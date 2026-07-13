import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enCommon from '../locales/en/common.json';
import jaCommon from '../locales/ja/common.json';
import viCommon from '../locales/vi/common.json';

/** UI languages (independent from quote locales — docs/07). English is source of truth. */
export const UI_LANGUAGES = ['en', 'vi', 'ja'] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

void i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon },
    vi: { common: viCommon },
    ja: { common: jaCommon },
  },
  fallbackLng: 'en',
  supportedLngs: [...UI_LANGUAGES],
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes
});

export default i18n;
