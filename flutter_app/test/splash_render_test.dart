import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:try1second/core/app_state.dart';
import 'package:try1second/ui/splash_gate.dart';

void main() {
  testWidgets('splash holds until warm-up completes (or max), then reveals app', (t) async {
    AppState.instance.warmProgress.value = 0;
    await t.pumpWidget(const MaterialApp(
      home: SplashGate(
        ready: true,
        minDuration: Duration(milliseconds: 300),
        maxDuration: Duration(seconds: 2),
        child: Scaffold(body: Text('APP')),
      ),
    ));
    await t.pump(const Duration(milliseconds: 400));
    // min elapsed + ready, but warm-up not done -> splash still on top (progress label visible)
    expect(find.textContaining('loading live prices'), findsOneWidget);

    AppState.instance.warmProgress.value = 1.0;
    await t.pump(const Duration(milliseconds: 50));
    await t.pump(const Duration(milliseconds: 600));
    await t.pump(const Duration(milliseconds: 600));
    expect(find.textContaining('loading live prices'), findsNothing);
    expect(find.text('APP'), findsOneWidget);
    await t.pump(const Duration(seconds: 3)); // drain the max-wait timer
  });

  testWidgets('max wait releases the splash on a dead network', (t) async {
    AppState.instance.warmProgress.value = 0.3;
    await t.pumpWidget(const MaterialApp(
      home: SplashGate(
        ready: true,
        minDuration: Duration(milliseconds: 100),
        maxDuration: Duration(milliseconds: 800),
        child: Scaffold(body: Text('APP')),
      ),
    ));
    await t.pump(const Duration(milliseconds: 500));
    expect(find.textContaining('loading live prices'), findsOneWidget);
    await t.pump(const Duration(milliseconds: 600));
    await t.pump(const Duration(milliseconds: 700));
    await t.pump(const Duration(milliseconds: 700));
    expect(find.textContaining('loading live prices'), findsNothing);
  });
}
