var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/common/settings.ts
var import_path, settings, dataDir;
var init_settings = __esm({
  "server/common/settings.ts"() {
    import_path = __toESM(require("path"), 1);
    settings = {
      port: Number(process.env.PORT || 3e3),
      env: process.env.NODE_ENV || "development",
      appUrl: process.env.APP_URL || "",
      /**
       * MySQL connection URL. Two supported forms (discrete vars win — they avoid
       * URL-encoding pitfalls with passwords containing @ : / # % etc.):
       *   1) DB_HOST + DB_PORT + DB_USER + DB_PASSWORD + DB_NAME (as shown in hPanel → Databases)
       *   2) DATABASE_URL / MYSQL_URL (mysql://user:pass@host:port/dbname)
       */
      mysqlUrl: process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME ? `mysql://${encodeURIComponent(process.env.DB_USER)}:${encodeURIComponent(process.env.DB_PASSWORD || "")}@${process.env.DB_HOST}:${process.env.DB_PORT || "3306"}/${encodeURIComponent(process.env.DB_NAME)}` : process.env.DATABASE_URL || process.env.MYSQL_URL || "",
      redisUrl: process.env.REDIS_URL || "",
      /**
       * HTTPS Redis (shared-hosting friendly): Upstash free tier via its REST API.
       * Works on Hostinger shared hosting (HTTPS-only egress, no TCP 6379 needed).
       * Set both in hPanel: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
       * REDIS_URL (ioredis/TCP, KVM4) takes precedence when both are present.
       */
      redisRestUrl: process.env.UPSTASH_REDIS_REST_URL || "",
      redisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN || "",
      geminiApiKey: process.env.GEMINI_API_KEY || "",
      /** First-admin bootstrap: any account registered with this email gets the admin role. */
      adminBootstrapEmail: (process.env.ADMIN_EMAIL || "").toLowerCase(),
      /** Allowed admin login emails (email-OTP). ADMIN_EMAILS is a comma-separated list. */
      adminEmails: (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
      aiAssistEnabled: process.env.AI_ASSIST !== "false" && Boolean(process.env.GEMINI_API_KEY),
      searchApi: {
        apiKey: process.env.SEARCHAPI_API_KEY || "",
        enabled: process.env.SEARCHAPI_ENABLED !== "false" && Boolean(process.env.SEARCHAPI_API_KEY)
      },
      /** Transactional email (Resend) for admin OTP login. */
      resendApiKey: process.env.RESEND_API_KEY || "",
      /** Firebase Authentication (Google sign-in for the main site). Project ID only — keys live client-side. */
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "",
      mailFrom: process.env.MAIL_FROM || "Try1Second <onboarding@resend.dev>",
      cuelinks: {
        apiKey: process.env.CUELINKS_API_KEY || "",
        campaignId: process.env.CUELINKS_CAMPAIGN_ID || "",
        subId: process.env.CUELINKS_SUB_ID || "",
        enabled: Boolean(process.env.CUELINKS_API_KEY)
      },
      admitad: {
        clientId: process.env.ADMITAD_CLIENT_ID || "",
        clientSecret: process.env.ADMITAD_CLIENT_SECRET || "",
        websiteId: process.env.ADMITAD_WEBSITE_ID || "",
        defaultCampaignId: process.env.ADMITAD_DEFAULT_CAMPAIGN_ID || "",
        baseUrl: process.env.ADMITAD_BASE_URL || "https://api.admitad.com",
        scope: process.env.ADMITAD_SCOPE || "advcampaigns_for_website coupons_for_website",
        enabled: Boolean(process.env.ADMITAD_CLIENT_ID && process.env.ADMITAD_CLIENT_SECRET)
      },
      vcommission: {
        apiKey: process.env.VCOMMISSION_API_KEY || "",
        baseUrl: process.env.VCOMMISSION_BASE_URL || "https://api.vcommission.com/v2",
        enabled: Boolean(process.env.VCOMMISSION_API_KEY)
      },
      http: {
        connectTimeoutMs: Number(process.env.HTTP_CONNECT_TIMEOUT_MS || 6e3),
        maxResponseBytes: Number(process.env.HTTP_MAX_RESPONSE_BYTES || 2 * 1024 * 1024),
        globalMaxConcurrency: Number(process.env.HTTP_GLOBAL_CONCURRENCY || 8),
        defaultRetries: 2
      },
      worker: {
        refreshIntervalSec: Number(process.env.REFRESH_INTERVAL_SEC || 300),
        maxRefreshBatch: Number(process.env.REFRESH_BATCH || 25)
      },
      isProduction: (process.env.NODE_ENV || "") === "production"
    };
    dataDir = import_path.default.resolve(
      process.cwd(),
      process.env.DATA_DIR || (process.env.NODE_ENV === "test" ? `.data-tests/${process.pid}` : ".data")
    );
  }
});

// server/common/logger.ts
function redact(value, depth = 0) {
  if (depth > 4) return "[DEPTH_LIMIT]";
  if (value === null || value === void 0) return value;
  if (typeof value === "string") {
    if (value.length > 80 && /^[A-Za-z0-9_\-\.]+$/.test(value)) return "[REDACTED]";
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = REDACT_KEYS.test(k) ? SECRET_VALUE : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}
function emit(level, module2, message, meta) {
  const line = {
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    level: LEVELS[level],
    module: module2,
    message,
    ...meta !== void 0 ? { meta: redact(meta) } : {}
  };
  const out = JSON.stringify(line);
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}
var REDACT_KEYS, SECRET_VALUE, LEVELS, log;
var init_logger = __esm({
  "server/common/logger.ts"() {
    REDACT_KEYS = /api[-_]?key|secret|token|password|credential|authorization|bearer|session/i;
    SECRET_VALUE = "[REDACTED]";
    LEVELS = { debug: "DEBUG", info: "INFO", warn: "WARN", error: "ERROR" };
    log = {
      debug: (module2, message, meta) => {
        if (process.env.LOG_LEVEL === "debug") emit("debug", module2, message, meta);
      },
      info: (module2, message, meta) => emit("info", module2, message, meta),
      warn: (module2, message, meta) => emit("warn", module2, message, meta),
      error: (module2, message, meta) => emit("error", module2, message, meta)
    };
  }
});

// server/common/db.ts
var db_exports = {};
__export(db_exports, {
  FileStore: () => FileStore,
  getStore: () => getStore,
  resetToFileStore: () => resetToFileStore,
  runMigrations: () => runMigrations,
  sanitizeBindParams: () => sanitizeBindParams,
  splitSqlStatements: () => splitSqlStatements
});
function sanitizeBindParams(params) {
  return (params || []).map((p) => p === void 0 || typeof p === "number" && Number.isNaN(p) ? null : p);
}
function getStore() {
  if (store) return store;
  if (settings.mysqlUrl) {
    try {
      const pool = import_promise.default.createPool({
        uri: settings.mysqlUrl,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 8e3,
        // All app-written datetimes are UTC strings; read/write them as UTC so DATETIME
        // round-trips identically regardless of the host's local timezone.
        timezone: "Z"
        // KVM4 sizing: small pool, bounded queue
      });
      store = new MysqlStore(pool);
      log.info("DataStore", "MySQL/MariaDB pool initialized (durable source of truth)");
    } catch (err) {
      log.error("DataStore", "MySQL pool init failed, using file fallback", { error: err.message });
      store = new FileStore();
    }
  } else {
    store = new FileStore();
  }
  return store;
}
function resetToFileStore() {
  store = new FileStore();
  log.warn("DataStore", "Switched to FILE FALLBACK store (non-durable) \u2014 fix MySQL env vars and restart");
}
function splitSqlStatements(sql) {
  const out = [];
  let cur = "";
  let i = 0;
  const hasContent = (s) => s.split("\n").some((line) => line.trim() && !line.trim().startsWith("--") && !line.trim().startsWith("#"));
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "-" && sql[i + 1] === "-") {
      const nl = sql.indexOf("\n", i);
      if (nl === -1) {
        cur += sql.slice(i);
        i = sql.length;
      } else {
        cur += sql.slice(i, nl + 1);
        i = nl + 1;
      }
      continue;
    }
    if (ch === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2;
          continue;
        }
        if (sql[j] === "'") {
          j++;
          break;
        }
        j++;
      }
      cur += sql.slice(i, j);
      i = j;
      continue;
    }
    if (ch === "`") {
      const end = sql.indexOf("`", i + 1);
      const stop = end === -1 ? sql.length : end + 1;
      cur += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === ";") {
      if (hasContent(cur)) out.push(cur.trim());
      cur = "";
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  if (hasContent(cur)) out.push(cur.trim());
  return out;
}
async function runMigrations() {
  const s = getStore();
  if (s.kind !== "mysql") return { applied: [], skipped: "file-fallback (dev)" };
  const dir = import_path2.default.resolve(process.cwd(), "database", "migrations");
  const files = import_fs.default.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  await s.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  const applied = await s.query("SELECT name FROM schema_migrations");
  const done = new Set(applied.map((r) => r.name));
  const appliedNow = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = import_fs.default.readFileSync(import_path2.default.join(dir, f), "utf8");
    await s.transaction(async (tx) => {
      for (const statement of splitSqlStatements(sql)) {
        await tx.execute(statement);
      }
      await tx.execute("INSERT INTO schema_migrations (name) VALUES (?)", [f]);
    });
    appliedNow.push(f);
    log.info("Migrations", `Applied ${f}`);
  }
  return { applied: appliedNow, skipped: "mysql" };
}
var import_fs, import_path2, import_promise, MysqlStore, FileStore, store;
var init_db = __esm({
  "server/common/db.ts"() {
    import_fs = __toESM(require("fs"), 1);
    import_path2 = __toESM(require("path"), 1);
    import_promise = __toESM(require("mysql2/promise"), 1);
    init_settings();
    init_logger();
    MysqlStore = class _MysqlStore {
      constructor(pool) {
        this.kind = "mysql";
        this.pool = pool;
      }
      static {
        /**
         * mysql2 rejects `undefined` bind params ("Bind parameters must not contain
         * undefined"). Offers from real feeds (e.g. VCommission campaigns) legitimately
         * have missing optional fields (brand, currency, expiry…), so every param is
         * normalized: undefined → SQL NULL. NaN also becomes NULL, never a fabricated 0.
         */
        this.bind = sanitizeBindParams;
      }
      async query(sql, params = []) {
        const [rows] = await this.pool.query(sql, _MysqlStore.bind(params));
        return rows;
      }
      async execute(sql, params = []) {
        const [result] = await this.pool.execute(sql, _MysqlStore.bind(params));
        const r = result;
        return { affectedRows: r.affectedRows, insertId: r.insertId };
      }
      async transaction(fn) {
        const conn = await this.pool.getConnection();
        try {
          await conn.beginTransaction();
          const tx = {
            query: (sql, params = []) => conn.query(sql, _MysqlStore.bind(params)).then(([r]) => r),
            execute: (sql, params = []) => conn.execute(sql, _MysqlStore.bind(params)).then(([r]) => r)
          };
          const out = await fn(tx);
          await conn.commit();
          return out;
        } catch (err) {
          await conn.rollback();
          throw err;
        } finally {
          conn.release();
        }
      }
      async healthy() {
        try {
          await this.pool.query("SELECT 1");
          return true;
        } catch {
          return false;
        }
      }
    };
    FileStore = class {
      constructor() {
        this.kind = "file";
        // Generic table emulation: { tableName: [rows] }
        this.file = import_path2.default.join(dataDir, "devstore.json");
        this.data = {};
        this.warned = false;
        import_fs.default.mkdirSync(dataDir, { recursive: true });
        if (import_fs.default.existsSync(this.file)) {
          try {
            this.data = JSON.parse(import_fs.default.readFileSync(this.file, "utf8"));
          } catch {
            this.data = {};
          }
        }
      }
      persist() {
        import_fs.default.mkdirSync(dataDir, { recursive: true });
        import_fs.default.writeFileSync(this.file, JSON.stringify(this.data));
        if (!this.warned) {
          this.warned = true;
          log.warn("DataStore", "Using FILE fallback store \u2014 set MYSQL_URL on KVM4 for the real durable catalogue");
        }
      }
      // --- Mini SQL engine (dev parity with the MySQL schema) ---
      tableOf(sql) {
        const m = sql.match(/(?:from|into|update)\s+`?(\w+)`?/i);
        return m ? m[1] : "default";
      }
      /** Parse WHERE clauses: supports "col = ?", "col IS [NOT] NULL", "col > n" joined by AND. */
      whereOf(sql, params) {
        const m = sql.match(/where\s+([\s\S]+?)(?:order by|limit|$)/i);
        if (!m) return null;
        const conditions = m[1].split(/\s+and\s+/i).map((c) => c.trim()).filter(Boolean);
        if (conditions.length === 0) return null;
        let p = 0;
        const preds = conditions.map((c) => {
          let cm;
          if (cm = c.match(/^`?(\w+)`?\s*=\s*\?$/i)) {
            const col = cm[1];
            const expected = params[p++];
            return (row) => String(row[col]) === String(expected);
          }
          if (cm = c.match(/^`?(\w+)`?\s+is\s+null$/i)) {
            const col = cm[1];
            return (row) => row[col] === null || row[col] === void 0;
          }
          if (cm = c.match(/^`?(\w+)`?\s+is\s+not\s+null$/i)) {
            const col = cm[1];
            return (row) => !(row[col] === null || row[col] === void 0);
          }
          if (cm = c.match(/^`?(\w+)`?\s*(>|>=|<|<=)\s*(\d+)$/i)) {
            const col = cm[1], op = cm[2], v = Number(cm[3]);
            return (row) => {
              const rv = Number(row[col]);
              return op === ">" ? rv > v : op === ">=" ? rv >= v : op === "<" ? rv < v : rv <= v;
            };
          }
          return (_row) => true;
        });
        const pred = (row) => preds.every((fn) => fn(row));
        pred.takesParams = true;
        return pred;
      }
      async query(sql, params = []) {
        const s = sql.trim();
        const table = this.tableOf(s);
        if (!/^select/i.test(s)) return [];
        let rows = [...this.data[table] || []];
        const where = this.whereOf(s, params);
        if (where) rows = rows.filter(where);
        const orderMatch = s.match(/order by\s+`?(\w+)`?\s*(desc)?/i);
        if (orderMatch) {
          rows.sort((a, b) => {
            const av = a[orderMatch[1]], bv = b[orderMatch[1]];
            const cmp = av === bv ? 0 : av > bv ? 1 : -1;
            return orderMatch[2] ? -cmp : cmp;
          });
        }
        const limitMatch = s.match(/limit\s+(\d+)/i);
        if (limitMatch) rows = rows.slice(0, Number(limitMatch[1]));
        return rows;
      }
      /** VALUES parser: maps each column to a param or a literal (number, NULL, NOW(), bool). */
      valuesOf(s, cols, params) {
        const vals = s.match(/values\s*\(([^)]+)\)/i)?.[1] || "";
        const tokens = vals.split(",").map((t) => t.trim());
        const row = {};
        let p = 0;
        cols.forEach((col, i) => {
          const tok = tokens[i];
          if (tok === "?") row[col] = params[p++];
          else if (/^-?\d+(\.\d+)?$/.test(tok)) row[col] = Number(tok);
          else if (/^null$/i.test(tok)) row[col] = null;
          else if (/^now()$/i.test(tok)) row[col] = (/* @__PURE__ */ new Date()).toISOString();
          else if (/^1$/.test(tok)) row[col] = true;
          else if (/^0$/.test(tok)) row[col] = false;
          else row[col] = tok;
        });
        return row;
      }
      async execute(sql, params = []) {
        const s = sql.trim();
        const table = this.tableOf(s);
        if (!this.data[table]) this.data[table] = [];
        if (/^insert/i.test(s)) {
          const cols = (s.match(/insert\s+into\s+`?\w+`?\s*\(([^)]+)\)/i)?.[1] || "").split(",").map((c) => c.trim().replace(/[`]/g, "")).filter(Boolean);
          const row = this.valuesOf(s, cols, params);
          if (!cols.includes("id")) row["id"] = this.data[table].length ? Math.max(...this.data[table].map((r) => Number(r.id) || 0)) + 1 : 1;
          this.data[table].push(row);
          this.persist();
          return { affectedRows: 1, insertId: row["id"] };
        }
        if (/^update/i.test(s)) {
          const setPart = s.match(/set\s+([\s\S]+?)\s+where/i)?.[1];
          const setPlaceholders = (setPart?.match(/\?/g) || []).length;
          const whereParams = params.slice(setPlaceholders);
          const where = this.whereOf(s, whereParams);
          if (!setPart || !where) return { affectedRows: 0, insertId: 0 };
          let affected = 0;
          for (const row of this.data[table]) {
            if (!where(row)) continue;
            for (const assignment of setPart.split(",").map((a) => a.trim())) {
              const cm = assignment.match(/^`?(\w+)`?\s*=\s*(.+)$/);
              if (!cm) continue;
              const col = cm[1], expr = cm[2];
              let qIndex = 0;
              let consumed = 0;
              for (let k = 0; k < assignment.length; k++) if (assignment[k] === "?") consumed++;
              let paramIdx = -1;
              {
                const before = setPart.slice(0, setPart.indexOf(assignment));
                const beforeQ = (before.match(/\?/g) || []).length;
                const localQ = (expr.match(/\?/g) || []).length;
                if (localQ === 1) paramIdx = beforeQ;
              }
              if (/^now\(\)$/i.test(expr)) row[col] = (/* @__PURE__ */ new Date()).toISOString();
              else if (/^null$/i.test(expr)) row[col] = null;
              else if (expr === "?") row[col] = params[paramIdx >= 0 ? paramIdx : 0];
              else if (/^`?(\w+)`?\s*[-+]\s*(\d+)$/i.test(expr)) {
                const am = expr.match(/^`?(\w+)`?\s*([-+])\s*(\d+)$/i);
                const cur = Number(row[am[1]] || 0);
                row[col] = am[2] === "-" ? cur - Number(am[3]) : cur + Number(am[3]);
              } else if (/^`?(\w+)`?$/i.test(expr)) row[col] = row[expr.replace(/[`]/g, "")];
            }
            row["updated_at"] = (/* @__PURE__ */ new Date()).toISOString();
            affected++;
          }
          this.persist();
          return { affectedRows: affected, insertId: 0 };
        }
        if (/^delete/i.test(s)) {
          const where = this.whereOf(s, params);
          const before = this.data[table].length;
          this.data[table] = where ? this.data[table].filter((r) => !where(r)) : [];
          this.persist();
          return { affectedRows: before - this.data[table].length, insertId: 0 };
        }
        return { affectedRows: 0, insertId: 0 };
      }
      async transaction(fn) {
        return fn({ query: this.query.bind(this), execute: this.execute.bind(this) });
      }
      async healthy() {
        return true;
      }
    };
    store = null;
  }
});

// server/sources/health.ts
function blank(sourceId) {
  return {
    sourceId,
    state: "UNVERIFIED",
    consecutiveFailures: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureClass: null,
    circuitOpenUntil: null,
    totalAttempts: 0,
    totalSuccesses: 0,
    avgLatencyMs: null
  };
}
function getHealth(sourceId) {
  return health.get(sourceId) || blank(sourceId);
}
function canAttempt(sourceId, now = Date.now()) {
  const h = getHealth(sourceId);
  if (h.state === "CIRCUIT_OPEN" && h.circuitOpenUntil) {
    if (now < new Date(h.circuitOpenUntil).getTime()) return false;
    const updated = { ...h, state: "DEGRADED", circuitOpenUntil: null };
    health.set(sourceId, updated);
    log.info("Health", `Circuit half-open for ${sourceId}, probing`);
    return true;
  }
  return true;
}
function recordAttempt(sourceId, latencyMs) {
  const h = getHealth(sourceId);
  h.totalAttempts += 1;
  h.avgLatencyMs = h.avgLatencyMs === null ? latencyMs : Math.round(0.7 * h.avgLatencyMs + 0.3 * latencyMs);
  health.set(sourceId, h);
}
function recordSuccess(sourceId, latencyMs) {
  const h = getHealth(sourceId);
  h.totalAttempts += 1;
  h.totalSuccesses += 1;
  h.consecutiveFailures = 0;
  h.lastSuccessAt = (/* @__PURE__ */ new Date()).toISOString();
  h.circuitOpenUntil = null;
  h.state = h.totalSuccesses >= 2 ? "HEALTHY" : "DEGRADED";
  h.avgLatencyMs = h.avgLatencyMs === null ? latencyMs : Math.round(0.7 * h.avgLatencyMs + 0.3 * latencyMs);
  health.set(sourceId, h);
  void persist(h);
}
function recordFailure(sourceId, failureClass, _error) {
  const h = getHealth(sourceId);
  h.totalAttempts += 1;
  h.consecutiveFailures += 1;
  h.lastFailureAt = (/* @__PURE__ */ new Date()).toISOString();
  h.lastFailureClass = failureClass;
  h.state = h.consecutiveFailures >= CIRCUIT_THRESHOLD ? "CIRCUIT_OPEN" : "DEGRADED";
  if (h.state === "CIRCUIT_OPEN") {
    h.circuitOpenUntil = new Date(Date.now() + CIRCUIT_COOLDOWN_MS).toISOString();
    log.warn("Health", `Circuit OPEN for ${sourceId} after ${h.consecutiveFailures} failures (${failureClass})`);
  }
  health.set(sourceId, h);
  void persist(h);
}
async function persist(h) {
  try {
    const { getStore: getStore2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const store2 = getStore2();
    await store2.execute(
      `INSERT INTO source_health (source_id, state, consecutive_failures, last_success_at, last_failure_at, last_failure_class, circuit_open_until, total_attempts, total_successes, avg_latency_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE state=VALUES(state), consecutive_failures=VALUES(consecutive_failures), last_success_at=VALUES(last_success_at), last_failure_at=VALUES(last_failure_at), last_failure_class=VALUES(last_failure_class), circuit_open_until=VALUES(circuit_open_until), total_attempts=VALUES(total_attempts), total_successes=VALUES(total_successes), avg_latency_ms=VALUES(avg_latency_ms)`,
      [h.sourceId, h.state, h.consecutiveFailures, h.lastSuccessAt, h.lastFailureAt, h.lastFailureClass, h.circuitOpenUntil, h.totalAttempts, h.totalSuccesses, h.avgLatencyMs]
    );
  } catch (e) {
    log.debug("Health", "Persist failed (file store / no table)", { error: String(e).slice(0, 120) });
  }
}
var CIRCUIT_THRESHOLD, CIRCUIT_COOLDOWN_MS, health;
var init_health = __esm({
  "server/sources/health.ts"() {
    init_logger();
    CIRCUIT_THRESHOLD = 3;
    CIRCUIT_COOLDOWN_MS = 6e4;
    health = /* @__PURE__ */ new Map();
  }
});

// server/common/curlCffiFetch.ts
function runProbe(bin) {
  return new Promise((resolve) => {
    let out = "";
    let done = false;
    const fin = (r) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(r);
      }
    };
    let child;
    try {
      child = (0, import_node_child_process.spawn)(bin, [HELPER, "--probe"], { stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      return resolve({ bin, cffi: false, error: String(e?.message || e) });
    }
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
      }
      fin({ bin, cffi: false, error: "probe timeout" });
    }, 6e3);
    child.stdout?.on("data", (d) => {
      out += d.toString();
    });
    child.on("error", (e) => fin({ bin, cffi: false, error: e.message }));
    child.on("close", () => {
      try {
        const j = JSON.parse(out);
        fin({ bin, version: j.version, cffi: !!j.cffi, error: j.error });
      } catch {
        fin({ bin, cffi: false, error: "no probe output" });
      }
    });
  });
}
function pythonBin() {
  if (!pyChoice) {
    pyChoice = (async () => {
      for (const bin of PY_CANDIDATES()) {
        const r = await runProbe(bin);
        if (r.version || r.error !== void 0) probeResults.push(r);
        if (r.cffi) return bin;
      }
      return "python3";
    })();
  }
  return pyChoice;
}
async function cffiFetch(url, opts = {}) {
  const payload = JSON.stringify({
    url,
    method: opts.method || "GET",
    headers: opts.headers || {},
    ...opts.body ? { body: opts.body } : {},
    ...opts.cookies ? { cookies: opts.cookies } : {},
    ...opts.returnCookies ? { returnCookies: true } : {},
    timeoutSec: Math.max(2, Math.ceil((opts.timeoutMs || 2e4) / 1e3)),
    impersonate: opts.impersonate || "safari17_0"
  });
  const py = await pythonBin();
  return new Promise((resolve, reject) => {
    const child = (0, import_node_child_process.spawn)(py, [HELPER], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new AcquisitionError("TIMEOUT", "curl_cffi bridge timed out"));
    }, (opts.timeoutMs || 2e4) + 5e3);
    child.stdout.on("data", (d) => {
      out += d.toString();
    });
    child.stderr.on("data", (d) => {
      err += d.toString();
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new AcquisitionError("CAPABILITY_UNAVAILABLE", `python3 bridge unavailable: ${e.message}`));
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const res = JSON.parse(out || "{}");
        if (res.ok) return resolve({ status: res.status, body: String(res.body ?? ""), ...res.cookies ? { cookies: res.cookies } : {} });
        reject(new AcquisitionError("SERVER_ERROR", `curl_cffi bridge error: ${res.error || err || "unknown"}`));
      } catch {
        reject(new AcquisitionError("SERVER_ERROR", `curl_cffi bridge bad output: ${err.slice(0, 200)}`));
      }
    });
    child.stdin.write(payload);
    child.stdin.end();
  });
}
var import_node_child_process, import_node_path, import_node_fs, import_node_url, import_meta, HELPER, PY_CANDIDATES, pyChoice, probeResults;
var init_curlCffiFetch = __esm({
  "server/common/curlCffiFetch.ts"() {
    import_node_child_process = require("node:child_process");
    import_node_path = __toESM(require("node:path"), 1);
    import_node_fs = __toESM(require("node:fs"), 1);
    import_node_url = require("node:url");
    init_httpClient();
    import_meta = {};
    HELPER = (() => {
      const cands = [];
      try {
        cands.push(import_node_path.default.join(import_node_path.default.dirname((0, import_node_url.fileURLToPath)(import_meta.url)), "..", "acquisition", "pyfetch.py"));
      } catch {
      }
      try {
        cands.push(import_node_path.default.join(__dirname, "server", "acquisition", "pyfetch.py"));
      } catch {
      }
      cands.push(import_node_path.default.join(process.cwd(), "server", "acquisition", "pyfetch.py"));
      return cands.find((c) => import_node_fs.default.existsSync(c)) || cands[cands.length - 1];
    })();
    PY_CANDIDATES = () => {
      const c = [];
      if (process.env.PYTHON_BIN) c.push(process.env.PYTHON_BIN);
      for (const v of ["3.13", "3.12", "3.11", "3.10", "3.9", "3.8", "3.7"]) c.push(`python${v}`);
      for (const v of ["313", "312", "311", "310", "39", "38", "37"]) c.push(`/opt/alt/python${v}/bin/python3`);
      c.push("/usr/local/bin/python3", "/usr/bin/python3.11", "/usr/bin/python3.9", "python3", "python");
      return Array.from(new Set(c));
    };
    probeResults = [];
  }
});

// server/common/httpClient.ts
function takeToken(sourceId, maxPerMinute) {
  const now = Date.now();
  const b = buckets.get(sourceId) || { tokens: maxPerMinute, lastRefill: now };
  const refill = (now - b.lastRefill) / 6e4 * maxPerMinute;
  b.tokens = Math.min(maxPerMinute, b.tokens + refill);
  b.lastRefill = now;
  if (b.tokens < 1) {
    buckets.set(sourceId, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(sourceId, b);
  return true;
}
async function acquireSlot(sourceId, maxConcurrency, globalCap) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const cur = inflightPerSource.get(sourceId) || 0;
    if (cur < maxConcurrency && globalInflight < globalCap) {
      inflightPerSource.set(sourceId, cur + 1);
      globalInflight++;
      return true;
    }
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));
  }
  return false;
}
function releaseSlot(sourceId) {
  inflightPerSource.set(sourceId, Math.max(0, (inflightPerSource.get(sourceId) || 1) - 1));
  globalInflight = Math.max(0, globalInflight - 1);
}
function classifyFailure(err) {
  const status = err?.httpStatus;
  if (status) {
    if (status === 401) return { failureClass: "EXPIRED_CREDENTIALS", retryable: false };
    if (status === 403) return { failureClass: "FORBIDDEN", retryable: false };
    if (status === 404) return { failureClass: "NOT_FOUND", retryable: false };
    if (status === 429) return { failureClass: "RATE_LIMITED", retryable: true };
    if (status >= 500) return { failureClass: "SERVER_ERROR", retryable: true };
  }
  const msg = String(err?.message || err || "").toLowerCase();
  const cause = String(err?.cause?.code || err?.cause?.message || "").toLowerCase();
  const all = `${msg} ${cause}`;
  if (err?.name === "AbortError" || all.includes("timeout") || all.includes("aborted")) return { failureClass: "TIMEOUT", retryable: true };
  if (all.includes("enotfound") || all.includes("eai_again") || all.includes("dns")) return { failureClass: "DNS_FAILURE", retryable: true };
  if (all.includes("econnrefused") || all.includes("econnreset") || all.includes("socket") || all.includes("fetch failed")) return { failureClass: "CONNECTION_FAILURE", retryable: true };
  if (all.includes("certificate") || all.includes("tls") || all.includes("ssl") || all.includes("cert_")) return { failureClass: "TLS_FAILURE", retryable: false };
  if (msg.includes("rate limited")) return { failureClass: "RATE_LIMITED", retryable: true };
  if (msg.includes("captcha") || msg.includes("challenge") || msg.includes("login")) return { failureClass: "ACCESS_CHALLENGE", retryable: false };
  if (msg.includes("too large")) return { failureClass: "MALFORMED_RESPONSE", retryable: false };
  return { failureClass: "UNKNOWN", retryable: true };
}
async function httpAcquire(url, opts) {
  const {
    method = "GET",
    headers = {},
    body,
    sourceId,
    timeoutMs = settings.http.connectTimeoutMs,
    retries = settings.http.defaultRetries,
    maxResponseBytes = settings.http.maxResponseBytes,
    maxPerMinute = 30,
    maxConcurrency = 2,
    expectJson
  } = opts;
  if (!takeToken(sourceId, maxPerMinute)) {
    throw new AcquisitionError("RATE_LIMITED", `Local rate limit reached for ${sourceId}`);
  }
  const gotSlot = await acquireSlot(sourceId, maxConcurrency, settings.http.globalMaxConcurrency);
  if (!gotSlot) throw new AcquisitionError("RATE_LIMITED", `Concurrency limit reached for ${sourceId}`);
  const start = Date.now();
  try {
    let attempt = 0;
    let retryAfterMs = 0;
    while (true) {
      attempt++;
      if (attempt === 1 && method === "GET") {
        try {
          const cffi = await cffiFetch(url, { headers, timeoutMs });
          if (cffi.status >= 200 && cffi.status < 500 && cffi.body) {
            const truncated = cffi.body.length > maxResponseBytes ? cffi.body.slice(0, maxResponseBytes) : cffi.body;
            if (cffi.status === 429) {
            } else {
              return {
                ok: cffi.status >= 200 && cffi.status < 300,
                status: cffi.status,
                body: truncated,
                contentType: expectJson ? "application/json" : "text/html",
                latencyMs: Date.now() - start
              };
            }
          }
        } catch {
        }
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method,
          headers: { "User-Agent": DEFAULT_UA, Accept: expectJson ? "application/json" : "*/*", ...headers },
          body,
          signal: controller.signal,
          redirect: "follow"
        });
        clearTimeout(timer);
        const contentType = response.headers.get("content-type") || "";
        if (response.status === 429) {
          const ra = Number(response.headers.get("retry-after") || 0);
          retryAfterMs = ra > 0 ? ra * 1e3 : 1e3 * Math.pow(2, attempt);
          if (attempt <= retries) {
            await backoff(retryAfterMs);
            continue;
          }
          throw new AcquisitionError("RATE_LIMITED", "HTTP 429 after retries", 429);
        }
        if (response.status === 401) throw new AcquisitionError("EXPIRED_CREDENTIALS", "HTTP 401", 401);
        if (response.status === 403) throw new AcquisitionError("FORBIDDEN", "HTTP 403 (source denied access)", 403);
        if (response.status === 404) throw new AcquisitionError("NOT_FOUND", "HTTP 404", 404);
        if (response.status >= 500) {
          if (attempt <= retries) {
            await backoff(800 * Math.pow(2, attempt));
            continue;
          }
          throw new AcquisitionError("SERVER_ERROR", `HTTP ${response.status}`, response.status);
        }
        const lenHeader = Number(response.headers.get("content-length") || "0");
        if (lenHeader > maxResponseBytes) throw new AcquisitionError("MALFORMED_RESPONSE", "Response exceeds bounded size");
        const text = await response.text();
        const truncated = text.length > maxResponseBytes ? text.slice(0, maxResponseBytes) : text;
        if (truncated.length < text.length) log.warn("HttpClient", `Response truncated to bound for ${sourceId}`);
        return {
          ok: response.ok,
          status: response.status,
          body: truncated,
          contentType,
          latencyMs: Date.now() - start
        };
      } catch (err) {
        clearTimeout(timer);
        const { failureClass, retryable } = err instanceof AcquisitionError ? { failureClass: err.failureClass, retryable: failureRetryable(err.failureClass) } : classifyFailure(err);
        if (retryable && attempt <= retries) {
          log.debug("HttpClient", `Retryable failure (${failureClass}) for ${sourceId}, attempt ${attempt}`);
          await backoff(500 * Math.pow(2, attempt));
          continue;
        }
        log.warn("HttpClient", `Acquisition failed for ${sourceId}`, { failureClass, error: String(err.message || err).slice(0, 200) });
        throw new AcquisitionError(failureClass, String(err.message || err), err?.httpStatus);
      }
    }
  } finally {
    releaseSlot(sourceId);
  }
}
function failureRetryable(fc) {
  return ["TIMEOUT", "SERVER_ERROR", "RATE_LIMITED", "DNS_FAILURE", "CONNECTION_FAILURE"].includes(fc);
}
async function backoff(baseMs) {
  const jitter = Math.random() * baseMs * 0.3;
  await new Promise((r) => setTimeout(r, baseMs + jitter));
}
async function httpHealthCheck(url, sourceId) {
  try {
    const r = await httpAcquire(url, { sourceId, retries: 0, timeoutMs: 4e3 });
    return { healthy: r.ok, latencyMs: r.latencyMs, status: r.status };
  } catch (e) {
    return { healthy: false, latencyMs: 0, failureClass: e.failureClass || "UNKNOWN" };
  }
}
var AcquisitionError, buckets, inflightPerSource, globalInflight, DEFAULT_UA;
var init_httpClient = __esm({
  "server/common/httpClient.ts"() {
    init_settings();
    init_logger();
    init_curlCffiFetch();
    AcquisitionError = class extends Error {
      constructor(failureClass, message, httpStatus) {
        super(message);
        this.failureClass = failureClass;
        this.httpStatus = httpStatus;
      }
    };
    buckets = /* @__PURE__ */ new Map();
    inflightPerSource = /* @__PURE__ */ new Map();
    globalInflight = 0;
    DEFAULT_UA = "Try1SecondBot/1.0 (+https://try1second.com; compatible; direct HTTP acquisition; contact via site)";
  }
});

// server/sources/contract.ts
function emptyResult(source, fetchedAt) {
  return {
    success: true,
    sourceId: source.id,
    sourceMethod: source.method,
    rawItems: [],
    latencyMs: 0,
    fetchedAt
  };
}
function failedResult(source, failureClass, error, latencyMs, httpStatus) {
  return {
    success: false,
    sourceId: source.id,
    sourceMethod: source.method,
    rawItems: [],
    httpStatus,
    latencyMs,
    error,
    failureClass,
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function newRawItem(source, partial) {
  return {
    sourceId: source.id,
    title: partial.title,
    price: partial.price,
    currency: partial.currency,
    listPrice: partial.listPrice,
    brand: partial.brand,
    model: partial.model,
    identifiers: partial.identifiers,
    attributes: partial.attributes || {},
    seller: partial.seller,
    sellerUrl: partial.sellerUrl,
    availability: partial.availability || "unknown",
    fees: partial.fees,
    location: partial.location,
    travel: partial.travel,
    expiresAt: partial.expiresAt,
    evidence: partial.evidence || { extractedFields: ["title"] },
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var init_contract = __esm({
  "server/sources/contract.ts"() {
  }
});

// server/acquisition/devFixtures.ts
function devFixturesEnabled() {
  return process.env.T1S_DEV_FIXTURES === "1" && process.env.NODE_ENV === "development";
}
function buildDevFixtures(source, vertical, query) {
  if (!devFixturesEnabled()) return [];
  const q3 = String(query || "sample query").slice(0, 60);
  const mk = (title, price) => newRawItem(source, {
    title,
    price,
    currency: "INR",
    seller: "DEV FIXTURE SELLER",
    sellerUrl: "https://example.com/",
    availability: "in_stock",
    attributes: {
      platform: "DEV FIXTURE",
      data_note: "DEV FIXTURE \u2014 local development sample, not live data",
      image_url: "https://placehold.co/400x400/png?text=DEV+FIXTURE"
    },
    evidence: { sourceUrl: "dev://fixture", sourceReference: `${vertical}:${q3}`, extractedFields: ["title"] }
  });
  return [mk(`DEV FIXTURE \u2014 ${q3} (sample A)`, 199), mk(`DEV FIXTURE \u2014 ${q3} (sample B)`, 499)];
}
var init_devFixtures = __esm({
  "server/acquisition/devFixtures.ts"() {
    init_contract();
  }
});

// server/workers/verticalWorker.ts
function looksLikeChallenge(body) {
  const head = body.slice(0, 6e3);
  const shell = body.length < 12e4;
  const markers = /captcha|robot check|are you a human|unusual traffic|access denied|enable javascript and cookies|verify you human|api-services-support@amazon\.com|enter the characters you see below|to discuss automated access|datadome|cf-chl|px-captcha|blocked|not available in your region/i;
  return markers.test(head) && !/application\/ld\+json/i.test(head) || shell && markers.test(body) && !/"asin"|productTitle|plp-card/i.test(body);
}
async function runTask(worker, task, source, query) {
  const started = Date.now();
  const fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
  const ctx = {
    query,
    source,
    fetch: async (url, opts = {}) => {
      const r = await httpAcquire(url, {
        sourceId: source.id,
        method: opts.method,
        body: opts.body,
        headers: { ...BROWSER_HEADERS, ...opts.headers || {} },
        expectJson: opts.expectJson,
        timeoutMs: opts.timeoutMs ?? 12e3,
        ...opts.maxBytes ? { maxResponseBytes: opts.maxBytes } : {},
        retries: 1,
        maxPerMinute: source.rateLimit.maxRequestsPerMinute,
        maxConcurrency: source.rateLimit.maxConcurrency
      });
      return { status: r.status, body: r.body, ok: r.ok, latencyMs: r.latencyMs };
    }
  };
  try {
    const rawItems = await Promise.race([
      task.run(ctx),
      new Promise((_, rej) => setTimeout(() => rej(new AcquisitionError("TIMEOUT", `worker task exceeded ${(task.timeoutMs ?? 18e3) / 1e3}s`)), task.timeoutMs ?? 18e3))
    ]);
    if (!rawItems.length) {
      return failedResult(source, "EMPTY_RESPONSE", `${worker.vertical} worker: source returned no parseable offers`, Date.now() - started);
    }
    return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems, latencyMs: Date.now() - started, fetchedAt };
  } catch (e) {
    const fc = e instanceof AcquisitionError ? e.failureClass : "UNKNOWN";
    log.debug("VerticalWorker", `${worker.vertical}/${task.sourceId} failed`, { fc, error: String(e?.message || e).slice(0, 140) });
    const fixtures = buildDevFixtures(source, worker.vertical, String(query.rawQuery || query.entityName || ""));
    if (fixtures.length) {
      log.warn("VerticalWorker", `Using DEV fixture for ${source.id} (dev-mode fallback for ${fc})`);
      return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems: fixtures, latencyMs: Date.now() - started, fetchedAt };
    }
    return failedResult(source, fc, String(e?.message || e).slice(0, 200), Date.now() - started, e?.httpStatus);
  }
}
function registerVerticalWorker(worker) {
  WORKERS.set(worker.vertical, worker);
  for (const t of worker.tasks) TASK_INDEX.set(t.sourceId, { worker, task: t });
}
function allVerticalWorkers() {
  return [...WORKERS.values()];
}
function workerTaskIndex() {
  return TASK_INDEX;
}
var BROWSER_UA, BROWSER_HEADERS, VerticalWorkerAdapter, WORKERS, TASK_INDEX;
var init_verticalWorker = __esm({
  "server/workers/verticalWorker.ts"() {
    init_httpClient();
    init_contract();
    init_devFixtures();
    init_logger();
    BROWSER_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
    BROWSER_HEADERS = {
      "User-Agent": BROWSER_UA,
      "Accept-Language": "en-IN,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7"
    };
    VerticalWorkerAdapter = class {
      constructor(workers) {
        this.workers = workers;
        this.id = "vertical_worker_adapter";
        this.method = "direct_http";
        this.adapterVersion = "2.0.0";
        this.parserVersion = "2.0.0";
      }
      async search(ctx) {
        const entry = this.workers.get(ctx.source.id);
        if (!entry) return failedResult(ctx.source, "CAPABILITY_UNAVAILABLE", "No vertical worker task bound to this source", 0);
        return runTask(entry.worker, entry.task, ctx.source, ctx.query);
      }
      async healthCheck(source) {
        const entry = this.workers.get(source.id);
        return { healthy: Boolean(entry), latencyMs: 0, failureClass: entry ? void 0 : "CAPABILITY_UNAVAILABLE" };
      }
      getFreshness(source) {
        return source.freshnessPolicy;
      }
      getExpiry() {
        return null;
      }
    };
    WORKERS = /* @__PURE__ */ new Map();
    TASK_INDEX = /* @__PURE__ */ new Map();
  }
});

// server/workers/parsers/amazonIn.ts
function parseInr(text) {
  if (!text) return void 0;
  const m = text.replace(/\s/g, "").match(/[\d,]+(?:\.\d+)?/);
  if (!m) return void 0;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : void 0;
}
function parseAmazonIn(html, source, searchUrl) {
  const $ = cheerio.load(html);
  const fingerprint = (0, import_crypto2.createHash)("sha256").update(html.slice(0, 5e4)).digest("hex");
  const out = [];
  $('div[data-component-type="s-search-result"]').each((_, el) => {
    const card = $(el);
    const asin = card.attr("data-asin");
    if (!asin) return;
    if (card.find('.puis-sponsored-label-text, [aria-label*="Sponsored"]').length) return;
    const brandText = card.find("h2").first().text().replace(/\s+/g, " ").trim();
    const nameText = (card.find('[data-cy="title-recipe"] a.a-link-normal[class*="line-clamp"]').first().text() || card.find('a.a-link-normal[class*="s-line-clamp"]').first().text() || card.find("img.s-image").first().attr("alt") || "").replace(/\s+/g, " ").trim();
    const title = nameText ? brandText && !nameText.toLowerCase().startsWith(brandText.toLowerCase()) ? `${brandText} ${nameText}` : nameText : brandText;
    const h2 = card.find("h2").first();
    const price = parseInr(card.find("span.a-price:not(.a-text-price) > span.a-offscreen").first().text());
    const mrp = parseInr(card.find("span.a-price.a-text-price > span.a-offscreen").first().text());
    if (!title || !price) return;
    const rating = card.find("span.a-icon-alt").first().text().match(/([\d.]+) out of 5/)?.[1];
    const href = h2.find("a").attr("href") || card.find('a.a-link-normal[href*="/dp/"]').attr("href") || `/dp/${asin}`;
    const url = new URL(href.startsWith("http") ? href : `https://www.amazon.in${href.startsWith("/") ? "" : "/"}${href}`);
    const productUrl = `https://www.amazon.in/dp/${asin}`;
    void url;
    const prime = card.find("i.a-icon-prime").length > 0;
    const img = (card.find("img.s-image").first().attr("src") || "").trim();
    const imageUrl = /^https:\/\/m\.media-amazon\.com\//.test(img) ? img : "";
    const unavailable = /currently unavailable|out of stock/i.test(card.text());
    out.push(newRawItem(source, {
      title: title.slice(0, 220),
      price,
      currency: "INR",
      listPrice: mrp && mrp > price ? mrp : void 0,
      identifiers: { vendorProductId: asin },
      attributes: { ...rating ? { rating } : {}, ...prime ? { prime: "true" } : {}, ...imageUrl ? { image_url: imageUrl } : {} },
      seller: "Amazon.in",
      sellerUrl: productUrl,
      availability: unavailable ? "out_of_stock" : "in_stock",
      evidence: {
        sourceUrl: searchUrl,
        sourceReference: asin,
        rawFingerprint: fingerprint,
        extractedFields: ["title", "price", ...mrp ? ["listPrice"] : [], ...rating ? ["rating"] : [], "availability"]
      }
    }));
  });
  return out.slice(0, 20);
}
var cheerio, import_crypto2;
var init_amazonIn = __esm({
  "server/workers/parsers/amazonIn.ts"() {
    cheerio = __toESM(require("cheerio"), 1);
    import_crypto2 = require("crypto");
    init_contract();
  }
});

// server/workers/parsers/flipkart.ts
function extractAssignedJson(html, marker) {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const eq = html.indexOf("=", at);
  if (eq < 0) return null;
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = eq + 1; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") {
      if (start < 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
function collectUnits(node, out) {
  if (Array.isArray(node)) {
    for (const v of node) collectUnits(v, out);
    return;
  }
  if (node && typeof node === "object") {
    if (node.id && node.titles?.title && Array.isArray(node.pricing?.prices) && node.pricing.prices.length) {
      out.push(node);
      return;
    }
    for (const v of Object.values(node)) collectUnits(v, out);
  }
}
function parseFlipkart(html, source, searchUrl) {
  const state = extractAssignedJson(html, "window.__INITIAL_STATE__");
  if (!state) return [];
  const units = [];
  collectUnits(state, units);
  const fingerprint = (0, import_crypto3.createHash)("sha256").update(html.slice(0, 5e4)).digest("hex");
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const u of units) {
    const id = u.id;
    const title = u.titles?.title;
    const prices = Array.isArray(u.pricing?.prices) ? u.pricing.prices : [];
    const selling = prices.find((p) => !p.strikeOff)?.value;
    const mrp = prices.find((p) => p.strikeOff)?.value;
    if (!id || !title || !selling || selling <= 0 || seen.has(id)) continue;
    seen.add(id);
    const state2 = String(u.availability?.displayState || "");
    const availability = state2 === "IN_STOCK" ? "in_stock" : /OUT_OF_STOCK|SOLD_OUT|UNAVAILABLE/i.test(state2) ? "out_of_stock" : "unknown";
    const avg = u.rating?.average;
    const rawImg = String(u.media?.images?.[0]?.url || u.imageUrl || "");
    const imageUrl = rawImg ? rawImg.replace(/^http:/, "https:").replace("{@width}", "400").replace("{@height}", "400").replace("{@quality}", "70") : "";
    out.push(newRawItem(source, {
      title: title.slice(0, 220),
      price: selling,
      currency: "INR",
      listPrice: mrp && mrp > selling ? mrp : void 0,
      brand: u.titles?.superTitle || void 0,
      identifiers: { vendorProductId: id },
      attributes: { ...avg ? { rating: String(avg) } : {}, ...u.rating?.count ? { rating_count: String(u.rating.count) } : {}, .../^https:\/\/rukmini/.test(imageUrl) ? { image_url: imageUrl } : {} },
      seller: "Flipkart",
      sellerUrl: u.baseUrl ? `https://www.flipkart.com${String(u.baseUrl).split("&")[0]}` : void 0,
      availability,
      evidence: {
        sourceUrl: searchUrl,
        sourceReference: id,
        rawFingerprint: fingerprint,
        extractedFields: ["title", "price", ...mrp ? ["listPrice"] : [], ...availability !== "unknown" ? ["availability"] : [], ...avg ? ["rating"] : []]
      }
    }));
  }
  return out.slice(0, 20);
}
var import_crypto3;
var init_flipkart = __esm({
  "server/workers/parsers/flipkart.ts"() {
    import_crypto3 = require("crypto");
    init_contract();
  }
});

// server/workers/parsers/myntra.ts
function findProductArrays(o, depth = 0) {
  const out = [];
  if (depth > 8 || !o || typeof o !== "object") return out;
  if (Array.isArray(o)) {
    for (const v of o) out.push(...findProductArrays(v, depth + 1));
    return out;
  }
  if (o["products"] && Array.isArray(o["products"]) && o["products"].length && typeof o["products"][0] === "object" && "productName" in o["products"][0]) {
    out.push(o["products"]);
  }
  for (const v of Object.values(o)) out.push(...findProductArrays(v, depth + 1));
  return out;
}
function parseMyntra(html, source, pageUrl) {
  let root = null;
  const direct = /window\.__myx\s*=\s*(\{[\s\S]*?\})\s*;\s*<\/script>/.exec(html);
  if (direct) {
    try {
      root = JSON.parse(direct[1]);
    } catch {
    }
  }
  if (!root) {
    const start = /window\.__myx\s*=\s*\{/.exec(html);
    if (start) {
      const from = start.index + start[0].length - 1;
      let depth = 0, inStr = false, esc = false, end = -1;
      for (let i = from; i < html.length; i++) {
        const ch = html[i];
        if (inStr) {
          if (esc) esc = false;
          else if (ch === "\\") esc = true;
          else if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') inStr = true;
        else if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end > 0) {
        try {
          root = JSON.parse(html.slice(from, end + 1));
        } catch {
        }
      }
    }
  }
  if (!root) return [];
  const arrays = findProductArrays(root);
  const products = arrays.sort((a, b) => b.length - a.length)[0] || [];
  const items = [];
  for (const p of products.slice(0, 40)) {
    const name = String(p.productName || p.product || "").trim();
    const price = Number(p.price);
    if (!name || !Number.isFinite(price) || price <= 0) continue;
    const mrp = Number(p.mrp) > price ? Number(p.mrp) : void 0;
    const landing = String(p.landingPageUrl || "");
    const url = landing ? `https://www.myntra.com/${landing.replace(/^\/+/, "")}` : "https://www.myntra.com";
    const img = p.searchImage ? String(p.searchImage).replace(/^http:/, "https:") : void 0;
    items.push(newRawItem(source, {
      title: name.slice(0, 200),
      brand: p.brand ? String(p.brand).slice(0, 120) : void 0,
      model: p.productId ? String(p.productId) : void 0,
      price,
      listPrice: mrp,
      currency: "INR",
      seller: "Myntra",
      sellerUrl: url,
      attributes: {
        brand: p.brand ? String(p.brand) : "",
        category: p.category ? String(p.category) : "",
        rating: p.rating ? String(Number(p.rating).toFixed(1)) : "",
        rating_count: p.ratingCount ? String(p.ratingCount) : "",
        discount: p.discountDisplayLabel ? String(p.discountDisplayLabel).replace(/[()]/g, "") : "",
        image: img || "",
        data_note: `Product as listed on Myntra search, observed ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`
      },
      identifiers: p.productId ? { sku: String(p.productId) } : void 0,
      evidence: { sourceUrl: pageUrl, extractedFields: ["title", "price", "mrp", "brand", "rating", "image", "landingPageUrl"] }
    }));
  }
  return items;
}
var init_myntra = __esm({
  "server/workers/parsers/myntra.ts"() {
    init_contract();
  }
});

// server/workers/parsers/ajio.ts
function pickImage(p) {
  const direct = p.fnlColorVariantData?.outfitPictureURL;
  if (direct) return String(direct).replace(/^http:/, "https:");
  const media = p.images?.[0]?.media;
  const url = media?.[0]?.mediumImageUrl || media?.[0]?.imageUrl;
  return url ? String(url).replace(/^http:/, "https:") : void 0;
}
function parseAjio(rawBody, source, pageUrl) {
  let root;
  try {
    root = JSON.parse(rawBody);
  } catch {
    return [];
  }
  const products = Array.isArray(root?.products) ? root.products : [];
  const items = [];
  for (const p of products.slice(0, 40)) {
    const name = String(p.name || "").trim();
    const price = Number(p.price?.value);
    if (!name || !Number.isFinite(price) || price <= 0) continue;
    const mrp = Number(p.wasPriceData?.value) > price ? Number(p.wasPriceData?.value) : void 0;
    const brand = p.fnlColorVariantData?.brandName ? String(p.fnlColorVariantData.brandName) : void 0;
    const rel = String(p.url || "");
    const url = rel ? `https://www.ajio.com${rel.startsWith("/") ? rel : `/${rel}`}` : "https://www.ajio.com";
    const img = pickImage(p);
    items.push(newRawItem(source, {
      title: (brand ? `${brand} ${name}` : name).slice(0, 200),
      brand,
      model: p.code ? String(p.code) : void 0,
      price,
      listPrice: mrp,
      currency: "INR",
      seller: "Ajio",
      sellerUrl: url,
      attributes: {
        brand: brand || "",
        discount: p.discountPercent ? `${p.discountPercent}%` : "",
        image: img || "",
        data_note: `Product as listed on Ajio search API, observed ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`
      },
      identifiers: p.code ? { sku: String(p.code) } : void 0,
      evidence: { sourceUrl: pageUrl, extractedFields: ["title", "price", "mrp", "brand", "discount", "image", "url"] }
    }));
  }
  return items;
}
var init_ajio = __esm({
  "server/workers/parsers/ajio.ts"() {
    init_contract();
  }
});

// server/workers/verticals/ecommerce.ts
var q, ecommerceWorker;
var init_ecommerce = __esm({
  "server/workers/verticals/ecommerce.ts"() {
    init_verticalWorker();
    init_amazonIn();
    init_flipkart();
    init_myntra();
    init_ajio();
    init_httpClient();
    init_curlCffiFetch();
    q = (ctx) => String(ctx.query.entityName || ctx.query.rawQuery || "").trim();
    ecommerceWorker = {
      vertical: "ecommerce",
      tasks: [
        {
          sourceId: "w_ecom_amazon_in",
          run: async (ctx) => {
            const term = q(ctx);
            if (!term) return [];
            const url = `https://www.amazon.in/s?k=${encodeURIComponent(term)}`;
            let items = [];
            let lastBody = "";
            for (let attempt = 1; attempt <= 2; attempt++) {
              const r = await ctx.fetch(url);
              if (r.status === 200) {
                lastBody = r.body;
                items = parseAmazonIn(r.body, ctx.source, url);
                if (items.length) break;
              } else if (attempt === 1 && r.status >= 500) {
                await new Promise((res) => setTimeout(res, 1500));
                continue;
              } else {
                throw new AcquisitionError(r.status === 403 ? "ACCESS_CHALLENGE" : "FORBIDDEN", `Amazon.in HTTP ${r.status}`, r.status);
              }
            }
            if (!items.length && looksLikeChallenge(lastBody)) throw new AcquisitionError("ACCESS_CHALLENGE", "Amazon.in presented a challenge page");
            return items;
          }
        },
        {
          sourceId: "w_ecom_flipkart",
          run: async (ctx) => {
            const term = q(ctx);
            if (!term) return [];
            const url = `https://www.flipkart.com/search?q=${encodeURIComponent(term)}`;
            const r = await ctx.fetch(url);
            if (r.status !== 200) throw new AcquisitionError("FORBIDDEN", `Flipkart HTTP ${r.status}`, r.status);
            const items = parseFlipkart(r.body, ctx.source, url);
            if (!items.length && looksLikeChallenge(r.body)) throw new AcquisitionError("ACCESS_CHALLENGE", "Flipkart presented a challenge page");
            return items;
          }
        },
        {
          // Myntra: SSR page with the full result set inside window.__myx
          sourceId: "w_ecom_myntra",
          run: async (ctx) => {
            const term = q(ctx);
            if (!term) return [];
            const slug = term.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
            const url = `https://www.myntra.com/${encodeURIComponent(slug)}`;
            const r = await ctx.fetch(url);
            if (r.status !== 200) throw new AcquisitionError("FORBIDDEN", `Myntra HTTP ${r.status}`, r.status);
            const items = parseMyntra(r.body, ctx.source, url);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", "Myntra page carried no parseable products");
            return items;
          }
        },
        {
          // Ajio: direct JSON search API
          sourceId: "w_ecom_ajio",
          run: async (ctx) => {
            const term = q(ctx);
            if (!term) return [];
            const url = `https://www.ajio.com/api/search?fields=FULL&query=${encodeURIComponent(term)}&pageSize=40`;
            const r = await ctx.fetch(url);
            if (r.status !== 200) throw new AcquisitionError("FORBIDDEN", `Ajio HTTP ${r.status}`, r.status);
            const items = parseAjio(r.body, ctx.source, url);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", "Ajio API returned no parseable products");
            return items;
          }
        },
        // ---- Owner-mandated e-commerce sources: attempted live on every search, honestly reported ----
        {
          sourceId: "w_ecom_meesho",
          name: "Ecom worker: Meesho (probe)",
          priority: 15,
          run: async (ctx) => {
            const term = q(ctx) || "products";
            await cffiFetch(`https://www.meesho.com/search?q=${encodeURIComponent(term)}`, { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError("EMPTY_RESPONSE", "Meesho search serves a client-rendered shell to browserless HTTP; product prices load only via session-gated app APIs.");
          }
        },
        {
          sourceId: "w_ecom_tatacliq",
          name: "Ecom worker: Tata CLiQ (probe)",
          priority: 16,
          run: async (ctx) => {
            const term = q(ctx) || "products";
            await cffiFetch(`https://www.tatacliq.com/search/?text=${encodeURIComponent(term)}`, { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError("EMPTY_RESPONSE", "Tata CLiQ search is a JS-rendered SPA shell; cmdity-federator search API paths are not available unauthenticated to browserless HTTP.");
          }
        }
      ]
    };
    registerVerticalWorker(ecommerceWorker);
  }
});

// server/workers/parsers/bankbazaarLoans.ts
function parseRateRange(text) {
  const nums = [...text.matchAll(/(\d{1,2}(?:\.\d{1,2})?)\s*%/g)].map((m) => Number(m[1])).filter((n) => n > 0 && n < 60);
  if (!nums.length) return {};
  return { min: Math.min(...nums), max: Math.max(...nums) };
}
function parseBankBazaarLoans(html, source, pageUrl, loanType) {
  const $ = cheerio2.load(html);
  const fingerprint = (0, import_crypto4.createHash)("sha256").update(html.slice(0, 5e4)).digest("hex");
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  $("table").each((_, table) => {
    const rows = $(table).find("tr").toArray().map((tr) => $(tr).find("th,td").toArray().map((c) => $(c).text().replace(/\s+/g, " ").trim()));
    if (rows.length < 3) return;
    const header = rows[0].map((h) => h.toLowerCase());
    const bankIdx = header.findIndex((h) => /bank|lender|name/.test(h));
    const rateIdx = header.findIndex((h) => /interest/.test(h));
    if (bankIdx < 0 || rateIdx < 0) return;
    const feeIdx = header.findIndex((h) => /processing/.test(h));
    const tenureIdx = header.findIndex((h) => /tenure|amount/.test(h));
    for (const r of rows.slice(1)) {
      const lender = (r[bankIdx] || "").trim();
      const rateText = r[rateIdx] || "";
      const { min, max } = parseRateRange(rateText);
      if (!lender || min === void 0 || seen.has(lender.toLowerCase())) continue;
      seen.add(lender.toLowerCase());
      const fee = feeIdx >= 0 ? (r[feeIdx] || "").slice(0, 140) : "";
      out.push(newRawItem(source, {
        title: lender.slice(0, 160),
        price: min,
        // lowest published p.a. rate (percent) — drives lowest-first ranking
        currency: "INR",
        seller: "BankBazaar",
        sellerUrl: pageUrl,
        availability: "in_stock",
        attributes: {
          loan_type: loanType,
          interest_rate: rateText.slice(0, 120),
          interest_rate_min: String(min),
          ...max !== void 0 ? { interest_rate_max: String(max) } : {},
          ...fee ? { processing_fee: fee } : {},
          ...tenureIdx >= 0 && r[tenureIdx] ? { tenure_or_amount: r[tenureIdx].slice(0, 140) } : {},
          rate_type: "indicative",
          source_note: "Published indicative rate range; final rate depends on lender approval"
        },
        evidence: {
          sourceUrl: pageUrl,
          sourceReference: `${loanType}:${lender}`,
          rawFingerprint: fingerprint,
          extractedFields: ["title", "interest_rate", ...fee ? ["processing_fee"] : []]
        }
      }));
    }
  });
  return out.slice(0, 40);
}
var import_crypto4, cheerio2;
var init_bankbazaarLoans = __esm({
  "server/workers/parsers/bankbazaarLoans.ts"() {
    import_crypto4 = require("crypto");
    cheerio2 = __toESM(require("cheerio"), 1);
    init_contract();
  }
});

// server/workers/parsers/publishedRates.ts
function extractRateRange(text) {
  const ranged = /(\d{1,2}(?:\.\d{1,2})?)\s*%\s*(?:to|–|-|—|till|upto|up to)\s*(\d{1,2}(?:\.\d{1,2})?)\s*%/i.exec(text);
  if (ranged) return { min: Number(ranged[1]), max: Number(ranged[2]) };
  const single = /(?:starting (?:at|from|as low as)|from|as low as|at)\s*(\d{1,2}(?:\.\d{1,2})?)\s*%\s*(?:p\.?\s?a\.?|per annum)/i.exec(text) || /(\d{1,2}(?:\.\d{1,2})?)\s*%\s*p\.?\s?a\.?/i.exec(text);
  if (single) {
    const v = Number(single[1]);
    return { min: v, max: v };
  }
  return {};
}
function extractProcessingFee(text) {
  const m = /processing fee[^<]{0,120}?((?:upto|up to)?\s*\d{1,2}(?:\.\d+)?\s*%[^<]{0,60})/i.exec(text);
  return m ? m[1].trim() : void 0;
}
function extractLoanAmount(text) {
  const m = /(?:loan amount[^<]{0,80}?)((?:₹|rs\.?\s?)?\d[\d,\.]{1,11}\s*(?:to|-|–|upto|up to)\s*(?:₹|rs\.?\s?)?[\d,\.]{1,11}\s*(?:lakh|lakhs|crore|cr)?)/i.exec(text);
  return m ? m[1].trim() : void 0;
}
function extractTenure(text) {
  const m = /(?:tenure|repayment[^<]{0,40}?)((?:up to\s*)?\d{1,2}\s*(?:years?|months?)\s*(?:\(\d{1,3}\s*months?\))?)/i.exec(text);
  return m ? m[1].trim() : void 0;
}
function buildRateOffer(source, opts) {
  const attrs = {
    ...opts.loanType ? { loan_type: opts.loanType } : {},
    ...opts.insuranceType ? { insurance_type: opts.insuranceType } : {},
    ...opts.planName ? { plan_name: opts.planName } : {},
    ...opts.facts.rateMin !== void 0 ? { interest_rate: String(opts.facts.rateMin) } : {},
    ...opts.facts.rateMin !== void 0 ? { interest_rate_min: String(opts.facts.rateMin) } : {},
    ...opts.facts.rateMin !== void 0 ? { rate_type: "indicative" } : {},
    ...opts.facts.sumInsured ? { quote_type: "indicative" } : {},
    ...opts.facts.rateMax !== void 0 ? { interest_rate_max: String(opts.facts.rateMax) } : {},
    ...opts.facts.processingFee ? { processing_fee: opts.facts.processingFee } : {},
    ...opts.facts.loanAmount ? { loan_amount: opts.facts.loanAmount } : {},
    ...opts.facts.tenure ? { tenure: opts.facts.tenure } : {},
    ...opts.facts.sumInsured ? { sum_insured: opts.facts.sumInsured } : {},
    ...opts.facts.startingPremium ? { starting_premium: opts.facts.startingPremium } : {},
    price_basis: opts.facts.rateMin !== void 0 ? "published annual interest-rate range, indicative \u2014 never an approved offer" : "published plan information",
    data_note: opts.evidenceNote,
    ...opts.extraAttributes || {}
  };
  const bits = [
    opts.planName,
    opts.facts.rateMin !== void 0 ? `${opts.facts.rateMin}${opts.facts.rateMax && opts.facts.rateMax !== opts.facts.rateMin ? `\u2013${opts.facts.rateMax}` : ""}% p.a.` : "",
    opts.facts.sumInsured ? `Cover ${opts.facts.sumInsured}` : ""
  ].filter(Boolean);
  const title = bits.join(" \xB7 ") || `${opts.seller} published rates`;
  return newRawItem(source, {
    title,
    seller: opts.seller,
    sellerUrl: opts.sellerUrl,
    currency: "INR",
    price: void 0,
    // a published rate/premium schedule is not a single purchasable price
    attributes: attrs,
    evidence: {
      sourceUrl: opts.pageUrl,
      extractedFields: Object.keys(attrs)
    }
  });
}
var init_publishedRates = __esm({
  "server/workers/parsers/publishedRates.ts"() {
    init_contract();
  }
});

// server/workers/verticals/loans.ts
function lenderPageTask(cfg) {
  return {
    sourceId: cfg.sourceId,
    name: `Loans worker: ${cfg.seller} published rate page`,
    priority: 20,
    run: async (ctx) => {
      const r = await ctx.fetch(cfg.url);
      if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `${cfg.seller} HTTP ${r.status}`, r.status);
      const text = r.body.replace(/<[^>]+>/g, " ");
      const range = extractRateRange(text);
      if (range.min === void 0) throw new AcquisitionError("EMPTY_RESPONSE", `${cfg.seller} page carried no publishable rate`);
      const facts = {
        rateMin: range.min,
        rateMax: range.max,
        processingFee: extractProcessingFee(text),
        loanAmount: extractLoanAmount(text),
        tenure: extractTenure(text)
      };
      return [buildRateOffer(ctx.source, {
        seller: cfg.seller,
        sellerUrl: cfg.url,
        pageUrl: cfg.url,
        loanType: cfg.loanType,
        facts,
        evidenceNote: `Published on ${cfg.seller}'s own rates page, observed ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}; indicative rates \u2014 never an approved offer`
      })];
    }
  };
}
var LENDER_PAGES, PAGES, loansWorker;
var init_loans = __esm({
  "server/workers/verticals/loans.ts"() {
    init_verticalWorker();
    init_bankbazaarLoans();
    init_publishedRates();
    init_httpClient();
    init_curlCffiFetch();
    LENDER_PAGES = [
      { sourceId: "w_loans_paisabazaar", seller: "Paisabazaar", url: "https://www.paisabazaar.com/personal-loan/interest-rates/", loanType: "personal loan" },
      { sourceId: "w_loans_bajajfinserv", seller: "Bajaj Finserv", url: "https://www.bajajfinserv.in/personal-loan-processing-fees-and-interest-rates", loanType: "personal loan" },
      { sourceId: "w_loans_hdfc", seller: "HDFC Bank", url: "https://www.hdfcbank.com/personal/borrow/popular-loans/personal-loan/interest-rates-and-charges", loanType: "personal loan" },
      { sourceId: "w_loans_moneyview", seller: "Money View", url: "https://moneyview.in/personal-loan-interest-rates-and-charges", loanType: "personal loan" },
      { sourceId: "w_loans_kreditbee", seller: "KreditBee", url: "https://www.kreditbee.in/personal-loan", loanType: "personal loan" },
      { sourceId: "w_loans_policybazaar", seller: "Policybazaar", url: "https://www.policybazaar.com/personal-loan/", loanType: "personal loan" }
    ];
    PAGES = [
      { type: "home loan", re: /home|housing|house|property purchase/i, url: "https://www.bankbazaar.com/home-loan.html" },
      { type: "car loan", re: /car|auto|vehicle/i, url: "https://www.bankbazaar.com/car-loan.html" },
      { type: "education loan", re: /educat|study|student|abroad/i, url: "https://www.bankbazaar.com/education-loan.html" },
      { type: "business loan", re: /business|msme|working capital/i, url: "https://www.bankbazaar.com/business-loan.html" },
      { type: "loan against property", re: /against property|lap\b|mortgage/i, url: "https://www.bankbazaar.com/home-loan/loan-against-property.html" },
      { type: "personal loan", re: /./, url: "https://www.bankbazaar.com/personal-loan.html" }
    ];
    loansWorker = {
      vertical: "loans",
      tasks: [
        {
          sourceId: "w_loans_bankbazaar",
          name: "Loans worker: BankBazaar lender-wise rate tables",
          priority: 10,
          run: async (ctx) => {
            const text = `${ctx.query.rawQuery || ""} ${ctx.query.entityName || ""}`;
            const page = PAGES.find((p) => p.re.test(text)) || PAGES[PAGES.length - 1];
            const r = await ctx.fetch(page.url);
            if (r.status !== 200) throw new AcquisitionError("FORBIDDEN", `BankBazaar HTTP ${r.status}`, r.status);
            const items = parseBankBazaarLoans(r.body, ctx.source, page.url, page.type);
            if (!items.length && looksLikeChallenge(r.body)) throw new AcquisitionError("ACCESS_CHALLENGE", "BankBazaar presented a challenge page");
            return items;
          }
        },
        ...LENDER_PAGES.map(lenderPageTask),
        // ---- Owner-mandated loans source: attempted live, honestly reported ----
        {
          sourceId: "w_loans_navi",
          name: "Loans worker: Navi (probe)",
          priority: 21,
          run: async () => {
            const r = await cffiFetch("https://navi.com/personal-loan", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError(r.status === 403 ? "ACCESS_CHALLENGE" : "EMPTY_RESPONSE", "Navi web serves HTTP 403 to browserless HTTP; loan rates are shown only in the app/sessioned flow.");
          }
        }
      ]
    };
    registerVerticalWorker(loansWorker);
  }
});

// server/workers/parsers/osmTravel.ts
async function photonGeocode(name) {
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(name)}&limit=5&lang=en`);
  if (!res.ok) return null;
  const json = await res.json();
  const features = json?.features || [];
  if (features.length === 0) return null;
  const inIndiaBbox = (f2) => {
    const [lon, lat] = f2.geometry.coordinates;
    return lat > 6 && lat < 37 && lon > 68 && lon < 98;
  };
  const f = features.find((x) => x?.properties?.countrycode === "IN") || features.find(inIndiaBbox) || features[0];
  return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], label: name };
}
function parseOverpassHotels(json, source, city, bbox, queryUrl) {
  const els = Array.isArray(json?.elements) ? json.elements : [];
  const out = [];
  for (const e of els) {
    const name = e.tags?.name;
    if (!name) continue;
    const coords = e.type === "node" ? { lat: e.lat, lon: e.lon } : e.center;
    const kind = e.tags.tourism || "hotel";
    const stars = e.tags.stars ? String(parseInt(e.tags.stars, 10) || "") : "";
    out.push(newRawItem(source, {
      title: name.slice(0, 200),
      seller: "OpenStreetMap (ODbL)",
      sellerUrl: e.tags.website || e.tags["contact:website"] || `https://www.openstreetmap.org/${e.type}/${e.id}`,
      currency: "INR",
      location: { city },
      attributes: {
        property_type: kind,
        ...stars ? { stars } : {},
        ...e.tags.phone || e.tags["contact:phone"] ? { phone: (e.tags.phone || e.tags["contact:phone"]).slice(0, 40) } : {},
        ...e.tags["addr:street"] ? { address: e.tags["addr:street"].slice(0, 120) } : {},
        ...coords ? { lat: coords.lat.toFixed(5), lon: coords.lon.toFixed(5) } : {},
        osm_license: "Data (c) OpenStreetMap contributors, ODbL"
      },
      evidence: {
        sourceUrl: queryUrl,
        sourceReference: `osm:${e.type}/${e.id}`,
        extractedFields: ["title", "location", ...stars ? ["stars"] : [], ...e.tags.phone ? ["phone"] : []]
      }
    }));
  }
  return out.slice(0, 60);
}
function overpassHotelQuery(bbox) {
  return `[out:json][timeout:20];nwr[tourism~"^(hotel|guest_house|hostel|resort|motel)$"](${bbox});out 80 tags center;`;
}
var init_osmTravel = __esm({
  "server/workers/parsers/osmTravel.ts"() {
    init_contract();
  }
});

// server/workers/parsers/booking.ts
function parseInr2(text) {
  if (!text) return { currency: "USD" };
  const m = text.replace(/\s/g, "").match(/(₹|\$|€|£)?([\d,]+(?:\.\d+)?)/);
  if (!m) return { currency: "USD" };
  const n = Number(m[2].replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return { currency: "USD" };
  const cur = m[1] === "\u20B9" ? "INR" : m[1] === "\u20AC" ? "EUR" : m[1] === "\xA3" ? "GBP" : "USD";
  return { value: n, currency: cur };
}
function parseBookingHotels(html, source, searchUrl, checkin, checkout) {
  const $ = cheerio3.load(html);
  const fingerprint = (0, import_crypto5.createHash)("sha256").update(html.slice(0, 5e4)).digest("hex");
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  $('[data-testid="property-card"]').each((_, el) => {
    const card = $(el);
    const name = card.find('[data-testid="title"]').first().text().trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    const priceEl = card.find('[data-testid="price-and-discounted-price"]').first().text() || card.find('[data-testid="price"]').first().text();
    const { value: price, currency } = parseInr2(priceEl);
    const scoreText = card.find('[data-testid="review-score"]').first().text().replace(/\s+/g, " ").trim();
    const score = scoreText.match(/(\d(?:\.\d)?)\b/)?.[1];
    const href = card.find('a[href*="/hotel/"]').first().attr("href") || "";
    const propUrl = href ? `https://www.booking.com${href.split("?")[0]}` : searchUrl;
    const distance = card.find('[data-testid="distance"]').first().text().trim();
    if (!price) return;
    out.push(newRawItem(source, {
      title: name.slice(0, 200),
      price,
      currency,
      seller: "Booking.com",
      sellerUrl: propUrl,
      availability: "in_stock",
      travel: { roomType: "as listed on Booking.com" },
      attributes: {
        ...score ? { review_score: score } : {},
        ...distance ? { distance_from_center: distance.slice(0, 40) } : {},
        price_scope: `nightly rate for ${checkin} \u2192 ${checkout} (as displayed by Booking.com)`,
        price_currency_note: currency !== "INR" ? "Price in source currency; convert to INR at checkout" : ""
      },
      evidence: {
        sourceUrl: searchUrl,
        sourceReference: name,
        rawFingerprint: fingerprint,
        extractedFields: ["title", "price", ...score ? ["review_score"] : []]
      }
    }));
  });
  return out.slice(0, 25);
}
var import_crypto5, cheerio3;
var init_booking = __esm({
  "server/workers/parsers/booking.ts"() {
    import_crypto5 = require("crypto");
    cheerio3 = __toESM(require("cheerio"), 1);
    init_contract();
  }
});

// server/workers/parsers/wikidataHotels.ts
function wikidataHotelQuery(city) {
  const safe = city.replace(/["\\\n\r]/g, "").slice(0, 60);
  return `SELECT DISTINCT ?h ?hLabel ?web ?stars ?coord WHERE {
  ?c rdfs:label "${safe}"@en .
  ?h wdt:P31/wdt:P279* wd:Q27686 .
  ?h wdt:P131* ?c .
  OPTIONAL { ?h wdt:P856 ?web }
  OPTIONAL { ?h wdt:P625 ?coord }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 40`;
}
function parseWikidataHotels(json, source, city, queryUrl) {
  const rows = json?.results?.bindings || [];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const b of rows) {
    const name = String(b?.hLabel?.value || "").trim();
    const qid = String(b?.h?.value || "").split("/").pop() || "";
    if (!name || /^Q\d+$/.test(name) || seen.has(qid)) continue;
    seen.add(qid);
    const web = String(b?.web?.value || "");
    const coord = String(b?.coord?.value || "").match(/Point\(([-\d.]+) ([-\d.]+)\)/);
    out.push(newRawItem(source, {
      title: name.slice(0, 200),
      seller: "Wikidata (CC0)",
      sellerUrl: web || `https://www.wikidata.org/wiki/${qid}`,
      currency: "INR",
      location: { city },
      attributes: {
        property_name: name.slice(0, 200),
        property_type: "hotel",
        ...coord ? { lat: Number(coord[2]).toFixed(5), lon: Number(coord[1]).toFixed(5) } : {},
        ...web ? { official_website: web.slice(0, 200) } : {},
        data_note: "Property listing from Wikidata (CC0); room rates are not in this dataset and are never invented"
      },
      evidence: {
        sourceUrl: queryUrl,
        sourceReference: `wikidata:${qid}`,
        extractedFields: ["title", "location", ...web ? ["official_website"] : [], ...coord ? ["coordinates"] : []]
      }
    }));
  }
  return out.slice(0, 25);
}
var WIKIDATA_ENDPOINT;
var init_wikidataHotels = __esm({
  "server/workers/parsers/wikidataHotels.ts"() {
    init_contract();
    WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
  }
});

// server/workers/parsers/cleartripHotels.ts
function parseCleartripHotels(nextData) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const slots = nextData?.props?.pageProps?.initialState?.results?.data?.slotsData;
  if (!Array.isArray(slots)) return out;
  for (const slot of slots) {
    if (slot?.slotData?.type !== "HOTEL_CARD_LIST") continue;
    const cards = slot?.slotData?.data?.hotelCardList;
    if (!Array.isArray(cards)) continue;
    for (const card of cards) {
      const d = card?.data;
      if (!d?.name || !d?.priceInfo?.data) continue;
      const pi = d.priceInfo.data;
      const price = Number(pi.price) || 0;
      if (price <= 0) continue;
      const id = String(d.ravenTracking?.eventData?.h_hotel_id || pi.hotelId || d.id || "");
      const key = id || `${d.name}|${price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const imgRaw = d?.imageSlider?.data?.images?.[0]?.data?.url;
      const imageUrl = typeof imgRaw === "string" && imgRaw.startsWith("http") ? imgRaw : typeof imgRaw === "string" && imgRaw ? CLEARTRIP_IMAGE_CDN + imgRaw.replace(/^\/+/, "") : null;
      const rel = card?.action?.payload?.url;
      const deeplink = typeof rel === "string" && rel.startsWith("/") ? CLEARTRIP_WEB + rel : typeof rel === "string" && rel.startsWith("http") ? rel : `${CLEARTRIP_WEB}/hotels/`;
      out.push({
        id,
        name: String(d.name).trim(),
        price,
        slashedPrice: Number(pi.slashedPrice) || 0,
        currency: "INR",
        rating: d?.clearTripRatingAndReview?.data?.rating ? String(d.clearTripRatingAndReview.data.rating) : null,
        stars: Number(d?.starRating) || null,
        locality: d?.locality ? String(d.locality) : null,
        city: d?.city ? String(d.city) : null,
        imageUrl,
        deeplink,
        freeCancellation: Boolean(d?.freeCancellation?.available),
        freeBreakfast: Boolean(d?.freeBreakfast?.available)
      });
    }
  }
  return out;
}
function parseCleartripOffers(hotels, source) {
  const out = [];
  for (const h of hotels.slice(0, 30)) {
    const attrs = {
      image_url: h.imageUrl,
      rating: h.rating,
      stars: h.stars,
      locality: h.locality,
      city: h.city,
      free_cancellation: h.freeCancellation,
      free_breakfast: h.freeBreakfast,
      price_basis: "per night for 1 room",
      data_note: "Live nightly rates from Cleartrip hotel search results"
    };
    out.push(newRawItem(source, {
      title: h.name,
      seller: "Cleartrip",
      sellerUrl: h.deeplink,
      // redirect only to the site that owns the price
      currency: "INR",
      price: h.price,
      listPrice: h.slashedPrice > h.price ? h.slashedPrice : void 0,
      attributes: attrs,
      evidence: {
        sourceUrl: `${CLEARTRIP_WEB}/hotels/india/`,
        sourceReference: h.id,
        extractedFields: ["title", "price", "listPrice", "rating", "locality", "image_url", "deeplink"]
      }
    }));
  }
  return out;
}
var CLEARTRIP_IMAGE_CDN, CLEARTRIP_WEB;
var init_cleartripHotels = __esm({
  "server/workers/parsers/cleartripHotels.ts"() {
    init_contract();
    CLEARTRIP_IMAGE_CDN = "https://rukmini-ct.flixcart.com/";
    CLEARTRIP_WEB = "https://www.cleartrip.com";
  }
});

// server/workers/parsers/airbnbHotels.ts
function extractAirbnbSearchResults(deferred) {
  try {
    const ncd = deferred?.niobeClientData?.[0];
    if (!Array.isArray(ncd)) return [];
    for (const entry of ncd) {
      if (!entry || typeof entry !== "object") continue;
      const results = entry?.data?.presentation?.staysSearch?.results?.searchResults;
      if (Array.isArray(results) && results.length) return results;
    }
  } catch {
  }
  return [];
}
function parseAirbnbStays(results) {
  const stays = [];
  for (const r of results) {
    if (!r || r.__typename !== "StaySearchResult") continue;
    const name = String(r.subtitle || r.nameLocalized?.localizedStringWithTranslationPreference || "").trim();
    if (!name) continue;
    const listingB64 = r.demandStayListing?.id || "";
    let listingId = "";
    try {
      listingId = Buffer.from(listingB64, "base64").toString("utf8").split(":")[1] || "";
    } catch {
    }
    if (!/^\d{5,}$/.test(listingId)) continue;
    const primary = r.structuredDisplayPrice?.primaryLine || {};
    const priceNum = parseInr3(primary.price);
    const qualifier = String(primary.qualifier || "");
    const nightsMatch = qualifier.match(/for\s+(\d+)\s+nights?/i);
    const nights = nightsMatch ? parseInt(nightsMatch[1], 10) : priceNum ? 1 : 0;
    const ratingRaw = String(r.avgRatingLocalized || "");
    const ratingMatch = ratingRaw.match(/^([\d.]+)\s*(?:\((\d+)\))?/);
    const coord = r.demandStayListing?.location?.coordinate;
    stays.push({
      name,
      roomType: r.title ? String(r.title) : null,
      listingId,
      deeplink: `${AIRBNB_WEB}/rooms/${listingId}`,
      priceTotal: priceNum,
      nights,
      pricePerNight: nights > 0 ? Math.round(priceNum / nights) : priceNum,
      rating: ratingMatch ? ratingMatch[1] : null,
      reviews: ratingMatch && ratingMatch[2] ? parseInt(ratingMatch[2], 10) : null,
      imageUrl: r.contextualPictures?.[0]?.picture || null,
      lat: coord?.latitude ?? null,
      lon: coord?.longitude ?? null
    });
  }
  return stays;
}
function parseInr3(s) {
  if (!s) return 0;
  const m = String(s).replace(/,/g, "").match(/([\d.]+)/);
  return m ? Math.round(parseFloat(m[1])) : 0;
}
function parseAirbnbOffers(stays, source, city) {
  const out = [];
  for (const s of stays.slice(0, 25)) {
    if (!s.pricePerNight) continue;
    const attrs = {
      image_url: s.imageUrl,
      rating: s.rating,
      review_count: s.reviews,
      room_type: s.roomType,
      city,
      latitude: s.lat,
      longitude: s.lon,
      price_basis: `per night (total \u20B9${s.priceTotal.toLocaleString("en-IN")} for ${s.nights} night${s.nights > 1 ? "s" : ""} on Airbnb)`,
      data_note: "Live stay rates from Airbnb search results"
    };
    out.push(newRawItem(source, {
      title: s.name,
      seller: "Airbnb",
      sellerUrl: s.deeplink,
      // redirect only to the site that owns the price
      currency: "INR",
      price: s.pricePerNight,
      attributes: attrs,
      evidence: {
        sourceUrl: `${AIRBNB_WEB}/s/${encodeURIComponent(city)}/homes`,
        sourceReference: s.listingId,
        extractedFields: ["title", "price", "rating", "image_url", "deeplink"]
      }
    }));
  }
  return out;
}
var AIRBNB_WEB;
var init_airbnbHotels = __esm({
  "server/workers/parsers/airbnbHotels.ts"() {
    init_contract();
    AIRBNB_WEB = "https://www.airbnb.co.in";
  }
});

// server/workers/parsers/ixigoHotels.ts
function pickImage2(h) {
  const list = h.imageInfoList;
  if (Array.isArray(list)) {
    for (const e of list) {
      const u = e?.imageUrl || e?.url || e?.thumbUrl || e?.mainImage || e?.image;
      if (typeof u === "string" && u) return u.replace(/^http:/, "https:");
      const dyn = e?.dynamicImageUrl || e?.cdnUrl;
      if (typeof dyn === "string" && dyn) return dyn.replace(/^http:/, "https:");
    }
  }
  return void 0;
}
function siteFor(name, city) {
  for (const [re, url] of CHAIN_SITES) {
    if (re.test(name)) return { url, chain: true };
  }
  const q3 = encodeURIComponent(`${name} ${city} hotel official website booking`);
  return { url: `https://www.google.com/search?q=${q3}`, chain: false };
}
function parseIxigoHotels(html, source, pageUrl, city) {
  const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) return [];
  let root;
  try {
    root = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const results = root?.props?.pageProps?.hotelsData?.result?.searchResults;
  if (!Array.isArray(results)) return [];
  const items = [];
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  for (const h of results.slice(0, 20)) {
    const name = String(h.name || "").trim();
    const fare = Number(h.fareDetail?.displayedBaseFare);
    if (!name || !Number.isFinite(fare) || fare <= 0) continue;
    const site = siteFor(name, h.city || city);
    const img = pickImage2(h);
    items.push(newRawItem(source, {
      title: name.slice(0, 200),
      brand: name.slice(0, 200),
      price: Math.round(fare),
      currency: "INR",
      seller: name.slice(0, 120),
      sellerUrl: site.url,
      location: { city: String(h.city || city) },
      attributes: {
        hotel_id: h.hotelId ? String(h.hotelId) : "",
        locality: String(h.locality || ""),
        city: String(h.city || city),
        star_rating: h.starRating ? String(h.starRating) : "",
        user_rating: h.userRating ? String(h.userRating) : "",
        user_rating_count: h.userRatingCount ? String(h.userRatingCount) : "",
        user_rating_category: String(h.userRatingCategory || ""),
        top_offerings: Array.isArray(h.topOfferings) ? h.topOfferings.slice(0, 5).join(", ") : "",
        image: img || "",
        price_basis: "per night, base fare as published by Ixigo",
        chain_site: site.chain ? "brand official website" : "web search for official site",
        data_note: `Price observed on Ixigo (metasearch) on ${today}; booking is via the hotel's own channels, never via Ixigo`
      },
      identifiers: h.hotelId ? { sku: String(h.hotelId) } : void 0,
      evidence: { sourceUrl: pageUrl, extractedFields: ["name", "displayedBaseFare", "locality", "city", "ratings", "image"] }
    }));
  }
  return items;
}
function ixigoHotelsSlug(city) {
  return `hotels-in-${city.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-")}`;
}
var CHAIN_SITES;
var init_ixigoHotels = __esm({
  "server/workers/parsers/ixigoHotels.ts"() {
    init_contract();
    CHAIN_SITES = [
      [/radisson|park inn|country inn/i, "https://www.radissonhotels.com/en-in/"],
      [/marriott|courtyard|renaissance|le meridien|westin|sheraton|four points|aloft|moxy|st\.? regis|ritz/i, "https://www.marriott.com/"],
      [/hilton|doubletree|embassy suites|hampton/i, "https://www.hilton.com/en/"],
      [/holiday inn|intercontinental|crowne plaza|indigo|voco|avid|ihg/i, "https://www.ihg.com/"],
      [/novotel|ibis|mercure|sofitel|pullman|fairmont|swissotel|movenpick|mövenpick|247|accent|grand mercure|all seasons/i, "https://all.accor.com/"],
      [/taj|vivanta|ginger| SeleQtions/i, "https://www.tajhotels.com/en-in/"],
      [/oberoi|trident/i, "https://www.oberoigroup.com/"],
      [/itc ?hotel|welcome ?hotel|welcomhotel|fortune ?park/i, "https://www.itchotels.com/"],
      [/lemon ?tree/i, "https://www.lemontreehotels.com/"],
      [/the park|zone by the park/i, "https://theparkhotels.com/"],
      [/hyatt|grand hyatt|hyatt ?regency|hyatt ?centric|andaz/i, "https://www.hyatt.com/"],
      [/shangri-?la/i, "https://www.shangri-la.com/"],
      [/kempinski/i, "https://www.kempinski.com/"],
      [/four seasons/i, "https://www.fourseasons.com/"],
      [/the grand|leela/i, "https://www.theleela.com/"],
      [/oyo/i, "https://www.oyorooms.com/"],
      [/fabhotel/i, "https://www.fabhotels.com/"],
      [/treebo/i, "https://treebohotels.com/"],
      [/zebnest|zostel/i, "https://www.zostel.com/"],
      [/the orchid/i, "https://www.orchidhotel.com/"],
      [/royal orchid/i, "https://www.royalorchidhotels.com/"],
      [/sun-n-sand|sun n sand/i, "https://www.sunnsandhotels.com/"]
    ];
  }
});

// server/common/cityAlias.ts
function cityVariants(city) {
  const n = norm(city);
  const out = [n];
  for (const g of ALIAS_GROUPS) if (g.includes(n)) {
    for (const a of g) if (!out.includes(a)) out.push(a);
  }
  return out;
}
var ALIAS_GROUPS, norm, slugOf;
var init_cityAlias = __esm({
  "server/common/cityAlias.ts"() {
    ALIAS_GROUPS = [
      ["bengaluru", "bangalore"],
      ["delhi", "new delhi"],
      ["gurugram", "gurgaon"],
      ["mysuru", "mysore"],
      ["puducherry", "pondicherry"],
      ["prayagraj", "allahabad"],
      ["kochi", "cochin"],
      ["thiruvananthapuram", "trivandrum"],
      ["mumbai", "bombay"],
      ["kolkata", "calcutta"],
      ["chennai", "madras"],
      ["vadodara", "baroda"],
      ["varanasi", "banaras", "benares"],
      ["pune", "poona"],
      ["mangaluru", "mangalore"],
      ["visakhapatnam", "vizag"],
      ["shimla", "simla"],
      ["kozhikode", "calicut"],
      ["panaji", "panjim", "goa"],
      ["ayodhya", "faizabad"]
    ];
    norm = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    slugOf = (s) => norm(s).replace(/\s+/g, "-");
  }
});

// server/workers/verticals/hotels.ts
function cityFromQuery(ctx) {
  const q3 = ctx.query;
  const raw = String(q3.rawQuery || "").trim();
  const strip = (x) => x.replace(/\b(hotels?|rooms?|stay|stays|resorts?|in|near|at|for|book|booking|cheap|best|budget|luxury|check-?in:?|tonight|night|nights|today|tomorrow|weekend|this|next|under|price)\b/gi, " ").replace(/,.*$/, "").replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  const cleaned = strip(raw);
  if (cleaned.length >= 3 && cleaned.length <= 40) return cleaned;
  if (q3.location?.city) return String(q3.location.city);
  return null;
}
function stayDates(q3) {
  const dep = q3?.travelDates?.depart;
  const ret = q3?.travelDates?.return;
  const fmt = (d) => d.toISOString().slice(0, 10);
  const base = dep && /\d{4}-\d{2}-\d{2}/.test(dep) ? new Date(dep) : new Date(Date.now() + 7 * 864e5);
  const end = ret && /\d{4}-\d{2}-\d{2}/.test(ret) ? new Date(ret) : new Date(base.getTime() + 864e5);
  return { checkin: fmt(base), checkout: fmt(end) };
}
var hotelsWorker;
var init_hotels = __esm({
  "server/workers/verticals/hotels.ts"() {
    init_verticalWorker();
    init_osmTravel();
    init_booking();
    init_wikidataHotels();
    init_cleartripHotels();
    init_airbnbHotels();
    init_ixigoHotels();
    init_curlCffiFetch();
    init_httpClient();
    init_cityAlias();
    hotelsWorker = {
      vertical: "hotels",
      tasks: [
        {
          // MakeMyTrip hotels — owner-mandated mandatory source. Akamai Bot Manager gates
          // the hotel listing behind a valid _abck sensor cookie at the edge today; the
          // attempt stays honest: on block we report ACCESS_CHALLENGE (visible as
          // unavailable) and never fabricate prices.
          sourceId: "w_hotels_mmt",
          priority: 15,
          run: async (ctx) => {
            const city = cityFromQuery(ctx);
            if (!city || city.length < 3) return [];
            const slug = city.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-");
            const r = await cffiFetch(`https://www.makemytrip.com/hotels/hotels-in-${slug}/`, { impersonate: "chrome", timeoutMs: 25e3 });
            if (r.status === 302 || r.status === 301) throw new AcquisitionError("ACCESS_CHALLENGE", "MakeMyTrip redirected to Akamai geo-challenge (makemytrip.global) from this IP");
            if (r.status !== 200) throw new AcquisitionError("ACCESS_CHALLENGE", `MakeMyTrip HTTP ${r.status}`);
            if (r.body.length < 500) throw new AcquisitionError("ACCESS_CHALLENGE", "MakeMyTrip returned an empty Akamai edge body (no sensor cookie)");
            throw new AcquisitionError("EMPTY_RESPONSE", "MakeMyTrip hotel page reached but carried no parseable SSR data");
          }
        },
        {
          // Goibibo hotels — owner-mandated mandatory source. Same Akamai edge gate today.
          sourceId: "w_hotels_goibibo",
          priority: 15,
          run: async (ctx) => {
            const city = cityFromQuery(ctx);
            if (!city || city.length < 3) return [];
            const slug = city.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-");
            const r = await cffiFetch(`https://www.goibibo.com/hotels/hotels-in-${slug}/`, { impersonate: "chrome", timeoutMs: 25e3 });
            if (r.status !== 200) throw new AcquisitionError("ACCESS_CHALLENGE", `Goibibo HTTP ${r.status}`);
            if (r.body.length < 500) throw new AcquisitionError("ACCESS_CHALLENGE", "Goibibo returned an empty Akamai edge body (no sensor cookie)");
            throw new AcquisitionError("EMPTY_RESPONSE", "Goibibo hotel page reached but carried no parseable SSR data");
          }
        },
        {
          // Ixigo hotels (metasearch acquisition): SEO listing page carries __NEXT_DATA__
          // with hotel names + per-night base fares. Seller = the hotel property, never Ixigo.
          sourceId: "w_hotels_ixigo",
          priority: 14,
          run: async (ctx) => {
            const city = cityFromQuery(ctx);
            if (!city || city.length < 3) return [];
            let items = [];
            let url = "";
            let lastStatus = 0;
            for (const variant of cityVariants(city)) {
              url = `https://www.ixigo.com/hotels/${ixigoHotelsSlug(variant)}`;
              const r = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 3e4 });
              lastStatus = r.status;
              if (r.status === 404) continue;
              if (r.status !== 200) throw new AcquisitionError(r.status === 403 || r.status === 429 ? "ACCESS_CHALLENGE" : "FORBIDDEN", `Ixigo hotels HTTP ${r.status}`, r.status);
              items = parseIxigoHotels(r.body, ctx.source, url, city);
              if (items.length) break;
            }
            if (!items.length && lastStatus === 404) throw new AcquisitionError("NOT_FOUND", `Ixigo has no hotels page for "${city}"`, 404);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", `No Ixigo hotels parsed for "${city}" (slug may not exist for this city)`);
            return items;
          }
        },
        {
          // Real nightly rates from Cleartrip's Next.js SEO SRP: __NEXT_DATA__
          // ships full hotel cards (price, slashed price, rating, locality,
          // Flipkart-CDN images, hotel-details deeplinks). No API keys, no browser.
          sourceId: "w_hotels_cleartrip",
          name: "Hotels worker: Cleartrip SEO SRP (live nightly rates via __NEXT_DATA__)",
          priority: 1,
          maxPerMinute: 6,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const city = cityFromQuery(ctx);
            if (!city) return [];
            let next;
            let lastErr;
            for (const variant of cityVariants(city)) {
              for (let attempt = 0; attempt < 2 && !next; attempt++) {
                const res = await cffiFetch(`https://www.cleartrip.com/hotels/india/${slugOf(variant)}`, { impersonate: "chrome", timeoutMs: 25e3 });
                if (res.status === 403 || res.status === 429) {
                  throw new AcquisitionError(res.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED", `Cleartrip blocked: ${res.status}`, res.status);
                }
                if (res.status === 404) {
                  lastErr = new AcquisitionError("NOT_FOUND", `Cleartrip has no SEO page for '${variant}'`, res.status);
                  break;
                }
                if (res.status !== 200) {
                  lastErr = new AcquisitionError("SERVER_ERROR", `Cleartrip SRP HTTP ${res.status}`, res.status);
                  break;
                }
                const m = res.body.match(/<script id="__NEXT_DATA__"[^>]*>(\{[\s\S]*?\})<\/script>/);
                if (!m) {
                  lastErr = new AcquisitionError("MALFORMED_RESPONSE", "Cleartrip SRP carried no __NEXT_DATA__");
                  continue;
                }
                try {
                  const parsed = JSON.parse(m[1]);
                  if (parseCleartripHotels(parsed).length > 0) next = parsed;
                  else lastErr = new AcquisitionError("EMPTY_RESPONSE", "Cleartrip SRP had no priced hotel cards");
                } catch {
                  lastErr = new AcquisitionError("MALFORMED_RESPONSE", "Cleartrip __NEXT_DATA__ not valid JSON");
                }
                break;
              }
              if (next) break;
            }
            if (!next) throw lastErr || new AcquisitionError("EMPTY_RESPONSE", "Cleartrip returned nothing for this destination");
            const hotels = parseCleartripHotels(next);
            if (hotels.length === 0) throw new AcquisitionError("EMPTY_RESPONSE", "Cleartrip SRP had no priced hotel cards");
            return parseCleartripOffers(hotels, ctx.source);
          }
        },
        {
          // Airbnb SSRs the full search page: <script data-deferred-state-0>
          // carries StaysSearch results (property name, stay total + nights
          // qualifier -> per-night rate, rating, photos, listing deeplink).
          // Airbnb totals are divided by the parsed night count - never fabricated.
          sourceId: "w_hotels_airbnb",
          name: "Hotels worker: Airbnb SSR stays (live per-night rates)",
          priority: 2,
          maxPerMinute: 6,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const city = cityFromQuery(ctx);
            if (!city) return [];
            const { checkin, checkout } = stayDates(ctx.query);
            const url = `https://www.airbnb.co.in/s/${encodeURIComponent(city)}/homes?checkin=${checkin}&checkout=${checkout}&adults=2`;
            const res = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 25e3 });
            if (res.status === 403 || res.status === 429) {
              throw new AcquisitionError(res.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED", `Airbnb blocked: ${res.status}`, res.status);
            }
            if (res.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Airbnb HTTP ${res.status}`, res.status);
            const m = res.body.match(/<script[^>]+data-deferred-state-0[^>]*>([\s\S]*?)<\/script>/);
            if (!m) throw new AcquisitionError("MALFORMED_RESPONSE", "Airbnb SRP carried no deferred state");
            let deferred;
            try {
              deferred = JSON.parse(m[1]);
            } catch {
              throw new AcquisitionError("MALFORMED_RESPONSE", "Airbnb deferred state not valid JSON");
            }
            const results = extractAirbnbSearchResults(deferred);
            if (results.length === 0) throw new AcquisitionError("EMPTY_RESPONSE", "Airbnb deferred state had no stays");
            const stays = parseAirbnbStays(results);
            if (stays.length === 0) throw new AcquisitionError("EMPTY_RESPONSE", "Airbnb results had no parseable stays");
            return parseAirbnbOffers(stays, ctx.source, city);
          }
        },
        {
          sourceId: "w_hotels_booking",
          name: "Hotels worker: Booking.com live rates (worldwide)",
          priority: 10,
          run: async (ctx) => {
            const city = cityFromQuery(ctx);
            if (!city) return [];
            const { checkin, checkout } = stayDates(ctx.query);
            const url = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(city)}&checkin=${checkin}&checkout=${checkout}&group_adults=2&no_rooms=1`;
            const UA = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" };
            for (let attempt = 1; attempt <= 2; attempt++) {
              const r = await ctx.fetch(url, { headers: UA, timeoutMs: 15e3 });
              if (r.status !== 200 && r.status !== 202) throw new AcquisitionError("FORBIDDEN", `Booking.com HTTP ${r.status}`, r.status);
              const items = parseBookingHotels(r.body, ctx.source, url, checkin, checkout);
              if (items.length) return items;
              if (looksLikeChallenge(r.body) && attempt === 1) {
                await new Promise((res) => setTimeout(res, 1500));
                continue;
              }
              throw new AcquisitionError("ACCESS_CHALLENGE", "Booking.com presented a challenge page (no parseable property cards)");
            }
            throw new AcquisitionError("EMPTY_RESPONSE", "Booking.com returned no property cards");
          }
        },
        {
          sourceId: "w_hotels_osm",
          name: "Hotels worker: OpenStreetMap hotel discovery (worldwide)",
          priority: 20,
          maxPerMinute: 6,
          timeoutMs: 45e3,
          // 3 mirrors x 12s must fit inside the task budget
          run: async (ctx) => {
            const city = cityFromQuery(ctx);
            if (!city) return [];
            const geo = await photonGeocode(city);
            if (!geo) return [];
            const d = 0.06;
            const bbox = `${(geo.lat - d).toFixed(4)},${(geo.lon - d).toFixed(4)},${(geo.lat + d).toFixed(4)},${(geo.lon + d).toFixed(4)}`;
            const q3 = overpassHotelQuery(bbox);
            const mirrors = [
              "https://overpass.osm.ch/api/interpreter",
              "https://overpass-api.de/api/interpreter",
              "https://overpass.kumi.systems/api/interpreter"
            ];
            let json = null;
            let lastErr = null;
            let usedUrl = "";
            for (const mirror of mirrors) {
              try {
                const r = await ctx.fetch(mirror, {
                  method: "POST",
                  body: `data=${encodeURIComponent(q3)}`,
                  headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
                  expectJson: true,
                  timeoutMs: 12e3
                });
                if (r.status === 429 || r.status >= 500) {
                  lastErr = new AcquisitionError("RATE_LIMITED", `Overpass mirror HTTP ${r.status}`);
                  continue;
                }
                if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Overpass HTTP ${r.status}`, r.status);
                json = JSON.parse(r.body);
                usedUrl = mirror;
                break;
              } catch (e) {
                lastErr = e;
              }
            }
            if (!json) throw lastErr || new AcquisitionError("SERVER_ERROR", "All Overpass mirrors failed");
            return parseOverpassHotels(json, ctx.source, city, bbox, usedUrl);
          }
        },
        {
          sourceId: "w_hotels_wikidata",
          name: "Hotels worker: Wikidata hotel discovery (worldwide)",
          priority: 30,
          maxPerMinute: 10,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const city = cityFromQuery(ctx);
            if (!city) return [];
            const url = `${WIKIDATA_ENDPOINT}?format=json&query=${encodeURIComponent(wikidataHotelQuery(city))}`;
            const r = await ctx.fetch(url, {
              headers: { Accept: "application/sparql-results+json", "User-Agent": "Try1Second/1.0 (contact@try1second.com)" },
              expectJson: true,
              timeoutMs: 25e3
            });
            if (r.status === 429 || r.status >= 500) throw new AcquisitionError("RATE_LIMITED", `Wikidata HTTP ${r.status}`, r.status);
            if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Wikidata HTTP ${r.status}`, r.status);
            return parseWikidataHotels(JSON.parse(r.body), ctx.source, city, WIKIDATA_ENDPOINT);
          }
        },
        // ---- Owner-mandated hotel sources: attempted live on every search, honestly reported ----
        {
          sourceId: "w_hotels_agoda",
          name: "Hotels worker: Agoda (probe)",
          priority: 19,
          run: async () => {
            await cffiFetch("https://www.agoda.com/", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError("EMPTY_RESPONSE", "Agoda serves an SSR shell; hotel prices load via token-gated XHRs that are not available unauthenticated to browserless HTTP.");
          }
        },
        {
          sourceId: "w_hotels_yatra",
          name: "Hotels worker: Yatra (probe)",
          priority: 20,
          run: async () => {
            await cffiFetch("https://www.yatra.com/hotels", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError("EMPTY_RESPONSE", "Yatra hotels serves an SPA shell (414KB, no SSR prices); quote XHRs require a session.");
          }
        }
      ]
    };
    registerVerticalWorker(hotelsWorker);
  }
});

// server/workers/parsers/openflights.ts
function splitCsv(line) {
  const out = [];
  let cur = "", inQ = false;
  for (const ch of line) {
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
async function loadOpenFlights(fetchFn) {
  if (cache && Date.now() - cache.at < 24 * 36e5) return cache;
  const [apRaw, alRaw, rtRaw] = await Promise.all([
    fetchFn(`${BASE}/airports.dat`),
    fetchFn(`${BASE}/airlines.dat`),
    fetchFn(`${BASE}/routes.dat`)
  ]);
  const airports = apRaw.split("\n").filter(Boolean).map((l) => {
    const f = splitCsv(l);
    return { id: f[0], name: f[1], city: f[2], country: f[3], iata: f[4], lat: Number(f[6]), lon: Number(f[7]) };
  }).filter((a) => a.iata && a.iata !== "\\N");
  const airlines = alRaw.split("\n").filter(Boolean).map((l) => {
    const f = splitCsv(l);
    return { name: f[1], iata: f[3], active: f[7] === "Y" };
  }).filter((a) => a.iata && a.iata !== "\\N");
  const routes = rtRaw.split("\n").filter(Boolean).map((l) => {
    const f = l.split(",");
    return { airlineIata: f[0], srcIata: f[2], dstIata: f[4], stops: Number(f[7]) };
  }).filter((r) => r.srcIata && r.dstIata && r.srcIata !== "\\N" && r.dstIata !== "\\N");
  cache = { at: Date.now(), airports, airlines, routes };
  return { airports, airlines, routes };
}
function matchAirports(airports, input) {
  const raw = String(input || "").trim();
  const code = raw.match(/\(([A-Za-z]{3})\)/)?.[1] || (/^[A-Za-z]{3}$/.test(raw) ? raw : "");
  if (code) {
    const byCode = airports.filter((a) => a.iata.toUpperCase() === code.toUpperCase());
    if (byCode.length) return byCode;
  }
  const cleaned = raw.replace(/\([^)]*\)/g, "").replace(/\b(airport|international|intl)\b/gi, "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!cleaned) return [];
  const target = CITY_ALIASES[cleaned] || cleaned;
  let hit = airports.filter((a) => a.city.toLowerCase() === target);
  if (!hit.length) hit = airports.filter((a) => a.city.toLowerCase() === cleaned);
  if (!hit.length) hit = airports.filter((a) => a.name.toLowerCase().includes(target));
  return hit;
}
function airlineSiteFor(name) {
  for (const [re, u] of AIRLINE_SITES) if (re.test(name)) return u;
  return void 0;
}
function parseRoute(airports, airlines, routes, source, fromCity, toCity, date, sourceUrl) {
  const fromAirports = matchAirports(airports, fromCity);
  const toAirports = matchAirports(airports, toCity);
  if (!fromAirports.length || !toAirports.length) return [];
  const srcIatas = new Set(fromAirports.map((a) => a.iata));
  const dstIatas = new Set(toAirports.map((a) => a.iata));
  const DEFUNCT = /\b(jet airways|kingfisher|spicejet cargo|silkair|tiger airways|air deccan|jetlite|go ?first|goair|king ?fisher|virgin america|germanwings|monarch|thomas cook|air berlin|alitalia|malev|cargo|freight|express cargo|logistics|courier|dhl|fedex|ups)\b/i;
  const airlineByIata = new Map(airlines.filter((a) => a.active && !DEFUNCT.test(a.name)).map((a) => [a.iata, a]));
  const matched = /* @__PURE__ */ new Map();
  for (const r of routes) {
    if (srcIatas.has(r.srcIata) && dstIatas.has(r.dstIata)) {
      const al = airlineByIata.get(r.airlineIata);
      if (!al) continue;
      if (!matched.has(al.name)) matched.set(al.name, []);
      matched.get(al.name).push(r);
    }
  }
  const out = [];
  for (const [airlineName, rs] of matched) {
    const direct = rs.filter((r) => r.stops === 0).length;
    const r0 = rs[0];
    const srcAp = fromAirports.find((a) => a.iata === r0.srcIata);
    const dstAp = toAirports.find((a) => a.iata === r0.dstIata);
    out.push(newRawItem(source, {
      title: `${airlineName}: ${srcAp.city} (${srcAp.iata}) \u2192 ${dstAp.city} (${dstAp.iata})`.slice(0, 200),
      seller: airlineName.slice(0, 100),
      sellerUrl: airlineSiteFor(airlineName) || sourceUrl,
      currency: "INR",
      travel: { route: `${srcAp.city} ${srcAp.iata} to ${dstAp.city} ${dstAp.iata}`.toLowerCase(), ...date ? { date } : {}, seatType: "unknown" },
      attributes: {
        airline: airlineName.slice(0, 100),
        ...r0.airlineIata ? { airline_code: r0.airlineIata } : {},
        from_iata: srcAp.iata,
        to_iata: dstAp.iata,
        scheduled_services: String(rs.length),
        ...direct > 0 ? { direct_services: String(direct) } : {},
        data_note: "Airline-route schedules from OpenFlights open data; live fares require the airline (we never invent them)"
      },
      evidence: {
        sourceUrl,
        sourceReference: `${r0.srcIata}-${r0.dstIata}:${airlineName}`,
        extractedFields: ["route", "airline", "airports"]
      }
    }));
  }
  return out.slice(0, 20);
}
var BASE, cache, CITY_ALIASES, AIRLINE_SITES;
var init_openflights = __esm({
  "server/workers/parsers/openflights.ts"() {
    init_contract();
    BASE = "https://raw.githubusercontent.com/jpatokal/openflights/master/data";
    cache = null;
    CITY_ALIASES = {
      "new delhi": "delhi",
      "bengaluru": "bangalore",
      "bombay": "mumbai",
      "calcutta": "kolkata",
      "madras": "chennai",
      "gurugram": "delhi",
      "gurgaon": "delhi",
      "noida": "delhi",
      "trivandrum": "thiruvananthapuram",
      "cochin": "kochi",
      "poona": "pune",
      "baroda": "vadodara",
      "banaras": "varanasi",
      "benares": "varanasi",
      "new york city": "new york",
      "nyc": "new york",
      "dubai international": "dubai",
      "abu dhabi": "abu dhabi"
    };
    AIRLINE_SITES = [
      [/indigo/i, "https://www.goindigo.in/"],
      [/air india express/i, "https://www.airindiaexpress.com/"],
      [/air india/i, "https://www.airindia.com/"],
      [/spicejet/i, "https://www.spicejet.com/"],
      [/akasa/i, "https://www.akasaair.com/"],
      [/vistara/i, "https://www.airindia.com/"],
      [/alliance air/i, "https://www.allianceair.in/"],
      [/star air/i, "https://www.starair.in/"],
      [/fly ?91/i, "https://flybig.in/"]
    ];
  }
});

// server/workers/parsers/ixigoFlights.ts
function parseIxigoFlights(nextData) {
  const entries = nextData?.props?.pageProps?.cheapFlightsData;
  if (!Array.isArray(entries)) return [];
  const flights = [];
  for (const e of entries) {
    const airline = String(e.airline || "").trim();
    const fare = Number(e.fare);
    if (!airline || !Number.isFinite(fare) || fare <= 0) continue;
    let fn = String(e.flightNumber || "").trim();
    fn = fn.replace(/^[A-Z]{3}-[A-Z]{3}-/, "");
    let duration = null;
    const dur = parseInt(String(e.duration ?? ""), 10);
    if (Number.isFinite(dur) && dur > 0) duration = dur;
    flights.push({
      airline,
      airlineCode: e.airlineCode ? String(e.airlineCode) : null,
      flightNumber: fn || null,
      fare: Math.round(fare),
      departureDate: String(e.departure_date || e.date || ""),
      departureTime: e.departure_time ? String(e.departure_time) : null,
      arrivalDate: e.arrival_date ? String(e.arrival_date) : null,
      arrivalTime: e.arrival_time ? String(e.arrival_time) : null,
      durationMinutes: duration,
      stops: Number.isFinite(Number(e.numOfStops)) ? Number(e.numOfStops) : null
    });
  }
  return flights;
}
function parseIxigoOffers(flights, source, from, to, date) {
  const AIRLINE_SITES2 = {
    "indigo": "https://www.goindigo.in",
    "air india": "https://www.airindia.com",
    "air-india express": "https://www.airindiaexpress.com",
    "air india express": "https://www.airindiaexpress.com",
    "akasa air": "https://www.akasaair.com",
    "spicejet": "https://www.spicejet.com",
    "vistara": "https://www.airindia.com"
  };
  const siteFor2 = (airline) => {
    const k = airline.toLowerCase().trim();
    for (const [name, url] of Object.entries(AIRLINE_SITES2)) {
      if (k === name || k.replace(/[^a-z ]/g, "").includes(name)) return { seller: airline.trim(), url };
    }
    return null;
  };
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const bestFare = /* @__PURE__ */ new Map();
  for (const f of flights) {
    if (!f.flightNumber) continue;
    const key = `${f.airlineCode || f.airline}|${f.flightNumber}|${f.departureTime}`;
    if (!bestFare.has(key) || f.fare < bestFare.get(key)) {
      bestFare.set(key, f.fare);
      if (!seen.has(key)) seen.add(key);
    }
  }
  for (const f of flights) {
    if (!f.flightNumber) continue;
    const key = `${f.airlineCode || f.airline}|${f.flightNumber}|${f.departureTime}`;
    if (!seen.has(key)) continue;
    seen.delete(key);
    const site = siteFor2(f.airline);
    if (!site) continue;
    const attrs = {
      airline: f.airline,
      airline_code: f.airlineCode,
      flight_number: f.flightNumber,
      departure_date: f.departureDate,
      departure_time: f.departureTime,
      arrival_date: f.arrivalDate,
      arrival_time: f.arrivalTime,
      duration_minutes: f.durationMinutes,
      stops: f.stops,
      route: `${from} \u2192 ${to}`,
      price_basis: "cheapest observed total one-way fare for 1 adult (economy)",
      data_note: `Fare observed via Ixigo metasearch at ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 16)}Z; booking is on ${site.seller}'s own website`
    };
    out.push(newRawItem(source, {
      title: `${f.airline} ${f.flightNumber} \xB7 ${from} \u2192 ${to}`,
      seller: site.seller,
      sellerUrl: site.url,
      // deeplink ONLY to the airline website, never to Ixigo
      currency: "INR",
      price: bestFare.get(key),
      travel: { route: `${from} to ${to}`.toLowerCase(), date, seatType: "economy" },
      attributes: attrs,
      evidence: {
        sourceUrl: `${IXIGO_WEB}/search/flight/`,
        sourceReference: f.flightNumber,
        extractedFields: ["title", "price", "airline", "flight_number", "departure_time", "arrival_time", "duration", "stops"]
      }
    }));
  }
  return out.slice(0, 40);
}
var IXIGO_WEB;
var init_ixigoFlights = __esm({
  "server/workers/parsers/ixigoFlights.ts"() {
    init_contract();
    IXIGO_WEB = "https://www.ixigo.com";
  }
});

// server/workers/parsers/emtFareCalendar.ts
function parseEmtFareCalendar(jsonText, wantDate) {
  const data = JSON.parse(jsonText);
  if (!Array.isArray(data) || !data[0]) return [];
  const rows = ["FstRow", "SndRow", "TrdRow", "ForthRow", "FifthRow", "SixRow"];
  const fares = [];
  const seen = /* @__PURE__ */ new Set();
  for (const rn of rows) {
    const cells = data[0][rn] || [];
    for (const c of cells) {
      if (!c?.fulDate || !c.bookMsg) continue;
      const fare = Number(String(c.bookMsg).replace(/[^0-9]/g, ""));
      if (!fare || fare <= 0 || seen.has(c.fulDate)) continue;
      seen.add(c.fulDate);
      fares.push({ date: c.fulDate, fare, airlineCode: c.AirlineCode || null });
    }
  }
  return fares;
}
function emtFareItems(fares, source, route, wantDate) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const airline = (code) => code && EMT_AIRLINES[code] ? EMT_AIRLINES[code] : null;
  const exact = fares.find((f) => f.date === wantDate && airline(f.airlineCode));
  const upcoming = fares.filter((f) => airline(f.airlineCode)).sort((a, b) => a.fare - b.fare);
  const chosen = exact || upcoming[0];
  if (!chosen) return [];
  const al = airline(chosen.airlineCode);
  const isExact = exact ? chosen.date === exact.date : false;
  const routeLabel = `${route.from} \u2192 ${route.to}`;
  return [newRawItem(source, {
    title: `${al.name} ${routeLabel} ${isExact ? `on ${chosen.date}` : `(cheapest upcoming, ${chosen.date})`} from \u20B9${chosen.fare}`,
    brand: al.name,
    price: chosen.fare,
    currency: "INR",
    seller: al.name,
    sellerUrl: al.url,
    travel: { route: `${route.from.toLowerCase()} to ${route.to.toLowerCase()}` },
    attributes: {
      route: routeLabel,
      travel_date: chosen.date,
      fare: String(chosen.fare),
      airline_code: chosen.airlineCode || "",
      price_basis: `cheapest fare observed on EaseMyTrip's live fare calendar on ${today} (acquisition source, not seller)`,
      data_note: `Fare acquired via EaseMyTrip fare calendar on ${today}; booking is on ${al.name}'s own website. Price is the cheapest carrier fare for this route/date and may change at checkout.`,
      image: ""
    },
    identifiers: { sku: `emt-${chosen.airlineCode}-${route.from}-${route.to}-${chosen.date.replace(/\//g, "-")}` },
    evidence: {
      sourceUrl: "https://flightservice-seo.easemytrip.com/EmtAppService/FareCalendar/FillCalendarDataByMonth",
      extractedFields: ["bookMsg (fare)", "AirlineCode", "fulDate"]
    }
  })];
}
var EMT_AIRLINES;
var init_emtFareCalendar = __esm({
  "server/workers/parsers/emtFareCalendar.ts"() {
    init_contract();
    EMT_AIRLINES = {
      "6E": { name: "IndiGo", url: "https://www.goindigo.in/" },
      QP: { name: "Akasa Air", url: "https://www.akasaair.com/" },
      AI: { name: "Air India", url: "https://www.airindia.com/" },
      IX: { name: "Air India Express", url: "https://www.airindiaexpress.com/" },
      SG: { name: "SpiceJet", url: "https://www.spicejet.com/" },
      UK: { name: "Vistara", url: "https://www.airvistara.com/" },
      G8: { name: "Go First", url: "https://www.flygofirst.com/" },
      "9I": { name: "Alliance Air", url: "https://www.allianceair.in/" },
      I5: { name: "AirAsia India", url: "https://www.airasia.co.in/" },
      QZ: { name: "IndiGo", url: "https://www.goindigo.in/" }
    };
  }
});

// server/workers/verticals/flights.ts
function routeFromQuery(raw) {
  const KNOWN_CODES = /* @__PURE__ */ new Set(["DEL", "BOM", "BLR", "HYD", "MAA", "CCU", "PNQ", "AMD", "JAI", "GOI", "LKO", "NAG", "IDR", "STV", "PAT", "BHO", "CJB", "COK", "GAU", "IXC", "DED", "ATQ", "VNS", "SXR", "TRV", "VTZ", "IXM", "UDR", "JDH", "IXR", "RPR", "BBI", "IMF", "IXL", "IXB", "IXU", "IXE", "BDQ", "RAJ", "IXJ", "IXD", "GOP", "JRG", "DIB", "TEZ", "KNU", "MYQ", "HBX", "IXG", "KLH", "ISK", "SAG", "TIR", "DXB", "SIN", "LHR", "JFK", "BKK", "KUL", "DOH", "AUH", "SHJ"]);
  raw = raw.replace(/\b([a-zA-Z][a-zA-Z.]{2,})\s+([A-Za-z]{3})\b(?!\s*\))/g, (full, city, code) => KNOWN_CODES.has(code.toUpperCase()) && !/^(to|from|and|the|via)$/i.test(city) ? `${city} (${code.toUpperCase()})` : full);
  const m = raw.match(/([a-zA-Z][a-zA-Z\s.]{1,28}?(?:\s*\([A-Za-z]{3}\))?)\s+(?:to|→|->|-)\s+([a-zA-Z][a-zA-Z\s.]{1,28}(?:\s*\([A-Za-z]{3}\))?)/);
  if (!m) return null;
  const codeOf = (s) => s.match(/\(([A-Za-z]{3})\)/)?.[1]?.toUpperCase();
  const clean = (s) => s.replace(/\([^)]*\)/g, " ").replace(/\b(flight|flights|ticket|tickets|air|fly|from|cheapest|cheap|direct|return|one-way|oneway|round trip|airport)\b/gi, " ").replace(/\b(on|for|tomorrow|today|tonight|night|morning|evening|at)\b.*$/i, " ").replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b.*$/i, " ").replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b.*$/, " ").replace(/,.*$/, "").replace(/\s+/g, " ").trim();
  const from = clean(m[1]);
  const to = clean(m[2]);
  if (!from || !to) return null;
  return { from, to, fromCode: codeOf(m[1]), toCode: codeOf(m[2]) };
}
var URL_AP, flightsWorker;
var init_flights = __esm({
  "server/workers/verticals/flights.ts"() {
    init_verticalWorker();
    init_openflights();
    init_ixigoFlights();
    init_httpClient();
    init_emtFareCalendar();
    init_curlCffiFetch();
    URL_AP = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat";
    flightsWorker = {
      vertical: "flights",
      tasks: [
        {
          // EaseMyTrip fare calendar (metasearch acquisition): real cheapest per-day
          // fare + operating airline. Seller = the AIRLINE; deeplink = airline's own site.
          sourceId: "w_flights_emt",
          priority: 14,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || "");
            const rt = routeFromQuery(raw);
            if (!rt) return [];
            const IATA = {
              delhi: "DEL",
              "new delhi": "DEL",
              mumbai: "BOM",
              bombay: "BOM",
              bangalore: "BLR",
              bengaluru: "BLR",
              hyderabad: "HYD",
              chennai: "MAA",
              kolkata: "CCU",
              pune: "PNQ",
              ahmedabad: "AMD",
              jaipur: "JAI",
              goa: "GOI",
              panaji: "GOI",
              lucknow: "LKO",
              nagpur: "NAG",
              indore: "IDR",
              surat: "STV",
              patna: "PAT",
              bhopal: "BHO",
              coimbatore: "CJB",
              kochi: "COK",
              ernakulam: "COK",
              guwahati: "GAU",
              chandigarh: "IXC",
              dehradun: "DED",
              amritsar: "ATQ",
              varanasi: "VNS",
              srinagar: "SXR",
              trivandrum: "TRV",
              thiruvananthapuram: "TRV",
              vizag: "VTZ",
              visakhapatnam: "VTZ",
              madurai: "IXM",
              udaipur: "UDR",
              jodhpur: "JDH",
              ranchi: "IXR",
              raipur: "RPR",
              bhubaneswar: "BBI",
              imphal: "IMF",
              leh: "IXL",
              bagdogra: "IXB",
              aurangabad: "IXU",
              mangalore: "IXE",
              vadodara: "BDQ",
              rajkot: "RAJ",
              jammu: "IXJ",
              allahabad: "IXD",
              prayagraj: "IXD",
              gorakhpur: "GOP",
              jharsuguda: "JRG",
              dibrugarh: "DIB",
              tezpur: "TEZ",
              kanpur: "KNU",
              mysore: "MYQ",
              hubli: "HBX",
              belgaum: "IXG",
              kolhapur: "KLH",
              nashik: "ISK",
              shirdi: "SAG",
              tirupati: "TIR"
            };
            const code = (s) => IATA[s.toLowerCase().trim()] || null;
            const from = rt.fromCode || code(rt.from);
            const to = rt.toCode || code(rt.to);
            if (!from || !to) return [];
            const dIso = ctx.query?.travelDates?.depart;
            const base = dIso && /^\d{4}-\d{2}-\d{2}$/.test(dIso) ? /* @__PURE__ */ new Date(`${dIso}T00:00:00`) : new Date(Date.now() + 7 * 864e5);
            const dd = String(base.getDate()).padStart(2, "0");
            const mm = String(base.getMonth() + 1).padStart(2, "0");
            const yy = base.getFullYear();
            const wantDate = `${dd}/${mm}/${yy}`;
            const body = JSON.stringify({ CalKey_: `${from}_${to}_rdate__${wantDate}_` });
            const r = await cffiFetch("https://flightservice-seo.easemytrip.com/EmtAppService/FareCalendar/FillCalendarDataByMonth", {
              impersonate: "chrome",
              timeoutMs: 25e3,
              method: "POST",
              body,
              headers: { "Content-Type": "application/json; charset=utf-8", Origin: "https://www.easemytrip.com", Referer: "https://www.easemytrip.com/" }
            });
            if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `EMT fare calendar HTTP ${r.status}`);
            const fares = parseEmtFareCalendar(r.body, wantDate);
            if (!fares.length) throw new AcquisitionError("EMPTY_RESPONSE", "EMT fare calendar returned no per-day fares for this route");
            const items = emtFareItems(fares, ctx.source, { from: rt.from, to: rt.to }, wantDate);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", "EMT fare calendar had no fare with a known Indian carrier for this route");
            return items;
          }
        },
        {
          // Ixigo SSRs the flight search page: __NEXT_DATA__ ships up to 100
          // real flight entries for the date (airline, flight number, total
          // fare, times, stops). City names are accepted directly.
          sourceId: "w_flights_ixigo",
          name: "Flights worker: real fares via Ixigo SSR (seller = airline website)",
          priority: 1,
          maxPerMinute: 6,
          timeoutMs: 35e3,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || ctx.query.entityName || "");
            const rt = routeFromQuery(raw);
            if (!rt) return [];
            const dep = ctx.query?.travelDates?.depart && /\d{4}-\d{2}-\d{2}/.test(ctx.query.travelDates.depart) ? ctx.query.travelDates.depart : new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
            const url = `https://www.ixigo.com/search/flight/${encodeURIComponent(rt.from.toLowerCase())}/${encodeURIComponent(rt.to.toLowerCase())}/${dep}/1/0`;
            const res = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 3e4 });
            if (res.status === 403 || res.status === 429) {
              throw new AcquisitionError(res.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED", `Ixigo blocked: ${res.status}`, res.status);
            }
            if (res.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Ixigo HTTP ${res.status}`, res.status);
            const m = res.body.match(/<script id="__NEXT_DATA__"[^>]*>(\{[\s\S]*?\})<\/script>/);
            if (!m) throw new AcquisitionError("MALFORMED_RESPONSE", "Ixigo SRP carried no __NEXT_DATA__");
            let next;
            try {
              next = JSON.parse(m[1]);
            } catch {
              throw new AcquisitionError("MALFORMED_RESPONSE", "Ixigo __NEXT_DATA__ not valid JSON");
            }
            const flights = parseIxigoFlights(next);
            if (flights.length === 0) throw new AcquisitionError("EMPTY_RESPONSE", "Ixigo SRP had no priced flights");
            return parseIxigoOffers(flights, ctx.source, rt.from, rt.to, dep);
          }
        },
        // ---- Owner-mandated flights sources: attempted live on every search, honestly reported ----
        {
          sourceId: "w_flights_makemytrip",
          name: "Flights worker: MakeMyTrip flights (probe)",
          priority: 15,
          run: async () => {
            await cffiFetch("https://www.makemytrip.com/flights/", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError("EMPTY_RESPONSE", "MakeMyTrip flight search serves an empty shell to browserless HTTP; fare lists load via Akamai-sensor-gated sessioned APIs (bot challenge on 302 to makemytrip.global).");
          }
        },
        {
          sourceId: "w_flights_yatra",
          name: "Flights worker: Yatra flights (probe)",
          priority: 16,
          run: async () => {
            await cffiFetch("https://flight.yatra.com/", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError("EMPTY_RESPONSE", "Yatra flight search is a JS shell to browserless HTTP (HTTP/2 stream reset); fares are session-gated. Cheap-flights SEO pages return 404.");
          }
        },
        {
          sourceId: "w_flights_cleartrip",
          name: "Flights worker: Cleartrip flights (probe)",
          priority: 17,
          run: async () => {
            await cffiFetch("https://www.cleartrip.com/flights/", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError("EMPTY_RESPONSE", "Cleartrip flight results render client-side only; the SEO route pages (/flights/<city>-<city>/) return 404 and the search results XHR requires a session.");
          }
        },
        {
          sourceId: "w_flights_akasa",
          name: "Flights worker: Akasa Air (probe)",
          priority: 18,
          run: async () => {
            await cffiFetch("https://www.akasaair.com/", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError("EMPTY_RESPONSE", "Akasa Air web serves a challenge/403 to browserless HTTP; homepage carries only marketing voucher fares, no live route fares without a sessioned booking flow.");
          }
        },
        {
          sourceId: "w_flights_indigo",
          name: "Flights worker: IndiGo (probe)",
          priority: 19,
          run: async () => {
            await cffiFetch("https://www.goindigo.in/", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError("EMPTY_RESPONSE", "IndiGo web homepage carries marketing fares only; live route fares come from the sessioned skyplus booking API (app-prod-skyplus6e.goindigo.in), not an unauthenticated browserless endpoint.");
          }
        },
        {
          sourceId: "w_flights_budgetair",
          name: "Flights worker: BudgetAir/Travix (probe)",
          priority: 20,
          run: async () => {
            const res = await cffiFetch("https://www.budgetair.com/en_us", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError(
              res.status === 200 ? "EMPTY_RESPONSE" : "ACCESS_CHALLENGE",
              "BudgetAir (Travix) search results load only via the sessioned edge-api.travix.com gateway; the flights URL 302s to a marketing home with static per-airline deal tiles, no SSR route fares to browserless HTTP."
            );
          }
        },
        {
          sourceId: "w_flights_gotogate",
          name: "Flights worker: Gotogate/Etraveli (probe)",
          priority: 21,
          run: async () => {
            const res = await cffiFetch("https://us.gotogate.com/?customerLanguage=en", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError(
              res.status === 200 ? "EMPTY_RESPONSE" : "ACCESS_CHALLENGE",
              "Gotogate (Etraveli Group) is a full JS shell: search results render client-side from sessioned XHRs, and /en-in returns 404 to browserless HTTP; no SSR fares."
            );
          }
        },
        {
          sourceId: "w_flights_flightnetwork",
          name: "Flights worker: FlightNetwork/Etraveli (probe)",
          priority: 22,
          run: async () => {
            const res = await cffiFetch("https://us-en.flightnetwork.com/?customerLanguage=en", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError(
              res.status === 200 ? "EMPTY_RESPONSE" : "ACCESS_CHALLENGE",
              "FlightNetwork (Etraveli Group) serves the same JS shell as Gotogate: route URLs 404, search is client-side only; no SSR fares to browserless HTTP."
            );
          }
        },
        {
          sourceId: "w_flights_holidaybreakz",
          name: "Flights worker: HolidayBreakz (probe)",
          priority: 23,
          run: async () => {
            const res = await cffiFetch("https://www.holidaybreakz.com/flightsticket", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError(
              res.status === 200 ? "EMPTY_RESPONSE" : "ACCESS_CHALLENGE",
              "HolidayBreakz is a US-market agency: static USD deal tiles for US cities (SFO/ATL/AUS) on SEO pages; flight/hotel search is a sessioned POST with no SSR fares, no India-route inventory."
            );
          }
        },
        {
          sourceId: "w_flights_openflights",
          name: "Flights worker: OpenFlights airline-route data (worldwide)",
          priority: 10,
          maxPerMinute: 10,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || ctx.query.entityName || "");
            const rt = routeFromQuery(raw);
            if (!rt) return [];
            const fetchFn = (u) => ctx.fetch(u, { expectJson: false }).then((r) => {
              if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `OpenFlights HTTP ${r.status}`, r.status);
              return r.body;
            });
            const { airports, airlines, routes } = await loadOpenFlights(fetchFn);
            return parseRoute(airports, airlines, routes, ctx.source, rt.from, rt.to, ctx.query.travelDates?.depart, URL_AP);
          }
        }
      ]
    };
    registerVerticalWorker(flightsWorker);
  }
});

// server/workers/parsers/zomato.ts
function parseZomatoRestaurants(html, source, searchUrl, platform) {
  const fingerprint = (0, import_crypto6.createHash)("sha256").update(html.slice(0, 5e4)).digest("hex");
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    let d;
    try {
      d = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const list = d?.["@type"] === "ItemList" ? d.itemListElement : null;
    if (!Array.isArray(list)) continue;
    for (const el of list) {
      const it = el?.item || el;
      if (!it?.name) continue;
      if (seen.has(it.name)) continue;
      seen.add(it.name);
      const rating = it.aggregateRating?.ratingValue;
      const reviews = it.aggregateRating?.reviewCount;
      out.push(newRawItem(source, {
        title: it.name.slice(0, 200),
        seller: platform || "Zomato",
        sellerUrl: it.url ? `https://www.zomato.com${String(it.url).split("?")[0]}` : searchUrl,
        currency: "INR",
        location: { city: "" },
        attributes: {
          restaurant: it.name.slice(0, 200),
          ...it.servesCuisine ? { cuisines: it.servesCuisine.slice(0, 160) } : {},
          ...typeof it.image === "string" && /^https:\/\//.test(it.image) ? { image_url: it.image.slice(0, 400) } : {},
          ...rating !== void 0 ? { rating: String(rating) } : {},
          ...reviews !== void 0 ? { review_count: String(reviews) } : {},
          ...it.address?.streetAddress ? { address: it.address.streetAddress.slice(0, 160) } : {},
          platform,
          data_note: "Restaurant listing from public Zomato pages; dish prices are not exposed and remain unknown"
        },
        evidence: {
          sourceUrl: searchUrl,
          sourceReference: it.name,
          rawFingerprint: fingerprint,
          extractedFields: ["title", ...rating !== void 0 ? ["rating"] : [], ...it.servesCuisine ? ["cuisines"] : []]
        }
      }));
    }
  }
  return out.slice(0, 40);
}
function walkMenuJson(node, out, depth = 0) {
  if (!node || depth > 12) return;
  if (Array.isArray(node)) {
    for (const n of node) walkMenuJson(n, out, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const t = String(node["@type"] || "");
  if ((t === "MenuItem" || t === "MenuSection") && node.name && node.offers) {
    const p = Number(node.offers.price ?? node.offers.lowPrice ?? NaN);
    if (Number.isFinite(p) && p > 0) out.push({ name: String(node.name).slice(0, 160), price: Math.round(p), description: node.description ? String(node.description).slice(0, 200) : void 0 });
  }
  if (!t && node.name && (node.price !== void 0 || node.item_price !== void 0 || node.price_incl !== void 0)) {
    const p = Number(node.price ?? node.item_price ?? node.price_incl ?? NaN);
    const nm = String(node.name).trim();
    if (Number.isFinite(p) && p >= 10 && p <= 12e3 && nm.length >= 3 && nm.length <= 160) {
      out.push({ name: nm.slice(0, 160), price: Math.round(p) });
    }
  }
  for (const v of Object.values(node)) walkMenuJson(v, out, depth + 1);
}
function parseZomatoMenuPage(html) {
  const hints = { jsonLdBlocks: 0, hasMenu: 0, preloadedState: 0, priceHits: 0 };
  const dishes = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (d) => {
    const k = `${d.name}|${d.price}`;
    if (!seen.has(k)) {
      seen.add(k);
      dishes.push(d);
    }
  };
  hints.priceHits = (html.match(/"(?:price|item_price|price_incl)"\s*:/g) || []).length;
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    hints.jsonLdBlocks += 1;
    if (m[1].includes("hasMenu") || m[1].includes("MenuItem")) hints.hasMenu += 1;
    try {
      const tmp = [];
      walkMenuJson(JSON.parse(m[1]), tmp);
      tmp.forEach(add);
    } catch {
    }
  }
  if (dishes.length) return { dishes: dishes.slice(0, 30), hints };
  const pre = /window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i.exec(html) || /__NEXT_DATA__[^>]*>(\{[\s\S]*?\})<\/script>/i.exec(html);
  if (pre) {
    hints.preloadedState += 1;
    try {
      const tmp = [];
      walkMenuJson(JSON.parse(pre[1]), tmp);
      tmp.forEach(add);
    } catch {
    }
  }
  return { dishes: dishes.slice(0, 30), hints };
}
var import_crypto6;
var init_zomato = __esm({
  "server/workers/parsers/zomato.ts"() {
    import_crypto6 = require("crypto");
    init_contract();
  }
});

// server/workers/parsers/swiggy.ts
function parseSwiggyDishes(json, source, searchUrl, city) {
  let d;
  try {
    d = JSON.parse(json);
  } catch {
    return [];
  }
  const fingerprint = (0, import_crypto7.createHash)("sha256").update(json.slice(0, 5e4)).digest("hex");
  const cards = [];
  const stack = [d?.data];
  while (stack.length) {
    const n = stack.pop();
    if (!n || typeof n !== "object") continue;
    if (n.cardGroupMap?.DISH?.cards) cards.push(...n.cardGroupMap.DISH.cards);
    for (const v of Object.values(n)) if (v && typeof v === "object") stack.push(v);
    if (cards.length) break;
  }
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const c of cards) {
    const card = c?.card?.card;
    const rest = card?.restaurant?.info;
    const dishes = Array.isArray(card?.dishes) ? card.dishes : [];
    if (!rest?.name || !dishes.length) continue;
    const restUrl = rest.slugs?.restaurant && rest.slugs?.city ? `https://www.swiggy.com/city/${rest.slugs.city}/${rest.slugs.restaurant}-rest${rest.id}` : searchUrl;
    for (const dw of dishes) {
      const di = dw?.info;
      if (!di?.name || typeof di.price !== "number" || di.price <= 0) continue;
      const key = `${rest.id}:${di.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const rating = di.ratings?.aggregatedRating?.rating;
      const ratingCount = di.ratings?.aggregatedRating?.ratingCountV2;
      const img = di.imageId ? `${IMG}${di.imageId}` : rest.cloudinaryImageId ? `${IMG}${rest.cloudinaryImageId}` : "";
      out.push(newRawItem(source, {
        title: String(di.name).slice(0, 200),
        price: Math.round(di.price) / 100,
        currency: "INR",
        seller: "Swiggy",
        sellerUrl: restUrl,
        availability: di.inStock === 1 && rest.availability?.opened !== false ? "in_stock" : "out_of_stock",
        location: { city },
        attributes: {
          restaurant: String(rest.name).slice(0, 120),
          ...rest.areaName ? { area: String(rest.areaName).slice(0, 80) } : {},
          ...img ? { image_url: img } : {},
          ...di.description ? { dish_description: String(di.description).replace(/\s+/g, " ").trim().slice(0, 220) } : {},
          ...rating ? { rating: String(rating) } : rest.avgRating ? { rating: String(rest.avgRating) } : {},
          ...ratingCount ? { rating_count: String(ratingCount) } : {},
          ...Array.isArray(rest.cuisines) && rest.cuisines.length ? { cuisines: rest.cuisines.slice(0, 4).join(", ") } : {},
          ...rest.sla?.slaString ? { eta: String(rest.sla.slaString).toLowerCase() } : {},
          ...rest.costForTwoMessage ? { cost_for_two: String(rest.costForTwoMessage) } : {},
          platform: "Swiggy"
        },
        evidence: {
          sourceUrl: searchUrl,
          sourceReference: `${rest.id}:${di.id}`,
          rawFingerprint: fingerprint,
          extractedFields: ["title", "price", ...img ? ["image"] : [], ...rating ? ["rating"] : [], "availability"]
        }
      }));
    }
  }
  return out.slice(0, 60);
}
var import_crypto7, IMG;
var init_swiggy = __esm({
  "server/workers/parsers/swiggy.ts"() {
    import_crypto7 = require("crypto");
    init_contract();
    IMG = "https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_400,h_400,c_fit/";
  }
});

// server/workers/parsers/dominos.ts
function parseDominosMenu(htmlEscaped) {
  const html = htmlEscaped.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'");
  const re = /\{"productMasterUID":"[0-9a-f-]{36}","name":"(.*?)","displayName":"(.*?)","family":\{"familyId":"[0-9a-f-]{36}","name":"(.*?)"\},"description":"(.*?)".{0,4000}?"price":\{"regularPrice":(\d+),"currentPrice":(\d+)\}/gs;
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const m of html.matchAll(re)) {
    const [, , displayName, family, description, regular, current] = m;
    const cur = Number(current);
    const reg = Number(regular);
    const disp = String(displayName);
    const key = `${disp}|${family}`;
    if (!disp || !cur || cur <= 0 || seen.has(key)) continue;
    seen.add(key);
    out.push({
      displayName: disp,
      family: String(family),
      currentPrice: cur,
      regularPrice: reg,
      description: String(description).replace(/\\u0026/g, "&").slice(0, 160),
      menuCode: ""
    });
  }
  return out;
}
function dominosItems(products, source, query) {
  const q3 = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!q3) return [];
  const words = q3.split(" ").filter((w) => w.length > 2 && !["the", "and", "for", "with", "pizza", "order", "buy", "price"].includes(w));
  const pizzaish = /pizza|margherita|farmhouse|paneer|corn|cheese|garlic|bread|taco|burger|chicken|veg|cake|dessert|sides|wings|lava|parcel|meltz|taco/i.test(q3);
  const scored = products.map((p) => {
    const hay = `${p.displayName} ${p.family} ${p.description}`.toLowerCase();
    let score = 0;
    for (const w of words) if (hay.includes(w)) score += 1;
    if (hay.includes(q3)) score += 3;
    return { p, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.p.currentPrice - b.p.currentPrice);
  const top = scored.slice(0, 12);
  if (!top.length && pizzaish) {
    return products.filter((p) => p.family === "Pizza").slice(0, 8).map((p) => buildItem(p, source, "national menu best-seller"));
  }
  return top.map((x) => buildItem(x.p, source, "menu item matched to your search"));
}
function buildItem(p, source, matchNote) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return newRawItem(source, {
    title: `Domino's ${p.displayName} (${p.family})`,
    brand: "Domino's",
    price: p.currentPrice,
    currency: "INR",
    seller: "Domino's Pizza India",
    sellerUrl: "https://www.dominos.co.in/menu",
    attributes: {
      dish: p.displayName,
      category: p.family,
      description: p.description,
      regular_price: String(p.regularPrice),
      saving: p.regularPrice > p.currentPrice ? String(p.regularPrice - p.currentPrice) : "",
      image: "",
      price_basis: `dominos.co.in web menu price (${matchNote}), scraped ${today}`,
      data_note: `Price from Domino's India national web menu on ${today}; final price at checkout may vary by city/store`
    },
    identifiers: { sku: `dominos-${p.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` },
    evidence: { sourceUrl: "https://www.dominos.co.in/menu", extractedFields: ["displayName", "family", "currentPrice", "regularPrice", "description"] }
  });
}
var init_dominos = __esm({
  "server/workers/parsers/dominos.ts"() {
    init_contract();
  }
});

// server/workers/verticals/food.ts
function citySlug(city, raw) {
  if (city) {
    const c = city.toLowerCase().trim();
    if (ZOMATO_SLUGS[c]) return ZOMATO_SLUGS[c];
  }
  const m = raw.match(/(?:in|near)\s+([a-z\s]{3,20})$/i);
  if (m) {
    const c = m[1].trim().toLowerCase();
    if (ZOMATO_SLUGS[c]) return ZOMATO_SLUGS[c];
    return c.replace(/\s+/g, "-");
  }
  return null;
}
var ZOMATO_SLUGS, CITY_COORDS, foodWorker;
var init_food = __esm({
  "server/workers/verticals/food.ts"() {
    init_verticalWorker();
    init_zomato();
    init_contract();
    init_swiggy();
    init_httpClient();
    init_dominos();
    init_curlCffiFetch();
    ZOMATO_SLUGS = {
      "new delhi": "ncr",
      delhi: "ncr",
      ncr: "ncr",
      gurgaon: "ncr",
      noida: "ncr",
      faridabad: "ncr",
      ghaziabad: "ncr",
      bengaluru: "bangalore",
      bangalore: "bangalore",
      mumbai: "mumbai",
      pune: "pune",
      hyderabad: "hyderabad",
      chennai: "chennai",
      kolkata: "kolkata",
      ahmedabad: "ahmedabad",
      jaipur: "jaipur",
      lucknow: "lucknow",
      chandigarh: "chandigarh",
      indore: "indore",
      nagpur: "nagpur",
      surat: "surat",
      vadodara: "vadodara",
      bhopal: "bhopal",
      patna: "patna",
      kochi: "kochi",
      coimbatore: "coimbatore",
      goa: "goa",
      "panaji": "goa"
    };
    CITY_COORDS = {
      "new delhi": [28.6315, 77.2167],
      delhi: [28.6315, 77.2167],
      ncr: [28.6315, 77.2167],
      gurgaon: [28.4595, 77.0266],
      noida: [28.5355, 77.391],
      bengaluru: [12.9716, 77.5946],
      bangalore: [12.9716, 77.5946],
      mumbai: [19.076, 72.8777],
      pune: [18.5204, 73.8567],
      hyderabad: [17.385, 78.4867],
      chennai: [13.0827, 80.2707],
      kolkata: [22.5726, 88.3639],
      ahmedabad: [23.0225, 72.5714],
      jaipur: [26.9124, 75.7873],
      lucknow: [26.8467, 80.9462],
      chandigarh: [30.7333, 76.7794],
      indore: [22.7196, 75.8577],
      goa: [15.4909, 73.8278],
      kochi: [9.9312, 76.2673]
    };
    foodWorker = {
      vertical: "food",
      tasks: [
        {
          // Domino's India: full national menu SSR'd (entity-encoded JSON) with real prices.
          // Seller = Domino's; web menu deeplink (web ordering works on dominos.co.in).
          sourceId: "w_food_dominos",
          priority: 13,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || "");
            const dishish = /pizza|margherita|farmhouse|garlic.?bread|taco|burger.?pizza|lava|chicken|wings|parcel|meltz|cheese|dominos|domino.?s/i.test(raw);
            if (!dishish) return [];
            const r = await cffiFetch("https://www.dominos.co.in/menu", { impersonate: "chrome", timeoutMs: 45e3 });
            if (r.status !== 200) throw new AcquisitionError("ACCESS_CHALLENGE", `Domino's HTTP ${r.status}`);
            const products = parseDominosMenu(r.body);
            if (!products.length) throw new AcquisitionError("EMPTY_RESPONSE", "Domino's menu page carried no parseable products");
            const items = dominosItems(products, ctx.source, raw);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", "Domino's menu had no item matching this query");
            return items;
          }
        },
        {
          sourceId: "w_food_eatsure",
          name: "Food worker: EatSure (Rebel Foods) menu",
          priority: 15,
          run: async () => {
            const r = await cffiFetch("https://www.eatsure.com/", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError("EMPTY_RESPONSE", `EatSure serves a JS shell to browserless HTTP (menu/prices load via sessioned XHR after city/location selection, no SSR product data). Searched the site, sitemaps and main bundle: no unauthenticated menu API found.`);
          }
        },
        {
          sourceId: "w_food_ovenstory",
          name: "Food worker: Oven Story pizza menu",
          priority: 15,
          run: async () => {
            const r = await cffiFetch("https://www.ovenstory.in/", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError("EMPTY_RESPONSE", `Oven Story (Rebel Foods) serves a JS shell to browserless HTTP: sitemap lists 334 product URLs but every product page renders the same empty shell; prices load via sessioned XHR only.`);
          }
        },
        {
          sourceId: "w_food_swiggy",
          name: "Food worker: Swiggy dish search (dish, price, photo, restaurant)",
          priority: 5,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || "");
            const term = String(ctx.query.entityName || raw).replace(/\b(in|near)\s+[a-z\s]+$/i, "").trim();
            if (!term) return [];
            const cityKey = String(ctx.query.location?.city || "").toLowerCase().trim();
            const c = CITY_COORDS[cityKey] || CITY_COORDS["new delhi"];
            const url = `https://www.swiggy.com/dapi/restaurants/search/v3?lat=${c[0]}&lng=${c[1]}&str=${encodeURIComponent(term)}&trackingId=undefined&submitAction=ENTER&queryUniqueId=t1s${Date.now() % 1e5}`;
            const r = await ctx.fetch(url, { expectJson: true, maxBytes: 8e6, timeoutMs: 2e4, headers: { Accept: "application/json" } });
            if (r.status !== 200) throw new AcquisitionError("FORBIDDEN", `Swiggy HTTP ${r.status}`, r.status);
            return parseSwiggyDishes(r.body, ctx.source, url, ctx.query.location?.city || "New Delhi");
          }
        },
        {
          sourceId: "w_food_zomato",
          name: "Food worker: Zomato public restaurant listings",
          priority: 10,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || "");
            const slug = citySlug(ctx.query.location?.city, raw);
            if (!slug) return [];
            const term = String(ctx.query.entityName || raw).replace(/\b(in|near)\s+[a-z\s]+$/i, "").trim();
            const url = `https://www.zomato.com/${slug}/restaurants?q=${encodeURIComponent(term || "restaurants")}`;
            let r = await ctx.fetch(url);
            if (r.status === 403 || r.status === 202 || r.status === 429) {
              await new Promise((res) => setTimeout(res, 1500));
              r = await ctx.fetch(url);
            }
            if (r.status !== 200) throw new AcquisitionError("FORBIDDEN", `Zomato HTTP ${r.status}`, r.status);
            const items = parseZomatoRestaurants(r.body, ctx.source, url, "Zomato");
            if (!items.length && looksLikeChallenge(r.body)) throw new AcquisitionError("ACCESS_CHALLENGE", "Zomato presented a challenge page");
            const restUrls = items.slice(0, 2).map((it) => String(it.sellerUrl || "")).filter((u) => /zomato\.com\//.test(u));
            const dishItems = [];
            const hintAgg = {};
            for (const ru of restUrls) {
              const rr = await ctx.fetch(ru);
              if (rr.status !== 200) continue;
              const { dishes, hints } = parseZomatoMenuPage(rr.body);
              for (const [k, v] of Object.entries(hints)) hintAgg[k] = (hintAgg[k] || 0) + v;
              const restName = String(items.find((it) => it.sellerUrl === ru)?.title || ru.split("/").pop() || "restaurant");
              for (const d of dishes) {
                dishItems.push(newRawItem(ctx.source, {
                  title: `${d.name} (${restName})`,
                  brand: "Zomato",
                  price: d.price,
                  currency: "INR",
                  seller: "Zomato",
                  sellerUrl: ru,
                  location: { city: ctx.query.location?.city || "" },
                  attributes: {
                    dish: d.name.slice(0, 160),
                    restaurant: restName.slice(0, 160),
                    platform: "Zomato",
                    ...d.description ? { description: d.description } : {},
                    price_basis: "Menu price served in Zomato restaurant page embedded JSON",
                    data_note: "Dish price extracted from the restaurant page on zomato.com; final price at checkout may vary"
                  },
                  evidence: { sourceUrl: ru, sourceReference: d.name, extractedFields: ["dish", "price"] }
                }));
              }
              if (dishItems.length >= 20) break;
            }
            if (dishItems.length) return dishItems;
            if (restUrls.length && !hintAgg.priceHits) {
              throw new AcquisitionError("EMPTY_RESPONSE", `Zomato restaurant pages carried no embedded menu prices (hints: ${JSON.stringify(hintAgg)}) \u2014 dish prices stay unavailable to browserless HTTP`);
            }
            return items;
          }
        }
      ]
    };
    registerVerticalWorker(foodWorker);
  }
});

// server/workers/parsers/osrmCab.ts
async function buildCabEstimate(source, from, to, date, fetchRoute, ratePerKm, sourceUrl) {
  const [a, b] = await Promise.all([photonGeocode(from), photonGeocode(to)]);
  if (!a || !b) return [];
  const route = await fetchRoute(a.lon, a.lat, b.lon, b.lat);
  const km = Math.round(route.distanceM / 100) / 10;
  const mins = Math.round(route.durationS / 60);
  if (km > 800) return [];
  const estimate = Math.round(km * ratePerKm);
  return [newRawItem(source, {
    title: `${from.trim()} \u2192 ${to.trim()} \xB7 ${km} km \xB7 about ${mins} min`,
    seller: "Try1Second estimate",
    sellerUrl: sourceUrl,
    price: estimate,
    currency: "INR",
    travel: { route: `${from.trim()} to ${to.trim()}`.toLowerCase(), ...date ? { date } : {}, seatType: "unknown" },
    location: { city: from.trim().slice(0, 60) },
    attributes: {
      vehicle_type: "cab (indicative)",
      distance_km: String(km),
      duration_minutes: String(mins),
      rate_per_km_assumed: String(ratePerKm),
      fare_type: "indicative_estimate",
      estimate_note: `Estimate = ${km} km x \u20B9${ratePerKm}/km (assumed rate, editable in admin). Real fare varies by operator, surge and time.`,
      from_lat: a.lat.toFixed(5),
      from_lon: a.lon.toFixed(5),
      to_lat: b.lat.toFixed(5),
      to_lon: b.lon.toFixed(5)
    },
    availability: "unknown",
    evidence: {
      sourceUrl,
      sourceReference: `${from}->${to}`,
      extractedFields: ["distance_km", "duration_minutes", "estimated_fare"]
    }
  })];
}
var init_osrmCab = __esm({
  "server/workers/parsers/osrmCab.ts"() {
    init_contract();
    init_osmTravel();
  }
});

// server/workers/parsers/savaariCabs.ts
function savaariRouteSlug(city) {
  return city.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-");
}
function parseSavaariCabs(html, source, pageUrl, from, to) {
  const items = [];
  const seenFares = [];
  const re = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while (m = re.exec(html)) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const blocks = Array.isArray(data) ? data : [data];
    for (const b of blocks) {
      const qa = b?.mainEntity;
      if (!Array.isArray(qa)) continue;
      for (const q3 of qa) {
        const text = String(q3?.acceptedAnswer?.text || "");
        const vary = /from\s+Rs\.?\s*([\d,]+)\s*\(([^)]*)\)\s*to\s+Rs\.?\s*([\d,]+)\s*\(([^)]*)\)/i.exec(text);
        if (vary) {
          seenFares.push({ fare: Number(vary[1].replace(/,/g, "")), label: vary[2].replace(/\bfor\b/gi, "").trim() || "base vehicle" });
          seenFares.push({ fare: Number(vary[3].replace(/,/g, "")), label: vary[4].replace(/\bfor\b/gi, "").trim() || "top vehicle" });
          continue;
        }
        const starts = /starts\s+from\s+Rs\.?\s*([\d,]+)\s*(?:for\s+([^.,]+))?/i.exec(text);
        if (starts) seenFares.push({ fare: Number(starts[1].replace(/,/g, "")), label: (starts[2] || "one-way cab service").trim() });
        if (!vary && !starts) {
          const bare = /Rs\.?\s*([\d,]{4,6})/.exec(text);
          if (bare) seenFares.push({ fare: Number(bare[1].replace(/,/g, "")), label: "one-way cab service" });
        }
      }
    }
  }
  if (!seenFares.length) return [];
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const lo = Math.min(...seenFares.map((f) => f.fare));
  const hi = Math.max(...seenFares.map((f) => f.fare));
  const loLabel = seenFares.find((f) => f.fare === lo)?.label || "one-way";
  const hiLabel = seenFares.find((f) => f.fare === hi)?.label || "one-way";
  for (const { fare, label } of seenFares.slice(0, 6)) {
    items.push(newRawItem(source, {
      title: `${from} to ${to} cab (${label}, one-way)`,
      brand: "Savaari",
      price: Math.round(fare),
      currency: "INR",
      seller: "Savaari",
      sellerUrl: pageUrl,
      // the price-owning website itself
      travel: { route: `${from} to ${to}`.toLowerCase(), seatType: "unknown" },
      attributes: {
        pickup: from,
        drop: to,
        route: `${from} to ${to}`,
        vehicle_type: `cab (${label})`,
        vehicle_class: label,
        trip_type: "one-way",
        fare_range: `Rs ${lo} (base) - Rs ${hi}`,
        price_basis: `route fare as published by savaari.com on ${today}`,
        image: "",
        data_note: `Route fare scraped from savaari.com route page on ${today}`
      },
      identifiers: { sku: `savaari-${from}-${to}-${label}`.toLowerCase().replace(/\s+/g, "-") },
      evidence: { sourceUrl: pageUrl, extractedFields: ["FAQPage ld+json fare text"] }
    }));
  }
  return items;
}
var init_savaariCabs = __esm({
  "server/workers/parsers/savaariCabs.ts"() {
    init_contract();
  }
});

// server/workers/parsers/bharatTaxi.ts
function bharatTaxiSlug(city) {
  const s = city.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-");
  return BTX_ALIASES[s] || s;
}
function parseBharatTaxiCabs(html, source, pageUrl, from, to) {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  const flat = [];
  for (const tb of tables) {
    const rows = tb.match(/<tr>\s*<td>[\s\S]*?<\/td>\s*<td>[\s\S]*?<\/td>\s*<\/tr>/g) || [];
    const parsed = [];
    for (const row of rows) {
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) ?? [];
      if (cells.length < 2) continue;
      const clean = (s) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
      parsed.push({ car: clean(cells[0] ?? ""), price: clean(cells[1] ?? "") });
    }
    const isFlat = parsed.length > 0 && parsed.every((p) => /^[₹rs\.]*\s?[\d,]{3,6}$/i.test(p.price)) && parsed.every((p) => !/km/i.test(p.price));
    if (isFlat) {
      for (const p of parsed) flat.push({ car: p.car, fare: Number(p.price.replace(/[₹rs\.,\s]/gi, "")) });
      break;
    }
  }
  const seen = flat.filter((f) => f.fare > 0 && f.car).slice(0, 8);
  if (!seen.length) return [];
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const lo = Math.min(...seen.map((f) => f.fare));
  const hi = Math.max(...seen.map((f) => f.fare));
  return seen.map((f) => newRawItem(source, {
    title: `${from} to ${to} cab (${f.car}, one-way)`,
    brand: "Bharat Taxi",
    price: Math.round(f.fare),
    currency: "INR",
    seller: "Bharat Taxi",
    sellerUrl: pageUrl,
    // the price-owning website itself
    travel: { route: `${from} to ${to}`.toLowerCase(), seatType: "unknown" },
    attributes: {
      pickup: from,
      drop: to,
      route: `${from} to ${to}`,
      vehicle_type: f.car,
      trip_type: "one-way",
      fare_range: `Rs ${lo} (base) - Rs ${hi}`,
      price_basis: `one-way route fare as published by bharattaxi.com on ${today}`,
      data_note: `Route fare scraped from bharattaxi.com route page on ${today}`
    },
    identifiers: { sku: `bharattaxi-${from}-${to}-${f.car}`.toLowerCase().replace(/\s+/g, "-") },
    evidence: { sourceUrl: pageUrl, extractedFields: ["SSR HTML fare table (flat one-way)"] }
  }));
}
var BTX_ALIASES;
var init_bharatTaxi = __esm({
  "server/workers/parsers/bharatTaxi.ts"() {
    init_contract();
    BTX_ALIASES = {
      bengaluru: "bangalore",
      mysuru: "mysore",
      kolkata: "kolkata",
      chennai: "chennai",
      gurugram: "gurgaon",
      prayagraj: "allahabad",
      puducherry: "pondicherry"
    };
  }
});

// server/workers/parsers/quickRideCabs.ts
function parseQuickRideCabs(html, source, pageUrl, from, to) {
  const items = [];
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  const norm2 = (s) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const fare = (s) => {
    const m = /([\d,]{3,7})/.exec(norm2(s).replace(/[₹]/g, ""));
    return m ? Number(m[1].replace(/,/g, "")) : null;
  };
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  for (const row of rows) {
    const cells = row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g) || [];
    if (cells.length < 4) continue;
    const rf = norm2(cells[0] || "").toLowerCase();
    const rt = norm2(cells[1] || "").toLowerCase();
    const f = norm2(from || "").toLowerCase();
    const t = norm2(to || "").toLowerCase();
    const routeMatch = f && t && (rf.includes(f) || f.includes(rf)) && (rt.includes(t) || t.includes(rt));
    if (!routeMatch) continue;
    const oneWay = fare(cells[2] || "");
    const roundTrip = fare(cells[3] || "");
    if (oneWay && oneWay > 0) {
      items.push(newRawItem(source, {
        title: `${norm2(cells[0] || "")} to ${norm2(cells[1] || "")} cab (one-way)`,
        brand: "Quick Ride",
        price: Math.round(oneWay),
        currency: "INR",
        seller: "Quick Ride",
        sellerUrl: pageUrl,
        travel: { route: `${from} to ${to}`.toLowerCase(), seatType: "unknown" },
        attributes: {
          pickup: from,
          drop: to,
          route: `${norm2(cells[0] || "")} to ${norm2(cells[1] || "")}`,
          vehicle_type: "cab (outstation)",
          trip_type: "one-way",
          round_trip_fare: roundTrip ? String(roundTrip) : "",
          price_basis: `route fare as published on quickride.in on ${today}`,
          image: "",
          data_note: `Route fare scraped from quickride.in outstation fare table on ${today}`
        },
        identifiers: { sku: `quickride-${rf}-${rt}-ow`.replace(/\s+/g, "-") },
        evidence: { sourceUrl: pageUrl, extractedFields: ["fare table row"] }
      }));
    }
  }
  return items;
}
var init_quickRideCabs = __esm({
  "server/workers/parsers/quickRideCabs.ts"() {
    init_contract();
  }
});

// server/workers/verticals/cab.ts
function routeFromQuery2(raw) {
  const cleaned = raw.replace(/\b(cab|taxi|ride|auto|uber|ola|rapido|book|a|an|the|price|fare|for|drop|pickup|from|need|want|go|going)\b/gi, " ").replace(/\s+/g, " ").trim();
  const m = cleaned.match(/(.{2,40}?)\s+(?:to|→)\s+(.{2,40})/);
  if (!m) return null;
  return { from: m[1].trim(), to: m[2].trim() };
}
var cabWorker;
var init_cab = __esm({
  "server/workers/verticals/cab.ts"() {
    init_verticalWorker();
    init_osrmCab();
    init_savaariCabs();
    init_bharatTaxi();
    init_quickRideCabs();
    init_curlCffiFetch();
    init_contract();
    init_osmTravel();
    init_httpClient();
    cabWorker = {
      vertical: "cab",
      tasks: [
        {
          // ---- Owner-mandated cab sources: attempted live on every cab search, honestly reported ----
          // Ola: official Ola Cabs API fare estimates (developers.olacabs.com). Credentials in
          // OLA_API_KEY (owner supplies the real app token; demo keys are rejected by Ola).
          sourceId: "w_cab_ola",
          name: "Cab worker: Ola India fare estimates (official API)",
          priority: 15,
          maxPerMinute: 10,
          timeoutMs: 25e3,
          run: async (ctx) => {
            const key = String(process.env.OLA_API_KEY || "").trim();
            if (!key) throw new AcquisitionError("EMPTY_RESPONSE", "Ola API credentials not configured: set OLA_API_KEY in hPanel env (official Ola Cabs API; a demo key will be rejected by Ola with 401 \u2014 the owner will supply the original token).");
            const rt = routeFromQuery2(String(ctx.query.rawQuery || ""));
            if (!rt) return [];
            const [a, b] = await Promise.all([photonGeocode(rt.from), photonGeocode(rt.to)]);
            if (!a || !b) return [];
            const url = `https://api.olacabs.com/v1/products?pickup_lat=${a.lat}&pickup_lng=${a.lon}&drop_lat=${b.lat}&drop_lng=${b.lon}&category=sedan&response_type=json`;
            const r = await cffiFetch(url, { timeoutMs: 18e3, headers: { "X-APP-TOKEN": key, Accept: "application/json" } });
            if (r.status === 401 || r.status === 403) throw new AcquisitionError("FORBIDDEN", `Ola API rejected credentials (HTTP ${r.status}) \u2014 set a valid OLA_API_KEY`, r.status);
            if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Ola API HTTP ${r.status}`, r.status);
            let j;
            try {
              j = JSON.parse(r.body);
            } catch {
              throw new AcquisitionError("MALFORMED_RESPONSE", "Ola API non-JSON");
            }
            const cats = Array.isArray(j?.categories) ? j.categories : [];
            const items = [];
            const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
            for (const c of cats.slice(0, 4)) {
              const fares = c?.ride_estimate?.fare_breakup;
              const total = Array.isArray(fares) ? fares.find((f) => String(f?.type || "").includes("total")) : null;
              const price = Math.round(Number(total?.amount ?? c?.ride_estimate?.amount_max ?? 0));
              if (!price) continue;
              const vehicle = String(c.display_name || c.category || "Ola cab").slice(0, 60);
              items.push(newRawItem(ctx.source, {
                title: `${rt.from} to ${rt.to} cab (${vehicle}, one-way)`,
                brand: "Ola",
                price,
                currency: "INR",
                seller: "Ola",
                sellerUrl: "https://book.olacabs.com/",
                travel: { route: `${rt.from} to ${rt.to}`.toLowerCase(), seatType: "unknown" },
                attributes: {
                  pickup: rt.from,
                  drop: rt.to,
                  route: `${rt.from} to ${rt.to}`,
                  vehicle_type: vehicle,
                  trip_type: "one-way",
                  price_basis: `Ola API fare estimate on ${today}`,
                  data_note: "Fare estimate from the official Ola Cabs API (developers.olacabs.com)"
                },
                identifiers: { sku: `ola-${rt.from}-${rt.to}-${vehicle}`.toLowerCase().replace(/\s+/g, "-") },
                evidence: { sourceUrl: url, extractedFields: ["Ola API fare_breakup total_fare"] }
              }));
            }
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", "Ola API returned no fare estimate for this route");
            return items;
          }
        },
        {
          // Uber: official Uber API price estimates (developer.uber.com / v1.2). Credentials in
          // UBER_SERVER_TOKEN (owner supplies the real token; demo keys are rejected with 401 — verified live).
          sourceId: "w_cab_uber",
          name: "Cab worker: Uber India fare estimates (official API)",
          priority: 15,
          maxPerMinute: 10,
          timeoutMs: 25e3,
          run: async (ctx) => {
            const token = String(process.env.UBER_SERVER_TOKEN || "").trim();
            if (!token) throw new AcquisitionError("EMPTY_RESPONSE", "Uber API credentials not configured: set UBER_SERVER_TOKEN in hPanel env (official Uber API /v1.2/estimates/price; demo keys are rejected by Uber with 401 \u2014 the owner will supply the original token).");
            const rt = routeFromQuery2(String(ctx.query.rawQuery || ""));
            if (!rt) return [];
            const [a, b] = await Promise.all([photonGeocode(rt.from), photonGeocode(rt.to)]);
            if (!a || !b) return [];
            const url = `https://api.uber.com/v1.2/estimates/price?start_latitude=${a.lat}&start_longitude=${a.lon}&end_latitude=${b.lat}&end_longitude=${b.lon}`;
            const r = await cffiFetch(url, { timeoutMs: 18e3, headers: { Authorization: `Token ${token}`, Accept: "application/json" } });
            if (r.status === 401 || r.status === 403) throw new AcquisitionError("FORBIDDEN", `Uber API rejected credentials (HTTP ${r.status}) \u2014 set a valid UBER_SERVER_TOKEN`, r.status);
            if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Uber API HTTP ${r.status}`, r.status);
            let j;
            try {
              j = JSON.parse(r.body);
            } catch {
              throw new AcquisitionError("MALFORMED_RESPONSE", "Uber API non-JSON");
            }
            const prices = Array.isArray(j?.prices) ? j.prices : [];
            const items = [];
            const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
            for (const p of prices.slice(0, 5)) {
              const price = Math.round(Number(p.estimate ?? p.low_estimate ?? 0));
              if (!price) continue;
              const vehicle = String(p.localized_display_name || "Uber cab").slice(0, 60);
              items.push(newRawItem(ctx.source, {
                title: `${rt.from} to ${rt.to} cab (${vehicle}, one-way)`,
                brand: "Uber",
                price,
                currency: String(p.currency_code || "INR"),
                seller: "Uber",
                sellerUrl: "https://m.uber.com/looking/",
                travel: { route: `${rt.from} to ${rt.to}`.toLowerCase(), seatType: "unknown" },
                attributes: {
                  pickup: rt.from,
                  drop: rt.to,
                  route: `${rt.from} to ${rt.to}`,
                  vehicle_type: vehicle,
                  trip_type: "one-way",
                  distance_km: p.distance != null ? String(Math.round(p.distance * 10) / 10) : "",
                  duration_minutes: p.duration != null ? String(Math.round(p.duration / 60)) : "",
                  fare_range: p.low_estimate && p.high_estimate ? `Rs ${p.low_estimate} - Rs ${p.high_estimate}` : "",
                  price_basis: `Uber API price estimate on ${today}`,
                  data_note: "Fare estimate from the official Uber API (developer.uber.com /v1.2/estimates/price)"
                },
                identifiers: { sku: `uber-${rt.from}-${rt.to}-${vehicle}`.toLowerCase().replace(/\s+/g, "-") },
                evidence: { sourceUrl: url, extractedFields: ["Uber API estimates/price"] }
              }));
            }
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", "Uber API returned no fare estimate for this route");
            return items;
          }
        },
        {
          sourceId: "w_cab_indrive",
          name: "Cab worker: InDrive India (probe)",
          priority: 15,
          run: async () => {
            const r = await cffiFetch("https://indrive.com/en-in/", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError("EMPTY_RESPONSE", "InDrive publishes no fare list anywhere on the web \u2014 its model is rider-offered (negotiated) fares set per-ride in the app.");
          }
        },
        {
          sourceId: "w_cab_meru",
          name: "Cab worker: Meru (probe)",
          priority: 15,
          run: async () => {
            const r = await cffiFetch("https://www.meru.in/fares", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError("EMPTY_RESPONSE", "Meru consumer cab booking has been folded into Mahindra Alyte (enterprise mobility); meru.in carries no consumer cab fares anymore \u2014 available only on app.");
          }
        },
        {
          sourceId: "w_cab_fastdeals",
          name: "Cab worker: Fastdeals/Snap-E (probe)",
          priority: 15,
          run: async () => {
            throw new AcquisitionError("EMPTY_RESPONSE", "No authoritative web presence found for the Fastdeals/Snap-E cab service (fastdeals.in is an unrelated laptop store); no fare data exists on the open web for this source.");
          }
        },
        {
          // Bharat Taxi (direct operator): SSR route pages with flat one-way fare tables,
          // covers routes Savaari/QuickRide do not publish (Indore→Ujjain, Mumbai→Pune, Bengaluru→Mysuru).
          sourceId: "w_cab_bharattaxi",
          name: "Cab worker: Bharat Taxi route fares (SSR HTML tables, per-vehicle one-way)",
          priority: 5,
          maxPerMinute: 6,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const rt = routeFromQuery2(String(ctx.query.rawQuery || ""));
            if (!rt) return [];
            const url = `https://www.bharattaxi.com/${bharatTaxiSlug(rt.from)}/to/${bharatTaxiSlug(rt.to)}`;
            const r = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 3e4 });
            if (r.status === 404) return [];
            if (r.status !== 200) throw new AcquisitionError(r.status === 403 || r.status === 429 ? "ACCESS_CHALLENGE" : "SERVER_ERROR", `BharatTaxi HTTP ${r.status}`, r.status);
            const items = parseBharatTaxiCabs(r.body, ctx.source, url, rt.from, rt.to);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", "BharatTaxi route page carried no flat one-way fares");
            return items;
          }
        },
        {
          // Savaari (direct operator): route page FAQ JSON-LD carries real one-way fares
          sourceId: "w_cab_savaari",
          name: "Cab worker: Savaari outstation route fares",
          priority: 5,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || "");
            const rt = routeFromQuery2(raw);
            if (!rt) return [];
            const from = savaariRouteSlug(rt.from);
            const to = savaariRouteSlug(rt.to);
            const url = `https://www.savaari.com/${from}/${from}-to-${to}-cabs`;
            const r = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 3e4 });
            if (r.status === 404) return [];
            if (r.status !== 200) throw new AcquisitionError(r.status === 403 || r.status === 429 ? "ACCESS_CHALLENGE" : "SERVER_ERROR", `Savaari HTTP ${r.status}`, r.status);
            const items = parseSavaariCabs(r.body, ctx.source, url, rt.from, rt.to);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", "Savaari route page carried no parseable fares");
            return items;
          }
        },
        {
          // QuickRide (direct operator): static outstation fare table
          sourceId: "w_cab_quickride",
          name: "Cab worker: QuickRide outstation fare table",
          priority: 6,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || "");
            const rt = routeFromQuery2(raw);
            if (!rt) return [];
            const url = "https://quickride.in/outstation-taxi.php";
            const r = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 3e4 });
            if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `QuickRide HTTP ${r.status}`, r.status);
            const items = parseQuickRideCabs(r.body, ctx.source, url, rt.from, rt.to);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", `QuickRide fare table has no row for ${rt.from} to ${rt.to}`);
            return items;
          }
        },
        {
          sourceId: "w_cab_osrm",
          name: "Cab worker: OSRM real-distance fare estimate",
          priority: 10,
          maxPerMinute: 10,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || "");
            const rt = routeFromQuery2(raw);
            if (!rt) return [];
            const ratePerKm = Number(ctx.source.config?.ratePerKm) || 18;
            const fetchRoute = async (lon1, lat1, lon2, lat2) => {
              const r = await ctx.fetch(`https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`, { expectJson: true });
              if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `OSRM HTTP ${r.status}`, r.status);
              let j;
              try {
                j = JSON.parse(r.body);
              } catch {
                throw new AcquisitionError("MALFORMED_RESPONSE", "OSRM non-JSON");
              }
              const route = j?.routes?.[0];
              if (!route) throw new AcquisitionError("NOT_FOUND", "OSRM found no route between the points");
              return { distanceM: Number(route.distance), durationS: Number(route.duration) };
            };
            return buildCabEstimate(ctx.source, rt.from, rt.to, ctx.query.travelDates?.depart, fetchRoute, ratePerKm, "https://router.project-osrm.org/");
          }
        }
      ]
    };
    registerVerticalWorker(cabWorker);
  }
});

// server/workers/parsers/bankbazaarInsurance.ts
function parseBankBazaarInsurance(html, source, pageUrl, insType) {
  const $ = cheerio4.load(html);
  const fingerprint = (0, import_crypto8.createHash)("sha256").update(html.slice(0, 5e4)).digest("hex");
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  $("table").each((_, table) => {
    const rows = $(table).find("tr").toArray().map((tr) => $(tr).find("th,td").toArray().map((c) => $(c).text().replace(/\s+/g, " ").trim()));
    if (rows.length < 3) return;
    const header = rows[0].map((h) => h.toLowerCase());
    const insIdx = header.findIndex((h) => /insur|company|provider|bank/.test(h));
    const csrIdx = header.findIndex((h) => /claim settlement|csr/.test(h));
    if (insIdx < 0 || csrIdx < 0) return;
    const planIdx = header.findIndex((h) => /plan|term plan|policy/.test(h));
    const extraIdx = header.findIndex((h) => /garage|hospital/.test(h));
    for (const r of rows.slice(1)) {
      const insurer = (r[insIdx] || "").trim();
      if (!insurer) continue;
      const key = `${insType}:${insurer}`;
      if (seen.has(key)) continue;
      const csrMatch = (r[csrIdx] || "").match(/(\d{1,3}(?:\.\d+)?)\s*%/);
      if (!csrMatch) continue;
      seen.add(key);
      const plan = planIdx >= 0 ? (r[planIdx] || "").trim() : "";
      const extra = extraIdx >= 0 ? (r[extraIdx] || "").trim() : "";
      out.push(newRawItem(source, {
        title: (plan ? `${insurer} \u2014 ${plan}` : `${insurer} ${insType}`).slice(0, 200),
        seller: "BankBazaar",
        sellerUrl: pageUrl,
        currency: "INR",
        price: Number(csrMatch[1]),
        // CSR % — the comparable metric users rank insurers by
        attributes: {
          insurance_type: insType,
          claim_settlement_ratio: csrMatch[1],
          ...extra ? { network: extra.slice(0, 80) } : {},
          quote_type: "indicative",
          data_note: "CSR and network data from BankBazaar insurer tables; personalized premiums need insurer quote flow"
        },
        evidence: {
          sourceUrl: pageUrl,
          sourceReference: key,
          rawFingerprint: fingerprint,
          extractedFields: ["insurer", ...plan ? ["plan"] : [], "claim_settlement_ratio", ...extra ? ["network"] : []]
        }
      }));
    }
  });
  return out.slice(0, 30);
}
var import_crypto8, cheerio4;
var init_bankbazaarInsurance = __esm({
  "server/workers/parsers/bankbazaarInsurance.ts"() {
    import_crypto8 = require("crypto");
    cheerio4 = __toESM(require("cheerio"), 1);
    init_contract();
  }
});

// server/workers/verticals/insurance.ts
function insurerPageTask(cfg) {
  return {
    sourceId: cfg.sourceId,
    name: `Insurance worker: ${cfg.seller} published plan page`,
    priority: 20,
    run: async (ctx) => {
      const r = await ctx.fetch(cfg.url);
      if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `${cfg.seller} HTTP ${r.status}`, r.status);
      const text = r.body.replace(/<[^>]+>/g, " ");
      const sumM = /(?:sum insured[^₹]{0,60}?₹\s*[\d,\.]+\s*(?:lakh|lakhs|crore)[^₹]{0,60}?₹\s*[\d,\.]+\s*(?:lakh|lakhs|crore))|(?:₹|rs\.?\s?)?\d[\d,\.]{0,11}\s*(?:lakh|lakhs|crore)\s*(?:to|-|–)\s*(?:₹|rs\.?\s?)?[\d,\.]{0,11}\s*(?:lakh|lakhs|crore)/i.exec(text);
      const premM = /(?:premium[^₹₨]{0,60}?|starting\s*(?:at|from)|@)\s*[₹₨]?\s*\d[\d,]*(?:\.\d+)?\s*(?:per\s*(?:month|year|annum|day)|\/\s*(?:month|year|day)|p\.?a\.?)/i.exec(text);
      const facts = {
        sumInsured: sumM ? sumM[0].trim() : void 0,
        startingPremium: premM ? premM[0].trim() : void 0
      };
      if (!facts.sumInsured && !facts.startingPremium) throw new AcquisitionError("EMPTY_RESPONSE", `${cfg.seller} page carried no publishable plan facts`);
      return [buildRateOffer(ctx.source, {
        seller: cfg.seller,
        sellerUrl: cfg.url,
        pageUrl: cfg.url,
        insuranceType: "health insurance",
        planName: cfg.planName,
        facts,
        evidenceNote: `Plan terms as published on ${cfg.seller}'s own page, observed ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}; real premiums depend on age, city and medical history`
      })];
    }
  };
}
var INSURER_PAGES, PAGES2, insuranceWorker;
var init_insurance = __esm({
  "server/workers/verticals/insurance.ts"() {
    init_verticalWorker();
    init_bankbazaarInsurance();
    init_publishedRates();
    init_httpClient();
    init_curlCffiFetch();
    INSURER_PAGES = [
      { sourceId: "w_insurance_policybazaar", seller: "Policybazaar", url: "https://www.policybazaar.com/health-insurance/", planName: "Policybazaar health plans" },
      { sourceId: "w_insurance_acko", seller: "Acko", url: "https://www.acko.com/health-insurance/", planName: "Acko health plans" },
      { sourceId: "w_insurance_digit", seller: "Digit", url: "https://www.godigit.com/health-insurance", planName: "Digit health plans" },
      { sourceId: "w_insurance_hdfcergo", seller: "HDFC Ergo", url: "https://www.hdfcergo.com/health-insurance", planName: "HDFC Ergo health plans" },
      { sourceId: "w_insurance_insurancedekho", seller: "InsuranceDekho", url: "https://www.insurancedekho.com/health-insurance", planName: "InsuranceDekho health plans" }
    ];
    PAGES2 = [
      { type: "term life insurance", re: /term|life cover/i, url: "https://www.bankbazaar.com/insurance/term-insurance.html" },
      { type: "health insurance", re: /health|medical/i, url: "https://www.bankbazaar.com/insurance/health-insurance.html" },
      { type: "car insurance", re: /car|motor|four[- ]wheeler/i, url: "https://www.bankbazaar.com/car-insurance.html" },
      { type: "insurance", re: /./, url: "https://www.bankbazaar.com/insurance/health-insurance.html" }
    ];
    insuranceWorker = {
      vertical: "insurance",
      tasks: [
        {
          sourceId: "w_insurance_bankbazaar",
          name: "Insurance worker: BankBazaar insurer tables (CSR)",
          priority: 10,
          run: async (ctx) => {
            const text = `${ctx.query.rawQuery || ""} ${ctx.query.entityName || ""}`;
            const page = PAGES2.find((p) => p.re.test(text)) || PAGES2[PAGES2.length - 1];
            const r = await ctx.fetch(page.url);
            if (r.status !== 200) throw new AcquisitionError("FORBIDDEN", `BankBazaar HTTP ${r.status}`, r.status);
            const items = parseBankBazaarInsurance(r.body, ctx.source, page.url, page.type);
            if (!items.length && looksLikeChallenge(r.body)) throw new AcquisitionError("ACCESS_CHALLENGE", "BankBazaar presented a challenge page");
            return items;
          }
        },
        ...INSURER_PAGES.map(insurerPageTask),
        // ---- Owner-mandated insurance sources: attempted live, honestly reported ----
        {
          sourceId: "w_insurance_ditto",
          name: "Insurance worker: Ditto (probe)",
          priority: 21,
          run: async () => {
            const r = await cffiFetch("https://www.getditto.com/", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError("ACCESS_CHALLENGE", `Ditto (dittoinsurance.com) is unreachable to our acquisition hosts: ${r.status === 200 ? "page renders but plan quotes require an interactive adviser session" : `HTTP ${r.status}`}.`);
          }
        },
        {
          sourceId: "w_insurance_coverfox",
          name: "Insurance worker: Coverfox (probe)",
          priority: 22,
          run: async () => {
            const r = await cffiFetch("https://www.coverfox.com/health-insurance/", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError(r.status === 403 ? "ACCESS_CHALLENGE" : "EMPTY_RESPONSE", `Coverfox serves HTTP ${r.status} to browserless HTTP; premium quotes require a sessioned quote flow.`);
          }
        }
      ]
    };
    registerVerticalWorker(insuranceWorker);
  }
});

// server/workers/parsers/blinkit.ts
function textOf(x) {
  return x && typeof x === "object" ? String(x.text ?? "") : typeof x === "string" ? x : "";
}
function rupees(s) {
  const m = String(s || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}
function parseBlinkit(rawBody, source, pageUrl, cityLabel, cap = 16) {
  let root;
  try {
    root = JSON.parse(rawBody);
  } catch {
    return [];
  }
  const snippets = root?.response?.snippets;
  if (!Array.isArray(snippets)) return [];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const sn of snippets) {
    const d = sn?.data;
    if (!d || !/product_card/.test(String(sn.widget_type || ""))) continue;
    const name = textOf(d.display_name) || textOf(d.name);
    if (!name) continue;
    const cart = d.atc_action?.add_to_cart?.cart_item;
    const price = Number(cart?.price) > 0 ? Number(cart.price) : rupees(textOf(d.normal_price));
    if (!price || price <= 0) continue;
    const mrpNum = Number(cart?.mrp);
    const mrp = mrpNum > price ? mrpNum : void 0;
    const pack = textOf(d.variant) || String(cart?.unit || "");
    const pid = String(d.product_id || d.identity?.id || "");
    const key = pid || `${name}|${pack}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const imageRaw = String(d.image?.url || cart?.image_url || "");
    const imageUrl = imageRaw ? imageRaw.replace(/^http:/, "https:") : "";
    const brand = textOf(d.brand_name) || void 0;
    const inventory = Number(d.inventory ?? cart?.inventory);
    const soldOut = d.is_sold_out === true || String(d.product_state || "") === "unavailable" || inventory === 0;
    out.push(newRawItem(source, {
      title: `${name}${pack ? ` (${pack})` : ""}`.slice(0, 200),
      brand,
      price,
      listPrice: mrp,
      currency: "INR",
      seller: "Blinkit",
      sellerUrl: `https://blinkit.com/s/?q=${encodeURIComponent(name)}`,
      availability: soldOut ? "out_of_stock" : "in_stock",
      location: { city: cityLabel },
      attributes: {
        platform: "Blinkit",
        ...pack ? { quantity: pack.slice(0, 60) } : {},
        ...imageUrl ? { image_url: imageUrl } : {},
        price_basis: `Blinkit price for ${cityLabel} (10-min delivery zone)`,
        data_note: "Price extracted from Blinkit search API (blinkit.com); final price at checkout may vary"
      },
      identifiers: pid ? { sku: pid, vendorProductId: String(d.merchant_id || "") || void 0 } : void 0,
      evidence: { sourceUrl: pageUrl, sourceReference: pid, extractedFields: ["name", "variant", "cart_item.price", "cart_item.mrp", "inventory", "image"] }
    }));
    if (out.length >= cap) break;
  }
  void now;
  return out;
}
var init_blinkit = __esm({
  "server/workers/parsers/blinkit.ts"() {
    init_contract();
  }
});

// server/workers/parsers/bigbasket.ts
function parseBigbasket(rawBody, source, pageUrl, cityLabel, cap = 16) {
  let root;
  try {
    root = JSON.parse(rawBody);
  } catch {
    return [];
  }
  const tabs = root?.tabs;
  if (!Array.isArray(tabs)) return [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const tab of tabs) {
    const products = tab?.product_info?.products;
    if (!Array.isArray(products)) continue;
    for (const p of products) {
      const name = String(p.desc || "").trim();
      if (!name) continue;
      const sp = num(p.pricing?.discount?.prim_price?.sp);
      if (!sp) continue;
      const mrp = num(p.pricing?.discount?.mrp);
      const pack = String(p.w || "").trim();
      const id = String(p.id || "");
      const key = id || `${name}|${pack}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const avail = p.availability?.avail_status === "001" && p.availability?.not_for_sale !== true;
      const img = String(p.images?.[0]?.l || p.images?.[0]?.m || p.images?.[0]?.s || "");
      const brand = String(p.brand?.name || "").trim() || void 0;
      const url = p.absolute_url ? `https://www.bigbasket.com${p.absolute_url}` : `https://www.bigbasket.com/ps/?q=${encodeURIComponent(name)}`;
      out.push(newRawItem(source, {
        title: `${name}${pack ? ` (${pack})` : ""}`.slice(0, 200),
        brand,
        price: sp,
        listPrice: mrp && mrp > sp ? mrp : void 0,
        currency: "INR",
        seller: "BigBasket",
        sellerUrl: url,
        availability: avail ? "in_stock" : "out_of_stock",
        location: { city: cityLabel },
        attributes: {
          platform: "BigBasket",
          ...pack ? { quantity: pack.slice(0, 60) } : {},
          ...img ? { image_url: img } : {},
          ...p.category?.tlc_name ? { category: String(p.category.tlc_name).slice(0, 80) } : {},
          price_basis: `BigBasket price for ${cityLabel} (slotted delivery zone)`,
          data_note: "Price extracted from BigBasket listing API (bigbasket.com); final price at checkout may vary"
        },
        identifiers: id ? { sku: id, ...p.ean_code ? { gtin: String(p.ean_code) } : {} } : void 0,
        evidence: { sourceUrl: pageUrl, sourceReference: id, extractedFields: ["desc", "w", "pricing.discount.prim_price.sp", "pricing.discount.mrp", "availability.avail_status", "images[0].l"] }
      }));
      if (out.length >= cap) return out;
    }
  }
  return out;
}
var num;
var init_bigbasket = __esm({
  "server/workers/parsers/bigbasket.ts"() {
    init_contract();
    num = (v) => {
      const n = Number(String(v ?? "").replace(/,/g, ""));
      return Number.isFinite(n) && n > 0 ? n : null;
    };
  }
});

// server/workers/verticals/grocery.ts
function imRupees(m) {
  if (!m || typeof m !== "object") return void 0;
  const units = Number(m.units);
  if (!Number.isFinite(units)) return void 0;
  const nanos = Number(m.nanos) || 0;
  return Math.round((units + nanos / 1e9) * 100) / 100;
}
function collectImProducts(node, out, depth = 0) {
  if (!node || depth > 20 || out.length > 2500) return;
  if (Array.isArray(node)) {
    for (const v of node) collectImProducts(v, out, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const looksLikeProduct = typeof node.displayName === "string" && Array.isArray(node.variations) && node.variations.length > 0;
  if (looksLikeProduct) out.push(node);
  for (const v of Object.values(node)) collectImProducts(v, out, depth + 1);
}
function extractImLayouts(body) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  const re = /swiggy:\/\/stores\/instamart\/(campaign-collection\/listing|campaign-collection\/mxn|category)[^"\\]{0,160}?layoutId=(\d+)/g;
  for (const m of body.matchAll(re)) {
    const id = m[2];
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, endpoint: m[1].includes("listing") ? "campaign/listing/v2" : "layout/v2" });
  }
  return out;
}
function imTokenize(term) {
  return term.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length >= 2 && !["the", "and"].includes(t));
}
function buildImItems(products, term, cityLabel, sourceUrl, cap) {
  const tokens = imTokenize(term);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const scored = [];
  for (const p of products) {
    const v = (p.variations || [])[0] || {};
    const price = imRupees(v.price?.offerPrice) ?? imRupees(v.price?.mrp);
    if (price == null || price <= 0) continue;
    const mrp = imRupees(v.price?.mrp);
    const name = String(p.displayName || "");
    if (!name) continue;
    const hay = `${name} ${p.brand || ""} ${p.category || ""}`.toLowerCase();
    let score = 0;
    for (const t of tokens) if (hay.includes(t) || t.endsWith("s") && hay.includes(t.slice(0, -1))) score++;
    if (score === 0) continue;
    if (tokens.length > 1 && score < tokens.length) score -= 0.5;
    const imageId = (v.imageIds || [])[0];
    const imageUrl = imageId ? `https://media-assets.swiggy.com/swiggy/image/upload/${imageId}` : void 0;
    const inStock = p.inStock === true && p.isAvail !== false;
    const item = {
      title: `${name}${v.quantityDescription ? ` (${v.quantityDescription})` : ""}`,
      price,
      listPrice: mrp && mrp > price ? mrp : void 0,
      brand: p.brand ? String(p.brand).slice(0, 120) : void 0,
      identifiers: v.skuId ? { sku: v.skuId, vendorProductId: v.spinId || void 0 } : void 0,
      attributes: {
        platform: "Swiggy Instamart",
        ...v.quantityDescription ? { quantity: v.quantityDescription.slice(0, 60) } : {},
        ...p.category ? { category: String(p.category).slice(0, 80) } : {},
        ...imageUrl ? { image_url: imageUrl } : {},
        price_basis: `Instamart offer price for ${cityLabel} (10-min delivery zone)`,
        data_note: "Price extracted from Swiggy Instamart storefront APIs (instamart.swiggy.com); final price at checkout may vary"
      },
      seller: "Swiggy Instamart",
      sellerUrl: `${IM_BASE}/instamart/search?query=${encodeURIComponent(name)}`,
      availability: inStock ? "in_stock" : "out_of_stock",
      location: { city: cityLabel },
      evidence: {
        sourceUrl,
        sourceReference: v.skuId,
        extractedFields: ["displayName", "variations[0].price.offerPrice", "variations[0].price.mrp", "inStock"]
      },
      fetchedAt: now
    };
    scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score || a.item.price - b.item.price);
  const seenNames = /* @__PURE__ */ new Set();
  const out = [];
  for (const { item } of scored) {
    const key = item.title.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    out.push({ ...item, sourceId: "w_grocery_instamart" });
    if (out.length >= cap) break;
  }
  return out;
}
var GCITY_COORDS, q2, QUICK_FAILS, IM_BASE, IM_HEADERS, groceryWorker;
var init_grocery = __esm({
  "server/workers/verticals/grocery.ts"() {
    init_verticalWorker();
    init_amazonIn();
    init_flipkart();
    init_blinkit();
    init_bigbasket();
    init_httpClient();
    init_curlCffiFetch();
    GCITY_COORDS = {
      "new delhi": [28.6315, 77.2167],
      delhi: [28.6315, 77.2167],
      noida: [28.5355, 77.391],
      gurgaon: [28.4595, 77.0266],
      bengaluru: [12.9716, 77.5946],
      bangalore: [12.9716, 77.5946],
      mumbai: [19.076, 72.8777],
      pune: [18.5204, 73.8567],
      hyderabad: [17.385, 78.4867],
      chennai: [13.0827, 80.2707],
      kolkata: [22.5726, 88.3639],
      ahmedabad: [23.0225, 72.5714],
      jaipur: [26.9124, 75.7873],
      lucknow: [26.8467, 80.9462],
      indore: [22.7196, 75.8577],
      chandigarh: [30.7333, 76.7794],
      kochi: [9.9312, 76.2673],
      nagpur: [21.1458, 79.0882]
    };
    q2 = (ctx) => String(ctx.query.entityName || ctx.query.rawQuery || "").replace(/\b(grocery|quick|10 min|instant|order|buy)\b/gi, " ").replace(/\s+/g, " ").trim();
    QUICK_FAILS = [
      { sourceId: "w_grocery_zepto", url: (t) => `https://www.zeptonow.com/search?query=${encodeURIComponent(t)}`, probe: "https://www.zeptonow.com/", note: "Zeptonow returns a 202 JS challenge shell to browserless HTTP" },
      { sourceId: "w_grocery_flipkart_minutes", url: (t) => `https://www.flipkart.com/minutes-store`, probe: "https://www.flipkart.com/minutes-store", note: "Flipkart Minutes store is a JS shell with no SSR product prices" }
    ];
    IM_BASE = "https://instamart.swiggy.com";
    IM_HEADERS = {
      Accept: "application/json",
      Origin: IM_BASE,
      Referer: IM_BASE + "/"
    };
    groceryWorker = {
      vertical: "grocery",
      tasks: [
        ...QUICK_FAILS.map((src2) => ({
          // Owner-mandated quick-commerce sources: ATTEMPTED on every grocery search,
          // honestly reported as unavailable when the edge gate blocks browserless HTTP.
          sourceId: src2.sourceId,
          priority: 15,
          run: async (ctx) => {
            const term = q2(ctx);
            if (!term) return [];
            const r = await cffiFetch(src2.probe, { impersonate: "chrome", timeoutMs: 12e3 });
            const gated = r.status === 202 || r.status === 403 || r.status === 200 && /challenge|captcha/i.test(r.body.slice(0, 4e3)) && !/__NEXT_DATA__/.test(r.body);
            if (gated) throw new AcquisitionError("ACCESS_CHALLENGE", src2.note);
            throw new AcquisitionError("EMPTY_RESPONSE", src2.note.replace(/returns|serves/, "served"));
          }
        })),
        {
          // Blinkit LIVE: /v1/layout/search answers real JSON to browserless HTTP when sent with the
          // web-app headers (app_client=consumer_web + lat/lon). Server-side search, location-aware prices.
          sourceId: "w_grocery_blinkit",
          name: "Grocery worker: Blinkit search API",
          priority: 14,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const term = q2(ctx);
            if (!term) return [];
            const loc = ctx.query.location || {};
            const coords = typeof loc.lat === "number" && typeof loc.lng === "number" && loc.lat ? [loc.lat, loc.lng] : GCITY_COORDS[String(loc.city || "").toLowerCase()] || GCITY_COORDS["mumbai"];
            const cityLabel = loc.city ? String(loc.city) : "Mumbai";
            const [lat, lng] = coords;
            const url = `https://blinkit.com/v1/layout/search?q=${encodeURIComponent(term)}&search_type=type_to_search`;
            const blHeaders = {
              app_client: "consumer_web",
              lat: String(lat),
              lon: String(lng),
              Accept: "application/json",
              "Content-Type": "application/json",
              Origin: "https://blinkit.com",
              Referer: `https://blinkit.com/s/?q=${encodeURIComponent(term)}`
            };
            let r = { status: 0, body: "" };
            for (const profile of ["chrome", "safari17_0", "chrome110"]) {
              r = await cffiFetch(url, { impersonate: profile, method: "POST", body: "{}", timeoutMs: 22e3, headers: blHeaders });
              if (r.status === 200 && r.body) break;
            }
            if (r.status === 403 || r.status === 202) throw new AcquisitionError("ACCESS_CHALLENGE", `Blinkit search API HTTP ${r.status} (tried 3 TLS fingerprints)`);
            if (r.status !== 200 || !r.body) throw new AcquisitionError("SERVER_ERROR", `Blinkit search API HTTP ${r.status}`, r.status);
            const items = parseBlinkit(r.body, ctx.source, url, cityLabel, 16);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", `Blinkit returned no products for "${term}" at ${cityLabel} (not serviceable or no match)`);
            return items;
          }
        },
        {
          // BigBasket LIVE: listing-svc answers real JSON once the session carries location cookies.
          // Handshake (3 calls, same cookie jar): homepage -> serviceable(lat,lng) -> listing-svc.
          sourceId: "w_grocery_bigbasket",
          name: "Grocery worker: BigBasket listing API",
          priority: 13,
          timeoutMs: 6e4,
          run: async (ctx) => {
            const term = q2(ctx);
            if (!term) return [];
            const loc = ctx.query.location || {};
            const coords = typeof loc.lat === "number" && typeof loc.lng === "number" && loc.lat ? [loc.lat, loc.lng] : GCITY_COORDS[String(loc.city || "").toLowerCase()] || GCITY_COORDS["mumbai"];
            const cityLabel = loc.city ? String(loc.city) : "Mumbai";
            const [lat, lng] = coords;
            const BB = "https://www.bigbasket.com";
            const baseHeaders = {
              Accept: "application/json",
              "x-channel": "BB-WEB",
              "x-entry-context": "bb-b2c",
              "x-entry-context-id": "100",
              Origin: BB,
              Referer: `${BB}/ps/?q=${encodeURIComponent(term)}`
            };
            const home = await cffiFetch(`${BB}/`, { impersonate: "chrome", timeoutMs: 2e4, returnCookies: true });
            if (home.status !== 200 || !home.cookies) throw new AcquisitionError("ACCESS_CHALLENGE", `BigBasket homepage HTTP ${home.status}`);
            const svUrl = `${BB}/ui-svc/v1/serviceable/?lat=${lat}&lng=${lng}&send_all_serviceability=true`;
            const sv = await cffiFetch(svUrl, { impersonate: "chrome", headers: baseHeaders, timeoutMs: 15e3, cookies: home.cookies, returnCookies: true });
            let pi = {};
            try {
              pi = JSON.parse(sv.body).places_info || {};
            } catch {
            }
            const area = String(pi.area || cityLabel);
            const pincode = String(pi.pincode || "");
            const addrCookie = `${pi.lat ?? lat}_${pi.lng ?? lng}_${area}_${pincode}_1_false_true_true_Express`;
            const listingUrl = `${BB}/listing-svc/v2/products?type=ps&slug=${encodeURIComponent(term)}&page=1`;
            const r = await cffiFetch(listingUrl, {
              impersonate: "chrome",
              timeoutMs: 25e3,
              headers: { ...baseHeaders, "x-latitude": String(pi.lat ?? lat), "x-longitude": String(pi.lng ?? lng) },
              cookies: { ...sv.cookies, _bb_addressinfo: addrCookie, _bb_pin_code: pincode, _bb_lat_long: Buffer.from(`${lat}|${lng}`).toString("base64") }
            });
            if (r.status === 403) throw new AcquisitionError("ACCESS_CHALLENGE", `BigBasket listing API HTTP 403 (Akamai)`);
            if (r.status === 400) throw new AcquisitionError("EMPTY_RESPONSE", `BigBasket listing API rejected the location handshake (HTTP 400)`);
            if (r.status !== 200 || !r.body) throw new AcquisitionError("SERVER_ERROR", `BigBasket listing API HTTP ${r.status}`, r.status);
            const items = parseBigbasket(r.body, ctx.source, listingUrl, cityLabel, 16);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", `BigBasket returned no products for "${term}" at ${cityLabel}`);
            return items;
          }
        },
        {
          // Swiggy Instamart LIVE: ungated storefront endpoints (reverse-engineered from the
          // instamart web bundle). Search path is edge-gated, so we pull product grids
          // (home banners + Top Deals campaign) and filter client-side by the query.
          sourceId: "w_grocery_instamart",
          name: "Grocery worker: Swiggy Instamart storefront APIs",
          priority: 12,
          timeoutMs: 55e3,
          run: async (ctx) => {
            const term = q2(ctx);
            if (!term) return [];
            const loc = ctx.query.location || {};
            const coords = typeof loc.lat === "number" && typeof loc.lng === "number" && loc.lat ? [loc.lat, loc.lng] : GCITY_COORDS[String(loc.city || "").toLowerCase()] || GCITY_COORDS["mumbai"];
            const cityLabel = loc.city ? String(loc.city) : "Mumbai";
            const [lat, lng] = coords;
            const homeUrl = `${IM_BASE}/api/instamart/home/v2?clientId=INSTAMART-APP&lat=${lat}&lng=${lng}`;
            const home = await cffiFetch(homeUrl, { impersonate: "chrome", headers: IM_HEADERS, timeoutMs: 2e4 });
            if (home.status !== 200 || !home.body) throw new AcquisitionError("ACCESS_CHALLENGE", `Instamart home/v2 HTTP ${home.status}`);
            let storeId = "";
            const pod = home.body.match(/"podId":\s*"?(\d+)"?/) || home.body.match(/"storeId":\s*"?(\d+)"?/);
            if (pod) storeId = pod[1];
            const products = [];
            const sources2 = [homeUrl];
            const layouts = extractImLayouts(home.body).slice(0, 18);
            const calls = [{ endpoint: "campaign/listing/v2", id: "35019" }, ...layouts];
            for (const c of calls) {
              const url = c.endpoint === "layout/v2" ? `${IM_BASE}/api/instamart/layout/v2?layoutId=${c.id}&storeId=${storeId}&clusterId=&lat=${lat}&lng=${lng}&clientId=INSTAMART-APP` : `${IM_BASE}/api/instamart/campaign/listing/v2?layoutId=${c.id}&clientId=INSTAMART-APP&lat=${lat}&lng=${lng}`;
              try {
                const r = await cffiFetch(url, { impersonate: "chrome", headers: IM_HEADERS, timeoutMs: 15e3 });
                if (r.status !== 200 || !r.body) continue;
                let json;
                try {
                  json = JSON.parse(r.body);
                } catch {
                  continue;
                }
                const before = products.length;
                collectImProducts(json, products);
                if (products.length > before) sources2.push(url);
              } catch {
              }
              if (products.length > 1500) break;
            }
            const items = buildImItems(products, term, cityLabel, sources2[0], 12);
            if (!items.length) {
              const detail = `Instamart storefront grids carried ${products.length} products, none matching "${term}" (search endpoint is edge-gated; home storeId=${storeId || "n/a"})`;
              throw new AcquisitionError("EMPTY_RESPONSE", detail);
            }
            return items;
          }
        },
        {
          sourceId: "w_grocery_amazon_in",
          name: "Grocery worker: Amazon.in grocery listings",
          priority: 10,
          run: async (ctx) => {
            const term = q2(ctx);
            if (!term) return [];
            const url = `https://www.amazon.in/s?k=${encodeURIComponent(term)}`;
            let items = [];
            let lastBody = "";
            for (let attempt = 1; attempt <= 2; attempt++) {
              const r = await ctx.fetch(url);
              if (r.status === 200) {
                lastBody = r.body;
                items = parseAmazonIn(r.body, ctx.source, url);
                if (items.length) break;
              } else if (attempt === 1 && r.status >= 500) {
                await new Promise((res) => setTimeout(res, 1500));
                continue;
              } else {
                throw new AcquisitionError(r.status === 403 ? "ACCESS_CHALLENGE" : "FORBIDDEN", `Amazon.in HTTP ${r.status}`, r.status);
              }
            }
            if (!items.length && looksLikeChallenge(lastBody)) throw new AcquisitionError("ACCESS_CHALLENGE", "Amazon.in presented a challenge page");
            return items;
          }
        },
        {
          sourceId: "w_grocery_flipkart",
          name: "Grocery worker: Flipkart grocery listings",
          priority: 11,
          run: async (ctx) => {
            const term = q2(ctx);
            if (!term) return [];
            const url = `https://www.flipkart.com/search?q=${encodeURIComponent(term)}`;
            const r = await ctx.fetch(url);
            if (r.status !== 200) throw new AcquisitionError("FORBIDDEN", `Flipkart HTTP ${r.status}`, r.status);
            const items = parseFlipkart(r.body, ctx.source, url);
            if (!items.length && looksLikeChallenge(r.body)) throw new AcquisitionError("ACCESS_CHALLENGE", "Flipkart presented a challenge page");
            return items;
          }
        }
      ]
    };
    registerVerticalWorker(groceryWorker);
  }
});

// server/workers/parsers/wikidataMovies.ts
async function wikidataFetch(url, init) {
  const r = await fetch(url, { ...init, headers: { "User-Agent": WD_UA, Accept: "application/sparql-results+json, application/json", ...init?.headers } });
  if (!r.ok) throw new Error(`Wikidata HTTP ${r.status}`);
  return r.json();
}
function recentIndianFilms(days) {
  const to = /* @__PURE__ */ new Date();
  const from = new Date(Date.now() - days * 864e5);
  const f = from.toISOString().slice(0, 10);
  const t = to.toISOString().slice(0, 10);
  return `SELECT ?filmLabel ?date WHERE { ?film wdt:P31 wd:Q11424; wdt:P495 wd:Q668; wdt:P577 ?date. FILTER(?date >= "${f}"^^xsd:dateTime && ?date <= "${t}"^^xsd:dateTime) SERVICE wikibase:label { bd:serviceParam wikibase:language "en,hi". } } LIMIT 20`;
}
function parseRecentFilms(json, source, today) {
  const rows = json?.results?.bindings || [];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const b of rows) {
    const title = b.filmLabel?.value;
    const date = b.date?.value?.slice(0, 10);
    if (!title || seen.has(title)) continue;
    seen.add(title);
    out.push(newRawItem(source, {
      title: title.slice(0, 200),
      seller: "Wikidata (CC0)",
      sellerUrl: "https://www.wikidata.org/wiki/Q668",
      currency: "INR",
      travel: date ? { date } : void 0,
      attributes: {
        release_date: date || "unknown",
        data_note: "Recently released Indian film per Wikidata; showtimes & ticket prices need a booking platform (none accessible to public HTTP today)"
      },
      evidence: {
        sourceUrl: "https://query.wikidata.org/sparql",
        sourceReference: title,
        extractedFields: ["title", ...date ? ["release_date"] : []]
      }
    }));
  }
  return out.slice(0, 30);
}
async function searchFilmEntity(name, source) {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json&limit=5&type=item`;
  const json = await wikidataFetch(url);
  const hits = (json?.search || []).filter((h) => /film|movie|motion picture|cinema/i.test(h.description || ""));
  const out = [];
  for (const h of hits.slice(0, 5)) {
    out.push(newRawItem(source, {
      title: `${h.label}${h.description ? ` \u2014 ${h.description}` : ""}`.slice(0, 220),
      seller: "Wikidata (CC0)",
      sellerUrl: String(h.concepturi || ""),
      currency: "INR",
      attributes: {
        match: h.label,
        data_note: "Movie facts from Wikidata; showtimes & ticket prices need a booking platform"
      },
      evidence: {
        sourceUrl: "https://www.wikidata.org",
        sourceReference: h.id,
        extractedFields: ["title", "description"]
      }
    }));
  }
  return out;
}
var WD_UA;
var init_wikidataMovies = __esm({
  "server/workers/parsers/wikidataMovies.ts"() {
    init_contract();
    WD_UA = "Try1Second/1.0 (contact: standardpetro.in@gmail.com)";
  }
});

// server/acquisition/selfHeal.ts
function getHealSpec(sourceId) {
  return SPECS.find((s) => s.sourceId === sourceId);
}
function extractScriptSrcs(html) {
  const out = /* @__PURE__ */ new Set();
  const re = /<script[^>]+src=["']([^"']+)["']/g;
  let m;
  while (m = re.exec(html)) out.add(m[1]);
  return [...out];
}
function absolutize(src2, pageUrl) {
  if (/^https?:\/\//i.test(src2)) return src2;
  try {
    return new URL(src2, pageUrl).toString();
  } catch {
    return src2;
  }
}
async function collectCandidates(spec) {
  const notes = [];
  const candidates = [];
  const bundleUrls = /* @__PURE__ */ new Set();
  for (const page of spec.entryPages) {
    try {
      const r = await cffiFetch(page, { impersonate: "chrome", timeoutMs: 25e3 });
      if (r.status !== 200) {
        notes.push(`entry ${page} -> HTTP ${r.status}`);
        continue;
      }
      for (const s of extractScriptSrcs(r.body)) {
        const abs = absolutize(s, page);
        if (spec.bundleFilter.test(abs)) bundleUrls.add(abs);
      }
    } catch (e) {
      notes.push(`entry ${page} -> ${String(e?.message || e).slice(0, 80)}`);
    }
  }
  const bundles = [...bundleUrls].slice(0, spec.maxBundles ?? DEFAULTS.maxBundles);
  for (const b of bundles) {
    try {
      const r = await cffiFetch(b, { impersonate: "chrome", timeoutMs: 25e3 });
      if (r.status !== 200) {
        notes.push(`bundle ${b.slice(-60)} -> HTTP ${r.status}`);
        continue;
      }
      const text = r.body.length > (spec.maxBundleBytes ?? DEFAULTS.maxBundleBytes) ? r.body.slice(0, spec.maxBundleBytes ?? DEFAULTS.maxBundleBytes) : r.body;
      for (const rule of spec.rules) {
        const re = new RegExp(rule.pattern.source, "g");
        let m;
        while (m = re.exec(text)) {
          const raw = m[1];
          if (!raw) continue;
          const value = rule.normalize ? rule.normalize(raw) : raw;
          if (!value || value.length > 500) continue;
          candidates.push({ key: rule.key, value, bundleUrl: b, context: text.slice(Math.max(0, m.index - 30), m.index + 60).replace(/\s+/g, " ") });
          if (candidates.filter((c) => c.key === rule.key).length >= 12) break;
        }
      }
    } catch (e) {
      notes.push(`bundle ${b.slice(-60)} -> ${String(e?.message || e).slice(0, 80)}`);
    }
  }
  return { bundles, candidates, notes };
}
async function saveEndpointOverride(sourceId, key, value, evidenceUrl, bundleUrl) {
  const store2 = getStore();
  const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
  const upd = await store2.execute(
    "UPDATE source_endpoint_overrides SET value = ?, evidence_url = ?, bundle_url = ?, healed_at = ? WHERE source_id = ? AND rule_key = ?",
    [value.slice(0, 500), evidenceUrl.slice(0, 500), bundleUrl.slice(0, 500), now, sourceId, key]
  );
  if (!upd.affectedRows) {
    await store2.execute(
      "INSERT INTO source_endpoint_overrides (source_id, rule_key, value, evidence_url, bundle_url, healed_at) VALUES (?, ?, ?, ?, ?, ?)",
      [sourceId, key, value.slice(0, 500), evidenceUrl.slice(0, 500), bundleUrl.slice(0, 500), now]
    );
  }
}
async function getEndpointOverrides(sourceId) {
  const store2 = getStore();
  const rows = await store2.query(
    "SELECT rule_key, value, healed_at, bundle_url FROM source_endpoint_overrides WHERE source_id = ?",
    [sourceId]
  );
  const out = {};
  for (const r of rows) out[r.rule_key] = { value: String(r.value), healedAt: r.healed_at, bundle: r.bundle_url };
  return out;
}
async function getOverride(sourceId, key) {
  const hit = overrideCache.get(sourceId);
  const use = hit && Date.now() - hit.at < OVERRIDE_TTL_MS ? hit : null;
  if (use) return use.data[key]?.value ?? null;
  const full = await getEndpointOverrides(sourceId);
  const data = {};
  for (const [k, v] of Object.entries(full)) data[k] = { value: v.value };
  overrideCache.set(sourceId, { at: Date.now(), data });
  return data[key]?.value ?? null;
}
function invalidateOverrideCache(sourceId) {
  if (sourceId) overrideCache.delete(sourceId);
  else overrideCache.clear();
}
var DEFAULTS, SPECS, overrideCache, OVERRIDE_TTL_MS, DynamicScannerEngine, dynamicScannerEngine;
var init_selfHeal = __esm({
  "server/acquisition/selfHeal.ts"() {
    init_db();
    init_curlCffiFetch();
    init_logger();
    DEFAULTS = { maxBundles: 6, maxBundleBytes: 3e6 };
    SPECS = [
      {
        // BookMyShow (movies): the explore API base + discover path live as constants in the
        // site's webpack bundles (parser header documents modules 6161/74318).
        sourceId: "w_movies_bookmyshow",
        entryPages: ["https://in.bookmyshow.com/explore/movies-bengaluru"],
        // BMS ships webpack chunks under /public/build/chunks/js/ (runtime, vendor-*, app, common-code, app-explore-*).
        bundleFilter: /\/public\/build\/chunks\/js\/(?:app|common-code|app-explore)[^"']*\.js/i,
        maxBundles: 4,
        maxBundleBytes: 4e6,
        rules: [
          {
            // `${host}/api/explore` — the explore API path suffix composed with a per-env host map.
            key: "explore_api_path",
            pattern: /`\$\{[a-z]\}(\/api\/explore)`/
          },
          {
            // production host in the env map: {...,prod:"https://in.bookmyshow.com"}[env]
            key: "api_host",
            pattern: /(?:prod|production)\s*:\s*"(https:\/\/in\.bookmyshow\.com)"/
          }
        ]
      }
    ];
    overrideCache = /* @__PURE__ */ new Map();
    OVERRIDE_TTL_MS = 6e4;
    DynamicScannerEngine = class {
      /** Re-derives endpoints for a source from its public bundles and persists overrides. */
      async heal(sourceId) {
        const spec = getHealSpec(sourceId);
        const report = {
          sourceId,
          healed: false,
          at: (/* @__PURE__ */ new Date()).toISOString(),
          entryPages: spec?.entryPages ?? [],
          scannedBundles: [],
          overrides: [],
          notes: []
        };
        if (!spec) {
          report.notes.push("no healing spec registered for this source");
          return report;
        }
        const { bundles, candidates, notes } = await collectCandidates(spec);
        report.scannedBundles = bundles;
        report.notes.push(...notes);
        if (candidates.length === 0) {
          report.notes.push("no rule matched in scanned bundles");
          return report;
        }
        const existing = await getEndpointOverrides(sourceId);
        let healedAny = false;
        const byKey = /* @__PURE__ */ new Map();
        for (const c of candidates) {
          if (!byKey.has(c.key)) byKey.set(c.key, []);
          byKey.get(c.key).push(c);
        }
        for (const rule of spec.rules) {
          const cands = byKey.get(rule.key) || [];
          const winner = spec.pick?.(rule.key, cands) || cands[0];
          if (!winner) continue;
          let verified = false;
          const probe = rule.verifyGet ? rule.verifyGet(winner.value) : null;
          if (probe) {
            try {
              const r = await cffiFetch(probe, { impersonate: "chrome", timeoutMs: 2e4 });
              verified = r.status >= 200 && r.status < 404;
            } catch {
              verified = false;
            }
          } else {
            verified = true;
          }
          const old = existing[rule.key]?.value ?? null;
          if (old === winner.value) {
            report.overrides.push({ key: rule.key, oldValue: old, newValue: winner.value, verified });
            continue;
          }
          await saveEndpointOverride(sourceId, rule.key, winner.value, spec.entryPages[0], winner.bundleUrl);
          report.overrides.push({ key: rule.key, oldValue: old, newValue: winner.value, verified });
          healedAny = true;
          log.info("SelfHeal", `Healed ${sourceId}.${rule.key}: ${old ?? "(none)"} -> ${winner.value.slice(0, 80)} (verified=${verified})`);
        }
        invalidateOverrideCache(sourceId);
        report.healed = healedAny && report.overrides.some((o) => o.verified);
        return report;
      }
    };
    dynamicScannerEngine = new DynamicScannerEngine();
  }
});

// server/workers/parsers/bookmyshow.ts
function normCity(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
async function resolveBmsRegion(city, fetchJson) {
  const want = normCity(city || "");
  if (!regionsCache || Date.now() - regionsCache.at > 24 * 36e5) {
    const j = await fetchJson(REGIONS_URL);
    const all = [...j?.BookMyShow?.TopCities || [], ...j?.BookMyShow?.OtherCities || []];
    const regions = all.map((r) => ({
      regionCode: String(r.RegionCode || ""),
      regionSlug: String(r.RegionSlug || "").toLowerCase(),
      regionName: String(r.RegionName || "")
    })).filter((r) => r.regionCode && r.regionSlug);
    const aliases = /* @__PURE__ */ new Map();
    for (const r of regions) {
      aliases.set(normCity(r.regionName), r);
      const aliasRaw = Array.isArray(all.find((x) => x.RegionCode === r.regionCode)?.Alias) ? all.find((x) => x.RegionCode === r.regionCode).Alias : [];
      for (const a of aliasRaw) aliases.set(normCity(a), r);
    }
    regionsCache = { at: Date.now(), regions, aliases };
  }
  if (want) {
    const hit = regionsCache.aliases.get(want) || regionsCache.regions.find((r) => normCity(r.regionName).startsWith(want));
    if (hit) return hit;
  }
  return { regionCode: DEFAULT_REGION.regionCode, regionSlug: DEFAULT_REGION.regionSlug, regionName: DEFAULT_REGION.regionName };
}
async function cityFromMovieQuery(raw, fallback, fetchJson) {
  const cleaned = normCity(String(raw || "").replace(MOVIE_QUERY_NOISE, " ").replace(/[^a-z\s]/gi, " "));
  const tokens = cleaned.split(" ").filter(Boolean);
  if (tokens.length !== 1) return fallback;
  try {
    await resolveBmsRegion(fallback || tokens[0], fetchJson);
    if (regionsCache) {
      const r = regionsCache.aliases.get(tokens[0]);
      if (r) return r.regionName;
    }
  } catch {
  }
  return fallback;
}
function extractMovieQuery(entity, cityTokens) {
  const clean = entity.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !cityTokens.includes(w) && !["movie", "movies", "tickets", "ticket", "show", "shows", "today", "now", "showing", "near", "in", "the", "latest", "current"].includes(w));
  return clean.join(" ");
}
function matchesQuery(title, query) {
  const toks = normCity(query).split(" ").filter((t) => t.length > 1 && !["in", "near", "movie", "movies", "tickets", "ticket", "show", "shows", "today", "now", "showing"].includes(t));
  if (!toks.length) return true;
  const hay = normCity(title);
  return toks.every((t) => hay.includes(t));
}
function bmsDiscoverUrl(region, healedBase) {
  const base = healedBase && /^https:\/\/in\.bookmyshow\.com\//.test(healedBase) ? healedBase.replace(/\/$/, "") : DISCOVER_BASE;
  return `${base}/movies-${region.regionSlug}?region=${encodeURIComponent(region.regionCode)}&embedded=true`;
}
function bmsDiscoverHeaders(region) {
  return {
    Accept: "application/json",
    "x-app-code": "WEB",
    "x-platform-code": "DESKTOP-WEB",
    "x-region-code": region.regionCode,
    "x-bms-id": "1"
  };
}
function parseMovieCards(payload, source, region, query, fingerprint) {
  const listings = Array.isArray(payload?.listings) ? payload.listings : [];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const L of listings) {
    for (const card of L?.cards || []) {
      const ctaUrl = String(card?.ctaUrl || "");
      if (!ctaUrl.startsWith("https://in.bookmyshow.com/movies/")) continue;
      const text = Array.isArray(card?.text) ? card.text : [];
      const title = String(text[0]?.components?.[0]?.text || "").trim();
      if (!title || title.length > 120) continue;
      const eventCode = String(card?.id || "");
      const key = eventCode || ctaUrl;
      if (seen.has(key)) continue;
      if (query && !matchesQuery(title, query)) continue;
      seen.add(key);
      const poster = String(card?.image?.url || "");
      const cert = String(text[1]?.components?.[0]?.text || "");
      const lang = String(text[2]?.components?.[0]?.text || "");
      out.push(newRawItem(source, {
        title: title.slice(0, 200),
        seller: "BookMyShow",
        sellerUrl: ctaUrl,
        // the deeplink goes ONLY to the price-owning platform (owner policy)
        availability: "in_stock",
        // now-showing in this region per BMS itself
        location: { city: region.regionName },
        attributes: {
          ...poster ? { image_url: poster } : {},
          ...cert ? { certification: cert } : {},
          ...lang ? { language: lang } : {},
          ...eventCode ? { event_code: eventCode } : {},
          movie_page_url: ctaUrl,
          platform: "BookMyShow"
        },
        evidence: {
          sourceUrl: bmsDiscoverUrl(region),
          sourceReference: eventCode || key,
          rawFingerprint: fingerprint,
          extractedFields: ["title", ...poster ? ["image"] : [], "deeplink", ...cert ? ["certification"] : [], ...lang ? ["language"] : []]
        }
      }));
    }
  }
  return out.slice(0, 40);
}
var REGIONS_URL, DISCOVER_BASE, DEFAULT_REGION, regionsCache, MOVIE_QUERY_NOISE;
var init_bookmyshow = __esm({
  "server/workers/parsers/bookmyshow.ts"() {
    init_contract();
    REGIONS_URL = "https://in.bmscdn.com/discovery-catalog/response-cache/regions.json";
    DISCOVER_BASE = "https://in.bookmyshow.com/api/explore/v1/discover";
    DEFAULT_REGION = { regionCode: "BANG", regionSlug: "bengaluru", regionName: "Bengaluru" };
    regionsCache = null;
    MOVIE_QUERY_NOISE = /\b(movie|movies|ticket|tickets|show|shows|showing|showtime|showtimes|today|tonight|now|near|me|latest|current|cinema|cinemas|this|weekend|book|buy|watch|bms|near\s+me)\b/gi;
  }
});

// server/workers/parsers/ticketnew.ts
function ticketnewCityKeys(city) {
  const c = (city || "").toLowerCase().trim().replace(/\s+/g, "-");
  if (!c) return [];
  return CITY_ALIASES2[c] || [c];
}
function ticketnewSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function parseTicketNewMoviesPage(body, cityKey) {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(body);
  if (!m) return [];
  let d;
  try {
    d = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const serverState = d?.props?.pageProps?.data?.serverState;
  const running = serverState?.currentlyRunningMovies;
  const entry = running?.[cityKey] || Object.values(running || {})[0];
  const movies = entry?.data?.movies || [];
  return movies.filter((mv) => mv && typeof mv.name === "string" && mv.name.length > 0);
}
function parseTicketNewMovies(movies, source, cityKey, queryTerm) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const mv of movies.slice(0, 40)) {
    const title = String(mv.name || "").trim();
    if (!title) continue;
    if (queryTerm && !matchesQuery(title, queryTerm)) continue;
    const slug = ticketnewSlug(title);
    if (seen.has(slug)) continue;
    seen.add(slug);
    const attrs = {
      image_url: mv.appImgPath ? String(mv.appImgPath) : null,
      language: mv.lang || null,
      genres: Array.isArray(mv.grn) ? mv.grn.join(", ") : null,
      certification: mv.censor || null,
      duration_min: typeof mv.duration === "number" ? mv.duration : null,
      sessions_today: typeof mv.totalSessionCount === "number" ? mv.totalSessionCount : null,
      data_note: "Now-showing discovery from TicketNew; ticket price appears in the seat-selection flow"
    };
    out.push(newRawItem(source, {
      title,
      seller: "TicketNew",
      sellerUrl: slug ? `${TICKETNEW_BASE}/${cityKey}/movies/${slug}` : `${TICKETNEW_BASE}/movies/${cityKey}`,
      currency: "INR",
      attributes: attrs,
      evidence: {
        sourceUrl: `${TICKETNEW_BASE}/movies/${cityKey}`,
        sourceReference: String(mv.id || ""),
        extractedFields: ["title", "language", "genres", "certification", "duration", "sessions", "image"]
      }
    }));
  }
  return out;
}
var TICKETNEW_BASE, CITY_ALIASES2;
var init_ticketnew = __esm({
  "server/workers/parsers/ticketnew.ts"() {
    init_contract();
    init_bookmyshow();
    TICKETNEW_BASE = "https://www.ticketnew.com";
    CITY_ALIASES2 = {
      bengaluru: ["bengaluru", "bangalore"],
      bangalore: ["bangalore", "bengaluru"],
      mumbai: ["mumbai"],
      delhi: ["delhi", "new-delhi"],
      "new delhi": ["new-delhi", "delhi"],
      ncr: ["delhi", "ncr"],
      hyderabad: ["hyderabad"],
      chennai: ["chennai"],
      kolkata: ["kolkata"],
      pune: ["pune"],
      ahmedabad: ["ahmedabad"],
      kochi: ["kochi"],
      coimbatore: ["coimbatore"],
      madurai: ["madurai"],
      jaipur: ["jaipur"],
      lucknow: ["lucknow"]
    };
  }
});

// server/workers/parsers/cinepolis.ts
function parseCinepolisPage(body) {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(body);
  if (!m) return { nowPlaying: [], comingSoon: [] };
  let d;
  try {
    d = JSON.parse(m[1]);
  } catch {
    return { nowPlaying: [], comingSoon: [] };
  }
  const pp = d?.props?.pageProps || {};
  const clean = (arr) => Array.isArray(arr) ? arr.filter((mv) => mv && typeof mv.Title === "string" && mv.Title.length > 0) : [];
  const np = pp.nowPlayingMoviesData;
  const nowPlaying = np && typeof np === "object" && !Array.isArray(np) ? clean(Object.values(np)) : clean(np);
  return { nowPlaying, comingSoon: clean(pp.comingSoonMoviesData) };
}
function cinepolisDisplayTitle(title) {
  return title.replace(/\s*\((?:[A-Z]{2,8}(?:\s+WI\s+[A-Z]{2,8})?(?:\s+\([^)]*\))?(?:\s+\(\d+D\))?)?\)\s*$/i, "").trim() || title;
}
function parseCinepolisMovies(data, source, queryTerm) {
  const out = [];
  const groups = [
    { movies: data.nowPlaying, availability: "now_showing", note: "Now-showing discovery from Cinepolis India; ticket price appears in the seat-selection flow" },
    { movies: data.comingSoon, availability: "coming_soon", note: "Upcoming release listed by Cinepolis India; tickets open per the release date shown" }
  ];
  for (const g of groups) {
    for (const mv of g.movies.slice(0, 25)) {
      const rawTitle = String(mv.Title || "").trim();
      if (!rawTitle) continue;
      if (queryTerm && !matchesQuery(rawTitle, queryTerm)) continue;
      const display = cinepolisDisplayTitle(rawTitle);
      const img = mv.movie_image_url_1 || mv.movie_image_url_2;
      const release = mv.movie_release_date ? String(mv.movie_release_date).slice(0, 10) : null;
      const attrs = {
        image_url: img ? encodeURI(String(img)) : null,
        language: mv.movie_lang || null,
        genres: mv.m_movie_genre_name || null,
        duration_min: typeof mv.run_time === "number" ? mv.run_time : null,
        trailer_url: mv.movie_trailer && mv.movie_trailer !== "NA" ? mv.movie_trailer : null,
        release_date: release,
        availability: g.availability,
        data_note: g.note
      };
      out.push(newRawItem(source, {
        title: display,
        seller: "Cinepolis India",
        sellerUrl: CINEPOLIS_MOVIE_LIST_URL,
        // the site's own SSR-verified movie-list entry
        currency: "INR",
        attributes: attrs,
        evidence: {
          sourceUrl: CINEPOLIS_MOVIE_LIST_URL,
          sourceReference: mv.movie_id ? String(mv.movie_id) : "",
          extractedFields: ["title", "language", "genres", "duration", "release_date", "trailer", "image"]
        }
      }));
    }
  }
  return out;
}
var CINEPOLIS_BASE, CINEPOLIS_MOVIE_LIST_URL;
var init_cinepolis = __esm({
  "server/workers/parsers/cinepolis.ts"() {
    init_contract();
    init_bookmyshow();
    CINEPOLIS_BASE = "https://cinepolisindia.com";
    CINEPOLIS_MOVIE_LIST_URL = `${CINEPOLIS_BASE}/movie-list/undefined`;
  }
});

// server/workers/parsers/district.ts
function parseDistrictMovies(body) {
  const out = [];
  const re = /<script type="application\/ld\+json">(\{[\s\S]*?\})<\/script>/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    let d;
    try {
      d = JSON.parse(m[1]);
    } catch {
      continue;
    }
    if (d?.["@type"] !== "ItemList") continue;
    const items = Array.isArray(d.itemListElement) ? d.itemListElement : [];
    for (const it of items) {
      const name = typeof it?.name === "string" ? it.name.trim() : "";
      const url = typeof it?.url === "string" ? it.url.trim() : "";
      if (!name || !/^https:\/\/www\.district\.in\/movies\/.+/.test(url)) continue;
      out.push({ name, url, image: typeof it.image === "string" && it.image.startsWith("http") ? it.image : null });
    }
  }
  return out;
}
function parseDistrictOffers(movies, source, queryTerm) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const mv of movies.slice(0, 25)) {
    if (queryTerm && !matchesQuery(mv.name, queryTerm)) continue;
    const key = mv.url.split("/").pop() || mv.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const attrs = {
      image_url: mv.image,
      availability: "now_showing",
      data_note: "Now-showing discovery from District by Zomato (the merged Paytm Insider movies platform); ticket price appears in the District seat-selection flow"
    };
    out.push(newRawItem(source, {
      title: mv.name,
      seller: DISTRICT_SELLER,
      sellerUrl: mv.url,
      // the platform's own canonical web deeplink — web redirection works
      currency: "INR",
      attributes: attrs,
      evidence: {
        sourceUrl: DISTRICT_MOVIES_URL,
        sourceReference: key,
        extractedFields: ["title", "web_deeplink", "poster"]
      }
    }));
  }
  return out;
}
var DISTRICT_MOVIES_URL, DISTRICT_SELLER;
var init_district = __esm({
  "server/workers/parsers/district.ts"() {
    init_contract();
    init_bookmyshow();
    DISTRICT_MOVIES_URL = "https://www.district.in/movies/";
    DISTRICT_SELLER = "District by Zomato (Paytm)";
  }
});

// server/workers/verticals/movies.ts
async function fetchJsonNode(url) {
  const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(2e4) });
  if (!r.ok) throw new AcquisitionError("SERVER_ERROR", `regions fetch ${r.status}`);
  return r.json();
}
var import_node_crypto, recentCache, moviesWorker;
var init_movies = __esm({
  "server/workers/verticals/movies.ts"() {
    init_verticalWorker();
    init_wikidataMovies();
    init_httpClient();
    init_selfHeal();
    init_curlCffiFetch();
    init_bookmyshow();
    init_ticketnew();
    init_cinepolis();
    init_district();
    import_node_crypto = require("node:crypto");
    recentCache = null;
    moviesWorker = {
      vertical: "movies",
      tasks: [
        {
          sourceId: "w_movies_bookmyshow",
          name: "Movies worker: BookMyShow now-showing discovery (posters + deeplinks, city-aware)",
          priority: 1,
          maxPerMinute: 6,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || "").trim();
            const entity = String(ctx.query.entityName || "").trim();
            const typedCity = await cityFromMovieQuery(String(ctx.query.rawQuery || ""), ctx.query.location?.city, fetchJsonNode);
            const region = await resolveBmsRegion(typedCity, fetchJsonNode);
            const healedBase = await getOverride("w_movies_bookmyshow", "explore_api_path").then(async (pth) => {
              const host = await getOverride("w_movies_bookmyshow", "api_host");
              return pth && host ? `${host}${pth}/v1/discover` : null;
            }).catch(() => null);
            let res = await cffiFetch(bmsDiscoverUrl(region, healedBase), { headers: bmsDiscoverHeaders(region), timeoutMs: 25e3 });
            if ((res.status === 404 || res.status === 410) && !healedBase) {
              const rep = await dynamicScannerEngine.heal("w_movies_bookmyshow").catch(() => null);
              const fresh = rep?.healed ? await getOverride("w_movies_bookmyshow", "explore_api_path").then(async (pth) => {
                const host = await getOverride("w_movies_bookmyshow", "api_host");
                return pth && host ? `${host}${pth}/v1/discover` : null;
              }).catch(() => null) : null;
              if (fresh) res = await cffiFetch(bmsDiscoverUrl(region, fresh), { headers: bmsDiscoverHeaders(region), timeoutMs: 25e3 });
            }
            if (res.status === 403 || res.status === 429) {
              throw new AcquisitionError(res.status === 403 ? "FORBIDDEN" : "RATE_LIMITED", `BMS blocked: ${res.status}`, res.status);
            }
            if (res.status !== 200) throw new AcquisitionError("SERVER_ERROR", `BMS discovery ${res.status}`, res.status);
            const payload = JSON.parse(res.body);
            const stripTokens = (normCity(region.regionName) + " " + normCity(String(ctx.query.location?.city || ""))).split(" ").filter(Boolean);
            const queryTerm = entity ? extractMovieQuery(entity, stripTokens) : "";
            const fingerprint = (0, import_node_crypto.createHash)("sha256").update(res.body).digest("hex").slice(0, 16);
            return parseMovieCards(payload, ctx.source, region, queryTerm, fingerprint);
          }
        },
        {
          sourceId: "w_movies_ticketnew",
          name: "Movies worker: TicketNew now-showing (Next.js __NEXT_DATA__, city-aware)",
          priority: 8,
          maxPerMinute: 6,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const entity = String(ctx.query.entityName || "").trim();
            const city = await cityFromMovieQuery(String(ctx.query.rawQuery || ""), ctx.query.location?.city, fetchJsonNode) || "";
            const keys = ticketnewCityKeys(city);
            if (keys.length === 0) return [];
            const queryTerm = entity ? extractMovieQuery(entity, normCity(city).split(" ").filter(Boolean)) : "";
            let lastErr = null;
            for (const key of keys.slice(0, 2)) {
              try {
                const res = await cffiFetch(`${TICKETNEW_BASE}/movies/${key}`, { timeoutMs: 25e3 });
                if (res.status === 403 || res.status === 429) {
                  throw new AcquisitionError(res.status === 403 ? "FORBIDDEN" : "RATE_LIMITED", `TicketNew blocked: ${res.status}`, res.status);
                }
                if (res.status !== 200) {
                  lastErr = new Error(`TN listing ${res.status}`);
                  continue;
                }
                const movies = parseTicketNewMoviesPage(res.body, key);
                if (movies.length === 0) {
                  lastErr = new Error("no movies parsed");
                  continue;
                }
                return parseTicketNewMovies(movies, ctx.source, key, queryTerm);
              } catch (e) {
                lastErr = e;
                if (e instanceof AcquisitionError && (e.failureClass === "FORBIDDEN" || e.failureClass === "RATE_LIMITED")) throw e;
              }
            }
            if (lastErr instanceof AcquisitionError) throw lastErr;
            return [];
          }
        },
        {
          sourceId: "w_movies_cinepolis",
          name: "Movies worker: Cinepolis India listing (Next.js SSR __NEXT_DATA__, now-showing + coming-soon)",
          priority: 9,
          maxPerMinute: 6,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const entity = String(ctx.query.entityName || "").trim();
            const city = await cityFromMovieQuery(String(ctx.query.rawQuery || ""), ctx.query.location?.city, fetchJsonNode) || "";
            const queryTerm = entity ? extractMovieQuery(entity, normCity(city).split(" ").filter(Boolean)) : "";
            const res = await cffiFetch(CINEPOLIS_MOVIE_LIST_URL, { timeoutMs: 25e3 });
            if (res.status === 403 || res.status === 429) {
              throw new AcquisitionError(res.status === 403 ? "FORBIDDEN" : "RATE_LIMITED", `Cinepolis blocked: ${res.status}`, res.status);
            }
            if (res.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Cinepolis listing ${res.status}`, res.status);
            const data = parseCinepolisPage(res.body);
            if (data.nowPlaying.length === 0 && data.comingSoon.length === 0) {
              throw new AcquisitionError("EMPTY_RESPONSE", "Cinepolis page carried no parseable movies");
            }
            return parseCinepolisMovies(data, ctx.source, queryTerm);
          }
        },
        {
          sourceId: "w_movies_district",
          name: "Movies worker: District by Zomato / Paytm movies (schema.org JSON-LD ItemList, web deeplinks)",
          priority: 8,
          maxPerMinute: 6,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const entity = String(ctx.query.entityName || "").trim();
            const city = await cityFromMovieQuery(String(ctx.query.rawQuery || ""), ctx.query.location?.city, fetchJsonNode) || "";
            const queryTerm = entity ? extractMovieQuery(entity, normCity(city).split(" ").filter(Boolean)) : "";
            const res = await cffiFetch(DISTRICT_MOVIES_URL, { timeoutMs: 25e3 });
            if (res.status === 403 || res.status === 429) {
              throw new AcquisitionError(res.status === 403 ? "FORBIDDEN" : "RATE_LIMITED", `District blocked: ${res.status}`, res.status);
            }
            if (res.status !== 200) throw new AcquisitionError("SERVER_ERROR", `District movies page ${res.status}`, res.status);
            const movies = parseDistrictMovies(res.body);
            if (movies.length === 0) throw new AcquisitionError("EMPTY_RESPONSE", "District page carried no parseable JSON-LD movies");
            return parseDistrictOffers(movies, ctx.source, queryTerm);
          }
        },
        {
          sourceId: "w_movies_wikidata",
          name: "Movies worker: Wikidata film releases (India)",
          priority: 10,
          maxPerMinute: 8,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const entity = String(ctx.query.entityName || "").trim();
            const effCity = await cityFromMovieQuery(String(ctx.query.rawQuery || ""), ctx.query.location?.city, fetchJsonNode) || "";
            const cityToks = normCity(effCity).split(" ").filter(Boolean);
            const movieTerm = entity ? extractMovieQuery(entity, cityToks) : "";
            if (movieTerm) {
              const hits = await searchFilmEntity(movieTerm, ctx.source);
              const strict = hits.filter((h) => matchesQuery(String(h.attributes?.match || h.title), movieTerm));
              return strict;
            }
            if (!recentCache || Date.now() - recentCache.at > 30 * 6e4) {
              const json = await wikidataFetch("https://query.wikidata.org/sparql", {
                method: "POST",
                body: `query=${encodeURIComponent(recentIndianFilms(45))}`,
                headers: { "Content-Type": "application/x-www-form-urlencoded" }
              });
              recentCache = { at: Date.now(), rows: json };
            }
            return parseRecentFilms(recentCache.rows, ctx.source, (/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
          }
        }
      ]
    };
    registerVerticalWorker(moviesWorker);
  }
});

// server/workers/parsers/abhibus.ts
async function resolveAbhiBusCity(fetchJson, city) {
  const raw = String(city || "").trim();
  if (!raw) return null;
  const q3 = encodeURIComponent(raw.replace(/\s+/g, " ").slice(0, 40));
  const list = await fetchJson(`https://www.abhibus.com/wap/SearchStations?s=${q3}`);
  if (!Array.isArray(list) || !list.length) return null;
  const lower = raw.toLowerCase();
  const exact = list.find((s) => String(s.label || "").toLowerCase() === lower);
  const chosen = exact || list[0];
  return { id: String(chosen.id), label: String(chosen.label || raw) };
}
function parseAbhiBusServices(json, source, route) {
  let d;
  try {
    d = JSON.parse(json);
  } catch {
    return [];
  }
  const services = Array.isArray(d?.services) ? d.services : [];
  if (!services.length) return [];
  const fingerprint = (0, import_crypto9.createHash)("sha256").update(json.slice(0, 5e4)).digest("hex");
  const searchUrl = `https://www.abhibus.com/bus_search/${encodeURIComponent(route.fromName)}/${route.fromId}/${encodeURIComponent(route.toName)}/${route.toId}/${route.jdate}`;
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const s of services) {
    const fare = Number(s?.fares?.offerPrice) || Number(s?.fares?.fare);
    if (!fare || fare <= 0) continue;
    const key = String(s.serviceKey || s.serviceId || s.masterId || "");
    if (seen.has(key)) continue;
    seen.add(key);
    const operator = String(s.travelerAgentName || "").trim();
    const busType = String(s.busServiceTypeName || s.busTypeName || "").trim();
    const t = s.timings || {};
    const seats = Number(s?.seatStats?.availableSeats);
    const rating = Number(s.rating) > 0 ? String(s.rating) : void 0;
    out.push(newRawItem(source, {
      title: `${operator || "AbhiBus operator"} \xB7 ${busType}`.slice(0, 200),
      price: fare,
      currency: "INR",
      ...Number(s?.fares?.fare) > fare ? { listPrice: Number(s.fares.fare) } : {},
      seller: "AbhiBus",
      sellerUrl: searchUrl,
      availability: seats > 0 ? "in_stock" : "out_of_stock",
      travel: { route: `${route.fromName} \u2192 ${route.toName}`, date: route.jdate, seatType: busType || "unknown" },
      attributes: {
        operator: operator || "AbhiBus",
        ...t.startTime ? { departure: `${String(t.startTime)}${t.arriveTime ? ` \u2192 ${String(t.arriveTime)}` : ""}` } : {},
        ...t.travelTime ? { duration: `~${String(t.travelTime).slice(0, 8)} h` } : {},
        ...Number.isFinite(seats) ? { seats_available: String(seats) } : {},
        ...rating ? { rating } : {},
        ...s?.busInsights?.busThumbnailUrl && /^https:\/\//.test(s.busInsights.busThumbnailUrl) ? { image_url: s.busInsights.busThumbnailUrl } : {},
        platform: "AbhiBus",
        data_note: "Live fare and seats from AbhiBus public JSON API"
      },
      evidence: {
        sourceUrl: searchUrl,
        sourceReference: key || String(s.serviceId || ""),
        rawFingerprint: fingerprint,
        extractedFields: ["title", "price", "departure", "duration", ...rating ? ["rating"] : [], "availability"]
      }
    }));
  }
  return out.slice(0, 40);
}
var import_crypto9;
var init_abhibus = __esm({
  "server/workers/parsers/abhibus.ts"() {
    import_crypto9 = require("crypto");
    init_contract();
  }
});

// server/workers/parsers/redbusRoute.ts
function extractRedBusRouteInfo(html) {
  const field = (key) => {
    const m = new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`).exec(html);
    return m ? m[1] : null;
  };
  const num2 = (key) => {
    const m = new RegExp(`"${key}"\\s*:\\s*([0-9]+)`).exec(html);
    return m ? m[1] : null;
  };
  const minFare = field("minFare");
  const source = field("source");
  if (!minFare || !source) return null;
  return {
    source,
    destination: field("destination") || "",
    minFare,
    servicecount: Number(num2("servicecount")) || 0,
    operators: field("operators") || num2("operators") || "",
    avgDuration: field("avgDuration") || "",
    firstBus: field("firstBus") || "",
    lastBus: field("lastBus") || ""
  };
}
function parseRedBusRoute(html, source, pageUrl) {
  const info = extractRedBusRouteInfo(html);
  if (!info) return [];
  const fareM = /([\d,]+(?:\.\d{1,2})?)/.exec(info.minFare);
  const fare = fareM ? Math.round(Number(fareM[1].replace(/,/g, ""))) : null;
  if (!fare || fare <= 0) return [];
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const route = `${info.source} to ${info.destination}`.toLowerCase();
  return [newRawItem(source, {
    title: `${info.source} to ${info.destination} bus (lowest fare across ${info.servicecount || "all"} services)`,
    brand: "redBus",
    price: fare,
    currency: "INR",
    seller: "redBus",
    sellerUrl: pageUrl,
    travel: { route, seatType: "varies (seater/sleeper/AC)" },
    attributes: {
      route: `${info.source} to ${info.destination}`,
      min_fare: String(fare),
      service_count: String(info.servicecount),
      operator_count: info.operators,
      avg_duration: info.avgDuration,
      first_departure: info.firstBus,
      last_departure: info.lastBus,
      image: "",
      price_basis: `minimum route fare as published by redbus.in on ${today}`,
      data_note: `Route-level fare summary (min fare across ${info.servicecount} services from ${info.operators} operators) scraped from redbus.in on ${today}`
    },
    identifiers: { sku: `redbus-${route.replace(/\s+/g, "-")}` },
    evidence: { sourceUrl: pageUrl, extractedFields: ["dataInfo minFare", "servicecount", "operators", "avgDuration"] }
  })];
}
var init_redbusRoute = __esm({
  "server/workers/parsers/redbusRoute.ts"() {
    init_contract();
  }
});

// server/workers/verticals/bus.ts
function routeFromQuery3(raw) {
  const cleaned = raw.replace(/\b(bus|buses|volvo|sleeper|ticket|tickets|book|redbus|fare|price|for|travel)\b/gi, " ").replace(/\b(today|tonight|tomorrow|day after tomorrow|this week|this weekend|next week|next day)\b/gi, " ").replace(/\b(?:on|at)\s+(?:mon|tues?|wed(?:nes)?|thur?s?|fri|sat(?:ur)?|sun)day\b/gi, " ").replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi, " ").replace(/\b\d{4}-\d{2}-\d{2}\b/gi, " ").replace(/\s+/g, " ").trim();
  const m = cleaned.match(/(.{2,40}?)\s+(?:to|from)\s+(.{2,40})/);
  if (!m) return null;
  return { from: m[1].trim(), to: m[2].trim() };
}
var busWorker;
var init_bus = __esm({
  "server/workers/verticals/bus.ts"() {
    init_verticalWorker();
    init_osrmCab();
    init_httpClient();
    init_abhibus();
    init_redbusRoute();
    init_curlCffiFetch();
    busWorker = {
      vertical: "bus",
      tasks: [
        {
          // redBus route pages embed a live dataInfo JSON (min fare, service/operator counts)
          sourceId: "w_bus_redbus",
          name: "Bus worker: redBus route-level fare summary",
          priority: 5,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || "");
            const rt = routeFromQuery3(raw);
            if (!rt) return [];
            const slug = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-");
            const url = `https://www.redbus.in/bus-tickets/${slug(rt.from)}-to-${slug(rt.to)}.aspx`;
            const r = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 3e4 });
            if (r.status === 404) return [];
            if (r.status !== 200) throw new AcquisitionError(r.status === 403 || r.status === 429 ? "ACCESS_CHALLENGE" : "SERVER_ERROR", `redBus HTTP ${r.status}`, r.status);
            const items = parseRedBusRoute(r.body, ctx.source, url);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", "redBus route page carried no parseable dataInfo fare");
            return items;
          }
        },
        {
          // ---- Owner-mandated bus sources: attempted live on every bus search, honestly reported ----
          sourceId: "w_bus_makemytrip",
          name: "Bus worker: MakeMyTrip bus (probe)",
          priority: 15,
          run: async (ctx) => {
            await cffiFetch("https://bus.makemytrip.com/", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError("EMPTY_RESPONSE", "MakeMyTrip bus search serves an empty JS shell to browserless HTTP; live service lists require a sessioned app API (Akamai-gated elsewhere on makemytrip.com).");
          }
        },
        {
          sourceId: "w_bus_yatra",
          name: "Bus worker: Yatra bus (probe)",
          priority: 15,
          run: async () => {
            try {
              const r = await cffiFetch("https://www.yatra.com/bus-booking/delhi-to-jaipur-buses", { impersonate: "chrome", timeoutMs: 12e3 });
              const gated = r.status !== 200 || r.body.length < 5e3;
              throw new AcquisitionError(gated ? "ACCESS_CHALLENGE" : "EMPTY_RESPONSE", "Yatra bus pages fail/reset the HTTP/2 stream to browserless HTTP clients; no SSR fare data available.");
            } catch (e) {
              if (e instanceof AcquisitionError) throw e;
              throw new AcquisitionError("ACCESS_CHALLENGE", "Yatra bus pages fail/reset the HTTP/2 stream to browserless HTTP clients; no SSR fare data available.");
            }
          }
        },
        {
          sourceId: "w_bus_ixigo",
          name: "Bus worker: Ixigo bus (probe)",
          priority: 15,
          run: async () => {
            await cffiFetch("https://www.ixigo.com/", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError("EMPTY_RESPONSE", "Ixigo publishes no bus SSR pages at all (sitemap has flights only); its bus results render from an AbhiBus-sourced CSR shell with no server-side fares.");
          }
        },
        {
          // REAL operator fares. AbhiBus's internal JSON API answers plain HTTP:
          // /wap/SearchStations resolves city -> station id, /buslist/v3/services
          // returns live per-service fares, timings, bus type and seat counts.
          sourceId: "w_bus_abhibus",
          name: "Bus worker: AbhiBus live services (real fares, timings, seats)",
          priority: 1,
          maxPerMinute: 8,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || "");
            const rt = routeFromQuery3(raw);
            if (!rt) return [];
            const getJson = async (url) => {
              const r2 = await ctx.fetch(url, { expectJson: true, headers: { Accept: "application/json" } });
              if (r2.status !== 200) throw new AcquisitionError("FORBIDDEN", `AbhiBus HTTP ${r2.status} on ${url.split("?")[0]}`, r2.status);
              try {
                return JSON.parse(r2.body);
              } catch {
                throw new AcquisitionError("MALFORMED_RESPONSE", "AbhiBus non-JSON response");
              }
            };
            const [from, to] = await Promise.all([
              resolveAbhiBusCity(getJson, rt.from),
              resolveAbhiBusCity(getJson, rt.to)
            ]);
            if (!from || !to) throw new AcquisitionError("NOT_FOUND", `AbhiBus: could not resolve '${rt.from}'/'${rt.to}' as stations`);
            const depart = String(ctx.query.travelDates?.depart || "");
            const jdate = /^\d{4}-\d{2}-\d{2}$/.test(depart) ? depart : new Date(Date.now() + 864e5).toISOString().slice(0, 10);
            const route = { fromName: from.label, fromId: from.id, toName: to.label, toId: to.id, jdate };
            const r = await ctx.fetch("https://www.abhibus.com/buslist/v3/services", {
              method: "POST",
              expectJson: true,
              maxBytes: 6e6,
              timeoutMs: 2e4,
              headers: { Accept: "application/json", "Content-Type": "application/json" },
              body: JSON.stringify({
                source: from.label,
                sourceid: Number(from.id),
                destination: to.label,
                destinationid: Number(to.id),
                jdate,
                prd: "mobile",
                filters: "1",
                isReturnJourney: "0"
              })
            });
            if (r.status !== 200) throw new AcquisitionError("FORBIDDEN", `AbhiBus services HTTP ${r.status}`, r.status);
            return parseAbhiBusServices(r.body, ctx.source, route);
          }
        },
        {
          sourceId: "w_bus_osrm_estimate",
          name: "Bus worker: OSRM real-distance intercity estimate",
          priority: 10,
          maxPerMinute: 10,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || "");
            const rt = routeFromQuery3(raw);
            if (!rt) return [];
            const ratePerKm = Number(ctx.source.config?.ratePerKm) || 2.2;
            const fetchRoute = async (lon1, lat1, lon2, lat2) => {
              const r = await ctx.fetch(`https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`, { expectJson: true });
              if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `OSRM HTTP ${r.status}`, r.status);
              let j;
              try {
                j = JSON.parse(r.body);
              } catch {
                throw new AcquisitionError("MALFORMED_RESPONSE", "OSRM non-JSON");
              }
              const route = j?.routes?.[0];
              if (!route) throw new AcquisitionError("NOT_FOUND", "OSRM found no route between the points");
              return { distanceM: Number(route.distance), durationS: Number(route.duration) };
            };
            const items = await buildCabEstimate(ctx.source, rt.from, rt.to, ctx.query.travelDates?.depart, fetchRoute, ratePerKm, "https://router.project-osrm.org/");
            return items.map((i) => ({
              ...i,
              title: `Bus route ${rt.from} \u2192 ${rt.to}`,
              attributes: {
                ...i.attributes,
                vehicle_type: "intercity bus (indicative)",
                fare_type: "indicative_estimate",
                estimate_note: `Indicative bus fare = ${(i.attributes || {})["distance_km"]} km x \u20B9${ratePerKm}/km assumed rate. Live operator fares (RedBus etc.) block public HTTP today.`
              },
              travel: { ...i.travel, seatType: "unknown" }
            }));
          }
        }
      ]
    };
    registerVerticalWorker(busWorker);
  }
});

// server/workers/verticals/index.ts
var init_verticals = __esm({
  "server/workers/verticals/index.ts"() {
    init_ecommerce();
    init_loans();
    init_hotels();
    init_flights();
    init_food();
    init_cab();
    init_insurance();
    init_grocery();
    init_movies();
    init_bus();
    init_verticalWorker();
  }
});

// server/sources/registry.ts
var registry_exports = {};
__export(registry_exports, {
  getSource: () => getSource,
  getSources: () => getSources,
  loadSourcesFromDb: () => loadSourcesFromDb,
  selectSources: () => selectSources,
  sourcesStatusReport: () => sourcesStatusReport,
  updateSource: () => updateSource
});
function src(p) {
  return {
    enabled: false,
    // all sources start disabled until configured & verified — honest default
    priority: 100,
    config: {},
    rateLimit: { maxRequestsPerMinute: 20, maxConcurrency: 2 },
    freshnessPolicy: DEFAULT_FRESHNESS,
    adapterVersion: "1.0.0",
    parserVersion: "1.0.0",
    requiresAuthorization: false,
    permittedForRetention: true,
    ...p
  };
}
function workerSources() {
  const out = [];
  for (const w of allVerticalWorkers()) {
    for (const t of w.tasks) {
      out.push(src({
        id: t.sourceId,
        name: t.name || `${w.vertical} worker: ${t.sourceId}`,
        method: "direct_http",
        verticals: [w.vertical],
        priority: t.priority ?? 15,
        enabled: true,
        rateLimit: { maxRequestsPerMinute: t.maxPerMinute ?? 20, maxConcurrency: 2 },
        config: { worker: w.vertical }
      }));
    }
  }
  return out;
}
function seedSources() {
  return [
    // ---- Direct HTTP (legit public pages; subject to their ToS) ----
    // ---- Structured public feeds ----
    src({
      id: "structured_books",
      name: "Open Library / public structured data",
      method: "structured_data",
      verticals: ["ecommerce"],
      priority: 30,
      // Public structured endpoint, no credentials — verified working; auto-enabled.
      enabled: true,
      config: { baseUrl: "https://openlibrary.org/search.json?fields=title,author_name,isbn,first_publish_year,key&limit=20", schema: "openlibrary_search", paramMap: { query: "q" } },
      requiresAuthorization: false
    }),
    // ---- Affiliate feed (Cuelinks) ----
    src({
      id: "affiliate_cuelinks",
      name: "Cuelinks Affiliate Feed",
      method: "affiliate_feed",
      verticals: ["ecommerce", "coupons", "banking", "giftcards"],
      priority: 20,
      config: { apiKey: settings.cuelinks.apiKey, campaignId: settings.cuelinks.campaignId, subId: settings.cuelinks.subId },
      requiresAuthorization: true,
      // Credentials present → enabled; orchestrator records real outcomes (REQUEST_SUCCEEDED etc.)
      enabled: Boolean(settings.cuelinks.apiKey)
    }),
    // ---- Affiliate feed (VCommission) ----
    src({
      id: "affiliate_vcommission",
      name: "VCommission Affiliate Feed",
      method: "affiliate_feed",
      verticals: ["ecommerce", "coupons", "banking", "giftcards"],
      priority: 21,
      config: { apiKey: settings.vcommission.apiKey, baseUrl: settings.vcommission.baseUrl, schema: "vcommission_campaigns" },
      requiresAuthorization: true,
      // Credentials present → enabled; the feed was verified live (55 campaigns).
      enabled: Boolean(settings.vcommission.apiKey)
    }),
    // ---- Partner feed (placeholder until a partner grants access) ----
    src({
      id: "partner_generic",
      name: "Partner Feed (configure per partner)",
      method: "partner_feed",
      verticals: [],
      priority: 40,
      requiresAuthorization: true
    }),
    // ---- Official API (placeholders until authorized) ----
    src({
      id: "api_irctc",
      name: "IRCTC API (requires authorization)",
      method: "official_api",
      verticals: [],
      priority: 25,
      requiresAuthorization: true
    }),
    src({
      id: "api_bus",
      name: "Bus operator API (requires authorization)",
      method: "official_api",
      verticals: ["bus"],
      priority: 25,
      requiresAuthorization: true
    }),
    // ---- Vertical worker tasks (one worker per vertical; see server/workers/verticals) ----
    ...workerSources()
    // OPTIONAL search provider deliberately NOT seeded — Try1Second acquires
    // its own data (direct cURL → headless-browser fallback). Owner decision:
    // no SearchApi.io or any third-party search/marketplace API.
  ];
}
function getSources() {
  return sources;
}
function getSource(id) {
  return sources.find((s) => s.id === id);
}
async function loadSourcesFromDb() {
  try {
    const { getStore: getStore2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const store2 = getStore2();
    const rows = await store2.query("SELECT id, name, method, verticals, enabled, priority, config, rate_limit_pm, max_concurrency FROM source_adapters");
    for (const row of rows) {
      const existing = sources.find((s) => s.id === row.id);
      if (!existing) continue;
      existing.enabled = Boolean(row.enabled);
      existing.priority = Number(row.priority);
      if (row.config) {
        try {
          const cfg = typeof row.config === "string" ? JSON.parse(row.config) : row.config;
          existing.config = { ...existing.config, ...cfg };
        } catch {
        }
      }
      if (row.rate_limit_pm) existing.rateLimit.maxRequestsPerMinute = Number(row.rate_limit_pm);
      if (row.max_concurrency) existing.rateLimit.maxConcurrency = Number(row.max_concurrency);
    }
    return { loaded: rows.length, dbKind: store2.kind };
  } catch {
    return { loaded: 0, dbKind: "none" };
  }
}
function updateSource(id, patch) {
  const s = sources.find((x) => x.id === id);
  if (!s) return null;
  Object.assign(s, patch);
  void (async () => {
    try {
      const { getStore: getStore2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const store2 = getStore2();
      await store2.execute(
        `INSERT INTO source_adapters (id, name, method, verticals, enabled, priority, config, rate_limit_pm, max_concurrency)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE enabled=VALUES(enabled), priority=VALUES(priority), config=VALUES(config), rate_limit_pm=VALUES(rate_limit_pm), max_concurrency=VALUES(max_concurrency)`,
        [s.id, s.name, s.method, JSON.stringify(s.verticals), s.enabled ? 1 : 0, s.priority, JSON.stringify(s.config), s.rateLimit.maxRequestsPerMinute, s.rateLimit.maxConcurrency]
      );
    } catch {
    }
  })();
  return s;
}
function selectSources(query, opts = {}) {
  const vertical = query.vertical;
  const candidates = sources.filter((s) => {
    if (!s.enabled) return false;
    if (vertical && s.verticals.length > 0 && !s.verticals.includes(vertical)) return false;
    if (!canAttempt(s.id)) return false;
    if (s.requiresAuthorization && !s.config.apiKey && s.method !== "partner_feed") return false;
    return true;
  });
  const scored = candidates.map((s) => {
    const h = getHealth(s.id);
    let score = s.priority;
    if (h.state === "DEGRADED") score += 25;
    if (h.state === "UNVERIFIED") score += 10;
    if (s.method === "search_provider") score += 50;
    return { s, score };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored.map((x) => x.s);
}
function sourcesStatusReport() {
  return sources.map((s) => {
    const h = getHealth(s.id);
    return {
      id: s.id,
      name: s.name,
      method: s.method,
      verticals: s.verticals,
      enabled: s.enabled,
      health: h.state,
      lastSuccessAt: h.lastSuccessAt,
      lastFailureAt: h.lastFailureAt,
      lastFailureClass: h.lastFailureClass,
      totalAttempts: h.totalAttempts,
      totalSuccesses: h.totalSuccesses,
      // Honest classification (Section 23 Phase 9)
      classification: s.enabled ? h.state === "HEALTHY" ? "WORKING_AND_VERIFIED" : h.state === "CIRCUIT_OPEN" ? "PARTIALLY_WORKING" : h.totalSuccesses > 0 ? "PARTIALLY_WORKING" : "CONFIGURATION_REQUIRED" : s.requiresAuthorization && !s.config.apiKey ? "CONFIGURATION_REQUIRED" : "UNAVAILABLE"
    };
  });
}
var DEFAULT_FRESHNESS, sources;
var init_registry = __esm({
  "server/sources/registry.ts"() {
    init_settings();
    init_health();
    init_verticals();
    DEFAULT_FRESHNESS = { liveVerifiedTtlSec: 900, freshTtlSec: 3600, maxStaleSec: 86400 };
    sources = seedSources();
  }
});

// server/cron/warm.ts
var warm_exports = {};
__export(warm_exports, {
  bootWarm: () => bootWarm
});
module.exports = __toCommonJS(warm_exports);
init_db();

// server/common/cache.ts
var import_crypto = __toESM(require("crypto"), 1);
init_settings();
init_logger();
var l1 = /* @__PURE__ */ new Map();
var inflight = /* @__PURE__ */ new Map();
var locks = /* @__PURE__ */ new Set();
var redis = null;
var redisTried = false;
async function getRedis() {
  if (redisTried) return redis;
  redisTried = true;
  if (!settings.redisUrl) return null;
  try {
    const mod = await import("ioredis");
    const Redis = mod.default;
    redis = new Redis(settings.redisUrl, { maxRetriesPerRequest: 2, lazyConnect: false });
    redis.on("error", (e) => log.warn("Cache", "Redis error", { error: e.message }));
    log.info("Cache", "L2 Redis connected");
  } catch (e) {
    log.warn("Cache", "L2 Redis unavailable, running with L1 only", { error: e.message });
    redis = null;
  }
  return redis;
}
var MAX_L2_BYTES = 900 * 1024;
async function restGet(key) {
  if (!settings.redisRestUrl) return null;
  try {
    const r = await fetch(`${settings.redisRestUrl}/get/${encodeURIComponent(key)}`, {
      headers: settings.redisRestToken ? { Authorization: `Bearer ${settings.redisRestToken}` } : {}
    });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j?.result === "string" ? j.result : null;
  } catch {
    return null;
  }
}
async function restSet(key, value, ttlSec) {
  if (!settings.redisRestUrl) return;
  try {
    await fetch(settings.redisRestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...settings.redisRestToken ? { Authorization: `Bearer ${settings.redisRestToken}` } : {}
      },
      body: JSON.stringify(["SET", key, value, "EX", Math.max(60, ttlSec)])
    });
  } catch {
  }
}
async function l2Get(key) {
  const r = await getRedis();
  if (r) {
    try {
      const v = await r.get(`t1s:${key}`);
      if (v) return v;
    } catch {
    }
  }
  return restGet(`t1s:${key}`);
}
async function l2Set(key, value, ttlSec) {
  if (value.length > MAX_L2_BYTES) return;
  const r = await getRedis();
  if (r) {
    try {
      await r.set(`t1s:${key}`, value, "EX", ttlSec);
    } catch {
    }
  }
  if (!r || settings.redisRestUrl) await restSet(`t1s:${key}`, value, ttlSec);
}
async function cacheGet(key) {
  const now = Date.now();
  const l1e = l1.get(key);
  if (l1e && l1e.expiresAt > now) return { value: l1e.value, fresh: true, stale: false };
  if (l1e && l1e.staleUntil > now) return { value: l1e.value, fresh: false, stale: true };
  const raw = await l2Get(key);
  if (raw) {
    try {
      return { value: JSON.parse(raw), fresh: false, stale: true };
    } catch {
      return { value: null, fresh: false, stale: false };
    }
  }
  return { value: null, fresh: false, stale: false };
}
function cachePut(key, value, ttlSec, staleSec) {
  const stale = (staleSec ?? ttlSec * 3) * 1e3;
  l1.set(key, { value, expiresAt: Date.now() + ttlSec * 1e3, staleUntil: Date.now() + stale });
  const payload = JSON.stringify(value);
  void l2Set(key, payload, ttlSec);
}
function revalidateInBackground(key, ttlSec, refresh) {
  if (inflight.has(key)) return;
  const p = (async () => {
    const done = await withLock(`swr:${key}`, async () => {
      const v = await refresh();
      if (v !== void 0 && v !== null) cachePut(key, v, ttlSec);
      return true;
    });
    return done;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  p.catch(() => void 0);
}
function buildCacheKey(parts) {
  const normalized = Object.keys(parts).sort().map((k) => `${k}=${parts[k] ?? ""}`).join("|");
  return import_crypto.default.createHash("sha1").update(normalized).digest("hex").slice(0, 32);
}
async function withLock(name, fn, opts = {}) {
  if (locks.has(name)) return null;
  const r = await getRedis();
  if (r) {
    const token = import_crypto.default.randomUUID();
    const ok = await r.set(`lock:${name}`, token, "PX", opts.ttlMs ?? 3e4, "NX");
    if (!ok) return null;
    locks.add(name);
    try {
      return await fn();
    } finally {
      locks.delete(name);
      await r.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", 1, `lock:${name}`, token).catch(() => void 0);
    }
  }
  locks.add(name);
  try {
    return await fn();
  } finally {
    locks.delete(name);
  }
}

// server/search/searchOrchestrator.ts
init_logger();

// server/types.ts
var ALL_VERTICALS = [
  "food",
  "grocery",
  "ecommerce",
  "flights",
  "hotels",
  "cab",
  "loans",
  "insurance",
  "movies",
  "bus",
  "coupons",
  "giftcards",
  "banking"
];

// server/query/queryUnderstanding.ts
init_settings();
var VERTICAL_KEYWORDS = {
  food: ["pizza", "biryani", "order food", "swiggy", "zomato", "restaurant", "dosa", "burger", "meal", "thali", "combo", "sandwich", "pasta"],
  grocery: ["grocery", "milk", "atta", "vegetable", "fruit", "zepto", "blinkit", "instamart", "insta mart", "quick commerce", "paneer", "curd", "bread", "egg", "rice", "dal", "oil", "ghee", "maggi", "chips", "cold drink", "snacks", "detergent", "shampoo", "soap"],
  ecommerce: ["buy", "price of", "under", "shopping", "amazon", "flipkart", "myntra", "laptop", "phone", "mobile", "headphone", "earbud", "tv", "watch", "shoe", "shirt", "camera", "speaker", "power bank", "tablet"],
  flights: ["flight", "flights", "air ticket", "fly to", "delhi to mumbai", "airline", "indigo", "air india", "airfare", "plane"],
  hotels: ["hotel", "hotels", "stay in", "resort", "room in", "check in", "accommodation", "oyo", "night stay"],
  cab: ["cab", "taxi", "uber", "ola", "rapido", "ride to", "auto", "drop to", "pick up", "pickup and drop"],
  loans: ["loan", "personal loan", "home loan", "car loan", "credit line", "borrow", "lender", "interest rate", "emi"],
  insurance: ["insurance", "policy", "premium", "term plan", "health cover", "bike insurance", "car insurance", "insurer"],
  movies: ["movie", "cinema", "pvr", "showtime", "show", "ticket for", "film", "concert", "event", "bookmyshow"],
  bus: ["bus", "buses", "volvo", "redbus", "sleeper bus", "bus ticket", "bus to"],
  coupons: ["coupon", "coupons", "promo code", "voucher", "discount code", "offer code", "cashback offer", "deal"],
  giftcards: ["gift card", "gift cards", "giftcard", "voucher card", "gift voucher"],
  banking: ["credit card", "debit card", "card offer", "bank offer", "hdfc offer", "sbi offer", "axis offer", "icici offer", "no cost emi", "card discount"]
};
var PINCODE_RE = /\b(\d{6})\b/;
var MAJOR_CITIES = [
  "delhi",
  "mumbai",
  "bangalore",
  "bengaluru",
  "hyderabad",
  "chennai",
  "kolkata",
  "pune",
  "ahmedabad",
  "jaipur",
  "lucknow",
  "goa",
  "noida",
  "gurgaon",
  "gurugram",
  "indore",
  "chandigarh"
];
var STOPWORDS = /* @__PURE__ */ new Set(["price", "best", "cheap", "cheapest", "compare", "comparison", "for", "in", "the", "a", "an", "of", "to", "near", "me", "under", "buy", "order", "book", "find", "show", "on", "and", "with", "under", "rs", "rupees", "today", "now", "deals", "deal", "offer", "offers"]);
function detectVertical(q3) {
  const lower = ` ${q3.toLowerCase()} `;
  const scores = [];
  for (const v of ALL_VERTICALS) {
    let s = 0;
    for (const kw of VERTICAL_KEYWORDS[v]) {
      if (lower.includes(` ${kw}`)) s += kw.split(" ").length;
    }
    if (s > 0) scores.push({ v, s });
  }
  scores.sort((a, b) => b.s - a.s);
  if (scores.length === 0) return { vertical: null, confidence: 0 };
  const top = scores[0];
  const second = scores[1];
  const conf = second ? Math.min(0.9, 0.5 + 0.2 * (top.s - second.s)) : 0.85;
  return { vertical: top.v, confidence: conf };
}
function extractEntity(q3) {
  const cleaned = q3.replace(/\b(under|below|less than)\s*₹?\s*\d+(\s*k)?\b/gi, "").replace(/₹\s*\d+(\.\d+)?/g, "").replace(/\bfrom\s+(amazon|flipkart|blinkit|zepto|swiggy|zomato|amazon)\b/gi, "").trim();
  const tokens = cleaned.split(/\s+/).filter((t) => t && !STOPWORDS.has(t.toLowerCase()));
  return tokens.length > 0 ? tokens.join(" ").slice(0, 160) : null;
}
function extractLocation(q3) {
  const loc = {};
  const pin = q3.match(PINCODE_RE);
  if (pin) loc.pincode = pin[1];
  const lower = q3.toLowerCase();
  const city = MAJOR_CITIES.find((c) => lower.includes(c));
  if (city) loc.city = city === "bengaluru" ? "Bengaluru" : city.charAt(0).toUpperCase() + city.slice(1);
  return loc;
}
function extractDates(q3) {
  const dateMatch = q3.match(/\b(20\d{2}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/);
  const tomorrow = /\b(tomorrow|today|tonight)\b/i.test(q3);
  if (!dateMatch && !tomorrow) return void 0;
  if (tomorrow) return { depart: /today|tonight/i.test(q3) ? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) : new Date(Date.now() + 864e5).toISOString().slice(0, 10) };
  return { depart: dateMatch?.[1] };
}
function extractParties(q3) {
  const pax = q3.match(/\b(\d+)\s*(?:passengers?|pax|guests?|people|adults?|seats?)\b/i);
  if (!pax) return void 0;
  const n = Number(pax[1]);
  if (/\b(passenger|pax)\b/i.test(q3)) return { passengers: n };
  return { guests: n };
}
function extractConfiguration(q3) {
  const cfg = {};
  const storage = q3.match(/\b(\d+)\s*(?:gb|tb)\b/i);
  if (storage) cfg["storage"] = storage[0];
  const color = q3.match(/\b(black|white|blue|red|green|gold|silver|grey|gray|graphite|midnight)\b/i);
  if (color) cfg["color"] = color[1];
  const size = q3.match(/\b(xl|xxl|large|medium|small|size \d+)\b/i);
  if (size) cfg["size"] = size[1];
  const room = q3.match(/\b(deluxe|luxury|suite|standard|ac room|non-ac)\b/i);
  if (room) cfg["room_type"] = room[1];
  const seat = q3.match(/\b(sleeper|seater|semi-sleeper|window seat)\b/i);
  if (seat) cfg["seat_type"] = seat[1];
  return Object.keys(cfg).length > 0 ? cfg : void 0;
}
function detectIntent(q3) {
  const lower = q3.toLowerCase();
  if (/\b(compare|vs\.?|versus|difference between)\b/.test(lower)) return "compare";
  if (/\b(book|reserve|ticket)\b/.test(lower)) return "book";
  if (/\b(buy|order|purchase)\b/.test(lower)) return "buy";
  if (/\b(review|rating|worth it|should i)\b/.test(lower)) return "research";
  return "browse";
}
function understandQuery(rawQuery, provided) {
  const { vertical, confidence } = detectVertical(rawQuery);
  const loc = { ...extractLocation(rawQuery) };
  if (provided) {
    if (provided.pincode) loc.pincode = provided.pincode;
    if (provided.city) loc.city = provided.city;
    if (typeof provided.lat === "number") loc.lat = provided.lat;
    if (typeof provided.lng === "number") loc.lng = provided.lng;
  }
  return {
    rawQuery,
    vertical,
    verticalConfidence: confidence,
    entityName: extractEntity(rawQuery),
    intent: detectIntent(rawQuery),
    location: loc,
    travelDates: extractDates(rawQuery),
    parties: extractParties(rawQuery),
    configuration: extractConfiguration(rawQuery)
  };
}
async function aiAssistedUnderstanding(query) {
  if (!settings.aiAssistEnabled || !settings.geminiApiKey) return query;
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });
    const prompt = `Classify this Indian shopping/travel search query. Return strict JSON only:
{"vertical":"one of food|grocery|ecommerce|flights|hotels|cab|loans|insurance|movies|bus|coupons|giftcards|banking","entity":"product/service name","city":"city if mentioned","pincode":"6-digit pincode if mentioned","dates":{"depart":"YYYY-MM-DD if mentioned"},"attributes":{"key":"value only for explicit configuration mentions"}}
Rules: Do NOT include prices, stock, or availability. Do NOT guess unstated fields.
Query: ${query.rawQuery}`;
    const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
    const text = res.text || "";
    const json = JSON.parse(text.replace(/```json|```/g, "").trim());
    const refined = { ...query };
    if (json.vertical && ALL_VERTICALS.includes(json.vertical)) refined.vertical = json.vertical;
    if (json.entity) refined.entityName = String(json.entity).slice(0, 160);
    if (json.city && !query.location.city) refined.location = { ...query.location, city: String(json.city) };
    if (json.pincode && /^\d{6}$/.test(String(json.pincode))) refined.location = { ...query.location, pincode: String(json.pincode) };
    if (json.dates?.depart && /^\d{4}-\d{2}-\d{2}$/.test(json.dates.depart)) refined.travelDates = { ...query.travelDates, depart: json.dates.depart };
    if (json.attributes && typeof json.attributes === "object") {
      refined.configuration = { ...query.configuration || {} };
      for (const [k, v] of Object.entries(json.attributes)) {
        if (typeof v === "string" && !/price|stock|availab/i.test(k)) refined.configuration[k.toLowerCase()] = v.slice(0, 60);
      }
    }
    return refined;
  } catch {
    return query;
  }
}

// server/search/searchOrchestrator.ts
init_registry();

// server/sources/orchestrator.ts
init_registry();
init_health();
init_logger();

// server/sources/adapters/httpAcquisitionAdapter.ts
var cheerio5 = __toESM(require("cheerio"), 1);
var import_crypto10 = require("crypto");
init_httpClient();
init_contract();
function toNumber(v) {
  if (v === null || v === void 0 || v === "") return void 0;
  const cleaned = String(v).replace(/[₹,\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : void 0;
}
function parseJsonLdOffers($) {
  const out = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const nodes = Array.isArray(data) ? data : [data, ...data["@graph"] || []];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const t = node["@type"];
        if (typeof t === "string" && /product|offer/i.test(t)) {
          const offer = t === "Product" ? node.offers?.[0] ?? node.offers : node;
          out.push({
            title: node.name || offer?.name || "",
            price: toNumber(offer?.price ?? offer?.lowPrice),
            listPrice: toNumber(node.listPrice),
            brand: typeof node.brand === "object" ? node.brand?.name : node.brand,
            availability: typeof offer?.availability === "string" ? offer.availability.includes("InStock") ? "in_stock" : offer.availability.includes("OutOfStock") ? "out_of_stock" : "unknown" : "unknown"
          });
        }
      }
    } catch {
    }
  });
  return out.filter((o) => o.title);
}
function parseMetaOffer($) {
  const title = $('meta[property="og:title"]').attr("content") || $('meta[name="twitter:title"]').attr("content") || $("h1").first().text().trim() || "";
  if (!title) return null;
  const priceMeta = $('meta[property="product:price:amount"]').attr("content") || $('meta[property="og:price:amount"]').attr("content") || $('[itemprop="price"]').first().attr("content") || $('[itemprop="price"]').first().text().trim() || "";
  const currency = $('meta[property="product:price:currency"]').attr("content") || $('meta[property="og:price:currency"]').attr("content") || "INR";
  const brandMeta = $('meta[property="og:site_name"]').attr("content") || void 0;
  const price = toNumber(priceMeta);
  const availability = /out of stock|sold out/i.test($("body").text().slice(0, 2e4)) ? "out_of_stock" : "unknown";
  const offer = { title, price, brand: brandMeta, availability };
  return offer;
}
var HttpAcquisitionAdapter = class {
  constructor() {
    this.id = "http_adapter";
    this.method = "direct_http";
    this.adapterVersion = "1.0.0";
    this.parserVersion = "1.2.0";
  }
  async search(ctx) {
    const { source, query } = ctx;
    const fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
    const urlTemplate = String(source.config.urlTemplate || "");
    if (!urlTemplate) return emptyResult(source, fetchedAt);
    const url = urlTemplate.replace("{query}", encodeURIComponent(query.rawQuery || "")).replace("{city}", encodeURIComponent(query.location?.city || ""));
    try {
      const res = await httpAcquire(url, {
        sourceId: source.id,
        maxPerMinute: source.rateLimit.maxRequestsPerMinute,
        maxConcurrency: source.rateLimit.maxConcurrency,
        retries: 2
      });
      if (res.status !== 200) {
        return failedResult(source, "NOT_FOUND", `HTTP ${res.status}`, res.latencyMs, res.status);
      }
      const $ = cheerio5.load(res.body);
      let offers = parseJsonLdOffers($);
      if (offers.length === 0) {
        const meta = parseMetaOffer($);
        if (meta) offers = [meta];
      }
      if (offers.length === 0) {
        return failedResult(source, "MISSING_REQUIRED_FIELD", "No verifiable product data found on page", res.latencyMs, 200);
      }
      const rawItems = offers.slice(0, 20).map(
        (o) => newRawItem(source, {
          title: o.title,
          price: o.price,
          currency: "INR",
          listPrice: o.listPrice,
          brand: o.brand,
          seller: source.name.replace(/\s*\(.*\)$/, ""),
          sellerUrl: url,
          availability: o.availability,
          evidence: {
            sourceUrl: url,
            rawFingerprint: (0, import_crypto10.createHash)("sha256").update(res.body.slice(0, 5e4)).digest("hex"),
            extractedFields: ["title", ...o.price ? ["price"] : [], ...o.availability !== "unknown" ? ["availability"] : []]
          }
        })
      );
      return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems, httpStatus: 200, latencyMs: res.latencyMs, fetchedAt };
    } catch (e) {
      const fc = e instanceof AcquisitionError ? e.failureClass : "UNKNOWN";
      return failedResult(source, fc, String(e.message || e), 0, e?.httpStatus);
    }
  }
  async healthCheck(source) {
    const url = String(source.config.healthUrl || source.config.urlTemplate || "");
    if (!url) return { healthy: false, failureClass: "CONFIGURATION_REQUIRED", latencyMs: 0 };
    const r = await httpHealthCheck(url, source.id);
    return { healthy: r.healthy, failureClass: r.failureClass, latencyMs: r.latencyMs };
  }
  getFreshness(source) {
    return source.freshnessPolicy;
  }
  getExpiry() {
    return null;
  }
};

// server/sources/adapters/structuredDataAdapter.ts
var import_crypto11 = require("crypto");
init_httpClient();
init_contract();
function validateOpenLibrary(json) {
  if (!json || typeof json !== "object" || !Array.isArray(json.docs)) {
    throw new AcquisitionError("SCHEMA_DRIFT", "Response does not match Open Library search schema");
  }
  return json.docs.filter((d) => d && typeof d.title === "string");
}
function parseFeed(xml) {
  const items = [];
  const itemBlocks = xml.match(/<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/g) || [];
  for (const block of itemBlocks) {
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.trim();
    if (!title) continue;
    items.push({
      title: title.replace(/<!\[CDATA\[|\]\]>/g, ""),
      link: block.match(/<link[^>]*href="([^"]+)"/)?.[1] || block.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1]?.trim(),
      description: block.match(/<description[^>]*>([\s\S]*?)<\/description>|<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1]?.trim(),
      pubDate: block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>|<updated[^>]*>([\s\S]*?)<\/updated>/)?.[1]?.trim()
    });
  }
  return items;
}
var StructuredDataAdapter = class {
  constructor() {
    this.id = "structured_adapter";
    this.method = "structured_data";
    this.adapterVersion = "1.0.0";
    this.parserVersion = "1.1.0";
  }
  async search(ctx) {
    const { source, query } = ctx;
    const fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
    const baseUrl = String(source.config.baseUrl || "");
    if (!baseUrl) return emptyResult(source, fetchedAt);
    try {
      let url = baseUrl;
      if (source.config.paramMap && typeof source.config.paramMap === "object") {
        for (const [param, qp] of Object.entries(source.config.paramMap)) {
          const value = param === "query" ? query.entityName || query.rawQuery : query[param];
          if (value) url += `${url.includes("?") ? "&" : "?"}${qp}=${encodeURIComponent(String(value))}`;
        }
      }
      const res = await httpAcquire(url, {
        sourceId: source.id,
        expectJson: true,
        maxPerMinute: source.rateLimit.maxRequestsPerMinute,
        maxConcurrency: source.rateLimit.maxConcurrency
      });
      if (!res.ok) return failedResult(source, "SERVER_ERROR", `HTTP ${res.status}`, res.latencyMs, res.status);
      const fingerprint = (0, import_crypto11.createHash)("sha256").update(res.body.slice(0, 5e4)).digest("hex");
      if (source.config.schema === "openlibrary_search") {
        const docs = validateOpenLibrary(JSON.parse(res.body));
        const rawItems = docs.slice(0, 20).map(
          (d) => newRawItem(source, {
            title: d.title,
            brand: d.author_name?.[0],
            identifiers: d.isbn?.[0] ? { gtin: d.isbn[0] } : {},
            attributes: d.first_publish_year ? { firstPublishYear: String(d.first_publish_year) } : {},
            seller: "Open Library (book metadata, not a commercial offer)",
            availability: "unknown",
            // NOTE: Open Library exposes no price. We deliberately do NOT set a price.
            evidence: { sourceUrl: `https://openlibrary.org${d.key}`, sourceReference: d.key, rawFingerprint: fingerprint, extractedFields: ["title", "brand", "identifiers"] }
          })
        );
        return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems, httpStatus: 200, latencyMs: res.latencyMs, fetchedAt };
      }
      if (source.config.schema === "feed") {
        const items = parseFeed(res.body);
        const rawItems = items.slice(0, 20).map(
          (i) => newRawItem(source, {
            title: i.title,
            seller: source.name,
            sellerUrl: i.link,
            availability: "unknown",
            evidence: { sourceUrl: i.link, rawFingerprint: fingerprint, extractedFields: ["title"] }
          })
        );
        return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems, httpStatus: 200, latencyMs: res.latencyMs, fetchedAt };
      }
      return failedResult(source, "SCHEMA_DRIFT", `No validator for schema '${source.config.schema}'`, res.latencyMs, 200);
    } catch (e) {
      const fc = e instanceof AcquisitionError ? e.failureClass : e.message?.includes("JSON") ? "MALFORMED_RESPONSE" : "UNKNOWN";
      return failedResult(source, fc, String(e.message || e).slice(0, 200), 0);
    }
  }
  async healthCheck(source) {
    const url = String(source.config.baseUrl || "");
    if (!url) return { healthy: false, failureClass: "CONFIGURATION_REQUIRED", latencyMs: 0 };
    try {
      const r = await httpAcquire(url, { sourceId: source.id, retries: 0, timeoutMs: 5e3 });
      return { healthy: r.ok, latencyMs: r.latencyMs };
    } catch (e) {
      return { healthy: false, failureClass: e.failureClass || "UNKNOWN", latencyMs: 0 };
    }
  }
  getFreshness(source) {
    return source.freshnessPolicy;
  }
  getExpiry(raw) {
    return raw.expiresAt || null;
  }
};

// server/sources/adapters/feedAndApiAdapters.ts
var import_crypto12 = require("crypto");
init_httpClient();
init_settings();
init_logger();
init_contract();
var AffiliateFeedAdapter = class {
  constructor() {
    this.id = "affiliate_feed_adapter";
    this.method = "affiliate_feed";
    this.adapterVersion = "1.0.0";
    this.parserVersion = "1.0.0";
  }
  async search(ctx) {
    const { source, query } = ctx;
    const fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
    const apiKey = String(source.config.apiKey || "");
    const isVcommission = source.config.schema === "vcommission_campaigns";
    const feedUrl = isVcommission ? `${String(source.config.baseUrl || "https://api.vcommission.com/v2")}/publisher/campaigns?apiKey=${encodeURIComponent(apiKey)}` : String(source.config.feedUrl || "");
    if (!feedUrl || !apiKey) {
      return failedResult(source, "EXPIRED_CREDENTIALS", "Affiliate feed URL/API key not configured", 0);
    }
    try {
      const res = await httpAcquire(feedUrl, {
        sourceId: source.id,
        headers: isVcommission ? {} : { Authorization: `Bearer ${apiKey}` },
        expectJson: true,
        maxPerMinute: source.rateLimit.maxRequestsPerMinute
      });
      if (!res.ok) return failedResult(source, res.status === 429 ? "QUOTA_EXHAUSTED" : "SERVER_ERROR", `HTTP ${res.status}`, res.latencyMs, res.status);
      const json = JSON.parse(res.body);
      if (isVcommission) {
        const campaigns = json?.data?.campaigns;
        if (!Array.isArray(campaigns)) {
          return failedResult(source, "SCHEMA_DRIFT", "VCommission feed schema unrecognized", res.latencyMs, 200);
        }
        const rawItems2 = campaigns.slice(0, 50).filter((c) => c && c.title).map(
          (c) => newRawItem(source, {
            title: String(c.title),
            price: void 0,
            // campaigns carry commissions, not product prices — never fabricated
            currency: "INR",
            identifiers: c.id ? { sku: String(c.id) } : {},
            seller: String(c.store_title || c.merchant_name || "VCommission merchant"),
            sellerUrl: c.tracking_url || c.url || void 0,
            availability: "unknown",
            expiresAt: c.validity_end || c.expires_at,
            evidence: {
              sourceUrl: feedUrl.replace(`apiKey=${encodeURIComponent(apiKey)}`, "apiKey=***"),
              rawFingerprint: (0, import_crypto12.createHash)("sha256").update(res.body.slice(0, 5e4)).digest("hex"),
              extractedFields: ["title", "seller", ...c.tracking_url || c.url ? ["tracking_url"] : []]
            }
          })
        );
        return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems: rawItems2, httpStatus: 200, latencyMs: res.latencyMs, fetchedAt };
      }
      if (!Array.isArray(json.offers) && !Array.isArray(json)) {
        return failedResult(source, "SCHEMA_DRIFT", "Feed response schema unrecognized", res.latencyMs, 200);
      }
      const offers = (json.offers || json).slice(0, 50);
      const rawItems = offers.filter((o) => o && (o.title || o.product_name) && (o.price ?? o.sale_price) !== void 0).map(
        (o) => newRawItem(source, {
          title: String(o.title || o.product_name),
          price: Number(o.price ?? o.sale_price) || void 0,
          listPrice: Number(o.list_price) || void 0,
          currency: (o.currency || "INR").toUpperCase(),
          identifiers: o.sku || o.product_id ? { sku: String(o.sku || o.product_id) } : {},
          seller: String(o.merchant || source.name),
          sellerUrl: o.url || o.deeplink,
          availability: o.in_stock === false ? "out_of_stock" : "unknown",
          expiresAt: o.expires_at || o.valid_to,
          evidence: {
            sourceUrl: o.url || o.deeplink,
            rawFingerprint: (0, import_crypto12.createHash)("sha256").update(res.body.slice(0, 5e4)).digest("hex"),
            extractedFields: ["title", "price", "seller", ...o.url ? ["url"] : []]
          }
        })
      );
      return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems, httpStatus: 200, latencyMs: res.latencyMs, fetchedAt };
    } catch (e) {
      const fc = e instanceof AcquisitionError ? e.failureClass : "UNKNOWN";
      return failedResult(source, fc, String(e.message || e).slice(0, 200), 0);
    }
  }
  async healthCheck(source) {
    const feedUrl = String(source.config.feedUrl || "");
    if (!feedUrl || !source.config.apiKey) return { healthy: false, failureClass: "EXPIRED_CREDENTIALS", latencyMs: 0 };
    try {
      const r = await httpAcquire(feedUrl, { sourceId: source.id, headers: { Authorization: `Bearer ${source.config.apiKey}` }, retries: 0, timeoutMs: 5e3 });
      return { healthy: r.ok, latencyMs: r.latencyMs };
    } catch (e) {
      return { healthy: false, failureClass: e.failureClass || "UNKNOWN", latencyMs: 0 };
    }
  }
  getFreshness(source) {
    return source.freshnessPolicy;
  }
  getExpiry(raw) {
    return raw.expiresAt || null;
  }
};
var PartnerFeedAdapter = class {
  constructor() {
    this.id = "partner_feed_adapter";
    this.method = "partner_feed";
    this.adapterVersion = "1.0.0";
    this.parserVersion = "1.0.0";
  }
  async search(ctx) {
    const { source } = ctx;
    if (!source.config.feedUrl) {
      return failedResult(source, "MISSING_REQUIRED_FIELD", "Partner feed not configured yet", 0);
    }
    try {
      const res = await httpAcquire(String(source.config.feedUrl), { sourceId: source.id, expectJson: true });
      const json = JSON.parse(res.body);
      const rows = Array.isArray(json) ? json : json.items || [];
      const rawItems = rows.slice(0, 50).map(
        (o) => newRawItem(source, {
          title: String(o.title || o.name || ""),
          price: Number(o.price) || void 0,
          currency: (o.currency || "INR").toUpperCase(),
          seller: String(o.seller || source.name),
          sellerUrl: o.url,
          availability: o.in_stock === false ? "out_of_stock" : "unknown",
          evidence: { sourceUrl: o.url, extractedFields: ["title", ...o.price ? ["price"] : []] }
        })
      ).filter((r) => r.title);
      return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems, httpStatus: res.status, latencyMs: res.latencyMs, fetchedAt: (/* @__PURE__ */ new Date()).toISOString() };
    } catch (e) {
      const fc = e instanceof AcquisitionError ? e.failureClass : "UNKNOWN";
      return failedResult(source, fc, String(e.message || e).slice(0, 200), 0);
    }
  }
  async healthCheck(source) {
    if (!source.config.feedUrl) return { healthy: false, failureClass: "CONFIGURATION_REQUIRED", latencyMs: 0 };
    try {
      const r = await httpAcquire(String(source.config.feedUrl), { sourceId: source.id, retries: 0, timeoutMs: 5e3 });
      return { healthy: r.ok, latencyMs: r.latencyMs };
    } catch (e) {
      return { healthy: false, failureClass: e.failureClass || "UNKNOWN", latencyMs: 0 };
    }
  }
  getFreshness(source) {
    return source.freshnessPolicy;
  }
  getExpiry(raw) {
    return raw.expiresAt || null;
  }
};
var OfficialAPIAdapter = class {
  constructor() {
    this.id = "official_api_adapter";
    this.method = "official_api";
    this.adapterVersion = "1.0.0";
    this.parserVersion = "1.0.0";
  }
  async search(ctx) {
    const { source } = ctx;
    const endpoint = String(source.config.endpoint || "");
    if (!endpoint || !source.config.apiKey) {
      return failedResult(source, "EXPIRED_CREDENTIALS", "Official API not authorized yet (endpoint/key missing)", 0);
    }
    try {
      const res = await httpAcquire(endpoint, {
        sourceId: source.id,
        headers: { Authorization: `Bearer ${source.config.apiKey}` },
        expectJson: true
      });
      const json = JSON.parse(res.body);
      const rows = Array.isArray(json) ? json : json.data || json.results || [];
      const rawItems = rows.slice(0, 50).map(
        (o) => newRawItem(source, {
          title: String(o.title || o.name || ""),
          price: Number(o.price ?? o.fare ?? o.premium) || void 0,
          currency: (o.currency || "INR").toUpperCase(),
          seller: String(o.provider || source.name),
          sellerUrl: o.url || o.booking_url,
          availability: o.available === false ? "out_of_stock" : "unknown",
          travel: o.route || o.date ? { route: o.route, date: o.date, passengers: o.passengers, seatType: o.seat_type } : void 0,
          evidence: { sourceUrl: o.url, extractedFields: ["title", ...o.price ? ["price"] : []] }
        })
      ).filter((r) => r.title);
      return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems, httpStatus: res.status, latencyMs: res.latencyMs, fetchedAt: (/* @__PURE__ */ new Date()).toISOString() };
    } catch (e) {
      const fc = e instanceof AcquisitionError ? e.failureClass : "UNKNOWN";
      return failedResult(source, fc, String(e.message || e).slice(0, 200), 0);
    }
  }
  async healthCheck(source) {
    if (!source.config.endpoint) return { healthy: false, failureClass: "CONFIGURATION_REQUIRED", latencyMs: 0 };
    try {
      const r = await httpAcquire(String(source.config.endpoint), { sourceId: source.id, retries: 0, timeoutMs: 5e3 });
      return { healthy: r.ok, latencyMs: r.latencyMs };
    } catch (e) {
      return { healthy: false, failureClass: e.failureClass || "UNKNOWN", latencyMs: 0 };
    }
  }
  getFreshness(source) {
    return source.freshnessPolicy;
  }
  getExpiry(raw) {
    return raw.expiresAt || null;
  }
};
var SearchProviderAdapter = class {
  constructor() {
    this.id = "search_provider_adapter";
    this.method = "search_provider";
    this.adapterVersion = "1.0.0";
    this.parserVersion = "1.0.0";
  }
  async search(ctx) {
    const { source, query } = ctx;
    const fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
    const apiKey = String(source.config.apiKey || settings.searchApi.apiKey);
    if (!apiKey) return failedResult(source, "EXPIRED_CREDENTIALS", "SearchApi key not configured (adapter optional)", 0);
    const engineMap = { ecommerce: "google_shopping", flights: "google_flights", hotels: "google_hotels" };
    const engine = engineMap[query.vertical || ""] || "google_shopping";
    if (!source.config.engines?.includes(engine)) {
      return failedResult(source, "MISSING_REQUIRED_FIELD", `Engine ${engine} not supported for this vertical`, 0);
    }
    try {
      const url = `https://www.searchapi.io/api/v1/search?engine=${engine}&q=${encodeURIComponent(query.rawQuery)}`;
      const res = await httpAcquire(url, { sourceId: source.id, headers: { Authorization: `Bearer ${apiKey}` }, expectJson: true });
      if (res.status === 429) return failedResult(source, "QUOTA_EXHAUSTED", "SearchApi quota exhausted", res.latencyMs, 429);
      if (!res.ok) return failedResult(source, "SERVER_ERROR", `HTTP ${res.status}`, res.latencyMs, res.status);
      const json = JSON.parse(res.body);
      const products = (json.shopping_results || json.flights || json.hotels || []).slice(0, 20);
      const rawItems = products.filter((p) => p && (p.title || p.name)).map(
        (p) => newRawItem(source, {
          title: String(p.title || p.name),
          price: Number(String(p.extracted_price ?? p.price ?? "").replace(/[₹,]/g, "")) || void 0,
          currency: p.currency || "INR",
          brand: p.source || p.seller,
          seller: p.source || p.seller || "SearchApi candidate",
          sellerUrl: p.link || p.url,
          availability: "unknown",
          evidence: {
            sourceUrl: p.link || p.url,
            rawFingerprint: (0, import_crypto12.createHash)("sha256").update(res.body.slice(0, 5e4)).digest("hex"),
            extractedFields: ["title", ...p.price !== void 0 ? ["price"] : []]
          }
        })
      );
      log.debug("SearchProvider", `SearchApi returned ${rawItems.length} candidates`);
      return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems, httpStatus: 200, latencyMs: res.latencyMs, fetchedAt };
    } catch (e) {
      const fc = e instanceof AcquisitionError ? e.failureClass : "UNKNOWN";
      return failedResult(source, fc, String(e.message || e).slice(0, 200), 0);
    }
  }
  async healthCheck(source) {
    if (!source.config.apiKey) return { healthy: false, failureClass: "EXPIRED_CREDENTIALS", latencyMs: 0 };
    try {
      const r = await httpAcquire("https://www.searchapi.io/api/v1/account", { sourceId: source.id, headers: { Authorization: `Bearer ${source.config.apiKey}` }, retries: 0, timeoutMs: 5e3 });
      return { healthy: r.ok, latencyMs: r.latencyMs };
    } catch (e) {
      return { healthy: false, failureClass: e.failureClass || "UNKNOWN", latencyMs: 0 };
    }
  }
  getFreshness(source) {
    return source.freshnessPolicy;
  }
  getExpiry() {
    return null;
  }
};

// server/sources/adapters/browserRenderAdapter.ts
init_contract();
var NAV_TIMEOUT_MS = 15e3;
var MAX_HTML = 3e6;
var BrowserRenderAdapter = class {
  constructor() {
    this.id = "browser_render_adapter";
    this.method = "browser_render";
    this.adapterVersion = "1.0.0";
    this.parserVersion = "1.0.0";
  }
  async healthCheck(source) {
    try {
      await import(
        /* @vite-ignore */
        "playwright"
      );
      return { healthy: true, latencyMs: 0 };
    } catch {
      return { healthy: false, latencyMs: 0 };
    }
  }
  getFreshness(source) {
    return source.freshnessPolicy ?? { liveVerifiedTtlSec: 600, freshTtlSec: 1800, maxStaleSec: 7200 };
  }
  getExpiry(rawItem) {
    return rawItem.expiresAt ?? null;
  }
  async search(ctx) {
    const { source, query } = ctx;
    const started = Date.now();
    let playwright;
    try {
      playwright = await import(
        /* @vite-ignore */
        "playwright"
      );
    } catch {
      return failedResult(
        source,
        "CAPABILITY_UNAVAILABLE",
        "Headless browser fallback unavailable: Playwright/Chromium not installed on this runtime",
        Date.now() - started
      );
    }
    const url = String(source.config.url || source.config.baseUrl || "");
    if (!/^https:\/\//i.test(url)) {
      return failedResult(source, "MISSING_REQUIRED_FIELD", "Browser render requires an https:// target URL", Date.now() - started);
    }
    let browser = null;
    try {
      browser = await playwright.chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
      const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
      page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
      if (!res || !res.ok()) {
        return failedResult(
          source,
          res && res.status() === 429 ? "QUOTA_EXHAUSTED" : "SERVER_ERROR",
          `Rendered page HTTP ${res ? res.status() : "unknown"}`,
          Date.now() - started,
          res && res.status ? res.status() : void 0
        );
      }
      await page.waitForLoadState("networkidle", { timeout: 5e3 }).catch(() => void 0);
      const extracted = await page.evaluate((maxLen) => {
        const out = [];
        for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
          try {
            out.push(JSON.parse(s.textContent || "{}"));
          } catch {
          }
        }
        const title = document.title || "";
        return { jsonLd: out, title, htmlLen: document.documentElement.outerHTML.length, html: document.documentElement.outerHTML.slice(0, maxLen) };
      }, MAX_HTML);
      const rawItems = this.mapJsonLd(extracted.jsonLd, source, url, started);
      if (rawItems.length === 0) {
        return failedResult(
          source,
          "EMPTY_RESPONSE",
          "Page rendered but exposed no public structured product data",
          Date.now() - started,
          res.status()
        );
      }
      return {
        success: true,
        sourceId: source.id,
        sourceMethod: this.method,
        rawItems,
        httpStatus: res.status(),
        latencyMs: Date.now() - started,
        fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (e) {
      const msg = String(e?.message || e).slice(0, 160);
      const klass = /Timeout|timed out/i.test(msg) ? "TIMEOUT" : /net::|ERR_/.test(msg) ? "CONNECTION_FAILURE" : "PARSER_FAILURE";
      return failedResult(source, klass, `Browser render failed: ${msg}`, Date.now() - started);
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {
        }
      }
    }
  }
  /** JSON-LD → RawSourceItem. Only evidence-backed fields are extracted. */
  mapJsonLd(blocks, source, url, started) {
    const items = [];
    const push = (node) => {
      if (!node || typeof node !== "object") return;
      const type = String(node["@type"] || "");
      if (/Product|Offer/i.test(type)) {
        const offer = /Offer|AggregateOffer/i.test(type) ? node : node.offers || node.offer;
        const price = offer ? Number(offer.price ?? offer.lowPrice) : void 0;
        const title = String(node.name || node.itemOffered?.name || "").trim();
        if (!title) return;
        items.push(newRawItem(source, {
          title,
          price: Number.isFinite(price) ? price : void 0,
          currency: String(offer?.priceCurrency || "INR"),
          identifiers: node.gtin13 ? { gtin: String(node.gtin13) } : node.sku ? { sku: String(node.sku) } : {},
          seller: String(node.brand?.name || node.seller?.name || ""),
          sellerUrl: url,
          availability: /InStock/i.test(String(offer?.availability || "")) ? "in_stock" : /OutOfStock/i.test(String(offer?.availability || "")) ? "out_of_stock" : "unknown",
          attributes: { rendered_via: "browser", schema_type: type },
          evidence: {
            sourceUrl: url,
            rawFingerprint: void 0,
            extractedFields: ["json_ld", "title", ...price !== void 0 ? ["price"] : []]
          }
        }));
      }
      const graph = node["@graph"];
      if (Array.isArray(graph)) graph.forEach(push);
      if (Array.isArray(node)) node.forEach(push);
    };
    blocks.forEach(push);
    return items.slice(0, 50);
  }
};

// server/sources/orchestrator.ts
init_verticalWorker();
init_verticals();
var ADAPTERS = {
  browser_render: new BrowserRenderAdapter(),
  direct_http: new HttpAcquisitionAdapter(),
  structured_data: new StructuredDataAdapter(),
  affiliate_feed: new AffiliateFeedAdapter(),
  partner_feed: new PartnerFeedAdapter(),
  official_api: new OfficialAPIAdapter(),
  search_provider: new SearchProviderAdapter()
};
var WORKER_ADAPTER = new VerticalWorkerAdapter(workerTaskIndex());
function getAdapter(source) {
  if (workerTaskIndex().has(source.id)) return WORKER_ADAPTER;
  return ADAPTERS[source.method];
}
async function acquireParallel(query, opts = {}) {
  const sources2 = selectSources(query).slice(0, opts.maxSources ?? 6);
  const outcome = { results: [], attempted: sources2.map((s) => s.id), succeeded: [], failed: [] };
  if (sources2.length === 0) {
    log.info("Orchestrator", "No eligible enabled sources \u2014 returning honest unavailable state");
    return outcome;
  }
  const runSource = async (source) => {
    const adapter = getAdapter(source);
    recordAttempt(source.id, 0);
    try {
      const result = await adapter.search({ query, source });
      if (result.success && result.rawItems.length > 0) {
        recordSuccess(source.id, result.latencyMs);
        return { kind: "ok", result };
      }
      const failureClass = result.failureClass || "EMPTY_RESPONSE";
      if (source.method === "direct_http" && !workerTaskIndex().has(source.id) && result.httpStatus && result.httpStatus < 500) {
        const target = String(source.config?.url || source.config?.baseUrl || "");
        if (/^https:\/\//i.test(target)) {
          const browserSource = {
            ...source,
            id: `${source.id}#browser`,
            method: "browser_render",
            config: { ...source.config, url: target }
          };
          recordAttempt(browserSource.id, 0);
          try {
            const browserResult = await ADAPTERS.browser_render.search({ query, source: browserSource });
            if (browserResult.success && browserResult.rawItems.length > 0) {
              recordSuccess(browserSource.id, browserResult.latencyMs);
              return { kind: "ok", result: browserResult };
            }
            recordFailure(
              browserSource.id,
              browserResult.failureClass || "EMPTY_RESPONSE",
              browserResult.error || "Browser fallback found no usable data"
            );
          } catch (e) {
            recordFailure(browserSource.id, "UNKNOWN", String(e).slice(0, 120));
          }
        }
      }
      recordFailure(source.id, failureClass, result.error || "No items");
      return { kind: "fail", sourceId: source.id, failureClass, error: result.error || "No items" };
    } catch (e) {
      recordFailure(source.id, "UNKNOWN", String(e).slice(0, 150));
      return { kind: "fail", sourceId: source.id, failureClass: "UNKNOWN", error: String(e?.message || e).slice(0, 200) };
    }
  };
  const settled = await Promise.allSettled(sources2.map((source) => runSource(source)));
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    const r = s.value;
    if (r.kind === "ok") {
      outcome.results.push(r.result);
      outcome.succeeded.push(r.result.sourceId);
    } else {
      outcome.failed.push({ sourceId: r.sourceId, failureClass: r.failureClass, error: r.error });
    }
  }
  return outcome;
}

// server/pipeline/normalization.ts
var NOISE_RE = /\s*\((?:pack of \d+|set of \d+|1 each)\)\s*$/i;
function normalizeTitle(raw) {
  return raw.replace(/\s+/g, " ").replace(NOISE_RE, "").trim().slice(0, 400);
}
function normalizeIdentifier(type, value) {
  const v = value.trim();
  if (/^(gtin|ean|upc|mpn)$/i.test(type)) return v.replace(/\D/g, "");
  return v.toLowerCase();
}
function normalizeAttributes(attrs) {
  const out = {};
  for (const [k, v] of Object.entries(attrs || {})) {
    const key = k.trim().toLowerCase().replace(/\s+/g, "_");
    if (key && v !== void 0 && v !== null && String(v).trim() !== "") out[key] = String(v).trim();
  }
  if (!out["image_url"]) {
    for (const k of ["image", "imageurl", "image_src", "img", "img_url", "thumbnail", "thumb", "poster", "poster_url", "photo", "picture"]) {
      let u = out[k];
      if (!u) continue;
      if (u.startsWith("//")) u = "https:" + u;
      u = u.replace(/^http:\/\//i, "https://");
      if (/^https:\/\//i.test(u)) {
        out["image_url"] = u;
        break;
      }
    }
  }
  return out;
}
function normalizeCurrency(cur) {
  const c = (cur || "INR").trim().toUpperCase();
  if (["INR", "\u20B9", "RS", "RUPEE", "RUPEES"].includes(c)) return "INR";
  return c;
}
function normalizeOffer(raw, source, vertical) {
  const attributes = normalizeAttributes(raw.attributes);
  const identifiers = {};
  for (const [k, v] of Object.entries(raw.identifiers || {})) {
    if (v) identifiers[k] = normalizeIdentifier(k, v);
  }
  const title = normalizeTitle(raw.title);
  return {
    id: `off_${source.id}_${hashOf(title, raw.seller || "", String(raw.price ?? ""))}`,
    canonicalEntityId: null,
    canonicalVariantId: null,
    vertical,
    title,
    brand: raw.brand?.trim(),
    model: raw.model?.trim(),
    identifiers,
    attributes,
    vendor: (raw.seller || source.name).trim(),
    seller: (raw.seller || source.name).trim(),
    sellerUrl: raw.sellerUrl || raw.evidence?.sourceUrl,
    location: raw.location,
    travel: raw.travel,
    prices: {
      listPrice: raw.listPrice,
      currency: normalizeCurrency(raw.currency),
      fees: {
        basePrice: raw.price,
        ...raw.fees || {}
      }
    },
    availability: raw.availability || "unknown",
    matchState: "NOT_MATCHED",
    freshnessStatus: "UNVERIFIED",
    validationStatus: "PARTIAL",
    confidence: 0,
    provenance: {
      sourceId: source.id,
      sourceMethod: source.method,
      adapterVersion: source.adapterVersion,
      parserVersion: source.parserVersion,
      sourceUrl: raw.evidence?.sourceUrl,
      sourceReference: raw.evidence?.sourceReference,
      fetchedAt: raw.fetchedAt
    },
    expiresAt: raw.expiresAt
  };
}
function hashOf(...parts) {
  const s = parts.join("|").toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = h * 31 + s.charCodeAt(i) | 0;
  }
  return Math.abs(h).toString(36).slice(0, 12);
}
function offerDedupKey(o) {
  const identity = o.identifiers.gtin || o.identifiers.ean || o.identifiers.upc || o.identifiers.sku || `${o.brand || ""}:${o.title}`.toLowerCase();
  if (["hotels", "flights", "bus", "cab", "movies"].includes(String(o.vertical))) {
    const svc = String(o.attributes?.["flight_number"] ?? o.attributes?.["flight number"] ?? o.attributes?.["departure"] ?? o.attributes?.["departure_time"] ?? o.attributes?.["departure time"] ?? "");
    const price = String(o.prices?.effectivePrice ?? "");
    return `${o.vertical}|${identity}|${o.seller.toLowerCase()}|${o.travel?.date || ""}|${o.travel?.route || ""}|${svc}|${o.vertical === "hotels" ? "" : price}`;
  }
  return `${identity}|${o.seller.toLowerCase()}|${o.location?.pincode || ""}|${o.attributes && Object.keys(o.attributes).length ? JSON.stringify(o.attributes) : ""}`;
}
function dedupeOffers(offers) {
  const seen = /* @__PURE__ */ new Map();
  for (const o of offers) {
    const key = offerDedupKey(o);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, o);
      continue;
    }
    if (new Date(o.provenance.fetchedAt) > new Date(existing.provenance.fetchedAt)) seen.set(key, o);
  }
  return [...seen.values()];
}

// server/pipeline/pricing.ts
function computeMandatoryTotal(fees) {
  const base = fees.basePrice;
  if (base === void 0 || base === null || !Number.isFinite(base)) return void 0;
  const sum = base + (fees.tax || 0) + (fees.deliveryFee || 0) + (fees.platformFee || 0) + (fees.serviceFee || 0) + (fees.otherMandatoryFee || 0);
  return round2(sum);
}
function computeEffectivePrice(fees, currency, verified = {}) {
  const warnings = [];
  const mandatoryTotal = computeMandatoryTotal(fees);
  const couponDiscount = verified.coupon && fees.couponDiscount && fees.couponDiscount > 0 ? fees.couponDiscount : 0;
  const bankDiscount = verified.bank && fees.bankDiscount && fees.bankDiscount > 0 ? fees.bankDiscount : 0;
  const vendorCashback = verified.cashback && fees.vendorCashback && fees.vendorCashback > 0 ? fees.vendorCashback : 0;
  const giftCardSaving = verified.giftCard && fees.giftCardSaving && fees.giftCardSaving > 0 ? fees.giftCardSaving : 0;
  if (fees.couponDiscount && !verified.coupon) warnings.push("Coupon discount present but unverified \u2014 not applied");
  if (fees.bankDiscount && !verified.bank) warnings.push("Bank discount present but unverified \u2014 not applied");
  if (fees.vendorCashback && !verified.cashback) warnings.push("Vendor cashback unverified \u2014 not applied");
  const totalVerifiedSavings = round2(couponDiscount + bankDiscount + vendorCashback + giftCardSaving);
  const effectivePrice = mandatoryTotal === void 0 ? void 0 : round2(Math.max(0, mandatoryTotal - totalVerifiedSavings));
  if (effectivePrice !== void 0 && mandatoryTotal !== void 0 && effectivePrice > mandatoryTotal) {
    warnings.push("Savings exceed mandatory total \u2014 capped at mandatory total");
  }
  return {
    currency,
    listPrice: fees.listPrice,
    mandatoryTotal,
    savingsBreakdown: { couponDiscount, bankDiscount, vendorCashback, giftCardSaving, totalVerifiedSavings },
    effectivePrice,
    finalPayablePrice: effectivePrice,
    // payable at checkout (vendor cashback arrives later, not deducted at pay time — but we surface it transparently above)
    verifiedSavings: totalVerifiedSavings > 0 && effectivePrice !== void 0 && mandatoryTotal !== void 0 ? round2(mandatoryTotal - effectivePrice) : 0,
    warnings
  };
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
var KNOWN_CURRENCIES = /* @__PURE__ */ new Set([
  "INR",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "SGD",
  "AUD",
  "CAD",
  "JPY",
  "CNY",
  "CHF",
  "THB",
  "MYR",
  "LKR",
  "NPR",
  "BHD",
  "KWD",
  "SAR",
  "QAR",
  "OMR"
]);
function isSupportedCurrency(cur) {
  return KNOWN_CURRENCIES.has(cur.toUpperCase());
}

// server/pipeline/validation.ts
var VERTICAL_RULES = {
  ecommerce: [
    { name: "price", present: (o) => o.prices.mandatoryTotal !== void 0 },
    { name: "currency", present: (o) => isSupportedCurrency(o.prices.currency) },
    { name: "seller", present: (o) => Boolean(o.seller) },
    { name: "identity", present: (o) => Boolean(o.identifiers.gtin || o.identifiers.sku || o.brand || o.attributes["model"]) },
    { name: "stock", present: (o) => o.availability !== "unknown", blocking: false },
    { name: "delivery_fee", present: (o) => o.prices.fees.deliveryFee !== void 0, blocking: false }
  ],
  food: [
    { name: "restaurant", present: (o) => Boolean(o.vendor) },
    { name: "menu_item", present: (o) => Boolean(o.title) },
    { name: "menu_price", present: (o) => o.prices.mandatoryTotal !== void 0, blocking: false },
    { name: "currency", present: (o) => isSupportedCurrency(o.prices.currency) },
    { name: "delivery_fee", present: (o) => o.prices.fees.deliveryFee !== void 0, blocking: false },
    { name: "platform_fee", present: (o) => o.prices.fees.platformFee !== void 0, blocking: false },
    { name: "eta", present: (o) => o.attributes["eta_minutes"] !== void 0, blocking: false }
  ],
  grocery: [
    { name: "item", present: (o) => Boolean(o.title) },
    { name: "pack_size", present: (o) => Boolean(o.attributes["pack_size"] || o.attributes["quantity"]), blocking: false },
    { name: "outlet", present: (o) => Boolean(o.vendor) },
    { name: "price", present: (o) => o.prices.mandatoryTotal !== void 0 },
    { name: "currency", present: (o) => isSupportedCurrency(o.prices.currency) },
    { name: "delivery_fee", present: (o) => o.prices.fees.deliveryFee !== void 0, blocking: false },
    { name: "eta", present: (o) => o.attributes["eta_minutes"] !== void 0, blocking: false }
  ],
  flights: [
    { name: "route", present: (o) => Boolean(o.travel?.route) },
    { name: "dates", present: (o) => Boolean(o.travel?.date), blocking: false },
    { name: "airline", present: (o) => Boolean(o.vendor) },
    { name: "fare", present: (o) => o.prices.mandatoryTotal !== void 0, blocking: false },
    { name: "currency", present: (o) => isSupportedCurrency(o.prices.currency) },
    { name: "fare_conditions", present: (o) => Boolean(o.attributes["fare_conditions"]), blocking: false },
    { name: "baggage", present: (o) => Boolean(o.attributes["baggage"]), blocking: false }
  ],
  hotels: [
    { name: "property", present: (o) => Boolean(o.title) },
    { name: "dates", present: (o) => Boolean(o.travel?.date), blocking: false },
    { name: "room_type", present: (o) => Boolean(o.travel?.roomType || o.attributes["room_type"]), blocking: false },
    { name: "guests", present: (o) => Boolean(o.travel?.guests), blocking: false },
    { name: "payable_total", present: (o) => o.prices.effectivePrice !== void 0 || o.prices.mandatoryTotal !== void 0, blocking: false },
    { name: "currency", present: (o) => isSupportedCurrency(o.prices.currency) },
    { name: "cancellation_policy", present: (o) => Boolean(o.attributes["cancellation_policy"]), blocking: false }
  ],
  cab: [
    { name: "pickup", present: (o) => Boolean(o.attributes["pickup"] || o.location?.city) },
    { name: "destination", present: (o) => Boolean(o.attributes["drop"] || o.travel?.route) },
    { name: "fare", present: (o) => o.prices.mandatoryTotal !== void 0 },
    { name: "currency", present: (o) => isSupportedCurrency(o.prices.currency) },
    { name: "vehicle_type", present: (o) => Boolean(o.attributes["vehicle_type"]), blocking: false }
  ],
  loans: [
    { name: "lender", present: (o) => Boolean(o.vendor) },
    { name: "product", present: (o) => Boolean(o.title) },
    { name: "rate", present: (o) => o.attributes["interest_rate"] !== void 0 },
    { name: "indicative_flag", present: (o) => o.attributes["rate_type"] === "indicative" || o.attributes["rate_type"] === "approved", blocking: false }
  ],
  insurance: [
    { name: "insurer", present: (o) => Boolean(o.vendor) },
    { name: "plan", present: (o) => Boolean(o.title) },
    { name: "premium", present: (o) => o.prices.mandatoryTotal !== void 0, blocking: false },
    { name: "indicative_flag", present: (o) => o.attributes["quote_type"] === "indicative" || o.attributes["quote_type"] === "quoted", blocking: false }
  ],
  movies: [
    { name: "event", present: (o) => Boolean(o.title) },
    { name: "venue", present: (o) => Boolean(o.attributes["venue"] || o.vendor), blocking: false },
    { name: "show_date", present: (o) => Boolean(o.travel?.date || o.attributes["date"]), blocking: false },
    { name: "ticket_price", present: (o) => o.prices.mandatoryTotal !== void 0, blocking: false },
    { name: "currency", present: (o) => isSupportedCurrency(o.prices.currency) },
    { name: "convenience_fee", present: (o) => o.prices.fees.serviceFee !== void 0, blocking: false }
  ],
  bus: [
    { name: "route", present: (o) => Boolean(o.travel?.route) },
    { name: "travel_date", present: (o) => Boolean(o.travel?.date), blocking: false },
    { name: "operator", present: (o) => Boolean(o.vendor) },
    { name: "fare", present: (o) => o.prices.mandatoryTotal !== void 0 },
    { name: "seat_type", present: (o) => Boolean(o.travel?.seatType), blocking: false }
  ],
  // Non-comparison verticals (Section 11): real affiliate-campaign offers often carry
  // no expiry/eligibility/denomination fields. Missing optional facts downgrade the offer
  // to PARTIAL (truthfully labelled, ranked lower) instead of discarding legitimate data.
  coupons: [
    { name: "merchant", present: (o) => Boolean(o.vendor) },
    { name: "expiry", present: (o) => Boolean(o.expiresAt || o.attributes["expires_at"]), blocking: false },
    { name: "eligibility", present: (o) => Boolean(o.attributes["min_spend"] || o.attributes["eligibility"]), blocking: false },
    { name: "verified", present: (o) => o.attributes["verified"] === "true", blocking: false }
  ],
  giftcards: [
    { name: "merchant", present: (o) => Boolean(o.vendor) },
    { name: "denomination", present: (o) => o.attributes["denomination"] !== void 0, blocking: false },
    { name: "sale_price", present: (o) => o.prices.mandatoryTotal !== void 0, blocking: false },
    { name: "validity", present: (o) => Boolean(o.attributes["validity"]), blocking: false }
  ],
  banking: [
    { name: "bank", present: (o) => Boolean(o.vendor) },
    { name: "offer_terms", present: (o) => Boolean(o.title) },
    { name: "validity", present: (o) => Boolean(o.expiresAt || o.attributes["valid_to"]), blocking: false },
    { name: "min_spend", present: (o) => o.attributes["min_spend"] !== void 0, blocking: false }
  ]
};
function validateOffer(offer, query) {
  const rules = VERTICAL_RULES[offer.vertical] || [];
  const checks = [];
  const unverified = [];
  checks.push({
    name: "currency_supported",
    passed: isSupportedCurrency(offer.prices.currency),
    severity: "blocking",
    detail: `currency=${offer.prices.currency}`
  });
  if (offer.prices.currency !== "INR") {
    checks.push({
      name: "currency_inr_context",
      passed: false,
      severity: "warning",
      detail: "Non-INR offer shown in Indian market context \u2014 displayed with explicit currency"
    });
  }
  for (const rule of rules) {
    const present = rule.present(offer);
    checks.push({ name: rule.name, passed: present, severity: rule.blocking === false ? "warning" : "blocking" });
    if (!present) unverified.push(rule.name);
  }
  if (offer.availability === "out_of_stock") {
    checks.push({ name: "purchasable", passed: false, severity: "blocking", detail: "out_of_stock" });
  }
  if (offer.prices.mandatoryTotal !== void 0 && offer.prices.mandatoryTotal <= 0) {
    checks.push({ name: "price_positive", passed: false, severity: "blocking", detail: `price=${offer.prices.mandatoryTotal}` });
  }
  const blockingFailures = checks.filter((c) => !c.passed && c.severity === "blocking");
  const warningFailures = checks.filter((c) => !c.passed && c.severity === "warning");
  const status = blockingFailures.length > 0 ? "INVALID" : warningFailures.length > 0 ? "PARTIAL" : "VALID";
  const confidence = Math.max(0, Math.min(1, 1 - blockingFailures.length * 0.5 - warningFailures.length * 0.12));
  return { status, checks, confidence, unverified };
}

// server/pipeline/freshness.ts
var import_crypto13 = require("crypto");
function computeFreshness(offer, clock, policy, isLiveAcquisition, validated) {
  const now = Date.now();
  const fetched = new Date(clock.fetchedAt).getTime();
  const sourceUpdated = clock.sourceUpdatedAt ? new Date(clock.sourceUpdatedAt).getTime() : null;
  if (clock.expiresAt && new Date(clock.expiresAt).getTime() < now) return "EXPIRED";
  if (sourceUpdated && sourceUpdated > fetched) return "UNVERIFIED";
  if (validated && isLiveAcquisition && (now - fetched) / 1e3 <= policy.liveVerifiedTtlSec) return "LIVE_VERIFIED";
  if ((now - fetched) / 1e3 <= policy.freshTtlSec) return validated ? "FRESH" : "UNVERIFIED";
  if ((now - fetched) / 1e3 <= policy.maxStaleSec) return validated ? "AGING" : "STALE";
  return validated ? "STALE" : "EXPIRED";
}
function isServable(status) {
  return !["EXPIRED", "SOURCE_UNAVAILABLE", "INVALID", "UNKNOWN"].includes(status);
}
function isComparable(status) {
  return ["LIVE_VERIFIED", "FRESH", "CACHED_VERIFIED"].includes(status);
}
function buildEvidence(offer, raw) {
  return {
    offerId: offer.id,
    sourceId: offer.provenance.sourceId,
    sourceMethod: offer.provenance.sourceMethod,
    sourceUrl: raw.evidence?.sourceUrl || offer.sellerUrl,
    sourceReference: raw.evidence?.sourceReference,
    fetchedAt: raw.fetchedAt,
    extractedFields: raw.evidence?.extractedFields || [],
    evidenceHash: raw.evidence?.rawFingerprint || (0, import_crypto13.createHash)("sha256").update(raw.title).digest("hex")
  };
}

// server/pipeline/brandImage.ts
var AIRLINE_IATA = {
  "indigo": "6E",
  "spicejet": "SG",
  "air india": "AI",
  "air india express": "IX",
  "air-india express": "IX",
  "akasa air": "QP",
  "akasa": "QP",
  "vistara": "UK",
  "alliance air": "9I",
  "star air": "S5",
  "fly91": "IC",
  "emirates": "EK",
  "qatar airways": "QR",
  "etihad airways": "EY",
  "singapore airlines": "SQ",
  "thai airways": "TG",
  "british airways": "BA",
  "lufthansa": "LH",
  "air arabia": "G9",
  "flydubai": "FZ",
  "oman air": "WY",
  "airasia": "AK"
};
var BRAND_DOMAIN = [
  [/redbus/i, "redbus.in"],
  [/abhibus/i, "abhibus.com"],
  [/zingbus/i, "zingbus.com"],
  [/intrcity/i, "intrcity.com"],
  [/vrl/i, "vrlbus.in"],
  [/srs travels/i, "srsbooking.com"],
  [/savaari/i, "savaari.com"],
  [/quick ?ride/i, "quickride.in"],
  [/ola\b/i, "olacabs.com"],
  [/uber/i, "uber.com"],
  [/rapido/i, "rapido.bike"],
  [/cleartrip/i, "cleartrip.com"],
  [/airbnb/i, "airbnb.co.in"],
  [/makemytrip/i, "makemytrip.com"],
  [/goibibo/i, "goibibo.com"],
  [/booking\.com/i, "booking.com"],
  [/easemytrip/i, "easemytrip.com"],
  [/ixigo/i, "ixigo.com"],
  [/swiggy/i, "swiggy.com"],
  [/zomato/i, "zomato.com"],
  [/domino/i, "dominos.co.in"],
  [/bookmyshow/i, "bookmyshow.com"],
  [/ticketnew/i, "ticketnew.com"],
  [/cinepolis/i, "cinepolisindia.com"],
  [/district/i, "district.in"],
  [/pvr|inox/i, "pvrcinemas.com"],
  [/amazon/i, "amazon.in"],
  [/flipkart/i, "flipkart.com"],
  [/myntra/i, "myntra.com"],
  [/ajio/i, "ajio.com"],
  [/bankbazaar/i, "bankbazaar.com"],
  [/paisabazaar/i, "paisabazaar.com"],
  [/policybazaar/i, "policybazaar.com"],
  [/bajaj/i, "bajajfinserv.in"],
  [/money ?view/i, "moneyview.in"],
  [/kreditbee/i, "kreditbee.in"],
  [/hdfc ergo/i, "hdfcergo.com"],
  [/hdfc/i, "hdfcbank.com"],
  [/acko/i, "acko.com"],
  [/digit/i, "godigit.com"],
  [/insurancedekho/i, "insurancedekho.com"],
  [/sbi/i, "sbi.co.in"],
  [/icici/i, "icicibank.com"],
  [/axis/i, "axisbank.com"]
];
var DATA_HOST = /(^|\.)(githubusercontent|github|wikidata|wikipedia|openstreetmap|project-osrm|osrm)\./i;
function hostOf(u) {
  try {
    return u ? new URL(u).hostname.replace(/^www\./, "") : void 0;
  } catch {
    return void 0;
  }
}
function brandImageFor(o) {
  const attrs = o.attributes || {};
  if (o.vertical === "flights") {
    const code = String(attrs.airline_code || "").toUpperCase();
    const iata = /^[A-Z0-9]{2}$/.test(code) ? code : AIRLINE_IATA[String(attrs.airline || o.seller || "").toLowerCase().trim()];
    if (iata) return `https://www.gstatic.com/flights/airline_logos/70px/${iata}.png`;
  }
  const label = `${o.seller || ""} ${o.vendor || ""}`;
  let dom = BRAND_DOMAIN.find(([re]) => re.test(label))?.[1];
  if (!dom) {
    const h = hostOf(o.sellerUrl);
    if (h && !DATA_HOST.test(h)) dom = h;
  }
  return dom ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dom)}&sz=128` : void 0;
}
function withBrandImages(offers) {
  for (const o of offers) {
    const a = o.attributes || (o.attributes = {});
    if (a.image_url || a.image) continue;
    const img = brandImageFor(o);
    if (img) {
      a.image_url = img;
      a.image_is_brand_logo = "true";
    }
  }
  return offers;
}

// server/pipeline/entityMatching.ts
init_db();
init_logger();
function matchScore(offer, entity) {
  let score = 0;
  const reasons = [];
  const offerIds = Object.values(offer.identifiers || {});
  const entityIds = entity.identifiers ? entity.identifiers.split(",").map((s) => s.trim()) : [];
  const idHit = offerIds.find((id) => entityIds.includes(id));
  if (idHit) {
    score += 0.6;
    reasons.push(`shared identifier ${idHit}`);
  }
  const titleMatch = normalizedTitle(offer.title) === normalizedTitle(entity.name);
  if (titleMatch) {
    score += 0.25;
    reasons.push("exact normalized title");
  } else if (tokenOverlap(offer.title, entity.name) > 0.85) {
    score += 0.15;
    reasons.push("high token overlap");
  }
  if (offer.brand && entity.brand && offer.brand.toLowerCase() === entity.brand.toLowerCase()) {
    score += 0.15;
    reasons.push("brand match");
  }
  log.debug("Matching", `score=${score.toFixed(2)} for ${offer.title.slice(0, 50)}`, { reasons });
  return score;
}
function normalizedTitle(t) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function tokenOverlap(a, b) {
  const ta = new Set(normalizedTitle(a).split(" "));
  const tb = new Set(normalizedTitle(b).split(" "));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  return ta.size === 0 ? 0 : inter / ta.size;
}
async function resolveCanonicalEntity(offer) {
  const store2 = getStore();
  try {
    const rows = await store2.query(
      "SELECT id, name, brand FROM canonical_entities WHERE vertical = ? ORDER BY id DESC LIMIT 500",
      [offer.vertical]
    );
    let best = null;
    for (const row of rows) {
      const score = matchScore(offer, { name: row.name, brand: row.brand });
      if (score >= 0.6 && (!best || score > best.score)) best = { id: Number(row.id), score };
    }
    if (best && best.score >= 0.6) {
      return {
        canonicalEntityId: best.id,
        canonicalVariantId: null,
        matchState: best.score >= 0.75 ? "MATCHED" : "PROBABLE_MATCH",
        matchEvidence: `deterministic score ${best.score.toFixed(2)}`
      };
    }
    const res = await store2.execute(
      "INSERT INTO canonical_entities (vertical, name, brand) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)",
      [offer.vertical, offer.title.slice(0, 500), offer.brand || null]
    );
    return {
      canonicalEntityId: res.insertId,
      canonicalVariantId: null,
      matchState: "MATCHED",
      matchEvidence: "new canonical entity created from first observed offer"
    };
  } catch (e) {
    log.warn("Matching", "Entity resolution store failure", { error: String(e).slice(0, 120) });
    return { canonicalEntityId: null, canonicalVariantId: null, matchState: "REVIEW_REQUIRED", matchEvidence: "store unavailable" };
  }
}

// server/pipeline/ranking.ts
var FRESHNESS_WEIGHT = {
  LIVE_VERIFIED: 1,
  FRESH: 0.85,
  CACHED_VERIFIED: 0.75,
  AGING: 0.5,
  STALE: 0.25,
  PARTIAL: 0.1,
  EXPIRED: 0,
  UNVERIFIED: 0.1,
  SOURCE_UNAVAILABLE: 0,
  INVALID: 0,
  UNKNOWN: 0.1
};
function rankOffers(offers, opts = {}) {
  const reasons = /* @__PURE__ */ new Map();
  const scoreOf = (o) => {
    const rs = [];
    let score = 0;
    const fresh = FRESHNESS_WEIGHT[o.freshnessStatus] ?? 0;
    score += fresh * 30;
    rs.push(`freshness ${o.freshnessStatus} (+${(fresh * 30).toFixed(1)})`);
    score += o.confidence * 30;
    rs.push(`validation confidence ${o.confidence.toFixed(2)} (+${(o.confidence * 30).toFixed(1)})`);
    if (o.matchState === "MATCHED") {
      score += 10;
      rs.push("entity MATCHED (+10)");
    } else if (o.matchState === "PROBABLE_MATCH") {
      score += 5;
      rs.push("entity PROBABLE_MATCH (+5)");
    } else if (o.matchState === "REVIEW_REQUIRED") {
      score -= 5;
      rs.push("entity REVIEW_REQUIRED (-5)");
    }
    if (opts.userPincode && o.location?.pincode === opts.userPincode) {
      score += 8;
      rs.push("exact pincode match (+8)");
    } else if (opts.userCity && o.location?.city?.toLowerCase() === opts.userCity.toLowerCase()) {
      score += 4;
      rs.push("same city (+4)");
    }
    if (o.prices.verifiedSavings && o.prices.verifiedSavings > 0 && o.prices.mandatoryTotal) {
      const pct = o.prices.verifiedSavings / o.prices.mandatoryTotal;
      score += Math.min(10, pct * 40);
      rs.push(`verified savings ${pct.toFixed(2)} (+${Math.min(10, pct * 40).toFixed(1)})`);
    }
    if (o.availability === "out_of_stock") {
      score -= 40;
      rs.push("out of stock (-40, never ranked purchasable)");
    }
    if (o.validationStatus === "INVALID") {
      score -= 50;
      rs.push("INVALID validation (-50)");
    }
    reasons.set(o.id, rs);
    return score;
  };
  const ranked = offers.filter((o) => o.validationStatus !== "INVALID").map((o) => ({ o, score: scoreOf(o) })).sort((a, b) => b.score - a.score);
  const byEntity = /* @__PURE__ */ new Map();
  for (const entry of ranked) {
    const key = String(entry.o.canonicalEntityId || `unmatched:${entry.o.id}`);
    if (!byEntity.has(key)) byEntity.set(key, []);
    byEntity.get(key).push(entry);
  }
  for (const group of byEntity.values()) {
    if (group.length > 1 && group.every((g) => g.o.prices.effectivePrice !== void 0)) {
      group.sort((a, b) => a.o.prices.effectivePrice - b.o.prices.effectivePrice || b.score - a.score);
    }
  }
  let ordered = [...byEntity.values()].flat();
  const SERVICE_VERTICALS = /* @__PURE__ */ new Set(["loans", "insurance", "flights", "hotels", "bus", "cab", "movies"]);
  const verticalSet = new Set(ordered.map((x) => x.o.vertical));
  if (verticalSet.size === 1 && SERVICE_VERTICALS.has([...verticalSet][0])) {
    const tier = (x) => isComparable(x.o.freshnessStatus) ? 0 : 1;
    ordered = ordered.sort((a, b) => tier(a) - tier(b) || (a.o.prices.effectivePrice ?? Infinity) - (b.o.prices.effectivePrice ?? Infinity) || b.score - a.score);
  }
  return ordered.map(({ o }, i) => ({
    ...o,
    rank: i + 1,
    rankReasons: reasons.get(o.id) || []
  }));
}

// server/verticals/verticalEngine.ts
var NON_COMPARISON_VERTICALS = [
  "coupons",
  "giftcards",
  "banking",
  // Listing/discovery verticals: the queried entity (dish, city, insurer, route) is not
  // part of the offer title, so title-token filtering would wrongly drop real results.
  "food",
  "hotels",
  "flights",
  "bus",
  "cab",
  "insurance",
  "loans",
  "movies"
];
function filterByQueryEntity(offers, query) {
  if (!query.entityName) return offers;
  const tokens = query.entityName.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return offers;
  if ((query.intent === "browse" || tokens.length > 2) && offers.length > 0 && offers.every((o) => NON_COMPARISON_VERTICALS.includes(o.vertical))) {
    return offers;
  }
  return offers.filter((o) => {
    const text = `${o.title} ${o.vendor || ""}`.toLowerCase();
    const hits = tokens.filter((t) => text.includes(t)).length;
    return hits >= Math.ceil(tokens.length / 2);
  });
}
var PLACE_ALIASES = {
  "new delhi": "delhi",
  "bengaluru": "bangalore",
  "bombay": "mumbai",
  "calcutta": "kolkata",
  "madras": "chennai",
  "gurugram": "gurgaon",
  "poona": "pune",
  "baroda": "vadodara"
};
var PLACE_NOISE = /\b(flight|flights|bus|buses|cab|cabs|taxi|ticket|tickets|book|booking|fare|fares|price|prices|from|cheapest|cheap|direct|return|one-way|oneway|airport|volvo|sleeper|ac|non-ac|hotel|hotels|in|near|around|at|on|for|tomorrow|today|tonight|night|morning|evening|next\s+\w+|this\s+\w+)\b/gi;
function normPlace(x) {
  const code = x.match(/\(([A-Za-z]{3})\)/)?.[1]?.toLowerCase();
  let t = x.replace(/\([^)]*\)/g, " ").replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi, " ").replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, " ").replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ").replace(PLACE_NOISE, " ").replace(/[,.]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  t = PLACE_ALIASES[t] || t;
  return { code, city: t };
}
var IATA_CODES = /* @__PURE__ */ new Set(["DEL", "BOM", "BLR", "HYD", "MAA", "CCU", "PNQ", "AMD", "JAI", "GOI", "LKO", "NAG", "IDR", "STV", "PAT", "BHO", "CJB", "COK", "GAU", "IXC", "DED", "ATQ", "VNS", "SXR", "TRV", "VTZ", "IXM", "UDR", "JDH", "IXR", "RPR", "BBI", "IMF", "IXL", "IXB", "IXU", "IXE", "BDQ", "RAJ", "IXJ", "IXD", "GOP", "JRG", "DIB", "TEZ", "KNU", "MYQ", "HBX", "IXG", "KLH", "ISK", "SAG", "TIR", "DXB", "SIN", "LHR", "JFK", "BKK", "KUL", "DOH", "AUH", "SHJ"]);
function withBracketedCodes(raw) {
  return raw.replace(/\b([a-zA-Z][a-zA-Z.]{2,})\s+([A-Za-z]{3})\b(?!\s*\))/g, (full, city, code) => IATA_CODES.has(code.toUpperCase()) && !/^(to|from|and|the|via)$/i.test(city) ? `${city} (${code.toUpperCase()})` : full);
}
function parseRouteQuery(raw) {
  raw = withBracketedCodes(raw);
  const m = raw.match(/([a-zA-Z][a-zA-Z\s.]{1,28}?(?:\s*\([A-Za-z]{3}\))?)\s+(?:to|→|->|-)\s+([a-zA-Z][a-zA-Z\s.]{1,28}(?:\s*\([A-Za-z]{3}\))?)/);
  if (!m) return null;
  const from = normPlace(m[1].replace(/^\s*from\s+/i, "")), to = normPlace(m[2]);
  if (!from.city || !to.city) return null;
  return { from, to };
}
function placeHit(text, side) {
  const s = (text || "").toLowerCase();
  const alias = Object.entries(PLACE_ALIASES).filter(([, v]) => v === side.city).map(([k]) => k);
  return !!(side.code && new RegExp(`\\b${side.code}\\b`, "i").test(s) || side.city && (s.includes(side.city) || alias.some((a) => s.includes(a))));
}
function routeFilter(offers, query) {
  const rt = parseRouteQuery(query.rawQuery || "");
  if (!rt) return offers;
  return offers.filter((o) => {
    const r = String(o.travel?.route || o.attributes?.["route"] || "").toLowerCase();
    if (!r) return false;
    const [src2 = "", dst = ""] = r.split(/\s+(?:to|→|->)\s+/);
    return placeHit(src2, rt.from) && placeHit(dst, rt.to);
  });
}
function destinationFilter(offers, query) {
  const head = String(query.rawQuery || "").split(",")[0];
  const q3 = normPlace(head);
  const city = (query.location?.city || "").toLowerCase();
  const target = q3.city || city;
  if (!target) return offers;
  const names = /* @__PURE__ */ new Set([target]);
  for (const [k, v] of Object.entries(PLACE_ALIASES)) {
    if (v === target) names.add(k);
    if (k === target) names.add(v);
  }
  for (const g of [["delhi", "new delhi"], ["mysuru", "mysore"], ["puducherry", "pondicherry"], ["prayagraj", "allahabad"], ["kochi", "cochin"], ["thiruvananthapuram", "trivandrum"], ["mangaluru", "mangalore"], ["visakhapatnam", "vizag"]]) {
    if (g.includes(target)) g.forEach((x) => names.add(x));
  }
  return offers.filter((o) => {
    const hay = `${o.location?.city || ""} ${o.attributes?.["destination"] || ""} ${o.attributes?.["city"] || ""} ${o.title}`.toLowerCase();
    for (const n of names) if (hay.includes(n)) return true;
    return false;
  });
}
function travelFilter(offers, query) {
  if (!query.travelDates?.depart) return offers;
  return offers.filter((o) => !o.travel?.date || o.travel.date === query.travelDates.depart);
}
var VerticalEngine = class {
  constructor(config) {
    this.config = config;
  }
  async execute(offers, query) {
    let out = offers.filter((o) => o.vertical === this.config.vertical);
    out = filterByQueryEntity(out, query);
    out = travelFilter(out, query);
    if (this.config.postProcess) out = this.config.postProcess(out, query);
    return out;
  }
};
var EcommerceEngine = class extends VerticalEngine {
  constructor() {
    super({
      vertical: "ecommerce",
      displayName: "E-Commerce / Shopping",
      postProcess: (offers, query) => {
        const cfg = query.configuration;
        if (!cfg) return offers;
        return offers.map((o) => {
          const attrs = o.attributes || {};
          let matchesConfig = true;
          for (const [k, v] of Object.entries(cfg)) {
            if (attrs[k] && attrs[k].toLowerCase() !== String(v).toLowerCase()) matchesConfig = false;
          }
          return { ...o, matchState: matchesConfig && o.matchState === "MATCHED" ? "MATCHED" : matchesConfig ? o.matchState : "NOT_MATCHED" };
        });
      }
    });
  }
};
var FlightEngine = class extends VerticalEngine {
  constructor() {
    super({
      vertical: "flights",
      displayName: "Flights",
      // ONLY offers for the typed route may be shown (a cached Delhi->Mumbai fare must never
      // appear for a Patna->Delhi search).
      postProcess: (offers, query) => routeFilter(offers, query)
    });
  }
};
var HotelEngine = class extends VerticalEngine {
  constructor() {
    super({ vertical: "hotels", displayName: "Hotels", postProcess: (offers, query) => destinationFilter(offers, query).map((o) => {
      return { ...o, attributes: { ...o.attributes, unit: o.attributes["unit"] || "per night" } };
    }) });
  }
};
var CabEngine = class extends VerticalEngine {
  constructor() {
    super({
      vertical: "cab",
      displayName: "Cabs & Mobility",
      postProcess: (offers, query) => routeFilter(offers, query).map((o) => ({
        ...o,
        // Stale fares are never presented as guaranteed booking prices (Section 12)
        attributes: { ...o.attributes, fare_type: o.freshnessStatus === "LIVE_VERIFIED" ? "live_estimate" : "indicative_only" }
      }))
    });
  }
};
var LoanEngine = class extends VerticalEngine {
  constructor() {
    super({ vertical: "loans", displayName: "Loans & Credit", postProcess: (offers) => offers.map((o) => ({
      ...o,
      // Indicative rates are distinguished from approved offers
      attributes: { ...o.attributes, rate_type: o.attributes["rate_type"] || "indicative" }
    })) });
  }
};
var InsuranceEngine = class extends VerticalEngine {
  constructor() {
    super({ vertical: "insurance", displayName: "Insurance", postProcess: (offers) => offers.map((o) => ({
      ...o,
      attributes: { ...o.attributes, quote_type: o.attributes["quote_type"] || "indicative" }
    })) });
  }
};
var MovieEventEngine = class extends VerticalEngine {
  constructor() {
    super({ vertical: "movies", displayName: "Movies & Events" });
  }
};
var BusEngine = class extends VerticalEngine {
  constructor() {
    super({ vertical: "bus", displayName: "Bus Travel", postProcess: (offers, query) => routeFilter(offers, query) });
  }
};
var FoodDeliveryEngine = class extends VerticalEngine {
  constructor() {
    super({ vertical: "food", displayName: "Food Delivery" });
  }
};
var QuickGroceryEngine = class extends VerticalEngine {
  constructor() {
    super({ vertical: "grocery", displayName: "Quick Grocery" });
  }
};
var CouponEngine = class extends VerticalEngine {
  constructor() {
    super({ vertical: "coupons", displayName: "Coupons & Promo Codes", postProcess: (offers) => offers.filter((o) => {
      return o.freshnessStatus !== "EXPIRED";
    }) });
  }
};
var GiftCardEngine = class extends VerticalEngine {
  constructor() {
    super({ vertical: "giftcards", displayName: "Gift Cards" });
  }
};
var BankingOfferEngine = class extends VerticalEngine {
  constructor() {
    super({ vertical: "banking", displayName: "Credit Card & Banking Offers" });
  }
};
var ENGINES = {
  ecommerce: new EcommerceEngine(),
  flights: new FlightEngine(),
  hotels: new HotelEngine(),
  cab: new CabEngine(),
  loans: new LoanEngine(),
  insurance: new InsuranceEngine(),
  movies: new MovieEventEngine(),
  bus: new BusEngine(),
  food: new FoodDeliveryEngine(),
  grocery: new QuickGroceryEngine(),
  coupons: new CouponEngine(),
  giftcards: new GiftCardEngine(),
  banking: new BankingOfferEngine()
};
function getVerticalEngine(vertical) {
  return ENGINES[vertical];
}

// server/catalogue/catalogueService.ts
init_db();
init_logger();
async function persistOffer(offer, raw, source) {
  const store2 = getStore();
  try {
    const res = await store2.execute(
      `INSERT INTO offers (
         canonical_entity_id, vertical, title, brand, identifiers, attributes, vendor, seller, seller_url,
         location_pincode, location_city, list_price, mandatory_total, effective_price, verified_savings,
         currency, fees, availability, match_state, freshness_status, validation_status, confidence,
         source_id, source_method, source_url, fetched_at, validated_at, expires_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        offer.canonicalEntityId,
        offer.vertical,
        offer.title,
        offer.brand,
        JSON.stringify(offer.identifiers),
        JSON.stringify(offer.attributes),
        offer.vendor,
        offer.seller,
        offer.sellerUrl,
        offer.location?.pincode || null,
        offer.location?.city || null,
        offer.prices.listPrice ?? null,
        offer.prices.mandatoryTotal ?? null,
        offer.prices.effectivePrice ?? null,
        offer.prices.verifiedSavings ?? 0,
        offer.prices.currency,
        JSON.stringify(offer.prices.fees),
        offer.availability,
        offer.matchState,
        offer.freshnessStatus,
        offer.validationStatus,
        offer.confidence,
        source.id,
        source.method,
        offer.provenance.sourceUrl || raw.evidence?.sourceUrl || null,
        offer.provenance.fetchedAt,
        offer.provenance.validatedAt || null,
        offer.expiresAt || null
      ]
    );
    const evidence = buildEvidence(offer, raw);
    try {
      await store2.execute(
        `INSERT INTO source_evidence (offer_id, source_id, source_method, source_url, source_reference, fetched_at, extracted_fields, evidence_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          res.insertId || 0,
          evidence.sourceId,
          evidence.sourceMethod,
          evidence.sourceUrl || null,
          evidence.sourceReference || null,
          evidence.fetchedAt,
          JSON.stringify(evidence.extractedFields),
          evidence.evidenceHash
        ]
      );
    } catch {
    }
    return res.insertId || 0;
  } catch (e) {
    log.warn("Catalogue", "Offer persist failed", { error: String(e).slice(0, 150) });
    return 0;
  }
}
async function recordPriceSnapshot(offer, rowId) {
  const store2 = getStore();
  try {
    await store2.execute(
      `INSERT INTO price_history (offer_id, canonical_entity_id, mandatory_total, effective_price, currency, source_id, freshness_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        rowId || 0,
        offer.canonicalEntityId,
        offer.prices.mandatoryTotal ?? null,
        offer.prices.effectivePrice ?? null,
        offer.prices.currency,
        offer.provenance.sourceId,
        offer.freshnessStatus
      ]
    );
  } catch {
  }
}
async function findCatalogueOffers(vertical, opts = {}) {
  const store2 = getStore();
  try {
    const params = [vertical];
    let where = "vertical = ? AND validation_status != ?";
    params.push("INVALID");
    if (opts.pincode) {
      where += " AND (location_pincode = ? OR location_pincode IS NULL)";
      params.push(opts.pincode);
    } else if (opts.city) {
      where += " AND (location_city = ? OR location_city IS NULL)";
      params.push(opts.city);
    }
    params.push(opts.limit ?? 50);
    return await store2.query(
      `SELECT id, vertical, title, vendor, seller, location_pincode, location_city, mandatory_total, effective_price,
              currency, availability, freshness_status, validation_status, confidence, fetched_at, source_id, canonical_entity_id
       FROM offers WHERE ${where} ORDER BY fetched_at DESC LIMIT ?`,
      params
    );
  } catch (e) {
    log.debug("Catalogue", "Lookup failed (store unavailable)", { error: String(e).slice(0, 100) });
    return [];
  }
}

// server/affiliate/affiliateNetwork.ts
init_settings();
init_logger();
init_db();
var CuelinksAdapter = class {
  constructor() {
    this.id = "cuelinks";
    this.name = "Cuelinks";
  }
  buildDeepLink(destinationUrl, _vendorDomain) {
    const apiKey = settings.cuelinks.apiKey;
    const template = settings.cuelinks.campaignId ? `https://linksredirect.com/cuelink?type=nl&subid=${settings.cuelinks.subId}&campaign=${settings.cuelinks.campaignId}&url={DESTINATION}` : null;
    if (!apiKey || !template) return null;
    return template.replace("{DESTINATION}", encodeURIComponent(destinationUrl));
  }
};
var NETWORKS = [new CuelinksAdapter()];
async function attachAffiliateDeepLinks(offers) {
  return offers.map((o) => {
    const dest = o.sellerUrl || o.provenance.sourceUrl || null;
    if (!dest) return o;
    const domain = safeDomain(dest);
    for (const network of NETWORKS) {
      const link = network.buildDeepLink(dest, domain);
      if (link) {
        o.affiliate = { network: network.id, deepLink: link, subId: settings.cuelinks.subId || void 0 };
        break;
      }
    }
    return o;
  });
}
function safeDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// server/search/searchOrchestrator.ts
function rowToOffer(row, isLiveNow) {
  const status = row.freshness_status === "LIVE_VERIFIED" ? "CACHED_VERIFIED" : row.freshness_status;
  return {
    id: `cat_${row.id}`,
    canonicalEntityId: row.canonical_entity_id ?? null,
    canonicalVariantId: null,
    vertical: row.vertical,
    title: row.title,
    identifiers: {},
    attributes: {},
    vendor: row.vendor,
    seller: row.seller,
    location: { pincode: row.location_pincode || void 0, city: row.location_city || void 0 },
    prices: {
      listPrice: row.mandatory_total ?? void 0,
      mandatoryTotal: row.mandatory_total ?? void 0,
      effectivePrice: row.effective_price ?? void 0,
      currency: row.currency,
      fees: {}
    },
    availability: row.availability || "unknown",
    matchState: "MATCHED",
    freshnessStatus: isServable(status) ? status : "STALE",
    validationStatus: row.validation_status || "PARTIAL",
    confidence: Number(row.confidence) || 0.5,
    provenance: {
      sourceId: row.source_id,
      sourceMethod: "cached_catalogue",
      adapterVersion: "-",
      parserVersion: "-",
      fetchedAt: row.fetched_at
    }
  };
}
function searchCacheTtl(vertical) {
  if (["flights", "hotels", "bus", "cab", "movies"].includes(vertical)) return { ttlSec: 300, staleSec: 900 };
  return { ttlSec: 900, staleSec: 2700 };
}
async function runSearch(input) {
  const totalStart = Date.now();
  let parsed = understandQuery(input.query, {
    pincode: input.pincode,
    city: input.city,
    lat: input.lat,
    lng: input.lng
  });
  if (input.vertical) parsed.vertical = input.vertical;
  if (input.travelDates?.depart) parsed.travelDates = { ...parsed.travelDates, depart: input.travelDates.depart, ...input.travelDates.return ? { return: input.travelDates.return } : {} };
  if (input.guests) parsed.parties = { ...parsed.parties, guests: input.guests };
  if (input.locality) parsed.location = { ...parsed.location, locality: input.locality };
  if (parsed.verticalConfidence < 0.6 || !parsed.vertical) {
    parsed = await aiAssistedUnderstanding(parsed);
  }
  const vertical = parsed.vertical || "ecommerce";
  parsed.vertical = vertical;
  const state = {
    servedFrom: "unavailable",
    sourcesAttempted: [],
    sourcesSucceeded: [],
    sourcesFailed: [],
    reusedCatalogue: false,
    triggeredRefresh: false
  };
  const cacheKey = buildCacheKey({
    vertical,
    q: input.query,
    pin: input.pincode,
    city: input.city,
    dates: parsed.travelDates?.depart,
    pax: parsed.parties?.passengers || parsed.parties?.guests,
    cfg: parsed.configuration ? JSON.stringify(parsed.configuration) : ""
  });
  const { ttlSec, staleSec } = searchCacheTtl(vertical);
  const cachedSearch = await cacheGet(cacheKey);
  if (cachedSearch.value) {
    const v = cachedSearch.value;
    for (const o of v.results) {
      if (o.freshnessStatus === "LIVE_VERIFIED") o.freshnessStatus = "CACHED_VERIFIED";
      if (o.provenance) o.provenance.replayedFromCache = true;
    }
    v.state.servedFrom = "cache";
    v.state.reusedCache = true;
    v.latencyMs = Date.now() - totalStart;
    v.totalSearchLatencyMs = v.latencyMs;
    if (!cachedSearch.fresh) {
      revalidateInBackground(cacheKey, ttlSec, () => runLivePipeline(input, parsed));
    }
    return v;
  }
  const response = await runLivePipeline(input, parsed);
  cachePut(cacheKey, response, ttlSec, staleSec);
  return response;
}
async function runLivePipeline(input, parsedIn) {
  const totalStart = Date.now();
  let parsed = parsedIn ?? understandQuery(input.query, {
    pincode: input.pincode,
    city: input.city,
    lat: input.lat,
    lng: input.lng
  });
  if (input.vertical) parsed.vertical = input.vertical;
  if (input.travelDates?.depart) parsed.travelDates = { ...parsed.travelDates, depart: input.travelDates.depart, ...input.travelDates.return ? { return: input.travelDates.return } : {} };
  if (input.guests) parsed.parties = { ...parsed.parties, guests: input.guests };
  if (input.locality) parsed.location = { ...parsed.location, locality: input.locality };
  if (!parsedIn && (parsed.verticalConfidence < 0.6 || !parsed.vertical)) {
    parsed = await aiAssistedUnderstanding(parsed);
  }
  const vertical = parsed.vertical || "ecommerce";
  parsed.vertical = vertical;
  const state = {
    servedFrom: "unavailable",
    sourcesAttempted: [],
    sourcesSucceeded: [],
    sourcesFailed: [],
    reusedCatalogue: false,
    triggeredRefresh: false
  };
  const catalogueRows = await findCatalogueOffers(vertical, { pincode: input.pincode, city: input.city, limit: 40 });
  const now = Date.now();
  const eligible = catalogueRows.filter((r) => {
    const ageSec = (now - new Date(r.fetched_at).getTime()) / 1e3;
    return ageSec < 3600 && r.validation_status !== "INVALID";
  });
  const catalogueOffers = eligible.map((r) => rowToOffer(r, false));
  const hasEligibleFresh = catalogueOffers.length > 0;
  const enabledSources = selectSources(parsed);
  state.reusedCatalogue = hasEligibleFresh;
  state.triggeredRefresh = !hasEligibleFresh || eligible.length < 5;
  let liveOffers = [];
  if (enabledSources.length > 0) {
    const outcome = await acquireParallel(parsed, { maxSources: 16 });
    state.sourcesAttempted = outcome.attempted;
    state.sourcesSucceeded = outcome.succeeded;
    state.sourcesFailed = outcome.failed.map((f) => ({ sourceId: f.sourceId, failureClass: f.failureClass, error: f.error }));
    liveOffers = await processAdapterResults(outcome.results, parsed);
  } else {
    state.sourcesAttempted = [];
  }
  const liveIdentity = (o) => `${o.vertical}|${o.title.toLowerCase()}|${o.seller.toLowerCase()}|${o.travel?.date || ""}|${o.travel?.route || ""}`;
  const liveKeys = new Set(liveOffers.map(liveIdentity));
  const supplementary = catalogueOffers.filter((o) => !liveKeys.has(liveIdentity(o)));
  let combined = dedupeOffers([...liveOffers, ...supplementary]);
  const engine = getVerticalEngine(vertical);
  combined = await engine.execute(combined, parsed);
  combined = await attachAffiliateDeepLinks(combined);
  const ranked = rankOffers(withBrandImages(combined), { userPincode: input.pincode, userCity: input.city });
  if (ranked.length === 0) {
    state.servedFrom = "unavailable";
    state.honestNotice = enabledSources.length === 0 ? "No data sources are enabled and verified for this vertical yet. Real results appear once a source is configured and passes validation \u2014 we never show invented prices." : "All configured sources were attempted but returned no verified offers for this query. Partial or cached data appears only when it passes freshness rules.";
  } else if (state.sourcesSucceeded.length > 0) {
    state.servedFrom = "live";
  } else if (hasEligibleFresh) {
    state.servedFrom = "catalogue";
  } else {
    state.servedFrom = "partial";
  }
  const response = {
    query: parsed,
    results: ranked,
    state,
    latencyMs: Date.now() - totalStart,
    totalSearchLatencyMs: Date.now() - totalStart
  };
  void recordSearchMetrics(input, parsed, response);
  return response;
}
async function processAdapterResults(results, parsed) {
  const { getSource: getSource2 } = await Promise.resolve().then(() => (init_registry(), registry_exports));
  const out = [];
  for (const result of results) {
    const source = getSource2(result.sourceId);
    if (!source) continue;
    for (const raw of result.rawItems) {
      try {
        const offer = normalizeOffer(raw, source, parsed.vertical || "ecommerce");
        const parsedLoc = Object.fromEntries(
          Object.entries(parsed.location || {}).filter(([, v]) => v !== void 0 && v !== null && v !== "")
        );
        offer.location = { ...offer.location, ...parsedLoc };
        const breakdown = computeEffectivePrice(offer.prices.fees, offer.prices.currency, { coupon: false, bank: false, cashback: false, giftCard: false });
        offer.prices.mandatoryTotal = breakdown.mandatoryTotal;
        offer.prices.effectivePrice = breakdown.effectivePrice;
        offer.prices.finalPayablePrice = breakdown.finalPayablePrice;
        offer.prices.listPrice = breakdown.listPrice;
        offer.prices.verifiedSavings = breakdown.verifiedSavings;
        const validation = validateOffer(offer, parsed);
        offer.validationStatus = validation.status;
        offer.confidence = validation.confidence;
        if (validation.status === "INVALID") continue;
        const match = await resolveCanonicalEntity(offer);
        offer.canonicalEntityId = match.canonicalEntityId;
        offer.canonicalVariantId = match.canonicalVariantId;
        offer.matchState = match.matchState;
        offer.matchEvidence = match.matchEvidence;
        const policy = source.freshnessPolicy;
        offer.freshnessStatus = computeFreshness(
          offer,
          { fetchedAt: raw.fetchedAt },
          policy,
          true,
          // Core-verified: no blocking failure and only non-blocking gaps (e.g. an unknown
          // delivery fee, which stays unknown — never invented). The price itself was just
          // acquired live, so it is LIVE_VERIFIED; the missing fee remains labelled unknown.
          validation.status === "VALID" || validation.status === "PARTIAL"
        );
        offer.provenance.validatedAt = (/* @__PURE__ */ new Date()).toISOString();
        if (!isServable(offer.freshnessStatus)) continue;
        if (source.permittedForRetention) {
          const rowId = await persistOffer(offer, raw, source);
          await recordPriceSnapshot(offer, rowId);
        }
        out.push(offer);
      } catch (e) {
        log.debug("Search", "Offer processing rejected an item", { error: String(e).slice(0, 120) });
      }
    }
  }
  return out;
}
async function recordSearchMetrics(input, parsed, response) {
  try {
    const { getStore: getStore2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    await getStore2().execute(
      `INSERT INTO searches (raw_query, vertical, detected_vertical, pincode, city, served_from, results_count, latency_ms, first_result_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.query.slice(0, 500),
        input.vertical || null,
        parsed.vertical,
        input.pincode || null,
        input.city || null,
        response.state.servedFrom,
        response.results.length,
        response.latencyMs,
        response.latencyMs
      ]
    );
  } catch {
  }
}

// server/cron/warm.ts
init_logger();
var SEED_QUERIES = [
  { query: "mobile phone", vertical: "ecommerce" },
  { query: "milk", vertical: "grocery", city: "Indore" },
  { query: "biryani", vertical: "food", city: "Indore" },
  { query: "movies", vertical: "movies", city: "Indore" },
  { query: "Indore to Bhopal", vertical: "bus", city: "Indore" },
  { query: "Indore to Bhopal", vertical: "cab", city: "Indore" },
  { query: "Indore (IDR) to Delhi (DEL)", vertical: "flights", city: "Indore" },
  { query: "Indore", vertical: "hotels", city: "Indore" },
  { query: "personal loan", vertical: "loans" },
  { query: "health insurance", vertical: "insurance" },
  { query: "iphone", vertical: "ecommerce" },
  { query: "pizza", vertical: "food", city: "Indore" },
  { query: "delhi to jaipur", vertical: "bus" },
  { query: "goa", vertical: "hotels" }
];
async function warmRows(rows, tag) {
  let ok = 0;
  for (const r of rows) {
    try {
      const res = await runSearch({
        query: String(r.raw_query || r.query || ""),
        vertical: r.v || r.vertical ? String(r.v || r.vertical) : void 0,
        pincode: r.pincode ? String(r.pincode) : void 0,
        city: r.city ? String(r.city) : void 0
      });
      ok += 1;
      log.info(tag, "Warmed", { query: r.raw_query || r.query, vertical: r.v || r.vertical, results: res.results.length, servedFrom: res.state.servedFrom });
    } catch (e) {
      log.warn(tag, "Warm pass failed (continuing)", { query: r.raw_query || r.query, error: String(e?.message || e).slice(0, 120) });
    }
  }
  log.info(tag, `Warmer finished: ${ok}/${rows.length} queries warmed`);
}
async function bootWarm() {
  try {
    const store2 = getStore();
    const rows = await store2.query(
      `SELECT raw_query, COALESCE(detected_vertical, vertical) AS v, pincode, city
       FROM searches WHERE created_at > (NOW() - INTERVAL 7 DAY)
       GROUP BY raw_query, v, pincode, city
       ORDER BY COUNT(*) DESC LIMIT 6`
    ).catch(() => []);
    const targets = rows.length > 0 ? rows : SEED_QUERIES.slice(0, 6);
    log.info("Cron", `Boot-warm starting (${targets.length} queries, background)`);
    void warmRows(targets, "BootWarm");
  } catch (e) {
    log.warn("Cron", "Boot-warm skipped", { error: String(e?.message || e).slice(0, 100) });
  }
}
async function main() {
  const args = process.argv.slice(2);
  const limit = Number((args.find((a) => a.startsWith("--limit=")) || "--limit=20").split("=")[1]);
  const verticalFilter = args.find((a) => a.startsWith("--vertical="))?.split("=")[1];
  await runMigrations();
  const store2 = getStore();
  const rows = await store2.query(
    `SELECT raw_query, COALESCE(detected_vertical, vertical) AS v, pincode, city, COUNT(*) AS n
     FROM searches
     WHERE created_at > (NOW() - INTERVAL 7 DAY)
     ${verticalFilter ? "AND COALESCE(detected_vertical, vertical) = ?" : ""}
     GROUP BY raw_query, v, pincode, city
     ORDER BY n DESC
     LIMIT ?`,
    verticalFilter ? [verticalFilter, limit] : [limit]
  );
  const useSeed = rows.length === 0 || args.includes("--seed");
  if (rows.length === 0 && !useSeed) {
    log.info("Cron", "Warmer: no recent queries to warm yet");
    process.exit(0);
  }
  if (useSeed) {
    log.info("Cron", `Warmer: pre-warming ${SEED_QUERIES.length} seed queries (fresh install / --seed)`);
    await warmRows(SEED_QUERIES, "Cron");
    process.exit(0);
  }
  await warmRows(rows, "Cron");
  process.exit(0);
}
main().catch((e) => {
  log.error("Cron", "Warmer crashed", { error: String(e) });
  process.exit(1);
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  bootWarm
});
