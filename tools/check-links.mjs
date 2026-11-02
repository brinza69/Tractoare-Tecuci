// Checks every internal href/src/srcset in the generated HTML resolves to a file (Cloudflare Pages URL rules).
// Usage: node tools/check-links.mjs
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skip = new Set(['node_modules', 'src', 'tools', '.git', '.tmp', 'docs', 'graphify-out', '.claude']);
const html = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (skip.has(f)) continue; if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.html')) html.push(p); } };
walk(ROOT);
const exists = (path) => {
  const clean = decodeURIComponent(path.split(/[?#]/)[0]);
  if (clean === '/' ) return existsSync(join(ROOT, 'index.html'));
  const p = join(ROOT, clean);
  return existsSync(p) && statSync(p).isFile() || existsSync(`${p}.html`) || existsSync(join(p, 'index.html'));
};
let bad = 0;
for (const file of html) {
  const t = readFileSync(file, 'utf8');
  const refs = [...t.matchAll(/\s(?:href|src|poster|data-full|data-src-[a-z]+|data-(?:webm|mp4)-[a-z]+)="([^"]+)"/g)].map((m) => m[1])
    .concat([...t.matchAll(/\s(?:srcset|imagesrcset|data-srcset)="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+/)[0])));
  for (const r of refs) {
    if (!r.startsWith('/') || r.startsWith('//')) continue;
    if (!exists(r)) { bad++; console.log(`${relative(ROOT, file)}: ${r}`); }
  }
}
console.log(bad ? `${bad} broken internal reference(s)` : `all internal references resolve (${html.length} pages)`);
process.exit(bad ? 1 : 0);
