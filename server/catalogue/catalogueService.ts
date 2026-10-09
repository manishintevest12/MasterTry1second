/**
 * CatalogueService (Section 7): persistent catalogue + incremental refresh bookkeeping.
 * MySQL is the durable source of truth (file store only as dev fallback).
 * - Stable vs volatile fields are persisted separately; refresh only rewrites volatile ones
 * - Every accepted offer writes a price snapshot (historical price tracking)
 * - Failed refresh never marks old data newly verified
 */
import type { NormalizedOffer, RawSourceItem, SourceConfig } from '../types';
import { getStore } from '../common/db';
import { log } from '../common/logger';
import { buildEvidence, type EvidenceRecord } from '../pipeline/freshness';

/** Persist a validated offer. Returns the DB row id (0 on dev-file store without AUTO_INCREMENT). */
export async function persistOffer(offer: NormalizedOffer, raw: RawSourceItem, source: SourceConfig): Promise<number> {
  const store = getStore();
  try {
    const res = await store.execute(
      `INSERT INTO offers (
         canonical_entity_id, vertical, title, brand, identifiers, attributes, vendor, seller, seller_url,
         location_pincode, location_city, list_price, mandatory_total, effective_price, verified_savings,
         currency, fees, availability, match_state, freshness_status, validation_status, confidence,
         source_id, source_method, source_url, fetched_at, validated_at, expires_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        offer.canonicalEntityId, offer.vertical, offer.title, offer.brand, JSON.stringify(offer.identifiers),
        JSON.stringify(offer.attributes), offer.vendor, offer.seller, offer.sellerUrl,
        offer.location?.pincode || null, offer.location?.city || null,
        offer.prices.listPrice ?? null, offer.prices.mandatoryTotal ?? null, offer.prices.effectivePrice ?? null,
        offer.prices.verifiedSavings ?? 0, offer.prices.currency, JSON.stringify(offer.prices.fees),
        offer.availability, offer.matchState, offer.freshnessStatus, offer.validationStatus, offer.confidence,
        source.id, source.method, offer.provenance.sourceUrl || raw.evidence?.sourceUrl || null,
        offer.provenance.fetchedAt, offer.provenance.validatedAt || null, offer.expiresAt || null,
      ],
    );

    // Evidence record (permitted fields only; raw payload is never stored, only its hash)
    const evidence: EvidenceRecord = buildEvidence(offer, raw);
    try {
      await store.execute(
        `INSERT INTO source_evidence (offer_id, source_id, source_method, source_url, source_reference, fetched_at, extracted_fields, evidence_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [res.insertId || 0, evidence.sourceId, evidence.sourceMethod, evidence.sourceUrl || null,
          evidence.sourceReference || null, evidence.fetchedAt, JSON.stringify(evidence.extractedFields), evidence.evidenceHash],
      );
    } catch { /* evidence is best-effort, never blocks the pipeline */ }

    return res.insertId || 0;
  } catch (e: any) {
    log.warn('Catalogue', 'Offer persist failed', { error: String(e).slice(0, 150) });
    return 0;
  }
}

/** Price snapshot for historical tracking — written on every persist, even unchanged prices. */
export async function recordPriceSnapshot(offer: NormalizedOffer, rowId: number): Promise<void> {
  const store = getStore();
  try {
    await store.execute(
      `INSERT INTO price_history (offer_id, canonical_entity_id, mandatory_total, effective_price, currency, source_id, freshness_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [rowId || 0, offer.canonicalEntityId, offer.prices.mandatoryTotal ?? null, offer.prices.effectivePrice ?? null,
        offer.prices.currency, offer.provenance.sourceId, offer.freshnessStatus],
    );
  } catch { /* best-effort */ }
}

export interface CatalogueRow {
  id: number;
  vertical: string;
  title: string;
  vendor: string;
  seller: string;
  location_pincode?: string | null;
  location_city?: string | null;
  mandatory_total?: number | null;
  effective_price?: number | null;
  currency: string;
  availability: string;
  freshness_status: string;
  validation_status: string;
  confidence: number;
  fetched_at: string;
  source_id: string;
  canonical_entity_id?: number | null;
}

/** L3 catalogue lookup: eligible fresh offers for a vertical/location. */
export async function findCatalogueOffers(
  vertical: string,
  opts: { pincode?: string; city?: string; limit?: number } = {},
): Promise<CatalogueRow[]> {
  const store = getStore();
  try {
    const params: unknown[] = [vertical];
    let where = 'vertical = ? AND validation_status != ?';
    params.push('INVALID');
    if (opts.pincode) {
      where += ' AND (location_pincode = ? OR location_pincode IS NULL)';
      params.push(opts.pincode);
    } else if (opts.city) {
      where += ' AND (location_city = ? OR location_city IS NULL)';
      params.push(opts.city);
    }
    params.push(opts.limit ?? 50);
    return await store.query<CatalogueRow>(
      `SELECT id, vertical, title, vendor, seller, location_pincode, location_city, mandatory_total, effective_price,
              currency, availability, freshness_status, validation_status, confidence, fetched_at, source_id, canonical_entity_id
       FROM offers WHERE ${where} ORDER BY fetched_at DESC LIMIT ?`,
      params,
    );
  } catch (e: any) {
    log.debug('Catalogue', 'Lookup failed (store unavailable)', { error: String(e).slice(0, 100) });
    return [];
  }
}

/**
 * Incremental refresh support: candidates for the background worker.
 * Only volatile fields are refreshed; unchanged stable fields are never rewritten.
 */
export async function refreshCandidates(opts: { limit: number; minAgeSec: number }): Promise<CatalogueRow[]> {
  const store = getStore();
  try {
    return await store.query<CatalogueRow>(
      `SELECT id, vertical, title, vendor, seller, mandatory_total, effective_price, currency, availability,
              freshness_status, validation_status, fetched_at, source_id, canonical_entity_id
       FROM offers
       WHERE validation_status != 'INVALID'
       AND TIMESTAMPDIFF(SECOND, COALESCE(fetched_at, '1970-01-01'), NOW()) > ?
       ORDER BY fetched_at ASC LIMIT ?`,
      [opts.minAgeSec, opts.limit],
    );
  } catch {
    return [];
  }
}

/** Update ONLY volatile fields on an existing offer row (Section 7.1). */
export async function updateVolatileFields(rowId: number, patch: {
  mandatoryTotal?: number; effectivePrice?: number; availability?: string;
  freshnessStatus?: string; validatedAt?: string; expiresAt?: string;
}): Promise<void> {
  const store = getStore();
  try {
    await store.execute(
      `UPDATE offers SET mandatory_total = ?, effective_price = ?, availability = ?, freshness_status = ?, validated_at = ?, expires_at = ?, fetched_at = NOW() WHERE id = ?`,
      [patch.mandatoryTotal ?? null, patch.effectivePrice ?? null, patch.availability || 'unknown',
        patch.freshnessStatus || 'UNVERIFIED', patch.validatedAt || null, patch.expiresAt || null, rowId],
    );
  } catch (e: any) {
    log.debug('Catalogue', 'Volatile update failed', { error: String(e).slice(0, 100) });
  }
}

/** Historical price series for an entity (drives "price trend" UI). */
export async function priceHistoryForEntity(canonicalEntityId: number, limit = 60): Promise<Array<{ effective_price: number | null; captured_at: string }>> {
  const store = getStore();
  try {
    return await store.query(
      `SELECT effective_price, captured_at FROM price_history WHERE canonical_entity_id = ? ORDER BY captured_at DESC LIMIT ?`,
      [canonicalEntityId, limit],
    );
  } catch {
    return [];
  }
}
