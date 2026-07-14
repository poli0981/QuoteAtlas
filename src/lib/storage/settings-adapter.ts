import type { StateStorage } from 'zustand/middleware';

/**
 * Settings persistence backend (docs/02 §4, docs/03 §7). Web uses localStorage;
 * desktop/Android switch to tauri-plugin-store in Phase 3/4 (same interface).
 * Each method is guarded so a missing/partial localStorage (sandboxed contexts)
 * degrades to in-memory rather than throwing.
 */
export function settingsStorage(): StateStorage {
  return {
    getItem: (name) =>
      typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
        ? localStorage.getItem(name)
        : null,
    setItem: (name, value) => {
      if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
        localStorage.setItem(name, value);
      }
    },
    removeItem: (name) => {
      if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
        localStorage.removeItem(name);
      }
    },
  };
}
