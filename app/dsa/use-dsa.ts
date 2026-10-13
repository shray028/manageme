import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { SyncEngine, type Collection, type Doc, type SyncStatus } from '@/lib/dsa/sync';
import { createLocalRemote } from '@/lib/dsa/remote-local';
import type { DsaRemote } from '@/lib/dsa/remote';
import { isTestMode, type AppUser } from '@/lib/dsa/auth';
import { TEXT_FIELDS } from '@/lib/dsa/types';

function tabId() {
  try {
    let id = sessionStorage.getItem('manageme:tab');
    if (!id) {
      id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem('manageme:tab', id);
    }
    return id;
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}

function safeLocalStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

async function makeRemote(uid: string): Promise<DsaRemote> {
  if (isTestMode) return createLocalRemote(uid);
  const { createFirestoreRemote } = await import('@/lib/dsa/remote-firestore');
  return createFirestoreRemote(uid);
}

export type DsaStore = {
  ready: boolean;
  loadError: string;
  status: SyncStatus;
  /** Bumps whenever any document changes; use it as a memo dependency. */
  version: number;
  get: (collection: Collection, id: string) => Doc | undefined;
  all: (collection: Collection) => Array<[string, Doc]>;
  update: (collection: Collection, id: string, patch: Doc) => void;
  flush: () => Promise<void>;
  retry: () => void;
  reload: () => void;
  remote: DsaRemote | null;
  snapshot: () => Record<Collection, Record<string, Doc>>;
};

export function useDsaStore(user: AppUser): DsaStore {
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [remote, setRemote] = useState<DsaRemote | null>(null);
  const engineRef = useRef<SyncEngine | null>(null);
  const versionRef = useRef(0);
  const subscribers = useRef(new Set<() => void>());
  const [status, setStatus] = useState<SyncStatus>({ state: 'idle', unsaved: 0, lastSavedAt: null, message: '', deviceBackup: true });

  const notify = useCallback(() => {
    versionRef.current += 1;
    subscribers.current.forEach((fn) => fn());
  }, []);

  const version = useSyncExternalStore(
    (fn) => {
      subscribers.current.add(fn);
      return () => subscribers.current.delete(fn);
    },
    () => versionRef.current,
  );

  useEffect(() => {
    let cancelled = false;
    let stopWatching: (() => void) | undefined;
    setReady(false);
    setLoadError('');
    void (async () => {
      try {
        const nextRemote = await makeRemote(user.uid);
        const docs = await nextRemote.load();
        if (cancelled) return;
        const engine = new SyncEngine({
          uid: user.uid,
          backend: nextRemote,
          storage: safeLocalStorage(),
          tabId: tabId(),
          textFields: { dsaProgress: TEXT_FIELDS },
        });
        engine.subscribe(setStatus);
        engine.onDocChange(notify);
        engine.hydrate(docs);
        engineRef.current = engine;
        setRemote(nextRemote);
        stopWatching = nextRemote.watch(
          ({ collection, id, data }) => engine.applyRemote(collection, id, data),
          () => undefined, // live updates are a nicety; saving does not depend on them
        );
        notify();
        setReady(true);
      } catch (error) {
        if (cancelled) return;
        const code = (error as { code?: string })?.code;
        setLoadError(
          code === 'permission-denied'
            ? 'Your DSA data could not be opened because the database refused access. Nothing has been changed. Try signing out and in again.'
            : 'Your DSA data could not be loaded. Nothing has been changed. Check your connection and try again.',
        );
      }
    })();
    return () => {
      cancelled = true;
      stopWatching?.();
      const engine = engineRef.current;
      engineRef.current = null;
      if (engine) {
        void engine.flush().finally(() => engine.dispose());
      }
    };
  }, [user.uid, attempt, notify]);

  // Keep saves moving: retry when the network returns, save when the tab is hidden, and warn before
  // closing the tab while something is still unsaved.
  useEffect(() => {
    const online = () => void engineRef.current?.retryNow();
    const hidden = () => {
      if (document.visibilityState === 'hidden') void engineRef.current?.flush();
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const engine = engineRef.current;
      if (!engine?.hasUnsavedChanges()) return;
      void engine.flush();
      event.preventDefault();
      event.returnValue = '';
    };
    const heartbeat = window.setInterval(() => engineRef.current?.heartbeat(), 10_000);
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, []);

  const api = useMemo(
    () => ({
      get: (collection: Collection, id: string) => engineRef.current?.get(collection, id),
      all: (collection: Collection) => engineRef.current?.all(collection) ?? [],
      update: (collection: Collection, id: string, patch: Doc) => {
        engineRef.current?.update(collection, id, patch);
      },
      flush: () => engineRef.current?.flush() ?? Promise.resolve(),
      retry: () => void engineRef.current?.retryNow(),
      reload: () => setAttempt((value) => value + 1),
      snapshot: () => engineRef.current?.snapshot() ?? { dsaProgress: {}, dsaLists: {} },
    }),
    [],
  );

  return { ...api, ready, loadError, status, version, remote };
}
