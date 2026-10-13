import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'manageme-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const anon = () => env.unauthenticatedContext().firestore();

describe('workspace document', () => {
  it('only the owner can read and write it', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice'), { tasks: [] }));
    await assertFails(getDoc(doc(bob(), 'users/alice')));
    await assertFails(setDoc(doc(bob(), 'users/alice'), { tasks: [] }));
    await assertFails(getDoc(doc(anon(), 'users/alice')));
  });
});

describe('DSA progress', () => {
  it('owner can save progress; others cannot read or write it', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/dsaProgress/two-sum'), { completed: true, code: 'x', links: null }, { merge: true }));
    await assertFails(getDoc(doc(bob(), 'users/alice/dsaProgress/two-sum')));
    await assertFails(setDoc(doc(bob(), 'users/alice/dsaProgress/two-sum'), { completed: false }, { merge: true }));
  });

  it('rejects oversized or wrongly-typed fields', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice/dsaProgress/p'), { code: 'x'.repeat(100_001) }));
    await assertFails(setDoc(doc(alice(), 'users/alice/dsaProgress/p'), { completed: 'yes' }));
  });

  it('progress can never be deleted from the app', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/dsaProgress/p'), { completed: true }));
    await assertFails(deleteDoc(doc(alice(), 'users/alice/dsaProgress/p')));
  });

  it('history is append-only', async () => {
    const ref = await assertSucceeds(addDoc(collection(alice(), 'users/alice/dsaProgress/p/history'), { code: 'old', savedAt: 1 }));
    await assertFails(updateDoc(ref, { code: 'tampered' }));
    await assertFails(deleteDoc(ref));
    await assertFails(addDoc(collection(bob(), 'users/alice/dsaProgress/p/history'), { code: 'x' }));
  });
});

describe('DSA lists', () => {
  it('owner can create and archive; nobody can delete', async () => {
    const ref = doc(alice(), 'users/alice/dsaLists/l1');
    await assertSucceeds(setDoc(ref, { title: 'Mine', source: { kind: 'custom' }, extraProblems: [], hiddenKeys: [], archived: false }));
    await assertSucceeds(setDoc(ref, { archived: true }, { merge: true }));
    await assertFails(deleteDoc(ref));
    await assertFails(getDoc(doc(bob(), 'users/alice/dsaLists/l1')));
  });
});
