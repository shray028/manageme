import type { Collection, Doc, KeyValueStore, SyncBackend } from '@/lib/dsa/sync';

export class MemoryStorage implements KeyValueStore {
  map = new Map<string, string>();
  failWrites = false;
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  get length() {
    return this.map.size;
  }
}

type Call = { collection: Collection; id: string; patch: Doc };

/** A fake server: stores merged docs, can fail, hang, or deny writes on demand. */
export class FakeBackend implements SyncBackend {
  docs = new Map<string, Doc>();
  history: Array<{ collection: Collection; id: string; snapshot: Doc }> = [];
  calls: Call[] = [];
  mode: 'ok' | 'fail' | 'deny' | 'hang' = 'ok';
  failNext = 0;
  hanging: Array<() => void> = [];

  async write(collection: Collection, id: string, patch: Doc) {
    this.calls.push({ collection, id, patch });
    if (this.failNext > 0) {
      this.failNext -= 1;
      throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
    }
    if (this.mode === 'fail') throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
    if (this.mode === 'deny') throw Object.assign(new Error('denied'), { code: 'permission-denied' });
    if (this.mode === 'hang') {
      await new Promise<void>((resolve) => this.hanging.push(resolve));
    }
    const key = `${collection}/${id}`;
    this.docs.set(key, { ...(this.docs.get(key) ?? {}), ...structuredClone(patch) });
  }

  async writeHistory(collection: Collection, id: string, snapshot: Doc) {
    if (this.mode === 'fail' || this.mode === 'deny') throw new Error('history failed');
    this.history.push({ collection, id, snapshot: structuredClone(snapshot) });
  }

  serverDocs() {
    return [...this.docs.entries()].map(([key, data]) => {
      const [collection, ...rest] = key.split('/');
      return { collection: collection as Collection, id: rest.join('/'), data: structuredClone(data) };
    });
  }
}
