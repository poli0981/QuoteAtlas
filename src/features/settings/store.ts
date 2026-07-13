import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { UiLanguage } from '../../lib/i18n';
import { settingsStorage } from '../../lib/storage/settings-adapter';
import type { QuoteMode } from '../quote/types';

export interface BackgroundSettings {
  mode: 'color' | 'gradient';
  color: string;
  gradient: { from: string; to: string; angle: number };
}

export interface Settings {
  version: number;
  uiLanguage: UiLanguage;
  regionOverride: string | null;
  quoteMode: QuoteMode;
  hour12: boolean;
  bilingual: boolean;
  background: BackgroundSettings;
  /** accepted LEGAL_VERSION; 0 = not yet accepted (docs/14 §1) */
  consentVersion: number;
}

interface SettingsActions {
  update: (patch: Partial<Settings>) => void;
  setBackground: (patch: Partial<BackgroundSettings>) => void;
  acceptLegal: (version: number) => void;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  uiLanguage: 'en',
  regionOverride: null,
  quoteMode: 'daily',
  hour12: false,
  bilingual: false,
  background: {
    mode: 'gradient',
    color: '#0a0a0a',
    gradient: { from: '#1e293b', to: '#0f172a', angle: 135 },
  },
  consentVersion: 0,
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
    }),
    {
      name: 'qa.settings.v1',
      version: 1,
      storage: createJSONStorage(settingsStorage),
    },
  ),
);
