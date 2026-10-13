/**
 * Pizza Hut India parser. https://www.pizzahut.co.in/menu/pizzas is a Next.js
 * SSR page: __NEXT_DATA__.props.pageProps.itemsByKind[].products[] carries
 * title, desc, size, crust, img and — for most items — a real rupee `price`
 * (some customisable variants carry null and are skipped).
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

interface HutProduct {
  id?: string;
  type?: string;
  title?: string;
  desc?: string;
  size?: string;
  crust?: string;
  img?: string;
  price?: number | null;
  veg?: boolean;
  popular?: boolean;
  new?: boolean;
}

const PIZZAISH = /pizza|margherita|farmhouse|paneer|veggie|cheese|bbq|schezwan|chilli|habanero|nashville|korean|onion|corn|peppy|chicken|sausage|taco|hut/i;

function sizeLabel(p: HutProduct): string {
  const parts: string[] = [];
  if (p.size && p.size !== 'medium') parts.push(String(p.size));
  if (p.crust) parts.push(String(p.crust).split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
  return parts.join(', ');
}

export function pizzaHutItems(rawBody: string, source: SourceConfig, query: string, pageUrl: string): RawSourceItem[] {
  const m = rawBody.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  let root: any;
  try { root = JSON.parse(m[1]); } catch { return []; }
  const kinds: any[] = root?.props?.pageProps?.itemsByKind || [];
  const products: HutProduct[] = [];
  const seen = new Set<string>();
  for (const kind of kinds) {
    for (const p of kind?.products || []) {
      const title = String(p?.title || '').trim();
      const price = Number(p?.price);
      if (!title || !Number.isFinite(price) || price <= 0) continue;
      const key = `${title}|${p.size || ''}|${price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      products.push(p);
    }
  }

  const q = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = q.split(' ').filter((w) => w.length > 2 && !['the', 'and', 'for', 'with', 'order', 'buy', 'price'].includes(w));
  const scored = products
    .map((p) => {
      const hay = `${p.title} ${p.desc || ''} ${p.type || ''} ${sizeLabel(p)}`.toLowerCase();
      let score = 0;
      for (const w of words) if (hay.includes(w)) score += 1;
      if (q && hay.includes(q)) score += 3;
      if (p.popular) score += 0.5;
      return { p, score };
    })
    .filter((x) => x.score >= 1)
    .sort((a, b) => b.score - a.score || (a.p.price || 0) - (b.p.price || 0));

  let top = scored.slice(0, 12).map((x) => x.p);
  if (!top.length && PIZZAISH.test(q)) {
    // generic pizza-ish query: their popular/new items, honestly labelled
    top = products.filter((p) => p.popular || p.new).slice(0, 8);
    if (!top.length) top = products.slice(0, 8);
  }
  if (!top.length) return [];

  const items: RawSourceItem[] = [];
  for (const p of top) {
    const size = sizeLabel(p);
    items.push(newRawItem(source, {
      title: `Pizza Hut ${p.title}${size ? ` (${size})` : ''}`.slice(0, 200),
      brand: 'Pizza Hut',
      price: Number(p.price),
      currency: 'INR',
      seller: 'Pizza Hut India',
      sellerUrl: 'https://www.pizzahut.co.in/menu/pizzas',
      attributes: {
        dish: p.title || '',
        size: p.size || '',
        crust: p.crust || '',
        image: p.img ? String(p.img).replace(/^http:/, 'https:') : '',
        veg: p.veg === true ? 'true' : 'false',
        data_note: `Menu item as listed on pizzahut.co.in national menu, observed ${new Date().toISOString().slice(0, 10)}`,
      },
      identifiers: p.id ? { sku: String(p.id) } : undefined,
      evidence: { sourceUrl: pageUrl, extractedFields: ['title', 'price', 'size', 'crust', 'image', 'veg'] },
    }));
  }
  return items;
}
