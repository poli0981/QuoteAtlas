import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Full-screen error page (docs/06 §9). `crash` is shown by the ErrorBoundary;
 * `notFound` by the SPA route check. `forbidden`/`rateLimited`/`serverError`
 * are host-level (Cloudflare static pages) but supported here for completeness.
 */
export type ErrorState = 'notFound' | 'forbidden' | 'rateLimited' | 'serverError' | 'crash';

const ISSUES_URL = 'https://github.com/poli0981/QuoteAtlas/issues/new';

export function ErrorView({ state }: { state: ErrorState }): ReactElement {
  const { t } = useTranslation('errors');

  return (
    <main className="grid min-h-dvh place-items-center bg-neutral-950 px-6 text-neutral-100">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-3xl leading-snug text-balance">{t(`${state}.title`)}</h1>
        <p className="mt-4 opacity-70">{t(`${state}.message`)}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {state === 'notFound' && (
            <button
              type="button"
              onClick={() => {
                window.location.assign('/');
              }}
              className="rounded-lg bg-white/10 px-4 py-2 hover:bg-white/20"
            >
              {t('notFound.home')}
            </button>
          )}
          {state === 'crash' && (
            <>
              <button
                type="button"
                onClick={() => {
                  window.location.reload();
                }}
                className="rounded-lg bg-white/10 px-4 py-2 hover:bg-white/20"
              >
                {t('crash.reload')}
              </button>
              <a
                href={ISSUES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-white/10 px-4 py-2 hover:bg-white/20"
              >
                {t('crash.reportBug')}
              </a>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
