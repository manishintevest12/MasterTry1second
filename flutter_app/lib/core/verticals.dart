import 'package:flutter/material.dart';

/// How a vertical's search form looks (mirrors SearchAndFilterHeader.tsx).
enum SearchKind { route, dateRoute, hotel, text, movie, cab }

/// Vertical metadata mirrored 1:1 from the website's VERTICAL_META + VerticalNav
/// (11 verticals, same ids and order). `movie` is the site's id; the backend
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
    placeholder: 'Savings, Current or Demat account offers',
    icon: Icons.account_balance_wallet_rounded,
    kind: SearchKind.text,
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

/// Default search seed per vertical (website DEFAULT_QUERY + SEED_QUERIES, so a tab shows real data on open).
String defaultQueryFor(String vertical, [String? city]) {
  final targetCity = (city == null || city.trim().isEmpty) ? 'Indore' : city.trim();
  switch (vertical) {
    case 'flights':
      return 'Indore (IDR) to Delhi (DEL)';
    case 'hotels':
      return targetCity;
    case 'bus':
    case 'cab':
      return '$targetCity to Bhopal';
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
