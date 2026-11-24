import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/app_state.dart';
import '../../core/auth.dart';
import '../../core/deep_links.dart';
import '../../core/theme.dart';
import '../widgets/kit.dart';

/// Notifications hub (website NotificationsDrawer): price drops + admin
/// broadcasts from GET /api/notifications and mark-read.
///
/// OWNER 24 Nov ("mai chata hoon notification pr click kr ke v redirection ho uss notification se related. abhi sirf
/// notification dikhta hai pr ye samj ni aata usko kaise kaha se le"): a notification that cannot be opened is only
/// half a notification. Every row now carries the destination the server already sent and opens it:
///   • a price drop  -> the Product page for that exact product (searchQuery)
///   • an app screen -> that tab, through DeepLinks (/flights, /grocery, /product/<slug>)
///   • a merchant    -> the in-app browser, through openDeal (/api/out?t=... the affiliate hop)
///   • a real link   -> the phone's browser (the Play listing)
/// A row with NO destination is not a dead tap: it opens its full text in place instead of pretending to be a link.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

/// Where a row goes. Built from the row's own fields — never guessed.
class _Dest {
  final _DestKind kind;
  final String value;
  const _Dest(this.kind, this.value);
}

enum _DestKind { product, appScreen, deal, external }

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _state = AppState.instance;
  final _auth = AuthService.instance;
  NotificationFeed? _feed;
  bool _busy = false;

  /// Rows opened to full text (only ever the ones with nowhere to go).
  final Set<String> _expanded = <String>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _busy = true);
    try {
      final f = await _state.api.notifications(token: _auth.token);
      if (mounted) setState(() => _feed = f);
      _state.unread = f.unread;
      _state.refreshUi();
    } catch (_) {/* honest: keep last feed */} finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _markRead() async {
    if (_auth.token == null) return;
    try {
      await _state.api.markNotificationsRead(_auth.token!);
      await _load();
    } catch (_) {}
  }

  /// Mark just the row that was tapped, so the badge follows what the person actually read.
  Future<void> _markOne(AppNotification n) async {
    final token = _auth.token;
    if (token == null || n.read) return;
    try {
      await _state.api.markNotificationsRead(token, ids: [n.id]);
    } catch (_) {
      return; // unread state is cosmetic: never block the redirect on it
    }
    await _load();
  }

  /// The destination the server already sent for this row, or null when it has none.
  _Dest? _destination(AppNotification n) {
    final query = n.searchQuery?.trim() ?? '';
    if (query.isNotEmpty) return _Dest(_DestKind.product, query);

    final raw = n.ctaUrl?.trim() ?? '';
    if (raw.isEmpty) return null;

    // The affiliate hop and the server's own pages must stay server pages: a real
    // navigation lets /api/out record the click and hand the browser the partner.
    if (raw.startsWith('/api/')) return _Dest(_DestKind.deal, raw);

    if (raw.startsWith('/')) {
      return _Dest(_DestKind.appScreen, 'https://www.try1second.com$raw');
    }

    final uri = Uri.tryParse(raw);
    if (uri == null || !uri.hasScheme) return null;
    if (uri.scheme != 'http' && uri.scheme != 'https') return null;

    // Our own links are app screens, not browser pages.
    if (DeepLinks.hosts.contains(uri.host)) return _Dest(_DestKind.appScreen, raw);

    // The Play listing belongs to the phone's store app, not to a web view.
    if (uri.host.contains('play.google.com')) return _Dest(_DestKind.external, raw);

    return _Dest(_DestKind.deal, raw);
  }

  /// What the row promises to do, shown on the row itself so the tap is never a surprise.
  String _ctaLabel(AppNotification n, _Dest? dest) {
    if (dest == null) return _expanded.contains(n.id) ? 'Show less' : 'Read more';
    return switch (dest.kind) {
      _DestKind.product => 'Open product',
      _DestKind.appScreen => 'Open in app',
      _DestKind.deal => 'Open deal',
      _DestKind.external => dest.value.contains('play.google.com') ? 'Install app' : 'Open link',
    };
  }

  void _closeScreen() {
    final nav = _state.navigator.currentState;
    if (nav != null && nav.canPop()) nav.pop();
  }

  Future<void> _open(AppNotification n) async {
    final dest = _destination(n);
    if (dest == null) {
      setState(() {
        if (!_expanded.remove(n.id)) _expanded.add(n.id);
      });
      return;
    }

    await _markOne(n);

    if (dest.kind == _DestKind.product) {
      _closeScreen();
      _state.openProduct(PendingSearch('ecommerce', dest.value, productPage: true));
      return;
    }
    if (dest.kind == _DestKind.appScreen) {
      // DeepLinks pops back to the shell itself, so the tab it switches to is the one on screen.
      await DeepLinks.handle(Uri.parse(dest.value));
      return;
    }
    if (dest.kind == _DestKind.deal) {
      _closeScreen();
      await openDeal(dest.value, sellerName: n.seller, price: n.priceNow);
      return;
    }
    _closeScreen();
    final uri = Uri.tryParse(dest.value);
    if (uri != null) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  String _timeAgo(String? iso) {
    final t = iso == null ? null : DateTime.tryParse(iso);
    if (t == null) return '';
    final d = DateTime.now().difference(t);
    if (d.inMinutes < 60) return '${d.inMinutes}m ago';
    if (d.inHours < 24) return '${d.inHours}h ago';
    return '${d.inDays}d ago';
  }

  @override
  Widget build(BuildContext context) {
    final items = _feed?.items ?? const <AppNotification>[];
    return Scaffold(
      backgroundColor: isDark(context) ? T1SColors.slate950 : T1SColors.slate50,
      appBar: AppBar(
        title: Text('Notifications', style: tx(context, 16, w: FontWeight.w900)),
        actions: [
          if (_busy) const Padding(padding: EdgeInsets.all(14), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: T1SColors.red))),
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded)),
          IconButton(onPressed: _markRead, icon: const Icon(Icons.done_all_rounded)),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 30),
        children: [
          if (items.isEmpty)
            Box(
              padding: const EdgeInsets.all(22),
              child: Column(children: [
                Icon(Icons.notifications_none_rounded, size: 30, color: T1SColors.slate300),
                const SizedBox(height: 10),
                Text('All quiet', style: tx(context, 13.5, w: FontWeight.w900)),
                const SizedBox(height: 5),
                Text('Price-drop alerts and announcements land here.', textAlign: TextAlign.center, style: tx(context, 11.5, color: muted(context))),
              ]),
            )
          else
            for (final n in items) ...[
              Builder(builder: (context) {
                final dest = _destination(n);
                final open = _expanded.contains(n.id);
                return Box(
                  padding: const EdgeInsets.all(12),
                  borderColor: n.read ? border(context) : T1SColors.red200,
                  color: n.read ? null : (isDark(context) ? T1SColors.slate900 : T1SColors.red50),
                  onTap: () => _open(n),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if (!n.read) Container(width: 8, height: 8, margin: const EdgeInsets.only(top: 5, right: 8), decoration: const BoxDecoration(color: T1SColors.red, shape: BoxShape.circle)),
                    Icon(
                      n.kind.contains('price') ? Icons.trending_down_rounded : Icons.campaign_rounded,
                      size: 18,
                      color: n.kind.contains('price') ? T1SColors.emerald600 : T1SColors.slate500,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Text(
                            n.kind.contains('price') ? 'PRICE DROP' : 'ANNOUNCEMENT',
                            style: tx(context, 9, w: FontWeight.w900, color: n.kind.contains('price') ? T1SColors.emerald600 : muted(context), ls: 0.7),
                          ),
                          const Spacer(),
                          if (_timeAgo(n.createdAt).isNotEmpty) Text(_timeAgo(n.createdAt), style: tx(context, 9, color: muted(context))),
                        ]),
                        const SizedBox(height: 3),
                        Text(n.title, style: tx(context, 12.5, w: FontWeight.w800)),
                        if (n.body.isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Text(
                            n.body,
                            maxLines: open ? null : 3,
                            overflow: open ? TextOverflow.clip : TextOverflow.ellipsis,
                            style: tx(context, 11, color: muted(context), h: 1.35),
                          ),
                        ],
                        if (n.priceNow != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            '₹${n.priceNow!.toStringAsFixed(0)}${n.seller == null ? '' : ' · ${n.seller}'}',
                            style: tx(context, 11, w: FontWeight.w800, color: T1SColors.emerald600),
                          ),
                        ],
                        const SizedBox(height: 6),
                        // The tap is spelled out on the row, so nobody has to guess where it leads.
                        Row(mainAxisSize: MainAxisSize.min, children: [
                          Text(_ctaLabel(n, dest), style: tx(context, 10.5, w: FontWeight.w900, color: T1SColors.red)),
                          const SizedBox(width: 3),
                          Icon(
                            dest == null
                                ? (open ? Icons.expand_less_rounded : Icons.expand_more_rounded)
                                : Icons.arrow_forward_rounded,
                            size: 13,
                            color: T1SColors.red,
                          ),
                        ]),
                      ]),
                    ),
                  ]),
                );
              }),
              const SizedBox(height: 8),
            ],
        ],
      ),
    );
  }
}
