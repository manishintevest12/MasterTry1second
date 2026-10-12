/**
 * Wikidata movies parser. Wikidata is an open knowledge base (CC0): SPARQL gives
 * real recently-released Indian films; wbsearchentities resolves a movie name to
 * its item + description. Showtimes and ticket prices are NOT in Wikidata and are
 * never invented.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

const WD_UA = 'Try1Second/1.0 (contact: standardpetro.in@gmail.com)';

export async function wikidataFetch(url: string, init?: RequestInit): Promise<any> {
  const r = await fetch(url, { ...init, headers: { 'User-Agent': WD_UA, Accept: 'application/sparql-results+json, application/json', ...(init?.headers as any) } });
  if (!r.ok) throw new Error(`Wikidata HTTP ${r.status}`);
  return r.json();
}

export function recentIndianFilms(days: number): string {
  const to = new Date();
  const from = new Date(Date.now() - days * 86400_000);
  const f = from.toISOString().slice(0, 10);
  const t = to.toISOString().slice(0, 10);
  return `SELECT ?filmLabel ?date WHERE { ?film wdt:P31 wd:Q11424; wdt:P495 wd:Q668; wdt:P577 ?date. FILTER(?date >= "${f}"^^xsd:dateTime && ?date <= "${t}"^^xsd:dateTime) SERVICE wikibase:label { bd:serviceParam wikibase:language "en,hi". } } LIMIT 20`;
}

export function parseRecentFilms(json: any, source: SourceSourceAlias, today: string): RawSourceItem[] {
  const rows: any[] = json?.results?.bindings || [];
  const seen = new Set<string>();
  const out: RawSourceItem[] = [];
  for (const b of rows) {
    const title = b.filmLabel?.value;
    const date = b.date?.value?.slice(0, 10);
    if (!title || seen.has(title)) continue;
    seen.add(title);
    out.push(newRawItem(source, {
      title: title.slice(0, 200),
      seller: 'Wikidata (CC0)',
      sellerUrl: 'https://www.wikidata.org/wiki/Q668',
      currency: 'INR',
      travel: date ? { date } : undefined,
      attributes: {
        release_date: date || 'unknown',
        data_note: 'Recently released Indian film per Wikidata; showtimes & ticket prices need a booking platform (none accessible to public HTTP today)',
      },
      evidence: {
        sourceUrl: 'https://query.wikidata.org/sparql',
        sourceReference: title,
        extractedFields: ['title', ...(date ? ['release_date'] : [])],
      },
    }));
  }
  return out.slice(0, 30);
}

export async function searchFilmEntity(name: string, source: SourceSourceAlias): Promise<RawSourceItem[]> {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json&limit=5&type=item`;
  const json = await wikidataFetch(url);
  const hits: any[] = (json?.search || []).filter((h: any) => /film|movie|motion picture|cinema/i.test(h.description || ''));
  const out: RawSourceItem[] = [];
  for (const h of hits.slice(0, 5)) {
    out.push(newRawItem(source, {
      title: `${h.label}${h.description ? ` — ${h.description}` : ''}`.slice(0, 220),
      seller: 'Wikidata (CC0)',
      sellerUrl: String(h.concepturi || ''),
      currency: 'INR',
      attributes: {
        match: h.label,
        data_note: 'Movie facts from Wikidata; showtimes & ticket prices need a booking platform',
      },
      evidence: {
        sourceUrl: 'https://www.wikidata.org',
        sourceReference: h.id,
        extractedFields: ['title', 'description'],
      },
    }));
  }
  return out;
}
// Local alias to avoid importing SourceConfig type twice
type SourceSourceAlias = import('../../types').SourceConfig;
