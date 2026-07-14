import type { Locator, Page } from '@playwright/test';
import { S, expect, openSettings, readStore, test, tinyPng } from './fixtures';

/**
 * Background media library (docs/06 §3): OPFS import → grid → apply as background.
 * Only the image + slideshow halves are covered; video needs a real encoded file.
 */

/** The slice of the persisted settings this spec asserts on. */
interface PersistedState {
  media: { id: string; kind: string }[];
  background: {
    mode: string;
    imageId: string | null;
    slideshow: { ids: string[]; transition: string };
  };
}

async function persisted(page: Page): Promise<PersistedState> {
  return (await readStore(page)) as unknown as PersistedState;
}

/** The stored media ids, in library order. */
async function mediaIds(page: Page): Promise<string[]> {
  return (await persisted(page)).media.map((m) => m.id);
}

/** Grid buttons are labelled `<kind> <n> — <action>` (MediaLibrary.tsx). */
function itemLabel(n: number, action: string): string {
  return `${S.media.kind.image} ${n} — ${action}`;
}

/** What <main> is currently painted with (App.backgroundStyle writes it inline). */
function mainBackground(page: Page): Promise<string> {
  return page.locator('main').evaluate((el) => getComputedStyle(el).backgroundImage);
}

/** Pick a background mode in the drawer's mode group (scoped: "Image" also labels grid items). */
async function chooseMode(panel: Locator, mode: string): Promise<void> {
  const button = panel
    .getByRole('group', { name: S.settings.background.mode })
    .getByRole('button', { name: mode, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

/**
 * Import one image. The real "Add image or video" button opens an OS picker, so the
 * only way in is the hidden <input type=file> it proxies to — setInputFiles drives
 * hidden inputs fine. Waiting on the grid count settles the async import
 * (sniff → decode → OPFS) before a second pick reuses the same input.
 */
async function upload(panel: Locator, expectedItems: number): Promise<void> {
  await panel.locator('input[type="file"]').setInputFiles(tinyPng());
  await expect(panel.getByRole('listitem')).toHaveCount(expectedItems);
}

async function closeSettings(panel: Locator): Promise<void> {
  await panel.getByRole('button', { name: S.settings.close }).click();
  await expect(panel).toBeHidden();
}

test.describe('background media library', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'OPFS/canvas import is chromium-only');

  test('image mode starts with an empty library and paints nothing', async ({ app }) => {
    const panel = await openSettings(app);
    await chooseMode(panel, S.settings.background.image);

    await expect(panel.getByText(S.media.empty)).toBeVisible();
    await expect(panel.getByRole('listitem')).toHaveCount(0);
    await expect(panel.getByRole('button', { name: S.media.upload })).toBeVisible();

    // an empty library must leave nothing applied: image mode with no imageId falls
    // back to the flat color, so <main> carries no url() at all
    await expect(app.locator('main')).toHaveCSS('background-image', 'none');
    const state = await persisted(app);
    expect(state.background.mode).toBe('image');
    expect(state.background.imageId).toBeNull();
    expect(state.media).toEqual([]);
  });

  test('an imported image lands in the grid, the store and the page background', async ({
    app,
  }) => {
    const panel = await openSettings(app);
    await chooseMode(panel, S.settings.background.image);
    await upload(panel, 1);

    const item = panel.getByRole('button', { name: itemLabel(1, S.media.select) });
    await expect(item).toBeVisible();
    await expect(panel.getByText(S.media.empty)).toBeHidden();
    // a fresh import is applied immediately — the item comes back selected
    await expect(item).toHaveAttribute('aria-pressed', 'true');
    // the thumbnail is read back out of OPFS, not echoed from the picked File
    await expect(item.locator('img')).toHaveAttribute('src', /^blob:/);

    const state = await persisted(app);
    expect(state.media).toHaveLength(1);
    expect(state.media[0]?.kind).toBe('image');
    expect(state.background.mode).toBe('image');
    expect(state.background.imageId).toBe(state.media[0]?.id);

    // <main> paints the OPFS file itself; no other background mode yields url(blob:)
    await expect(app.locator('main')).toHaveCSS('background-image', /^url\("blob:/);
  });

  test('tapping a library item swaps which image is applied', async ({ app }) => {
    const panel = await openSettings(app);
    await chooseMode(panel, S.settings.background.image);
    await upload(panel, 1);
    await upload(panel, 2);

    const first = panel.getByRole('button', { name: itemLabel(1, S.media.select) });
    const second = panel.getByRole('button', { name: itemLabel(2, S.media.select) });
    const ids = await mediaIds(app);
    // the newest import is the one currently applied — tapping item 1 must move it
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    expect((await persisted(app)).background.imageId).toBe(ids[1]);
    const before = await mainBackground(app);

    await first.click();

    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(second).toHaveAttribute('aria-pressed', 'false');
    expect((await persisted(app)).background.imageId).toBe(ids[0]);

    // App re-resolves the object URL only when background.imageId actually changes,
    // so a *different* blob url is proof the selection reached the painted layer.
    await expect.poll(() => mainBackground(app)).not.toBe(before);
    await expect(app.locator('main')).toHaveCSS('background-image', /^url\("blob:/);
  });

  test('each item gets its own label, and delete removes it from the grid and the store', async ({
    app,
  }) => {
    const panel = await openSettings(app);
    await chooseMode(panel, S.settings.background.image);
    await upload(panel, 1);
    await upload(panel, 2);

    const ids = await mediaIds(app);
    expect(ids).toHaveLength(2);
    // ids key the OPFS filenames — a collision would make one import clobber the other
    expect(new Set(ids).size).toBe(2);
    const survivor = ids[1];

    const first = panel.getByRole('button', { name: itemLabel(1, S.media.select) });
    const second = panel.getByRole('button', { name: itemLabel(2, S.media.select) });
    // the two buttons are distinct elements with distinct selection state, i.e. the
    // grid really is per-item and not one label reused
    await expect(first).toHaveAttribute('aria-pressed', 'false');
    await expect(second).toHaveAttribute('aria-pressed', 'true');

    // delete the *first* (unselected) item on purpose: deleting the selected image
    // resets the mode to gradient and unmounts the library entirely
    await panel.getByRole('button', { name: itemLabel(1, S.media.delete) }).click();

    await expect(panel.getByRole('listitem')).toHaveCount(1);
    // the survivor renumbers to 1 and stays applied; the old slot 2 is gone
    await expect(panel.getByRole('button', { name: itemLabel(1, S.media.select) })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(panel.getByRole('button', { name: itemLabel(2, S.media.select) })).toHaveCount(0);

    const after = await persisted(app);
    expect(after.media.map((m) => m.id)).toEqual([survivor]);
    expect(after.background.mode).toBe('image');
    expect(after.background.imageId).toBe(survivor);
    // deleting an unrelated file must not tear down the painted background
    await expect(app.locator('main')).toHaveCSS('background-image', /^url\("blob:/);
  });

  test('slideshow crossfade stacks every selected slide', async ({ app }) => {
    const panel = await openSettings(app);
    await chooseMode(panel, S.settings.background.slideshow);
    await upload(panel, 1);
    await upload(panel, 2);

    const state = await persisted(app);
    expect(state.background.mode).toBe('slideshow');
    // importing while in slideshow mode enrolls the item in the playlist
    expect(state.background.slideshow.ids).toEqual(state.media.map((m) => m.id));
    expect(state.background.slideshow.transition).toBe('crossfade');

    await closeSettings(panel);

    // with the drawer unmounted, the only <img>s left on the page are the slides
    const slides = app.locator('main img');
    await expect(slides).toHaveCount(2);
    await expect(slides.nth(0)).toHaveAttribute('src', /^blob:/);
    await expect(slides.nth(1)).toHaveAttribute('src', /^blob:/);

    const srcs = await slides.evaluateAll((els) => els.map((el) => el.getAttribute('src')));
    expect(new Set(srcs).size).toBe(2); // two distinct OPFS blobs, not one blob twice

    // crossfade blends opacity between stacked layers: one shown, one waiting beneath.
    // Polled (not a fixed nth) because the interval timer may have already advanced.
    const layers = slides.locator('xpath=..');
    await expect
      .poll(async () =>
        (await layers.evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity))).sort(),
      )
      .toEqual(['0', '1']);
  });

  test('tapping a slide again drops it from the playlist and the stack', async ({ app }) => {
    const panel = await openSettings(app);
    await chooseMode(panel, S.settings.background.slideshow);
    await upload(panel, 1);
    await upload(panel, 2);

    const first = panel.getByRole('button', { name: itemLabel(1, S.media.select) });
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    const ids = await mediaIds(app);

    // "Tap items to include in the slideshow" — tapping an included one excludes it
    await expect(panel.getByText(S.media.slideshow.hint)).toBeVisible();
    await first.click();

    await expect(first).toHaveAttribute('aria-pressed', 'false');
    // it leaves the playlist but stays in the library
    expect((await persisted(app)).background.slideshow.ids).toEqual([ids[1]]);
    await expect(panel.getByRole('listitem')).toHaveCount(2);

    await closeSettings(panel);

    // the excluded slide must leave the stack, not merely lose its ring
    const slides = app.locator('main img');
    await expect(slides).toHaveCount(1);
    await expect(slides).toHaveAttribute('src', /^blob:/);
  });

  test('switching to the fade transition mounts only the active slide', async ({ app }) => {
    let panel = await openSettings(app);
    await chooseMode(panel, S.settings.background.slideshow);
    await upload(panel, 1);
    await upload(panel, 2);
    await closeSettings(panel);

    // baseline: the default crossfade keeps both slides mounted…
    await expect(app.locator('main img')).toHaveCount(2);

    panel = await openSettings(app);
    const transition = panel.getByLabel(S.media.slideshow.transition);
    await transition.selectOption({ label: S.media.slideshow.fade });
    await expect(transition).toHaveValue('fade');
    expect((await persisted(app)).background.slideshow.transition).toBe('fade');
    await closeSettings(panel);

    // …while fade dips through the black backdrop, so the outgoing slide unmounts.
    // Same two-item playlist, one layer instead of two — the select drove the DOM.
    const slides = app.locator('main img');
    await expect(slides).toHaveCount(1);
    await expect(slides).toHaveAttribute('src', /^blob:/);
  });
});
