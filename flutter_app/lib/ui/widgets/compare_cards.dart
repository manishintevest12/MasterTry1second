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
import 'kit.dart';

/// Grouped result cards (one product = one card, every site's real price inside,
/// cheapest site first) mirroring the website's TravelDealRow / HotelDealCard /
/// CreditCardCard / ComparisonCard.

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
        Text(
          row.priceAvailable ? formatPrice(vertical, row.price) : 'Price on site',
          style: tx(
            context,
            12.5,
            w: FontWeight.w900,
            color: row.priceAvailable ? ink(context) : muted(context),
            mono: true,
          ),
        ),
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
            child: Text('Book', style: tx(context, 10, w: FontWeight.w900, color: Colors.white)),
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
    final seats = it.spec('seats').isNotEmpty ? it.spec('seats') : (it.spec('capacity').isNotEmpty ? it.spec('capacity') : '');
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
                      'Book',
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

  @override
  Widget build(BuildContext context) {
    final bestSeller = g.best.site.isNotEmpty ? g.best.site : 'Hotel Partner';

    return Box(
      padding: EdgeInsets.zero,
      radius: 16,
      shadow: true,
      clip: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GestureDetector(
            onTap: () => showHotelDetail(context, g),
            child: Stack(
            children: [
              NetImage(g.image ?? g.gallery.firstOrNull, height: 130, fallbackIcon: Icons.hotel_rounded),
              if (g.gallery.length > 1)
                Positioned(
                  top: 8,
                  left: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.55),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.photo_library_rounded, size: 10, color: Colors.white70),
                        const SizedBox(width: 3),
                        Text('${g.gallery.length} photos', style: tx(context, 8.5, w: FontWeight.w800, color: Colors.white)),
                      ],
                    ),
                  ),
                ),
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.transparent, Colors.black.withValues(alpha: 0.6)],
                    ),
                  ),
                ),
              ),
              Positioned(
                left: 10,
                bottom: 8,
                right: 10,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      g.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: tx(context, 13.5, w: FontWeight.w900, color: Colors.white),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        if (g.locality != null) ...[
                          const Icon(Icons.location_on_rounded, size: 10, color: Colors.white70),
                          const SizedBox(width: 2),
                          Flexible(
                            child: Text(
                              '${g.locality}${g.city.isNotEmpty ? ', ${g.city}' : ''}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: tx(context, 9.5, color: Colors.white70),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.55),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text('per night', style: tx(context, 9, w: FontWeight.w800, color: Colors.white)),
                ),
              ),
            ],
          ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    if (g.rating10 != null) ...[
                      Pill(
                        '${g.rating10}/10',
                        bg: T1SColors.emerald500.withValues(alpha: 0.15),
                        fg: T1SColors.emerald600,
                        icon: Icons.star_rounded,
                        size: 9,
                      ),
                      const SizedBox(width: 6),
                    ],
                    if (g.ratingCount != null)
                      Text('${g.ratingCount} reviews', style: tx(context, 9.5, color: muted(context))),
                    const Spacer(),
                    Pill('BEST PRICE', bg: T1SColors.greenBg, fg: T1SColors.green, size: 8.5),
                    const SizedBox(width: 6),
                    Text(formatPrice('hotels', g.best.price), style: tx(context, 16, w: FontWeight.w900, mono: true)),
                  ],
                ),
                if (g.amenities.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 7),
                    child: Wrap(
                      spacing: 5,
                      runSpacing: 4,
                      children: [
                        for (final a in g.amenities.take(5))
                          Pill(
                            a,
                            bg: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                            fg: muted(context),
                            size: 8.5,
                          ),
                      ],
                    ),
                  ),
                const SizedBox(height: 9),
                _SiteRows(
                  rows: [for (final r in g.rows) OfferRow(r.item, r.site, r.price, true)],
                  vertical: 'hotels',
                ),
                if (g.best.item.bestQuote?.url.isNotEmpty == true) ...[
                  const SizedBox(height: 8),
                  RedButton(
                    'Book',
                    onTap: () => _openRedirect(
                    context,
                    sellerName: bestSeller,
                    title: g.best.item.title,
                    goUrl: g.best.item.bestQuote!.url,
                    appBookUrl: g.best.item.appBookUrl,
                    vertical: g.best.item.vertical,
                    price: g.best.price > 0 ? g.best.price : null,
                    image: g.best.item.imageUrl,
                    isLowest: true,
                    appOnly: (g.best.item.bestQuote?.badge ?? '').toLowerCase().contains('app'),
                  ),
                    dense: true,
                  ),
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
                if (g.rows.length > 1) ...[
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
                            : 'Book',
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
                        onTap: () => AppState.instance.addToSmartCart(it.title),
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
