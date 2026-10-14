import React, { useState } from 'react';
import { Link2, Search, Sparkles, Send, Loader2, TrendingDown, ExternalLink, AlertCircle, Bot, ArrowRight, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VoiceSearchButton } from './VoiceSearchButton';
import { VerticalId } from '../types';

/**
 * Home: (1) Price Lens: paste ANY product link, see the cheapest price across sites.
 *       (2) AI assistant: ask by text or voice ("Delhi to Mumbai flight"), we open that vertical and search.
 * Every number comes from the real /api/lens and /api/search pipeline; nothing is invented.
 */

const SUPPORTED = [
  { name: 'Amazon', domain: 'amazon.in' },
  { name: 'Flipkart', domain: 'flipkart.com' },
  { name: 'Myntra', domain: 'myntra.com' },
  { name: 'Ajio', domain: 'ajio.com' },
  { name: 'Tata CLiQ', domain: 'tatacliq.com' },
  { name: 'Meesho', domain: 'meesho.com' },
  { name: 'Croma', domain: 'croma.com' },
  { name: 'Nykaa', domain: 'nykaa.com' },
];

interface LensResult {
  id: string; title: string; seller: string; price: number; listPrice: number;
  image: string | null; availability: string; goUrl: string;
}
interface LensResponse {
  success: boolean; found?: boolean; error?: string; message?: string;
  product?: { title: string | null; merchant: string; domain: string; pagePrice: number | null; image: string | null; titleSource: string; fetchStatus: string };
  cheapest?: LensResult | null;
  pageVsCheapest?: { pagePrice: number; cheapest: number; saving: number } | null;
  results: LensResult[];
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export const PriceLensAndAssistant: React.FC = () => {
  const { setVertical, setActiveNavTab, setPendingAssistantSearch, addToast } = useApp();

  // ---- Price Lens ----
  const [link, setLink] = useState('');
  const [lensBusy, setLensBusy] = useState(false);
  const [lens, setLens] = useState<LensResponse | null>(null);
  const [lensError, setLensError] = useState<string | null>(null);

  const runLens = async (text?: string) => {
    const input = (text ?? link).trim();
    if (!input) return;
    setLensBusy(true); setLensError(null); setLens(null);
    try {
      const res = await fetch('/api/lens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input }) });
      const data: LensResponse = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || 'Could not check that link');
      setLens(data);
    } catch (e: any) {
      setLensError(String(e?.message || e));
    } finally {
      setLensBusy(false);
    }
  };

  // ---- AI assistant ----
  const [ask, setAsk] = useState('');
  const [askBusy, setAskBusy] = useState(false);
  const [chat, setChat] = useState<{ from: 'me' | 'ai'; text: string }[]>([]);

  const runAsk = async (text?: string) => {
    const q = (text ?? ask).trim();
    if (!q) return;
    setAsk('');
    setChat((c) => [...c.slice(-3), { from: 'me', text: q }]);
    setAskBusy(true);
    try {
      const res = await fetch('/api/assist/intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: q }) });
      const data = await res.json();
      setChat((c) => [...c.slice(-3), { from: 'ai', text: data.reply || 'Sorry, I could not understand that.' }]);
      if (data.understood && data.vertical) {
        // Clear the old vertical's rows first, then hand the question to that vertical's own search form.
        setPendingAssistantSearch({ vertical: data.vertical, query: data.query, date: data.date });
        setVertical(data.vertical as VerticalId);
        setActiveNavTab('compare');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      setChat((c) => [...c.slice(-3), { from: 'ai', text: 'I could not reach the server. Please try again.' }]);
      addToast('alert', 'Assistant unavailable', 'Check your connection and try again.');
    } finally {
      setAskBusy(false);
    }
  };

  const cheapest = lens?.cheapest;

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20 space-y-4">
      {/* ============ PRICE LENS ============ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-900/5 p-3 sm:p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); runLens(); }}
          className="flex items-center gap-2 bg-slate-50 border border-slate-200 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/15 rounded-xl px-3 py-2 transition-all"
        >
          <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Paste any product link (Amazon, Flipkart, Myntra…) to find it cheapest"
            aria-label="Paste a product link"
            className="flex-1 min-w-0 bg-transparent outline-hidden text-sm text-slate-900 placeholder:text-slate-400 py-1"
          />
          {link && (
            <button type="button" onClick={() => { setLink(''); setLens(null); setLensError(null); }} className="text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Clear">
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            disabled={lensBusy || !link.trim()}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-black cursor-pointer transition-colors"
          >
            {lensBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>{lensBusy ? 'Checking' : 'Find Cheapest'}</span>
          </button>
        </form>

        {/* supports: merchant logos */}
        <div className="flex items-center gap-2.5 mt-3 px-1 overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Supports</span>
          {SUPPORTED.map((m) => (
            <span key={m.domain} title={m.name} className="w-7 h-7 shrink-0 rounded-full bg-white border border-slate-200 overflow-hidden flex items-center justify-center shadow-2xs">
              <img
                src={`https://www.google.com/s2/favicons?domain=${m.domain}&sz=64`}
                alt={m.name}
                className="w-5 h-5 object-contain"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </span>
          ))}
          <span className="text-[10px] font-semibold text-slate-400 shrink-0">+ any shopping site</span>
        </div>

        {lensError && (
          <div className="mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-px" /><span>{lensError}</span>
          </div>
        )}

        {lensBusy && (
          <div className="mt-3 text-xs text-slate-500 flex items-center gap-2 px-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" /> Reading the product and comparing live prices across sites…
          </div>
        )}

        {lens && lens.found === false && (
          <div className="mt-3 flex items-start gap-2 text-xs text-slate-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-px text-amber-600" /><span>{lens.message}</span>
          </div>
        )}

        {lens && lens.found && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex items-start gap-3">
              {lens.product?.image && (
                <img src={lens.product.image} alt="" className="w-16 h-16 rounded-lg object-contain bg-slate-50 border border-slate-100 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">From {lens.product?.merchant}</p>
                <h3 className="text-sm font-extrabold text-slate-900 leading-snug line-clamp-2">{lens.product?.title}</h3>
                {lens.product?.pagePrice ? (
                  <p className="text-xs text-slate-500 mt-0.5">This page shows <strong className="text-slate-800">{inr(lens.product.pagePrice)}</strong></p>
                ) : null}
              </div>
            </div>

            {cheapest ? (
              <>
                <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Cheapest we found</p>
                    <p className="text-xl font-black text-slate-900 leading-tight">{inr(cheapest.price)}</p>
                    <p className="text-xs text-slate-600 truncate">on <strong>{cheapest.seller}</strong>
                      {lens.pageVsCheapest && lens.pageVsCheapest.saving > 0 && (
                        <span className="ml-1.5 text-emerald-700 font-bold">· saves {inr(lens.pageVsCheapest.saving)} vs this page</span>
                      )}
                    </p>
                  </div>
                  {cheapest.goUrl && (
                    <a href={cheapest.goUrl} target="_blank" rel="noopener noreferrer sponsored" className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-red-600 text-white text-xs font-black transition-colors">
                      Buy <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                <ul className="mt-3 divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                  {lens.results.slice(0, 8).map((r, i) => (
                    <li key={r.id || i} className="flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-slate-50">
                      <span className="w-6 text-[11px] font-black text-slate-400">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">{r.seller}</p>
                        <p className="text-[11px] text-slate-500 truncate">{r.title}</p>
                      </div>
                      <span className="text-sm font-black text-slate-900">{inr(r.price)}</span>
                      {r.goUrl && (
                        <a href={r.goUrl} target="_blank" rel="noopener noreferrer sponsored" className="text-slate-400 hover:text-red-600" aria-label={`Open on ${r.seller}`}>
                          <ArrowRight className="w-4 h-4" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-3 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                {lens.message || 'No verified prices were found for this product right now.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ============ AI ASSISTANT (text + voice) ============ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-900/5 p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2.5 px-1">
          <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-red-500 to-rose-700 text-white flex items-center justify-center"><Sparkles className="w-3.5 h-3.5" /></span>
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">Ask Try1Second AI</h2>
          <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">type or speak · Hindi, English, Hinglish</span>
        </div>

        {chat.length > 0 && (
          <div className="mb-3 space-y-2 max-h-40 overflow-y-auto px-1">
            {chat.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] text-xs rounded-2xl px-3 py-2 leading-snug ${m.from === 'me' ? 'bg-slate-900 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm flex gap-1.5'}`}>
                  {m.from === 'ai' && <Bot className="w-3.5 h-3.5 shrink-0 mt-px text-red-600" />}
                  <span>{m.text}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); runAsk(); }}
          className="flex items-center gap-2 bg-slate-50 border border-slate-200 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/15 rounded-xl px-3 py-2 transition-all"
        >
          <input
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            placeholder='Ask anything: "Delhi to Mumbai flight ka rate batao"'
            aria-label="Ask the assistant"
            className="flex-1 min-w-0 bg-transparent outline-hidden text-sm text-slate-900 placeholder:text-slate-400 py-1"
          />
          <VoiceSearchButton accent="red" size="md" onTranscript={(t) => { setAsk(t); runAsk(t); }} />
          <button
            type="submit"
            disabled={askBusy || !ask.trim()}
            className="shrink-0 w-9 h-9 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white flex items-center justify-center cursor-pointer transition-colors"
            aria-label="Send"
          >
            {askBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5 mt-2.5 px-1">
          {['Delhi to Mumbai flight', 'Indore to Bhopal bus kal', 'Hotels in Goa', 'Chicken biryani'].map((s) => (
            <button key={s} type="button" onClick={() => runAsk(s)} className="text-[11px] font-semibold text-slate-600 bg-slate-50 hover:bg-red-50 hover:text-red-700 border border-slate-200 rounded-full px-2.5 py-1 cursor-pointer transition-colors">
              {s}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
