import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'product_screen.dart';
import 'package:try1second/core/app_handoff.dart';
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


/// In-app browser (owner 23 Oct image-4 spec): every offer redirection opens
/// INSIDE the app — a slim WHITE header (magnifier + seller name + X close, the
/// merchant page starts right below it) and the browser toolbar at the bottom
/// (Back / Forward / Refresh / Price history / Expand). No purchase action
/// bar: the seller's own page buttons are the only checkout path (the 21 Oct
/// purchase overlay of 21 Oct is removed by owner request).
class InAppBrowserScreen extends StatefulWidget {
  const InAppBrowserScreen({super.key, required this.url, this.sellerName, this.price});

  /// Initial URL — usually the /api/out masking pointer; the webview follows
  /// the 302 to the seller automatically.
  final String url;
  final String? sellerName;
  /// Verified offer price (kept for call-site compatibility; the image-4
  /// layout renders no purchase bar, so it is not displayed anywhere).
  final double? price;

  @override
  State<InAppBrowserScreen> createState() => _InAppBrowserScreenState();
}

class _InAppBrowserScreenState extends State<InAppBrowserScreen> {
  WebViewController? _controller;
  String _currentUrl = '';
  bool _loading = true;
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
      // UA marker (owner 23 Oct): the server's /api/out recognizes this and
      // skips the AdSense /redirect interstitial for OUR app — AdSense for
      // Content may not render inside an application webview (publisher
      // policy), and in-app exits must stay instant. Stock Android WebView
      // already carries "; wv)"; this marker makes iOS deterministic too.
      ..setUserAgent(
          'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) '
          'Chrome/128.0.0.0 Mobile Safari/537.36 Try1SecondApp/1.9')
      ..setNavigationDelegate(NavigationDelegate(
        onPageStarted: (url) => _set(url: url, loading: true),
        onPageFinished: (url) => _syncState(url: url, loading: false),
        // App-to-app (owner 30 Oct): a merchant exit can arrive as
        // `intent://...#Intent;package=<partner>;S.browser_fallback_url=<paid url>;end`,
        // or as a partner scheme (uber://, olacabs://, blinkit://, swiggy://...). A webview
        // cannot resolve either, so it is handed to the OS: the partner's installed app
        // opens, and when it is missing the engine's browser_fallback_url (our tracked
        // affiliate link) loads here instead — the click is never lost either way.
        onNavigationRequest: (req) {
          if (AppHandoff.isExternalHandoff(req.url)) {
            _handOff(req.url);
            return NavigationDecision.prevent;
          }
          return req.url.startsWith('http')
              ? NavigationDecision.navigate
              : NavigationDecision.prevent;
        },
      ))
      ..loadRequest(Uri.parse(widget.url));
    _controller = c;
  }

  /// Hands a partner app URL to the OS and keeps a paid fallback if the app is absent.
  Future<void> _handOff(String url) async {
    final fallback = await AppHandoff.open(url);
    if (!mounted) return;
    if (fallback != null && fallback.isNotEmpty) {
      _set(loading: true);
      await _controller?.loadRequest(Uri.parse(fallback));
      _syncState(url: fallback);
    }
  }

  void _set({String? url, bool? loading}) {
    if (!mounted) return;
    setState(() {
      if (url != null) _currentUrl = url;
      if (loading != null) _loading = loading;
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

  @override
  Widget build(BuildContext context) {
    final name = widget.sellerName?.isNotEmpty == true ? widget.sellerName! : _siteName;

    return Scaffold(
      backgroundColor: Colors.white,
      // Owner 23 Oct (image-5 follow-up): the merchant page must feel OPENED
      // INSIDE the app — the partner's own menubar/logo bar hides BEHIND our
      // dark strip. The WebView is FULL-BLEED (fills the whole screen) and the
      // #131725 header overlays on top, so the partner's sticky top menubar
      // sits physically underneath the black header instead of peeking below.
      body: Stack(
        children: [
          if (_controller != null)
            Positioned.fill(
              child: WebViewWidget(
                controller: _controller!,
                gestureRecognizers: {
                  Factory<VerticalDragGestureRecognizer>(() => VerticalDragGestureRecognizer()),
                },
              ),
            ),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: _HeaderOverlay(
              name: name,
              loading: _loading,
              onClose: () => Navigator.of(context).pop(),
            ),
          ),
        ],
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Owner 23 Oct image-4: no purchase bar — the merchant's own page
          // buttons are the only checkout path. Only the browser toolbar stays.
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


/// Full-width dark overlay header (owner 23 Oct): the merchant name strip +
/// white pull tab + load hairline, drawn ON TOP of the full-bleed WebView so
/// the partner site's own menubar/logo stays hidden behind it.
class _HeaderOverlay extends StatelessWidget {
  const _HeaderOverlay({required this.name, required this.loading, required this.onClose});
  final String name;
  final bool loading;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      ignoring: false,
      child: Container(
        decoration: const BoxDecoration(
          color: Color(0xFF131725),
          boxShadow: [BoxShadow(color: Color(0x44000000), blurRadius: 8, offset: Offset(0, 2))],
        ),
        child: SafeArea(
          bottom: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Owner 25 Oct ("header thora sa chota kro — FROM ka address
              // hide ho raha hai"): 68 was hiding Ola's route-input area
              // below the fold; strip 68 -> 56 and the pull-tab spacing
              // 10 -> 6 so the merchant page's own inputs (FROM/TO on Ola)
              // clear the overlay. Still tall enough to mask the typical
              // ~50-56pt merchant menubar; taller menus (24 Oct complaint)
              // are masked by the strip + tab, not the full 68 anymore.
              SizedBox(
                height: 56,
                child: Row(children: [
                  const SizedBox(width: 14),
                  const Icon(Icons.travel_explore, size: 20, color: Colors.white70),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white),
                    ),
                  ),
                  InkWell(
                    onTap: onClose,
                    child: const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      child: Icon(Icons.close, size: 22, color: Colors.white70),
                    ),
                  ),
                ]),
              ),
              // White tab handle centered under the dark strip (owner 23 Oct;
              // margin trimmed 10 -> 6 with the shorter 25 Oct strip).
              Center(
                child: Container(
                  width: 36,
                  height: 4.5,
                  margin: const EdgeInsets.only(bottom: 6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              if (loading)
                const LinearProgressIndicator(
                  minHeight: 2.5,
                  backgroundColor: Colors.transparent,
                  valueColor: AlwaysStoppedAnimation(Color(0xFFE60000)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
