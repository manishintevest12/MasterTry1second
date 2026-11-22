/**
 * Per-vertical partner exclusions (owner 21 Nov: "digihaat.in ko aap food delivery, 10 min grocery se hata do").
 *
 * This is a VERTICAL SCOPE rule, not a partner ban: DigiHaat (digihaat.in) stays a partner for e-commerce, where it
 * has its own worker. The owner does not want it offered on Food Delivery or 10-Min Grocery, so:
 *   - its grocery and food workers are gone (no new rows can be acquired for those verticals), and
 *   - this list is enforced at the response choke point and in the catalogue lookup, so rows that were already
 *     written to the catalogue before the change cannot leak back into either feed (cached catalogue rows, last
 *     known good snapshots, response cache replays).
 *
 * Matching is on the merchant name/vendor/seller text and the source id, lowercased. Keep the entries narrow: one
 * brand per vertical, so an unrelated merchant whose name merely contains "haat" is never caught.
 */

/** Lowercased merchant tokens that must never appear in a vertical's feed. */
const EXCLUSIONS: Record<string, string[]> = {
  grocery: ['digihaat', 'digi haat'],
  food: ['digihaat', 'digi haat'],
};

/** Merchant tokens excluded from this vertical (empty array = nothing excluded). */
export function excludedMerchantsFor(vertical: string | undefined | null): string[] {
  const v = String(vertical || '').toLowerCase();
  return EXCLUSIONS[v] || [];
}

/** True when this text names an excluded merchant for the vertical. */
export function isExcludedMerchant(vertical: string | undefined | null, ...texts: Array<string | undefined | null>): boolean {
  const tokens = excludedMerchantsFor(vertical);
  if (!tokens.length) return false;
  const hay = texts.filter(Boolean).map((t) => String(t).toLowerCase()).join(' ');
  if (!hay) return false;
  return tokens.some((t) => hay.includes(t));
}

/**
 * Every text a row can carry the merchant's name in. OWNER 22 Nov ("digihaat.in ... abhi v 10 min grocery mai aa raha
 * hai"): the first version only read the top-level vendor/seller/site/provider fields, so a row whose merchant name
 * lived in its TITLE ("Milk 500 ml - DigiHaat"), in its URL, or in a per-seller quote survived the filter and showed
 * up in the feed. All of them are checked now.
 */
function merchantTexts(o: Record<string, any> | undefined | null): Array<string | undefined | null> {
  if (!o) return [];
  const quotes: any[] = Array.isArray(o.sellerQuotes) ? o.sellerQuotes : Array.isArray(o.quotes) ? o.quotes : [];
  return [
    o.vendor,
    o.seller,
    o.site,
    o.provider,
    o.merchant,
    o.sourceId,
    o.source_id,
    o.title,
    o.url,
    o.exitUrl,
    ...quotes.flatMap((q) => [q?.sellerName, q?.seller, q?.provider, q?.site]),
  ];
}

/** Drop offers naming an excluded merchant for the vertical. Never re-prices or re-ranks what survives. */
export function dropExcludedOffers<T extends Record<string, any>>(vertical: string | undefined | null, offers: T[]): T[] {
  if (!offers?.length) return offers || [];
  if (!excludedMerchantsFor(vertical).length) return offers;
  return offers.filter((o) => !isExcludedMerchant(vertical, ...merchantTexts(o)));
}
