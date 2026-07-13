/**
 * The single attribution formatter (CLAUDE.md R3) — consumed by the app UI
 * **and** scripts/gen-attributions.ts. Never write a second formatter.
 *
 * Segment order is locked per type (docs/04 §5). Missing optional fields
 * collapse (their separators disappear); `work` / `author` / `source` is the
 * guaranteed minimum. The markdown variant swaps the underline for `[text](url)`.
 */
import type { QuoteRecord } from './types';

export interface AttributionSegment {
  text: string;
  /** present ⇒ this segment is a link */
  href?: string;
}

const PREFIX = '— ';
const SEP = ' – ';

function seg(text: string | null, href?: string): AttributionSegment | null {
  if (!text) return null;
  return href ? { text, href } : { text };
}

/** Ordered, collapsed attribution segments for a record (docs/04 §5). */
export function attributionSegments(record: QuoteRecord): AttributionSegment[] {
  const a = record.attribution;
  let raw: (AttributionSegment | null)[];

  switch (record.type) {
    case 'movie':
      raw = [seg(a.work, a.links.work), seg(a.character), seg(a.actor)];
      break;
    case 'book':
      raw = [seg(a.character), seg(a.work, a.links.work), seg(a.author, a.links.author)];
      break;
    case 'game':
      raw = [seg(a.character), seg(a.work, a.links.work), seg(a.developer ?? a.publisher)];
      break;
    case 'quote':
      raw = [seg(a.author ?? a.source, a.author ? a.links.author : undefined)];
      break;
    case 'proverb':
      raw = [seg(a.source)];
      break;
  }

  return raw.filter((s): s is AttributionSegment => s !== null);
}

/** Plain-text attribution line (aria/copy): "— Work – Character – Actor". */
export function attributionText(record: QuoteRecord): string {
  const segs = attributionSegments(record);
  return segs.length ? PREFIX + segs.map((s) => s.text).join(SEP) : '';
}

/** Markdown attribution line (docs/14 §9 ATTRIBUTIONS.md): links as [text](url). */
export function attributionMarkdown(record: QuoteRecord): string {
  const segs = attributionSegments(record);
  if (!segs.length) return '';
  return PREFIX + segs.map((s) => (s.href ? `[${s.text}](${s.href})` : s.text)).join(SEP);
}
