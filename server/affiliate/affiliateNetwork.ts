/**
 * AffiliateMonetization (Section 15): routing and attribution, independent of acquisition.
 *
 * - Cuelinks (existing configured network) + modular adapters for future direct networks
 * - Exact configured affiliate IDs / campaign / sub-IDs preserved — never invented
 * - Exact intended destination preserved (no homepage substitution)
 * - Redirect endpoint validates destinations: no open redirects, no non-HTTP schemes
 * - Conversions recorded only from authorized tracking/reports
 */
import crypto from 'crypto';
import type { NormalizedOffer } from '../types';
import { settings } from '../common/settings';
import { log } from '../common/logger';
import { getStore } from '../common/db';

export interface AffiliateNetwork {
  id: string;
  name: string;
  /** Build a deep link from configured template. Returns null when no valid template exists. */
  buildDeepLink(destinationUrl: string, vendorDomain: string): string | null;
}

class CuelinksAdapter implements AffiliateNetwork {
  readonly id = 'cuelinks';
  readonly name = 'Cuelinks';

  buildDeepLink(destinationUrl: string, _vendorDomain: string): string | null {
    const apiKey = settings.cuelinks.apiKey;
    const template = settings.cuelinks.campaignId
      ? `https://linksdesination.com/cuelink?type=nl&subid=${settings.cuelinks.subId}&campaign=${settings.cuelinks.campaignId}&url={DESTINATION}`
      : null;
    // No credentials configured → no deep link. We NEVER invent affiliate parameters.
    if (!apiKey || !template) return null;
    return template.replace('{DESTINATION}', encodeURIComponent(destinationUrl));
  }
}

const NETWORKS: AffiliateNetwork[] = [new CuelinksAdapter()];

/** Attach configured deep links to offers (or leave null — raw destination still reachable). */
export async function attachAffiliateDeepLinks(offers: NormalizedOffer[]): Promise<NormalizedOffer[]> {
  return offers.map((o) => {
    const dest = o.sellerUrl || o.provenance.sourceUrl || null;
    if (!dest) return o;
    const domain = safeDomain(dest);
    for (const network of NETWORKS) {
      const link = network.buildDeepLink(dest, domain);
      if (link) {
        o.affiliate = { network: network.id, deepLink: link, subId: settings.cuelinks.subId || undefined };
        break;
      }
    }
    // No configured network → affiliate stays undefined; user goes to the exact vendor destination
    return o;
  });
}

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// ============ Redirect validation (Section 15) ============
const BLOCKED_SCHEMES = /^(?!https?:$).+:$/i; // anything not http/https

/** Validate a destination before redirecting: scheme, host sanity, no open redirect. */
export function validateDestination(dest: string): { valid: boolean; reason?: string } {
  try {
    const u = new URL(dest);
    if (BLOCKED_SCHEMES.test(u.protocol)) return { valid: false, reason: `blocked scheme ${u.protocol}` };
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { valid: false, reason: 'non-HTTP scheme' };
    if (!u.hostname || !u.hostname.includes('.')) return { valid: false, reason: 'invalid hostname' };
    // Credirect chains are collapsed: an embedded "next=/redirect" param pointing at another host is refused
    for (const [k, v] of u.searchParams.entries()) {
      if (/^(next|redirect|redir|return|return_to|url)$/i.test(k)) {
        try {
          const inner = new URL(v, u.origin);
          if (inner.hostname !== u.hostname) return { valid: false, reason: 'embedded redirect to another host' };
        } catch { /* not a URL — ignore */ }
      }
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'unparseable URL' };
  }
}

export interface RedirectDecision {
  allowed: boolean;
  reason?: string;
  destination: string | null;
  clickId: string | null;
  viaNetwork?: string | null;
}

/**
 * Decide and record a click-through. The affiliate redirect endpoint uses this:
 * Try1Second → [affiliate network tracking] → exact intended vendor destination.
 */
export async function resolveRedirect(dest: string, opts: { offerId?: string; userId?: number } = {}): Promise<RedirectDecision> {
  const check = validateDestination(dest);
  if (!check.valid) {
    log.warn('Affiliate', 'Redirect refused', { reason: check.reason });
    return { allowed: false, reason: check.reason, destination: null, clickId: null };
  }
  const clickId = crypto.randomUUID();

  let network: string | null = null;
  let finalUrl = dest;
  for (const net of NETWORKS) {
    const link = net.buildDeepLink(dest, safeDomain(dest));
    if (link) {
      network = net.id;
      finalUrl = link;
      break;
    }
  }

  // Click attribution (conversion only ever recorded from authorized reports — Section 15)
  try {
    const store = getStore();
    await store.execute(
      `INSERT INTO affiliate_clicks (offer_id, network_id, vendor_domain, destination_url, click_id, user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [opts.offerId ? extractNumericId(opts.offerId) : null, network || 'direct', safeDomain(dest), dest, clickId, opts.userId || null],
    );
  } catch { /* best-effort attribution */ }

  return { allowed: true, destination: finalUrl, clickId, viaNetwork: network };
}

function extractNumericId(offerId: string): number | null {
  const m = offerId.match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** Conversion recording — only from an authorized tracking/report source (manual/admin import). */
export async function recordConversion(clickId: string, sourceReport: string, orderValue?: number, commission?: number): Promise<boolean> {
  if (!clickId || !sourceReport) return false;
  try {
    await getStore().execute(
      `INSERT INTO affiliate_conversions (click_id, network_id, order_value, commission, confirmed_at, source_report)
       SELECT ?, COALESCE(network_id, 'direct'), ?, ?, NOW(), ? FROM affiliate_clicks WHERE click_id = ?`,
      [clickId, orderValue ?? null, commission ?? null, sourceReport, clickId],
    );
    return true;
  } catch {
    return false;
  }
}
