/**
 * Zepto SSR parser — zepto.com server-rendered rails (17 Oct 2026 breakthrough).
 *
 * zepto.com sits behind an AWS WAF "Goku" JS challenge. Once a valid aws-waf-token
 * cookie is minted (server/common/awsWafChallenge.ts — browserless jsdom PoW solver,
 * verified from the sandbox datacenter IP), these pages return HTTP 200 with REAL
 * priced product JSON embedded in the RSC/Next.js payload (double-escaped inside
 * JS strings, so we unescape first):
 *
 *   - https://www.zepto.com/                          homepage rails (~90 products, IP-city)
 *   - https://www.zepto.com/delivery-in-<city-slug>    city rails (68 cities; Indore verified)
 *   - https://www.zepto.com/brand/<brand-slug>        brand catalog (~45-60 products;
 *                                                     amul/nestle/britannia/dove verified)
 *
 * Search pages (/search?query=) are a client-side shell (no products in HTML) and the
 * bff/api gateways stay 429/202-gated, so the worker fetches rail/brand/city pages and
 * filters client-side — the same honest pattern as the Instamart worker.
 *
 * Verified product record shape (all prices in PAISE):
 *   ..."discountedSellingPrice":56800,...,"product":{"brand":"Surf Excel",...,"name":"...",
 *   "id":"<uuid>"...},"productVariant":{"formattedPacksize":"1 pack (5 kg)","id":"<pvid>",
 *   "images":[{"path":"cms/product_variant/<uuid>.jpeg",...}],"mrp":56800,"productId":...,
 *   ...,"availableQuantity":20...}
 * Image URL: https://cdn.zeptonow.com/production/<path>.
 * NO data is ever fabricated: only records with a real price are emitted.
 */

/** Undo the double-escaped JS-string layers Zepto's RSC payload uses. */
export function unescapeZeptoRsc(s: string): string {
  return s
    .replace(/\\\\u0026/g, '&')
    .replace(/\\\\"/g, '"')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

export interface ZeptoSsrProduct {
  brand: string;
  name: string;
  price: number; // rupees
  mrp?: number; // rupees
  pack?: string;
  image?: string;
  variantId?: string;
  availableQuantity?: number;
}

const IMG_CDN = 'https://cdn.zeptonow.com/production/';
const PACK_ANCHOR = '"productVariant":{"formattedPacksize"';

/**
 * Extract every product record from an unescaped SSR payload. Records are located via
 * their stable "productVariant":{"formattedPacksize" anchor; brand/name/price are read
 * from a bounded window around each anchor (the payload is not valid JSON as a whole).
 */
export function parseZeptoSsr(html: string, max = 400): ZeptoSsrProduct[] {
  const u = unescapeZeptoRsc(html);
  if (!u.includes(PACK_ANCHOR)) return [];
  const out: ZeptoSsrProduct[] = [];
  const seen = new Set<string>();
  let idx = u.indexOf(PACK_ANCHOR);
  while (idx !== -1 && out.length < max) {
    const back = u.slice(Math.max(0, idx - 4500), idx);
    const fwd = u.slice(idx, idx + 2200);
    // price: nearest discountedSellingPrice before the variant anchor (paise)
    let price: number | undefined;
    const pm = [...back.matchAll(/"discountedSellingPrice":(\d+)/g)].pop();
    if (pm) price = Number(pm[1]) / 100;
    // brand + name inside the preceding product block
    const bm = [...back.matchAll(/"brand":"([^"]{1,60})"/g)].pop();
    let name: string | undefined;
    if (bm) {
      const nm = back.slice(bm.index!).match(/"name":"([^"]{2,160})"/);
      if (nm) name = nm[1];
    }
    const pack = (fwd.match(/"formattedPacksize":"([^"]{0,80})"/) || [])[1];
    const vid = (fwd.match(/"id":"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/) || [])[1];
    const mrpRaw = (fwd.match(/"mrp":(\d+)/) || [])[1];
    // Zepto ships images in several shapes across rails: cms/... paths, bare
    // product_variant/... paths, plain imageUrl and absolute CDN urls. Missing the
    // non-cms shapes is why rows landed without a photo and the page showed
    // "No photo available" (owner 27 Oct).
    const imgRel = (fwd.match(/"path":"((?:cms\/)?[^"]{5,200}\.(?:jpe?g|png|webp))"/) || [])[1];
    const imgAbs = (fwd.match(/"(?:imageUrl|image_url|image)":"(https?:\/\/[^"]{5,240}\.(?:jpe?g|png|webp)[^"]*)"/) || [])[1];
    const imgPath = imgAbs || (imgRel ? IMG_CDN + imgRel : undefined);
    const availRaw = (fwd.match(/"availableQuantity":(\d+)/) || [])[1];
    if (price && price > 0 && price < 500000 && name && name.trim().length > 1) {
      const key = vid || `${brandName(bm)}|${name}|${price}`;
      if (!seen.has(key)) {
        seen.add(key);
        const mrp = mrpRaw ? Number(mrpRaw) / 100 : undefined;
        out.push({
          brand: brandName(bm),
          name: name.trim().slice(0, 140),
          price: Math.round(price * 100) / 100,
          mrp: mrp && mrp >= price ? Math.round(mrp * 100) / 100 : undefined,
          pack: pack ? pack.trim() : undefined,
          image: imgPath || undefined,
          variantId: vid,
          availableQuantity: availRaw !== undefined ? Number(availRaw) : undefined,
        });
      }
    }
    idx = u.indexOf(PACK_ANCHOR, idx + 1);
  }
  return out;
}

function brandName(m?: RegExpMatchArray | null): string {
  return m ? m[1] : '';
}

/** Query-token filter (plural-stem substring, same contract as the Instamart worker). */
export function zeptoSsrMatches(term: string, product: ZeptoSsrProduct): boolean {
  const tokens = term.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  if (!tokens.length) return true;
  const hay = `${product.brand} ${product.name} ${product.pack || ''}`.toLowerCase();
  return tokens.every((t) => hay.includes(t) || hay.includes(t.replace(/s$/, '')));
}
