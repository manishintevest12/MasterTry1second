import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/app_state.dart';
import '../../core/auth.dart';
import '../../core/theme.dart';
import '../widgets/kit.dart';
import 'alerts_screen.dart';

/// Profile (website ProfileModal): Google sign-in -> session, wallet with
/// OmniPoints + spins, quick actions, honest sign-out. End-to-end auth:
/// splash restores the token, /auth/me validates, logout clears everything.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _state = AppState.instance;
  final _auth = AuthService.instance;
  RewardsSummary? _rewards;

  @override
  void initState() {
    super.initState();
    _auth.addListener(_onAuth);
    _load();
  }

  @override
  void dispose() {
    _auth.removeListener(_onAuth);
    super.dispose();
  }

  void _onAuth() {
    if (mounted) setState(() {});
    _load();
  }

  Future<void> _load() async {
    if (!_auth.signedIn || _auth.token == null) return;
    try {
      final r = await _state.api.rewards(_auth.token!);
      if (mounted) setState(() => _rewards = r);
    } catch (_) {/* honest: keep last known wallet */}
  }

  Future<void> _login() async {
    final ok = await _auth.signInWithGoogle(_state.api);
    if (!mounted) return;
    if (ok) {
      toast(context, 'Signed in as ${_auth.user?.email}');
      await _state.refreshBadges();
    } else if (_auth.error != null) {
      toast(context, _auth.error!, error: true);
    }
  }

  Future<void> _logout() async {
    await _auth.signOut();
    await _state.refreshBadges();
    if (mounted) toast(context, 'Signed out — session cleared');
  }

  @override
  Widget build(BuildContext context) {
    final user = _auth.user;
    final signedIn = _auth.signedIn;
    return Scaffold(
      backgroundColor: isDark(context) ? T1SColors.slate950 : T1SColors.slate50,
      appBar: AppBar(title: Text('Profile', style: tx(context, 16, w: FontWeight.w900))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 30),
        children: [
          // Owner 22 Oct: visible build stamp so the installed APK version can
          // be verified on-device (Profile screen, always current build).
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(
              'Try1Second v1.8.13 · build 23 Oct',
              textAlign: TextAlign.center,
              style: tx(context, 9.5, w: FontWeight.w800, color: muted(context)),
            ),
          ),
          Box(
            padding: const EdgeInsets.all(18),
            child: Column(children: [
              Container(
                width: 58,
                height: 58,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: T1SColors.slate950, shape: BoxShape.circle, border: Border.all(color: T1SColors.goldLight, width: 2)),
                child: Text(
                  signedIn ? (user?.initials ?? '1S') : '1S',
                  style: tx(context, 18, w: FontWeight.w900, color: T1SColors.goldLight, mono: true),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                signedIn ? (user?.name ?? 'Try1Second Member') : 'Welcome to Try1Second',
                style: tx(context, 16, w: FontWeight.w900),
              ),
              const SizedBox(height: 3),
              Text(
                signedIn ? (user?.email ?? '') : 'Sign in to save your rewards, spins and vouchers across devices.',
                textAlign: TextAlign.center,
                style: tx(context, 11.5, color: muted(context)),
              ),
              if (signedIn) ...[
                const SizedBox(height: 6),
                Pill(user?.role == 'admin' ? 'Admin' : 'Tier 1', bg: T1SColors.amber300.withValues(alpha: 0.25), fg: const Color(0xFF78350F), size: 9),
              ],
              const SizedBox(height: 14),
              if (!signedIn)
                _GoogleButton(onTap: _auth.busy ? () {} : _login, busy: _auth.busy)
              else
                RedButton('Log out', onTap: _logout, icon: Icons.logout_rounded, expand: true),
            ]),
          ),
          if (signedIn) ...[
            const SizedBox(height: 14),
            Box(
              padding: const EdgeInsets.all(14),
              child: Column(children: [
                _walletRow('Reward Balance', '${_rewards?.validPoints ?? _state.points}', 'OmniPoints', T1SColors.red, 17),
                const Divider(height: 18),
                _walletRow('Spins Unlocked', '${_rewards?.availableSpins ?? _state.spinsAvailable}', 'Free Spin(s)', T1SColors.emerald600, 12.5),
              ]),
            ),
            const SizedBox(height: 14),
            T1SOutlineButton('Go to Spin & Earn Wheel', onTap: () { Navigator.pop(context); _state.go(NavTab.rewards); }, icon: Icons.casino_rounded),
            const SizedBox(height: 8),
            T1SOutlineButton('My Price Alerts', onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AlertsScreen())), icon: Icons.notifications_active_outlined),
          ],
          const SizedBox(height: 14),
        ],
      ),
    );
  }

  Widget _walletRow(String label, String value, String unit, Color color, double size) {
    return Builder(builder: (c) {
      return Row(children: [
        Expanded(child: Text('$label:', style: tx(c, 11.5, color: muted(c)))),
        Text('$value $unit', style: tx(c, size, w: FontWeight.w900, color: color, mono: true)),
      ]);
    });
  }
}

class _GoogleButton extends StatelessWidget {
  const _GoogleButton({required this.onTap, required this.busy});
  final VoidCallback onTap;
  final bool busy;
  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        backgroundColor: Colors.white,
        side: const BorderSide(color: T1SColors.slate300),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.symmetric(vertical: 13),
      ),
      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        if (busy)
          const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: T1SColors.red))
        else
          Image.network('https://www.google.com/s2/favicons?domain=google.com&sz=64', width: 18, height: 18,
              errorBuilder: (_, __, ___) => const Icon(Icons.login_rounded, size: 16)),
        const SizedBox(width: 10),
        Text('Continue with Google', style: tx(context, 13, w: FontWeight.w800, color: const Color(0xFF1F2937))),
      ]),
    );
  }
}
