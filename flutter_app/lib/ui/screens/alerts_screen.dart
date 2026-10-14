import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/app_state.dart';
import '../../core/auth.dart';
import '../../core/compare.dart';
import '../../core/theme.dart';
import '../widgets/kit.dart';

/// Price Tracker (website PriceAlertsView): server-side alerts list with
/// target prices, plus the local watchlist. Create/delete via /api/alerts.
class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  final _state = AppState.instance;
  final _auth = AuthService.instance;
  List<PriceAlert>? _alerts;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!_auth.signedIn || _auth.token == null) return;
    setState(() => _busy = true);
    try {
      final a = await _state.api.alerts(_auth.token!);
      if (mounted) setState(() { _alerts = a; _error = null; });
    } catch (e) {
      if (mounted) setState(() => _error = '$e'.replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete(PriceAlert a) async {
    try {
      await _state.api.deleteAlert(_auth.token!, a.id);
      await _load();
      await _state.refreshBadges();
    } catch (e) {
      toast(context, '$e'.replaceFirst('Exception: ', ''), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: isDark(context) ? T1SColors.slate950 : T1SColors.slate50,
      appBar: AppBar(
        title: Text('Price Tracker', style: tx(context, 16, w: FontWeight.w900)),
        actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded))],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 30),
        children: [
          if (!_auth.signedIn) ...[
            Box(
              padding: const EdgeInsets.all(20),
              child: Column(children: [
                Icon(Icons.lock_outline_rounded, size: 30, color: T1SColors.slate300),
                const SizedBox(height: 10),
                Text('Sign in to track price drops', style: tx(context, 14, w: FontWeight.w900)),
                const SizedBox(height: 6),
                Text('Alerts are verified against the live engine, then emailed to you.',
                    textAlign: TextAlign.center, style: tx(context, 11.5, color: muted(context), h: 1.4)),
              ]),
            ),
          ] else ...[
            SectionTitle('YOUR PRICE ALERTS', trailing: _busy
                ? const SizedBox(width: 13, height: 13, child: CircularProgressIndicator(strokeWidth: 2, color: T1SColors.red))
                : null),
            if (_error != null)
              Box(padding: const EdgeInsets.all(12), child: Text(_error!, style: tx(context, 11.5, color: T1SColors.red))),
            if (_alerts != null && _alerts!.isEmpty)
              Box(
                padding: const EdgeInsets.all(20),
                child: Column(children: [
                  Icon(Icons.notifications_none_rounded, size: 28, color: T1SColors.slate300),
                  const SizedBox(height: 8),
                  Text('No alerts yet', style: tx(context, 13, w: FontWeight.w900)),
                  const SizedBox(height: 5),
                  Text('Open any result and tap "Track price" to create one.',
                      textAlign: TextAlign.center, style: tx(context, 11, color: muted(context))),
                ]),
              ),
            for (final a in _alerts ?? const <PriceAlert>[]) ...[
              Box(
                padding: const EdgeInsets.all(12),
                child: Row(children: [
                  NetImage(a.image, width: 46, height: 46, radius: 10, fallbackIcon: Icons.notifications_active_outlined),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(a.productTitle, maxLines: 2, overflow: TextOverflow.ellipsis, style: tx(context, 12, w: FontWeight.w800)),
                      const SizedBox(height: 3),
                      Row(children: [
                        Pill('under ${inrAmount(a.targetPrice)}', fg: T1SColors.emerald600, bg: T1SColors.emerald500.withValues(alpha: 0.12), icon: Icons.trending_down_rounded, size: 9),
                        if (a.priceAtSet != null) ...[
                          const SizedBox(width: 5),
                          Text('was ${inrAmount(a.priceAtSet!)}', style: tx(context, 9.5, color: muted(context))),
                        ],
                      ]),
                    ]),
                  ),
                  IconButton(
                    onPressed: () => _delete(a),
                    icon: const Icon(Icons.delete_outline_rounded, size: 19, color: T1SColors.red),
                  ),
                ]),
              ),
              const SizedBox(height: 8),
            ],
            const SizedBox(height: 14),
            SectionTitle('HOW IT WORKS', dot: T1SColors.slate400),
            Box(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _step(context, '1', 'Set a target price on any product.'),
                _step(context, '2', 'The engine re-checks live sources every 30 minutes.'),
                _step(context, '3', 'You get an email the moment a verified price crosses it.'),
              ]),
            ),
          ],
        ],
      ),
    );
  }

  Widget _step(BuildContext c, String n, String t) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 18,
            height: 18,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(6)),
            child: Text(n, style: tx(c, 9, w: FontWeight.w900, color: Colors.white)),
          ),
          const SizedBox(width: 8),
          Expanded(child: Text(t, style: tx(c, 11.5, color: muted(context)))),
        ]),
      );
}
