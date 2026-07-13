/**
 * Bug-report builders (docs/03 §6). Pure — the UI collects the impure bits
 * (navigator, log ring) and passes them in. No automatic transmission ever;
 * every report is a user click that only *prefills* a GitHub issue for review.
 */
import { redact, type LogEntry } from '../../lib/log-buffer';

const REPO = 'https://github.com/poli0981/QuoteAtlas';
/** GitHub caps issue URLs; beyond this we fall back to clipboard (docs/03 §6). */
const MAX_URL = 7000;

export interface BugContext {
  appVersion: string;
  platform: string;
  os: string;
  locale: string;
  region: string;
}

/** Coarse OS label from a user-agent string. */
export function deriveOs(ua: string): string {
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/windows/i.test(ua)) return 'Windows';
  if (/mac os x|macintosh/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'unknown';
}

export function collectContext(input: {
  appVersion: string;
  platform: string;
  userAgent: string;
  locale: string;
  region: string | null;
}): BugContext {
  return {
    appVersion: input.appVersion,
    platform: input.platform,
    os: deriveOs(input.userAgent),
    locale: input.locale,
    region: input.region ?? 'auto',
  };
}

/** Redacted, newline-joined log lines for the report body (docs/09 §6). */
export function formatLogs(entries: readonly LogEntry[]): string {
  return entries
    .map((e) => {
      const code = e.code ? ` ${e.code}` : '';
      return `[${new Date(e.t).toISOString()}] ${e.level}${code}: ${redact(e.msg)}`;
    })
    .join('\n');
}

/** Plaintext report (for the .txt export and the clipboard fallback). */
export function buildReportText(ctx: BugContext, logs: string): string {
  const header = [
    `App: QuoteAtlas ${ctx.appVersion}`,
    `Platform: ${ctx.platform} / ${ctx.os}`,
    `Locale: ${ctx.locale} · Region: ${ctx.region}`,
  ].join('\n');
  return `${header}\n\n--- Logs (redacted) ---\n${logs || '(no log entries)'}\n`;
}

/**
 * Prefilled GitHub new-issue URL, or null if it would exceed MAX_URL (caller
 * then copies the report to the clipboard instead). Uses the `body` param so it
 * works before the `bug_report.yml` issue form exists; switch to template+field
 * params once that form is committed (docs/03 §6).
 */
export function buildIssueUrl(ctx: BugContext, logs: string): string | null {
  const params = new URLSearchParams({
    title: `Bug: QuoteAtlas ${ctx.appVersion}`,
    body: buildReportText(ctx, logs),
  });
  const url = `${REPO}/issues/new?${params.toString()}`;
  return url.length <= MAX_URL ? url : null;
}
