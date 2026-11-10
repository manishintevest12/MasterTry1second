import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';
import 'kit.dart';

/// House-sponsored cards for the results feed (owner 9 Nov).
///
/// The owner asked for four non-intrusive monetisation layers in the app and ruled out popunders:
/// "user ko kabhi spam ya malware feel nahi hoga". Three already ship: every merchant card exits
/// through the masked /api/out affiliate pointer, the ecommerce product page has a sponsored banner,
/// and AdSmartlink is tap-only. This file adds the fourth: a native-looking card INSIDE the results
/// list, plus an optional Featured-partner card on top of the finance verticals.
///
/// Deliberately no AdMob: `/api/ads?slot=vertical_<id>` already mints a house slot from the deals
/// registry - real partner offers with a masked /api/out goUrl, so the card is vertical-relevant,
/// already monetised per click, and honest (no invented merchant or discount, and nothing at all
/// when no deal matches the vertical). An AdMob native unit can replace the body of [SponsoredCard]
/// later without the feed knowing.
class SponsoredOffer {
  const SponsoredOffer({
    required this.merchant,
    required this.title,
    required this.url,
    this.discount = '',
    this.image,
  });

  final String merchant;
  final String title;

  /// Either an absolute https partner URL or the masked "/api/out?..." pointer the deals registry
  /// hands out. Anything else is rejected, so a sponsored tap can only ever reach a partner page.
  final String url;
  final String discount;
  final String? image;

  static SponsoredOffer? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final url = (raw['url'] ?? '').toString().trim();
    if (!url.startsWith('https://') && !url.startsWith('/api/out')) return null;
    final merchant = (raw['merchant'] ?? '').toString().trim();
    final title = (raw['title'] ?? '').toString().trim();
    if (merchant.isEmpty && title.isEmpty) return null;
    final image = (raw['image'] ?? '').toString().trim();
    return SponsoredOffer(
      merchant: merchant.isEmpty ? 'Partner' : merchant,
      title: title,
      url: url,
      discount: (raw['discount'] ?? '').toString().trim(),
      image: image.startsWith('https://') ? image : null,
    );
  }

  /// The absolute tap target. A relative pointer is resolved against the API base, which is the same
  /// host the app already talks to, so the in-app browser keeps the affiliate hop server-side.
  String resolvedUrl() {
    if (url.startsWith('https://')) return url;
    final base = AppState.instance.api.baseUrl;
    return base.isEmpty ? url : '$base$url';
  }
}

/// Reads the vertical's house sponsor slot. Any failure returns an empty list so a slow or empty ad
/// endpoint can never delay or blank the results list.
Future<List<SponsoredOffer>> fetchSponsoredOffers(String vertical) async {
  if (vertical.isEmpty) return const [];
  try {
    final res = await AppState.instance.api.getJsonPublic('/api/ads?slot=vertical_$vertical');
    if (res['active'] != true) return const [];
    final slot = res['slot'];
    if (slot is! Map) return const [];
    final deals = slot['deals'];
    if (deals is! List) return const [];
    final out = <SponsoredOffer>[];
    for (final row in deals) {
      final offer = SponsoredOffer.fromJson(row);
      if (offer != null) out.add(offer);
      if (out.length == 2) break;
    }
    return out;
  } catch (_) {
    return const [];
  }
}

/// Inserts [card] into [rows] after the Nth result (default: the 6th, same as the web feed).
/// Untouched when there is no card or the list is too short to hide a paid row between real ones.
List<Widget> injectSponsoredCard(List<Widget> rows, Widget? card, {int after = 6}) {
  if (card == null || rows.length <= after) return rows;
  return <Widget>[...rows.take(after), card, ...rows.skip(after)];
}

/// One sponsored result card: styled like a real deal row on purpose, with a permanent label so the
/// user always knows it is paid placement.
class SponsoredCard extends StatelessWidget {
  const SponsoredCard({super.key, required this.offer, this.label = 'SPONSORED'});

  final SponsoredOffer offer;

  /// "SPONSORED" inside the feed, "FEATURED PARTNER" for the CPA slot on finance verticals
  /// (loans, credit cards, insurance, savings), the way comparison sites label paid rows.
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GestureDetector(
        onTap: () => openDeal(offer.resolvedUrl(), sellerName: offer.merchant),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: border(context)),
          ),
          child: Row(children: [
            if (offer.image != null)
              NetImage(offer.image!, width: 56, height: 56, fit: BoxFit.contain, radius: 8, fallbackIcon: Icons.local_offer_outlined)
            else
              const Icon(Icons.local_offer_outlined, size: 28, color: T1SColors.red),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Text(label, style: tx(context, 8.5, w: FontWeight.w900, color: muted(context), ls: 0.8)),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(offer.merchant,
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: tx(context, 9.5, w: FontWeight.w800, color: T1SColors.red)),
                  ),
                ]),
                if (offer.title.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(offer.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: tx(context, 11, w: FontWeight.w800)),
                ],
                if (offer.discount.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(offer.discount, style: tx(context, 9.5, w: FontWeight.w700, color: T1SColors.green)),
                ],
              ]),
            ),
            const SizedBox(width: 8),
            Icon(Icons.chevron_right_rounded, size: 20, color: muted(context)),
          ]),
        ),
      ),
    );
  }
}
