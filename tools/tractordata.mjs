// Model specifications from TractorData.com for the listings in data/products.json.
// Usage: node tools/tractordata.mjs
// The model -> page map is data/specs.map.json (OLX id -> TractorData URL), chosen by hand.
// A page is used only when its production years include the listing's year; otherwise it is dropped
// and reported, so no listing shows another generation's numbers.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const map = JSON.parse(readFileSync(join(ROOT, 'data/specs.map.json'), 'utf8'));
const products = JSON.parse(readFileSync(join(ROOT, 'data/products.json'), 'utf8'));

const get = (url) => {
  const r = spawnSync('curl', ['-sfL', '--max-time', '60', '-A', UA, url], { maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`GET failed: ${url}`);
  return r.stdout.toString('utf8');
};
const lines = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, '\n').replace(/<[^>]+>/g, '\n')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&uarr;/g, '').replace(/&#[0-9]+;/g, '')
  .split('\n').map((l) => l.trim()).filter(Boolean);

// Value(s) that follow a label, until the next known label.
function after(ls, label, n = 1) {
  const i = ls.findIndex((l) => l.toLowerCase() === label.toLowerCase());
  return i < 0 ? [] : ls.slice(i + 1, i + 1 + n);
}
const metric = (pair) => {
  const v = pair.find((x) => /kW|kg|cm|L$|lpm|mm/.test(x)) || pair[0] || '';
  const lb = v.match(/^([\d,.]+)\s*(?:to\s*([\d,.]+)\s*)?(?:lbs|pounds)$/);
  if (!lb) return v;
  const kg = (n) => Math.round(parseFloat(n.replace(/,/g, '')) * 0.4536);
  return lb[2] ? `${kg(lb[1])}–${kg(lb[2])} kg` : `${kg(lb[1])} kg`;
};
// TractorData writes in English; the site is Romanian.
const COUNTRIES = { Germany: 'Germania', England: 'Anglia', Italy: 'Italia', France: 'Franța', Austria: 'Austria', 'United States': 'SUA' };
const tr = (s) => String(s)
  .replace(/(\d)\.(\d)L\b/g, '$1,$2 L')
  .replace(/(\d)-cyl diesel/g, '$1 cilindri, diesel')
  .replace(/continuously[- ]variable transmission/gi, 'transmisie continuu variabilă')
  .replace(/infinitely variable transmission/gi, 'transmisie continuu variabilă')
  .replace(/four-speed power shift/gi, 'powershift în 4 trepte')
  .replace(/partial power shift/gi, 'powershift parțial')
  .replace(/full power shift/gi, 'powershift integral')
  .replace(/power shift/gi, 'powershift')
  .replace(/synchro shuttle/gi, 'cu inversor sincronizat')
  .replace(/synchromesh/gi, 'sincronizată')
  .replace(/shuttle/gi, 'cu inversor')
  .replace(/(\d+)-speed/g, '$1 viteze')
  .replace(/, ([A-Z][a-z]+(?: [A-Z][a-z]+)?)$/, (m, c) => ', ' + (COUNTRIES[c] || c));
const ro = (s) => String(s).replace(/(\d),(\d{3})/g, '$1.$2').replace(/(\d)\.(\d)/g, '$1,$2');
const cp = (kw) => Math.round(parseFloat(kw) / 0.7355);

function parse(html) {
  const ls = lines(html);
  const yi = ls.findIndex((l) => /^\d{4}\s*-\s*(\d{4}|present|\?{4})$/i.test(l));
  const [from, to] = yi < 0 ? [] : ls[yi].split('-').map((s) => s.trim());
  const spec = [];
  const add = (k, v) => { v = tr(v ?? '').trim(); if (v && !/undefined/.test(v)) spec.push({ k, v }); };
  add('Ani de producție', !from ? '' : /\?/.test(to) ? `din ${from}` : `${from}–${/present/i.test(to) ? 'prezent' : to}`);
  add('Fabricat în', (ls.find((l) => l.startsWith('Built in')) || '').replace('Built in ', ''));
  const engineIdx = ls.findIndex((l) => / Engine$/.test(l) && !/details/i.test(l));
  add('Motor', engineIdx >= 0 ? ls[engineIdx + 1] : '');
  for (const [label, k] of [['Engine (gross)', 'Putere motor (brut)'], ['Engine (net)', 'Putere motor (net)'], ['Engine (rated)', 'Putere motor (nominală)'], ['PTO (claimed)', 'Putere la priză (declarată)']]) {
    const v = after(ls, label, 2);
    const kw = v.find((x) => /kW/.test(x));
    if (kw) add(k, `${ro(kw)} (${cp(kw)} CP)`);
  }
  const ti = ls.findIndex((l) => / Transmissions?$/.test(l));
  if (ti >= 0) {
    const tr = [];
    for (let i = ti + 1; i < ls.length && !/details/i.test(ls[i]); i++) tr.push(ls[i]);
    add('Transmisie', tr.join('; '));
  }
  add('Rezervor combustibil', ro(metric(after(ls, 'Fuel tank', 2))));
  add('Debit pompă hidraulică', ro(metric(after(ls, 'Pump flow', 2))));
  const lift = ls.find((l) => /^Rear lift/.test(l));
  if (lift) add('Capacitate ridicare spate', ro(metric(after(ls, lift, 2))));
  add('Priză de putere spate', after(ls, 'Rear PTO Type', 1)[0] ? `${after(ls, 'Rear PTO Type', 1)[0].replace(/\s*\(.*\)/, '')} rot/min` : '');
  add('Ampatament', ro(metric(after(ls, 'Wheelbase', 2))));
  add('Greutate', ro(metric(after(ls, 'Weight', 2))));
  add('Anvelope față', after(ls, 'Front tire', 1)[0] || '');
  add('Anvelope spate', after(ls, 'Rear tire', 1)[0] || '');
  return { from: Number(from), to: /present|\?/i.test(to || '') ? 9999 : Number(to), spec };
}

const out = {};
for (const p of products) {
  const url = map[p.olxId];
  if (!url) { console.log(`-  ${p.slug}: no TractorData page mapped`); continue; }
  const { from, to, spec } = parse(get(url));
  if (!p.year || !(p.year >= from && p.year <= to)) {
    console.log(`x  ${p.slug}: year ${p.year} outside ${from}-${to}, dropped (${url})`);
    continue;
  }
  out[p.olxId] = { source: url, spec };
  console.log(`ok ${p.slug}: ${spec.length} fields (${from}-${to === 9999 ? 'present' : to})`);
}
writeFileSync(join(ROOT, 'data/specs.json'), JSON.stringify(out, null, 2) + '\n');
