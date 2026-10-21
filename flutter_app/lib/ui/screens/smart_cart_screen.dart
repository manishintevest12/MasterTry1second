import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';
import '../widgets/kit.dart';

/// Smart Cart (owner rule): the grocery basket is totalled at EVERY store
/// server-side (/api/smart-cart/compare) and ranked by FULL-basket cost.
/// 'Shop at store' hops through the /api/out pointer like every other deal.
class SmartCartScreen extends StatefulWidget {
  const SmartCartScreen({super.key});

  @override
  State<SmartCartScreen> createState() => _SmartCartScreenState();
}

class _SmartCartScreenState extends State<SmartCartScreen> {
  bool _comparing = false;
  Map<String, dynamic>? _result;
  String _error = '';

  Future<void> _compare() async {
    final app = AppState.instance;
    if (app.smartCart.isEmpty) return;
    setState(() { _comparing = true; _error = ''; _result = null; });
    try {
      final comparison = await app.api.smartCartCompare(
        app.smartCart,
        pincode: app.pincode,
        city: app.city,
      );
      if (!mounted) return;
      setState(() => _result = comparison);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not compare the basket right now.');
    } finally {
      if (mounted) setState(() => _comparing = false);
    }
  }

  String _rupees(num n) => '\u20B9${n.round()}';

  @override
  Widget build(BuildContext context) {
    final app = AppState.instance;
    final items = List<Map<String, dynamic>>.from(
        (_result?['items'] as List?)?.map((x) => Map<String, dynamic>.from(x as Map)) ?? const <Map<String, dynamic>>[]);
    final stores = List<Map<String, dynamic>>.from(
        (_result?['stores'] as List?)?.map((x) => Map<String, dynamic>.from(x as Map)) ?? const <Map<String, dynamic>>[]);
    final notFound = List<String>.from((_result?['notFound'] as List?) ?? const []);
    final bestIdx = stores.indexWhere((s) => s['complete'] == true);
    final partial = stores.where((s) => s['complete'] != true).toList();

    return Scaffold(
      appBar: AppBar(
        title: Text('Smart Cart', style: tx(context, 14, w: FontWeight.w900)),
        actions: [
          if (app.smartCart.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_sweep_outlined, size: 20),
              onPressed: () { app.clearSmartCart(); setState(() => _result = null); },
            ),
        ],
      ),
      body: Column(
        children: [
          // Basket list
          Expanded(
            child: app.smartCart.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Text(
                        'Search groceries and tap "+ Cart" on any product.\nSmart Cart totals your whole basket at every store and sends you to the cheapest one.',
                        textAlign: TextAlign.center,
                        style: tx(context, 11.5, color: muted(context), h: 1.5),
                      ),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(11),
                    itemCount: app.smartCart.length + (stores.isEmpty ? 0 : 1 + partial.length) + (_error.isNotEmpty || notFound.isNotEmpty ? 1 : 0),
                    itemBuilder: (c, i) {
                      if (i < app.smartCart.length) {
                        final it = app.smartCart[i];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 7),
                          child: Box(
                          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
                          child: Row(
                            children: [
                              Expanded(child: Text(it.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 11.5, w: FontWeight.w800))),
                              _qtyBtn(Icons.remove_rounded, () => app.updateSmartCartQty(it.name, it.qty - 1)),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 9),
                                child: Text('${it.qty}', style: tx(context, 12, w: FontWeight.w900, mono: true)),
                              ),
                              _qtyBtn(Icons.add_rounded, () => app.updateSmartCartQty(it.name, it.qty + 1)),
                              const SizedBox(width: 7),
                              GestureDetector(
                                onTap: () => app.removeFromSmartCart(it.name),
                                child: Icon(Icons.close_rounded, size: 16, color: muted(context)),
                              ),
                            ],
                          ),
                          ),
                        );
                      }
                      final r = i - app.smartCart.length;
                      if (_error.isNotEmpty || notFound.isNotEmpty) {
                        final last = r == (stores.isEmpty ? 0 : partial.length);
                        if (last) {
                          return Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              if (_error.isNotEmpty)
                                Text(_error, style: tx(context, 10.5, w: FontWeight.w700, color: T1SColors.amber500)),
                              if (notFound.isNotEmpty)
                                Text('No store returned: ${notFound.join(', ')} — try a shorter product name.',
                                    style: tx(context, 10.5, w: FontWeight.w700, color: T1SColors.amber500)),
                            ]),
                          );
                        }
                      }
                      // Best full basket
                      if (r == 0 && bestIdx >= 0) return _storeCard(stores[bestIdx], true, items.length);
                      // Partial stores
                      final pi = (bestIdx >= 0 ? r - 1 : r);
                      if (pi < 0 || pi >= partial.length) return const SizedBox.shrink();
                      return _storeCard(partial[pi], false, items.length);
                    },
                  ),
          ),
          // Footer CTA
          if (app.smartCart.isNotEmpty)
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(11, 4, 11, 11),
                child: RedButton(
                  _comparing ? 'Checking every store\u2026' : 'Compare basket across stores',
                  onTap: _comparing ? null : _compare,
                  trailing: Icons.storefront_rounded,
                  dense: true,
                ),
              ),
            ),
        ],
      ),
      // Floating badge while basket has items on the grocery tab
      floatingActionButton: app.smartCart.isNotEmpty && app.vertical == 'grocery'
          ? FloatingActionButton.extended(
              backgroundColor: Colors.black87,
              onPressed: () {},
              icon: const Icon(Icons.shopping_cart_outlined, size: 16, color: Colors.white),
              label: Text('${app.smartCart.length} items', style: tx(context, 11, w: FontWeight.w900, color: Colors.white)),
            )
          : null,
    );
  }

  Widget _qtyBtn(IconData icon, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(border: Border.all(color: border(context)), borderRadius: BorderRadius.circular(7)),
          child: Icon(icon, size: 13, color: ink(context)),
        ),
      );

  Widget _storeCard(Map<String, dynamic> s, bool isBest, int totalItems) {
    final itemized = List<Map<String, dynamic>>.from(
        (s['itemized'] as List? ?? const []).map((x) => Map<String, dynamic>.from(x as Map)));
    final missing = List<String>.from(s['missing'] ?? const []);
    final firstUrl = itemized.map((x) => x['url']).whereType<String>().firstWhere((u) => u.isNotEmpty, orElse: () => '');
    final seller = '${s['seller']}';
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Box(
      padding: const EdgeInsets.all(11),
      borderColor: isBest ? T1SColors.green : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (isBest) ...[
                Icon(Icons.emoji_events_rounded, size: 14, color: T1SColors.green),
                const SizedBox(width: 4),
              ],
              Expanded(child: Text(seller, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 11.5, w: FontWeight.w900))),
              if (isBest) Pill('CHEAPEST FULL BASKET', bg: T1SColors.greenBg, fg: T1SColors.green, size: 8),
              const SizedBox(width: 6),
              Text(_rupees((s['total'] as num).toDouble()), style: tx(context, 13.5, w: FontWeight.w900, mono: true)),
            ],
          ),
          const SizedBox(height: 5),
          if (isBest)
            ...itemized.map((x) => Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: Row(
                    children: [
                      Expanded(child: Text('${x['qty']} \u00D7 ${x['name']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 10, color: muted(context)))),
                      Text(_rupees((x['price'] as num).toDouble()), style: tx(context, 10, w: FontWeight.w800, mono: true)),
                      if ('${x['url']}'.isNotEmpty) ...[
                        const SizedBox(width: 6),
                        GestureDetector(
                          onTap: () => openDeal('${x['url']}', sellerName: seller),
                          child: Text('Open', style: tx(context, 10, w: FontWeight.w800, color: T1SColors.red)),
                        ),
                      ],
                    ],
                  ),
                ))
          else
            Text(
              'Missing ${missing.length} item${missing.length > 1 ? 's' : ''}: ${missing.take(3).join(', ')}${missing.length > 3 ? '\u2026' : ''}  \u00B7  ${s['itemsCovered']}/$totalItems items',
              style: tx(context, 10, w: FontWeight.w700, color: T1SColors.amber500),
            ),
          if (isBest && firstUrl.isNotEmpty) ...[
            const SizedBox(height: 7),
            RedButton('Shop at $seller', onTap: () => openDeal(firstUrl, sellerName: seller), trailing: Icons.open_in_new_rounded, dense: true),
          ],
        ],
      ),
      ),
    );
  }
}
