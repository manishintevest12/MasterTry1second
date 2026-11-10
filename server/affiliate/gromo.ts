/**
 * OWNER 10 Nov: "Issued by Axis Bank ... Apply Now: sales.gromo.in/ac/CCiv1ofkx2, gromo humera partner
 * hai wo pura banking products deta hai pr waha aise link milta hai."
 *
 * GroMo (sales.gromo.in) is a certified financial-advisor platform: the owner is an advisor there, so
 * every banking product (credit cards, loans, savings accounts, insurance) has its OWN advisor link in the
 * shape https://sales.gromo.in/ac/<CODE>. Measured 10 Nov: that link answers 200 HTML from
 * sales.gromo.in (a React app), i.e. it is a LANDING link for one product, not a carrier that can hold
 * {DESTINATION}. So it is deliberately kept out of the env-template networks (which must carry the deep
 * path) and gets its own small resolver here.
 *
 * Consequences that matter for honesty:
 *  - A GroMo exit does NOT preserve the issuer's deep URL (the click lands on GroMo's product page). For a
 *    "Apply Now" finance row that is exactly what we want, because that page is the tracked application.
 *  - One code = one product. There is no self-serve code generation from our side, so the map is data:
 *    GROMO_LINKS (JSON, merchant key -> link) + an optional GROMO_DEFAULT_LINK for unmapped finance
 *    merchants. Admin affiliate_configs still wins above this layer, because it is the manual override.
 */

/** Domains that are genuinely banking/insurance surfaces. The default link only applies here. */
const FINANCE_DOMAINS = [
  'axisbank.com', 'hdfcbank.com', 'icicibank.com', 'kotak.com', 'kotak811.com', 'sbi.co.in', 'sbicard.com',
  'idfcfirstbank.com', 'federalbank.co.in', 'aubank.in', 'indusind.com', 'yesbank.in', 'rblbank.com',
  'bobcard.co.in', 'bobfinancial.com', 'hsbc.co.in', 'sc.com', 'americanexpress.com', 'amexindia.com',
  'citibank.co.in', 'bandhanbank.com', 'equitas.bank.in', 'ujjivansfb.in', 'bajajfinserv.in',
  'tatacapital.com', 'hdfcergo.com', 'icicilombard.com', 'godigit.com', 'acko.com', 'zurichkotak.com',
  'policybazaar.com', 'paisabazaar.com', 'bankbazaar.com', 'coverfox.com', 'insurancedekho.com',
  'cardinsider.com', 'kredit.pe', 'kreditbee.in', 'moneyview.in', 'navi.com', 'groww.in', 'zerodha.com',
];

/** The owner's own GroMo advisor link for the Axis Bank credit card (given 10 Nov). Env overrides it. */
const BUILTIN_LINKS: Record<string, string> = {
  axis: 'https://sales.gromo.in/ac/CCiv1ofkx2',
  axisbank: 'https://sales.gromo.in/ac/CCiv1ofkx2',
  axisbankcreditcard: 'https://sales.gromo.in/ac/CCiv1ofkx2',
};

/**
 * OWNER 10 Nov (second message): "gromo ke saare products add kr do, wahi link jo diya tha - ussi mein mera
 * id hint hai". The code in https://sales.gromo.in/ac/CCiv1ofkx2 is his ADVISOR code, not a one-product code:
 * the GroMo landing resolves the advisor and offers the products from there. Measured: the same URL answers
 * 200 with an identical 6.7KB app shell for a valid and an invalid code, so the code is resolved client-side
 * and no product list can be enumerated server-side - one advisor link therefore serves every GroMo product.
 */
const BUILTIN_ADVISOR_LINK = 'https://sales.gromo.in/ac/CCiv1ofkx2';

/** A lead aggregator is a competitor, not a GroMo product: its row keeps its own (already paying) route. */
const AGGREGATOR_DOMAINS = [
  'policybazaar.com', 'paisabazaar.com', 'bankbazaar.com', 'coverfox.com', 'insurancedekho.com',
  'cardinsider.com', 'kredit.pe', 'creditmantri.com', 'getditto.com', 'emergencypaisa.com',
];

/**
 * The advisor link is product-agnostic now, so there is no destination-context gate any more: a GroMo landing
 * page offers the product list and the visitor picks the one they came for. What stays gated is the DOMAIN
 * family - only real issuers/banks/insurers/brokers get the advisor link, never a lead aggregator or a travel
 * merchant, so a competitor's row and every non-finance exit keep their own paying route.
 */

/** Merchant key -> extra spelling variants, so 'Axis Bank Credit Card' and 'axisbank.com' agree. */
function keyVariants(key: string): string[] {
  const raw = String(key || '').toLowerCase();
  const compact = raw.replace(/[^a-z0-9]/g, '');
  const words = raw.replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const out = new Set<string>([compact]);
  if (words[0]) out.add(words[0].replace(/[^a-z0-9]/g, ''));
  // 'axisbankcreditcard' -> 'axisbank', 'hdfcbankcreditcard' -> 'hdfcbank'
  for (const suffix of ['creditcard', 'creditcards', 'card', 'cards', 'bank', 'loan', 'insurance']) {
    if (compact.endsWith(suffix) && compact.length > suffix.length + 2) {
      out.add(compact.slice(0, -suffix.length));
    }
  }
  return [...out].filter(Boolean);
}

export function isGromoUrl(url: string): boolean {
  try {
    const u = new URL(String(url || ''));
    if (u.protocol !== 'https:') return false;
    return u.hostname.toLowerCase() === 'sales.gromo.in' || /(^|\.)gromo\.in$/i.test(u.hostname);
  } catch { return false; }
}

/** Env map: GROMO_LINKS='{"axis":"https://sales.gromo.in/ac/CODE", ...}' (invalid entries ignored). */
function envLinks(): Record<string, string> {
  const raw = (process.env.GROMO_LINKS || '').trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed || {})) {
      if (typeof v === 'string' && isGromoUrl(v)) out[String(k).toLowerCase()] = v;
    }
    return out;
  } catch { return {}; }
}

/** Every usable GroMo link, built-in defaults first then env overrides. */
export function gromoAdvisorLink(): string {
  // An override is only used when it is a real https GroMo link; otherwise the built-in advisor code stands,
  // because a typo in hPanel must never turn every banking exit into a dead link.
  const override = (process.env.GROMO_ADVISOR_LINK || process.env.GROMO_DEFAULT_LINK || '').trim();
  if (override && isGromoUrl(override)) return override;
  return BUILTIN_ADVISOR_LINK;
}

export function gromoLinkMap(): Record<string, string> {
  const map = { ...envLinks() };
  const advisor = gromoAdvisorLink();
  // The advisor link is the default for every finance-family domain (reported, not duplicated per merchant).
  if (advisor) map.advisor = advisor;
  return map;
}

/** True when this host is a banking/insurance surface the default GroMo link may serve. */
export function isFinanceDomain(domain: string): boolean {
  const d = String(domain || '').toLowerCase().replace(/^www\./, '');
  if (FINANCE_DOMAINS.some((f) => d === f || d.endsWith(`.${f}`))) return true;
  // Banks also run on the newer .bank.in domain (hdfc.bank.in, axis.bank.in, idfcfirst.bank.in, au.bank.in).
  // A sub-brand host therefore counts as a bank even when only the .com domain is in the list above.
  return /(^|\.)bank\.in$/.test(d);
}

/**
 * Resolve the GroMo advisor link for a merchant, or null.
 * Order: every spelling variant of the merchant key, then the finance-only default link.
 * A non-finance domain NEVER gets the default, so travel/ecommerce exits are untouched.
 */
/** Domains the owner wants paid by their own network instead of GroMo (env GROMO_SKIP_DOMAINS, comma list). */
function skippedDomain(domain: string): boolean {
  const d = String(domain || '').toLowerCase().replace(/^www\./, '');
  if (!d) return false;
  return (process.env.GROMO_SKIP_DOMAINS || '')
    .split(',')
    .map((x) => x.trim().toLowerCase().replace(/^www\./, ''))
    .filter(Boolean)
    .some((skip) => d === skip || d.endsWith(`.${skip}`));
}

export function gromoLinkFor(merchant: string, domain = '', _targetUrl = ''): string | null {
  const d = String(domain || '').toLowerCase().replace(/^www\./, '');
  // An issuer the owner pinned back to its own paying campaign is never taken by GroMo.
  if (skippedDomain(d)) return null;
  // 1. an explicit per-merchant code (env GROMO_LINKS / built-in pins) always wins
  const map = gromoLinkMap();
  for (const v of keyVariants(merchant)) {
    const hit = map[v];
    if (hit && isGromoUrl(hit)) return hit;
  }
  // 2. the owner's advisor link, which covers every GroMo product, on finance-family domains only
  if (isAggregatorDomain(d) || !isFinanceDomain(d)) return null;
  return gromoAdvisorLink();
}

/** True when this host is a lead aggregator (competitor), so GroMo must not take its row. */
export function isAggregatorDomain(domain: string): boolean {
  const d = String(domain || '').toLowerCase().replace(/^www\./, '');
  return AGGREGATOR_DOMAINS.some((a) => d === a || d.endsWith(`.${a}`));
}

/**
 * Attribution hint appended to a GroMo click, when the owner has set one.
 * GroMo links already carry the advisor code; an extra parameter is only added when the owner supplies
 * the exact one their dashboard expects (GROMO_SUBID_PARAM, e.g. 'utm_source'), never invented here.
 */
export function gromoClickUrl(link: string, subid = ''): string {
  if (!isGromoUrl(link)) return '';
  const param = (process.env.GROMO_SUBID_PARAM || '').trim();
  if (!param || !subid) return link;
  try {
    const u = new URL(link);
    u.searchParams.set(param, subid);
    return u.toString();
  } catch { return link; }
}

/** Which finance merchants currently have a GroMo link - for the admin affiliate view. */
export function gromoCoverage(): { keys: string[]; advisorLink: string; defaultConfigured: boolean; financeDomains: number } {
  return {
    keys: Object.keys(gromoLinkMap()).sort(),
    advisorLink: gromoAdvisorLink(),
    defaultConfigured: Boolean(gromoAdvisorLink()),
    financeDomains: FINANCE_DOMAINS.length,
  };
}
