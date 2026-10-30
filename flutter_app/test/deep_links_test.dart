import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/deep_links.dart';

/// OWNER 29 Oct: universal links must open the app on the same screen the website
/// would show. These are the URL shapes the site itself produces (VERTICAL_PATHS in
/// src/utils/verticalRoutes.ts and the SEO slug reader in AppContext), so the app's
/// copy of that grammar is pinned here.
void main() {
  group('vertical routes', () {
    test('route slug becomes "From to To" exactly like the site', () {
      expect(DeepLinks.queryFromSlug('flights', 'delhi-to-mumbai-flights'), 'Delhi to Mumbai');
      expect(DeepLinks.queryFromSlug('bus', 'indore-to-bhopal-bus'), 'Indore to Bhopal');
      // Multi-word cities keep every word.
      expect(DeepLinks.queryFromSlug('flights', 'new-delhi-to-port-blair-flights'), 'New Delhi to Port Blair');
    });

    test('city pages use the tail as the starting query', () {
      expect(DeepLinks.queryFromSlug('hotels', 'indore'), 'Indore');
      expect(DeepLinks.queryFromSlug('hotels', 'jim-corbett'), 'Jim Corbett');
      expect(DeepLinks.queryFromSlug('cabs', 'bengaluru'), 'Bengaluru');
      expect(DeepLinks.queryFromSlug('food', 'biryani-in-indore'), 'Biryani In Indore');
    });

    test('category pages become a natural phrase', () {
      expect(DeepLinks.queryFromSlug('loans', 'personal-loan'), 'personal loan');
      expect(DeepLinks.queryFromSlug('insurance', 'health-insurance'), 'health insurance');
      expect(DeepLinks.queryFromSlug('credit-cards', 'hdfc-credit-card'), 'hdfc credit card');
    });
  });

  group('product slugs', () {
    test('de-slugged title matches the site capitalisation rule', () {
      expect(DeepLinks.titleFromSlug('iphone-16-128gb-black'), 'Iphone 16 128gb Black');
      // A leading number stays as typed (site rule).
      expect(DeepLinks.titleFromSlug('55-inch-smart-tv'), '55 Inch Smart Tv');
    });

    test('empty slug never becomes an empty product page', () {
      expect(DeepLinks.titleFromSlug(''), '');
    });
  });

  group('link ownership', () {
    test('our https hosts and the custom scheme are internal', () {
      expect(DeepLinks.isInternal(Uri.parse('https://www.try1second.com/flights')), isTrue);
      expect(DeepLinks.isInternal(Uri.parse('https://try1second.com/hotels/indore')), isTrue);
      expect(DeepLinks.isInternal(Uri.parse('try1second://flights?query=Delhi')), isTrue);
      expect(DeepLinks.isInternal(Uri.parse('https://www.try1second.com/product/iphone-16')), isTrue);
      expect(DeepLinks.isInternal(Uri.parse('https://www.try1second.com/')), isTrue);
    });

    test('affiliate hop, interstitials and private routes stay in the browser', () {
      expect(DeepLinks.isInternal(Uri.parse('https://www.try1second.com/api/out?t=abc')), isFalse);
      expect(DeepLinks.isInternal(Uri.parse('https://www.try1second.com/redirect?u=x')), isFalse);
      expect(DeepLinks.isInternal(Uri.parse('https://www.try1second.com/admininsta')), isFalse);
      expect(DeepLinks.isInternal(Uri.parse('https://www.try1second.com/merchantinstab2b')), isFalse);
      expect(DeepLinks.isInternal(Uri.parse('https://www.flipkart.com/x')), isFalse);
    });
  });
}
