import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/movie_venue.dart';

/// OWNER 18 Nov ("best price yaa cheapest price movie mai ... theatre ka naam v batao"). Same fixtures as
/// tests/movieVenue.test.ts: the app card and the web card must return the SAME line for the same data.
void main() {
  final shows = [
    {
      'theatre': 'PVR Treasure Island',
      'time': '2026-11-18T15:15',
      'areas': [
        {'label': 'Silver', 'price': 180},
        {'label': 'Recliner', 'price': 420},
      ],
    },
    {
      'theatre': 'Velocity 3D',
      'time': '2026-11-18T18:40',
      'areas': [
        {'label': 'Balcony', 'price': 260},
      ],
    },
  ];

  test('a printed show at the advertised price names its theatre and time', () {
    expect(movieVenueLine(showtimes: shows, best: 180), 'at PVR Treasure Island · 3:15 PM');
    expect(movieVenueForPrice(shows, null, 180)!.exact, isTrue);
  });

  test('the seat-level cheapest show wins when it is the advertised price', () {
    final seat = {'theatre': 'Drama Factory', 'time': '2026-11-18T21:05', 'seatClass': 'Balcony', 'price': 100};
    expect(movieVenueLine(showtimes: shows, cheapestShow: seat, best: 100), 'at Drama Factory · 9:05 PM');
  });

  test('a show cheaper than the headline price may still name its cinema', () {
    final v = movieVenueForPrice(shows, null, 300)!;
    expect(v.theatre, 'PVR Treasure Island');
    expect(v.price, 180);
    expect(v.exact, isFalse);
  });

  test('no show at the price: the real theatre list is shown, never an invented hall', () {
    expect(movieVenueForPrice(shows, null, 100), isNull);
    expect(movieVenueLine(showtimes: shows, best: 100), 'in theatres: PVR Treasure Island, Velocity 3D');
    expect(
      movieVenueLine(theatres: 'PVR Treasure Island | Velocity 3D | Regal Cinema', best: 100),
      'in theatres: PVR Treasure Island, Velocity 3D +1',
    );
  });

  test('nothing honest to say when the source gave no theatre at all', () {
    expect(movieVenueLine(best: 100), '');
    expect(movieVenueLine(showtimes: const [], theatres: '', best: 0), '');
  });

  test('the attribute pipeline hands these specs over as JSON strings', () {
    expect(movieVenueLine(showtimes: jsonEncode(shows), best: 180), 'at PVR Treasure Island · 3:15 PM');
    expect(
      movieVenueLine(
        cheapestShow: '{"theatre":"Drama Factory","time":"21:05","price":"100"}',
        best: 100,
      ),
      'at Drama Factory · 21:05',
    );
    expect(movieTimeLabel('garbage'), 'garbage');
  });
}
