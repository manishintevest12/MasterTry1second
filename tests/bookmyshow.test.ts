import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMovieCards, matchesQuery, bmsDiscoverUrl, bmsDiscoverHeaders } from '../server/workers/parsers/bookmyshow';

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
