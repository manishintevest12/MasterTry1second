/**
 * Wikidata hotel discovery (hotels vertical, worldwide). Independent of Booking.com and
 * Overpass: Wikidata's public SPARQL endpoint lists hotels located in a place, with the
 * official website where one is recorded. It carries NO room rates - price stays honestly
 * unknown and is never invented.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

export function wikidataHotelQuery(city: string): string {
  const safe = city.replace(/["\\\n\r]/g, '').slice(0, 60);
  return `SELECT DISTINCT ?h ?hLabel ?web ?stars ?coord WHERE {
  ?c rdfs:label "${safe}"@en .
  ?h wdt:P31/wdt:P279* wd:Q27686 .
  ?h wdt:P131* ?c .
  OPTIONAL { ?h wdt:P856 ?web }
  OPTIONAL { ?h wdt:P625 ?coord }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 40`;
}

export function parseWikidataHotels(json: any, source: SourceConfig, city: string, queryUrl: string): RawSourceItem[] {
  const rows: any[] = json?.results?.bindings || [];
  const seen = new Set<string>();
  const out: RawSourceItem[] = [];
  for (const b of rows) {
    const name = String(b?.hLabel?.value || '').trim();
    const qid = String(b?.h?.value || '').split('/').pop() || '';
    // A bare Q-id label means Wikidata has no English name: not a displayable property
    if (!name || /^Q\d+$/.test(name) || seen.has(qid)) continue;
    seen.add(qid);
    const web = String(b?.web?.value || '');
    const coord = String(b?.coord?.value || '').match(/Point\(([-\d.]+) ([-\d.]+)\)/);
    out.push(newRawItem(source, {
      title: name.slice(0, 200),
      seller: 'Wikidata (CC0)',
      sellerUrl: web || `https://www.wikidata.org/wiki/${qid}`,
      currency: 'INR',
      location: { city },
      attributes: {
      property_name: name.slice(0, 200),
        property_type: 'hotel',
        ...(coord ? { lat: Number(coord[2]).toFixed(5), lon: Number(coord[1]).toFixed(5) } : {}),
        ...(web ? { official_website: web.slice(0, 200) } : {}),
        data_note: 'Property listing from Wikidata (CC0); room rates are not in this dataset and are never invented',
      },
      evidence: {
        sourceUrl: queryUrl,
        sourceReference: `wikidata:${qid}`,
        extractedFields: ['title', 'location', ...(web ? ['official_website'] : []), ...(coord ? ['coordinates'] : [])],
      },
    }));
  }
  return out.slice(0, 25);
}
