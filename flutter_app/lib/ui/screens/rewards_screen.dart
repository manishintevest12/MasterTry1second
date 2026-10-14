import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/auth.dart';
import '../../core/storage.dart';
import '../../core/theme.dart';
import '../widgets/common.dart';
import 'profile_screen.dart';

/// Rewards: points, spin eligibility and the Spin & Earn wheel — backed by the
/// same account as the website (sign in with Google to sync).
class RewardsScreen extends StatefulWidget {
  const RewardsScreen({super.key});

  @override
  State<RewardsScreen> createState() => _RewardsScreenState();
}

class _RewardsScreenState extends State<RewardsScreen> {
  final _auth = AuthService.instance;
  RewardsSummary? _summary;
  bool _loading = false;
  String? _error;
  bool _spinning = false;

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
    if (!_auth.signedIn || _auth.token == null) {
      setState(() => _summary = null);
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final api = await _storeApi();
      final s = await api.rewards(_auth.token!);
      if (mounted) setState(() => _summary = s);
    } catch (e) {
      if (mounted) setState(() => _error = '$e'.replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<Try1SecondApi> _storeApi() => AppStore().api();

  Future<void> _spin() async {
    if (_spinning || _auth.token == null) return;
    setState(() { _spinning = true; _error = null; });
    try {
      final api = await _storeApi();
      final prize = await api.spin(_auth.token!);
      if (!mounted) return;
      await _load();
      if (!mounted) return;
      final dialogContext = context;
      if (!dialogContext.mounted) return;
      await showDialog<void>(
        context: dialogContext,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 56, height: 56,
                decoration: const BoxDecoration(gradient: T1SColors.badgeGradient, shape: BoxShape.circle),
                child: const Icon(Icons.celebration, color: Colors.white),
              ),
              const SizedBox(height: 14),
              Text('You won!', style: T1SText.headline(context)),
              const SizedBox(height: 6),
              Text(prize.name, style: T1SText.price(context), textAlign: TextAlign.center),
              if (prize.description != null) ...[
                const SizedBox(height: 4),
                Text(prize.description!, style: T1SText.body(context).copyWith(color: T1SColors.slate500), textAlign: TextAlign.center),
              ],
            ],
          ),
          actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Nice'))],
        ),
      );
    } catch (e) {
      if (mounted) setState(() => _error = '$e'.replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _spinning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = _auth.signedIn;
    final s = _summary;

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          Text('Rewards', style: T1SText.display(context).copyWith(fontSize: 22)),
          const SizedBox(height: 4),
          Text('Earn points on every redirection. 100 points = one spin.',
              style: T1SText.body(context).copyWith(color: T1SColors.slate500)),
          const SizedBox(height: 16),

          if (!signedIn) ...[
            T1SCard(
              child: Column(
                children: [
                  const Icon(Icons.card_giftcard, size: 34, color: T1SColors.red),
                  const SizedBox(height: 12),
                  Text('Sign in to see your rewards', style: T1SText.title(context), textAlign: TextAlign.center),
                  const SizedBox(height: 4),
                  Text('Your points and spins live in your Try1Second account — the same one as the website.',
                      style: T1SText.body(context).copyWith(color: T1SColors.slate500),
                      textAlign: TextAlign.center),
                  const SizedBox(height: 14),
                  T1SButton.primary(label: 'Go to Profile', onTap: () => Navigator.of(context)
                      .push(MaterialPageRoute(builder: (_) => const ProfileScreen()))),
                ],
              ),
            ),
          ] else ...[
            // Wallet card
            T1SCard(
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _Stat(label: 'POINTS', value: _loading ? '…' : '${s?.validPoints ?? '—'}'),
                      _Stat(label: 'SPINS READY', value: _loading ? '…' : '${s?.availableSpins ?? '—'}'),
                      _Stat(label: 'PTS / SPIN', value: '${s?.pointsPerSpin ?? 100}'),
                    ],
                  ),
                  const Divider(height: 26),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: T1SButton.primary(
                      label: _spinning
                          ? 'Spinning…'
                          : 'Spin & Earn',
                      icon: _spinning
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.casino, size: 17),
                      onTap: _spinning ? null : _spin,
                    ),
                  ),
                ],
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              T1SCard(
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Icon(Icons.info_outline, size: 17, color: T1SColors.red),
                  const SizedBox(width: 10),
                  Expanded(child: Text(_error!, style: T1SText.body(context))),
                ]),
              ),
            ],
          ],
          const SizedBox(height: 16),

          const SectionHeader('HOW REWARDS WORK'),
          T1SCard(
            child: Column(
              children: const [
                _RuleRow(icon: Icons.touch_app, text: 'Every merchant redirection you make earns one valid point.'),
                _RuleRow(icon: Icons.casino_outlined, text: '100 valid points unlock one spin eligibility.'),
                _RuleRow(icon: Icons.lock_outline, text: 'Spin results are visible only to you.'),
                _RuleRow(icon: Icons.block, text: 'Points never convert to cash — vouchers & prizes only.'),
              ],
            ),
          ),
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
        Text(value, style: T1SText.price(context).copyWith(fontSize: 19)),
        const SizedBox(height: 2),
        Text(label, style: T1SText.label(context).copyWith(letterSpacing: 0.5)),
      ],
    );
  }
}

class _RuleRow extends StatelessWidget {
  const _RuleRow({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 16, color: T1SColors.red),
        const SizedBox(width: 10),
        Expanded(child: Text(text, style: T1SText.body(context).copyWith(fontSize: 11.5))),
      ]),
    );
  }
}
