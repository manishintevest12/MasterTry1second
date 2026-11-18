import assert from 'node:assert/strict';
import test from 'node:test';
import { movieVenueForPrice, movieVenueLine, parseMovieList, movieTimeLabel } from '../src/lib/movieVenue';

/**
 * OWNER 18 Nov: "maine kaha tha best price yaa cheapest price movie mai jb bata rahe ho app mai tho movie
 * theatre ka naam v batao." The card's headline price belongs to a seller row, so the cinema was missing.
 * The rule (mirrored in the Flutter app, flutter_app/lib/core/movie_venue.dart): only a printed show may
 * name a cinema for a price; otherwise the real theatre list is shown and nothing is invented.
 */
const shows = [
  { theatre: 'PVR Treasure Island', time: '2026-11-18T15:15', areas: [{ label: 'Silver', price: 180 }, { label: 'Recliner', price: 420 }] },
  { theatre: 'Velocity 3D', time: '2026-11-18T18:40', areas: [{ label: 'Balcony', price: 260 }] },
];

test('a printed show carrying exactly the advertised price names its theatre and time', () => {
  const v = movieVenueForPrice(shows as any, null, 180);
  assert.equal(v?.theatre, 'PVR Treasure Island');
  assert.equal(v?.exact, true);
  assert.equal(movieVenueLine({ showtimes: shows, best: 180 }), 'at PVR Treasure Island · 3:15 PM');
});

test('the seat-level cheapest show wins when it is the advertised price', () => {
  const seat = { theatre: 'Drama Factory', time: '2026-11-18T21:05', seatClass: 'Balcony', price: 100 };
  assert.equal(movieVenueLine({ showtimes: shows, cheapestShow: seat, best: 100 }), 'at Drama Factory · 9:05 PM');
});

test('a show CHEAPER than the headline price may still name its cinema (it never contradicts it)', () => {
  const v = movieVenueForPrice(shows as any, null, 300);
  assert.equal(v?.theatre, 'PVR Treasure Island');
  assert.equal(v?.price, 180);
  assert.equal(v?.exact, false);
});

test('no printed show at the price: the real theatre list is shown, never an invented hall', () => {
  // The "₹100 best price vs ₹180 cheapest" case: no show carries ₹100, so no cinema may own it.
  assert.equal(movieVenueForPrice(shows as any, null, 100)?.theatre, undefined);
  assert.equal(movieVenueLine({ showtimes: shows, best: 100 }), 'in theatres: PVR Treasure Island, Velocity 3D');
  assert.equal(
    movieVenueLine({ theatres: 'PVR Treasure Island | Velocity 3D | Regal Cinema', best: 100 }),
    'in theatres: PVR Treasure Island, Velocity 3D +1',
  );
});

test('nothing honest to say when the source gave no theatre at all', () => {
  assert.equal(movieVenueLine({ best: 100 }), '');
  assert.equal(movieVenueLine({ showtimes: [], theatres: '', best: 0 }), '');
});

test('the attribute pipeline hands these specs over as JSON strings', () => {
  assert.equal(movieVenueLine({ showtimes: JSON.stringify(shows), best: 180 }), 'at PVR Treasure Island · 3:15 PM');
  assert.equal(
    movieVenueLine({ cheapestShow: JSON.stringify({ theatre: 'Drama Factory', time: '21:05', price: '100' }), best: 100 }),
    'at Drama Factory · 21:05',
  );
  assert.deepEqual(parseMovieList('[{"theatre":"A"}]'), [{ theatre: 'A' }]);
  assert.equal(movieTimeLabel('garbage'), 'garbage');
});
