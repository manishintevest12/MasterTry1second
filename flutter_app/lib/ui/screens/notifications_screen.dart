import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/app_state.dart';
import '../../core/auth.dart';
import '../../core/theme.dart';
import '../widgets/kit.dart';

/// Notifications hub (website NotificationsDrawer): price drops + admin
/// broadcasts from GET /api/notifications and mark-read.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _state = AppState.instance;
  final _auth = AuthService.instance;
  NotificationFeed? _feed;
  bool _busy = false;

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
              Box(
                padding: const EdgeInsets.all(12),
                borderColor: n.read ? border(context) : T1SColors.red200,
                color: n.read ? null : (isDark(context) ? T1SColors.slate900 : T1SColors.red50),
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
                        Text(n.body, maxLines: 3, overflow: TextOverflow.ellipsis, style: tx(context, 11, color: muted(context), h: 1.35)),
                      ],
                    ]),
                  ),
                ]),
              ),
              const SizedBox(height: 8),
            ],
        ],
      ),
    );
  }
}
