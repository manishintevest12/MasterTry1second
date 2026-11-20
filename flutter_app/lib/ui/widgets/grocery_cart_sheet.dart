import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/grocery_cart.dart';
import '../../core/theme.dart';
import 'kit.dart';

/// GROCERY CART UI (owner 20 Nov): the Blinkit-style basket the cards feed.
///
/// A basket, not a checkout. Each group names the partner it will be ordered from and carries that partner's own
/// tracked link, so nothing here implies we hold the money or that a price is locked. The total is the sum of the
/// prices the shopper saw and says so.
Future<void> showGroceryCartSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => const _GroceryCartSheet(),
  );
}

class _GroceryCartSheet extends StatefulWidget {
  const _GroceryCartSheet();
  @override
  State<_GroceryCartSheet> createState() => _GroceryCartSheetState();
}

class _GroceryCartSheetState extends State<_GroceryCartSheet> {
  final cart = GroceryCart.instance;

  Future<void> _open(String? url) async {
    if (url == null || url.isEmpty) return;
    final abs = url.startsWith('http') ? url : 'https://www.try1second.com$url';
    await launchUrl(Uri.parse(abs), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: cart,
      builder: (context, _) {
        final groups = cart.groupedByPartner();
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 10, 10),
                child: Row(
                  children: [
                    const Icon(Icons.shopping_basket_outlined, size: 18, color: T1SColors.red),
                    const SizedBox(width: 8),
                    Text('Grocery cart', style: tx(context, 14, w: FontWeight.w900)),
                    const SizedBox(width: 8),
                    Text('${cart.units} item${cart.units == 1 ? '' : 's'}',
                        style: tx(context, 11, w: FontWeight.w700, color: muted(context))),
                    const Spacer(),
                    if (!cart.isEmpty)
                      TextButton(
                        onPressed: cart.clear,
                        child: Text('Clear', style: tx(context, 11, w: FontWeight.w800, color: muted(context))),
                      ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close, size: 18),
                      color: muted(context),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Flexible(
                child: cart.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.symmetric(vertical: 36),
                        child: Text('Your cart is empty. Tap ADD on any grocery card.',
                            style: tx(context, 12, color: muted(context))),
                      )
                    : ListView(
                        shrinkWrap: true,
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                        children: [
                          for (final entry in groups.entries) ...[
                            Row(
                              children: [
                                Expanded(
                                  child: Text('Ordered from ${entry.key}',
                                      style: tx(context, 11, w: FontWeight.w900, color: muted(context))),
                                ),
                                Text(
                                  groceryRupees(entry.value.fold<double>(0, (s, l) => s + l.price * l.qty)),
                                  style: tx(context, 11, w: FontWeight.w800, color: muted(context)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            for (final l in entry.value) _line(context, l),
                            const SizedBox(height: 12),
                          ],
                        ],
                      ),
              ),
              if (!cart.isEmpty) ...[
                const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 18),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(groceryRupees(cart.total), style: tx(context, 16, w: FontWeight.w900)),
                            Text(
                              cart.saving > 0
                                  ? 'You save ${groceryRupees(cart.saving)} · prices as seen when you added them'
                                  : 'Prices as seen when you added them',
                              style: tx(context, 10, color: muted(context)),
                            ),
                          ],
                        ),
                      ),
                      if (groups.length == 1)
                        GestureDetector(
                          onTap: () => _open(groups.values.first.first.url),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                            decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(12)),
                            child: Text('Order on ${groups.keys.first}',
                                style: tx(context, 12, w: FontWeight.w900, color: Colors.white)),
                          ),
                        )
                      else
                        Text('${groups.length} partners —\norder each group on its own site',
                            textAlign: TextAlign.right,
                            style: tx(context, 10, w: FontWeight.w700, color: muted(context))),
                    ],
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _line(BuildContext context, GroceryLine l) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        border: Border.all(color: T1SColors.slate200),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: (l.image != null && l.image!.isNotEmpty)
                ? Image.network(l.image!, width: 44, height: 44, fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(width: 44, height: 44, color: T1SColors.slate100))
                : Container(width: 44, height: 44, color: T1SColors.slate100),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.title, maxLines: 2, overflow: TextOverflow.ellipsis,
                    style: tx(context, 12, w: FontWeight.w800)),
                Text(
                  '${l.unit.isEmpty ? '' : '${l.unit} · '}${groceryRupees(l.price)}'
                  '${l.mrp > l.price ? '  ${groceryRupees(l.mrp)}' : ''}',
                  style: tx(context, 11, color: muted(context)),
                ),
              ],
            ),
          ),
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: T1SColors.slate200),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                InkWell(
                  onTap: () => cart.setQty(l.key, l.qty - 1),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                    child: Icon(l.qty == 1 ? Icons.delete_outline : Icons.remove, size: 13),
                  ),
                ),
                Text('${l.qty}', style: tx(context, 11, w: FontWeight.w900)),
                InkWell(
                  onTap: () => cart.setQty(l.key, l.qty + 1),
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                    child: Icon(Icons.add, size: 13),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          if (l.url != null && l.url!.isNotEmpty)
            InkWell(
              onTap: () => _open(l.url),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
                decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(8)),
                child: Text('Order', style: tx(context, 10, w: FontWeight.w900, color: Colors.white)),
              ),
            ),
        ],
      ),
    );
  }
}

/// The floating bar on the grocery feed: what is in the basket and where it goes next.
class GroceryCartBar extends StatelessWidget {
  const GroceryCartBar({super.key});

  @override
  Widget build(BuildContext context) {
    final cart = GroceryCart.instance;
    return AnimatedBuilder(
      animation: cart,
      builder: (context, _) {
        if (cart.isEmpty) return const SizedBox.shrink();
        return GestureDetector(
          onTap: () => showGroceryCartSheet(context),
          child: Container(
            margin: const EdgeInsets.fromLTRB(12, 0, 12, 10),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: BoxDecoration(color: T1SColors.slate900, borderRadius: BorderRadius.circular(12)),
            child: Row(
              children: [
                const Icon(Icons.shopping_basket_outlined, size: 16, color: Colors.white),
                const SizedBox(width: 8),
                Text('${cart.units} item${cart.units == 1 ? '' : 's'}',
                    style: tx(context, 12, w: FontWeight.w900, color: Colors.white)),
                const Spacer(),
                Text('${groceryRupees(cart.total)} · View cart',
                    style: tx(context, 12, w: FontWeight.w900, color: Colors.white)),
              ],
            ),
          ),
        );
      },
    );
  }
}
