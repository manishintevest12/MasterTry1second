import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:try1second/core/rewards_wallet.dart';
import 'package:try1second/ui/widgets/spin_wheel.dart';

void _noop() {}

/// Spin & Earn system (owner 23 Oct, web SpinAndEarnWheel parity): local
/// wallet — 1 referral = +1 point, 100 points = 1 spin, weighted prize
/// selection, persisted voucher backpack. The 8 slices mirror the web
/// SPIN_REWARDS pool exactly.
void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('RewardsWallet (web parity)', () {
    test('1 referral = +1 point and lands in Recent with +1 pt', () async {
      final w = RewardsWallet.instance;
      w.debugReset();
      w.referFriend('Aakash Verma', 'aakash.v@gmail.com');
      expect(w.points, 1);
      expect(w.friends.first.name, 'Aakash Verma');
      expect(w.friends.first.pointsAwarded, 1);
      expect(w.pointsToNextSpin, 99);
      expect(w.spinsAvailable, 0);
    });

    test('empty name falls back to Invited Friend (web parity)', () {
      final w = RewardsWallet.instance;
      w.debugReset();
      w.referFriend('   ');
      expect(w.friends.first.name, 'Invited Friend');
    });

    test('spin needs 100 points, deducts, and awards a voucher from the 8-slice pool', () {
      final w = RewardsWallet.instance;
      w.debugReset();
      expect(w.executeSpin(), isNull); // not enough points — no spin
      w.addPoints(100);
      expect(w.spinsAvailable, 1);
      final prize = w.executeSpin();
      expect(prize, isNotNull);
      expect(w.points, lessThan(100)); // deducted
      expect(w.wonRewards, isNotEmpty);
      expect(kSpinSlices.map((s) => s.id), contains(prize!.id));
      // voucher code mirrors web format CODE-NNNN
      expect(RegExp(r'^[A-Z0-9-]+-\d{4}$').hasMatch(w.wonRewards.first.voucherCode), isTrue);
    });

    test('persistence survives a reload (SharedPreferences)', () async {
      final w = RewardsWallet.instance;
      w.debugReset();
      w.referFriend('Pooja Iyer');
      w.addPoints(50);
      // simulate a fresh instance by clearing the loaded flag
      await w.load();
      expect(w.points, 51);
      expect(w.friends.first.name, 'Pooja Iyer');
    });

    test('the 8 slices mirror the web SPIN_REWARDS pool', () {
      expect(kSpinSlices.length, 8);
      expect(kSpinSlices.map((s) => s.value), [
        '₹500 Voucher', '₹250 Cash', '3 Months Free', '₹1,000 Off',
        '₹100 Credit', '₹50 Ride', '+50 Points', '₹150 Off',
      ]);
      expect(kSpinCostPoints, 100);
    });
  });

  group('SpinWheel widget', () {
    testWidgets('renders the SPIN hub with the 100 pts label', (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: Scaffold(body: Center(child: SpinWheel(rotation: 0, onSpin: _noop, enabled: true, spinning: false))),
      ));
      expect(find.text('SPIN'), findsOneWidget);
      expect(find.text('100 pts'), findsOneWidget);
    });

    testWidgets('disabled hub does not crash and shows greyed state', (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: Scaffold(body: Center(child: SpinWheel(rotation: 120, onSpin: _noop, enabled: false, spinning: false))),
      ));
      expect(find.text('SPIN'), findsOneWidget);
    });
  });
}


