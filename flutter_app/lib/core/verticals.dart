import 'package:flutter/material.dart';

/// Vertical metadata mirrored from the site's VERTICAL_META.
class VerticalMeta {
  final String id;
  final String name;
  final String description;
  final String placeholder;
  final IconData icon;
  const VerticalMeta(this.id, this.name, this.description, this.placeholder, this.icon);
}

/// The 10 comparison verticals, same ids/order as the website's VERTICAL_META.
const kVerticals = <VerticalMeta>[
  VerticalMeta('flights', 'Flights', 'Non-stop & connecting fares across airlines & OTAs',
      'Search route (e.g. Indore to Delhi)', Icons.flight_takeoff_outlined),
  VerticalMeta('hotels', 'Hotels', 'Live per-night rates across Cleartrip, Airbnb & verified hotel sources',
      'Search city, resort or landmark', Icons.apartment_outlined),
  VerticalMeta('bus', 'Bus', 'Compare bus fares & schedules across operators',
      'Search route (e.g. Indore to Bhopal)', Icons.directions_bus_outlined),
  VerticalMeta('ecommerce', 'E-Commerce', 'Compare product prices across Amazon, Flipkart, Myntra & more',
      'Search any product (e.g. boAt Airdopes 141)', Icons.shopping_bag_outlined),
  VerticalMeta('grocery', '10-Min Grocery', 'Quick-commerce prices across Blinkit, Zepto, Instamart & more',
      'Search grocery item (e.g. Amul milk 500ml)', Icons.bolt_outlined),
  VerticalMeta('food', 'Food Delivery', 'Dish prices across Zomato, Swiggy & direct restaurant sources',
      'Search dish (e.g. chicken biryani)', Icons.restaurant_outlined),
  VerticalMeta('movie', 'Movies', 'Showtimes & ticket prices across BookMyShow, District & cinemas',
      'Search movie or cinema', Icons.movie_outlined),
  VerticalMeta('loans', 'Loans & EMI', 'Real offers from Paisabazaar, BankBazaar, Money View & more',
      'Search loan (e.g. personal loan 5 lakh)', Icons.account_balance_outlined),
  VerticalMeta('insurance', 'Insurance', 'Premiums from Policybazaar, Acko, Digit & more',
      'Search insurance (e.g. term cover 1 crore)', Icons.shield_outlined),
  VerticalMeta('cab', 'Cab & Rides', 'Live fare estimates across Uber, Ola, InDrive & more',
      'Enter pickup & destination', Icons.local_taxi_outlined),
];

VerticalMeta verticalById(String id) =>
    kVerticals.firstWhere((v) => v.id == id, orElse: () => kVerticals.first);
