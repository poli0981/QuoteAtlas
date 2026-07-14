import { useEffect, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { BugReportActions } from '../bug-report/BugReportActions';
import type { QuoteMode } from '../quote/types';
import { useSettings } from './store';

/** Settings drawer (docs/06 §3, §11): background + general controls. */
export function SettingsPanel({ onClose }: { onClose: () => void }): ReactElement {
  const { t } = useTranslation('settings');
  const background = useSettings((s) => s.background);
  const setBackground = useSettings((s) => s.setBackground);
  const quoteMode = useSettings((s) => s.quoteMode);
  const rotateSeconds = useSettings((s) => s.rotateSeconds);
  const hour12 = useSettings((s) => s.hour12);
  const bilingual = useSettings((s) => s.bilingual);
  const favorites = useSettings((s) => s.favorites);
  const update = useSettings((s) => s.update);
  const clearFavorites = useSettings((s) => s.clearFavorites);

  useEffect(() => {
    // close on Escape (docs/06 §10 pattern) — the drawer is dismissible
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
    >
      <div className="h-full w-full max-w-sm overflow-y-auto bg-neutral-900 p-6 text-neutral-100 shadow-2xl">
        <header className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-medium">{t('title')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="rounded px-2 py-1 hover:bg-white/10"
          >
            ✕
          </button>
        </header>

        <section className="mb-8">
          <h3 className="mb-3 text-xs tracking-wide uppercase opacity-60">
            {t('background.title')}
          </h3>

          <div className="mb-3 flex gap-2" role="group" aria-label={t('background.mode')}>
            {(['color', 'gradient'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setBackground({ mode });
                }}
                aria-pressed={background.mode === mode}
                className={`flex-1 rounded px-3 py-2 text-sm ${
                  background.mode === mode ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                {t(`background.${mode}`)}
              </button>
            ))}
          </div>

          {background.mode === 'color' ? (
            <label className="mb-3 flex items-center justify-between text-sm">
              <span>{t('background.color')}</span>
              <input
                type="color"
                value={background.color}
                onChange={(e) => {
                  setBackground({ color: e.target.value });
                }}
                className="h-8 w-12 rounded border-0 bg-transparent"
              />
            </label>
          ) : (
            <>
              <label className="mb-3 flex items-center justify-between text-sm">
                <span>{t('background.from')}</span>
                <input
                  type="color"
                  value={background.gradient.from}
                  onChange={(e) => {
                    setBackground({ gradient: { ...background.gradient, from: e.target.value } });
                  }}
                  className="h-8 w-12 rounded border-0 bg-transparent"
                />
              </label>
              <label className="mb-3 flex items-center justify-between text-sm">
                <span>{t('background.to')}</span>
                <input
                  type="color"
                  value={background.gradient.to}
                  onChange={(e) => {
                    setBackground({ gradient: { ...background.gradient, to: e.target.value } });
                  }}
                  className="h-8 w-12 rounded border-0 bg-transparent"
                />
              </label>
              <label className="mb-3 block text-sm">
                <span>
                  {t('background.angle')}: {background.gradient.angle}°
                </span>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={background.gradient.angle}
                  onChange={(e) => {
                    setBackground({
                      gradient: { ...background.gradient, angle: Number(e.target.value) },
                    });
                  }}
                  className="mt-1 w-full"
                />
              </label>
            </>
          )}

          <label className="mb-3 block text-sm">
            <span>
              {t('background.scrim')}: {background.scrim}%
            </span>
            <input
              type="range"
              min={0}
              max={80}
              value={background.scrim}
              onChange={(e) => {
                setBackground({ scrim: Number(e.target.value) });
              }}
              className="mt-1 w-full"
            />
          </label>

          <label className="mb-3 flex items-center justify-between text-sm">
            <span>{t('background.fontColor')}</span>
            <input
              type="color"
              value={background.fontColor}
              onChange={(e) => {
                setBackground({ fontColor: e.target.value });
              }}
              className="h-8 w-12 rounded border-0 bg-transparent"
            />
          </label>

          <label className="flex items-center justify-between text-sm">
            <span>{t('background.textShadow')}</span>
            <input
              type="checkbox"
              checked={background.textShadow}
              onChange={(e) => {
                setBackground({ textShadow: e.target.checked });
              }}
            />
          </label>
        </section>

        <section>
          <h3 className="mb-3 text-xs tracking-wide uppercase opacity-60">{t('general.title')}</h3>

          <label className="mb-3 flex items-center justify-between text-sm">
            <span>{t('general.quoteMode')}</span>
            <select
              value={quoteMode}
              onChange={(e) => {
                update({ quoteMode: e.target.value as QuoteMode });
              }}
              className="rounded bg-white/10 px-2 py-1"
            >
              <option value="per-load">{t('general.perLoad')}</option>
              <option value="daily">{t('general.daily')}</option>
              <option value="rotate">{t('general.rotate')}</option>
            </select>
          </label>

          {quoteMode === 'rotate' && (
            <label className="mb-3 block text-sm">
              <span>
                {t('general.interval')}: {rotateSeconds}
              </span>
              <input
                type="range"
                min={30}
                max={3600}
                step={30}
                value={rotateSeconds}
                onChange={(e) => {
                  update({ rotateSeconds: Number(e.target.value) });
                }}
                className="mt-1 w-full"
              />
            </label>
          )}

          <label className="mb-3 flex items-center justify-between text-sm">
            <span>{t('general.clock24')}</span>
            <input
              type="checkbox"
              checked={!hour12}
              onChange={(e) => {
                update({ hour12: !e.target.checked });
              }}
            />
          </label>

          <label className="flex items-center justify-between text-sm">
            <span>{t('general.bilingual')}</span>
            <input
              type="checkbox"
              checked={bilingual}
              onChange={(e) => {
                update({ bilingual: e.target.checked });
              }}
            />
          </label>
        </section>

        <section className="mt-8">
          <h3 className="mb-3 text-xs tracking-wide uppercase opacity-60">{t('data.title')}</h3>
          <p className="mb-3 text-sm opacity-70">
            {t('data.favorites', { count: favorites.length })}
          </p>
          <button
            type="button"
            onClick={clearFavorites}
            disabled={favorites.length === 0}
            className="rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20 disabled:opacity-40"
          >
            {t('data.clearFavorites')}
          </button>
        </section>

        <section className="mt-8">
          <h3 className="mb-3 text-xs tracking-wide uppercase opacity-60">{t('about.title')}</h3>
          <p className="mb-3 text-sm opacity-70">
            {t('about.version')}: {__APP_VERSION__}
          </p>
          <div className="mb-3">
            <BugReportActions />
          </div>
          <button
            type="button"
            onClick={() => {
              update({ consentVersion: 0 });
              onClose();
            }}
            className="rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
          >
            {t('about.reopenLegal')}
          </button>
        </section>
      </div>
    </div>
  );
}
