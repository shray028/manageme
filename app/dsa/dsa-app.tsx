import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Check, Cloud, LogIn, LogOut, Moon, ShieldCheck, Sun } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { useSiteTheme, type SiteTheme } from '@/lib/site-theme';
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
  const [theme, toggleTheme] = useSiteTheme();
  useEffect(() => {
    document.title = 'DSA practice · ManageMe';
  }, []);

  if (user === undefined)
    return (
      <Shell theme={theme} onToggleTheme={toggleTheme}>
        <p role="status" className="py-24 text-center text-lg">
          Checking your sign-in…
        </p>
      </Shell>
    );
  if (!user) return <SignedOut theme={theme} onToggleTheme={toggleTheme} />;
  return <SignedIn key={user.uid} user={user} theme={theme} onToggleTheme={toggleTheme} />;
}

function Shell({ children, header, wide = false, theme, onToggleTheme }: { children: React.ReactNode; header?: React.ReactNode; wide?: boolean; theme: SiteTheme; onToggleTheme: () => void }) {
  return (
    <div className={`dsa-root ${wide ? 'is-wide' : ''}`} data-theme={theme}>
      {/* Focus the content directly: a "#dsa-main" link would change the hash route. */}
      <a
        href="#/dsa"
        className="dsa-skip"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById('dsa-main');
          main?.focus();
          main?.scrollIntoView();
        }}
      >
        Skip to content
      </a>
      <header className="dsa-topbar">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <a href="#/dsa" className="flex items-center gap-2.5 no-underline" aria-label="ManageMe DSA home">
            <BrandLogo compact />
            <span className="rounded-full bg-[var(--dsa-brand-soft)] px-2 py-0.5 text-xs font-bold text-[var(--dsa-brand-strong)]">DSA</span>
          </a>
          <div className="dsa-header-actions">
            {header}
            <button type="button" className="dsa-theme-toggle" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              {theme === 'dark' ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'} theme</span>
            </button>
          </div>
        </div>
      </header>
      <main id="dsa-main" tabIndex={-1} className={wide ? 'dsa-wide-main' : 'dsa-home-main'}>
        {children}
      </main>
    </div>
  );
}

function SignedOut({ theme, onToggleTheme }: { theme: SiteTheme; onToggleTheme: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Shell theme={theme} onToggleTheme={onToggleTheme}>
      <div className="dsa-welcome">
        <div className="dsa-welcome-copy">
          <p className="dsa-overline">A CLEARER WAY TO PRACTISE</p>
          <h1 className="dsa-h1">Track your DSA practice in one place</h1>
          <p className="dsa-welcome-lead">The next problem, your approach, and what to revise—all together. Choose a trusted sheet and build a practice rhythm that lasts.</p>
          <div className="dsa-welcome-points"><span><Check size={16} aria-hidden /> Solve and revise with intention</span><span><BookOpen size={16} aria-hidden /> Keep code, mistakes and links close</span><span><Cloud size={16} aria-hidden /> Return to your work across devices</span></div>
          <button type="button" className="dsa-btn-primary dsa-welcome-cta" disabled={busy} onClick={async () => {
            setBusy(true);
            setError('');
            try { await signIn(); } catch (err) {
              const code = (err as { code?: string })?.code ?? '';
              setError(code === 'auth/popup-blocked' ? 'Your browser blocked the Google sign-in window. Allow pop-ups for this site, then try again.' : code === 'auth/popup-closed-by-user' ? 'The sign-in window was closed before finishing. Try again when ready.' : 'Google sign-in didn’t finish. Check your connection and try again.');
            } finally { setBusy(false); }
          }}><LogIn className="size-4" aria-hidden /> {busy ? 'Opening Google…' : 'Sign in with Google'} <ArrowRight className="size-4" aria-hidden /></button>
          {error && <p role="alert" className="mt-3 font-semibold text-[var(--dsa-danger)]">{error}</p>}
          <p className="dsa-welcome-privacy"><ShieldCheck size={17} aria-hidden /> Your practice and notes are private to your sign-in.</p>
        </div>
        <div className="dsa-welcome-preview" aria-label="Illustration of a DSA practice list">
          <div className="dsa-welcome-preview-head"><p className="dsa-overline">YOUR PRACTICE DESK</p><span>01 / 03</span></div>
          <h2>Make the next problem count.</h2>
          <p>A place for the attempt and the lesson.</p>
          <div className="dsa-welcome-sample"><span className="dsa-sample-radio is-done"><Check size={13} strokeWidth={3} aria-hidden /></span><span><strong>Two Sum</strong><small>Approach saved · ready to revise</small></span><span className="dsa-tag dsa-tag-easy">Easy</span></div>
          <div className="dsa-welcome-sample"><span className="dsa-sample-radio" /><span><strong>Valid Anagram</strong><small>Your next clear step</small></span><span className="dsa-tag dsa-tag-easy">Easy</span></div>
          <div className="dsa-welcome-sample"><span className="dsa-sample-radio" /><span><strong>Contains Duplicate</strong><small>Code and notes stay together</small></span><span className="dsa-tag dsa-tag-easy">Easy</span></div>
          <p className="dsa-welcome-preview-foot">Illustrative preview</p>
        </div>
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

function SignedIn({ user, theme, onToggleTheme }: { user: AppUser; theme: SiteTheme; onToggleTheme: () => void }) {
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-5">
      {store.ready && <SaveStatus status={store.status} onRetry={store.retry} />}

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
      <Shell header={header} theme={theme} onToggleTheme={onToggleTheme}>
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
      <Shell header={header} theme={theme} onToggleTheme={onToggleTheme}>
        <p role="status" className="py-24 text-center text-lg">
          Loading your practice…
        </p>
      </Shell>
    );

  return (
    <Shell header={header} wide={Boolean(listId && activeList)} theme={theme} onToggleTheme={onToggleTheme}>
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
            Back to practice
          </button>
        </div>
      ) : (
        <DsaHome store={store} lists={lists} archived={archived} userName={user.name} userEmail={user.email} onOpen={(id) => navigate(`/dsa/list/${encodeURIComponent(id)}`)} />
      )}
    </Shell>
  );
}
