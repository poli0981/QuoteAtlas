import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import enData from '../../data/quotes/en.json';
import { Clock } from '../features/clock/Clock';
import { select } from '../features/quote/engine';
import { QuoteView } from '../features/quote/QuoteView';
import type { QuoteRecord } from '../features/quote/types';
import { detect } from '../features/region/detect';
import tzData from '../features/region/tz-to-country.json';
import { useSettings, type BackgroundSettings } from '../features/settings/store';
import i18n, { UI_LANGUAGES } from '../lib/i18n';

// v1.0 has one quote pool (en); its locale is independent of the UI language.
const QUOTE_LOCALE = 'en';

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
  const update = useSettings((s) => s.update);
  const [quote, setQuote] = useState<QuoteRecord | null>(null);
  const [region, setRegion] = useState<string | null>(null);

  useEffect(() => {
    // keep the i18n runtime in sync with the persisted UI language
    void i18n.changeLanguage(uiLanguage);
  }, [uiLanguage]);

  useEffect(() => {
    // boot: resolve region (override → detect) and pick today's quote (docs/03 §1)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setRegion(regionOverride ?? detect(tzData.map, { timeZone, languages: navigator.languages }));

    const now = new Date();
    const dateKey = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
    const result = select({
      pool: enData.quotes as unknown as QuoteRecord[],
      mode: 'daily',
      history: [],
      holidayTags: { national: [], international: [] },
      locale: QUOTE_LOCALE,
      dateKey,
    });
    setQuote(result?.quote ?? null);
  }, [regionOverride]);

  return (
    <main
      className="relative grid min-h-dvh place-items-center px-6 text-neutral-100"
      style={backgroundStyle(background)}
    >
      <header className="absolute inset-x-0 top-0 flex items-start justify-between p-6">
        <Clock locale={uiLanguage} />
        <div className="flex items-center gap-3 text-sm">
          <span className="font-mono opacity-70">{region ?? '—'}</span>
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
      {quote && <QuoteView quote={quote} />}
    </main>
  );
}
