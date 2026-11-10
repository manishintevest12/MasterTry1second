import 'package:flutter/material.dart';

import '../../core/ad_smartlink.dart';
import '../../core/theme.dart';
import 'kit.dart';

/// Smartlink footer pill (owner 9 Nov).
///
/// The owner's four-layer plan ends with "app ki bottom navigation bar ke just upar ek patli si clean
/// interactive pill ... jab koi interested user khud tap karta hai, tabhi smartlink open hota hai".
/// This is that pill and it is deliberately the least assertive surface in the app:
///  * nothing renders until /api/app-ads confirms a live smartlink (a disabled link shows no pill);
///  * it never fires on its own - no timer, no initState open, no gesture hook; the ONLY call is
///    inside onTap, so the user's own tap is the whole trigger;
///  * AdSmartlink opens the phone's default browser (never the current tab) at most once per session,
///    https-only, host allow-listed, so the search flow underneath keeps running untouched;
///  * it is labelled "Ad" because a paid surface must say so.
class SponsoredDealPill extends StatefulWidget {
  const SponsoredDealPill({super.key});

  @override
  State<SponsoredDealPill> createState() => _SponsoredDealPillState();
}

class _SponsoredDealPillState extends State<SponsoredDealPill> {
  bool _available = false;

  @override
  void initState() {
    super.initState();
    // Availability only. No link is opened here - openFromUserTap() is called from onTap alone.
    AdSmartlink.url().then((link) {
      if (!mounted) return;
      setState(() => _available = link != null);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_available) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 6),
      child: GestureDetector(
        onTap: () => AdSmartlink.openFromUserTap(),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: border(context)),
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.local_offer_outlined, size: 14, color: T1SColors.red),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                'Explore Featured Deals & Offers',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: tx(context, 11, w: FontWeight.w800),
              ),
            ),
            const SizedBox(width: 6),
            Text('Ad', style: tx(context, 9, w: FontWeight.w700, color: muted(context))),
          ]),
        ),
      ),
    );
  }
}
