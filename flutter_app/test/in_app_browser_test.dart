import 'package:flutter_test/flutter_test.dart';

import 'package:try1second/ui/screens/in_app_browser_screen.dart';

/// 21 Oct image-3 in-app browser: seller-name resolution from the redirect
/// host, honest "Buy now at ₹X" labels, and the JS that clicks the seller's
/// own cart/buy buttons must all stay intact.
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

  test('buyNowLabel is honest with and without a verified price', () {
    expect(buyNowLabel(null), 'Buy now');
    expect(buyNowLabel(0), 'Buy now');
    expect(buyNowLabel(195), 'Buy now at \u20B9195');
    expect(buyNowLabel(138.85), 'Buy now at \u20B9138.85');
  });

  test('the JS clicker targets both cart and buy button labels', () {
    expect(cartLabels, containsAll(<String>['add to cart', 'add to bag']));
    expect(buyLabels, contains('buy now'));
    // The injected script is an IIFE body that returns '1' or '0'.
    expect(clickSellerButtonJs.contains('function(labelsRaw)'), isTrue);
    expect(clickSellerButtonJs.contains("return '1'"), isTrue);
    expect(clickSellerButtonJs.contains("return '0'"), isTrue);
  });
}
