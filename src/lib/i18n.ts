import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enCommon from '../locales/en/common.json';
import enLegal from '../locales/en/legal.json';
import jaCommon from '../locales/ja/common.json';
import jaLegal from '../locales/ja/legal.json';
import viCommon from '../locales/vi/common.json';
import viLegal from '../locales/vi/legal.json';

/** UI languages (independent from quote locales — docs/07). English is source of truth. */
export const UI_LANGUAGES = ['en', 'vi', 'ja'] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

void i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, legal: enLegal },
    vi: { common: viCommon, legal: viLegal },
    ja: { common: jaCommon, legal: jaLegal },
  },
  ns: ['common', 'legal'],
  fallbackLng: 'en',
  supportedLngs: [...UI_LANGUAGES],
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes
});

export default i18n;
