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
