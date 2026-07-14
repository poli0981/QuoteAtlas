import type { Locator, Page } from '@playwright/test';
import { S, expect, openSettings, readStore, test } from './fixtures';

/**
 * Background modes + readability controls (docs/06 §3). Colour / gradient only —
 * media-backed modes (image / video / slideshow) are covered by the media spec.
 *
 * The whole feature is observable as CSS on two elements:
 *   <main>                       → backgroundStyle() + font colour + text shadow
 *   main > div[aria-hidden=true] → the scrim overlay (colour auto-picked, opacity = scrim %)
 */

const main = (page: Page): Locator => page.locator('main');
/** The readability scrim — the only aria-hidden div App renders (RegionPicker's is a span). */
const scrim = (page: Page): Locator => page.locator('main > div[aria-hidden="true"]');

/** The `<button>` for a background mode inside the drawer's "Mode" group. */
function modeButton(panel: Locator, name: string): Locator {
  return panel
    .getByRole('group', { name: S.settings.background.mode })
    .getByRole('button', { name, exact: true });
}

/**
 * Range inputs are labelled with their live value baked in ("Scrim: 40%"), so an
 * exact accessible-name lookup can't reach them — match the wrapping <label> instead.
 */
function rangeRow(panel: Locator, label: string): Locator {
  return panel.locator('label').filter({ hasText: label });
}
function range(panel: Locator, label: string): Locator {
  return rangeRow(panel, label).locator('input[type="range"]');
}

/** What the persisted `background` slice looks like, for readStore() assertions. */
interface StoredBackground {
  mode: string;
  color: string;
  gradient: { from: string; to: string; angle: number };
  scrim: number;
  fontColor: string;
  textShadow: boolean;
}

async function storedBackground(page: Page): Promise<StoredBackground> {
  return (await readStore(page)).background as StoredBackground;
}

test.describe('background', () => {
  test('color mode paints <main> and swaps the drawer to the color control', async ({ app }) => {
    const panel = await openSettings(app);
    const colorInput = panel.getByLabel(S.settings.background.color, { exact: true });
    const from = panel.getByLabel(S.settings.background.from, { exact: true });
    const to = panel.getByLabel(S.settings.background.to, { exact: true });
    const angle = range(panel, S.settings.background.angle);

    // Gradient is the boot mode. Assert the *positive* half first: it proves every
    // locator below really resolves, so the toHaveCount(0)s that follow can't pass
    // vacuously just because a selector was wrong.
    await expect(from).toBeVisible();
    await expect(to).toBeVisible();
    await expect(angle).toBeVisible();
    await expect(colorInput).toHaveCount(0);

    const color = modeButton(panel, S.settings.background.color);
    await color.click();
    await expect(color).toHaveAttribute('aria-pressed', 'true');
    await expect(modeButton(panel, S.settings.background.gradient)).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    // the drawer must swap controls with the mode — leaving From/To/Angle on screen
    // would let the user edit a gradient that is no longer being painted
    await expect(colorInput).toBeVisible();
    await expect(from).toHaveCount(0);
    await expect(to).toHaveCount(0);
    await expect(angle).toHaveCount(0);

    // DEFAULT_SETTINGS.background.color = #0a0a0a, and the gradient must be dropped —
    // if the mode switch were a no-op the linear-gradient would still be painted.
    await expect(main(app)).toHaveCSS('background-color', 'rgb(10, 10, 10)');
    await expect(main(app)).toHaveCSS('background-image', 'none');

    await colorInput.fill('#ff0080');
    await expect(main(app)).toHaveCSS('background-color', 'rgb(255, 0, 128)');
  });

  test('gradient mode paints a linear-gradient driven by from/to/angle', async ({ app }) => {
    // gradient is the default mode, so the boot paint is already the gradient
    await expect(main(app)).toHaveCSS(
      'background-image',
      'linear-gradient(135deg, rgb(30, 41, 59), rgb(15, 23, 42))',
    );
    // ...and nothing else: a flat colour underneath would mean the mode isn't exclusive
    await expect(main(app)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

    const panel = await openSettings(app);
    await expect(modeButton(panel, S.settings.background.gradient)).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await range(panel, S.settings.background.angle).fill('45');
    // the slider's only readout is its label, so a stale label = a broken control
    await expect(rangeRow(panel, S.settings.background.angle)).toContainText(
      `${S.settings.background.angle}: 45°`,
    );

    await panel.getByLabel(S.settings.background.from, { exact: true }).fill('#ff0000');
    await panel.getByLabel(S.settings.background.to, { exact: true }).fill('#0000ff');

    await expect(main(app)).toHaveCSS(
      'background-image',
      'linear-gradient(45deg, rgb(255, 0, 0), rgb(0, 0, 255))',
    );
  });

  test('a custom gradient survives a round-trip through color mode', async ({ app }) => {
    const panel = await openSettings(app);
    await range(panel, S.settings.background.angle).fill('90');
    await panel.getByLabel(S.settings.background.from, { exact: true }).fill('#00ff00');

    // `mode` and the gradient live in the same store slice: a setBackground({mode})
    // that clobbered its siblings would silently reset the user's gradient here
    await modeButton(panel, S.settings.background.color).click();
    await expect(main(app)).toHaveCSS('background-image', 'none');

    await modeButton(panel, S.settings.background.gradient).click();
    await expect(main(app)).toHaveCSS(
      'background-image',
      'linear-gradient(90deg, rgb(0, 255, 0), rgb(15, 23, 42))',
    );
    await expect(range(panel, S.settings.background.angle)).toHaveValue('90');
  });

  test('scrim slider drives the overlay opacity, and its color flips with the text color', async ({
    app,
  }) => {
    // fontColor defaults to #fafafa (light) ⇒ scrimColor() picks black; scrim 0 ⇒ invisible
    await expect(scrim(app)).toHaveCSS('opacity', '0');
    await expect(scrim(app)).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    // a full-bleed overlay that ate clicks would kill the toolbar and the quote below it
    await expect(scrim(app)).toHaveCSS('pointer-events', 'none');

    const panel = await openSettings(app);
    await range(panel, S.settings.background.scrim).fill('40');
    await expect(scrim(app)).toHaveCSS('opacity', '0.4');
    await expect(rangeRow(panel, S.settings.background.scrim)).toContainText(
      `${S.settings.background.scrim}: 40%`,
    );

    // a dark text colour must flip the scrim to white, otherwise the overlay would
    // reduce contrast instead of protecting it (docs/05 §8)
    await panel.getByLabel(S.settings.background.fontColor, { exact: true }).fill('#101010');
    await expect(scrim(app)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(scrim(app)).toHaveCSS('opacity', '0.4');
  });

  test('text color and text shadow apply to <main>', async ({ app }) => {
    await expect(main(app)).toHaveCSS('color', 'rgb(250, 250, 250)');
    await expect(main(app)).toHaveCSS('text-shadow', 'none');

    const panel = await openSettings(app);
    await panel.getByLabel(S.settings.background.fontColor, { exact: true }).fill('#ffcc00');
    await expect(main(app)).toHaveCSS('color', 'rgb(255, 204, 0)');
    // the colour is inherited, so the quote and its attribution are repainted too
    await expect(app.locator('blockquote')).toHaveCSS('color', 'rgb(255, 204, 0)');
    await expect(app.locator('figcaption')).toHaveCSS('color', 'rgb(255, 204, 0)');

    const shadow = panel.getByLabel(S.settings.background.textShadow, { exact: true });
    await shadow.check();
    await expect(main(app)).toHaveCSS('text-shadow', 'rgba(0, 0, 0, 0.55) 0px 2px 10px');
    await expect(app.locator('blockquote')).toHaveCSS(
      'text-shadow',
      'rgba(0, 0, 0, 0.55) 0px 2px 10px',
    );

    await shadow.uncheck();
    await expect(main(app)).toHaveCSS('text-shadow', 'none');
  });

  test('background settings survive a reload', async ({ page }) => {
    // NOT the `app` fixture: it seeds consent with addInitScript(), which re-runs on
    // every navigation and would rewrite localStorage on reload — wiping the very
    // settings this test checks. Accept the gate through the UI instead, so the only
    // thing writing to storage is the app itself.
    await page.goto('/');
    await page.getByRole('button', { name: S.legal.agree }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const panel = await openSettings(page);
    // edit the gradient first (its controls only exist in gradient mode) so the reload
    // has to restore the *nested* slice too — store.ts's merge() only deep-merges
    // `background` one level, so `background.gradient` is where persistence breaks first
    await range(panel, S.settings.background.angle).fill('45');
    await panel.getByLabel(S.settings.background.from, { exact: true }).fill('#ff0000');
    await panel.getByLabel(S.settings.background.to, { exact: true }).fill('#0000ff');

    await modeButton(panel, S.settings.background.color).click();
    await panel.getByLabel(S.settings.background.color, { exact: true }).fill('#123456');
    await range(panel, S.settings.background.scrim).fill('25');
    await panel.getByLabel(S.settings.background.fontColor, { exact: true }).fill('#ffcc00');
    await panel.getByLabel(S.settings.background.textShadow, { exact: true }).check();
    await panel.getByRole('button', { name: S.settings.close }).click();
    await expect(panel).toBeHidden();

    expect(await storedBackground(page)).toMatchObject({
      mode: 'color',
      color: '#123456',
      gradient: { from: '#ff0000', to: '#0000ff', angle: 45 },
      scrim: 25,
      fontColor: '#ffcc00',
      textShadow: true,
    });

    await page.reload();

    // the rehydrated store must repaint the same background, not fall back to defaults
    await expect(main(page)).toHaveCSS('background-color', 'rgb(18, 52, 86)');
    await expect(main(page)).toHaveCSS('background-image', 'none');
    await expect(main(page)).toHaveCSS('color', 'rgb(255, 204, 0)');
    await expect(main(page)).toHaveCSS('text-shadow', 'rgba(0, 0, 0, 0.55) 0px 2px 10px');
    await expect(scrim(page)).toHaveCSS('opacity', '0.25');

    // the drawer reopens on the persisted mode, and the gradient the user never
    // returned to is still theirs — not the #1e293b→#0f172a default
    const reopened = await openSettings(page);
    await expect(modeButton(reopened, S.settings.background.color)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await modeButton(reopened, S.settings.background.gradient).click();
    await expect(main(page)).toHaveCSS(
      'background-image',
      'linear-gradient(45deg, rgb(255, 0, 0), rgb(0, 0, 255))',
    );
  });
});
