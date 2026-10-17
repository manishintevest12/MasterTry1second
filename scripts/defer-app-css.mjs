/**
 * Post-build step (PageSpeed render-blocking CSS fix, 17 Oct): Vite emits the
 * 155KB app stylesheet as a parser-blocking <link rel="stylesheet">. The
 * landing page paints from the INLINE splash CSS already in <head>, and the
 * splash overlay covers the viewport until React mounts — so the app CSS can
 * load off the critical path with the preload→swap pattern (high priority
 * fetch, non-blocking apply). A <noscript> fallback keeps the real stylesheet
 * for browsers without JS.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../dist/index.html', import.meta.url).pathname;
let html = readFileSync(FILE, 'utf8');

// Match Vite's emitted app stylesheet (crossorigin, hashed asset path).
const cssRe = /<link rel="stylesheet" crossorigin href="(\/assets\/index-[^"]+\.css)">/;
const m = html.match(cssRe);
if (!m) {
  if (html.includes('onload="this.rel=\'stylesheet\'"')) {
    console.log('[defer-app-css] already deferred, nothing to do');
  } else {
    console.warn('[defer-app-css] no app stylesheet link found — skipping');
  }
  process.exit(0);
}

const href = m[1];
const deferred =
  `<link rel="preload" as="style" href="${href}" onload="this.rel='stylesheet';this.onload=null">` +
  `<noscript><link rel="stylesheet" crossorigin href="${href}"></noscript>`;

html = html.replace(cssRe, deferred);
writeFileSync(FILE, html);
console.log(`[defer-app-css] deferred ${href}`);
