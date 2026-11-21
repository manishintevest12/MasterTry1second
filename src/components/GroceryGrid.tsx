import React from 'react';
import { Clock, Star } from 'lucide-react';
import type { OfferGroup } from '../utils/offerGroups';
import { useApp } from '../context/AppContext';
import { useGroceryCart } from '../context/GroceryCartContext';
import { cartKey } from '../lib/groceryCart';
import { trackFunnel } from '../lib/funnel';

/**
 * RETAIL GRID — 10-min grocery, e-commerce and food (owner 20 Nov: "ecommerce and food mai v yahi design rkho").
 *
 * The same tile serves all three retail verticals because a shopper reads them the same way: image, % off,
 * delivery time, title, pack, price with struck MRP, the partner's name, ADD/stepper, Order. Vertical-specific
 * bits are additive, never a different layout:
 *  - e-commerce keeps its in-site price comparison ("Compare prices" opens the product page for the same item);
 *  - food shows the veg / non-veg mark when the source states it.
 *
 * Rules that do not change with the vertical: the partner is named on EVERY tile, ADD is a real persisted
 * basket control, Order leaves through the partner's tracked exit, and no price is ever re-computed.
 *
 * The first pass added the partner name, ADD/stepper and "Order on <partner>" to the existing comparison card —
 * correct behaviour, wrong shape. A grocery shopper reads a grid of products (image, % off, delivery time, pack,
 * price, MRP, ADD), not a comparison row. This renders exactly that shape while keeping every rule we already
 * hold:
 *  - the partner website is named on EVERY tile (that is the price's source and the order destination);
 *  - ADD is a real basket control (shared grocery cart, persisted) and the cart bar shows the running total;
 *  - "Order" opens that partner's tracked exit, so nothing is invented and no checkout is implied here;
 *  - no price is ever re-computed: the tile shows the price the engine returned, with its own MRP.
 */

function rupees(n: number): string {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function discountPct(price: number, mrp: number): number {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

/** First real ETA string the source gave us ("8 MINS", "10 mins") — never invented. */
function etaOf(group: OfferGroup): string {
  const quotes = [group.best.item, ...group.rows.map((r: any) => r.item)];
  for (const it of quotes) {
    for (const q of (it.sellerQuotes || []) as any[]) {
      const eta = String((q as any).deliveryOrEta || '').trim();
      if (eta) return eta.replace(/^delivery\s*(in)?\s*/i, '').slice(0, 14).toUpperCase();
    }
  }
  return '';
}

const ProductTile: React.FC<{ group: OfferGroup; vertical: string }> = ({ group, vertical }) => {
  const { startRedirection, openProductPage } = useApp();
  const cart = useGroceryCart();
  const item = group.best.item;
  const partner = String(group.best.site || item.provider || '').trim();
  const unit = String(item.unit || '').replace(/^per\s+/i, '').trim();
  const price = Number(group.best.price ?? item.primaryPrice ?? 0);
  const mrp = Number(item.originalPrice || 0);
  const off = discountPct(price, mrp);
  const eta = etaOf(group);
  const image = item.imageUrl || (item.images || [])[0] || '';
  const key = cartKey(item.title, unit, partner);
  // food: the veg mark only when the source actually states it (never inferred from the dish name)
  const vegSpec = String((item as any).specs?.['is_veg'] ?? (item as any).specs?.['veg'] ?? '').toLowerCase();
  const veg = vertical === 'food' && (vegSpec === 'true' || vegSpec === 'yes') ? true
    : vertical === 'food' && (vegSpec === 'false' || vegSpec === 'no') ? false : null;
  const qty = cart.qtyOf(key);

  const add = () => {
    trackFunnel({ event: 'card_click', vertical, itemId: item.id, seller: partner, query: item.title });
    cart.add({
      key,
      title: item.title,
      unit,
      price,
      mrp: mrp > price ? mrp : price,
      partner: partner || 'Partner',
      image,
      url: (group.best.item.sellerQuotes || []).find((q: any) => q.isLowest)?.url || group.best.item.sellerQuotes?.[0]?.url,
    });
  };

  return (
    <div className="relative flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* image + badges */}
      <div className="relative aspect-square bg-slate-50">
        {image ? (
          <img src={image} alt={item.title} className="w-full h-full object-contain p-2" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">No image</div>
        )}
        {off > 0 && (
          <span className="absolute top-1.5 left-1.5 rounded bg-sky-600 px-1.5 py-0.5 text-[9px] font-black text-white">
            {off}% OFF
          </span>
        )}
        {eta && (
          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-white/95 px-1.5 py-0.5 text-[9px] font-extrabold text-slate-600 shadow-sm">
            <Clock className="w-2.5 h-2.5" /> {eta}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-2">
        {/* the partner whose price this is: named on every tile */}
        <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400 truncate" title={partner}>
          {partner || 'Partner'}
        </p>
        <p className="mt-0.5 text-[11.5px] font-bold leading-snug text-slate-900 line-clamp-2 min-h-[2.4em]">
          {veg !== null && (
            <span
              className={`inline-block align-middle mr-1 h-2.5 w-2.5 rounded-sm border ${veg ? 'border-emerald-600' : 'border-red-600'}`}
              title={veg ? 'Vegetarian' : 'Non-vegetarian'}
            >
              <span className={`block h-full w-full scale-50 rounded-full ${veg ? 'bg-emerald-600' : 'bg-red-600'}`} />
            </span>
          )}
          {item.title}
        </p>
        <div className="mt-0.5 flex items-center gap-1">
          {unit && <span className="text-[10px] font-semibold text-slate-500">{unit}</span>}
          {Number(item.rating) > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-slate-500">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" /> {item.rating}
            </span>
          )}
        </div>

        <div className="mt-1.5 flex items-end justify-between gap-1">
          <div className="leading-tight">
            <p className="text-[13px] font-black text-slate-900">{rupees(price)}</p>
            {mrp > price && <p className="text-[10px] text-slate-400 line-through">{rupees(mrp)}</p>}
          </div>
          {/* OWNER 21 Nov: "add button sirf 10-min grocery mai hoga" — the basket is the grocery vertical's,
              so e-commerce and food tiles show no ADD/stepper. They keep price, MRP, partner name and Order. */}
          {vertical === 'grocery' && (qty === 0 ? (
              <button
                type="button"
                onClick={add}
                className="rounded-lg border-2 border-emerald-600 px-3 py-1 text-[11px] font-black text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors cursor-pointer"
              >
                ADD
              </button>
            ) : (
              <div className="flex items-center rounded-lg border-2 border-emerald-600 overflow-hidden">
                <button
                  type="button"
                  aria-label="Remove one"
                  onClick={() => cart.setQuantity(key, qty - 1)}
                  className="px-1.5 py-0.5 text-[13px] font-black text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                >
                  −
                </button>
                <span className="px-1 text-[11px] font-black text-emerald-700 min-w-4 text-center">{qty}</span>
                <button
                  type="button"
                  aria-label="Add one"
                  onClick={add}
                  className="px-1.5 py-0.5 text-[13px] font-black text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                >
                  +
                </button>
              </div>
            ))}
        </div>

        {/* E-COMMERCE: keep the in-site product page (gallery + every seller's price) reachable from the tile */}
        {vertical === 'ecommerce' && (
          <button
            type="button"
            onClick={() =>
              openProductPage({
                query: item.title,
                seed: (item.sellerQuotes || []).map((q: any) => ({
                  seller: q.sellerName, title: item.title, price: q.price,
                  listPrice: q.originalPrice, image: q.sellerLogo || image || null, url: q.url,
                })),
              })
            }
            className="mt-1.5 w-full rounded-lg border border-slate-300 py-1.5 text-[10px] font-extrabold text-slate-700 cursor-pointer"
          >
            Compare prices
          </button>
        )}

        {/* Order goes to the partner's own page for THIS product */}
        <button
          type="button"
          onClick={() => {
            const q = (group.best.item.sellerQuotes || []).find((x: any) => x.isLowest) || group.best.item.sellerQuotes?.[0];
            if (q) startRedirection(group.best.item, q);
          }}
          className="mt-1.5 w-full rounded-lg bg-[#E7000B] py-1.5 text-[10px] font-extrabold text-white cursor-pointer"
        >
          Order on {partner || 'partner'}
        </button>
      </div>
    </div>
  );
};

export const ProductGrid: React.FC<{ groups: OfferGroup[]; vertical: string }> = ({ groups, vertical }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
    {groups.map((g) => (
      <ProductTile key={g.key + g.best.item.id} group={g} vertical={vertical} />
    ))}
  </div>
);

/** Kept for the grocery call site's name; identical behaviour. */
export const GroceryGrid = ProductGrid;
