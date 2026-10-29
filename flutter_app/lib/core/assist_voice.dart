import 'package:flutter/services.dart';

/// Spoken answers for the AI assistant (owner 29 Oct: a question asked by voice must come back
/// in BOTH text and voice). The device's own engine speaks the very same reply text that is
/// shown, so the audio can never disagree with the screen. Every call is best-effort: on a
/// device or platform without a voice the app stays silent and the text answer stands.
class AssistVoice {
  AssistVoice._();

  static const MethodChannel _channel = MethodChannel('try1second/tts');

  /// Hindi text is spoken with a hi-IN voice, everything else with Indian English.
  static String langFor(String text) => RegExp(r'[\u0900-\u097F]').hasMatch(text) ? 'hi-IN' : 'en-IN';

  /// Cleans prices/marks so the engine reads them out in words instead of symbols.
  static String spokenForm(String text) => text
      .replaceAll('₹', ' rupees ')
      .replaceAll('→', ' to ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();

  static Future<void> speak(String text) async {
    final clean = spokenForm(text);
    if (clean.isEmpty) return;
    try {
      await _channel.invokeMethod('speak', {'text': clean, 'lang': langFor(clean)});
    } catch (_) {
      // No TTS on this build/device: silence is fine, the text answer is already on screen.
    }
  }

  static Future<void> stop() async {
    try {
      await _channel.invokeMethod('stop');
    } catch (_) {
      // Nothing to stop.
    }
  }
}
