import 'package:flutter_test/flutter_test.dart';

import 'package:try1second/core/nav_stack.dart';

void main() {
  group('BrowserNavStack — redirect-aware back (owner 22 Oct)', () {
    test('redirect landing: pointer never fired onPageFinished -> Back exits', () {
      final nav = BrowserNavStack('https://try1second.com/api/out?p=abc');
      nav.record('https://www.myntra.com/');
      expect(nav.back(), isNull); // exits the browser instead of a dead button
      expect(nav.current, 'https://www.myntra.com/');
    });

    test('redirect landing: pointer DID fire onPageFinished -> Back still exits', () {
      final nav = BrowserNavStack('https://try1second.com/api/out?p=abc');
      nav.record('https://try1second.com/api/out?p=abc');
      nav.record('https://www.myntra.com/');
      expect(nav.back(), isNull); // never reloads the pointer (bounce loop)
    });

    test('affiliate-network hop in the stack is skipped on back', () {
      final nav = BrowserNavStack('https://try1second.com/api/out?p=abc');
      nav.record('https://linksredirect.com/?cid=1');
      nav.record('https://www.myntra.com/');
      nav.record('https://www.myntra.com/shirt');
      expect(nav.back(), 'https://www.myntra.com/');
      expect(nav.back(), isNull); // landing reached -> exit
    });

    test('in-page navigation goes back and forward through visited pages', () {
      final nav = BrowserNavStack('https://www.flipkart.com/');
      nav.record('https://www.flipkart.com/');
      nav.record('https://www.flipkart.com/search?q=watch');
      nav.record('https://www.flipkart.com/item/1');
      expect(nav.canGoBack, isTrue);
      expect(nav.back(), 'https://www.flipkart.com/search?q=watch');
      expect(nav.back(), 'https://www.flipkart.com/');
      expect(nav.canGoForward, isTrue);
      expect(nav.forward(), 'https://www.flipkart.com/search?q=watch');
      expect(nav.forward(), 'https://www.flipkart.com/item/1');
      expect(nav.canGoForward, isFalse);
    });

    test('stepping back then opening a NEW page trims the stale forward tail', () {
      final nav = BrowserNavStack('https://www.amazon.in/');
      nav.record('https://www.amazon.in/');
      nav.record('https://www.amazon.in/a');
      nav.record('https://www.amazon.in/b');
      nav.back(); // now on a
      nav.record('https://www.amazon.in/c');
      expect(nav.forward(), isNull); // b is gone
      expect(nav.back(), 'https://www.amazon.in/a');
      expect(nav.back(), 'https://www.amazon.in/');
      expect(nav.canGoBack, isFalse);
    });

    test('record() dedupes the same page and recognizes stepping in both directions', () {
      final nav = BrowserNavStack('https://oyo.com/');
      nav.record('https://oyo.com/x');
      nav.record('https://oyo.com/x'); // duplicate settle — no extra entry
      nav.record('https://oyo.com/y');
      nav.record('https://oyo.com/x'); // settled via webview goBack — steps back
      expect(nav.current, 'https://oyo.com/x');
      expect(nav.canGoForward, isTrue);
      nav.record('https://oyo.com/y'); // and forward again
      expect(nav.current, 'https://oyo.com/y');
      expect(nav.length, 2); // entry never settled; only x and y are pages
    });

    test('empty and blank URLs are ignored', () {
      final nav = BrowserNavStack('https://agoda.com/');
      nav.record('');
      expect(nav.current, isNull);
      nav.record('https://agoda.com/hotels');
      expect(nav.current, 'https://agoda.com/hotels');
    });

    test('stack is capped: oldest entries drop after 40 pages', () {
      final nav = BrowserNavStack('https://croma.com/');
      for (var i = 0; i < 60; i++) {
        nav.record('https://croma.com/p/$i');
      }
      expect(nav.length <= 41, isTrue);
      expect(nav.canGoBack, isTrue);
      expect(nav.back(), isNotNull);
    });
  });
}
