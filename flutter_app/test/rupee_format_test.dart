import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/ui/widgets/home_showcase.dart';

void main() {
  test('home showcase price grouping: 1000 renders 1,000, never 10,00', () {
    expect(formatRupee(1000), '1,000');
    expect(formatRupee(999), '999');
    expect(formatRupee(10000), '10,000');
    expect(formatRupee(109999), '1,09,999');
    expect(formatRupee(12345678), '1,23,45,678');
    expect(formatRupee(199.5), '199.50');
  });
}
