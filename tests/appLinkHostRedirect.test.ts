import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * OWNER 29 Oct: a tapped try1second.com link must open the app, not the browser.
 * Android/iOS verifiers do NOT follow redirects, so the apex host has to serve
 * /.well-known/assetlinks.json with a 200 of its own instead of the canonical 301
 * to www. This pins that exemption in place next to the redirect it guards.
 */
const src = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');

test('canonical apex -> www 301 still exists for normal pages', () => {
  assert.match(src, /res\.redirect\(301, `https:\/\/www\.try1second\.com\$\{req\.originalUrl \|\| req\.url\}`\)/);
});

test('the .well-known verification paths are exempt from that redirect', () => {
  assert.match(src, /startsWith\('\/\.well-known\/'\)/);
  const guard = src.slice(src.indexOf('startsWith(\'/.well-known/\')'), src.indexOf('startsWith(\'/.well-known/\')') + 400);
  assert.match(guard, /if \(!isVerificationFile && \(host === 'try1second\.com'/, guard.slice(0, 200));
});
