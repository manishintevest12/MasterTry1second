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

/** A built-in entry is product-specific, so it only applies to a matching destination surface. */
const BUILTIN_CONTEXT: Record<string, RegExp> = {
  // the Axis link the owner pasted is a CREDIT CARD application; an Axis loan/account row must not use it
  axis: /card|credit|cc[-_/]|apply/i,
  axisbank: /card|credit|cc[-_/]|apply/i,
  axisbankcreditcard: /card|credit|cc[-_/]|apply/i,
};

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
export function gromoLinkMap(): Record<string, string> {
  return { ...BUILTIN_LINKS, ...envLinks() };
}

/** True when this host is a banking/insurance surface the default GroMo link may serve. */
export function isFinanceDomain(domain: string): boolean {
  const d = String(domain || '').toLowerCase().replace(/^www\./, '');
  return FINANCE_DOMAINS.some((f) => d === f || d.endsWith(`.${f}`));
}

/**
 * Resolve the GroMo advisor link for a merchant, or null.
 * Order: every spelling variant of the merchant key, then the finance-only default link.
 * A non-finance domain NEVER gets the default, so travel/ecommerce exits are untouched.
 */
export function gromoLinkFor(merchant: string, domain = '', targetUrl = ''): string | null {
  const map = gromoLinkMap();
  const envKeys = envLinks();
  for (const v of keyVariants(merchant)) {
    const hit = map[v];
    if (!hit || !isGromoUrl(hit)) continue;
    const ctx = BUILTIN_CONTEXT[v];
    // A built-in product link is only for its own product. The owner's own env/admin mapping is trusted as
    // given, because they are the ones who know which product that code belongs to.
    if (ctx && !envKeys[v] && targetUrl && !ctx.test(targetUrl)) continue;
    return hit;
  }
  const defaultLink = (process.env.GROMO_DEFAULT_LINK || '').trim();
  if (defaultLink && isGromoUrl(defaultLink) && isFinanceDomain(domain)) return defaultLink;
  return null;
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
export function gromoCoverage(): { keys: string[]; defaultConfigured: boolean; financeDomains: number } {
  return {
    keys: Object.keys(gromoLinkMap()).sort(),
    defaultConfigured: Boolean((process.env.GROMO_DEFAULT_LINK || '').trim()),
    financeDomains: FINANCE_DOMAINS.length,
  };
}
