import 'package:flutter/material.dart';

import 'core/storage.dart';
import 'core/theme.dart';
import 'ui/main_shell.dart';
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
  final _store = AppStore();
  bool _dark = false;

  @override
  void initState() {
    super.initState();
    _store.darkMode().then((v) {
      if (mounted) setState(() => _dark = v);
    });
    // React instantly when dark mode is toggled on the Settings screen.
    _store.darkModeNotifier.addListener(_onDarkChanged);
  }

  void _onDarkChanged() {
    if (mounted) setState(() => _dark = _store.darkModeNotifier.value);
  }

  @override
  void dispose() {
    _store.darkModeNotifier.removeListener(_onDarkChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Try1Second',
      debugShowCheckedModeBanner: false,
      theme: t1sLightTheme(),
      darkTheme: t1sDarkTheme(),
      themeMode: _dark ? ThemeMode.dark : ThemeMode.light,
      home: const SplashGate(child: MainShell()),
    );
  }
}
