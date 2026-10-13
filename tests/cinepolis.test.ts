import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCinepolisPage, parseCinepolisMovies, cinepolisDisplayTitle } from '../server/workers/parsers/cinepolis';

const source: any = { id: 'w_movies_cinepolis', method: 'direct_http', vertical: 'movies' };

function pageBody(nowPlaying: any, comingSoon: any[]): string {
  const next = { props: { pageProps: { nowPlayingMoviesData: nowPlaying, comingSoonMoviesData: comingSoon } } };
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(next)}</script></body></html>`;
}

const comingSoon = [
  { Title: 'JAILER 2 (TAMIL)', movie_id: 13730, movie_lang: 'Tamil', m_movie_genre_name: 'Action', run_time: 165,
    movie_release_date: '2026-10-15T00:00:00.000Z', movie_trailer: 'https://youtu.be/x',
    movie_image_url_1: 'https://api_new.cinepolisindia.com/uploads/images/movies/1791809373766-JAILER 2.jpg.jpg' },
  { Title: 'FAST & FURIOUS 7 - 3D REAL D (3D) (ENG WI ENG SUB)', movie_id: 13726, movie_lang: 'English', run_time: 140 },
  { Title: '' }, // empty title — must be dropped
];

test('cinepolis: parses comingSoon from __NEXT_DATA__; empty-title rows dropped', () => {
  const data = parseCinepolisPage(pageBody({}, comingSoon));
  assert.equal(data.comingSoon.length, 2);
  assert.equal(data.nowPlaying.length, 0);
});

test('cinepolis: strict matching — unknown movie yields honest empty; images URL-encoded', () => {
  const data = parseCinepolisPage(pageBody({}, comingSoon));
  const offers = parseCinepolisMovies(data, source, 'jailer 2');
  assert.equal(offers.length, 1);
  const o = offers[0];
  assert.equal(o.title, 'JAILER 2'); // language suffix stripped for display
  assert.equal(o.seller, 'Cinepolis India');
  assert.equal(o.attributes!.image_url, 'https://api_new.cinepolisindia.com/uploads/images/movies/1791809373766-JAILER%202.jpg.jpg');
  assert.equal(o.attributes!.availability, 'coming_soon');
  assert.equal(o.attributes!.release_date, '2026-10-15');
  assert.equal(parseCinepolisMovies(data, source, 'kantara chapter 2').length, 0);
});

test('cinepolis: now-playing values parse when a valid city page serves them', () => {
  const data = parseCinepolisPage(pageBody({ '5': { Title: 'KANTARA CHAPTER 2', movie_lang: 'Kannada' } }, []));
  assert.equal(data.nowPlaying.length, 1);
  const offers = parseCinepolisMovies(data, source, 'kantara');
  assert.equal(offers.length, 1);
  assert.equal(offers[0].attributes!.availability, 'now_showing');
});

test('cinepolis: malformed body yields no items', () => {
  const d = parseCinepolisPage('<html>Access Denied</html>');
  assert.equal(d.comingSoon.length, 0);
  assert.equal(parseCinepolisMovies(d, source, '').length, 0);
});

test('cinepolis: display title cleanup keeps titles without parentheses intact', () => {
  assert.equal(cinepolisDisplayTitle('Dorothy'), 'Dorothy');
  assert.equal(cinepolisDisplayTitle('SITA RAMAM (TELUGU)'), 'SITA RAMAM');
});
