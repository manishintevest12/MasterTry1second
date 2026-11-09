// OWNER 9 Nov: flights and bus cards must show which date the fare answers. The label is built
// from the same specs the servers publish, which differ per source.
import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/compare.dart';
import 'package:try1second/ui/widgets/compare_cards.dart';

CompareItem item(Map<String, dynamic> specs, {String vertical = 'bus'}) => CompareItem.fromJson({
      'id': 'x', 'vertical': vertical, 'title': 't', 'subtitle': '', 'provider': 'p',
      'primaryPrice': 750, 'specs': specs,
    });

void main() {
  test('bus rows date from the normalised Date spec', () {
    expect(journeyDateLabel(item({'Date': '2026-11-25'})), '25 Nov 2026');
  });
  test('flight rows date from departure date, clock in the value is ignored', () {
    expect(journeyDateLabel(item({'departure date': '2026-11-24 07:15'}, vertical: 'flights')), '24 Nov 2026');
  });
  test('a row with no readable date prints nothing', () {
    expect(journeyDateLabel(item({'date': 'tomorrow-ish'})), '');
    expect(journeyDateLabel(item({})), '');
  });
}
