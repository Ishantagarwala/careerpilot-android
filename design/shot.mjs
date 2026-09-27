import { firefox } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, 'png');
fs.mkdirSync(out, { recursive: true });

const files = fs.readdirSync(here).filter(f => /^\d\d-.*\.html$/.test(f)).sort();
const browser = await firefox.launch();

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
