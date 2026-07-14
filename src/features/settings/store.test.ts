import { beforeEach, describe, expect, it } from 'vitest';
import type { MediaItem } from '../background/media';
import { DEFAULT_SETTINGS, useSettings } from './store';

const img: MediaItem = {
  id: 'a',
  kind: 'image',
  mime: 'image/png',
  ext: 'png',
  bytes: 100,
  w: 10,
  h: 10,
  addedAt: 0,
};

beforeEach(() => {
  useSettings.setState(structuredClone(DEFAULT_SETTINGS));
});

const s = () => useSettings.getState();

describe('settings store', () => {
  it('update patches top-level fields', () => {
    s().update({ hour12: true, quoteMode: 'per-load' });
    expect(s().hour12).toBe(true);
    expect(s().quoteMode).toBe('per-load');
  });

  it('setBackground merges the background', () => {
    s().setBackground({ mode: 'color', color: '#fff' });
    expect(s().background.mode).toBe('color');
    expect(s().background.color).toBe('#fff');
  });

  it('acceptLegal records consent', () => {
    s().acceptLegal(3);
    expect(s().consentVersion).toBe(3);
  });

  it('toggles + clears favorites', () => {
    s().toggleFavorite('q1');
    expect(s().favorites).toEqual(['q1']);
    s().toggleFavorite('q1');
    expect(s().favorites).toEqual([]);
    s().toggleFavorite('q2');
    s().clearFavorites();
    expect(s().favorites).toEqual([]);
  });

  it('adds media and removes it, reverting an image background', () => {
    s().addMedia(img);
    s().setBackground({ mode: 'image', imageId: 'a' });
    expect(s().media).toHaveLength(1);
    s().removeMedia('a');
    expect(s().media).toEqual([]);
    expect(s().background.imageId).toBeNull();
    expect(s().background.mode).toBe('gradient');
  });

  it('manages slideshow selection + config', () => {
    s().toggleSlideshowItem('a');
    expect(s().background.slideshow.ids).toEqual(['a']);
    s().setSlideshow({ intervalSeconds: 20, shuffle: true });
    expect(s().background.slideshow.intervalSeconds).toBe(20);
    expect(s().background.slideshow.shuffle).toBe(true);
    s().toggleSlideshowItem('a');
    expect(s().background.slideshow.ids).toEqual([]);
  });

  it('removeMedia clears a video background + slideshow ids', () => {
    const vid: MediaItem = { ...img, id: 'v', kind: 'video', mime: 'video/mp4', ext: 'mp4' };
    s().addMedia(vid);
    s().setBackground({ mode: 'video', videoId: 'v' });
    s().toggleSlideshowItem('v');
    s().removeMedia('v');
    expect(s().background.videoId).toBeNull();
    expect(s().background.mode).toBe('gradient');
    expect(s().background.slideshow.ids).toEqual([]);
  });
});
