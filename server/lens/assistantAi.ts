/**
 * AI assist for "Ask Try1Second" routing.
 *
 * OWNER 18 Nov: the master system prompt must sit in the backend so a typo or an unusual phrasing still
 * routes correctly, and so a question with no results gets a helpful answer instead of a refusal.
 *
 * Where this sits in the design:
 *  - The deterministic interpreter (assistantIntent.ts) stays FIRST and stays authoritative. It is fast,
 *    free, and it is right for every phrasing the owner has already taught it.
 *  - This module is only consulted when that interpreter could NOT place the question (understood=false or
 *    no vertical). It then asks Gemini with MASTER_SYSTEM_PROMPT at temperature 0.1 for parameters only.
 *  - Whatever comes back is validated against the engine's own allowlists and shapes. A field that fails
 *    validation is dropped, never "fixed up": no price, stock, seller or URL can enter from here, and the
 *    real search still runs through the same pipeline as /api/search.
 *  - Any failure (no key, outage, bad JSON) returns null and the caller keeps the deterministic answer, so
 *    the assistant never breaks because of the model.
 */
import { settings } from '../common/settings';
import type { AssistantIntent, AssistantVertical } from './assistantIntent';
import { normalizeAssistantQuestion } from './questionNormalizer';
import { MASTER_JSON_CONTRACT, MASTER_MODEL, MASTER_SYSTEM_PROMPT, MASTER_TEMPERATURE } from '../ai/masterPrompt';

/** The verticals the assistant can route to, exactly as assistantIntent defines them. */
const ROUTABLE: AssistantVertical[] = [
  'flights', 'hotels', 'bus', 'ecommerce', 'grocery', 'food',
  'movies', 'loans', 'insurance', 'cab', 'creditcards', 'account',
];

export interface AiIntent {
  vertical: AssistantVertical | null;
  query: string;
  city?: string;
  date?: string;
  budget?: number;
  quantity?: { value: number; unit: string };
  repaired?: string[];
}

/** Strip anything that is not a usable parameter. Returns null when the model gave us nothing safe. */
export function validateAiIntent(raw: any): AiIntent | null {
  if (!raw || typeof raw !== 'object') return null;
  const vertical = ROUTABLE.includes(raw.vertical) ? (raw.vertical as AssistantVertical) : null;
  const query = typeof raw.query === 'string' ? raw.query.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  const entity = typeof raw.entity === 'string' ? raw.entity.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  const cleanQuery = query || entity;
  if (!cleanQuery || !/[a-z0-9\u0900-\u097F]/i.test(cleanQuery)) return null;

  const out: AiIntent = { vertical, query: cleanQuery };
  if (typeof raw.city === 'string' && /^[a-zA-Z .'-]{2,40}$/.test(raw.city.trim())) out.city = raw.city.trim();
  if (typeof raw.dates?.depart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.dates.depart)) out.date = raw.dates.depart;
  if (raw.dates?.depart instanceof Date) out.date = raw.dates.depart.toISOString().slice(0, 10);
  const budget = Number(raw.budget);
  if (Number.isFinite(budget) && budget > 0 && budget <= 10_000_000) out.budget = Math.round(budget);
  const qValue = Number(raw.quantity?.value);
  const qUnit = String(raw.quantity?.unit || '').toLowerCase();
  if (Number.isFinite(qValue) && qValue > 0 && ['g', 'kg', 'ml', 'l', 'pack', 'pcs'].includes(qUnit)) {
    out.quantity = { value: qValue, unit: qUnit };
  }
  return out;
}

/**
 * Ask the model to place a question the rule-based interpreter could not. Returns null whenever the model
 * is unavailable or its answer does not validate — the caller then keeps its deterministic answer.
 */
export async function aiRouteQuestion(text: string): Promise<AiIntent | null> {
  const question = String(text || '').trim().slice(0, 300);
  if (!question || !settings.aiAssistEnabled || !settings.geminiApiKey) return null;
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });
    const res = await ai.models.generateContent({
      model: MASTER_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                `Question (typos and Hinglish included, keep every stated quantity, size, city, date and count):\n` +
                `"""${question}"""\n\n${MASTER_JSON_CONTRACT}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: MASTER_SYSTEM_PROMPT,
        temperature: MASTER_TEMPERATURE,
        responseMimeType: 'application/json',
        maxOutputTokens: 400,
      },
    });
    const out = String((res as any).text || '');
    const json = JSON.parse(out.replace(/```json|```/g, '').trim());
    const valid = validateAiIntent(json);
    if (!valid) return null;
    // Transparency: the assistant already tells the user which words it repaired.
    const normalized = normalizeAssistantQuestion(question);
    if (normalized.repaired?.length) valid.repaired = normalized.repaired.slice(0, 6);
    return valid;
  } catch {
    return null; // AI is an assist, never a dependency
  }
}

/**
 * Merge the model's parameters into the deterministic intent WITHOUT letting it override a confident
 * deterministic read. Only fills gaps, and never touches the reply wording that the intent module owns.
 */
export function mergeAiIntent(base: AssistantIntent, ai: AiIntent | null): AssistantIntent {
  if (!ai) return base;
  const merged: AssistantIntent = { ...base };
  if (!merged.vertical && ai.vertical) merged.vertical = ai.vertical;
  if (!merged.understood) merged.understood = true;
  // The deterministic query was empty or just the raw text: the model's cleaned query is better.
  const baseQuery = String(merged.query || '').trim();
  if (!baseQuery || baseQuery.length < 3) merged.query = ai.query;
  if (!merged.date && ai.date) merged.date = ai.date;
  if (!merged.budget && ai.budget) merged.budget = ai.budget;
  if (ai.repaired?.length && !merged.normalized) merged.normalized = { transliterated: false, repaired: ai.repaired };
  if (!merged.assumed) merged.assumed = Boolean(ai.vertical && !base.vertical);
  return merged;
}
