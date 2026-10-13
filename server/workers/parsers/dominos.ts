/**
 * Domino's India menu parser — food vertical.
 *
 * dominos.co.in/menu serves the full national product catalog SSR'd inside an
 * HTML-entity-encoded JSON (&quot;-escaped). Each product carries name, family
 * (Pizza/Sides/Bread/Dessert...), description and a real price object
 * {"regularPrice":n,"currentPrice":n}. Prices are Domino's own web menu prices
 * (location may vary slightly at checkout; honest national-menu basis).
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export interface DominosProduct {
  displayName: string;
  family: string;
  currentPrice: number;
  regularPrice: number;
  description: string;
  menuCode: string;
}

export function parseDominosMenu(htmlEscaped: string): DominosProduct[] {
  const html = htmlEscaped.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'");
  const re = /\{"productMasterUID":"[0-9a-f-]{36}","name":"(.*?)","displayName":"(.*?)","family":\{"familyId":"[0-9a-f-]{36}","name":"(.*?)"\},"description":"(.*?)".{0,4000}?"price":\{"regularPrice":(\d+),"currentPrice":(\d+)\}/gs;
  const seen = new Set<string>();
  const out: DominosProduct[] = [];
  for (const m of html.matchAll(re)) {
    const [, , displayName, family, description, regular, current] = m;
    const cur = Number(current);
    const reg = Number(regular);
    const disp = String(displayName);
    const key = `${disp}|${family}`;
    if (!disp || !cur || cur <= 0 || seen.has(key)) continue;
    seen.add(key);
    out.push({
      displayName: disp,
      family: String(family),
      currentPrice: cur,
      regularPrice: reg,
      description: String(description).replace(/\\u0026/g, '&').slice(0, 160),
      menuCode: '',
    });
  }
  return out;
}

/** Filter products against a dish/pizza query and build raw items (seller = Domino's). */
export function dominosItems(products: DominosProduct[], source: SourceConfig, query: string): RawSourceItem[] {
  const q = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!q) return [];
  const words = q.split(' ').filter((w) => w.length > 2 && !['the', 'and', 'for', 'with', 'pizza', 'order', 'buy', 'price'].includes(w));
  const pizzaish = /pizza|margherita|farmhouse|paneer|corn|cheese|garlic|bread|taco|burger|chicken|veg|cake|dessert|sides|wings|lava|parcel|meltz|taco/i.test(q);
  const scored = products
    .map((p) => {
      const hay = `${p.displayName} ${p.family} ${p.description}`.toLowerCase();
      let score = 0;
      for (const w of words) if (hay.includes(w)) score += 1;
      if (hay.includes(q)) score += 3;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.currentPrice - b.p.currentPrice);
  const top = scored.slice(0, 12);
  if (!top.length && pizzaish) {
    // generic dish query: national best-sellers, honestly labelled
    return products.filter((p) => p.family === 'Pizza').slice(0, 8).map((p) => buildItem(p, source, 'national menu best-seller'));
  }
  return top.map((x) => buildItem(x.p, source, 'menu item matched to your search'));
}

function buildItem(p: DominosProduct, source: SourceConfig, matchNote: string): RawSourceItem {
  const today = new Date().toISOString().slice(0, 10);
  return newRawItem(source, {
    title: `Domino's ${p.displayName} (${p.family})`,
    brand: "Domino's",
    price: p.currentPrice,
    currency: 'INR',
    seller: "Domino's Pizza India",
    sellerUrl: 'https://www.dominos.co.in/menu',
    attributes: {
      dish: p.displayName,
      category: p.family,
      description: p.description,
      regular_price: String(p.regularPrice),
      saving: p.regularPrice > p.currentPrice ? String(p.regularPrice - p.currentPrice) : '',
      image: '',
      price_basis: `dominos.co.in web menu price (${matchNote}), scraped ${today}`,
      data_note: `Price from Domino's India national web menu on ${today}; final price at checkout may vary by city/store`,
    },
    identifiers: { sku: `dominos-${p.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` },
    evidence: { sourceUrl: 'https://www.dominos.co.in/menu', extractedFields: ['displayName', 'family', 'currentPrice', 'regularPrice', 'description'] },
  });
}
