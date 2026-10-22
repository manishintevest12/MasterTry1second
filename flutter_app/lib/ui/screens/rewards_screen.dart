import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/services.dart';

import '../../core/api.dart';
import '../../core/app_state.dart';
import '../../core/auth.dart';
import '../../core/theme.dart';
import '../widgets/kit.dart';
import 'profile_screen.dart';

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
  final _auth = AuthService.instance;
  late int _tab = 0;

  @override
  void initState() {
    super.initState();
    _tab = widget.initialTab.clamp(0, 2);
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
            onTap: (i) => setState(() => _tab = i),
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
              _DealCard(deal: d),
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
        Expanded(child: NetImage(deal.imageUrl, fit: BoxFit.cover, fallbackIcon: Icons.storefront_outlined, width: 112)),
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

class _DealCard extends StatelessWidget {
  const _DealCard({required this.deal});
  final Deal deal;

  @override
  Widget build(BuildContext context) {
    final hasCode = deal.code != null && deal.code!.isNotEmpty;
    return Box(
      padding: EdgeInsets.zero,
      clip: true,
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _DealArt(deal: deal),
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
class _DealArt extends StatelessWidget {
  const _DealArt({required this.deal});
  final Deal deal;

  @override
  Widget build(BuildContext context) {
    final logoDomain = deal.kind == 'bank_offer' ? _logoDomainOf(deal.merchantName) : '';
    if (logoDomain.isEmpty) {
      return NetImage(deal.imageUrl, width: 96, height: 118, fit: BoxFit.cover, fallbackIcon: Icons.sell_outlined);
    }
    return Container(
      width: 96,
      height: 118,
      color: Colors.white,
      alignment: Alignment.center,
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: CachedNetworkImage(
          imageUrl: 'https://icons.duckduckgo.com/ip3/$logoDomain.ico',
          fit: BoxFit.contain,
          errorWidget: (_, __, ___) => NetImage(deal.imageUrl, width: 96, height: 118, fit: BoxFit.cover, fallbackIcon: Icons.sell_outlined),
        ),
      ),
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
      _state.notifyListeners();
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
  String? _link;
  String? _error;
  bool _busy = false;

  Future<void> _load() async {
    if (!_auth.signedIn || _auth.token == null) return;
    setState(() => _busy = true);
    try {
      final l = await _state.api.referralLink(_auth.token!);
      if (mounted) setState(() { _link = l; _error = null; });
    } catch (e) {
      if (mounted) setState(() => _error = '$e'.replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        Box(
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Icon(Icons.group_add_rounded, size: 18, color: T1SColors.orange500),
              const SizedBox(width: 8),
              Expanded(child: Text('Refer & Earn', style: tx(context, 15, w: FontWeight.w900))),
            ]),
            const SizedBox(height: 8),
            Text('Earn 1 Point for Every Referral. Spin at 100 Points.',
                style: tx(context, 12.5, w: FontWeight.w800, h: 1.3)),
            const SizedBox(height: 6),
            Text('Invite friends using your personal Try1Second referral link. Every friend who joins accredits 1 point directly to your wallet.',
                style: tx(context, 11, color: muted(context), h: 1.45)),
            const SizedBox(height: 14),
            if (!_auth.signedIn)
              Text('Sign in from Profile to get your referral link.', style: tx(context, 11.5, color: muted(context)))
            else ...[
              if (_busy) const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: T1SColors.red)),
              if (_error != null) Text(_error!, style: tx(context, 11.5, color: T1SColors.red)),
              if (_link != null) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(color: isDark(context) ? T1SColors.slate800 : T1SColors.slate50, borderRadius: BorderRadius.circular(10), border: Border.all(color: border(context))),
                  child: Text(_link!, style: tx(context, 11, mono: true), maxLines: 2, overflow: TextOverflow.ellipsis),
                ),
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(
                    child: RedButton('Copy link', onTap: () { Clipboard.setData(ClipboardData(text: _link!)); toast(context, 'Referral link copied'); }, icon: Icons.copy_rounded),
                  ),
                  const SizedBox(width: 8),
                  Expanded(child: T1SOutlineButton('Refresh', onTap: _load)),
                ]),
              ],
            ],
          ]),
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
      SizedBox(
        height: 172,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: picks.length,
          separatorBuilder: (_, __) => const SizedBox(width: 10),
          itemBuilder: (c, i) => _TopPickCard(pick: picks[i], state: state),
        ),
      ),
    ]);
  }
}

class _TopPickCard extends StatelessWidget {
  const _TopPickCard({required this.pick, required this.state});
  final RewardTopPick pick;
  final AppState state;

  @override
  Widget build(BuildContext context) {
    final dark = isDark(context);
    return GestureDetector(
      onTap: pick.url.isEmpty ? null : () => openDeal(pick.url, sellerName: pick.partnerName),
      child: Container(
        width: 150,
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
            child: Stack(children: [
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
          Padding(
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
              const SizedBox(height: 5),
              Container(
                width: double.infinity,
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(vertical: 4),
                decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(8)),
                child: Text(pick.ctaText, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, color: Colors.white)),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}
