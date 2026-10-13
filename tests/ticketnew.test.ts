import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ticketnewCityKeys,
  ticketnewSlug,
  parseTicketNewMoviesPage,
  parseTicketNewMovies,
} from '../server/workers/parsers/ticketnew';

const source: any = { id: 'w_movies_ticketnew', method: 'direct_http', vertical: 'movies' };

function nextPageBody(movies: any[]): string {
  const next = {
    props: {
      pageProps: {
        data: {
          serverState: {
            currentlyRunningMovies: {
              chennai: { serverTime: 1791874077, meta: {}, data: { movies, groupedMovies: {} } },
            },
          },
        },
      },
    },
  };
  return `<!DOCTYPE html><html><head><title>TicketNew</title></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(next)}</script></body></html>`;
}

test('tn: city keys resolve common aliases, unknown city falls back to slugified input', () => {
  assert.deepEqual(ticketnewCityKeys('Bengaluru'), ['bengaluru', 'bangalore']);
  assert.deepEqual(ticketnewCityKeys('Chennai'), ['chennai']);
  assert.deepEqual(ticketnewCityKeys('Vizag'), ['vizag']);
  assert.deepEqual(ticketnewCityKeys(''), []);
});

test('tn: slug builder matches TicketNew deeplink format', () => {
  assert.equal(ticketnewSlug('Other Mommy'), 'other-mommy');
  assert.equal(ticketnewSlug('Jailer 2'), 'jailer-2');
  assert.equal(ticketnewSlug('Drishyam: The Conclusion'), 'drishyam-the-conclusion');
});

test('tn: parses real __NEXT_DATA__ movies with image, language, sessions; drops empty rows', () => {
  const body = nextPageBody([
    { id: 'OB66RF', name: 'Jailer 2', lang: 'Tamil', grn: ['Action', 'Drama'], censor: 'UA', duration: 168,
      appImgPath: 'https://b.zmtcdn.com/data/edition_assets/jailer2.jpg', totalSessionCount: 87 },
    { id: 'X1', name: 'Other Mommy', lang: 'English', grn: ['Horror'], censor: 'A', duration: 120,
      appImgPath: 'https://b.zmtcdn.com/data/edition_assets/other.jpg', totalSessionCount: 24 },
    { id: 'X2', name: '', lang: 'Tamil' }, // empty title — must be dropped
  ]);
  const movies = parseTicketNewMoviesPage(body, 'chennai');
  assert.equal(movies.length, 2);
  const offers = parseTicketNewMovies(movies, source, 'chennai', '');
  assert.equal(offers.length, 2);
  const o = offers[0];
  assert.equal(o.title, 'Jailer 2');
  assert.equal(o.seller, 'TicketNew');
  assert.equal(o.sellerUrl, 'https://www.ticketnew.com/chennai/movies/jailer-2');
  assert.equal(o.attributes!.image_url, 'https://b.zmtcdn.com/data/edition_assets/jailer2.jpg');
  assert.equal(o.attributes!.language, 'Tamil');
  assert.equal(o.attributes!.sessions_today, 87);
});

test('tn: strict token matching — an unknown movie name yields an honest empty, never a substitute', () => {
  const body = nextPageBody([
    { id: 'A', name: 'Jailer 2', appImgPath: 'https://b.zmtcdn.com/a.jpg', totalSessionCount: 10 },
    { id: 'B', name: 'Sardar 2', appImgPath: 'https://b.zmtcdn.com/b.jpg', totalSessionCount: 8 },
  ]);
  const movies = parseTicketNewMoviesPage(body, 'chennai');
  assert.equal(parseTicketNewMovies(movies, source, 'chennai', 'jailer 2').length, 1);
  assert.equal(parseTicketNewMovies(movies, source, 'chennai', 'kantara chapter 2').length, 0);
});

test('tn: format duplicates (2D/3D rows of the same title) collapse into one offer', () => {
  const body = nextPageBody([
    { id: 'A1', name: 'Jailer 2', appImgPath: 'https://b.zmtcdn.com/a.jpg', totalSessionCount: 10 },
    { id: 'A2', name: 'Jailer 2', appImgPath: 'https://b.zmtcdn.com/a.jpg', totalSessionCount: 12 },
    { id: 'B', name: 'Dorothy', appImgPath: 'https://b.zmtcdn.com/b.jpg', totalSessionCount: 8 },
  ]);
  const movies = parseTicketNewMoviesPage(body, 'chennai');
  const offers = parseTicketNewMovies(movies, source, 'chennai', '');
  assert.equal(offers.length, 2);
});

test('tn: malformed or plain-HTML body yields no items (never invented)', () => {
  assert.equal(parseTicketNewMoviesPage('<html><body>Access Denied</body></html>', 'chennai').length, 0);
});
