import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { capsFor, classifyImage, imageCapBytes, targetEdge } from './limits';

const MB = 1024 * 1024;

describe('capsFor', () => {
  it('web profile caps (docs/04 §7)', () => {
    const c = capsFor('web');
    expect(c.imageMaxFiles).toBe(25);
    expect(c.videoMaxFiles).toBe(10);
    expect(c.videoMaxBytes4k).toBe(125 * MB);
  });

  it('desktop-android profile caps', () => {
    const c = capsFor('desktop-android');
    expect(c.imageMaxFiles).toBe(40);
    expect(c.videoMaxFiles).toBe(20);
    expect(c.videoMaxBytes4k).toBe(150 * MB);
  });

  it('shares byte/duration caps across profiles', () => {
    expect(capsFor('web').videoMaxBytes1080).toBe(capsFor('desktop-android').videoMaxBytes1080);
    expect(capsFor('web').videoMaxSeconds).toBe(capsFor('desktop-android').videoMaxSeconds);
  });
});

describe('classifyImage — class edges', () => {
  const caps = capsFor('web');
  it('1920 → P1080, 1921 → P4K', () => {
    expect(classifyImage(1920, caps)).toBe('P1080');
    expect(classifyImage(1921, caps)).toBe('P4K');
  });
  it('3840 → P4K, 3841 → OVERSIZE', () => {
    expect(classifyImage(3840, caps)).toBe('P4K');
    expect(classifyImage(3841, caps)).toBe('OVERSIZE');
  });
});

describe('imageCapBytes / targetEdge', () => {
  const caps = capsFor('web');
  it('maps classes to caps and target edges', () => {
    expect(imageCapBytes('P1080', caps)).toBe(10 * MB);
    expect(imageCapBytes('P4K', caps)).toBe(25 * MB);
    expect(targetEdge('P1080', caps)).toBe(1920);
    expect(targetEdge('P4K', caps)).toBe(3840);
  });
});

describe('R2 — no literal media caps outside limits.ts', () => {
  it('resolution-class caps (1920/3840/2160) appear only in limits.ts', () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, ent.name);
        if (ent.isDirectory()) {
          walk(p);
        } else if (
          /\.tsx?$/.test(ent.name) &&
          !/\.test\.tsx?$/.test(ent.name) &&
          ent.name !== 'limits.ts'
        ) {
          if (/\b(?:1920|3840|2160)\b/.test(readFileSync(p, 'utf8'))) offenders.push(p);
        }
      }
    };
    walk(join(process.cwd(), 'src'));
    expect(offenders).toEqual([]);
  });
});
