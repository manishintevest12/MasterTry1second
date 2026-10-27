/**
 * ONE latency contract for every vertical (owner 27 Oct: "muje hr vertical ka results
 * within 3 sec chaiye").
 *
 * Before this file the rule lived in scattered literals: products had a 550ms first
 * paint, the generic pipeline raced a 2.2s first paint and then a 3.2s cold deadline,
 * and returned 3.2s + assembly time — measured 3.0-3.4s on food, flights, movies and
 * credit cards, i.e. just over the promise.
 *
 * The contract is now stated once: real results by OWNER_RESULT_DEADLINE_MS (3000),
 * with a slice reserved for response assembly (context build, ranking, JSON) so the
 * FINAL byte still lands inside 3s. Nothing here invents data: a search that cannot
 * reach its deadline returns the honest still-acquiring marker and the client keeps
 * polling the same pipeline that is still running.
 */

/** The owner's promise to users: results within three seconds, every vertical. */
export const OWNER_RESULT_DEADLINE_MS = 3_000;

/**
 * Time kept back from the deadline for assembly so the response still lands inside it.
 * Measured on a 1-CPU box: finalize/rank/post-process can run ~200-300ms after the
 * acquisition race (the event loop is busy, so the ceiling timer fires late). 600ms of
 * headroom keeps the worst observed vertical (bus 2.83s) at ~2.6s instead of on the line.
 */
export const RESPONSE_ASSEMBLY_HEADROOM_MS = 600;

/**
 * Deadline the pipeline may spend acquiring before it must answer (2400ms by default).
 * `T1S_RESULT_DEADLINE_MS` exists for operators who want a different cap; it can never
 * buy a vertical more than the owner's ceiling unless they explicitly raise it.
 */
export function resultDeadlineMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.T1S_RESULT_DEADLINE_MS);
  const ceiling = Number.isFinite(raw) && raw > 0 ? raw : OWNER_RESULT_DEADLINE_MS;
  return Math.max(500, ceiling - RESPONSE_ASSEMBLY_HEADROOM_MS);
}

/** First-paint race window: the deadline minus the assembly slice the finalize step needs. */
export function firstPaintMs(env: NodeJS.ProcessEnv = process.env): number {
  return Math.max(250, resultDeadlineMs(env) - 150);
}
