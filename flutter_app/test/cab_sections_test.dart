import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/compare.dart' as cmp;

cmp.CompareItem cabItem({
  required String id,
  required String title,
  required String provider,
  double price = 500,
  bool priced = true,
  String vehicleType = '',
}) =>
    cmp.CompareItem.fromJson({
      'id': id,
      'vertical': 'cab',
      'title': title,
      'subtitle': provider,
      'provider': provider,
      'primaryPrice': price,
      'priceAvailable': priced,
      'specs': {'vehicle type': vehicleType, 'pickup': 'Indore', 'drop': 'Bhopal', 'trip type': 'one-way'},
      'sellerQuotes': [
        {'id': 'sq-$id', 'sellerName': provider, 'price': price, 'url': '/api/out?t=x', 'isLowest': true}
      ],
    });

void main() {
  test('cabVehicleClassOf: bike / auto / cab from spec and title (owner 22 Oct)', () {
    expect(cmp.cabVehicleClassOf(cabItem(id: 'a', title: 'Indore to Bhopal cab (Ola Bike, one-way)', provider: 'Ola')), 'bike');
    expect(cmp.cabVehicleClassOf(cabItem(id: 'b', title: 'Indore to Bhopal cab (Ola Auto, one-way)', provider: 'Ola')), 'auto');
    expect(cmp.cabVehicleClassOf(cabItem(id: 'c', title: 'Indore to Bhopal cab (Swift Dzire, one-way)', provider: 'Bharat Taxi')), 'cab');
    expect(cmp.cabVehicleClassOf(cabItem(id: 'd', title: 'Rapido Bike Taxi', provider: 'Rapido', vehicleType: 'Bike Taxi')), 'bike');
  });

  test('cabVariantOf: spec first, then title parenthesis', () {
    expect(cmp.cabVariantOf(cabItem(id: 'e', title: 'Indore to Bhopal cab (Swift Dzire, one-way)', provider: 'Bharat Taxi')), 'Swift Dzire');
    expect(cmp.cabVariantOf(cabItem(id: 'f', title: 'Ride', provider: 'Ola', vehicleType: 'Ola Auto')), 'Ola Auto');
  });

  test('identical site+variant+price cab quotes collapse to one row (owner 22 Oct duplicate clutter)', () {
    final items = [
      cabItem(id: '1', title: 'Indore to Bhopal cab (Swift Dzire, one-way)', provider: 'Bharat Taxi', price: 2600),
      cabItem(id: '2', title: 'Indore to Bhopal cab (Swift Dzire, one-way)', provider: 'Bharat Taxi', price: 2600),
      cabItem(id: '3', title: 'Indore to Bhopal cab (Toyota Etios, one-way)', provider: 'Bharat Taxi', price: 2600),
      cabItem(id: '4', title: 'Indore to Bhopal cab (Ola SUV, one-way)', provider: 'Ola', price: 2888),
    ];
    final groups = cmp.groupOffers(items);
    final cabGroup = groups.firstWhere((g) => g.rows.any((r) => r.site == 'Bharat Taxi'));
    final bharatRows = cabGroup.rows.where((r) => r.site == 'Bharat Taxi').toList();
    // Dzire appears once (dup collapsed), Etios stays separate — same price but a different car.
    expect(bharatRows.length, 2);
    final variants = bharatRows.map((r) => cmp.cabVariantOf(r.item)).toSet();
    expect(variants.contains('Swift Dzire'), true);
    expect(variants.contains('Toyota Etios'), true);
  });

  test('bike and cab quotes form separate class groups', () {
    final items = [
      cabItem(id: 'b1', title: 'Indore to Bhopal cab (Ola Bike, one-way)', provider: 'Ola', price: 200),
      cabItem(id: 'c1', title: 'Indore to Bhopal cab (Ola SUV, one-way)', provider: 'Ola', price: 2888),
      cabItem(id: 'a1', title: 'Indore to Bhopal cab (Rapido Auto, one-way)', provider: 'Rapido', price: 120),
    ];
    final groups = cmp.groupOffers(items);
    expect(groups.length, 3);
    final classes = groups.map((g) => cmp.cabVehicleClassOf(g.lead)).toSet();
    expect(classes.containsAll(['bike', 'auto', 'cab']), true);
  });
}
