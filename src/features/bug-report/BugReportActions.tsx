import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { getLog } from '../../lib/log-buffer';
import { platformKind } from '../../lib/platform';
import { useSettings } from '../settings/store';
import { buildIssueUrl, buildReportText, collectContext, formatLogs } from './report';

/**
 * "Report bug" + "Export logs" (docs/03 §6, docs/06 §11). Report opens a
 * prefilled GitHub issue for the user to review/submit; if the URL is too long
 * it copies the report and hints to paste it. Nothing is sent automatically.
 */
export function BugReportActions(): ReactElement {
  const { t } = useTranslation('settings');
  const uiLanguage = useSettings((s) => s.uiLanguage);
  const regionOverride = useSettings((s) => s.regionOverride);
  const [copied, setCopied] = useState(false);

  const build = (): { text: string; url: string | null } => {
    const ctx = collectContext({
      appVersion: __APP_VERSION__,
      platform: platformKind(),
      userAgent: navigator.userAgent,
      locale: uiLanguage,
      region: regionOverride,
    });
    const logs = formatLogs(getLog());
    return { text: buildReportText(ctx, logs), url: buildIssueUrl(ctx, logs) };
  };

  const report = (): void => {
    const { text, url } = build();
    if (url) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    void navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(true);
  };

  const exportLogs = (): void => {
    const blob = new Blob([build().text], { type: 'text/plain' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = 'quoteatlas-logs.txt';
    a.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={report}
        className="rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
      >
        {t('about.report')}
      </button>
      <button
        type="button"
        onClick={exportLogs}
        className="rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
      >
        {t('about.export')}
      </button>
      {copied && <span className="text-xs opacity-70">{t('about.copiedHint')}</span>}
    </div>
  );
}
