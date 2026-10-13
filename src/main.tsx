import { lazy, StrictMode, Suspense, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { navigate, useRoute } from '../app/router';
import '../app/globals.css';

const Workspace = lazy(() => import('../app/page'));
const DsaApp = lazy(() => import('../app/dsa/dsa-app'));

function readStart() {
  try {
    return localStorage.getItem('manageme:start');
  } catch {
    return null;
  }
}

function App() {
  const route = useRoute();
  const isDsa = route === '/dsa' || route.startsWith('/dsa/');

  // People who use ManageMe only for DSA land straight on it.
  useEffect(() => {
    if (!window.location.hash && readStart() === 'dsa') navigate('/dsa');
  }, []);

  return (
    <Suspense
      fallback={
        <p role="status" style={{ padding: '6rem 1rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          Loading…
        </p>
      }
    >
      {isDsa ? <DsaApp /> : <Workspace />}
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
