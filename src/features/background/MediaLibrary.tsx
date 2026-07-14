import { useEffect, useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  estimateStorage,
  mediaUrl,
  removeMedia as removeMediaFile,
} from '../../lib/storage/media-adapter';
import { useSettings } from '../settings/store';
import { importImage } from './import-image';
import { capsFor } from './limits';
import type { MediaItem } from './media';

function fmtBytes(n: number): string {
  const mb = n / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Image library grid: upload, select-as-background, delete, used/cap + storage meter. */
export function MediaLibrary(): ReactElement {
  const { t } = useTranslation('media');
  const media = useSettings((s) => s.media);
  const imageId = useSettings((s) => s.background.imageId);
  const addMedia = useSettings((s) => s.addMedia);
  const removeMedia = useSettings((s) => s.removeMedia);
  const setBackground = useSettings((s) => s.setBackground);
  const inputRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const caps = capsFor('web');

  const onDelete = (m: MediaItem): void => {
    void removeMediaFile(`${m.id}.${m.ext}`).catch(() => undefined);
    removeMedia(m.id);
  };

  useEffect(() => {
    // resolve thumbnail object URLs; revoke them on change/unmount (docs/09 §9)
    const token = { active: true };
    const created: string[] = [];
    void (async () => {
      const next: Record<string, string> = {};
      for (const m of media) {
        try {
          const u = await mediaUrl(`${m.id}.${m.ext}`);
          next[m.id] = u;
          created.push(u);
        } catch {
          /* file missing — skip */
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
    void importImage(file, 'web', media.length)
      .then((r) => {
        if (r.ok) {
          addMedia(r.item);
          setBackground({ mode: 'image', imageId: r.item.id });
        } else {
          setError(t(`err.${r.reason === 'library-full' ? 'libraryFull' : r.reason}`));
        }
      })
      .catch(() => {
        setError(t('err.uncompressible'));
      });
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs opacity-70">
        <span>{t('used', { count: media.length, cap: caps.imageMaxFiles })}</span>
        {storage && <span>{t('storage', { used: fmtBytes(storage.usage) })}</span>}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mb-3 w-full rounded bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
      >
        {t('upload')}
      </button>

      {error != null && <p className="mb-2 text-xs text-red-300">{error}</p>}

      {media.length === 0 ? (
        <p className="text-xs opacity-50">{t('empty')}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {media.map((m) => {
            const url = urls[m.id];
            return (
              <li key={m.id} className="group relative">
                <button
                  type="button"
                  onClick={() => {
                    setBackground({ mode: 'image', imageId: m.id });
                  }}
                  aria-pressed={imageId === m.id}
                  aria-label={t('select')}
                  className={`block aspect-square w-full overflow-hidden rounded ${
                    imageId === m.id ? 'ring-2 ring-white' : ''
                  }`}
                >
                  {url != null ? (
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="block h-full w-full bg-white/10" />
                  )}
                </button>
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/50 px-1 text-[10px]">
                  {fmtBytes(m.bytes)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(m);
                  }}
                  aria-label={t('delete')}
                  className="absolute end-1 top-1 rounded bg-black/60 px-1 text-xs opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
