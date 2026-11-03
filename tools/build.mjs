// Static site generator for tractoaretecuci.ro.
// Sources: data/*.json (site, products, specs, posts), src/pages, src/css, src/js.
// Output: the HTML, sitemap, robots, llms files at the repo root (committed; Cloudflare Pages serves the root as is).
// Usage: node tools/build.mjs          build
//        node tools/build.mjs --check  fail if the committed output is not what the sources produce
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as esbuild from 'esbuild';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
// Sources may be checked out with CRLF (core.autocrlf on Windows); output is always LF.
const read = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const json = (p) => JSON.parse(read(p));

const site = json('data/site.json');
const products = json('data/products.json');
const specs = json('data/specs.json');
const posts = json('data/posts.json').slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));

// ---------------------------------------------------------------- helpers
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const int = (n) => Number(n).toLocaleString('ro-RO');
const abs = (p) => site.url + (p === '/' ? '/' : p);
const url = (p) => encodeURI(p.startsWith('/') ? p : `/${p}`);
const day = (iso) => String(iso || '').slice(0, 10);
const roDate = (iso) => new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bucharest' }).format(new Date(iso));
const words = (html) => String(html).replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
const plain = (html) => String(html).replace(/<\/(p|h[1-6]|li|tr)>/g, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*/g, '\n').trim();
const truncate = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…`);
const hoursText = site.hours.map((h) => `${h.label} ${h.opens}–${h.closes}`).join(' · ');
const addressText = `${site.address.street}, ${site.address.city}, județul ${site.address.county}`;
const wa = (text) => `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;
const ga4 = /^G-[A-Z0-9]+$/.test(site.ga4Id || '');
const hasCompany = Boolean(site.company.cui && site.company.regCom);

// Icons: Font Awesome Free 7 (CC BY 4.0, https://fontawesome.com/license/free), inlined from the SVG files.
const FA_DIR = join(ROOT, 'tools/node_modules/@fortawesome/fontawesome-free/svgs');
const ICON_MAP = {
  phone: 'solid/phone', mail: 'solid/envelope', whatsapp: 'brands/whatsapp', pin: 'solid/location-dot', clock: 'solid/clock',
  car: 'brands/waze', external: 'solid/arrow-up-right-from-square', arrow: 'solid/arrow-right', back: 'solid/arrow-left',
  star: 'solid/star', pause: 'solid/pause', play: 'solid/play', zoom: 'solid/magnifying-glass-plus', tractor: 'solid/tractor',
  truck: 'solid/truck', handshake: 'solid/handshake', check: 'solid/circle-check', tiktok: 'brands/tiktok', prev: 'solid/chevron-left',
  next: 'solid/chevron-right', close: 'solid/xmark', calendar: 'solid/calendar', gauge: 'solid/gauge-high', globe: 'solid/earth-europe',
  images: 'solid/images', warehouse: 'solid/warehouse', filter: 'solid/filter',
};
const faCache = new Map();
function fa(name) {
  if (!faCache.has(name)) {
    const svg = readFileSync(join(FA_DIR, `${ICON_MAP[name]}.svg`), 'utf8');
    faCache.set(name, { viewBox: svg.match(/viewBox="([^"]+)"/)[1], d: svg.match(/<path[^>]* d="([^"]+)"/)[1] });
  }
  return faCache.get(name);
}
const icon = (name, cls = 'ico-svg') => { const i = fa(name); return `<svg class="${cls}" viewBox="${i.viewBox}" width="20" height="20" aria-hidden="true" focusable="false" fill="currentColor"><path d="${i.d}"/></svg>`; };
const emailLink = (cls = '', label = site.email) => `<!--email_off--><a${cls ? ` class="${cls}"` : ''} href="mailto:${site.email}">${label}</a><!--/email_off-->`;

const CATS = {
  tractor: { slug: 'tractoare', name: 'Tractoare', lower: 'tractoare', one: 'tractor', img: 'assets/categorii/tractoare.webp', alt: 'Tractoare agricole aliniate pe câmp' },
  telescopic: { slug: 'incarcatoare-telescopice', name: 'Încărcătoare telescopice', lower: 'încărcătoare telescopice', one: 'încărcător telescopic', img: 'assets/categorii/telescopice.webp', alt: 'Încărcător telescopic ridicând un balot de paie' },
  alte: { slug: 'alte-utilaje', name: 'Alte utilaje', lower: 'alte utilaje', one: 'utilaj', img: 'assets/categorii/alte-utilaje.webp', alt: 'Combină, tractor și încărcător frontal pe un câmp cultivat' },
};
const catOf = (p) => CATS[p.category] || CATS.alte;
const productPath = (p) => `/utilaje/${p.slug}`;
const fullTitle = (p) => `${p.brand && !p.title.startsWith(p.brand) ? `${p.brand} ` : ''}${p.title}`;
const typeLabel = (p) => (p.type === 'viticol' ? 'Tractor viticol' : p.category === 'tractor' ? 'Tractor' : catOf(p).one.replace(/^./, (c) => c.toUpperCase()));

// ---------------------------------------------------------------- responsive images for static content
const IMG_OUT = 'assets/img';
const imgCache = new Map();
async function variants(src, widths) {
  const key = `${src}|${widths}`;
  if (imgCache.has(key)) return imgCache.get(key);
  const meta = await sharp(join(ROOT, src)).metadata();
  const name = basename(src).replace(/\.[a-z]+$/i, '');
  const out = [];
  for (const w of widths) {
    const width = Math.min(w, meta.width);
    const file = `${IMG_OUT}/${name}-${width}.webp`;
    if (!out.some((o) => o.w === width)) {
      if (!existsSync(join(ROOT, file)) && !CHECK) {
        mkdirSync(join(ROOT, IMG_OUT), { recursive: true });
        await sharp(join(ROOT, src)).resize({ width }).webp({ quality: 72, effort: 6 }).toFile(join(ROOT, file));
      }
      out.push({ w: width, src: file });
    }
  }
  const res = { list: out, width: meta.width, height: meta.height };
  imgCache.set(key, res);
  return res;
}
async function pic(src, { widths, sizes, alt, cls = '', eager = false, priority = false }) {
  const v = await variants(src, widths);
  const mid = v.list[Math.min(1, v.list.length - 1)];
  const h = Math.round((v.height * mid.w) / v.width);
  return `<img${cls ? ` class="${cls}"` : ''} src="${url(mid.src)}" srcset="${v.list.map((x) => `${url(x.src)} ${x.w}w`).join(', ')}" sizes="${sizes}" width="${mid.w}" height="${h}" alt="${esc(alt)}"${eager ? '' : ' loading="lazy"'}${priority ? ' fetchpriority="high"' : ''} decoding="async">`;
}
const photoSrcset = (ph) => ph.src.map((x) => `${url(x.src)} ${x.w}w`).join(', ');
const photoMid = (ph) => ph.src[Math.min(1, ph.src.length - 1)];

// ---------------------------------------------------------------- CSS and JS
const cssCache = new Map();
async function css(...files) {
  const key = files.join('|');
  if (!cssCache.has(key)) {
    const src = files.filter((f) => existsSync(join(ROOT, f))).map(read).join('\n');
    const { code } = await esbuild.transform(src, { loader: 'css', minify: true, target: ['chrome100', 'safari15', 'firefox100'] });
    cssCache.set(key, code.trim());
  }
  return cssCache.get(key);
}
const outputs = new Map(); // path -> content
const emit = (file, content) => outputs.set(file, content);
async function bundle(src, name) {
  const { code } = await esbuild.transform(read(src), { loader: 'js', minify: true, target: ['chrome100', 'safari15', 'firefox100'] });
  const hash = createHash('sha1').update(code).digest('hex').slice(0, 8);
  const file = `assets/js/${name}.${hash}.js`;
  emit(file, code);
  return `/${file}`;
}

// ---------------------------------------------------------------- JSON-LD
const BUSINESS_ID = `${site.url}/#business`;
const WEBSITE_ID = `${site.url}/#website`;
const business = () => ({
  '@type': 'LocalBusiness',
  '@id': BUSINESS_ID,
  name: site.name,
  description: site.description,
  url: `${site.url}/`,
  logo: `${site.url}/assets/logo.png`,
  image: `${site.url}/assets/og-image.jpg`,
  telephone: site.phone,
  email: site.email,
  address: { '@type': 'PostalAddress', streetAddress: site.address.street, addressLocality: site.address.city, addressRegion: site.address.county, postalCode: site.address.postalCode, addressCountry: site.address.country },
  geo: { '@type': 'GeoCoordinates', latitude: site.geo.lat, longitude: site.geo.lng },
  hasMap: site.mapsUrl,
  openingHoursSpecification: site.hours.map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: h.days, opens: h.opens, closes: h.closes })),
  areaServed: { '@type': 'Country', name: 'România' },
  sameAs: Object.values(site.social),
  ...(hasCompany ? { legalName: site.company.legalName, taxID: site.company.cui } : {}),
});
const website = () => ({ '@type': 'WebSite', '@id': WEBSITE_ID, url: `${site.url}/`, name: site.name, inLanguage: 'ro-RO', publisher: { '@id': BUSINESS_ID } });
const crumbs = (list) => ({ '@type': 'BreadcrumbList', itemListElement: list.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })) });
const ldScript = (nodes) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c')}</script>`;

// ---------------------------------------------------------------- layout
const NAV = [['/', 'Acasă'], ['/utilaje', 'Utilaje'], ['/despre-noi', 'Despre noi'], ['/blog', 'Blog']];
const isCurrent = (href, path) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));
function header(path) {
  const links = (cls) => NAV.map(([href, label]) => `<a href="${href}"${cls ? ` class="${cls}"` : ''}${isCurrent(href, path) ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const logo = (w) => `<img class="logo" src="/assets/icons/logo-240.webp" srcset="/assets/icons/logo-240.webp 240w, /assets/icons/logo-440.webp 440w" sizes="${w}px" width="${w}" height="${Math.round((w * 200) / 664)}" alt="${site.name}">`;
  return `<a class="skip-link" href="#main">Sari la conținut</a>
<header class="site-header">
  <div class="wrap header-bar">
    <a class="brand" href="/" aria-label="${site.name}, acasă">${logo(120)}</a>
    <nav class="nav" aria-label="Navigație principală">${links('nav-link')}</nav>
    <div class="header-cta">
      <a href="/contact" class="btn primary contact-cta"${path === '/contact' ? ' aria-current="page"' : ''}>Contact</a>
      <button class="hamb" type="button" aria-label="Meniu" aria-controls="mobile-drawer" aria-expanded="false"><span></span></button>
    </div>
  </div>
  <nav id="mobile-drawer" class="drawer" aria-label="Meniu mobil">
    <div class="nav-list">${links('')}</div>
    <a href="/contact" class="btn primary wfull">Contact</a>
  </nav>
</header>
<div class="nav-backdrop" hidden></div>`;
}

function footer() {
  const company = hasCompany
    ? `<p class="f-legal">${esc(site.company.legalName)} · CUI ${esc(site.company.cui)} · Nr. Reg. Com. ${esc(site.company.regCom)} · ${esc(addressText)}</p>`
    : '';
  return `<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="f-col">
      <a class="f-brand" href="/" aria-label="${site.name}, acasă"><img src="/assets/icons/logo-440.webp" srcset="/assets/icons/logo-240.webp 240w, /assets/icons/logo-440.webp 440w" sizes="186px" width="220" height="66" alt="${site.name}" loading="lazy" decoding="async"></a>
      <p class="f-desc">Tractoare și utilaje agricole second hand, import direct din Europa. Consultanță, finanțare și transport.</p>
    </div>
    <nav class="f-col" aria-label="Linkuri rapide">
      <h2 class="f-title">Linkuri</h2>
      <ul class="f-links">
        <li><a href="/">Acasă</a></li>
        <li><a href="/utilaje">Categorii utilaje</a></li>
        <li><a href="/products">Stoc complet</a></li>
        <li><a href="/despre-noi">Despre noi</a></li>
        <li><a href="/blog">Blog</a></li>
        <li><a href="/contact">Contact</a></li>
      </ul>
    </nav>
    <div class="f-col">
      <h2 class="f-title">Contact</h2>
      <ul class="f-contact">
        <li>${icon('phone')}<a href="tel:${site.phone}">${site.phoneDisplay}</a></li>
        <li>${icon('whatsapp')}<a href="${wa('Bună ziua, vă scriu de pe tractoaretecuci.ro.')}" rel="noopener">WhatsApp</a></li>
        <li>${icon('mail')}${emailLink()}</li>
        <li>${icon('pin')}<a href="${esc(site.mapsUrl)}" rel="noopener">${esc(site.address.street)}, ${esc(site.address.city)}</a></li>
        <li>${icon('clock')}<span>${site.hours.map((h) => `${h.label}: ${h.opens}–${h.closes}`).join('<br>')}<br>${esc(site.closed)}</span></li>
      </ul>
      <div class="f-social">
        <a class="ico social olx-badge" href="${site.social.olx}" rel="noopener" aria-label="Anunțurile noastre pe OLX"><svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="30" fill="#23E5DB"/><path d="M20.9 40.3c-4.7 0-8.2-3.6-8.2-8.3s3.5-8.3 8.2-8.3 8.2 3.6 8.2 8.3-3.5 8.3-8.2 8.3zm0-13.3c-2.9 0-5 2.2-5 5s2.1 5 5 5 5-2.2 5-5-2.1-5-5-5z"/><rect x="30.6" y="24.1" width="3.6" height="16" rx="1.8"/><path d="M48.4 40.1l-4.9-6.1 4.7-6c.3-.4.4-.9.2-1.4-.3-.8-1.2-1.1-2-.7l-.5.4-4 5.1-4-5.1c-.4-.5-1.1-.7-1.8-.5-.9.3-1.2 1.3-.6 2.1l4.7 5.9-4.9 6.2c-.3.4-.4.9-.2 1.4.3.8 1.2 1.1 2 .7l.5-.4 4.2-5.3 4.1 5.2c.4.5 1.1.7 1.8.5.9-.4 1.2-1.3.7-2z"/></svg></a>
        <a class="ico social tiktok" href="${site.social.tiktok}" rel="noopener" aria-label="Videoclipuri pe TikTok"><svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path fill="#25F4EE" d="M40 12c2.7 3.6 6.2 6 10 6v6c-3.8 0-7.4-1.2-10-3.2v17.7c0 8.7-7 15.7-15.7 15.7S8.6 47.2 8.6 38.5s7-15.7 15.7-15.7c1.1 0 2.2.1 3.3.4v7.2c-.9-.4-1.9-.6-3-.6-4.5 0-8.1 3.6-8.1 8.1s3.6 8.1 8.1 8.1 8.1-3.6 8.1-8.1V12z"/><path d="M36.7 10v21.5c0 6.9-5.6 12.5-12.5 12.5S11.7 38.4 11.7 31.5 17.3 19 24.2 19c1.1 0 2.1.2 3.1.5v5.9c-.9-.4-1.9-.6-3-.6-3.9 0-7 3.1-7 7s3.1 7 7 7 7-3.1 7-7V10zm3.3 3c2.6 3.9 6.4 6.3 10.6 6.7V25c-4.9-.3-9.1-2.3-12-5.3V13z"/></svg></a>
      </div>
    </div>
  </div>
  <div class="f-bottom">
    <div class="wrap f-bottom-row">
      <p>© ${new Date().getFullYear()} ${site.name}. Toate drepturile rezervate.</p>
      <p class="f-mini"><a href="/termeni">Termeni</a> · <a href="/confidentialitate">Confidențialitate</a> · <a href="/confidentialitate#cookies">Cookie-uri</a>${ga4 ? ' · <button type="button" class="linkish" data-consent-open>Setări cookies</button>' : ''} · <a href="${site.anpcSal}" rel="noopener">ANPC – SAL</a></p>
    </div>
    ${company ? `<div class="wrap">${company}</div>` : ''}
  </div>
</footer>`;
}

function actionBar(ctx = {}) {
  const msg = ctx.whatsapp || 'Bună ziua, vă scriu de pe tractoaretecuci.ro.';
  return `<div class="action-bar" data-action-bar>
  <a class="ab-btn ab-call" href="tel:${site.phone}">${icon('phone')}<span>Sună</span></a>
  <a class="ab-btn ab-wa" href="${wa(msg)}" rel="noopener">${icon('whatsapp')}<span>WhatsApp</span></a>
</div>`;
}

let APP_JS = '';
// Text and heading fonts are preloaded; both use font-display: swap with metric-matched fallbacks.
const FONT_PRELOAD = [...read('src/css/fonts.css').matchAll(/url\('(\/assets\/fonts\/(?:inter-var|barlow-sc-700)\.[^']+)'\)/g)]
  .map((m) => `<link rel="preload" as="font" type="font/woff2" href="${m[1]}" crossorigin>\n`).join('');
let CONSENT_JS = '';
async function layout(p) {
  const canonical = abs(p.path);
  const ogImage = p.ogImage || `${site.url}/assets/og-image.jpg`;
  const style = await css('src/css/fonts.css', 'src/css/base.css', ...(p.css || []).map((c) => `src/css/pages/${c}.css`), 'src/css/upgrade.css');
  const graph = [business(), website(), { '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical, name: p.title, isPartOf: { '@id': WEBSITE_ID }, inLanguage: 'ro-RO', ...(p.crumbs ? { breadcrumb: crumbs(p.crumbs) } : {}) }, ...(p.ld || [])];
  const consentHead = ga4
    ? `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});window.TT_GA4=${JSON.stringify(site.ga4Id)};</script>`
    : '';
  return `<!doctype html>
<!-- Generat de tools/build.mjs din src/ și data/. Nu edita aici: modifică sursele și rulează node tools/build.mjs. -->
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${canonical}">
${p.noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta property="og:type" content="${p.ogType || 'website'}">
<meta property="og:site_name" content="${site.name}">
<meta property="og:locale" content="ro_RO">
<meta property="og:title" content="${esc(p.ogTitle || p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
${p.ogImageSize ? `<meta property="og:image:width" content="${p.ogImageSize[0]}">\n<meta property="og:image:height" content="${p.ogImageSize[1]}">\n` : '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n'}<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/assets/icons/favicon-96.png" type="image/png" sizes="96x96">
<link rel="icon" href="/assets/icons/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#2e7d32">
${FONT_PRELOAD}${p.preload || ''}<style>${style}</style>
${consentHead}<script defer src="${APP_JS}"></script>
${ga4 ? `<script defer src="${CONSENT_JS}"></script>\n` : ''}${ldScript(graph)}
</head>
<body${p.bodyAttrs ? ` ${p.bodyAttrs}` : ''}>
${header(p.path)}
<main id="main"${p.mainClass ? ` class="${p.mainClass}"` : ''}>
${p.main}
</main>
${footer()}
${p.noActionBar ? '' : actionBar(p.actionBar)}
</body>
</html>
`;
}

// ---------------------------------------------------------------- source pages (src/pages/*.html)
function source(name) {
  const t = read(`src/pages/${name}.html`);
  const m = t.match(/^<!--meta ([\s\S]*?) -->\n/);
  const meta = m ? JSON.parse(m[1]) : {};
  let body = m ? t.slice(m[0].length) : t;
  return { meta, body };
}
function fill(html, slots = {}) {
  return html
    .replace(/\{\{phone\}\}/g, site.phone)
    .replace(/\{\{phoneDisplay\}\}/g, site.phoneDisplay)
    .replace(/\{\{email\}\}/g, site.email)
    .replace(/\{\{emailLink(?::([a-z-]+))?\}\}/g, (_, cls) => emailLink(cls || ''))
    .replace(/\{\{whatsappUrl\}\}/g, esc(wa('Bună ziua, vă scriu de pe tractoaretecuci.ro.')))
    .replace(/\{\{mapsUrl\}\}/g, esc(site.mapsUrl))
    .replace(/\{\{wazeUrl\}\}/g, esc(site.wazeUrl))
    .replace(/\{\{mapsEmbed\}\}/g, esc(site.mapsEmbed))
    .replace(/\{\{address\}\}/g, esc(addressText))
    .replace(/\{\{hours\}\}/g, esc(hoursText))
    .replace(/\{\{hoursHtml\}\}/g, `${site.hours.map((h) => `${h.label}: ${h.opens}–${h.closes}`).join('<br>')}<br>${esc(site.closed)}`)
    .replace(/\{\{policyVersion\}\}/g, site.policyVersion)
    .replace(/\{\{stockCount\}\}/g, String(products.length))
    .replace(/\{\{icon:([a-z]+)\}\}/g, (_, n) => icon(n))
    .replace(/<!-- @slot ([a-z0-9-]+) -->/g, (_, k) => {
      if (!(k in slots)) throw new Error(`missing slot ${k}`);
      return slots[k];
    });
}

// ---------------------------------------------------------------- shared blocks
const CARD_SIZES = '(min-width: 1025px) 374px, (min-width: 700px) 46vw, calc(100vw - 32px)';
function productCard(p, { level = 3, eager = false } = {}) {
  const ph = p.photos[0];
  const mid = photoMid(ph);
  const facts = [[p.year, 'calendar'], [p.hours ? `${int(p.hours)} ore` : '', 'gauge'], [p.origin ? `import ${p.origin}` : '', 'globe']].filter(([v]) => v);
  return `<a class="card product" href="${productPath(p)}" data-cat="${p.category}" data-brand="${esc(p.brand)}" data-hours="${p.hours || 0}" data-text="${esc(`${fullTitle(p)} ${p.brand} ${p.type}`.toLowerCase())}">
  <div class="media"><img src="${url(mid.src)}" srcset="${photoSrcset(ph)}" sizes="${CARD_SIZES}" width="${mid.w}" height="${Math.round((ph.h * mid.w) / ph.w)}" alt="${esc(`${fullTitle(p)}, ${p.year}`)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"></div>
  <div class="body">
    <span class="badge">${esc(p.brand)}</span>
    <h${level} class="card-title">${esc(fullTitle(p))}</h${level}>
    <p class="card-facts">${facts.map(([f, ic]) => `<span>${icon(ic)}${esc(f)}</span>`).join('')}</p>
  </div>
</a>`;
}
const grid = (items, opts) => `<ul class="grid product-grid" role="list">${items.map((p, i) => `<li>${productCard(p, { ...opts, eager: opts?.eagerFirst && i < (opts.eagerCount || 1) })}</li>`).join('')}</ul>`;
const itemList = (items) => ({ '@type': 'ItemList', numberOfItems: items.length, itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(productPath(p)), name: fullTitle(p) })) });
const preloadImg = (ph, sizes) => `<link rel="preload" as="image" imagesrcset="${photoSrcset(ph)}" imagesizes="${sizes}" fetchpriority="high">\n`;

// ---------------------------------------------------------------- pages
const pages = []; // { path, file, html, lastmod, images }

async function page(path, file, p, lastmod, images = []) {
  pages.push({ path, file, lastmod, images, noindex: p.noindex });
  emit(file, await layout({ path, ...p }));
}

async function home() {
  const { meta, body } = source('index');
  const latest = products.slice(0, 6);
  const heroPoster = `<picture>
  <source media="(max-width: 700px)" type="image/avif" srcset="/assets/media/hero-mobile-540.avif 540w, /assets/media/hero-mobile-810.avif 810w" sizes="100vw">
  <source media="(max-width: 700px)" type="image/webp" srcset="/assets/media/hero-mobile-540.webp 540w, /assets/media/hero-mobile-810.webp 810w" sizes="100vw">
  <source type="image/avif" srcset="/assets/media/hero-desktop-960.avif 960w, /assets/media/hero-desktop-1280.avif 1280w, /assets/media/hero-desktop-1920.avif 1920w" sizes="100vw">
  <img class="hero-poster" src="/assets/media/hero-desktop-1280.webp" srcset="/assets/media/hero-desktop-960.webp 960w, /assets/media/hero-desktop-1280.webp 1280w, /assets/media/hero-desktop-1920.webp 1920w" sizes="100vw" width="1280" height="720" alt="" fetchpriority="high" decoding="async">
</picture>`;
  const reviews = await Promise.all([1, 2, 3].map((n) => pic(`assets/reviews/r${n}.webp`, { widths: [96, 192], sizes: '84px', alt: '', cls: 'rev-avatar' })));
  const slots = {
    'hero-poster': heroPoster,
    latest: grid(latest, { level: 3 }),
    'svc-1': await pic('assets/index photos/servicii-vanzare-utilaje-agricole-tractoare-tecuci.webp', { widths: [400, 800], sizes: '(min-width: 1025px) 374px, (min-width: 700px) 46vw, calc(100vw - 32px)', alt: 'Tractor agricol verificat tehnic' }),
    'svc-2': await pic('assets/index photos/servicii-finantare-consultanta-investitii-utilaje-agricole.webp', { widths: [400, 800], sizes: '(min-width: 1025px) 374px, (min-width: 700px) 46vw, calc(100vw - 32px)', alt: 'Consultanță pentru investiții agricole' }),
    'svc-3': await pic('assets/index photos/servicii-transport-international-utilaje-agricole.webp', { widths: [400, 800], sizes: '(min-width: 1025px) 374px, (min-width: 700px) 46vw, calc(100vw - 32px)', alt: 'Transport utilaje agricole' }),
    about: await pic('assets/index photos/tractor-ara.webp', { widths: [471], sizes: '(min-width: 900px) 471px, calc(100vw - 32px)', alt: 'Tractor lucrând pe câmp' }),
    casella: await pic('assets/index photos/casella.webp', { widths: [180, 340, 680], sizes: '(max-width: 600px) 180px, 340px', alt: 'Casella' }),
    'rev-1': reviews[0], 'rev-2': reviews[1], 'rev-3': reviews[2],
    stars: `<span class="rev-stars" role="img" aria-label="5 din 5 stele">${icon('star').repeat(5)}</span>`,
  };
  const preload = `<link rel="preload" as="image" media="(max-width: 700px)" type="image/avif" imagesrcset="/assets/media/hero-mobile-540.avif 540w, /assets/media/hero-mobile-810.avif 810w" imagesizes="100vw" fetchpriority="high">
<link rel="preload" as="image" media="(min-width: 701px)" type="image/avif" imagesrcset="/assets/media/hero-desktop-960.avif 960w, /assets/media/hero-desktop-1280.avif 1280w, /assets/media/hero-desktop-1920.avif 1920w" imagesizes="100vw" fetchpriority="high">
`;
  await page('/', 'index.html', {
    title: meta.title, description: meta.description, css: ['index'], bodyAttrs: 'data-page="home"', preload,
    main: fill(body, slots), ld: [itemList(latest)],
  }, meta.updated);
}

async function categoriesPage() {
  const { meta, body } = source('utilaje');
  const cats = Object.entries(CATS).map(([key, c]) => ({ key, ...c, items: products.filter((p) => p.category === key) })).filter((c) => c.items.length);
  const cards = await Promise.all(cats.map(async (c, i) => `<li><a class="cat-card" href="/utilaje/${c.slug}">
  <div class="cat-bg">${await pic(c.img, { widths: [400, 800], sizes: '(min-width: 1025px) 374px, (min-width: 700px) 46vw, calc(100vw - 32px)', alt: c.alt, eager: i < 3, priority: i === 0 })}</div>
  <h2 class="cat-name">${c.name}</h2>
  <p class="cat-count">${c.items.length} ${c.items.length === 1 ? 'utilaj' : 'utilaje'} în stoc</p>
</a></li>`));
  const brands = [...new Set(products.map((p) => p.brand))].sort((a, b) => a.localeCompare(b, 'ro'));
  const slots = {
    categories: `<ul class="grid cat-grid" role="list">${cards.join('')}</ul>`,
    summary: `<p class="lead">Avem acum ${products.length} utilaje în stoc: ${cats.map((c) => `${c.items.length} ${c.items.length === 1 ? c.one : c.lower}`).join(' și ')}. Mărci: ${brands.join(', ')}. Majoritatea sunt importate din ${[...new Set(products.map((p) => p.origin).filter(Boolean))].join(' și ')}.</p>`,
  };
  await page('/utilaje', 'utilaje.html', {
    title: meta.title, description: meta.description, css: ['utilaje'], bodyAttrs: 'data-page="utilaje"', mainClass: 'section',
    main: fill(body, slots), crumbs: [['Acasă', '/'], ['Utilaje', '/utilaje']],
    ld: [{ '@type': 'CollectionPage', '@id': `${abs('/utilaje')}#collection`, name: 'Categorii utilaje agricole', url: abs('/utilaje') }],
  }, meta.updated);
  for (const c of cats) await categoryPage(c);
}

async function categoryPage(c) {
  const path = `/utilaje/${c.slug}`;
  const brands = [...new Set(c.items.map((p) => p.brand))].sort((a, b) => a.localeCompare(b, 'ro'));
  const years = c.items.map((p) => p.year).filter(Boolean);
  const title = `${c.name} second hand de vânzare | Tractoare Tecuci`;
  const intro = `${c.items.length} ${c.items.length === 1 ? c.one : c.lower} în stoc, ${years.length ? `din anii ${Math.min(...years)}–${Math.max(...years)}, ` : ''}mărcile ${brands.join(', ')}. Fiecare anunț are fotografiile exemplarului, anul, orele de funcționare și țara de proveniență. Pentru preț, vizionare sau transport, sună-ne sau scrie-ne pe WhatsApp.`;
  const main = `<div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Acasă</a> <span aria-hidden="true">/</span> <a href="/utilaje">Utilaje</a> <span aria-hidden="true">/</span> <span aria-current="page">${c.name}</span></nav>
  <h1>${c.name} second hand</h1>
  <p class="lead">${esc(intro)}</p>
  ${grid(c.items, { level: 2, eagerFirst: true, eagerCount: 1 })}
  <p class="more-row"><a class="btn more-btn" href="/products">Tot stocul ${icon('arrow')}</a></p>
</div>`;
  await page(path, `utilaje/${c.slug}.html`, {
    title: truncate(title, 60), description: truncate(`${c.name} second hand din import: ${brands.join(', ')}. ${c.items.length} în stoc la Tecuci, cu poze reale, an și ore de funcționare. Transport în toată țara.`, 158),
    css: ['products'], bodyAttrs: 'data-page="list"', mainClass: 'section', main, preload: preloadImg(c.items[0].photos[0], CARD_SIZES),
    crumbs: [['Acasă', '/'], ['Utilaje', '/utilaje'], [c.name, path]],
    ld: [{ '@type': 'CollectionPage', '@id': `${abs(path)}#collection`, name: `${c.name} second hand`, url: abs(path), mainEntity: itemList(c.items) }],
  }, day(c.items.map((p) => p.refreshed).sort().at(-1)), c.items.map((p) => p.photos[0]));
}

async function stockPage() {
  const { meta, body } = source('products');
  const brands = [...new Set(products.map((p) => p.brand))].sort((a, b) => a.localeCompare(b, 'ro'));
  const cats = Object.entries(CATS).filter(([k]) => products.some((p) => p.category === k));
  const slots = {
    'brand-options': brands.map((b) => `<option>${esc(b)}</option>`).join(''),
    'category-options': cats.map(([k, c]) => `<option value="${k}">${c.name}</option>`).join(''),
    'category-chips': [['', 'Toate'], ...cats.map(([k, c]) => [k, c.name])].map(([k, n]) => `<button type="button" class="chip-filter" data-cat="${k}" aria-pressed="${k === '' ? 'true' : 'false'}">${n}</button>`).join(''),
    stock: grid(products, { level: 2, eagerFirst: true, eagerCount: 1 }),
  };
  await page('/products', 'products.html', {
    title: meta.title, description: meta.description, css: ['products'], bodyAttrs: 'data-page="list"', mainClass: 'section',
    main: fill(body, slots), preload: preloadImg(products[0].photos[0], CARD_SIZES),
    crumbs: [['Acasă', '/'], ['Stoc', '/products']],
    ld: [{ '@type': 'CollectionPage', '@id': `${abs('/products')}#collection`, name: 'Stoc utilaje agricole', url: abs('/products'), mainEntity: itemList(products) }],
  }, day(products.map((p) => p.refreshed).sort().at(-1)), products.map((p) => p.photos[0]));
}

const DETAIL_SIZES = '(min-width: 1024px) 680px, calc(100vw - 32px)';
async function productPage(p) {
  const path = productPath(p);
  const c = catOf(p);
  const name = fullTitle(p);
  const spec = specs[p.olxId];
  const msg = `Bună ziua, mă interesează ${name} (${p.year}) de pe tractoaretecuci.ro: ${abs(path)}`;
  const photos = p.photos;
  const main0 = photos[0];
  const facts = [
    ['Marcă', p.brand], ['Tip', typeLabel(p)], ['An de fabricație', p.year], ['Ore de funcționare', p.hours ? `${int(p.hours)} ore` : ''],
    ['Țara de proveniență', p.origin], ['Anunț actualizat', p.refreshed ? roDate(p.refreshed) : ''],
  ].filter(([, v]) => v);
  const similar = products.filter((x) => x !== p && x.category === p.category).slice(0, 3);
  // Swipeable strip (scroll snap) + thumbnails + full-screen viewer. Works without JS as a scrollable strip.
  const n = photos.length;
  const gallery = `<div class="gallery" data-gallery>
  <div class="g-stage">
    <ul class="g-track" role="list" data-track tabindex="0" aria-label="Fotografii ${esc(name)}">${photos.map((ph, i) => `<li class="g-slide"><button type="button" class="g-open" data-lb-open data-index="${i}" data-full="${url(ph.src.at(-1).src)}" aria-label="Mărește fotografia ${i + 1} din ${n}">${i === 0
      ? `<img src="${url(photoMid(ph).src)}" srcset="${photoSrcset(ph)}" sizes="${DETAIL_SIZES}" width="${photoMid(ph).w}" height="${Math.round((ph.h * photoMid(ph).w) / ph.w)}" alt="${esc(`${name}, fotografia 1 din ${n}`)}" fetchpriority="high">`
      // Slides 2+ sit right next to the screen, so the browser would fetch and decode them all at once and delay the
      // first photo. They start as the small thumbnail; app.js swaps in the full srcset after load or on first use.
      : `<img src="${url(ph.src[0].src)}" data-srcset="${photoSrcset(ph)}" sizes="${DETAIL_SIZES}" width="${ph.src[0].w}" height="${Math.round((ph.h * ph.src[0].w) / ph.w)}" alt="${esc(`${name}, fotografia ${i + 1} din ${n}`)}" loading="lazy" decoding="async">`}</button></li>`).join('')}</ul>
    <button type="button" class="g-nav g-prev" data-prev aria-label="Fotografia anterioară" disabled>${icon('prev')}</button>
    <button type="button" class="g-nav g-next" data-next aria-label="Fotografia următoare">${icon('next')}</button>
    <span class="g-count"><span data-count>1</span> / ${n}</span>
    <span class="g-zoom" aria-hidden="true">${icon('zoom')}</span>
  </div>
  <ul class="g-thumbs" role="list" data-thumbs>${photos.map((ph, i) => `<li><button type="button" class="g-thumb" data-index="${i}" aria-label="Arată fotografia ${i + 1} din ${n}"${i === 0 ? ' aria-current="true"' : ''}><img src="${url(ph.src[0].src)}" width="${ph.src[0].w}" height="${Math.round((ph.h * ph.src[0].w) / ph.w)}" alt="" loading="lazy" decoding="async"></button></li>`).join('')}</ul>
</div>`;
  const specTable = spec
    ? `<section class="specs" aria-labelledby="spec-model">
  <h2 id="spec-model">Specificații de model</h2>
  <p class="spec-note">Date de catalog pentru ${esc(name)}, nu măsurători ale acestui exemplar. Sursa: <a href="${esc(spec.source)}" rel="noopener">TractorData.com</a>.</p>
  <dl class="spec-list">${spec.spec.map((s) => `<div class="spec"><dt>${esc(s.k)}</dt><dd>${esc(s.v)}</dd></div>`).join('')}</dl>
</section>`
    : '';
  const main = `<section class="section head-sec">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Acasă</a> <span aria-hidden="true">/</span> <a href="/utilaje">Utilaje</a> <span aria-hidden="true">/</span> <a href="/utilaje/${c.slug}">${c.name}</a> <span aria-hidden="true">/</span> <span aria-current="page">${esc(name)}</span></nav>
    <div class="head-stack">
      <h1 class="head-title">${esc(name)}, ${p.year}</h1>
      <p class="head-meta"><span class="brand-badge">${esc(p.brand)}</span><span class="stock-badge">În stoc</span></p>
    </div>
  </div>
</section>
<section class="section detail-sec">
  <div class="wrap detail">
    ${gallery}
    <div class="info">
      <dl class="meta">${facts.slice(0, 4).map(([k, v], i) => `<div class="item"><dt>${icon(['tractor', 'warehouse', 'calendar', 'gauge'][i])}${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <div class="cta" data-hero-cta>
        <a class="ask-offer" href="tel:${site.phone}">${icon('phone')} Sună acum</a>
        <a class="btn btn-wa" href="${esc(wa(msg))}" rel="noopener">${icon('whatsapp')} WhatsApp</a>
        <a class="btn btn-outline" href="${esc(p.olxUrl)}" rel="noopener">${icon('external')} Vezi pe OLX</a>
      </div>
      <p class="cta-note">Prețul, vizionarea la Tecuci și transportul le stabilim la telefon. Program: ${esc(hoursText)}.</p>
      <section class="desc" aria-labelledby="desc-h">
        <h2 id="desc-h">Descriere</h2>
        ${p.description.split('\n').map((l) => `<p>${esc(l)}</p>`).join('')}
      </section>
      <section class="specs" aria-labelledby="spec-unit">
        <h2 id="spec-unit">Datele exemplarului</h2>
        <dl class="spec-list">${facts.slice(4).map(([k, v]) => `<div class="spec"><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}<div class="spec"><dt>Anunț OLX</dt><dd><a href="${esc(p.olxUrl)}" rel="noopener">Deschide anunțul</a></dd></div></dl>
      </section>
      ${specTable}
    </div>
  </div>
</section>
${similar.length ? `<section class="section similar-sec" aria-labelledby="similar-h">
  <div class="wrap">
    <h2 id="similar-h">${c.name} similare</h2>
    ${grid(similar, { level: 3 })}
    <p class="more-row"><a class="btn more-btn" href="/utilaje/${c.slug}">Toate ${c.lower} ${icon('arrow')}</a></p>
  </div>
</section>` : ''}
<dialog class="lb" data-lb aria-label="Fotografii ${esc(name)}">
  <div class="lb-img-wrap">
    <button type="button" class="lb-btn lb-prev" data-lb-prev aria-label="Fotografia anterioară">${icon('prev')}</button>
    <img class="lb-img" src="${url(main0.src.at(-1).src)}" alt="" data-lb-img width="1440" height="1920" loading="lazy" decoding="async">
    <button type="button" class="lb-btn lb-next" data-lb-next aria-label="Fotografia următoare">${icon('next')}</button>
    <button type="button" class="lb-btn lb-close" data-lb-close aria-label="Închide">${icon('close')}</button>
    <p class="lb-count" aria-live="polite" data-lb-count></p>
  </div>
</dialog>`;
  const title = truncate(`${name} ${p.year}${p.hours ? `, ${int(p.hours)} ore` : ''} | Tractoare Tecuci`, 60);
  const description = truncate(`${typeLabel(p)} ${name}, an ${p.year}${p.hours ? `, ${int(p.hours)} ore` : ''}${p.origin ? `, import ${p.origin}` : ''}. ${p.description.replace(/\n/g, ' ')}`, 158);
  const og = await ogFor(p);
  await page(path, `utilaje/${p.slug}.html`, {
    title, description, css: ['product'], bodyAttrs: 'data-page="detail"', main, ogType: 'product', ogImage: og,
    preload: preloadImg(main0, DETAIL_SIZES),
    crumbs: [['Acasă', '/'], ['Utilaje', '/utilaje'], [c.name, `/utilaje/${c.slug}`], [name, path]],
    actionBar: { whatsapp: msg },
    ld: [{
      '@type': 'Product', '@id': `${abs(path)}#product`, name: `${name} (${p.year})`, url: abs(path), description: p.description.replace(/\n/g, ' '),
      brand: { '@type': 'Brand', name: p.brand }, category: typeLabel(p), productionDate: String(p.year), itemCondition: 'https://schema.org/UsedCondition',
      image: photos.map((ph) => abs(url(ph.src.at(-1).src))),
      additionalProperty: [
        p.hours ? { '@type': 'PropertyValue', name: 'Ore de funcționare', value: p.hours, unitText: 'ore' } : null,
        p.origin ? { '@type': 'PropertyValue', name: 'Țara de proveniență', value: p.origin } : null,
      ].filter(Boolean),
      seller: { '@id': BUSINESS_ID },
    }],
  }, day(p.refreshed), photos);
}

// Share image per listing: the cover photo on a 1200x630 canvas.
async function ogFor(p) {
  const file = `assets/og/${p.slug}.jpg`;
  if (!existsSync(join(ROOT, file)) && !CHECK) {
    mkdirSync(join(ROOT, 'assets/og'), { recursive: true });
    await sharp(join(ROOT, p.photos[0].src.at(-1).src)).resize(1200, 630, { fit: 'cover', position: 'attention' }).jpeg({ quality: 80, mozjpeg: true }).toFile(join(ROOT, file));
  }
  return abs(`/${file}`);
}

async function blogPages() {
  const { meta, body } = source('blog');
  const cats = [...new Set(posts.flatMap((p) => (p.cats?.length ? p.cats : ['ghiduri'])))];
  const label = (c) => ({ ghiduri: 'Ghiduri', intretinere: 'Întreținere' }[c] || c);
  const cards = await Promise.all(posts.map(async (p, i) => `<li><a class="card post-card" href="/blog/${p.slug}" data-cats="${(p.cats || ['ghiduri']).join(' ')}">
  ${await pic(p.cover, { widths: [400, 800], sizes: '(min-width: 1040px) 375px, (min-width: 740px) 46vw, calc(100vw - 32px)', alt: p.alt || p.title, eager: i < 3, priority: i === 0 })}
  <div class="body"><h2 class="card-title">${esc(p.title)}</h2><p class="muted">${esc(p.excerpt || '')}</p></div>
</a></li>`));
  const slots = {
    chips: [['toate', 'Toate'], ...cats.map((c) => [c, label(c)])].map(([k, n]) => `<button type="button" class="pill${k === 'toate' ? ' active' : ''}" data-cat="${k}" aria-pressed="${k === 'toate'}">${n}</button>`).join(''),
    posts: `<ul id="blogList" class="grid" role="list">${cards.join('')}</ul>`,
  };
  await page('/blog', 'blog.html', {
    title: meta.title, description: meta.description, css: ['blog'], bodyAttrs: 'data-page="blog"', mainClass: 'section',
    main: fill(body, slots), crumbs: [['Acasă', '/'], ['Blog', '/blog']],
    ld: [{ '@type': 'Blog', '@id': `${abs('/blog')}#blog`, name: 'Blog Tractoare Tecuci', url: abs('/blog'), blogPost: posts.map((p) => ({ '@id': `${abs(`/blog/${p.slug}`)}#article` })) }],
  }, day(posts[0].date), posts.map((p) => ({ src: [{ src: p.cover }] })));
  for (const p of posts) await postPage(p, label);
}

// Post bodies come from the old site: fix headings, links to the old query-string pages and wide tables.
function postHtml(html) {
  const posts_ = new Set(posts.map((x) => x.slug));
  const prods = new Set(products.map((x) => x.slug));
  return html
    .replace(/<h1(\s|>)/g, '<h2$1').replace(/<\/h1>/g, '</h2>')
    .replace(/ href="(?:https?:\/\/www\.tractoaretecuci\.ro)?\/?post(?:\.html)?\?(?:p|slug)=([^"&]+)[^"]*"/g, (_, slug) => ` href="${posts_.has(slug) ? `/blog/${slug}` : '/blog'}"`)
    .replace(/ href="(?:https?:\/\/www\.tractoaretecuci\.ro)?\/?product(?:\.html)?\?slug=([^"&]+)[^"]*"/g, (_, slug) => ` href="${prods.has(slug) ? `/utilaje/${slug}` : '/products'}"`)
    .replace(/ href="(?:https?:\/\/www\.tractoaretecuci\.ro)?\/?(products|utilaje|contact|despre-noi|blog)\.html(\?[^"]*)?"/g, ' href="/$1$2"')
    .replace(/<table/g, '<div class="table-wrap" role="region" tabindex="0" aria-label="Tabel"><table').replace(/<\/table>/g, '</table></div>');
}

async function postPage(p, label) {
  const path = `/blog/${p.slug}`;
  const read = Math.max(2, Math.round(words(p.html) / 200));
  const others = posts.filter((x) => x !== p).slice(0, 3);
  const cover = await pic(p.cover, { widths: [800, 1200], sizes: '(min-width: 980px) 900px, calc(100vw - 32px)', alt: p.alt || p.title, eager: true, priority: true });
  const share = abs(path);
  const main = `<div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Acasă</a> <span aria-hidden="true">/</span> <a href="/blog">Blog</a> <span aria-hidden="true">/</span> <span aria-current="page">${esc(p.title)}</span></nav>
  <article>
    <header class="post-hero">
      <h1 class="post-title">${esc(p.title)}</h1>
      <p class="post-meta"><time datetime="${day(p.date)}">${roDate(p.date)}</time> · ${esc(p.author || site.name)} · ${read} min de citit</p>
      <figure class="post-cover">${cover}</figure>
    </header>
    <div class="post-body">
      <div class="prose">
        ${postHtml(p.html)}
        <div class="share">
          <a class="btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(share)}" rel="noopener">Facebook</a>
          <a class="btn" href="https://wa.me/?text=${encodeURIComponent(`${p.title} ${share}`)}" rel="noopener">WhatsApp</a>
        </div>
      </div>
    </div>
  </article>
  <section class="related" aria-labelledby="rel-h">
    <h2 id="rel-h">Alte articole</h2>
    <ul class="related-list" role="list">${others.map((o) => `<li><a href="/blog/${o.slug}">${esc(o.title)}</a></li>`).join('')}</ul>
    <p><a class="btn more-btn" href="/products">Vezi utilajele în stoc ${icon('arrow')}</a></p>
  </section>
</div>`;
  await page(path, `blog/${p.slug}.html`, {
    title: truncate(`${p.title} | Tractoare Tecuci`, 60), description: truncate(p.excerpt || plain(p.html), 158),
    css: ['post'], bodyAttrs: 'data-page="post"', mainClass: 'section', main, ogType: 'article', ogImage: abs(url(p.cover)), ogImageSize: null,
    crumbs: [['Acasă', '/'], ['Blog', '/blog'], [p.title, path]],
    ld: [{
      '@type': 'BlogPosting', '@id': `${abs(path)}#article`, headline: p.title, description: p.excerpt || '', image: abs(url(p.cover)),
      datePublished: day(p.date), dateModified: day(p.date), inLanguage: 'ro-RO', articleSection: label((p.cats || ['ghiduri'])[0]),
      author: { '@id': BUSINESS_ID }, publisher: { '@id': BUSINESS_ID }, mainEntityOfPage: abs(path), keywords: p.keywords || undefined,
    }],
  }, day(p.date), [{ src: [{ src: p.cover }] }]);
}

// Plain <img src="assets/..."> in hand-written pages get responsive variants and the right loading hints.
async function responsiveImgs(html) {
  const re = /<img\s+([^>]*?)src="(assets\/[^"]+\.(?:webp|jpe?g|png))"([^>]*)>/g;
  const out = [];
  let last = 0;
  for (const m of html.matchAll(re)) {
    const attrs = m[1] + m[3];
    const alt = (attrs.match(/alt="([^"]*)"/) || [])[1] || '';
    const eager = /loading="eager"/.test(attrs);
    const cls = (attrs.match(/class="([^"]*)"/) || [])[1] || '';
    out.push(html.slice(last, m.index), await pic(m[2], {
      widths: [400, 800, 1200], alt, cls, eager, priority: eager,
      sizes: eager ? '(min-width: 1024px) 520px, calc(100vw - 32px)' : '(min-width: 1025px) 380px, (min-width: 700px) 46vw, calc(100vw - 32px)',
    }));
    last = m.index + m[0].length;
  }
  return out.join('') + html.slice(last);
}

async function staticPage(name, path, extra = {}) {
  const { meta, body } = source(name);
  await page(path, `${name}.html`, {
    title: meta.title, description: meta.description, css: meta.css || [name], bodyAttrs: meta.body || '', mainClass: meta.mainClass || '',
    main: await responsiveImgs(fill(body, extra.slots || {})), crumbs: path === '/404' ? null : [['Acasă', '/'], [meta.crumb || meta.title.split('|')[0].trim(), path]],
    noindex: meta.noindex, ld: extra.ld || [], noActionBar: extra.noActionBar,
  }, meta.updated);
}

// Old query-string URLs (/product?slug=..., /post?p=...) send visitors to the new addresses.
function redirectStub(file, mapping, fallback, param) {
  emit(file, `<!doctype html>
<html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${site.name}</title><link rel="canonical" href="${abs(fallback)}">
<script>(function(){var q=new URLSearchParams(location.search),s=${param.map((x) => `q.get(${JSON.stringify(x)})`).join('||')}||'',m=${JSON.stringify(mapping)};location.replace(m[s]||${JSON.stringify(fallback)});})();</script>
</head><body><p><a href="${fallback}">Continuă</a></p></body></html>
`);
}

// ---------------------------------------------------------------- text files
function sitemap() {
  const list = pages.filter((p) => !p.noindex && p.path !== '/404');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${list.map((p) => `  <url>
    <loc>${abs(p.path)}</loc>${p.lastmod ? `\n    <lastmod>${p.lastmod}</lastmod>` : ''}${(p.images || []).slice(0, 8).map((ph) => `\n    <image:image><image:loc>${abs(url(ph.src.at(-1).src))}</image:loc></image:image>`).join('')}
  </url>`).join('\n')}
</urlset>
`;
  emit('sitemap.xml', xml);
}

function robots() {
  emit('robots.txt', `# ${site.url}/robots.txt
User-agent: *
Allow: /
# Filtrele din pagina de stoc dublează conținutul; ID-urile de clic din reclame nu aduc nimic nou.
Disallow: /*?q=
Disallow: /*?brand=
Disallow: /*?maxHours=
Disallow: /*?gclid=
Disallow: /*?fbclid=
Disallow: /tools/
Disallow: /src/

# Motoarele de căutare cu AI au voie să citească site-ul, ca să poată recomanda utilajele din stoc.
User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: Claude-User
Allow: /

Sitemap: ${site.url}/sitemap.xml
`);
}

function llms() {
  const cats = Object.entries(CATS).map(([k, c]) => [c, products.filter((p) => p.category === k)]).filter(([, l]) => l.length);
  const head = `# ${site.name}

> ${site.description}

- Telefon și WhatsApp: ${site.phoneDisplay}
- Email: ${site.email}
- Adresă: ${addressText}, ${site.address.postalCode}
- Program: ${hoursText}; ${site.closed.toLowerCase()}
- Prețurile nu sunt afișate pe site; se stabilesc la telefon. Stocul se actualizează din anunțurile OLX: ${site.social.olx}
`;
  const short = `${head}
## Stoc (${products.length} utilaje, actualizat ${roDate(products.map((p) => p.refreshed).sort().at(-1))})

${cats.map(([c, l]) => `### ${c.name}\n\n${l.map((p) => `- [${fullTitle(p)}, ${p.year}](${abs(productPath(p))}): ${[p.hours ? `${int(p.hours)} ore` : '', p.origin ? `import ${p.origin}` : ''].filter(Boolean).join(', ')}`).join('\n')}`).join('\n\n')}

## Pagini

- [Stoc complet](${abs('/products')})
- [Categorii](${abs('/utilaje')})
- [Despre noi](${abs('/despre-noi')})
- [Contact](${abs('/contact')})
- [Termeni](${abs('/termeni')})

## Ghiduri

${posts.map((p) => `- [${p.title}](${abs(`/blog/${p.slug}`)}): ${p.excerpt || ''}`).join('\n')}

## Text complet

- [llms-full.txt](${site.url}/llms-full.txt)
`;
  const full = `${head}
## Utilaje în stoc

${products.map((p) => {
  const s = specs[p.olxId];
  return `### ${fullTitle(p)}, ${p.year}

- Pagina: ${abs(productPath(p))}
- Tip: ${typeLabel(p)}; marcă: ${p.brand}; an: ${p.year}${p.hours ? `; ${int(p.hours)} ore de funcționare` : ''}${p.origin ? `; import ${p.origin}` : ''}
- Anunț OLX: ${p.olxUrl}

${p.description}
${s ? `\nSpecificații de model (TractorData.com, date de catalog, nu ale exemplarului):\n${s.spec.map((x) => `- ${x.k}: ${x.v}`).join('\n')}\n` : ''}`;
}).join('\n')}
## Ghiduri

${posts.map((p) => `### ${p.title}\n\n${abs(`/blog/${p.slug}`)}\n\n${plain(p.html)}\n`).join('\n')}`;
  emit('llms.txt', short);
  emit('llms-full.txt', full);
}

function manifest() {
  emit('manifest.json', `${JSON.stringify({
    name: `${site.name}: utilaje agricole second hand`,
    short_name: site.name,
    description: site.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f7faf7',
    theme_color: '#2e7d32',
    lang: 'ro-RO',
    icons: [
      { src: '/assets/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/assets/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }, null, 2)}\n`);
}

function securityTxt() {
  const expires = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 0, 1)).toISOString().replace('.000', '');
  emit('.well-known/security.txt', `Contact: mailto:${site.email}
Expires: ${expires}
Preferred-Languages: ro, en
Canonical: ${site.url}/.well-known/security.txt
`);
}

// ---------------------------------------------------------------- run
APP_JS = await bundle('src/js/app.js', 'app');
if (ga4) CONSENT_JS = await bundle('src/js/consent.js', 'consent');
await home();
await categoriesPage();
await stockPage();
for (const p of products) await productPage(p);
await blogPages();
await staticPage('despre-noi', '/despre-noi');
await staticPage('contact', '/contact', { slots: { map: '' } });
await staticPage('termeni', '/termeni');
await staticPage('confidentialitate', '/confidentialitate', { slots: { analytics: ga4 ? read('src/pages/_analytics-policy.html') : '' } });
await staticPage('404', '/404', { noActionBar: false });
redirectStub('product.html', { 'massey-ferguson-7724-dyna6-240cp': '/utilaje/massey-ferguson-7724-2019' }, '/products', ['slug']);
redirectStub('post.html', Object.fromEntries(posts.map((p) => [p.slug, `/blog/${p.slug}`])), '/blog', ['p', 'slug']);
sitemap();
robots();
llms();
manifest();
securityTxt();

// Guard rails: no emoji, comma-below diacritics only, no placeholder left.
const problems = [];
for (const [file, content] of outputs) {
  if (!/\.(html|txt|xml|json)$/.test(file)) continue;
  if (/\p{Emoji_Presentation}|\p{Extended_Pictographic}️/u.test(content)) problems.push(`${file}: emoji`);
  if (/[şţŞŢ]/.test(content)) problems.push(`${file}: cedilla ş/ţ (use ș/ț)`);
  const left = content.match(/\{\{[a-zA-Z:]+\}\}|<!-- @slot[^>]*>/);
  if (left) problems.push(`${file}: unfilled placeholder ${left[0]}`);
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

// Write, or compare in --check mode. Generated files that are no longer produced are removed (only in generated folders).
const generatedDirs = ['utilaje', 'blog', 'assets/js'];
let stale = 0;
for (const [file, content] of outputs) {
  const p = join(ROOT, file);
  const old = existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null;
  if (old === content) continue;
  stale++;
  if (CHECK) { console.error(`out of date: ${file}`); continue; }
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}
for (const d of generatedDirs) {
  const dir = join(ROOT, d);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    const rel = `${d}/${f}`;
    if (statSync(join(dir, f)).isFile() && !outputs.has(rel)) {
      stale++;
      if (CHECK) console.error(`not generated any more: ${rel}`);
      else rmSync(join(dir, f));
    }
  }
}
if (CHECK && stale) process.exit(1);
console.log(CHECK ? 'output up to date' : `built ${outputs.size} files (${stale} changed), ${pages.length} pages`);
