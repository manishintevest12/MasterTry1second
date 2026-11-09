/**
 * INDEXNOW — instant submission to Bing, Yandex, Seznam and Naver.
 *
 * OWNER 9 Nov: "google yaa google jaise saare browser pr search krte hi hum top pr dikhe". Google needs
 * no ping (it reads the sitemap), but the other engines that power DuckDuckGo/Brave-style surfaces accept
 * IndexNow: you host a key file, then POST the changed URLs and they crawl them within minutes instead of
 * waiting weeks. This module owns the key, serves it at the URL the protocol requires, and builds the
 * submission payload from the same corpus the sitemap uses, so the three can never disagree.
 *
 * No secret is involved: the key is public by design (it only proves we control the host).
 */
import { listSeoPaths, SEO_HOST } from './data';

/** 32 hex chars, generated once for this domain. Changing it invalidates every previous submission. */
export const INDEXNOW_KEY = 'b7d41e6a9c2f4f8a8e13c5d6a07b2e94';

/** The key file path IndexNow requires: https://www.try1second.com/<key>.txt */
export const INDEXNOW_KEY_PATH = `/${INDEXNOW_KEY}.txt`;

/** Engines to notify. All of them accept the same POST body. */
export const INDEXNOW_ENDPOINTS = [
  'https://api.indexnow.org/indexnow',
  'https://www.bing.com/indexnow',
  'https://yandex.com/indexnow',
];

/**
 * Registrable host, which is what the protocol wants (it validates the key file on this host and the
 * submitted URLs must belong to it). www is kept because that is the canonical host we serve.
 */
export const INDEXNOW_HOST = 'www.try1second.com';

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

/** Sitemap URLs, including the answer layer, chunked to the 10k limit the protocol allows. */
export function indexNowPayloads(max = 10_000): IndexNowPayload[] {
  let paths: string[] = [];
  try { paths = listSeoPaths(); } catch { paths = ['/']; }
  const urls = Array.from(new Set(paths.filter(Boolean))).map((p) => `${SEO_HOST}${p === '/' ? '/' : p}`);
  const chunks: IndexNowPayload[] = [];
  for (let i = 0; i < urls.length; i += max) {
    chunks.push({
      host: INDEXNOW_HOST,
      key: INDEXNOW_KEY,
      keyLocation: `${SEO_HOST}${INDEXNOW_KEY_PATH}`,
      urlList: urls.slice(i, i + max),
    });
  }
  return chunks;
}

/**
 * Route for the key file plus a manual trigger. The trigger is token-guarded (SEO_PING_TOKEN) because
 * submitting 1000 URLs is an outward action; the key file itself is public and always served.
 */
export function registerIndexNowRoutes(app: any): void {
  app.get(INDEXNOW_KEY_PATH, (_req: any, res: any) => {
    res.type('text/plain; charset=utf-8').setHeader('Cache-Control', 'public, max-age=86400');
    res.send(INDEXNOW_KEY);
  });

  app.post('/api/seo/indexnow', async (req: any, res: any) => {
    const token = process.env.SEO_PING_TOKEN || '';
    if (!token || String(req.query.token || '') !== token) {
      res.status(403).json({ ok: false, error: 'token required' });
      return;
    }
    const results: { endpoint: string; status: number }[] = [];
    for (const chunk of indexNowPayloads()) {
      for (const endpoint of INDEXNOW_ENDPOINTS) {
        try {
          const r = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(chunk),
          });
          results.push({ endpoint, status: r.status });
        } catch (e: any) {
          results.push({ endpoint, status: 0 });
        }
      }
    }
    res.json({ ok: true, urls: indexNowPayloads().reduce((n, c) => n + c.urlList.length, 0), results });
  });
}
