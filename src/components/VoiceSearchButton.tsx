import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';

/**
 * Voice search button — Web Speech API (webkitSpeechRecognition), en-IN.
 * Speech goes straight into the vertical's live search pipeline.
 * Renders nothing when the browser has no speech support.
 */

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: any) => void) | null;
  start: () => void;
  stop: () => void;
}

export const VoiceSearchButton: React.FC<{
  onTranscript: (text: string) => void;
  accent?: 'orange' | 'blue' | 'red' | 'dark';
  size?: 'sm' | 'md';
}> = ({ onTranscript, accent = 'orange', size = 'sm' }) => {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef('');

  useEffect(() => {
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const rec: SpeechRecognitionLike = new Ctor();
    rec.lang = 'en-IN';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      // accumulate finals in case the engine fires multiple results
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalRef.current += e.results[i][0].transcript;
      }
    };
    rec.onend = () => {
      setListening(false);
      const text = finalRef.current.trim();
      finalRef.current = '';
      if (text) onTranscript(text);
    };
    rec.onerror = () => {
      setListening(false);
      finalRef.current = '';
    };
    recRef.current = rec;
    return () => {
      try { rec.stop(); } catch { /* already stopped */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!supported) return null;

  const toggle = () => {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      try { rec.stop(); } catch { /* noop */ }
      return;
    }
    finalRef.current = '';
    try {
      rec.start();
      setListening(true);
    } catch { /* start failed (already running) */ }
  };

  const palette =
    accent === 'blue'
      ? listening ? 'bg-red-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'
      : accent === 'red'
      ? listening ? 'bg-red-700 animate-pulse' : 'bg-red-600 hover:bg-red-500'
      : accent === 'dark'
      ? listening ? 'bg-red-700 animate-pulse' : 'bg-slate-900 hover:bg-slate-800'
      : listening ? 'bg-red-600 animate-pulse' : 'bg-orange-600 hover:bg-orange-700';

  const dims = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? 'Listening… speak now (tap to stop)' : 'Voice search — speak your query'}
      aria-label={listening ? 'Stop voice search' : 'Start voice search'}
      className={`${dims} ${palette} text-white rounded-xl flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-xs`}
    >
      {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
    </button>
  );
};
