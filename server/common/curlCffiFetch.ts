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

/**
 * Shared hosting (CloudLinux) ships an ancient system `python3` (3.6) but usually ALSO offers newer
 * interpreters (python3.9/3.11, /opt/alt/pythonNN/bin/python3, a hPanel virtualenv). Probe candidates once,
 * keep the first one that can really `import curl_cffi` (system install or the vendored wheels).
 */
const PY_CANDIDATES = (): string[] => {
  const c: string[] = [];
  if (process.env.PYTHON_BIN) c.push(process.env.PYTHON_BIN);
  for (const v of ['3.13', '3.12', '3.11', '3.10', '3.9', '3.8', '3.7']) c.push(`python${v}`);
  for (const v of ['313', '312', '311', '310', '39', '38', '37']) c.push(`/opt/alt/python${v}/bin/python3`);
  c.push('/usr/local/bin/python3', '/usr/bin/python3.11', '/usr/bin/python3.9', 'python3', 'python');
  return Array.from(new Set(c));
};

export interface PyProbe { bin: string; version?: string; cffi: boolean; error?: string }
let pyChoice: Promise<string> | undefined;
const probeResults: PyProbe[] = [];

function runProbe(bin: string): Promise<PyProbe> {
  return new Promise((resolve) => {
    let out = '';
    let done = false;
    const fin = (r: PyProbe) => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
    let child: ReturnType<typeof spawn>;
    try { child = spawn(bin, [HELPER, '--probe'], { stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e: any) { return resolve({ bin, cffi: false, error: String(e?.message || e) }); }
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* ignore */ } fin({ bin, cffi: false, error: 'probe timeout' }); }, 6000);
    child.stdout?.on('data', (d: Buffer) => { out += d.toString(); });
    child.on('error', (e) => fin({ bin, cffi: false, error: e.message }));
    child.on('close', () => { try { const j = JSON.parse(out); fin({ bin, version: j.version, cffi: !!j.cffi, error: j.error }); } catch { fin({ bin, cffi: false, error: 'no probe output' }); } });
  });
}

export function pythonBin(): Promise<string> {
  if (!pyChoice) {
    pyChoice = (async () => {
      for (const bin of PY_CANDIDATES()) {
        const r = await runProbe(bin);
        if (r.version || r.error !== undefined) probeResults.push(r);
        if (r.cffi) return bin;
      }
      return 'python3';
    })();
  }
  return pyChoice;
}

/** For /api/health/transport: which interpreters exist and whether curl_cffi loads in each. */
export async function pythonDiagnostics(): Promise<{ chosen: string; probes: PyProbe[] }> {
  const chosen = await pythonBin();
  return { chosen, probes: probeResults.filter((p) => p.version || p.cffi) };
}

export interface CffiResponse {
  status: number;
  body: string;
  /** Present when requested via opts.returnCookies: the session cookie jar after the call. */
  cookies?: Record<string, string>;
}

export async function cffiFetch(
  url: string,
  opts: {
    headers?: Record<string, string>;
    method?: 'GET' | 'POST';
    body?: string;
    timeoutMs?: number;
    impersonate?: string;
    /** Force HTTP/1.1 (some Akamai edges reset HTTP/2 streams from datacenter IPs). */
    httpVersion?: '1.1';
    /** Seed the session cookie jar with these cookies (registrable domain of the URL). */
    cookies?: Record<string, string>;
    /** Return the session cookie jar after the call (for multi-step handshakes). */
    returnCookies?: boolean;
  } = {},
): Promise<CffiResponse> {
  const payload = JSON.stringify({
    url,
    method: opts.method || 'GET',
    headers: opts.headers || {},
    ...(opts.body ? { body: opts.body } : {}),
    ...(opts.cookies ? { cookies: opts.cookies } : {}),
    ...(opts.returnCookies ? { returnCookies: true } : {}),
    ...(opts.httpVersion ? { httpVersion: opts.httpVersion } : {}),
    timeoutSec: Math.max(2, Math.ceil((opts.timeoutMs || 20_000) / 1000)),
    impersonate: opts.impersonate || 'safari17_0',
  });

  const py = await pythonBin();
  return new Promise<CffiResponse>((resolve, reject) => {
    const child = spawn(py, [HELPER], { stdio: ['pipe', 'pipe', 'pipe'] });
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
        if (res.ok) return resolve({ status: res.status, body: String(res.body ?? ''), ...(res.cookies ? { cookies: res.cookies as Record<string, string> } : {}) });
        reject(new AcquisitionError('SERVER_ERROR', `curl_cffi bridge error: ${res.error || err || 'unknown'}`));
      } catch {
        reject(new AcquisitionError('SERVER_ERROR', `curl_cffi bridge bad output: ${err.slice(0, 200)}`));
      }
    });
    child.stdin.write(payload);
    child.stdin.end();
  });
}
