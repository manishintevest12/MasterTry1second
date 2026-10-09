/**
 * Adapter contract (Section 4). Every acquisition mechanism implements this interface.
 * Consistent error handling, timeouts, observability, output schema, version tracking.
 */
import type {
  AdapterResult, FailureClass, ParsedQuery, RawSourceItem, SourceConfig, VerticalId,
} from '../types';

export interface AcquireContext {
  query: ParsedQuery;
  source: SourceConfig;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface SourceAdapter {
  readonly id: string;
  readonly method: SourceConfig['method'];
  readonly adapterVersion: string;
  readonly parserVersion: string;

  /** Applicable operations per the master spec; unsupported ones reject with UNKNOWN failure. */
  search(ctx: AcquireContext): Promise<AdapterResult>;
  healthCheck(source: SourceConfig): Promise<{ healthy: boolean; failureClass?: FailureClass; latencyMs: number }>;
  getFreshness(source: SourceConfig): { liveVerifiedTtlSec: number; freshTtlSec: number; maxStaleSec: number };
  getExpiry(rawItem: RawSourceItem): string | null;
}

export function emptyResult(source: SourceConfig, fetchedAt: string): AdapterResult {
  return {
    success: true,
    sourceId: source.id,
    sourceMethod: source.method,
    rawItems: [],
    latencyMs: 0,
    fetchedAt,
  };
}

export function failedResult(
  source: SourceConfig,
  failureClass: FailureClass,
  error: string,
  latencyMs: number,
  httpStatus?: number,
): AdapterResult {
  return {
    success: false,
    sourceId: source.id,
    sourceMethod: source.method,
    rawItems: [],
    httpStatus,
    latencyMs,
    error,
    failureClass,
    fetchedAt: new Date().toISOString(),
  };
}

export function newRawItem(source: SourceConfig, partial: Partial<RawSourceItem> & { title: string }): RawSourceItem {
  return {
    sourceId: source.id,
    title: partial.title,
    price: partial.price,
    currency: partial.currency,
    listPrice: partial.listPrice,
    brand: partial.brand,
    model: partial.model,
    identifiers: partial.identifiers,
    attributes: partial.attributes || {},
    seller: partial.seller,
    sellerUrl: partial.sellerUrl,
    availability: partial.availability || 'unknown',
    fees: partial.fees,
    location: partial.location,
    travel: partial.travel,
    expiresAt: partial.expiresAt,
    evidence: partial.evidence || { extractedFields: ['title'] },
    fetchedAt: new Date().toISOString(),
  };
}
