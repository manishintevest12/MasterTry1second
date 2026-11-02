// Owner 1 Nov: "bhopal likhne par Switzerland ke result aaye" was caused by an
// ESCAPED interpolation (\${...}) inside a request path — Dart then ships the
// literal text instead of the value, so the phone silently never sent the query.
// This guard fails the build if the pattern comes back anywhere in lib/.
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('lib/ has no escaped string interpolation', () {
    final offenders = <String>[];
    for (final f in Directory('lib').listSync(recursive: true)) {
      if (f is! File || !f.path.endsWith('.dart')) continue;
      final lines = f.readAsLinesSync();
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].contains(r'\${')) offenders.add('${f.path}:${i + 1}');
      }
    }
    expect(offenders, isEmpty, reason: 'escaped interpolation: ${offenders.join(', ')}');
  });
}
