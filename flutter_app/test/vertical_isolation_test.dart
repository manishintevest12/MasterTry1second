import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/verticals.dart';

// OWNER 3 Nov: "maine search kiya hotel mai goa but by default ecommerce mai v goa aa gaya... hr
// vertical ke dusre se alag hai unka aapas mai kuch lena dena ni hai". A search intent may only be
// applied to the vertical it was created for.
void main() {
  test('a hotels search never applies to e-commerce', () {
    expect(pendingFitsVertical('hotels', 'ecommerce'), isFalse);
    expect(pendingFitsVertical('hotels', 'grocery'), isFalse);
    expect(pendingFitsVertical('hotels', 'food'), isFalse);
    expect(pendingFitsVertical('hotels', 'flights'), isFalse);
  });

  test('same-vertical intents still apply', () {
    expect(pendingFitsVertical('hotels', 'hotels'), isTrue);
    expect(pendingFitsVertical('flights', 'flights'), isTrue);
    expect(pendingFitsVertical('ecommerce', 'ecommerce'), isTrue);
  });

  test('movies/movie are the same vertical', () {
    expect(pendingFitsVertical('movies', 'movie'), isTrue);
    expect(pendingFitsVertical('movie', 'movies'), isTrue);
    expect(normalizeVerticalId('MOVIES'), 'movie');
  });

  test('an empty or unknown intent never lands anywhere', () {
    expect(pendingFitsVertical('', 'ecommerce'), isFalse);
    expect(pendingFitsVertical('hotels', ''), isFalse);
  });
}
