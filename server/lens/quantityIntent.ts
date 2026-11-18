/**
 * Strict quantity preservation (master prompt section 2), enforced in code.
 *
 * OWNER 18 Nov: "'10 kg atta' ka matlab 10 kg hai — 1 kg ya 5 kg pack uski jagah nahi le sakta."
 *
 * A prompt can ask a model to preserve a quantity; it cannot STOP the search pipeline from ranking a 1 kg
 * pouch as "the cheapest atta". So the rule lives here, in pure functions the answer layer calls:
 *
 *   parseRequestedQuantity("10 kg atta")     -> { label: '10 kg', grams: 10000, unit: 'kg' ... }
 *   rowQuantity("Aashirvaad Atta 5 kg")      -> { grams: 5000, unit: 'kg' ... }
 *   planByQuantity(req, rows)                -> exact / alternates / notice
 *
 * Sellers write the same pack a dozen ways ("10kg", "10 kg pack", "10 Kilogram", "10000 g"), so both sides
 * are canonicalised to grams / millilitres / a pack count before comparing. Units never mix: 1 l of milk is
 * not 1 kg of atta, and an unknown size is 'unknown', never treated as a match.
 */

export type QuantityUnit = 'g' | 'kg' | 'ml' | 'l' | 'pack' | 'pcs';

export interface Quantity {
  /** The amount in the family's base unit ALWAYS: grams, millilitres, or a count. Never rescaled. */
  base: number;
  unit: QuantityUnit;
  /** What the user/row actually said, e.g. "10 kg" — used in the apology wording. */
  label: string;
}

const UNIT_TO_BASE: Record<QuantityUnit, { family: 'mass' | 'volume' | 'count'; factor: number }> = {
  g: { family: 'mass', factor: 1 },
  kg: { family: 'mass', factor: 1000 },
  ml: { family: 'volume', factor: 1 },
  l: { family: 'volume', factor: 1000 },
  pack: { family: 'count', factor: 1 },
  pcs: { family: 'count', factor: 1 },
};

/** Word/number -> canonical unit. Hinglish and Indian-English spellings included. */
const UNIT_WORDS: Array<[RegExp, QuantityUnit]> = [
  [/^(kilograms?|kilo|kilos|kgs?|k\b|केजी|किलो)$/i, 'kg'],
  [/^(grams?|grammes?|gms?|gm|g\b|ग्राम)$/i, 'g'],
  [/^(millilitres?|milliliters?|mls?|ml\b|मिली)$/i, 'ml'],
  [/^(litres?|liters?|ltrs?|ltr|litre|liter|ls?|l\b|लीटर|लिटर)$/i, 'l'],
  [/^(packs?|packets?|pkts?|pk\b|pouch|पैकेट)$/i, 'pack'],
  [/^(pcs?|pieces?|piece|units?|नग)$/i, 'pcs'],
];

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  ek: 1, do: 2, teen: 3, char: 4, panch: 5, paanch: 5, das: 10, dus: 10, aadha: 0.5, adha: 0.5,
  half: 0.5, quarter: 0.25, 'सवा': 1.25,
};

function canonicalUnit(token: string): QuantityUnit | null {
  const t = String(token || '').trim();
  for (const [re, unit] of UNIT_WORDS) if (re.test(t)) return unit;
  return null;
}

/** Display unit for an amount expressed in base units: 10000 g reads as "10 kg". */
function displayOf(base: number, unit: QuantityUnit): { unit: QuantityUnit; value: number } {
  const fam = UNIT_TO_BASE[unit].family;
  if (fam === 'mass' && base >= 1000) return { unit: 'kg', value: base / 1000 };
  if (fam === 'volume' && base >= 1000) return { unit: 'l', value: base / 1000 };
  return { unit, value: base };
}

function labelOf(value: number, unit: QuantityUnit): string {
  const n = Number.isInteger(value) ? String(value) : String(value);
  return `${n} ${unit === 'g' ? 'g' : unit === 'kg' ? 'kg' : unit === 'ml' ? 'ml' : unit === 'l' ? 'L' : unit === 'pack' ? 'pack' : 'pcs'}`;
}

/**
 * A quantity as the USER asked for it. Deliberately conservative:
 *  - "500" alone is not a quantity (could be a price, a model number or a year),
 *  - "500 g atta" and "atta 500g" both work,
 *  - "pack of 6", "dozen" and "6 pack" all read as a count,
 *  - a number followed by a unit is required, except an explicit "pack of N".
 */
export function parseRequestedQuantity(text: string): Quantity | null {
  const t = ` ${String(text || '').toLowerCase()} `;
  // "pack of 6" / "6 ka pack" / "dozen"
  const packOf = /\bpack\s*of\s*(\d{1,3})\b|\b(\d{1,3})\s*(?:ka\s*)?pack\b/.exec(t);
  if (packOf) {
    const n = Number(packOf[1] || packOf[2]);
    if (n > 0 && n <= 500) return { base: n, unit: 'pack', label: labelOf(n, 'pack') };
  }
  if (/\bdozen\b/.test(t)) return { base: 12, unit: 'pcs', label: '12 pcs' };
  // "<number> <unit>" with an optional decimal and optional space
  const m = /(\d{1,4}(?:\.\d{1,2})?)\s*(kilograms?|kilos?|kgs?|grams?|grammes?|gms?|gm|millilitres?|milliliters?|mls?|litres?|liters?|ltrs?|litre|liter|packs?|packets?|pcs?|pieces?|kg|g|ml|ltr|l|gm)\b/.exec(t);
  if (m) {
    const value = Number(m[1]);
    const unit = canonicalUnit(m[2]);
    if (unit && value > 0) {
      const base = value * UNIT_TO_BASE[unit].factor; // grams / ml / count, never rescaled
      const d = displayOf(base, unit);
      return { base, unit: d.unit, label: labelOf(d.value, d.unit) };
    }
  }
  // worded amounts: "do kilo atta", "ek litre doodh"
  const w = /\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|panch|paanch|das|dus|aadha|adha|half|quarter)\s+(kilograms?|kilos?|kgs?|grams?|gms?|litres?|liters?|ltrs?|litre|liter|packs?|packets?|pcs?|pieces?)\b/.exec(t);
  if (w) {
    const value = NUMBER_WORDS[w[1]];
    const unit = canonicalUnit(w[2]);
    if (value && unit) {
      const base = value * UNIT_TO_BASE[unit].factor;
      const d = displayOf(base, unit);
      return { base, unit: d.unit, label: labelOf(d.value, d.unit) };
    }
  }
  return null;
}

/**
 * The size a product title is actually sold in. Multipliers win ("Pack of 2 x 1 kg" = 2 kg), because that
 * is the total you buy; otherwise the largest single stated size is taken, since titles write
 * "Atta 10 kg (Pack of 1)" and the pack count is noise.
 */
export function rowQuantity(title: string): Quantity | null {
  const t = String(title || '').toLowerCase();
  const sizes: Quantity[] = [];
  for (const m of t.matchAll(/(\d{1,5}(?:\.\d{1,2})?)\s*(kilograms?|kilos?|kgs?|grams?|grammes?|gms?|gm|millilitres?|milliliters?|mls?|litres?|liters?|ltrs?|litre|liter|pcs?|pieces?|kg|g|ml|ltr|gm|l)\b/g)) {
    const value = Number(m[1]);
    const unit = canonicalUnit(m[2]);
    if (!unit || !(value > 0)) continue;
    if (unit === 'l' && /\b\d\s*l\b/.test(`${m[1]} ${m[2]}`) === false && /^(l)$/i.test(m[2]) && value > 50) continue; // "1 L" ok, "1234 L" noise
    const base = value * UNIT_TO_BASE[unit].factor;
    sizes.push({ base, unit, label: labelOf(value, unit) });
  }
  if (!sizes.length) return null;
  // a pack multiplier: "pack of 3" together with a per-unit size
  const mult = /\b(?:pack\s*of|combo\s*of)\s*(\d{1,2})\b/.exec(t);
  const perUnit = sizes.find((s) => UNIT_TO_BASE[s.unit].family !== 'count');
  if (mult && perUnit) {
    const n = Number(mult[1]);
    if (n > 1) {
      const base = perUnit.base * n;
      const d = displayOf(base, perUnit.unit);
      return { base, unit: d.unit, label: labelOf(d.value, d.unit) };
    }
  }
  // no multiplier: the biggest stated size is the pack you buy
  sizes.sort((a, b) => b.base - a.base);
  const top = sizes[0];
  const d = displayOf(top.base, top.unit);
  return { base: top.base, unit: d.unit, label: labelOf(d.value, d.unit) };
}

export type QuantityVerdict = 'exact' | 'different' | 'unknown';

/** Same family AND the same amount. A different family is 'unknown', never 'exact'. */
export function quantityVerdict(requested: Quantity, title: string): QuantityVerdict {
  const row = rowQuantity(title);
  if (!row) return 'unknown';
  if (UNIT_TO_BASE[row.unit].family !== UNIT_TO_BASE[requested.unit].family) return 'unknown';
  // tolerate rounding in scraped titles: 0.1% of the requested amount
  const diff = Math.abs(row.base - requested.base) / requested.base;
  return diff <= 0.001 ? 'exact' : 'different';
}

export interface QuantityPlan<T> {
  /** Rows that ARE the requested size. Empty when the exact pack is not on offer. */
  exact: T[];
  /** Everything else, cheapest first, never presented as the requested size. */
  alternates: T[];
  /** The owner's sentence, only when the exact pack is missing. */
  notice: string | null;
}

/**
 * Split rows into the requested size and alternatives.
 *
 * The owner's rule, in order: the exact size wins; if it is not there, say so in exactly those words and
 * show the closest alternatives. An unknown size is never promoted to "exact" - that is how a 1 kg pouch
 * ends up answering a 10 kg question.
 */
export function planByQuantity<T extends { title: string; price: number }>(
  requested: Quantity | null,
  rows: T[],
  noticeFor: (label: string) => string,
): QuantityPlan<T> {
  if (!requested) return { exact: [], alternates: rows, notice: null };
  const exact: T[] = [];
  const alternates: T[] = [];
  for (const r of rows) (quantityVerdict(requested, r.title) === 'exact' ? exact : alternates).push(r);
  const byPrice = (a: T, b: T) => a.price - b.price;
  exact.sort(byPrice);
  alternates.sort(byPrice);
  return { exact, alternates, notice: exact.length ? null : noticeFor(requested.label) };
}
