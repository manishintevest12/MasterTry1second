// OWNER 6 Nov (screenshots: Hotels "Rau Tahsil", Bus "Rau 1 -> Bhop", E-Commerce "Rau Tahsil to
// Bhopal"): "mai ek jagah address daal raha hoon aur app hr jagah daal deta hai ... hr page ka ek
// default hoga" + "mai 5 baar flight mai search krta hoon aur 5 baar alag alag seller aate hai".
import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/verticals.dart';

void main() {
  test('every vertical has a non-empty default seed', () {
    for (final v in kVerticals) {
      expect(defaultQueryFor(v.id, 'Rau Tahsil').trim().isNotEmpty, isTrue, reason: '${v.id} has no seed');
    }
  });

  test("the owner's exact seeds", () {
    expect(defaultQueryFor('hotels'), 'Goa');
    expect(defaultQueryFor('flights'), 'Indore to New Delhi');
    expect(defaultQueryFor('bus'), 'Indore to Nagpur');
  });

  test('a device address can never become another vertical search text', () {
    // The screenshot bug: a village-level address leaked into every box.
    for (final city in ['Rau Tahsil', 'Juni Indore Tahsil', '', 'Bhopal']) {
      expect(defaultQueryFor('flights', city), 'Indore to New Delhi');
      expect(defaultQueryFor('hotels', city), 'Goa');
      expect(defaultQueryFor('bus', city), 'Indore to Nagpur');
      expect(defaultQueryFor('ecommerce', city), 'mobile phone');
      expect(defaultQueryFor('grocery', city), 'milk');
    }
  });

  test('a route-shaped query never belongs to hotels/products, and vice versa', () {
    expect(queryFitsVertical('hotels', 'Rau Tahsil to Bhopal'), isFalse);
    expect(queryFitsVertical('flights', 'Rau Tahsil to Bhopal'), isTrue);
    expect(queryFitsVertical('bus', 'Indore to Nagpur'), isTrue);
    expect(queryFitsVertical('grocery', 'tata tea'), isTrue);
    expect(queryFitsVertical('grocery', 'Indore to Nagpur'), isFalse);
    expect(queryFitsVertical('hotels', 'Goa'), isTrue);
    expect(queryFitsVertical('hotels', '   '), isFalse);
  });

  test('seed keeps a fitting user query, else the vertical default', () {
    expect(seedQueryFor('hotels', 'Indore', 'Rau Tahsil to Bhopal'), 'Goa');
    expect(seedQueryFor('flights', 'Indore', 'Indore to Mumbai'), 'Indore to Mumbai');
    expect(seedQueryFor('ecommerce', 'Indore', ''), 'mobile phone');
  });

  test('an identical press has an identical signature, a changed one does not', () {
    String sig({String q = 'Indore to New Delhi', String city = 'Indore', String depart = '2026-11-20', String to = ''}) =>
        searchSignature(vertical: 'flights', query: q, depart: depart, to: to, city: city, pincode: '452001');
    expect(sig(), sig(), reason: 'same intent must reuse the settled answer');
    expect(sig(q: 'Indore to Mumbai'), isNot(sig()), reason: 'a new route is a new search');
    expect(sig(depart: '2026-11-21'), isNot(sig()), reason: 'a new date is a new search');
    expect(sig(city: 'Bhopal'), isNot(sig()), reason: 'a new location is a new search');
    // Case/padding must not create a false "new" search that re-sweeps the same question.
    expect(sig(q: '  indore TO new delhi  '), sig());
  });
}
