/// Own-history navigation stack for the in-app browser (owner bug 22 Oct:
/// "back button kaam ni krta redirection ke baad").
///
/// Why the WebView's canGoBack()/goBack() alone is wrong here:
/// 1. Every merchant link enters through the /api/out masking pointer which
///    302-hops through an affiliate network before landing on the merchant.
///    After that redirect chain Android WebView's back list is often EMPTY
///    (canGoBack=false), so the toolbar Back rendered permanently disabled.
/// 2. When the back list is NOT empty, its entry is the redirect pointer:
///    goBack() reloads it and the server instantly bounces the user forward
///    to the same page — a redirect loop that reads as "back is dead".
///
/// So the browser keeps its own stack of settled page URLs (onPageFinished)
/// and never steps onto a redirect entry: stepping there means EXIT the
/// browser and return to the app, which is what a user pressing Back on a
/// redirect landing actually wants.
class BrowserNavStack {
  final List<String> _pages = <String>[];
  int _idx = -1;

  /// The full URL the browser was opened with (often the /api/out pointer).
  final String entryUrl;

  BrowserNavStack(this.entryUrl);

  int get index => _idx;
  int get length => _pages.length;
  String? get current => (_idx >= 0 && _idx < _pages.length) ? _pages[_idx] : null;

  /// Toolbar Back is always tappable: it goes back in-page, or exits.
  bool get canGoBack => _idx > 0;
  bool get canGoForward => _idx >= 0 && _idx + 1 < _pages.length;

  /// True when [url] is the browser's entry point or a server masking pointer —
  /// such entries must never be RELOADED (they redirect-bounce forward).
  static bool isRedirectEntry(String url) =>
      url.contains('/api/out?') || url.contains('/api/out/');

  /// Record a settled page URL (onPageFinished). Recognizes stepping back /
  /// forward through already-seen pages; anything else starts a new branch
  /// (truncating the stale forward tail), like a real browser.
  void record(String url) {
    if (url.isEmpty) return;
    if (_idx >= 0 && _idx < _pages.length && url == _pages[_idx]) return;
    if (_idx > 0 && url == _pages[_idx - 1]) {
      _idx--;
      return;
    }
    if (_idx >= 0 && _idx + 1 < _pages.length && url == _pages[_idx + 1]) {
      _idx++;
      return;
    }
    if (_idx < 0) {
      _pages.add(url);
      _idx = 0;
      return;
    }
    if (_pages.length > 40) {
      _pages.removeRange(0, 20);
      _idx -= 20;
    }
    _pages.removeRange(_idx + 1, _pages.length);
    _pages.add(url);
    _idx = _pages.length - 1;
  }

  /// Previous page to display, or null when Back should EXIT the browser.
  /// Never reloads a /api/out pointer (it would bounce forward again), and a
  /// redirect-ENTRY session exits at the first recorded page — the merchant
  /// landing IS the user's first page; before it there is only the redirect
  /// chain they came through. A directly-opened merchant URL stays a normal
  /// first page the user can go back to.
  String? back() {
    while (_idx > 0) {
      _idx--;
      final u = _pages[_idx];
      final exitHere =
          isRedirectEntry(u) || (_idx == 0 && isRedirectEntry(entryUrl));
      if (exitHere) break;
      return u;
    }
    return null;
  }

  /// Next page to display (after a back), or null at the tip.
  String? forward() {
    if (_idx >= 0 && _idx + 1 < _pages.length) {
      _idx++;
      return _pages[_idx];
    }
    return null;
  }
}
