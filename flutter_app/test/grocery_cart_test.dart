import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/grocery_cart.dart';

/// OWNER 20 Nov: grocery cards now carry the partner name, ADD/stepper and a real basket, on web AND app. These
/// tests pin the app-side basket rules so the two platforms cannot drift: identity, clamping, totals and the
/// partner grouping the cart sheet renders.
void main() {
  final attaZepto = GroceryLine(
    key: groceryKey('Aashirvaad Atta', '5 kg', 'Zepto'),
    title: 'Aashirvaad Atta',
    unit: '5 kg',
    price: 321,
    mrp: 450,
    partner: 'Zepto',
  );
  final attaBlinkit = GroceryLine(
    key: groceryKey('Aashirvaad Atta', '5 kg', 'Blinkit'),
    title: 'Aashirvaad Atta',
    unit: '5 kg',
    price: 330,
    mrp: 450,
    partner: 'Blinkit',
  );

  setUp(() => GroceryCart.instance.clear());

  test('the same product from two partners stays two lines', () {
    GroceryCart.instance
      ..add(attaZepto)
      ..add(attaBlinkit);
    expect(GroceryCart.instance.lineCount, 2);
  });

  test('adding the same product from the same partner increments', () {
    GroceryCart.instance
      ..add(attaZepto)
      ..add(attaZepto)
      ..add(attaZepto);
    expect(GroceryCart.instance.lineCount, 1);
    expect(GroceryCart.instance.qtyOf(attaZepto.key), 3);
  });

  test('quantity clamps at the cap and zero removes the line', () {
    GroceryCart.instance.add(attaZepto);
    GroceryCart.instance.setQty(attaZepto.key, 999);
    expect(GroceryCart.instance.qtyOf(attaZepto.key), kGroceryMaxQty);
    GroceryCart.instance.setQty(attaZepto.key, 0);
    expect(GroceryCart.instance.isEmpty, isTrue);
  });

  test('totals use the prices the shopper saw, and the saving is honest', () {
    final cart = GroceryCart.instance..add(attaZepto);
    cart.setQty(attaZepto.key, 2);
    expect(cart.units, 2);
    expect(cart.total, 642);
    expect(cart.mrpTotal, 900);
    expect(cart.saving, 258);
  });

  test('lines group by the partner they will be ordered from', () {
    final cart = GroceryCart.instance
      ..add(attaZepto)
      ..add(GroceryLine(
        key: groceryKey('Amul Milk', '1 L', 'Zepto'),
        title: 'Amul Milk',
        unit: '1 L',
        price: 60,
        mrp: 66,
        partner: 'Zepto',
      ))
      ..add(attaBlinkit);
    final groups = cart.groupedByPartner();
    expect(groups.keys.length, 2);
    expect(groups['Zepto']!.length, 2);
    expect(groups['Blinkit']!.length, 1);
  });

  test('a line with no title is refused, and a bad price is not trusted', () {
    expect(GroceryLine.fromJson({'title': '  '}), isNull);
    final parsed = GroceryLine.fromJson({'title': 'Ok', 'price': 'x', 'qty': 999});
    expect(parsed, isNotNull);
    expect(parsed!.price, 0);
    expect(parsed.qty, kGroceryMaxQty);
  });
}
