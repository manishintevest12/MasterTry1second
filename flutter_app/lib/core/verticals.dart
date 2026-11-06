import 'package:flutter/material.dart';

/// How a vertical's search form looks (mirrors SearchAndFilterHeader.tsx).
enum SearchKind { route, dateRoute, hotel, text, movie, cab, account }

/// Mirror of the web accountSearchQuery (owner 21 Oct): a typed bank narrows to
/// that provider ("<bank> <type> account"); a blank bank box compares every bank
/// ("<type> account"). Type is lowercased to match the server's account parser.
String accountSearchQuery(String bank, String type) {
  final b = bank.trim();
  final t = type.toLowerCase();
  return b.isEmpty ? '$t account' : '$b $t account';
}

/// Vertical metadata mirrored 1:1 from the website's VERTICAL_META + VerticalNav
/// (12 verticals, same ids and order). `movie` is the site's id; the backend
/// accepts it and `movies`.
class VerticalMeta {
  final String id;
  final String name;
  final String tagline;
  final String description;
  final String placeholder;
  final IconData icon;
  final SearchKind kind;
  final String cover;
  final String defaultFrom;
  final String defaultTo;
  final List<String> samples;
  const VerticalMeta({
    required this.id,
    required this.name,
    required this.tagline,
    required this.description,
    required this.placeholder,
    required this.icon,
    required this.kind,
    required this.cover,
    this.defaultFrom = '',
    this.defaultTo = '',
    this.samples = const [],
  });
}

const kVerticals = <VerticalMeta>[
  VerticalMeta(
    id: 'flights',
    name: 'Flights',
    tagline: 'Airline & OTA Matrix',
    description: 'Compare non-stop & connecting fares across 40+ airlines & OTAs',
    placeholder: 'Search route (e.g. Indore to Delhi, Patna to Mumbai)',
    icon: Icons.flight_takeoff_rounded,
    kind: SearchKind.route,
    cover: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&auto=format&fit=crop&q=80',
    defaultFrom: 'Indore (IDR)',
    defaultTo: 'Delhi (DEL)',
    samples: ['Direct flights under ₹30,000', 'Morning departure with meals included', 'Refundable ticket with 25kg luggage'],
  ),
  VerticalMeta(
    id: 'hotels',
    name: 'Hotels',
    tagline: 'Suites & Resorts',
    description: 'Uncover 5-star suites, resorts & boutique stays across Booking, Agoda & MMT',
    placeholder: 'Search city, resort, or landmark (e.g. Indore, Patna, Goa)',
    icon: Icons.apartment_rounded,
    kind: SearchKind.hotel,
    cover: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&auto=format&fit=crop&q=80',
    defaultTo: 'Indore',
    samples: ['Beachfront resort with free cancellation', '5-star boutique hotel under ₹7,000/night', 'Swimming pool & buffet breakfast included'],
  ),
  VerticalMeta(
    id: 'bus',
    name: 'Bus',
    tagline: 'AC Sleeper Routes',
    description: 'Live AC sleeper & semi-sleeper ticket comparisons across RedBus, AbhiBus & ZingBus',
    placeholder: 'Search route (e.g. Indore to Bhopal, Patna to Ranchi)',
    icon: Icons.directions_bus_rounded,
    kind: SearchKind.dateRoute,
    cover: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80',
    defaultFrom: 'Indore',
    defaultTo: 'Bhopal',
    samples: ['Multi-axle AC Sleeper with live tracking', 'Late evening departure after 9 PM', 'Single lady seat available'],
  ),
  VerticalMeta(
    id: 'ecommerce',
    name: 'E-Commerce',
    tagline: 'Gadgets & Tech',
    description: 'Instant price check for gadgets & electronics across Amazon, Flipkart, Tata CliQ & Croma',
    placeholder: 'Search smartphones, laptops, headphones, appliances',
    icon: Icons.shopping_bag_rounded,
    kind: SearchKind.text,
    cover: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
    samples: ['Sony WH-1000XM5 under ₹25,000', 'Apple M3 MacBook with bank discount', 'Fast 1-day delivery with warranty'],
  ),
  VerticalMeta(
    id: 'grocery',
    name: '10-Min Grocery',
    tagline: 'Quick-Commerce',
    description: 'Real-time item & basket price comparison across Blinkit, Zepto, Instamart & BB Now',
    placeholder: 'Search milk, fruits, veggies, snacks, staples',
    icon: Icons.bolt_rounded,
    kind: SearchKind.text,
    cover: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80',
    samples: ['Fresh Alphonso mangoes under 10 minutes', 'Dairy milk & bakery basket lowest surge', 'Cooking oil 5L best price'],
  ),
  VerticalMeta(
    id: 'food',
    name: 'Food Delivery',
    tagline: 'Dishes & Outlets',
    description: 'Compare dish pricing, restaurant packing, and delivery surge across Zomato & Swiggy',
    placeholder: 'Search dishes, cuisines, or restaurants (e.g. Biryani, Pizza, Rolls)',
    icon: Icons.restaurant_rounded,
    kind: SearchKind.text,
    cover: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80',
    samples: ['Authentic woodfired pizza with 20% discount', 'Hyderabadi Dum Biryani family pack', 'Healthy high-protein salads under 30 mins'],
  ),
  VerticalMeta(
    id: 'movie',
    name: 'Movies',
    tagline: 'IMAX & Cinema',
    description: 'Real-time showtimes, IMAX & 4DX ticket fees compared across BookMyShow, Paytm & PVR INOX',
    placeholder: 'Search blockbuster films or theatres',
    icon: Icons.movie_rounded,
    kind: SearchKind.movie,
    cover: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80',
    samples: ['IMAX 3D evening show with recliner', 'Weekend tickets under ₹350', 'Dolby Atmos show in South Delhi'],
  ),
  VerticalMeta(
    id: 'cab',
    name: 'Cab & Rides',
    tagline: 'Surge & Fare Check',
    description: 'Live fare estimates across Uber, Ola, InDrive & more',
    placeholder: 'Enter pickup & destination locations',
    icon: Icons.local_taxi_rounded,
    kind: SearchKind.cab,
    cover: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=600&auto=format&fit=crop&q=80',
    defaultFrom: 'Indore',
    defaultTo: 'Bhopal',
    samples: ['Airport cab without surge pricing', 'Sedan with AC within 3 mins ETA', 'Quick bike taxi under ₹80'],
  ),
  VerticalMeta(
    id: 'loans',
    name: 'Loans & EMI',
    tagline: 'Lowest APR & EMI',
    description: 'Real offers from Paisabazaar, BankBazaar, Money View & more',
    placeholder: 'Search personal, home, or vehicle loan rates',
    icon: Icons.account_balance_rounded,
    kind: SearchKind.text,
    cover: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80',
    samples: ['Personal loan with lowest APR under 11%', 'Zero prepayment penalty home loan', 'Instant paperless approval in 24 hours'],
  ),
  VerticalMeta(
    id: 'insurance',
    name: 'Insurance',
    tagline: '1 Cr Health & Car',
    description: 'Premiums from Policybazaar, Acko, Digit & more',
    placeholder: 'Search health, term life, or motor insurance',
    icon: Icons.shield_rounded,
    kind: SearchKind.text,
    cover: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80',
    samples: ['1 Crore health cover with zero co-pay', 'Term life with 99%+ claim settlement', 'Comprehensive car cover with zero depreciation'],
  ),
  VerticalMeta(
    id: 'account',
    name: 'Bank Accounts',
    tagline: 'Savings • Current • Demat',
    description: 'Compare Savings, Current and Demat accounts across top Indian banks',
    placeholder: 'Search bank (e.g. SBI, HDFC) — leave blank to compare all',
    icon: Icons.account_balance_wallet_rounded,
    kind: SearchKind.account,
    cover: 'https://images.unsplash.com/photo-1601597111158-2fceff292fb9?w=600&auto=format&fit=crop&q=80',
    samples: ['zero balance savings account', 'Demat account with lowest AMC', 'current account for small business'],
  ),
  VerticalMeta(
    id: 'creditcards',
    name: 'Credit Cards',
    tagline: 'Fees, Rewards, APR',
    description: 'Compare fees, rewards and APR across top Indian credit cards',
    placeholder: 'Search cards (e.g. HDFC travel card, lifetime free, cashback)',
    icon: Icons.credit_card_rounded,
    kind: SearchKind.text,
    cover: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&auto=format&fit=crop&q=80',
    samples: ['HDFC credit card', 'lifetime free credit card', 'travel card with lounge access', 'cashback card'],
  ),
];

VerticalMeta verticalById(String id) {
  final key = id == 'movies' ? 'movie' : id;
  return kVerticals.firstWhere((v) => v.id == key, orElse: () => kVerticals.first);
}

bool isKnownVertical(String id) => kVerticals.any((v) => v.id == (id == 'movies' ? 'movie' : id));

/// Default search seed per vertical.
///
/// OWNER 4 Nov (screenshot: Hotels box holding "Rau Tahsil to Bhopal", 0 results):
/// "hr vertical pr data user ke search ke phle ek default aaye jiss se koi v vertical khali naa
/// dikhe — hotels ke liye Goa, flight ke liye Indore to New Delhi, bus ke liye Indore to Nagpur."
/// So every vertical now has a REAL, searchable default that the form shows before the user types
/// anything, and that seed is what the first open searches.
String defaultQueryFor(String vertical, [String? city]) {
  // OWNER 6 Nov (screenshots: Hotels "Rau Tahsil", Bus "Rau 1 -> Bhop", E-Commerce "Rau Tahsil to
  // Bhopal"): "mai ek jagah address daal raha hoon aur app hr jagah daal deta hai ... hr page ka ek
  // default hoga". The seeds below are therefore LITERAL and independent of the device address - a
  // village-level location can never become another vertical's search text, and every vertical opens
  // on real data. The address only drives the location chip (and local delivery verticals).
  switch (vertical) {
    case 'flights':
      return 'Indore to New Delhi';
    case 'hotels':
      return 'Goa';
    case 'bus':
      return 'Indore to Nagpur';
    case 'cab':
      return 'Rajwada Indore to Airport Indore';
    case 'ecommerce':
      return 'mobile phone';
    case 'grocery':
      return 'milk';
    case 'food':
      return 'biryani';
    case 'movie':
    case 'movies':
      return 'movies';
    case 'loans':
      return 'personal loan';
    case 'insurance':
      return 'health insurance';
    case 'creditcards':
      return 'best credit card';
    case 'account':
      return 'savings account';
  }
  return '';
}

/// Identity of one search intent. OWNER 6 Nov: "mai 5 baar flight mai search krta hoon aur 5 baar
/// alag alag seller aate hai" - so an identical press (same vertical, query, date, route, address)
/// must resolve to the SAME settled answer instead of firing a brand-new sweep that can return a
/// different seller mix.
String searchSignature({
  required String vertical,
  required String query,
  String? depart,
  String? from,
  String? to,
  String? city,
  String? pincode,
}) {
  return [
    normalizeVerticalId(vertical),
    query.trim().toLowerCase(),
    (depart ?? '').trim(),
    (from ?? '').trim().toLowerCase(),
    (to ?? '').trim().toLowerCase(),
    (city ?? '').trim().toLowerCase(),
    (pincode ?? '').trim(),
  ].join('|');
}

/// Does a remembered query actually BELONG to this vertical's search shape?
///
/// OWNER 4 Nov: the Hotels box was carrying "Rau Tahsil to Bhopal" — a ROUTE left over from a
/// travel search — and the auto search ran it inside hotels, which can only answer with "No
/// matching options found". A route shape ("X to Y") is valid for flights/bus/cab and nonsense
/// for hotels/products/finance; the reverse is true too. Sticky queries that fail this check are
/// ignored and the vertical's own default seed is used instead, so no vertical inherits another
/// vertical's text.
bool queryFitsVertical(String vertical, String query) {
  final q = query.trim();
  if (q.isEmpty) return false;
  final isRoute = RegExp(r'\bto\b', caseSensitive: false).hasMatch(q);
  switch (normalizeVerticalId(vertical)) {
    case 'flights':
    case 'bus':
    case 'cab':
      return isRoute;
    default:
      // hotels, ecommerce, grocery, food, movie, loans, insurance, creditcards, account
      return !isRoute;
  }
}

/// The exact query a vertical should search when the user has not typed one: the vertical's own
/// remembered query only if it fits the shape, otherwise the owner's default seed.
String seedQueryFor(String vertical, String city, String sticky) {
  if (queryFitsVertical(vertical, sticky)) return sticky.trim();
  return defaultQueryFor(vertical, city);
}

/// OWNER 3 Nov ("hr vertical ke dusre se alag hai unka aapas mai kuch lena dena ni hai"):
/// a search intent carries the vertical it was created for, and it may ONLY be applied to that
/// vertical. Consuming it on whatever tab happened to be open is what put a Goa hotel search
/// into the E-Commerce box. Kept here (not in the screen) so it is unit-testable.
String normalizeVerticalId(String v) {
  final t = v.trim().toLowerCase();
  return t == 'movies' ? 'movie' : t;
}

bool pendingFitsVertical(String pendingVertical, String currentVertical) {
  final a = normalizeVerticalId(pendingVertical);
  final b = normalizeVerticalId(currentVertical);
  if (a.isEmpty || b.isEmpty) return false;
  return a == b;
}
