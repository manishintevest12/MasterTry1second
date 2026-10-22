import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'product_screen.dart';
import 'package:try1second/core/nav_stack.dart';

/// Derives a friendly seller name from the redirect's final host, mirroring the
/// seller labels the engine itself uses (Air India, MakeMyTrip, redBus, ...).
String hostDisplayName(String url) {
  final uri = Uri.tryParse(url);
  final host = (uri?.host ?? '').toLowerCase().replaceFirst(RegExp(r'^www\.'), '');
  if (host.isEmpty) return 'Website';
  const known = <String, String>{
    'makemytrip': 'MakeMyTrip',
    'goibibo': 'Goibibo',
    'airindia': 'Air India',
    'airindiaexpress': 'Air India Express',
    'indigo': 'IndiGo',
    'akasaair': 'Akasa Air',
    'spicejet': 'SpiceJet',
    'vistara': 'Vistara',
    'irctc': 'IRCTC',
    'redbus': 'redBus',
    'abhibus': 'AbhiBus',
    'zingbus': 'Zingbus',
    'ixigo': 'Ixigo',
    'easemytrip': 'EaseMyTrip',
    'cleartrip': 'Cleartrip',
    'yatra': 'Yatra',
    'expedia': 'Expedia',
    'kiwi': 'Kiwi.com',
    'agoda': 'Agoda',
    'booking': 'Booking.com',
    'hotels': 'Hotels.com',
    'oyorooms': 'OYO',
    'airbnb': 'Airbnb',
    'amazon': 'Amazon',
    'flipkart': 'Flipkart',
    'myntra': 'Myntra',
    'ajio': 'AJIO',
    'tatacliq': 'Tata CLiQ',
    'meesho': 'Meesho',
    'zomato': 'Zomato',
    'swiggy': 'Swiggy',
    'dominos': "Domino's",
    'pizza hut': 'Pizza Hut',
    'pizzahut': 'Pizza Hut',
    'blinkit': 'Blinkit',
    'zepto': 'Zepto',
    'bigbasket': 'BigBasket',
    'jiomart': 'JioMart',
    'bookmyshow': 'BookMyShow',
    'paytm': 'Paytm',
    'pvr': 'PVR INOX',
    'cinepolis': 'Cinepolis',
    'uber': 'Uber',
    'ola': 'Ola',
    'meru': 'Meru',
    'linksredirect': 'Try1Second',
    'try1second': 'Try1Second',
  };
  for (final e in known.entries) {
    if (host.contains(e.key)) return e.value;
  }
  // Fallback: drop the TLD and title-case the rest ("tajawwad" -> "Tajawwad").
  final parts = host.split('.');
  final core = parts.length > 1 ? parts.sublist(0, parts.length - 1).join(' ') : parts.first;
  return core
      .replaceAll(RegExp(r'[-_]'), ' ')
      .split(' ')
      .where((w) => w.isNotEmpty)
      .map((w) => w.length <= 3 ? w.toUpperCase() : '${w[0].toUpperCase()}${w.substring(1)}')
      .join(' ');
}

/// The image-3 "Buy now at ₹X" label; without a verified price it stays honest
/// and just says "Buy now" (it still clicks the seller's own button).
String buyNowLabel(double? price) {
  if (price == null || price <= 0) return 'Buy now';
  final amt = price == price.roundToDouble() ? price.round().toString() : price.toStringAsFixed(2);
  return 'Buy now at \u20B9$amt';
}

/// Finds the seller's OWN cart / buy-now button inside the embedded page and
/// clicks it (scrollIntoView + click), exactly like the image-3 reference: the
/// wrapper's bottom buttons drive the seller's real buttons. Honest fallback:
/// if the page exposes no such button we say so — nothing is faked.
const String clickSellerButtonJs = '''
(function(labelsRaw){
  try {
    var norm = function(s){ return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
    var wants = labelsRaw.split('|').map(norm).filter(function(w){ return w.length > 0; });
    var sel = 'button, a, input[type=button], input[type=submit], div[role=button], span[role=button], li[role=button]';
    var els = Array.prototype.slice.call(document.querySelectorAll(sel));
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var t = norm(el.innerText || el.value || el.getAttribute('aria-label') || el.title || '');
      if (!t) continue;
      for (var j = 0; j < wants.length; j++) {
        var w = wants[j];
        if (t === w || (t.indexOf(w) === 0 && t.length <= w.length + 4)) {
          el.scrollIntoView({behavior: 'smooth', block: 'center'});
          el.click();
          return '1';
        }
      }
    }
    return '0';
  } catch (e) { return '0'; }
})
''';

const List<String> cartLabels = [
  'add to cart', 'add to bag', 'add to basket', 'add cart', 'add to trolley', 'add item',
];
const List<String> buyLabels = [
  'buy now', 'buy', 'place order', 'order now', 'book now', 'proceed to pay', 'pay now',
  'order food', 'grab deal', 'get deal', 'view price', 'select seats',
];

/// In-app browser (owner spec, 21 Oct image-3): every offer redirection opens
/// INSIDE the app — dark header (#0d172a) with a white favicon+seller pill that
/// hides the URL, a fixed bottom action bar ("Add to cart" + "Buy now at ₹X"
/// which click the seller's own buttons inside the page), and a browser toolbar
/// (Back / Forward / Refresh / Price history / Expand).
class InAppBrowserScreen extends StatefulWidget {
  const InAppBrowserScreen({super.key, required this.url, this.sellerName, this.price});

  /// Initial URL — usually the /api/out masking pointer; the webview follows
  /// the 302 to the seller automatically.
  final String url;
  final String? sellerName;
  /// Verified price from the offer — powers the "Buy now at ₹X" button.
  final double? price;

  @override
  State<InAppBrowserScreen> createState() => _InAppBrowserScreenState();
}

class _InAppBrowserScreenState extends State<InAppBrowserScreen> {
  WebViewController? _controller;
  String _currentUrl = '';
  bool _loading = true;
  bool _acting = false;
  /// Own-history back/forward (webview canGoBack lies after redirect chains).
  late final BrowserNavStack _nav;

  String get _siteName => hostDisplayName(_currentUrl.isEmpty ? widget.url : _currentUrl);

  @override
  void initState() {
    super.initState();
    _currentUrl = widget.url;
    _nav = BrowserNavStack(widget.url);
    final c = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onPageStarted: (url) => _set(url: url, loading: true),
        onPageFinished: (url) => _syncState(url: url, loading: false),
        // Block popups/blank targets inside the embedded view.
        onNavigationRequest: (req) => req.url.startsWith('http') ? NavigationDecision.navigate : NavigationDecision.prevent,
      ))
      ..loadRequest(Uri.parse(widget.url));
    _controller = c;
  }

  void _set({String? url, bool? loading, bool? acting}) {
    if (!mounted) return;
    setState(() {
      if (url != null) _currentUrl = url;
      if (loading != null) _loading = loading;
      if (acting != null) _acting = acting;
    });
  }

  Future<void> _syncState({String? url, bool? loading}) async {
    if (url != null) _nav.record(url);
    if (!mounted) return;
    setState(() {
      if (url != null) _currentUrl = url;
      if (loading != null) _loading = loading;
    });
  }

  /// Toolbar Back — always functional: goes back inside the merchant site, and
  /// when the landing came via a redirect chain it EXITS back to the app
  /// (never reloads the /api/out pointer, which would bounce forward again).
  Future<void> _goBack() async {
    final u = _nav.back();
    if (u == null) {
      if (mounted && Navigator.of(context).canPop()) Navigator.of(context).pop();
      return;
    }
    _set(loading: true);
    await _controller?.loadRequest(Uri.parse(u));
    _syncState(url: u);
  }

  /// Toolbar Forward — replays a real visited page (redirect entries skipped).
  Future<void> _goForward() async {
    final u = _nav.forward();
    if (u == null) return;
    _set(loading: true);
    await _controller?.loadRequest(Uri.parse(u));
    _syncState(url: u);
  }

  Future<void> _refresh() => _controller?.reload() ?? Future.value();

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        content: Text(msg, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
        behavior: SnackBarBehavior.floating,
        backgroundColor: const Color(0xFF0D172A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      ));
  }

  /// Clicks the seller's own cart / buy button inside the embedded page.
  Future<void> _clickSellerButton(List<String> labels, String what) async {
    final ctl = _controller;
    if (ctl == null || _acting) return;
    _set(acting: true);
    try {
      final js = '$clickSellerButtonJs("${labels.join('|')}")';
      final r = await ctl.runJavaScriptReturningResult(js);
      final hit = '$r'.trim().replaceAll('"', '') == '1';
      if (!mounted) return;
      if (hit) {
        _toast('$what tapped on ${_siteName}');
      } else {
        _toast("Scroll the page — use $what on ${_siteName}'s own buttons");
      }
    } catch (_) {
      if (mounted) _toast("Scroll the page — use $what on ${_siteName}'s own buttons");
    } finally {
      _set(acting: false);
    }
  }

  void _priceHistory() {
    final url = _currentUrl.isEmpty ? widget.url : _currentUrl;
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => ProductScreen(input: url)),
    );
  }

  Future<void> _expand() async {
    final url = _currentUrl.isEmpty ? widget.url : _currentUrl;
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  String get _buyLabel => buyNowLabel(widget.price);

  @override
  Widget build(BuildContext context) {
    final name = widget.sellerName?.isNotEmpty == true ? widget.sellerName! : _siteName;
    final host = Uri.tryParse(_currentUrl.isEmpty ? widget.url : _currentUrl)?.host ?? '';
    final favicon =
        host.isEmpty ? null : 'https://www.google.com/s2/favicons?sz=64&domain=$host';

    return Scaffold(
      backgroundColor: const Color(0xFF0D172A),
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: Container(
          color: const Color(0xFF0D172A),
          child: SafeArea(
            bottom: false,
            child: Row(children: [
              // Back arrow — returns to the app
              IconButton(
                onPressed: _goBack,
                icon: const Icon(Icons.keyboard_arrow_left, color: Colors.white, size: 30),
              ),
              // Favicon + seller-name pill; the URL itself is never shown.
              Expanded(
                child: Container(
                  height: 38,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(19),
                  ),
                  child: Row(children: [
                    if (favicon != null)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: Image.network(
                          favicon,
                          width: 20,
                          height: 20,
                          errorBuilder: (_, __, ___) => const Icon(Icons.language, size: 20),
                        ),
                      ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.black),
                      ),
                    ),
                    // X — closes the embedded view immediately
                    InkWell(
                      onTap: () => Navigator.of(context).pop(),
                      child: const Icon(Icons.close, size: 20, color: Colors.black54),
                    ),
                  ]),
                ),
              ),
              const SizedBox(width: 12),
              if (_loading)
                const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white70),
                )
              else
                const SizedBox(width: 20),
              const SizedBox(width: 8),
            ]),
          ),
        ),
      ),
      body: _controller == null
          ? const SizedBox.shrink()
          : WebViewWidget(
              controller: _controller!,
              gestureRecognizers: {
                Factory<VerticalDragGestureRecognizer>(() => VerticalDragGestureRecognizer()),
              },
            ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Persistent action bar (image-3): the two purchase buttons sit fixed
          // at the bottom above the browser toolbar and drive the seller's own
          // page buttons.
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
            child: Row(children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _acting ? null : () => _clickSellerButton(cartLabels, 'Add to cart'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    side: const BorderSide(color: Colors.black, width: 1.2),
                    backgroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text('Add to cart',
                      style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: Colors.black)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: TextButton(
                  onPressed: _acting ? null : () => _clickSellerButton(buyLabels, 'Buy'),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    backgroundColor: const Color(0xFFFFD814),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: Text(_buyLabel,
                      style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Colors.black)),
                ),
              ),
            ]),
          ),
          _BottomToolBar(
            canGoBack: true, // in-page back, else exit to the app — never dead
            canGoForward: _nav.canGoForward,
            onBack: _goBack,
            onForward: _goForward,
            onRefresh: _refresh,
            onPriceHistory: _priceHistory,
            onExpand: _expand,
          ),
        ],
      ),
    );
  }
}

class _BottomToolBar extends StatelessWidget {
  const _BottomToolBar({
    required this.canGoBack,
    required this.canGoForward,
    required this.onBack,
    required this.onForward,
    required this.onRefresh,
    required this.onPriceHistory,
    required this.onExpand,
  });

  final bool canGoBack;
  final bool canGoForward;
  final VoidCallback onBack;
  final VoidCallback onForward;
  final VoidCallback onRefresh;
  final VoidCallback onPriceHistory;
  final VoidCallback onExpand;

  Widget _btn(IconData icon, String label, VoidCallback onTap, {bool enabled = true, bool highlight = false}) {
    final color = !enabled
        ? Colors.black26
        : highlight
            ? const Color(0xFFE11D48)
            : Colors.black;
    return Expanded(
      child: InkWell(
        onTap: enabled ? onTap : null,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 22, color: color),
          const SizedBox(height: 3),
          Text(label, style: TextStyle(fontSize: 10.5, color: color, fontWeight: FontWeight.w500)),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFE5E7EB),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 58,
          child: Row(children: [
            _btn(Icons.arrow_back, 'Back', onBack, enabled: canGoBack),
            _btn(Icons.arrow_forward, 'Forward', onForward, enabled: canGoForward),
            _btn(Icons.refresh, 'Refresh', onRefresh),
            _btn(Icons.bar_chart_rounded, 'Price history', onPriceHistory, highlight: true),
            _btn(Icons.open_in_full, 'Expand', onExpand),
          ]),
        ),
      ),
    );
  }
}
