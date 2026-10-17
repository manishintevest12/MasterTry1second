import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emtCityPaths, parseEmtLdJson, parseEmtHotelLinks, parseEmtHotels, parseEmtOffers,
  emtIdFromImage, ddmmyyyyDash,
} from '../server/workers/parsers/emtHotels';

const source: any = { id: 'w_hotels_emt', method: 'direct_http', vertical: 'hotels' };

/** Faithful slice of the real EMT city SSR page (17 Oct 2026). */
const pageHtml = `<html><body>
<a href="https://www.easemytrip.com/hotels/estrela-do-mar-beach-resort-a-beach-property-goa-100557/">x</a>
<a href="https://www.easemytrip.com/hotels/hotels-in-lucknow/">x</a>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"ItemList","itemListElement":[
{"@type":"Hotel","name":"Estrela Do Mar Beach Resort - A Beach Property, Goa","starRating":{"@type":"Rating","ratingValue":"4"},"address":{"@type":"PostalAddress","streetAddress":"North Goa>Calangute","addressRegion":"Goa"},"geo":{"@type":"GeoCoordinates","latitude":15.551139,"longitude":73.75488},"priceRange":"5693","image":"https://img.easemytrip.com/emthotel-100557/70/32/na/s/39617594_0.jpg","checkInTime":"02:00 PM","checkOutTime":"11:00 AM"},
{"@type":"Hotel","name":"Unpriced Hotel","starRating":{"@type":"Rating","ratingValue":"3"},"address":{"streetAddress":"South Goa"},"priceRange":"","image":"https://img.easemytrip.com/emthotel-999888/1.jpg"}
]}</script>
</body></html>`;

test('emt: city path candidates from variants', () => {
  assert.equal(emtCityPaths('Goa')[0], 'hotels/hotels-in-goa');
  assert.ok(emtCityPaths('New Delhi').includes('hotels/hotels-in-delhi'));
  assert.ok(emtCityPaths('Puducherry').includes('hotels/hotels-in-pondicherry'));
});

test('emt: hotel id lifted from image host segment', () => {
  assert.equal(emtIdFromImage('https://img.easemytrip.com/emthotel-100557/70/32/na/s/39617594_0.jpg'), '100557');
  assert.equal(emtIdFromImage('https://example.com/x.jpg'), null);
  assert.equal(emtIdFromImage(null), null);
});

test('emt: JSON-LD ItemList parsed, links harvested, hotels normalized', () => {
  const items = parseEmtLdJson(pageHtml);
  assert.equal(items.length, 2);
  const links = parseEmtHotelLinks(pageHtml);
  assert.equal(links.size, 1); // only property anchors (city pages lack -<id> suffix pattern)
  assert.ok(links.get('100557')!.includes('estrela-do-mar'));
  const hotels = parseEmtHotels(items, links);
  const h = hotels[0];
  assert.equal(h.name, 'Estrela Do Mar Beach Resort - A Beach Property, Goa');
  assert.equal(h.id, '100557');
  assert.equal(h.price, 5693);
  assert.equal(h.starRating, 4);
  assert.equal(h.area, 'North Goa');
  assert.equal(h.locality, 'Calangute');
  assert.equal(h.region, 'Goa');
  assert.equal(h.latitude, 15.551139);
  assert.ok(h.deeplink!.includes('estrela-do-mar-beach-resort-a-beach-property-goa-100557'));
  assert.equal(h.checkInTime, '02:00 PM');
  assert.equal(hotels[1].price, null); // priceRange "" -> null
});

test('emt: offers — unpriced hotels never published, deeplink joined by id', () => {
  const hotels = parseEmtHotels(parseEmtLdJson(pageHtml), parseEmtHotelLinks(pageHtml));
  const offers = parseEmtOffers(hotels, source, 'Goa', { checkin: '2026-10-25', checkout: '2026-10-26', path: 'hotels/hotels-in-goa' });
  assert.equal(offers.length, 1); // unpriced dropped
  const o = offers[0];
  assert.equal(o.price, 5693);
  assert.equal(o.currency, 'INR');
  assert.equal(o.seller, 'EaseMyTrip');
  assert.equal(o.sellerUrl, 'https://www.easemytrip.com/hotels/estrela-do-mar-beach-resort-a-beach-property-goa-100557/');
  assert.equal(o.attributes.star_rating, '4');
  assert.equal(o.attributes.property_id, '100557');
  assert.ok(String(o.evidence.sourceUrl).includes('checkin=25-10-2026'));
});

test('emt: dd-mm-yyyy URL date helper', () => {
  assert.equal(ddmmyyyyDash('2026-10-25'), '25-10-2026');
  assert.equal(ddmmyyyyDash(''), '');
});
