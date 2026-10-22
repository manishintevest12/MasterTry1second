import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMovieCards, matchesQuery, bmsDiscoverUrl, bmsDiscoverHeaders, parseUpcomingCards } from '../server/workers/parsers/bookmyshow';

const source: any = { id: 'w_movies_bookmyshow', method: 'direct_http', vertical: 'movies' };
const region = { regionCode: 'BANG', regionSlug: 'bengaluru', regionName: 'Bengaluru' };

const sample = {
  listings: [
    { cards: [
      { id: 'EG00410984', ctaUrl: 'https://in.bookmyshow.com/movies/bengaluru/premada-oorali/ET00412717',
        text: [
          { components: [{ text: 'Premada Oorali' }] },
          { components: [{ text: 'UA16+' }] },
          { components: [{ text: 'Kannada' }] },
        ],
        image: { url: 'https://assets-in.bmscdn.com/discovery-catalog/events/et00412717-portrait.jpg' } },
      // promo card — must be dropped (not a movie deeplink)
      { id: 'PROMO1', ctaUrl: 'https://in.bookmyshow.com/offers', text: [{ components: [{ text: 'Super saver' }] }] },
    ] },
    { cards: [
      { id: 'EG00410985', ctaUrl: 'https://in.bookmyshow.com/movies/bengaluru/jailer-2/ET00412718',
        text: [
          { components: [{ text: 'Jailer 2' }] },
          { components: [{ text: 'UA' }] },
          { components: [{ text: 'Tamil' }] },
        ],
        image: { url: 'https://assets-in.bmscdn.com/discovery-catalog/events/et00412718-portrait.jpg' } },
    ] },
  ],
};

test('bms: parses real movie cards with poster, deeplink, language; drops promo cards', () => {
  const items = parseMovieCards(sample, source, region, '', 'fp');
  assert.equal(items.length, 2);
  const it = items[0];
  assert.equal(it.title, 'Premada Oorali');
  assert.equal(it.seller, 'BookMyShow');
  assert.equal(it.sellerUrl, 'https://in.bookmyshow.com/movies/bengaluru/premada-oorali/ET00412717');
  assert.equal(it.attributes!.image_url, 'https://assets-in.bmscdn.com/discovery-catalog/events/et00412717-portrait.jpg');
  assert.equal(it.attributes!.language, 'Kannada');
  assert.equal(it.attributes!.certification, 'UA16+');
  assert.equal(it.attributes!.event_code, 'EG00410984');
  assert.equal(it.price, undefined); // honest: no ticket price in the card payload
  assert.ok(it.evidence.extractedFields.includes('title'));
});

test('bms: strict token matching — every query token must appear in the title', () => {
  assert.equal(matchesQuery('Jailer 2', 'jailer 2'), true);
  assert.equal(matchesQuery('Coconut Milk Special', 'amul milk'), false);
  assert.equal(matchesQuery('Amul Milk', 'amul milk'), true);
  // stopwords in a movies query are ignored, not treated as required tokens
  assert.equal(matchesQuery('Jailer 2', 'jailer movie tickets'), true);
  assert.equal(parseMovieCards(sample, source, region, 'jailer 2', 'fp').length, 1);
  assert.equal(parseMovieCards(sample, source, region, 'rrr', 'fp').length, 0); // no substitutes, honest empty
});

test('bms: discover url + headers carry region code for geo-accurate listings', () => {
  assert.equal(bmsDiscoverUrl(region), 'https://in.bookmyshow.com/api/explore/v1/discover/movies-bengaluru?region=BANG&embedded=true');
  assert.equal(bmsDiscoverHeaders(region)['x-region-code'], 'BANG');
  assert.equal(bmsDiscoverHeaders(region)['x-app-code'], 'WEB');
});

test('query: "in chennai" city extraction survives undefined caller-provided location', async () => {
  const { understandQuery } = await import('../server/query/queryUnderstanding');
  const q = understandQuery('jailer 2 movie tickets in chennai', { pincode: undefined, city: undefined });
  assert.equal(q.location.city, 'Chennai');
  assert.equal(q.vertical, 'movies');
});

// ---------------------------------------------------------------------------
// Upcoming movies (owner 22 Oct): the homepage Upcoming Movies section parses
// BMS's own upcoming-discovery tab. Release dates come from BMS's base64
// poster metadata — decoded, never invented. Promo cards must be dropped.
// ---------------------------------------------------------------------------

test('bms upcoming: parses real upcoming cards, decodes release date from poster, drops promos', () => {
  const b64 = Buffer.from('24, Oct 2026', 'utf8').toString('base64');
  const payload = {
    listings: [
      { cards: [
        {
          id: 'ET00455111',
          ctaUrl: 'https://in.bookmyshow.com/movies/indore/jayaho-ramanuja/ET00455111',
          text: [
            { components: [{ text: 'Jayaho Ramanuja' }] },
            { components: [{ text: 'Biography/Devotional/Drama' }] },
            { components: [{ text: '10.3K+ Likes' }] },
          ],
          image: { url: `https://assets-in.bmscdn.com/discovery-catalog/events/tr:w-400,ie-${b64},/et00455111-portrait.jpg` },
        },
        // promo card — not an upcoming movie
        { id: 'PROMOX', ctaUrl: 'https://in.bookmyshow.com/explore', text: [{ components: [{ text: 'Explore' }] }] },
      ] },
    ],
  };
  const ms = parseUpcomingCards(payload, { regionCode: 'INDO', regionSlug: 'indore', regionName: 'Indore' } as any);
  assert.equal(ms.length, 1);
  const m = ms[0];
  assert.equal(m.title, 'Jayaho Ramanuja');
  assert.equal(m.releaseDate, '24, Oct 2026');
  assert.equal(m.genres, 'Biography/Devotional/Drama');
  assert.equal(m.likes, '10.3K+ Likes');
  assert.equal(m.eventCode, 'ET00455111');
  assert.equal(m.pageUrl.startsWith('https://in.bookmyshow.com/movies/'), true);
  // no date in poster metadata -> honestly null, never invented
  const noDate = parseUpcomingCards({ listings: [{ cards: [{
    id: 'ET1', ctaUrl: 'https://in.bookmyshow.com/movies/x/ET1',
    text: [{ components: [{ text: 'X' }] }, { components: [{ text: 'Drama' }] }, { components: [{ text: '5+ Likes' }] }],
    image: { url: 'https://assets-in.bmscdn.com/discovery-catalog/events/plain.jpg' },
  }] }] }, {} as any);
  assert.equal(noDate[0].releaseDate, null);
});
