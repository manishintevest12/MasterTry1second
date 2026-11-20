import 'package:flutter/material.dart';

import '../../core/compare.dart';
import '../../core/grocery_cart.dart';
import '../../core/theme.dart';
import 'compare_cards.dart' show openPartnerExit;
import 'grocery_cart_sheet.dart';
import 'kit.dart';

/// 10-MIN GROCERY GRID (owner 20 Nov, second pass — web parity).
///
/// The behaviour was already right (partner name, ADD/stepper, Order); the SHAPE was still a comparison row. A
/// grocery shopper reads a grid: image, % off, delivery time, title, pack, price/MRP, partner, ADD. This is that
/// grid, and it keeps every rule: the partner whose price this is gets named on every tile, ADD feeds the shared
/// persisted basket, and Order leaves through the same tracked exit as every other card (openPartnerExit), so no
/// checkout is implied here.
class GroceryGridChunk extends StatelessWidget {
  const GroceryGridChunk({super.key, required this.groups});
  final List<OfferGroup> groups;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < groups.length; i += 2) {
      final pair = groups.skip(i).take(2).toList();
      rows.add(Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: GroceryTile(group: pair[0])),
            const SizedBox(width: 10),
            Expanded(child: pair.length > 1 ? GroceryTile(group: pair[1]) : const SizedBox.shrink()),
          ],
        ),
      ));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows);
  }
}

class GroceryTile extends StatelessWidget {
  const GroceryTile({super.key, required this.group});
  final OfferGroup group;

  String _inr(double n) => groceryRupees(n);

  /// First real ETA the source gave us — never invented.
  String _eta() {
    for (final it in [group.lead, ...group.rows.map((r) => r.item)]) {
      for (final q in it.sellerQuotes) {
        final e = (q.deliveryOrEta ?? '').trim();
        if (e.isNotEmpty) return e.replaceFirst(RegExp(r'^delivery\s*(in)?\s*', caseSensitive: false), '').toUpperCase();
      }
    }
    return '';
  }

  @override
  Widget build(BuildContext context) {
    final item = group.lead;
    final partner = group.best.site.isNotEmpty ? group.best.site : (item.provider.isNotEmpty ? item.provider : 'Partner');
    final unit = item.unit.replaceFirst(RegExp(r'^per\s+', caseSensitive: false), '').trim();
    final price = group.best.price > 0 ? group.best.price : item.primaryPrice;
    final mrp = item.originalPrice;
    final off = (mrp > price && mrp > 0) ? ((mrp - price) / mrp * 100).round() : 0;
    final eta = _eta();
    final key = groceryKey(item.title, unit, partner);
    final cart = GroceryCart.instance;
    final quote = item.bestQuote ?? (item.sellerQuotes.isNotEmpty ? item.sellerQuotes.first : null);

    void add() => cart.add(GroceryLine(
          key: key,
          title: item.title,
          unit: unit,
          price: price,
          mrp: mrp > price ? mrp : price,
          partner: partner,
          image: item.imageUrl,
          url: quote?.url,
        ));

    return AnimatedBuilder(
      animation: cart,
      builder: (context, _) {
        final qty = cart.qtyOf(key);
        return Container(
          decoration: BoxDecoration(
            color: surface(context),
            border: Border.all(color: border(context)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // image + badges
              Stack(children: [
                AspectRatio(
                  aspectRatio: 1,
                  child: ClipRRect(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                    child: Container(
                      color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50,
                      child: (item.imageUrl ?? '').isNotEmpty
                          ? Image.network(item.imageUrl!, fit: BoxFit.contain,
                              errorBuilder: (_, __, ___) => const SizedBox.shrink())
                          : const SizedBox.shrink(),
                    ),
                  ),
                ),
                if (off > 0)
                  Positioned(
                    top: 6,
                    left: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                      decoration: BoxDecoration(color: const Color(0xFF0284C7), borderRadius: BorderRadius.circular(4)),
                      child: Text('$off% OFF', style: tx(context, 8.5, w: FontWeight.w900, color: Colors.white)),
                    ),
                  ),
                if (eta.isNotEmpty)
                  Positioned(
                    bottom: 6,
                    left: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(4)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.access_time_rounded, size: 9, color: T1SColors.slate500),
                        const SizedBox(width: 2),
                        Text(eta, style: tx(context, 8.5, w: FontWeight.w900, color: T1SColors.slate600)),
                      ]),
                    ),
                  ),
              ]),
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // the partner whose price this is: on EVERY tile
                    Text(partner.toUpperCase(), maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: tx(context, 8.5, w: FontWeight.w900, color: muted(context))),
                    const SizedBox(height: 2),
                    Text(item.title, maxLines: 2, overflow: TextOverflow.ellipsis,
                        style: tx(context, 11.5, w: FontWeight.w800, h: 1.2)),
                    const SizedBox(height: 2),
                    Text(unit.isEmpty ? '' : unit, style: tx(context, 10, w: FontWeight.w600, color: muted(context))),
                    const SizedBox(height: 6),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(_inr(price), style: tx(context, 13, w: FontWeight.w900)),
                              if (mrp > price)
                                Text(_inr(mrp),
                                    style: tx(context, 9.5, w: FontWeight.w600, color: muted(context))
                                        .copyWith(decoration: TextDecoration.lineThrough)),
                            ],
                          ),
                        ),
                        qty == 0
                            ? GestureDetector(
                                onTap: add,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                  decoration: BoxDecoration(
                                    border: Border.all(color: T1SColors.emerald600, width: 1.6),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text('ADD', style: tx(context, 10.5, w: FontWeight.w900, color: T1SColors.emerald600)),
                                ),
                              )
                            : Container(
                                decoration: BoxDecoration(
                                  border: Border.all(color: T1SColors.emerald600, width: 1.6),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Row(mainAxisSize: MainAxisSize.min, children: [
                                  InkWell(
                                    onTap: () => cart.setQty(key, qty - 1),
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                      child: Text('\u2212', style: tx(context, 12, w: FontWeight.w900, color: T1SColors.emerald600)),
                                    ),
                                  ),
                                  Text('$qty', style: tx(context, 10.5, w: FontWeight.w900, color: T1SColors.emerald600)),
                                  InkWell(
                                    onTap: add,
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                      child: Text('+', style: tx(context, 12, w: FontWeight.w900, color: T1SColors.emerald600)),
                                    ),
                                  ),
                                ]),
                              ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    GestureDetector(
                      onTap: quote == null
                          ? null
                          : () => openPartnerExit(
                                context,
                                sellerName: partner,
                                title: item.title,
                                goUrl: quote.url,
                                price: price,
                                image: item.imageUrl,
                                isLowest: true,
                                vertical: 'grocery',
                              ),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(8)),
                        child: Text('Order on $partner',
                            textAlign: TextAlign.center,
                            style: tx(context, 9.5, w: FontWeight.w900, color: Colors.white)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Small helper so a grocery feed can show its basket without the caller wiring the sheet.
Future<void> openGroceryCart(BuildContext context) => showGroceryCartSheet(context);
