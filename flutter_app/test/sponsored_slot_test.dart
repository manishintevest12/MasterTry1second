import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/ui/widgets/sponsored_slot.dart';

void main() {
  group('SponsoredOffer.fromJson fails closed', () {
    test('accepts a masked /api/out pointer from the deals registry', () {
      final o = SponsoredOffer.fromJson({
        'merchant': 'Amazon',
        'title': 'Up to 60% off',
        'discount': '60% off',
        'url': '/api/out?p=abc',
      });
      expect(o, isNotNull);
      expect(o!.merchant, 'Amazon');
      expect(o.discount, '60% off');
    });

    test('accepts an absolute https partner url', () {
      final o = SponsoredOffer.fromJson({'merchant': 'Flipkart', 'url': 'https://flipkart.com/x'});
      expect(o?.merchant, 'Flipkart');
    });

    test('rejects anything that is not a partner https page or an /api/out pointer', () {
      expect(SponsoredOffer.fromJson({'merchant': 'X', 'url': 'http://insecure.example'}), isNull);
      expect(SponsoredOffer.fromJson({'merchant': 'X', 'url': 'javascript:alert(1)'}), isNull);
      expect(SponsoredOffer.fromJson({'merchant': 'X', 'url': 'intent://pay'}), isNull);
      expect(SponsoredOffer.fromJson({'merchant': 'X', 'url': ''}), isNull);
      expect(SponsoredOffer.fromJson({'merchant': '', 'title': '', 'url': '/api/out?p=1'}), isNull);
      expect(SponsoredOffer.fromJson('not a map'), isNull);
    });
  });

  group('injectSponsoredCard', () {
    Widget label(String s) => SizedBox(key: ValueKey(s));

    test('places the paid card after the 6th result, never at the top of a normal vertical', () {
      final rows = List<Widget>.generate(10, (i) => label('r$i'));
      final out = injectSponsoredCard(rows, label('ad'));
      expect(out.length, 11);
      expect((out[6].key as ValueKey).value, 'ad');
      expect((out[5].key as ValueKey).value, 'r5');
      expect((out[7].key as ValueKey).value, 'r6');
    });

    test('leaves a short list untouched so no paid row becomes the last thing seen', () {
      final rows = List<Widget>.generate(6, (i) => label('r$i'));
      expect(injectSponsoredCard(rows, label('ad')), same(rows));
    });

    test('no card means no change', () {
      final rows = List<Widget>.generate(12, (i) => label('r$i'));
      expect(injectSponsoredCard(rows, null), same(rows));
    });
  });

  test('smartlink pill can only open on the user tap (no timer, no auto-open)', () {
    final src = File('lib/ui/widgets/sponsored_pill.dart').readAsStringSync();
    final code = src.split('\n').where((l) => !l.trimLeft().startsWith('//') && !l.trimLeft().startsWith('///')).join('\n');
    expect(code.contains('Timer('), isFalse, reason: 'an ad must never fire itself');
    expect(code.contains('initState'), isTrue);
    final init = code.substring(code.indexOf('initState'), code.indexOf('Widget build'));
    expect(init.contains('openFromUserTap'), isFalse, reason: 'initState may only check availability');
    expect(code.contains('openFromUserTap()'), isTrue, reason: 'the tap is the only trigger');
    expect(code.contains('openFromUserTap()'), isTrue);
    expect(RegExp(r'onTap: \(\) => AdSmartlink\.openFromUserTap\(\)').hasMatch(code), isTrue);
  });
}
