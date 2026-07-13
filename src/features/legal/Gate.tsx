import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { UI_LANGUAGES } from '../../lib/i18n';
import { useSettings } from '../settings/store';
import { LEGAL_VERSION } from './legal-version';

// Links resolve to the GitHub-rendered files (docs/14 §1). The legal/*.md drafts
// are added by a human before first release (docs/00 §8); LICENSE + ATTRIBUTIONS
// already exist.
const REPO = 'https://github.com/poli0981/QuoteAtlas';
const LINKS = {
  license: `${REPO}/blob/main/LICENSE`,
  terms: `${REPO}/tree/main/legal`,
  notices: `${REPO}/blob/main/ATTRIBUTIONS.md`,
};

/**
 * Blocking first-run/visit legal gate (docs/06 §10). No dismiss besides the
 * button; stores { consentVersion, at } via the settings store.
 */
export function Gate(): ReactElement {
  const { t } = useTranslation('legal');
  const uiLanguage = useSettings((s) => s.uiLanguage);
  const update = useSettings((s) => s.update);
  const acceptLegal = useSettings((s) => s.acceptLegal);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qa-gate-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl bg-neutral-900 p-8 text-neutral-100 shadow-2xl">
        <h1 id="qa-gate-title" className="font-serif text-2xl">
          ◆ QuoteAtlas
        </h1>
        <p className="mt-1 text-sm opacity-80">{t('title')}</p>
        <p className="mt-4 text-sm opacity-70">{t('intro')}</p>

        <ul className="mt-4 flex flex-col gap-2 text-sm">
          <li>
            <a
              className="underline underline-offset-4 hover:opacity-80"
              href={LINKS.license}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('sourceLicense')}
            </a>
          </li>
          <li>
            <a
              className="underline underline-offset-4 hover:opacity-80"
              href={LINKS.terms}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('terms')}
            </a>
          </li>
          <li>
            <a
              className="underline underline-offset-4 hover:opacity-80"
              href={LINKS.notices}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('notices')}
            </a>
          </li>
        </ul>

        <div className="mt-6">
          <span className="text-xs tracking-wide uppercase opacity-60">{t('language')}</span>
          <div className="mt-1 flex gap-1" role="group" aria-label={t('language')}>
            {UI_LANGUAGES.map((lng) => (
              <button
                key={lng}
                type="button"
                onClick={() => {
                  update({ uiLanguage: lng });
                }}
                aria-pressed={uiLanguage === lng}
                className={`rounded px-3 py-1 text-sm ${
                  uiLanguage === lng ? 'bg-white/20' : 'opacity-60 hover:opacity-100'
                }`}
              >
                {lng.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            acceptLegal(LEGAL_VERSION);
          }}
          className="mt-8 w-full rounded-xl bg-white/90 px-4 py-3 font-medium text-neutral-900 transition hover:bg-white"
        >
          {t('agree')}
        </button>
      </div>
    </div>
  );
}
