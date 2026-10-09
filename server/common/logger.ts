/**
 * Structured, secret-redacting logger. All backend modules log through this.
 * Redacts keys that look like credentials before anything is written.
 */
const REDACT_KEYS = /api[-_]?key|secret|token|password|credential|authorization|bearer|session/i;
const SECRET_VALUE = '[REDACTED]';

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[DEPTH_LIMIT]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    // Redact long opaque tokens that appear inline
    if (value.length > 80 && /^[A-Za-z0-9_\-\.]+$/.test(value)) return '[REDACTED]';
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_KEYS.test(k) ? SECRET_VALUE : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

type Level = 'debug' | 'info' | 'warn' | 'error';
const LEVELS: Record<Level, string> = { debug: 'DEBUG', info: 'INFO', warn: 'WARN', error: 'ERROR' };

function emit(level: Level, module: string, message: string, meta?: unknown) {
  const line = {
    ts: new Date().toISOString(),
    level: LEVELS[level],
    module,
    message,
    ...(meta !== undefined ? { meta: redact(meta) } : {}),
  };
  // Single-line JSON for log aggregation on KVM4 (journald / file capture)
  const out = JSON.stringify(line);
  if (level === 'error') console.error(out);
  else if (level === 'warn') console.warn(out);
  else console.log(out);
}

export const log = {
  debug: (module: string, message: string, meta?: unknown) => {
    if (process.env.LOG_LEVEL === 'debug') emit('debug', module, message, meta);
  },
  info: (module: string, message: string, meta?: unknown) => emit('info', module, message, meta),
  warn: (module: string, message: string, meta?: unknown) => emit('warn', module, message, meta),
  error: (module: string, message: string, meta?: unknown) => emit('error', module, message, meta),
};

export function redactSecrets<T>(value: T): unknown {
  return redact(value);
}
