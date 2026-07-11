import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
let currentTheme = typeof document !== 'undefined'
  ? document.documentElement.getAttribute('data-theme') ?? 'light'
  : 'light';

export function setTheme(theme: 'light' | 'dark') {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('etfbuilder-theme', theme);
  listeners.forEach((fn) => fn());
}

export function toggleTheme() {
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

export function initTheme() {
  const stored = localStorage.getItem('etfbuilder-theme');
  if (stored === 'dark' || stored === 'light') {
    currentTheme = stored;
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    currentTheme = 'dark';
  }
  document.documentElement.setAttribute('data-theme', currentTheme);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return currentTheme;
}

export function useTheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, getSnapshot) as 'light' | 'dark';
}

export function resolveToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
