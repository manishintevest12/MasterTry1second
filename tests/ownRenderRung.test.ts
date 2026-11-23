import test from 'node:test';
import assert from 'node:assert/strict';
import { rescueRungs, rescueOrderFor, ownRenderAvailable } from '../server/sources/rescueFetch';

/**
 * OWNER 23 Nov: "scrapper api charge krega hume apna scrapper api jaisa kaam chaiye."
 * The own-render rung must exist without any paid key, and must be tried BEFORE the paid rung.
 */
test('our own render service is a rung of its own, no paid key needed', () => {
  delete process.env.SCRAPER_API_KEY;
  delete process.env.CF_ACCOUNT_ID;
  delete process.env.CF_BROWSER_TOKEN;
  delete process.env.T1S_RENDER_URL;

  assert.equal(ownRenderAvailable(), false, 'nothing configured, no rung');
  assert.equal(rescueRungs().includes('own'), false);

  process.env.T1S_RENDER_URL = 'https://render.example.test';
  assert.equal(ownRenderAvailable(), true);
  assert.ok(rescueRungs().includes('own'), 'a self-hosted service is enough');
  assert.ok(rescueOrderFor('www.booking.com').includes('own'));

  // Cloudflare's free Browser Rendering works as the no-server option.
  delete process.env.T1S_RENDER_URL;
  process.env.CF_ACCOUNT_ID = 'acc';
  process.env.CF_BROWSER_TOKEN = 'tok';
  assert.equal(ownRenderAvailable(), true);
  delete process.env.CF_ACCOUNT_ID;
  delete process.env.CF_BROWSER_TOKEN;
});

test('own runs before the paid rung when both exist', () => {
  process.env.T1S_RENDER_URL = 'https://render.example.test';
  process.env.SCRAPER_API_KEY = 'paid-key';
  const rungs = rescueRungs();
  assert.ok(rungs.indexOf('own') < rungs.indexOf('scraperapi'), 'free-at-the-margin capacity is spent first');
  delete process.env.T1S_RENDER_URL;
  delete process.env.SCRAPER_API_KEY;
});

/**
 * OWNER 23 Nov: "cloudflare wala diya tho tha" — the account was already configured, just under the names the
 * Cloudflare dashboard uses. Every common spelling must work, and the chosen names must be reportable.
 */
test('the panel/dashboard spellings of the Cloudflare keys are accepted', async () => {
  const { ownRenderEnvNames } = await import('../server/sources/rescueFetch');
  for (const k of ['T1S_RENDER_URL','CF_ACCOUNT_ID','CF_BROWSER_TOKEN','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN','CLOUDFLARE_API_KEY','CLOUDFLARE_EMAIL','CF_API_TOKEN']) delete process.env[k];

  assert.equal(ownRenderEnvNames().mode, 'none');

  process.env.CLOUDFLARE_ACCOUNT_ID = 'acc123';
  process.env.CLOUDFLARE_API_TOKEN = 'tok123';
  const a = ownRenderEnvNames();
  assert.equal(a.mode, 'cloudflare-token');
  assert.equal(a.account, 'CLOUDFLARE_ACCOUNT_ID');
  assert.equal(a.token, 'CLOUDFLARE_API_TOKEN');
  assert.equal(ownRenderAvailable(), true);

  // CF_* still works
  delete process.env.CLOUDFLARE_ACCOUNT_ID; delete process.env.CLOUDFLARE_API_TOKEN;
  process.env.CF_ACCOUNT_ID = 'acc'; process.env.CF_API_TOKEN = 'tok';
  assert.equal(ownRenderEnvNames().mode, 'cloudflare-token');
  delete process.env.CF_ACCOUNT_ID; delete process.env.CF_API_TOKEN;

  // Cloudflare's global-key pair (email + key) is supported too
  process.env.CLOUDFLARE_ACCOUNT_ID = 'acc';
  process.env.CLOUDFLARE_EMAIL = 'owner@example.com';
  process.env.CLOUDFLARE_API_KEY = 'global-key';
  assert.equal(ownRenderEnvNames().mode, 'cloudflare-global-key');
  delete process.env.CLOUDFLARE_ACCOUNT_ID; delete process.env.CLOUDFLARE_EMAIL; delete process.env.CLOUDFLARE_API_KEY;
});
