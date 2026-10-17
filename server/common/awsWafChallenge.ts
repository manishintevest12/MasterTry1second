/**
 * AWS WAF "Goku" JS-challenge solver — browserless, cffi-transport.
 *
 * Zepto's SSR pages (zepto.com) sit behind an AWS WAF JavaScript challenge:
 * GET returns HTTP 202 + a 2KB shell carrying window.gokuProps {key,iv,context}
 * and a <script src="https://<id>.<hash>.us-east-1.token.awswaf.com/.../challenge.js">.
 * The challenge script computes a proof-of-work and POSTs it (as multipart
 * FormData) to .../mp_verify?region=us-east-1; on 200 it sets the aws-waf-token
 * cookie (domain .zepto.com) and reloads the page.
 *
 * THIS MODULE runs the exact challenge inside a jsdom sandbox (no browser, no
 * automation framework — a pure-JS DOM), routing every network call through the
 * platform's cffi bridge (curl-impersonate TLS), so the answer is computed with
 * the same fingerprints production already uses. Verified live 17 Oct 2026:
 * mp_verify 200, aws-waf-token minted from the SANDBOX datacenter IP, and Zepto
 * homepage + search pages return 200 with real priced product JSON.
 *
 * jsdom polyfills needed: window.crypto.subtle (Node webcrypto), a no-op
 * location.reload (we poll document.cookie instead of reloading), and a fetch()
 * shim that serializes FormData to multipart with a real boundary (the one bug
 * that turned every mp_verify into 400 "Invalid boundary").
 * No canvas package needed: jsdom's getContext() returns null and the
 * challenge still passes — important for shared hosting (no native deps).
 *
 * Token freshness: AWS WAF challenge tokens are short-lived (minutes for
 * reuse). We cache per-host for CACHE_TTL_MS and re-mint on demand; every
 * caller treats a 202 after this as "re-mint once, retry".
 */
import { webcrypto } from 'node:crypto';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const CACHE_TTL_MS = 150_000; // 2.5 min — observed tokens go stale within minutes

export const AWS_WAF_UA = UA;

interface CacheEntry { token: string; mintedAt: number }
const tokenCache = new Map<string, CacheEntry>();

interface CffiResult { status: number; body: string }
type Cffi = (url: string, opts: Record<string, any>) => Promise<CffiResult>;

/** Curl-impersonate transport, injected so the module has no import cycles. */
export function makeAwsWafSolver(cffiFetch: Cffi) {
  const serializeFormData = (fd: any): { body: string; contentType: string } => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const parts: string[] = [];
    for (const [k, v] of fd.entries()) parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
    parts.push(`--${boundary}--\r\n`);
    return { body: parts.join(''), contentType: `multipart/form-data; boundary=${boundary}` };
  };

  /** Mint (or reuse) an aws-waf-token valid for GETs against `url`'s host. */
  async function mintAwsWafToken(url: string, opts: { maxMs?: number } = {}): Promise<string> {
    const host = new URL(url).hostname;
    const cached = tokenCache.get(host);
    if (cached && Date.now() - cached.mintedAt < CACHE_TTL_MS) return cached.token;
    const t0 = Date.now();
    const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 20_000, headers: { 'User-Agent': UA, 'Accept-Language': 'en-IN,en;q=0.9' } });
    const html = r.body || '';
    if (r.status === 200 && !html.includes('gokuProps')) {
      tokenCache.set(host, { token: '', mintedAt: Date.now() }); // no challenge for this host
      return '';
    }
    if (!html.includes('gokuProps')) throw new Error(`AWS WAF shell missing (HTTP ${r.status}, len ${html.length})`);
    const m = html.match(/<script src="(https:\/\/[^"]*awswaf\.com[^"]*challenge\.js)"><\/script>/);
    if (!m) throw new Error('challenge.js URL not found in shell');
    const cj = await cffiFetch(m[1], { impersonate: 'chrome', timeoutMs: 25_000, headers: { 'User-Agent': UA } });
    if (!cj.body) throw new Error(`challenge.js fetch failed (HTTP ${cj.status})`);

    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM(html.replace(m[0], ''), { url, runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window as any;
    Object.defineProperty(w, 'crypto', {
      value: { ...(w.crypto || {}), subtle: webcrypto.subtle, getRandomValues: (b: any) => webcrypto.getRandomValues(b) },
      configurable: true, writable: true,
    });
    w.TextEncoder = w.TextEncoder || TextEncoder;
    w.TextDecoder = w.TextDecoder || TextDecoder;
    Object.defineProperty(w.Location.prototype, 'reload', { value: () => {}, configurable: true });
    Object.defineProperty(w.navigator, 'userAgent', { get: () => UA, configurable: true });
    w.fetch = async (u: string, init: any = {}) => {
      let bodyStr: string | undefined; let ct = '';
      if (init.body) {
        if (init.body instanceof w.FormData) { const s = serializeFormData(init.body); bodyStr = s.body; ct = s.contentType; }
        else if (typeof init.body === 'string') bodyStr = init.body;
        else if (init.body instanceof Uint8Array) bodyStr = Buffer.from(init.body).toString();
        else bodyStr = String(init.body);
      }
      const hdrs: Record<string, string> = { 'User-Agent': UA, ...((init.headers as Record<string, string>) || {}) };
      if (ct && !hdrs['Content-Type'] && !hdrs['content-type']) hdrs['Content-Type'] = ct;
      const res = await cffiFetch(String(u), { impersonate: 'chrome', method: init.method || 'GET', body: bodyStr, timeoutMs: 25_000, headers: hdrs });
      const body = res.body || '';
      return { ok: res.status >= 200 && res.status < 300, status: res.status, statusText: String(res.status), text: async () => body, json: async () => JSON.parse(body || '{}') };
    };
    try { dom.window.eval(cj.body); } catch (e: any) { throw new Error(`challenge.js eval failed: ${String(e).slice(0, 120)}`); }

    const deadline = Date.now() + (opts.maxMs ?? 60_000);
    while (Date.now() < deadline) {
      await new Promise((res) => setTimeout(res, 1000));
      const mm = (w.document.cookie || '').match(/aws-waf-token=([^;]+)/);
      if (mm) {
        const token = decodeURIComponent(mm[1]);
        tokenCache.set(host, { token, mintedAt: Date.now() });
        return token;
      }
    }
    throw new Error('aws-waf-token not minted before deadline');
  }

  /** GET a WAF-protected page: mint token, fetch; retry once on a fresh 202. */
  async function wafGet(url: string, extraHeaders: Record<string, string> = {}, opts: { maxMs?: number } = {}): Promise<CffiResult> {
    const token = await mintAwsWafToken(url, opts);
    const headers = { 'User-Agent': UA, 'Accept-Language': 'en-IN,en;q=0.9', ...(token ? { Cookie: 'aws-waf-token=' + token } : {}), ...extraHeaders };
    let r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 25_000, headers });
    if (r.status === 202) {
      tokenCache.delete(new URL(url).hostname); // stale — re-mint once
      const fresh = await mintAwsWafToken(url, opts);
      r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 25_000, headers: { ...headers, ...(fresh ? { Cookie: 'aws-waf-token=' + fresh } : {}) } });
    }
    return r;
  }

  return { mintAwsWafToken, wafGet, isChallenged: (status: number, body: string) => status === 202 || (status === 200 && body.includes('gokuProps')) };
}
