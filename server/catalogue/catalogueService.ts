/**
 * CatalogueService (Section 7): persistent catalogue + incremental refresh bookkeeping.
 * MySQL is the durable source of truth (file store only as dev fallback).
 * - Stable vs volatile fields are persisted separately; refresh only rewrites volatile ones
 * - Every accepted offer writes a price snapshot (historical price tracking)
 * - Failed refresh never marks old data newly verified
 */
import type { NormalizedOffer, RawSourceItem, SourceConfig } from '../types';
import { notifyWriteDenied } from './prune';
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
    notifyWriteDenied(String(e));
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
  /** Persisted attribute JSON (image_url, rating, gallery...) — hydrate, never discard. */
  attributes?: unknown;
  /** Persisted seller deeplink target — without it cached rows had NO Book button (owner 22 Oct). */
  seller_url?: string | null;
  brand?: string | null;
}

/** L3 catalogue lookup: eligible fresh offers for a vertical/location. */
export async function findCatalogueOffers(
  vertical: string,
  opts: { pincode?: string; city?: string; limit?: number; strictCity?: boolean } = {},
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
      // Owner 28 Oct ('Indore dhoondha, Goa ke hotels aaye'): the NULL branch let rows with
      // no city prove nothing yet be borrowed for ANY city. A city-driven floor must be
      // explicit: strictCity requires the row's own city, so wrong-city rows can never paint.
      where += opts.strictCity ? ' AND location_city = ?' : ' AND (location_city = ? OR location_city IS NULL)';
      params.push(opts.city);
    }
    params.push(opts.limit ?? 50);
    return await store.query<CatalogueRow>(
      `SELECT id, vertical, title, vendor, seller, location_pincode, location_city, mandatory_total, effective_price,
              currency, availability, freshness_status, validation_status, confidence, fetched_at, source_id, canonical_entity_id,
              seller_url, brand
       FROM offers WHERE ${where} ORDER BY fetched_at DESC LIMIT ?`,
      params,
    );
  } catch (e: any) {
    log.debug('Catalogue', 'Lookup failed (store unavailable)', { error: String(e).slice(0, 100) });
    return [];
  }
}

/**
 * Incremental refresh support: candidates for the background worker (Section 7.3).
 * Only volatile fields are refreshed; unchanged stable fields are never rewritten.
 * Priority = measured search demand for the vertical (24h) first, then near-expiry, then oldest.
 * Runs only on MySQL (measured demand lives in the searches table); the dev file
 * store returns [] honestly rather than pretending to know demand.
 */
export async function refreshCandidates(opts: { limit: number; minAgeSec: number }): Promise<CatalogueRow[]> {
  const store = getStore();
  if (store.kind !== 'mysql') return [];
  try {
    return await store.query<CatalogueRow>(
      `SELECT o.id, o.vertical, o.title, o.vendor, o.seller, o.mandatory_total, o.effective_price, o.currency,
              o.availability, o.freshness_status, o.validation_status, o.fetched_at, o.source_id, o.canonical_entity_id
       FROM offers o
       LEFT JOIN (
         SELECT vertical, COUNT(*) AS demand FROM searches
         WHERE created_at >= NOW() - INTERVAL 24 HOUR GROUP BY vertical
       ) d ON d.vertical = o.vertical
       WHERE o.validation_status != 'INVALID'
       AND TIMESTAMPDIFF(SECOND, COALESCE(o.fetched_at, '1970-01-01'), NOW()) > ?
       ORDER BY COALESCE(d.demand, 0) DESC,
                (o.expires_at IS NULL OR o.expires_at < NOW() + INTERVAL 6 HOUR) DESC,
                o.fetched_at ASC
       LIMIT ?`,
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


/**
 * Hotel art hygiene (owner 22 Oct): prod served merchant favicons as property
 * photos because rows written by pre-gallery batches carry no image_url in
 * attributes. Current parsers (Agoda, OYO, Yatra, EMT, SaffronStays, Ixigo,
 * Cleartrip, Airbnb) always persist image_url, so any hotel row older than a
 * day without one is a stale-shape write — boot clears it once; the healthy
 * warm rotation repopulates with real art within one cycle.
 */
export async function purgePhotolessHotelOffers(): Promise<void> {
  const store = getStore();
  try {
    await store.execute(
      `DELETE FROM offers WHERE vertical = 'hotels'
        AND (attributes IS NULL OR attributes NOT LIKE '%"image_url"%'
             OR JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.image_url')) IS NULL)
        AND fetched_at < (NOW() - INTERVAL 1 DAY)`,
    );
  } catch (e: any) {
    // FileStore fallback lacks JSON_EXTRACT — plain LIKE keeps it working there.
    try {
      await store.execute(
        `DELETE FROM offers WHERE vertical = 'hotels'
          AND (attributes IS NULL OR attributes NOT LIKE '%"image_url"%')
          AND fetched_at < (NOW() - INTERVAL 1 DAY)`,
      );
    } catch (e2: any) {
      log.debug('Catalogue', 'Photoless hotel purge failed', { error: String(e2).slice(0, 100) });
    }
  }
}

/**
/**
 * One-time hygiene (21 Oct): purge stale-shape banking rows persisted by the
 * pre-worker account implementation (they carry mis-captured charge text and
 * lack the account_type marker every current parser emits). Old rows age out
 * via the row cap eventually, but wrong published rates must never surface
 * beside the verified ones — so boot clears them once, best-effort.
 */
export async function purgeStaleBankingOffers(): Promise<void> {
  const store = getStore();
  try {
    await store.execute(
      `DELETE FROM offers WHERE vertical = 'banking' AND (attributes IS NULL OR attributes NOT LIKE '%"account_type"%')`,
    );
  } catch (e: any) {
    log.debug('Catalogue', 'Stale banking purge failed', { error: String(e).slice(0, 100) });
  }
}
