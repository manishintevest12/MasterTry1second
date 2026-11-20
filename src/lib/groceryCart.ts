/**
 * GROCERY CART (owner 20 Nov: "10 min-grocery mai muje aisa design chaiye flutter app and website mai, hr card pr
 * partner website ka naam, order now button and add to cart functionality").
 *
 * A grocery basket is a different object from the existing Smart Cart. Smart Cart compares ONE basket across
 * stores; this is the thing a shopper actually builds while browsing — the Blinkit-style list: this atta from
 * Zepto, this milk from Blinkit — with a quantity per line and the partner each line will be ordered from.
 *
 * Rules that keep it honest:
 *  - A line remembers the price the shopper saw AND the partner it belongs to. Totals are the sum of those
 *    remembered prices, so the cart total is labelled as a snapshot, never as a live quote.
 *  - "Order" on a line opens that partner's own exit for that product (the same /api/out pointer the card
 *    uses), so nothing is invented and no second, unofficial checkout is implied.
 *  - The cart lives in localStorage only: no account is needed to build a basket, and no personal data leaves
 *    the device until the shopper actually orders on the partner site.
 *
 * Pure functions so the arithmetic and the key rules are unit-testable.
 */

export interface GroceryCartLine {
  /** stable identity: same product + same pack + same partner is the same line */
  key: string;
  title: string;
  /** pack/size as printed, e.g. "5 kg" — never normalised, never guessed */
  unit: string;
  price: number;
  mrp: number;
  /** the partner website this line will be ordered from, e.g. "Zepto" */
  partner: string;
  image?: string;
  /** that partner's exit link for this product (already a tracked pointer) */
  url?: string;
  qty: number;
}

export const MAX_QTY = 20;
export const MAX_LINES = 40;

const STORAGE_KEY = 't1s_grocery_cart_v1';

export function cartKey(title: string, unit: string, partner: string): string {
  return `${String(partner || '').trim().toLowerCase()}|${String(title || '').trim().toLowerCase()}|${String(unit || '').trim().toLowerCase()}`;
}

/** Add or increment. Returns a new list; the caller owns state. */
export function addLine(lines: GroceryCartLine[], line: Omit<GroceryCartLine, 'qty'>, qty = 1): GroceryCartLine[] {
  const key = line.key || cartKey(line.title, line.unit, line.partner);
  const at = lines.findIndex((l) => l.key === key);
  if (at >= 0) {
    const next = [...lines];
    next[at] = { ...next[at], qty: Math.min(MAX_QTY, next[at].qty + qty) };
    return next;
  }
  const fresh: GroceryCartLine = { ...line, key, qty: Math.min(MAX_QTY, Math.max(1, qty)) };
  const next = [...lines, fresh];
  // bounded: the oldest line falls off rather than the basket growing without limit
  return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
}

/** Set an exact quantity; 0 removes the line. */
export function setQty(lines: GroceryCartLine[], key: string, qty: number): GroceryCartLine[] {
  const clamped = Math.max(0, Math.min(MAX_QTY, Math.round(qty)));
  if (clamped === 0) return lines.filter((l) => l.key !== key);
  return lines.map((l) => (l.key === key ? { ...l, qty: clamped } : l));
}

export function removeLine(lines: GroceryCartLine[], key: string): GroceryCartLine[] {
  return lines.filter((l) => l.key !== key);
}

export function qtyOf(lines: GroceryCartLine[], key: string): number {
  return lines.find((l) => l.key === key)?.qty || 0;
}

/** Totals over the prices the shopper saw. Money is rounded once, at the end. */
export function cartTotals(lines: GroceryCartLine[]): { items: number; units: number; total: number; mrpTotal: number; saving: number } {
  let units = 0;
  let total = 0;
  let mrpTotal = 0;
  for (const l of lines) {
    units += l.qty;
    total += (Number(l.price) || 0) * l.qty;
    mrpTotal += (Number(l.mrp) || Number(l.price) || 0) * l.qty;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    items: lines.length,
    units,
    total: round(total),
    mrpTotal: round(mrpTotal),
    saving: round(Math.max(0, mrpTotal - total)),
  };
}

/** Group lines by the partner they will be ordered from, so the cart can say where each order goes. */
export function groupByPartner(lines: GroceryCartLine[]): { partner: string; lines: GroceryCartLine[]; subtotal: number }[] {
  const map = new Map<string, GroceryCartLine[]>();
  for (const l of lines) {
    const p = String(l.partner || 'Partner').trim() || 'Partner';
    map.set(p, [...(map.get(p) || []), l]);
  }
  return [...map.entries()]
    .map(([partner, group]) => ({
      partner,
      lines: group,
      subtotal: Math.round(group.reduce((s, l) => s + (Number(l.price) || 0) * l.qty, 0) * 100) / 100,
    }))
    .sort((a, b) => b.subtotal - a.subtotal);
}

export function loadCart(): GroceryCartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l: any) => l && typeof l.title === 'string' && l.title.trim())
      .map((l: any) => ({
        key: String(l.key || cartKey(l.title, l.unit, l.partner)),
        title: String(l.title).slice(0, 200),
        unit: String(l.unit || '').slice(0, 40),
        price: Math.max(0, Number(l.price) || 0),
        mrp: Math.max(0, Number(l.mrp) || Number(l.price) || 0),
        partner: String(l.partner || '').slice(0, 60),
        image: typeof l.image === 'string' ? l.image.slice(0, 500) : undefined,
        url: typeof l.url === 'string' ? l.url.slice(0, 1000) : undefined,
        qty: Math.max(1, Math.min(MAX_QTY, Number(l.qty) || 1)),
      }))
      .slice(0, MAX_LINES);
  } catch {
    return [];
  }
}

export function saveCart(lines: GroceryCartLine[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* storage blocked: the cart still works for this page view */
  }
}
