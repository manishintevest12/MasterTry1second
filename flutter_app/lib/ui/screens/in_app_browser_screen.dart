import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

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

/// In-app browser (owner request, 21 Oct): every offer redirection opens INSIDE
/// the app instead of the external browser — a dark header with a favicon +
/// seller-name pill (URL stays hidden, X closes) and a bottom Back / Forward /
/// Refresh / Share / More toolbar, so the purchase feels native to the app.
class InAppBrowserScreen extends StatefulWidget {
  const InAppBrowserScreen({super.key, required this.url, this.sellerName});

  /// Initial URL — usually the /api/out masking pointer; the webview follows
  /// the 302 to the seller automatically.
  final String url;
  final String? sellerName;

  @override
  State<InAppBrowserScreen> createState() => _InAppBrowserScreenState();
}

class _InAppBrowserScreenState extends State<InAppBrowserScreen> {
  late final WebViewController _controller;
  String _currentUrl = '';
  bool _canGoBack = false;
  bool _canGoForward = false;
  bool _loading = true;

  String get _siteName => hostDisplayName(_currentUrl.isEmpty ? widget.url : _currentUrl);

  @override
  void initState() {
    super.initState();
    _currentUrl = widget.url;
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onPageStarted: (url) => _set(url: url, loading: true),
        onPageFinished: (url) => _syncState(url: url, loading: false),
        // Block popups/blank targets inside the embedded view.
        onNavigationRequest: (req) => req.url.startsWith('http') ? NavigationDecision.navigate : NavigationDecision.prevent,
      ))
      ..loadRequest(Uri.parse(widget.url));
  }

  void _set({String? url, bool? loading}) {
    if (!mounted) return;
    setState(() {
      if (url != null) _currentUrl = url;
      if (loading != null) _loading = loading;
    });
  }

  Future<void> _syncState({String? url, bool? loading}) async {
    final back = await _controller.canGoBack();
    final fwd = await _controller.canGoForward();
    if (!mounted) return;
    setState(() {
      if (url != null) _currentUrl = url;
      if (loading != null) _loading = loading;
      _canGoBack = back;
      _canGoForward = fwd;
    });
  }

  Future<void> _refresh() => _controller.reload();

  Future<void> _share() => SharePlus.instance.share(ShareParams(uri: Uri.tryParse(_currentUrl)));

  void _more() {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.open_in_new),
            title: const Text('Open in browser'),
            onTap: () async {
              Navigator.of(ctx).pop();
              await launchUrl(Uri.parse(_currentUrl), mode: LaunchMode.externalApplication);
            },
          ),
          ListTile(
            leading: const Icon(Icons.copy),
            title: const Text('Copy link'),
            onTap: () async {
              Navigator.of(ctx).pop();
              if (!mounted) return;
              ScaffoldMessenger.of(context)
                ..hideCurrentSnackBar()
                ..showSnackBar(const SnackBar(content: Text('Link copied')));
            },
          ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.sellerName?.isNotEmpty == true ? widget.sellerName! : _siteName;
    final host = Uri.tryParse(_currentUrl.isEmpty ? widget.url : _currentUrl)?.host ?? '';
    final favicon =
        host.isEmpty ? null : 'https://www.google.com/s2/favicons?sz=64&domain=$host';

    return PopScope(
      canPop: true,
      child: Scaffold(
        backgroundColor: const Color(0xFF131725),
        appBar: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Container(
            color: const Color(0xFF131725),
            child: SafeArea(
              bottom: false,
              child: Row(children: [
                // Back chevron — returns to the app
                IconButton(
                  onPressed: () => Navigator.of(context).maybePop(),
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
        body: WebViewWidget(
          controller: _controller,
          gestureRecognizers: {
            Factory<VerticalDragGestureRecognizer>(() => VerticalDragGestureRecognizer()),
          },
        ),
        bottomNavigationBar: _BottomToolBar(
          canGoBack: _canGoBack,
          canGoForward: _canGoForward,
          onBack: () async {
            if (await _controller.canGoBack()) {
              await _controller.goBack();
            }
          },
          onForward: () => _controller.goForward(),
          onRefresh: _refresh,
          onShare: _share,
          onMore: _more,
        ),
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
    required this.onShare,
    required this.onMore,
  });

  final bool canGoBack;
  final bool canGoForward;
  final VoidCallback onBack;
  final VoidCallback onForward;
  final VoidCallback onRefresh;
  final VoidCallback onShare;
  final VoidCallback onMore;

  Widget _btn(IconData icon, String label, VoidCallback onTap, {bool enabled = true}) {
    final color = enabled ? Colors.black : Colors.black26;
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
      color: Colors.white,
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 58,
          child: Row(children: [
            _btn(Icons.arrow_back, 'Back', onBack, enabled: canGoBack),
            _btn(Icons.arrow_forward, 'Forward', onForward, enabled: canGoForward),
            _btn(Icons.refresh, 'Refresh', onRefresh),
            _btn(Icons.share, 'Share', onShare),
            _btn(Icons.more_vert, 'More', onMore),
          ]),
        ),
      ),
    );
  }
}
