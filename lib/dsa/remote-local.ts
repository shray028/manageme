/**
 * A stand-in server kept in localStorage. Only used for automated browser tests and local demos
 * (VITE_E2E=1); production always uses Firestore. Tests can make it fail or deny writes via
 * window.__manageMeTest so we can prove the app keeps data safe when the server misbehaves.
 */
import type { Collection, Doc } from './sync';
import type { DsaRemote, ServerDoc } from './remote';

type Controls = { mode: 'ok' | 'fail' | 'deny' | 'slow' | 'fail-load'; writes: number };

declare global {
  interface Window {
    __manageMeTest?: Controls;
  }
}

const KEY = 'manageme:e2e:server:v1';

function readAll(): Record<string, Doc> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

export function createLocalRemote(uid: string): DsaRemote {
  const initialMode = (localStorage.getItem('manageme:e2e:mode') as Controls['mode'] | null) ?? 'ok';
  const controls: Controls = (window.__manageMeTest ??= { mode: initialMode, writes: 0 });
  const listeners = new Set<(doc: ServerDoc) => void>();
  const prefix = `users/${uid}/`;

  const gate = async () => {
    if (controls.mode === 'fail') throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
    if (controls.mode === 'deny') throw Object.assign(new Error('denied'), { code: 'permission-denied' });
    if (controls.mode === 'slow') await new Promise((resolve) => setTimeout(resolve, 1500));
  };

  return {
    async write(collection: Collection, id: string, patch: Doc) {
      await gate();
      const all = readAll();
      const key = `${prefix}${collection}/${id}`;
      all[key] = { ...(all[key] ?? {}), ...structuredClone(patch), updatedAt: Date.now() };
      localStorage.setItem(KEY, JSON.stringify(all));
      controls.writes += 1;
    },
    async writeHistory(collection: Collection, id: string, snapshot: Doc) {
      await gate();
      const all = readAll();
      const key = `${prefix}${collection}/${id}/history/${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      all[key] = { ...structuredClone(snapshot) };
      localStorage.setItem(KEY, JSON.stringify(all));
    },
    async load() {
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (controls.mode === 'fail-load') throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
      const all = readAll();
      return Object.entries(all)
        .filter(([key]) => key.startsWith(prefix) && key.split('/').length === 4)
        .map(([key, data]) => {
          const [, , collection, id] = key.split('/');
          return { collection: collection as Collection, id, data };
        });
    },
    watch(onDoc) {
      listeners.add(onDoc);
      return () => listeners.delete(onDoc);
    },
    async listHistory(collection: Collection, id: string) {
      const all = readAll();
      const base = `${prefix}${collection}/${id}/history/`;
      return Object.entries(all)
        .filter(([key]) => key.startsWith(base))
        .map(([key, data]) => ({ id: key.slice(base.length), savedAt: Number(data.savedAt) || 0, reason: typeof data.reason === 'string' ? data.reason : '', data }))
        .sort((a, b) => b.savedAt - a.savedAt);
    },
  };
}
