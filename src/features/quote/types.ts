/** Quote domain types — mirror of data/schema/quote.schema.json (docs/04 §1). */

export type QuoteType = 'proverb' | 'quote' | 'movie' | 'game' | 'book';

export type Rights = 'public-domain' | 'quoted-with-attribution' | 'own-translation' | 'cc0';

export interface Attribution {
  work: string | null;
  character: string | null;
  /** movie only — the actor who delivers the line */
  actor: string | null;
  /** book/quote author */
  author: string | null;
  /** game only */
  developer: string | null;
  /** game only */
  publisher: string | null;
  /** proverb/quote provenance label */
  source: string | null;
  year: number | null;
  /** attribution links, host-allowlisted in CI (docs/04 §6) */
  links: { work?: string; author?: string };
  rights: Rights;
}

export interface QuoteRecord {
  id: string;
  type: QuoteType;
  text: string;
  /** BCP-47 of `text` */
  lang: string;
  translations: Record<string, string>;
  attribution: Attribution;
  /** ISO 3166-1 alpha-2 region codes; drives region pools */
  regions: string[];
  tags: string[];
  /** holiday tag ids, e.g. ["tet","new-year"] */
  holidays: string[];
}

export type QuoteMode = 'per-load' | 'daily' | 'rotate';
