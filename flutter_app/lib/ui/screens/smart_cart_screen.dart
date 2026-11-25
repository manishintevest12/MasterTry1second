import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';
import '../widgets/kit.dart';

/// Smart Cart (owner rule): the grocery basket is totalled at EVERY store
/// server-side (/api/smart-cart/compare) and ranked by FULL-basket cost.
/// 'Shop at store' hops through the /api/out pointer like every other deal.
///
/// OWNER 24 Nov ("smart cart 10-min grocery mai smart comparison kre mtlb agar maine aloo pyaaz add kiya tho wo
/// bataye cart mai ki sbse sasta blinkit mai hai yaa zepto mai aise"): two things were missing for that sentence.
///   1. The basket could only be filled from a feed card. It can now be TYPED ("aloo 1 kg"), so the comparison
///      starts from what the shopper actually wants to buy.
///   2. The answer was spread over four store cards. The server now returns ONE verdict sentence
///      ("Cheapest full basket: Blinkit — ₹65 · ₹10 less than Zepto") and this screen prints it verbatim, so the
///      website and the app can never phrase the same basket differently.
class SmartCartScreen extends StatefulWidget {
  const SmartCartScreen({super.key});

  @override
  State<SmartCartScreen> createState() => _SmartCartScreenState();
}

class _SmartCartScreenState extends State<SmartCartScreen> {
  bool _comparing = false;
  Map<String, dynamic>? _result;
  String _error = '';

  /// The item the shopper is typing into the basket.
  final _newItem = TextEditingController();

  @override
  void dispose() {
    _newItem.dispose();
    super.dispose();
  }

  void _addByName() {
    final name = _newItem.text.trim();
    if (name.isEmpty) return;
    AppState.instance.addToSmartCart(name);
    _newItem.clear();
    setState(() => _result = null); // an old total belongs to a different basket
    FocusScope.of(context).unfocus();
  }

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
    final verdict = _result?['verdict'] is Map ? Map<String, dynamic>.from(_result!['verdict'] as Map) : null;
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
          // Add by name
          Padding(
            padding: const EdgeInsets.fromLTRB(11, 10, 11, 0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _newItem,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _addByName(),
                    style: tx(context, 11.5, w: FontWeight.w800),
                    decoration: InputDecoration(
                      isDense: true,
                      hintText: 'Add an item \u2014 e.g. aloo 1 kg, pyaaz',
                      hintStyle: tx(context, 11.5, color: muted(context)),
                      filled: true,
                      fillColor: surface(context),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 11, vertical: 11),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(11), borderSide: BorderSide(color: border(context))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(11), borderSide: BorderSide(color: border(context))),
                    ),
                  ),
                ),
                const SizedBox(width: 7),
                GestureDetector(
                  onTap: _addByName,
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: T1SColors.slate900, borderRadius: BorderRadius.circular(11)),
                    child: const Icon(Icons.add_rounded, size: 18, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
          // Basket + comparison
          Expanded(
            child: app.smartCart.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Text(
                        'Type an item above (e.g. "aloo 1 kg"), or tap "+ Cart" on any grocery product.\nSmart Cart totals your whole basket at every store and tells you which one is cheapest.',
                        textAlign: TextAlign.center,
                        style: tx(context, 11.5, color: muted(context), h: 1.5),
                      ),
                    ),
                  )
                : ListView(
                    padding: const EdgeInsets.all(11),
                    children: [
                      ...app.smartCart.map((it) => Padding(
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
                          )),
                      if (verdict != null) _verdictCard(verdict),
                      if (bestIdx >= 0) _storeCard(stores[bestIdx], true, items.length),
                      ...partial.map((s) => _storeCard(s, false, items.length)),
                      if (_error.isNotEmpty || notFound.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            if (_error.isNotEmpty)
                              Text(_error, style: tx(context, 10.5, w: FontWeight.w700, color: T1SColors.amber500)),
                            if (notFound.isNotEmpty)
                              Text('No store returned: ${notFound.join(', ')} \u2014 try a shorter product name.',
                                  style: tx(context, 10.5, w: FontWeight.w700, color: T1SColors.amber500)),
                          ]),
                        ),
                    ],
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

  /// The server's one-sentence answer, printed verbatim (headline + detail).
  Widget _verdictCard(Map<String, dynamic> v) {
    final kind = '${v['kind']}';
    final isBest = kind == 'complete';
    final isPartial = kind == 'partial';
    final fg = isBest ? T1SColors.green : (isPartial ? T1SColors.amber500 : T1SColors.slate600);
    final bg = isBest ? T1SColors.greenBg : (isPartial ? const Color(0xFFFFFBEB) : T1SColors.slate100);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.all(11),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: fg.withValues(alpha: 0.35)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${v['headline'] ?? ''}', style: tx(context, 11.5, w: FontWeight.w900, color: fg)),
          if ('${v['detail'] ?? ''}'.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text('${v['detail']}', style: tx(context, 10, w: FontWeight.w700, color: fg)),
          ],
        ]),
      ),
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
                          onTap: () => openDeal('${x['url']}', sellerName: seller, price: (x['price'] is num) ? (x['price'] as num).toDouble() : null),
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
