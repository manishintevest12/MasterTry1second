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

  _headerRemovalGuards();
}

/// OWNER 8 Nov ("redirection ke baad header or link ko hide krne ke liye jo black colour ka hai
/// usko hata do flutter app se, wo search bar v partner ka hide kr de raha hai"): the dark
/// #131725 overlay strip (merchant name + pull tab + link line) used to sit ON TOP of the partner
/// page and hid its own logo/search bar. It must not come back, and the WebView must handle the
/// status bar itself so nothing of ours covers the merchant header.
void _headerRemovalGuards() {
  test('the dark overlay header and its masking colours are gone', () {
    final src = File('lib/ui/screens/in_app_browser_screen.dart').readAsStringSync();
    expect(src.contains('_HeaderOverlay'), isFalse);
    // The strip is identified by its masking container + widget, not by the dark tone, which the
    // bottom toolbar legitimately still uses for its labels.
    expect(src.contains('Full-width dark overlay header'), isFalse);
    expect(src.contains('pull tab'), isFalse);
  });

  test('the webview is safe-area wrapped so the partner header is fully visible', () {
    final src = File('lib/ui/screens/in_app_browser_screen.dart').readAsStringSync();
    expect(src.contains('SafeArea(\n                bottom: false,\n                child: WebViewWidget('), isTrue);
  });
}
