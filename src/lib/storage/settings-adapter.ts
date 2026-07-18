import type { StateStorage } from 'zustand/middleware';
import { isTauri } from '../platform';

/**
 * Settings persistence backend (docs/02 §4, docs/03 §7). Web uses localStorage;
 * desktop/Android use tauri-plugin-store (`settings.json` in the app data dir) —
 * same `StateStorage` interface, just async. Zustand's persist middleware already
 * rehydrates asynchronously (the store uses a `merge`), so the async native path
 * is transparent to the store. `@tauri-apps/plugin-store` is loaded via a dynamic
 * import inside the native branch so the web bundle never pulls Tauri IPC code.
 */
export function settingsStorage(): StateStorage {
  return isTauri() ? tauriStoreStorage() : webStorage();
}

/** Web/localStorage impl. Guarded so a missing/partial localStorage (sandboxed
 * contexts) degrades to in-memory rather than throwing. */
function webStorage(): StateStorage {
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

/** Native impl backed by tauri-plugin-store (docs/04 §6 — `settings.json`). */
function tauriStoreStorage(): StateStorage {
  type Store = Awaited<ReturnType<typeof import('@tauri-apps/plugin-store').load>>;
  let storeP: Promise<Store> | null = null;
  const store = (): Promise<Store> => {
    storeP ??= import('@tauri-apps/plugin-store').then((m) => m.load('settings.json'));
    return storeP;
  };
  return {
    getItem: async (name) => (await (await store()).get<string>(name)) ?? null,
    setItem: async (name, value) => {
      const s = await store();
      await s.set(name, value);
      await s.save();
    },
    removeItem: async (name) => {
      const s = await store();
      await s.delete(name);
      await s.save();
    },
  };
}
