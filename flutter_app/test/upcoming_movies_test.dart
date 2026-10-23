import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';

import 'package:try1second/core/api.dart';
import 'package:try1second/core/compare.dart';

/// Upcoming Movies (owner 22 Oct): BMS upcoming tab model + movie card
/// showtime/seat-price UI. Every value must come from the live payload —
/// missing fields stay null, never invented.
void main() {
  test('UpcomingMovie parses the full BMS payload honestly', () {
    final m = UpcomingMovie.fromJson({
      'title': 'Killer',
      'genres': 'Action/Sci-Fi/Thriller',
      'likes': '15.2K+ Likes',
      'releaseDate': '30, Oct 2026',
      'poster': 'https://assets-in.bmscdn.com/discovery-catalog/events/tr:w-400/p.jpg',
      'pageUrl': 'https://in.bookmyshow.com/indore/movies/killer/ET003',
      'eventCode': 'ET003',
      'trailerUrl': 'https://www.youtube.com/results?search_query=Killer%20official%20trailer',
      'goUrl': '/api/out?t=eyJk',
    });
    expect(m.title, 'Killer');
    expect(m.releaseDate, '30, Oct 2026');
    expect(m.genres, contains('Sci-Fi'));
    expect(m.goUrl, startsWith('/api/out?t='));
    expect(m.trailerUrl, contains('youtube.com'));

    // missing optional fields stay null — no fabrication
    final bare = UpcomingMovie.fromJson({'title': 'Nenu Naa Lalli', 'pageUrl': 'https://in.bookmyshow.com/x', 'trailerUrl': '', 'goUrl': ''});
    expect(bare.genres, isNull);
    expect(bare.likes, isNull);
    expect(bare.releaseDate, isNull);
    expect(bare.poster, isNull);
    expect(bare.eventCode, isNull);
  });

  test('movie row spec keeps the showtimes JSON for the card UI', () {
    final showtimes = jsonEncode([
      {
        'time': '2026-10-23T06:30',
        'theatre': 'Mangal Multiplex, Vijay Nagar',
        'areas': [
          {'label': 'GOLD', 'price': 130},
          {'label': 'SILVER', 'price': 130},
          {'label': 'PLATINUM', 'price': 160},
        ],
      },
      {'time': '14:45', 'theatre': 'Kalyan Cinemas', 'areas': [{'label': 'RECLINER', 'price': 249}]},
    ]);
    final it = CompareItem.fromJson({
      'vertical': 'movies',
      'title': 'Tum Mere Ho',
      'subtitle': 'BookMyShow',
      'provider': 'BookMyShow',
      'description': '5 shows today',
      'specs': {
        'price band': '₹130–₹450',
        'shows today': '5',
        'showtimes': showtimes,
      },
      'sellerQuotes': [
        {'seller': 'BookMyShow', 'url': '/api/out?t=abc.sig', 'price': 130},
      ],
    });
    expect(it.isMovie, isTrue);
    expect(it.spec('showtimes'), isNotEmpty);
    final parsed = jsonDecode(it.spec('showtimes')) as List;
    expect(parsed.first['time'], '2026-10-23T06:30');
    expect((parsed.first['areas'] as List).first['price'], 130);
  });
}
