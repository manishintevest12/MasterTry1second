/**
 * NormalizationEngine (Sections 6–7): converts RawSourceItems into the normalized
 * offer model with clean identifiers, canonical attributes and provenance metadata.
 * Unknown fields stay unknown — normalization never fills gaps with guesses.
 */
import type { NormalizedOffer, RawSourceItem, SourceConfig, VerticalId } from '../types';

const NOISE_RE = /\s*\((?:pack of \d+|set of \d+|1 each)\)\s*$/i;

export function normalizeTitle(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(NOISE_RE, '').trim().slice(0, 400);
}

/** Digits-only comparison key for identifiers, case-normalized otherwise. */
export function normalizeIdentifier(type: string, value: string): string {
  const v = value.trim();
  if (/^(gtin|ean|upc|mpn)$/i.test(type)) return v.replace(/\D/g, '');
  return v.toLowerCase();
}

export function normalizeAttributes(attrs: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs || {})) {
    const key = k.trim().toLowerCase().replace(/\s+/g, '_');
    if (key && v !== undefined && v !== null && String(v).trim() !== '') out[key] = String(v).trim();
  }
  return out;
}

export function normalizeCurrency(cur: string | undefined): string {
  const c = (cur || 'INR').trim().toUpperCase();
  // Known INR aliases seen on Indian sources; anything else passes through for explicit validation
  if (['INR', '₹', 'RS', 'RUPEE', 'RUPEES'].includes(c)) return 'INR';
  return c;
}

export function normalizeOffer(raw: RawSourceItem, source: SourceConfig, vertical: VerticalId): NormalizedOffer {
  const attributes = normalizeAttributes(raw.attributes);
  const identifiers: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw.identifiers || {})) {
    if (v) identifiers[k] = normalizeIdentifier(k, v);
  }
  const title = normalizeTitle(raw.title);
  return {
    id: `off_${source.id}_${hashOf(title, raw.seller || '', String(raw.price ?? ''))}`,
    canonicalEntityId: null,
    canonicalVariantId: null,
    vertical,
    title,
    brand: raw.brand?.trim(),
    model: raw.model?.trim(),
    identifiers,
    attributes,
    vendor: (raw.seller || source.name).trim(),
    seller: (raw.seller || source.name).trim(),
    sellerUrl: raw.sellerUrl || raw.evidence?.sourceUrl,
    location: raw.location,
    travel: raw.travel,
    prices: {
      listPrice: raw.listPrice,
      currency: normalizeCurrency(raw.currency),
      fees: {
        basePrice: raw.price,
        ...(raw.fees || {}),
      },
    },
    availability: raw.availability || 'unknown',
    matchState: 'NOT_MATCHED',
    freshnessStatus: 'UNVERIFIED',
    validationStatus: 'PARTIAL',
    confidence: 0,
    provenance: {
      sourceId: source.id,
      sourceMethod: source.method,
      adapterVersion: source.adapterVersion,
      parserVersion: source.parserVersion,
      sourceUrl: raw.evidence?.sourceUrl,
      sourceReference: raw.evidence?.sourceReference,
      fetchedAt: raw.fetchedAt,
    },
    expiresAt: raw.expiresAt,
  };
}

function hashOf(...parts: string[]): string {
  const s = parts.join('|').toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).slice(0, 12);
}

export function offerDedupKey(o: NormalizedOffer): string {
  // Same product identity from the same seller = one offer; different sellers stay separate (Section 10)
  const identity = o.identifiers.gtin || o.identifiers.ean || o.identifiers.upc || o.identifiers.sku ||
    `${o.brand || ''}:${o.title}`.toLowerCase();
  return `${identity}|${o.seller.toLowerCase()}|${o.location?.pincode || ''}|${o.attributes && Object.keys(o.attributes).length ? JSON.stringify(o.attributes) : ''}`;
}

export function dedupeOffers(offers: NormalizedOffer[]): NormalizedOffer[] {
  const seen = new Map<string, NormalizedOffer>();
  for (const o of offers) {
    const key = offerDedupKey(o);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, o);
      continue;
    }
    // Prefer fresher fetch for duplicate identity+seller
    if (new Date(o.provenance.fetchedAt) > new Date(existing.provenance.fetchedAt)) seen.set(key, o);
  }
  return [...seen.values()];
}
