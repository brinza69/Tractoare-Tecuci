// Browser matrix: Chrome, Edge, Firefox, WebKit at 320/390/768/1440/1920 on the key pages.
// Checks horizontal overflow, console errors, failed requests, images without size; saves screenshots to .tmp/qa.
// Usage: node tools/qa.mjs [baseUrl]   (default http://localhost:8788; start it with node tools/serve.mjs)
// Playwright comes from D:\SiteKit; browsers from PLAYWRIGHT_BROWSERS_PATH (default D:\Impecabil\.tmp\pw-browsers).
import { mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= 'D:\\Impecabil\\.tmp\\pw-browsers';
const pw = await import(pathToFileURL('D:/SiteKit/node_modules/playwright/index.mjs').href);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || 'http://localhost:8788';
const OUT = join(ROOT, '.tmp/qa');
mkdirSync(OUT, { recursive: true });
const PAGES = ['/', '/utilaje', '/utilaje/tractoare', '/products', '/utilaje/fendt-820-vario-tms-2011', '/blog', '/blog/cvt-vs-powershift-la-tractoare', '/contact', '/despre-noi', '/confidentialitate', '/nu-exista'];
const WIDTHS = [320, 390, 768, 1440, 1920];
const ENGINES = [
  ['chrome', () => pw.chromium.launch({ channel: 'chrome' }).catch(() => pw.chromium.launch())],
  ['edge', () => pw.chromium.launch({ channel: 'msedge' })],
  ['firefox', () => pw.firefox.launch()],
  ['webkit', () => pw.webkit.launch()],
];
const problems = [];
for (const [name, launch] of ENGINES) {
  let browser;
  try { browser = await launch(); } catch (e) { problems.push(`${name}: cannot launch (${e.message.split('\n')[0]})`); continue; }
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 768 ? 800 : 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('requestfailed', (r) => { if (!/hero-(desktop|mobile)\.(webm|mp4)/.test(r.url())) errors.push(`failed ${r.url()}`); });
    for (const path of PAGES) {
      errors.length = 0;
      await page.goto(BASE + path, { waitUntil: 'load' });
      await page.waitForTimeout(150);
      const r = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const wide = [...document.querySelectorAll('body *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.right > vw + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.g-track,.g-thumbs,dialog'); }).slice(0, 3).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`);
        const unsized = [...document.images].filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length;
        return { overflow: document.documentElement.scrollWidth > vw + 1, wide, unsized };
      });
      const tag = `${name} ${w}px ${path}`;
      if (r.overflow) problems.push(`${tag}: horizontal scroll (${r.wide.join(', ')})`);
      if (r.unsized) problems.push(`${tag}: ${r.unsized} image(s) without width/height`);
      if (path === '/nu-exista') errors.splice(0, errors.length, ...errors.filter((e) => !/status of 404/.test(e)));
      if (errors.length) problems.push(`${tag}: ${[...new Set(errors)].slice(0, 2).join(' | ')}`);
      if ([390, 1440].includes(w) && ['/', '/utilaje/fendt-820-vario-tms-2011', '/products', '/contact'].includes(path)) {
        await page.screenshot({ path: join(OUT, `${name}-${w}${path.replace(/\//g, '_') || '_home'}.png`), fullPage: true });
      }
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`${name} done`);
}
console.log(problems.length ? problems.join('\n') : 'no problems found');
process.exit(problems.length ? 1 : 0);
