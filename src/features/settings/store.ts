import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { UiLanguage } from '../../lib/i18n';
import { settingsStorage } from '../../lib/storage/settings-adapter';
import type { MediaItem } from '../background/media';
import type { QuoteMode } from '../quote/types';

export interface BackgroundSettings {
  mode: 'color' | 'gradient' | 'image';
  color: string;
  gradient: { from: string; to: string; angle: number };
  /** selected image media id (mode = 'image') */
  imageId: string | null;
  /** readability overlay, 0–80 % (docs/06 §3) */
  scrim: number;
  fontColor: string;
  textShadow: boolean;
}

export interface Settings {
  version: number;
  uiLanguage: UiLanguage;
  regionOverride: string | null;
  quoteMode: QuoteMode;
  /** rotate-mode interval in seconds (30–3600, docs/03 §3) */
  rotateSeconds: number;
  hour12: boolean;
  bilingual: boolean;
  background: BackgroundSettings;
  /** accepted LEGAL_VERSION; 0 = not yet accepted (docs/14 §1) */
  consentVersion: number;
  /** favorited quote ids (docs/06 §11) */
  favorites: string[];
  /** background media index — binaries live in OPFS, not here (docs/04 §6) */
  media: MediaItem[];
}

interface SettingsActions {
  update: (patch: Partial<Settings>) => void;
  setBackground: (patch: Partial<BackgroundSettings>) => void;
  acceptLegal: (version: number) => void;
  toggleFavorite: (id: string) => void;
  clearFavorites: () => void;
  addMedia: (item: MediaItem) => void;
  removeMedia: (id: string) => void;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  uiLanguage: 'en',
  regionOverride: null,
  quoteMode: 'daily',
  rotateSeconds: 60,
  hour12: false,
  bilingual: false,
  background: {
    mode: 'gradient',
    color: '#0a0a0a',
    gradient: { from: '#1e293b', to: '#0f172a', angle: 135 },
    imageId: null,
    scrim: 0,
    fontColor: '#fafafa',
    textShadow: false,
  },
  consentVersion: 0,
  favorites: [],
  media: [],
};

export const useSettings = create<Settings & SettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => {
        set(patch);
      },
      setBackground: (patch) => {
        set((s) => ({ background: { ...s.background, ...patch } }));
      },
      acceptLegal: (version) => {
        set({ consentVersion: version });
      },
      toggleFavorite: (id) => {
        set((s) => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((f) => f !== id)
            : [...s.favorites, id],
        }));
      },
      clearFavorites: () => {
        set({ favorites: [] });
      },
      addMedia: (item) => {
        set((s) => ({ media: [...s.media, item] }));
      },
      removeMedia: (id) => {
        set((s) => ({
          media: s.media.filter((m) => m.id !== id),
          background:
            s.background.imageId === id
              ? { ...s.background, imageId: null, mode: 'gradient' }
              : s.background,
        }));
      },
    }),
    {
      name: 'qa.settings.v1',
      version: 1,
      storage: createJSONStorage(settingsStorage),
      // Deep-merge so persisted state from an older field set backfills new
      // fields from the defaults (docs/05 §9 settings migration).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Settings>;
        return {
          ...current,
          ...p,
          background: { ...current.background, ...(p.background ?? {}) },
        };
      },
    },
  ),
);
