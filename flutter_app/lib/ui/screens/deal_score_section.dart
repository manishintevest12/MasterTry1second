import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/compare.dart';
import '../../core/app_state.dart';
import '../../core/theme.dart';
import '../widgets/history_chart.dart';
import '../widgets/kit.dart';
import 'compare_screen.dart' show showTrackSheet;

// ---------------------------------------------------------------------------
// Tab 2: Deal score + buy/wait verdict (POST /api/product-page)
// ---------------------------------------------------------------------------

class DealScoreSection extends StatefulWidget {
  const DealScoreSection({super.key});

  @override
  State<DealScoreSection> createState() => _DealScoreSectionState();
}

class _DealScoreSectionState extends State<DealScoreSection> {
  final _state = AppState.instance;
  final _q = TextEditingController();
  ProductPage? _page;
  bool _busy = false;
  String? _error;

  Future<void> _run() async {
    final q = _q.text.trim();
    if (q.isEmpty || _busy) return;
    setState(() { _busy = true; _error = null; });
    try {
      final p = await _state.api.productPage(q, city: _state.city, pincode: _state.pincode);
      if (mounted) setState(() => _page = p);
    } catch (e) {
      if (mounted) setState(() => _error = '$e'.replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = _page;
    final verdictColor = switch (p?.verdict) {
      'great' => T1SColors.emerald600,
      'good' => T1SColors.emerald400,
      'fair' => T1SColors.amber500,
      'wait' => T1SColors.orange600,
      _ => T1SColors.slate500,
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionTitle('DEAL SCORE · BUY OR WAIT?'),
        Box(
          padding: const EdgeInsets.all(12),
          child: Column(children: [
            TextField(
              controller: _q,
              onSubmitted: (_) => _run(),
              textInputAction: TextInputAction.search,
              decoration: const InputDecoration(hintText: 'Paste a product link or type a name', isDense: true, prefixIcon: Icon(Icons.search_rounded, size: 16)),
              style: tx(context, 12.5),
            ),
            const SizedBox(height: 10),
            // Full-width, comfortably tall, never clipped (owner 22 Oct: the old
            // dense side-button rendered cramped/misaligned next to the field).
            SizedBox(
              width: double.infinity,
              child: RedButton('Analyse', onTap: _busy ? null : _run, loading: _busy),
            ),
          ]),
        ),
        if (_busy) ...[
          const SizedBox(height: 12),
          const InsightsSkeleton(),
        ],
        if (_error != null) ...[
          const SizedBox(height: 12),
          Box(padding: const EdgeInsets.all(12), child: Text(_error!, style: tx(context, 11.5, color: T1SColors.red))),
        ],
        if (p != null && !p.found) ...[
          const SizedBox(height: 12),
          Box(
            padding: const EdgeInsets.all(16),
            child: Text(p.message ?? 'Could not read that page.', style: tx(context, 12, color: muted(context), h: 1.4)),
          ),
        ],
        if (p != null && p.found) ...[
          const SizedBox(height: 12),
          Box(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(p.title, style: tx(context, 14, w: FontWeight.w900), maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 12),
              Row(children: [
                // score ring
                SizedBox(
                  width: 84,
                  height: 84,
                  child: Stack(alignment: Alignment.center, children: [
                    SizedBox(
                      width: 84,
                      height: 84,
                      child: CircularProgressIndicator(
                        value: p.score > 0 ? p.score / 100 : 0,
                        strokeWidth: 7,
                        color: verdictColor,
                        backgroundColor: T1SColors.slate200,
                      ),
                    ),
                    Column(mainAxisSize: MainAxisSize.min, children: [
                      Text('${p.score}', style: tx(context, 20, w: FontWeight.w900, mono: true)),
                      Text('/100', style: tx(context, 9, color: muted(context))),
                    ]),
                  ]),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(p.verdict.toUpperCase(), style: tx(context, 13, w: FontWeight.w900, color: verdictColor, ls: 0.6)),
                    const SizedBox(height: 4),
                    Text(p.headline, style: tx(context, 11.5, color: muted(context), h: 1.35)),
                  ]),
                ),
              ]),
              if (p.offers.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text('Cheapest now: ${p.offers.first.seller} · ${inrAmount(p.offers.first.price)}',
                    style: tx(context, 12, w: FontWeight.w800, mono: true)),
              ],
              const SizedBox(height: 12),
              if (p.history.length >= 2)
                HistoryChart(points: p.history, height: 100)
              else
                Text('Not enough recorded history for a verdict yet — the engine needs at least 2 real observations.', style: tx(context, 10.5, color: muted(context))),
              const SizedBox(height: 10),
              if (p.offers.isNotEmpty)
                Row(children: [
                  Expanded(
                    child: RedButton('Set price alert', onTap: () {
                      showTrackSheet(
                        context,
                        title: p.title,
                        query: _q.text.trim(),
                        vertical: 'ecommerce',
                        price: p.offers.first.price,
                        sourceUrl: p.offers.first.goUrl,
                      );
                    }, dense: true, icon: Icons.notifications_active_outlined),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: T1SOutlineButton('Buy cheapest', onTap: p.offers.first.goUrl.isEmpty ? null : () => openDeal(p.offers.first.goUrl), icon: Icons.open_in_new_rounded),
                  ),
                ]),
            ]),
          ),
        ],
        const SizedBox(height: 16),
        SectionTitle('HOW THE VERDICT IS COMPUTED', dot: T1SColors.slate400),
        Box(
          padding: const EdgeInsets.all(14),
          child: Text(
            'The engine scores each product 0-100 from its RECORDED price history only: position of today\'s price versus the observed range, trend over the last 14 days, and drop velocity. Great/good/fair/wait — never a guess, and "not enough history" when fewer than 2 real points exist.',
            style: tx(context, 11.5, color: muted(context), h: 1.45),
          ),
        ),
      ],
    );
  }
}

class InsightsSkeleton extends StatelessWidget {
  const InsightsSkeleton({super.key});
  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Container(
        height: 84,
        decoration: BoxDecoration(color: isDark(context) ? T1SColors.slate800 : T1SColors.slate200, borderRadius: BorderRadius.circular(12)),
      ),
      const SizedBox(height: 10),
      ...List.generate(3, (i) => Container(
            height: 14,
            margin: const EdgeInsets.only(bottom: 6),
            decoration: BoxDecoration(color: isDark(context) ? T1SColors.slate800 : T1SColors.slate100, borderRadius: BorderRadius.circular(7)),
          )),
    ]);
  }
}
