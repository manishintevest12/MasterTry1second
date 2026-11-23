/**
 * Photos for ONE related-product row on the product page.
 *
 * OWNER 23 Nov (screenshots of the Product Page): "jb mai product ka link daal raha hoon tho related products mai
 * jiska link copy kiya hoon ussi ka image sb mai aa raha hai jb ki usme uss product se related aana chaiye tha jaise
 * pp ke liye uss oppo mobile ka image".
 *
 * MEASURED root cause: the row builder appended the SEARCHED product's own gallery (`productImageUrls`) to every
 * related row's photo list. A row that carried its own photo was unaffected (its own photo stayed first), but the
 * moment a related row had no photo of its own — the common case for a borrowed catalogue row — the searched
 * product's photo became `imgs[0]` and the whole grid painted one repeated image: twelve different titles, all
 * showing the shoe from the link the owner pasted.
 *
 * So this helper reads ONLY the row's own photo, under every spelling the parsers use. A row with no photo returns
 * an empty list, and the caller borrows a photo of the SAME TITLE from the catalogue (or drops the row) — never the
 * parent product's picture.
 */

/** Every honest spelling of a row's own product photo, first real https URL first. */
export function rowPhotos(o: Record<string, any> | undefined | null): string[] {
  if (!o) return [];
  const attrs = (o.attributes && typeof o.attributes === 'object') ? o.attributes : {};
  const candidates: any[] = [
    attrs.image_url,
    attrs.image,
    o.image,
    o.imageUrl,
    o.thumbnail,
    o.thumbnail_url,
    Array.isArray(o.images) ? o.images[0] : undefined,
  ];
  const first = candidates.map((u) => (typeof u === 'string' ? u : '')).find((u) => u.startsWith('https://')) || '';
  const gallery = String(attrs.image_urls || attrs.images || '')
    .split('|')
    .map((u) => u.trim())
    .filter((u) => u.startsWith('https://'));
  return Array.from(new Set([first, ...gallery].filter((u) => u.startsWith('https://'))));
}

/** The one photo a related card shows, or null when the row genuinely has none of its own. */
export function rowPhoto(o: Record<string, any> | undefined | null): string | null {
  const photos = rowPhotos(o);
  return photos.length ? photos[0] : null;
}
