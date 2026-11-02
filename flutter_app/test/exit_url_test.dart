import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/api.dart';

/// OWNER 2 Nov: "book dabane par partner website nahi khul rahi, blank white page".
/// The masking pointer must be resolved against the PUBLIC site host. Resolving it against the
/// API relay produced 401 {"error":"unauthorized"} inside the webview, which paints as a blank
/// page under the seller's name.
void main() {
  test('a relative masking pointer goes to the public site, never the relay', () {
    final u = exitUrl('/api/out?t=abc123');
    expect(u, 'https://www.try1second.com/api/out?t=abc123');
    expect(u.contains('workers.dev'), isFalse);
  });

  test('an absolute partner URL is left exactly as the server minted it', () {
    const partner = 'https://in.flightnetwork.com/from/sharedurl/air/IDRDEL19NOV/c:Y?selectionKey=x';
    expect(exitUrl(partner), partner);
  });

  test('an empty pointer cannot produce a bare host', () {
    expect(exitUrl(''), '');
  });
}
