/**
 * Meesho affiliate wrapper.
 *
 * OWNER 5 Nov: "yes i signed on meesho with affiliate and i used my number +91 9905846149".
 *
 * WHAT THE AFFILIATE PORTAL ACTUALLY OFFERS (measured, not assumed): affiliate.meesho.com is a
 * CREATOR portal - its API map (read out of the live bundle) is auth/otp, Instagram/auto-DM,
 * collection-links, product-benefits, payouts and milestones. There is NO product-search or
 * catalogue endpoint and no public price feed, so the affiliate account alone cannot supply Meesho
 * ROWS. What it CAN do, reliably, is monetise the EXITS we already build
 * (meesho.com/search?q=..., product pages) once its tracking shape is known.
 *
 * So this module is the wrapping point: paste the portal's own copied link (or the onelink
 * template) into MEESHO_AFFILIATE_LINK_TEMPLATE with {url} where the destination belongs, and every
 * Meesho exit in every vertical starts carrying the affiliate id. Nothing is guessed: with no
 * template configured the destination is returned untouched, so exits behave exactly as today.
 */
const template = (): string => String(process.env.MEESHO_AFFILIATE_LINK_TEMPLATE || '').trim();

/** Query params to append when the operator supplies them (e.g. "sub_id=try1second&utm_source=t1s"). */
const extraParams = (): string => String(process.env.MEESHO_AFFILIATE_PARAMS || '').trim();

export function isMeeshoAffiliateConfigured(): boolean {
  return template().length > 0 || extraParams().length > 0;
}

/**
 * Wrap a Meesho destination with the affiliate template.
 *  - `{url}` (raw) and `{urlEncoded}` are replaced with the destination.
 *  - A template with no placeholder gets the destination appended as its `url` parameter, which is
 *    the shape most short-link services use (`https://bitli.in/XXXX?url=...`).
 *  - Invalid/unsafe templates (not https, no host) are ignored: a broken affiliate config must never
 *    break a working exit.
 */
export function meeshoAffiliateUrl(destination: string): string {
  const dest = String(destination || '');
  if (!dest) return dest;
  const tpl = template();
  if (tpl) {
    try {
      const parsed = new URL(tpl.replace('{urlEncoded}', encodeURIComponent(dest)).replace('{url}', dest));
      if (parsed.protocol !== 'https:') return appendParams(dest);
      if (tpl.includes('{url}') || tpl.includes('{urlEncoded}')) return parsed.toString();
      parsed.searchParams.set('url', dest);
      return parsed.toString();
    } catch {
      return appendParams(dest); // malformed template: fall back, never throw
    }
  }
  return appendParams(dest);
}

function appendParams(dest: string): string {
  const extra = extraParams();
  if (!extra) return dest;
  try {
    const u = new URL(dest);
    for (const pair of extra.split('&')) {
      const [k, v] = pair.split('=');
      if (k) u.searchParams.set(k.trim(), (v ?? '').trim());
    }
    return u.toString();
  } catch {
    return dest;
  }
}
