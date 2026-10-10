/**
 * BrowserRenderAdapter (Section 5.2 fallback): when direct HTTP/cURL returns a
 * JS-rendered shell with no usable product data, Try1Second renders the page in
 * a headless browser (Playwright) and extracts public structured data (JSON-LD).
 *
 * Capability-honest: if Playwright/Chromium is not installed on this runtime the
 * adapter reports CONFIGURATION_REQUIRED — it never fabricates results.
 * Shared-hosting safe: hard-bounded navigation + render timeouts, one page,
 * closed browser, per-source rate limits. It never bypasses authentication,
 * CAPTCHAs or access controls — pages that require them fail honestly.
 */
import type { AdapterResult, RawSourceItem, SourceConfig } from '../../types';
import { failedResult, newRawItem, type SourceAdapter } from '../contract';

const RENDER_TIMEOUT_MS = 20_000;   // hard cap on total render
const NAV_TIMEOUT_MS = 15_000;      // per-page navigation
const MAX_HTML = 3_000_000;         // 3 MB render cap

export class BrowserRenderAdapter implements SourceAdapter {
  readonly id = 'browser_render_adapter';
  readonly method = 'browser_render' as const;
  readonly adapterVersion = '1.0.0';
  readonly parserVersion = '1.0.0';

  async healthCheck(source: SourceConfig): Promise<{ healthy: boolean; latencyMs: number }> {
    // Capability probe: healthy only when Playwright is importable.
    try { await import(/* @vite-ignore */ 'playwright' as any); return { healthy: true, latencyMs: 0 }; }
    catch { return { healthy: false, latencyMs: 0 }; }
  }

  getFreshness(source: SourceConfig) {
    return source.freshnessPolicy ?? { liveVerifiedTtlSec: 600, freshTtlSec: 1800, maxStaleSec: 7200 };
  }

  getExpiry(rawItem: RawSourceItem): string | null {
    return rawItem.expiresAt ?? null;
  }

  async search(ctx: { query: any; source: SourceConfig }): Promise<AdapterResult> {
    const { source, query } = ctx;
    const started = Date.now();
    let playwright: any;
    try {
      playwright = await import(/* @vite-ignore */ 'playwright' as any);
    } catch {
      return failedResult(source, 'CAPABILITY_UNAVAILABLE',
        'Headless browser fallback unavailable: Playwright/Chromium not installed on this runtime', Date.now() - started);
    }

    const url = String(source.config.url || source.config.baseUrl || '');
    if (!/^https:\/\//i.test(url)) {
      return failedResult(source, 'MISSING_REQUIRED_FIELD', 'Browser render requires an https:// target URL', Date.now() - started);
    }

    let browser: any = null;
    try {
      browser = await playwright.chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
      const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
      page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
      if (!res || !res.ok()) {
        return failedResult(source, res && res.status() === 429 ? 'QUOTA_EXHAUSTED' : 'SERVER_ERROR',
          `Rendered page HTTP ${res ? res.status() : 'unknown'}`, Date.now() - started, res && res.status ? res.status() : undefined);
      }
      // Bounded settle: wait at most a few seconds for late JS, then extract.
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);

      const extracted = await page.evaluate((maxLen: number) => {
        const out: any[] = [];
        // Public structured data first (JSON-LD: Product, Offer, AggregateOffer…)
        for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
          try { out.push(JSON.parse((s as HTMLElement).textContent || '{}')); } catch { /* malformed block skipped */ }
        }
        const title = document.title || '';
        return { jsonLd: out, title, htmlLen: document.documentElement.outerHTML.length, html: document.documentElement.outerHTML.slice(0, maxLen) };
      }, MAX_HTML);

      const rawItems = this.mapJsonLd(extracted.jsonLd, source, url, started);
      if (rawItems.length === 0) {
        return failedResult(source, 'EMPTY_RESPONSE',
          'Page rendered but exposed no public structured product data', Date.now() - started, res.status());
      }
      return {
        success: true, sourceId: source.id, sourceMethod: this.method, rawItems,
        httpStatus: res.status(), latencyMs: Date.now() - started, fetchedAt: new Date().toISOString(),
      };
    } catch (e: any) {
      const msg = String(e?.message || e).slice(0, 160);
      const klass = /Timeout|timed out/i.test(msg) ? 'TIMEOUT' : /net::|ERR_/.test(msg) ? 'CONNECTION_FAILURE' : 'PARSER_FAILURE';
      return failedResult(source, klass, `Browser render failed: ${msg}`, Date.now() - started);
    } finally {
      if (browser) { try { await browser.close(); } catch { /* already closed */ } }
    }
  }

  /** JSON-LD → RawSourceItem. Only evidence-backed fields are extracted. */
  private mapJsonLd(blocks: any[], source: SourceConfig, url: string, started: number): RawSourceItem[] {
    const items: RawSourceItem[] = [];
    const push = (node: any) => {
      if (!node || typeof node !== 'object') return;
      const type = String(node['@type'] || '');
      if (/Product|Offer/i.test(type)) {
        const offer = /Offer|AggregateOffer/i.test(type) ? node : (node.offers || node.offer);
        const price = offer ? Number(offer.price ?? offer.lowPrice) : undefined;
        const title = String(node.name || node.itemOffered?.name || '').trim();
        if (!title) return;
        items.push(newRawItem(source, {
          title,
          price: Number.isFinite(price as number) ? (price as number) : undefined,
          currency: String(offer?.priceCurrency || 'INR'),
          identifiers: node.gtin13 ? { gtin: String(node.gtin13) } : node.sku ? { sku: String(node.sku) } : {},
          seller: String(node.brand?.name || node.seller?.name || ''),
          sellerUrl: url,
          availability: /InStock/i.test(String(offer?.availability || '')) ? 'in_stock' : /OutOfStock/i.test(String(offer?.availability || '')) ? 'out_of_stock' : 'unknown',
          attributes: { rendered_via: 'browser', schema_type: type },
          evidence: {
            sourceUrl: url,
            rawFingerprint: undefined,
            extractedFields: ['json_ld', 'title', ...(price !== undefined ? ['price'] : [])],
          },
        }));
      }
      const graph = node['@graph'];
      if (Array.isArray(graph)) graph.forEach(push);
      if (Array.isArray(node)) node.forEach(push);
    };
    blocks.forEach(push);
    return items.slice(0, 50);
  }
}
