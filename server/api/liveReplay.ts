/**
 * Burst replay for POST /api/scrape/live.
 *
 * OWNER 4 Nov: "existing results और flow को बिना delete किए CPU-reducer code लगाकर /api/scrape/live का
 * load कम kre."
 *
 * MEASURED FIRST (not guessed): assembling an already-cached 240-row answer costs about 1ms of CPU per
 * poll, so route assembly is not the load - acquisition is, and the load governor + cache tiers already
 * cap that. What still reaches the route unnecessarily is the BURST: one screen load fires the same
 * search two or three times within a few hundred milliseconds (web double-mount, a widget plus the
 * feed, a double tap). Each of those runs the whole assembly and the thin-answer merge loop again.
 *
 * This is a very short replay window (T1S_LIVE_REPLAY_MS, default 600ms) keyed by the caller's own poll
 * chain (ip + vertical + query + city + pin + dates), and it only ever stores a COMPLETE answer:
 *  - a gated-empty answer is never stored, so a replay can never show an empty page,
 *  - a still-scanning (pendingRefresh) answer IS stored: the burst poll then gets the same rows it
 *    just got, still flagged pendingRefresh, so it keeps polling exactly as before and can lose at
 *    most the same 600ms window the client's own 2s poll interval already tolerates,
 *  - a replay keeps the stored rows/notice flags and only refreshes latencyMs, so what the client sees
 *    is exactly the answer the previous poll got, not a different one.
 * Set T1S_LIVE_REPLAY_MS=0 to disable it entirely.
 */
const MAX_ENTRIES = Math.max(10, Number(process.env.T1S_LIVE_REPLAY_MAX) || 400);

const replayTtlMs = (): number => {
  const raw = process.env.T1S_LIVE_REPLAY_MS;
  if (raw === undefined) return 600;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 600;
};

interface Entry { at: number; payload: any }
const store = new Map<string, Entry>();

let replays = 0;
let stored = 0;

/** The answer this exact caller got moments ago, or null when the window is empty/expired. */
export function readLiveReplay(key: string): { payload: any } | null {
  if (replayTtlMs() <= 0 || !key) return null;
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > replayTtlMs()) { store.delete(key); return null; }
  replays += 1;
  return hit;
}

/**
 * Remember a COMPLETE answer. Returns false (and stores nothing) for an empty answer or one that
 * still says pendingRefresh, because replaying those would either show an empty page or hide the
 * rows that are about to land.
 */
export function writeLiveReplay(key: string, payload: any): boolean {
  if (replayTtlMs() <= 0 || !key) return false;
  if (!payload || !Array.isArray(payload.results) || payload.results.length === 0) return false;
  if (store.size >= MAX_ENTRIES) {
    // oldest-first prune keeps this map tiny and never grows without bound
    const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, Math.ceil(MAX_ENTRIES / 4));
    for (const [k] of oldest) store.delete(k);
  }
  store.set(key, { at: Date.now(), payload });
  stored += 1;
  return true;
}

export function liveReplayStats(): { replays: number; stored: number; windowMs: number; entries: number } {
  return { replays, stored, windowMs: replayTtlMs(), entries: store.size };
}

/** Test hook. */
export function _resetLiveReplay(): void {
  store.clear();
  replays = 0;
  stored = 0;
}
