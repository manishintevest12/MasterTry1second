#!/usr/bin/env node
/**
 * OWNER 9 Nov: production served dist/index.html that pointed at hashed files which were no longer on
 * disk (/assets/index-DMosdBwh.js, index-B_WEV_f-.css, icons-*.js, rolldown-runtime-*.js all 404), so the
 * page painted its HTML and froze. That is a half-finished build, and it must never be able to boot:
 * this script runs at the end of `npm run build` and fails the build when the dist is inconsistent.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const fail = (msg, extra) => {
  console.error(`\n[verify-dist] FAILED: ${msg}`);
  if (extra) console.error(extra);
  console.error('[verify-dist] The dist/ directory is inconsistent. Re-run `npm run build` (a stale or');
  console.error('[verify-dist] partially deleted dist is the usual cause). Do not deploy this build.\n');
  process.exit(1);
};

if (!existsSync(path.join(dist, 'index.html'))) fail('dist/index.html is missing');

const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
const assetsDir = path.join(dist, 'assets');
const files = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
if (!files.length) fail('dist/assets is empty', `  expected: ${assetsDir}`);

const refs = [...html.matchAll(/\/assets\/([A-Za-z0-9_.-]+\.(?:js|css))/g)].map((m) => m[1]);
const missingAssets = [...new Set(refs)].filter((f) => !files.includes(f));
if (missingAssets.length) fail(`index.html references ${missingAssets.length} file(s) that are not in dist/assets`, missingAssets.map((m) => `  missing: assets/${m}`).join('\n'));

// Root art referenced by the shell (icons, logos) must exist too - production 404'd all of them.
const rootRefs = [...html.matchAll(/(?:href|src)="\/([A-Za-z0-9_.-]+\.(?:ico|png|webp|jpe?g|svg))"/g)].map((m) => m[1]);
const missingRoot = [...new Set(rootRefs)].filter((f) => !existsSync(path.join(dist, f)));
if (missingRoot.length) fail(`index.html references ${missingRoot.length} root file(s) missing from dist/`, missingRoot.map((m) => `  missing: ${m}`).join('\n'));

console.log(`[verify-dist] OK - ${refs.length} asset refs and ${rootRefs.length} root files all present (${files.length} files in dist/assets)`);
