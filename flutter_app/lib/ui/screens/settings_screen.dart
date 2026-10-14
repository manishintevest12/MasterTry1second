import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/storage.dart';
import '../../core/theme.dart';
import '../widgets/common.dart';
import '../widgets/logo.dart';

/// Settings: city/pincode for live local pricing, backend URL override,
/// dark mode. All persisted locally.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _store = AppStore();
  final _city = TextEditingController();
  final _pincode = TextEditingController();
  final _api = TextEditingController();
  bool _dark = false;
  bool _saved = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    _city.text = await _store.city();
    _pincode.text = await _store.pincode();
    _api.text = await _store.apiBase();
    final dark = await _store.darkMode();
    if (!mounted) return;
    setState(() => _dark = dark);
  }

  Future<void> _save() async {
    await _store.saveSettings(
      city: _city.text,
      pincode: _pincode.text,
      apiBase: _api.text,
      dark: _dark,
    );
    final st = AppState.instance;
    st.city = _city.text.trim().isNotEmpty ? _city.text.trim() : st.city;
    st.pincode = _pincode.text.trim().isNotEmpty ? _pincode.text.trim() : st.pincode;
    st.api = await _store.api();
    st.cache.clear();
    st.notifyListeners();
    setState(() => _saved = true);
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _saved = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: LayoutBuilder(builder: (context, constraints) {
        final wide = constraints.maxWidth > 760;
        final maxW = wide ? 760.0 : constraints.maxWidth;
        return Center(
          child: SizedBox(
            width: maxW,
            child: ListView(
              padding: const EdgeInsets.all(14),
              children: [
                const T1SLogo(size: 40),
                const SizedBox(height: 18),
                Text('Settings', style: T1SText.headline(context)),
                const SizedBox(height: 14),
                TextField(
                  controller: _city,
                  decoration: const InputDecoration(
                    labelText: 'City (for live pricing)',
                    hintText: 'e.g. Indore',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _pincode,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Pincode',
                    hintText: 'e.g. 452001',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _api,
                  decoration: const InputDecoration(
                    labelText: 'Try1Second backend URL',
                    hintText: 'https://www.try1second.com',
                  ),
                ),
                const SizedBox(height: 14),
                SwitchListTile(
                  value: _dark,
                  onChanged: (v) => setState(() => _dark = v),
                  activeTrackColor: T1SColors.red,
                  title: Text('Dark mode', style: T1SText.title(context)),
                  subtitle: Text('Slate-950 surfaces with the same Try1Second red.',
                      style: T1SText.body(context).copyWith(fontSize: 10.5)),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    T1SButton.primary(label: 'Save settings', onTap: _save),
                    const SizedBox(width: 12),
                    if (_saved)
                      Text('Saved ✓',
                          style: T1SText.body(context).copyWith(
                              color: T1SColors.green, fontWeight: FontWeight.w800)),
                  ],
                ),
                const SizedBox(height: 18),
                T1SCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Our promise', style: T1SText.title(context)),
                      const SizedBox(height: 6),
                      Text(
                        'This app only shows prices verified live by the Try1Second engine. '
                        'Blocked or empty sources are reported as unavailable — never mocked. '
                        'Opens use the safe /api/go redirect with affiliate tracking applied server-side.',
                        style: T1SText.body(context).copyWith(fontSize: 11.5),
                      ),
                      const SizedBox(height: 10),
                      GestureDetector(
                        onTap: () => launchUrl(
                          Uri.parse('https://www.try1second.com'),
                          mode: LaunchMode.externalApplication,
                        ),
                        child: const Text(
                          'www.try1second.com →',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: T1SColors.red,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      }),
    );
  }
}
