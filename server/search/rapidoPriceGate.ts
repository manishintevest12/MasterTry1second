/**
 * RAPIDO PRICE GATE (owner 31 Oct: "intercity ride mai hide kro, aur city rides mai dikhao
 * results with price so simple").
 *
 * Rapido publishes no intercity service at all (their own guest fare API answers HTTP 500
 * for a two-city trip), and its live city quotes are computed by a signed call that can
 * fail. A Rapido card with no fare is therefore never shown: intercity searches carry no
 * Rapido row, and a city search shows Rapido only when the live quote actually arrived.
 *
 * Applied centrally (after the vertical engine, before ranking) so no other path — a
 * catalogue replay, a cached row written by an older build, a presence builder — can
 * reintroduce a priceless Rapido card. Priced Rapido rows pass through untouched.
 */

const isRapido = (offer: any): boolean => {
  const seller = String(offer?.seller || offer?.vendor || offer?.brand || '').toLowerCase();
  const src = String(offer?.provenance?.sourceId || '').toLowerCase();
  return seller.includes('rapido') || src.includes('rapido');
};

const pricedOf = (offer: any): number =>
  Number(offer?.prices?.effectivePrice ?? offer?.prices?.mandatoryTotal ?? offer?.prices?.listPrice ?? 0) || 0;

export interface RapidoGateResult<T> {
  kept: T[];
  dropped: Array<{ title: string; seller: string; reason: 'no_fare' | 'intercity' }>;
}

/**
 * @param intercity true when the searched trip runs between two different cities — Rapido
 * only operates inside a city, so every Rapido row is hidden in that case regardless of price.
 */
export function gateRapidoRows<T extends Record<string, any>>(offers: T[], intercity = false): RapidoGateResult<T> {
  const kept: T[] = [];
  const dropped: RapidoGateResult<T>['dropped'] = [];
  for (const offer of offers || []) {
    if (!isRapido(offer)) { kept.push(offer); continue; }
    if (intercity) {
      dropped.push({ title: String(offer?.title || '').slice(0, 80), seller: 'Rapido', reason: 'intercity' });
      continue;
    }
    if (pricedOf(offer) > 0) { kept.push(offer); continue; }
    dropped.push({ title: String(offer?.title || '').slice(0, 80), seller: 'Rapido', reason: 'no_fare' });
  }
  return { kept, dropped };
}
