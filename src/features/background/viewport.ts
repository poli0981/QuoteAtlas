/**
 * The display the aspect gate judges background media against (docs/03 §4).
 *
 * `screen`, not the window: a background is ambient wallpaper for a display, and
 * the window it happens to occupy at import time can be resized or rotated a
 * second later — a verdict that flips with a drag of the window edge would be
 * worse than no verdict. Kept in its own shell so media.ts stays pure and takes
 * the numbers as arguments.
 */
import type { ScreenSize } from './media';

export function screenSize(): ScreenSize {
  // Headless and embedded browsers can report 0 here; the gate reads that as
  // "cannot tell" and lets the import through rather than guessing.
  return { w: screen.width, h: screen.height };
}
