// Adds one blog post from a draft, after quality gates; optionally commits and publishes.
// Usage: node tools/new-post.mjs drafts/<slug>.json            check + add + build + checks
//        node tools/new-post.mjs drafts/<slug>.json --dry      gates only, nothing written
//        node tools/new-post.mjs drafts/<slug>.json --commit   also commit and push to main (live in ~1 min)
//
// Draft (JSON): { "slug", "title", "excerpt", "keywords", "cats": ["ghiduri"|"intretinere"], "html",
//   "cover": { "from": "assets/utilaje/<machine>/<photo>.webp", "alt": "..." }, "sources": ["https://..."],
//   "topic": "<id from data/blog-plan.json>" }
// The cover must be a real photo of a machine from the stock (assets/utilaje/...): no stock images, no AI images.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const draftPath = args.find((a) => !a.startsWith('--'));
const DRY = args.includes('--dry');
const COMMIT = args.includes('--commit');
const REPO = 'https://github.com/brinza69/Tractoare-Tecuci.git';
if (!draftPath) { console.error('usage: node tools/new-post.mjs drafts/<slug>.json [--dry|--commit]'); process.exit(2); }

const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8').replace(/^﻿/, ''));
const run = (cmd, a, opts = {}) => {
  const r = spawnSync(cmd, a, { cwd: ROOT, stdio: opts.capture ? 'pipe' : 'inherit', encoding: 'utf8' });
  if (r.status !== 0 && !opts.allowFail) throw new Error(`failed: ${cmd} ${a.join(' ')}${r.stderr ? `\n${r.stderr}` : ''}`);
  return r;
};
const git = (...a) => run('git', ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', ...a]);

const draft = JSON.parse(readFileSync(resolve(ROOT, draftPath), 'utf8').replace(/^﻿/, ''));
const posts = readJson('data/posts.json');
const products = readJson('data/products.json');
const site = readJson('data/site.json');
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const words = (html) => text(html).split(' ').filter(Boolean).length;

// ---------------------------------------------------------------- gates
const errors = [];
const fail = (m) => errors.push(m);
const { slug = '', title = '', excerpt = '', html = '', cover = {}, sources = [] } = draft;
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) fail('slug: lowercase words joined by hyphens, max 80 characters');
if (posts.some((p) => p.slug === slug)) fail(`slug already used: ${slug}`);
if (title.length < 30 || title.length > 65) fail(`title: 30-65 characters (now ${title.length})`);
if (posts.some((p) => p.title.toLowerCase() === title.toLowerCase())) fail('title already used');
if (excerpt.length < 80 || excerpt.length > 160) fail(`excerpt: 80-160 characters (now ${excerpt.length})`);
if (!Array.isArray(draft.cats) || !draft.cats.length || draft.cats.some((c) => !['ghiduri', 'intretinere'].includes(c))) fail('cats: ["ghiduri"] or ["intretinere"]');
const n = words(html);
if (n < 700 || n > 2600) fail(`length: 700-2600 words (now ${n})`);
const tags = [...html.matchAll(/<\/?([a-z0-9]+)/gi)].map((m) => m[1].toLowerCase());
const allowed = new Set(['p', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'br']);
const bad = [...new Set(tags.filter((t) => !allowed.has(t)))];
if (bad.length) fail(`html: tags not allowed: ${bad.join(', ')} (no h1, img, script, style, div)`);
if (/\s(style|on[a-z]+|class|id)=/i.test(html)) fail('html: no style, class, id or event attributes');
if ((html.match(/<h2[\s>]/g) || []).length < 3) fail('html: at least 3 <h2> sections');
// Links: internal ones must exist; external ones must be https and listed in sources.
const pages = new Set(['/', '/utilaje', '/products', '/contact', '/despre-noi', '/blog', '/termeni', '/confidentialitate', '/utilaje/tractoare', '/utilaje/incarcatoare-telescopice',
  ...products.map((p) => `/utilaje/${p.slug}`), ...posts.map((p) => `/blog/${p.slug}`)]);
const hrefs = [...html.matchAll(/<a\s+href="([^"]+)"/g)].map((m) => m[1]);
if ([...html.matchAll(/<a\s/g)].length !== hrefs.length) fail('html: every <a> starts with href="..." and has no other attribute before it');
const internal = hrefs.filter((h) => h.startsWith('/'));
for (const h of internal) if (!pages.has(h.replace(/[#?].*$/, ''))) fail(`internal link to a missing page: ${h}`);
if (internal.filter((h) => /^\/(utilaje|products|contact)/.test(h)).length < 2) fail('html: at least 2 links to /utilaje/..., /products or /contact');
for (const h of hrefs.filter((x) => !x.startsWith('/'))) {
  if (!h.startsWith('https://')) fail(`external link must be https: ${h}`);
  else if (!sources.some((s) => h.startsWith(s) || s.startsWith(h))) fail(`external link not in sources: ${h}`);
}
// Content rules from the owner: no prices on the site, no other phone numbers, no invented company facts.
const plain = text(html);
if (/\d[\d.,\s]*\s?(lei|ron|euro|eur|€|\$)(?![a-z])/i.test(plain) || /(€|\$)\s?\d/.test(plain)) fail('no prices or money amounts (owner rule: prices are given by phone)');
const phones = plain.match(/(\+?40|0)7\d{2}[\s.]?\d{3}[\s.]?\d{3}/g) || [];
if (phones.some((p) => p.replace(/\D/g, '').slice(-9) !== site.phone.replace(/\D/g, '').slice(-9))) fail('only the company phone number may appear');
if (/\b(garantăm|garanție de \d|cel mai ieftin|cele mai mici prețuri|lider|nr\.? ?1)\b/i.test(plain)) fail('no guarantees, superlatives or rankings the owner has not confirmed');
if (/(lorem ipsum|TODO|\[de completat\]|xx+)/i.test(plain)) fail('placeholder text left in the draft');
if (sources.some((s) => !/^https:\/\//.test(s))) fail('sources: https URLs only');
if (!cover.from || !/^assets\/utilaje\/[a-z0-9-]+\/[^/]+\.(webp|jpe?g|png)$/.test(cover.from) || !existsSync(join(ROOT, cover.from))) fail('cover.from: an existing photo under assets/utilaje/<machine>/');
if (!cover.alt || cover.alt.length < 15 || cover.alt.length > 140) fail('cover.alt: 15-140 characters describing the photo');

if (errors.length) { console.error(`Draft rejected (${errors.length}):\n- ${errors.join('\n- ')}`); process.exit(1); }
console.log(`Draft OK: "${title}", ${n} words, ${internal.length} internal links, ${sources.length} sources.`);
if (DRY) process.exit(0);

// ---------------------------------------------------------------- add
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date());
const coverOut = `assets/posts/${slug}.webp`;
const before = readFileSync(join(ROOT, 'data/posts.json'), 'utf8');
const planPath = join(ROOT, 'data/blog-plan.json');
const planBefore = existsSync(planPath) ? readFileSync(planPath, 'utf8') : null;
try {
  if (COMMIT) {
    // Start from what is live, so the push is a fast-forward.
    git('fetch', REPO, 'main');
    run('git', ['merge', '--ff-only', 'FETCH_HEAD']);
  }
  mkdirSync(join(ROOT, 'assets/posts'), { recursive: true });
  await sharp(join(ROOT, cover.from)).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 74, effort: 6 }).toFile(join(ROOT, coverOut));
  const entry = { title, slug, cover: coverOut, alt: cover.alt, excerpt, cats: draft.cats, date: today, author: site.name, keywords: draft.keywords || '', html, sources };
  writeFileSync(join(ROOT, 'data/posts.json'), `${JSON.stringify([entry, ...posts], null, 2)}\n`);
  if (planBefore && draft.topic) {
    const plan = JSON.parse(planBefore);
    const t = plan.topics.find((x) => x.id === draft.topic);
    if (t) Object.assign(t, { status: 'published', slug, date: today });
    writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  }
  run('node', ['tools/build.mjs']);
  run('node', ['tools/check-links.mjs']);
  run('node', ['tools/seo-check.mjs']);
} catch (e) {
  writeFileSync(join(ROOT, 'data/posts.json'), before);
  if (planBefore) writeFileSync(planPath, planBefore);
  rmSync(join(ROOT, coverOut), { force: true });
  run('node', ['tools/build.mjs'], { allowFail: true });
  console.error(`Not published, everything restored: ${e.message}`);
  process.exit(1);
}
console.log(`Added /blog/${slug} (${today}).`);
if (!COMMIT) process.exit(0);
run('git', ['add', '-A', 'data/posts.json', 'data/blog-plan.json', 'assets', '*.html', 'blog', 'utilaje', 'sitemap.xml', 'llms.txt', 'llms-full.txt']);
run('git', ['commit', '-m', `Blog: ${title}`, '-m', `Automatic daily post (tools/new-post.mjs): ${n} words, ${sources.length} sources, gates passed, build + link + SEO checks passed.`]);
const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true }).stdout.trim();
git('push', REPO, `HEAD:main`, ...(branch && branch !== 'main' && branch !== 'HEAD' ? [`HEAD:${branch}`] : []));
console.log(`Published: https://www.tractoaretecuci.ro/blog/${slug}`);
