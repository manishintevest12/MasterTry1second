import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/storage.dart';
import '../../core/theme.dart';
import '../widgets/common.dart';

/// Quick Apps: the same curated partner-app catalogue as the website.
/// Tapping a card opens the partner's web page in the browser.
class QuickAppsScreen extends StatefulWidget {
  const QuickAppsScreen({super.key});

  @override
  State<QuickAppsScreen> createState() => _QuickAppsScreenState();
}

class _QuickAppsScreenState extends State<QuickAppsScreen> {
  final _store = AppStore();
  List<QuickApp>? _apps;
  String? _error;
  bool _loading = true;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final api = await _store.api();
      final apps = await api.quickApps();
      if (!mounted) return;
      setState(() { _apps = apps; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = '$e'.replaceFirst('Exception: ', ''); _loading = false; });
    }
  }

  Future<void> _open(QuickApp app) async {
    final uri = Uri.tryParse(app.webUrl);
    if (uri == null || !uri.isScheme('https')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No safe link available for this app yet.'), behavior: SnackBarBehavior.floating),
      );
      return;
    }
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not open ${app.name}.'), behavior: SnackBarBehavior.floating),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final apps = (_apps ?? const <QuickApp>[])
        .where((a) => _search.isEmpty ||
            a.name.toLowerCase().contains(_search) ||
            a.category.toLowerCase().contains(_search))
        .toList();

    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Quick Apps', style: T1SText.display(context).copyWith(fontSize: 22)),
                const SizedBox(height: 4),
                Text('Open your favourite Indian apps in one tap.',
                    style: T1SText.body(context).copyWith(color: T1SColors.slate500)),
                const SizedBox(height: 14),
                TextField(
                  onChanged: (v) => setState(() => _search = v.toLowerCase().trim()),
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.search, size: 20),
                    hintText: 'Search apps (e.g. Swiggy, Zepto)',
                    isDense: true,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: T1SColors.red))
                : _error != null
                    ? _StateCard(
                        icon: Icons.cloud_off_outlined,
                        title: 'Could not load Quick Apps',
                        message: _error!,
                        actionLabel: 'Retry',
                        onAction: _load,
                      )
                    : apps.isEmpty
                        ? const _StateCard(
                            icon: Icons.apps_outlined,
                            title: 'No apps found',
                            message: 'Try a different search.',
                          )
                        : RefreshIndicator(
                            color: T1SColors.red,
                            onRefresh: _load,
                            child: GridView.builder(
                              padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                                maxCrossAxisExtent: 320,
                                mainAxisExtent: 116,
                                crossAxisSpacing: 10,
                                mainAxisSpacing: 10,
                              ),
                              itemCount: apps.length,
                              itemBuilder: (context, i) => _AppCard(app: apps[i], onTap: () => _open(apps[i])),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

class _AppCard extends StatelessWidget {
  const _AppCard({required this.app, required this.onTap});
  final QuickApp app;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return T1SCard(
      onTap: onTap,
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(13),
              color: Colors.white,
              border: Border.all(color: dark ? const Color(0xFF334155) : T1SColors.slate200),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: CachedNetworkImage(
                imageUrl: app.iconUrl,
                fit: BoxFit.contain,
                errorWidget: (_, __, ___) => const Icon(Icons.apps, size: 24, color: T1SColors.slate400),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(app.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: T1SText.title(context)),
                    ),
                    if (app.badge != null) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(999)),
                        child: Text(app.badge!,
                            style: const TextStyle(fontSize: 8.5, fontWeight: FontWeight.w800, color: Colors.white)),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Text(app.category, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: T1SText.body(context).copyWith(fontSize: 10.5, color: T1SColors.slate500)),
                const SizedBox(height: 3),
                Row(
                  children: [
                    const Icon(Icons.star, size: 12, color: T1SColors.gold),
                    const SizedBox(width: 3),
                    Text(app.rating.toStringAsFixed(1), style: T1SText.label(context)),
                    if (app.users != null) ...[
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(app.users!, maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: T1SText.label(context).copyWith(color: T1SColors.slate400)),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const Icon(Icons.open_in_new, size: 15, color: T1SColors.slate300),
        ],
      ),
    );
  }
}

class _StateCard extends StatelessWidget {
  const _StateCard({required this.icon, required this.title, required this.message, this.actionLabel, this.onAction});
  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44, color: T1SColors.slate400),
            const SizedBox(height: 14),
            Text(title, style: T1SText.title(context)),
            const SizedBox(height: 6),
            Text(message, textAlign: TextAlign.center,
                style: T1SText.body(context).copyWith(color: T1SColors.slate500)),
            if (actionLabel != null) ...[
              const SizedBox(height: 16),
              T1SButton.primary(label: actionLabel!, onTap: onAction),
            ],
          ],
        ),
      ),
    );
  }
}
