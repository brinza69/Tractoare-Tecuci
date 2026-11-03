// SEO checks on the generated pages (title/description length and uniqueness, one h1, heading order, alt text,
// OG/Twitter, canonical, JSON-LD validity, orphan pages). Usage: node tools/seo-check.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://www.tractoaretecuci.ro';
const skip = new Set(['node_modules', 'src', 'tools', '.git', '.tmp', 'docs', 'graphify-out', '.claude']);
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (skip.has(f)) continue; if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.html')) files.push(p); } };
walk(ROOT);
const issues = [];
const titles = new Map();
const descs = new Map();
const linked = new Set();
const pages = [];
for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const t = readFileSync(file, 'utf8');
  if (/name="robots" content="noindex"/.test(t)) continue;
  const path = rel === 'index.html' ? '/' : `/${rel.replace(/\.html$/, '')}`;
  pages.push(path);
  const title = (t.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const desc = (t.match(/name="description" content="([^"]*)"/) || [])[1] || '';
  const canonical = (t.match(/rel="canonical" href="([^"]*)"/) || [])[1] || '';
  const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  if (!title) issues.push(`${path}: no title`);
  else if (decode(title).length > 60) issues.push(`${path}: title ${decode(title).length} chars`);
  if (desc.length < 70 || decode(desc).length > 160) issues.push(`${path}: description ${decode(desc).length} chars`);
  titles.set(title, [...(titles.get(title) || []), path]);
  descs.set(desc, [...(descs.get(desc) || []), path]);
  if (canonical !== SITE + path) issues.push(`${path}: canonical ${canonical}`);
  for (const tag of ['og:title', 'og:description', 'og:image', 'og:url']) if (!t.includes(`property="${tag}"`)) issues.push(`${path}: missing ${tag}`);
  if (!t.includes('name="twitter:card"')) issues.push(`${path}: missing twitter:card`);
  const body = t.slice(t.indexOf('<main'), t.indexOf('</main>'));
  const h1 = (t.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) issues.push(`${path}: ${h1} h1`);
  const levels = [...t.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) { issues.push(`${path}: heading skip h${levels[i - 1]} -> h${levels[i]}`); break; }
  for (const m of t.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt="/.test(m[0])) issues.push(`${path}: img without alt ${m[0].slice(0, 80)}`);
    if (!/\bwidth="/.test(m[0]) || !/\bheight="/.test(m[0])) issues.push(`${path}: img without size ${m[0].slice(0, 80)}`);
  }
  for (const m of t.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { issues.push(`${path}: invalid JSON-LD (${e.message})`); }
  }
  if (/<h[1-6][^>]*>\s*<\/h[1-6]>/.test(t)) issues.push(`${path}: empty heading`);
  const links = [...body.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1].replace(/\/$/, '') || '/');
  links.forEach((l) => linked.add(l));
  [...t.matchAll(/href="(\/[^"#?]*)/g)].forEach((m) => linked.add(m[1].replace(/\/$/, '') || '/'));
  if (links.length > 100) issues.push(`${path}: ${links.length} links in main`);
}
for (const [k, v] of titles) if (v.length > 1) issues.push(`duplicate title "${k}": ${v.join(', ')}`);
for (const [k, v] of descs) if (v.length > 1) issues.push(`duplicate description: ${v.join(', ')}`);
for (const p of pages) if (!linked.has(p) && p !== '/') issues.push(`${p}: orphan (no internal link)`);
const sitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
for (const p of pages) if (!sitemap.includes(`<loc>${SITE}${p}</loc>`)) issues.push(`${p}: not in sitemap`);
console.log(`${pages.length} indexable pages checked`);
console.log(issues.length ? issues.join('\n') : 'no SEO issues found');
process.exit(issues.length ? 1 : 0);
