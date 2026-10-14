import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';
import '../widgets/kit.dart';

/// Live Scanner Radar (website RadarView): the engine's live source health +
/// recent provenance events, refreshed from /api/status and /api/provenance.
/// No synthetic activity: everything shown is what the engine really did.
class RadarScreen extends StatefulWidget {
  const RadarScreen({super.key});

  @override
  State<RadarScreen> createState() => _RadarScreenState();
}

class _RadarScreenState extends State<RadarScreen> {
  final _state = AppState.instance;
  List<Map<String, dynamic>> _sources = [];
  List<Map<String, dynamic>> _logs = [];
  bool _busy = true;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 20), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final status = await _state.api.getJson('/api/status');
      final prov = await _state.api.getJson('/api/provenance');
      if (mounted) {
        setState(() {
          _sources = ((status['sources'] as List?) ?? const []).whereType<Map<String, dynamic>>().where((s) => s['enabled'] == true).toList();
          _logs = ((prov['logs'] as List?) ?? const []).whereType<Map<String, dynamic>>().take(40).toList();
          _busy = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final live = _sources.where((s) => '${s['health']}' == 'HEALTHY' || '${s['health']}' == 'OK').length;
    final degraded = _sources.where((s) => '${s['health']}' == 'DEGRADED').length;
    return Scaffold(
      backgroundColor: T1SColors.heroBg,
      appBar: AppBar(
        backgroundColor: T1SColors.heroBg,
        foregroundColor: Colors.white,
        title: Text('Live Scanner Radar', style: tx(context, 16, w: FontWeight.w900, color: Colors.white)),
        actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded, color: Colors.white))],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 30),
        children: [
          Row(children: [
            const _RadarPulse(),
            const SizedBox(width: 10),
            Expanded(
              child: Text('REAL-TIME ENGINE ACTIVITY', style: tx(context, 11.5, w: FontWeight.w900, color: T1SColors.amber400, ls: 1)),
            ),
            if (_busy) const SizedBox(width: 13, height: 13, child: CircularProgressIndicator(strokeWidth: 2, color: T1SColors.red)),
          ]),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(child: _RadarStat('LIVE SOURCES', '$live', T1SColors.emerald400)),
            const SizedBox(width: 10),
            Expanded(child: _RadarStat('DEGRADED', '$degraded', T1SColors.amber400)),
            const SizedBox(width: 10),
            Expanded(child: _RadarStat('ENABLED', '${_sources.length}', T1SColors.sky400)),
          ]),
          const SizedBox(height: 16),
          Text('SOURCE HEALTH', style: tx(context, 10.5, w: FontWeight.w900, color: T1SColors.slate400, ls: 1)),
          const SizedBox(height: 10),
          for (final s in _sources) ...[
            _SourceRow(s: s),
            const SizedBox(height: 6),
          ],
          const SizedBox(height: 16),
          Text('RECENT VERIFIED FETCHES', style: tx(context, 10.5, w: FontWeight.w900, color: T1SColors.slate400, ls: 1)),
          const SizedBox(height: 10),
          if (_logs.isEmpty)
            Text('No fetches recorded yet.', style: tx(context, 11.5, color: T1SColors.slate500))
          else
            for (final l in _logs.take(25)) ...[
              _LogRow(l: l),
              const SizedBox(height: 6),
            ],
          const SizedBox(height: 10),
          Text('Every card in the app traces back to fetches like these. Nothing is invented.',
              style: tx(context, 10, color: T1SColors.slate500, h: 1.4)),
        ],
      ),
    );
  }
}

class _RadarPulse extends StatefulWidget {
  const _RadarPulse();
  @override
  State<_RadarPulse> createState() => _RadarPulseState();
}

class _RadarPulseState extends State<_RadarPulse> with SingleTickerProviderStateMixin {
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500))..repeat();
  @override
  void dispose() { _c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 26,
      height: 26,
      child: AnimatedBuilder(
        animation: _c,
        builder: (_, __) => Container(
          width: 10 + 16 * _c.value,
          height: 10 + 16 * _c.value,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: T1SColors.red500.withValues(alpha: 0.85 - 0.7 * _c.value),
          ),
        ),
      ),
    );
  }
}

class _RadarStat extends StatelessWidget {
  const _RadarStat(this.label, this.value, this.color);
  final String label;
  final String value;
  final Color color;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.white.withValues(alpha: 0.1))),
      child: Column(children: [
        Text(value, style: tx(context, 17, w: FontWeight.w900, color: color, mono: true)),
        const SizedBox(height: 2),
        Text(label, style: tx(context, 8.5, w: FontWeight.w800, color: T1SColors.slate400, ls: 0.7)),
      ]),
    );
  }
}

class _SourceRow extends StatelessWidget {
  const _SourceRow({required this.s});
  final Map<String, dynamic> s;
  @override
  Widget build(BuildContext context) {
    final health = '${s['health']}';
    final color = health == 'HEALTHY' || health == 'OK' ? T1SColors.emerald400 : (health == 'DEGRADED' ? T1SColors.amber400 : T1SColors.slate500);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.04), borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.white.withValues(alpha: 0.08))),
      child: Row(children: [
        Container(width: 7, height: 7, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 9),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${s['name']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 11.5, w: FontWeight.w800, color: Colors.white)),
            Text('${s['method']} · ${s['lastSuccessAt'] ?? 'no success yet'}', maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 9, color: T1SColors.slate500)),
          ]),
        ),
      ]),
    );
  }
}

class _LogRow extends StatelessWidget {
  const _LogRow({required this.l});
  final Map<String, dynamic> l;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.04), borderRadius: BorderRadius.circular(10)),
      child: Row(children: [
        const Icon(Icons.verified_rounded, size: 13, color: T1SColors.emerald400),
        const SizedBox(width: 8),
        Expanded(
          child: Text('${l['source_id']} · ${l['source_method'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 10.5, w: FontWeight.w700, color: Colors.white70)),
        ),
        Text('${l['fetched_at'] ?? ''}'.substring(0, ('${l['fetched_at'] ?? ''}'.length > 19 ? 19 : '${l['fetched_at'] ?? ''}'.length)), style: tx(context, 9, color: T1SColors.slate500, mono: true)),
      ]),
    );
  }
}
