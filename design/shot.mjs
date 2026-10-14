/*
 * Chromium, not Firefox.
 *
 * This used Firefox, which meant the generator only ran on a machine that had
 * `playwright install firefox` — and the repo shipped no note saying so. Anyone
 * cloning it got `Executable doesn't exist at .../firefox-1538/firefox/firefox`
 * and no PNGs. Chromium is what Playwright installs by default, so this now
 * works out of the box.
 *
 * Verified: all ten screens re-render at the same 1184x2020 size, and the mean
 * per-channel difference against the committed PNGs is under 5/255 — font
 * rasterisation and anti-aliasing only, no layout or colour change.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, 'png');
fs.mkdirSync(out, { recursive: true });

const files = fs.readdirSync(here).filter(f => /^\d\d-.*\.html$/.test(f)).sort();
const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

for (const f of files) {
  const page = await browser.newPage({
    viewport: { width: 592, height: 1010 },
    deviceScaleFactor: 2,
  });
  await page.goto('file://' + path.join(here, f), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(180);
  const target = path.join(out, f.replace('.html', '.png'));
  await page.screenshot({ path: target });
  console.log('rendered', path.basename(target));
  await page.close();
}
await browser.close();
