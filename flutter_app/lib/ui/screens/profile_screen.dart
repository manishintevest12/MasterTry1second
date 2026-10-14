import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/auth.dart';
import '../../core/storage.dart';
import '../../core/theme.dart';
import '../widgets/common.dart';
import '../widgets/logo.dart';
import 'settings_screen.dart';
import 'tracked_screen.dart';

/// Profile: Google sign-in/out, account card, points, quick links.
/// When Google login is not configured in this build it says so honestly.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _auth = AuthService.instance;
  final _store = AppStore();
  RewardsSummary? _rewards;
  bool _rewardsBusy = false;

  @override
  void initState() {
    super.initState();
    _auth.addListener(_onAuth);
    _maybeLoadRewards();
  }

  @override
  void dispose() {
    _auth.removeListener(_onAuth);
    super.dispose();
  }

  void _onAuth() {
    if (mounted) setState(() => _rewards = _auth.signedIn ? _rewards : null);
    _maybeLoadRewards();
  }

  Future<void> _maybeLoadRewards() async {
    if (!_auth.signedIn || _auth.token == null) return;
    setState(() => _rewardsBusy = true);
    try {
      final api = await _store.api();
      final r = await api.rewards(_auth.token!);
      if (mounted) setState(() => _rewards = r);
    } catch (_) {
      // rewards are optional profile info; failure is not surfaced as an error
    } finally {
      if (mounted) setState(() => _rewardsBusy = false);
    }
  }

  Future<void> _signIn() async {
    final api = await _store.api();
    final ok = await _auth.signInWithGoogle(api);
    if (!mounted) return;
    if (!ok && _auth.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_auth.error!), behavior: SnackBarBehavior.floating),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final user = _auth.user;

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          Row(children: [const T1SLogo(size: 38), const Spacer()]),
          const SizedBox(height: 18),

          if (user != null) ...[
            // ---- Signed-in account card ----
            T1SCard(
              child: Column(
                children: [
                  Row(
                    children: [
                      _Avatar(user: user, size: 54),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(user.name,
                                style: T1SText.headline(context), maxLines: 1, overflow: TextOverflow.ellipsis),
                            const SizedBox(height: 2),
                            Text(user.email,
                                style: T1SText.body(context).copyWith(color: T1SColors.slate500),
                                maxLines: 1, overflow: TextOverflow.ellipsis),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 26),
                  Row(
                    children: [
                      Expanded(
                        child: _Stat(
                          label: 'POINTS',
                          value: _rewardsBusy ? '…' : '${_rewards?.validPoints ?? '—'}',
                        ),
                      ),
                      Expanded(
                        child: _Stat(
                          label: 'SPINS READY',
                          value: _rewardsBusy ? '…' : '${_rewards?.availableSpins ?? '—'}',
                        ),
                      ),
                      Expanded(
                        child: _Stat(
                          label: 'ACCOUNT',
                          value: user.role == 'admin' ? 'Admin' : 'Standard',
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _LinkTile(
              icon: Icons.favorite_border,
              label: 'My watchlist',
              sub: 'Tracked items with live re-check',
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const TrackedScreen())),
            ),
            const SizedBox(height: 10),
            _LinkTile(
              icon: Icons.tune,
              label: 'Settings',
              sub: 'City, pincode, backend URL, dark mode',
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: T1SButton.secondary(
                label: 'Sign out',
                icon: const Icon(Icons.logout, size: 16),
                onTap: () => _auth.signOut(),
              ),
            ),
          ] else ...[
            // ---- Signed-out: Google sign-in ----
            T1SCard(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Column(
                  children: [
                    const CircleAvatar(
                      radius: 30,
                      backgroundColor: T1SColors.slate100,
                      child: Text('1S', style: TextStyle(fontWeight: FontWeight.w900, color: T1SColors.slate500)),
                    ),
                    const SizedBox(height: 14),
                    Text('Sign in to sync your rewards',
                        style: T1SText.title(context), textAlign: TextAlign.center),
                    const SizedBox(height: 4),
                    Text(
                      'Your points, spin eligibility and prize history live in your Try1Second account.',
                      style: T1SText.body(context).copyWith(color: T1SColors.slate500),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 18),
                    _GoogleButton(
                      busy: _auth.busy,
                      enabled: _auth.isConfigured,
                      onTap: _signIn,
                    ),
                    if (!_auth.isConfigured) ...[
                      const SizedBox(height: 10),
                      Text(
                        'Google sign-in is not configured in this build yet.',
                        style: T1SText.label(context).copyWith(color: T1SColors.slate400),
                        textAlign: TextAlign.center,
                      ),
                    ],
                    if (_auth.error != null) ...[
                      const SizedBox(height: 10),
                      Text(_auth.error!, style: T1SText.label(context).copyWith(color: T1SColors.red)),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            _LinkTile(
              icon: Icons.tune,
              label: 'Settings',
              sub: 'City, pincode, backend URL, dark mode',
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
            ),
            if (dark) const SizedBox(height: 4),
          ],
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value, style: T1SText.price(context).copyWith(fontSize: 17)),
        const SizedBox(height: 2),
        Text(label, style: T1SText.label(context).copyWith(letterSpacing: 0.5)),
      ],
    );
  }
}

class _LinkTile extends StatelessWidget {
  const _LinkTile({required this.icon, required this.label, required this.sub, this.onTap});
  final IconData icon;
  final String label;
  final String sub;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return T1SCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Icon(icon, size: 20, color: T1SColors.red),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: T1SText.title(context)),
                const SizedBox(height: 1),
                Text(sub, style: T1SText.body(context).copyWith(fontSize: 11, color: T1SColors.slate500)),
              ],
            ),
          ),
          Icon(Icons.chevron_right, size: 18, color: dark ? T1SColors.slate600 : T1SColors.slate300),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.user, required this.size});
  final AuthUser user;
  final double size;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final pic = user.picture;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(colors: [T1SColors.redLight, T1SColors.red]),
        border: Border.all(color: dark ? T1SColors.slate800 : T1SColors.slate200, width: 2),
      ),
      child: ClipOval(
        child: (pic != null && pic.startsWith('https://'))
            ? Image.network(pic, fit: BoxFit.cover, errorBuilder: (_, __, ___) => _initials(context))
            : _initials(context),
      ),
    );
  }

  Widget _initials(BuildContext context) => Center(
        child: Text(user.initials,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 15)),
      );
}

/// Google-style sign-in button (white pill, G mark).
class _GoogleButton extends StatelessWidget {
  const _GoogleButton({required this.busy, required this.enabled, required this.onTap});
  final bool busy;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return SizedBox(
      height: 46,
      child: Material(
        color: dark ? Colors.white : Colors.white,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          onTap: enabled && !busy ? onTap : null,
          borderRadius: BorderRadius.circular(999),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: T1SColors.slate300),
              boxShadow: const [BoxShadow(color: Color(0x110F172A), blurRadius: 6, offset: Offset(0, 2))],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (busy)
                  const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                else ...[
                  const Text('G',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF4285F4),
                      )),
                  const SizedBox(width: 10),
                ],
                Text(
                  busy ? 'Signing in…' : 'Continue with Google',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF1F2937)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
