import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';
import { useTranslation } from 'react-i18next';
import enData from '../../data/quotes/en.json';
import indexData from '../../data/quotes/index.json';
import { BackgroundLayer } from '../features/background/BackgroundLayer';
import { Clock } from '../features/clock/Clock';
import { resolveActiveHolidays } from '../features/holidays/boot-holidays';
import { Gate } from '../features/legal/Gate';
import { LEGAL_VERSION } from '../features/legal/legal-version';
import { attributionText } from '../features/quote/attribution';
import { QuoteView } from '../features/quote/QuoteView';
import type { LocaleIndex, QuoteRecord } from '../features/quote/types';
import { detect } from '../features/region/detect';
import { regionsWithPool, resolveLocale } from '../features/region/locale-chain';
import { RegionPicker } from '../features/region/RegionPicker';
import tzData from '../features/region/tz-to-country.json';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import { useSettings, type BackgroundSettings } from '../features/settings/store';
import i18n, { UI_LANGUAGES } from '../lib/i18n';
import { mediaUrl } from '../lib/storage/media-adapter';
import { ErrorView } from './ErrorView';
import { UpdateToast } from './UpdateToast';
import { useAutoHide } from './use-auto-hide';
import { useFullscreen } from './use-fullscreen';
import { useQuoteStack } from './use-quote-stack';

const INDEX = indexData as unknown as LocaleIndex;
const POOL = enData.quotes as unknown as QuoteRecord[];
const POOL_REGIONS = regionsWithPool(INDEX);
const ALL_REGIONS = [
  ...new Set([...Object.values(tzData.map), ...INDEX.locales.flatMap((l) => l.regions)]),
];

function backgroundStyle(bg: BackgroundSettings, imageUrl: string | null): CSSProperties {
  if (bg.mode === 'gradient') {
    return {
      backgroundImage: `linear-gradient(${bg.gradient.angle}deg, ${bg.gradient.from}, ${bg.gradient.to})`,
    };
  }
  if (bg.mode === 'image' && imageUrl != null) {
    return {
      backgroundImage: `url("${imageUrl}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
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

const TOOLBAR_BTN = 'rounded-full px-3 py-2 text-lg opacity-70 hover:bg-white/10 hover:opacity-100';

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
  const favorites = useSettings((s) => s.favorites);
  const media = useSettings((s) => s.media);
  const update = useSettings((s) => s.update);
  const toggleFavorite = useSettings((s) => s.toggleFavorite);

  const [detected, setDetected] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const toolbarVisible = useAutoHide();
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const effective = regionOverride ?? detected;
  const resolution = resolveLocale(effective, INDEX, navigator.languages);
  const { locale } = resolution;
  const localeName = new Intl.DisplayNames([uiLanguage], { type: 'language' }).of(locale) ?? locale;
  const regionName = effective
    ? (new Intl.DisplayNames([uiLanguage], { type: 'region' }).of(effective) ?? effective)
    : '';

  const holidayTags = useMemo(() => resolveActiveHolidays(new Date(), effective), [effective]);

  const { quote, goPrev, goNext, canPrev } = useQuoteStack({
    pool: POOL,
    mode: quoteMode,
    locale,
    rotateSeconds,
    holidayTags,
  });
  const isFavorite = quote != null && favorites.includes(quote.id);

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
    // resolve the selected image's object URL for the background (revoke on change)
    if (background.mode !== 'image' || background.imageId == null) {
      setBgImageUrl(null);
      return undefined;
    }
    const item = media.find((m) => m.id === background.imageId);
    if (!item) {
      setBgImageUrl(null);
      return undefined;
    }
    let live = true;
    let created: string | null = null;
    void mediaUrl(`${item.id}.${item.ext}`)
      .then((u) => {
        if (live) {
          created = u;
          setBgImageUrl(u);
        } else {
          URL.revokeObjectURL(u);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
      if (created != null) URL.revokeObjectURL(created);
    };
  }, [background.mode, background.imageId, media]);

  const copyQuote = useCallback((): void => {
    if (!quote) return;
    void navigator.clipboard
      .writeText(`${quote.text}\n${attributionText(quote)}`)
      .catch(() => undefined);
  }, [quote]);

  const favorite = useCallback((): void => {
    if (quote) toggleFavorite(quote.id);
  }, [quote, toggleFavorite]);

  useEffect(() => {
    // keyboard (docs/06 §12): arrows prev/next, F favorite, C copy, F11 fullscreen
    const onKey = (e: KeyboardEvent): void => {
      // R11 — the legal gate is *blocking*. It is only a pointer overlay, so the
      // shortcuts must be disarmed too; otherwise arrows/F/C drive the app (and
      // persist settings) behind the gate before consent is ever given.
      if (consentVersion !== LEGAL_VERSION) return;
      if (
        e.target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)
      ) {
        return;
      }
      switch (e.key) {
        case 'F11':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'ArrowLeft':
          goPrev();
          break;
        case 'ArrowRight':
          goNext();
          break;
        case 'f':
        case 'F':
          favorite();
          break;
        case 'c':
        case 'C':
          copyQuote();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [toggleFullscreen, goPrev, goNext, favorite, copyQuote, consentVersion]);

  const path = window.location.pathname;
  if (path !== '/' && path !== '/index.html') {
    return <ErrorView state="notFound" />;
  }

  return (
    <main
      className={`relative grid min-h-dvh place-items-center overflow-hidden px-6 ${
        isFullscreen && !toolbarVisible ? 'cursor-none' : ''
      }`}
      style={{
        ...backgroundStyle(background, bgImageUrl),
        color: background.fontColor,
        ...(background.textShadow ? { textShadow: '0 2px 10px rgba(0,0,0,0.55)' } : {}),
      }}
    >
      <BackgroundLayer background={background} media={media} />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
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
          onClick={goPrev}
          disabled={!canPrev}
          aria-label={t('settings:prev')}
          className={`${TOOLBAR_BTN} disabled:opacity-30 disabled:hover:bg-transparent`}
        >
          ‹
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label={t('settings:next')}
          className={TOOLBAR_BTN}
        >
          ›
        </button>
        <button
          type="button"
          onClick={favorite}
          aria-pressed={isFavorite}
          aria-label={t(isFavorite ? 'settings:unfavorite' : 'settings:favorite')}
          className={TOOLBAR_BTN}
        >
          {isFavorite ? '♥' : '♡'}
        </button>
        <button
          type="button"
          onClick={copyQuote}
          aria-label={t('settings:copy')}
          className={TOOLBAR_BTN}
        >
          ⧉
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={t('settings:fullscreen')}
          aria-pressed={isFullscreen}
          className={TOOLBAR_BTN}
        >
          ⛶
        </button>
        <button
          type="button"
          onClick={() => {
            setSettingsOpen(true);
          }}
          aria-label={t('settings:open')}
          className={TOOLBAR_BTN}
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

      <UpdateToast />
    </main>
  );
}
