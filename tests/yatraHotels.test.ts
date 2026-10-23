import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseYatraHotels, parseYatraOffers, yatraPageSearchUrl, yatraSrpUrl, ddmmyyyy,
} from '../server/workers/parsers/yatraHotels';

const source: any = { id: 'w_hotels_yatra', method: 'direct_http', vertical: 'hotels' };

/** Faithful slice of the real tgapi pageSearch response (17 Oct 2026). */
const body = {
  meta: { status: 'SUCCESS', count: 10, lastPage: false },
  data: {
    content: {
      totalResultCount: 765,
      hotels: [
        {
          id: '00211822', n: 'Golden Landmark Green Valley Beach Resort', orgName: 'Golden Landmark Green Valley Beach Resort',
          hsk: 'golden-landmark-green-valley-beach-resort-00211822',
          gr: { rating: 4.9, reviews: 1402 },
          loc: { c: 'Goa', a: 'Panjim', la: 15.456358, lo: 73.81587 },
          cldImage: { url: 'https://imgcld.yatra.com/ytimages/image/upload/t_hotel_yatra_city_desktop/v6997453299/Hotel/Goa/00211822/ff_C4R34V.PNG' },
          ctg: ['Hotels'], r: 15446,
        },
        { id: '00000002', n: 'No Rate Hotel', gr: { rating: 3.0, reviews: 5 }, loc: { c: 'Goa' }, cldImage: {} },
      ],
    },
    rates: {
      hotels: [
        {
          id: '00211822', roomsLeft: 5, price: 5003.0, basePrice: 4500.0, freeCancel: true,
          roomName: 'Club Class Room', bookable: true, currencyCode: 'INR',
          perNightPrice: { price: 4500.0, serviceCharge: 236.0, serviceTax: 42.0 },
        },
        { id: '00000002', price: null, bookable: true },
        { id: '00000003', price: 999.0, bookable: false }, // unbookable — never published
      ],
    },
  },
};

test('yatra: pageSearch URL format (dd/mm/yyyy dates, page+offset)', () => {
  const u = yatraPageSearchUrl('Goa', '2026-10-25', '2026-10-26', 2);
  assert.ok(u.includes('checkInDate=25/10/2026'));
  assert.ok(u.includes('checkOutDate=26/10/2026'));
  assert.ok(u.includes('city=Goa'));
  assert.ok(u.includes('page=2'));
  assert.ok(u.includes('offset=20'));
  assert.ok(u.includes('source=BOOKING_ENGINE'));
});

test('yatra: hotels joined with rates by id, fields normalized', () => {
  const hotels = parseYatraHotels(body);
  assert.equal(hotels.length, 2);
  const h = hotels[0];
  assert.equal(h.name, 'Golden Landmark Green Valley Beach Resort');
  assert.equal(h.id, '00211822');
  assert.equal(h.price, 5003);
  assert.equal(h.basePrice, 4500);
  assert.equal(h.roomName, 'Club Class Room');
  assert.equal(h.rating, 4.9);
  assert.equal(h.reviews, 1402);
  assert.equal(h.city, 'Goa');
  assert.equal(h.area, 'Panjim');
  assert.equal(h.lat, 15.456358);
  assert.equal(h.imageUrl!.includes('imgcld.yatra.com'), true);
  assert.equal(h.rackRate, 15446);
  assert.equal(h.bookable, true);
  assert.equal(h.roomsLeft, 5);
  assert.equal(h.freeCancel, true);
  assert.equal(hotels[1].price, null); // no rate row for this hotel
});

test('yatra: offers — unpriced and unbookable never published', () => {
  const hotels = parseYatraHotels(body);
  const offers = parseYatraOffers(hotels, source, 'Goa', { checkin: '2026-10-25', checkout: '2026-10-26' });
  assert.equal(offers.length, 1); // "No Rate Hotel" dropped
  const o = offers[0];
  assert.equal(o.title, 'Golden Landmark Green Valley Beach Resort');
  assert.equal(o.price, 5003);
  assert.equal(o.currency, 'INR');
  assert.equal(o.seller, 'Yatra');
  assert.ok(o.sellerUrl!.startsWith('https://hotel.yatra.com/nextui/hotel-search/dom/search?'));
  assert.ok(o.sellerUrl!.includes('checkinDate=25%2F10%2F2026'));
  assert.ok(o.attributes!.price_basis.includes('total ₹5003'));
  assert.equal(o.attributes!.rating, '4.9');
  assert.equal(o.attributes!.rooms_left, '5');
  assert.equal(o.attributes!.free_cancellation, 'true');
});

test('yatra: SRP deeplink carries city + dates, dd/mm/yyyy helper', () => {
  assert.equal(ddmmyyyy('2026-10-25'), '25/10/2026');
  assert.equal(ddmmyyyy(''), '');
  const u = yatraSrpUrl('Goa', '2026-10-25', '2026-10-26');
  assert.ok(u.includes('city.name=Goa'));
  assert.ok(u.includes('country.code=IND'));
});
