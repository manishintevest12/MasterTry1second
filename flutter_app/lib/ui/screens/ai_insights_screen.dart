import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api.dart';
import '../../core/app_state.dart';
import '../../core/compare.dart';
import '../../core/insights.dart';
import '../../core/theme.dart';
import '../../core/verticals.dart';
import '../widgets/kit.dart';
import 'deal_score_section.dart';

/// AI Insights, 1:1 with the website's AiInsightsView:
///  1. Universal Scanner hero (paste a link -> live-verified price)
///  2. Live Coupon Codes (only codes a partner network really returned)
///  3. 10-vertical predictive insights built from LIVE offers only
/// Nothing is simulated: blocked / empty sources are reported honestly.
class AiInsightsScreen extends StatefulWidget {
  const AiInsightsScreen({super.key});

  @override
  State<AiInsightsScreen> createState() => _AiInsightsScreenState();
}

class _AiInsightsScreenState extends State<AiInsightsScreen> {
  final _state = AppState.instance;

  // hero
  final _url = TextEditingController();
  bool _scanning = false;
  String? _scanError;
  ScanResult? _scan;

  // coupons
  List<Map<String, dynamic>> _coupons = const [];
  bool _couponsLoading = true;

  // insights
  final Map<String, InsightStats> _stats = {};
  final Set<String> _probeDone = {};
  String _filter = 'ALL';

  @override
  void initState() {
    super.initState();
    _loadCoupons();
    _loadInsights();
  }

  @override
  void dispose() {
    _url.dispose();
    super.dispose();
  }

  Future<void> _loadCoupons() async {
    try {
      final c = await _state.api.liveCoupons();
      if (mounted) setState(() => _coupons = c);
    } catch (_) {
      if (mounted) setState(() => _coupons = const []);
    } finally {
      if (mounted) setState(() => _couponsLoading = false);
    }
  }

  /// Probes are live searches, and a cold pipeline answers first with a
  /// PARTIAL snapshot (pendingRefresh) that settles over the next seconds.
  /// The old single-shot call read the partial and gave up: most verticals
  /// never reached 2 priced offers, so "All Verticals" showed ~2 cards.
  /// Now every probe polls until the pipeline settles (compare-screen pattern)
  /// and probes run 3-wide so we don't stampede the orchestrator on a phone.
  Future<void> _probe(InsightProbe p) async {
    for (var attempt = 0; attempt < 6; attempt++) {
      try {
        final r = await _state.live(p.vertical, p.query);
        final s = computeInsight(r.items);
        if (s != null) {
          if (mounted) setState(() => _stats[p.vertical] = s);
          break; // a real spread: the card is honest as-is
        }
        if (!r.pendingRefresh) break; // pipeline settled without a spread: no card, honestly
        if (attempt < 5) await Future<void>.delayed(const Duration(milliseconds: 2500));
      } catch (_) {
        // One honest retry for transient network hiccups, then give up quietly.
        if (attempt >= 1) break;
        await Future<void>.delayed(const Duration(milliseconds: 1500));
      }
    }
    if (mounted) setState(() => _probeDone.add(p.vertical));
  }

  void _loadInsights() {
    final queue = List.of(kInsightProbes);
    Future<void> worker() async {
      while (queue.isNotEmpty) {
        await _probe(queue.removeAt(0));
      }
    }

    Future.wait([worker(), worker(), worker()]);
  }

  Future<void> _runScan() async {
    final url = _url.text.trim();
    if (url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri == null || !(uri.isScheme('http') || uri.isScheme('https'))) {
      setState(() => _scanError = 'Paste a link starting with https://');
      return;
    }
    setState(() { _scanning = true; _scanError = null; _scan = null; });
    try {
      final r = await _state.api.scanUrl(url);
      if (mounted) setState(() => _scan = r);
    } catch (e) {
      if (mounted) setState(() => _scanError = '$e'.replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _scanning = false);
    }
  }

  void _preset(String vertical, String query) {
    _state.openVertical(vertical, search: PendingSearch(vertical, query));
  }

  Future<void> _openExtension() async {
    try {
      final links = await _state.api.appLinks();
      final u = links.chromeExtension?.url;
      if (u == null) {
        if (mounted) toast(context, 'The Chrome extension link has not been published yet.');
        return;
      }
      await openDeal(u);
    } catch (_) {
      if (mounted) toast(context, 'Could not load the extension link right now.', error: true);
    }
  }

  Future<void> _useCoupon(Map<String, dynamic> o) async {
    final url = '${o['affiliate_url'] ?? ''}';
    if (url.isEmpty) return;
    try {
      final redirect = await _state.api.go(url, '${o['id'] ?? ''}');
      await openDeal(redirect);
    } catch (_) {
      if (mounted) toast(context, 'Redirect service unavailable right now.', error: true);
    }
  }

  bool _inFilter(InsightProbe p) => _filter == 'ALL' || p.group == _filter;

  @override
  Widget build(BuildContext context) {
    final cards = [for (final p in kInsightProbes) if (_stats.containsKey(p.vertical) && _inFilter(p)) p];
    final loading = _probeDone.length < kInsightProbes.length;
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 32),
      children: [
        _hero(context),
        const SizedBox(height: 14),
        _couponsCard(context),
        const SizedBox(height: 20),
        Text('10-Vertical Predictive Insights & Yield Telemetry', style: tx(context, 17, w: FontWeight.w900, h: 1.2)),
        const SizedBox(height: 4),
        Text('Real-time algorithm monitoring airline yield curves, hotel rate parity, dark-store surges, and bank card stacks.', style: tx(context, 11.5, color: muted(context), h: 1.4)),
        const SizedBox(height: 12),
        _filterChips(context),
        const SizedBox(height: 12),
        for (final p in cards) ...[
          _InsightCard(probe: p, stats: _stats[p.vertical]!, onLaunch: () => _state.openVertical(p.vertical)),
          const SizedBox(height: 14),
        ],
        if (loading) ...[
          for (var i = 0; i < (cards.isEmpty ? 2 : 1); i++) ...[const _CardSkeleton(), const SizedBox(height: 14)],
        ],
        if (!loading && cards.isEmpty)
          Box(
            padding: const EdgeInsets.all(14),
            child: Text('No live insight is available for this group right now. Insights appear only when at least two real priced offers are returned.', style: tx(context, 11.5, color: muted(context), h: 1.45)),
          ),
        const SizedBox(height: 10),
        const DealScoreSection(),
      ],
    );
  }

  // -- 1. hero ---------------------------------------------------------------

  Widget _hero(BuildContext context) {
    final r = _scan;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [T1SColors.slate950, Color(0xFF0B1B3F)]),
        border: Border.all(color: T1SColors.slate800),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(color: const Color(0x332563EB), borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0x4D60A5FA))),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.psychology_rounded, size: 14, color: Color(0xFF22D3EE)),
            const SizedBox(width: 6),
            Flexible(child: Text('TRY1SECOND UNIVERSAL AI SCANNER & DEAL TRUTH ENGINE', style: tx(context, 8.5, w: FontWeight.w900, color: const Color(0xFF93C5FD)), maxLines: 2)),
            const SizedBox(width: 6),
            Container(width: 6, height: 6, decoration: const BoxDecoration(color: T1SColors.emerald400, shape: BoxShape.circle)),
          ]),
        ),
        const SizedBox(height: 14),
        Text('Universal Scanner, Price History &', style: tx(context, 25, w: FontWeight.w900, color: Colors.white, h: 1.15)),
        ShaderMask(
          shaderCallback: (b) => const LinearGradient(colors: [Color(0xFF22D3EE), Color(0xFF60A5FA), Color(0xFFA5B4FC)]).createShader(b),
          child: Text('Auto-Coupon Engine', style: tx(context, 25, w: FontWeight.w900, color: Colors.white, h: 1.15)),
        ),
        const SizedBox(height: 10),
        Text(
          'Combines 365-day historical price telemetry with instant cross-platform parity across all 12 verticals. Flag artificial MRP spikes, auto-apply winning coupon codes at checkout, and catch rain surcharges in sub-second speed.',
          style: tx(context, 11.5, color: const Color(0xFFCBD5E1), h: 1.5),
        ),
        const SizedBox(height: 14),
        Wrap(spacing: 8, runSpacing: 8, children: [
          _modeChip(context, 'Paste Product / Flight Link', Icons.link_rounded, true, () {}),
          GestureDetector(
            onTap: _openExtension,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), gradient: const LinearGradient(colors: [Color(0xFFDC2626), Color(0xFFD97706)])),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.bolt_rounded, size: 14, color: Colors.white),
                const SizedBox(width: 5),
                Text('Launch Chrome Extension', style: tx(context, 11, w: FontWeight.w900, color: Colors.white)),
              ]),
            ),
          ),
        ]),
        const SizedBox(height: 12),
        Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(color: const Color(0x1AFFFFFF), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0x33FFFFFF))),
            child: Column(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                decoration: BoxDecoration(color: const Color(0xCC0F172A), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0x99334155))),
                child: Row(children: [
                  const Icon(Icons.link_rounded, size: 16, color: Color(0xFF22D3EE)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _url,
                      onSubmitted: (_) => _runScan(),
                      keyboardType: TextInputType.url,
                      textInputAction: TextInputAction.search,
                      style: tx(context, 12, color: Colors.white),
                      decoration: InputDecoration(
                        hintText: 'Paste link: Amazon, Flipkart, Swiggy, Zomato, IndiGo, Blinkit, Booking.com...',
                        hintStyle: tx(context, 11.5, color: T1SColors.slate400),
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        filled: false,
                      ),
                    ),
                  ),
                ]),
              ),
              const SizedBox(height: 6),
              GestureDetector(
                onTap: _scanning ? null : _runScan,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), gradient: const LinearGradient(colors: [Color(0xFFE11D48), Color(0xFFBE123C)])),
                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    if (_scanning)
                      const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    else
                      const Icon(Icons.auto_awesome_rounded, size: 15, color: T1SColors.amber300),
                    const SizedBox(width: 8),
                    Text(_scanning ? 'Auditing 365d Trend...' : 'Audit Deal Truth', style: tx(context, 12.5, w: FontWeight.w900, color: Colors.white)),
                  ]),
                ),
              ),
            ]),
          ),
        if (_scanError != null) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: const Color(0x33DC2626), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0x66F87171))),
            child: Text(_scanError!, style: tx(context, 11.5, color: const Color(0xFFFECACA), h: 1.4)),
          ),
        ],
        if (r != null) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: const Color(0x1AFFFFFF), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0x33FFFFFF))),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Pill(r.vertical.toUpperCase(), fg: T1SColors.red, bg: T1SColors.red50, size: 8.5),
                const SizedBox(width: 6),
                Expanded(child: Text(r.provider, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 10.5, color: T1SColors.slate400))),
              ]),
              const SizedBox(height: 6),
              Text(r.title, style: tx(context, 13.5, w: FontWeight.w900, color: Colors.white), maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 8),
              Row(children: [
                Text(inrAmount(r.price), style: tx(context, 20, w: FontWeight.w900, mono: true, color: Colors.white)),
                const SizedBox(width: 8),
                Pill('Live verified', fg: T1SColors.emerald400, bg: T1SColors.emerald500.withValues(alpha: 0.15), icon: Icons.verified_rounded, size: 8.5),
              ]),
              const SizedBox(height: 10),
              if ((r.url ?? '').isNotEmpty) RedButton('Open product page', onTap: () => openDeal(r.url!), dense: true, icon: Icons.open_in_new_rounded),
            ]),
          ),
        ],
        const SizedBox(height: 14),
        Row(children: [
          const Icon(Icons.auto_awesome_rounded, size: 13, color: Color(0xFF22D3EE)),
          const SizedBox(width: 5),
          Text('Presets:', style: tx(context, 11, w: FontWeight.w800, color: T1SColors.slate400)),
        ]),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [
            _presetChip(context, '🎧 Sony XM5 Headphones', () => _preset('ecommerce', 'sony wh-1000xm5 headphones')),
            _presetChip(context, '✈️ DEL → DXB Flights', () => _preset('flights', 'delhi to dubai')),
            _presetChip(context, '⚡ 10-Min Grocery', () => _preset('grocery', 'milk bread')),
            _presetChip(context, '🍛 Live Biryani Deals', () => _preset('food', 'biryani')),
            _presetChip(context, '🏨 Goa Hotels', () => _preset('hotels', 'goa')),
            _presetChip(context, '📱 Mobile Phones', () => _preset('ecommerce', 'mobile phone')),
          ]),
        ),
      ]),
    );
  }

  Widget _modeChip(BuildContext context, String label, IconData icon, bool on, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(color: on ? T1SColors.blue600 : const Color(0x1AFFFFFF), borderRadius: BorderRadius.circular(12)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 14, color: Colors.white),
          const SizedBox(width: 5),
          Text(label, style: tx(context, 11, w: FontWeight.w900, color: on ? Colors.white : const Color(0xFFCBD5E1))),
        ]),
      ),
    );
  }

  Widget _presetChip(BuildContext context, String label, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          decoration: BoxDecoration(color: const Color(0x1AFFFFFF), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0x1AFFFFFF))),
          child: Text(label, style: tx(context, 11, w: FontWeight.w700, color: Colors.white)),
        ),
      ),
    );
  }

  // -- 2. coupons ------------------------------------------------------------

  Widget _couponsCard(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: T1SColors.slate950, borderRadius: BorderRadius.circular(24), border: Border.all(color: T1SColors.slate800)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Live Coupon Codes', style: tx(context, 19, w: FontWeight.w900, color: Colors.white)),
        const SizedBox(height: 4),
        Text('Real codes returned by our partner networks right now. Copy a code, then open the merchant to use it at checkout. Nothing here is simulated.', style: tx(context, 11.5, color: const Color(0xFFCBD5E1), h: 1.45)),
        const SizedBox(height: 12),
        if (_couponsLoading) Text('Loading live coupons…', style: tx(context, 11.5, color: T1SColors.slate400)),
        if (!_couponsLoading && _coupons.isEmpty)
          Text('No coupon codes are available from our partner networks at the moment.', style: tx(context, 11.5, color: T1SColors.slate400)),
        for (final o in _coupons)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: const Color(0x0DFFFFFF), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0x1AFFFFFF))),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${o['merchant_name'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 12, w: FontWeight.w900, color: Colors.white)),
                  Text('${o['title'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis, style: tx(context, 10.5, color: T1SColors.slate400, h: 1.3)),
                  const SizedBox(height: 3),
                  Text('${o['coupon_code']}', style: tx(context, 14, w: FontWeight.w900, mono: true, color: const Color(0xFF67E8F9))),
                ]),
              ),
              const SizedBox(width: 10),
              Column(children: [
                _smallBtn(context, 'Copy', const Color(0x1AFFFFFF), Colors.white, () async {
                  await Clipboard.setData(ClipboardData(text: '${o['coupon_code']}'));
                  if (context.mounted) toast(context, '${o['coupon_code']} copied. Paste it at checkout.');
                }),
                if ('${o['affiliate_url'] ?? ''}'.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  _smallBtn(context, 'Use at store', const Color(0xFF06B6D4), T1SColors.slate950, () => _useCoupon(o)),
                ],
              ]),
            ]),
          ),
      ]),
    );
  }

  Widget _smallBtn(BuildContext context, String label, Color bg, Color fg, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 88,
        padding: const EdgeInsets.symmetric(vertical: 7),
        alignment: Alignment.center,
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
        child: Text(label, style: tx(context, 11, w: FontWeight.w900, color: fg)),
      ),
    );
  }

  // -- 3. filters ------------------------------------------------------------

  Widget _filterChips(BuildContext context) {
    final items = <(String, String)>[
      ('ALL', 'All Verticals (${_stats.length})'),
      ('TRAVEL', 'Travel & Stays'),
      ('SHOPPING', 'Electronics & Grocery'),
      ('DINING', 'Food & Movies'),
      ('FINANCE', 'Loans & Mobility'),
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(children: [
        for (final (id, label) in items)
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => setState(() => _filter = id),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
                decoration: BoxDecoration(
                  color: _filter == id ? T1SColors.blue600 : (isDark(context) ? T1SColors.slate800 : Colors.white),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: _filter == id ? T1SColors.blue600 : (isDark(context) ? T1SColors.slate700 : T1SColors.slate200)),
                ),
                child: Text(label, style: tx(context, 11.5, w: FontWeight.w800, color: _filter == id ? Colors.white : muted(context))),
              ),
            ),
          ),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// One live insight card (website card, built only from real offers)
// ---------------------------------------------------------------------------

class _InsightCard extends StatelessWidget {
  const _InsightCard({required this.probe, required this.stats, required this.onLaunch});
  final InsightProbe probe;
  final InsightStats stats;
  final VoidCallback onLaunch;

  @override
  Widget build(BuildContext context) {
    final meta = kVerticals.firstWhere((v) => v.id == probe.vertical, orElse: () => kVerticals.first);
    final buy = stats.recommendation == 'BUY_NOW';
    final dark = isDark(context);
    return Box(
      padding: EdgeInsets.zero,
      radius: 20,
      clip: true,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(
          height: 130,
          child: Stack(fit: StackFit.expand, children: [
            Container(color: T1SColors.slate900, child: Icon(meta.icon, size: 46, color: const Color(0x33FFFFFF))),
            if ((stats.cheapest.imageUrl ?? '').isNotEmpty) NetImage(stats.cheapest.imageUrl, fit: BoxFit.cover),
            Container(decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x66000000), Color(0x00000000), Color(0xB3000000)]))),
            Positioned(left: 10, top: 10, child: _badge(context, 'LIVE DATA', const Color(0xCC0F172A), Colors.white)),
            Positioned(right: 10, top: 10, child: _badge(context, buy ? 'BUY NOW' : 'VOLATILE', buy ? T1SColors.emerald600 : T1SColors.amber500, Colors.white)),
            Positioned(left: 10, bottom: 10, child: _badge(context, 'Live low ${inrAmount(stats.lowest)}', const Color(0xB3000000), Colors.white)),
            Positioned(right: 10, bottom: 10, child: _badge(context, 'Score: ${stats.dealScore}/100', const Color(0xB3000000), Colors.white)),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(meta.name.toUpperCase(), style: tx(context, 9.5, w: FontWeight.w900, color: T1SColors.red)),
            const SizedBox(height: 3),
            Text(probe.label, style: tx(context, 16, w: FontWeight.w900)),
            const SizedBox(height: 6),
            Text('Cheapest live: ${inrAmount(stats.lowest)} vs highest ${inrAmount(stats.highest)} (${stats.spreadPct}% spread)', style: tx(context, 11.5, w: FontWeight.w800, h: 1.35)),
            const SizedBox(height: 4),
            Text(
              'Measured right now across ${stats.count} live priced offers. Median ${inrAmount(stats.median)}. Cheapest is "${_clip(stats.cheapest.title, 60)}" via ${stats.cheapest.subtitle.isNotEmpty ? stats.cheapest.subtitle : (stats.cheapest.provider.isNotEmpty ? stats.cheapest.provider : 'a verified source')}.',
              style: tx(context, 10.5, color: muted(context), h: 1.45),
            ),
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: dark ? T1SColors.slate800 : T1SColors.slate50, borderRadius: BorderRadius.circular(12), border: Border.all(color: dark ? T1SColors.slate700 : T1SColors.slate200)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('CROSS-PLATFORM BEST PRICE', style: tx(context, 8.5, w: FontWeight.w900, color: muted(context))),
                const SizedBox(height: 6),
                for (var i = 0; i < stats.top.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(children: [
                      Expanded(
                        child: Text(
                          stats.top[i].subtitle.isNotEmpty ? stats.top[i].subtitle : (stats.top[i].provider.isNotEmpty ? stats.top[i].provider : 'Live source'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: tx(context, 11, w: FontWeight.w700),
                        ),
                      ),
                      Text(inrAmount(stats.top[i].primaryPrice), style: tx(context, 11.5, w: FontWeight.w900, mono: true, color: i == 0 ? T1SColors.emerald600 : null)),
                    ]),
                  ),
              ]),
            ),
            const SizedBox(height: 10),
            Row(children: [
              Icon(Icons.schedule_rounded, size: 12, color: muted(context)),
              const SizedBox(width: 4),
              Text('Live now', style: tx(context, 10.5, color: muted(context))),
              const Spacer(),
              Text('Save up to ${inrAmount(stats.saving)}', style: tx(context, 11, w: FontWeight.w900, color: T1SColors.emerald600)),
            ]),
            const SizedBox(height: 10),
            GestureDetector(
              onTap: onLaunch,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(color: T1SColors.slate900, borderRadius: BorderRadius.circular(12)),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Flexible(child: Text('Launch ${meta.name.toUpperCase()} Metasearch', maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 11.5, w: FontWeight.w900, color: Colors.white))),
                  const SizedBox(width: 6),
                  const Icon(Icons.arrow_forward_rounded, size: 14, color: Colors.white),
                ]),
              ),
            ),
          ]),
        ),
      ]),
    );
  }

  static String _clip(String s, int n) => s.length <= n ? s : s.substring(0, n);

  Widget _badge(BuildContext context, String t, Color bg, Color fg) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
        child: Text(t, style: tx(context, 9, w: FontWeight.w900, color: fg)),
      );
}

class _CardSkeleton extends StatelessWidget {
  const _CardSkeleton();
  @override
  Widget build(BuildContext context) {
    final c = isDark(context) ? T1SColors.slate800 : T1SColors.slate100;
    return Box(
      padding: EdgeInsets.zero,
      radius: 20,
      clip: true,
      child: Column(children: [
        Container(height: 130, color: c),
        Padding(
          padding: const EdgeInsets.all(14),
          child: Column(children: [
            for (var i = 0; i < 4; i++) Container(height: 12, margin: const EdgeInsets.only(bottom: 8), decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(6))),
          ]),
        ),
      ]),
    );
  }
}
