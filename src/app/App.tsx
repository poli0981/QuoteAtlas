import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import enData from '../../data/quotes/en.json';
import indexData from '../../data/quotes/index.json';
import { Clock } from '../features/clock/Clock';
import type { HolidayTags } from '../features/holidays/types';
import { Gate } from '../features/legal/Gate';
import { LEGAL_VERSION } from '../features/legal/legal-version';
import { attributionText } from '../features/quote/attribution';
import { select } from '../features/quote/engine';
import { QuoteView } from '../features/quote/QuoteView';
import type { LocaleIndex, QuoteRecord } from '../features/quote/types';
import { detect } from '../features/region/detect';
import { regionsWithPool, resolveLocale } from '../features/region/locale-chain';
import { RegionPicker } from '../features/region/RegionPicker';
import tzData from '../features/region/tz-to-country.json';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import { useSettings, type BackgroundSettings } from '../features/settings/store';
import i18n, { UI_LANGUAGES } from '../lib/i18n';
import { ErrorView } from './ErrorView';
import { useAutoHide } from './use-auto-hide';

const INDEX = indexData as unknown as LocaleIndex;
const POOL = enData.quotes as unknown as QuoteRecord[];
const POOL_REGIONS = regionsWithPool(INDEX);
const ALL_REGIONS = [
  ...new Set([...Object.values(tzData.map), ...INDEX.locales.flatMap((l) => l.regions)]),
];
const NO_HOLIDAYS: HolidayTags = { national: [], international: [] };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function backgroundStyle(bg: BackgroundSettings): CSSProperties {
  if (bg.mode === 'gradient') {
    return {
      backgroundImage: `linear-gradient(${bg.gradient.angle}deg, ${bg.gradient.from}, ${bg.gradient.to})`,
    };
  }
  return { backgroundColor: bg.color };
}

/** Black or white scrim, auto-picked against the font color (docs/05 §8). */
function scrimColor(fontColor: string): string {
  const hex = /^#?([0-9a-f]{6})$/i.exec(fontColor)?.[1] ?? 'ffffff';
  const n = Number.parseInt(hex, 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.5 ? '#000000' : '#ffffff';
}

export function App(): ReactElement {
  const { t } = useTranslation();
  const uiLanguage = useSettings((s) => s.uiLanguage);
  const regionOverride = useSettings((s) => s.regionOverride);
  const background = useSettings((s) => s.background);
  const quoteMode = useSettings((s) => s.quoteMode);
  const rotateSeconds = useSettings((s) => s.rotateSeconds);
  const hour12 = useSettings((s) => s.hour12);
  const bilingual = useSettings((s) => s.bilingual);
  const consentVersion = useSettings((s) => s.consentVersion);
  const update = useSettings((s) => s.update);

  const [quote, setQuote] = useState<QuoteRecord | null>(null);
  const [detected, setDetected] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const historyRef = useRef<string[]>([]);
  const toolbarVisible = useAutoHide();

  const effective = regionOverride ?? detected;
  const resolution = resolveLocale(effective, INDEX, navigator.languages);
  const { locale } = resolution;
  const localeName = new Intl.DisplayNames([uiLanguage], { type: 'language' }).of(locale) ?? locale;
  const regionName = effective
    ? (new Intl.DisplayNames([uiLanguage], { type: 'region' }).of(effective) ?? effective)
    : '';

  useEffect(() => {
    // keep the i18n runtime in sync with the persisted UI language
    void i18n.changeLanguage(uiLanguage);
  }, [uiLanguage]);

  useEffect(() => {
    // one-time region detection (docs/03 §1)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setDetected(detect(tzData.map, { timeZone, languages: navigator.languages }));
  }, []);

  useEffect(() => {
    // track connectivity for the offline notice (docs/06 §9)
    const on = (): void => {
      setOnline(true);
    };
    const off = (): void => {
      setOnline(false);
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    // pick a quote when the locale or mode changes; rotate re-picks on an interval
    // (docs/03 §3). Keyed on `locale` (not `detected`) so daily stays stable.
    const doPick = (): void => {
      const now = new Date();
      const dateKey = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
      const result = select({
        pool: POOL,
        mode: quoteMode,
        history: historyRef.current,
        holidayTags: NO_HOLIDAYS,
        locale,
        dateKey,
      });
      if (result) {
        historyRef.current = result.history;
        setQuote(result.quote);
      }
    };
    doPick();
    if (quoteMode === 'rotate') {
      const id = setInterval(doPick, rotateSeconds * 1000);
      return () => {
        clearInterval(id);
      };
    }
    return undefined;
  }, [locale, quoteMode, rotateSeconds]);

  const copyQuote = (): void => {
    if (!quote) return;
    void navigator.clipboard
      .writeText(`${quote.text}\n${attributionText(quote)}`)
      .catch(() => undefined);
  };

  const path = window.location.pathname;
  if (path !== '/' && path !== '/index.html') {
    return <ErrorView state="notFound" />;
  }

  return (
    <main
      className="relative grid min-h-dvh place-items-center overflow-hidden px-6"
      style={{
        ...backgroundStyle(background),
        color: background.fontColor,
        ...(background.textShadow ? { textShadow: '0 2px 10px rgba(0,0,0,0.55)' } : {}),
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundColor: scrimColor(background.fontColor),
          opacity: background.scrim / 100,
        }}
      />

      <header className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-6">
        <Clock locale={uiLanguage} hour12={hour12} />
        <div className="flex items-center gap-3 text-sm">
          <RegionPicker
            detected={detected}
            poolRegions={POOL_REGIONS}
            allRegions={ALL_REGIONS}
            uiLanguage={uiLanguage}
          />
          <div className="flex gap-1" role="group" aria-label={t('language.label')}>
            {UI_LANGUAGES.map((lng) => (
              <button
                key={lng}
                type="button"
                onClick={() => {
                  update({ uiLanguage: lng });
                }}
                aria-pressed={uiLanguage === lng}
                className={`rounded px-2 py-1 transition ${
                  uiLanguage === lng ? 'bg-white/20' : 'opacity-60 hover:opacity-100'
                }`}
              >
                {t(`language.${lng}`)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {resolution.fallback && (
        <div className="absolute inset-x-0 top-20 z-20 mx-auto w-fit rounded-full bg-amber-500/15 px-4 py-1 text-xs text-amber-200">
          {t('region.fallback', { locale: localeName, region: regionName })}
        </div>
      )}

      {!online && (
        <div className="absolute inset-x-0 top-8 z-20 mx-auto w-fit rounded-full bg-red-500/20 px-4 py-1 text-xs text-red-200">
          {t('errors:offline.title')}
        </div>
      )}

      <div className="relative z-10">
        {quote && <QuoteView quote={quote} bilingual={bilingual} uiLanguage={uiLanguage} />}
      </div>

      <div
        className={`absolute inset-x-0 bottom-0 z-20 flex justify-center gap-4 p-6 transition-opacity duration-500 ${
          toolbarVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <button
          type="button"
          onClick={copyQuote}
          aria-label={t('settings:copy')}
          className="rounded-full px-3 py-2 text-lg opacity-70 hover:bg-white/10 hover:opacity-100"
        >
          ⧉
        </button>
        <button
          type="button"
          onClick={() => {
            setSettingsOpen(true);
          }}
          aria-label={t('settings:open')}
          className="rounded-full px-3 py-2 text-lg opacity-70 hover:bg-white/10 hover:opacity-100"
        >
          ⚙
        </button>
      </div>

      {settingsOpen && (
        <SettingsPanel
          onClose={() => {
            setSettingsOpen(false);
          }}
        />
      )}

      {consentVersion !== LEGAL_VERSION && <Gate />}
    </main>
  );
}
