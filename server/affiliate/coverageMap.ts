/**
 * Per-merchant "which affiliate ID will actually fire" (owner 27 Oct: "jisme affiliate
 * id hai wo v dikhenge admin mai").
 *
 * The Affiliate IDs panel used to list only the merchants the owner had typed something
 * for, so partnerships that ALREADY earn — our Amazon Associates tag, the Cuelinks
 * publisher id, a LinkInR campaign, Ekaro conversion — were invisible in the per-merchant
 * rows. This module resolves the same precedence buildSecureDeeplink() uses, entirely
 * from local data (no network, no fabricated coverage):
 *
 *   1. manual affiliate_configs template
 *   2. Amazon Associates store tag
 *   3. Cuelinks known-merchant campaign (publisher id)
 *   4. LinkInR campaign registry
 *   5. Ekaro converter (only attempt-at-click; converts EarnKaro-catalogue merchants only)
 *   6. AdSense (merchant marked monetization='adsense')
 *   7. direct (nothing configured yet — honest hop)
 */
import { settings } from '../common/settings';
import { linkinrCampaignList } from './linkinr';
import { ekaroStats } from './ekaro';

export type CoverageSource = 'affiliate_configs' | 'amazon_associates' | 'cuelinks' | 'linkinr' | 'ekaro' | 'adsense' | 'direct';

const AMAZON_DOMAINS = /(^|\.)(amazon\.(?:in|com|co\.uk|de|ca|fr|it|es|nl|sg|ae|com\.au|com\.br|com\.mx|jp|co\.jp)|amzn\.to)$/i;

/** Nothing secret leaves the admin list: only the tail of an id is shown. */
export function maskId(id: string | null | undefined): string {
  const v = String(id || '').trim();
  if (!v) return '';
  if (v.length <= 4) return '••••';
  return `${'•'.repeat(Math.min(8, v.length - 4))}${v.slice(-4)}`;
}

/** The id embedded in a manual template (…pub_id=123&… or …affid=xxx…). */
function idFromTemplate(template: string | null | undefined): string {
  const t = String(template || '');
  // Priority order matters: 'cid' is usually the MERCHANT campaign, not our account id,
  // so it is checked last (owner 27 Oct — the panel must show OUR id first).
  for (const key of ['pub_id', 'affid', 'aff_id', 'aff', 'tag', 'pid', 'id', 'cid']) {
    const m = t.match(new RegExp(`[?&]${key}=([^&]+)`, 'i'));
    if (m) {
      const v = decodeURIComponent(m[1]);
      if (v.length >= 3) return v;
    }
  }
  return '';
}

let cuelinksSet: Set<string> | null = null;
async function cuelinksMerchantSet(): Promise<Set<string>> {
  if (cuelinksSet) return cuelinksSet;
  const out = new Set<string>();
  try {
    const mod: any = await import('./deeplink');
    // The set lives in deeplink's module scope; probe it with a harmless URL per
    // merchant when a public accessor is unavailable.
    if (typeof mod.cuelinksKnownMerchants === 'function') {
      for (const d of mod.cuelinksKnownMerchants() as string[]) out.add(String(d).toLowerCase());
    }
  } catch { /* older build: fall back to probe below */ }
  cuelinksSet = out;
  return out;
}

export interface EffectiveRow {
  slug: string;
  effective_source: CoverageSource;
  effective_id_masked: string;
  effective_label: string;
}

export async function resolveEffective(rows: { slug: string; company_domain: string; template?: string | null; affiliate_id?: string | null; monetization?: string | null }[]): Promise<EffectiveRow[]> {
  const amzTag = String(settings.amazonAssociates?.tag || '');
  const cuelinksPub = String(settings.cuelinks?.publisherId || '');
  const cuelinksOn = Boolean(settings.cuelinks?.enabled);
  const ekaroOn = ekaroStats().enabled;
  const linkinrOn = linkinrCampaignList().length > 0;
  const linkinrDomains = new Map<string, string>();
  for (const c of linkinrCampaignList()) linkinrDomains.set(String(c.domain || '').toLowerCase(), c.name || '');
  const cueSet = await cuelinksMerchantSet();

  return rows.map((r) => {
    const domain = String(r.company_domain || '').toLowerCase().replace(/^www\./, '');
    if (r.template) {
      const id = String(r.affiliate_id || '') || idFromTemplate(r.template);
      return { slug: r.slug, effective_source: 'affiliate_configs' as CoverageSource, effective_id_masked: maskId(id), effective_label: `Manual template${id ? '' : ' (no id in URL)'}` };
    }
    if (AMAZON_DOMAINS.test(domain) && amzTag) {
      return { slug: r.slug, effective_source: 'amazon_associates' as CoverageSource, effective_id_masked: maskId(amzTag), effective_label: 'Amazon Associates tag' };
    }
    if (cuelinksOn && cuelinksPub && (cueSet.size === 0 || cueSet.has(domain))) {
      return { slug: r.slug, effective_source: 'cuelinks' as CoverageSource, effective_id_masked: maskId(cuelinksPub), effective_label: 'Cuelinks publisher' };
    }
    if (linkinrOn && linkinrDomains.has(domain)) {
      return { slug: r.slug, effective_source: 'linkinr' as CoverageSource, effective_id_masked: maskId(linkinrDomains.get(domain) || ''), effective_label: `LinkInR: ${linkinrDomains.get(domain)}` };
    }
    if (String(r.monetization || '').toLowerCase() === 'adsense') {
      return { slug: r.slug, effective_source: 'adsense' as CoverageSource, effective_id_masked: '', effective_label: 'AdSense (no affiliate program)' };
    }
    if (ekaroOn) {
      return { slug: r.slug, effective_source: 'ekaro' as CoverageSource, effective_id_masked: '', effective_label: 'Ekaro attempt at click' };
    }
    return { slug: r.slug, effective_source: 'direct' as CoverageSource, effective_id_masked: '', effective_label: 'Direct hop (no affiliate yet)' };
  });
}
