/**
 * Alexa voice front door (owner 29 Oct: "connect our site and app to Alexa so that platform reach
 * increases and user search increases WITHOUT disturbing the flow and design of the website and
 * app").
 *
 * This is pure server-side: one HTTPS webhook that Amazon's Alexa service calls, plus the skill
 * model files in /alexa. Nothing in the web UI or the Flutter app changes - voice is simply one
 * more client of the SAME search engine (`runSearch`), exactly like the web feed and the app.
 *
 * WHAT THE USER HEARS
 *   "Alexa, ask try one second to compare iPhone 16"
 *   -> "On Try1Second, the lowest verified price for iPhone 16 is 69,900 rupees at Flipkart.
 *       I also found Amazon at 71,499 rupees. Two sellers compared. Prices update live."
 *
 * HONESTY RULES (same as every other surface)
 *   - Only prices our own scan actually returned are spoken. No guessed or invented figure.
 *   - No verified row -> say so plainly and offer the site; never a fabricated answer.
 *   - The spoken list is capped at three sellers; the full comparison stays on the site.
 *
 * SILENCE IS SAFE
 *   Alexa waits ~8s. We answer within VOICE_BUDGET_MS and then either speak real rows or the
 *   honest "still checking" line, so the skill never times out mid-sentence.
 */
import type { SearchInput, SearchResponse } from '../search/searchOrchestrator';

export const VOICE_BUDGET_MS = 6_500;
/** Amazon retries a request it thinks got lost; requests older than this are stale. */
export const MAX_REQUEST_AGE_MS = 150_000;
const SITE_URL = 'https://www.try1second.com';

export interface AlexaRequestEnvelope {
  version?: string;
  session?: { new?: boolean; sessionId?: string; attributes?: Record<string, unknown> };
  context?: { System?: { application?: { applicationId?: string } } };
  request?: {
    type?: string;
    requestId?: string;
    timestamp?: string;
    locale?: string;
    intent?: { name?: string; slots?: Record<string, { value?: string } | undefined> };
    reason?: string;
  };
}

type AlexaResponse = {
  version: '1.0';
  sessionAttributes?: Record<string, unknown>;
  response: {
    outputSpeech: { type: 'SSML'; ssml: string };
    card?: { type: 'Simple'; title: string; content: string };
    reprompt?: { outputSpeech: { type: 'SSML'; ssml: string } };
    shouldEndSession: boolean;
  };
};

/** SSML is XML: an unescaped '&' makes Alexa drop the whole sentence. */
export function ssmlEscape(text: string): string {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function speak(text: string, opts: { card?: { title: string; content: string }; reprompt?: string; attributes?: Record<string, unknown> } = {}): AlexaResponse {
  return {
    version: '1.0',
    ...(opts.attributes ? { sessionAttributes: opts.attributes } : {}),
    response: {
      outputSpeech: { type: 'SSML', ssml: `<speak>${ssmlEscape(text)}</speak>` },
      ...(opts.card ? { card: { type: 'Simple' as const, title: opts.card.title, content: opts.card.content } } : {}),
      ...(opts.reprompt ? { reprompt: { outputSpeech: { type: 'SSML' as const, ssml: `<speak>${ssmlEscape(opts.reprompt)}</speak>` } } } : {}),
      shouldEndSession: !opts.reprompt,
    },
  };
}

/** Amazon's own rule: reject a replayed/stale request. */
export function isFreshRequest(timestamp: string | undefined, now: Date = new Date(), toleranceMs = MAX_REQUEST_AGE_MS): boolean {
  const t = Date.parse(String(timestamp || ''));
  if (!Number.isFinite(t)) return false;
  return Math.abs(now.getTime() - t) <= toleranceMs;
}

/**
 * Reject traffic that is not for OUR skill. When ALEXA_SKILL_ID is not configured yet the check
 * passes (the skill cannot be impersonated before it exists) but the handler reports it, so the
 * gap is visible in the logs instead of hidden.
 */
export function isOurSkill(envelope: AlexaRequestEnvelope, expectedSkillId: string | undefined): { ok: boolean; reason?: string } {
  const got = envelope?.context?.System?.application?.applicationId;
  if (!expectedSkillId) return { ok: true, reason: 'skill-id-not-configured' };
  if (!got) return { ok: false, reason: 'missing-application-id' };
  if (got !== expectedSkillId) return { ok: false, reason: 'foreign-application-id' };
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Query understanding: a voice sentence carries the vertical implicitly ("... bus from Indore to
// Bhopal"), so the vertical is inferred from the words the user actually said and passed to the
// engine as a hint. The engine still does its own routing; this only sharpens it.
// ---------------------------------------------------------------------------------------------
const VERTICAL_HINTS: Array<{ vertical: string; re: RegExp }> = [
  { vertical: 'bus', re: /\b(bus|buses|buss? ticket)\b/i },
  { vertical: 'flights', re: /\b(flight|flights|air ticket|airfare|plane)\b/i },
  { vertical: 'hotels', re: /\b(hotel|hotels|stay|room booking)\b/i },
  { vertical: 'movies', re: /\b(movie|movies|cinema|ticket for the film|show timing)\b/i },
  { vertical: 'cab', re: /\b(cab|taxi|ola|uber|outstation)\b/i },
  { vertical: 'food', re: /\b(food|restaurant|pizza|biryani|dinner|order food)\b/i },
  { vertical: 'grocery', re: /\b(grocery|groceries|milk|atta|vegetables)\b/i },
  { vertical: 'creditcards', re: /\b(credit card|debit card|card offer)\b/i },
  { vertical: 'loans', re: /\b(loan|emi|home loan|personal loan)\b/i },
  { vertical: 'insurance', re: /\b(insurance|policy|premium)\b/i },
  { vertical: 'ecommerce', re: /\b(price of|cheapest|compare|buy)\b/i },
];

/** The engine's vertical ids are plural ('flights'), Alexa's slots are singular ('flight'). */
export const VERTICAL_FROM_SLOT: Record<string, string> = {
  flight: 'flights', flights: 'flights',
  hotel: 'hotels', hotels: 'hotels',
  movie: 'movies', movies: 'movies',
  bus: 'bus', buses: 'bus',
  cab: 'cab', taxi: 'cab',
  train: 'bus', // there is no train vertical; the ground-travel comparison is the honest answer
  food: 'food', grocery: 'grocery', ecommerce: 'ecommerce',
  creditcard: 'creditcards', loan: 'loans', insurance: 'insurance',
};

export function inferVertical(query: string, slotVertical?: string): string {
  const explicit = String(slotVertical || '').trim().toLowerCase();
  if (explicit) return VERTICAL_FROM_SLOT[explicit] || explicit;
  const q = String(query || '');
  for (const h of VERTICAL_HINTS) if (h.re.test(q)) return h.vertical;
  return 'ecommerce'; // the engine's own default for a bare product sentence
}

/** Indian money phrasing Alexa reads naturally: 69900 -> "69,900 rupees". */
export function speakPrice(amount: number): string {
  const rounded = Math.round(amount);
  return `${rounded.toLocaleString('en-IN')} rupees`;
}

export interface VoiceHit {
  title: string;
  seller: string;
  price: number;
  url: string;
}

/** Cheapest first, only rows that carry a real price. Never pads the list. */
export function pickVoiceHits(response: SearchResponse | null | undefined, limit = 3): VoiceHit[] {
  const results: any[] = Array.isArray((response as any)?.results) ? (response as any).results : [];
  const hits: VoiceHit[] = [];
  for (const r of results) {
    const price = Number(
      r?.prices?.effectivePrice ?? r?.prices?.finalPayablePrice ?? r?.prices?.mandatoryTotal ?? r?.prices?.listPrice ?? r?.primaryPrice,
    );
    if (!Number.isFinite(price) || price <= 0) continue;
    const title = String(r?.title || '').trim();
    if (!title) continue;
    const seller = String(r?.seller || r?.vendor || '').trim();
    hits.push({ title, seller, price, url: String(r?.sellerUrl || '') });
  }
  hits.sort((a, b) => a.price - b.price);
  // Spoken answers name SELLERS, so one row per seller is what reads naturally: the cheapest offer
  // that seller has. (Listing every variant made Alexa repeat "Croma at 69,900" twice.)
  const seen = new Set<string>();
  const unique = hits.filter((h) => {
    const key = (h.seller || h.title).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.slice(0, Math.max(1, limit));
}

/** The sentence the user hears. Pure function so the wording is testable and never drifts. */
export function buildSpokenAnswer(query: string, hits: VoiceHit[], totalSellers: number): string {
  const q = String(query || '').trim();
  if (!hits.length) {
    return `I could not verify a live price for ${q} just now. Prices change fast, so open Try1Second dot com to see the comparison, or ask me again in a moment.`;
  }
  const first = hits[0];
  const pricePart = `the lowest verified price for ${q} is ${speakPrice(first.price)}${first.seller ? ` at ${first.seller}` : ''}`;
  const rest = hits.slice(1);
  const others = rest.length
    ? ` I also found ${rest.map((h) => `${h.seller || 'another seller'} at ${speakPrice(h.price)}`).join(', and ')}.`
    : '';
  const sellers = totalSellers > 1 ? `${totalSellers} sellers compared.` : '';
  return `On Try1Second, ${pricePart}.${others} ${sellers} Prices update live.`.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------------------------
export interface AlexaHandlerDeps {
  /** Injected so tests (and the route) share one code path; the route passes runSearch. */
  search: (input: SearchInput) => Promise<SearchResponse>;
  /**
   * Second, patient attempt used only when the first snapshot carried no priced row. The engine
   * answers its first snapshot fast (often before prices land) and then fills in; a listener on a
   * speaker cannot wait forever, so this gets the leftover budget and nothing more.
   */
  searchMore?: (input: SearchInput, deadlineMs: number) => Promise<SearchResponse>;
  skillId?: string;
  now?: () => Date;
  timeoutMs?: number;
  log?: (level: 'info' | 'warn', message: string) => void;
}

function slot(envelope: AlexaRequestEnvelope, ...names: string[]): string {
  const slots = envelope?.request?.intent?.slots || {};
  for (const n of names) {
    const v = slots[n]?.value;
    if (v && String(v).trim()) return String(v).trim();
  }
  return '';
}

/** Speak at most this long; Alexa clips longer speech on some devices. */
function clip(text: string, max = 480): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(', '));
  return (stop > 120 ? cut.slice(0, stop + 1) : cut).trim();
}

export async function handleAlexaRequest(envelope: AlexaRequestEnvelope, deps: AlexaHandlerDeps): Promise<AlexaResponse> {
  const now = deps.now ? deps.now() : new Date();
  const log = deps.log || (() => undefined);
  const type = String(envelope?.request?.type || '');

  const skill = isOurSkill(envelope, deps.skillId);
  if (!skill.ok) {
    log('warn', `alexa: rejected request (${skill.reason})`);
    return speak('This skill is not available to this device.');
  }
  if (skill.reason === 'skill-id-not-configured') {
    log('info', 'alexa: ALEXA_SKILL_ID is not set - accepting requests without skill pinning');
  }
  // Launch/Intent requests carry a timestamp; Amazon's own guidance is to drop stale ones.
  if (envelope?.request?.timestamp && !isFreshRequest(envelope.request.timestamp, now)) {
    log('warn', 'alexa: stale request rejected');
    return speak('Sorry, that request took too long to reach us. Please say it again.');
  }

  const intentName = String(envelope?.request?.intent?.name || '');

  if (type === 'LaunchRequest') {
    return speak(
      'Try1Second here. Ask me for any price and I will compare it live. For example: iPhone sixteen price, or bus from Indore to Bhopal.',
      { reprompt: 'What should I compare?', card: { title: 'Try1Second', content: `Voice compare is live. Full comparison on ${SITE_URL}` } },
    );
  }

  if (type === 'SessionEndedRequest') {
    return speak('Goodbye.', {});
  }

  if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
    return speak('Goodbye.', {});
  }
  if (intentName === 'AMAZON.HelpIntent') {
    return speak(
      'Say what you want to compare, for example: cheapest price of iPhone sixteen, Indore to Bhopal bus, or movie tickets in Indore. I read out the lowest verified price and the sellers I compared.',
      { reprompt: 'What should I compare?' },
    );
  }
  if (intentName === 'AMAZON.FallbackIntent') {
    return speak('I did not catch that. You can say: compare iPhone sixteen.', { reprompt: 'What should I compare?' });
  }

  const city = slot(envelope, 'city');
  const route = [slot(envelope, 'from'), slot(envelope, 'to')].filter(Boolean).join(' to ');
  let query = slot(envelope, 'query', 'product', 'searchQuery') || route;
  let vertical = inferVertical(query, slot(envelope, 'vertical'));

  // "movie tickets in Indore" carries no title: the movie vertical itself answers what is
  // running, so the city is the query rather than a reason to refuse.
  if (intentName === 'MovieTicketIntent') {
    vertical = 'movies';
    query = query || `movies in ${city || 'Indore'}`;
  }
  if (intentName === 'TravelIntent') {
    query = route || query;
    vertical = inferVertical(query, slot(envelope, 'vertical'));
  }

  if (!query) {
    return speak('Tell me what to compare, for example: cheapest price of iPhone sixteen.', { reprompt: 'What should I compare?' });
  }
  const input: SearchInput = {
    query,
    vertical,
    ...(city ? { city } : {}),
    // Voice gets the same engine; the budget only decides when we stop waiting, never what we say.
    coldDeadlineMs: Math.min(VOICE_BUDGET_MS, deps.timeoutMs ?? VOICE_BUDGET_MS),
  };

  let response: SearchResponse | null = null;
  const budget = deps.timeoutMs ?? VOICE_BUDGET_MS;
  const startedAt = Date.now();
  try {
    response = (await Promise.race([
      deps.search(input),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), budget)),
    ])) as SearchResponse | null;
  } catch (e: any) {
    log('warn', `alexa: search failed (${String(e?.message || e).slice(0, 120)})`);
    response = null;
  }

  let hits = pickVoiceHits(response, 3);
  // The engine's first snapshot can arrive before any price is attached (that is exactly what the
  // owner hears as "no price found" on a product). Spend the remaining budget on the polling path
  // before saying we could not verify anything.
  const remaining = budget - (Date.now() - startedAt);
  if (!hits.length && deps.searchMore && remaining > 1_200) {
    try {
      const filled = (await Promise.race([
        deps.searchMore(input, Math.max(900, remaining - 250)),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), Math.max(900, remaining - 200))),
      ])) as SearchResponse | null;
      if (filled) {
        response = filled;
        hits = pickVoiceHits(filled, 3);
      }
    } catch (e: any) {
      log('warn', `alexa: patient search failed (${String(e?.message || e).slice(0, 120)})`);
    }
  }
  const totalSellers = new Set(((response as any)?.results || []).map((r: any) => String(r?.seller || r?.vendor || ''))).size;
  const answer = clip(buildSpokenAnswer(query, hits, totalSellers));

  if (!hits.length) {
    // Nothing verified: say so and invite a retry. The card still carries the site so the user is
    // never left at a dead end.
    return speak(answer, {
      reprompt: 'Do you want me to try again?',
      card: { title: `Try1Second: ${query}`, content: `We could not verify a live price for "${query}" just now. Open ${SITE_URL} for the full comparison.` },
    });
  }

  return speak(answer, {
    card: {
      title: `Try1Second: ${query}`,
      content: [
        `Lowest verified price: ${speakPrice(hits[0].price)}${hits[0].seller ? ` at ${hits[0].seller}` : ''}`,
        ...hits.slice(1).map((h) => `${h.seller || 'Seller'}: ${speakPrice(h.price)}`),
        `Full comparison: ${SITE_URL}`,
      ].join('\n'),
    },
  });
}
