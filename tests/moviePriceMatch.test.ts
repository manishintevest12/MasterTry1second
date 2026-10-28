import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchAgg } from '../server/workers/verticals/movies';
import type { GwMovieAgg } from '../server/workers/parsers/districtGw';

/**
 * Owner 27 Oct: movie cards came back with no price even though the seat-price gateway
 * answered (Drishyam Rs.100, Hope Rs.149 in Indore). Root cause was the title matcher
 * demanding that EVERY word of the BookMyShow card appear in the gateway's title, so
 * "Namit Malhotra's Ramayana" never met "Ramayana" and the price was silently dropped.
 * It must now match the same film in both directions without ever lending one film
 * another film's price band (sequels especially).
 */

function agg(title: string, minPrice = 100): GwMovieAgg {
  return {
    mids: new Set<string>(['m1']),
    title,
    minPrice,
    maxPrice: minPrice,
    showCount: 1,
    theatres: ['PVR Treasure Island'],
    shows: [],
    contentId: null,
    posterUrl: null,
    censor: null,
    durationMin: null,
    genres: null,
  } as unknown as GwMovieAgg;
}

function book(titles: string[]): Map<string, GwMovieAgg> {
  const m = new Map<string, GwMovieAgg>();
  for (const t of titles) m.set(t.toLowerCase(), agg(t, 100 + m.size));
  return m;
}

describe('matchAgg (movie seat-price attach)', () => {
  it('matches when the gateway title is contained in the longer card title', () => {
    const aggs = book(['Ramayana']);
    const hit = matchAgg(aggs, "Namit Malhotra's Ramayana");
    assert.ok(hit, 'expected a match for the longer card title');
    assert.equal(hit!.title, 'Ramayana');
  });

  it('matches an exact title', () => {
    const hit = matchAgg(book(['Drishyam The Conclusion', 'Hope']), 'Drishyam The Conclusion');
    assert.equal(hit?.title, 'Drishyam The Conclusion');
  });

  it('never lends a sequel the original film price band', () => {
    const aggs = book(['Drishyam']);
    assert.equal(matchAgg(aggs, 'Drishyam 2'), null);
    const reverse = book(['Drishyam 2']);
    assert.equal(matchAgg(reverse, 'Drishyam'), null);
  });

  it('never matches an unrelated film on a partial overlap', () => {
    const aggs = book(['Tu Hai Meri Kiran']);
    assert.equal(matchAgg(aggs, 'Titans'), null);
  });

  it('returns null for an empty book or empty title', () => {
    assert.equal(matchAgg(new Map(), 'Kantara'), null);
    assert.equal(matchAgg(book(['Hope']), ''), null);
  });
});
