package com.try1second.try1second

import android.os.Build
import android.speech.tts.TextToSpeech
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.util.Locale

/**
 * Owner 29 Oct ("jb saamne wala voice ki through question kre tho answer dono text and voice form
 * mai wapas aana chaiye"): the app already listens with speech_to_text, so it must also SPEAK the
 * answer. Android's own TextToSpeech engine is used through a tiny channel instead of a new
 * package, so the answer is spoken on any device (Hindi voice when the reply is Hindi, else
 * Indian English) and a device without a voice simply stays silent - the text answer always shows.
 */
class MainActivity : FlutterActivity() {
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var pendingText: String? = null
    private var pendingLang: String? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "speak" -> {
                    val text = call.argument<String>("text") ?: ""
                    val lang = call.argument<String>("lang") ?: "en-IN"
                    if (text.isBlank()) {
                        result.success(false)
                    } else {
                        speak(text, lang)
                        result.success(true)
                    }
                }
                "stop" -> {
                    tts?.stop()
                    pendingText = null
                    result.success(true)
                }
                else -> result.notImplemented()
            }
        }
        tts = TextToSpeech(applicationContext) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) {
                // Queue the reply that arrived while the engine was still loading.
                pendingText?.let { speak(it, pendingLang ?: "en-IN") }
                pendingText = null
            }
        }
    }

    private fun speak(text: String, lang: String) {
        val engine = tts
        if (engine == null || !ttsReady) {
            pendingText = text
            pendingLang = lang
            return
        }
        val locale = Locale.forLanguageTag(lang)
        val available = try { engine.isLanguageAvailable(locale) } catch (_: Exception) { TextToSpeech.LANG_NOT_SUPPORTED }
        if (available == TextToSpeech.LANG_MISSING_DATA || available == TextToSpeech.LANG_NOT_SUPPORTED) {
            engine.language = Locale.US
        } else {
            engine.language = locale
        }
        engine.setSpeechRate(1.0f)
        engine.setPitch(1.0f)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "t1s-answer")
        } else {
            @Suppress("DEPRECATION")
            engine.speak(text, TextToSpeech.QUEUE_FLUSH, null)
        }
    }

    override fun onDestroy() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        super.onDestroy()
    }

    companion object {
        private const val CHANNEL = "try1second/tts"
    }
}
