// One command for the stock: OLX sync, TractorData specs, build, checks; optionally commit and push.
// Usage: node tools/update-stock.mjs            update the files only
//        node tools/update-stock.mjs --commit   also commit and push when something changed
// Runs on a schedule once docs/stock-sync.workflow.yml is copied to .github/workflows/; can be run by hand.
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COMMIT = process.argv.includes('--commit');
const run = (cmd, args, opts = {}) => {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: opts.capture ? 'pipe' : 'inherit', encoding: 'utf8', shell: false });
  if (r.status !== 0 && !opts.allowFail) {
    console.error(`failed: ${cmd} ${args.join(' ')}`);
    process.exit(r.status || 1);
  }
  return r;
};

run('node', ['tools/sync-olx.mjs']);
run('node', ['tools/tractordata.mjs']);
run('node', ['tools/build.mjs']);
run('node', ['tools/check-links.mjs']);
run('node', ['tools/seo-check.mjs']);

const status = run('git', ['status', '--porcelain'], { capture: true }).stdout.trim();
if (!status) { console.log('\nStoc neschimbat.'); process.exit(0); }
console.log(`\nSchimbări:\n${status.split('\n').slice(0, 30).join('\n')}`);
if (!COMMIT) process.exit(0);

run('git', ['add', '-A']);
const date = new Date().toISOString().slice(0, 10);
run('git', ['commit', '-m', `Stoc actualizat din OLX (${date})`, '-m', 'Automatic run of tools/update-stock.mjs: OLX sync, TractorData specs, build, link and SEO checks.']);
run('git', ['push']);
