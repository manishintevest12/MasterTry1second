import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/app_state.dart';
import '../../core/auth.dart';
import '../../core/compare.dart';
import '../../core/theme.dart';
import '../widgets/kit.dart';

/// Spend Lens (website SpendLensView, 1:1): which website did you spend how
/// much on — graphs built ONLY from purchases you confirm. We never estimate
/// spend from clicks or sessions (honest-data policy).
class SpendLensScreen extends StatefulWidget {
  const SpendLensScreen({super.key, this.prefill});

  /// Prefilled suggestion from a Buy-click redirect sheet; user still confirms.
  final SpendPrefill? prefill;

  @override
  State<SpendLensScreen> createState() => _SpendLensScreenState();
}

class SpendPrefill {
  const SpendPrefill({required this.merchant, required this.amount, this.itemTitle});
  final String merchant;
  final double amount;
  final String? itemTitle;
}

class _SpendLensScreenState extends State<SpendLensScreen> {
  final _state = AppState.instance;
  final _auth = AuthService.instance;
  SpendData? _data;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
    if (widget.prefill != null && _auth.signedIn && _auth.token != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _openForm(
            initial: widget.prefill!,
          ));
    }
  }

  Future<void> _load() async {
    if (!_auth.signedIn || _auth.token == null) return;
    setState(() => _busy = true);
    try {
      final d = await _state.api.spend(_auth.token!);
      if (mounted) setState(() { _data = d; _error = null; });
    } catch (e) {
      if (mounted) setState(() => _error = '$e'.replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openForm({SpendPrefill? initial}) async {
    if (!_auth.signedIn || _auth.token == null) {
      toast(context, 'Sign in to log purchases', error: true);
      return;
    }
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddSpendSheet(initial: initial),
    );
    if (saved == true) await _load();
  }

  Future<void> _delete(SpendEntryM e) async {
    try {
      setState(() => _busy = true);
      final d = await _state.api.deleteSpend(_auth.token!, e.id);
      if (mounted) setState(() => _data = d);
    } catch (err) {
      if (mounted) toast(context, '$err'.replaceFirst('Exception: ', ''), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dark = isDark(context);
    if (!_auth.signedIn) {
      return Scaffold(
        backgroundColor: dark ? T1SColors.slate950 : T1SColors.slate50,
        appBar: AppBar(title: Text('Spend Lens', style: tx(context, 16, w: FontWeight.w900))),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 64, height: 64,
                  decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(16)),
                  child: const Icon(Icons.account_balance_wallet_rounded, color: Colors.white, size: 30),
                ),
                const SizedBox(height: 14),
                Text('Spend Lens', style: tx(context, 20, w: FontWeight.w900)),
                const SizedBox(height: 6),
                Text(
                  'Which website did you spend how much on? Only purchases you confirm — never guessed.',
                  textAlign: TextAlign.center,
                  style: tx(context, 12, color: dark ? T1SColors.slate400 : T1SColors.slate500),
                ),
                const SizedBox(height: 16),
                RedButton('Sign in via Profile menu', onTap: () => toast(context, 'Open the Profile menu to sign in first')),
              ],
            ),
          ),
        ),
      );
    }

    final summary = _data?.summary;
    final nowMonth = DateTime.now().toIso8601String().substring(0, 7);
    final thisMonth = summary?.byMonth.firstWhere((m) => m['month'] == nowMonth, orElse: () => const {})['total'] ?? 0;

    return Scaffold(
      backgroundColor: dark ? T1SColors.slate950 : T1SColors.slate50,
      appBar: AppBar(title: Text('Spend Lens', style: tx(context, 16, w: FontWeight.w900))),
      floatingActionButton: FloatingActionButton(
        backgroundColor: T1SColors.red,
        onPressed: () => _openForm(),
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: _error != null
          ? _msg(_error!, dark)
          : _busy && _data == null
              ? const Center(child: CircularProgressIndicator(color: T1SColors.red))
              : RefreshIndicator(
                  color: T1SColors.red,
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 90),
                    children: [
                      _statRow(dark, summary, thisMonth),
                      const SizedBox(height: 12),
                      _card(dark, 'Spend by website', Icons.bar_chart_rounded, _MerchantBars(summary: summary, dark: dark)),
                      const SizedBox(height: 12),
                      _card(dark, 'Monthly trend', Icons.trending_up_rounded, _MonthTrend(summary: summary)),
                      const SizedBox(height: 12),
                      _card(dark, 'Your logged purchases', Icons.receipt_long_rounded, _entries(dark)),
                      const SizedBox(height: 10),
                      Row(children: [
                        Icon(Icons.info_outline_rounded, size: 12, color: dark ? T1SColors.slate500 : T1SColors.slate400),
                        const SizedBox(width: 6),
                        Expanded(child: Text('Only purchases you confirm are counted. Never estimated from clicks.', style: tx(context, 10, color: dark ? T1SColors.slate500 : T1SColors.slate400))),
                      ]),
                    ],
                  ),
                ),
    );
  }

  Widget _msg(String m, bool dark) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(m, textAlign: TextAlign.center, style: tx(context, 13, color: dark ? T1SColors.slate400 : T1SColors.slate500))));

  Widget _card(bool dark, String title, IconData icon, Widget child) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: dark ? T1SColors.slate900 : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: dark ? T1SColors.slate800 : T1SColors.slate200),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(icon, size: 16, color: T1SColors.red),
            const SizedBox(width: 7),
            Text(title, style: tx(context, 13, w: FontWeight.w900)),
          ]),
          const SizedBox(height: 12),
          child,
        ]),
      );

  Widget _statRow(bool dark, SpendSummary? s, num thisMonth) {
    final top = (s?.byMerchant.isNotEmpty ?? false) ? s!.byMerchant.first['merchant'].toString() : '—';
    return Row(children: [
      Expanded(child: _statTile(dark, 'TOTAL SPEND', s == null ? '…' : inrAmount(s.total))),
      const SizedBox(width: 8),
      Expanded(child: _statTile(dark, 'PURCHASES', s == null ? '…' : '${s.count}')),
      const SizedBox(width: 8),
      Expanded(child: _statTile(dark, 'TOP SITE', top, small: true)),
      const SizedBox(width: 8),
      Expanded(child: _statTile(dark, 'THIS MONTH', s == null ? '…' : inrAmount(thisMonth.toDouble()))),
    ]);
  }

  Widget _statTile(bool dark, String label, String value, {bool small = false}) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: dark ? T1SColors.slate900 : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: dark ? T1SColors.slate800 : T1SColors.slate200),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 9, w: FontWeight.w800, color: dark ? T1SColors.slate500 : T1SColors.slate400)),
          const SizedBox(height: 6),
          Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, small ? 12 : 15, w: FontWeight.w900)),
        ]),
      );

  Widget _entries(bool dark) {
    final list = _data?.entries ?? const <SpendEntryM>[];
    if (list.isEmpty) {
      return Text('Nothing here yet — nothing is fabricated either. Add your first purchase with the + button.',
          style: tx(context, 12, color: dark ? T1SColors.slate400 : T1SColors.slate500));
    }
    return Column(
      children: [for (final e in list) _entryTile(dark, e)],
    );
  }

  Widget _entryTile(bool dark, SpendEntryM e) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(children: [
          SizedBox(
            width: 96,
            child: Text(e.merchant, maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 12, w: FontWeight.w900)),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(e.itemTitle ?? '—', maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 11, color: dark ? T1SColors.slate400 : T1SColors.slate500)),
              Text('${e.entryDate}${e.source == 'redirect' ? ' · from a Buy click' : ''}', style: tx(context, 9, color: dark ? T1SColors.slate500 : T1SColors.slate400)),
            ]),
          ),
          Text(inrAmount(e.amount), style: tx(context, 12, w: FontWeight.w900)),
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: Icon(Icons.delete_outline_rounded, size: 17, color: dark ? T1SColors.slate600 : T1SColors.slate300),
            onPressed: () => _delete(e),
          ),
        ]),
      );
}

/// Horizontal spend bars per website — one brand colour, like the web view.
class _MerchantBars extends StatelessWidget {
  const _MerchantBars({required this.summary, required this.dark});
  final SpendSummary? summary;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final top = (summary?.byMerchant ?? const []).take(8).toList();
    if (top.isEmpty) {
      return Text('No purchases logged yet — this chart builds from real entries only.',
          style: tx(context, 12, color: dark ? T1SColors.slate400 : T1SColors.slate500));
    }
    final max = top.fold<double>(1, (m, x) => ((x['total'] as num?)?.toDouble() ?? 0) > m ? ((x['total'] as num?)?.toDouble() ?? 0) : m);
    return Column(
      children: [
        for (final m in top)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(children: [
              SizedBox(width: 82, child: Text(m['merchant'].toString(), maxLines: 1, overflow: TextOverflow.ellipsis, style: tx(context, 11, w: FontWeight.w800))),
              const SizedBox(width: 6),
              Expanded(
                child: Container(
                  height: 20,
                  decoration: BoxDecoration(color: dark ? T1SColors.slate800 : T1SColors.slate100, borderRadius: BorderRadius.circular(10)),
                  child: FractionallySizedBox(
                    alignment: Alignment.centerLeft,
                    widthFactor: (((m['total'] as num?)?.toDouble() ?? 0) / max).clamp(0.04, 1.0),
                    child: Container(decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(10))),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              SizedBox(width: 68, child: Text(inrAmount((m['total'] as num?)?.toDouble() ?? 0), textAlign: TextAlign.right, style: tx(context, 11, w: FontWeight.w800))),
            ]),
          ),
      ],
    );
  }
}

/// Monthly trend line via CustomPainter — REAL data from confirmed entries only.
class _MonthTrend extends StatelessWidget {
  const _MonthTrend({required this.summary});
  final SpendSummary? summary;

  @override
  Widget build(BuildContext context) {
    final months = summary?.byMonth ?? const [];
    if (months.length < 2) {
      return Text('Add purchases from at least two different months to see your trend line.',
          style: tx(context, 12, color: isDark(context) ? T1SColors.slate400 : T1SColors.slate500));
    }
    return SizedBox(
      height: 150,
      child: CustomPaint(painter: _TrendPainter(months), size: Size.infinite),
    );
  }
}

class _TrendPainter extends CustomPainter {
  _TrendPainter(this.months);
  final List<Map<String, dynamic>> months;

  @override
  void paint(Canvas canvas, Size size) {
    final pts = <Offset>[];
    final max = months.fold<double>(1, (m, x) => ((x['total'] as num?)?.toDouble() ?? 0) > m ? ((x['total'] as num?)?.toDouble() ?? 0) : m);
    final w = size.width, h = size.height;
    for (var i = 0; i < months.length; i++) {
      final x = 24 + (i * (w - 48)) / (months.length - 1);
      final y = h - 26 - (((months[i]['total'] as num?)?.toDouble() ?? 0) / max) * (h - 52);
      pts.add(Offset(x, y));
    }
    final line = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (final p in pts.skip(1)) line.lineTo(p.dx, p.dy);
    final area = Path.from(line)
      ..lineTo(pts.last.dx, h - 22)
      ..lineTo(pts.first.dx, h - 22)
      ..close();

    final red = T1SColors.red.withOpacity(0.08);
    canvas.drawPath(area, Paint()..color = red..style = PaintingStyle.fill);
    canvas.drawPath(line, Paint()
      ..color = T1SColors.red
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round);

    final tp = TextPainter(textDirection: TextDirection.ltr, textAlign: TextAlign.center);
    for (var i = 0; i < months.length; i++) {
      canvas.drawCircle(pts[i], 4, Paint()..color = T1SColors.red);
      final ym = months[i]['month'].toString();
      final label = ym.length >= 7 ? '${_monthShort(ym.substring(5, 7))} ${ym.substring(2, 4)}' : ym;
      tp.text = TextSpan(text: label, style: const TextStyle(fontSize: 9, color: T1SColors.slate400));
      tp.layout();
      tp.paint(canvas, Offset(pts[i].dx - tp.width / 2, h - 20));
    }
  }

  String _monthShort(String mm) => const ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][(int.tryParse(mm) ?? 1) - 1];

  @override
  bool shouldRepaint(covariant _TrendPainter old) => old.months != months;
}

/// Add/confirm purchase sheet — prefilled when launched from a Buy-click redirect.
class _AddSpendSheet extends StatefulWidget {
  const _AddSpendSheet({this.initial});
  final SpendPrefill? initial;

  @override
  State<_AddSpendSheet> createState() => _AddSpendSheetState();
}

class _AddSpendSheetState extends State<_AddSpendSheet> {
  late final TextEditingController _merchant;
  late final TextEditingController _amount;
  late final TextEditingController _item;
  late DateTime _date;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _merchant = TextEditingController(text: widget.initial?.merchant ?? '');
    _amount = TextEditingController(text: widget.initial != null && widget.initial!.amount > 0 ? widget.initial!.amount.toStringAsFixed(0) : '');
    _item = TextEditingController(text: widget.initial?.itemTitle ?? '');
    _date = DateTime.now();
  }

  @override
  void dispose() {
    _merchant.dispose();
    _amount.dispose();
    _item.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2000), lastDate: DateTime.now().add(const Duration(days: 1)));
    if (d != null) setState(() => _date = d);
  }

  Future<void> _save() async {
    final auth = AuthService.instance;
    if (auth.token == null) { if (mounted) Navigator.pop(context, false); return; }
    final amount = double.tryParse(_amount.text.trim()) ?? 0;
    if (_merchant.text.trim().isEmpty || amount <= 0) {
      toast(context, 'Enter the website and the amount', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await AppState.instance.api.addSpend(
        auth.token!,
        merchant: _merchant.text.trim(),
        amount: amount,
        itemTitle: _item.text.trim(),
        entryDate: _date.toIso8601String().substring(0, 10),
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) toast(context, '$e'.replaceFirst('Exception: ', ''), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dark = isDark(context);
    final iso = _date.toIso8601String().substring(0, 10);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 26),
        decoration: BoxDecoration(
          color: dark ? T1SColors.slate900 : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Log a purchase', style: tx(context, 16, w: FontWeight.w900)),
          const SizedBox(height: 4),
          Text('Only purchases you confirm are counted.', style: tx(context, 11, color: dark ? T1SColors.slate400 : T1SColors.slate500)),
          const SizedBox(height: 14),
          TextField(
            controller: _merchant,
            decoration: InputDecoration(labelText: 'Website / store (e.g. Amazon.in)', isDense: true, border: const OutlineInputBorder(), fillColor: dark ? T1SColors.slate800 : T1SColors.slate50, filled: true),
            style: tx(context, 13),
          ),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(
              child: TextField(
                controller: _amount,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(labelText: 'Amount (₹)', isDense: true, border: const OutlineInputBorder(), fillColor: dark ? T1SColors.slate800 : T1SColors.slate50, filled: true),
                style: tx(context, 13),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextField(
                controller: _item,
                decoration: InputDecoration(labelText: 'Item (optional)', isDense: true, border: const OutlineInputBorder(), fillColor: dark ? T1SColors.slate800 : T1SColors.slate50, filled: true),
                style: tx(context, 13),
              ),
            ),
          ]),
          const SizedBox(height: 10),
          InkWell(
            onTap: _pickDate,
            borderRadius: BorderRadius.circular(8),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
              decoration: BoxDecoration(color: dark ? T1SColors.slate800 : T1SColors.slate50, borderRadius: BorderRadius.circular(8)),
              child: Row(children: [
                Icon(Icons.calendar_today_rounded, size: 15, color: T1SColors.red),
                const SizedBox(width: 8),
                Text('Purchase date: $iso', style: tx(context, 12, w: FontWeight.w700)),
              ]),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: RedButton(_busy ? 'Saving…' : 'Add to Spend Lens', onTap: _busy ? null : _save),
          ),
        ]),
      ),
    );
  }
}
