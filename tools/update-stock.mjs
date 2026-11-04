// One command for the stock: OLX sync, TractorData specs, build, checks; optionally commit and publish.
// Usage: node tools/update-stock.mjs            update the files only
//        node tools/update-stock.mjs --commit   also commit and push to main when something changed
// Runs unattended twice a day from Windows Task Scheduler (tools/stock-sync.cmd, log in .tmp/stock-sync.log),
// or from GitHub Actions once docs/stock-sync.workflow.yml is copied to .github/workflows/.
// Safe to run unattended: with --commit it does nothing while the repo has uncommitted work, starts from what is
// live, and sync-olx.mjs refuses to change anything when OLX suddenly shows under half of the listings.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COMMIT = process.argv.includes('--commit');
const REPO = 'https://github.com/brinza69/Tractoare-Tecuci.git';
const ACTIONS = !!process.env.GITHUB_ACTIONS;
const stamp = () => new Date().toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' });
const run = (cmd, args, opts = {}) => {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: opts.capture ? 'pipe' : 'inherit', encoding: 'utf8', shell: false });
  if (r.status !== 0 && !opts.allowFail) {
    console.error(`[${stamp()}] failed: ${cmd} ${args.join(' ')}${r.stderr ? `\n${r.stderr}` : ''}`);
    process.exit(r.status || 1);
  }
  return r;
};
// On this PC there is no SSH key: authenticate the HTTPS remote with the GitHub CLI. Actions has its own token.
const gitRemote = (...a) => (ACTIONS ? run('git', a) : run('git', ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', ...a]));
const titles = (json) => new Map(JSON.parse(json).map((p) => [p.slug, `${p.brand && !p.title.startsWith(p.brand) ? `${p.brand} ` : ''}${p.title}, ${p.year}`]));

console.log(`[${stamp()}] stock update${COMMIT ? ' (commit + publish)' : ''}`);
if (COMMIT && !ACTIONS) {
  const dirty = run('git', ['status', '--porcelain'], { capture: true }).stdout.trim();
  if (dirty) { console.log(`Skipped: the repo has uncommitted work, nothing touched.\n${dirty.split('\n').slice(0, 10).join('\n')}`); process.exit(0); }
  gitRemote('fetch', REPO, 'main');
  run('git', ['merge', '--ff-only', 'FETCH_HEAD']);
}
const before = titles(readFileSync(join(ROOT, 'data/products.json'), 'utf8'));

run('node', ['tools/sync-olx.mjs']);
run('node', ['tools/tractordata.mjs']);
run('node', ['tools/build.mjs']);
run('node', ['tools/check-links.mjs']);
run('node', ['tools/seo-check.mjs']);

const after = titles(readFileSync(join(ROOT, 'data/products.json'), 'utf8'));
const added = [...after].filter(([s]) => !before.has(s)).map(([, t]) => t);
const removed = [...before].filter(([s]) => !after.has(s)).map(([, t]) => t);
const summary = [added.length ? `Noi: ${added.join('; ')}` : '', removed.length ? `Vândute / scoase: ${removed.join('; ')}` : ''].filter(Boolean).join('\n');

const status = run('git', ['status', '--porcelain'], { capture: true }).stdout.trim();
if (!status) { console.log(`\n[${stamp()}] Stoc neschimbat (${after.size} utilaje).`); process.exit(0); }
console.log(`\nSchimbări (${after.size} utilaje):\n${summary || 'texte, poze sau date actualizate'}\n${status.split('\n').slice(0, 30).join('\n')}`);
if (!COMMIT) process.exit(0);

run('git', ['add', '-A']);
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date());
run('git', ['commit', '-m', `Stoc actualizat din OLX (${date}): ${after.size} utilaje${added.length ? `, ${added.length} noi` : ''}${removed.length ? `, ${removed.length} scoase` : ''}`,
  '-m', `${summary ? `${summary}\n\n` : ''}Automatic run of tools/update-stock.mjs: OLX sync, TractorData specs, build, link and SEO checks.`]);
if (ACTIONS) run('git', ['push']);
else {
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true }).stdout.trim();
  gitRemote('push', REPO, 'HEAD:main', ...(branch && branch !== 'main' && branch !== 'HEAD' ? [`HEAD:${branch}`] : []));
}
console.log(`\n[${stamp()}] Publicat: Cloudflare Pages actualizează site-ul în ~1 minut.`);
