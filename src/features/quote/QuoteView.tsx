import type { ReactElement } from 'react';
import { attributionSegments } from './attribution';
import type { QuoteRecord } from './types';

/** The centered quote block + attribution line (docs/06 §1). */
export function QuoteView({
  quote,
  bilingual = false,
  uiLanguage = 'en',
}: {
  quote: QuoteRecord;
  bilingual?: boolean;
  uiLanguage?: string;
}): ReactElement {
  const segments = attributionSegments(quote);
  const translation = bilingual
    ? (quote.translations[uiLanguage] ?? quote.translations.en)
    : undefined;
  return (
    <figure className="mx-auto flex max-w-[34ch] flex-col items-center gap-8 text-center">
      <blockquote
        lang={quote.lang}
        className="font-serif text-3xl leading-snug text-balance sm:text-4xl"
      >
        {quote.text}
      </blockquote>
      {translation && translation !== quote.text && (
        <p lang={uiLanguage} className="max-w-[40ch] text-xl leading-snug opacity-70">
          {translation}
        </p>
      )}
      {segments.length > 0 && (
        <figcaption className="text-sm tracking-wide opacity-70">
          {'— '}
          {segments.map((s, i) => (
            <span key={`${s.text}-${i}`}>
              {i > 0 && ' – '}
              {s.href ? (
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-4 hover:underline"
                >
                  {s.text}
                </a>
              ) : (
                s.text
              )}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
