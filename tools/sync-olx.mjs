// Sync the stock with the OLX shop: data/products.json + photos in assets/utilaje/<slug>/.
// Usage (from the repo root or tools/): node tools/sync-olx.mjs [--dry]
// Reads only public pages. Prices are deliberately not stored (the site shows none).
// Spelling fixes, titles and slugs per listing live in data/products.overrides.json (keyed by OLX id).
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOP = 'https://compaia.olx.ro/home/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const WIDTHS = [480, 960, 1440];
const DRY = process.argv.includes('--dry');
const OUT_DIR = join(ROOT, 'assets/utilaje');
const overridesPath = join(ROOT, 'data/products.overrides.json');
const overrides = existsSync(overridesPath) ? JSON.parse(readFileSync(overridesPath, 'utf8')) : {};

// Brand spelling as the manufacturers write it (OLX has "McCormik").
const BRANDS = { mccormik: 'McCormick', mccormick: 'McCormick', 'massey ferguson': 'Massey Ferguson', 'john deere': 'John Deere', fendt: 'Fendt', same: 'Same', merlo: 'Merlo' };

// OLX writes country names without diacritics.
const ORIGINS = { Franta: 'Franța', Tarile: 'Țările de Jos', Elvetia: 'Elveția', Romania: 'România' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// curl, not fetch(): OLX's CDN answers 403 to Node's HTTP client.
async function get(url, as = 'text') {
  for (let i = 0; i < 3; i++) {
    const r = spawnSync('curl', ['-sfL', '--max-time', '60', '-A', UA, '-H', 'Accept-Language: ro-RO,ro;q=0.9', url], { maxBuffer: 64 * 1024 * 1024 });
    if (r.status === 0 && r.stdout.length) return as === 'buffer' ? r.stdout : r.stdout.toString('utf8');
    await sleep(1500 * (i + 1));
  }
  throw new Error(`GET failed: ${url}`);
}

function prerendered(html) {
  const i = html.indexOf('__PRERENDERED_STATE__');
  if (i < 0) throw new Error('OLX page without __PRERENDERED_STATE__ (markup changed?)');
  const start = html.indexOf('"', i);
  let j = start + 1;
  while (j < html.length && !(html[j] === '"' && html[j - 1] !== '\\')) j++;
  return JSON.parse(JSON.parse(html.slice(start, j + 1)));
}

const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const param = (ad, key) => (ad.params || []).find((p) => p.key === key);
const paramText = (ad, key) => {
  const p = param(ad, key);
  if (!p) return '';
  const v = p.value;
  return String(v?.label ?? v?.key ?? p.normalizedValue ?? v ?? '').trim();
};
const htmlToText = (h) => String(h || '')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');

function category(title) {
  const t = title.toLowerCase();
  if (/telescopic|incarcator|încărcător/.test(t)) return 'telescopic';
  if (/semanatoare|semănătoare|plug|disc|grapa|grapă|presa|presă|remorca|remorcă/.test(t)) return 'alte';
  return 'tractor';
}

async function photo(link, dir, n) {
  // OLX serves any size up to the original through the s=WxH template.
  const base = link.replace(/;s=.*$/, '');
  const buf = await get(`${base};s=2000x2000`, 'buffer');
  const img = sharp(buf).rotate();
  const meta = await img.metadata();
  const files = [];
  for (const w of WIDTHS) {
    if (w > meta.width && files.length) break;
    const width = Math.min(w, meta.width);
    const height = Math.round((meta.height * width) / meta.width);
    // Content hash in the name: the files can be cached for a year and a changed photo gets a new URL.
    const file = `${n}-${createHash('sha1').update(buf).digest('hex').slice(0, 8)}-${width}.webp`;
    if (!DRY) await sharp(buf).rotate().resize({ width }).webp({ quality: 72, effort: 6 }).toFile(join(dir, file));
    files.push({ w: width, h: height, file });
  }
  return files;
}

const shop = prerendered(await get(SHOP));
const ads = shop.shop.adsOffers.data.filter((a) => a.status === 'active');
if (!ads.length) throw new Error('No active ads found on the shop page; nothing changed.');
console.log(`OLX: ${ads.length} active listings`);

const products = [];
for (const a of ads) {
  await sleep(800);
  const page = prerendered(await get(a.url));
  const ad = page.ad?.ad || {};
  const o = overrides[a.id] || {};
  const make = paramText(a, 'make');
  const brand = BRANDS[make.toLowerCase()] || make;
  const year = Number(paramText(a, 'year')) || null;
  const hours = Number(paramText(a, 'lifetime').replace(/\s/g, '')) || null;
  const rawTitle = a.title.replace(/^(tractor viticol|tractor|telescopic)\s+/i, '').trim();
  const title = o.title || rawTitle;
  const slug = o.slug || slugify(`${title} ${year || ''}`);
  const dir = join(OUT_DIR, slug);
  if (!DRY) { rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true }); }
  const links = (ad.photos?.length ? ad.photos.map((p) => (typeof p === 'string' ? p : p.link)) : a.photos.map((p) => p.link));
  const photos = [];
  for (let i = 0; i < links.length; i++) photos.push(await photo(links[i], dir, i + 1));
  products.push({
    olxId: a.id,
    slug,
    title,
    brand,
    category: o.category || category(a.title),
    type: o.type || (/viticol/i.test(a.title) ? 'viticol' : ''),
    year,
    hours,
    origin: ORIGINS[paramText(a, 'country_origin')] || paramText(a, 'country_origin'),
    description: o.description || htmlToText(ad.description),
    olxUrl: a.url,
    refreshed: a.last_refresh_time,
    created: a.created_time,
    photos: photos.map((variants) => ({ w: variants.at(-1).w, h: variants.at(-1).h, src: variants.map((v) => ({ w: v.w, src: `assets/utilaje/${slug}/${v.file}` })) })),
  });
  console.log(`  ${slug}: ${photos.length} photos`);
}

// Newest refresh first, like the shop.
products.sort((x, y) => String(y.refreshed).localeCompare(String(x.refreshed)));

// Drop photo folders of listings that are gone.
if (!DRY && existsSync(OUT_DIR)) {
  const keep = new Set(products.map((p) => p.slug));
  for (const d of readdirSync(OUT_DIR)) if (!keep.has(d)) rmSync(join(OUT_DIR, d), { recursive: true, force: true });
}
if (!DRY) writeFileSync(join(ROOT, 'data/products.json'), JSON.stringify(products, null, 2) + '\n');
console.log(DRY ? 'dry run: nothing written' : `wrote data/products.json (${products.length})`);
