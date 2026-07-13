import { useEffect, useState, type ReactElement } from 'react';
import enData from '../../data/quotes/en.json';
import tzData from '../features/region/tz-to-country.json';
import { Clock } from '../features/clock/Clock';
import { select } from '../features/quote/engine';
import { QuoteView } from '../features/quote/QuoteView';
import type { QuoteRecord } from '../features/quote/types';
import { detect } from '../features/region/detect';

// First-cut boot (docs/03 §1): detect region, pick today's quote from the bundled
// `en` pool. Lazy locale-loading, region picker, i18n, backgrounds, persistence
// and the legal gate are the next M4 increment.
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

const LOCALE = 'en'; // only pool available in this first cut

export function App(): ReactElement {
  const [quote, setQuote] = useState<QuoteRecord | null>(null);
  const [region, setRegion] = useState<string | null>(null);

  useEffect(() => {
    // one-time boot on mount
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setRegion(detect(tzData.map, { timeZone, languages: navigator.languages }));

    const now = new Date();
    const dateKey = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
    const result = select({
      pool: enData.quotes as unknown as QuoteRecord[],
      mode: 'daily',
      history: [],
      holidayTags: { national: [], international: [] },
      locale: LOCALE,
      dateKey,
    });
    setQuote(result?.quote ?? null);
  }, []);

  return (
    <main className="relative grid min-h-dvh place-items-center bg-neutral-950 px-6 text-neutral-100">
      <header className="absolute inset-x-0 top-0 flex items-start justify-between p-6">
        <Clock locale={LOCALE} />
        <div className="font-mono text-sm opacity-70">{region ?? '—'}</div>
      </header>
      {quote && <QuoteView quote={quote} />}
    </main>
  );
}
