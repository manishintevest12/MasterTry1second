/**
 * (owner 23 Oct, prod log audit: 120 "Not implemented: HTMLCanvasElement's
 * getContext() ... installing the canvas npm package" errors/hour) The AWS WAF
 * challenge solver runs challenge.js inside jsdom WITHOUT the native canvas
 * package — jsdom then reports the canvas call as a virtual-console error.
 * The quiet VirtualConsole (server/common/awsWafChallenge.ts) must swallow
 * that known-harmless family while still surfacing real script errors.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('awsWaf: quiet virtual console swallows canvas not-implemented noise', async () => {
  const { makeQuietVirtualConsole } = await import('../server/common/awsWafChallenge.ts');
  const { JSDOM } = await import('jsdom');

  const vc = await makeQuietVirtualConsole();
  const noise: string[] = [];
  vc.on('jsdomError', (e: any) => {
    // capture whatever the shared logger did NOT swallow — the helper's own
    // handler logs via the server logger, so here we assert on stdout silence
    // instead: nothing should be written for the canvas family.
  });

  // Redirect stderr so the test FAILS if any "Not implemented" noise leaks
  // through the virtual console default forwarding path.
  const realStderrWrite = process.stderr.write.bind(process.stderr);
  let leaked = '';
  process.stderr.write = ((chunk: any) => { leaked += String(chunk); return true; }) as any;
  try {
    const dom = new JSDOM(
      `<html><body><canvas id="c"></canvas><script>document.getElementById("c").getContext("2d");</script></body></html>`,
      { runScripts: 'dangerously', virtualConsole: vc },
    );
    await new Promise((r) => setTimeout(r, 150));
    dom.window.close();
    assert.ok(
      !/not implemented/i.test(leaked),
      `canvas not-implemented noise leaked to stderr: ${leaked.slice(0, 200)}`,
    );
    void noise;
  } finally {
    process.stderr.write = realStderrWrite;
  }
});
