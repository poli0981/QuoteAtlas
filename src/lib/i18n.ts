import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enCommon from '../locales/en/common.json';
import enErrors from '../locales/en/errors.json';
import enLegal from '../locales/en/legal.json';
import enMedia from '../locales/en/media.json';
import enSettings from '../locales/en/settings.json';
import enUpdater from '../locales/en/updater.json';
import jaCommon from '../locales/ja/common.json';
import jaErrors from '../locales/ja/errors.json';
import jaLegal from '../locales/ja/legal.json';
import jaMedia from '../locales/ja/media.json';
import jaSettings from '../locales/ja/settings.json';
import jaUpdater from '../locales/ja/updater.json';
import viCommon from '../locales/vi/common.json';
import viErrors from '../locales/vi/errors.json';
import viLegal from '../locales/vi/legal.json';
import viMedia from '../locales/vi/media.json';
import viSettings from '../locales/vi/settings.json';
import viUpdater from '../locales/vi/updater.json';

/** UI languages (independent from quote locales — docs/07). English is source of truth. */
export const UI_LANGUAGES = ['en', 'vi', 'ja'] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

void i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      legal: enLegal,
      settings: enSettings,
      errors: enErrors,
      updater: enUpdater,
      media: enMedia,
    },
    vi: {
      common: viCommon,
      legal: viLegal,
      settings: viSettings,
      errors: viErrors,
      updater: viUpdater,
      media: viMedia,
    },
    ja: {
      common: jaCommon,
      legal: jaLegal,
      settings: jaSettings,
      errors: jaErrors,
      updater: jaUpdater,
      media: jaMedia,
    },
  },
  ns: ['common', 'legal', 'settings', 'errors', 'updater', 'media'],
  fallbackLng: 'en',
  supportedLngs: [...UI_LANGUAGES],
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes
});

export default i18n;
