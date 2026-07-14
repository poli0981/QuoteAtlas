import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { mediaUrl } from '../../lib/storage/media-adapter';
import type { SlideshowSettings } from '../settings/store';
import type { MediaItem } from './media';

/**
 * Slideshow background (docs/06 §3): steps through the selected media on an
 * interval with the chosen transition — `crossfade` overlaps the outgoing and
 * incoming slides, `fade` dips through the black backdrop. Optional shuffle +
 * Ken Burns (images). Only the visible video ever decodes (docs/09 §9, spike
 * S2); all non-essential motion is gated behind prefers-reduced-motion in CSS.
 */
export function SlideshowPlayer({
  config,
  media,
}: {
  config: SlideshowSettings;
  media: MediaItem[];
}): ReactElement | null {
  const items = useMemo(
    () =>
      config.ids
        .map((id) => media.find((m) => m.id === id))
        .filter((m): m is MediaItem => m !== undefined),
    [config.ids, media],
  );

  const [urls, setUrls] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const videoEls = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    // resolve object URLs; revoke on change/unmount (docs/09 §9)
    const token = { active: true };
    const created: string[] = [];
    void (async () => {
      const next: Record<string, string> = {};
      for (const m of items) {
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
  }, [items]);

  useEffect(() => {
    // (re)build the play order when the set or shuffle changes
    const idx = items.map((_, i) => i);
    if (config.shuffle) {
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idx[i], idx[j]] = [idx[j] ?? i, idx[i] ?? j];
      }
    }
    setOrder(idx);
    setPos(0);
  }, [items, config.shuffle]);

  useEffect(() => {
    if (order.length <= 1) return undefined;
    const id = setInterval(
      () => {
        setPos((p) => (p + 1) % order.length);
      },
      Math.max(2, config.intervalSeconds) * 1000,
    );
    return () => {
      clearInterval(id);
    };
  }, [order.length, config.intervalSeconds]);

  const activeItem = order[pos] ?? 0;
  const activeId = items[activeItem]?.id;

  useEffect(() => {
    // Only the visible slide's video should decode/loop; pause the rest so a
    // library of N videos doesn't run N simultaneous decodes (spike S2).
    videoEls.current.forEach((el, id) => {
      if (id === activeId) {
        void el.play().catch(() => {
          /* autoplay may be blocked; harmless for a muted bg */
        });
      } else {
        el.pause();
      }
    });
  }, [activeId, urls]);

  if (items.length === 0) return null;

  const renderMedia = (m: MediaItem, active: boolean, url: string): ReactElement =>
    m.kind === 'image' ? (
      <img
        src={url}
        alt=""
        className={`h-full w-full object-cover ${active && config.kenBurns ? 'qa-kenburns' : ''}`}
      />
    ) : (
      <video
        ref={(el) => {
          if (el) videoEls.current.set(m.id, el);
          else videoEls.current.delete(m.id);
        }}
        src={url}
        loop
        muted
        playsInline
        className="h-full w-full object-cover"
      />
    );

  // Fade-to-black: mount only the active slide; it fades in from the black
  // backdrop as the previous one unmounts (and only one video ever decodes).
  if (config.transition === 'fade') {
    const m = items[activeItem];
    const url = m ? urls[m.id] : undefined;
    return (
      <div className="absolute inset-0 overflow-hidden bg-black">
        {m && url != null && (
          <div key={m.id} className="qa-fadein absolute inset-0">
            {renderMedia(m, true, url)}
          </div>
        )}
      </div>
    );
  }

  // Crossfade: stack every slide and blend opacity; only the active video plays.
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {items.map((m, i) => {
        const url = urls[m.id];
        const active = i === activeItem;
        if (url == null) return null;
        return (
          <div
            key={m.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              active ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {renderMedia(m, active, url)}
          </div>
        );
      })}
    </div>
  );
}
