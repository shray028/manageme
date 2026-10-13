import type { Collection, Doc, SyncBackend } from './sync';

export type ServerDoc = { collection: Collection; id: string; data: Doc };
export type HistoryEntry = { id: string; savedAt: number; reason: string; data: Doc };

/** Everything the DSA tracker needs from a server. Firestore in production, a local fake in tests. */
export interface DsaRemote extends SyncBackend {
  load(): Promise<ServerDoc[]>;
  /** Live updates from other tabs/devices. Returns an unsubscribe function. */
  watch(onDoc: (doc: ServerDoc) => void, onError: (error: unknown) => void): () => void;
  listHistory(collection: Collection, id: string): Promise<HistoryEntry[]>;
}

/** Firestore Timestamps → plain millis, so data can be journaled and exported as JSON. */
export function plain(value: unknown): unknown {
  if (value && typeof value === 'object') {
    if (typeof (value as { toMillis?: unknown }).toMillis === 'function') return (value as { toMillis: () => number }).toMillis();
    if (Array.isArray(value)) return value.map(plain);
    const out: Doc = {};
    for (const [key, item] of Object.entries(value)) out[key] = plain(item);
    return out;
  }
  return value;
}
