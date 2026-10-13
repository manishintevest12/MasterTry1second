import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/storage.dart';
import '../../core/theme.dart';
import '../widgets/common.dart';
import '../widgets/history_chart.dart';

/// Product detail: all site offers for one canonical product, REAL price
/// history chart, buy/wait verdict, track button and safe /api/go opens.
class ProductScreen extends StatefulWidget {
  const ProductScreen({
    super.key,
    required this.group,
    required this.vertical,
    required this.query,
  });

  final OfferGroup group;
  final String vertical;
  final String query;

  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> {
  final _store = AppStore();
  List<HistoryPoint> _history = [];
  bool _historyLoaded = false;
  String? _openError;
  bool _tracked = false;

  String get _key =>
      widget.group.best.canonicalEntityId ?? widget.group.best.id;

  @override
  void initState() {
    super.initState();
    _store.isTracked(_key).then((t) => setState(() => _tracked = t));
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    final entityId = widget.group.best.canonicalEntityId;
    if (entityId == null || entityId.isEmpty) {
      setState(() => _historyLoaded = true);
      return;
    }
    try {
      final api = await _store.api();
      final points = await api.history(entityId);
      if (!mounted) return;
      setState(() { _history = points; _historyLoaded = true; });
    } catch (_) {
      if (mounted) setState(() => _historyLoaded = true);
    }
  }

  Future<void> _openOffer(Offer offer) async {
    setState(() => _openError = null);
    try {
      final api = await _store.api();
      final dest = offer.sellerUrl == null || offer.sellerUrl!.isEmpty
          ? api.searchUrl(widget.query).toString()
          : await api.go(offer.sellerUrl!, offer.id);
      final ok = await launchUrl(Uri.parse(dest),
          mode: LaunchMode.externalApplication);
      if (!ok && mounted) {
        setState(() => _openError = 'Could not open the link on this device.');
      }
    } catch (e) {
      if (mounted) setState(() => _openError = 'Link unavailable ($e).');
    }
  }

  Future<void> _toggleTrack() async {
    final best = widget.group.best;
    await _store.toggleTrack(TrackedItem(
      key: _key,
      title: best.title,
      vertical: widget.vertical,
      query: widget.query,
      canonicalEntityId: best.canonicalEntityId,
      lastPrice: widget.group.bestPrice,
      pageUrl: best.sellerUrl,
      addedAt: DateTime.now(),
    ));
    setState(() => _tracked = !_tracked);
  }

  @override
  Widget build(BuildContext context) {
    final offers = widget.group.offers
        .where((o) => o.hasPrice)
        .toList()
      ..sort((a, b) => a.effectivePrice.compareTo(b.effectivePrice));
    final verdict = verdictFromHistory(_history, widget.group.bestPrice);

    return Scaffold(
      appBar: AppBar(title: const Text('Compare')),
      body: SafeArea(
        child: LayoutBuilder(builder: (context, constraints) {
          final wide = constraints.maxWidth > 760;
          final maxW = wide ? 760.0 : constraints.maxWidth;
          return Center(
            child: SizedBox(
              width: maxW,
              child: ListView(
                padding: const EdgeInsets.all(14),
                children: [
                  // Title + best price
                  Text(widget.group.best.title, style: T1SText.headline(context)),
                  const SizedBox(height: 6),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('Best verified price  ', style: T1SText.label(context)),
                      Text(inr(widget.group.bestPrice), style: T1SText.price(context)),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // Track + open best
                  Row(
                    children: [
                      Expanded(
                        child: T1SButton.primary(
                          label: _tracked ? 'Tracking ✓' : 'Track price',
                          icon: Icon(
                            _tracked ? Icons.notifications_active : Icons.notifications_none,
                            size: 16,
                            color: Colors.white,
                          ),
                          onTap: _toggleTrack,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: T1SButton.secondary(
                          label: 'Open ${offers.isEmpty ? 'on web' : 'best offer'}',
                          icon: const Icon(Icons.open_in_new, size: 15),
                          onTap: offers.isEmpty ? null : () => _openOffer(offers.first),
                        ),
                      ),
                    ],
                  ),
                  if (_openError != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(_openError!,
                          style: T1SText.body(context).copyWith(color: T1SColors.slate400)),
                    ),
                  const SizedBox(height: 16),

                  // Verdict (only from real history)
                  if (verdict != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Theme.of(context).brightness == Brightness.dark
                              ? const Color(0xFF1E293B)
                              : T1SColors.slate50,
                          border: Border.all(color: T1SColors.slate200),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                gradient: T1SColors.badgeGradient,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(verdict.label,
                                  style: const TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w900,
                                      color: Colors.white)),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(verdict.text, style: T1SText.body(context)),
                            ),
                          ],
                        ),
                      ),
                    ),

                  // Price history (real only)
                  T1SCard(
                    child: _historyLoaded
                        ? HistoryChart(points: _history)
                        : const HonestNote('Loading recorded history…', loading: true),
                  ),
                  const SizedBox(height: 14),

                  // All sites
                  const SectionHeader('ALL SITES (VERIFIED)'),
                  for (final o in offers)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: _OfferRow(
                        offer: o,
                        isBest: o == offers.first,
                        onOpen: () => _openOffer(o),
                      ),
                    ),

                  const SizedBox(height: 10),
                  T1SCard(
                    child: Text(
                      'Opens go through Try1Second\'s safe redirect (clicks recorded, '
                      'affiliate applied server-side). Unavailable sources are listed as '
                      'unavailable — never guessed.',
                      style: T1SText.body(context).copyWith(fontSize: 10.5, color: T1SColors.slate400),
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _OfferRow extends StatelessWidget {
  const _OfferRow({required this.offer, required this.isBest, required this.onOpen});

  final Offer offer;
  final bool isBest;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      decoration: BoxDecoration(
        color: isBest
            ? (dark ? const Color(0xFF2A1218) : const Color(0xFFFFF1F2))
            : (dark ? T1SColors.slate900 : Colors.white),
        border: Border.all(
            color: isBest
                ? const Color(0xFFFECDD3)
                : (dark ? const Color(0xFF334155) : T1SColors.slate200)),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(offer.seller.isEmpty ? 'Verified source' : offer.seller,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T1SText.title(context).copyWith(fontSize: 12.5)),
                const SizedBox(height: 2),
                Text(
                  [
                    if (!offer.inStock) 'check availability',
                    if (offer.city != null && offer.city!.isNotEmpty) offer.city!,
                  ].join(' · '),
                  style: T1SText.body(context).copyWith(fontSize: 10, color: T1SColors.slate400),
                ),
              ],
            ),
          ),
          Text(inr(offer.effectivePrice), style: T1SText.title(context)),
          const SizedBox(width: 10),
          SizedBox(
            height: 34,
            child: T1SButton.secondary(label: 'Open', onTap: onOpen),
          ),
        ],
      ),
    );
  }
}
