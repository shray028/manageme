import { useSyncExternalStore } from 'react';

/** Tiny hash router: "#/dsa/list/abc" → "/dsa/list/abc". Hash routes work on any static host. */
const read = () => {
  const hash = window.location.hash.replace(/^#/, '');
  return hash.startsWith('/') ? hash : '/';
};

const subscribe = (callback: () => void) => {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
};

export const useRoute = () => useSyncExternalStore(subscribe, read, () => '/');

export function navigate(path: string) {
  if (read() !== path) window.location.hash = path;
}
