import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { convertSolar2Lunar, formatVi } from './calendars/amlich';
import { calendarFor, type RegionalCalendar } from './regional-calendar';

/**
 * Live clock: locale date + ticking HH:mm:ss, plus the regional calendar line
 * (docs/06 §1, docs/07 §4).
 *
 * The Vietnamese line comes from the in-house `amlich.ts`, never from Intl's
 * `chinese` calendar — R8. That module is wired in now because its vectors were
 * verified across 1900–2100 against an independent implementation, and the two
 * impossible dates that sweep exposed were fixed first.
 */
function regionalLine(cal: RegionalCalendar, now: Date, uiLanguage: string): string | null {
  if (cal.kind === 'vn') {
    // amlich is defined at UTC+7, but `now` is the viewer's clock. Read the civil
    // date *in Vietnam* so someone abroad still sees Vietnam's lunar date rather
    // than one shifted by wherever they happen to be.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    const [y, m, d] = parts.split('-').map(Number) as [number, number, number];
    return formatVi(convertSolar2Lunar(d, m, y));
  }

  try {
    return new Intl.DateTimeFormat(`${uiLanguage}-u-ca-${cal.calendar}`, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      ...(cal.era === true ? { era: 'short' as const } : {}),
    }).format(now);
  } catch {
    // An engine missing this calendar must lose the line, not the clock.
    return null;
  }
}

export function Clock({
  locale,
  hour12 = false,
  region = null,
}: {
  locale: string;
  hour12?: boolean;
  region?: string | null;
}): ReactElement {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // tick once per second to keep the displayed time live
    const id = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, []);

  const date = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12,
  }).format(now);

  const cal = calendarFor(region);
  // The regional date changes at most once a day; keying the memo on the day
  // keeps the astronomical conversion from running 86 400 times a day.
  const dayKey = `${String(now.getFullYear())}-${String(now.getMonth())}-${String(now.getDate())}`;
  const calKey = cal == null ? '' : cal.kind === 'vn' ? 'vn' : cal.calendar;
  const regional = useMemo(
    () => (cal == null ? null : regionalLine(cal, now, locale)),
    // `now` is intentionally absent: this must recompute per day, not per tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calKey, dayKey, locale],
  );

  return (
    <div className="text-sm opacity-80">
      <div>
        {date} · {time}
      </div>
      {regional != null && (
        <div className="opacity-75">
          {cal?.kind === 'vn' ? `${t('calendar.lunarVi')}: ${regional}` : regional}
        </div>
      )}
    </div>
  );
}
