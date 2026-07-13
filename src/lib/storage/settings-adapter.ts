import type { StateStorage } from 'zustand/middleware';

/**
 * Settings persistence backend (docs/02 §4, docs/03 §7). Web uses localStorage;
 * desktop/Android switch to tauri-plugin-store in Phase 3/4 (same interface).
 */
export function settingsStorage(): StateStorage {
  return {
    getItem: (name) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(name)),
    setItem: (name, value) => {
      if (typeof localStorage !== 'undefined') localStorage.setItem(name, value);
    },
    removeItem: (name) => {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(name);
    },
  };
}
