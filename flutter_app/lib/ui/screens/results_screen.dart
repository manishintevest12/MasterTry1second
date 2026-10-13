import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/storage.dart';
import '../../core/theme.dart';
import '../../core/verticals.dart';
import '../widgets/common.dart';
import 'product_screen.dart';

/// Search results: offers grouped per canonical product, cheapest first.
class ResultsScreen extends StatefulWidget {
  const ResultsScreen({super.key, required this.query, required this.vertical});

  final String query;
  final String vertical;

  @override
  State<ResultsScreen> createState() => _ResultsScreenState();
}

class _ResultsScreenState extends State<ResultsScreen> {
  final _store = AppStore();
  SearchResponse? _res;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final api = await _store.api();
      final city = await _store.city();
      final pin = await _store.pincode();
      final res = await api.search(widget.query,
          vertical: widget.vertical, city: city, pincode: pin);
      if (!mounted) return;
      setState(() { _res = res; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = '$e'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final v = verticalById(widget.vertical);
    final dark = Theme.of(context).brightness == Brightness.dark;
    final groups = _res == null
        ? <OfferGroup>[]
        : groupByEntity(_res!.results)
            .where((g) => g.best.hasPrice)
            .toList()
          ..sort((a, b) => a.bestPrice.compareTo(b.bestPrice));

    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.query} · ${v.name}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
      body: SafeArea(
        child: LayoutBuilder(builder: (context, constraints) {
          final wide = constraints.maxWidth > 760;
          final maxW = wide ? 760.0 : constraints.maxWidth;
          Widget body;
          if (_loading) {
            body = const HonestNote('Searching across sites…', loading: true);
          } else if (_error != null) {
            body = HonestNote(
                'Try1Second is unreachable right now ($_error). No prices were invented.');
          } else if (groups.isEmpty) {
            body = HonestNote(
                'No verified offers for "${widget.query}" right now${_res?.honestNotice != null ? ' — ${_res!.honestNotice}' : ''}. '
                'Try1Second does not show unverified prices.');
          } else {
            body = ListView.builder(
              padding: const EdgeInsets.all(14),
              itemCount: groups.length + 1,
              itemBuilder: (context, i) {
                if (i == 0) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      children: [
                        Text('${groups.length} products · live results',
                            style: T1SText.label(context).copyWith(color: T1SColors.slate500)),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: dark ? const Color(0xFF1E293B) : T1SColors.slate100,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text('served: ${_res!.servedFrom}',
                              style: T1SText.label(context).copyWith(fontSize: 9.5)),
                        ),
                      ],
                    ),
                  );
                }
                final g = groups[i - 1];
                return _GroupCard(group: g, vertical: widget.vertical, query: widget.query);
              },
            );
          }
          return Center(
            child: SizedBox(
              width: maxW,
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: wide ? 0 : 14),
                child: body,
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _GroupCard extends StatelessWidget {
  const _GroupCard({required this.group, required this.vertical, required this.query});

  final OfferGroup group;
  final String vertical;
  final String query;

  @override
  Widget build(BuildContext context) {
    final best = group.best;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final more = group.offers.length - 1;

    return T1SCard(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => ProductScreen(group: group, vertical: vertical, query: query),
      )),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(best.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: T1SText.title(context)),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(inr(group.bestPrice), style: T1SText.price(context)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  best.seller.isEmpty ? 'Verified source' : best.seller,
                  style: T1SText.label(context).copyWith(color: T1SColors.red),
                ),
              ),
              if (best.listPrice > group.bestPrice)
                Text(inr(best.listPrice),
                    style: T1SText.body(context).copyWith(
                        decoration: TextDecoration.lineThrough,
                        color: T1SColors.slate400,
                        fontSize: 11)),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '+$more more site${more == 1 ? '' : 's'} compared',
            style: T1SText.body(context).copyWith(
                fontSize: 10.5,
                color: dark ? T1SColors.slate400 : T1SColors.slate500),
          ),
        ],
      ),
    );
  }
}
