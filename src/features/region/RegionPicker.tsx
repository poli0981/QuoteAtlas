import { useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../settings/store';

/**
 * Region picker (docs/06 §6): searchable country list (localized via
 * Intl.DisplayNames) + "reset to auto". Regions with a native pool are marked;
 * the fallback banner (rendered by the caller) surfaces the no-pool case.
 */
export function RegionPicker({
  detected,
  poolRegions,
  allRegions,
  uiLanguage,
}: {
  detected: string | null;
  poolRegions: Set<string>;
  allRegions: string[];
  uiLanguage: string;
}): ReactElement {
  const { t } = useTranslation();
  const regionOverride = useSettings((s) => s.regionOverride);
  const update = useSettings((s) => s.update);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const displayNames = useMemo(
    () => new Intl.DisplayNames([uiLanguage], { type: 'region' }),
    [uiLanguage],
  );
  const nameOf = (code: string): string => {
    try {
      return displayNames.of(code) ?? code;
    } catch {
      return code;
    }
  };

  const effective = regionOverride ?? detected;
  const q = query.trim().toLowerCase();
  const items = allRegions
    .map((code) => ({ code, name: nameOf(code) }))
    .filter(
      ({ code, name }) =>
        q === '' || name.toLowerCase().includes(q) || code.toLowerCase().includes(q),
    )
    .sort((a, b) => a.name.localeCompare(b.name, uiLanguage));

  const choose = (region: string | null): void => {
    update({ regionOverride: region });
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-1 rounded px-2 py-1 hover:bg-white/10"
      >
        <span aria-hidden>🌐</span>
        <span>{effective ? nameOf(effective) : t('region.auto')}</span>
      </button>

      {open && (
        <div
          className="absolute end-0 z-40 mt-2 w-64 rounded-xl bg-neutral-900/95 p-2 shadow-xl backdrop-blur"
          role="listbox"
        >
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            placeholder={t('region.search')}
            aria-label={t('region.search')}
            className="mb-2 w-full rounded bg-white/10 px-2 py-1 text-sm outline-none placeholder:opacity-50"
          />
          <button
            type="button"
            onClick={() => {
              choose(null);
            }}
            className="mb-1 block w-full rounded px-2 py-1 text-start text-sm opacity-80 hover:bg-white/10"
          >
            {t('region.reset')}
          </button>
          <ul className="max-h-64 overflow-y-auto">
            {items.map(({ code, name }) => (
              <li key={code}>
                <button
                  type="button"
                  onClick={() => {
                    choose(code);
                  }}
                  role="option"
                  aria-selected={effective === code}
                  className={`flex w-full items-center justify-between rounded px-2 py-1 text-start text-sm hover:bg-white/10 ${
                    effective === code ? 'bg-white/10' : ''
                  }`}
                >
                  <span>{name}</span>
                  <span className="font-mono text-xs opacity-50">
                    {poolRegions.has(code) ? `${code} ✓` : code}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
