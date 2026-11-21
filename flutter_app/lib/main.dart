import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'core/app_state.dart';
import 'core/grocery_cart.dart';
import 'core/deep_links.dart';
import 'core/push_alerts.dart';
import 'core/theme.dart';
import 'ui/main_shell.dart';
import 'ui/screens/product_screen.dart';
import 'ui/splash_gate.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // EDGE-TO-EDGE (Play Console, 16 Nov: "Edge-to-edge may not display for all users").
  // Android 15+ draws every app behind the status and navigation bars whether it likes it or not, and Play asks
  // for the app to render that way deliberately. Asking for edgeToEdge here means the bars are transparent, the
  // content sits underneath them, and the SafeAreas inside each screen keep text clear of them - instead of the
  // window being letterboxed on some devices and full-bleed on others.
  // GROCERY CART (owner 20 Nov): restore the basket saved on this device before the first frame that can show a
  // card, so the ADD/stepper on a grocery card opens in the right state instead of flashing "ADD".
  unawaited(GroceryCart.instance.load());
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Color(0x00000000),
    systemNavigationBarColor: Color(0x00000000),
    statusBarIconBrightness: Brightness.dark,
    statusBarBrightness: Brightness.light,
    systemNavigationBarIconBrightness: Brightness.dark,
    systemNavigationBarContrastEnforced: false,
    systemNavigationBarDividerColor: Color(0x00000000),
  ));
  // Device alerts: permission + token registration. Deliberately not awaited, so a slow
  // or unavailable Play Services never delays the first frame.
  unawaited(PushAlerts.init());
  // REFERRAL FROM THE PLAY LISTING (owner 17 Nov): a friend who taps /r/<code> without the app installed lands on the
  // Play listing with the member code as the install referrer. Android hands that string back here, so the invite is
  // kept even though no link was ever opened in the app - the person then gets credited when they sign in.
  unawaited(DeepLinks.captureInstallReferral());
  runApp(const Try1SecondApp());
}

class Try1SecondApp extends StatefulWidget {
  const Try1SecondApp({super.key});

  @override
  State<Try1SecondApp> createState() => _Try1SecondAppState();
}

class _Try1SecondAppState extends State<Try1SecondApp> {
  final _state = AppState.instance;
  bool _dark = false;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _state.store.darkModeNotifier.addListener(_onDarkFromStore);
    _boot();
  }

  @override
  void dispose() {
    _state.store.darkModeNotifier.removeListener(_onDarkFromStore);
    super.dispose();
  }

  void _onDarkFromStore() => _onDark(_state.store.darkModeNotifier.value);

  void _onDark(bool v) {
    if (mounted) setState(() => _dark = v);
  }

  /// Splash holds until the API is ready and the saved session (if any) has
  /// been validated, so the app opens on the right screen with fresh badges.
  Future<void> _boot() async {
    await _state.init();
    // OWNER 29 Oct: every universal link / try1second:// link opens the app on the
    // matching screen. Started after the session is restored so a product or vertical
    // link lands on top of a fully painted shell (not the splash).
    unawaited(DeepLinks.init());
    if (mounted) setState(() => _ready = true);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Try1Second',
      debugShowCheckedModeBanner: false,
      theme: t1sLightTheme(),
      darkTheme: t1sDarkTheme(),
      themeMode: _dark ? ThemeMode.dark : ThemeMode.light,
      navigatorKey: AppState.instance.navigator,
      navigatorObservers: [_DismissKeyboardOnNavigation()],
      routes: {
        'product': (_) => _ProductRoute(),
      },
      home: SplashGate(ready: _ready, child: const MainShell()),
    );
  }
}

/// OWNER 29 Oct: an autocomplete hint list lives in the ROOT overlay, so pushing a page on top of
/// the field left the hint floating over the new screen, hiding everything behind it. Any route
/// change now drops focus first, which closes every hint/overlay the field had opened.
class _DismissKeyboardOnNavigation extends NavigatorObserver {
  void _clear() {
    final f = FocusManager.instance.primaryFocus;
    if (f != null && f.hasFocus) f.unfocus();
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) => _clear();

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) => _clear();

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) => _clear();
}

class _ProductRoute extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final args = ModalRoute.of(context)?.settings.arguments;
    final input = args is PendingSearch ? args.query : (args is String ? args : '');
    return ProductScreen(input: input);
  }
}
