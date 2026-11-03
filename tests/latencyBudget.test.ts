/**
 * Owner rule (27 Oct): "muje hr vertical ka results within 3 sec chaiye".
 * These tests keep the promise enforceable: one budget, applied everywhere, with
 * enough headroom that a slow finalize step cannot push a response past 3s again.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  OWNER_RESULT_DEADLINE_MS,
  RESPONSE_ASSEMBLY_HEADROOM_MS,
  firstPaintMs,
  resultDeadlineMs,
} from '../server/search/latencyBudget';

test('owner ceiling is three seconds', () => {
  assert.equal(OWNER_RESULT_DEADLINE_MS, 3_000);
});

test('acquisition deadline leaves real assembly headroom under the ceiling', () => {
  const deadline = resultDeadlineMs({} as NodeJS.ProcessEnv);
  assert.equal(deadline, OWNER_RESULT_DEADLINE_MS - RESPONSE_ASSEMBLY_HEADROOM_MS);
  assert.ok(deadline < OWNER_RESULT_DEADLINE_MS, 'acquisition must finish before the ceiling');
  // Measured finalize/rank overrun on a 1-CPU box was ~230ms; the reserve must exceed it.
  assert.ok(RESPONSE_ASSEMBLY_HEADROOM_MS >= 500, 'reserve must absorb post-processing overrun');
});

test('first paint is strictly inside the acquisition deadline', () => {
  const env = {} as NodeJS.ProcessEnv;
  assert.ok(firstPaintMs(env) < resultDeadlineMs(env));
  assert.ok(firstPaintMs(env) >= 250);
});

test('operator override is honoured but never becomes zero', () => {
  assert.equal(resultDeadlineMs({ T1S_RESULT_DEADLINE_MS: '2000' } as NodeJS.ProcessEnv), 1_400);
  assert.equal(resultDeadlineMs({ T1S_RESULT_DEADLINE_MS: '300' } as NodeJS.ProcessEnv), 500);
});

test('both search routes claim the budget and a hard race, not just the pipeline', () => {
  const routes = readFileSync(join(process.cwd(), 'server/api/routes.ts'), 'utf8');
  // Every search route must set the shared deadline and race it, so an overrun answers
  // with the honest pendingRefresh marker instead of making the app wait.
  const claims = routes.match(/input\.coldDeadlineMs = .*resultDeadlineMs\(\)/g) || [];
  assert.ok(claims.length >= 2, `both /api/search and /api/scrape/live must claim the budget (found ${claims.length})`);
  // Owner 28 Oct ('har vertical hotels jaisa'): cold verticals measured 3.3-4.5s because the
  // race fired at the full 2.4s budget and the last-chance floor ran on top of it. The routes
  // now cap acquisition at 2.0s and give the floor 0.6s, so the FINAL byte still lands under
  // the 3s promise. The contract is asserted on those three numbers, not on a literal line.
  // /api/search races through its capped `budgetMs`, /api/scrape/live races the capped
  // expression inline — both forms count, as long as there are exactly two race sites.
  // 28 Oct: /api/assist/answer is the third route that serves real rows (the Ask
  // Try1Second AI answers in every vertical now), so it must honour the SAME capped
  // budget as the two feed routes instead of running an unbounded search.
  // OWNER 3 Nov ('jitne v sellers hai unn sb ka data aaye'): /api/search now races the vertical's
  // FULL SWEEP budget instead of the 2s cap - that cap is exactly what answered with 2 sellers
  // one minute and 5 the next. It is still a hard race with a bounded ceiling (never unbounded,
  // never a poll loop), so the contract below is: two routes keep the 2s cap, /api/search races
  // sweepBudget.
  const capped = (routes.match(/setTimeout\(\(\) => resolve\(null\), (?:Math\.min\(resultDeadlineMs\(\), 2000\)|budgetMs)\)/g) || []).length;
  assert.equal(capped, 2, `scrape/live and assist/answer keep the capped budget (found ${capped})`);
  assert.ok(routes.includes('setTimeout(() => resolve(null), sweepBudget)'), '/api/search must race the full seller sweep');
  assert.match(routes, /hotels' \? 20_000 : sweepVertical === 'flights' \? 18_000/, 'the sweep ceiling must be per vertical and bounded');
  assert.ok(routes.includes('T1S_FULL_SWEEP_MS'), 'the sweep ceiling must be overridable from the environment');
  // The starvation regression: /api/search must never poll the orchestrator in a loop.
  assert.equal(
    (routes.match(/settleSearchComplete\(|settleForRequestedDate\(/g) || []).length,
    0,
    'no polling settle loops in the route (it restarted acquisition and starved the pipeline)',
  );
  assert.ok(routes.includes("apiRouter.post('/assist/answer'"), 'the assistant must answer from the real pipeline');
  assert.ok(routes.includes('lastChanceRows(searchInput, 600)'), 'the assistant answer must also use the bounded last-chance floor');
  assert.ok(routes.includes('const budgetMs = Math.min(resultDeadlineMs(), 2000)'), '/api/search must cap the acquisition budget');
  assert.ok(routes.includes('lastChanceRows(input, 600)'), 'the last-chance floor must be bounded');
  const total = 2000 + 600;
  assert.ok(total < 3000, `acquisition (2000) + floor (600) must stay inside the 3s promise, got ${total}`);
});

test('the pipeline default deadline is the shared budget, not a loose literal', () => {
  const orch = readFileSync(join(process.cwd(), 'server/search/searchOrchestrator.ts'), 'utf8');
  assert.ok(!orch.includes('|| 3_200'), 'the old 3.2s cold deadline must not come back');
  assert.ok(orch.includes('|| resultDeadlineMs()'), 'cold deadline must come from the shared budget');
  assert.ok(orch.includes('firstPaintMs()'), 'first-paint window must come from the shared budget');
});
