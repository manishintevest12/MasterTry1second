/**
 * Development-only fixture fallback (HonestDev mode).
 *
 * Purpose: keep local development and CI unblocked when a target platform's WAF
 * rate-limits the dev IP (403/429/timeout). Enabled ONLY when the env var
 * T1S_DEV_FIXTURES=1 is set AND NODE_ENV is 'development'. Production never
 * loads these: every fixture row carries data_note='DEV FIXTURE' and the
 * attributes clearly say so, meaning a fixture can never be mistaken for live
 * data on a card.
 *
 * This is a development convenience, not an acquisition strategy. In production
 * a blocked source is reported honestly as unavailable (honestNotice).
 */
import type { RawSourceItem, SourceConfig } from '../types';
import { newRawItem } from '../sources/contract';

export function devFixturesEnabled(): boolean {
  return process.env.T1S_DEV_FIXTURES === '1' && process.env.NODE_ENV === 'development';
}

/** Two clearly-labelled sample rows shaped exactly like live items. */
export function buildDevFixtures(source: SourceConfig, vertical: string, query: string): RawSourceItem[] {
  if (!devFixturesEnabled()) return [];
  const q = String(query || 'sample query').slice(0, 60);
  const mk = (title: string, price: number): RawSourceItem =>
    newRawItem(source, {
      title,
      price,
      currency: 'INR',
      seller: 'DEV FIXTURE SELLER',
      sellerUrl: 'https://example.com/',
      availability: 'in_stock',
      attributes: {
        platform: 'DEV FIXTURE',
        data_note: 'DEV FIXTURE — local development sample, not live data',
        image_url: 'https://placehold.co/400x400/png?text=DEV+FIXTURE',
      },
      evidence: { sourceUrl: 'dev://fixture', sourceReference: `${vertical}:${q}`, extractedFields: ['title'] },
    });
  return [mk(`DEV FIXTURE — ${q} (sample A)`, 199), mk(`DEV FIXTURE — ${q} (sample B)`, 499)];
}
