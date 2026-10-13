/**
 * Local-first save engine for DSA data.
 *
 * Guarantees, in order of importance:
 *  1. Every edit is written to a per-tab journal in localStorage *synchronously*, before anything
 *     else happens. Closing the tab, a crash, or losing the network cannot lose it.
 *  2. Writes are field-level merges, so two tabs/devices editing different fields never clobber
 *     each other, and a failed write never touches data it was not changing.
 *  3. Failed writes are retried with backoff until they succeed; the journal entry is only removed
 *     after the server has acknowledged that exact version.
 *  4. On the next load, journals left behind by closed tabs are replayed. If the server already has
 *     a newer edit from another device, the leftover draft is saved to history instead of being
 *     dropped or overwriting the newer value.
 *  5. Before text is overwritten, the previous version is snapshotted to history (at most every
 *     few minutes, and always before a large deletion), so mistakes can be undone.
 */

export type Collection = 'dsaProgress' | 'dsaLists';
export type Doc = Record<string, unknown>;

export interface SyncBackend {
  write(collection: Collection, id: string, patch: Doc): Promise<void>;
  writeHistory(collection: Collection, id: string, snapshot: Doc): Promise<void>;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

export type SyncStatus = {
  state: 'idle' | 'saving' | 'saved' | 'retrying' | 'offline' | 'blocked';
  /** Number of documents with changes the server has not confirmed yet. */
  unsaved: number;
  lastSavedAt: number | null;
  message: string;
  /** False when the browser refused to keep a local backup (private mode, storage full). */
  deviceBackup: boolean;
};

type Entry = { collection: Collection; id: string; patch: Doc; clientTs: number; version: number };

type JournalFile = {
  v: 1;
  uid: string;
  heartbeat: number;
  entries: Array<{ collection: Collection; id: string; patch: Doc; clientTs: number }>;
};

export type SyncOptions = {
  uid: string;
  backend: SyncBackend;
  storage: KeyValueStore | null;
  tabId: string;
  now?: () => number;
  isOnline?: () => boolean;
  debounceMs?: number;
  writeTimeoutMs?: number;
  /** Journals from other tabs are treated as abandoned when their heartbeat is older than this. */
  staleTabMs?: number;
  historyIntervalMs?: number;
  textFields?: Partial<Record<Collection, readonly string[]>>;
  timers?: {
    setTimeout: (fn: () => void, ms: number) => unknown;
    clearTimeout: (handle: unknown) => void;
  };
};

const JOURNAL_PREFIX = 'manageme:dsa:journal:v1:';
const docKey = (collection: Collection, id: string) => `${collection}/${id}`;

export class WriteTimeoutError extends Error {
  constructor() {
    super('The save is taking longer than expected.');
  }
}

export function stripUndefined(doc: Doc): Doc {
  const out: Doc = {};
  for (const [key, value] of Object.entries(doc)) {
    if (value === undefined) continue;
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype)
      out[key] = stripUndefined(value as Doc);
    else if (Array.isArray(value)) out[key] = value.map((item) => (item && typeof item === 'object' && !Array.isArray(item) ? stripUndefined(item as Doc) : item));
    else out[key] = value;
  }
  return out;
}

const textLength = (doc: Doc | undefined, fields: readonly string[]) =>
  fields.reduce((total, field) => total + (typeof doc?.[field] === 'string' ? (doc[field] as string).length : 0), 0);

function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) return String((error as { code: unknown }).code);
  return '';
}

export class SyncEngine {
  private readonly opts: Required<Omit<SyncOptions, 'storage' | 'textFields'>> & {
    storage: KeyValueStore | null;
    textFields: Partial<Record<Collection, readonly string[]>>;
  };
  /** Latest local view of each document (server data + every local edit). */
  private readonly docs = new Map<string, Doc>();
  /** Last version the server confirmed. Used for history snapshots. */
  private readonly confirmed = new Map<string, Doc>();
  private readonly pending = new Map<string, Entry>();
  private readonly inflight = new Map<string, Entry>();
  private readonly lastHistoryAt = new Map<string, number>();
  private readonly listeners = new Set<(status: SyncStatus) => void>();
  private readonly docListeners = new Set<(collection: Collection, id: string, doc: Doc) => void>();
  private flushTimer: unknown = null;
  private retryTimer: unknown = null;
  private retryDelay = 1000;
  private versionCounter = 0;
  private journalOk = true;
  private disposed = false;
  private status: SyncStatus = { state: 'idle', unsaved: 0, lastSavedAt: null, message: '', deviceBackup: true };

  constructor(options: SyncOptions) {
    this.opts = {
      now: () => Date.now(),
      isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
      debounceMs: 700,
      writeTimeoutMs: 20_000,
      staleTabMs: 45_000,
      historyIntervalMs: 10 * 60_000,
      textFields: {},
      timers: {
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      },
      ...options,
    } as SyncEngine['opts'];
    this.journalOk = this.probeStorage();
    this.status.deviceBackup = this.journalOk;
  }

  // ---------------------------------------------------------------- public API

  subscribe(listener: (status: SyncStatus) => void) {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  onDocChange(listener: (collection: Collection, id: string, doc: Doc) => void) {
    this.docListeners.add(listener);
    return () => this.docListeners.delete(listener);
  }

  getStatus() {
    return this.status;
  }

  get(collection: Collection, id: string): Doc | undefined {
    return this.docs.get(docKey(collection, id));
  }

  all(collection: Collection): Array<[string, Doc]> {
    const prefix = `${collection}/`;
    return [...this.docs.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, doc]) => [key.slice(prefix.length), doc]);
  }

  hasUnsavedChanges() {
    return this.pending.size > 0 || this.inflight.size > 0;
  }

  /**
   * Seed the engine with what the server returned, then recover any journal left behind by this
   * tab (e.g. after a reload) or by tabs that were closed before their saves finished.
   */
  hydrate(serverDocs: Array<{ collection: Collection; id: string; data: Doc }>) {
    for (const { collection, id, data } of serverDocs) {
      const key = docKey(collection, id);
      this.confirmed.set(key, { ...data });
      this.docs.set(key, { ...data });
    }
    this.recoverJournals();
    this.emitStatus();
  }

  /** Apply a change pushed by the server (another tab or device). Local unsaved fields win. */
  applyRemote(collection: Collection, id: string, data: Doc) {
    const key = docKey(collection, id);
    this.confirmed.set(key, { ...data });
    const local = { ...data, ...(this.inflight.get(key)?.patch ?? {}), ...(this.pending.get(key)?.patch ?? {}) };
    this.docs.set(key, local);
    this.emitDoc(collection, id, local);
  }

  /** Record a local edit. Returns the new local document. Never throws for storage problems. */
  update(collection: Collection, id: string, rawPatch: Doc): Doc {
    if (this.disposed) throw new Error('This page was signed out. Reload to keep editing.');
    const key = docKey(collection, id);
    const clientTs = this.monotonicNow();
    const patch = stripUndefined({ ...rawPatch, clientUpdatedAt: clientTs });
    const next = { ...(this.docs.get(key) ?? {}), ...patch };
    this.docs.set(key, next);
    const existing = this.pending.get(key);
    this.pending.set(key, {
      collection,
      id,
      patch: { ...(existing?.patch ?? {}), ...patch },
      clientTs,
      version: ++this.versionCounter,
    });
    this.persistJournal();
    this.emitDoc(collection, id, next);
    this.scheduleFlush();
    this.emitStatus();
    return next;
  }

  /** Save everything now (used on blur, on "Save now", and before leaving the page). */
  async flush(): Promise<void> {
    if (this.flushTimer) {
      this.opts.timers.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.disposed) return;
    const ready = [...this.pending.entries()].filter(([key]) => !this.inflight.has(key));
    if (!ready.length) {
      this.emitStatus();
      return;
    }
    if (!this.opts.isOnline()) {
      this.setState('offline', 'You are offline. Changes are kept on this device and will save when you reconnect.');
      return;
    }
    this.setState('saving', '');
    await Promise.all(ready.map(([key, entry]) => this.send(key, entry)));
  }

  /** Retry immediately (e.g. the browser came back online, or the person pressed "Retry"). */
  retryNow() {
    if (this.retryTimer) {
      this.opts.timers.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.retryDelay = 1000;
    return this.flush();
  }

  /** Stop all timers. Unsaved edits stay in the journal and are recovered on the next load. */
  dispose() {
    this.disposed = true;
    if (this.flushTimer) this.opts.timers.clearTimeout(this.flushTimer);
    if (this.retryTimer) this.opts.timers.clearTimeout(this.retryTimer);
    this.listeners.clear();
    this.docListeners.clear();
  }

  /** Everything currently known, for backups/exports. */
  snapshot(): Record<Collection, Record<string, Doc>> {
    const out: Record<Collection, Record<string, Doc>> = { dsaProgress: {}, dsaLists: {} };
    for (const [key, doc] of this.docs) {
      const [collection, ...rest] = key.split('/');
      (out[collection as Collection] ??= {})[rest.join('/')] = doc;
    }
    return out;
  }

  // ---------------------------------------------------------------- internals

  private monotonicNow() {
    const now = this.opts.now();
    // Make sure two edits in the same millisecond still order correctly.
    const last = this.lastTs ?? 0;
    this.lastTs = now > last ? now : last + 1;
    return this.lastTs;
  }
  private lastTs: number | undefined;

  private scheduleFlush() {
    if (this.flushTimer) this.opts.timers.clearTimeout(this.flushTimer);
    this.flushTimer = this.opts.timers.setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, this.opts.debounceMs);
  }

  private async send(key: string, entry: Entry) {
    this.pending.delete(key);
    this.inflight.set(key, entry);
    try {
      // History runs alongside the real write; it can never delay or block it.
      void this.maybeSnapshotHistory(key, entry);
      await this.withTimeout(this.opts.backend.write(entry.collection, entry.id, entry.patch));
      this.inflight.delete(key);
      this.confirmed.set(key, { ...(this.confirmed.get(key) ?? {}), ...entry.patch });
      this.retryDelay = 1000;
      this.persistJournal();
      if (!this.pending.size && !this.inflight.size) {
        this.status.lastSavedAt = this.opts.now();
        this.setState('saved', '');
      } else {
        this.emitStatus();
        if (this.pending.has(key)) this.scheduleFlush();
      }
    } catch (error) {
      this.inflight.delete(key);
      // Put the failed patch back underneath anything newer the person typed meanwhile.
      const newer = this.pending.get(key);
      this.pending.set(key, newer ? { ...newer, patch: { ...entry.patch, ...newer.patch } } : entry);
      this.persistJournal();
      const code = errorCode(error);
      if (code === 'permission-denied' || code === 'unauthenticated') {
        this.setState(
          'blocked',
          'The server refused this save (permission denied). Your changes are safe on this device. Sign in again, or ask the site owner to update the database rules.',
        );
        this.scheduleRetry(60_000);
      } else if (!this.opts.isOnline()) {
        this.setState('offline', 'You are offline. Changes are kept on this device and will save when you reconnect.');
        this.scheduleRetry(5_000);
      } else {
        this.setState('retrying', 'Couldn’t reach the server. Your changes are kept on this device and will keep retrying.');
        this.scheduleRetry(this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, 60_000);
      }
    }
  }

  private scheduleRetry(ms: number) {
    if (this.retryTimer || this.disposed) return;
    this.retryTimer = this.opts.timers.setTimeout(() => {
      this.retryTimer = null;
      void this.flush();
    }, ms);
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const handle = this.opts.timers.setTimeout(() => reject(new WriteTimeoutError()), this.opts.writeTimeoutMs);
      promise.then(
        (value) => {
          this.opts.timers.clearTimeout(handle);
          resolve(value);
        },
        (error) => {
          this.opts.timers.clearTimeout(handle);
          reject(error);
        },
      );
    });
  }

  private async maybeSnapshotHistory(key: string, entry: Entry) {
    const fields = this.opts.textFields[entry.collection];
    if (!fields?.length) return;
    if (!fields.some((field) => field in entry.patch)) return;
    const before = this.confirmed.get(key);
    const beforeLength = textLength(before, fields);
    if (!before || beforeLength === 0) return;
    const after = { ...before, ...entry.patch };
    const changed = fields.some((field) => (before[field] ?? '') !== (after[field] ?? ''));
    if (!changed) return;
    const bigDeletion = beforeLength >= 120 && textLength(after, fields) < beforeLength * 0.5;
    const last = this.lastHistoryAt.get(key) ?? 0;
    if (!bigDeletion && this.opts.now() - last < this.opts.historyIntervalMs) return;
    const snapshot: Doc = { savedAt: this.opts.now(), reason: bigDeletion ? 'before-large-deletion' : 'periodic' };
    for (const field of fields) snapshot[field] = before[field] ?? '';
    if ('links' in before) snapshot.links = before.links;
    this.lastHistoryAt.set(key, this.opts.now());
    try {
      await this.withTimeout(this.opts.backend.writeHistory(entry.collection, entry.id, stripUndefined(snapshot)));
    } catch {
      // History is a safety net; failing to write it must never block saving the actual change.
      this.lastHistoryAt.set(key, last);
    }
  }

  // ---------------------------------------------------------------- journal

  private journalKey(tabId = this.opts.tabId) {
    return `${JOURNAL_PREFIX}${this.opts.uid}:${tabId}`;
  }

  private probeStorage() {
    const storage = this.opts.storage;
    if (!storage) return false;
    try {
      const probe = `${JOURNAL_PREFIX}probe`;
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }

  private persistJournal() {
    const storage = this.opts.storage;
    if (!storage) return;
    const entries = [...this.inflight.values(), ...this.pending.values()];
    // Merge inflight + pending for the same doc so the journal always holds the newest full patch.
    const merged = new Map<string, JournalFile['entries'][number]>();
    for (const entry of entries) {
      const key = docKey(entry.collection, entry.id);
      const existing = merged.get(key);
      merged.set(key, {
        collection: entry.collection,
        id: entry.id,
        patch: { ...(existing?.patch ?? {}), ...entry.patch },
        clientTs: Math.max(existing?.clientTs ?? 0, entry.clientTs),
      });
    }
    try {
      if (!merged.size) storage.removeItem(this.journalKey());
      else {
        const file: JournalFile = { v: 1, uid: this.opts.uid, heartbeat: this.opts.now(), entries: [...merged.values()] };
        storage.setItem(this.journalKey(), JSON.stringify(file));
        // Only a successful write proves the device backup works again.
        this.journalOk = true;
        this.status.deviceBackup = true;
      }
    } catch {
      this.journalOk = false;
      this.status.deviceBackup = false;
    }
  }

  private readJournals(): Array<{ storageKey: string; file: JournalFile; own: boolean }> {
    const storage = this.opts.storage;
    if (!storage) return [];
    const prefix = `${JOURNAL_PREFIX}${this.opts.uid}:`;
    const found: Array<{ storageKey: string; file: JournalFile; own: boolean }> = [];
    try {
      const keys: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key?.startsWith(prefix)) keys.push(key);
      }
      for (const storageKey of keys) {
        const raw = storage.getItem(storageKey);
        if (!raw) continue;
        try {
          const file = JSON.parse(raw) as JournalFile;
          if (file?.v !== 1 || !Array.isArray(file.entries)) continue;
          found.push({ storageKey, file, own: storageKey === this.journalKey() });
        } catch {
          // A corrupt journal is left in place (never deleted) so it can be inspected/recovered manually.
        }
      }
    } catch {
      return [];
    }
    return found;
  }

  private recoverJournals() {
    const journals = this.readJournals();
    for (const { storageKey, file, own } of journals) {
      const abandoned = own || this.opts.now() - (file.heartbeat ?? 0) > this.opts.staleTabMs;
      if (!abandoned) continue; // another open tab is still working on these
      for (const entry of file.entries) {
        if (entry.collection !== 'dsaProgress' && entry.collection !== 'dsaLists') continue;
        const key = docKey(entry.collection, entry.id);
        const server = this.confirmed.get(key);
        const serverTs = typeof server?.clientUpdatedAt === 'number' ? server.clientUpdatedAt : 0;
        const alreadySaved = server && Object.entries(entry.patch).every(([field, value]) => JSON.stringify(server[field]) === JSON.stringify(value));
        if (alreadySaved) continue;
        if (serverTs > entry.clientTs) {
          // Someone saved a newer version elsewhere. Keep this draft in history rather than lose it.
          void this.opts.backend
            .writeHistory(entry.collection, entry.id, { ...entry.patch, savedAt: this.opts.now(), reason: 'unsynced-draft-from-older-session' })
            .catch(() => undefined);
          continue;
        }
        const existing = this.pending.get(key);
        const patch = { ...(existing?.patch ?? {}), ...entry.patch };
        this.pending.set(key, { collection: entry.collection, id: entry.id, patch, clientTs: entry.clientTs, version: ++this.versionCounter });
        const next = { ...(this.docs.get(key) ?? {}), ...patch };
        this.docs.set(key, next);
      }
      if (!own) {
        try {
          this.opts.storage?.removeItem(storageKey);
        } catch {
          /* ignore */
        }
      }
    }
    this.persistJournal();
    if (this.pending.size) this.scheduleFlush();
  }

  /** Keep this tab's journal marked as alive so other tabs don't adopt it. */
  heartbeat() {
    if (this.pending.size || this.inflight.size) this.persistJournal();
  }

  // ---------------------------------------------------------------- status

  private setState(state: SyncStatus['state'], message: string) {
    this.status = { ...this.status, state, message };
    this.emitStatus();
  }

  private emitStatus() {
    const unsaved = new Set([...this.pending.keys(), ...this.inflight.keys()]).size;
    let { state, message } = this.status;
    if (unsaved && (state === 'saved' || state === 'idle')) state = 'saving';
    if (!unsaved && (state === 'saving' || state === 'retrying' || state === 'offline' || state === 'blocked')) {
      state = 'saved';
      message = '';
    }
    this.status = { ...this.status, state, message, unsaved, deviceBackup: this.journalOk };
    for (const listener of this.listeners) listener(this.status);
  }

  private emitDoc(collection: Collection, id: string, doc: Doc) {
    for (const listener of this.docListeners) listener(collection, id, doc);
  }
}
