import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

import 'package:try1second/ui/screens/in_app_browser_screen.dart';

/// 23 Oct image-4 embedded browser: seller-name resolution stays, and the
/// purchase overlay (Add to cart / Buy now) must NOT come back — the
/// merchant's own page buttons are the only checkout path.
void main() {
  test('hostDisplayName maps the mandatory sellers to their real names', () {
    expect(hostDisplayName('https://www.flipkart.com/x?y=1'), 'Flipkart');
    expect(hostDisplayName('https://www.amazon.in/dp/B0X'), 'Amazon');
    expect(hostDisplayName('https://www.redbus.in/route'), 'redBus');
    expect(hostDisplayName('https://www.makemytrip.com/hotels'), 'MakeMyTrip');
    expect(hostDisplayName('https://www.zomato.com/order'), 'Zomato');
    expect(hostDisplayName('https://unknown-shop.example.com/p'), 'Unknown Shop Example');
    expect(hostDisplayName('not a url'), 'Website');
  });

  test('the embedded browser has no purchase overlay (owner 23 Oct)', () {
    final src = File('lib/ui/screens/in_app_browser_screen.dart').readAsStringSync();
    // The 21 Oct bottom purchase bar and its JS clicker machinery are gone:
    // the merchant page owns the only checkout path.
    expect(src.contains('Add to cart'), isFalse);
    expect(src.contains('Buy now'), isFalse);
    expect(src.contains('cartLabels'), isFalse);
    expect(src.contains('buyLabels'), isFalse);
    expect(src.contains('buyNowLabel'), isFalse);
    expect(src.contains('clickSellerButtonJs'), isFalse);
  });
}
