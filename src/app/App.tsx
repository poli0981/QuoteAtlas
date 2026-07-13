import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import enData from '../../data/quotes/en.json';
import indexData from '../../data/quotes/index.json';
import { Clock } from '../features/clock/Clock';
import { Gate } from '../features/legal/Gate';
import { LEGAL_VERSION } from '../features/legal/legal-version';
import { select } from '../features/quote/engine';
import { QuoteView } from '../features/quote/QuoteView';
import type { LocaleIndex, QuoteRecord } from '../features/quote/types';
import { detect } from '../features/region/detect';
import { resolveLocale, regionsWithPool } from '../features/region/locale-chain';
import { RegionPicker } from '../features/region/RegionPicker';
import tzData from '../features/region/tz-to-country.json';
import { useSettings, type BackgroundSettings } from '../features/settings/store';
import i18n, { UI_LANGUAGES } from '../lib/i18n';

const INDEX = indexData as unknown as LocaleIndex;
const POOL_REGIONS = regionsWithPool(INDEX);
const ALL_REGIONS = [
  ...new Set([...Object.values(tzData.map), ...INDEX.locales.flatMap((l) => l.regions)]),
];

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

export function App(): ReactElement {
  const { t } = useTranslation();
  const uiLanguage = useSettings((s) => s.uiLanguage);
  const regionOverride = useSettings((s) => s.regionOverride);
  const background = useSettings((s) => s.background);
  const consentVersion = useSettings((s) => s.consentVersion);
  const update = useSettings((s) => s.update);
  const [quote, setQuote] = useState<QuoteRecord | null>(null);
  const [detected, setDetected] = useState<string | null>(null);

  useEffect(() => {
    // keep the i18n runtime in sync with the persisted UI language
    void i18n.changeLanguage(uiLanguage);
  }, [uiLanguage]);

  useEffect(() => {
    // boot: detect region, resolve locale, pick today's quote (docs/03 §1)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const det = detect(tzData.map, { timeZone, languages: navigator.languages });
    setDetected(det);

    const { locale } = resolveLocale(regionOverride ?? det, INDEX, navigator.languages);
    const now = new Date();
    const dateKey = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
    const result = select({
      pool: enData.quotes as unknown as QuoteRecord[],
      mode: 'daily',
      history: [],
      holidayTags: { national: [], international: [] },
      locale,
      dateKey,
    });
    setQuote(result?.quote ?? null);
  }, [regionOverride]);

  const effective = regionOverride ?? detected;
  const resolution = resolveLocale(effective, INDEX, navigator.languages);
  const localeName =
    new Intl.DisplayNames([uiLanguage], { type: 'language' }).of(resolution.locale) ??
    resolution.locale;
  const regionName = effective
    ? (new Intl.DisplayNames([uiLanguage], { type: 'region' }).of(effective) ?? effective)
    : '';

  return (
    <main
      className="relative grid min-h-dvh place-items-center px-6 text-neutral-100"
      style={backgroundStyle(background)}
    >
      <header className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-6">
        <Clock locale={uiLanguage} />
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
        <div className="absolute inset-x-0 top-20 mx-auto w-fit rounded-full bg-amber-500/15 px-4 py-1 text-xs text-amber-200">
          {t('region.fallback', { locale: localeName, region: regionName })}
        </div>
      )}

      {quote && <QuoteView quote={quote} />}

      {consentVersion !== LEGAL_VERSION && <Gate />}
    </main>
  );
}
