import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/compare.dart';
import '../../core/theme.dart';
import 'lead_sheet.dart';
import 'redirect_sheet.dart';
import 'hotel_detail.dart';
import '../../core/verticals.dart';
import '../screens/compare_screen.dart' show showTrackSheet;
import '../screens/product_screen.dart';
import 'kit.dart';

/// Grouped result cards (one product = one card, every site's real price inside,
/// cheapest site first) mirroring the website's TravelDealRow / HotelDealCard /
/// CreditCardCard / ComparisonCard.

/// Ecom 'Compare' button (web parity, owner rule: every e-commerce card carries
/// one). Opens the in-app product detail page seeded with THIS card's own
/// sellerQuotes so 100% of found sellers + gallery images show immediately.
void _openComparePage(BuildContext context, {required CompareItem it, required OfferGroup g}) {
  final heroImage = it.imageUrl;
  final seed = <Map<String, Object?>>[
    for (final r in g.rows)
      if (r.item.bestQuote != null && r.item.bestQuote!.url.isNotEmpty && r.priceAvailable && r.price > 0)
        {
          'seller': r.site.isNotEmpty ? r.site : 'Seller',
          'title': it.title,
          'price': r.price,
          'listPrice': r.item.bestQuote!.originalPrice > 0 ? r.item.bestQuote!.originalPrice : 0,
          'image': heroImage != null && heroImage.startsWith('https://') ? heroImage : null,
          'url': r.item.bestQuote!.url,
        },
  ];
  Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => ProductScreen(input: it.title, seed: seed, gallery: it.images),
    ),
  );
}

class _CompareButton extends StatelessWidget {
  const _CompareButton({required this.it, required this.g, required this.label});
  final CompareItem it;
  final OfferGroup g;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 7),
      child: GestureDetector(
        onTap: () => _openComparePage(context, it: it, g: g),
        child: Container(
          height: 30,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            border: Border.all(color: T1SColors.red, width: 1.2),
            borderRadius: BorderRadius.circular(8),
            color: Colors.transparent,
          ),
          child: Text(label, style: tx(context, 10, w: FontWeight.w900, color: T1SColors.red)),
        ),
      ),
    );
  }
}

/// Owner 22 Oct: retail verticals (food, 10-min grocery, e-commerce) sell an
/// order, not a booking — every CTA that used to read 'Book' on those rows
/// now reads 'Order Now', matching the web buttons.
String ctaLabelFor(String vertical) {
  const retail = {'food', 'grocery', 'ecommerce'};
  return retail.contains(vertical) ? 'Order Now' : 'Book';
}

class _SiteRows extends StatelessWidget {
  const _SiteRows({required this.rows, required this.vertical});
  final List<OfferRow> rows;
  final String vertical;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < rows.length; i++)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: _SiteRow(
              row: rows[i],
              vertical: vertical,
              isBest: i == 0 && rows[i].priceAvailable,
            ),
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
    final sellerName = row.site.isNotEmpty ? row.site : 'Seller';
    final initial = sellerName.substring(0, 1).toUpperCase();

    return Row(
      children: [
        if (domain.isNotEmpty)
          SiteLogo(domain, size: 22)
        else
          Container(
            width: 22,
            height: 22,
            decoration: const BoxDecoration(
              color: T1SColors.red,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              initial,
              style: tx(context, 10, w: FontWeight.w900, color: Colors.white),
            ),
          ),
        const SizedBox(width: 8),
        Expanded(
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(text: sellerName, style: tx(context, 11.5, w: FontWeight.w800)),
                // Owner 22 Oct: cab rows must name the exact vehicle variant the
                // provider quoted — "Bharat Taxi · Swift Dzire ₹2,600" instead of
                // the same provider+price repeating with no visible difference.
                if (vertical == 'cab') ...[
                  if (cabVariantOf(row.item).isNotEmpty)
                    TextSpan(
                      text: ' · ${cabVariantOf(row.item)}',
                      style: tx(context, 10.5, w: FontWeight.w700, color: muted(context)),
                    ),
                ],
              ],
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (isBest) ...[
          const SizedBox(width: 6),
          Pill('BEST PRICE', bg: T1SColors.greenBg, fg: T1SColors.green, size: 8.5),
        ],
        const SizedBox(width: 8),
        // Owner 23 Oct: cab rows whose price is app-only (Uber/Rapido never
        // publish web fares) show the web-parity 'Fare on app' label instead of
        // a misleading 'Price on site' — the price exists, inside the provider
        // app (spec price_basis = app_only_fares, mirrors TravelDealRow.tsx).
        Builder(builder: (context) {
          final appOnlyFares =
              vertical == 'cab' && row.item.spec('price basis', 'price_basis') == 'app_only_fares';
          return Text(
            !appOnlyFares && row.priceAvailable
                ? formatPrice(vertical, row.price)
                : appOnlyFares
                    ? 'Fare on app'
                    : 'Price on site',
            style: tx(
              context,
              appOnlyFares ? 10.5 : 12.5,
              w: FontWeight.w900,
              color: appOnlyFares || !row.priceAvailable ? muted(context) : ink(context),
              mono: !appOnlyFares,
            ),
          );
        }),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: row.item.bestQuote != null &&
                  (row.item.bestQuote!.url.isNotEmpty || (row.item.appBookUrl ?? '').isNotEmpty)
              ? () => _openRedirect(
                  context,
                  sellerName: sellerName,
                  title: row.item.title,
                  goUrl: row.item.bestQuote!.url,
                  appBookUrl: row.item.appBookUrl,
                  price: row.priceAvailable ? row.price : null,
                  image: row.item.imageUrl,
                  isLowest: isBest,
                  vertical: row.item.vertical,
                )
              : null,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(8)),
            child: Text(ctaLabelFor(vertical), style: tx(context, 10, w: FontWeight.w900, color: Colors.white)),
          ),
        ),
      ],
    );
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
    'Xiaomi': 'mi.com',
    'Oppo': 'oppo.com',
    'Realme': 'realme.com',
    'Lenovo': 'lenovo.com',
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
    // Owner 17 Oct: sellers whose logos were missing/blank in the app.
    'TravelGuru': 'travelguru.com',
    'SaffronStays': 'saffronstays.com',
    'Kiwi': 'kiwi.com',
    'Expedia': 'expedia.com',
    'Via': 'via.com',
    'OYO': 'oyorooms.com',
    'Treebo': 'treebo.com',
    'Zingbus': 'zingbus.com',
    'InDrive': 'indrive.com',
    'QuickRide': 'quickride.in',
    'Rapido': 'rapido.bike',
    'Meru': 'meru.in',
    'Ditto': 'dittoinsurance.com',
    'InsuranceDekho': 'insurancedekho.com',
    'Coverfox': 'coverfox.com',
    'Acko': 'acko.com',
    'Digit': 'godigit.com',
    'KreditBee': 'kreditbee.in',
    'Navi': 'navi.com',
    'Nykaa': 'nykaa.com',
    'Snapdeal': 'snapdeal.com',
    'JioMart': 'jiomart.com',
    'Pizza Hut': 'pizzahut.co.in',
    'Oven Story': 'ovenstorypizzas.com',
    'EatSure': 'eatsure.com',
    'Air India': 'airindia.in',
    'SpiceJet': 'spicejet.com',
    'Vistara': 'airvistara.com',
  };
  for (final e in map.entries) {
    if (site.toLowerCase().contains(e.key.toLowerCase())) return e.value;
  }
  return '';
}


/// Finance verticals (loans / insurance / creditcards / account): the web card
/// ALWAYS shows the CTA when a quote exists — the lead form captures the
/// enquiry server-side even when the partner exposes no direct deep-link
/// (owner 22 Oct: "button ni aata jiss pr click kr ke form fill kr ke
/// redirect ho sake jaise web pr ho raha hai").
const kFinanceVerticals = ['loans', 'insurance', 'creditcards', 'account'];

bool _isFinance(String vertical) => kFinanceVerticals.contains(vertical);

/// Owner 22 Oct: web-parity CTA labels (ComparisonCard.tsx).
String _financeCtaLabel(String vertical, String sellerName) {
  switch (vertical) {
    case 'loans':
      return 'Check Eligibility & Match';
    case 'insurance':
      return 'Instant Policy Match';
    default:
      return 'Apply on $sellerName';
  }
}

/// Web-parity logo gate for finance tiles (ComparisonCard.tsx): the tile shows
/// the LENDER's logo, and aggregator favicons (bankbazaar/paisabazaar/
/// policybazaar) are never shown as a brand — the tile falls back to crisp
/// brand initials instead of a blurry wrong-logo icon.
final _aggregatorLogoRe = RegExp(r'bankbazaar|paisabazaar|policybazaar', caseSensitive: false);

String? _financeTileLogo(String? imageUrl) {
  final u = (imageUrl ?? '').trim();
  if (u.isEmpty) return null;
  return _aggregatorLogoRe.hasMatch(u) ? null : u;
}

/// Brand initials for the finance tile, exactly like the web tile's fallback
/// (brandLogo.ts initials()): 'Star Health health insurance' -> 'SH'.
String _brandInitials(String title, {String? provider}) {
  final cleaned = title
      .replaceAll(RegExp(r'(personal|home|car|auto|business|gold|education|two[- ]wheeler|used car|property|loan|loans|insurance|health|term|life|motor|travel|savings|current|demat|trading|zero[- ]balance|account)s?', caseSensitive: false), ' ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
  final src = cleaned.isNotEmpty ? cleaned : (provider ?? '');
  final parts = src.replaceAll(RegExp(r'[^A-Za-z0-9 ]'), ' ').split(RegExp(r'\s+')).where((x) => x.isNotEmpty).toList();
  if (parts.isEmpty) return '1S';
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].substring(0, parts[0].length >= 2 ? 2 : 1).toUpperCase();
}

/// White-tile finance logo with web parity: lender logo when the URL is the
/// lender's own, crisp brand initials when it is an aggregator favicon/none.
class FinanceLogoTile extends StatelessWidget {
  const FinanceLogoTile({super.key, required this.imageUrl, required this.title, this.provider, this.size = 88});
  final String? imageUrl;
  final String title;
  final String? provider;
  final double size;

  @override
  Widget build(BuildContext context) {
    final logo = _financeTileLogo(imageUrl);
    final b = Border.all(color: border(context));
    if (logo != null) {
      return Container(
        width: size, height: size,
        decoration: BoxDecoration(color: Colors.white, border: b),
        child: Center(
          child: NetImage(logo, fit: BoxFit.contain, width: size - 16, height: size - 16, bg: Colors.white),
        ),
      );
    }
    return Container(
      width: size, height: size,
      decoration: BoxDecoration(color: Colors.white, border: b),
      alignment: Alignment.center,
      child: Text(
        _brandInitials(title, provider: provider),
        style: tx(context, 26, w: FontWeight.w900, color: const Color(0xFF334155)),
      ),
    );
  }
}

/// Every Book/Buy tap first opens the redirect sheet: it confirms the direct
/// price and surfaces the seller's real best offer/coupon before leaving.
void _openRedirect(
  BuildContext context, {
  required String sellerName,
  required String title,
  required String goUrl,
  double? price,
  String? image,
  bool isLowest = false,
  bool appOnly = false,
  String vertical = '',
  String? appBookUrl,
}) {
  // Owner 22 Oct: Uber/Ola cab rows open the provider's OWN app with the trip
  // prefilled, so the user sees the real in-app fare and books directly there.
  // The link routes through /api/cab/book -> /api/out server-side: the admin-
  // configured affiliate params are injected and the click tracked there.
  if (appBookUrl != null && appBookUrl.isNotEmpty) {
    launchUrl(Uri.parse(appBookUrl), mode: LaunchMode.externalApplication);
    return;
  }

  // Owner 21 Oct: finance verticals capture the lead FIRST (server-persisted,
  // MySQL) and hand off to the partner after submission — website parity.
  if (const ['loans', 'insurance', 'creditcards', 'account'].contains(vertical)) {
    showLeadSheet(
      context,
      vertical: vertical,
      serviceType: title,
      sellerName: sellerName,
      goUrl: goUrl,
    );
    return;
  }
  showRedirectSheet(
    context,
    sellerName: sellerName,
    title: title,
    goUrl: goUrl,
    price: price,
    image: image,
    isLowest: isLowest,
    appOnly: appOnly,
  );
}

// ---------------------------------------------------------------------------
// Travel card (flights / bus / cab) — compact row card with cab support
// ---------------------------------------------------------------------------

class TravelTile extends StatelessWidget {
  const TravelTile({super.key, required this.g, required this.meta});
  final OfferGroup g;
  final VerticalMeta meta;

  CompareItem get it => g.lead;

  @override
  Widget build(BuildContext context) {
    final isCab = meta.id == 'cab' || it.vertical == 'cab';
    var durMin = (double.tryParse(it.spec('duration minutes')) ?? 0).round();
    // Owner bug 21 Oct (bus timings missing): mirror the web's fallbacks —
    // 1) '~06:00:00 h' style duration strings parse into minutes;
    final durStr = it.spec('duration');
    if (durMin == 0 && durStr.isNotEmpty) {
      final m = RegExp(r'(\d{1,2}):(\d{2})(?::(\d{2}))?').firstMatch(durStr);
      if (m != null) durMin = (int.tryParse(m.group(1)!) ?? 0) * 60 + (int.tryParse(m.group(2)!) ?? 0);
    }
    // 2) 'departure time' missing an arrival falls back to the 'departure' range
    //    ('02:30 AM → 08:30 AM' → dep 02:30, arr 08:30) exactly like the web card.
    var depTime = it.spec('departure time');
    var arrTime = it.spec('arrival time');
    if (depTime.isNotEmpty && arrTime.isEmpty) {
      final range = it.spec('departure');
      final arrow = range.contains('→') ? range.split('→') : null;
      if (arrow != null && arrow.length == 2) {
        String hhmm(String v) {
          final m = RegExp(r'(\d{1,2}):(\d{2})').firstMatch(v);
          return m == null ? v : '${m.group(1)!.padLeft(2, '0')}:${m.group(2)}';
        }
        depTime = hhmm(arrow[0]);
        arrTime = hhmm(arrow[1]);
      }
    }

    // Spec pills for cab and general travel
    final vehicleType = it.spec('vehicle type').isNotEmpty ? it.spec('vehicle type') : it.spec('vehicle_type');
    // Web parity (22 Oct): bus rows publish 'seats available' (underscore attrs are
    // space-normalized server-side) — check that key first, then generic fallbacks.
    final seats = it.spec('seats available', 'seats', 'capacity');
    final tripType = it.spec('trip type').isNotEmpty ? it.spec('trip type') : (it.spec('trip_type').isNotEmpty ? it.spec('trip_type') : '');

    // Owner 17 Oct: airline name visible on flight cards alongside the seller website.
    final airline = it.spec('airline');
    final specs = [
      if (airline.isNotEmpty) airline,
      if (it.spec('flight number').isNotEmpty) it.spec('flight number'),
      if (durMin > 0) durMin < 60 ? '$durMin m' : '${durMin ~/ 60}h ${durMin % 60}m',
      if (depTime.isNotEmpty) '$depTime → $arrTime',
      if (it.spec('stops').isNotEmpty) (it.spec('stops') == '0' ? 'Non-stop' : '${it.spec('stops')} stop'),
      if (it.spec('operator').isNotEmpty) it.spec('operator'),
      if (vehicleType.isNotEmpty) vehicleType,
      if (seats.isNotEmpty) (seats.contains('Seat') ? seats : '$seats Seats'),
      if (tripType.isNotEmpty) tripType,
      if (it.spec('bus type').isNotEmpty) it.spec('bus type'),
      if (it.spec('fuel type').isNotEmpty) it.spec('fuel type'),
      if (it.spec('inclusion').isNotEmpty) it.spec('inclusion'),
    ];

    final fallbackIcon = isCab ? Icons.local_taxi_rounded : (meta.id == 'bus' ? Icons.directions_bus_rounded : Icons.flight_rounded);
    final sellerName = g.best.site.isNotEmpty ? g.best.site : 'Seller';
    final domain = _domainOf(sellerName);

    return Box(
      padding: const EdgeInsets.all(12),
      radius: 16,
      shadow: true,
      onTap: () => _expand(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: border(context)),
                ),
                child: NetImage(
                  it.imageUrl,
                  width: 36,
                  height: 36,
                  radius: 9,
                  fit: BoxFit.cover,
                  fallbackIcon: fallbackIcon,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      it.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tx(context, 13, w: FontWeight.w900),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        if (domain.isNotEmpty)
                          SiteLogo(domain, size: 14)
                        else
                          Icon(Icons.storefront_rounded, size: 14, color: muted(context)),
                        const SizedBox(width: 4),
                        Text(
                          sellerName,
                          style: tx(context, 10.5, w: FontWeight.w700, color: muted(context)),
                        ),
                        const SizedBox(width: 6),
                        Pill('BEST PRICE', bg: T1SColors.greenBg, fg: T1SColors.green, size: 8),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    formatPrice(it.vertical, g.best.price),
                    style: tx(context, 15, w: FontWeight.w900, mono: true),
                  ),
                  if (g.highest != null && g.highest! > g.best.price)
                    Text(
                      'save ${formatPrice(it.vertical, g.highest! - g.best.price)}',
                      style: tx(context, 9, w: FontWeight.w800, color: T1SColors.emerald600),
                    ),
                ],
              ),
            ],
          ),
          if (specs.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Wrap(
                spacing: 6,
                runSpacing: 4,
                children: [
                  for (final s in specs)
                    Pill(
                      s,
                      bg: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                      fg: muted(context),
                      size: 9,
                    ),
                ],
              ),
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              Pill(
                g.rows.length > 1 ? 'Compare ${g.rows.length} sites' : 'Available now',
                fg: T1SColors.red,
                bg: T1SColors.red50,
                size: 9,
              ),
              const Spacer(),
              if (g.best.item.bestQuote?.url.isNotEmpty == true || (g.best.item.appBookUrl ?? '').isNotEmpty)
                GestureDetector(
                  onTap: () => _openRedirect(
                    context,
                    sellerName: sellerName,
                    title: g.best.item.title,
                    goUrl: g.best.item.bestQuote?.url ?? '',
                    appBookUrl: g.best.item.appBookUrl,
                    vertical: g.best.item.vertical,
                    price: g.best.priceAvailable ? g.best.price : null,
                    image: g.best.item.imageUrl,
                    isLowest: true,
                    appOnly: (g.best.item.bestQuote?.badge ?? '').toLowerCase().contains('app'),
                  ),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: T1SColors.red,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      ctaLabelFor(g.best.item.vertical),
                      style: tx(context, 10, w: FontWeight.w900, color: Colors.white),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
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
        decoration: BoxDecoration(
          color: surface(c),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: border(c)),
        ),
        child: DraggableScrollableSheet(
          expand: false,
          initialChildSize: .5,
          builder: (c, sc) => ListView(
            controller: sc,
            children: [
              Text('Every site, cheapest first', style: tx(context, 14, w: FontWeight.w900)),
              const SizedBox(height: 6),
              Text('Same trip, real prices — we never adjust them.', style: tx(context, 10.5, color: muted(context))),
              const SizedBox(height: 12),
              _SiteRows(rows: g.rows, vertical: it.vertical),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Hotel card (HotelDealCard)
// ---------------------------------------------------------------------------

class HotelCard extends StatelessWidget {
  const HotelCard({super.key, required this.g});
  final HotelGroup g;

  // Owner 22 Oct reference design: full-width photo header with a white photo
  // count badge, heart button and carousel dots; below it a clean info block
  // (title, Details & photos link, location, rating chip), a per-seller price
  // table, and a bottom bar with the savings capsule, best price and the big
  // orange View Deal button.
  @override
  Widget build(BuildContext context) {
    final bestSeller = g.best.site.isNotEmpty ? g.best.site : 'Hotel Partner';
    final sorted = [...g.rows]..sort((a, b) => a.price.compareTo(b.price));
    // Honest savings capsule: only when a second real seller price exists and
    // the best one is genuinely cheaper (never fabricate a percentage).
    int? savingsPct;
    if (sorted.length > 1 && sorted[0].price > 0 && sorted[1].price > sorted[0].price) {
      savingsPct = (((sorted[1].price - sorted[0].price) / sorted[1].price) * 100).round();
    }
    final dotCount = g.gallery.length.clamp(2, 5);

    return Box(
      padding: EdgeInsets.zero,
      radius: 16,
      shadow: true,
      clip: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // -- photo header ---------------------------------------------------
          GestureDetector(
            onTap: () => showHotelDetail(context, g),
            // Owner 23 Oct fix: StackFit.expand — portrait photos used to size
            // to their intrinsic aspect (a narrow ~25% column at the left)
            // leaving blank space to the right of the photo header.
            child: Stack(
              fit: StackFit.expand,
              children: [
                NetImage(g.image ?? g.gallery.firstOrNull, height: 155, fallbackIcon: Icons.hotel_rounded),
                // Top-left: white photo-count badge (reference image)
                Positioned(
                  top: 8,
                  left: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.photo_library_rounded, size: 11, color: Color(0xFF2C3E50)),
                        const SizedBox(width: 3),
                        Text(
                          g.gallery.isNotEmpty ? '${g.gallery.length}' : '',
                          style: tx(context, 10.5, w: FontWeight.w900, color: const Color(0xFF2C3E50)),
                        ),
                      ],
                    ),
                  ),
                ),
                // Top-right: heart in a white circle -> opens the full gallery
                Positioned(
                  top: 8,
                  right: 8,
                  child: GestureDetector(
                    onTap: () => showHotelDetail(context, g),
                    child: Container(
                      width: 30,
                      height: 30,
                      decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                      child: const Icon(Icons.favorite_rounded, size: 15, color: Color(0xFFE11D48)),
                    ),
                  ),
                ),
                // Bottom-right: TOP RATED ribbon (only when honestly earned)
                if ((g.rating10 ?? 0) >= 8.5)
                  Positioned(
                    right: 8,
                    bottom: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: T1SColors.red,
                        borderRadius: BorderRadius.circular(3),
                      ),
                      child: Text('TOP RATED', style: tx(context, 8, w: FontWeight.w900, color: Colors.white, ls: 0.6)),
                    ),
                  ),
                // Bottom-center: carousel dots
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 8,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      for (var i = 0; i < dotCount; i++) ...[
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: i == 0 ? Colors.white : Colors.white.withValues(alpha: 0.55),
                            shape: BoxShape.circle,
                          ),
                        ),
                        if (i < dotCount - 1) const SizedBox(width: 5),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          // -- info block -----------------------------------------------------
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 11, 12, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  g.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: tx(context, 13.5, w: FontWeight.w900, color: ink(context)),
                ),
                const SizedBox(height: 5),
                // Details & photos link (orange, opens the lightbox gallery)
                GestureDetector(
                  onTap: () => showHotelDetail(context, g),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.image_rounded, size: 11, color: Color(0xFFE67E22)),
                      const SizedBox(width: 3),
                      Text(
                        'Details & photos${g.gallery.isNotEmpty ? ' (${g.gallery.length})' : ''}',
                        style: tx(context, 10, w: FontWeight.w800, color: const Color(0xFFE67E22)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 5),
                Row(
                  children: [
                    Icon(Icons.location_on_rounded, size: 11, color: muted(context)),
                    const SizedBox(width: 2),
                    Expanded(
                      child: Text(
                        [g.locality, g.city].whereType<String>().where((x) => x.isNotEmpty).join(', '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: tx(context, 10, color: muted(context)),
                      ),
                    ),
                  ],
                ),
                if (g.rating10 != null) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                        decoration: BoxDecoration(
                          color: const Color(0xFF27AE60),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          g.rating10!.toStringAsFixed(1),
                          style: tx(context, 10.5, w: FontWeight.w900, color: Colors.white),
                        ),
                      ),
                      const SizedBox(width: 6),
                      if (g.ratingCount != null)
                        Text('(${g.ratingCount})', style: tx(context, 10, w: FontWeight.w600, color: muted(context))),
                    ],
                  ),
                ],
              ],
            ),
          ),
          // -- per-seller price table ----------------------------------------
          Container(
            margin: const EdgeInsets.fromLTRB(12, 10, 12, 0),
            decoration: BoxDecoration(
              color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                for (var i = 0; i < sorted.length && i < 4; i++)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
                    child: _SellerPriceRow(
                      row: sorted[i],
                      isBest: i == 0,
                      isLast: i == (sorted.length.clamp(0, 4) - 1),
                    ),
                  ),
                if (sorted.length > 4)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 7),
                    child: Text('+${sorted.length - 4} more sites', style: tx(context, 9, w: FontWeight.w800, color: muted(context))),
                  ),
              ],
            ),
          ),
          // -- bottom action bar ---------------------------------------------
          Container(
            margin: const EdgeInsets.fromLTRB(12, 10, 12, 12),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
            decoration: BoxDecoration(
              color: const Color(0xFFD4EFDF),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (savingsPct != null && savingsPct > 0)
                        Text(
                          '$savingsPct% less than other sites',
                          style: tx(context, 9, w: FontWeight.w900, color: const Color(0xFF1E8449)),
                        ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          if ((g.best.item.bestQuote?.sourceDomain ?? '').isNotEmpty) ...[
                            SiteLogo(g.best.item.bestQuote!.sourceDomain ?? '', size: 14),
                            const SizedBox(width: 4),
                          ],
                          Text(
                            '${formatPrice('hotels', g.best.price)} ',
                            style: tx(context, 15, w: FontWeight.w900, color: ink(context), mono: true),
                          ),
                          Text('per night', style: tx(context, 9, color: muted(context))),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                // View Deal: big orange CTA (reference image #F39C12)
                GestureDetector(
                  onTap: (g.best.item.bestQuote?.url.isNotEmpty == true || (g.best.item.appBookUrl ?? '').isNotEmpty)
                      ? () => _openRedirect(
                          context,
                          sellerName: bestSeller,
                          title: g.best.item.title,
                          goUrl: g.best.item.bestQuote?.url ?? '',
                          appBookUrl: g.best.item.appBookUrl,
                          vertical: g.best.item.vertical,
                          price: g.best.price > 0 ? g.best.price : null,
                          image: g.best.item.imageUrl,
                          isLowest: true,
                          appOnly: (g.best.item.bestQuote?.badge ?? '').toLowerCase().contains('app'),
                        )
                      : () => showHotelDetail(context, g),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF39C12),
                      borderRadius: BorderRadius.circular(11),
                    ),
                    child: Row(
                      children: [
                        Text('View Deal', style: tx(context, 11.5, w: FontWeight.w900, color: Colors.white)),
                        const SizedBox(width: 4),
                        const Icon(Icons.arrow_forward_rounded, size: 13, color: Colors.white),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// One row of the hotel price table (reference design): seller logo + name,
/// "Standard rate" on the right of the name, price on the far right — green
/// for the cheapest seller, ink for the rest. The whole row exits to that
/// seller's site, same as the old per-row Book button.
class _SellerPriceRow extends StatelessWidget {
  const _SellerPriceRow({required this.row, required this.isBest, required this.isLast});
  final HotelRow row;
  final bool isBest;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final domain = row.item.bestQuote?.sourceDomain ?? '';
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: (row.item.bestQuote?.url.isNotEmpty == true || (row.item.appBookUrl ?? '').isNotEmpty)
          ? () => _openRedirect(
              context,
              sellerName: row.site,
              title: row.item.title,
              goUrl: row.item.bestQuote?.url ?? '',
              appBookUrl: row.item.appBookUrl,
              vertical: row.item.vertical,
              price: row.price > 0 ? row.price : null,
              image: row.item.imageUrl,
              isLowest: isBest,
            )
          : null,
      child: Column(
        children: [
          Row(
            children: [
              if (domain.isNotEmpty) SiteLogo(domain, size: 20),
              if (domain.isNotEmpty) const SizedBox(width: 7),
              Text(row.site, style: tx(context, 11, w: FontWeight.w800, color: ink(context))),
              const SizedBox(width: 6),
              Expanded(
                child: Text('Standard rate', maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 9.5, color: muted(context))),
              ),
              Text(
                row.price > 0 ? formatPrice('hotels', row.price) : 'Price on site',
                style: tx(
                  context,
                  12.5,
                  w: FontWeight.w900,
                  color: row.price > 0 && isBest ? const Color(0xFF27AE60) : ink(context),
                  mono: true,
                ),
              ),
            ],
          ),
          if (!isLast) Divider(height: 12, color: isDark(context) ? T1SColors.slate700 : T1SColors.slate200),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Credit card tile
// ---------------------------------------------------------------------------

class CreditCardTile extends StatelessWidget {
  const CreditCardTile({super.key, required this.g});
  final OfferGroup g;

  @override
  Widget build(BuildContext context) {
    final it = g.lead;
    final bank = it.spec('bank');
    final sellerName = g.best.site.isNotEmpty ? g.best.site : bank;
    final fees = [
      if (it.spec('joining fee').isNotEmpty) 'Join: ${it.spec('joining fee')}',
      if (it.spec('annual fee').isNotEmpty) 'Annual: ${it.spec('annual fee')}',
      if (it.spec('apr').isNotEmpty) 'APR ${it.spec('apr')}',
      if (it.spec('network').isNotEmpty) it.spec('network'),
    ];

    return Box(
      padding: EdgeInsets.zero,
      radius: 16,
      shadow: true,
      clip: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: border(context))),
            ),
            child: NetImage(it.imageUrl, height: 170, fit: BoxFit.cover, fallbackIcon: Icons.credit_card_rounded),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    if (bank.isNotEmpty)
                      Expanded(
                        child: Text(
                          bank,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: tx(context, 10.5, w: FontWeight.w800, color: muted(context)),
                        ),
                      )
                    else
                      const Spacer(),
                    if (it.rating > 0) Pill('${it.rating}★', fg: T1SColors.amber400, size: 9),
                  ],
                ),
                const SizedBox(height: 4),
                Text(it.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: tx(context, 13.5, w: FontWeight.w900)),
                if (fees.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Wrap(
                      spacing: 5,
                      runSpacing: 4,
                      children: [
                        for (final f in fees)
                          Pill(
                            f,
                            bg: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                            fg: muted(context),
                            size: 8.5,
                          ),
                      ],
                    ),
                  ),
                if (it.spec('reward rate text').isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      it.spec('reward rate text'),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: tx(context, 10.5, color: muted(context), h: 1.35),
                    ),
                  ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(it.unit.isEmpty ? 'Annual fee' : it.unit, style: tx(context, 9, w: FontWeight.w700, color: muted(context))),
                        Text(formatPrice('creditcards', g.best.price), style: tx(context, 15, w: FontWeight.w900, mono: true)),
                      ],
                    ),
                    const Spacer(),
                    if (g.best.item.bestQuote != null)
                      GestureDetector(
                        onTap: () => _openRedirect(
                    context,
                    sellerName: sellerName,
                    title: g.best.item.title,
                    goUrl: g.best.item.bestQuote!.url,
                    appBookUrl: g.best.item.appBookUrl,
                    vertical: g.best.item.vertical,
                    price: g.best.price > 0 ? g.best.price : null,
                    image: g.best.item.imageUrl,
                    isLowest: true,
                    appOnly: (g.best.item.bestQuote?.badge ?? '').toLowerCase().contains('app'),
                  ),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(10)),
                          child: Text('Apply on $sellerName', style: tx(context, 11, w: FontWeight.w900, color: Colors.white)),
                        ),
                      ),
                  ],
                ),
                if (g.rows.length > 1) ...[
                  const SizedBox(height: 10),
                  Text('Also listed on:', style: tx(context, 9.5, w: FontWeight.w800, color: muted(context))),
                  const SizedBox(height: 4),
                  _SiteRows(rows: g.rows, vertical: 'creditcards'),
                ],
              ],
            ),
          ),
        ],
      ),
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

  IconData _fallbackIconForVertical(String v) {
    switch (v) {
      case 'grocery':
        return Icons.shopping_basket_outlined;
      case 'food':
        return Icons.fastfood_outlined;
      case 'movie':
      case 'movies':
        return Icons.movie_outlined;
      case 'loans':
        return Icons.account_balance_outlined;
      case 'insurance':
        return Icons.health_and_safety_outlined;
      default:
        return Icons.shopping_bag_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final it = g.lead;
    final isMovie = it.isMovie;
    final wide = vertical == 'loans' || vertical == 'insurance' || isMovie || vertical == 'food';
    final fallbackIcon = _fallbackIconForVertical(vertical);
    final sellerName = g.best.site.isNotEmpty ? g.best.site : (it.provider.isNotEmpty ? it.provider : 'Seller');
    final domain = _domainOf(sellerName);

    return Box(
      padding: EdgeInsets.zero,
      radius: 16,
      shadow: true,
      clip: true,
      onTap: g.best.item.bestQuote != null &&
              (g.best.item.bestQuote!.url.isNotEmpty || _isFinance(vertical))
          ? () => _openRedirect(
              context,
              sellerName: sellerName,
              title: g.best.item.title,
              goUrl: g.best.item.bestQuote!.url,
              appBookUrl: g.best.item.appBookUrl,
                    vertical: g.best.item.vertical,
              price: g.best.priceAvailable ? g.best.price : null,
              image: g.best.item.imageUrl,
              isLowest: true,
            )
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                decoration: BoxDecoration(
                  border: Border(right: BorderSide(color: border(context))),
                ),
                child: _isFinance(vertical)
                    ? FinanceLogoTile(imageUrl: it.imageUrl, title: it.title, provider: it.provider)
                    : NetImage(
                  it.imageUrl,
                  width: isMovie ? 92 : 88,
                  height: isMovie ? 128 : 88,
                  fit: BoxFit.cover,
                  fallbackIcon: fallbackIcon,
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(11),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          if (domain.isNotEmpty)
                            SiteLogo(domain, size: 16)
                          else
                            Icon(Icons.storefront_outlined, size: 16, color: muted(context)),
                          const SizedBox(width: 5),
                          Expanded(
                            child: Text(
                              sellerName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: tx(context, 10, w: FontWeight.w800, color: muted(context)),
                            ),
                          ),
                          if (it.rating > 0) Pill('${it.rating}★', fg: T1SColors.amber500, size: 9),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        it.title,
                        maxLines: wide ? 3 : 2,
                        overflow: TextOverflow.ellipsis,
                        style: tx(context, 12.5, w: FontWeight.w800, h: 1.25),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (it.isRate) ...[
                                Text('from', style: tx(context, 9, color: muted(context))),
                                Text(formatPrice(vertical, g.best.price), style: tx(context, 16.5, w: FontWeight.w900, mono: true)),
                                Text(
                                  it.unit.isNotEmpty && it.vertical == 'account' ? it.unit : 'interest p.a. (starting)',
                                  style: tx(context, 8.5, color: muted(context)),
                                ),
                              ] else ...[
                                Row(
                                  children: [
                                    Text(
                                      g.best.priceAvailable ? formatPrice(vertical, g.best.price) : 'Price on site',
                                      style: tx(
                                        context,
                                        16,
                                        w: FontWeight.w900,
                                        mono: true,
                                        color: g.best.priceAvailable ? ink(context) : muted(context),
                                      ),
                                    ),
                                    if (g.best.priceAvailable) ...[
                                      const SizedBox(width: 6),
                                      Pill('BEST PRICE', bg: T1SColors.greenBg, fg: T1SColors.green, size: 8),
                                    ],
                                  ],
                                ),
                                if (it.unit.isNotEmpty) Text(it.unit, style: tx(context, 8.5, color: muted(context))),
                              ],
                            ],
                          ),
                          const Spacer(),
                          _ChipSpecs(it: it, vertical: vertical),
                        ],
                      ),
                      if (it.isMovie) _MovieShowtimes(raw: it.spec('showtimes')),
                    ],
                  ),
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(11, 0, 11, 11),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (vertical == 'ecommerce')
                  _CompareButton(
                    it: it,
                    g: g,
                    label: g.rows.length > 1 ? 'Compare ${g.rows.length} sites' : 'Compare prices',
                  ),
                if (g.rows.length > 1 && vertical != 'ecommerce') ...[
                  Text('Compare ${g.rows.length} websites', style: tx(context, 10, w: FontWeight.w900, color: T1SColors.red)),
                  const SizedBox(height: 4),
                  _SiteRows(rows: g.rows.take(4).toList(), vertical: vertical),
                  if (g.rows.length > 4)
                    Padding(
                      padding: const EdgeInsets.only(top: 5),
                      child: Text('+${g.rows.length - 4} more sites', style: tx(context, 9.5, w: FontWeight.w800, color: muted(context))),
                    ),
                ] else if (g.best.item.bestQuote == null) ...[
                  const SizedBox.shrink(),
                ] else if (!_isFinance(vertical) && g.best.item.bestQuote!.url.isEmpty) ...[
                  const SizedBox.shrink(),
                ] else ...[
                  RedButton(
                    it.isMovie
                        ? 'Book tickets on $sellerName'
                        : _isFinance(vertical)
                            ? _financeCtaLabel(vertical, sellerName)
                            : ctaLabelFor(vertical),
                    onTap: () => _openRedirect(
                    context,
                    sellerName: sellerName,
                    title: g.best.item.title,
                    goUrl: g.best.item.bestQuote!.url,
                    vertical: g.best.item.vertical,
                    price: g.best.price > 0 ? g.best.price : null,
                    image: g.best.item.imageUrl,
                    isLowest: true,
                    appOnly: (g.best.item.bestQuote?.badge ?? '').toLowerCase().contains('app'),
                  ),
                    trailing: Icons.open_in_new_rounded,
                    dense: true,
                  ),
                ],
                // Finance multi-row cards keep the seller table AND get the web-parity
                // CTA below it: the lead form opens even without a deep-link (22 Oct).
                if (_isFinance(vertical) && g.rows.length > 1 && g.best.item.bestQuote != null) ...[
                  const SizedBox(height: 8),
                  RedButton(
                    _financeCtaLabel(vertical, sellerName),
                    onTap: () => _openRedirect(
                      context,
                      sellerName: sellerName,
                      title: g.best.item.title,
                      goUrl: g.best.item.bestQuote!.url,
                      vertical: g.best.item.vertical,
                      price: g.best.price > 0 ? g.best.price : null,
                      image: g.best.item.imageUrl,
                      isLowest: true,
                    ),
                    trailing: Icons.open_in_new_rounded,
                    dense: true,
                  ),
                ],
                const SizedBox(height: 7),
                Row(
                  children: [
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
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.notifications_active_outlined, size: 13, color: muted(context)),
                          const SizedBox(width: 4),
                          Text('Track price', style: tx(context, 10, w: FontWeight.w800, color: muted(context))),
                        ],
                      ),
                    ),
                    // Smart Cart (owner rule): add this product to the basket.
                    if (vertical == 'grocery') ...[
                      const SizedBox(width: 12),
                      GestureDetector(
                        onTap: () {
                          AppState.instance.addToSmartCart(it.title);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Added to Smart Cart \u2014 ${AppState.instance.smartCart.length} item\u2026'),
                              duration: const Duration(milliseconds: 1400),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            border: Border.all(color: ink(context), width: 1.4),
                            borderRadius: BorderRadius.circular(9),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.add_shopping_cart_rounded, size: 13, color: ink(context)),
                              const SizedBox(width: 4),
                              Text('Cart', style: tx(context, 10, w: FontWeight.w900, color: ink(context))),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Movies (owner 22 Oct): per-showtime seat-class prices on the card.
/// specs['showtimes'] = [{"time","theatre","areas":[{"label","price"}]}]
/// from the District/TicketNew live sessions. District publishes ISO times
/// ("2026-10-23T06:30") — shown as a 12h clock; any other raw text passes through.
class _MovieShowtimes extends StatelessWidget {
  final String raw;
  const _MovieShowtimes({required this.raw});

  String _fmt(Object? t) {
    final s = '$t';
    final m = RegExp(r'^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})').firstMatch(s);
    if (m == null) return s;
    final h = int.parse(m.group(1)!);
    final ap = h >= 12 ? 'PM' : 'AM';
    final h12 = h % 12 == 0 ? 12 : h % 12;
    return '$h12:${m.group(2)} $ap';
  }

  @override
  Widget build(BuildContext context) {
    List shows;
    try {
      shows = jsonDecode(raw.isEmpty ? '[]' : raw) as List;
    } catch (_) {
      return const SizedBox.shrink();
    }
    if (shows.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 7),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final sh in shows.take(3))
            if (sh is Map)
              Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                      decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(5)),
                      child: Text(
                        _fmt(sh['time']),
                        style: tx(context, 9, w: FontWeight.w900, color: Colors.white),
                      ),
                    ),
                    const SizedBox(width: 5),
                    Expanded(
                      child: Text(
                        '${sh['theatre'] ?? ''}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: tx(context, 9, color: muted(context)),
                      ),
                    ),
                    for (final a in ((sh['areas'] as List?) ?? const []).take(2))
                      if (a is Map)
                        Padding(
                          padding: const EdgeInsets.only(left: 4),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                            decoration: BoxDecoration(
                              color: Theme.of(context).cardColor,
                              borderRadius: BorderRadius.circular(5),
                              border: Border.all(color: border(context)),
                            ),
                            child: Text(
                              '${a['label'] ?? ''} ₹${a['price'] ?? ''}',
                              style: tx(context, 8.5, w: FontWeight.w800, color: ink(context)),
                            ),
                          ),
                        ),
                  ],
                ),
              ),
        ],
      ),
    );
  }
}

class _ChipSpecs extends StatelessWidget {
  const _ChipSpecs({required this.it, required this.vertical});
  final CompareItem it;
  final String vertical;

  @override
  Widget build(BuildContext context) {
    final list = <String>[];
    if (vertical == 'food' && (it.spec('is_veg') == 'true' || it.spec('veg') == 'true')) {
      list.add('Veg');
    }
    if (it.spec('delivery').isNotEmpty) list.add(it.spec('delivery'));
    if (it.spec('tenure').isNotEmpty) list.add(it.spec('tenure'));
    if (it.spec('cover').isNotEmpty) list.add(it.spec('cover'));
    if (it.spec('language').isNotEmpty) list.add(it.spec('language'));

    if (list.isEmpty) return const SizedBox.shrink();

    return Wrap(
      spacing: 4,
      children: [
        for (final s in list.take(2))
          Pill(
            s,
            bg: s == 'Veg' ? T1SColors.greenBg : (isDark(context) ? T1SColors.slate800 : T1SColors.slate100),
            fg: s == 'Veg' ? T1SColors.green : muted(context),
            size: 8.5,
          ),
      ],
    );
  }
}
