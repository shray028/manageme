import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
