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
  assert.ok(routes.includes('const budgetMs = resultDeadlineMs()'), '/api/search must race the budget');
  assert.ok(routes.includes('setTimeout(() => resolve(null), resultDeadlineMs())'), '/api/scrape/live must race the budget');
});

test('the pipeline default deadline is the shared budget, not a loose literal', () => {
  const orch = readFileSync(join(process.cwd(), 'server/search/searchOrchestrator.ts'), 'utf8');
  assert.ok(!orch.includes('|| 3_200'), 'the old 3.2s cold deadline must not come back');
  assert.ok(orch.includes('|| resultDeadlineMs()'), 'cold deadline must come from the shared budget');
  assert.ok(orch.includes('firstPaintMs()'), 'first-paint window must come from the shared budget');
});
