// @vitest-environment jsdom
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const user = { uid: 'u1', displayName: 'Asha Rao', email: 'asha@example.com' };
const state = vi.hoisted(() => ({
  doc: null as null | Record<string, unknown>,
  failLoad: false,
  writes: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/firebase', () => ({ auth: {}, db: {}, firebaseApp: {}, googleProvider: {} }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (u: unknown) => void) => {
    setTimeout(() => callback(user), 0);
    return () => undefined;
  },
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('firebase/storage', () => ({ getStorage: vi.fn(), ref: vi.fn(), uploadBytes: vi.fn(), getDownloadURL: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  doc: () => ({}),
  serverTimestamp: () => 'ts',
  getDoc: async () => {
    if (state.failLoad) throw new Error('offline');
    return { exists: () => Boolean(state.doc), data: () => state.doc };
  },
  setDoc: async (_ref: unknown, data: Record<string, unknown>) => {
    state.writes.push(data);
  },
}));

import Home from '@/app/page';

window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

async function renderHome() {
  render(<Home />);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe('workspace', () => {
  beforeEach(() => {
    state.doc = null;
    state.failLoad = false;
    state.writes = [];
    window.localStorage.clear();
  });
  afterEach(() => cleanup());

  it('starts a brand-new account empty, with no one else’s tasks or calendar', async () => {
    await renderHome();
    const text = document.body.textContent ?? '';
    for (const leftover of ['Call Mom', 'Engineering standup', 'Client sync', 'No phone until', 'September 3', 'Become interview-ready', 'DSA mastery']) {
      expect(text).not.toContain(leftover);
    }
    expect(state.writes[0]).toMatchObject({ tasks: [], projects: [] });
  });

  it('shows the person’s own tasks, habit, and today’s date', async () => {
    state.doc = {
      tasks: [{ id: 1, title: 'Write unit tests', time: '10:00 AM', duration: '45 min', tag: 'Work', color: 'stone', priority: true }],
      projects: [],
      habitLog: [],
      profile: { onboardingCompleted: true, name: 'Asha', habit: 'Stretch for 5 minutes', features: ['tasks', 'habit'] },
    };
    await renderHome();
    expect(screen.getAllByText('Write unit tests').length).toBeGreaterThan(0);
    expect(screen.getByText('Stretch for 5 minutes')).toBeTruthy();
    expect(screen.getByText(new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }))).toBeTruthy();
    expect(screen.getByText(/Next up: Write unit tests/)).toBeTruthy();
  });

  it('never overwrites the saved workspace when it failed to load', async () => {
    state.failLoad = true;
    await renderHome();
    expect(screen.getByText(/editing is paused/i)).toBeTruthy();
    // Trying to add a task is refused…
    const input = screen.getByPlaceholderText('Add to today...');
    fireEvent.change(input, { target: { value: 'New task' } });
    fireEvent.submit(input.closest('form')!);
    // …and "Retry" reloads instead of pushing local (empty) data.
    state.failLoad = false;
    state.doc = { tasks: [{ id: 9, title: 'Saved in the cloud', time: 'Unscheduled', duration: '30 min', tag: 'Inbox', color: 'stone' }], profile: { onboardingCompleted: true } };
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry loading' }));
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(state.writes.some((write) => Array.isArray(write.tasks) && (write.tasks as unknown[]).length === 0)).toBe(false);
    expect(screen.getAllByText('Saved in the cloud').length).toBeGreaterThan(0);
  });

  it('offers back changes that failed to save last time instead of silently dropping them', async () => {
    state.doc = { tasks: [], profile: { onboardingCompleted: true } };
    window.localStorage.setItem('manageme-pending-u1', JSON.stringify({ tasks: [{ id: 5, title: 'Unsaved from yesterday', time: 'Unscheduled', duration: '30 min', tag: 'Inbox', color: 'stone' }] }));
    await renderHome();
    expect(screen.getByText(/Unsaved changes from an earlier visit/)).toBeTruthy();
    expect(window.localStorage.getItem('manageme-pending-u1')).not.toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Restore those changes' }));
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
    expect(screen.getAllByText('Unsaved from yesterday').length).toBeGreaterThan(0);
    expect(state.writes.at(-1)?.tasks).toEqual([expect.objectContaining({ title: 'Unsaved from yesterday' })]);
  });

  it('keeps the 60-day roadmap for people who have one, without forcing it on anyone else', async () => {
    state.doc = { tasks: [], projects: [{ id: 1, title: 'My 60-day roadmap', progress: 0, cards: [] }], profile: { onboardingCompleted: true } };
    await renderHome();
    expect(screen.getByText(/Choose a week/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to workspace' }));
    expect(screen.getByText(/Continue your 60-day roadmap/)).toBeTruthy();
  });
});
