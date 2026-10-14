import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/app_state.dart';
import '../../core/compare.dart';
import '../../core/theme.dart';
import '../widgets/history_chart.dart';
import '../widgets/kit.dart';
import '../widgets/redirect_sheet.dart';
import 'compare_screen.dart' show showTrackSheet;

/// In-app product page (website ProductPageView): paste a link or type a product
/// name -> same-product offers cheapest-first, REAL price history, deal score
/// verdict, related products, seller coupons. Everything from POST /api/product-page.
class ProductScreen extends StatefulWidget {
  const ProductScreen({super.key, required this.input});
  final String input;

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
    final page = await _state.api.productPage(input, city: _state.city, pincode: _state.pincode);
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
                return const _ProductSkeleton();
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

class _ProductSkeleton extends StatelessWidget {
  const _ProductSkeleton();
  @override
  Widget build(BuildContext context) {
    Widget block(double h) => Container(
          height: h,
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(color: isDark(context) ? T1SColors.slate800 : T1SColors.slate200, borderRadius: BorderRadius.circular(12)),
        );
    return const Column(children: [
      _Shimmer(),
    ]);
  }
}

class _Shimmer extends StatefulWidget {
  const _Shimmer();
  @override
  State<_Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<_Shimmer> with SingleTickerProviderStateMixin {
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..repeat();
  @override
  void dispose() { _c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (c, _) {
        final base = isDark(c) ? T1SColors.slate800 : T1SColors.slate100;
        final hi = isDark(c) ? T1SColors.slate700 : Colors.white;
        return Column(children: [
          Container(height: 190, decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(14))),
          const SizedBox(height: 12),
          ...List.generate(4, (i) => Container(
                height: 58,
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [base, hi.withValues(alpha: .55), base], stops: [0, _c.value, 1]),
                  borderRadius: BorderRadius.circular(12),
                ),
              )),
        ]);
      },
    );
  }
}

class _Page extends StatelessWidget {
  const _Page({required this.page, required this.onSearch});
  final ProductPage page;
  final ValueChanged<String> onSearch;

  @override
  Widget build(BuildContext context) {
    final cheapest = page.offers.firstOrNull;
    final verdictColor = switch (page.verdict) {
      'great' => T1SColors.emerald600,
      'good' => T1SColors.emerald400,
      'fair' => T1SColors.amber500,
      'wait' => T1SColors.orange600,
      _ => T1SColors.slate500,
    };
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      // gallery + title
      Box(
        padding: EdgeInsets.zero,
        clip: true,
        child: Column(children: [
          SizedBox(
            height: 200,
            child: page.images.isEmpty
                ? Icon(Icons.image_outlined, size: 40, color: T1SColors.slate300)
                : ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.all(10),
                    itemCount: page.images.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, i) => NetImage(page.images[i], width: 180, height: 180, radius: 12),
                  ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(page.title, style: tx(context, 15, w: FontWeight.w900), maxLines: 3, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 8),
              Row(children: [
                if (page.score > 0) ...[
                  Pill('Deal score ${page.score}/100', bg: verdictColor.withValues(alpha: 0.14), fg: verdictColor, icon: Icons.insights_rounded, size: 9.5),
                  const SizedBox(width: 6),
                ],
                if (page.headline.isNotEmpty) Expanded(child: Text(page.headline, style: tx(context, 11, w: FontWeight.w800, color: verdictColor))),
              ]),
            ]),
          ),
        ]),
      ),
      const SizedBox(height: 12),

      // cheapest banner
      if (cheapest != null) ...[
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: T1SColors.greenBg, borderRadius: BorderRadius.circular(14), border: Border.all(color: T1SColors.greenBorder)),
          child: Row(children: [
            const Icon(Icons.savings_rounded, color: T1SColors.green, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Cheapest verified price', style: tx(context, 10, w: FontWeight.w800, color: T1SColors.green)),
                const SizedBox(height: 2),
                Text('${cheapest.seller} · ${inrAmount(cheapest.price)}', style: tx(context, 14, w: FontWeight.w900, mono: true)),
              ]),
            ),
            RedButton('Buy', onTap: cheapest.goUrl.isEmpty ? null : () => showRedirectSheet(
              context,
              sellerName: cheapest.seller,
              title: page.title.isEmpty ? cheapest.title : page.title,
              goUrl: cheapest.goUrl,
              price: cheapest.price,
              image: cheapest.image ?? (page.images.isNotEmpty ? page.images.first : null),
              isLowest: true,
            ), dense: true),
          ]),
        ),
        const SizedBox(height: 12),
      ],

      // history chart (REAL recorded points only)
      if (page.history.length >= 2) ...[
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
        const SizedBox(height: 12),
      ],

      // offers list
      if (page.offers.isNotEmpty) ...[
        SectionTitle('ALL VERIFIED SELLERS · CHEAPEST FIRST'),
        for (final o in page.offers) ...[
          Box(
            padding: const EdgeInsets.all(11),
            child: Row(children: [
              NetImage(o.image, width: 52, height: 52, radius: 10, fallbackIcon: Icons.storefront_outlined),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(o.seller, style: tx(context, 11, w: FontWeight.w900)),
                  const SizedBox(height: 2),
                  Row(children: [
                    Text(inrAmount(o.price), style: tx(context, 14, w: FontWeight.w900, mono: true)),
                    if (o.rating != null) ...[
                      const SizedBox(width: 8),
                      Pill('${o.rating}★', fg: T1SColors.amber500, size: 8.5),
                    ],
                  ]),
                ]),
              ),
              RedButton('Buy', onTap: o.goUrl.isEmpty ? null : () => showRedirectSheet(
                context,
                sellerName: o.seller,
                title: page.title.isEmpty ? o.title : page.title,
                goUrl: o.goUrl,
                price: o.price,
                image: o.image ?? (page.images.isNotEmpty ? page.images.first : null),
                isLowest: cheapest != null && o.price <= cheapest.price,
              ), dense: true),
            ]),
          ),
          const SizedBox(height: 8),
        ],
      ] else ...[
        Box(
          padding: const EdgeInsets.all(16),
          child: Text(page.message ?? 'No verified listing of this exact product was found on our sources right now.',
              style: tx(context, 12, color: muted(context), h: 1.4)),
        ),
      ],

      // track button
      if (cheapest != null) ...[
        const SizedBox(height: 4),
        T1SOutlineButton('Set price alert for this product', onTap: () {
          final sc = ScaffoldMessenger.of(context);
          showTrackSheet(
            context,
            title: page.title,
            query: page.title,
            vertical: 'ecommerce',
            price: cheapest.price,
            image: cheapest.image,
            sourceUrl: cheapest.goUrl,
          );
        }),
      ],

      // related
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
                onTap: () => onSearch(r.title),
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
