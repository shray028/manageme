import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

export type AppUser = { uid: string; name: string; email: string };

export const isTestMode = import.meta.env.VITE_E2E === '1';
const TEST_USER_KEY = 'manageme:e2e:user';
const listeners = new Set<() => void>();

function readTestUser(): AppUser | null {
  try {
    return JSON.parse(localStorage.getItem(TEST_USER_KEY) || 'null');
  } catch {
    return null;
  }
}

/** Current signed-in person; `undefined` while still checking. */
export function useAppUser(): AppUser | null | undefined {
  const [user, setUser] = useState<AppUser | null | undefined>(isTestMode ? readTestUser() : undefined);
  useEffect(() => {
    if (isTestMode) {
      const update = () => setUser(readTestUser());
      listeners.add(update);
      return () => {
        listeners.delete(update);
      };
    }
    return onAuthStateChanged(auth, (next) =>
      setUser(next ? { uid: next.uid, name: next.displayName?.trim().split(/\s+/)[0] || next.email?.split('@')[0] || '', email: next.email ?? '' } : null),
    );
  }, []);
  return user;
}

export async function signIn() {
  if (isTestMode) {
    localStorage.setItem(TEST_USER_KEY, JSON.stringify({ uid: 'test-user', name: 'Tester', email: 'tester@example.com' }));
    listeners.forEach((listener) => listener());
    return;
  }
  await signInWithPopup(auth, googleProvider);
}

export async function signOut() {
  if (isTestMode) {
    localStorage.removeItem(TEST_USER_KEY);
    listeners.forEach((listener) => listener());
    return;
  }
  await firebaseSignOut(auth);
}
