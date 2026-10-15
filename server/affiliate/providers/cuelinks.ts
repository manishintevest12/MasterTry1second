/** CuelinksProvider — Monetization API v3 (developers.cuelinks.com, Oct 2026).
 *
 * Two layers, honestly separated:
 *  1. linkkit deeplinks (NO API key needed): linksredirect.com/?cid=<campaign>&
 *     subid=<publisherId>&url=<dest> — verified live: 302s to the exact merchant
 *     destination from any client. Serves the deeplink.ts merchant-campaign
 *     registry for /api/out redirects.
 *  2. Monetization API v3 (needs CUELINKS_API_KEY from the publisher dashboard,
 *     scopes read:campaigns + read:offers + write:links):
 *     - GET  /campaigns  → campaign discovery (auto-cid per merchant domain)
 *     - GET  /offers     → live coupons/deals (MakeMyTrip hotels+flights offers
 *                          land in the deals registry as real, tracked offers)
 *     - POST /links/convert → channel-attributed tracking links
 * Auth is a static token: Authorization: Token <key> on every request.
 */
import { settings } from '../../common/settings';
import { BaseAffiliateProvider } from '../baseProvider';
import type { ProviderFetchResult, UnifiedAffiliateOffer } from '../types';

export class CuelinksProvider extends BaseAffiliateProvider {
  readonly id = 'cuelinks' as const;
  readonly label = 'Cuelinks';
  private campaignsCache: any[] = [];
  private cacheAt = 0;
  private static readonly TTL_MS = 30 * 60 * 1000;

  isConfigured(): boolean { return Boolean(settings.cuelinks?.apiKey); }

  /** Static token auth (v3): valid whenever the key is present. */
  tokenValid(): boolean { return this.isConfigured() && Date.now() - this.cacheAt < CuelinksProvider.TTL_MS; }

  async authenticate(): Promise<void> { /* static token — nothing to exchange */ }

  private async api(path: string, init?: RequestInit): Promise<any> {
    const res = await fetch(`${settings.cuelinks.apiBase}${path}`, {
      ...init,
      headers: { Authorization: `Token ${settings.cuelinks.apiKey}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
    if (!res.ok) throw new Error(`cuelinks: ${path} HTTP ${res.status}`);
    return res.json();
  }

  /** Live coupons/deals across joined campaigns. Paginates a few pages; every
   *  offer carries the publisher's own tracking_url (channel embedded). */
  async fetchOffers(opts: { pages?: number } = {}): Promise<ProviderFetchResult> {
    if (!this.isConfigured()) return this.unconfigured();
    const maxPages = Math.min(Math.max(opts.pages ?? 3, 1), 10);
    const offers: UnifiedAffiliateOffer[] = [];
    const warnings: string[] = [];
    try {
      for (let page = 1; page <= maxPages; page++) {
        const j = await this.api(`/offers?per_page=200&page=${page}`);
        const rows = Array.isArray(j?.data) ? j.data : [];
        for (const o of rows) offers.push(this.normalize(o));
        if (!j?.meta?.next_page) break;
      }
      this.cacheAt = Date.now();
    } catch (e: any) {
      warnings.push(`cuelinks: offers fetch failed (${e?.message || 'error'})`);
    }
    return { offers, count: offers.length, warnings };
  }

  normalize(o: any): UnifiedAffiliateOffer {
    // Verified v3 shape: id, title, description, terms, coupon_code, offer_type,
    // campaign_id, campaign_name, categories[{id,name}], tracking_url, status,
    // start_date, end_date, original_price, discount_price, percent_off
    const pct = Number.isFinite(Number(o?.percent_off)) ? Number(o.percent_off) : null;
    return {
      network_source: 'cuelinks',
      network_offer_id: String(o?.id ?? ''),
      merchant_name: String(o?.campaign_name || 'Cuelinks merchant').slice(0, 255),
      merchant_logo: null,
      title: String(o?.title || '').slice(0, 500),
      description: o?.description ? String(o.description).replace(/<[^>]*>/g, '').slice(0, 2000) : null,
      coupon_code: o?.coupon_code ? String(o.coupon_code) : null,
      discount_value: pct,
      discount_type: pct != null ? 'percentage' : 'other',
      affiliate_url: o?.tracking_url ? String(o.tracking_url) : null,
      original_url: null,
      categories: (Array.isArray(o?.categories) ? o.categories : []).map((c: any) => String(c?.name || '').toLowerCase()).filter(Boolean),
      starts_at: o?.start_date ? new Date(String(o.start_date)) : null,
      expires_at: o?.end_date ? new Date(String(o.end_date)) : null,
      status: o?.status === 'live' ? 'active' : 'paused',
      commission: null,
      commission_note: null,
      raw: { offer_type: o?.offer_type || null, campaign_id: o?.campaign_id ?? null, terms: o?.terms ? String(o.terms).slice(0, 500) : null },
    };
  }

  /** Campaign discovery: id, name, access_status, domains — feeds the deeplink
   *  registry with per-merchant cids (incl. future MMT vertical campaigns). */
  async fetchCampaigns(): Promise<Array<Record<string, unknown>>> {
    if (!this.isConfigured()) return [];
    const out: Array<Record<string, unknown>> = [];
    for (let page = 1; page <= 3; page++) {
      const j = await this.api(`/campaigns?per_page=200&page=${page}`);
      const rows = Array.isArray(j?.data) ? j.data : [];
      out.push(...rows);
      if (!j?.meta?.next_page) break;
    }
    this.campaignsCache = out;
    return out;
  }

  /** Channel-attributed tracking link via the official convert endpoint.
   *  Fallback (no key): the verified linkkit format with publisher subid. */
  async generateTrackingLink(targetUrl: string, subId?: string): Promise<string> {
    if (this.isConfigured()) {
      const j = await this.api(`/links/convert`, { method: 'POST', body: JSON.stringify({ url: targetUrl, ...(subId ? { subid: subId } : {}) }) });
      const d = j?.data;
      if (d?.tracking_url) {
        if (d.affiliated === false) return targetUrl; // not joined/inactive — never send users through a dead hop
        return String(d.tracking_url);
      }
    }
    const c = settings.cuelinks;
    if (c.publisherId) {
      return `https://linksredirect.com/?cid=${encodeURIComponent(c.campaignId || '')}&subid=${encodeURIComponent(c.publisherId)}&url=${encodeURIComponent(targetUrl)}`;
    }
    return targetUrl;
  }
}
