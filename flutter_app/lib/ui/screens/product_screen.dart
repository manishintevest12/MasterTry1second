import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/auth.dart';
import '../../core/app_state.dart';
import '../../core/compare.dart';
import '../../core/theme.dart';
import '../widgets/search_progress_card.dart';
import '../widgets/history_chart.dart';
import '../widgets/kit.dart';
import '../widgets/redirect_sheet.dart';
import 'compare_screen.dart' show showTrackSheet;

/// In-app product page (website ProductPageView): paste a link or type a product
/// name -> same-product offers cheapest-first, REAL price history, deal score
/// verdict, related products, seller coupons. Everything from POST /api/product-page.
class ProductScreen extends StatefulWidget {
  const ProductScreen({super.key, required this.input, this.seed = const [], this.gallery = const []});
  final String input;

  /// Seller quotes from the card the user tapped Compare on (web parity):
  /// the detail page shows every seller the engine already found for this
  /// product even if the fresh search flakes on this attempt.
  final List<Map<String, Object?>> seed;
  final List<String> gallery;

  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> {
  final _state = AppState.instance;
  late Future<ProductPage> _future;
  late final TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.input);
    _future = _load(widget.input);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<ProductPage> _load(String input) async {
    final page = await _state.api.productPage(
      input,
      city: _state.city,
      pincode: _state.pincode,
      seed: widget.seed,
      gallery: widget.gallery,
    );
    return page;
  }

  void _search(String v) {
    final q = v.trim();
    if (q.isEmpty) return;
    setState(() => _future = _load(q));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: isDark(context) ? T1SColors.slate950 : T1SColors.slate50,
      appBar: AppBar(
        title: Text('Product Page', style: tx(context, 16, w: FontWeight.w900)),
        leading: IconButton(icon: const Icon(Icons.arrow_back_rounded), onPressed: () => Navigator.pop(context)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 30),
        children: [
          Row(children: [
            Expanded(
              child: TextField(
                controller: _ctrl,
                onSubmitted: _search,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(hintText: 'Paste product link or type a name', isDense: true, prefixIcon: const Icon(Icons.link_rounded, size: 17)),
                style: tx(context, 13),
              ),
            ),
            const SizedBox(width: 8),
            RedButton('Find', onTap: () => _search(_ctrl.text), dense: true),
          ]),
          const SizedBox(height: 14),
          FutureBuilder<ProductPage>(
            future: _future,
            builder: (c, snap) {
              if (snap.connectionState != ConnectionState.done) {
                // OWNER 28 Oct: the product page shows the SAME progress panel as the
                // feed (web parity) — live source name, real count, brand-red fill and
                // result-shaped skeletons — never a bare grey shimmer.
                return SearchProgressCard(
                  verticalId: 'ecommerce',
                  title: _ctrl.text.trim().isEmpty ? null : _ctrl.text.trim(),
                );
              }
              if (snap.hasError) {
                return Box(
                  padding: const EdgeInsets.all(16),
                  child: Column(children: [
                    const Icon(Icons.wifi_off_rounded, color: T1SColors.red),
                    const SizedBox(height: 8),
                    Text('${snap.error}'.replaceFirst('Exception: ', ''), style: tx(c, 12, color: T1SColors.red)),
                  ]),
                );
              }
              final page = snap.data!;
              if (!page.found) {
                return Box(
                  padding: const EdgeInsets.all(20),
                  child: Column(children: [
                    Icon(Icons.search_off_rounded, size: 30, color: T1SColors.slate300),
                    const SizedBox(height: 10),
                    Text(page.message ?? 'Could not read that page.', textAlign: TextAlign.center, style: tx(c, 12.5, color: muted(c), h: 1.4)),
                  ]),
                );
              }
              return _Page(page: page, onSearch: _search);
            },
          ),
        ],
      ),
    );
  }
}

class _Page extends StatefulWidget {
  const _Page({required this.page, required this.onSearch});
  final ProductPage page;
  final ValueChanged<String> onSearch;

  @override
  State<_Page> createState() => _PageState();
}

class _PageState extends State<_Page> {
  int _activeImg = 0;
  int _dealTab = 0; // 0 = Deal Scanner, 1 = Price Drop
  late final TextEditingController _alertCtrl;

  @override
  void initState() {
    super.initState();
    final cur = widget.page.offers.firstOrNull?.price ?? 0;
    _alertCtrl = TextEditingController(text: cur > 0 ? (cur * 0.95).round().toString() : '');
  }

  @override
  void dispose() {
    _alertCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final page = widget.page;
    final cheapest = page.offers.firstOrNull;
    final images = page.images;
    final listPrice = cheapest != null && cheapest.listPrice > cheapest.price ? cheapest.listPrice : 0.0;
    final off = listPrice > 0 ? ((listPrice - cheapest!.price) / listPrice * 100).round() : 0;

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      // ---- 1. gallery: main image + thumbnail rail ----
      Box(
        padding: EdgeInsets.zero,
        clip: true,
        child: Column(children: [
          AspectRatio(
            aspectRatio: 1,
            child: images.isEmpty
                ? Icon(Icons.image_outlined, size: 44, color: T1SColors.slate300)
                : NetImage(images[_activeImg.clamp(0, images.length - 1)], fit: BoxFit.contain),
          ),
          if (images.length > 1)
            SizedBox(
              height: 64,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.all(10),
                itemCount: images.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (c, i) => GestureDetector(
                  onTap: () => setState(() => _activeImg = i),
                  child: Container(
                    width: 52,
                    height: 52,
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      color: isDark(c) ? T1SColors.slate800 : Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      // Reference: thin red border on the selected thumbnail.
                      border: Border.all(color: i == _activeImg ? T1SColors.red : border(c), width: i == _activeImg ? 1.4 : 1),
                    ),
                    child: NetImage(images[i], fit: BoxFit.contain),
                  ),
                ),
              ),
            ),
        ]),
      ),
      const SizedBox(height: 12),

      // ---- 2. info: seller badge, rating, price, share, big Buy ----
      Box(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (cheapest != null) ...[
            Row(children: [
              _SellerChip(cheapest.seller),
            ]),
            const SizedBox(height: 8),
          ],
          Text(page.title, style: tx(context, 15.5, w: FontWeight.w900), maxLines: 3, overflow: TextOverflow.ellipsis),
          if (cheapest?.rating != null) ...[
            const SizedBox(height: 6),
            Row(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xFF14A067), borderRadius: BorderRadius.circular(6)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.star_rounded, size: 11, color: Colors.white),
                  const SizedBox(width: 2),
                  Text(cheapest!.rating!.toStringAsFixed(1), style: tx(context, 10, w: FontWeight.w900, color: Colors.white)),
                ]),
              ),
              const SizedBox(width: 8),
              if (cheapest.reviews > 0)
                Text('${cheapest.reviews} ratings', style: tx(context, 10.5, color: muted(context))),
            ]),
          ],
          const SizedBox(height: 10),
          Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(cheapest != null ? inrAmount(cheapest.price) : 'Price unavailable',
                style: tx(context, 24, w: FontWeight.w900, mono: true)),
            if (listPrice > 0) ...[
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Text(inrAmount(listPrice), style: const TextStyle(fontSize: 12, color: T1SColors.slate400, decoration: TextDecoration.lineThrough, fontWeight: FontWeight.w600)),
              ),
            ],
          ]),
          if (off > 0) ...[
            const SizedBox(height: 2),
            Row(children: [
              Icon(Icons.trending_down_rounded, size: 13, color: T1SColors.green),
              const SizedBox(width: 3),
              Text('$off% OFF', style: tx(context, 11, w: FontWeight.w900, color: T1SColors.green)),
            ]),
          ],
          const SizedBox(height: 10),
          Row(children: [
            Text('Share on', style: tx(context, 10.5, color: muted(context))),
            const SizedBox(width: 8),
            _ShareButton(
              icon: Icons.share_rounded,
              background: const Color(0xFF14A067),
              onTap: () {
                final text = '${page.title} - ${cheapest != null ? inrAmount(cheapest.price) : ''} (cheapest found on Try1Second)';
                launchUrl(Uri.parse('https://wa.me/?text=${Uri.encodeComponent(text)}'), mode: LaunchMode.externalApplication);
              },
            ),
            const SizedBox(width: 8),
            _ShareButton(
              icon: Icons.copy_rounded,
              outline: true,
              onTap: () {
                Clipboard.setData(ClipboardData(text: page.title));
                if (mounted) toast(context, 'Copied');
              },
            ),
          ]),
          if (cheapest != null && cheapest.goUrl.isNotEmpty) ...[
            const SizedBox(height: 12),
            RedButton(
              'Buy on ${cheapest.seller}',
              onTap: () => showRedirectSheet(
                context,
                sellerName: cheapest.seller,
                title: page.title.isEmpty ? cheapest.title : page.title,
                goUrl: cheapest.goUrl,
                price: cheapest.price,
                image: cheapest.image ?? (page.images.isNotEmpty ? page.images.first : null),
                isLowest: true,
              ),
            ),
          ],
        ]),
      ),
      const SizedBox(height: 12),

      // ---- 3. Compare N Available Prices ----
      if (page.offers.isNotEmpty) ...[
        Box(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Compare ${page.offers.length} Available ${page.offers.length == 1 ? 'Price' : 'Prices'}',
                style: tx(context, 13, w: FontWeight.w900)),
            for (final (i, o) in page.offers.indexed) ...[
              _CompareRow(
                offer: o,
                lowest: i == 0,
                pctCostlier: (cheapest != null && i > 0 && o.price > 0)
                    ? ((o.price - cheapest.price) / o.price * 100).round()
                    : 0,
                onTap: o.goUrl.isEmpty
                    ? null
                    : () => showRedirectSheet(
                          context,
                          sellerName: o.seller,
                          title: page.title.isEmpty ? o.title : page.title,
                          goUrl: o.goUrl,
                          price: o.price,
                          image: o.image ?? (page.images.isNotEmpty ? page.images.first : null),
                          isLowest: i == 0,
                        ),
              ),
              if (i < page.offers.length - 1) Divider(height: 1, color: border(context)),
            ],
          ]),
        ),
        const SizedBox(height: 12),
      ],

      // ---- 4. Deal Scanner | Price Drop ----
      _DealScannerCard(page: page, tab: _dealTab, onTab: (t) => setState(() => _dealTab = t), alertCtrl: _alertCtrl),

      // ---- history chart (REAL recorded points only) ----
      if (page.history.length >= 2) ...[
        const SizedBox(height: 12),
        Box(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Icon(Icons.show_chart_rounded, size: 15, color: T1SColors.red),
              const SizedBox(width: 6),
              Expanded(child: Text('REAL PRICE HISTORY', style: tx(context, 11, w: FontWeight.w900, ls: 0.6))),
              Text('${page.history.length} recorded points', style: tx(context, 9.5, color: muted(context))),
            ]),
            const SizedBox(height: 10),
            HistoryChart(points: page.history, height: 110),
            const SizedBox(height: 6),
            Text('Only real observations. Nothing is generated.', style: tx(context, 9.5, color: muted(context))),
          ]),
        ),
      ],

      // ---- related ----
      if (page.related.isNotEmpty) ...[
        const SizedBox(height: 16),
        SectionTitle('RELATED PRODUCTS · REAL PRICES', dot: T1SColors.slate400),
        SizedBox(
          height: 118,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: page.related.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (c, i) {
              final r = page.related[i];
              return GestureDetector(
                onTap: () => widget.onSearch(r.title),
                child: Box(
                  padding: const EdgeInsets.all(8),
                  child: SizedBox(
                    width: 96,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      NetImage(r.image, height: 60, fit: BoxFit.contain, radius: 8, fallbackIcon: Icons.shopping_bag_outlined),
                      const SizedBox(height: 5),
                      Text(r.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(c, 9.5, w: FontWeight.w800)),
                      Text(inrAmount(r.price), style: tx(c, 11, w: FontWeight.w900, mono: true)),
                    ]),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    ]);
  }
}

/// Small seller badge with the merchant logo (registry `/api/logos/<key>` first).
class _SellerChip extends StatelessWidget {
  const _SellerChip(this.seller);
  final String seller;

  String get _logoKey {
    final m = seller.toLowerCase().replaceAll(RegExp(r'\.(com|in|co\.in)\b'), '').replaceAll(RegExp(r'[^a-z0-9]+'), ' ').trim();
    final first = m.isEmpty ? '' : m.split(' ').first;
    const alias = {'amzn': 'amazon', 'tata': 'tatacliq', 'reliance': 'reliancedigital', 'jiomart': 'jiomart'};
    return alias[first] ?? first;
  }

  @override
  Widget build(BuildContext context) {
    final base = AppState.instance.api.baseUrl;
    final logo = base.isEmpty ? '' : '$base/api/logos/$_logoKey';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border(context)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        NetImage(logo, width: 14, height: 14, fit: BoxFit.contain, fallbackIcon: Icons.storefront_rounded),
        const SizedBox(width: 6),
        Text(seller, style: tx(context, 10, w: FontWeight.w900)),
      ]),
    );
  }
}

/// Circular share/copy icon button (reference: green filled + outlined copy).
class _ShareButton extends StatelessWidget {
  const _ShareButton({required this.icon, required this.onTap, this.background, this.outline = false});
  final IconData icon;
  final VoidCallback onTap;
  final Color? background;
  final bool outline;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          color: background,
          shape: BoxShape.circle,
          border: outline ? Border.all(color: border(context)) : null,
        ),
        child: Icon(icon, size: 14, color: background != null ? Colors.white : muted(context)),
      ),
    );
  }
}

/// One 'Compare' row: logo circle, seller, variant, price, Lowest/% costlier.
class _CompareRow extends StatelessWidget {
  const _CompareRow({required this.offer, required this.lowest, required this.pctCostlier, this.onTap});
  final ProductOffer offer;
  final bool lowest;
  final int pctCostlier;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final o = offer;
    final sub = o.availability == 'out_of_stock'
        ? 'Out of stock'
        : (o.title.isNotEmpty ? o.title : '') + (o.variantCount > 1 ? ' · ${o.variantCount} variants' : '');
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 2),
        child: Row(children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isDark(context) ? T1SColors.slate800 : Colors.white,
              border: Border.all(color: border(context)),
            ),
            child: ClipOval(child: NetImage(o.image, fit: BoxFit.contain, fallbackIcon: Icons.storefront_rounded)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(o.seller, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 12.5, w: FontWeight.w800)),
              if (sub.isNotEmpty)
                Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 9.5, color: T1SColors.slate400)),
            ]),
          ),
          const SizedBox(width: 8),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(inrAmount(o.price), style: tx(context, 12.5, w: FontWeight.w900, mono: true)),
            if (lowest)
              Text('Lowest price', style: tx(context, 8.5, w: FontWeight.w900, color: T1SColors.green))
            else if (pctCostlier > 0)
              Text('$pctCostlier% costlier', style: tx(context, 8.5, w: FontWeight.w800, color: T1SColors.slate400)),
          ]),
          const SizedBox(width: 4),
          Icon(Icons.chevron_right_rounded, size: 16, color: T1SColors.slate300),
        ]),
      ),
    );
  }
}

/// Deal Scanner | Price Drop card (reference right column).
class _DealScannerCard extends StatelessWidget {
  const _DealScannerCard({required this.page, required this.tab, required this.onTab, required this.alertCtrl});
  final ProductPage page;
  final int tab;
  final ValueChanged<int> onTab;
  final TextEditingController alertCtrl;

  @override
  Widget build(BuildContext context) {
    final signedIn = AuthService.instance.signedIn;
    final cheapest = page.offers.firstOrNull;
    return Box(
      padding: EdgeInsets.zero,
      clip: true,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        // tabs — reference: active tab red underline
        Container(
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: border(context)))),
          child: Row(children: [
            _DealTab(label: 'Deal Scanner', active: tab == 0, onTap: () => onTab(0)),
            _DealTab(label: 'Price Drop', active: tab == 1, onTap: () => onTab(1)),
          ]),
        ),
        if (tab == 0) _ScannerBody(page: page) else _PriceDropBody(page: page, alertCtrl: alertCtrl, signedIn: signedIn, cheapest: cheapest),
      ]),
    );
  }
}

class _DealTab extends StatelessWidget {
  const _DealTab({required this.label, required this.active, required this.onTap});
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 11),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: active ? T1SColors.red : Colors.transparent, width: 2)),
          ),
          child: Text(label, textAlign: TextAlign.center,
              style: tx(context, 11.5, w: active ? FontWeight.w900 : FontWeight.w700,
                  color: active ? ink(context) : T1SColors.slate400)),
        ),
      ),
    );
  }
}

class _ScannerBody extends StatelessWidget {
  const _ScannerBody({required this.page});
  final ProductPage page;

  @override
  Widget build(BuildContext context) {
    if (!page.hasHistory || page.score <= 0) {
      return Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(Icons.auto_awesome_rounded, size: 15, color: T1SColors.red),
            const SizedBox(width: 6),
            Text('Deal score building up', style: tx(context, 12.5, w: FontWeight.w900)),
          ]),
          const SizedBox(height: 4),
          Text(page.headline.isNotEmpty
              ? page.headline
              : 'Not enough recorded price history yet to score this deal. We never guess.',
              style: tx(context, 10.5, color: muted(context), h: 1.4)),
          const SizedBox(height: 6),
          Text('Every search records the live price, so the score appears as history grows.',
              style: tx(context, 9, color: T1SColors.slate400)),
        ]),
      );
    }
    final verdictColor = switch (page.verdict) {
      'great' || 'good' => T1SColors.green,
      'fair' => T1SColors.amber500,
      'wait' => T1SColors.orange600,
      _ => T1SColors.slate500,
    };
    final verdictLabel = switch (page.verdict) {
      'great' => 'Hot Deal',
      'good' => 'Good Deal',
      'fair' => 'Fair Price',
      'wait' => 'Better to wait',
      _ => 'Deal Score',
    };
    return Padding(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
            decoration: BoxDecoration(
              color: verdictColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: verdictColor.withValues(alpha: 0.4)),
            ),
            child: Text(verdictLabel, style: tx(context, 11, w: FontWeight.w900, color: verdictColor)),
          ),
          const Spacer(),
          _ScoreGauge(score: page.score),
        ]),
        if (page.headline.isNotEmpty) ...[
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFE8F5E9),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(page.headline, style: tx(context, 10.5, w: FontWeight.w800, color: const Color(0xFF1B5E20))),
          ),
        ],
        const SizedBox(height: 10),
        Row(children: [
          _StatBox(label: 'All-time low', value: page.allTimeLow != null ? inrAmount(page.allTimeLow!) : '-'),
          const SizedBox(width: 8),
          _StatBox(label: 'Average', value: page.average != null ? inrAmount(page.average!) : '-'),
          const SizedBox(width: 8),
          _StatBox(label: 'All-time high', value: page.allTimeHigh != null ? inrAmount(page.allTimeHigh!) : '-'),
        ]),
        if (page.breakup.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text('DEAL SCORE BREAKUP', style: tx(context, 9, w: FontWeight.w900, ls: 0.6, color: T1SColors.slate500)),
          const SizedBox(height: 6),
          for (final b in page.breakup)
            Padding(
              padding: const EdgeInsets.only(bottom: 5),
              child: Row(children: [
                Expanded(child: Text(b.label, style: tx(context, 10.5, color: muted(context)))),
                Text('${b.pts}', style: tx(context, 10.5, w: FontWeight.w900)),
                Text('/${b.max}', style: tx(context, 10.5, color: T1SColors.slate400)),
              ]),
            ),
        ],
        const SizedBox(height: 6),
        Text('Computed from ${page.points} recorded prices plus live prices on other sites.',
            style: tx(context, 8.5, color: T1SColors.slate400)),
      ]),
    );
  }
}

class _PriceDropBody extends StatelessWidget {
  const _PriceDropBody({required this.page, required this.alertCtrl, required this.signedIn, required this.cheapest});
  final ProductPage page;
  final TextEditingController alertCtrl;
  final bool signedIn;
  final ProductOffer? cheapest;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.notifications_active_outlined, size: 18, color: T1SColors.red),
          const SizedBox(width: 8),
          Expanded(
            child: Text('Set price drop alert to buy later', style: tx(context, 12.5, w: FontWeight.w900)),
          ),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: border(context)),
              ),
              child: Row(children: [
                Text('\u20B9', style: tx(context, 13, w: FontWeight.w900, color: muted(context))),
                const SizedBox(width: 6),
                Expanded(
                  child: TextField(
                    controller: alertCtrl,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: const InputDecoration(hintText: 'Target price', border: InputBorder.none, isDense: true),
                    style: tx(context, 13, w: FontWeight.w900),
                  ),
                ),
              ]),
            ),
          ),
          const SizedBox(width: 10),
          RedButton(signedIn ? 'Set Alert' : 'Login & Set Alert', onTap: () {
            final target = double.tryParse(alertCtrl.text.trim()) ?? 0;
            showTrackSheet(
              context,
              title: page.title,
              query: page.title,
              vertical: 'ecommerce',
              price: target > 0 ? target : cheapest?.price,
              image: cheapest?.image,
              sourceUrl: cheapest?.goUrl,
            );
          }, dense: true),
        ]),
        const SizedBox(height: 10),
        Text('We re-check live prices every 30 minutes and notify you the moment it hits your target. Only real observed prices.',
            style: tx(context, 9, color: T1SColors.slate400, h: 1.4)),
        if (cheapest != null && cheapest!.goUrl.isNotEmpty) ...[
          const SizedBox(height: 12),
          T1SOutlineButton('Buy on ${cheapest!.seller}', onTap: () => showRedirectSheet(
            context,
            sellerName: cheapest!.seller,
            title: page.title.isEmpty ? cheapest!.title : page.title,
            goUrl: cheapest!.goUrl,
            price: cheapest!.price,
            image: cheapest!.image ?? (page.images.isNotEmpty ? page.images.first : null),
            isLowest: true,
          )),
        ],
      ]),
    );
  }
}

class _StatBox extends StatelessWidget {
  const _StatBox({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: border(context)),
        ),
        child: Column(children: [
          Text(label, style: tx(context, 8.5, color: T1SColors.slate400)),
          const SizedBox(height: 2),
          Text(value, style: tx(context, 10.5, w: FontWeight.w900, mono: true)),
        ]),
      ),
    );
  }
}

/// Semicircular 0-100 gauge (web Gauge parity): red / amber / green arcs + needle.
class _ScoreGauge extends StatelessWidget {
  const _ScoreGauge({required this.score});
  final int score;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 118,
      height: 78,
      child: CustomPaint(
        painter: _GaugePainter(score.clamp(0, 100).toDouble()),
        child: Align(
          alignment: Alignment.bottomCenter,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: Text('Deal Score ${score.clamp(0, 100)}', style: tx(context, 9, w: FontWeight.w900)),
          ),
        ),
      ),
    );
  }
}

class _GaugePainter extends CustomPainter {
  _GaugePainter(this.score);
  final double score;

  static const _r = 42.0;

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height - 14.0;
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8
      ..strokeCap = StrokeCap.butt;
    void arc(double a0, double a1, Color color) {
      stroke.color = color;
      canvas.drawArc(Rect.fromCircle(center: Offset(cx, cy), radius: _r), math.pi * (1 - a1), math.pi * (a1 - a0), false, stroke);
    }
    arc(0, 0.34, const Color(0xFFE7000B));
    arc(0.34, 0.67, const Color(0xFFF59E0B));
    arc(0.67, 1, const Color(0xFF16A34A));
    // needle
    final ang = math.pi * (1 - score / 100);
    final needle = Paint()
      ..color = const Color(0xFF0F172A)
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset(cx, cy), Offset(cx + _r * math.cos(ang), cy - _r * math.sin(ang)), needle);
    canvas.drawCircle(Offset(cx, cy), 3.5, Paint()..color = const Color(0xFF0F172A));
  }

  @override
  bool shouldRepaint(_GaugePainter old) => old.score != score;
}
