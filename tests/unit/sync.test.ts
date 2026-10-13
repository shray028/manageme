import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncEngine, type SyncOptions } from '@/lib/dsa/sync';
import { FakeBackend, MemoryStorage } from './helpers';

const TEXT = { dsaProgress: ['code', 'completedNote', 'revisedNote', 'mistake'] } as const;

function makeEngine(overrides: Partial<SyncOptions> & { backend: FakeBackend; storage: MemoryStorage }) {
  return new SyncEngine({
    uid: 'u1',
    tabId: 'tab-a',
    debounceMs: 500,
    writeTimeoutMs: 5_000,
    historyIntervalMs: 60_000,
    textFields: TEXT,
    isOnline: () => true,
    ...overrides,
  });
}

/** Let promises and timers settle. */
async function settle(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
  await vi.advanceTimersByTimeAsync(0);
}

describe('SyncEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T10:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('debounces edits into one merged write per document', async () => {
    const backend = new FakeBackend();
    const storage = new MemoryStorage();
    const engine = makeEngine({ backend, storage });
    engine.hydrate([]);
    engine.update('dsaProgress', 'two-sum', { code: 'a' });
    engine.update('dsaProgress', 'two-sum', { code: 'ab' });
    engine.update('dsaProgress', 'two-sum', { completed: true });
    expect(backend.calls).toHaveLength(0);
    await settle(600);
    expect(backend.calls).toHaveLength(1);
    expect(backend.calls[0].patch).toMatchObject({ code: 'ab', completed: true });
    expect(engine.getStatus().state).toBe('saved');
    expect(engine.hasUnsavedChanges()).toBe(false);
  });

  it('writes the journal synchronously on every edit and clears it only after the server confirms', async () => {
    const backend = new FakeBackend();
    backend.mode = 'hang';
    const storage = new MemoryStorage();
    const engine = makeEngine({ backend, storage });
    engine.hydrate([]);
    engine.update('dsaProgress', 'two-sum', { code: 'print(1)' });
    const journalKey = 'manageme:dsa:journal:v1:u1:tab-a';
    expect(JSON.parse(storage.getItem(journalKey)!).entries[0].patch.code).toBe('print(1)');
    await settle(600);
    expect(backend.calls).toHaveLength(1);
    expect(storage.getItem(journalKey)).not.toBeNull(); // still unconfirmed
    backend.hanging.shift()!();
    await settle();
    expect(storage.getItem(journalKey)).toBeNull();
  });

  it('keeps retrying with backoff after failures and never loses the edit', async () => {
    const backend = new FakeBackend();
    backend.failNext = 3;
    const storage = new MemoryStorage();
    const engine = makeEngine({ backend, storage });
    engine.hydrate([]);
    engine.update('dsaProgress', 'p', { mistake: 'off by one' });
    await settle(600);
    expect(engine.getStatus().state).toBe('retrying');
    await settle(1000); // retry 1
    await settle(2000); // retry 2
    await settle(4000); // retry 3 succeeds
    expect(backend.docs.get('dsaProgress/p')).toMatchObject({ mistake: 'off by one' });
    expect(engine.getStatus().state).toBe('saved');
    expect(storage.length).toBe(0);
  });

  it('does not let a failed older write overwrite a newer edit made while it was in flight', async () => {
    const backend = new FakeBackend();
    backend.failNext = 1;
    const storage = new MemoryStorage();
    const engine = makeEngine({ backend, storage });
    engine.hydrate([]);
    engine.update('dsaProgress', 'p', { code: 'v1', completed: true });
    await vi.advanceTimersByTimeAsync(500); // write v1 starts and fails
    engine.update('dsaProgress', 'p', { code: 'v2' });
    await settle(5000);
    expect(backend.docs.get('dsaProgress/p')).toMatchObject({ code: 'v2', completed: true });
    expect(engine.get('dsaProgress', 'p')).toMatchObject({ code: 'v2', completed: true });
  });

  it('only sends changed fields, so two devices editing different fields do not clobber each other', async () => {
    const backend = new FakeBackend();
    backend.docs.set('dsaProgress/p', { code: 'server code', revisedNote: 'from phone', clientUpdatedAt: 1 });
    const storage = new MemoryStorage();
    const engine = makeEngine({ backend, storage });
    engine.hydrate(backend.serverDocs());
    engine.update('dsaProgress', 'p', { completed: true });
    await settle(600);
    expect(Object.keys(backend.calls[0].patch).sort()).toEqual(['clientUpdatedAt', 'completed']);
    expect(backend.docs.get('dsaProgress/p')).toMatchObject({ code: 'server code', revisedNote: 'from phone', completed: true });
  });

  it('recovers this tab’s unsaved edits after a reload', async () => {
    const backend = new FakeBackend();
    backend.mode = 'fail';
    const storage = new MemoryStorage();
    const first = makeEngine({ backend, storage });
    first.hydrate([]);
    first.update('dsaProgress', 'p', { code: 'precious' });
    await settle(600);
    first.dispose(); // tab reloaded / closed

    backend.mode = 'ok';
    const second = makeEngine({ backend, storage });
    second.hydrate(backend.serverDocs());
    expect(second.get('dsaProgress', 'p')).toMatchObject({ code: 'precious' });
    await settle(600);
    expect(backend.docs.get('dsaProgress/p')).toMatchObject({ code: 'precious' });
    expect(storage.length).toBe(0);
  });

  it('adopts journals from closed tabs but leaves a live tab’s journal alone', async () => {
    const backend = new FakeBackend();
    const storage = new MemoryStorage();
    const now = Date.now();
    storage.setItem(
      'manageme:dsa:journal:v1:u1:dead-tab',
      JSON.stringify({ v: 1, uid: 'u1', heartbeat: now - 120_000, entries: [{ collection: 'dsaProgress', id: 'a', patch: { code: 'dead', clientUpdatedAt: now - 120_000 }, clientTs: now - 120_000 }] }),
    );
    storage.setItem(
      'manageme:dsa:journal:v1:u1:live-tab',
      JSON.stringify({ v: 1, uid: 'u1', heartbeat: now - 1_000, entries: [{ collection: 'dsaProgress', id: 'b', patch: { code: 'live', clientUpdatedAt: now - 1000 }, clientTs: now - 1000 }] }),
    );
    storage.setItem(
      'manageme:dsa:journal:v1:someone-else:x',
      JSON.stringify({ v: 1, uid: 'someone-else', heartbeat: 0, entries: [{ collection: 'dsaProgress', id: 'c', patch: { code: 'not mine' }, clientTs: 0 }] }),
    );
    const engine = makeEngine({ backend, storage });
    engine.hydrate([]);
    await settle(600);
    expect(backend.docs.get('dsaProgress/a')).toMatchObject({ code: 'dead' });
    expect(backend.docs.has('dsaProgress/b')).toBe(false);
    expect(backend.docs.has('dsaProgress/c')).toBe(false);
    expect(storage.getItem('manageme:dsa:journal:v1:u1:dead-tab')).toBeNull();
    expect(storage.getItem('manageme:dsa:journal:v1:u1:live-tab')).not.toBeNull();
    expect(storage.getItem('manageme:dsa:journal:v1:someone-else:x')).not.toBeNull();
  });

  it('saves a stale leftover draft to history instead of overwriting a newer server edit', async () => {
    const backend = new FakeBackend();
    const storage = new MemoryStorage();
    const now = Date.now();
    backend.docs.set('dsaProgress/p', { code: 'newer from laptop', clientUpdatedAt: now - 1000 });
    storage.setItem(
      'manageme:dsa:journal:v1:u1:old-tab',
      JSON.stringify({ v: 1, uid: 'u1', heartbeat: now - 600_000, entries: [{ collection: 'dsaProgress', id: 'p', patch: { code: 'old draft', clientUpdatedAt: now - 600_000 }, clientTs: now - 600_000 }] }),
    );
    const engine = makeEngine({ backend, storage });
    engine.hydrate(backend.serverDocs());
    await settle(600);
    expect(backend.docs.get('dsaProgress/p')).toMatchObject({ code: 'newer from laptop' });
    expect(backend.history).toHaveLength(1);
    expect(backend.history[0].snapshot).toMatchObject({ code: 'old draft', reason: 'unsynced-draft-from-older-session' });
  });

  it('snapshots the previous text before a large deletion', async () => {
    const backend = new FakeBackend();
    const long = 'x'.repeat(500);
    backend.docs.set('dsaProgress/p', { code: long, clientUpdatedAt: 1 });
    const storage = new MemoryStorage();
    const engine = makeEngine({ backend, storage });
    engine.hydrate(backend.serverDocs());
    engine.update('dsaProgress', 'p', { code: '' });
    await settle(600);
    expect(backend.history[0].snapshot).toMatchObject({ code: long, reason: 'before-large-deletion' });
    expect(backend.docs.get('dsaProgress/p')).toMatchObject({ code: '' });
  });

  it('limits periodic history snapshots to the configured interval', async () => {
    const backend = new FakeBackend();
    backend.docs.set('dsaProgress/p', { code: 'start', clientUpdatedAt: 1 });
    const storage = new MemoryStorage();
    const engine = makeEngine({ backend, storage });
    engine.hydrate(backend.serverDocs());
    for (let i = 0; i < 5; i += 1) {
      engine.update('dsaProgress', 'p', { code: `start ${i}` });
      await settle(600);
    }
    expect(backend.history).toHaveLength(1);
    await settle(60_000);
    engine.update('dsaProgress', 'p', { code: 'later' });
    await settle(600);
    expect(backend.history).toHaveLength(2);
  });

  it('reports permission problems clearly and keeps the data on the device', async () => {
    const backend = new FakeBackend();
    backend.mode = 'deny';
    const storage = new MemoryStorage();
    const engine = makeEngine({ backend, storage });
    engine.hydrate([]);
    engine.update('dsaProgress', 'p', { code: 'x' });
    await settle(600);
    expect(engine.getStatus().state).toBe('blocked');
    expect(engine.getStatus().message).toMatch(/permission/i);
    expect(storage.length).toBe(1);
  });

  it('waits while offline and saves once retried online', async () => {
    const backend = new FakeBackend();
    const storage = new MemoryStorage();
    let online = false;
    const engine = makeEngine({ backend, storage, isOnline: () => online });
    engine.hydrate([]);
    engine.update('dsaProgress', 'p', { code: 'offline edit' });
    await settle(600);
    expect(backend.calls).toHaveLength(0);
    expect(engine.getStatus().state).toBe('offline');
    online = true;
    await engine.retryNow();
    await settle();
    expect(backend.docs.get('dsaProgress/p')).toMatchObject({ code: 'offline edit' });
  });

  it('treats a hung write as unconfirmed, keeps the journal, and retries', async () => {
    const backend = new FakeBackend();
    backend.mode = 'hang';
    const storage = new MemoryStorage();
    const engine = makeEngine({ backend, storage });
    engine.hydrate([]);
    engine.update('dsaProgress', 'p', { code: 'slow' });
    await settle(600);
    await settle(5_000); // write timeout
    expect(engine.getStatus().state).toBe('retrying');
    expect(storage.length).toBe(1);
    backend.mode = 'ok';
    await settle(1_000);
    expect(backend.docs.get('dsaProgress/p')).toMatchObject({ code: 'slow' });
  });

  it('still saves to the server when the browser refuses local storage', async () => {
    const backend = new FakeBackend();
    const storage = new MemoryStorage();
    storage.failWrites = true;
    const engine = makeEngine({ backend, storage });
    engine.hydrate([]);
    expect(engine.getStatus().deviceBackup).toBe(false);
    engine.update('dsaProgress', 'p', { code: 'y' });
    await settle(600);
    expect(backend.docs.get('dsaProgress/p')).toMatchObject({ code: 'y' });
  });

  it('remote updates do not override fields the person is still editing', async () => {
    const backend = new FakeBackend();
    backend.mode = 'hang';
    const storage = new MemoryStorage();
    const engine = makeEngine({ backend, storage });
    engine.hydrate([]);
    engine.update('dsaProgress', 'p', { code: 'typing…' });
    engine.applyRemote('dsaProgress', 'p', { code: 'other device', mistake: 'from other device' });
    expect(engine.get('dsaProgress', 'p')).toMatchObject({ code: 'typing…', mistake: 'from other device' });
  });

  it('strips undefined values that Firestore would reject', async () => {
    const backend = new FakeBackend();
    const storage = new MemoryStorage();
    const engine = makeEngine({ backend, storage });
    engine.hydrate([]);
    engine.update('dsaProgress', 'p', { code: 'z', title: undefined, links: [{ id: '1', label: 'v', url: 'https://x.y', note: undefined }] });
    await settle(600);
    expect('title' in backend.calls[0].patch).toBe(false);
    expect(backend.calls[0].patch.links).toEqual([{ id: '1', label: 'v', url: 'https://x.y' }]);
  });
});
