import { useCallback, useEffect, useState } from 'react';

const KEY = 'nexus:theme';
const media = () => matchMedia('(prefers-color-scheme: dark)');
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

// Explicit choice (light / dark) wins; otherwise follow the system and keep following it.
export function useTheme() {
  const [theme, setTheme] = useState(read);
  const [systemDark, setSystemDark] = useState(() => media().matches);
  useEffect(() => {
    const m = media();
    const on = (e) => setSystemDark(e.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  const dark = theme ? theme === 'dark' : systemDark;
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);
  const toggle = useCallback(() => {
    const next = dark ? 'light' : 'dark';
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
    setTheme(next);
  }, [dark]);
  return { dark, toggle };
}
