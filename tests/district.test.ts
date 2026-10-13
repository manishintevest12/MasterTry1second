import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDistrictMovies, parseDistrictOffers } from '../server/workers/parsers/district';

const source: any = { id: 'w_movies_district', method: 'direct_http', vertical: 'movies' };

const body = `<html><script type="application/ld+json">{"@context":"https://schema.org","@type":"ItemList","name":"Movie Ticket Booking","itemListElement":[
{"@type":"ListItem","position":1,"url":"https://www.district.in/movies/drishyam-the-conclusion-movie-tickets-MV207254","name":"Drishyam: The Conclusion","image":"https://cdn.district.in/movies-assets/images/cinema/a.jpg"},
{"@type":"ListItem","position":2,"url":"https://www.district.in/movies/other-mommy-movie-tickets-MV207240","name":"Other Mommy","image":"https://cdn.district.in/movies-assets/images/cinema/b.jpg"},
{"@type":"ListItem","position":3,"url":"https://evil.example.com/steal","name":"Evil","image":"x"}]}</script>
<script type="application/ld+json">{"@type":"Organization","url":"https://www.district.in"}</script></html>`;

test('district: parses JSON-LD ItemList; non-district URLs rejected', () => {
  const movies = parseDistrictMovies(body);
  assert.equal(movies.length, 2);
  assert.equal(movies[0].name, 'Drishyam: The Conclusion');
});

test('district: strict matching and web deeplinks', () => {
  const movies = parseDistrictMovies(body);
  const offers = parseDistrictOffers(movies, source, 'drishyam the conclusion');
  assert.equal(offers.length, 1);
  const o = offers[0];
  assert.equal(o.seller, 'District by Zomato (Paytm)');
  assert.equal(o.sellerUrl, 'https://www.district.in/movies/drishyam-the-conclusion-movie-tickets-MV207254');
  assert.equal(o.attributes!.availability, 'now_showing');
  assert.equal(o.attributes!.image_url, 'https://cdn.district.in/movies-assets/images/cinema/a.jpg');
  assert.equal(parseDistrictOffers(movies, source, 'jailer 2').length, 0);
});

test('district: malformed body yields no items', () => {
  assert.equal(parseDistrictMovies('<html>blocked</html>').length, 0);
});
