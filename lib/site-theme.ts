import { useEffect, useState } from 'react';

export type SiteTheme = 'light' | 'dark';

const THEME_KEY = 'manageme:theme';

function savedTheme(): SiteTheme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function preferredTheme(): SiteTheme {
  return savedTheme() ?? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function useSiteTheme(): [SiteTheme, () => void] {
  const [theme, setTheme] = useState<SiteTheme>(preferredTheme);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onPreferenceChange = () => {
      if (!savedTheme()) setTheme(media?.matches ? 'dark' : 'light');
    };
    const onStorageChange = (event: StorageEvent) => {
      if (event.key === THEME_KEY) setTheme(preferredTheme());
    };
    media?.addEventListener('change', onPreferenceChange);
    window.addEventListener('storage', onStorageChange);
    return () => {
      media?.removeEventListener('change', onPreferenceChange);
      window.removeEventListener('storage', onStorageChange);
    };
  }, []);

  const toggle = () => setTheme((current) => {
    const next = current === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(THEME_KEY, next); } catch { /* preference remains in this tab */ }
    return next;
  });

  return [theme, toggle];
}
