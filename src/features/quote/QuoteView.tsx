import type { ReactElement } from 'react';
import { attributionSegments } from './attribution';
import type { QuoteRecord } from './types';

/** The centered quote block + attribution line (docs/06 §1). */
export function QuoteView({ quote }: { quote: QuoteRecord }): ReactElement {
  const segments = attributionSegments(quote);
  return (
    <figure className="mx-auto flex max-w-[34ch] flex-col items-center gap-8 text-center">
      <blockquote
        lang={quote.lang}
        className="font-serif text-3xl leading-snug text-balance text-shadow-sm sm:text-4xl"
      >
        {quote.text}
      </blockquote>
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
