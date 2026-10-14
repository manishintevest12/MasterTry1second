import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/compare.dart';
import '../../core/app_state.dart';
import '../../core/theme.dart';
import '../widgets/history_chart.dart';
import '../widgets/kit.dart';
import 'compare_screen.dart' show showTrackSheet;

/// AI Insights (website AiInsightsView): (1) URL price scanner — paste any
/// product page link and get the live-verified price; (2) Deal Score — the
/// engine's buy/wait verdict computed ONLY from recorded history via
/// POST /api/product-page. No mock data: blocked pages report honestly.
class AiInsightsScreen extends StatefulWidget {
  const AiInsightsScreen({super.key});

  @override
  State<AiInsightsScreen> createState() => _AiInsightsScreenState();
}

class _AiInsightsScreenState extends State<AiInsightsScreen> with SingleTickerProviderStateMixin {
  late final _tabs = TabController(length: 2, vsync: this);
  final _state = AppState.instance;

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Container(
        color: isDark(context) ? T1SColors.slate900 : Colors.white,
        child: TabBar(
          controller: _tabs,
          labelColor: T1SColors.blue600,
          unselectedLabelColor: muted(context),
          indicatorColor: T1SColors.blue600,
          labelStyle: tx(context, 12.5, w: FontWeight.w900),
          tabs: const [
            Tab(icon: Icon(Icons.link_rounded, size: 15), text: 'URL Price Scanner'),
            Tab(icon: Icon(Icons.insights_rounded, size: 15), text: 'Deal Score'),
          ],
        ),
      ),
      Expanded(
        child: TabBarView(
          controller: _tabs,
          children: [
            _ScannerTab(state: _state),
            const _DealScoreTab(),
          ],
        ),
      ),
    ]);
  }
}

// ---------------------------------------------------------------------------
// Tab 1: URL price scanner (POST /api/scan/url)
// ---------------------------------------------------------------------------

class _ScannerTab extends StatefulWidget {
  const _ScannerTab({required this.state});
  final AppState state;

  @override
  State<_ScannerTab> createState() => _ScannerTabState();
}

class _ScannerTabState extends State<_ScannerTab> {
  final _url = TextEditingController();
  bool _busy = false;
  String? _error;
  ScanResult? _result;

  @override
  void dispose() {
    _url.dispose();
    super.dispose();
  }

  Future<void> _scan() async {
    final url = _url.text.trim();
    if (url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri == null || !uri.isScheme('http') && !uri.isScheme('https')) {
      setState(() => _error = 'Paste a link starting with https://');
      return;
    }
    setState(() { _busy = true; _error = null; _result = null; });
    try {
      final r = await widget.state.api.scanUrl(url);
      if (mounted) setState(() => _result = r);
    } catch (e) {
      if (mounted) setState(() => _error = '$e'.replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = _result;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      children: [
        SectionTitle('PASTE ANY PRODUCT LINK · LIVE PRICE CHECK'),
        Box(
          padding: const EdgeInsets.all(12),
          child: Column(children: [
            Row(children: [
              Expanded(
                child: TextField(
                  controller: _url,
                  onSubmitted: (_) => _scan(),
                  textInputAction: TextInputAction.search,
                  keyboardType: TextInputType.url,
                  decoration: const InputDecoration(hintText: 'https://www.amazon.in/dp/…', isDense: true, prefixIcon: Icon(Icons.link_rounded, size: 16)),
                  style: tx(context, 12.5),
                ),
              ),
              const SizedBox(width: 8),
              RedButton('Scan', onTap: _busy ? null : _scan, dense: true, loading: _busy),
            ]),
          ]),
        ),
        if (_busy) ...[
          const SizedBox(height: 12),
          const _InsightsSkeleton(),
        ],
        if (_error != null) ...[
          const SizedBox(height: 12),
          Box(padding: const EdgeInsets.all(12), borderColor: T1SColors.red200, color: isDark(context) ? null : T1SColors.red50, child: Text(_error!, style: tx(context, 11.5, color: T1SColors.red))),
        ],
        if (r != null) ...[
          const SizedBox(height: 12),
          Box(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Pill(r.vertical.toUpperCase(), fg: T1SColors.red, bg: T1SColors.red50, size: 8.5),
                const SizedBox(width: 6),
                Expanded(child: Text(r.provider, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 10.5, color: muted(context)))),
              ]),
              const SizedBox(height: 6),
              Text(r.title, style: tx(context, 13.5, w: FontWeight.w900), maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 8),
              Row(children: [
                Text(inrAmount(r.price), style: tx(context, 20, w: FontWeight.w900, mono: true)),
                const SizedBox(width: 8),
                Pill('Live verified', fg: T1SColors.emerald600, bg: T1SColors.emerald500.withValues(alpha: 0.12), icon: Icons.verified_rounded, size: 8.5),
              ]),
              const SizedBox(height: 10),
              if ((r.url ?? '').isNotEmpty)
                RedButton('Open product page', onTap: () => openDeal(r.url!), dense: true, icon: Icons.open_in_new_rounded),
            ]),
          ),
        ],
        const SizedBox(height: 16),
        SectionTitle('WHAT THE SCANNER DOES', dot: T1SColors.slate400),
        Box(
          padding: const EdgeInsets.all(14),
          child: Text(
            'Reads the product page server-side (JSON-LD / og:title / title), extracts the real listed price, and stores it as a recorded observation. If a site bot-gates the page, you get an honest message — never a guess.',
            style: tx(context, 11.5, color: muted(context), h: 1.45),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 2: Deal score + buy/wait verdict (POST /api/product-page)
// ---------------------------------------------------------------------------

class _DealScoreTab extends StatefulWidget {
  const _DealScoreTab();

  @override
  State<_DealScoreTab> createState() => _DealScoreTabState();
}

class _DealScoreTabState extends State<_DealScoreTab> {
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
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      children: [
        SectionTitle('DEAL SCORE · BUY OR WAIT?'),
        Box(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            Expanded(
              child: TextField(
                controller: _q,
                onSubmitted: (_) => _run(),
                textInputAction: TextInputAction.search,
                decoration: const InputDecoration(hintText: 'Paste a product link or type a name', isDense: true, prefixIcon: Icon(Icons.search_rounded, size: 16)),
                style: tx(context, 12.5),
              ),
            ),
            const SizedBox(width: 8),
            RedButton('Analyse', onTap: _busy ? null : _run, dense: true, loading: _busy),
          ]),
        ),
        if (_busy) ...[
          const SizedBox(height: 12),
          const _InsightsSkeleton(),
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

class _InsightsSkeleton extends StatelessWidget {
  const _InsightsSkeleton();
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
