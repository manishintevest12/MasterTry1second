import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/compare.dart';
import '../../core/theme.dart';
import '../../core/verticals.dart';
import '../screens/compare_screen.dart' show showTrackSheet;
import 'kit.dart';

/// Grouped result cards (one product = one card, every site's real price inside,
/// cheapest first) mirroring the website's TravelDealRow / HotelDealCard /
/// CreditCardCard / ComparisonCard.

class _SiteRows extends StatelessWidget {
  const _SiteRows({required this.rows, required this.vertical, this.highlight = 0});
  final List<OfferRow> rows;
  final String vertical;
  final int highlight;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < rows.length; i++)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: _SiteRow(row: rows[i], vertical: vertical, isBest: i == 0 && rows[i].priceAvailable),
          ),
      ],
    );
  }
}

class _SiteRow extends StatelessWidget {
  const _SiteRow({required this.row, required this.vertical, required this.isBest});
  final OfferRow row;
  final String vertical;
  final bool isBest;

  @override
  Widget build(BuildContext context) {
    final domain = row.item.bestQuote?.sourceDomain ?? _domainOf(row.site);
    return Row(children: [
      SiteLogo(domain.isNotEmpty ? domain : 'try1second.com', size: 22),
      const SizedBox(width: 8),
      Expanded(child: Text(row.site, style: tx(context, 11.5, w: FontWeight.w800), overflow: TextOverflow.ellipsis)),
      if (isBest) ...[
        const SizedBox(width: 6),
        Pill('Lowest', bg: T1SColors.greenBg, fg: T1SColors.green, size: 8.5),
      ],
      const SizedBox(width: 8),
      Text(
        row.priceAvailable ? formatPrice(vertical, row.price) : 'Price on site',
        style: tx(context, 12.5, w: FontWeight.w900, color: row.priceAvailable ? ink(context) : muted(context), mono: true),
      ),
      const SizedBox(width: 8),
      GestureDetector(
        onTap: row.item.bestQuote != null && row.item.bestQuote!.url.isNotEmpty
            ? () => openDeal(row.item.bestQuote!.url)
            : null,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
          decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(8)),
          child: Text('Book', style: tx(context, 10.5, w: FontWeight.w900, color: Colors.white)),
        ),
      ),
    ]);
  }
}

String _domainOf(String site) {
  const map = {
    'Amazon': 'amazon.in',
    'Flipkart': 'flipkart.com',
    'Myntra': 'myntra.com',
    'Ajio': 'ajio.com',
    'Tata CLiQ': 'tatacliq.com',
    'Croma': 'croma.com',
    'Meesho': 'meesho.com',
    'Blinkit': 'blinkit.com',
    'Zepto': 'zepto.com',
    'Instamart': 'swiggy.com',
    'BigBasket': 'bigbasket.com',
    'Zomato': 'zomato.com',
    'Swiggy': 'swiggy.com',
    "Domino's": 'dominos.co.in',
    'BookMyShow': 'bookmyshow.com',
    'District': 'zomato.com',
    'Paytm': 'paytm.com',
    'PVR INOX': 'pvrinox.com',
    'TicketNew': 'ticketnew.com',
    'Cinepolis': 'cinepolisindia.com',
    'MakeMyTrip': 'makemytrip.com',
    'Goibibo': 'goibibo.com',
    'Booking.com': 'booking.com',
    'Agoda': 'agoda.com',
    'Cleartrip': 'cleartrip.com',
    'Yatra': 'yatra.com',
    'Airbnb': 'airbnb.com',
    'EaseMyTrip': 'easemytrip.com',
    'Ixigo': 'ixigo.com',
    'redBus': 'redbus.in',
    'AbhiBus': 'abhibus.com',
    'Air India Express': 'airindiaexpress.in',
    'IndiGo': 'goindigo.in',
    'Akasa Air': 'akasaair.com',
    'Paisabazaar': 'paisabazaar.com',
    'BankBazaar': 'bankbazaar.com',
    'Policybazaar': 'policybazaar.com',
    'Money View': 'moneyview.in',
    'HDFC Bank': 'hdfcbank.com',
    'SBI': 'sbicard.com',
    'Axis Bank': 'axisbank.com',
    'ICICI Bank': 'icicibank.com',
    'Kotak': 'kotak.com',
    'Ola': 'olacabs.com',
    'Uber': 'uber.com',
    'Savaari': 'savaari.com',
    'Bharat Taxi': 'bharattaxi.com',
    'CardInsider': 'cardinsider.com',
  };
  for (final e in map.entries) {
    if (site.toLowerCase().contains(e.key.toLowerCase())) return e.value;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Travel card (flights / bus / cab) — compact row card like TravelDealRow
// ---------------------------------------------------------------------------

class TravelTile extends StatelessWidget {
  const TravelTile({super.key, required this.g, required this.meta});
  final OfferGroup g;
  final VerticalMeta meta;

  @override
  Widget build(BuildContext context) {
    final it = g.lead;
    final durMin = (double.tryParse(it.spec('duration minutes')) ?? 0).round();
    final specs = [
      if (it.spec('flight number').isNotEmpty) it.spec('flight number'),
      if (durMin > 0) durMin < 60 ? '$durMin m' : '${durMin ~/ 60}h ${durMin % 60}m',
      if (it.spec('departure time').isNotEmpty) '${it.spec('departure time')} → ${it.spec('arrival time')}',
      if (it.spec('stops').isNotEmpty) '${it.spec('stops') == '0' ? 'Non-stop' : '${it.spec('stops')} stop'}',
      if (it.spec('operator').isNotEmpty) it.spec('operator'),
      if (it.spec('vehicle type').isNotEmpty) it.spec('vehicle type'),
      if (it.spec('bus type').isNotEmpty) it.spec('bus type'),
      if (it.spec('trip type').isNotEmpty) it.spec('trip type'),
    ];
    return Box(
      padding: const EdgeInsets.all(12),
      onTap: () => _expand(context),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          if (it.imageUrl != null) ...[
            NetImage(it.imageUrl, width: 30, height: 30, radius: 8, fit: BoxFit.contain, fallbackIcon: Icons.flight_rounded),
            const SizedBox(width: 9),
          ],
          Expanded(
            child: Text(it.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 12.5, w: FontWeight.w800)),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(formatPrice(it.vertical, g.best.price), style: tx(context, 14.5, w: FontWeight.w900, mono: true)),
            if (g.highest != null && g.highest! > g.best.price)
              Text('save ${formatPrice(it.vertical, g.highest! - g.best.price)}', style: tx(context, 9, w: FontWeight.w800, color: T1SColors.emerald600)),
          ]),
        ]),
        if (specs.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 7),
            child: Wrap(
              spacing: 6,
              runSpacing: 4,
              children: [for (final s in specs) Pill(s, bg: isDark(context) ? T1SColors.slate800 : T1SColors.slate50, fg: muted(context), size: 9)],
            ),
          ),
        const SizedBox(height: 7),
        Row(children: [
          Pill(g.rows.length > 1 ? 'Compare ${g.rows.length} sites' : g.best.site, fg: T1SColors.red, bg: T1SColors.red50, size: 9),
          const Spacer(),
          Text('Details', style: tx(context, 10, w: FontWeight.w800, color: muted(context))),
          Icon(Icons.expand_more_rounded, size: 15, color: muted(context)),
        ]),
      ]),
    );
  }

  void _expand(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (c) => Container(
        margin: const EdgeInsets.all(12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: surface(c), borderRadius: BorderRadius.circular(18), border: Border.all(color: border(c))),
        child: DraggableScrollableSheet(
          expand: false,
          initialChildSize: .5,
          builder: (c, sc) => ListView(controller: sc, children: [
            Text('Every site, cheapest first', style: tx(context, 14, w: FontWeight.w900)),
            const SizedBox(height: 6),
            Text('Same trip, real prices — we never adjust them.', style: tx(context, 10.5, color: muted(context))),
            const SizedBox(height: 12),
            _SiteRows(rows: g.rows, vertical: it.vertical),
          ]),
        ),
      ),
    );
  }

  CompareItem get it => g.lead;
}

// ---------------------------------------------------------------------------
// Hotel card (HotelDealCard)
// ---------------------------------------------------------------------------

class HotelCard extends StatelessWidget {
  const HotelCard({super.key, required this.g});
  final HotelGroup g;

  @override
  Widget build(BuildContext context) {
    return Box(
      padding: EdgeInsets.zero,
      clip: true,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Stack(children: [
          NetImage(g.image ?? g.gallery.firstOrNull, height: 130),
          Positioned.fill(child: DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.black.withValues(alpha: 0.55)])))),
          Positioned(
            left: 10,
            bottom: 8,
            right: 10,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(g.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 13.5, w: FontWeight.w900, color: Colors.white)),
              const SizedBox(height: 2),
              Row(children: [
                if (g.locality != null) ...[
                  Icon(Icons.location_on_rounded, size: 10, color: Colors.white70),
                  const SizedBox(width: 2),
                  Flexible(child: Text('${g.locality}${g.city.isNotEmpty ? ', ${g.city}' : ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 9.5, color: Colors.white70))),
                ],
              ]),
            ]),
          ),
          Positioned(
            top: 8,
            right: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.55), borderRadius: BorderRadius.circular(8)),
              child: Text('per night', style: tx(context, 9, w: FontWeight.w800, color: Colors.white)),
            ),
          ),
        ]),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              if (g.rating10 != null) ...[
                Pill('${g.rating10}/10', bg: T1SColors.emerald500.withValues(alpha: 0.15), fg: T1SColors.emerald600, icon: Icons.star_rounded, size: 9),
                const SizedBox(width: 6),
              ],
              if (g.ratingCount != null) Text('${g.ratingCount} reviews', style: tx(context, 9.5, color: muted(context))),
              const Spacer(),
              Text(formatPrice('hotels', g.best.price), style: tx(context, 16, w: FontWeight.w900, mono: true)),
            ]),
            if (g.amenities.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 7),
                child: Wrap(
                  spacing: 5,
                  runSpacing: 4,
                  children: [for (final a in g.amenities.take(5)) Pill(a, bg: isDark(context) ? T1SColors.slate800 : T1SColors.slate50, fg: muted(context), size: 8.5)],
                ),
              ),
            const SizedBox(height: 9),
            _SiteRows(rows: [for (final r in g.rows) OfferRow(r.item, r.site, r.price, true)], vertical: 'hotels'),
          ]),
        ),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// Credit card tile (CreditCardCard: big art, fees/rewards/APR)
// ---------------------------------------------------------------------------

class CreditCardTile extends StatelessWidget {
  const CreditCardTile({super.key, required this.g});
  final OfferGroup g;

  @override
  Widget build(BuildContext context) {
    final it = g.lead;
    final bank = it.spec('bank');
    final fees = [
      if (it.spec('joining fee').isNotEmpty) 'Join: ${it.spec('joining fee')}',
      if (it.spec('annual fee').isNotEmpty) 'Annual: ${it.spec('annual fee')}',
      if (it.spec('apr').isNotEmpty) 'APR ${it.spec('apr')}',
      if (it.spec('network').isNotEmpty) it.spec('network'),
    ];
    return Box(
      padding: EdgeInsets.zero,
      clip: true,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        NetImage(it.imageUrl, height: 170, fit: BoxFit.cover, fallbackIcon: Icons.credit_card_rounded),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              if (bank.isNotEmpty)
                Expanded(child: Text(bank, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 10.5, w: FontWeight.w800, color: muted(context))))
              else
                const Spacer(),
              if (it.rating > 0) Pill('${it.rating}★', fg: T1SColors.amber400, size: 9),
            ]),
            const SizedBox(height: 4),
            Text(it.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: tx(context, 13.5, w: FontWeight.w900)),
            if (fees.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Wrap(spacing: 5, runSpacing: 4, children: [for (final f in fees) Pill(f, bg: isDark(context) ? T1SColors.slate800 : T1SColors.slate50, fg: muted(context), size: 8.5)]),
              ),
            if (it.spec('reward rate text').isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(it.spec('reward rate text'), maxLines: 3, overflow: TextOverflow.ellipsis, style: tx(context, 10.5, color: muted(context), h: 1.35)),
              ),
            const SizedBox(height: 10),
            Row(children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(it.unit.isEmpty ? 'Annual fee' : it.unit, style: tx(context, 9, w: FontWeight.w700, color: muted(context))),
                Text(formatPrice('creditcards', g.best.price), style: tx(context, 15, w: FontWeight.w900, mono: true)),
              ]),
              const Spacer(),
              if (g.best.item.bestQuote?.url.isNotEmpty == true)
                GestureDetector(
                  onTap: () => openDeal(g.best.item.bestQuote!.url),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 9),
                    decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(10)),
                    child: Text('Apply Now', style: tx(context, 11.5, w: FontWeight.w900, color: Colors.white)),
                  ),
                ),
            ]),
            if (g.rows.length > 1) ...[
              const SizedBox(height: 10),
              Text('Also listed on:', style: tx(context, 9.5, w: FontWeight.w800, color: muted(context))),
              const SizedBox(height: 4),
              _SiteRows(rows: g.rows, vertical: 'creditcards'),
            ],
          ]),
        ),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// Standard group card (ecommerce / grocery / food / movies / loans / insurance)
// ---------------------------------------------------------------------------

class GroupCard extends StatelessWidget {
  const GroupCard({super.key, required this.g, required this.vertical});
  final OfferGroup g;
  final String vertical;

  @override
  Widget build(BuildContext context) {
    final it = g.lead;
    final isMovie = it.isMovie;
    final wide = vertical == 'loans' || vertical == 'insurance' || isMovie || vertical == 'food';
    return Box(
      padding: EdgeInsets.zero,
      clip: true,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          NetImage(it.imageUrl, width: isMovie ? 92 : 86, height: isMovie ? 128 : 86, fit: BoxFit.cover, fallbackIcon: Icons.shopping_bag_outlined),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(11),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(it.subtitle.isNotEmpty ? it.subtitle : it.provider, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 9.5, w: FontWeight.w800, color: muted(context)))),
                  if (it.rating > 0) Pill('${it.rating}★', fg: T1SColors.amber500, size: 9),
                ]),
                const SizedBox(height: 3),
                Text(it.title, maxLines: wide ? 3 : 2, overflow: TextOverflow.ellipsis, style: tx(context, 12.5, w: FontWeight.w800, h: 1.25)),
                const SizedBox(height: 6),
                Row(children: [
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if (it.isRate) ...[
                      Text('from', style: tx(context, 9, color: muted(context))),
                      Text(formatPrice(vertical, g.best.price), style: tx(context, 17, w: FontWeight.w900, mono: true)),
                      Text('interest p.a. (starting)', style: tx(context, 8.5, color: muted(context))),
                    ] else ...[
                      Text(g.best.priceAvailable ? formatPrice(vertical, g.best.price) : 'Price on site',
                          style: tx(context, 16.5, w: FontWeight.w900, mono: true, color: g.best.priceAvailable ? ink(context) : muted(context))),
                      if (it.unit.isNotEmpty) Text(it.unit, style: tx(context, 8.5, color: muted(context))),
                    ],
                  ]),
                  const Spacer(),
                  _ChipSpecs(it: it, vertical: vertical),
                ]),
              ]),
            ),
          ),
        ]),
        Padding(
          padding: const EdgeInsets.fromLTRB(11, 0, 11, 11),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (g.rows.length > 1) ...[
              Text('Compare ${g.rows.length} websites', style: tx(context, 10, w: FontWeight.w900, color: T1SColors.red)),
              const SizedBox(height: 4),
              _SiteRows(rows: g.rows.take(4).toList(), vertical: vertical),
              if (g.rows.length > 4)
                Padding(
                  padding: const EdgeInsets.only(top: 5),
                  child: Text('+${g.rows.length - 4} more sites', style: tx(context, 9.5, w: FontWeight.w800, color: muted(context))),
                ),
            ] else if (g.best.item.bestQuote != null && g.best.item.bestQuote!.url.isNotEmpty) ...[
              RedButton(
                it.isMovie ? 'Book tickets' : 'Buy on ${g.best.site}',
                onTap: () => openDeal(g.best.item.bestQuote!.url),
                trailing: Icons.open_in_new_rounded,
                dense: true,
              ),
            ],
            const SizedBox(height: 7),
            Row(children: [
              GestureDetector(
                onTap: () => showTrackSheet(
                  context,
                  title: it.title,
                  query: it.title,
                  vertical: vertical,
                  price: g.best.price,
                  image: it.imageUrl,
                  sourceUrl: g.best.item.bestQuote?.url,
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.notifications_active_outlined, size: 13, color: muted(context)),
                  const SizedBox(width: 4),
                  Text('Track price', style: tx(context, 10, w: FontWeight.w800, color: muted(context))),
                ]),
              ),
              const Spacer(),
              Pill('Live Verified', fg: T1SColors.emerald600, bg: T1SColors.emerald500.withValues(alpha: 0.12), icon: Icons.verified_rounded, size: 8.5),
            ]),
          ]),
        ),
      ]),
    );
  }
}

class _ChipSpecs extends StatelessWidget {
  const _ChipSpecs({required this.it, required this.vertical});
  final CompareItem it;
  final String vertical;

  @override
  Widget build(BuildContext context) {
    final chips = <String>[];
    switch (vertical) {
      case 'loans':
        for (final k in ['interest p.a.', 'emi', 'tenure', 'processing fee']) {
          final v = it.spec(k);
          if (v.isNotEmpty) chips.add(k == 'interest p.a.' ? '$v p.a.' : v);
        }
      case 'insurance':
        for (final k in ['cover', 'premium', 'claim settlement']) {
          final v = it.spec(k);
          if (v.isNotEmpty) chips.add(v);
        }
      case 'movie':
        for (final k in ['certification', 'language', 'shows today']) {
          final v = it.spec(k);
          if (v.isNotEmpty) chips.add(v);
        }
      case 'food':
        for (final k in ['restaurant', 'veg', 'delivery time']) {
          final v = it.spec(k);
          if (v.isNotEmpty) chips.add(k == 'veg' ? (v == 'true' ? 'Veg' : v) : v);
        }
      case 'grocery':
        for (final k in ['quantity', 'delivery time']) {
          final v = it.spec(k);
          if (v.isNotEmpty) chips.add(v);
        }
      default:
        for (final f in it.features.take(2)) {
          chips.add(f);
        }
    }
    if (chips.isEmpty) return const SizedBox.shrink();
    return Wrap(spacing: 4, runSpacing: 3, children: [
      for (final c in chips.take(2)) Pill(c, bg: isDark(context) ? T1SColors.slate800 : T1SColors.slate50, fg: muted(context), size: 8.5),
    ]);
  }
}
