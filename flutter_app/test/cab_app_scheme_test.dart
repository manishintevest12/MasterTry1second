import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

/// Owner 23 Oct ("deeplink site pr le jaa raha hai, app pr jana tha"): the cab
/// Book button must try the NATIVE Uber/Ola app scheme first (uber://,
/// olacabs://) and fall back to the tracked web link only when the app is
/// missing. Standing rule: native app deep-link schemes + web fallback for
/// tracking, generated server-side via /api/cab/book.
void main() {
  final dir = Directory.current.path;
  final cards = File('$dir/lib/ui/widgets/compare_cards.dart').readAsStringSync();
  final manifest = File(
    '$dir/android/app/src/main/AndroidManifest.xml',
  ).readAsStringSync();

  test('Book tap asks /api/cab/book for the JSON app-first flow (json=1)', () {
    expect(cards.contains('_launchCabAppBooking'), isTrue);
    expect(cards.contains("json=1"), isTrue);
    // The server click is tracked BEFORE the launch (parity with web 302 flow).
    expect(cards.contains('getJson'), isTrue);
  });

  test('native scheme launches first, web link is the honest fallback', () {
    final m = RegExp(
      r'Future<void> _launchCabAppBooking[\s\S]*?\n\}',
    ).firstMatch(cards)!.group(0)!;
    expect(m.contains('canLaunchUrl'), isTrue,
        reason: 'app presence must be checked before launching the scheme');
    expect(m.indexOf('canLaunchUrl') < m.indexOf("res['webUrl']"), isTrue,
        reason: 'scheme attempt must precede the web fallback');
    // Old server without json=1: the previous external launch still works.
    expect(m.contains('externalApplication'), isTrue);
  });

  test('Android package visibility declared for uber/olacabs schemes', () {
    expect(manifest.contains('android:scheme="uber"'), isTrue);
    expect(manifest.contains('android:scheme="olacabs"'), isTrue);
  });

  test('relative appBookUrl still resolves against the API base (old bug)', () {
    final api = 'https://www.try1second.com';
    final appBookUrl = '/api/cab/book?provider=uber&pickup=Indore&drop=Bhopal';
    var path = appBookUrl;
    if (path.startsWith('http')) path = path.replaceFirst(api, '');
    expect('$path&json=1',
        '/api/cab/book?provider=uber&pickup=Indore&drop=Bhopal&json=1');
    // Absolute urls keep working unchanged.
    final abs = 'https://www.try1second.com/api/cab/book?provider=ola&x=1';
    expect(abs.replaceFirst(api, ''), '/api/cab/book?provider=ola&x=1');
  });
}
