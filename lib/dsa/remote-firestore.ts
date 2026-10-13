import {
  addDoc,
  collection as fsCollection,
  doc,
  getDocs,
  getDocsFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Collection, Doc } from './sync';
import { plain, type DsaRemote, type ServerDoc } from './remote';

const COLLECTIONS: Collection[] = ['dsaProgress', 'dsaLists'];

export function createFirestoreRemote(uid: string): DsaRemote {
  const col = (name: Collection) => fsCollection(db, 'users', uid, name);

  return {
    async write(collection, id, patch) {
      await setDoc(doc(db, 'users', uid, collection, id), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
    },

    async writeHistory(collection, id, snapshot) {
      await addDoc(fsCollection(db, 'users', uid, collection, id, 'history'), { ...snapshot, createdAt: serverTimestamp() });
    },

    async load() {
      const out: ServerDoc[] = [];
      for (const name of COLLECTIONS) {
        let snapshot;
        try {
          // Prefer the server so we never start from a stale cache…
          snapshot = await getDocsFromServer(col(name));
        } catch (error) {
          const code = (error as { code?: string })?.code;
          if (code === 'permission-denied' || code === 'unauthenticated') throw error;
          // …but if we are offline, the local cache is better than nothing.
          snapshot = await getDocs(col(name));
        }
        snapshot.forEach((item) => out.push({ collection: name, id: item.id, data: plain(item.data()) as Doc }));
      }
      return out;
    },

    watch(onDoc, onError) {
      const stops = COLLECTIONS.map((name) =>
        onSnapshot(
          col(name),
          { includeMetadataChanges: false },
          (snapshot) => {
            // Our own not-yet-confirmed writes are already applied locally.
            if (snapshot.metadata.hasPendingWrites) return;
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'removed') return;
              onDoc({ collection: name, id: change.doc.id, data: plain(change.doc.data()) as Doc });
            });
          },
          onError,
        ),
      );
      return () => stops.forEach((stop) => stop());
    },

    async listHistory(collection, id) {
      const snapshot = await getDocs(query(fsCollection(db, 'users', uid, collection, id, 'history'), orderBy('savedAt', 'desc'), limit(25)));
      return snapshot.docs.map((item) => {
        const data = plain(item.data()) as Doc;
        return { id: item.id, savedAt: Number(data.savedAt) || 0, reason: typeof data.reason === 'string' ? data.reason : '', data };
      });
    },
  };
}
