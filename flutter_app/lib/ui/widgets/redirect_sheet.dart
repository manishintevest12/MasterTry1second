import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/app_state.dart';
import '../../core/theme.dart';
import 'kit.dart';
import '../screens/spend_lens_screen.dart';

/// The website's RedirectionModal, app edition: confirms the direct price and
/// shows the seller's real best offer / best coupon (from /api/deals/for-seller)
/// before the user leaves for the merchant's own page via the /api/out deeplink.
Future<void> showRedirectSheet(
  BuildContext context, {
  required String sellerName,
  required String title,
  required String goUrl,
  double? price,
  String? image,
  bool isLowest = false,
  bool appOnly = false,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _RedirectSheet(
      sellerName: sellerName,
      title: title,
      goUrl: goUrl,
      price: price,
      image: image,
      isLowest: isLowest,
      appOnly: appOnly,
    ),
  );
}

class _RedirectSheet extends StatefulWidget {
  const _RedirectSheet({
    required this.sellerName,
    required this.title,
    required this.goUrl,
    this.price,
    this.image,
    this.isLowest = false,
    this.appOnly = false,
  });

  final String sellerName;
  final String title;
  final String goUrl;
  final double? price;
  final String? image;
  final bool isLowest;
  final bool appOnly;

  @override
  State<_RedirectSheet> createState() => _RedirectSheetState();
}

class _RedirectSheetState extends State<_RedirectSheet> {
  SellerDeals? _seller;
  bool _loading = true;
  bool _copied = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await AppState.instance.api
          .dealsForSeller(widget.sellerName)
          .timeout(const Duration(seconds: 4));
      if (mounted) setState(() { _seller = r; _loading = false; });
    } catch (_) {
      if (mounted) setState(() { _loading = false; }); // offers are an overlay; the Go button is never blocked
    }
  }

  Future<void> _copy(String code) async {
    await Clipboard.setData(ClipboardData(text: code));
    HapticFeedback.selectionClick();
    if (mounted) setState(() => _copied = true);
    Future.delayed(const Duration(seconds: 2), () { if (mounted) setState(() => _copied = false); });
  }

  Future<void> _go() async {
    HapticFeedback.selectionClick();
    if (!mounted) return;
    Navigator.of(context).pop();
    await openDeal(widget.goUrl, sellerName: widget.sellerName);
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final offer = _seller?.bestOffer;
    final coupon = _seller?.bestCoupon;
    return Container(
      decoration: BoxDecoration(
        color: surface(context),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
      ),
      margin: EdgeInsets.only(bottom: bottom),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 40, height: 4, alignment: Alignment.center, margin: const EdgeInsets.only(bottom: 16),
                child: Container(width: 40, height: 4, decoration: BoxDecoration(color: muted(context).withOpacity(.25), borderRadius: BorderRadius.circular(2)))),
            // header chips: Try1Sec -> Seller
            Row(children: [
              _chip(context, 'Try1Sec', emphasized: true),
              Icon(Icons.arrow_forward_rounded, size: 14, color: muted(context)),
              const SizedBox(width: 2),
              _chip(context, widget.sellerName.isEmpty ? 'Seller' : widget.sellerName),
            ]),
            const SizedBox(height: 14),
            Row(children: [
              if (widget.image != null && widget.image!.startsWith('http'))
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: CachedNetworkImage(
                      imageUrl: widget.image!, width: 54, height: 54, fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => const SizedBox.shrink()),
                )
              else
                Container(
                  width: 54, height: 54, alignment: Alignment.center,
                  decoration: BoxDecoration(color: muted(context).withOpacity(.12), borderRadius: BorderRadius.circular(10)),
                  child: Icon(Icons.shopping_bag_outlined, size: 24, color: muted(context)),
                ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(widget.title, maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: tx(context, 14, w: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Row(children: [
                    if (widget.price != null && widget.price! > 0)
                      Text('₹${widget.price!.toStringAsFixed(widget.price! == widget.price!.roundToDouble() ? 0 : 2)}',
                          style: tx(context, 18, w: FontWeight.w800, color: T1SColors.red)),
                    const SizedBox(width: 8),
                    Flexible(child: Text(widget.isLowest ? 'Lowest Direct Price Verified!' : 'Direct from ${widget.sellerName.isEmpty ? "seller" : widget.sellerName}',
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: tx(context, 11.5, w: FontWeight.w700, color: const Color(0xFF0E9F6E)))),
                  ]),
                ]),
              ),
            ]),
            if (widget.isLowest) const SizedBox(height: 6),
            // animated check ring
            const SizedBox(height: 10),
            _CheckRing(),
            if (widget.appOnly) ...[
              const SizedBox(height: 10),
              _notice(context, 'Available only on app'),
            ],
            const SizedBox(height: 12),
            if (_loading)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: _Skeleton(),
              )
            else ..._bestBlocks(context, offer, coupon),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14), side: BorderSide(color: muted(context).withOpacity(.35))),
                  child: Text('Keep browsing', style: tx(context, 13, w: FontWeight.w700)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: RedButton(
                  'Go to ${widget.sellerName.isEmpty ? "site" : widget.sellerName}',
                  onTap: widget.goUrl.isEmpty ? null : _go,
                  dense: true,
                ),
              ),
            ]),
            const SizedBox(height: 8),
            // Spend Lens prefill: a SUGGESTION the user confirms — never auto-saved.
            if (widget.price != null && widget.price! > 0)
              OutlinedButton.icon(
                onPressed: () {
                  Navigator.of(context).pop();
                  AppState.instance.navigator.currentState?.push(
                    MaterialPageRoute(
                      builder: (_) => SpendLensScreen(
                        prefill: SpendPrefill(
                          merchant: widget.sellerName,
                          amount: widget.price ?? 0,
                          itemTitle: widget.title,
                        ),
                      ),
                    ),
                  );
                },
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  side: const BorderSide(color: T1SColors.red),
                ),
                icon: const Icon(Icons.account_balance_wallet_rounded, size: 15, color: T1SColors.red),
                label: Text('Log purchase in Spend Lens', style: tx(context, 11, w: FontWeight.w800, color: T1SColors.red)),
              ),
          ],
        ),
      ),
    );
  }

  List<Widget> _bestBlocks(BuildContext context, Deal? offer, Deal? coupon) {
    final out = <Widget>[];
    if (offer != null) {
      out.add(_BestCard(
        label: 'Your best offer',
        title: offer.title,
        badge: offer.discountText ?? offer.merchantName,
        note: offer.validTill != null && offer.validTill!.isNotEmpty ? 'Valid till ${offer.validTill}' : (offer.terms ?? offer.description),
      ));
      out.add(const SizedBox(height: 8));
    }
    if (coupon != null) {
      out.add(_BestCard(
        label: 'Your best coupon',
        title: coupon.title,
        badge: coupon.discountText,
        code: coupon.code,
        onCopy: coupon.code == null ? null : () => _copy(coupon.code!),
        copied: _copied,
      ));
      out.add(const SizedBox(height: 8));
    }
    if (offer == null && coupon == null) {
      out.add(Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text(
          'No extra offer is running on ${widget.sellerName.isEmpty ? "this seller" : widget.sellerName} right now.',
          textAlign: TextAlign.center,
          style: tx(context, 12.5, color: muted(context)),
        ),
      ));
    }
    return out;
  }

  Widget _chip(BuildContext context, String label, {bool emphasized = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: emphasized ? T1SColors.red : muted(context).withOpacity(.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label, style: tx(context, 11, w: FontWeight.w800, color: emphasized ? Colors.white : null)),
    );
  }

  Widget _notice(BuildContext context, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7E6),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFF5C04A)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.smartphone_rounded, size: 14, color: Color(0xFFB7791F)),
        const SizedBox(width: 6),
        Flexible(child: Text(text, style: tx(context, 11, w: FontWeight.w700, color: const Color(0xFFB7791F)))),
      ]),
    );
  }
}

class _BestCard extends StatelessWidget {
  const _BestCard({required this.label, required this.title, this.badge, this.note, this.code, this.onCopy, this.copied = false});

  final String label;
  final String title;
  final String? badge;
  final String? note;
  final String? code;
  final VoidCallback? onCopy;
  final bool copied;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: muted(context).withOpacity(.06),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: muted(context).withOpacity(.14)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(badge != null ? Icons.local_offer_rounded : Icons.sell_outlined, size: 13, color: T1SColors.red),
          const SizedBox(width: 5),
          Text(label, style: tx(context, 11, w: FontWeight.w800, color: T1SColors.red)),
          const Spacer(),
          if (badge != null)
            Flexible(child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(color: const Color(0xFFE6F6EE), borderRadius: BorderRadius.circular(6)),
              child: Text(badge!, maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: tx(context, 10, w: FontWeight.w800, color: const Color(0xFF0E9F6E))),
            )),
        ]),
        const SizedBox(height: 6),
        Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: tx(context, 12.5, w: FontWeight.w700)),
        if (note != null && note!.isNotEmpty) ...[
          const SizedBox(height: 3),
          Text(note!, maxLines: 2, overflow: TextOverflow.ellipsis, style: tx(context, 10.5, color: muted(context))),
        ],
        if (code != null && code!.isNotEmpty) ...[
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                decoration: BoxDecoration(
                  color: surface(context),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: T1SColors.red.withOpacity(.4), style: BorderStyle.solid),
                ),
                child: Text(code!, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: tx(context, 13.5, w: FontWeight.w800, mono: true)),
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: onCopy,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                decoration: BoxDecoration(color: copied ? const Color(0xFF0E9F6E) : T1SColors.red, borderRadius: BorderRadius.circular(10)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(copied ? Icons.check_rounded : Icons.copy_rounded, size: 14, color: Colors.white),
                  const SizedBox(width: 5),
                  Text(copied ? 'Copied' : 'COPY', style: tx(context, 11.5, w: FontWeight.w800, color: Colors.white)),
                ]),
              ),
            ),
          ]),
        ],
      ]),
    );
  }
}

class _CheckRing extends StatefulWidget {
  @override
  State<_CheckRing> createState() => _CheckRingState();
}

class _CheckRingState extends State<_CheckRing> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 700))..forward();

  @override
  void dispose() { _c.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (_, __) {
        final t = Curves.easeOutBack.transform(_c.value.clamp(0, 1));
        return Container(
          width: 44, height: 44, alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xFFE6F6EE),
            border: Border.all(color: const Color(0xFF0E9F6E).withOpacity(.6), width: 2),
          ),
          child: Transform.scale(scale: t, child: const Icon(Icons.check_rounded, size: 26, color: Color(0xFF0E9F6E))),
        );
      },
    );
  }
}

class _Skeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 64, decoration: BoxDecoration(color: muted(context).withOpacity(.08), borderRadius: BorderRadius.circular(14)),
      alignment: Alignment.center,
      child: Text('Checking for running offers…', style: tx(context, 11.5, color: muted(context))),
    );
  }
}
