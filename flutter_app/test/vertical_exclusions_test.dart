import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/vertical_exclusions.dart';

/// OWNER 21 Nov: "digihaat.in ko aap food delivery, 10 min grocery se hata do".
/// OWNER 22 Nov (again): "muje digihaat.in sirf ecommerce section mai chaiye pr wo abhi v 10 min grocery mai aa raha
/// hai usko hatao iss vertical se aur ye kitni baar bolu".
///
/// The server drops these rows, and the app now drops them again on every response — including the previous
/// session's on-disk answer, which is where the partner kept reappearing. DigiHaat stays a partner for e-commerce;
/// only the two shelves the owner scoped it out of are affected.
void main() {
  test('DigiHaat is scoped out of 10-Min Grocery and Food Delivery', () {
    expect(excludedMerchantsFor('grocery'), contains('digihaat'));
    expect(excludedMerchantsFor('food'), contains('digihaat'));
    expect(excludedMerchantsFor('ecommerce'), isEmpty);
    expect(excludedMerchantsFor('movies'), isEmpty);
  });

  test('the merchant name is caught wherever a row carries it', () {
    // the four shapes a real row puts it in: provider, title, url, seller quote
    expect(isExcludedMerchant('grocery', ['DigiHaat']), isTrue);
    expect(isExcludedMerchant('grocery', ['Amul Milk 500 ml - DigiHaat']), isTrue);
    expect(isExcludedMerchant('grocery', ['https://digihaat.in/en/product/123']), isTrue);
    expect(isExcludedMerchant('grocery', ['BigBasket', 'Digi Haat']), isTrue);
    expect(isExcludedMerchant('grocery', ['Amul Milk', 'BigBasket']), isFalse);
  });

  test('e-commerce keeps DigiHaat: this is a vertical scope, not a partner ban', () {
    expect(isExcludedMerchant('ecommerce', ['DigiHaat']), isFalse);
    expect(isExcludedMerchant('ecommerce', ['https://digihaat.in/en/search?q=milk']), isFalse);
  });

  test('a merchant that merely contains "haat" is never caught', () {
    expect(isExcludedMerchant('grocery', ['Sabzi Haat Fresh']), isFalse);
    expect(isExcludedMerchant('grocery', ['Haat Bazaar']), isFalse);
  });

  test('an empty row never matches', () {
    expect(isExcludedMerchant('grocery', const []), isFalse);
    expect(isExcludedMerchant('grocery', [null, '']), isFalse);
  });
}
