import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/services.dart';

import '../../core/api.dart';
import '../../core/app_state.dart';
import '../../core/auth.dart';
import '../../core/theme.dart';
import '../widgets/kit.dart';
import '../widgets/home_showcase.dart';
/// Rewards Hub (website RewardsHub + OffersHub): wallet with OmniPoints and
/// free spins, the real Spin & Earn wheel, referral link, and the Deals &
/// Coupons hub with per-store tiles (UP TO X% OFF) and live deal cards.
/// Every deal routes through the server (affiliate injection stays server-side).
class RewardsScreen extends StatefulWidget {
  const RewardsScreen({super.key, this.initialTab = 0});

  /// Website parity (21 Oct): home Coupons card lands on Deals & Coupons,
  /// Rewards card lands on Spin & Earn. 0/1/2 like the TabBar.
  final int initialTab;

  @override
  State<RewardsScreen> createState() => _RewardsScreenState();
}

class _RewardsScreenState extends State<RewardsScreen> {
  final _state = AppState.instance;

  @override
  void initState() {
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      initialIndex: widget.initialTab.clamp(0, 2),
      length: 3,
      child: Column(children: [
        Container(
          color: isDark(context) ? T1SColors.slate900 : Colors.white,
          child: TabBar(
            labelColor: T1SColors.red,
            unselectedLabelColor: muted(context),
            indicatorColor: T1SColors.red,
            labelStyle: tx(context, 12.5, w: FontWeight.w900),
            tabs: const [
              Tab(icon: Icon(Icons.local_offer_rounded, size: 15), text: 'Deals & Coupons'),
              Tab(icon: Icon(Icons.casino_rounded, size: 15), text: 'Spin & Earn'),
              Tab(icon: Icon(Icons.group_add_rounded, size: 15), text: 'Refer & Earn'),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(children: [
            _DealsHub(state: _state),
            const _SpinTab(),
            const _ReferralTab(),
          ]),
        ),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// Deals hub
// ---------------------------------------------------------------------------

class _DealsHub extends StatefulWidget {
  const _DealsHub({required this.state});
  final AppState state;

  @override
  State<_DealsHub> createState() => _DealsHubState();
}

class _DealsHubState extends State<_DealsHub> {
  List<Deal>? _deals;
  List<RewardTopPick>? _picks; // Rewards Top Picks (owner 21 Oct): one per vertical
  // Owner 23 Oct: 'Special Offers For You' lives HERE (Rewards tab), not on
  // the homepage — the same showcase coupon section, rendered as CouponCards.
  List<ShowcaseItem> _special = const [];
  Map<String, int> _counts = const {};
  String? _error;
  String? _merchant;
  String? _vertical; // null = All
  String? _kind; // null = All
  bool _busy = false;
  final _ctrl = TextEditingController();

  static const _kinds = <String, String>{
    'coupon': 'Coupons', 'bank_offer': 'Bank offers', 'sale': 'Sales', 'cashback': 'Cashback',
  };

  @override
  void initState() {
    super.initState();
    _load();
    // Top Picks rail: admin-curated picks + live auto-picks, all /api/out redirects.
    fetchRewardsTopPicks(widget.state.api).then((picks) {
      if (mounted) setState(() => _picks = picks);
    }).catchError((_) {}); // honest: rail simply stays hidden on failure
    fetchHomeShowcase(widget.state.api).then((sections) {
      final special = sections.where((x) => x.id == 'special').expand((x) => x.items).toList();
      if (mounted && special.isNotEmpty) setState(() => _special = special);
    }).catchError((_) {}); // honest: strip stays hidden on failure
  }

  Future<void> _load({String? merchant, String? vertical}) async {
    setState(() => _busy = true);
    try {
      final feed = await widget.state.api.deals(
        merchant: (merchant ?? _merchant ?? '').isEmpty ? null : (merchant ?? _merchant),
        vertical: vertical ?? _vertical,
        limit: 200,
      );
      if (mounted) {
        setState(() {
          _deals = feed.deals;
          _counts = feed.counts;
          _error = null;
          if (merchant != null) _merchant = merchant.isEmpty ? null : merchant;
          if (vertical != null) _vertical = vertical.isEmpty ? null : vertical;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e'.replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Owner decision: a deal without a real image never renders.
    final deals = (_deals ?? const <Deal>[]).where((d) => (d.imageUrl ?? '').startsWith('http')).toList();
    final q = _ctrl.text.toLowerCase();
    final filtered = q.isEmpty
        ? deals
        : deals.where((d) =>
            d.title.toLowerCase().contains(q) ||
            d.merchantName.toLowerCase().contains(q) ||
            (d.description ?? '').toLowerCase().contains(q)).toList();

    // vertical chips from live data (server counts first, local derivation as fallback)
    final vCounts = <String, int>{};
    for (final d in deals) {
      final v = d.verticalLabel;
      if (v.isNotEmpty) vCounts[v] = (vCounts[v] ?? 0) + 1;
    }
    final serverCounts = _counts.isNotEmpty ? _counts : vCounts;
    final vLabel = <String, String>{
      'ecommerce': 'Shopping', 'flights': 'Flights', 'hotels': 'Hotels', 'bus': 'Bus', 'cab': 'Cab',
      'food': 'Food', 'grocery': 'Grocery', 'movies': 'Movies', 'loans': 'Loans', 'insurance': 'Insurance', 'creditcards': 'Cards',
    };
    final chipVerticals = (serverCounts.isNotEmpty ? serverCounts.keys : vCounts.keys).toList()..sort((a, b) => (serverCounts[b] ?? vCounts[b] ?? 0).compareTo(serverCounts[a] ?? vCounts[a] ?? 0));

    // per-merchant tiles filtered by the active vertical
    final tilesForVertical = deals.where((d) => _vertical == null || d.verticalLabel == _vertical).toList();
    final byMerchant = <String, List<Deal>>{};
    for (final d in tilesForVertical) {
      byMerchant.putIfAbsent(d.merchantName, () => []).add(d);
    }
    final tiles = byMerchant.entries.toList()
      ..sort((a, b) {
        final ap = a.value.map((d) => d.percent).reduce(math.max);
        final bp = b.value.map((d) => d.percent).reduce(math.max);
        return bp.compareTo(ap);
      });

    return RefreshIndicator(
      color: T1SColors.red,
      onRefresh: () => _load(merchant: _merchant ?? ''),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
        children: [
          if ((_picks ?? const []).isNotEmpty) ...[
            _TopPicksRail(picks: _picks!, state: widget.state),
            const SizedBox(height: 14),
          ],
          if (_special.isNotEmpty) ...[
            SectionTitle('SPECIAL OFFERS FOR YOU',
                trailing: Text('${_special.length} offers',
                    style: tx(context, 10, color: muted(context)))),
            SizedBox(
              height: 164,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.only(top: 8, bottom: 4),
                itemCount: _special.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (c, i) => SizedBox(
                  width: 150,
                  height: 164,
                  child: CouponCard(item: _special[i], state: widget.state),
                ),
              ),
            ),
            const SizedBox(height: 18),
          ],
          Row(children: [
            Expanded(
              child: TextField(
                controller: _ctrl,
                decoration: const InputDecoration(hintText: 'Search deals, coupons, stores…', isDense: true, prefixIcon: Icon(Icons.search, size: 16)),
                style: tx(context, 12),
                onSubmitted: (_) => setState(() {}),
              ),
            ),
            if (_merchant != null) ...[
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => _load(merchant: ''),
                child: Pill('$_merchant ×', fg: T1SColors.red, bg: T1SColors.red50, size: 10),
              ),
            ],
            const SizedBox(width: 8),
            if (_busy) const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: T1SColors.red)),
          ]),
          const SizedBox(height: 10),

          // vertical filter chips
          if (chipVerticals.isNotEmpty) ...[
            SizedBox(
              height: 30,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: chipVerticals.length + 1,
                separatorBuilder: (_, __) => const SizedBox(width: 6),
                itemBuilder: (c, i) {
                  if (i == 0) {
                    return _filterChip(c, label: 'All', selected: _vertical == null, onTap: () => _load(vertical: ''));
                  }
                  final v = chipVerticals[i - 1];
                  final n = serverCounts[v] ?? 0;
                  return _filterChip(c, label: '${vLabel[v] ?? v} ($n)', selected: _vertical == v, onTap: () => _load(vertical: v));
                },
              ),
            ),
            const SizedBox(height: 8),
          ],

          // kind filter chips
          SizedBox(
            height: 30,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _kinds.length + 1,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (c, i) {
                if (i == 0) {
                  return _filterChip(c, label: 'All types', selected: _kind == null, onTap: () => setState(() => _kind = null));
                }
                final k = _kinds.keys.elementAt(i - 1);
                final selected = _kind == k;
                return _filterChip(c, label: _kinds[k]!, selected: selected, onTap: () => setState(() => _kind = selected ? null : k));
              },
            ),
          ),
          const SizedBox(height: 12),

          if (_error != null)
            Box(padding: const EdgeInsets.all(12), child: Text(_error!, style: tx(context, 11.5, color: T1SColors.red))),

          if (deals.isEmpty && _busy)
            Column(children: [ for (var i = 0; i < 3; i++) ...[
              Box(padding: const EdgeInsets.all(12), child: Row(children: [
                Container(width: 64, height: 64, decoration: BoxDecoration(color: muted(context).withOpacity(.08), borderRadius: BorderRadius.circular(12))),
                const SizedBox(width: 10),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(width: 140, height: 12, decoration: BoxDecoration(color: muted(context).withOpacity(.08), borderRadius: BorderRadius.circular(4))),
                  const SizedBox(height: 6),
                  Container(width: 90, height: 10, decoration: BoxDecoration(color: muted(context).withOpacity(.08), borderRadius: BorderRadius.circular(4))),
                ]),
              ])),
              const SizedBox(height: 10),
            ]]),

          if (deals.isEmpty && !_busy && _error == null)
            Box(
              padding: const EdgeInsets.all(22),
              child: Column(children: [
                Icon(Icons.local_offer_outlined, size: 30, color: T1SColors.slate300),
                const SizedBox(height: 10),
                Text('No live offers for this category right now', style: tx(context, 13.5, w: FontWeight.w900)),
                const SizedBox(height: 5),
                Text('The engine re-acquires fresh deals automatically.', textAlign: TextAlign.center, style: tx(context, 11, color: muted(context))),
              ]),
            ),

          if (tiles.isNotEmpty) ...[
            SectionTitle('STORES · LIVE DEALS', trailing: Text('${deals.length} deals', style: tx(context, 10, color: muted(context)))),
            SizedBox(
              height: 116,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: tiles.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (c, i) {
                  final e = tiles[i];
                  final maxPct = e.value.map((d) => d.percent).reduce(math.max);
                  return GestureDetector(
                    onTap: () => _load(merchant: e.key),
                    child: _StoreTile(name: e.key, count: e.value.length, maxPct: maxPct, deal: e.value.firstWhere((d) => d.imageUrl != null, orElse: () => e.value.first)),
                  );
                },
              ),
            ),
            const SizedBox(height: 18),
          ],

          if (filtered.isNotEmpty) ...[
            SectionTitle(_merchant == null ? 'LIVE DEALS · AUTO-ACQUIRED' : '$_merchant DEALS'),
            for (final d in _kindFiltered(filtered)) ...[
              DealCard(deal: d, apiBase: widget.state.api.baseUrl),
              const SizedBox(height: 10),
            ],
          ],
        ],
      ),
    );
  }

  List<Deal> _kindFiltered(List<Deal> deals) {
    final base = _kind == null ? deals : deals.where((d) => d.kind == _kind).toList();
    return base;
  }

  Widget _filterChip(BuildContext context, {required String label, required bool selected, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: () { HapticFeedback.selectionClick(); onTap(); },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? T1SColors.red : (isDark(context) ? T1SColors.slate800 : Colors.white),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? T1SColors.red : border(context)),
        ),
        child: Text(label, style: tx(context, 10.5, w: FontWeight.w800, color: selected ? Colors.white : null)),
      ),
    );
  }
}

class _StoreTile extends StatelessWidget {
  const _StoreTile({required this.name, required this.count, required this.maxPct, required this.deal});
  final String name;
  final int count;
  final int maxPct;
  final Deal deal;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 128,
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: isDark(context) ? T1SColors.slate900 : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: border(context)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Owner 22 Oct: promo banners are wide — contain the full artwork
        // instead of cover-cropping it to a sliver.
        Expanded(child: NetImage(deal.imageUrl, fit: BoxFit.contain, fallbackIcon: Icons.storefront_outlined, width: 112)),
        const SizedBox(height: 6),
        if (maxPct > 0)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: T1SColors.greenBg, borderRadius: BorderRadius.circular(5)),
            child: Text('UP TO $maxPct% OFF', style: tx(context, 8.5, w: FontWeight.w900, color: T1SColors.emerald600)),
          ),
        const SizedBox(height: 4),
        Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 10.5, w: FontWeight.w900)),
        Text('$count live deal${count == 1 ? '' : 's'}', style: tx(context, 8.5, color: muted(context))),
      ]),
    );
  }
}
/// Clean official-brand logo domain for a merchant (owner 21 Oct: bank offers
/// show the seller's crisp logo, not the blurry favicon scrape).
String _logoDomainOf(String merchant) {
  const map = {
    'amazon': 'amazon.in',
    'flipkart': 'flipkart.com',
    'myntra': 'myntra.com',
    'ajio': 'ajio.com',
    'tatacliq': 'tatacliq.com',
    'croma': 'croma.com',
    'xiaomi': 'mi.com',
    'oppo': 'oppo.com',
    'realme': 'realme.com',
    'lenovo': 'lenovo.com',
    'meesho': 'meesho.com',
    'nykaa': 'nykaa.com',
    'blinkit': 'blinkit.com',
    'zepto': 'zepto.com',
    'bigbasket': 'bigbasket.com',
    'jiomart': 'jiomart.com',
    'zomato': 'zomato.com',
    'swiggy': 'swiggy.com',
    'domino': 'dominos.co.in',
    'bookmyshow': 'bookmyshow.com',
    'makemytrip': 'makemytrip.com',
    'goibibo': 'goibibo.com',
  };
  final m = merchant.toLowerCase();
  for (final e in map.entries) {
    if (m.contains(e.key)) return e.value;
  }
  return '';
}

/// Logo-registry key — mirrors the server's merchantKeyOf(): lowercase,
/// strip the domain suffix, first word + aliases.
String _logoKeyOf(String merchant) {
  final m = merchant.toLowerCase().replaceAll(RegExp(r'\.(com|in|co\.in)\b'), '').replaceAll(RegExp(r'[^a-z0-9]+'), ' ').trim();
  final first = m.isEmpty ? '' : m.split(' ').first;
  const alias = {'amzn': 'amazon', 'tata': 'tatacliq', 'bms': 'bookmyshow', 'book': 'bookmyshow', 'paytm': 'district'};
  return alias[first] ?? first;
}

class DealCard extends StatelessWidget {
  const DealCard({required this.deal, required this.apiBase});
  final Deal deal;
  final String apiBase;

  @override
  Widget build(BuildContext context) {
    final hasCode = deal.code != null && deal.code!.isNotEmpty;
    return Box(
      padding: EdgeInsets.zero,
      clip: true,
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        DealArt(deal: deal, apiBase: apiBase),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Pill(deal.merchantName, fg: T1SColors.red, bg: T1SColors.red50, size: 8.5),
                const SizedBox(width: 5),
                Pill(deal.kind.replaceAll('_', ' ').toUpperCase(), bg: isDark(context) ? T1SColors.slate800 : T1SColors.slate100, fg: muted(context), size: 8),
              ]),
              const SizedBox(height: 6),
              Text(deal.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: tx(context, 12.5, w: FontWeight.w800, h: 1.25)),
              if (deal.discountText != null && deal.discountText!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(color: T1SColors.greenBg, borderRadius: BorderRadius.circular(6)),
                  child: Text(deal.discountText!, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 10, w: FontWeight.w900, color: T1SColors.emerald600)),
                ),
              ],
              const SizedBox(height: 6),
              Text(deal.validTill != null && deal.validTill!.isNotEmpty ? 'Valid till ${deal.validTill}' : 'Live now', style: tx(context, 9.5, color: muted(context))),
              const SizedBox(height: 9),
              Row(children: [
                if (hasCode)
                  Expanded(
                    child: _CopyCodePill(code: deal.code!),
                  )
                else
                  const Spacer(),
                const SizedBox(width: 8),
                RedButton('Get Deal', onTap: deal.goUrl.isEmpty ? null : () => openDeal(deal.goUrl), dense: true),
              ]),
            ]),
          ),
        ),
      ]),
    );
  }
}

/// Card art. Bank offers (owner 21 Oct): the seller's crisp OFFICIAL logo on a
/// clean tile — the scraped favicon image is blurry at this size. Every other
/// deal kind keeps its real acquired image.
class DealArt extends StatelessWidget {
  const DealArt({required this.deal, required this.apiBase});
  final Deal deal;
  final String apiBase;

  @override
  Widget build(BuildContext context) {
    final logoDomain = deal.kind == 'bank_offer' ? _logoDomainOf(deal.merchantName) : '';
    if (logoDomain.isEmpty) {
      // FIX (owner 22 Oct: "image sahi ni hai"): deal promo art is WIDE. The old
      // BoxFit.cover in this portrait slot cropped it to a meaningless sliver;
      // contain shows the full acquired banner, honestly, on a quiet surface.
      return NetImage(deal.imageUrl, width: 96, height: 118, fit: BoxFit.contain, fallbackIcon: Icons.sell_outlined);
    }
    // Owner rule (21/22 Oct): contained 72px rounded-square logo tile with white
    // padding, border + small Verified badge. Source chain: admin-uploaded logo
    // (MySQL registry via /api/logos/<key>) -> brand domain icon -> the deal's
    // own image (contained, never cover-cropped) -> placeholder icon.
    final key = _logoKeyOf(deal.merchantName);
    final adminLogo = apiBase.isEmpty ? '' : '$apiBase/api/logos/$key';
    Widget logo;
    if (adminLogo.isNotEmpty) {
      logo = CachedNetworkImage(
        imageUrl: adminLogo,
        fit: BoxFit.contain,
        errorWidget: (_, __, ___) => _domainIcon(logoDomain, deal),
      );
    } else {
      logo = _domainIcon(logoDomain, deal);
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          alignment: Alignment.center,
          padding: const EdgeInsets.all(8),
          child: logo,
        ),
        const SizedBox(height: 5),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(999)),
          child: const Text('VERIFIED', style: TextStyle(fontSize: 7.5, fontWeight: FontWeight.w900, color: Color(0xFF4B5563), letterSpacing: .5)),
        ),
      ],
    );
  }

  /// Brand-domain icon (last-resort chain before the deal image fallback).
  Widget _domainIcon(String logoDomain, Deal deal) {
    return CachedNetworkImage(
      imageUrl: 'https://icons.duckduckgo.com/ip3/$logoDomain.ico',
      fit: BoxFit.contain,
      errorWidget: (_, __, ___) => NetImage(deal.imageUrl, width: 72, height: 72, fit: BoxFit.contain, fallbackIcon: Icons.sell_outlined),
    );
  }
}

class _CopyCodePill extends StatefulWidget {
  const _CopyCodePill({required this.code});
  final String code;

  @override
  State<_CopyCodePill> createState() => _CopyCodePillState();
}

class _CopyCodePillState extends State<_CopyCodePill> {
  bool _copied = false;

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: widget.code));
    HapticFeedback.selectionClick();
    if (mounted) setState(() => _copied = true);
    toast(context, 'Code copied');
    Future.delayed(const Duration(seconds: 2), () { if (mounted) setState(() => _copied = false); });
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _copy,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: _copied ? T1SColors.emerald600 : (isDark(context) ? T1SColors.slate800 : T1SColors.slate50),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: _copied ? T1SColors.emerald600 : T1SColors.red.withOpacity(.45)),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(_copied ? Icons.check_rounded : Icons.copy_rounded, size: 12, color: _copied ? Colors.white : T1SColors.red),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              _copied ? 'Copied' : 'Copy ${widget.code}',
              maxLines: 1, overflow: TextOverflow.ellipsis,
              style: tx(context, 10, w: FontWeight.w900, mono: true, color: _copied ? Colors.white : T1SColors.red),
            ),
          ),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Spin & Earn
// ---------------------------------------------------------------------------

class _SpinTab extends StatefulWidget {
  const _SpinTab();

  @override
  State<_SpinTab> createState() => _SpinTabState();
}

class _SpinTabState extends State<_SpinTab> with SingleTickerProviderStateMixin {
  final _state = AppState.instance;
  final _auth = AuthService.instance;
  RewardsSummary? _summary;
  SpinPrize? _prize;
  bool _spinning = false;
  bool _busy = false;
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 3));

  @override
  void initState() {
    super.initState();
    _auth.addListener(_load);
    _load();
  }

  @override
  void dispose() {
    _c.dispose();
    _auth.removeListener(_load);
    super.dispose();
  }

  Future<void> _load() async {
    if (!_auth.signedIn || _auth.token == null) {
      if (mounted) setState(() => _summary = null);
      return;
    }
    try {
      final s = await _state.api.rewards(_auth.token!);
      if (mounted) setState(() => _summary = s);
      _state.points = s.validPoints;
      _state.spinsAvailable = s.availableSpins;
      _state.refreshUi();
    } catch (_) {/* honest: keep last wallet */}
  }

  Future<void> _spin() async {
    if (_busy || _spinning) return;
    if (!_auth.signedIn || _auth.token == null) {
      toast(context, 'Sign in to spin the wheel', error: true);
      return;
    }
    if ((_summary?.availableSpins ?? 0) < 1) {
      toast(context, 'You need ${_summary?.pointsPerSpin ?? 100} points for a spin');
      return;
    }
    setState(() { _spinning = true; _prize = null; });
    _c.forward(from: 0);
    try {
      final p = await _state.api.spin(_auth.token!);
      await Future.delayed(const Duration(milliseconds: 3100));
      if (mounted) setState(() { _prize = p; _spinning = false; });
      await _load();
      await _state.refreshBadges();
    } catch (e) {
      if (mounted) setState(() => _spinning = false);
      toast(context, '$e'.replaceFirst('Exception: ', ''), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = _summary;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        Box(
          padding: const EdgeInsets.all(18),
          child: Column(children: [
            Row(children: [
              Expanded(child: _wallet('OmniPoints', '${s?.validPoints ?? _state.points}', T1SColors.red, 22)),
              Expanded(child: _wallet('Free Spins', '${s?.availableSpins ?? 0}', T1SColors.emerald600, 22)),
            ]),
            if (s != null) ...[
              const SizedBox(height: 6),
              Text('${s.pointsPerSpin} points = 1 spin', style: tx(context, 10, color: muted(context))),
            ],
          ]),
        ),
        const SizedBox(height: 18),
        Box(
          padding: const EdgeInsets.all(22),
          child: Column(children: [
            RotationTransition(
              turns: _spinning
                  ? Tween(begin: 0.0, end: 5.0).animate(CurvedAnimation(parent: _c, curve: Curves.easeOutExpo))
                  : const AlwaysStoppedAnimation<double>(0.0),
              child: Container(
                width: 168,
                height: 168,
                decoration: const BoxDecoration(shape: BoxShape.circle, gradient: T1SColors.badgeGradient, boxShadow: [BoxShadow(color: Color(0x33E7000B), blurRadius: 26, spreadRadius: 3)]),
                child: const Icon(Icons.casino_rounded, size: 64, color: Colors.white),
              ),
            ),
            const SizedBox(height: 16),
            Text(_prize != null ? 'You won: ${_prize!.name}' : (_spinning ? 'Spinning…' : 'Spin & Earn'),
                style: tx(context, 15, w: FontWeight.w900, color: _prize != null ? T1SColors.emerald600 : ink(context))),
            if (_prize?.description != null) ...[
              const SizedBox(height: 4),
              Text(_prize!.description!, textAlign: TextAlign.center, style: tx(context, 11.5, color: muted(context))),
            ],
            const SizedBox(height: 16),
            RedButton(_spinning ? 'Spinning…' : 'SPIN THE WHEEL', onTap: _spin, loading: _spinning, expand: true),
            if (!_auth.signedIn) ...[
              const SizedBox(height: 8),
              Text('Sign in from Profile to unlock spins.', style: tx(context, 10, color: muted(context))),
            ],
          ]),
        ),
        const SizedBox(height: 16),
        Box(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('HOW EARNING WORKS', style: tx(context, 10.5, w: FontWeight.w900, ls: 0.7, color: muted(context))),
            const SizedBox(height: 10),
            _row('1', 'Every merchant redirection earns 1 OmniPoint.'),
            _row('2', 'Every friend who joins via your referral link adds 1 point.'),
            _row('3', 'Redeem ${s?.pointsPerSpin ?? 100} points per spin for vouchers & cashback.'),
          ]),
        ),
      ],
    );
  }

  Widget _row(String n, String t) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(width: 18, height: 18, alignment: Alignment.center, decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(6)), child: Text(n, style: tx(context, 9, w: FontWeight.w900, color: Colors.white))),
          const SizedBox(width: 8),
          Expanded(child: Text(t, style: tx(context, 11.5, color: muted(context)))),
        ]),
      );

  Widget _wallet(String label, String value, Color color, double size) =>
      Builder(builder: (c) => Column(children: [
            Text(value, style: tx(c, size, w: FontWeight.w900, color: color, mono: true)),
            const SizedBox(height: 2),
            Text(label, style: tx(c, 10, w: FontWeight.w800, color: muted(c))),
          ]));
}

// ---------------------------------------------------------------------------
// Referral
// ---------------------------------------------------------------------------

class _ReferralTab extends StatefulWidget {
  const _ReferralTab();

  @override
  State<_ReferralTab> createState() => _ReferralTabState();
}

class _ReferralTabState extends State<_ReferralTab> {
  final _state = AppState.instance;
  final _auth = AuthService.instance;
  String? _code;
  String? _link;
  int _referredCount = 0;
  int _points = 0;
  String? _referredByCode;
  String? _error;
  bool _busy = false;
  final _applyCtl = TextEditingController();
  String? _applyMsg;
  bool _applyOk = false;
  bool _applying = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _applyCtl.dispose();
    super.dispose();
  }

  /// Owner 23 Oct: real referral codes — GET /api/rewards/referral/me mints a
  /// T1S-XXXXXX idempotently and returns the wallet stats.
  Future<void> _load() async {
    final t = _auth.token;
    if (!_auth.signedIn || t == null) return;
    setState(() => _busy = true);
    try {
      final me = await _state.api.referralMe(t);
      if (mounted) {
        setState(() {
          _code = me?['code']?.toString();
          _link = me?['link']?.toString();
          _referredCount = (me?['referredCount'] as num?)?.toInt() ?? 0;
          _points = (me?['points'] as num?)?.toInt() ?? 0;
          _referredByCode = me?['referredByCode']?.toString();
          _error = me == null ? 'Could not reach the referral engine — tap Refresh.' : null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e'.replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Apply a friend's code (once per account) — +1 point to the friend.
  Future<void> _apply() async {
    final t = _auth.token;
    final code = _applyCtl.text.trim().toUpperCase();
    if (t == null || code.isEmpty || _applying) return;
    setState(() => _applying = true);
    final err = await _state.api.referralApply(t, code);
    if (mounted) {
      setState(() {
        _applying = false;
        _applyOk = err == null;
        _applyMsg = err ?? 'Done! $code credited +1 point to your friend.';
        if (err == null) {
          _referredByCode = code;
          _applyCtl.clear();
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final dark = isDark(context);
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        // ── Your referral code card (web parity: ReferAndEarn) ──
        Box(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                const Icon(Icons.group_add_rounded, size: 18, color: T1SColors.orange500),
                const SizedBox(width: 8),
                Expanded(child: Text('Refer & Earn', style: tx(context, 15, w: FontWeight.w900))),
              ]),
              const SizedBox(height: 8),
              Text('Earn 1 Point for Every Referral. Spin at 100 Points.',
                  style: tx(context, 12.5, w: FontWeight.w800, h: 1.3)),
              const SizedBox(height: 6),
              Text('Share your code — every friend who joins adds 1 point to your wallet.',
                  style: tx(context, 11, color: muted(context), h: 1.45)),
              const SizedBox(height: 14),
              if (!_auth.signedIn)
                Text('Sign in from Profile to get your T1S referral code.', style: tx(context, 11.5, color: muted(context)))
              else ...[
                if (_busy && _code == null)
                  const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: T1SColors.red)),
                if (_error != null) Text(_error!, style: tx(context, 11.5, color: T1SColors.red)),
                if (_code != null) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: dark ? T1SColors.slate800 : T1SColors.slate50,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: border(context)),
                    ),
                    child: Text(_code!, style: tx(context, 20, w: FontWeight.w900, ls: 3, color: T1SColors.red, mono: true)),
                  ),
                  if (_link != null) ...[
                    const SizedBox(height: 6),
                    Text(_link!, style: tx(context, 10, mono: true, color: muted(context)), maxLines: 2, overflow: TextOverflow.ellipsis),
                  ],
                  const SizedBox(height: 10),
                  Row(children: [
                    Expanded(
                      child: RedButton(
                        'Copy code & link',
                        onTap: () {
                          Clipboard.setData(ClipboardData(text: '${_code ?? ''}\n${_link ?? ''}'));
                          toast(context, 'Referral code & link copied');
                        },
                        icon: Icons.copy_rounded,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(child: T1SOutlineButton('Refresh', onTap: _load)),
                  ]),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                      child: Box(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Column(children: [
                          Text('$_referredCount', style: tx(context, 17, w: FontWeight.w900)),
                          const SizedBox(height: 2),
                          Text('FRIENDS JOINED', style: tx(context, 9, w: FontWeight.w800, ls: .6, color: muted(context))),
                        ]),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Box(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Column(children: [
                          Text('$_points', style: tx(context, 17, w: FontWeight.w900)),
                          const SizedBox(height: 2),
                          Text('VALID POINTS', style: tx(context, 9, w: FontWeight.w800, ls: .6, color: muted(context))),
                        ]),
                      ),
                    ),
                  ]),
                ],
              ],
            ],
          ),
        ),
        const SizedBox(height: 14),
        // ── Apply a friend's code (once per account) ──
        Box(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Icon(Icons.card_giftcard_rounded, size: 16, color: T1SColors.red),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    !_auth.signedIn
                        ? "Have a friend's code?"
                        : (_referredByCode != null ? 'You joined with $_referredByCode' : "Have a friend's code?"),
                    style: tx(context, 12.5, w: FontWeight.w900),
                  ),
                ),
              ]),
              if (_auth.signedIn && _referredByCode == null) ...[
                const SizedBox(height: 10),
                Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
                  Expanded(
                    child: TextField(
                      controller: _applyCtl,
                      textCapitalization: TextCapitalization.characters,
                      decoration: InputDecoration(
                        hintText: 'T1S-XXXXXX',
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: border(context))),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: border(context))),
                      ),
                      style: tx(context, 12, w: FontWeight.w800, ls: 1),
                    ),
                  ),
                  const SizedBox(width: 8),
                  RedButton('Apply', onTap: _applying ? null : _apply),
                ]),
              ],
              if (_applyMsg != null) ...[
                const SizedBox(height: 8),
                Text(_applyMsg!, style: tx(context, 11, w: FontWeight.w800, color: _applyOk ? T1SColors.green : T1SColors.red)),
              ],
            ],
          ),
        ),
      ],
    );
  }
}


// ---------------------------------------------------------------------------
// Top Picks rail (website RewardsTopPicks): one best pick per vertical.
// Admin-curated picks first, live auto-picks from the real offers catalogue
// otherwise; every card redirects through its masking pointer (/api/out).
// ---------------------------------------------------------------------------

const _kPickVerticals = <String, String>{
  'ecommerce': 'Shopping', 'grocery': 'Grocery', 'food': 'Food', 'flights': 'Flights',
  'hotels': 'Hotels', 'bus': 'Bus', 'cab': 'Cab', 'movie': 'Movies', 'loans': 'Loans',
  'insurance': 'Insurance', 'creditcards': 'Credit Cards', 'account': 'Accounts',
};

class _TopPicksRail extends StatelessWidget {
  const _TopPicksRail({required this.picks, required this.state});
  final List<RewardTopPick> picks;
  final AppState state;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Icon(Icons.workspace_premium_rounded, size: 15, color: T1SColors.red),
        const SizedBox(width: 6),
        Expanded(child: Text('TOP PICKS — ONE BEST DEAL PER VERTICAL', style: tx(context, 11.5, w: FontWeight.w900, ls: .5))),
      ]),
      const SizedBox(height: 8),
      // FIX (owner 22 Oct: "button v hidden hai"): the old 172px rail was
      // EXACTLY the worst-case content height, so any card with a price badge
      // clipped its CTA button at the card's bottom edge. 186px + a fixed
      // card height with the CTA pinned via Spacer guarantees the button
      // always renders fully.
      SizedBox(
        height: 186,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: picks.length,
          separatorBuilder: (_, __) => const SizedBox(width: 10),
          itemBuilder: (c, i) => TopPickCard(pick: picks[i], state: state),
        ),
      ),
    ]);
  }
}

class TopPickCard extends StatelessWidget {
  const TopPickCard({required this.pick, required this.state});
  final RewardTopPick pick;
  final AppState state;

  @override
  Widget build(BuildContext context) {
    final dark = isDark(context);
    return GestureDetector(
      onTap: pick.url.isEmpty ? null : () => openDeal(pick.url, sellerName: pick.partnerName),
      child: Container(
        width: 150,
        height: 186,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: dark ? T1SColors.slate900 : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: border(context)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(
            height: 84,
            width: double.infinity,
            // Owner 23 Oct fix: StackFit.expand forces the photo to FILL the
            // 84px hero box — square CDN thumbs used to render as small
            // centered thumbnails with white space around them.
            child: Stack(fit: StackFit.expand, children: [
              NetImage(pick.image, fit: BoxFit.cover, bg: dark ? T1SColors.slate800 : T1SColors.slate50),
              Positioned(
                top: 6, left: 6,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(999)),
                  child: Text((_kPickVerticals[pick.vertical] ?? pick.vertical).toUpperCase(),
                      style: const TextStyle(fontSize: 7.5, fontWeight: FontWeight.w900, color: Colors.white)),
                ),
              ),
              if (pick.badgeText != null)
                Positioned(
                  bottom: 6, left: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: const Color(0xFFFACC15), borderRadius: BorderRadius.circular(999)),
                    child: Text(pick.badgeText!, style: const TextStyle(fontSize: 7.5, fontWeight: FontWeight.w900, color: T1SColors.slate900)),
                  ),
                ),
            ]),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SizedBox(
                height: 26,
                child: Text(pick.headline, maxLines: 2, overflow: TextOverflow.ellipsis, style: tx(context, 9.5, w: FontWeight.w800, h: 1.12)),
              ),
              const SizedBox(height: 2),
              Text('via ${pick.partnerName}', maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 9, color: muted(context))),
              if (pick.priceBadge != null) ...[
                const SizedBox(height: 2),
                Text(pick.priceBadge!, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 10.5, w: FontWeight.w900, color: T1SColors.red)),
              ],
              const Spacer(),
              Container(
                width: double.infinity,
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(vertical: 4),
                decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(8)),
                child: Text(pick.ctaText, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, color: Colors.white)),
              ),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}
