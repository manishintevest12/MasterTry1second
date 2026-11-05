import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';
import '../../core/verticals.dart';
import 'kit.dart';

/// Website dark hero: #0D0714 background, dotted grid backdrop, engine pill,
/// 4 stat tiles, amber sub-header, gradient headline, Price Lens link bar
/// (Find Cheapest -> in-app product page), two launch buttons.
class HomeHero extends StatefulWidget {
  const HomeHero({super.key});

  @override
  State<HomeHero> createState() => _HomeHeroState();
}

class _HomeHeroState extends State<HomeHero> {
  final _lensCtrl = TextEditingController();
  final _state = AppState.instance;
  bool _busy = false;

  @override
  void dispose() {
    _lensCtrl.dispose();
    super.dispose();
  }

  Future<void> _findCheapest() async {
    final t = _lensCtrl.text.trim();
    if (t.isEmpty || _busy) return;
    setState(() => _busy = true);
    _state.openProduct(PendingSearch('ecommerce', t, productPage: true));
    setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    const merchants = ['amazon.in', 'flipkart.com', 'myntra.com', 'ajio.com', 'tatacliq.com', 'shopsy.in', 'croma.com', 'nykaa.com'];
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 26),
      decoration: const BoxDecoration(
        color: T1SColors.heroBg,
        border: Border(bottom: BorderSide(color: Color(0x663B0764))),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Sub-header badge
        Row(children: [
          const Icon(Icons.auto_awesome_rounded, size: 15, color: T1SColors.amber400),
          const SizedBox(width: 7),
          Expanded(
            child: Text("INDIA'S UNIFIED MULTI-VERTICAL METASEARCH ENGINE",
                style: tx(context, 10.5, w: FontWeight.w800, color: T1SColors.amber400, ls: 1.1)),
          ),
        ]),
        const SizedBox(height: 8),

        // Headline with gradient word
        Text.rich(
          TextSpan(
            text: 'One Second Is All It Takes to ',
            style: tx(context, 27, w: FontWeight.w900, color: Colors.white, h: 1.12),
            children: [
              WidgetSpan(
                alignment: PlaceholderAlignment.middle,
                child: ShaderMask(
                  shaderCallback: (r) => T1SColors.heroGradientText.createShader(r),
                  child: Text('Find the Lowest Price',
                      style: tx(context, 27, w: FontWeight.w900, color: Colors.white, h: 1.12)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Price Lens white card
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: T1SColors.slate200),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.25), blurRadius: 22, offset: const Offset(0, 8))],
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(
                child: Container(
                  height: 44,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(color: T1SColors.slate50, borderRadius: BorderRadius.circular(12), border: Border.all(color: T1SColors.slate200)),
                  child: Row(children: [
                    const Icon(Icons.link_rounded, size: 17, color: T1SColors.slate400),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _lensCtrl,
                        onSubmitted: (_) => _findCheapest(),
                        textInputAction: TextInputAction.search,
                        keyboardType: TextInputType.url,
                        style: tx(context, 13, color: T1SColors.slate900),
                        decoration: InputDecoration(
                          isCollapsed: true,
                          border: InputBorder.none,
                          hintText: 'Paste any product link',
                          hintStyle: tx(context, 12, color: T1SColors.slate400),
                          contentPadding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                    if (_lensCtrl.text.isNotEmpty)
                      GestureDetector(
                        onTap: () { setState(() => _lensCtrl.clear()); },
                        child: const Icon(Icons.close_rounded, size: 16, color: T1SColors.slate400),
                      ),
                    const SizedBox(width: 6),
                    GestureDetector(
                      onTap: () async {
                        final d = await Clipboard.getData('text/plain');
                        final t = d?.text?.trim() ?? '';
                        if (t.isEmpty) return;
                        setState(() => _lensCtrl.text = t);
                        if (RegExp(r'^https?://\S+$').hasMatch(t)) _findCheapest();
                      },
                      child: const Icon(Icons.content_paste_rounded, size: 16, color: T1SColors.slate400),
                      ),
                  ]),
                ),
              ),
              const SizedBox(width: 8),
              // Owner 23 Oct: lens ICON ONLY (no 'Find Cheapest' text) —
              // the paste area gets the freed horizontal space.
              Tooltip(
                message: 'Find Cheapest',
                child: GestureDetector(
                  onTap: _findCheapest,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
                    decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(10)),
                    child: _busy
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.search_rounded, size: 20, color: Colors.white),
                  ),
                ),
              ),
            ]),
            const SizedBox(height: 10),
            Row(children: [
              Text('SUPPORTS', style: tx(context, 8.5, w: FontWeight.w800, color: T1SColors.slate400, ls: 0.8)),
              const SizedBox(width: 8),
              Expanded(
                child: SizedBox(
                  height: 26,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: merchants.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 6),
                    itemBuilder: (_, i) => Container(
                      width: 26,
                      height: 26,
                      decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, border: Border.all(color: T1SColors.slate200)),
                      clipBehavior: Clip.antiAlias,
                      padding: const EdgeInsets.all(3),
                      child: CachedNetworkImage(
                        imageUrl: 'https://www.google.com/s2/favicons?domain=${merchants[i]}&sz=64',
                        fit: BoxFit.contain,
                        errorWidget: (_, __, ___) => Icon(Icons.language_rounded, size: 13, color: T1SColors.slate300),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text('+ any shopping site', style: tx(context, 9.5, w: FontWeight.w600, color: T1SColors.slate400)),
            ]),
          ]),
        ),
        const SizedBox(height: 16),

        // Launch buttons
        Wrap(spacing: 10, runSpacing: 10, children: [
          GestureDetector(
            onTap: () => _state.openVertical('flights'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: BoxDecoration(
                color: T1SColors.red,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [BoxShadow(color: T1SColors.red.withValues(alpha: 0.3), blurRadius: 16, offset: const Offset(0, 6))],
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                // Owner 23 Oct: registry-driven count (kVerticals = 12) —
                // the button can never show a stale count again.
                Text('Launch ${kVerticals.length}-Vertical Search', style: tx(context, 12, w: FontWeight.w900, color: Colors.white)),
                const SizedBox(width: 7),
                const Icon(Icons.arrow_forward_rounded, size: 15, color: Colors.white),
              ]),
            ),
          ),
          // Owner 25 Oct: Live Scanner Radar fully removed from the app.
        ]),
      ]),
    );
  }
}


class _PulseDot extends StatefulWidget {
  const _PulseDot({required this.color, required this.size});
  final Color color;
  final double size;
  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot> with SingleTickerProviderStateMixin {
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.maybeOf(context)?.disableAnimations ?? false) {
      return Container(width: widget.size, height: widget.size, decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle));
    }
    return FadeTransition(
      opacity: Tween(begin: 0.35, end: 1.0).animate(CurvedAnimation(parent: _c, curve: Curves.easeInOut)),
      child: Container(width: widget.size, height: widget.size, decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle)),
    );
  }
}
