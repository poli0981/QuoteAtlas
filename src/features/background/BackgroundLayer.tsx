import { useEffect, useState, type ReactElement } from 'react';
import { mediaUrl } from '../../lib/storage/media-adapter';
import type { BackgroundSettings } from '../settings/store';
import type { MediaItem } from './media';
import { SlideshowPlayer } from './SlideshowPlayer';

function VideoBackground({
  id,
  media,
}: {
  id: string | null;
  media: MediaItem[];
}): ReactElement | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const item = id != null ? media.find((m) => m.id === id) : undefined;
    if (!item) {
      setUrl(null);
      return undefined;
    }
    let live = true;
    let created: string | null = null;
    void mediaUrl(`${item.id}.${item.ext}`)
      .then((u) => {
        if (live) {
          created = u;
          setUrl(u);
        } else {
          URL.revokeObjectURL(u);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
      if (created != null) URL.revokeObjectURL(created);
    };
  }, [id, media]);

  if (url == null) return null;
  return (
    <video
      src={url}
      autoPlay
      loop
      muted
      playsInline
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

/**
 * The video / slideshow background layer (docs/06 §3). Color / gradient / image
 * modes are painted by the main element's CSS `style`, so this returns null for
 * them.
 */
export function BackgroundLayer({
  background,
  media,
}: {
  background: BackgroundSettings;
  media: MediaItem[];
}): ReactElement | null {
  if (background.mode === 'video') {
    return (
      <div className="absolute inset-0 z-0 overflow-hidden bg-black">
        <VideoBackground id={background.videoId} media={media} />
      </div>
    );
  }
  if (background.mode === 'slideshow') {
    return (
      <div className="absolute inset-0 z-0">
        <SlideshowPlayer config={background.slideshow} media={media} />
      </div>
    );
  }
  return null;
}
