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
const WIDTHS = [240, 480, 960, 1200, 1440];
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
  for (let i = 0; i < 5; i++) {
    const r = spawnSync('curl', ['-sfL', '--max-time', '60', '-A', UA, '-H', 'Accept-Language: ro-RO,ro;q=0.9', url], { maxBuffer: 64 * 1024 * 1024 });
    if (r.status === 0 && r.stdout.length) return as === 'buffer' ? r.stdout : r.stdout.toString('utf8');
    await sleep(2000 * 2 ** i);
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
    if (!DRY) await sharp(buf).rotate().resize({ width }).webp({ quality: 72, effort: 4 }).toFile(join(dir, file));
    files.push({ w: width, h: height, file });
  }
  return files;
}

const FORCE = process.argv.includes('--force');
const productsPath = join(ROOT, 'data/products.json');
const soldPath = join(ROOT, 'data/sold.json');
const previous = existsSync(productsPath) ? JSON.parse(readFileSync(productsPath, 'utf8')) : [];
const prevById = new Map(previous.map((p) => [String(p.olxId), p]));

const shop = prerendered(await get(SHOP));
const ads = shop.shop.adsOffers.data.filter((a) => a.status === 'active');
if (!ads.length) throw new Error('No active ads found on the shop page; nothing changed.');
// A sudden drop usually means OLX answered with a partial page or blocked us: keep the current stock.
if (!FORCE && previous.length >= 4 && ads.length < previous.length * 0.5) {
  throw new Error(`OLX shows ${ads.length} listings, the site has ${previous.length}: too big a drop, nothing changed (use --force if real).`);
}
console.log(`OLX: ${ads.length} active listings (site had ${previous.length})`);

// 1. Read everything first; nothing on disk changes until every listing has been read.
const plans = [];
for (const a of ads) {
  await sleep(800);
  const page = prerendered(await get(a.url));
  const ad = page.ad?.ad || {};
  const links = (ad.photos?.length ? ad.photos.map((p) => (typeof p === 'string' ? p : p.link)) : a.photos.map((p) => p.link)).map((l) => l.replace(/;s=.*$/, ''));
  plans.push({ a, ad, links });
}

// 2. Photos: listings whose photo list did not change keep their files (no download, no churn).
const products = [];
const changes = { added: [], updated: [], removed: [] };
for (const { a, ad, links } of plans) {
  const o = overrides[a.id] || {};
  const make = paramText(a, 'make');
  const brand = BRANDS[make.toLowerCase()] || make;
  const year = Number(paramText(a, 'year')) || null;
  const hours = Number(paramText(a, 'lifetime').replace(/\s/g, '')) || null;
  const rawTitle = a.title.replace(/^(tractor viticol|tractor|telescopic)\s+/i, '').trim();
  const title = o.title || rawTitle;
  const slug = o.slug || slugify(`${title} ${year || ''}`);
  const prev = prevById.get(String(a.id));
  // Records written before photoKeys existed: same slug and photo count count as unchanged (one-time migration).
  const sameList = prev && (prev.photoKeys ? JSON.stringify(prev.photoKeys) === JSON.stringify(links) : prev.photos.length === links.length);
  const samePhotos = prev && prev.slug === slug && sameList
    && prev.photos.every((ph) => ph.src.every((v) => existsSync(join(ROOT, v.src))));
  let photos = prev?.photos;
  if (!samePhotos) {
    const dir = join(OUT_DIR, slug);
    if (!DRY) mkdirSync(dir, { recursive: true });
    const fresh = [];
    for (let i = 0; i < links.length; i++) fresh.push(await photo(links[i], dir, i + 1));
    photos = fresh.map((variants) => ({ w: variants.at(-1).w, h: variants.at(-1).h, src: variants.map((v) => ({ w: v.w, src: `assets/utilaje/${slug}/${v.file}` })) }));
  }
  const record = {
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
    photoKeys: links,
    photos,
  };
  if (!prev) changes.added.push(slug);
  else if (!samePhotos || JSON.stringify({ ...prev, refreshed: 0 }) !== JSON.stringify({ ...record, refreshed: 0 })) changes.updated.push(slug);
  products.push(record);
}

// Newest refresh first, like the shop.
products.sort((x, y) => String(y.refreshed).localeCompare(String(x.refreshed)));

// 3. Sold (gone from OLX): remembered so their old addresses redirect to the category instead of 404.
const live = new Set(products.map((p) => String(p.olxId)));
const sold = existsSync(soldPath) ? JSON.parse(readFileSync(soldPath, 'utf8')) : [];
for (const p of previous) {
  if (live.has(String(p.olxId))) continue;
  changes.removed.push(p.slug);
  if (!sold.some((s) => s.slug === p.slug)) sold.push({ slug: p.slug, title: p.title, category: p.category, soldOn: new Date().toISOString().slice(0, 10) });
}
const liveSlugs = new Set(products.map((p) => p.slug));
const soldOut = sold.filter((s) => !liveSlugs.has(s.slug));

// 4. Write, then remove photo files nothing refers to any more.
if (!DRY) {
  writeFileSync(productsPath, JSON.stringify(products, null, 2) + '\n');
  writeFileSync(soldPath, JSON.stringify(soldOut, null, 2) + '\n');
  const used = new Set(products.flatMap((p) => p.photos.flatMap((ph) => ph.src.map((v) => v.src))));
  if (existsSync(OUT_DIR)) {
    for (const d of readdirSync(OUT_DIR)) {
      const dir = join(OUT_DIR, d);
      for (const f of readdirSync(dir)) if (!used.has(`assets/utilaje/${d}/${f}`)) rmSync(join(dir, f));
      if (!readdirSync(dir).length) rmSync(dir, { recursive: true });
    }
  }
}
console.log(`added: ${changes.added.join(', ') || '-'}\nupdated: ${changes.updated.join(', ') || '-'}\nsold: ${changes.removed.join(', ') || '-'}`);
console.log(DRY ? 'dry run: nothing written' : `wrote data/products.json (${products.length}) and data/sold.json (${soldOut.length})`);
const noSpecs = products.filter((p) => p.category === 'tractor' && !JSON.parse(readFileSync(join(ROOT, 'data/specs.map.json'), 'utf8'))[p.olxId]).map((p) => p.slug);
if (changes.added.length) console.log(`new listings without a TractorData mapping (add them to data/specs.map.json if the model matches): ${changes.added.filter((s) => noSpecs.includes(s)).join(', ') || '-'}`);
