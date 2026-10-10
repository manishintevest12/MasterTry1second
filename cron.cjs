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
      process.env.DATA_DIR || (process.env.NODE_ENV === "test" ? `.data/test-${process.pid}` : ".data")
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
        connectTimeout: 8e3
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
function seedSources() {
  return [
    // ---- Direct HTTP (legit public pages; subject to their ToS) ----
    src({ id: "http_amazon_in", name: "Amazon.in Product Page (direct HTTP)", method: "direct_http", verticals: ["ecommerce"], priority: 10 }),
    src({ id: "http_flipkart", name: "Flipkart Product Page (direct HTTP)", method: "direct_http", verticals: ["ecommerce"], priority: 11 }),
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
    })
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
    DEFAULT_FRESHNESS = { liveVerifiedTtlSec: 900, freshTtlSec: 3600, maxStaleSec: 86400 };
    sources = seedSources();
  }
});

// server/cron/warm.ts
init_db();

// server/common/cache.ts
var import_crypto = __toESM(require("crypto"), 1);
init_settings();
init_logger();
var l1 = /* @__PURE__ */ new Map();
var inflight = /* @__PURE__ */ new Map();
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
function buildCacheKey(parts) {
  const normalized = Object.keys(parts).sort().map((k) => `${k}=${parts[k] ?? ""}`).join("|");
  return import_crypto.default.createHash("sha1").update(normalized).digest("hex").slice(0, 32);
}
async function cached(key, ttlSec, loader, opts = {}) {
  const now = Date.now();
  const l1e = l1.get(key);
  if (l1e && l1e.expiresAt > now) {
    return { value: l1e.value, fresh: true, stale: false };
  }
  if (l1e && opts.allowStale !== false && l1e.staleUntil > now) {
    if (!inflight.has(key)) {
      inflight.set(key, loader().then((v) => {
        l1.set(key, { value: v, expiresAt: Date.now() + ttlSec * 1e3, staleUntil: Date.now() + (opts.staleWhileRevalidateSec ?? ttlSec * 3) * 1e3 });
        return v;
      }).finally(() => inflight.delete(key)));
    }
    return { value: l1e.value, fresh: false, stale: true };
  }
  if (inflight.has(key)) {
    const v = await inflight.get(key);
    return { value: v, fresh: true, stale: false };
  }
  const p = (async () => {
    const r = await getRedis();
    if (r) {
      try {
        const raw = await r.get(`t1s:${key}`);
        if (raw) {
          const value2 = JSON.parse(raw);
          l1.set(key, { value: value2, expiresAt: now + ttlSec * 1e3, staleUntil: now + (opts.staleWhileRevalidateSec ?? ttlSec * 3) * 1e3 });
          return value2;
        }
      } catch {
      }
    }
    const value = await loader();
    l1.set(key, { value, expiresAt: Date.now() + ttlSec * 1e3, staleUntil: Date.now() + (opts.staleWhileRevalidateSec ?? ttlSec * 3) * 1e3 });
    if (r) {
      try {
        await r.set(`t1s:${key}`, JSON.stringify(value), "EX", ttlSec);
      } catch {
      }
    }
    return value;
  })();
  inflight.set(key, p);
  try {
    const v = await p;
    return { value: v, fresh: true, stale: false };
  } finally {
    inflight.delete(key);
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
function detectVertical(q) {
  const lower = ` ${q.toLowerCase()} `;
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
function extractEntity(q) {
  const cleaned = q.replace(/\b(under|below|less than)\s*₹?\s*\d+(\s*k)?\b/gi, "").replace(/₹\s*\d+(\.\d+)?/g, "").replace(/\bfrom\s+(amazon|flipkart|blinkit|zepto|swiggy|zomato|amazon)\b/gi, "").trim();
  const tokens = cleaned.split(/\s+/).filter((t) => t && !STOPWORDS.has(t.toLowerCase()));
  return tokens.length > 0 ? tokens.join(" ").slice(0, 160) : null;
}
function extractLocation(q) {
  const loc = {};
  const pin = q.match(PINCODE_RE);
  if (pin) loc.pincode = pin[1];
  const lower = q.toLowerCase();
  const city = MAJOR_CITIES.find((c) => lower.includes(c));
  if (city) loc.city = city === "bengaluru" ? "Bengaluru" : city.charAt(0).toUpperCase() + city.slice(1);
  return loc;
}
function extractDates(q) {
  const dateMatch = q.match(/\b(20\d{2}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/);
  const tomorrow = /\b(tomorrow|today|tonight)\b/i.test(q);
  if (!dateMatch && !tomorrow) return void 0;
  if (tomorrow) return { depart: /today|tonight/i.test(q) ? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) : new Date(Date.now() + 864e5).toISOString().slice(0, 10) };
  return { depart: dateMatch?.[1] };
}
function extractParties(q) {
  const pax = q.match(/\b(\d+)\s*(?:passengers?|pax|guests?|people|adults?|seats?)\b/i);
  if (!pax) return void 0;
  const n = Number(pax[1]);
  if (/\b(passenger|pax)\b/i.test(q)) return { passengers: n };
  return { guests: n };
}
function extractConfiguration(q) {
  const cfg = {};
  const storage = q.match(/\b(\d+)\s*(?:gb|tb)\b/i);
  if (storage) cfg["storage"] = storage[0];
  const color = q.match(/\b(black|white|blue|red|green|gold|silver|grey|gray|graphite|midnight)\b/i);
  if (color) cfg["color"] = color[1];
  const size = q.match(/\b(xl|xxl|large|medium|small|size \d+)\b/i);
  if (size) cfg["size"] = size[1];
  const room = q.match(/\b(deluxe|luxury|suite|standard|ac room|non-ac)\b/i);
  if (room) cfg["room_type"] = room[1];
  const seat = q.match(/\b(sleeper|seater|semi-sleeper|window seat)\b/i);
  if (seat) cfg["seat_type"] = seat[1];
  return Object.keys(cfg).length > 0 ? cfg : void 0;
}
function detectIntent(q) {
  const lower = q.toLowerCase();
  if (/\b(compare|vs\.?|versus|difference between)\b/.test(lower)) return "compare";
  if (/\b(book|reserve|ticket)\b/.test(lower)) return "book";
  if (/\b(buy|order|purchase)\b/.test(lower)) return "buy";
  if (/\b(review|rating|worth it|should i)\b/.test(lower)) return "research";
  return "browse";
}
function understandQuery(rawQuery, provided) {
  const { vertical, confidence } = detectVertical(rawQuery);
  const loc = { ...extractLocation(rawQuery), ...provided };
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
var cheerio = __toESM(require("cheerio"), 1);
var import_crypto2 = require("crypto");

// server/common/httpClient.ts
init_settings();
init_logger();
var AcquisitionError = class extends Error {
  constructor(failureClass, message, httpStatus) {
    super(message);
    this.failureClass = failureClass;
    this.httpStatus = httpStatus;
  }
};
var buckets = /* @__PURE__ */ new Map();
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
var inflightPerSource = /* @__PURE__ */ new Map();
var globalInflight = 0;
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
var DEFAULT_UA = "Try1SecondBot/1.0 (+https://try1second.com; compatible; direct HTTP acquisition; contact via site)";
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

// server/sources/adapters/httpAcquisitionAdapter.ts
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
      const $ = cheerio.load(res.body);
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
            rawFingerprint: (0, import_crypto2.createHash)("sha256").update(res.body.slice(0, 5e4)).digest("hex"),
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
var import_crypto3 = require("crypto");
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
      const fingerprint = (0, import_crypto3.createHash)("sha256").update(res.body.slice(0, 5e4)).digest("hex");
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
var import_crypto4 = require("crypto");
init_settings();
init_logger();
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
              rawFingerprint: (0, import_crypto4.createHash)("sha256").update(res.body.slice(0, 5e4)).digest("hex"),
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
            rawFingerprint: (0, import_crypto4.createHash)("sha256").update(res.body.slice(0, 5e4)).digest("hex"),
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
            rawFingerprint: (0, import_crypto4.createHash)("sha256").update(res.body.slice(0, 5e4)).digest("hex"),
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
var ADAPTERS = {
  browser_render: new BrowserRenderAdapter(),
  direct_http: new HttpAcquisitionAdapter(),
  structured_data: new StructuredDataAdapter(),
  affiliate_feed: new AffiliateFeedAdapter(),
  partner_feed: new PartnerFeedAdapter(),
  official_api: new OfficialAPIAdapter(),
  search_provider: new SearchProviderAdapter()
};
function getAdapter(source) {
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
      if (source.method === "direct_http" && result.httpStatus && result.httpStatus < 500) {
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
    { name: "menu_price", present: (o) => o.prices.mandatoryTotal !== void 0 },
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
    { name: "dates", present: (o) => Boolean(o.travel?.date) },
    { name: "airline", present: (o) => Boolean(o.vendor) },
    { name: "fare", present: (o) => o.prices.mandatoryTotal !== void 0 },
    { name: "currency", present: (o) => isSupportedCurrency(o.prices.currency) },
    { name: "fare_conditions", present: (o) => Boolean(o.attributes["fare_conditions"]), blocking: false },
    { name: "baggage", present: (o) => Boolean(o.attributes["baggage"]), blocking: false }
  ],
  hotels: [
    { name: "property", present: (o) => Boolean(o.title) },
    { name: "dates", present: (o) => Boolean(o.travel?.date) },
    { name: "room_type", present: (o) => Boolean(o.travel?.roomType || o.attributes["room_type"]), blocking: false },
    { name: "guests", present: (o) => Boolean(o.travel?.guests), blocking: false },
    { name: "payable_total", present: (o) => o.prices.effectivePrice !== void 0 || o.prices.mandatoryTotal !== void 0 },
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
    { name: "premium", present: (o) => o.prices.mandatoryTotal !== void 0 },
    { name: "indicative_flag", present: (o) => o.attributes["quote_type"] === "indicative" || o.attributes["quote_type"] === "quoted", blocking: false }
  ],
  movies: [
    { name: "event", present: (o) => Boolean(o.title) },
    { name: "venue", present: (o) => Boolean(o.attributes["venue"] || o.vendor) },
    { name: "show_date", present: (o) => Boolean(o.travel?.date || o.attributes["date"]) },
    { name: "ticket_price", present: (o) => o.prices.mandatoryTotal !== void 0 },
    { name: "currency", present: (o) => isSupportedCurrency(o.prices.currency) },
    { name: "convenience_fee", present: (o) => o.prices.fees.serviceFee !== void 0, blocking: false }
  ],
  bus: [
    { name: "route", present: (o) => Boolean(o.travel?.route) },
    { name: "travel_date", present: (o) => Boolean(o.travel?.date) },
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
var import_crypto5 = require("crypto");
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
function buildEvidence(offer, raw) {
  return {
    offerId: offer.id,
    sourceId: offer.provenance.sourceId,
    sourceMethod: offer.provenance.sourceMethod,
    sourceUrl: raw.evidence?.sourceUrl || offer.sellerUrl,
    sourceReference: raw.evidence?.sourceReference,
    fetchedAt: raw.fetchedAt,
    extractedFields: raw.evidence?.extractedFields || [],
    evidenceHash: raw.evidence?.rawFingerprint || (0, import_crypto5.createHash)("sha256").update(raw.title).digest("hex")
  };
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
      "INSERT INTO canonical_entities (vertical, name, brand) VALUES (?, ?, ?)",
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
  const ordered = [...byEntity.values()].flat();
  return ordered.map(({ o }, i) => ({
    ...o,
    rank: i + 1,
    rankReasons: reasons.get(o.id) || []
  }));
}

// server/verticals/verticalEngine.ts
var NON_COMPARISON_VERTICALS = ["coupons", "giftcards", "banking"];
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
      postProcess: (offers, query) => {
        const routeMatch = query.rawQuery.match(/([a-z]+)\s+to\s+([a-z]+)/i);
        if (!routeMatch) return offers;
        const from = routeMatch[1].toLowerCase(), to = routeMatch[2].toLowerCase();
        return offers.filter((o) => {
          const r = (o.travel?.route || "").toLowerCase();
          return !r || r.includes(from) && r.includes(to);
        });
      }
    });
  }
};
var HotelEngine = class extends VerticalEngine {
  constructor() {
    super({ vertical: "hotels", displayName: "Hotels", postProcess: (offers) => offers.map((o) => {
      return { ...o, attributes: { ...o.attributes, unit: o.attributes["unit"] || "per night" } };
    }) });
  }
};
var CabEngine = class extends VerticalEngine {
  constructor() {
    super({
      vertical: "cab",
      displayName: "Cabs & Mobility",
      postProcess: (offers) => offers.map((o) => ({
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
    super({ vertical: "bus", displayName: "Bus Travel" });
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
    const template = settings.cuelinks.campaignId ? `https://linksdesination.com/cuelink?type=nl&subid=${settings.cuelinks.subId}&campaign=${settings.cuelinks.campaignId}&url={DESTINATION}` : null;
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
async function runSearch(input) {
  const totalStart = Date.now();
  let parsed = understandQuery(input.query, {
    pincode: input.pincode,
    city: input.city,
    lat: input.lat,
    lng: input.lng
  });
  if (input.vertical) parsed.vertical = input.vertical;
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
  const cachedSearch = await cached(cacheKey, 60, async () => null);
  if (cachedSearch.value && cachedSearch.fresh) {
    const v = cachedSearch.value;
    v.state.servedFrom = "cache";
    v.latencyMs = Date.now() - totalStart;
    return v;
  }
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
    const outcome = await acquireParallel(parsed, { maxSources: 6 });
    state.sourcesAttempted = outcome.attempted;
    state.sourcesSucceeded = outcome.succeeded;
    state.sourcesFailed = outcome.failed.map((f) => ({ sourceId: f.sourceId, failureClass: f.failureClass, error: f.error }));
    liveOffers = await processAdapterResults(outcome.results, parsed);
  } else {
    state.sourcesAttempted = [];
  }
  let combined = dedupeOffers([...liveOffers, ...catalogueOffers]);
  const engine = getVerticalEngine(vertical);
  combined = await engine.execute(combined, parsed);
  combined = await attachAffiliateDeepLinks(combined);
  const ranked = rankOffers(combined, { userPincode: input.pincode, userCity: input.city });
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
        offer.location = { ...offer.location, ...parsed.location };
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
          validation.status === "VALID"
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
  if (rows.length === 0) {
    log.info("Cron", "Warmer: no recent queries to warm yet");
    process.exit(0);
  }
  let ok = 0;
  for (const r of rows) {
    try {
      const res = await runSearch({
        query: String(r.raw_query || ""),
        vertical: r.v ? String(r.v) : void 0,
        pincode: r.pincode ? String(r.pincode) : void 0,
        city: r.city ? String(r.city) : void 0
      });
      ok += 1;
      log.info("Cron", "Warmed", { query: r.raw_query, vertical: r.v, results: res.results.length, servedFrom: res.state.servedFrom });
    } catch (e) {
      log.warn("Cron", "Warm pass failed (continuing)", { query: r.raw_query, error: String(e?.message || e).slice(0, 120) });
    }
  }
  log.info("Cron", `Warmer finished: ${ok}/${rows.length} queries warmed`);
  process.exit(0);
}
main().catch((e) => {
  log.error("Cron", "Warmer crashed", { error: String(e) });
  process.exit(1);
});
