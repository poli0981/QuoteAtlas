import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Reload toast shown when a new service worker is waiting (docs/08 §5). */
export function UpdateToast(): ReactElement | null {
  const { t } = useTranslation('updater');
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-0 bottom-6 z-40 mx-auto flex w-fit items-center gap-3 rounded-full bg-neutral-800 px-4 py-2 text-sm text-neutral-100 shadow-xl">
      <span>{t('updateAvailable')}</span>
      <button
        type="button"
        onClick={() => {
          void updateServiceWorker(true);
        }}
        className="rounded bg-white/20 px-3 py-1 hover:bg-white/30"
      >
        {t('reload')}
      </button>
      <button
        type="button"
        onClick={() => {
          setNeedRefresh(false);
        }}
        aria-label={t('dismiss')}
        className="opacity-60 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}
