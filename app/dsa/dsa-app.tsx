import { useEffect, useMemo, useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { signIn, signOut, useAppUser, type AppUser } from '@/lib/dsa/auth';
import { toList } from '@/lib/dsa/model';
import type { DsaList } from '@/lib/dsa/types';
import { useDsaStore } from './use-dsa';
import { SaveStatus } from './save-status';
import { DsaHome } from './home';
import { ListView } from './list-view';
import { navigate, useRoute } from '../router';

export default function DsaApp() {
  const user = useAppUser();
  useEffect(() => {
    document.title = 'DSA practice · ManageMe';
  }, []);

  if (user === undefined)
    return (
      <Shell>
        <p role="status" className="py-24 text-center text-lg">
          Checking your sign-in…
        </p>
      </Shell>
    );
  if (!user) return <SignedOut />;
  return <SignedIn key={user.uid} user={user} />;
}

function Shell({ children, header, wide = false }: { children: React.ReactNode; header?: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`dsa-root ${wide ? 'is-wide' : ''}`}>
      <a href="#dsa-main" className="dsa-skip">
        Skip to content
      </a>
      <header className="dsa-topbar">
        <div className={`mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 ${wide ? '' : 'max-w-6xl'}`}>
          <a href="#/dsa" className="flex items-center gap-2.5 no-underline" aria-label="ManageMe DSA home">
            <span className="grid size-9 place-items-center rounded-lg bg-[var(--dsa-brand)] text-lg font-bold text-white" aria-hidden>
              m
            </span>
            <span className="text-lg font-bold text-[var(--dsa-ink)]">ManageMe DSA</span>
          </a>
          {header}
        </div>
      </header>
      <main id="dsa-main" className={wide ? 'dsa-wide-main' : 'mx-auto max-w-6xl px-4 py-8 sm:px-6'}>
        {children}
      </main>
    </div>
  );
}

function SignedOut() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Shell>
      <div className="mx-auto max-w-2xl py-10">
        <h1 className="dsa-h1">Track your DSA practice in one place</h1>
        <p className="mt-4 text-lg">Pick a sheet like Striver’s 180 or LeetCode’s Top Interview Questions, or bring your own list. For every problem you get:</p>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-lg">
          <li>
            <strong>Done</strong> and <strong>Revised</strong> checkboxes, each with space for what you learned
          </li>
          <li>A code editor with syntax colours and auto-indent, which also works for plain notes</li>
          <li>A weak list for problems you got wrong, with the mistake to remember</li>
          <li>Reference links, like the video that explains it</li>
        </ul>
        <p className="mt-4 text-lg">Everything saves to your Google account as you type and works across devices.</p>
        <button
          type="button"
          className="dsa-btn-primary mt-6 !px-5 !py-3 text-lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await signIn();
            } catch (err) {
              const code = (err as { code?: string })?.code ?? '';
              setError(
                code === 'auth/popup-blocked'
                  ? 'Your browser blocked the Google sign-in window. Allow pop-ups for this site, then try again.'
                  : code === 'auth/popup-closed-by-user'
                    ? 'The sign-in window was closed before finishing. Try again when ready.'
                    : 'Google sign-in didn’t finish. Check your connection and try again.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <LogIn className="size-5" aria-hidden /> {busy ? 'Opening Google…' : 'Sign in with Google'}
        </button>
        {error && (
          <p role="alert" className="mt-3 font-semibold text-[var(--dsa-danger)]">
            {error}
          </p>
        )}
        <p className="mt-10 text-[var(--dsa-muted)]">
          Looking for habits, tasks and projects too?{' '}
          <a className="dsa-link" href="#/" onClick={() => rememberStart('workspace')}>
            Open the full ManageMe workspace
          </a>
          .
        </p>
      </div>
    </Shell>
  );
}

export function rememberStart(mode: 'dsa' | 'workspace') {
  try {
    localStorage.setItem('manageme:start', mode);
  } catch {
    /* optional */
  }
}

function useDarkEditor(): [boolean, () => void] {
  const [dark, setDark] = useState(() => {
    try {
      // LeetCode-style dark editor by default; people can switch to light.
      return localStorage.getItem('manageme:dsa:dark-editor') !== '0';
    } catch {
      return false;
    }
  });
  return [
    dark,
    () =>
      setDark((value) => {
        try {
          localStorage.setItem('manageme:dsa:dark-editor', value ? '0' : '1');
        } catch {
          /* optional */
        }
        return !value;
      }),
  ];
}

function SignedIn({ user }: { user: AppUser }) {
  const store = useDsaStore(user);
  const route = useRoute();
  const [darkEditor, toggleDark] = useDarkEditor();

  useEffect(() => rememberStart('dsa'), []);

  const { lists, archived } = useMemo(() => {
    const all = store
      .all('dsaLists')
      .map(([id, doc]) => toList(id, doc))
      .filter((list): list is DsaList => Boolean(list))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return { lists: all.filter((list) => !list.archived), archived: all.filter((list) => list.archived) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.version]);

  const [rawListId, rawProblemKey] = route.startsWith('/dsa/list/') ? route.slice('/dsa/list/'.length).split('/') : [];
  const listId = rawListId ? decodeURIComponent(rawListId) : null;
  const problemKey = rawProblemKey ? decodeURIComponent(rawProblemKey) : null;
  const activeList = listId ? [...lists, ...archived].find((list) => list.id === listId) : undefined;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [listId]);

  const header = (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {store.ready && <SaveStatus status={store.status} onRetry={store.retry} />}

      <a className="dsa-text-btn inline-flex items-center" href="#/" onClick={() => rememberStart('workspace')}>
        Full workspace
      </a>
      <button
        type="button"
        className="dsa-text-btn inline-flex items-center gap-1.5"
        onClick={async () => {
          await store.flush();
          if (store.status.unsaved > 0 && !window.confirm('Some changes haven’t reached your account yet. They are kept on this device and will save next time you sign in here. Sign out anyway?')) return;
          await signOut();
        }}
      >
        <LogOut className="size-4" aria-hidden /> Sign out
      </button>
    </div>
  );

  if (store.loadError)
    return (
      <Shell header={header}>
        <div className="dsa-panel mx-auto max-w-xl text-center" role="alert">
          <h1 className="dsa-h2">Couldn’t open your DSA data</h1>
          <p className="mt-2">{store.loadError}</p>
          <button type="button" className="dsa-btn-primary mt-4" onClick={store.reload}>
            Try again
          </button>
        </div>
      </Shell>
    );

  if (!store.ready)
    return (
      <Shell header={header}>
        <p role="status" className="py-24 text-center text-lg">
          Loading your lists…
        </p>
      </Shell>
    );

  return (
    <Shell header={header} wide={Boolean(listId && activeList)}>
      {listId && activeList ? (
        <ListView
          key={activeList.id}
          list={activeList}
          store={store}
          selectedKey={problemKey}
          darkEditor={darkEditor}
          onToggleDark={toggleDark}
          onSelect={(key) => navigate(`/dsa/list/${encodeURIComponent(activeList.id)}${key ? `/${encodeURIComponent(key)}` : ''}`)}
          onBack={() => navigate('/dsa')}
        />
      ) : listId ? (
        <div className="dsa-panel">
          <p className="font-semibold">That list doesn’t exist in your account.</p>
          <button type="button" className="dsa-btn-primary mt-3" onClick={() => navigate('/dsa')}>
            Back to your lists
          </button>
        </div>
      ) : (
        <DsaHome store={store} lists={lists} archived={archived} userName={user.name} userEmail={user.email} onOpen={(id) => navigate(`/dsa/list/${encodeURIComponent(id)}`)} />
      )}
    </Shell>
  );
}
