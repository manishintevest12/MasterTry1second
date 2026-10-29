import 'package:flutter/material.dart';

import 'core/app_state.dart';
import 'core/theme.dart';
import 'ui/main_shell.dart';
import 'ui/screens/product_screen.dart';
import 'ui/splash_gate.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
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
