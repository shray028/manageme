import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

// Firebase web configuration identifies this application; Firestore rules keep
// the actual productivity data private to the signed-in person.
const firebaseConfig = {
  apiKey: 'AIzaSyDY5XGc7X6ABSDHOnCXMaWPfgpvxtUueX0',
  authDomain: 'manageme-11386.firebaseapp.com',
  projectId: 'manageme-11386',
  storageBucket: 'manageme-11386.firebasestorage.app',
  messagingSenderId: '680669219075',
  appId: '1:680669219075:web:2daceeff2b08df04dd4136',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);

function createFirestore(): Firestore {
  try {
    // Keep a copy of the user's data in IndexedDB so the app works offline and queued writes
    // survive reloads. Works across several open tabs.
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
  } catch {
    try {
      // Private browsing or an old browser: fall back to an in-memory cache.
      return initializeFirestore(firebaseApp, { localCache: memoryLocalCache(), ignoreUndefinedProperties: true });
    } catch {
      // Already initialised (e.g. hot reload).
      return getFirestore(firebaseApp);
    }
  }
}

export const db = createFirestore();
export const googleProvider = new GoogleAuthProvider();
