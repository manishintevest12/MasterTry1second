import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/storage.dart';
import '../../core/theme.dart';
import '../../core/verticals.dart';
import '../widgets/common.dart';

/// AI Insights: paste any product page URL and get the live-scraped price
/// from the Try1Second engine (same scanner the website uses). No mock data:
/// a blocked page is reported honestly.
class AiInsightsScreen extends StatefulWidget {
  const AiInsightsScreen({super.key});

  @override
  State<AiInsightsScreen> createState() => _AiInsightsScreenState();
}

class _AiInsightsScreenState extends State<AiInsightsScreen> {
  final _url = TextEditingController();
  final _store = AppStore();
  bool _busy = false;
  String? _error;
  ScanResult? _result;

  @override
  void dispose() {
    _url.dispose();
    super.dispose();
  }

  Future<void> _scan() async {
    final url = _url.text.trim();
    if (url.isEmpty) return;
    if (!Uri.tryParse(url)!.isScheme('http') && !Uri.tryParse(url)!.isScheme('https')) {
      setState(() => _error = 'Paste a link starting with https://');
      return;
    }
    setState(() { _busy = true; _error = null; _result = null; });
    try {
      final api = await _store.api();
      final r = await api.scanUrl(url);
      if (!mounted) return;
      setState(() => _result = r);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e'.replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          Text('AI Insights', style: T1SText.display(context).copyWith(fontSize: 22)),
          const SizedBox(height: 4),
          Text('Paste a product link — we read the page live and show the real price.',
              style: T1SText.body(context).copyWith(color: T1SColors.slate500)),
          const SizedBox(height: 16),

          // URL scanner
          T1SCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('URL PRICE SCANNER', style: T1SText.label(context).copyWith(letterSpacing: 0.6)),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _url,
                        onSubmitted: (_) => _scan(),
                        keyboardType: TextInputType.url,
                        textInputAction: TextInputAction.go,
                        decoration: const InputDecoration(
                          prefixIcon: Icon(Icons.link, size: 18),
                          hintText: 'https://www.amazon.in/dp/…',
                          isDense: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    SizedBox(
                      height: 44,
                      child: T1SButton.primary(
                        label: _busy ? 'Scanning…' : 'Scan',
                        icon: _busy
                            ? const SizedBox(width: 13, height: 13, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.bolt, size: 15),
                        onTap: _busy ? null : _scan,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          if (_error != null)
            T1SCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.info_outline, size: 18, color: T1SColors.red),
                  const SizedBox(width: 10),
                  Expanded(child: Text(_error!, style: T1SText.body(context))),
                ],
              ),
            ),

          if (_result != null) ...[
            _ResultCard(result: _result!),
            const SizedBox(height: 12),
          ],

          // How it works
          const SectionHeader('HOW IT WORKS'),
          T1SCard(
            child: Column(
              children: const [
                _HowRow(icon: Icons.travel_explore, text: 'The engine opens the page you paste and extracts the live price.'),
                _HowRow(icon: Icons.fact_check_outlined, text: 'Only verified prices are shown — a blocked page is reported as unavailable.'),
                _HowRow(icon: Icons.compare_arrows, text: 'Search the same product in Compare to see it across every platform.'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({required this.result});
  final ScanResult result;

  @override
  Widget build(BuildContext context) {
    final v = verticalById(result.vertical);
    final hasPrice = result.price > 0;
    return T1SCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(v.icon, size: 16, color: T1SColors.red),
              const SizedBox(width: 6),
              Text(v.name.toUpperCase(), style: T1SText.label(context).copyWith(letterSpacing: 0.5)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(color: T1SColors.greenBg, borderRadius: BorderRadius.circular(999)),
                child: const Text('LIVE SCAN', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: T1SColors.green)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(result.title.isEmpty ? 'Untitled page' : result.title,
              style: T1SText.headline(context).copyWith(fontSize: 15),
              maxLines: 2, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 4),
          Text(result.provider, style: T1SText.body(context).copyWith(color: T1SColors.slate500)),
          const SizedBox(height: 12),
          Row(
            children: [
              Text(hasPrice ? '₹${_fmt(result.price)}' : 'Price unavailable',
                  style: T1SText.price(context).copyWith(color: hasPrice ? T1SColors.ink : T1SColors.slate400)),
              const Spacer(),
              T1SButton.secondary(
                label: 'Open page',
                icon: const Icon(Icons.open_in_new, size: 13),
                onTap: () async {
                  final uri = Uri.tryParse(result.url ?? '');
                  if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _fmt(double n) {
    final i = n.round();
    return i == n ? i.toString() : n.toStringAsFixed(2);
  }
}

class _HowRow extends StatelessWidget {
  const _HowRow({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 17, color: T1SColors.red),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: T1SText.body(context).copyWith(fontSize: 11.5))),
        ],
      ),
    );
  }
}
