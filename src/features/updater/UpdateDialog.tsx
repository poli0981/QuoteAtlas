import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdateCheck } from './useUpdateCheck';

/**
 * Android update prompt (docs/06 §9). Shows the available version + release-notes
 * excerpt and opens the GitHub release page in the browser — the user downloads
 * and installs the APK manually (no in-app install; docs/08 §4). Renders nothing
 * unless the hook has an update to offer.
 */
export function UpdateDialog(): ReactElement | null {
  const { t } = useTranslation('updater');
  const prompt = useUpdateCheck();
  if (!prompt) return null;
  const { info } = prompt;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qa-update-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl bg-neutral-900 p-8 text-neutral-100 shadow-2xl">
        <h1 id="qa-update-title" className="font-serif text-2xl">
          {t('newVersionTitle')}
        </h1>
        <p className="mt-2 text-sm opacity-80">
          {t('newVersionBody', { version: info.version, current: __APP_VERSION__ })}
        </p>

        {info.notes && (
          <div className="mt-4 max-h-48 overflow-y-auto rounded-lg bg-black/30 p-3 text-sm whitespace-pre-wrap opacity-80">
            {info.notes}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            void prompt.openReleasePage();
            prompt.later();
          }}
          className="mt-6 w-full rounded-xl bg-white/90 px-4 py-3 font-medium text-neutral-900 transition hover:bg-white"
        >
          {t('openReleasePage')}
        </button>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={prompt.later}
            className="flex-1 rounded-xl px-4 py-2 text-sm opacity-70 hover:opacity-100"
          >
            {t('later')}
          </button>
          <button
            type="button"
            onClick={prompt.skip}
            className="flex-1 rounded-xl px-4 py-2 text-sm opacity-70 hover:opacity-100"
          >
            {t('skipThisVersion')}
          </button>
        </div>
      </div>
    </div>
  );
}
