import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isKnownPath, isSecretPortalPath } from '../server/seo/agentReady';

test('the admin portal route is a known app path, so the shell is served instead of a 404', () => {
  assert.equal(isKnownPath('/admininsta'), true, 'owner 11 Nov: /admininsta must boot the app');
  assert.equal(isKnownPath('/merchantinstab2b'), true, 'the merchant portal keeps working');
  assert.equal(isKnownPath('/admininsta-but-not-a-route'), false, 'no prefix over-match');
  assert.equal(isKnownPath('/definitely-not-a-page'), false, 'unknown URLs still 404 honestly');
});

test('both private portals carry a noindex header and are never advertised', () => {
  assert.equal(isSecretPortalPath('/admininsta'), true);
  assert.equal(isSecretPortalPath('/merchantinstab2b/'), true, 'trailing slash tolerated');
  assert.equal(isSecretPortalPath('/admin'), false, 'only the portals, not every /admin* path');
  const shell = readFileSync('server/index.ts', 'utf8');
  assert.match(shell, /X-Robots-Tag', 'noindex, nofollow, noarchive'/, 'header must be set on the shell');
  const robots = readFileSync('server/seo/sitemap.ts', 'utf8');
  assert.match(robots, /Disallow: \/admin/, 'robots.txt keeps /admin out of the index');
});
