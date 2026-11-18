import 'dart:convert';

/// Movie price -> THEATRE (owner 18 Nov: "maine kaha tha best price yaa cheapest price movie mai jb bata
/// rahe ho app mai tho movie theatre ka naam v batao").
///
/// The movie card prints ONE headline number ("₹100 · BEST PRICE") that comes from the cheapest provider
/// row, and that row is a SELLER (BookMyShow / District / TicketNew). Nothing on the card named the cinema
/// that number belongs to, so the user could not tell where to go.
///
/// This is the rule already proven on the CHEAPEST line (v1.8.99+106), now shared by the headline price,
/// and mirrored byte-for-byte on the web card (src/lib/movieVenue.ts) so the two cards can never disagree:
///
///  1. the seat-level cheapest show may name its cinema only when its price EQUALS the advertised price,
///  2. a printed showtime whose seat class carries exactly the advertised price names that cinema + time,
///  3. a printed showtime whose seat class is CHEAPER than the advertised price still names its cinema (it
///     cannot contradict the headline, because it is below it),
///  4. otherwise NO cinema is named from a price - the caller shows the real theatre list instead of an
///     unproven hall. We never invent a venue: that is the "₹100 best price / ₹180 cheapest" bug again.
class MovieVenue {
  const MovieVenue({
    required this.theatre,
    required this.time,
    required this.price,
    required this.seatClass,
    required this.exact,
  });

  final String theatre;
  final String time;
  final double price;
  final String seatClass;

  /// true when a printed show carries EXACTLY the advertised price, so the cinema truly owns that number.
  final bool exact;
}

double _money(Object? v) {
  if (v is num) return v > 0 ? v.toDouble() : 0;
  final n = double.tryParse('$v'.replaceAll(RegExp(r'[^0-9.]'), '')) ?? 0;
  return n > 0 ? n : 0;
}

/// A spec may arrive as a JSON string (attribute pipeline) or already parsed.
List _list(Object? raw) {
  if (raw is List) return raw;
  try {
    final v = jsonDecode('${raw ?? '[]'}');
    return v is List ? v : const [];
  } catch (_) {
    return const [];
  }
}

Map<String, dynamic>? _seat(Object? raw) {
  if (raw is Map) return raw.cast<String, dynamic>();
  try {
    final v = jsonDecode('${raw ?? 'null'}');
    return v is Map ? v.cast<String, dynamic>() : null;
  } catch (_) {
    return null;
  }
}

/// The cinema that owns [best], or null when no printed show can prove one.
MovieVenue? movieVenueForPrice(List shows, Map<String, dynamic>? seatCheapest, double best) {
  if (!(best > 0)) return null;
  final seatPrice = _money(seatCheapest?['price']);

  // 1. Seat-level cheapest show: a live seat map at that exact fare is the strongest evidence.
  if (seatCheapest != null && seatPrice == best) {
    return MovieVenue(
      theatre: '${seatCheapest['theatre'] ?? ''}',
      time: '${seatCheapest['time'] ?? ''}',
      price: seatPrice,
      seatClass: '${seatCheapest['seatClass'] ?? ''}',
      exact: true,
    );
  }

  // 2/3. Printed showtimes: exact match first, then any show BELOW the headline price.
  MovieVenue? below;
  for (final sh in shows) {
    if (sh is! Map) continue;
    for (final a in _list(sh['areas'])) {
      if (a is! Map) continue;
      final p = _money(a['price']);
      if (p <= 0) continue;
      if (p == best) {
        return MovieVenue(
          theatre: '${sh['theatre'] ?? ''}',
          time: '${sh['time'] ?? ''}',
          price: p,
          seatClass: '${a['label'] ?? ''}',
          exact: true,
        );
      }
      if (p < best && below == null) {
        below = MovieVenue(
          theatre: '${sh['theatre'] ?? ''}',
          time: '${sh['time'] ?? ''}',
          price: p,
          seatClass: '${a['label'] ?? ''}',
          exact: false,
        );
      }
    }
  }
  return below;
}

/// Theatre names the source itself lists for this movie (never price-linked - context only).
List<String> movieTheatreNames(Object? raw, List shows) {
  final out = <String>[];
  void push(Object? v) {
    final s = '${v ?? ''}'.trim();
    if (s.isNotEmpty && !out.contains(s)) out.add(s);
  }

  // `theatres` spec: "PVR Treasure Island | Velocity 3D | ..." (gateway aggregate).
  '${raw ?? ''}'.split('|').forEach(push);
  for (final sh in shows) {
    if (sh is Map) push(sh['theatre']);
  }
  return out;
}

/// "3:15 PM" from District's ISO time; free text passes through unchanged.
String movieTimeLabel(Object? t) {
  final s = '${t ?? ''}';
  final m = RegExp(r'^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})').firstMatch(s);
  if (m == null) return s;
  final h = int.parse(m.group(1)!);
  final ap = h >= 12 ? 'PM' : 'AM';
  return '${h % 12 == 0 ? 12 : h % 12}:${m.group(2)} $ap';
}

/// The one line the movie card prints under its price, so the theatre is ALWAYS named:
///  - "at Drama Factory · 3:15 PM" when a show carries that price,
///  - "in theatres: PVR Treasure Island, Velocity 3D +2" when no show can prove it (real names, no fake claim).
/// Empty when the source gave no theatre at all (nothing honest to add beyond the seller badge).
String movieVenueLine({
  Object? showtimes,
  Object? cheapestShow,
  Object? theatres,
  required double best,
}) {
  final shows = _list(showtimes);
  final venue = movieVenueForPrice(shows, _seat(cheapestShow), best);
  if (venue != null && venue.theatre.trim().isNotEmpty) {
    final time = movieTimeLabel(venue.time);
    return 'at ${venue.theatre}${time.isEmpty ? '' : ' · $time'}';
  }
  final names = movieTheatreNames(theatres, shows);
  if (names.isEmpty) return '';
  final shown = names.take(2).join(', ');
  final more = names.length > 2 ? ' +${names.length - 2}' : '';
  return '${names.length == 1 ? 'in theatre' : 'in theatres'}: $shown$more';
}
