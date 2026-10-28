/// Website-parity comparison model + grouping (pure Dart, no Flutter imports).
///
/// Ported 1:1 from the web app so the mobile app shows exactly what the website
/// shows: POST /api/scrape/live returns `ComparisonItem`s (sellerQuotes with
/// /api/out deeplinks, images, specs). Grouping = "one product, one card, the
/// cheapest site on top, every other site as a row" (src/utils/offerGroups.ts and
/// hotelGroups.ts). Nothing is invented: a missing price stays unknown.
library;

class SellerQuote {
  final String id;
  final String sellerName;
  final double price;
  final double originalPrice;
  final String url; // masking pointer (/api/out?t=...), affiliate params added server-side
  final String? badge;
  final String? deliveryOrEta;
  final bool isLowest;
  final bool isLiveScraped;
  final String? sourceDomain;

  const SellerQuote({
    required this.id,
    required this.sellerName,
    required this.price,
    this.originalPrice = 0,
    required this.url,
    this.badge,
    this.deliveryOrEta,
    this.isLowest = false,
    this.isLiveScraped = false,
    this.sourceDomain,
  });

  factory SellerQuote.fromJson(Map<String, dynamic> j) => SellerQuote(
        id: '${j['id'] ?? ''}',
        sellerName: '${j['sellerName'] ?? ''}',
        price: _d(j['price']),
        originalPrice: _d(j['originalPrice']),
        url: '${j['url'] ?? ''}',
        badge: j['badge'] == null ? null : '${j['badge']}',
        deliveryOrEta: j['deliveryOrEta'] == null ? null : '${j['deliveryOrEta']}',
        isLowest: j['isLowest'] == true,
        isLiveScraped: j['isLiveScraped'] == true,
        sourceDomain: j['sourceDomain'] == null ? null : '${j['sourceDomain']}',
      );
}

class CompareItem {
  final String id;
  final String vertical;
  final String title;
  final String subtitle;
  final String provider;
  final String? imageUrl;
  final List<String> images;
  final double rating;
  final int reviewCount;
  final String description;
  final double primaryPrice;
  final double originalPrice;
  final bool priceAvailable;
  final String unit;
  final List<String> features;
  final Map<String, String> specs;
  final List<SellerQuote> sellerQuotes;
  final String? sourceId;
  /// Server-built in-app booking link (owner 22 Oct): Uber/Ola cab rows open
  /// the provider's own app prefilled via /api/cab/book -> /api/out, with the
  /// admin-configured affiliate params injected server-side.
  final String? appBookUrl;

  const CompareItem({
    required this.id,
    required this.vertical,
    required this.title,
    required this.subtitle,
    required this.provider,
    this.imageUrl,
    this.images = const [],
    this.rating = 0,
    this.reviewCount = 0,
    this.description = '',
    this.primaryPrice = 0,
    this.originalPrice = 0,
    this.priceAvailable = true,
    this.unit = '',
    this.features = const [],
    this.specs = const {},
    this.sellerQuotes = const [],
    this.sourceId,
    this.appBookUrl,
  });

  factory CompareItem.fromJson(Map<String, dynamic> j) {
    final specs = <String, String>{};
    final rawSpecs = j['specs'];
    if (rawSpecs is Map) rawSpecs.forEach((k, v) => specs['$k'.toLowerCase()] = '$v');
    final img = j['imageUrl'];
    final imgs = <String>[
      if (img is String && img.startsWith('http')) img,
      for (final x in (j['images'] as List? ?? const []))
        if (x is String && x.startsWith('http')) x,
    ];
    return CompareItem(
      id: '${j['id'] ?? ''}',
      vertical: '${j['vertical'] ?? ''}',
      title: '${j['title'] ?? ''}',
      subtitle: '${j['subtitle'] ?? ''}',
      provider: '${j['provider'] ?? ''}',
      imageUrl: img is String && img.startsWith('http') ? img : null,
      images: imgs.toSet().toList(),
      rating: _d(j['rating']),
      reviewCount: _d(j['reviewCount']).round(),
      description: '${j['description'] ?? ''}',
      primaryPrice: _d(j['primaryPrice']),
      originalPrice: _d(j['originalPrice']),
      priceAvailable: j['priceAvailable'] != false,
      unit: '${j['unit'] ?? ''}',
      features: [for (final f in (j['features'] as List? ?? const [])) '$f'],
      specs: specs,
      sellerQuotes: [
        for (final q in (j['sellerQuotes'] as List? ?? const []))
          if (q is Map<String, dynamic>) SellerQuote.fromJson(q),
      ],
      sourceId: (j['evidence'] is Map) ? '${(j['evidence'] as Map)['sourceId'] ?? ''}' : null,
      appBookUrl: (j['appBookUrl'] is String && (j['appBookUrl'] as String).isNotEmpty) ? j['appBookUrl'] as String : null,
    );
  }

  String spec(String a, [String? b, String? c]) {
    for (final k in [a, b, c]) {
      if (k == null) continue;
      final v = specs[k.toLowerCase()];
      if (v != null && v.trim().isNotEmpty && v != 'undefined') return v;
    }
    return '';
  }

  bool get priced => primaryPrice > 0 && priceAvailable;
  // Website parity (21 Oct): account savings rows carry the rate in unit ('% p.a. ...').
  bool get isRate => vertical == 'loans' || vertical == 'insurance' || unit.startsWith('%');
  bool get isMovie => vertical == 'movie' || vertical == 'movies';

  SellerQuote? get bestQuote {
    if (sellerQuotes.isEmpty) return null;
    for (final q in sellerQuotes) {
      if (q.isLowest) return q;
    }
    return sellerQuotes.first;
  }

  String get site => bestQuote?.sellerName ?? (provider.isEmpty ? 'Seller' : provider);

  CompareItem withQuote(SellerQuote q) => CompareItem(
        id: id,
        vertical: vertical,
        title: title,
        subtitle: subtitle,
        provider: provider,
        imageUrl: imageUrl,
        images: images,
        rating: rating,
        reviewCount: reviewCount,
        description: description,
        primaryPrice: q.price,
        originalPrice: originalPrice,
        priceAvailable: q.price > 0,
        unit: unit,
        features: features,
        specs: specs,
        sellerQuotes: [q],
        sourceId: sourceId,
        appBookUrl: appBookUrl,
      );
}

double _d(dynamic v) {
  if (v == null) return 0;
  final d = v is num ? v.toDouble() : double.tryParse('$v');
  return d != null && d.isFinite ? d : 0;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/// Indian digit grouping: 1,09,999
String inrAmount(num n) {
  final whole = n.round().abs().toString();
  String body;
  if (whole.length <= 3) {
    body = whole;
  } else {
    final last3 = whole.substring(whole.length - 3);
    var rest = whole.substring(0, whole.length - 3);
    final parts = <String>[];
    while (rest.length > 2) {
      parts.insert(0, rest.substring(rest.length - 2));
      rest = rest.substring(0, rest.length - 2);
    }
    if (rest.isNotEmpty) parts.insert(0, rest);
    body = '${parts.join(',')},$last3';
  }
  return '${n < 0 ? '-' : ''}₹$body';
}

/// Loans/insurance publish a RATE (% p.a.), everything else rupees.
String formatPrice(String vertical, num value) {
  if (value <= 0) return '—';
  if (vertical == 'loans' || vertical == 'insurance' || vertical == 'account') {
    final r = (value * 100).round() / 100;
    return '${r == r.roundToDouble() ? r.toInt() : r}%';
  }
  return inrAmount(value);
}

// ---------------------------------------------------------------------------
// Grouping (offerGroups.ts)
// ---------------------------------------------------------------------------

class OfferRow {
  final CompareItem item;
  final String site;
  final double price;
  final bool priceAvailable;
  const OfferRow(this.item, this.site, this.price, this.priceAvailable);
}

class OfferGroup {
  final String key;
  final String vertical;
  CompareItem lead;
  final List<OfferRow> rows;
  OfferRow best;
  double? highest;
  OfferGroup(this.key, this.vertical, this.lead, this.rows, this.best);
}

String _norm(String s) => s
    .toLowerCase()
    .replaceAll('&', ' and ')
    .replaceAll(RegExp(r'[^a-z0-9 ]'), ' ')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim();

final _noise = RegExp(
    r'\b(the|a|an|of|and|with|for|by|new|latest|original|combo|pack|buy|online|india|official|store|limited|ltd|pvt)\b');

String _tokens(String s) {
  final set = _norm(s).replaceAll(_noise, ' ').split(' ').where((e) => e.isNotEmpty).toSet().toList()..sort();
  return set.join(' ');
}

/// Date normalizer (owner 24 Oct flight compare fix): sellers emit either ISO
/// (2026-10-25) or DD-MM-YYYY (Ixigo's legacy block format); both must produce
/// the SAME grouping key so one flight's rows from different sellers compare.
String _dateNorm(String v) {
  final s = v.trim();
  final iso = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(s);
  if (iso != null) {
    return '${iso.group(1)}-${iso.group(2)}-${iso.group(3)}';
  }
  final dmy = RegExp(r'^(\d{2})-(\d{2})-(\d{4})').firstMatch(s);
  if (dmy != null) {
    return '${dmy.group(3)}-${dmy.group(2)}-${dmy.group(1)}';
  }
  return _norm(s);
}

String _hhmm(String v) {
  final m = RegExp(r'(\d{1,2}):(\d{2})\s*(AM|PM)?', caseSensitive: false).firstMatch(v);
  if (m == null) return _norm(v);
  var h = int.parse(m.group(1)!);
  final ap = (m.group(3) ?? '').toUpperCase();
  if (ap == 'PM' && h < 12) h += 12;
  if (ap == 'AM' && h == 12) h = 0;
  return '${h.toString().padLeft(2, '0')}:${m.group(2)}';
}

/// Flight-code key (owner 24 Oct "similar flights compare nahi ho rahe" fix):
/// the SAME departure is published in different spellings per seller —
/// "6E974" (Cleartrip/EMT), "6E 974" (Via), "AI2566" vs "AI 2566", and
/// connecting itineraries "6E7168-2384" (EMT) vs "6E 7168 + 6E 2384" (Via).
/// Grouping on the raw string kept splitting one flight into 2-3 cards.
/// Key on the FIRST leg's flight code with separators stripped. The airline
/// code must contain a letter so dates ("2026-10-24") never match; only the
/// flight-number spec is scanned (never the title) so word+year pairs like
/// "on 2026-10-24" can never fabricate a code. Mirrors web offerGroups.ts.
String _flightCodeKey(String raw) {
  final re = RegExp(r'\b([A-Z0-9]{2})\s*-?\s*(\d{3,4})\b', caseSensitive: false);
  for (final m in re.allMatches(raw)) {
    final code = (m.group(1) ?? '').toUpperCase();
    if (RegExp(r'[A-Z]').hasMatch(code)) return '$code${m.group(2)}';
  }
  return _norm(raw); // no parseable code: legacy norm (compares only on exact spelling)
}

String offerKey(CompareItem it) {
  final v = it.vertical;
  switch (v) {
    case 'flights':
      final no = _flightCodeKey(it.spec('flight number'));
      // Same flight from different sellers compares when flight number + date +
      // time all match (owner 24 Oct). Dates normalize across ISO/DD-MM-YYYY;
      // flight codes normalize across "6E 974"/"6E974"/"6E7168-2384" spellings.
      final date = _dateNorm(it.spec('departure date', 'travel date', 'date'));
      final dep = _hhmm(it.spec('departure time'));
      if (no.isNotEmpty) return 'f|$no|$date|$dep';
      return 'f|${_norm(it.provider)}|${_norm(it.spec('route'))}|$date|$dep|${_norm(it.title)}';
    case 'bus':
      final op = _norm(it.spec('operator').isNotEmpty ? it.spec('operator') : it.provider);
      final dep = _hhmm(it.spec('departure').split('→').first.isNotEmpty
          ? it.spec('departure').split('→').first
          : it.spec('departure time'));
      final type = _norm(it.spec('seat type', 'bus type').isNotEmpty
          ? it.spec('seat type', 'bus type')
          : (it.features.isNotEmpty ? it.features.first : ''));
      if (dep.isEmpty) return 'b|${_norm(it.title)}|${_norm(it.provider)}';
      return 'b|$op|$dep|$type';
    case 'cab':
      return 'c|${_norm(it.spec('pickup'))}|${_norm(it.spec('drop'))}|${_cabVehicleClass(it.spec('vehicle type').isNotEmpty ? it.spec('vehicle type') : it.title)}|${_norm(it.spec('trip type'))}';
    case 'food':
      return 'fd|${_tokens(it.title)}|${_norm(it.spec('restaurant'))}';
    case 'movie':
    case 'movies':
      return 'm|${_tokens(it.title)}';
    case 'creditcards':
      return 'cc|${_tokens(it.title)}|${_norm(it.spec('bank'))}';
    case 'loans':
      return 'l|${_tokens(it.title)}|${_norm(it.spec('loan type'))}';
    case 'insurance':
      return 'i|${_tokens(it.title)}|${_norm(it.spec('insurance type'))}';
    case 'grocery':
      return 'g|${_tokens(it.title.replaceAllMapped(RegExp(r'\(([^)]*)\)'), (m) => ' ${m.group(1)} '))}|${_norm(it.spec('quantity'))}';
    default:
      return 'e|${_tokens(it.title)}|${_norm(it.spec('brand'))}';
  }
}

/// Cab cards compare providers for the SAME vehicle CATEGORY (owner 17 Oct: "auto,
/// bike, cab teeno... same card pr cheapest top pr baki neeche"). Ola Auto + Rapido
/// Auto are one card, Ola Bike + Rapido Bike Taxi one card, every car class is the
/// "cab" card — cheapest row on top, rest below, app-only rows last.
String _cabVehicleClass(String v) {
  final s = v.toLowerCase();
  if (RegExp('bike|scoot').hasMatch(s)) return 'bike';
  if (RegExp('auto|rickshaw').hasMatch(s)) return 'auto';
  return 'cab';
}

/// Owner 22 Oct: cab results must be segmented into Auto / Bike / Cab sections so
/// every ride type's price is visible separately for the same trip.
String cabVehicleClassOf(CompareItem it) =>
    _cabVehicleClass(cabVariantOf(it).isNotEmpty ? cabVariantOf(it) : it.title);

/// The vehicle variant a provider actually quoted ("Swift Dzire", "Ola Auto",
/// "Uber Go"). Falls back to the title's parenthesised vehicle, then the spec.
String cabVariantOf(CompareItem it) {
  var v = it.spec('vehicle type');
  if (v.isEmpty) v = it.spec('vehicle_type');
  if (v.isEmpty) {
    final m = RegExp(r'cab \(([^,)]+)', caseSensitive: false).firstMatch(it.title);
    v = m != null ? m.group(1)!.trim() : '';
  }
  return v;
}

List<OfferRow> _rowsFor(CompareItem it) {
  if (it.isMovie && it.sellerQuotes.length > 1) {
    return [for (final q in it.sellerQuotes) OfferRow(it.withQuote(q), q.sellerName, q.price, q.price > 0)];
  }
  return [OfferRow(it, it.site, it.primaryPrice, it.priced)];
}

List<OfferGroup> groupOffers(List<CompareItem> items) {
  final groups = <String, OfferGroup>{};
  for (final it in items) {
    final key = offerKey(it);
    for (final row in _rowsFor(it)) {
      final g = groups[key];
      if (g == null) {
        groups[key] = OfferGroup(key, it.vertical, it, [row], row);
        continue;
      }
      // Cab: the same operator's vehicle VARIANTS (Ola Mini/Prime/SUV, BharatTaxi
      // Dzire/Ertiga/Innova) all stay on the category card — no same-site collapse.
      // Owner 22 Oct: an IDENTICAL quote (same site + same variant + same price)
      // is still one row — repeated "Bharat Taxi ₹2,600" cluttered the sheet.
      final dup = it.vertical == 'cab'
          ? g.rows.indexWhere((r) =>
              r.site == row.site &&
              cabVariantOf(r.item).toLowerCase() == cabVariantOf(it).toLowerCase() &&
              r.price == row.price &&
              r.priceAvailable == row.priceAvailable)
          : g.rows.indexWhere((r) => r.site == row.site);
      if (dup >= 0) {
        final cur = g.rows[dup];
        final better = row.priceAvailable && (!cur.priceAvailable || row.price < cur.price);
        if (better) g.rows[dup] = row;
        continue;
      }
      g.rows.add(row);
    }
  }
  final out = groups.values.toList();
  for (final g in out) {
    g.rows.sort((a, b) {
      if (a.priceAvailable != b.priceAvailable) return a.priceAvailable ? -1 : 1;
      return a.price.compareTo(b.price);
    });
    g.best = g.rows.first;
    int richness(OfferRow r) => (r.item.imageUrl != null ? 2 : 0) + (r.item.description.isNotEmpty ? 1 : 0);
    final richest = ([...g.rows]..sort((a, b) => richness(b).compareTo(richness(a)))).first;
    g.lead = richest.item;
    final prices = g.rows.where((r) => r.priceAvailable).map((r) => r.price).toList();
    g.highest = prices.length > 1 ? prices.reduce((a, b) => a > b ? a : b) : null;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Hotels (hotelGroups.ts)
// ---------------------------------------------------------------------------

class HotelRow {
  final CompareItem item;
  final String site;
  final double price;
  final bool freeCancellation;
  final bool breakfast;
  const HotelRow(this.item, this.site, this.price, this.freeCancellation, this.breakfast);
}

class HotelGroup {
  final String key;
  final String name;
  String? image;
  final List<String> gallery;
  String? locality;
  final String city;
  double? stars;
  double? rating10;
  int? ratingCount;
  String? ratingLabel;
  final List<String> amenities;
  final List<HotelRow> rows;
  HotelRow best;
  HotelGroup(this.key, this.name, this.city, this.rows, this.best,
      {this.image, this.locality, this.stars, this.rating10, this.ratingCount, this.ratingLabel})
      : gallery = [],
        amenities = [];
}

final _hotelStop = RegExp(
    r'\b(hotel|hotels|the|by|a|an|and|resort|resorts|inn|stay|stays|rooms?|boutique|suites?|residency|palace|near|in|at|of|best|luxury|premium|collection|o|oyo|international)\b');

String _hotelKey(String name, String city) {
  var t = name.toLowerCase().replaceAll('&', ' ').replaceAll(RegExp(r'[^a-z0-9 ]'), ' ');
  if (city.isNotEmpty) t = t.replaceAll(RegExp('\\b${RegExp.escape(city.toLowerCase())}\\b'), ' ');
  t = t.replaceAll(_hotelStop, ' ');
  final set = t.split(RegExp(r'\s+')).where((e) => e.isNotEmpty).toSet().toList()..sort();
  return set.join(' ');
}

String hotelSite(CompareItem it) {
  const map = {
    'w_hotels_cleartrip': 'Cleartrip',
    'w_hotels_airbnb': 'Airbnb',
    'w_hotels_booking': 'Booking.com',
    'w_hotels_mmt': 'MakeMyTrip',
    'w_hotels_goibibo': 'Goibibo',
    'w_hotels_agoda': 'Agoda',
  };
  if (it.sourceId == 'w_hotels_ixigo') return 'Hotel website';
  if (it.sourceId != null && map.containsKey(it.sourceId)) return map[it.sourceId]!;
  return it.sellerQuotes.isNotEmpty ? it.sellerQuotes.first.sellerName : (it.provider.isEmpty ? 'Seller' : it.provider);
}

bool _truthy(String v) => RegExp(r'^(true|yes|1)$', caseSensitive: false).hasMatch(v);

List<HotelGroup> groupHotels(List<CompareItem> items) {
  final groups = <String, HotelGroup>{};
  for (final it in items) {
    if (!it.priceAvailable && it.primaryPrice <= 0) continue;
    final city = it.spec('city');
    final key = '${_hotelKey(it.title, city)}|${city.toLowerCase()}';
    final stars = double.tryParse(it.spec('star rating', 'stars'));
    final raw = double.tryParse(it.spec('user rating', 'rating')) ?? it.rating;
    final rating10 = raw > 0 ? (raw <= 5 ? (raw * 20).round() / 10 : raw) : null;
    final img = it.imageUrl ?? (it.spec('image url').isNotEmpty ? it.spec('image url') : null);
    final offerings = it.spec('top offerings');
    final amen = offerings
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty && !RegExp(r'payment|pay at|₹0|offer|discount|coupon', caseSensitive: false).hasMatch(s))
        .toList();
    final row = HotelRow(
      it,
      hotelSite(it),
      it.primaryPrice,
      _truthy(it.spec('free cancellation')) || RegExp('free cancel', caseSensitive: false).hasMatch(offerings),
      _truthy(it.spec('free breakfast')) || RegExp('breakfast', caseSensitive: false).hasMatch(offerings),
    );
    var g = groups[key];
    if (g == null) {
      g = HotelGroup(key, it.title, city, [row], row,
          image: img,
          locality: it.spec('locality').isEmpty ? null : it.spec('locality'),
          stars: stars,
          rating10: rating10,
          ratingCount: int.tryParse(it.spec('user rating count', 'review count')) ?? (it.reviewCount > 0 ? it.reviewCount : null),
          ratingLabel: it.spec('user rating category').isEmpty ? null : it.spec('user rating category'));
      groups[key] = g;
    } else {
      g.rows.add(row);
      g.image ??= img;
      g.stars ??= stars;
      if (g.rating10 == null && rating10 != null) {
        g.rating10 = rating10;
        g.ratingCount = int.tryParse(it.spec('user rating count', 'review count')) ?? g.ratingCount;
        g.ratingLabel = it.spec('user rating category').isEmpty ? g.ratingLabel : it.spec('user rating category');
      }
      if (g.locality == null && it.spec('locality').isNotEmpty) g.locality = it.spec('locality');
    }
    if (img != null && !g.gallery.contains(img)) g.gallery.add(img);
    for (final extra in it.images) {
      if (!g.gallery.contains(extra)) g.gallery.add(extra);
    }
    for (final a in amen) {
      if (!g.amenities.contains(a)) g.amenities.add(a);
    }
  }

  // Second pass: merge groups whose distinctive tokens are a subset of the other's (same city only).
  final merged = <HotelGroup>[];
  Set<String> toks(HotelGroup g) => g.key.split('|').first.split(' ').where((e) => e.isNotEmpty).toSet();
  for (final g in groups.values) {
    final tg = toks(g);
    HotelGroup? host;
    for (final m in merged) {
      if (m.city.toLowerCase() != g.city.toLowerCase()) continue;
      final tm = toks(m);
      if (tm.isEmpty || tg.isEmpty) continue;
      final small = tm.length <= tg.length ? tm : tg;
      final big = tm.length <= tg.length ? tg : tm;
      if (!small.every(big.contains)) continue;
      if (!small.any((t) => t.length >= 4)) continue;
      if (big.length - small.length > 1) continue;
      final sitesM = m.rows.map((r) => r.site).toSet();
      if (!g.rows.every((r) => !sitesM.contains(r.site))) continue;
      host = m;
      break;
    }
    if (host == null) {
      merged.add(g);
      continue;
    }
    host.rows.addAll(g.rows);
    host.image ??= g.image;
    host.stars ??= g.stars;
    if (host.rating10 == null && g.rating10 != null) {
      host.rating10 = g.rating10;
      host.ratingCount = g.ratingCount;
      host.ratingLabel = g.ratingLabel;
    }
    host.locality ??= g.locality;
    for (final im in g.gallery) {
      if (!host.gallery.contains(im)) host.gallery.add(im);
    }
    for (final a in g.amenities) {
      if (!host.amenities.contains(a)) host.amenities.add(a);
    }
  }
  for (final g in merged) {
    g.rows.sort((a, b) => a.price.compareTo(b.price));
    g.best = g.rows.first;
    if (g.rows.any((r) => r.freeCancellation) && !g.amenities.any((a) => RegExp('free cancel', caseSensitive: false).hasMatch(a))) {
      g.amenities.insert(0, 'Free cancellation');
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Sorting / summary tabs
// ---------------------------------------------------------------------------

enum SortMode { best, cheapest, highestRated }

/// OWNER 28 Oct ("flight mai bahut aisa section hai jo 1st card show kar raha
/// hai, pr hume second card chahiye"): two card shapes reach the feed. The
/// "second type" carries flight number + real dep -> arr + duration + non-stop;
/// the "first type" is a bare airline/route/price row. A row is only promoted to
/// the second type when the timings are REAL (the server copies them from an
/// observed row of the same flight number) — otherwise it drops to the end of
/// the feed instead of holding a top slot.
final RegExp _clockRe = RegExp(r'(\d{1,2}):(\d{2})');

String? _clockOf(String? raw) {
  if (raw == null) return null;
  final s = raw.trim();
  if (s.isEmpty) return null;
  final iso = RegExp(r'T(\d{2}):(\d{2})').firstMatch(s);
  if (iso != null) return '${iso.group(1)}:${iso.group(2)}';
  final m = _clockRe.firstMatch(s);
  if (m == null) return null;
  final h = int.tryParse(m.group(1)!) ?? 99;
  if (h > 23) return null;
  return '${m.group(1)!.padLeft(2, '0')}:${m.group(2)}';
}

bool flightScheduleComplete(CompareItem item) {
  if (item.vertical != 'flights') return false;
  final dep = _clockOf(item.specs['departure time'] ?? item.specs['departure']);
  final arr = _clockOf(item.specs['arrival time'] ?? item.specs['arrival']);
  return dep != null && arr != null;
}

/// One comparison group = the SAME flight sold by several sites. When the
/// cheapest row carries no timings but another seller's row for that flight does,
/// lift only the schedule specs onto the lead row (never the price/seller) so the
/// card still renders in full.
const _scheduleSpecKeys = ['departure time', 'arrival time', 'duration minutes', 'stops', 'flight number', 'airline', 'departure date'];

void liftGroupSchedule(OfferGroup g) {
  if (flightScheduleComplete(g.lead)) return;
  CompareItem? donor;
  for (final r in g.rows) {
    if (flightScheduleComplete(r.item)) {
      donor = r.item;
      break;
    }
  }
  if (donor == null) return;
  for (final k in _scheduleSpecKeys) {
    final v = donor.specs[k];
    if (v != null && v.trim().isNotEmpty && (g.lead.specs[k] ?? '').isEmpty) {
      g.lead.specs[k] = v;
    }
  }
}

/// Stable partition: complete "second type" cards keep the chosen sort order and
/// lead; the rest follow in the same order. Never re-sorts.
List<OfferGroup> scheduleCompleteFirst(List<OfferGroup> gs, String vertical) {
  if (vertical != 'flights') return gs;
  final complete = <OfferGroup>[];
  final incomplete = <OfferGroup>[];
  for (final g in gs) {
    (flightScheduleComplete(g.lead) ? complete : incomplete).add(g);
  }
  if (incomplete.isEmpty) return gs;
  return [...complete, ...incomplete];
}

List<OfferGroup> sortGroups(List<OfferGroup> gs, SortMode mode) {
  double priceOf(OfferGroup g) => g.best.priceAvailable ? g.best.price : double.infinity;
  final out = [...gs];
  switch (mode) {
    case SortMode.cheapest:
      out.sort((a, b) => priceOf(a).compareTo(priceOf(b)));
    case SortMode.highestRated:
      out.sort((a, b) => b.lead.rating.compareTo(a.lead.rating));
    case SortMode.best:
      out.sort((a, b) {
        final byRows = b.rows.length.compareTo(a.rows.length);
        return byRows != 0 ? byRows : priceOf(a).compareTo(priceOf(b));
      });
  }
  return out;
}

List<HotelGroup> sortHotels(List<HotelGroup> gs, SortMode mode) {
  final out = [...gs];
  switch (mode) {
    case SortMode.cheapest:
      out.sort((a, b) => a.best.price.compareTo(b.best.price));
    case SortMode.highestRated:
      out.sort((a, b) => (b.rating10 ?? 0).compareTo(a.rating10 ?? 0));
    case SortMode.best:
      // Owner rule (16 Oct): multi-site comparison cards (2+ companies) lead the
      // feed, cheapest first among them; single-site hotels follow, cheapest first.
      // Pure price order only when the user explicitly picks Cheapest.
      out.sort((a, b) {
        final byMulti = ((a.rows.length >= 2) ? 0 : 1).compareTo((b.rows.length >= 2) ? 0 : 1);
        if (byMulti != 0) return byMulti;
        final byPrice = a.best.price.compareTo(b.best.price);
        if (byPrice != 0) return byPrice;
        return (b.rating10 ?? 0).compareTo(a.rating10 ?? 0);
      });
  }
  return out;
}
