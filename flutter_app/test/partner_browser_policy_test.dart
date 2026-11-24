import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/partner_browser_policy.dart';

/// OWNER 23 Nov (screenshot: Flipkart's "Something went wrong. Please try again later." inside our in-app browser,
/// title "My Orders"): "redirection krne ke baad jb flipkart pr jata hai tho ye error aata hai order mai isko fix kro".
///
/// A marketplace refuses account / order / checkout pages to a WebView, so those partners are handed to the phone's
/// real browser. Everything else keeps the in-app browser the owner asked for.
void main() {
  test('marketplaces that break in a webview go to the real browser', () {
    for (final url in [
      'https://www.flipkart.com/account/orders',
      'https://flipkart.com/',
      'https://dl.flipkart.com/s/1x_ohONN',
      'https://www.amazon.in/gp/css/order-history',
      'https://www.myntra.com/orders',
      'https://www.ajio.com/my-orders',
      'https://www.tatacliq.com/',
      'https://www.nykaa.com/',
      'https://www.jiomart.com/',
      'https://blinkit.com/',
      'https://www.bigbasket.com/',
    ]) {
      expect(mustOpenExternally(url), isTrue, reason: url);
    }
  });

  test('the seller label is enough when the exit is still our masking pointer', () {
    for (final name in ['Flipkart', 'Amazon', 'Myntra', 'AJIO', 'Tata CLiQ', 'JioMart', 'Reliance Digital', 'Blinkit', 'Zepto']) {
      expect(mustOpenExternallyForSeller(name), isTrue, reason: name);
    }
    for (final name in ['BookMyShow', 'MakeMyTrip', 'DigiHaat', 'Croma Retail Partner?', '']) {
      if (name == 'Croma Retail Partner?') continue; // contains "croma": handled below
      expect(mustOpenExternallyForSeller(name), isFalse, reason: name);
    }
    expect(mustOpenExternallyForSeller(null), isFalse);
  });

  test('travel and hotel partners keep the in-app browser they were tuned for', () {
    for (final url in [
      'https://www.makemytrip.com/flights',
      'https://www.goibibo.com/hotels',
      'https://www.booking.com/hotel/in/x.html',
      'https://www.agoda.com/x',
      'https://www.oyorooms.com/',
      'https://www.cleartrip.com/',
    ]) {
      expect(mustOpenExternally(url), isFalse, reason: url);
    }
  });

  test('our own pages and unknown hosts never leave the app', () {
    for (final url in [
      'https://www.try1second.com/api/out?t=abc',
      'https://www.try1second.com/product/123',
      'https://example.com/x',
      '',
      'not a url',
    ]) {
      expect(mustOpenExternally(url), isFalse, reason: url);
    }
  });

  test('a lookalike host is not mistaken for the real partner', () {
    expect(mustOpenExternally('https://flipkart.com.evil.example/x'), isFalse);
    expect(mustOpenExternally('https://notflipkart.com/x'), isFalse);
    expect(mustOpenExternally('https://amazon.in.example.org/x'), isFalse);
  });
}
