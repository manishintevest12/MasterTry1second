#!/usr/bin/env node
/**
 * Push every sitemap URL to IndexNow (Bing, Yandex, Seznam) in one shot.
 *
 *   node scripts/indexnow.mjs            # submit production
 *   node scripts/indexnow.mjs --dry-run  # print what would be sent
 *
 * The key file must already be live at https://www.try1second.com/<key>.txt
 * (server/seo/indexnow.ts serves it). No secret is needed: the key is public.
 */
const HOST = 'www.try1second.com';
const ORIGIN = `https://${HOST}`;
const KEY = 'b7d41e6a9c2f4f8a8e13c5d6a07b2e94';
const ENDPOINTS = ['https://api.indexnow.org/indexnow', 'https://www.bing.com/indexnow', 'https://yandex.com/indexnow'];

const dry = process.argv.includes('--dry-run');

/**
 * /sitemap.xml is a <sitemapindex> of /sitemap-core.xml, /sitemap-cities.xml and /sitemap-products.xml, so a
 * plain <loc> scrape of the top file yields three sitemap URLs instead of pages (that is exactly what happened
 * after the split). Read the index, then every child, and submit the real page URLs.
 */
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
const rootXml = await fetch(`${ORIGIN}/sitemap.xml`).then((r) => r.text());
let urls = locs(rootXml);
if (/<sitemapindex/.test(rootXml)) {
  const children = urls.filter((u) => u.endsWith('.xml'));
  const pages = [];
  for (const child of children) {
    const childXml = await fetch(child).then((r) => r.text()).catch(() => '');
    pages.push(...locs(childXml));
  }
  urls = pages;
  console.log(`sitemap index: ${children.length} files`);
}
urls = [...new Set(urls)];
if (!urls.length) {
  console.error('No URLs found in the sitemap. Is the site up?');
  process.exit(1);
}

const keyCheck = await fetch(`${ORIGIN}/${KEY}.txt`).then((r) => r.text()).catch(() => '');
if (keyCheck.trim() !== KEY) {
  console.error(`Key file is not live at ${ORIGIN}/${KEY}.txt - deploy first, then re-run.`);
  process.exit(1);
}

const body = { host: HOST, key: KEY, keyLocation: `${ORIGIN}/${KEY}.txt`, urlList: urls };
console.log(`${urls.length} URLs from the sitemap`);
if (dry) {
  console.log(JSON.stringify({ ...body, urlList: urls.slice(0, 5) }, null, 2));
  process.exit(0);
}

for (const endpoint of ENDPOINTS) {
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });
    // 200 = accepted, 202 = accepted and key still being validated; both are fine.
    console.log(`${endpoint} -> ${r.status}${r.status === 200 || r.status === 202 ? ' OK' : ''}`);
  } catch (e) {
    console.log(`${endpoint} -> failed (${e.message})`);
  }
}
