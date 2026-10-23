import 'dart:convert';
import 'dart:math';

import 'dart:ui' show Color;

import 'package:flutter/foundation.dart';

import 'package:shared_preferences/shared_preferences.dart';

/// Spin & Earn wallet (owner 23 Oct) — the Flutter mirror of the web's
/// SpinAndEarnWheel client state (AppContext userPoints / referredFriends /
/// wonRewards / executeSpin), persisted to SharedPreferences so the demo
/// wallet survives app restarts. Web parity: 1 referral = +1 point,
/// 100 points = 1 spin, weighted-random prize selection, voucher codes in
/// the same CODE-NNNN format.
class SpinSlice {
  const SpinSlice(this.id, this.title, this.description, this.voucherCode, this.color, this.value, this.expiryDays, this.weight);
  final String id;
  final String title;
  final String description;
  final String voucherCode;
  final int color; // 0xRRGGBB
  final String value;
  final int expiryDays;
  final int weight;

  Color get asColor => Color(color | 0xFF000000);
}

class ReferredFriend {
  const ReferredFriend(this.id, this.name, this.email, this.date, this.pointsAwarded);
  final String id;
  final String name;
  final String email;
  final String date;
  final int pointsAwarded;

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'email': email, 'date': date, 'pointsAwarded': pointsAwarded};
  static ReferredFriend fromJson(Map<String, dynamic> j) => ReferredFriend(
        j['id'] as String? ?? '',
        j['name'] as String? ?? 'Invited Friend',
        j['email'] as String? ?? '',
        j['date'] as String? ?? '',
        (j['pointsAwarded'] as num?)?.toInt() ?? 1,
      );
}

class WonReward {
  const WonReward(this.id, this.title, this.value, this.voucherCode, this.wonAt, this.expiresAt, this.color);
  final String id;
  final String title;
  final String value;
  final String voucherCode;
  final String wonAt;
  final String expiresAt;
  final int color;

  Map<String, dynamic> toJson() => {'id': id, 'title': title, 'value': value, 'voucherCode': voucherCode, 'wonAt': wonAt, 'expiresAt': expiresAt, 'color': color};
  static WonReward fromJson(Map<String, dynamic> j) => WonReward(
        j['id'] as String? ?? '',
        j['title'] as String? ?? '',
        j['value'] as String? ?? '',
        j['voucherCode'] as String? ?? '',
        j['wonAt'] as String? ?? '',
        j['expiresAt'] as String? ?? '',
        (j['color'] as num?)?.toInt() ?? 0xEA580C,
      );
}

/// The 8 wheel slices — exact mirror of the web SPIN_REWARDS pool
/// (src/data/mockData.ts) so both platforms show the same prize wheel.
const kSpinSlices = <SpinSlice>[
  SpinSlice('sp-1', '₹500 Amazon Gift Card', 'Instant gift voucher valid across Amazon India storefront.', 'AMZ-500-OMNI', 0xEA580C, '₹500 Voucher', 30, 5),
  SpinSlice('sp-2', '₹250 Flight Cash Back', 'Redeemable on MakeMyTrip or Cleartrip flight bookings.', 'FLY-250-CASH', 0x0284C7, '₹250 Cash', 45, 10),
  SpinSlice('sp-3', 'Free 3-Month Swiggy One', 'Unlimited free food & Instamart grocery delivery privileges.', 'SWIG-ONE-FREE', 0xD97706, '3 Months Free', 14, 15),
  SpinSlice('sp-4', '₹1,000 Hotel Booking Voucher', 'Valid for stays booked on Agoda, Taj, or Booking.com.', 'HOTEL-1000-VIP', 0x16A34A, '₹1,000 Off', 60, 10),
  SpinSlice('sp-5', '₹100 Blinkit Grocery Credit', 'Instant credit applied to fresh fruits & breakfast items.', 'BLINK-100-QUICK', 0x9333EA, '₹100 Credit', 15, 20),
  SpinSlice('sp-6', '₹50 Ola/Uber Ride Coupon', 'Flat discount on your next airport or city cab trip.', 'RIDE-50-OFF', 0xDC2626, '₹50 Ride', 20, 15),
  SpinSlice('sp-7', '50 Bonus OmniPoints', '50 points added to your balance towards your next spin.', 'POINTS-50-BOOST', 0x0D9488, '+50 Points', 90, 25),
  SpinSlice('sp-8', '₹150 Movie Ticket Discount', 'Valid on BookMyShow IMAX & regular theater seats.', 'CINE-150-TIX', 0x4F46E5, '₹150 Off', 30, 10),
];

const kSpinCostPoints = 100;

class RewardsWallet {
  RewardsWallet._();
  static final RewardsWallet instance = RewardsWallet._();

  static const _kPoints = 'spin.points';
  static const _kFriends = 'spin.friends';
  static const _kWon = 'spin.won';

  int _points = 0;
  List<ReferredFriend> _friends = const [];
  List<WonReward> _won = const [];
  bool _loaded = false;
  final List<void Function()> _listeners = [];

  int get points => _points;
  List<ReferredFriend> get friends => List.unmodifiable(_friends);
  List<WonReward> get wonRewards => List.unmodifiable(_won);
  int get spinsAvailable => _points >= kSpinCostPoints ? _points ~/ kSpinCostPoints : 0;
  int get pointsToNextSpin => _points >= kSpinCostPoints ? 0 : kSpinCostPoints - _points;

  /// Returns the unsubscribe function.
  VoidCallback listen(void Function() fn) {
    _listeners.add(fn);
    return () => _listeners.remove(fn);
  }

  void _notify() {
    for (final l in List.of(_listeners)) {
      l();
    }
  }

  Future<void> load() async {
    if (_loaded) return;
    final p = await SharedPreferences.getInstance();
    _points = p.getInt(_kPoints) ?? 0;
    try {
      _friends = ((jsonDecode(p.getString(_kFriends) ?? '[]') as List?) ?? const [])
          .map((e) => ReferredFriend.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
    } catch (_) {
      _friends = const [];
    }
    try {
      _won = ((jsonDecode(p.getString(_kWon) ?? '[]') as List?) ?? const [])
          .map((e) => WonReward.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
    } catch (_) {
      _won = const [];
    }
    _loaded = true;
    _notify();
  }

  Future<void> _persist() async {
    final p = await SharedPreferences.getInstance();
    await p.setInt(_kPoints, _points);
    await p.setString(_kFriends, jsonEncode([for (final f in _friends) f.toJson()]));
    await p.setString(_kWon, jsonEncode([for (final w in _won) w.toJson()]));
  }

  /// Web parity: referFriend(name, email) — +1 point, prepends a friend.
  void referFriend(String name, [String? email]) {
    final cleanName = name.trim().isEmpty ? 'Invited Friend' : name.trim();
    final cleanEmail = (email ?? '').trim().isNotEmpty
        ? email!.trim()
        : '${cleanName.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '')}@gmail.com';
    _friends = [ReferredFriend('ref-${DateTime.now().millisecondsSinceEpoch}', cleanName, cleanEmail, 'Just now', 1), ..._friends];
    _points += 1;
    _persist();
    _notify();
  }

  /// Web parity: addPoints(100, 'Tester Instant 100-Pt Spin Unlock').
  void addPoints(int amount) {
    _points += amount;
    _persist();
    _notify();
  }

  /// Web parity: executeSpin — weighted random pick, 100-pt deduction,
  /// +50-point prize bonus, voucher code in the same CODE-NNNN format.
  /// Returns the won slice, or null when not enough points.
  SpinSlice? executeSpin() {
    if (_points < kSpinCostPoints) return null;
    _points -= kSpinCostPoints;
    final total = kSpinSlices.fold<int>(0, (s, r) => s + r.weight);
    var rand = Random().nextDouble() * total;
    var wonPrize = kSpinSlices.first;
    for (final r in kSpinSlices) {
      rand -= r.weight;
      if (rand <= 0) {
        wonPrize = r;
        break;
      }
    }
    if (wonPrize.value.contains('Point')) {
      final matched = RegExp(r'\d+').firstMatch(wonPrize.value);
      _points += matched != null ? int.parse(matched.group(0)!) : 50;
    }
    final now = DateTime.now();
    final fmt = (DateTime d) => '${d.day} ${const ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.month - 1]} ${d.year}';
    _won = [
      WonReward(
        'won-${now.millisecondsSinceEpoch}',
        wonPrize.title,
        wonPrize.value,
        '${wonPrize.voucherCode}-${1000 + Random().nextInt(9000)}',
        fmt(now),
        fmt(now.add(Duration(days: wonPrize.expiryDays))),
        wonPrize.color,
      ),
      ..._won,
    ];
    _persist();
    _notify();
    return wonPrize;
  }

  /// Test-only.
  void debugReset() {
    _points = 0;
    _friends = const [];
    _won = const [];
    _loaded = true;
    _notify();
  }
}
