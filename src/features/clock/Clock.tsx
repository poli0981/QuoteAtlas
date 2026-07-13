import { useEffect, useState, type ReactElement } from 'react';

/**
 * Live clock: locale date + ticking HH:mm:ss (docs/06 §1). The regional calendar
 * line (docs/07 §4) — incl. the VN amlich line — is added once its fixture is
 * human-verified (R8); until then only the Gregorian line shows.
 */
export function Clock({
  locale,
  hour12 = false,
}: {
  locale: string;
  hour12?: boolean;
}): ReactElement {
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

  return (
    <div className="text-sm opacity-80">
      {date} · {time}
    </div>
  );
}
