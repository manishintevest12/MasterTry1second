import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:speech_to_text/speech_to_text.dart';

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

  // ---- Assistant ----
  final _askCtrl = TextEditingController();
  bool _askBusy = false;
  bool _listening = false;
  final _speech = SpeechToText();
  final List<({bool me, String text})> _chat = [];
  /// OWNER 28 Oct ("Ask Try1Second AI ka text history mai save ho raha hai, space jaa
  /// raha hai"): the transcript is a scratch pad, not a record. It lives in memory only
  /// (never written to disk) and wipes itself one minute after a search finishes, so the
  /// panel is empty again on the next load and never grows into a wall of old questions.
  /// Only the bubbles go; the live result cards, voice button and input are untouched.
  Timer? _chatClearTimer;
  static const _chatTtl = Duration(minutes: 1);

  void _armChatClear() {
    _chatClearTimer?.cancel();
    _chatClearTimer = Timer(_chatTtl, () {
      if (!mounted) return;
      // Text only: the priced result cards are results, not chat history.
      setState(() => _chat.clear());
    });
  }
  /// OWNER 28 Oct: the assistant must show REAL priced rows for every vertical —
  /// not just jump the user to a category. This holds the last answer.
  AssistAnswer? _answer;

  @override
  void initState() {
    super.initState();
    // Never restore an older transcript: every mount starts clean.
    _chat.clear();
    _answer = null;
  }

  @override
  void dispose() {
    _chatClearTimer?.cancel();
    _askCtrl.dispose();
    super.dispose();
  }

  Future<void> _ask([String? override]) async {
    final text = (override ?? _askCtrl.text).trim();
    if (text.isEmpty) return;
    _askCtrl.clear();
    setState(() { _chat.add((me: true, text: text)); _askBusy = true; });
    try {
      // One call answers in EVERY vertical: the server routes the question, runs the
      // same acquisition pipeline as the feed and returns the priced rows here.
      final answer = await widget.api.assistAnswer(text, city: AppState.instance.city);
      if (!mounted) return;
      setState(() {
        _chat.add((me: false, text: answer.reply));
        _answer = answer.understood ? answer : null;
      });
    } catch (e) {
      setState(() => _chat.add((me: false, text: 'Could not reach the server. Please try again.')));
    } finally {
      if (mounted) setState(() => _askBusy = false);
      // Search finished: give the answer one minute on screen, then wipe the text.
      _armChatClear();
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

  String _answerVerticalLabel(String? v) {
    switch (v) {
      case 'flights':
        return 'flights';
      case 'hotels':
        return 'hotels';
      case 'bus':
        return 'bus';
      case 'cab':
        return 'cabs';
      case 'ecommerce':
        return 'shopping results';
      case 'grocery':
        return 'grocery items';
      case 'food':
        return 'food items';
      case 'movies':
        return 'movie tickets';
      case 'loans':
        return 'loans';
      case 'insurance':
        return 'insurance plans';
      case 'creditcards':
        return 'credit cards';
      case 'account':
        return 'bank accounts';
      default:
        return 'results';
    }
  }

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
              if (_answer != null && _answer!.results.isNotEmpty) ...[
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${_answer!.count} live ${_answerVerticalLabel(_answer!.vertical)} · cheapest first',
                        style: T1SText.label(context).copyWith(fontSize: 9.5, color: T1SColors.slate500),
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        final v = _answer!.vertical;
                        if (v == null) return;
                        widget.onVerticalPicked?.call(v);
                        AppState.instance.openVertical(v,
                            search: PendingSearch(v, _answer!.query, date: _answer!.date));
                      },
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        minimumSize: const Size(0, 28),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: Text(
                        'Open all →',
                        style: T1SText.label(context).copyWith(fontSize: 10, color: T1SColors.red),
                      ),
                    ),
                  ],
                ),
                for (final r in _answer!.results.take(4))
                  Container(
                    margin: const EdgeInsets.only(bottom: 6),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: dark ? const Color(0xFF1E293B) : T1SColors.slate50,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: dark ? const Color(0xFF334155) : T1SColors.slate200),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                r.title,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: T1SText.body(context).copyWith(fontSize: 11, fontWeight: FontWeight.w700),
                              ),
                              if (r.specs.isNotEmpty)
                                Text(
                                  r.specs.values.take(2).join(' · '),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: T1SText.body(context).copyWith(fontSize: 9.5, color: T1SColors.slate500),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              r.priceAvailable ? '₹${r.price.round()}' : 'On site',
                              style: T1SText.body(context).copyWith(fontSize: 12, fontWeight: FontWeight.w900),
                            ),
                            if (r.provider.isNotEmpty)
                              Text(
                                r.provider,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: T1SText.body(context).copyWith(fontSize: 9, color: T1SColors.slate500),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                if (_answer!.pendingRefresh)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(
                      'Still scanning more sites — prices update here automatically.',
                      style: T1SText.body(context).copyWith(fontSize: 9.5, color: T1SColors.slate500),
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

}
