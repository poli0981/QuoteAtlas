import { useEffect, useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  estimateStorage,
  mediaUrl,
  removeMedia as removeMediaFile,
} from '../../lib/storage/media-adapter';
import { useSettings } from '../settings/store';
import { importMedia } from './import';
import { capsFor } from './limits';
import type { MediaItem } from './media';

type Purpose = 'image' | 'video' | 'slideshow';

function fmtBytes(n: number, locale: string): string {
  // Binary MB, formatted through Intl so the unit localizes (docs/07 §7, R9).
  const mb = n / (1024 * 1024);
  const value = mb >= 1 ? Math.round(mb * 10) / 10 : Math.max(1, Math.round(n / 1024));
  const unit = mb >= 1 ? 'megabyte' : 'kilobyte';
  return new Intl.NumberFormat(locale, { style: 'unit', unit, maximumFractionDigits: 1 }).format(
    value,
  );
}

function errKey(reason: string): string {
  return reason === 'library-full' ? 'libraryFull' : reason;
}

/** Media library grid + slideshow controls (docs/06 §3). Behaviour varies by purpose. */
export function MediaLibrary({ purpose }: { purpose: Purpose }): ReactElement {
  const { t, i18n } = useTranslation('media');
  const media = useSettings((s) => s.media);
  const imageId = useSettings((s) => s.background.imageId);
  const videoId = useSettings((s) => s.background.videoId);
  const slideshow = useSettings((s) => s.background.slideshow);
  const addMedia = useSettings((s) => s.addMedia);
  const removeMedia = useSettings((s) => s.removeMedia);
  const setBackground = useSettings((s) => s.setBackground);
  const setSlideshow = useSettings((s) => s.setSlideshow);
  const toggleSlideshowItem = useSettings((s) => s.toggleSlideshowItem);
  const inputRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const caps = capsFor('web');

  const items =
    purpose === 'image'
      ? media.filter((m) => m.kind === 'image')
      : purpose === 'video'
        ? media.filter((m) => m.kind === 'video')
        : media;
  const cap =
    purpose === 'image'
      ? caps.imageMaxFiles
      : purpose === 'video'
        ? caps.videoMaxFiles
        : caps.imageMaxFiles + caps.videoMaxFiles;
  const accept =
    purpose === 'image' ? 'image/*' : purpose === 'video' ? 'video/*' : 'image/*,video/*';

  const isSelected = (m: MediaItem): boolean =>
    purpose === 'image'
      ? imageId === m.id
      : purpose === 'video'
        ? videoId === m.id
        : slideshow.ids.includes(m.id);

  const onSelect = (m: MediaItem): void => {
    if (purpose === 'slideshow') {
      toggleSlideshowItem(m.id);
    } else if (m.kind === 'image') {
      setBackground({ mode: 'image', imageId: m.id });
    } else {
      setBackground({ mode: 'video', videoId: m.id });
    }
  };

  /**
   * Select `m` for the current purpose — idempotent, unlike onSelect. Re-importing
   * a file that is already a slideshow slide must not *toggle it off*.
   */
  const ensureSelected = (m: MediaItem): void => {
    if (purpose === 'slideshow') {
      if (!slideshow.ids.includes(m.id)) toggleSlideshowItem(m.id);
    } else if (m.kind === 'image') {
      setBackground({ mode: 'image', imageId: m.id });
    } else {
      setBackground({ mode: 'video', videoId: m.id });
    }
  };

  const onDelete = (m: MediaItem): void => {
    void removeMediaFile(`${m.id}.${m.ext}`).catch(() => undefined);
    removeMedia(m.id);
  };

  useEffect(() => {
    // resolve image thumbnail URLs; revoke on change/unmount (docs/09 §9)
    const token = { active: true };
    const created: string[] = [];
    void (async () => {
      const next: Record<string, string> = {};
      for (const m of media) {
        if (m.kind !== 'image') continue;
        try {
          const u = await mediaUrl(`${m.id}.${m.ext}`);
          next[m.id] = u;
          created.push(u);
        } catch {
          /* skip missing */
        }
      }
      if (token.active) {
        setUrls(next);
      } else {
        created.forEach((u) => {
          URL.revokeObjectURL(u);
        });
      }
    })();
    return () => {
      token.active = false;
      created.forEach((u) => {
        URL.revokeObjectURL(u);
      });
    };
  }, [media]);

  useEffect(() => {
    void estimateStorage()
      .then(setStorage)
      .catch(() => undefined);
  }, [media]);

  const onPick = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setNotice(null);
    void importMedia(file, 'web', media)
      .then((r) => {
        if (!r.ok) {
          if (r.reason === 'duplicate') {
            // The library already holds these exact bytes — reuse that item rather
            // than burning a second OPFS copy and a second slot in the cap.
            setNotice(t('duplicate'));
            ensureSelected(r.existing);
            return;
          }
          setError(t(`err.${errKey(r.reason)}`));
          return;
        }
        addMedia(r.item);
        ensureSelected(r.item);
      })
      .catch(() => {
        setError(t('err.unsupported'));
      });
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs opacity-70">
        <span>{t('used', { count: items.length, cap })}</span>
        {storage && <span>{t('storage', { used: fmtBytes(storage.usage, i18n.language) })}</span>}
      </div>

      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onPick} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mb-3 w-full rounded bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
      >
        {t('upload')}
      </button>

      {/* Live regions: an import resolves asynchronously, so without these a screen
          reader announces nothing at all when a file is rejected or deduplicated. */}
      {error != null && (
        <p role="alert" className="mb-2 text-xs text-red-300">
          {error}
        </p>
      )}
      {notice != null && (
        <p role="status" className="mb-2 text-xs text-emerald-300">
          {notice}
        </p>
      )}
      {purpose === 'slideshow' && items.length > 0 && (
        <p className="mb-2 text-xs opacity-50">{t('slideshow.hint')}</p>
      )}

      {items.length === 0 ? (
        <p className="text-xs opacity-50">{t('empty')}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {items.map((m, i) => {
            const url = urls[m.id];
            const n = i + 1;
            return (
              <li key={m.id} className="group relative">
                <button
                  type="button"
                  onClick={() => {
                    onSelect(m);
                  }}
                  aria-pressed={isSelected(m)}
                  aria-label={`${t(`kind.${m.kind}`)} ${String(n)} — ${t('select')}`}
                  className={`block aspect-square w-full overflow-hidden rounded ${
                    isSelected(m) ? 'ring-2 ring-white' : ''
                  }`}
                >
                  {m.kind === 'image' && url != null ? (
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center bg-white/10 text-xl">
                      {m.kind === 'video' ? '🎬' : ''}
                    </span>
                  )}
                </button>
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/50 px-1 text-[10px]">
                  {fmtBytes(m.bytes, i18n.language)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(m);
                  }}
                  aria-label={`${t(`kind.${m.kind}`)} ${String(n)} — ${t('delete')}`}
                  className="absolute end-1 top-1 rounded bg-black/60 px-1 text-xs opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {purpose === 'slideshow' && (
        <div className="mt-4 flex flex-col gap-3">
          <label className="block text-sm">
            <span>
              {t('slideshow.interval')}: {slideshow.intervalSeconds}
            </span>
            <input
              type="range"
              min={5}
              max={300}
              value={slideshow.intervalSeconds}
              onChange={(e) => {
                setSlideshow({ intervalSeconds: Number(e.target.value) });
              }}
              className="mt-1 w-full"
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>{t('slideshow.transition')}</span>
            <select
              value={slideshow.transition}
              onChange={(e) => {
                setSlideshow({ transition: e.target.value === 'fade' ? 'fade' : 'crossfade' });
              }}
              className="rounded bg-white/10 px-2 py-1"
            >
              <option value="crossfade">{t('slideshow.crossfade')}</option>
              <option value="fade">{t('slideshow.fade')}</option>
            </select>
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>{t('slideshow.shuffle')}</span>
            <input
              type="checkbox"
              checked={slideshow.shuffle}
              onChange={(e) => {
                setSlideshow({ shuffle: e.target.checked });
              }}
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>{t('slideshow.kenBurns')}</span>
            <input
              type="checkbox"
              checked={slideshow.kenBurns}
              onChange={(e) => {
                setSlideshow({ kenBurns: e.target.checked });
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
