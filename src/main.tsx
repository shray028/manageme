import { Component, lazy, StrictMode, Suspense, useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { useRoute } from '../app/router';
import '../app/globals.css';
import '../app/premium.css';

const DsaApp = lazy(() => import('../app/dsa/dsa-app'));
const FrontDoor = lazy(() => import('../app/front-door'));

// A tab opened before a deployment can still reference a chunk that the new build removed.
// Vite emits this event for that failed import; reload once to pick up the current build.
const assetReloadKey = 'manageme:asset-reload';
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  let lastReload: number;
  try {
    lastReload = Number(sessionStorage.getItem(assetReloadKey)) || 0;
    if (Date.now() - lastReload < 60_000) return;
    sessionStorage.setItem(assetReloadKey, String(Date.now()));
  } catch {
    // If storage is unavailable, leave the refresh to the error boundary.
    return;
  }
  window.location.reload();
});

class LoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed)
      return (
        <main className="grid min-h-screen place-content-center gap-4 bg-[#f4f8ff] px-5 text-center text-[#0b2454]">
          <h1 className="text-2xl font-bold">ManageMe couldn’t load</h1>
          <p>Refresh the page to try again.</p>
          <button type="button" className="rounded-lg bg-[#1769d8] px-4 py-2 font-semibold text-white" onClick={() => window.location.reload()}>
            Refresh ManageMe
          </button>
        </main>
      );
    return this.props.children;
  }
}

const isDsaRoute = (route: string) => route === '/dsa' || route.startsWith('/dsa/');

function App() {
  const route = useRoute();
  const isDsa = isDsaRoute(route);
  // "/" is the front page (also covers in-page anchors like "#paths", which read as "/").
  const isFront = route === '/';

  // ManageMe is DSA-only for now: the older workspace isn't reachable from any address.
  // Any other address (an old bookmark such as "#/roadmap") goes to the DSA home.
  useEffect(() => {
    // replace() swaps the history entry, so Back doesn't bounce to the address being redirected.
    if (!isDsa && !isFront) window.location.replace('#/dsa');
  }, [isDsa, isFront]);

  return (
    <Suspense
      fallback={
        <p role="status" style={{ padding: '6rem 1rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          Loading…
        </p>
      }
    >
      {isDsa ? <DsaApp /> : isFront ? <FrontDoor /> : null}
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LoadBoundary>
      <App />
    </LoadBoundary>
  </StrictMode>,
);
