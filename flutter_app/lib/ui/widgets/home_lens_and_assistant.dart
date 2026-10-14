import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/app_state.dart';
import '../../core/theme.dart';
import 'common.dart';

/// Home: Price Lens (paste ANY product link -> cheapest across sites)
///      + Ask Try1Second AI (text or voice -> opens that vertical and searches).
/// Every price comes from the real /api/lens and /api/assist/intent pipeline.
class HomeLensAndAssistant extends StatefulWidget {
  const HomeLensAndAssistant({super.key, required this.api, this.onVerticalPicked});

  final Try1SecondApi api;
  /// Called when the assistant routes to a vertical the caller should reflect in its UI.
  final void Function(String vertical)? onVerticalPicked;

  @override
  State<HomeLensAndAssistant> createState() => _HomeLensAndAssistantState();
}

class _HomeLensAndAssistantState extends State<HomeLensAndAssistant> {
  // ---- Price Lens ----
  final _linkCtrl = TextEditingController();
  bool _lensBusy = false;
  LensResponse? _lens;
  String? _lensError;

  // ---- Assistant ----
  final _askCtrl = TextEditingController();
  bool _askBusy = false;
  bool _listening = false;
  final _speech = SpeechToText();
  final List<({bool me, String text})> _chat = [];

  @override
  void dispose() {
    _linkCtrl.dispose();
    _askCtrl.dispose();
    super.dispose();
  }

  Future<void> _runLens([String? input]) async {
    final text = (input ?? _linkCtrl.text).trim();
    if (text.isEmpty) return;
    _linkCtrl.text = text;
    setState(() { _lensBusy = true; _lensError = null; _lens = null; });
    try {
      final res = await widget.api.lens(text);
      setState(() => _lens = res);
    } catch (e) {
      setState(() => _lensError = _plainError(e));
    } finally {
      setState(() => _lensBusy = false);
    }
  }

  Future<void> _ask([String? override]) async {
    final text = (override ?? _askCtrl.text).trim();
    if (text.isEmpty) return;
    _askCtrl.clear();
    setState(() { _chat.add((me: true, text: text)); _askBusy = true; });
    try {
      final intent = await widget.api.assistIntent(text);
      setState(() => _chat.add((me: false, text: intent.reply)));
      if (intent.understood && intent.vertical != null) {
        widget.onVerticalPicked?.call(intent.vertical!);
        if (mounted) {
          AppState.instance.openVertical(intent.vertical!, search: PendingSearch(intent.vertical!, intent.query, date: intent.date));
        }
      }
    } catch (e) {
      setState(() => _chat.add((me: false, text: 'Could not reach the server. Please try again.')));
    } finally {
      setState(() => _askBusy = false);
    }
  }

  Future<void> _toggleVoice() async {
    if (_listening) {
      await _speech.stop();
      setState(() => _listening = false);
      return;
    }
    try {
      final ok = await _speech.initialize();
      if (!ok) {
        setState(() => _chat.add((me: false, text: 'Voice is not available on this device. Please type your question.')));
        return;
      }
      setState(() => _listening = true);
      _speech.listen(
        localeId: 'en_IN',
        listenOptions: null,
        onResult: (r) {
          if (r.finalResult) {
            setState(() => _listening = false);
            _speech.stop();
            _ask(r.recognizedWords);
          }
        },
      );
    } catch (_) {
      setState(() => _chat.add((me: false, text: 'Voice is not available on this device. Please type your question.')));
    }
  }

  String _plainError(Object e) {
    final m = e.toString().replaceFirst(RegExp(r'^Exception: ?'), '');
    return m.isEmpty ? 'Something went wrong. Please try again.' : m;
  }

  Future<void> _open(String goUrl) async {
    if (goUrl.isEmpty) return;
    try {
      await launchUrl(Uri.parse(goUrl), mode: LaunchMode.externalApplication);
    } catch (_) {}
  }

  String _inr(double v) =>
      '₹${v.round().toString().replaceAllMapped(RegExp(r'\\B(?=(\\d{3})+(?!\\d))'), (m) => ',')}';

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ---------------- AI ASSISTANT ----------------
        T1SCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Icon(Icons.auto_awesome_rounded, size: 16, color: T1SColors.red),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'ASK TRY1SECOND AI',
                      style: T1SText.label(context).copyWith(letterSpacing: 0.8),
                    ),
                  ),
                  Text(
                    'text or voice · Hindi, English, Hinglish',
                    style: T1SText.body(context).copyWith(fontSize: 9.5, color: T1SColors.slate500),
                  ),
                ],
              ),
              if (_chat.isNotEmpty) ...[
                const SizedBox(height: 10),
                for (final m in _chat)
                  Align(
                    alignment: m.me ? Alignment.centerRight : Alignment.centerLeft,
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      constraints: const BoxConstraints(maxWidth: 300),
                      decoration: BoxDecoration(
                        color: m.me
                            ? (dark ? Colors.white10 : T1SColors.slate900)
                            : (dark ? const Color(0xFF1E293B) : T1SColors.slate100),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        m.text,
                        style: T1SText.body(context)
                            .copyWith(fontSize: 11.5, color: m.me ? Colors.white : T1SColors.slate800),
                      ),
                    ),
                  ),
              ],
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _askCtrl,
                      onSubmitted: (_) => _ask(),
                      textInputAction: TextInputAction.send,
                      decoration: const InputDecoration(
                        hintText: '"Delhi to Mumbai flight ka rate batao"',
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _toggleVoice,
                    child: Container(
                      height: 44,
                      width: 44,
                      decoration: BoxDecoration(
                        color: _listening ? T1SColors.red : (dark ? const Color(0xFF1E293B) : T1SColors.slate100),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        _listening ? Icons.stop_rounded : Icons.mic_rounded,
                        size: 20,
                        color: _listening ? Colors.white : (dark ? T1SColors.slate200 : T1SColors.slate800),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    height: 44,
                    child: T1SButton.primary(
                      label: 'Ask',
                      onTap: _askBusy ? null : () => _ask(),
                    ),
                  ),
                ],
              ),
              if (_askBusy) ...[
                const SizedBox(height: 10),
                const LinearProgressIndicator(minHeight: 2, color: T1SColors.red),
              ],
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final s in const ['Delhi to Mumbai flight', 'Indore to Bhopal bus kal', 'Hotels in Goa', 'Chicken biryani'])
                    ActionChip(
                      label: Text(s, style: T1SText.body(context).copyWith(fontSize: 10.5)),
                      backgroundColor: dark ? T1SColors.slate900 : Colors.white,
                      side: BorderSide(color: dark ? const Color(0xFF334155) : T1SColors.slate200),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                      onPressed: () => _ask(s),
                    ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  List<Widget> _lensResult(bool dark) {
    final res = _lens!;
    return [
      const SizedBox(height: 12),
      const Divider(height: 1),
      const SizedBox(height: 10),
      if (!res.found)
        _note(Icons.info_outline, res.message ?? 'Could not read a product from that link. Try typing the product name.', dark)
      else ...[
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    res.merchant.toUpperCase(),
                    style: T1SText.label(context).copyWith(fontSize: 9, color: T1SColors.slate500),
                  ),
                  Text(
                    res.title ?? '',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: T1SText.body(context).copyWith(fontWeight: FontWeight.w800),
                  ),
                  if (res.pagePrice != null)
                    Text(
                      'This page shows ${_inr(res.pagePrice!)}',
                      style: T1SText.body(context).copyWith(fontSize: 10.5, color: T1SColors.slate500),
                    ),
                ],
              ),
            ),
          ],
        ),
        if (res.offers.isEmpty)
          _note(Icons.info_outline, res.message ?? 'No verified listing of this exact product right now.', dark)
        else ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: dark ? const Color(0xFF052E16) : const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF86EFAC)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.trending_down_rounded, size: 13, color: Color(0xFF16A34A)),
                          const SizedBox(width: 4),
                          Text(
                            'CHEAPEST WE FOUND',
                            style: T1SText.label(context).copyWith(fontSize: 9, color: const Color(0xFF15803D)),
                          ),
                        ],
                      ),
                      Text(
                        _inr(res.offers.first.price),
                        style: T1SText.body(context).copyWith(fontSize: 22, fontWeight: FontWeight.w900),
                      ),
                      Text(
                        'on ${res.offers.first.seller}'
                        '${res.savingVsPage != null && res.savingVsPage! > 0 ? ' · saves ${_inr(res.savingVsPage!)}' : ''}',
                        style: T1SText.body(context).copyWith(fontSize: 10.5),
                      ),
                    ],
                  ),
                ),
                T1SButton.primary(
                  label: 'Buy',
                  onTap: () => _open(res.offers.first.goUrl),
                ),
              ],
            ),
          ),
          for (final o in res.offers.skip(1).take(7))
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(o.seller,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: T1SText.body(context).copyWith(fontSize: 11.5, fontWeight: FontWeight.w700)),
                        Text(
                          o.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: T1SText.body(context).copyWith(fontSize: 10, color: T1SColors.slate500),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(_inr(o.price), style: T1SText.body(context).copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(width: 6),
                  InkWell(
                    onTap: () => _open(o.goUrl),
                    child: const Padding(
                      padding: EdgeInsets.all(4),
                      child: Icon(Icons.arrow_forward_rounded, size: 15),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ],
    ];
  }

  Widget _note(IconData icon, String text, bool dark) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: dark ? const Color(0xFF1E293B) : T1SColors.slate100,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 15, color: T1SColors.slate500),
            const SizedBox(width: 8),
            Expanded(child: Text(text, style: T1SText.body(context).copyWith(fontSize: 11))),
          ],
        ),
      );
}
