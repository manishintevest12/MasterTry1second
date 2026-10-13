/**
 * curl_cffi bridge (Node -> python helper).
 *
 * Some mandatory Indian platforms (BookMyShow via Akamai and others) fingerprint
 * TLS/HTTP2 and hard-block Node's undici and plain curl with 403. This bridge
 * shells out to server/acquisition/pyfetch.py, which performs the same honest
 * HTTPS GET/POST with curl_cffi's browser TLS impersonation — still 100%
 * browserless, no automation frameworks, no CAPTCHA/WAF solving. A hard block is
 * reported as blocked (owner policy: never fabricate).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AcquisitionError } from './httpClient';

// Works under tsx dev (file at server/common/), the bundled server.cjs at repo root,
// and ESM test imports where __dirname does not exist.
const HELPER = (() => {
  const cands: string[] = [];
  try { cands.push(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'acquisition', 'pyfetch.py')); } catch { /* cjs bundle: import.meta shimmed by esbuild */ }
  try { cands.push(path.join(__dirname, 'server', 'acquisition', 'pyfetch.py')); } catch { /* esm: no __dirname */ }
  cands.push(path.join(process.cwd(), 'server', 'acquisition', 'pyfetch.py'));
  return cands.find((c) => fs.existsSync(c)) || cands[cands.length - 1];
})();

export interface CffiResponse {
  status: number;
  body: string;
}

export async function cffiFetch(
  url: string,
  opts: {
    headers?: Record<string, string>;
    method?: 'GET' | 'POST';
    body?: string;
    timeoutMs?: number;
    impersonate?: string;
  } = {},
): Promise<CffiResponse> {
  const payload = JSON.stringify({
    url,
    method: opts.method || 'GET',
    headers: opts.headers || {},
    ...(opts.body ? { body: opts.body } : {}),
    timeoutSec: Math.max(2, Math.ceil((opts.timeoutMs || 20_000) / 1000)),
    impersonate: opts.impersonate || 'safari17_0',
  });

  return new Promise<CffiResponse>((resolve, reject) => {
    const child = spawn('python3', [HELPER], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new AcquisitionError('TIMEOUT', 'curl_cffi bridge timed out'));
    }, (opts.timeoutMs || 20_000) + 5_000);

    child.stdout.on('data', (d: Buffer) => { out += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { err += d.toString(); });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new AcquisitionError('CAPABILITY_UNAVAILABLE', `python3 bridge unavailable: ${e.message}`));
    });
    child.on('close', () => {
      clearTimeout(timer);
      try {
        const res = JSON.parse(out || '{}');
        if (res.ok) return resolve({ status: res.status, body: String(res.body ?? '') });
        reject(new AcquisitionError('SERVER_ERROR', `curl_cffi bridge error: ${res.error || err || 'unknown'}`));
      } catch {
        reject(new AcquisitionError('SERVER_ERROR', `curl_cffi bridge bad output: ${err.slice(0, 200)}`));
      }
    });
    child.stdin.write(payload);
    child.stdin.end();
  });
}
