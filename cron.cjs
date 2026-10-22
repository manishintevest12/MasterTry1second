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
      /**
       * Firebase Authentication (Google sign-in for the main site). Project ID only — keys live client-side.
       * Fallback to the public project ID so a missing env var can never silently
       * break verification; env always takes precedence.
       */
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "try1second-66273",
      /** Google OAuth client IDs allowed as the `aud` of mobile-app Google ID tokens (comma separated). */
      googleOauthClientIds: (process.env.GOOGLE_OAUTH_CLIENT_IDS || "").split(",").map((e) => e.trim()).filter(Boolean),
      mailFrom: process.env.MAIL_FROM || "Try1Second <onboarding@resend.dev>",
      // Amazon Associates (owner's own store, Oct 2026): tag= on every amazon.* click
      // through /api/out. This is ATTRIBUTION ONLY — it does not grant any product-data
      // API access (PA-API needs separate Associates approval with qualifying sales).
      amazonAssociates: {
        tag: (process.env.AMAZON_ASSOCIATES_TAG || "try1second-21").trim()
      },
      cuelinks: {
        apiKey: process.env.CUELINKS_API_KEY || "",
        publisherId: process.env.CUELINKS_PUBLISHER_ID || "278473",
        // owner account, Oct 2026
        // Per-publisher tracking cid returned by the official /links/convert API
        // (NOT the public campaign id): cid=326794 = our channel, verified live.
        cid: process.env.CUELINKS_CID || "326794",
        campaignId: process.env.CUELINKS_CAMPAIGN_ID || "",
        subId: process.env.CUELINKS_SUB_ID || "",
        apiBase: process.env.CUELINKS_API_BASE || "https://developers.cuelinks.com/pub_api/v3",
        // linkkit deeplinks need only publisherId + campaign cid; the Monetization
        // API (offers/campaigns/convert) needs the dashboard API key on top.
        enabled: Boolean(process.env.CUELINKS_API_KEY || process.env.CUELINKS_PUBLISHER_ID)
      },
      admitad: {
        clientId: process.env.ADMITAD_CLIENT_ID || "",
        clientSecret: process.env.ADMITAD_CLIENT_SECRET || "",
        websiteId: process.env.ADMITAD_WEBSITE_ID || "",
        defaultCampaignId: process.env.ADMITAD_DEFAULT_CAMPAIGN_ID || "",
        baseUrl: process.env.ADMITAD_BASE_URL || "https://api.admitad.com",
        scope: process.env.ADMITAD_SCOPE || "advcampaigns advcampaigns_for_website coupons_for_website websites",
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
  localHostCandidates: () => localHostCandidates,
  normalizeSqlValue: () => normalizeSqlValue,
  recoverMysqlWithLocalHost: () => recoverMysqlWithLocalHost,
  resetToFileStore: () => resetToFileStore,
  runMigrations: () => runMigrations,
  sanitizeBindParams: () => sanitizeBindParams,
  splitSqlStatements: () => splitSqlStatements
});
function normalizeSqlValue(p) {
  if (p === void 0 || typeof p === "number" && Number.isNaN(p)) return null;
  if (typeof p === "string") {
    const t = p.trim();
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(t)) {
      return t.replace("T", " ").slice(0, -1);
    }
    const off = t.match(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?([+\-]\d{2}:?\d{2})$/);
    if (off) {
      const d = new Date(t.replace(" ", "T"));
      if (!Number.isNaN(d.getTime())) return d.toISOString().replace("T", " ").slice(0, -1);
    }
    if (ISO_DT.test(t)) return t.replace("T", " ");
  }
  return p;
}
function sanitizeBindParams(params) {
  return (params || []).map(normalizeSqlValue);
}
function getStore() {
  if (store) return store;
  if (settings.mysqlUrl) {
    try {
      const pool2 = import_promise.default.createPool({
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
      store = new MysqlStore(pool2);
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
function localHostCandidates(configuredHost) {
  return ["localhost", "127.0.0.1"].filter((h) => h !== configuredHost.toLowerCase());
}
async function recoverMysqlWithLocalHost(url = settings.mysqlUrl) {
  const original = url || "";
  if (!original) return false;
  const originalHost = (() => {
    try {
      return new URL(original).hostname;
    } catch {
      return "";
    }
  })();
  for (const host of localHostCandidates(originalHost)) {
    let candidate = null;
    try {
      const uri = new URL(original);
      uri.hostname = host;
      candidate = import_promise.default.createPool({
        uri: uri.toString(),
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 8e3,
        timezone: "Z"
      });
      const probe = new MysqlStore(candidate);
      await probe.query("SELECT 1 AS ok");
      store = probe;
      log.warn("DataStore", `MySQL access denied on host '${originalHost}' \u2014 SELF-HEALED via co-located host '${host}'. Set DB_HOST=${host} in hPanel env vars to make it permanent.`);
      return true;
    } catch (e) {
      candidate?.end?.().catch?.(() => void 0);
      log.warn("DataStore", `Self-heal candidate '${host}' rejected: ${e.code || ""} ${String(e.message || "")}`);
    }
  }
  if (["localhost", "127.0.0.1", "::1"].includes(originalHost)) {
    log.error("DataStore", `DB_HOST is already local ('${originalHost}') \u2014 the denial is a CREDENTIALS problem (wrong DB_USER or DB_PASSWORD for '${(() => {
      try {
        return decodeURIComponent(new URL(original).username);
      } catch {
        return "?";
      }
    })()}'), not a host problem. Fix in hPanel > Databases.`);
  }
  return false;
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
var import_fs, import_path2, import_promise, ISO_DT, MysqlStore, FileStore, store;
var init_db = __esm({
  "server/common/db.ts"() {
    import_fs = __toESM(require("fs"), 1);
    import_path2 = __toESM(require("path"), 1);
    import_promise = __toESM(require("mysql2/promise"), 1);
    init_settings();
    init_logger();
    ISO_DT = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/;
    MysqlStore = class _MysqlStore {
      constructor(pool2) {
        this.kind = "mysql";
        this.pool = pool2;
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
    FileStore = class _FileStore {
      constructor() {
        this.kind = "file";
        // Generic table emulation: { tableName: [rows] }
        this.file = import_path2.default.join(dataDir, "devstore.json");
        this.data = {};
        this.warned = false;
        this.lastMtimeMs = 0;
        this.lastReloadAt = 0;
        this.saveTimer = null;
        import_fs.default.mkdirSync(dataDir, { recursive: true });
        if (import_fs.default.existsSync(this.file)) {
          try {
            this.data = JSON.parse(import_fs.default.readFileSync(this.file, "utf8"));
            this.lastMtimeMs = import_fs.default.statSync(this.file).mtimeMs;
          } catch {
            this.data = {};
          }
        }
      }
      /**
       * MULTI-INSTANCE COHERENCE (owner 21 Oct coupon wipe): hPanel/Passenger runs
       * SEVERAL instances of this app behind port 3000. The singleton instance
       * performs background work (affiliate syncs wrote 600 coupon offers at
       * 13:08:46) and persists devstore.json, but every other instance loaded its
       * snapshot ONCE at boot and never re-read the file — so they kept answering
       * /api/v1/offers with stale tables (0 coupons) and their own whole-file
       * persists clobbered the singleton's rows. Before every query/execute we now
       * stat the file: if another instance changed it, reload. Throttled to one
       * reload per 5s in production so a busy writer can't burn CPU on this side;
       * test env skips the throttle (single-process, synchronous durability).
       */
      maybeReload() {
        const now = Date.now();
        if (settings.env !== "test" && now - this.lastReloadAt < 5e3) return;
        this.lastReloadAt = now;
        try {
          const st = import_fs.default.statSync(this.file);
          if (st.mtimeMs > this.lastMtimeMs + 1) {
            this.data = JSON.parse(import_fs.default.readFileSync(this.file, "utf8"));
            this.lastMtimeMs = st.mtimeMs;
            log.info("DataStore", "devstore.json changed by another instance \u2014 state reloaded");
          }
        } catch {
        }
      }
      persist() {
        if (this.warned) {
          this.warned = false;
          log.warn("DataStore", "Using FILE fallback store \u2014 set MYSQL_URL for the real durable catalogue");
        }
        if (settings.env === "test") {
          try {
            import_fs.default.mkdirSync(dataDir, { recursive: true });
            import_fs.default.writeFileSync(this.file, JSON.stringify(this.data));
          } catch {
          }
          return;
        }
        if (this.saveTimer) return;
        this.saveTimer = setTimeout(() => {
          this.saveTimer = null;
          try {
            const snapshot = JSON.stringify(this.data);
            import_fs.default.mkdirSync(dataDir, { recursive: true });
            import_fs.default.promises.writeFile(this.file, snapshot).then(() => {
              try {
                this.lastMtimeMs = import_fs.default.statSync(this.file).mtimeMs;
              } catch {
              }
            }).catch(() => {
            });
          } catch {
          }
        }, 2e3);
      }
      // --- Mini SQL engine (dev parity with the MySQL schema) ---
      tableOf(sql) {
        const m = sql.match(/(?:from|into|update)\s+`?(\w+)`?/i);
        return m ? m[1] : "default";
      }
      /**
         * Compare two SQL values the way MySQL would: datetimes as instants, numbers
         * numerically, everything else as strings. Prune/expiry compares ISO strings
         * ('2026-10-14T...') against space-format datetimes ('2026-10-21 ...'), so a
         * naive string compare silently mis-orders rows it must keep.
         */
      static cmp(l, r) {
        if (l === null || l === void 0 || r === null || r === void 0) return null;
        const ls = String(l).trim();
        const rs = String(r).trim();
        if (!ls || !rs) return null;
        const looksDate = (v) => /\d{4}-\d{2}-\d{2}/.test(v);
        const toDate = (v) => {
          let x = v.replace(" ", "T");
          if (!/[zZ+]/.test(x)) x = x + "Z";
          return Date.parse(x);
        };
        if (looksDate(ls) && looksDate(rs)) {
          const ld = toDate(ls);
          const rd = toDate(rs);
          if (Number.isFinite(ld) && Number.isFinite(rd)) return ld < rd ? -1 : ld > rd ? 1 : 0;
        }
        const ln = Number(ls);
        const rn = Number(rs);
        if (!Number.isNaN(ln) && !Number.isNaN(rn)) return ln < rn ? -1 : ln > rn ? 1 : 0;
        const a = ls.toLowerCase();
        const b = rs.toLowerCase();
        return a < b ? -1 : a > b ? 1 : 0;
      }
      /**
       * Parse WHERE clauses. Operator support (owner bug, 21 Oct): the old parser only
       * understood "= ?", "IS [NOT] NULL" and "< literal-number"; every other shape —
       * crucially `col < ?` used by the retention PRUNE and `col < NOW()` used by
       * affiliate expiry — fell through to a permissive `true`, so on file-fallback
       * storage the hourly prune deleted ENTIRE tables (coupons wiped every cycle)
       * and expirePastOffers expired every active row. Unknown conditions are now
       * CONSERVATIVE (match nothing) so a parse gap can never mass-delete again.
       */
      whereOf(sql, params) {
        const m = sql.match(/where\s+([\s\S]+?)(?:order by|limit|$)/i);
        if (!m) return null;
        const conditions = m[1].split(/\s+and\s+/i).map((c) => c.trim()).filter(Boolean);
        if (conditions.length === 0) return null;
        let p = 0;
        const parseCond = (c) => {
          let cm;
          const orGroup = c.match(/^\((.+)\)$/);
          if (orGroup && /\s+or\s+/i.test(orGroup[1])) {
            const subs = orGroup[1].split(/\s+or\s+/i).map((x) => x.trim()).filter(Boolean).map(parseCond);
            return (row) => subs.some((fn) => fn(row));
          }
          if (cm = c.match(/^`?(\w+)`?\s*=\s*'([^']*)'$/i)) {
            const col = cm[1];
            const lit = cm[2];
            return (row) => String(row[col]) === lit;
          }
          if (cm = c.match(/^`?(\w+)`?\s*=\s*(\d+(?:\.\d+)?)$/i)) {
            const col = cm[1];
            const lit = Number(cm[2]);
            return (row) => Number(row[col]) === lit;
          }
          if (cm = c.match(/^`?(\w+)`?\s*=\s*\?$/i)) {
            const col = cm[1];
            const expected = params[p++];
            return (row) => {
              const cmp = _FileStore.cmp(row[col], expected);
              return cmp !== null ? cmp === 0 : String(row[col]) === String(expected);
            };
          }
          if (cm = c.match(/^`?(\w+)`?\s*(!=|<>)\s*\?$/i)) {
            const col = cm[1];
            const expected = params[p++];
            return (row) => {
              if (row[col] === null || row[col] === void 0) return false;
              const cmp = _FileStore.cmp(row[col], expected);
              return cmp !== null ? cmp !== 0 : String(row[col]) !== String(expected);
            };
          }
          if (cm = c.match(/^`?(\w+)`?\s+like\s+\?$/i)) {
            const col = cm[1];
            const pat = String(params[p++] ?? "").toLowerCase();
            const rx = new RegExp("^" + pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$");
            return (row) => rx.test(String(row[col] ?? "").toLowerCase());
          }
          if (cm = c.match(/^`?(\w+)`?\s+in\s*\(([^)]+)\)$/i)) {
            const col = cm[1];
            const toks2 = cm[2].split(",").map((t) => t.trim());
            const vals = toks2.map((t) => t === "?" ? params[p++] : /^null$/i.test(t) ? null : /^'.*'$/.test(t) ? t.slice(1, -1) : Number(t));
            return (row) => vals.some((v) => v === null ? row[col] === null : String(row[col]) === String(v));
          }
          if (cm = c.match(/^`?(\w+)`?\s*is\s*null$/i)) {
            const col = cm[1];
            return (row) => row[col] === null || row[col] === void 0;
          }
          if (cm = c.match(/^`?(\w+)`?\s*is\s*not\s*null$/i)) {
            const col = cm[1];
            return (row) => !(row[col] === null || row[col] === void 0);
          }
          if (cm = c.match(/^`?(\w+)`?\s*(>|>=|<|<=)\s*(\?|now\(\)|-?\d+(?:\.\d+)?)$/i)) {
            const col = cm[1];
            const op = cm[2];
            const rhs = /^now\(\)$/i.test(cm[3]) ? (/* @__PURE__ */ new Date()).toISOString() : cm[3] === "?" ? params[p++] : Number(cm[3]);
            return (row) => {
              const cmp = _FileStore.cmp(row[col], rhs);
              if (cmp === null) return false;
              return op === ">" ? cmp > 0 : op === ">=" ? cmp >= 0 : op === "<" ? cmp < 0 : cmp <= 0;
            };
          }
          return (_row) => false;
        };
        const preds = conditions.map(parseCond);
        const pred = (row) => preds.every((fn) => fn(row));
        pred.takesParams = true;
        return pred;
      }
      async query(sql, params = []) {
        this.maybeReload();
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
        const tokens2 = vals.split(",").map((t) => t.trim());
        const row = {};
        let p = 0;
        cols.forEach((col, i) => {
          const tok = tokens2[i];
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
        this.maybeReload();
        const s = sql.trim();
        const table = this.tableOf(s);
        if (!this.data[table]) this.data[table] = [];
        if (/^insert/i.test(s)) {
          const cols = (s.match(/insert\s+into\s+`?\w+`?\s*\(([^)]+)\)/i)?.[1] || "").split(",").map((c) => c.trim().replace(/[`]/g, "")).filter(Boolean);
          const row = this.valuesOf(s, cols, params);
          if (!cols.includes("id")) row["id"] = this.data[table].length ? Math.max(...this.data[table].map((r) => Number(r.id) || 0)) + 1 : 1;
          this.data[table].push(row);
          if (this.data[table].length > 2500) this.data[table] = this.data[table].slice(-2500);
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
              else if (/^'([^']*)'$/.test(expr)) row[col] = expr.slice(1, -1);
              else if (/^-?\d+(\.\d+)?$/.test(expr)) row[col] = Number(expr);
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
    lastFailureMessage: null,
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
  challengeOpenings.delete(sourceId);
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
function recordFailure(sourceId, failureClass, error) {
  const h = getHealth(sourceId);
  h.totalAttempts += 1;
  if (failureClass === "RATE_LIMITED") {
    h.lastFailureAt = (/* @__PURE__ */ new Date()).toISOString();
    h.lastFailureClass = failureClass;
    h.state = h.state === "CIRCUIT_OPEN" ? h.state : "DEGRADED";
    health.set(sourceId, h);
    void persist(h);
    return;
  }
  h.consecutiveFailures += 1;
  h.lastFailureAt = (/* @__PURE__ */ new Date()).toISOString();
  h.lastFailureClass = failureClass;
  h.lastFailureMessage = String(error || "").slice(0, 300) || null;
  const wasOpen = h.state === "CIRCUIT_OPEN";
  h.state = h.consecutiveFailures >= CIRCUIT_THRESHOLD ? "CIRCUIT_OPEN" : "DEGRADED";
  if (h.state === "CIRCUIT_OPEN" && !wasOpen) {
    let cooldownMs = CIRCUIT_COOLDOWN_MS;
    if (failureClass === "ACCESS_CHALLENGE") {
      const n = (challengeOpenings.get(sourceId) ?? 0) + 1;
      challengeOpenings.set(sourceId, n);
      cooldownMs = CHALLENGE_COOLDOWN_STEPS_MS[Math.min(n - 1, CHALLENGE_COOLDOWN_STEPS_MS.length - 1)];
    }
    h.circuitOpenUntil = new Date(Date.now() + cooldownMs).toISOString();
    log.warn("Health", `Circuit OPEN for ${sourceId} after ${h.consecutiveFailures} failures (${failureClass}), cooldown ${Math.round(cooldownMs / 6e4)}min`);
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
var CIRCUIT_THRESHOLD, CIRCUIT_COOLDOWN_MS, CHALLENGE_COOLDOWN_STEPS_MS, challengeOpenings, health;
var init_health = __esm({
  "server/sources/health.ts"() {
    init_logger();
    CIRCUIT_THRESHOLD = 3;
    CIRCUIT_COOLDOWN_MS = 6e4;
    CHALLENGE_COOLDOWN_STEPS_MS = [6e4, 5 * 6e4, 25 * 6e4, 60 * 6e4];
    challengeOpenings = /* @__PURE__ */ new Map();
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
    ...opts.httpVersion ? { httpVersion: opts.httpVersion } : {},
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
var import_node_child_process, import_node_path2, import_node_fs2, import_node_url, import_meta, HELPER, PY_CANDIDATES, pyChoice, probeResults;
var init_curlCffiFetch = __esm({
  "server/common/curlCffiFetch.ts"() {
    import_node_child_process = require("node:child_process");
    import_node_path2 = __toESM(require("node:path"), 1);
    import_node_fs2 = __toESM(require("node:fs"), 1);
    import_node_url = require("node:url");
    init_httpClient();
    import_meta = {};
    HELPER = (() => {
      const cands = [];
      try {
        cands.push(import_node_path2.default.join(import_node_path2.default.dirname((0, import_node_url.fileURLToPath)(import_meta.url)), "..", "acquisition", "pyfetch.py"));
      } catch {
      }
      try {
        cands.push(import_node_path2.default.join(__dirname, "server", "acquisition", "pyfetch.py"));
      } catch {
      }
      cands.push(import_node_path2.default.join(process.cwd(), "server", "acquisition", "pyfetch.py"));
      return cands.find((c) => import_node_fs2.default.existsSync(c)) || cands[cands.length - 1];
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
  const markers = /captcha|robot check|are you a human|unusual traffic|access denied|enable javascript and cookies|verify you human|bm-verify|api-services-support@amazon\.com|enter the characters you see below|to discuss automated access|datadome|cf-chl|px-captcha|blocked|not available in your region/i;
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
function extractAmazonGallery(pdpHtml) {
  const urls = [];
  const push = (u) => {
    if (/^https:\/\/m\.media-amazon\.com\/.*\.(jpe?g|png|webp)/i.test(u) && !urls.includes(u)) urls.push(u);
  };
  for (const m of pdpHtml.matchAll(/"hiRes"\s*:\s*"(https:[^"]+)"/g)) push(m[1]);
  if (urls.length < 2) {
    for (const m of pdpHtml.matchAll(/"large"\s*:\s*"(https:[^"]+)"/g)) push(m[1]);
  }
  return urls.slice(0, 6);
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
    const fkImgs = (Array.isArray(u.media?.images) ? u.media.images : []).map((im) => String(im?.url || "")).filter(Boolean).map((x) => x.replace(/^http:/, "https:").replace("{@width}", "400").replace("{@height}", "400").replace("{@quality}", "70")).filter((x) => /^https:\/\/rukmini/.test(x)).slice(0, 6);
    out.push(newRawItem(source, {
      title: title.slice(0, 220),
      price: selling,
      currency: "INR",
      listPrice: mrp && mrp > selling ? mrp : void 0,
      brand: u.titles?.superTitle || void 0,
      identifiers: { vendorProductId: id },
      attributes: { ...avg ? { rating: String(avg) } : {}, ...u.rating?.count ? { rating_count: String(u.rating.count) } : {}, .../^https:\/\/rukmini/.test(imageUrl) ? { image_url: imageUrl } : {}, ...fkImgs.length > 1 ? { image_urls: fkImgs.join("|") } : {} },
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
    const imgs = [...new Set((Array.isArray(p.images) ? p.images : []).map((i) => String(i?.src || "").replace(/^http:/, "https:")).filter((u) => /^https:\/\//.test(u)))].slice(0, 6);
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
        ...imgs.length > 1 ? { image_urls: imgs.join("|") } : {},
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
function pickImages(p) {
  const out = [];
  const add = (u) => {
    if (u) {
      const x = String(u).replace(/^http:/, "https:");
      if (!out.includes(x)) out.push(x);
    }
  };
  add(p.fnlColorVariantData?.outfitPictureURL);
  for (const g of p.images || []) {
    add(g.url);
    for (const m of g.media || []) add(m.mediumImageUrl || m.imageUrl);
  }
  for (const x of p.extraImages || []) for (const m of x.images || []) add(m.url);
  return out.slice(0, 8);
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
        ...pickImages(p).length > 1 ? { image_urls: pickImages(p).join("|") } : {},
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

// server/workers/parsers/tatacliq.ts
function parseTataCliq(rawBody, source, pageUrl) {
  let root;
  try {
    root = JSON.parse(rawBody);
  } catch {
    return [];
  }
  const groups = Array.isArray(root?.response) ? root.response : [];
  const items = [];
  const seen = /* @__PURE__ */ new Set();
  for (const grp of groups) {
    const results = grp?.product_search_page?.search_result || [];
    for (const p of results) {
      const name = String(p.productname || p.productTitle || "").trim();
      const price = Number(p.price?.sellingPrice?.doubleValue);
      if (!name || !Number.isFinite(price) || price <= 0) continue;
      const sku = String(p.ussid || p.productId || "");
      if (sku && seen.has(sku)) continue;
      if (sku) seen.add(sku);
      const mrpVal = Number(p.price?.mrpPrice?.doubleValue);
      const mrp = Number.isFinite(mrpVal) && mrpVal > price ? mrpVal : void 0;
      const brand = p.brandname ? String(p.brandname) : void 0;
      const rel = String(p.webURL || "");
      const url = rel ? `https://www.tatacliq.com${rel.startsWith("/") ? rel : `/${rel}`}` : "https://www.tatacliq.com";
      let img;
      const rawImg = String(p.imageURL || "");
      if (rawImg) img = rawImg.startsWith("http") ? rawImg : `https:${rawImg}`;
      const gallery = (p.productImages || []).map((u) => String(u).startsWith("http") ? String(u) : `https:${String(u)}`).filter((u) => /^https:\/\//.test(u));
      const galleryUrls = gallery.filter((u) => u !== img);
      items.push(newRawItem(source, {
        title: (brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${name}` : name).slice(0, 200),
        brand,
        model: p.productId ? String(p.productId) : void 0,
        price,
        listPrice: mrp,
        currency: "INR",
        seller: "Tata CLiQ",
        sellerUrl: url,
        attributes: {
          brand: brand || "",
          discount: p.discountPercent ? `${p.discountPercent}%` : "",
          image: img || "",
          ...galleryUrls.length ? { image_urls: [img, ...galleryUrls].filter(Boolean).slice(0, 8).join("|") } : {},
          in_stock: p.inStockFlag === false ? "false" : "true",
          ...p.averageRating ? { rating: String(p.averageRating) } : {},
          ...p.totalNoOfReviews ? { review_count: String(p.totalNoOfReviews) } : {},
          data_note: `Product as listed on Tata CLiQ search API, observed ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`
        },
        identifiers: sku ? { sku } : void 0,
        evidence: { sourceUrl: pageUrl, extractedFields: ["title", "price", "mrp", "brand", "discount", "image", "url"] }
      }));
      if (items.length >= 40) return items;
    }
  }
  return items;
}
var init_tatacliq = __esm({
  "server/workers/parsers/tatacliq.ts"() {
    init_contract();
  }
});

// server/workers/parsers/nykaa.ts
function parseNykaa(html, source, pageUrl) {
  const tag = '<script id="__PRELOADED_STATE__" type="application/json">';
  const i = html.indexOf(tag);
  if (i < 0) return [];
  const from = i + tag.length;
  const end = html.indexOf("</script>", from);
  if (end < 0) return [];
  let root;
  try {
    root = JSON.parse(html.slice(from, end));
  } catch {
    return [];
  }
  let products = [];
  const direct = root?.listingV2?.products;
  if (Array.isArray(direct) && direct.length && "discountedPrice" in (direct[0] || {})) {
    products = direct;
  } else {
    const walk2 = (o, depth) => {
      if (depth > 10 || !o || typeof o !== "object") return [];
      if (Array.isArray(o)) {
        if (o.length && typeof o[0] === "object" && o[0] && ("discountedPrice" in o[0] || "price" in o[0]) && ("title" in o[0] || "subTitle" in o[0])) {
          return o;
        }
        for (const v of o) {
          const r = walk2(v, depth + 1);
          if (r.length) return r;
        }
        return [];
      }
      for (const v of Object.values(o)) {
        const r = walk2(v, depth + 1);
        if (r.length) return r;
      }
      return [];
    };
    products = walk2(root, 0);
  }
  if (!products.length) return [];
  const hrefs = /* @__PURE__ */ new Map();
  const re = /href="(\/[a-z0-9][a-z0-9-]*\/p\/(\d+)[^"]*)"/g;
  let m;
  while ((m = re.exec(html)) && hrefs.size < 200) hrefs.set(m[2], m[1].split("?")[0]);
  const items = [];
  for (const p of products.slice(0, 40)) {
    const brand = String(p.title || "").trim();
    const name = String(p.subTitle || "").trim();
    const full = [brand, name].filter(Boolean).join(" ");
    if (!full) continue;
    const sell = Number(p.discountedPrice);
    const mrp = Number(p.price);
    const price = Number.isFinite(sell) && sell > 0 ? sell : mrp;
    if (!Number.isFinite(price) || price <= 0) continue;
    const id = p.id != null ? String(p.id) : "";
    const pdp = id && hrefs.get(id) ? `https://www.nykaa.com${hrefs.get(id)}` : "https://www.nykaa.com";
    const https = (u) => u.replace(/^http:/, "https:");
    const img = p.imageUrl ? https(String(p.imageUrl)) : "";
    const imgs = [...new Set((p.plp_pdp_bridge?.images || []).map((x) => x?.url ? https(String(x.url)) : "").filter((u) => /^https:\/\//.test(u)))].slice(0, 6);
    items.push(newRawItem(source, {
      title: full.slice(0, 200),
      brand: brand || void 0,
      model: p.sku ? String(p.sku) : id || void 0,
      price,
      listPrice: mrp > price ? mrp : void 0,
      currency: "INR",
      seller: "Nykaa",
      sellerUrl: pdp,
      availability: p.isOutOfStock ? "out_of_stock" : "in_stock",
      attributes: {
        brand,
        product: name,
        discount: p.discount != null ? String(p.discount).replace(/[()%]/g, "") : "",
        image: img,
        ...imgs.length > 1 ? { image_urls: imgs.join("|") } : {},
        data_note: `Product as listed on Nykaa search, observed ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`
      },
      identifiers: p.sku ? { sku: String(p.sku), ...id ? { vendorProductId: id } : {} } : void 0,
      evidence: { sourceUrl: pageUrl, extractedFields: ["title", "subTitle", "price", "discountedPrice", "discount", "imageUrl", "pdp_url", "sku"] }
    }));
  }
  return items;
}
var init_nykaa = __esm({
  "server/workers/parsers/nykaa.ts"() {
    init_contract();
  }
});

// server/workers/parsers/croma.ts
function parseCromaSearch(rawBody, source, pageUrl) {
  let root;
  try {
    root = JSON.parse(rawBody);
  } catch {
    return [];
  }
  const products = Array.isArray(root?.products) ? root.products : [];
  const items = [];
  const seen = /* @__PURE__ */ new Set();
  for (const p of products) {
    const name = String(p.name || "").trim();
    const price = Number(p.price?.value ?? p.pincodePrice?.value);
    if (!name || !Number.isFinite(price) || price <= 0) continue;
    const sku = String(p.code || "");
    if (sku && seen.has(sku)) continue;
    if (sku) seen.add(sku);
    const mrpVal = Number(p.mrp?.value);
    const mrp = Number.isFinite(mrpVal) && mrpVal > price ? mrpVal : void 0;
    const brand = p.manufacturer ? String(p.manufacturer) : void 0;
    const rel = String(p.url || "");
    const url = rel ? `https://www.croma.com${rel.startsWith("/") ? rel : `/${rel}`}` : "https://www.croma.com";
    const img = /^https:\/\//.test(String(p.plpImage || "")) ? String(p.plpImage) : void 0;
    const stock = Array.isArray(p.stockFlag) ? p.stockFlag.length > 0 ? "true" : "false" : "true";
    const rating = Number(p.averageRating ?? p.finalReviewRating) || 0;
    const reviews = Number(p.numberOfReviews ?? p.finalReviewRatingCount) || 0;
    items.push(newRawItem(source, {
      title: (brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${name}` : name).slice(0, 200),
      brand,
      model: sku || void 0,
      price,
      listPrice: mrp,
      currency: "INR",
      seller: "Croma",
      sellerUrl: url,
      availability: stock === "true" ? "in_stock" : "out_of_stock",
      attributes: {
        brand: brand || "",
        ...p.discount ? { discount: `${p.discount}%` } : {},
        image: img || "",
        in_stock: stock,
        ...rating ? { rating: String(rating) } : {},
        ...reviews ? { review_count: String(reviews) } : {},
        data_note: `Live prices from Croma search API, observed ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`
      },
      identifiers: sku ? { sku } : void 0,
      evidence: { sourceUrl: pageUrl, extractedFields: ["title", "price", "mrp", "brand", "image", "url", "stock"] }
    }));
    if (items.length >= 30) break;
  }
  return items;
}
function extractCromaGallery(html, code) {
  if (!code) return [];
  const urls = /* @__PURE__ */ new Set();
  const re = /https:\/\/media\.tatacroma\.com\/[A-Za-z0-9%_()\/.-]*?Images[^"'\\ )]*/g;
  let m;
  while (m = re.exec(html)) {
    const u = m[0];
    if (!u.includes(code) || u.includes("No_image")) continue;
    urls.add(u);
  }
  return Array.from(urls).map((u) => {
    const idx = new RegExp(`${code}_(\\d+)_`).exec(u);
    return { u, n: idx ? Number(idx[1]) : 99 };
  }).sort((a, b) => a.n - b.n).map((x) => x.u).slice(0, 6);
}
function mergeCromaGallery(item, gallery) {
  const hero = String(item.attributes?.image || "");
  const merged = [hero, ...gallery].filter((u, i, a) => /^https:\/\//.test(u) && a.indexOf(u) === i).slice(0, 6);
  if (merged.length > 1) {
    item.attributes = { ...item.attributes, image_urls: merged.join("|") };
  }
}
var init_croma = __esm({
  "server/workers/parsers/croma.ts"() {
    init_contract();
  }
});

// server/workers/parsers/xiaomi.ts
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : void 0;
}
function parseXiaomiSearch(rawBody, source, pageUrl) {
  let root;
  try {
    root = JSON.parse(rawBody);
  } catch {
    return [];
  }
  const list = Array.isArray(root?.data?.data_provider?.data?.product_list) ? root.data.data_provider.data.product_list : [];
  const items = [];
  const seen = /* @__PURE__ */ new Set();
  for (const entry of list) {
    const p = entry?.product;
    const name = String(p?.name || "").trim();
    if (!name || !p) continue;
    const id = String(p.id || p.spu_id || "");
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    const price = num(p.price_min_num) ?? num(p.price_max_num) ?? num((entry.commodity || [])[0]?.sales_price);
    if (!price) continue;
    items.push(makeItem(source, pageUrl, p, entry, price));
    if (items.length >= 30) break;
  }
  return items;
}
function makeItem(source, pageUrl, p, entry, price) {
  const name = String(p.name || "").trim();
  const id = String(p.id || p.spu_id || "");
  const mrp = num(p.market_price_min_num) ?? num(p.market_price_max_num);
  const url = /^https?:\/\//.test(String(p.item_link || "")) ? String(p.item_link) : "https://www.mi.com/in";
  const hero = /^https?:\/\//.test(String(p.image || "")) ? String(p.image) : "";
  const gallery = [];
  if (hero) gallery.push(hero);
  for (const c of entry?.commodity || []) {
    const u = String(c?.image || "");
    if (/^https?:\/\//.test(u) && !gallery.includes(u)) gallery.push(u);
    if (gallery.length >= 6) break;
  }
  const cats = p.categories || [];
  const category = cats.map((c) => String(c?.title || "")).filter(Boolean).join(" > ");
  const brand = /(^|\s)redmi\b/i.test(name) ? "Redmi" : /(^|\s)poco\b/i.test(name) ? "Poco" : /(^|\s)xiaomi\b/i.test(name) ? "Xiaomi" : "Xiaomi";
  const inStock = Number(p.has_store ?? p.is_sale ?? 1) === 1;
  const isNew = Number(p.is_new ?? 0) === 1;
  return newRawItem(source, {
    title: name.slice(0, 200),
    brand,
    model: p.spu_id ? String(p.spu_id) : void 0,
    price,
    listPrice: mrp && mrp > price ? mrp : void 0,
    currency: "INR",
    seller: "Xiaomi (mi.com)",
    sellerUrl: url,
    availability: inStock ? "in_stock" : "out_of_stock",
    attributes: {
      brand,
      image: hero,
      image_urls: gallery.length > 1 ? gallery.join("|") : "",
      category: category || "",
      in_stock: inStock ? "true" : "false",
      ...isNew ? { badge: "New" } : {},
      data_note: `Live prices from Xiaomi India (mi.com) search API, observed ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`
    },
    identifiers: id ? { sku: id } : void 0,
    evidence: { sourceUrl: pageUrl, extractedFields: ["title", "price", "mrp", "brand", "image", "url", "stock", "variant_gallery"] }
  });
}
var init_xiaomi = __esm({
  "server/workers/parsers/xiaomi.ts"() {
    init_contract();
  }
});

// server/workers/parsers/lenovo.ts
function lenovoSearchUrl(term, rows = 24) {
  return `${LENOVO_SEARCH_API}?text=${encodeURIComponent(term)}&rows=${rows}&sort=Recommended&contentNum=0&productNum=${rows}`;
}
function lenovoHeaders(term) {
  return {
    Accept: "application/json, text/plain, */*",
    // CRITICAL: the edge 403s (HTML) without a lenovo.com search Referer.
    Referer: `https://www.lenovo.com/in/en/search?text=${encodeURIComponent(term)}`
  };
}
function lenovoTitle(p) {
  const summary = String(p.summary || "").trim();
  if (summary && summary.length >= 3) return summary.slice(0, 200);
  const slug2 = String(p.url || "").split("?")[0].split("/").filter(Boolean).slice(-2, -1)[0] || "";
  if (slug2.includes("-")) {
    return slug2.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 200);
  }
  const alt = String(p?.media?.gallery?.[0]?.imageAlt || "").trim();
  if (alt && !/^(front|side|back|top|bottom|left|right|angle)/i.test(alt)) {
    return alt.replace(/^Lenovo\s+/i, "").slice(0, 200);
  }
  const raw = String(p.productName || "").trim();
  if (raw) {
    return raw.split(" - ")[0].split("_")[0].trim().slice(0, 200);
  }
  return "";
}
function parseLenovoSearch(rawBody, source, pageUrl) {
  let root;
  try {
    root = JSON.parse(rawBody);
  } catch {
    return [];
  }
  const blocks = Array.isArray(root?.data?.data) ? root.data.data : [];
  const products = [];
  for (const block of blocks) {
    if (Array.isArray(block?.products)) products.push(...block.products);
  }
  const items = [];
  const seen = /* @__PURE__ */ new Set();
  for (const p of products) {
    const price = money(p.finalPrice) ?? money(p.beforeTaxPrice);
    if (!price) continue;
    const id = String(p.id || p.productCode || "");
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    const title = lenovoTitle(p);
    if (!title) continue;
    const listPrice = money(p.webPrice) ?? money(p.noCouponPrice);
    const inStock = Number(p.inventoryStatus ?? 1) === 1;
    const gallery = [];
    for (const g of p?.media?.gallery || []) {
      let u = String(g?.imageAddress || "");
      if (!u) continue;
      if (u.startsWith("//")) u = "https:" + u;
      if (!/^https?:\/\//.test(u) || gallery.includes(u)) continue;
      gallery.push(u);
      if (gallery.length >= 6) break;
    }
    const url = String(p.url || "").startsWith("http") ? String(p.url) : "https://www.lenovo.com" + String(p.url || "");
    const specs = {};
    for (const c of p.classification || []) {
      const key = String(c?.a || "").trim();
      const val = String(c?.b || "").trim();
      if (key && val && Object.keys(specs).length < 8) specs[key] = val.slice(0, 120);
    }
    const rating = money(p.ratingStar);
    items.push(newRawItem(source, {
      title,
      brand: "Lenovo",
      price,
      listPrice: listPrice && listPrice > price ? listPrice : void 0,
      currency: String(p.currencyCode || "INR"),
      seller: "Lenovo (lenovo.com)",
      sellerUrl: url,
      availability: inStock ? "in_stock" : "out_of_stock",
      attributes: {
        brand: "Lenovo",
        ...rating && rating > 0 && rating <= 5 ? { rating: String(Math.round(rating * 10) / 10), ...Number(p.commentCount) > 0 ? { reviews: String(p.commentCount) } : {} } : {},
        image: gallery[0] || "",
        image_urls: gallery.length > 1 ? gallery.join("|") : "",
        category: (p.categoryPath || []).slice(1, 4).join(" > "),
        in_stock: inStock ? "true" : "false",
        ...Object.keys(specs).length ? { specs: JSON.stringify(specs) } : {},
        data_note: `Live prices from Lenovo India openapi search (finalPrice incl. instant savings), observed ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`
      },
      identifiers: p.productCode ? { sku: String(p.productCode) } : void 0,
      evidence: { sourceUrl: pageUrl, extractedFields: ["title", "price", "listPrice", "rating", "image", "url", "stock", "specs"] }
    }));
    if (items.length >= 30) break;
  }
  return items;
}
var LENOVO_SEARCH_API, money;
var init_lenovo = __esm({
  "server/workers/parsers/lenovo.ts"() {
    init_contract();
    LENOVO_SEARCH_API = "https://openapi.lenovo.com/in/en/ofp/search/global/cache/products/get/_tsc";
    money = (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : void 0;
    };
  }
});

// server/workers/parsers/realme.ts
function num2(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : void 0;
}
function parseRealmeSearch(rawBody, source, pageUrl) {
  let root;
  try {
    root = JSON.parse(rawBody);
  } catch {
    return [];
  }
  if (root?.code !== 200) return [];
  const recs = Array.isArray(root?.data?.records) ? root.data.records : [];
  const items = [];
  const seen = /* @__PURE__ */ new Set();
  for (const r of recs) {
    const name = String(r?.spuName || "").trim();
    const sku = String(r?.skuId || r?.spuId || "");
    if (!name || !sku || seen.has(sku)) continue;
    if (r?.isPricePendingDisplay) continue;
    const price = num2(r?.currentPrice) ?? num2(r?.useCouponPrice);
    if (!price) continue;
    seen.add(sku);
    const mrp = num2(r?.mrpPrice) ?? num2(r?.originalPrice);
    const hero = /^https?:\/\//.test(String(r?.overviewUrl || "")) ? String(r.overviewUrl) : "";
    const inStock = r?.stockStatus === true && r?.saleStatus !== false;
    const rating = num2(r?.reviewsScoreAvg);
    const reviews = num2(r?.reviewsTotalNum);
    const url = `https://buy.realme.com/in/goods/${sku}`;
    const brand = /narzo/i.test(name) ? "Realme (Narzo)" : /^realme/i.test(name) ? "Realme" : "Realme";
    const category = String(r?.productCategoryCode || "");
    items.push(newRawItem(source, {
      title: name.slice(0, 200),
      brand,
      model: String(r?.spuId || sku),
      price,
      listPrice: mrp && mrp > price ? mrp : void 0,
      currency: "INR",
      seller: "Realme (realme.com)",
      sellerUrl: url,
      availability: inStock ? "in_stock" : "out_of_stock",
      attributes: {
        brand,
        image: hero,
        image_urls: "",
        category,
        in_stock: inStock ? "true" : "false",
        ...reviews ? { review_count: String(Math.round(reviews)) } : {},
        ...rating ? { rating: String(Math.round(rating * 10) / 10) } : {},
        ...r?.tag ? { badge: String(r.tag).slice(0, 40) } : {},
        data_note: `Live prices from Realme India search API (api.realme.com), observed ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}. Gallery unavailable browserless: goods-detail API needs session auth \u2014 hero image only.`
      },
      identifiers: { sku },
      evidence: { sourceUrl: pageUrl, extractedFields: ["title", "price", "mrp", "brand", "image", "url", "stock", "rating"] }
    }));
    if (items.length >= 30) break;
  }
  return items;
}
var init_realme = __esm({
  "server/workers/parsers/realme.ts"() {
    init_contract();
  }
});

// server/workers/parsers/oppo.ts
function num3(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : void 0;
}
function parseOppoSearch(html) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  let idx = html.indexOf("buyLink");
  while (idx !== -1 && out.length < 40) {
    const start = walkBackToObject(html, idx);
    if (start !== -1) {
      const obj = scanObject(html, start);
      if (obj && typeof obj.buyLink === "string" && /^https?:/.test(obj.buyLink)) {
        const title = String(obj.title || "").trim();
        const key = String(obj.buyLink);
        if (title && !seen.has(key)) {
          seen.add(key);
          let img = String(obj.image || "");
          if (img && !/^https?:/.test(img)) img = img.startsWith("/") ? `https://www.oppo.com${img}` : `https://www.oppo.com/${img}`;
          out.push({ title, buyLink: key, image: img, tag: String(obj.tag || "") });
        }
      }
    }
    idx = html.indexOf("buyLink", idx + 7);
  }
  return out;
}
function walkBackToObject(s, i) {
  let depth = 0;
  let j = i;
  while (j > 0) {
    const c = s[j];
    if (c === "}") depth += 1;
    else if (c === "{") {
      if (depth === 0) return j;
      depth -= 1;
    }
    j -= 1;
  }
  return -1;
}
function scanObject(s, start) {
  const end = findObjectEnd(s, start);
  if (end === -1) return null;
  const body = s.slice(start, end + 1);
  const out = {};
  const re = /"([A-Za-z0-9_]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while (m = re.exec(body)) out[m[1]] = m[2];
  return Object.keys(out).length ? out : null;
}
function findObjectEnd(s, start) {
  let depth = 0;
  for (let k = start; k < s.length && k < start + 2e4; k++) {
    const c = s[k];
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return k;
    }
  }
  return -1;
}
function parseOppoPdp(html) {
  const variants = [];
  const seenSku = /* @__PURE__ */ new Set();
  let idx = html.indexOf('"priceCurrency"');
  let steps = 0;
  while (idx !== -1 && variants.length < 20 && steps < 120) {
    steps += 1;
    let start = walkBackToObject(html, idx);
    let v = null;
    while (start !== -1) {
      const end = findObjectEnd(html, start);
      if (end === -1) break;
      const body = html.slice(start, end + 1);
      if (body.includes('"sku"') && body.includes('"priceCurrency"')) {
        v = extractVariant(body);
        break;
      }
      start = walkBackToObject(html, start - 1);
    }
    if (v && !seenSku.has(v.sku)) {
      seenSku.add(v.sku);
      variants.push(v);
    }
    idx = html.indexOf('"priceCurrency"', idx + 15);
  }
  return variants;
}
function extractVariant(body) {
  const priceM = /"offers"\s*:\s*\{[^{}]*?"price"\s*:\s*"([0-9.]+)"/.exec(body);
  const price = num3(priceM?.[1]);
  if (!price) return null;
  const listM = /"listPrice"\s*:\s*\{\s*[^{}]*?"price"\s*:\s*"([0-9.]+)"/.exec(body);
  const skuM = /"sku"\s*:\s*"([0-9A-Za-z-]+)"/.exec(body);
  const nameM = /"name"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(body);
  const availM = /"availability"\s*:\s*"([^"]+)"/.exec(body);
  const colorM = /"color"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(body);
  const memM = /"memory"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(body);
  const storM = /"storageCapacity"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(body);
  const modelM = /"model"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(body);
  const images = [];
  const imgRe = /"image"\s*:\s*\[([\s\S]*?)\]/.exec(body);
  if (imgRe) {
    for (const u of imgRe[1].match(/https?:\/\/[^"',\s]+/g) || []) {
      if (!images.includes(u)) images.push(u);
      if (images.length >= 6) break;
    }
  }
  const name = (nameM?.[1] || "").trim();
  if (!name) return null;
  return {
    name,
    sku: skuM?.[1] || `${name}-${colorM?.[1] || ""}`,
    price,
    listPrice: num3(listM?.[1]),
    inStock: (availM?.[1] || "").includes("InStock"),
    images,
    color: colorM?.[1] || void 0,
    memory: memM?.[1] || void 0,
    storage: storM?.[1],
    model: modelM?.[1],
    variantCount: 1
  };
}
function extractOppoProsePrice(html) {
  const indian = (raw) => Number(raw.replace(/,/g, ""));
  const pats = [
    /is ₹([0-9][0-9,]{3,9}) in (?:a|an) [A-Za-z ]{0,30}configuration/,
    /Priced from ₹([0-9][0-9,]{3,9})/
  ];
  for (const re of pats) {
    const m = re.exec(html);
    if (m) {
      const price = indian(m[1]);
      if (Number.isFinite(price) && price >= 1e3) {
        return { price, matched: m[0].slice(0, 120) };
      }
    }
  }
  return null;
}
function oppoItem(source, pageUrl, prod, v, totalVariants, dataNoteOverride) {
  const gallery = [];
  if (/^https?:/.test(prod.image) && !gallery.includes(prod.image)) gallery.push(prod.image);
  for (const u of v.images) {
    if (/^https?:/.test(u) && !gallery.includes(u)) gallery.push(u);
    if (gallery.length >= 6) break;
  }
  const model = v.model || "";
  return newRawItem(source, {
    title: prod.title.slice(0, 200),
    brand: "Oppo",
    model,
    price: v.price,
    listPrice: v.listPrice && v.listPrice > v.price ? v.listPrice : void 0,
    currency: "INR",
    seller: "Oppo (oppo.com/in)",
    sellerUrl: prod.buyLink,
    availability: v.inStock ? "in_stock" : "out_of_stock",
    attributes: {
      brand: "Oppo",
      image: gallery[0] || "",
      image_urls: gallery.length > 1 ? gallery.join("|") : "",
      category: "electronics",
      in_stock: v.inStock ? "true" : "false",
      ...v.color ? { variant: v.color } : {},
      ...v.storage ? { storage: v.storage } : {},
      ...totalVariants > 1 ? { variant_count: String(totalVariants) } : {},
      data_note: dataNoteOverride || `Live price from Oppo India PDP schema.org offers (search SSR + product page), observed ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`
    },
    identifiers: { sku: v.sku },
    evidence: { sourceUrl: pageUrl, extractedFields: ["title", "price", "mrp", "brand", "image", "url", "stock", "pdp_gallery"] }
  });
}
var init_oppo = __esm({
  "server/workers/parsers/oppo.ts"() {
    init_contract();
  }
});

// server/workers/parsers/jiomart.ts
function parseJiomart(body, source, pageUrl) {
  let root;
  try {
    root = JSON.parse(body);
  } catch {
    return [];
  }
  let items = Array.isArray(root?.items) ? root.items : [];
  if (!items.length) {
    const walk2 = (o, depth) => {
      if (depth > 8 || !o || typeof o !== "object") return [];
      if (Array.isArray(o)) {
        if (o.length && typeof o[0] === "object" && o[0] && "name" in o[0] && (o[0]?.price?.effective || o[0]?.price?.marked)) {
          return o;
        }
        for (const v of o) {
          const r = walk2(v, depth + 1);
          if (r.length) return r;
        }
        return [];
      }
      for (const v of Object.values(o)) {
        const r = walk2(v, depth + 1);
        if (r.length) return r;
      }
      return [];
    };
    items = walk2(root, 0);
  }
  if (!items.length) return [];
  const out = [];
  for (const it of items.slice(0, 40)) {
    const name = String(it.name || "").trim();
    if (!name) continue;
    const eff = Number(it.price?.effective?.min ?? it.price?.effective?.max);
    const marked = Number(it.price?.marked?.min ?? it.price?.marked?.max);
    const price = Number.isFinite(eff) && eff > 0 ? eff : marked;
    if (!Number.isFinite(price) || price <= 0) continue;
    const brand = String(it.brand?.name || "").trim();
    const slug2 = String(it.slug || "").trim();
    const pdp = slug2 ? `https://www.jiomart.com/p/${slug2}` : "https://www.jiomart.com";
    const imgs = [...new Set(
      (it.medias || []).filter((m) => m?.type === "image" && typeof m.url === "string").map((m) => String(m.url).replace(/^http:/, "https:")).filter((u) => /^https:\/\//.test(u))
    )].slice(0, 6);
    const hero = imgs[0] || "";
    const discount = Number.isFinite(marked) && marked > price ? Math.round((marked - price) / marked * 100) : 0;
    const sku = String(it.sku_code || it.item_code || "").trim();
    out.push(newRawItem(source, {
      title: name.slice(0, 200),
      brand: brand || void 0,
      model: sku || (it.uid != null ? String(it.uid) : void 0),
      price,
      listPrice: Number.isFinite(marked) && marked > price ? marked : void 0,
      currency: it.price?.currency_code || "INR",
      seller: "JioMart",
      sellerUrl: pdp,
      availability: it.sellable === false ? "out_of_stock" : "in_stock",
      attributes: {
        brand,
        product: name,
        ...discount ? { discount: String(discount) } : {},
        image: hero,
        ...imgs.length > 1 ? { image_urls: imgs.join("|") } : {},
        data_note: `Product as listed on JioMart catalog search, observed ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`
      },
      identifiers: sku ? { sku, ...it.uid != null ? { vendorProductId: String(it.uid) } : {} } : void 0,
      evidence: {
        sourceUrl: pageUrl,
        extractedFields: ["name", "slug", "uid", "item_code", "brand.name", "price.effective.min", "price.marked.min", "medias[].url", "sellable"]
      }
    }));
  }
  return out;
}
var init_jiomart = __esm({
  "server/workers/parsers/jiomart.ts"() {
    init_contract();
  }
});

// server/workers/parsers/relianceDigital.ts
function extractRelianceState(html) {
  const i = html.indexOf("window.__INITIAL_STATE__");
  if (i < 0) return null;
  const eq = html.indexOf("=", i);
  if (eq < 0) return null;
  const s = html.slice(eq + 1).trimStart();
  if (s[0] !== "{") return null;
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let k = 0; k < s.length; k++) {
    const ch = s[k];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = k + 1;
        break;
      }
    }
  }
  if (end < 0) return null;
  try {
    return JSON.parse(s.slice(0, end));
  } catch {
    return null;
  }
}
function parseRelianceDigital(html, source, pageUrl) {
  const state = extractRelianceState(html);
  const list = state?.productListingPage?.productlists?.items;
  if (!Array.isArray(list)) return [];
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const it of list.slice(0, 40)) {
    const name = String(it?.name || "").trim();
    const price = Number(it?.price?.effective?.min);
    if (!name || !Number.isFinite(price) || price <= 0) continue;
    if (it?.sellable === false) continue;
    const slug2 = String(it?.slug || "").trim();
    if (!slug2 || seen.has(slug2)) continue;
    seen.add(slug2);
    const marked = Number(it?.price?.marked?.min);
    const mrp = Number.isFinite(marked) && marked > price ? marked : void 0;
    const brand = it?.brand?.name ? String(it.brand.name) : void 0;
    const medias = (Array.isArray(it?.medias) ? it.medias : []).filter((m) => m?.type !== "video" && typeof m?.url === "string").map((m) => String(m.url).replace(/^http:/, "https:"));
    const ean = Array.isArray(it?.attributes?.identifier?.ean) ? String(it.attributes.identifier.ean[0] || "") : "";
    const sku = Array.isArray(it?.attributes?.identifier?.sku_code) ? String(it.attributes.identifier.sku_code[0] || "") : "";
    const rating = Number(it?.rating);
    const url = `${RELIANCE_WEB}/product/${slug2}`;
    out.push(newRawItem(source, {
      title: name.slice(0, 200),
      brand,
      model: sku || void 0,
      price,
      listPrice: mrp,
      currency: "INR",
      seller: "Reliance Digital",
      sellerUrl: url,
      attributes: {
        brand: brand || "",
        discount: mrp ? `${Math.round((mrp - price) / mrp * 100)}%` : "",
        image: medias[0] || "",
        ...medias.length > 1 ? { image_urls: medias.slice(0, 6).join("|") } : {},
        ...Number.isFinite(rating) && rating > 0 ? { rating: String(rating) } : {},
        data_note: `Price as listed on reliancedigital.in search, observed ${today2}`
      },
      identifiers: ean || sku ? { ...ean ? { gtin: ean } : {}, ...sku ? { sku } : {} } : void 0,
      evidence: { sourceUrl: pageUrl, extractedFields: ["title", "price", "mrp", "brand", "image", "url"] }
    }));
  }
  return out;
}
var RELIANCE_WEB;
var init_relianceDigital = __esm({
  "server/workers/parsers/relianceDigital.ts"() {
    init_contract();
    RELIANCE_WEB = "https://www.reliancedigital.in";
  }
});

// server/workers/verticals/ecommerce.ts
function jmCityForPin(pincode) {
  if (!/^\d{6}$/.test(pincode)) return void 0;
  return JM_PIN_CITY[pincode.slice(0, 2)];
}
async function enrichAmazonGalleries(items, jar) {
  const targets = items.filter((it) => it.identifiers?.vendorProductId).slice(0, 3);
  for (const it of targets) {
    try {
      const asin = String(it.identifiers.vendorProductId);
      await new Promise((res) => setTimeout(res, 900));
      const r = await cffiFetch(`https://www.amazon.in/dp/${asin}`, { cookies: jar, timeoutMs: 12e3 });
      if (r.status !== 200 || r.body.includes("bm-verify") || looksLikeChallenge(r.body)) continue;
      const gallery = extractAmazonGallery(r.body);
      if (gallery.length >= 2) {
        it.attributes = it.attributes || {};
        it.attributes.image_urls = gallery.join("|");
        if (!it.attributes.image_url && gallery[0]) it.attributes.image_url = gallery[0];
        it.evidence = it.evidence || {};
        it.evidence.extractedFields = [.../* @__PURE__ */ new Set([...it.evidence.extractedFields || [], "pdp_gallery"])];
      }
    } catch {
    }
  }
  return items;
}
var import_node_crypto, q, JM_PIN_CITY, ecommerceWorker;
var init_ecommerce = __esm({
  "server/workers/verticals/ecommerce.ts"() {
    init_verticalWorker();
    init_amazonIn();
    init_flipkart();
    init_myntra();
    init_ajio();
    init_tatacliq();
    init_nykaa();
    init_croma();
    init_xiaomi();
    init_lenovo();
    init_realme();
    init_oppo();
    init_jiomart();
    init_relianceDigital();
    import_node_crypto = require("node:crypto");
    init_httpClient();
    init_curlCffiFetch();
    q = (ctx) => String(ctx.query.entityName || ctx.query.rawQuery || "").trim();
    JM_PIN_CITY = {
      "11": "Delhi",
      "40": "Mumbai",
      "56": "Bengaluru",
      "60": "Chennai",
      "70": "Kolkata",
      "50": "Hyderabad",
      "45": "Indore",
      "30": "Jaipur",
      "41": "Pune",
      "38": "Ahmedabad",
      "46": "Bhopal",
      "80": "Patna",
      "68": "Kochi",
      "32": "Lucknow",
      "22": "Mumbai",
      "14": "Chandigarh",
      "44": "Nagpur",
      "25": "Surat",
      "78": "Siliguri",
      "58": "Jabalpur"
    };
    ecommerceWorker = {
      vertical: "ecommerce",
      tasks: [
        {
          sourceId: "w_ecom_amazon_in",
          // Amazon.in now fronts repeated browserless hits with an Imperva "bm-verify"
          // interstitial: HTTP 200 + <meta refresh URL='...?bm-verify=TOKEN'>. Following
          // that URL once with the SAME cookie session returns the real results page,
          // so we run the acquisition as a cffi session handshake instead of a plain GET.
          timeoutMs: 4e4,
          run: async (ctx) => {
            const term = q(ctx);
            if (!term) return [];
            const url = `https://www.amazon.in/s?k=${encodeURIComponent(term)}`;
            let body = "";
            let status = 0;
            const r1 = await cffiFetch(url, { timeoutMs: 18e3, returnCookies: true });
            let jar = r1.cookies;
            body = r1.body;
            status = r1.status;
            if (status === 200 && body.includes("bm-verify")) {
              const m = body.match(/URL='([^']+)'/);
              if (m) {
                const vUrl = m[1].startsWith("/") ? "https://www.amazon.in" + m[1] : m[1];
                await new Promise((res) => setTimeout(res, 1200));
                const r2 = await cffiFetch(vUrl, { cookies: jar, returnCookies: true, timeoutMs: 22e3 });
                jar = r2.cookies || jar;
                body = r2.body;
                status = r2.status;
                if (status === 200 && body.includes("bm-verify")) {
                  const m2 = body.match(/URL='([^']+)'/);
                  if (m2) {
                    await new Promise((res) => setTimeout(res, 1200));
                    const v2 = m2[1].startsWith("/") ? "https://www.amazon.in" + m2[1] : m2[1];
                    const r3 = await cffiFetch(v2, { cookies: jar, timeoutMs: 22e3 });
                    body = r3.body;
                    status = r3.status;
                  }
                }
              }
            }
            if (status === 503) {
              await new Promise((res) => setTimeout(res, 2500));
              const r4 = await cffiFetch(url, { timeoutMs: 18e3, returnCookies: true });
              jar = r4.cookies || jar;
              body = r4.body;
              status = r4.status;
              if (status === 200 && body.includes("bm-verify")) {
                const m3 = body.match(/URL='([^']+)'/);
                if (m3) {
                  await new Promise((res) => setTimeout(res, 1200));
                  const v3 = m3[1].startsWith("/") ? "https://www.amazon.in" + m3[1] : m3[1];
                  const r5 = await cffiFetch(v3, { cookies: jar, timeoutMs: 22e3 });
                  body = r5.body;
                  status = r5.status;
                }
              }
            }
            if (status === 403) throw new AcquisitionError("ACCESS_CHALLENGE", "Amazon.in HTTP 403 (edge denied)", 403);
            if (status !== 200) throw new AcquisitionError("SERVER_ERROR", `Amazon.in HTTP ${status}`, status);
            const items = parseAmazonIn(body, ctx.source, url);
            if (items.length) return enrichAmazonGalleries(items, jar);
            if (body.includes("bm-verify") || looksLikeChallenge(body)) {
              throw new AcquisitionError("ACCESS_CHALLENGE", "Amazon.in presented a bm-verify challenge that did not clear");
            }
            throw new AcquisitionError("EMPTY_RESPONSE", `Amazon.in carried no parseable products (body ${body.length} bytes)`);
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
            const slug2 = term.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
            const url = `https://www.myntra.com/${encodeURIComponent(slug2)}`;
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
        {
          // Reliance Digital: Fynd/Jio-platform SSR storefront; window.__INITIAL_STATE__
          // carries productListingPage.productlists.items[] with real INR prices + images.
          sourceId: "w_ecom_reliance_digital",
          name: "Ecom worker: Reliance Digital (SSR __INITIAL_STATE__)",
          priority: 14,
          maxPerMinute: 8,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const term = q(ctx);
            if (!term) return [];
            const url = `https://www.reliancedigital.in/products?q=${encodeURIComponent(term)}`;
            const r = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 25e3 });
            if (r.status === 403 || r.status === 429) {
              throw new AcquisitionError(r.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED", `Reliance Digital blocked: ${r.status}`, r.status);
            }
            if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Reliance Digital HTTP ${r.status}`, r.status);
            const items = parseRelianceDigital(r.body, ctx.source, url);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", "Reliance Digital had no priced products for this query");
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
          // Tata CLiQ: web SPA's search BFF (reverse-engineered 13 Oct 2026).
          // x-auth / X-ACCESS-TOKEN = AES-192-CBC(current epoch seconds) with a
          // key extracted from the obfuscated client bundle; body is pure JSON.
          sourceId: "w_ecom_tatacliq",
          name: "Ecom worker: Tata CLiQ (search BFF)",
          priority: 16,
          run: async (ctx) => {
            const term = q(ctx);
            if (!term) return [];
            const searchText = encodeURIComponent(`${term}:relevance:inStockFlag:true`);
            const params = "isTextSearch=true&isFilter=false&qc=false&page=0&isKeywordRedirect=true&isKeywordRedirectEnabled=true&isFilterDataRequired=false&isMDE=true&isSuggested=false&isPwa=true&pageSize=20&typeID=all&channel=mobile";
            const url = `https://searchbff.tatacliq.com/v2/products/mpl/search?searchText=${searchText}&${params}&originalSearchText=${encodeURIComponent(term)}`;
            const key = "Vwdu3LWvHSOhAusUG9xfFw==";
            const ts = String(Math.floor(Date.now() / 1e3));
            const cipher = (0, import_node_crypto.createCipheriv)("aes-192-cbc", Buffer.from(key, "utf8"), Buffer.alloc(16, 0));
            const token = cipher.update(ts, "utf8", "base64") + cipher.final("base64");
            const r = await cffiFetch(url, {
              impersonate: "chrome",
              timeoutMs: 15e3,
              headers: {
                Accept: "application/json",
                authorization: "Bearer ",
                "x-auth": token,
                "X-ACCESS-TOKEN": token
              }
            });
            if (r.status === 401) throw new AcquisitionError("ACCESS_CHALLENGE", "Tata CLiQ search BFF rejected the x-auth token", r.status);
            if (r.status !== 200) throw new AcquisitionError("FORBIDDEN", `Tata CLiQ search BFF HTTP ${r.status}`, r.status);
            const items = parseTataCliq(r.body, ctx.source, url);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", "Tata CLiQ search BFF returned no parseable products");
            return items;
          }
        },
        {
          // Nykaa: SSR search page embeds the full result set in
          // <script id="__PRELOADED_STATE__"> -> listingV2.products[] (17 Oct 2026).
          sourceId: "w_ecom_nykaa",
          name: "Ecom worker: Nykaa (SSR preloaded state)",
          priority: 17,
          maxPerMinute: 8,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const term = q(ctx);
            if (!term) return [];
            const url = `https://www.nykaa.com/search/result/?q=${encodeURIComponent(term)}`;
            const r = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 25e3 });
            if (r.status === 403 || r.status === 429) {
              throw new AcquisitionError(r.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED", `Nykaa blocked: HTTP ${r.status}`, r.status);
            }
            if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Nykaa HTTP ${r.status}`, r.status);
            const items = parseNykaa(r.body, ctx.source, url);
            if (!items.length) {
              if (looksLikeChallenge(r.body)) throw new AcquisitionError("ACCESS_CHALLENGE", "Nykaa presented a challenge page");
              throw new AcquisitionError("EMPTY_RESPONSE", "Nykaa carried no parseable products for this query");
            }
            return items;
          }
        },
        {
          // Croma (croma.com, Tata electronics retailer) LIVE (22 Oct 2026): the PWA
          // search BFF is an unauthenticated GET extracted from the main SPA chunk
          // (searchservices/v1/search, channel=WEB + channelCode pincode 400001).
          // Multi-image: search gives 1 hero shot; top-3 PDP fetch lifts the
          // media.tatacroma.com Images gallery (Amazon pattern, soft-fail).
          sourceId: "w_ecom_croma",
          name: "Ecom worker: Croma (search BFF)",
          priority: 18,
          maxPerMinute: 8,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const term = q(ctx);
            if (!term) return [];
            const url = "https://api.croma.com/searchservices/v1/search?currentPage=0&query=" + encodeURIComponent(`${term}:relevance`) + "&fields=FULL&channel=WEB&channelCode=400001";
            const r = await cffiFetch(url, {
              impersonate: "chrome",
              timeoutMs: 2e4,
              headers: { Accept: "application/json", Referer: "https://www.croma.com/searchB" }
            });
            if (r.status === 403 || r.status === 429) {
              throw new AcquisitionError(r.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED", `Croma blocked: HTTP ${r.status}`, r.status);
            }
            if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Croma search BFF HTTP ${r.status}`, r.status);
            const items = parseCromaSearch(r.body, ctx.source, url);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", "Croma search BFF returned no parseable products");
            const pin = String(ctx.query.location?.pincode || "").trim();
            for (const it of items.filter((x) => x.identifiers?.sku).slice(0, 3)) {
              try {
                await new Promise((res) => setTimeout(res, 900));
                const pdpUrl = String(it.attributes?.sellerUrl || it.sellerUrl || "");
                const pr = await cffiFetch(pdpUrl || "https://www.croma.com", { impersonate: "chrome", timeoutMs: 15e3 });
                if (pr.status !== 200) continue;
                const gallery = extractCromaGallery(pr.body, String(it.identifiers?.sku || ""));
                if (gallery.length >= 2) {
                  mergeCromaGallery(it, gallery);
                  it.evidence = it.evidence || {};
                  it.evidence.extractedFields = [.../* @__PURE__ */ new Set([...it.evidence.extractedFields || [], "pdp_gallery"])];
                }
              } catch {
              }
            }
            return items;
          }
        },
        {
          // Realme India (owner request 22 Oct) LIVE: the realme.com NUXT search page
          // renders results client-side from an unauthenticated JSON POST cracked from
          // search bundle DPzNpKbK.js: POST api.realme.com/in/product/info/search with
          // {keyWords,pageNum,pageSize:20,labelType:1,sortType:1,categoryParams:[]}.
          // Records carry live price/MRP/stock/rating + hero image; PDP deeplink is
          // buy.realme.com/in/goods/<skuId>. Honest limit: the goods-detail API is
          // 401 session-gated, so no gallery beyond the hero (no fabrication).
          sourceId: "w_ecom_realme",
          name: "Ecom worker: Realme India (api.realme.com search)",
          priority: 18,
          maxPerMinute: 8,
          timeoutMs: 25e3,
          run: async (ctx) => {
            const term = q(ctx);
            if (!term) return [];
            const url = "https://api.realme.com/in/product/info/search";
            const r = await cffiFetch(url, {
              impersonate: "chrome",
              timeoutMs: 2e4,
              method: "POST",
              body: JSON.stringify({ keyWords: term, pageNum: 1, pageSize: 20, labelType: 1, sortType: 1, categoryParams: [] }),
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Origin: "https://www.realme.com",
                Referer: `https://www.realme.com/in/search?q=${encodeURIComponent(term)}`
              }
            });
            if (r.status === 403 || r.status === 429) {
              throw new AcquisitionError(r.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED", `Realme API blocked: HTTP ${r.status}`, r.status);
            }
            if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Realme API HTTP ${r.status}`, r.status);
            const items = parseRealmeSearch(r.body, ctx.source, url);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", "Realme search API returned no parseable products");
            return items;
          }
        },
        {
          // Oppo India (owner request 22 Oct) LIVE: the /in/search page is SSR'd by
          // "Venus-Render" and embeds product cards (title, buyLink, image) as JSON in
          // script blocks — but with NO prices. Stage 2 fetches each product's PDP,
          // which embeds per-variant schema.org objects (price, listPrice, InStock,
          // 4-shot colour galleries). Search gives up to 40 cards; the first 6 with a
          // buyLink get PDP enrichment (900ms spacing, soft-fail like Croma).
          sourceId: "w_ecom_oppo",
          name: "Ecom worker: Oppo India (SSR search + PDP schema.org)",
          priority: 18,
          maxPerMinute: 8,
          timeoutMs: 45e3,
          run: async (ctx) => {
            const term = q(ctx);
            if (!term) return [];
            const searchUrl = `https://www.oppo.com/in/search/?q=${encodeURIComponent(term)}`;
            const r = await cffiFetch(searchUrl, { impersonate: "chrome", timeoutMs: 2e4 });
            if (r.status === 403 || r.status === 429) {
              throw new AcquisitionError(r.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED", `Oppo search blocked: HTTP ${r.status}`, r.status);
            }
            if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Oppo search HTTP ${r.status}`, r.status);
            const prods = parseOppoSearch(r.body).filter((p) => p.buyLink.includes("/product/"));
            if (!prods.length) throw new AcquisitionError("EMPTY_RESPONSE", "Oppo search SSR had no buyLink products");
            const items = [];
            for (const prod of prods.slice(0, 6)) {
              try {
                await new Promise((res) => setTimeout(res, items.length ? 900 : 0));
                const pdp = await cffiFetch(prod.buyLink, { impersonate: "chrome", timeoutMs: 15e3 });
                if (pdp.status !== 200) continue;
                const variants = parseOppoPdp(pdp.body);
                if (variants.length) {
                  const pick3 = variants.find((v) => v.inStock) || variants[0];
                  items.push(oppoItem(ctx.source, searchUrl, prod, pick3, variants.length));
                  continue;
                }
                const prose = extractOppoProsePrice(pdp.body);
                if (prose) {
                  items.push(oppoItem(ctx.source, searchUrl, prod, {
                    name: prod.title,
                    sku: `prose-${prose.price}`,
                    price: prose.price,
                    inStock: true,
                    images: [],
                    variantCount: 1
                  }, 1, `Price from the PDP's own India-price FAQ text (\u201C${prose.matched}\u201D); structured variant prices load via a session-gated buy API`));
                }
              } catch {
              }
            }
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", "Oppo PDP enrichment yielded no priced variants");
            return items;
          }
        },
        {
          // Xiaomi India (mi.com — Redmi/Poco/Xiaomi, owner request 22 Oct) LIVE: the
          // storefront SPA fetches its search results from the goSite BFF, an
          // unauthenticated GET (cracked from the SPPS bundle chunk 33572:
          // url = goSite + "/v2/search/result", params word/type=2/page_size/from=pc).
          // Multi-image: the payload's commodity[] variants carry distinct colour shots,
          // merged into attributes.image_urls by the parser (no PDP fetch needed).
          sourceId: "w_ecom_xiaomi",
          name: "Ecom worker: Xiaomi India / Redmi (goSite search BFF)",
          priority: 18,
          maxPerMinute: 8,
          timeoutMs: 25e3,
          run: async (ctx) => {
            const term = q(ctx);
            if (!term) return [];
            const url = "https://in-go.buy.mi.com/in/v2/search/result?word=" + encodeURIComponent(term) + "&type=2&page_index=0&page_size=24&v2_page_index=0&v2_page_size=24&from=pc";
            const r = await cffiFetch(url, {
              impersonate: "chrome",
              timeoutMs: 2e4,
              headers: { Accept: "application/json", Referer: `https://www.mi.com/in/search/${encodeURIComponent(term)}` }
            });
            if (r.status === 403 || r.status === 429) {
              throw new AcquisitionError(r.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED", `Xiaomi goSite blocked: HTTP ${r.status}`, r.status);
            }
            if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Xiaomi goSite HTTP ${r.status}`, r.status);
            const items = parseXiaomiSearch(r.body, ctx.source, url);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", "Xiaomi search BFF returned no parseable products");
            return items;
          }
        },
        {
          // Lenovo India (lenovo.com, owner request 22 Oct) LIVE: the SRP is fully
          // client-rendered, but the search micro-app calls an unauthenticated JSON
          // GET on openapi.lenovo.com (captured via Playwright request tracing —
          // discovery only; production replays it with curl_cffi). CRITICAL: the
          // edge 403s (HTML) unless Referer is a lenovo.com/in/en/search URL.
          sourceId: "w_ecom_lenovo",
          name: "Ecom worker: Lenovo India (openapi search)",
          priority: 18,
          maxPerMinute: 6,
          timeoutMs: 25e3,
          run: async (ctx) => {
            const term = q(ctx);
            if (!term) return [];
            const url = lenovoSearchUrl(term);
            let r = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 2e4, headers: lenovoHeaders(term) });
            if (r.status === 403) {
              await new Promise((res) => setTimeout(res, 1500));
              r = await cffiFetch(url, {
                impersonate: "chrome",
                timeoutMs: 2e4,
                headers: { ...lenovoHeaders(term), Origin: "https://www.lenovo.com" }
              });
            }
            if (r.status === 403 || r.status === 429) {
              throw new AcquisitionError(r.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED", `Lenovo openapi edge block: HTTP ${r.status}`, r.status);
            }
            if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Lenovo openapi HTTP ${r.status}`, r.status);
            const items = parseLenovoSearch(r.body, ctx.source, url);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", "Lenovo search returned no priced products");
            return items;
          }
        },
        // ---- Owner-requested additions (17 Oct 2026): attempted live every search, honestly reported ----
        {
          // JioMart (Fynd/JCP platform) LIVE (17 Oct 2026): the catalog API
          // /api/service/application/catalog/v1.0/products/ is guest-accessible with two
          // headers lifted from the web theme bundle (themeBundle.umd.js):
          //   Authorization: Bearer base64(applicationID:applicationToken)
          //   x-location-detail: {"pincode","city","country_code"} (pincode+city must match)
          // No guest-JWT mint is needed; the application bearer itself authenticates.
          sourceId: "w_ecom_jiomart",
          name: "Ecom worker: JioMart (Fynd catalog v1.0)",
          priority: 17,
          maxPerMinute: 8,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const term = q(ctx);
            if (!term) return [];
            const JM_APP_ID = "685945f46c8c7aee3f3af605";
            const JM_APP_TOKEN = "TpKw7wD9h";
            const auth = "Bearer " + Buffer.from(`${JM_APP_ID}:${JM_APP_TOKEN}`).toString("base64");
            const api = (pin, city) => `https://www.jiomart.com/api/service/application/catalog/v1.0/products/?q=${encodeURIComponent(term)}&page_no=1&page_size=40&pincode=${encodeURIComponent(pin)}`;
            const headers = (pin, city) => ({
              Accept: "application/json",
              Authorization: auth,
              "x-location-detail": JSON.stringify({ pincode: pin, city, country_code: "91" }),
              Referer: "https://www.jiomart.com/"
            });
            const userPin = String(ctx.query.location?.pincode || "").trim();
            const userCity = String(ctx.query.location?.city || "").trim();
            const attempts = [];
            if (userPin && userCity) attempts.push({ pin: userPin, city: userCity });
            else if (userPin) {
              const c = jmCityForPin(userPin);
              if (c) attempts.push({ pin: userPin, city: c });
            }
            attempts.push({ pin: "400070", city: "Mumbai" });
            let lastStatus = 0;
            let lastBody = "";
            for (const a of attempts) {
              const r = await cffiFetch(api(a.pin, a.city), { impersonate: "chrome", timeoutMs: 25e3, headers: headers(a.pin, a.city) });
              if (r.status === 200) {
                const items = parseJiomart(r.body, ctx.source, api(a.pin, a.city));
                if (items.length) return items;
                lastStatus = 200;
                lastBody = r.body;
                continue;
              }
              if (r.status === 400 && r.body.includes("invalid pincode")) {
                lastStatus = 400;
                lastBody = r.body;
                continue;
              }
              if (r.status === 401 || r.status === 403) throw new AcquisitionError("ACCESS_CHALLENGE", `JioMart auth rejected: HTTP ${r.status}`, r.status);
              if (r.status === 429) throw new AcquisitionError("RATE_LIMITED", `JioMart throttled: HTTP ${r.status}`, r.status);
              lastStatus = r.status;
              lastBody = r.body;
            }
            if (lastStatus === 200 || lastStatus === 400 && lastBody.includes("invalid pincode")) {
              throw new AcquisitionError("EMPTY_RESPONSE", "JioMart catalog returned no parseable products for this query");
            }
            throw new AcquisitionError("SERVER_ERROR", `JioMart HTTP ${lastStatus}`, lastStatus);
          }
        },
        {
          // Snapdeal: WAF 403 on every TLS fingerprint (chrome110-124, edge, safari, iOS);
          // m.snapdeal.com serves a client-rendered shell. APK recon queued.
          sourceId: "w_ecom_snapdeal",
          name: "Ecom worker: Snapdeal (probe)",
          priority: 18,
          run: async (ctx) => {
            const term = q(ctx) || "products";
            const r = await cffiFetch(`https://www.snapdeal.com/search?keyword=${encodeURIComponent(term)}`, { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError(
              "ACCESS_CHALLENGE",
              r.status === 403 ? "Snapdeal WAF denies datacenter/browserless fingerprints on all TLS profiles; mobile web is a client-rendered shell." : `Snapdeal acquisition failed (HTTP ${r.status}); no browserless product API known.`,
              r.status || 403
            );
          }
        },
        {
          // Tata Neu: the web (tataneu.com) is an app-marketing shell; all commerce
          // (CLiQ/Croma/1mg/BigBasket) happens in the app. Tata CLiQ — its web
          // storefront arm — is already a live source (w_ecom_tatacliq).
          sourceId: "w_ecom_tataneu",
          name: "Ecom worker: Tata Neu (probe)",
          priority: 18,
          run: async (_ctx) => {
            throw new AcquisitionError("EMPTY_RESPONSE", 'Tata Neu commerce is app-only (tataneu.com is a marketing shell with no web search/pricing); its web storefront arm Tata CLiQ is a live source. Tata Neu offers, when surfaced, will state "available only on app".');
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
function extractOgImage(html) {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (!m) return void 0;
  const url = m[1].replace(/&amp;/g, "&").trim();
  if (url.startsWith("https://")) return url;
  return void 0;
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
    ...opts.facts.imageUrl ? { image_url: opts.facts.imageUrl } : {},
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
    // The indicative rate minimum is the row's comparable value — same convention as
    // BankBazaar's lender rows (price = rate) — rendered as % by the loans/insurance UI.
    // Without it the route-level price filter dropped every published-rate row the
    // moment any priced row existed (owner bug 17 Oct: only 1 company per vertical).
    price: opts.facts.rateMin,
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
        tenure: extractTenure(text),
        imageUrl: extractOgImage(r.body)
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
function cityFromRouteText(place) {
  const noPin = place.replace(/\(\s*\d{6}\s*\)/g, " ");
  const parts = noPin.split(",").map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
  return (parts.length ? parts[parts.length - 1] : noPin.replace(/\s+/g, " ").trim()) || place.trim();
}
async function cityForPlace(place) {
  const clean3 = cityFromRouteText(place);
  const pin = place.match(/\((\d{6})\)/)?.[1];
  if (!pin) return clean3 || null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      if (res.ok) {
        const j = await res.json();
        const po = j?.[0]?.PostOffice?.[0];
        const district = po?.District || po?.Block || null;
        if (district) return /delhi/i.test(district) ? "New Delhi" : String(district);
      }
      await new Promise((r) => setTimeout(r, 400));
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${pin}&countrycodes=in&format=jsonv2&limit=1`,
      { headers: { "User-Agent": "Try1Second/1.0" } }
    );
    if (res.ok) {
      const rows = await res.json() || [];
      if (rows.length) {
        const parts = String(rows[0].display_name || "").split(",").map((x) => x.trim()).filter(Boolean);
        const district = parts.length >= 4 ? parts[parts.length - 3] : parts[1];
        if (district && !/^\d+$/.test(district)) return /delhi/i.test(district) ? "New Delhi" : district;
      }
    }
  } catch {
  }
  return clean3 || null;
}
async function geocodePlace(name) {
  const a = await photonGeocode(name);
  if (a) return a;
  const city = cityFromRouteText(name);
  return city !== name ? photonGeocode(city) : null;
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
    const imgEl = card.find('img[data-testid="hotel-image"]').first().length ? card.find('img[data-testid="hotel-image"]').first() : card.find('img[src*="bstatic.com"], img[data-src*="bstatic.com"]').first();
    const img = String(imgEl.attr("src") || imgEl.attr("data-src") || "").trim();
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
        ...img ? { image_url: img } : {},
        ...score ? { review_score: score } : {},
        ...distance ? { distance_from_center: distance.slice(0, 40) } : {},
        price_scope: `nightly rate for ${checkin} \u2192 ${checkout} (as displayed by Booking.com)`,
        price_currency_note: currency !== "INR" ? "Price in source currency; convert to INR at checkout" : ""
      },
      evidence: {
        sourceUrl: searchUrl,
        sourceReference: name,
        rawFingerprint: fingerprint,
        extractedFields: ["title", "price", ...img ? ["image_url"] : [], ...score ? ["review_score"] : []]
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

// server/workers/parsers/expediaGroup.ts
function parsePriceFormatted(f) {
  const m = String(f || "").replace(/\s/g, "").match(/(₹|\$|€|£)?([\d,]+(?:\.\d+)?)/);
  if (!m) return { value: 0, currency: "USD" };
  const n = Number(m[2].replace(/,/g, ""));
  const cur = m[1] === "\u20B9" ? "INR" : m[1] === "\u20AC" ? "EUR" : m[1] === "\xA3" ? "GBP" : "USD";
  return { value: Number.isFinite(n) && n > 0 ? n : 0, currency: cur };
}
function parseExpediaGroup(body, source, site, checkin, checkout, fx) {
  let d;
  try {
    d = JSON.parse(body);
  } catch {
    return [];
  }
  const listings = d?.data?.propertySearch?.propertySearchListings || [];
  const origin = `https://www.${site}`;
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  for (const L of listings.slice(0, 60)) {
    if (L?.__typename !== "LodgingCard") continue;
    const name = String(L?.headingSection?.heading || "").trim();
    if (!name || seen.has(name)) continue;
    const { value: price, currency } = parsePriceFormatted(String(L?.priceSection?.priceSummary?.options?.[0]?.displayPrice?.formatted || ""));
    if (!price) continue;
    seen.add(name);
    const img = String(L?.mediaSection?.gallery?.media?.[0]?.media?.url || "").replace(/^http:/, "https:");
    const rel = String(L?.cardLink?.resource?.relativePath || "");
    const url = rel ? `${origin}${rel.startsWith("/") ? rel : `/${rel}`}` : origin;
    const sellerUrl = `${url}${url.includes("?") ? "&" : "?"}chkin=${checkin}&chkout=${checkout}`;
    let finalPrice = price, finalCurrency = currency;
    let note = `Nightly rate observed on ${site} live listing API, ${today2}`;
    if (fx && currency === "USD" && price > 0) {
      finalPrice = Math.round(price * fx.rate);
      finalCurrency = "INR";
      note = `$${price} nightly listed on ${site}, converted to INR at live USD/INR ${fx.rate.toFixed(2)} (${fx.source}), ${today2}`;
    }
    out.push(newRawItem(source, {
      title: name.slice(0, 200),
      price: finalPrice,
      currency: finalCurrency,
      seller: site === "hotels.com" ? "Hotels.com" : "Expedia",
      sellerUrl,
      attributes: {
        image: img,
        ...img ? { image_url: img } : {},
        data_note: note
      },
      identifiers: L?.id ? { vendorProductId: String(L.id) } : void 0,
      evidence: { sourceUrl: sellerUrl, extractedFields: ["title", "price", "image", "url"] }
    }));
  }
  return out;
}
var EXPEDIA_GRAPHQL_QUERY;
var init_expediaGroup = __esm({
  "server/workers/parsers/expediaGroup.ts"() {
    init_contract();
    EXPEDIA_GRAPHQL_QUERY = `query LodgingPropertySearch($context: ContextInput!, $criteria: PropertySearchCriteriaInput) {
  propertySearch(context: $context, criteria: $criteria) {
    __typename
    propertySearchListings {
      __typename
      ... on LodgingCard {
        id
        headingSection { heading }
        priceSection { priceSummary { options { displayPrice { formatted } } } }
        mediaSection { gallery { media { media { ... on Image { url } } } } }
        cardLink { resource { ... on HttpURI { relativePath } } }
      }
    }
  }
}`;
  }
});

// server/common/fxRates.ts
async function fetchRateFrom(source) {
  try {
    const r = await cffiFetch(source, { timeoutMs: 12e3, headers: { Accept: "application/json" } });
    if (r.status !== 200) return null;
    const d = JSON.parse(r.body);
    const inr = Number(d?.rates?.INR);
    return Number.isFinite(inr) && inr > 20 && inr < 200 ? inr : null;
  } catch {
    return null;
  }
}
async function usdToInrRate() {
  if (cache2 && Date.now() - cache2.fetchedAt < TTL_MS) return { rate: cache2.rate, source: cache2.source };
  const sources2 = [
    "https://open.er-api.com/v6/latest/USD",
    "https://api.exchangerate-api.com/v4/latest/USD"
  ];
  for (const src2 of sources2) {
    const rate = await fetchRateFrom(src2);
    if (rate) {
      cache2 = { rate, source: new URL(src2).host, fetchedAt: Date.now() };
      return { rate, source: cache2.source };
    }
  }
  return null;
}
var cache2, TTL_MS;
var init_fxRates = __esm({
  "server/common/fxRates.ts"() {
    init_curlCffiFetch();
    cache2 = null;
    TTL_MS = 60 * 60 * 1e3;
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
      const allImgs = (Array.isArray(d?.imageSlider?.data?.images) ? d.imageSlider.data.images : []).map((im) => im?.data?.url).filter((u) => typeof u === "string" && u).map((u) => u.startsWith("http") ? u : CLEARTRIP_IMAGE_CDN + u.replace(/^\/+/, "")).slice(0, 8);
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
        imageUrls: allImgs,
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
      ...h.imageUrls && h.imageUrls.length > 1 ? { image_urls: h.imageUrls.join("|") } : {},
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

// server/workers/parsers/goibiboHermes.ts
function collectHermesHotels(node, out, depth = 0) {
  if (!node || depth > 8 || out.length >= 60) return;
  if (Array.isArray(node)) {
    const candidates = node.filter(isHotelish);
    if (candidates.length >= 3) {
      for (const c of candidates) {
        const price = toPrice(pick(c, PRICE_KEYS) ?? c.pricing ?? c.priceDetails ?? c.fareDetails);
        if (price <= 0) continue;
        out.push({
          name: String(pick(c, NAME_KEYS)).trim().slice(0, 160),
          price,
          rating: (() => {
            const r = Number(pick(c, RATING_KEYS));
            return Number.isFinite(r) && r > 0 && r <= 5 ? r : void 0;
          })(),
          image: (() => {
            const i = pick(c, IMAGE_KEYS);
            return typeof i === "string" && /^https?:\/\//.test(i) ? i : void 0;
          })(),
          locality: (() => {
            const l = pick(c, LOCALITY_KEYS);
            return typeof l === "string" ? l.slice(0, 80) : void 0;
          })(),
          url: (() => {
            const u = pick(c, URL_KEYS);
            return typeof u === "string" && /^https?:\/\//.test(u) ? u : void 0;
          })()
        });
        if (out.length >= 60) return;
      }
      return;
    }
    for (const x of node) collectHermesHotels(x, out, depth + 1);
    return;
  }
  if (typeof node === "object") {
    for (const v of Object.values(node)) collectHermesHotels(v, out, depth + 1);
  }
}
function parseHermesHotels(body, source, city, checkIn, checkOut, sourceUrl) {
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    return [];
  }
  const rows = [];
  collectHermesHotels(json, rows);
  if (!rows.length) return [];
  const seen = /* @__PURE__ */ new Set();
  const items = [];
  for (const h of rows) {
    if (seen.has(h.name)) continue;
    seen.add(h.name);
    items.push(newRawItem(source, {
      title: h.name,
      seller: "Goibibo",
      sellerUrl: h.url || sourceUrl,
      currency: "INR",
      price: h.price,
      attributes: {
        ...h.image ? { image_url: h.image } : {},
        ...h.rating !== void 0 ? { rating: String(h.rating) } : {},
        ...h.locality ? { locality: h.locality } : {},
        city,
        check_in: checkIn,
        check_out: checkOut,
        price_basis: `per night for 1 room (${checkIn} \u2192 ${checkOut}, engine-chosen dates)`,
        data_note: "Live nightly fares from Goibibo hotel search API (hermes v12)"
      },
      evidence: {
        sourceUrl,
        extractedFields: ["title", "price", ...h.rating !== void 0 ? ["rating"] : [], ...h.locality ? ["locality"] : []]
      }
    }));
  }
  return items.slice(0, 40);
}
var NAME_KEYS, PRICE_KEYS, RATING_KEYS, IMAGE_KEYS, LOCALITY_KEYS, URL_KEYS, pick, toPrice, isHotelish;
var init_goibiboHermes = __esm({
  "server/workers/parsers/goibiboHermes.ts"() {
    init_contract();
    NAME_KEYS = ["hotelName", "hotel_name", "hn", "name", "nm", "title", "hotelTitle"];
    PRICE_KEYS = ["fare", "Fare", "price", "Price", "op", "Op", "amount", "totalToPay", "totalPrice", "baseFare", "minrate", "minRate", "Minrate", "displayPrice", "discAmount"];
    RATING_KEYS = ["hotelRating", "rating", "starRating", "userRating", "gr"];
    IMAGE_KEYS = ["hotelImage", "image", "img", "thumbnail", "hc", "imageUrl"];
    LOCALITY_KEYS = ["locality", "area", "address", "location", "hotelLoc"];
    URL_KEYS = ["hotelUrl", "url", "deeplink", "link", "hotelCodeUrl"];
    pick = (o, keys) => {
      for (const k of keys) {
        const v = o[k];
        if (v !== void 0 && v !== null && String(v).trim() !== "") return v;
      }
      return void 0;
    };
    toPrice = (v) => {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.round(v);
      if (typeof v === "string") {
        const m = /(\d[\d,]{2,})/.exec(v);
        if (m) {
          const n = Number(m[1].replace(/,/g, ""));
          if (Number.isFinite(n) && n > 0) return Math.round(n);
        }
      }
      if (v && typeof v === "object") {
        let min;
        const walk2 = (x) => {
          if (typeof x === "number" && Number.isFinite(x) && x > 50 && x < 1e7) min = min === void 0 ? x : Math.min(min, x);
          else if (x && typeof x === "object") for (const vv of Object.values(x)) walk2(vv);
        };
        walk2(v);
        if (min !== void 0) return Math.round(min);
      }
      return 0;
    };
    isHotelish = (o) => {
      if (!o || typeof o !== "object" || Array.isArray(o)) return false;
      const name = pick(o, NAME_KEYS);
      if (typeof name !== "string" || name.trim().length < 3) return false;
      return true;
    };
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
      imageUrls: (Array.isArray(r.contextualPictures) ? r.contextualPictures : []).map((x) => x?.picture).filter((u) => typeof u === "string" && u.startsWith("http")).slice(0, 8),
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
      ...s.imageUrls && s.imageUrls.length > 1 ? { image_urls: s.imageUrls.join("|") } : {},
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
function pickImages2(h) {
  const out = [];
  for (const e of Array.isArray(h.imageInfoList) ? h.imageInfoList : []) {
    const u = e?.imageUrl || e?.url || e?.thumbUrl || e?.mainImage || e?.image || e?.dynamicImageUrl || e?.cdnUrl;
    if (typeof u === "string" && u && !out.includes(u)) out.push(u.replace(/^http:/, "https:"));
  }
  return out.slice(0, 8);
}
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
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  for (const h of results.slice(0, 60)) {
    const name = String(h.name || "").trim();
    const fare = Number(h.fareDetail?.displayedBaseFare);
    if (!name || !Number.isFinite(fare) || fare <= 0) continue;
    const site = siteFor(name, h.city || city);
    const img = pickImage2(h);
    const imgs = pickImages2(h);
    items.push(newRawItem(source, {
      title: name.slice(0, 200),
      brand: name.slice(0, 200),
      price: Math.round(fare),
      currency: "INR",
      // Owner rule (17 Oct): the seller is the PLATFORM whose price is shown — a hotel's
      // NAME must never appear in the Platforms & Sellers sidebar. The booking deeplink
      // still goes to the hotel's own channels (siteFor), never to Ixigo.
      seller: "Ixigo",
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
        ...imgs.length > 1 ? { image_urls: imgs.join("|") } : {},
        price_basis: "per night, base fare as published by Ixigo",
        chain_site: site.chain ? "brand official website" : "web search for official site",
        data_note: `Price observed on Ixigo (metasearch) on ${today2}; booking is via the hotel's own channels, never via Ixigo`
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

// server/workers/parsers/goibiboHotels.ts
function walk(node, out, depth = 0) {
  if (depth > 9 || !node) return;
  if (Array.isArray(node)) {
    if (node.length >= 3 && node.length <= 800) {
      const scored = node.filter((x) => x && typeof x === "object" && !Array.isArray(x)).map((x) => scoreHotelLike(x)).filter((x) => x.score > 0);
      if (scored.length >= Math.max(3, Math.floor(node.length * 0.6))) {
        out.push(...scored);
      }
    }
    for (const x of node) walk(x, out, depth + 1);
    return;
  }
  if (typeof node === "object") {
    for (const v of Object.values(node)) walk(v, out, depth + 1);
  }
}
function keyMatches(key, keys) {
  const lk = key.toLowerCase();
  return keys.some((n) => {
    const ln = n.toLowerCase();
    return lk === ln || lk.endsWith("." + ln);
  });
}
function scoreHotelLike(o) {
  let score = 0;
  const flat = flatten(o, 0, 3);
  for (const k of Object.keys(flat)) {
    if (keyMatches(k, NAME_KEYS2)) score += 2;
    if (keyMatches(k, PRICE_KEYS2)) score += 3;
    if (keyMatches(k, RATING_KEYS2)) score += 1;
    if (keyMatches(k, IMG_KEYS)) score += 1;
  }
  return { obj: flat, score };
}
function flatten(o, depth, maxDepth, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v) && depth < maxDepth) {
      Object.assign(out, flatten(v, depth + 1, maxDepth, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}
function pickFirst(flat, keys) {
  for (const [k, v] of Object.entries(flat)) {
    const lk = k.toLowerCase();
    if (keys.some((n) => lk === n.toLowerCase()) || keys.some((n) => lk.endsWith("." + n.toLowerCase()))) return v;
  }
  return void 0;
}
function parseGoibiboHotelsSsr(body) {
  const m = /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(body);
  if (!m) return [];
  let data;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const hits = [];
  walk(data, hits);
  hits.sort((a, b) => b.score - a.score);
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const h of hits) {
    if (h.score < 5) continue;
    const name = String(pickFirst(h.obj, NAME_KEYS2) || "").trim();
    let price = Number(pickFirst(h.obj, PRICE_KEYS2)) || 0;
    if (Array.isArray(pickFirst(h.obj, PRICE_KEYS2))) price = Number(pickFirst(h.obj, PRICE_KEYS2)[0]) || 0;
    if (!name || !Number.isFinite(price) || price < 100 || price > 1e7) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const rating = Number(pickFirst(h.obj, RATING_KEYS2)) || void 0;
    let image = String(pickFirst(h.obj, IMG_KEYS) || "");
    if (image && image.startsWith("//")) image = "https:" + image;
    const locality = String(pickFirst(h.obj, ["locality", "area", "address", "location"]) || "");
    const slug2 = String(pickFirst(h.obj, ["slug", "hotelUrl", "url", "link"]) || "");
    out.push({ name, price, rating, image: image || void 0, locality: locality || void 0, url: slug2 || void 0 });
    if (out.length >= 60) break;
  }
  return out;
}
var NAME_KEYS2, PRICE_KEYS2, RATING_KEYS2, IMG_KEYS;
var init_goibiboHotels = __esm({
  "server/workers/parsers/goibiboHotels.ts"() {
    NAME_KEYS2 = ["name", "displayName", "hotelName", "hotel_name", "propertyName", "title"];
    PRICE_KEYS2 = ["price", "fare", "total", "totalPrice", "sellingPrice", "amount", "perNight", "baseFare", "finalPrice"];
    RATING_KEYS2 = ["rating", "hotelRating", "userRating", "starRating", "goibiboRating"];
    IMG_KEYS = ["image", "imgUrl", "imageUrl", "thumbnail", "hotelImage", "mainImage", "imageURL"];
  }
});

// server/workers/parsers/goibiboHotelSsr.ts
function extractInitialState(body) {
  const marker = "window.__initial_state__=";
  const start = body.indexOf(marker);
  if (start < 0) return null;
  let i = start + marker.length;
  while (i < body.length && /\s/.test(body[i])) i++;
  if (body[i] !== "{") return null;
  const objStart = i;
  let depth = 0, inStr = false, esc = false, end = -1;
  for (; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;
  let raw = body.slice(objStart, end + 1);
  raw = raw.replace(/new Date\("([^"]*)"\)/g, '"$1"');
  raw = raw.replace(/:undefined/g, ":null");
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function firstUrl(h) {
  const u = h?.detailDeeplinkUrl || h?.seoUrl || h?.sharingUrl || "";
  return String(u || "");
}
function parseGoibiboHotelSsrState(body) {
  const d = extractInitialState(body);
  if (!d) return { rows: [] };
  const out = { rows: [] };
  const ci = d?.common?.checkin?.date, co = d?.common?.checkout?.date;
  if (typeof ci === "string") out.checkIn = ci.slice(0, 10);
  if (typeof co === "string") out.checkOut = co.slice(0, 10);
  const hc = d?.srpUnif?.srpData?.hotelCount;
  if (Number.isFinite(Number(hc))) out.hotelCount = Number(hc);
  const sections = d?.srpUnif?.srpData?.personalizedSections || {};
  const seen = /* @__PURE__ */ new Set();
  const pushHotel = (h) => {
    if (!h || typeof h !== "object") return;
    const name = String(h.name || h.maskedName || "").trim();
    const pd = h.priceDetail || {};
    let price = Number(pd.discountedPrice ?? pd.price ?? 0) || 0;
    if (!price) price = Number(pd.discountedPriceWithTax ?? pd.priceWithTax ?? 0) || 0;
    if (!name || !Number.isFinite(price) || price < 100 || price > 1e7) return;
    if (h.soldOut === true || h.showCallToBook === true) return;
    const key = name.toLowerCase() + "|" + Math.round(price);
    if (seen.has(key)) return;
    seen.add(key);
    let image = "";
    if (Array.isArray(h.media) && h.media[0]?.url) {
      const mu = String(h.media[0].url);
      image = mu.startsWith("//") ? `https:${mu}` : mu;
    }
    let rating;
    const rs = h?.reviewSummaryUgc;
    if (rs) {
      const rv = Number(rs?.hotelRating ?? rs?.rating ?? rs?.overallRating ?? rs?.avgRating);
      if (Number.isFinite(rv) && rv > 0) rating = Math.round(rv * 10) / 10;
    }
    const loc = Array.isArray(h.locationPersuasion) ? String(h.locationPersuasion[0] || "") : String(h?.locationDetail?.name || "");
    out.rows.push({
      name,
      price,
      rating,
      image,
      locality: loc,
      url: firstUrl(h)
    });
  };
  for (const key of Object.keys(sections)) {
    const sec = sections[key];
    const list = Array.isArray(sec?.hotels) ? sec.hotels : Array.isArray(sec?.hotelInfoList) ? sec.hotelInfoList : null;
    if (list) for (const h of list) pushHotel(h);
  }
  if (!out.rows.length) {
    const scan = (o, depth = 0) => {
      if (!o || typeof o !== "object" || depth > 6) return;
      if (Array.isArray(o)) {
        for (const x of o) {
          if (x?.priceDetail && x?.name) pushHotel(x);
          else scan(x, depth + 1);
        }
        return;
      }
      for (const v of Object.values(o)) scan(v, depth + 1);
    };
    scan(d?.srpUnif?.srpData);
  }
  return out;
}
var init_goibiboHotelSsr = __esm({
  "server/workers/parsers/goibiboHotelSsr.ts"() {
  }
});

// server/workers/parsers/mmtHotelLanding.ts
function num4(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}
function pickFirst2(o, keys) {
  for (const k of keys) {
    const v = o?.[k];
    if (v !== void 0 && v !== null && v !== "") return v;
  }
  return void 0;
}
function parseMmtHotelLanding(body) {
  const marker = "$hotelReducerResponse";
  const out = { rows: [], reducerEmpty: false };
  let i = body.indexOf(marker);
  if (i < 0) return out;
  while (i >= 0 && !out.rows.length) {
    const eq = body.indexOf("=", i);
    if (eq < 0) break;
    let j = eq + 1;
    while (j < body.length && /\s/.test(body[j])) j++;
    if (body[j] !== "{") {
      i = body.indexOf(marker, eq);
      continue;
    }
    const objStart = j;
    let depth = 0, inStr = false, esc = false, end = -1;
    for (; j < body.length; j++) {
      const c = body[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end < 0) break;
    let red;
    try {
      red = JSON.parse(body.slice(objStart, end + 1));
    } catch {
      i = body.indexOf(marker, end);
      continue;
    }
    const hasContent = JSON.stringify(red).length > 50;
    out.reducerEmpty = out.reducerEmpty || !hasContent;
    const seen = /* @__PURE__ */ new Set();
    const scan = (o, depth2) => {
      if (!o || typeof o !== "object" || depth2 > 6) return;
      if (Array.isArray(o)) {
        for (const x of o) scan(x, depth2 + 1);
        return;
      }
      const name = String(pickFirst2(o, NAME_KEYS3) || "").trim();
      const price = num4(pickFirst2(o, PRICE_KEYS3));
      if (name && Number.isFinite(price) && price >= 100 && price <= 1e7) {
        const key = name.toLowerCase() + "|" + Math.round(price);
        if (!seen.has(key)) {
          seen.add(key);
          let image = String(pickFirst2(o, IMG_KEYS2) || "");
          if (image.startsWith("//")) image = `https:${image}`;
          const rating = num4(pickFirst2(o, RATING_KEYS3));
          out.rows.push({
            name,
            price,
            rating: Number.isFinite(rating) && rating > 0 && rating <= 5 ? Math.round(rating * 10) / 10 : void 0,
            image,
            locality: String(pickFirst2(o, LOC_KEYS) || ""),
            url: ""
          });
        }
      }
      for (const v of Object.values(o)) scan(v, depth2 + 1);
    };
    scan(red, 0);
    i = body.indexOf(marker, end);
  }
  return out;
}
var PRICE_KEYS3, NAME_KEYS3, RATING_KEYS3, IMG_KEYS2, LOC_KEYS;
var init_mmtHotelLanding = __esm({
  "server/workers/parsers/mmtHotelLanding.ts"() {
    PRICE_KEYS3 = ["price", "priceForOneNight", "fare", "minFare", "cheapestPrice", "startingPrice", "basePrice", "amount", "nightlyRate"];
    NAME_KEYS3 = ["name", "hotelName", "displayName", "title", "propertyName"];
    RATING_KEYS3 = ["rating", "starRating", "userRating", "avgRating", "hotelRating"];
    IMG_KEYS2 = ["image", "imageUrl", "thumbUrl", "heroImage", "img", "image_url"];
    LOC_KEYS = ["locality", "areaName", "area", "neighbourhood", "location"];
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

// server/workers/parsers/oyoHotels.ts
function oyoCityPaths(city) {
  const out = [];
  for (const v of cityVariants(city)) {
    const p = `hotels-in-${slugOf(v)}`;
    if (!out.includes(p)) out.push(p);
  }
  return out.slice(0, 6);
}
function parseOyoPreloadedState(html) {
  const start = html.indexOf("window.__PRELOADED_STATE__");
  if (start === -1) return null;
  const eq = html.indexOf("=", start);
  if (eq === -1) return null;
  let sub = html.slice(eq + 1).trim();
  if (sub.startsWith('JSON.parse("')) {
    const q3 = sub.indexOf('"', "JSON.parse(".length);
    const end = sub.indexOf('")', q3);
    const inner = sub.slice(q3 + 1, end === -1 ? Math.min(sub.length, q3 + 3e6) : end);
    try {
      sub = JSON.parse(`"${inner}"`);
    } catch {
    }
  }
  const tail = sub.indexOf("</script>");
  if (tail !== -1) sub = sub.slice(0, tail);
  sub = sub.trim().replace(/;$/, "");
  try {
    const d = JSON.parse(sub);
    return typeof d === "string" ? JSON.parse(d) : d;
  } catch {
    return null;
  }
}
function parseOyoHotels(state) {
  const raw = state?.listing?.hotels;
  if (!Array.isArray(raw)) return [];
  const num10 = (x) => {
    if (x == null || x === "") return null;
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  };
  const out = [];
  for (const h of raw) {
    if (!h || typeof h !== "object") continue;
    const pricing = h.pricing || {};
    const tax = pricing.taxInfo || {};
    const rating = h.rating || {};
    const geo = h.geo_location || {};
    const images = (Array.isArray(h.hotel_images) ? h.hotel_images : []).filter((u) => typeof u === "string" && u.startsWith("http"));
    out.push({
      id: String(h.id ?? ""),
      name: String(h.name ?? "").trim(),
      url: typeof h.url === "string" && h.url.startsWith("/") ? h.url : null,
      address: typeof h.address === "string" ? h.address : null,
      city: typeof h.city === "string" ? h.city : null,
      category: typeof h.category === "string" ? h.category : null,
      oneLiner: typeof h.oneLinerText === "string" ? h.oneLinerText : null,
      rating: num10(rating.value),
      ratingCount: num10(rating.count),
      pricePerNight: num10(pricing.bookingPrice),
      tax: num10(tax.total_tax),
      priceInclusive: num10(tax.final_price_with_tax),
      slashedPrice: num10(pricing.slashedPrice),
      discountPercentage: num10(pricing.discountPercentage),
      imageUrl: images[0] || null,
      images: images.slice(0, 6),
      lat: num10(geo.lat ?? geo.latitude),
      lon: num10(geo.lng ?? geo.long ?? geo.longitude),
      soldOut: Boolean(h.isSoldOut) || h.status === "Soldout"
    });
  }
  return out;
}
function parseOyoOffers(hotels, source, city, meta) {
  const out = [];
  const srpUrl = `${OYO_WEB}/${meta.path}/?checkin=${fmtDdMmYyyy(meta.checkin)}&checkout=${fmtDdMmYyyy(meta.checkout)}&guests=2&rooms=1`;
  for (const h of hotels) {
    if (!h.name || h.soldOut || h.pricePerNight == null || h.pricePerNight <= 0) continue;
    const deeplink = h.url ? `${OYO_WEB}${h.url}` : srpUrl;
    const attrs = {
      image_url: h.imageUrl,
      images: h.images.join("|"),
      rating: h.rating != null ? String(h.rating) : null,
      // already /5
      review_count: h.ratingCount,
      address: h.address,
      city: h.city || city,
      property_category: h.category,
      latitude: h.lat,
      longitude: h.lon,
      property_id: h.id,
      price_basis: h.priceInclusive != null ? `per night on OYO (\u20B9${Math.round(h.pricePerNight)} + \u20B9${Math.round(h.tax ?? 0)} tax; total \u20B9${Math.round(h.priceInclusive)})` : "per night on OYO (tax-exclusive booking price)",
      data_note: "Live per-night rates observed on OYO city listing"
    };
    if (h.discountPercentage) attrs.discount = `${Math.round(h.discountPercentage)}% off`;
    if (h.oneLiner) attrs.tagline = h.oneLiner;
    out.push(newRawItem(source, {
      title: h.name,
      seller: "OYO",
      sellerUrl: deeplink,
      currency: "INR",
      price: Math.round(h.pricePerNight),
      listPrice: h.slashedPrice && h.slashedPrice > h.pricePerNight ? Math.round(h.slashedPrice) : void 0,
      attributes: attrs,
      travel: { date: meta.checkin, route: `${city} stay`, roomType: h.category || void 0 },
      evidence: {
        sourceUrl: srpUrl,
        sourceReference: h.id,
        extractedFields: ["title", "price", "rating", "review_count", "image_url", "deeplink"]
      }
    }));
  }
  return out;
}
function fmtDdMmYyyy(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
var OYO_WEB;
var init_oyoHotels = __esm({
  "server/workers/parsers/oyoHotels.ts"() {
    init_contract();
    init_cityAlias();
    OYO_WEB = "https://www.oyorooms.com";
  }
});

// server/workers/parsers/yatraHotels.ts
function parseYatraHotels(body) {
  const content = body?.data?.content;
  const rates = Array.isArray(body?.data?.rates?.hotels) ? body.data.rates.hotels : [];
  const rateById = /* @__PURE__ */ new Map();
  for (const r of rates) if (r?.id) rateById.set(String(r.id), r);
  const hotels = Array.isArray(content?.hotels) ? content.hotels : [];
  const out = [];
  for (const h of hotels) {
    if (!h || typeof h !== "object") continue;
    const rate = rateById.get(String(h.id ?? "")) || {};
    out.push({
      id: String(h.id ?? ""),
      name: String(h.n ?? h.orgName ?? "").trim(),
      slug: typeof h.hsk === "string" ? h.hsk : null,
      rating: num5(h?.gr?.rating),
      reviews: num5(h?.gr?.reviews),
      city: typeof h?.loc?.c === "string" ? h.loc.c : null,
      area: typeof h?.loc?.a === "string" ? h.loc.a : null,
      lat: num5(h?.loc?.la),
      lon: num5(h?.loc?.lo),
      imageUrl: typeof h?.cldImage?.url === "string" ? h.cldImage.url : null,
      categories: Array.isArray(h.ctg) ? h.ctg.filter((x) => typeof x === "string") : [],
      rackRate: num5(h.r),
      price: num5(rate.price),
      basePrice: num5(rate.basePrice),
      roomName: typeof rate.roomName === "string" ? rate.roomName : null,
      bookable: rate.bookable !== false,
      roomsLeft: num5(rate.roomsLeft),
      freeCancel: Boolean(rate.freeCancel)
    });
  }
  return out;
}
function yatraPageSearchUrl(city, checkin, checkout, page = 1) {
  const ci = ddmmyyyy(checkin);
  const co = ddmmyyyy(checkout);
  return `${YATRA_HOTELS_API}?checkOutDate=${co}&checkInDate=${ci}&city=${encodeURIComponent(city)}&source=BOOKING_ENGINE&tenant=B2C&page=${page}&offset=${page * 10}&rooms%5B0%5D.id=1&rooms%5B0%5D.noOfAdults=2&rooms%5B0%5D.noOfChildren=0&type=all&otherRateplans=all&allImages=true&showBOR=true&loggedIn=false&offset=10`;
}
function yatraSrpUrl(city, checkin, checkout) {
  const ci = encodeURIComponent(ddmmyyyy(checkin));
  const co = encodeURIComponent(ddmmyyyy(checkout));
  const c = encodeURIComponent(city);
  return `${YATRA_SRP}?checkoutDate=${co}&checkinDate=${ci}&source=BOOKING_ENGINE&pg=1&tenant=B2C&city.name=${c}&city.code=${c}&state.name=${c}&state.code=${c}&country.name=IND&country.code=IND&roomRequests%5B0%5D.id=1&roomRequests%5B0%5D.noOfAdults=2&roomRequests%5B0%5D.noOfChildren=0`;
}
function parseYatraOffers(hotels, source, city, meta) {
  const out = [];
  for (const h of hotels) {
    if (!h.name || h.price == null || h.price <= 0 || !h.bookable) continue;
    const attrs = {
      image_url: h.imageUrl,
      rating: h.rating != null ? String(h.rating) : null,
      // /5 scale on Yatra
      review_count: h.reviews,
      city: h.city || city,
      area: h.area,
      latitude: h.lat,
      longitude: h.lon,
      property_id: h.id,
      room_type: h.roomName,
      price_basis: h.basePrice != null && h.basePrice < h.price ? `per night on Yatra (\u20B9${Math.round(h.basePrice)} base + taxes; total \u20B9${Math.round(h.price)})` : "per night on Yatra (all-inclusive total)",
      data_note: "Live per-night rates observed on Yatra hotel search"
    };
    if (h.roomsLeft != null && h.roomsLeft <= 5) attrs.rooms_left = String(h.roomsLeft);
    if (h.freeCancel) attrs.free_cancellation = "true";
    if (h.rackRate != null && h.rackRate > h.price) attrs.rack_rate = String(Math.round(h.rackRate));
    out.push(newRawItem(source, {
      title: h.name,
      seller: "Yatra",
      sellerUrl: yatraSrpUrl(h.city || city, meta.checkin, meta.checkout),
      currency: "INR",
      price: Math.round(h.price),
      attributes: attrs,
      travel: { date: meta.checkin, route: `${h.city || city} stay`, roomType: h.roomName || void 0 },
      evidence: {
        sourceUrl: yatraSrpUrl(city, meta.checkin, meta.checkout),
        sourceReference: h.id,
        extractedFields: ["title", "price", "rating", "review_count", "image_url", "deeplink"]
      }
    }));
  }
  return out;
}
function ddmmyyyy(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
var YATRA_HOTELS_API, YATRA_HOTELS_API_KEY, YATRA_SRP, num5;
var init_yatraHotels = __esm({
  "server/workers/parsers/yatraHotels.ts"() {
    init_contract();
    YATRA_HOTELS_API = "https://hotel.yatra.com/tgapi/hotels/v1/pageSearch";
    YATRA_HOTELS_API_KEY = "JN9aWyj7hJ1ZrExC7Ozo";
    YATRA_SRP = "https://hotel.yatra.com/nextui/hotel-search/dom/search";
    num5 = (x) => {
      if (x == null || x === "") return null;
      const n = Number(x);
      return Number.isFinite(n) ? n : null;
    };
  }
});

// server/workers/parsers/emtHotels.ts
function emtCityPaths(city) {
  const out = [];
  for (const v of cityVariants(city)) {
    const p = `hotels/hotels-in-${slugOf(v)}`;
    if (!out.includes(p)) out.push(p);
  }
  return out.slice(0, 6);
}
function parseEmtLdJson(html) {
  const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  for (const b of blocks) {
    try {
      const d = JSON.parse(b.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""));
      if (d?.["@type"] === "ItemList" && Array.isArray(d.itemListElement)) return d.itemListElement;
    } catch {
    }
  }
  return [];
}
function parseEmtHotelLinks(html) {
  const map = /* @__PURE__ */ new Map();
  const re = /href="(https:\/\/www\.easemytrip\.com\/hotels\/([a-z0-9-]+)-(\d+)\/?)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const id = m[3];
    if (!map.has(id)) map.set(id, m[1]);
  }
  return map;
}
function emtIdFromImage(imageUrl) {
  if (!imageUrl) return null;
  const m = /emthotel-(\d+)\//.exec(imageUrl);
  return m ? m[1] : null;
}
function parseEmtHotels(items, links) {
  const out = [];
  for (const it of items) {
    if (!it || typeof it !== "object" || typeof it.name !== "string") continue;
    const image = typeof it.image === "string" ? it.image : null;
    const id = emtIdFromImage(image) || "";
    const addr = it.address || {};
    const street = typeof addr.streetAddress === "string" ? addr.streetAddress : "";
    const [area, localityPart] = street.split(">");
    out.push({
      id,
      name: it.name.trim(),
      starRating: num6(it?.starRating?.ratingValue),
      area: area?.trim() || null,
      locality: localityPart?.trim() || (typeof addr.addressLocality === "string" ? addr.addressLocality : null),
      region: typeof addr.addressRegion === "string" ? addr.addressRegion : null,
      latitude: num6(it?.geo?.latitude),
      longitude: num6(it?.geo?.longitude),
      price: num6(it.priceRange),
      imageUrl: image,
      deeplink: id && links.get(id) || null,
      checkInTime: typeof it.checkInTime === "string" ? it.checkInTime : null,
      checkOutTime: typeof it.checkOutTime === "string" ? it.checkOutTime : null
    });
  }
  return out;
}
function parseEmtOffers(hotels, source, city, meta) {
  const out = [];
  const srpUrl = `${EMT_HOTELS_WEB}/${meta.path}/?checkin=${ddmmyyyyDash(meta.checkin)}&checkout=${ddmmyyyyDash(meta.checkout)}&c=IN&num_rooms=1&adults=2`;
  for (const h of hotels) {
    if (!h.name || h.price == null || h.price <= 0) continue;
    const attrs = {
      image_url: h.imageUrl,
      star_rating: h.starRating != null ? String(h.starRating) : null,
      area: h.area,
      address: h.locality,
      city: h.region || city,
      latitude: h.latitude,
      longitude: h.longitude,
      property_id: h.id || null,
      price_basis: "per night as listed on EaseMyTrip city page",
      data_note: "Live per-night rates observed on EaseMyTrip hotel listing"
    };
    if (h.checkInTime) attrs.check_in_time = h.checkInTime;
    if (h.checkOutTime) attrs.check_out_time = h.checkOutTime;
    out.push(newRawItem(source, {
      title: h.name,
      seller: "EaseMyTrip",
      sellerUrl: h.deeplink || srpUrl,
      // property page if id-matched, else the price-owning SRP
      currency: "INR",
      price: Math.round(h.price),
      attributes: attrs,
      travel: { date: meta.checkin, route: `${city} stay` },
      evidence: {
        sourceUrl: srpUrl,
        sourceReference: h.id || h.name,
        extractedFields: ["title", "price", "rating", "image_url", "deeplink"]
      }
    }));
  }
  return out;
}
function ddmmyyyyDash(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
var EMT_HOTELS_WEB, num6;
var init_emtHotels = __esm({
  "server/workers/parsers/emtHotels.ts"() {
    init_contract();
    init_cityAlias();
    EMT_HOTELS_WEB = "https://www.easemytrip.com";
    num6 = (x) => {
      if (x == null || x === "") return null;
      const n = Number(x);
      return Number.isFinite(n) ? n : null;
    };
  }
});

// server/workers/parsers/saffronStays.ts
function saffronSearchBody(location) {
  return {
    location,
    page: 1,
    no_of_guest: 2,
    no_of_room: 1,
    suitables: [],
    amenities: [],
    sort_by: "",
    signature: "",
    min_price: 0,
    max_price: 25e5,
    pocket: false,
    same_day: false,
    non_shared: false,
    new_home: false,
    top_rated: false,
    lat: null,
    long: null,
    mint_fresh: false,
    is_agent: "",
    distance: 125
  };
}
function saffronImageUrl(imageId) {
  return `${SAFFRON_IMG_BASE}/${imageId}?tr=w-640,q-75`;
}
function parseSaffronVillas(data) {
  const out = [];
  for (const v of data) {
    if (!v || typeof v !== "object" || typeof v.title !== "string") continue;
    out.push({
      id: String(v.id ?? ""),
      title: v.title.trim(),
      location: typeof v.location === "string" ? v.location : null,
      latitude: num7(v.latitude),
      longitude: num7(v.longitude),
      pricePerNight: num7(v.price_per_night),
      perNightAfterDiscount: num7(v.per_night_price_after_discount),
      totalWithTax: num7(v.total_amount_with_tax),
      baseWithTax: num7(v.base_price_with_tax),
      rating: num7(v.rating),
      reviews: num7(v.total_reviews),
      capacity: num7(v.max_capacity ?? v.capacity),
      bedrooms: num7(v.bedrooms),
      signature: typeof v.signature === "string" ? v.signature : null,
      available: v.is_available !== false,
      imageIds: Array.isArray(v.images) ? v.images.filter((x) => typeof x === "string").slice(0, 6) : [],
      seoUrl: typeof v.seo_url === "string" ? v.seo_url : null
    });
  }
  return out;
}
function parseSaffronOffers(villas, source, city) {
  const out = [];
  for (const v of villas) {
    const price = v.perNightAfterDiscount ?? v.pricePerNight;
    if (!v.title || price == null || price <= 0 || !v.available) continue;
    const attrs = {
      image_url: v.imageIds[0] ? saffronImageUrl(v.imageIds[0]) : null,
      images: v.imageIds.map(saffronImageUrl).join("|") || null,
      rating: v.rating != null ? v.rating.toFixed(1) : null,
      review_count: v.reviews,
      location: v.location,
      latitude: v.latitude,
      longitude: v.longitude,
      property_id: v.id,
      bedrooms: v.bedrooms,
      max_capacity: v.capacity,
      collection: v.signature,
      price_basis: v.totalWithTax && v.totalWithTax > price ? `villa per night on SaffronStays (\u20B9${Math.round(price)} + taxes; total \u20B9${Math.round(v.totalWithTax)})` : "villa per night on SaffronStays (as listed)",
      data_note: "Live villa per-night rates observed on SaffronStays search"
    };
    out.push(newRawItem(source, {
      title: v.title,
      seller: "SaffronStays",
      sellerUrl: v.seoUrl ? `${SAFFRON_WEB}/villas/${v.seoUrl}` : `${SAFFRON_WEB}/villas`,
      currency: "INR",
      price: Math.round(price),
      attributes: attrs,
      travel: { route: `${city} stay` },
      evidence: {
        sourceUrl: `${SAFFRON_WEB}/search?location=${encodeURIComponent(city)}`,
        sourceReference: v.id,
        extractedFields: ["title", "price", "rating", "review_count", "image_url", "deeplink"]
      }
    }));
  }
  return out;
}
var SAFFRON_API, SAFFRON_IMG_BASE, SAFFRON_WEB, num7;
var init_saffronStays = __esm({
  "server/workers/parsers/saffronStays.ts"() {
    init_contract();
    SAFFRON_API = "https://ecapi4.saffronstays.com/api/search-advance";
    SAFFRON_IMG_BASE = "https://ik.imagekit.io/5tgxhsqev/saffronstays-media";
    SAFFRON_WEB = "https://www.saffronstays.com";
    num7 = (x) => {
      if (x == null || x === "") return null;
      const n = Number(x);
      return Number.isFinite(n) ? n : null;
    };
  }
});

// server/workers/parsers/agodaHotels.ts
function agodaCitySlugs(city) {
  const out = [];
  for (const v of cityVariants(city)) {
    const slug2 = `${slugOf(v)}-in`;
    if (!out.includes(slug2)) out.push(slug2);
  }
  return out.slice(0, 6);
}
function extractAgodaCityId(html) {
  const m = html.match(/search\?city=(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}
function extractAgodaPageConfig(html) {
  const m = html.match(/agoda\.pageConfig\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  if (!m) return null;
  try {
    const seg = m[1].slice(0, 4e3);
    const cor2 = seg.match(/correlationId\s*:\s*["']([^"']+)["']/);
    const ana2 = seg.match(/analyticsSessionId\s*:\s*["']([^"']+)["']/);
    if (cor2 && ana2) return { correlationId: cor2[1], analyticsSessionId: ana2[1] };
  } catch {
  }
  const cor = html.match(/"correlationId"\s*:\s*"([^"]+)"/);
  const ana = html.match(/"analyticsSessionId"\s*:\s*"([^"]+)"/);
  if (cor && ana) return { correlationId: cor[1], analyticsSessionId: ana[1] };
  return null;
}
function agodaGateHeaders(cfg, epochMs) {
  const gate = Buffer.from(`${epochMs}||/graphql/search`).toString("base64");
  return {
    "Content-Type": "application/json",
    Accept: "application/json, text/plain, */*",
    Origin: AGODA_WEB,
    "AG-LANGUAGE-LOCALE": "en-us",
    "AG-CID": "-1",
    "AG-PAGE-TYPE-ID": "103",
    "AG-RETRY-ATTEMPT": "0",
    "AG-REQUEST-ATTEMPT": "1",
    "Access-Control-Max-Age": "7200",
    "x-gate-meta": gate,
    ...cfg.correlationId ? { "AG-CORRELATION-ID": cfg.correlationId } : {},
    ...cfg.analyticsSessionId ? { "AG-ANALYTICS-SESSION-ID": cfg.analyticsSessionId } : {}
  };
}
function buildAgodaCitySearchVars(cityId, checkin, checkout, pageNumber = 1) {
  const inMs = Date.parse(`${checkin}T00:00:00Z`);
  const outMs = Date.parse(`${checkout}T00:00:00Z`);
  const los = Number.isFinite(outMs) && outMs > inMs ? Math.max(1, Math.round((outMs - inMs) / 864e5)) : 1;
  const ci = `${checkin}T00:00:00.000Z`;
  const co = new Date(inMs + los * 864e5).toISOString().slice(0, 10) + "T00:00:00.000Z";
  const now = nowIso();
  const searchId = crypto.randomUUID();
  return {
    CitySearchRequest: {
      cityId,
      searchRequest: {
        searchCriteria: {
          bookingDate: now,
          checkInDate: ci,
          los,
          rooms: 1,
          adults: 2,
          children: 0,
          childAges: [],
          currency: "INR",
          sorting: { sortField: "Ranking", sortOrder: "Desc" },
          requiredBasis: "PRPN",
          requiredPrice: "Exclusive",
          isUserLoggedIn: false,
          travellerType: "AllGuests",
          ratePlans: [],
          suggestionLimit: 0,
          synchronous: false,
          isRoomSuggestionRequested: false
        },
        searchContext: {
          locale: "en-us",
          cid: -1,
          origin: "US",
          platform: 1,
          deviceTypeId: 1,
          storefrontId: 3,
          pageTypeId: 103,
          endpointSearchType: "CitySearch",
          searchId,
          userId: "",
          memberId: 0,
          experiments: { forceByVariant: null, forceByExperiment: [{ id: "JGCW-204", variant: "B" }] },
          isRetry: false,
          showCMS: false,
          whiteLabelKey: "",
          ipAddress: null
        },
        page: { pageSize: 30, pageNumber }
      }
    },
    ContentSummaryRequest: {
      context: {
        rawUserId: "",
        memberId: 0,
        userOrigin: "US",
        locale: "en-us",
        apo: false,
        searchCriteria: { cityId },
        platform: { id: 1 },
        storefrontId: 3,
        cid: "-1",
        occupancy: { numberOfAdults: 2, numberOfChildren: 0, checkIn: ci },
        deviceTypeId: 1,
        whiteLabelKey: "",
        correlationId: "",
        forceExperimentsByIdNew: [{ key: "JGCW-204", value: "B" }]
      },
      summary: { highlightedFeaturesOrderPriority: null, includeHotelCharacter: false },
      reviews: {
        commentary: null,
        demographics: { providerIds: null, filter: { defaultProviderOnly: true } },
        summaries: { providerIds: null, apo: true, limit: 1 },
        cumulative: { providerIds: null },
        filters: null
      },
      images: { page: null, maxWidth: 0, maxHeight: 0, imageSizes: null, indexOffset: null },
      rooms: {
        images: null,
        featureLimit: 0,
        filterCriteria: null,
        includeMissing: false,
        includeSoldOut: false,
        includeDmcRoomId: false,
        soldOutRoomCriteria: null,
        showRoomSize: true,
        showRoomFacilities: true,
        showRoomName: false
      },
      nonHotelAccommodation: true,
      engagement: true,
      highlights: { maxNumberOfItems: 0, images: { imageSizes: [{ key: "full", size: { width: 0, height: 0 } }] } },
      personalizedInformation: true,
      localInformation: { images: null },
      features: null,
      rateCategories: null,
      contentRateCategories: null,
      synopsis: true
    },
    PricingSummaryRequest: {
      cheapestOnly: true,
      isSSR: true,
      context: {
        isAllowBookOnRequest: false,
        abTests: [9021, 9023, 9024, 9025, 9027, 9029].map((testId) => ({ testId, abUser: "B" })),
        clientInfo: {
          cid: -1,
          languageId: 1,
          languageUse: 1,
          origin: "US",
          platform: 1,
          searchId: crypto.randomUUID(),
          storefront: 3,
          userId: "",
          ipAddress: null
        },
        experiment: [{ name: "JGCW-204", variant: "B" }],
        sessionInfo: { isLogin: false, memberId: 0, sessionId: 1 }
      },
      pricing: {
        bookingDate: now,
        checkIn: ci,
        checkout: co,
        currency: "INR",
        details: { cheapestPriceOnly: false, itemBreakdown: false, priceBreakdown: false },
        filters: { cheapestRoomFilters: null, filterAPO: false, ratePlans: [1], secretDealOnly: false, suppliers: [] },
        features: {
          calculateRareRoomBadge: false,
          crossOutRate: false,
          isAPSPeek: false,
          isAllOcc: false,
          isApsEnabled: false,
          isIncludeUsdAndLocalCurrency: false,
          isMSE: true,
          isRPM2Included: true,
          maxSuggestions: 0,
          isEnableSupplierFinancialInfo: false,
          isLoggingAuctionData: false,
          newRateModel: false,
          overrideOccupancy: false,
          filterCheapestRoomEscapesPackage: false,
          priusId: 0,
          synchronous: false,
          enableRichContentOffer: false,
          showCouponAmountInUserCurrency: false,
          disableEscapesPackage: false,
          enablePushDayUseRates: false,
          enableDayUseCor: false,
          ignoreRoomsCountForNha: false,
          enableSuggestPriceExclusiveWithFees: false
        },
        includedPriceInfo: false,
        occupancy: { adults: 2, children: 0, rooms: 1, childAges: [] },
        requiredBasis: "PRPN",
        requiredPrice: "Exclusive",
        ratePlans: [],
        sorting: { sortField: "Ranking", sortOrder: "Desc" }
      },
      suggestedPrice: "Exclusive"
    }
  };
}
function extractAgodaProperties(gql) {
  const props = gql?.data?.citySearch?.properties;
  return Array.isArray(props) ? props : [];
}
function parseAgodaHotels(props) {
  const first = (v) => Array.isArray(v) && v.length ? v[0] : void 0;
  const out = [];
  for (const p of props) {
    if (!p || typeof p !== "object") continue;
    const info = p.content?.informationSummary || {};
    const name = String(info.displayName || "").trim();
    const propertyId = String(p.propertyId || "").trim();
    if (!name || !/^\d+$/.test(propertyId)) continue;
    const rev = p.content?.reviews?.cumulative;
    let score = null;
    let reviews = null;
    if (rev && typeof rev === "object") {
      score = typeof rev.score === "number" ? rev.score : null;
      reviews = typeof rev.reviewCount === "number" ? rev.reviewCount : null;
    }
    const offer = first(p.pricing?.offers);
    const roomOffer = first(offer?.roomOffers);
    const pricing = first(roomOffer?.room?.pricing) || {};
    const perNight = pricing?.price?.perNight || {};
    const exclusive = perNight?.exclusive?.display;
    const inclusive = perNight?.inclusive?.display;
    const pricePerNight = typeof exclusive === "number" ? exclusive : typeof inclusive === "number" ? inclusive : null;
    const priceInclusive = typeof inclusive === "number" ? inclusive : null;
    const imgEntry = first(first(p.content?.images?.hotelImages)?.urls);
    const rawImg = typeof imgEntry?.value === "string" ? imgEntry.value : null;
    const imageUrl = rawImg ? rawImg.startsWith("//") ? `https:${rawImg}` : rawImg : null;
    out.push({
      propertyId,
      name,
      accommodationType: info.accommodationType != null ? String(info.accommodationType) : null,
      cityName: info.address?.city?.name ? String(info.address.city.name) : null,
      score,
      reviews,
      pricePerNight,
      priceInclusive,
      currency: String(pricing.currency || "INR"),
      imageUrl,
      lat: typeof info.geoInfo?.latitude === "number" ? info.geoInfo.latitude : null,
      lon: typeof info.geoInfo?.longitude === "number" ? info.geoInfo.longitude : null,
      available: p.pricing?.isAvailable === true
    });
  }
  return out;
}
function parseAgodaOffers(hotels, source, city, meta) {
  const out = [];
  const srpUrl = `${AGODA_WEB}/search?city=${meta.cityId}&checkIn=${meta.checkin}&los=${meta.los}`;
  for (const h of hotels.slice(0, 80)) {
    if (!h.pricePerNight) continue;
    const attrs = {
      image_url: h.imageUrl,
      rating: h.score != null ? String(h.score / 10) : null,
      // Agoda scores are /10 → /5 scale
      review_count: h.reviews,
      city: h.cityName || city,
      latitude: h.lat,
      longitude: h.lon,
      property_id: h.propertyId,
      price_basis: h.priceInclusive != null ? `per night on Agoda (tax-exclusive \u20B9${Math.round(h.pricePerNight)}; inclusive \u20B9${Math.round(h.priceInclusive)})` : "per night on Agoda (tax-exclusive)",
      data_note: "Live per-night rates observed on Agoda search"
    };
    out.push(newRawItem(source, {
      title: h.name,
      seller: "Agoda",
      sellerUrl: srpUrl,
      // redirect only to the site that owns the price
      currency: h.currency,
      price: Math.round(h.pricePerNight),
      attributes: attrs,
      evidence: {
        sourceUrl: srpUrl,
        sourceReference: h.propertyId,
        extractedFields: ["title", "price", "rating", "review_count", "image_url", "deeplink"]
      }
    }));
  }
  return out;
}
var AGODA_WEB, nowIso, AGODA_CITY_SEARCH_QUERY;
var init_agodaHotels = __esm({
  "server/workers/parsers/agodaHotels.ts"() {
    init_contract();
    init_cityAlias();
    AGODA_WEB = "https://www.agoda.com";
    nowIso = () => (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, ".000Z");
    AGODA_CITY_SEARCH_QUERY = "query citySearch($CitySearchRequest: CitySearchRequest!, $ContentSummaryRequest: ContentSummaryRequest!, $PricingSummaryRequest: PricingRequestParameters) { citySearch(CitySearchRequest: $CitySearchRequest) { properties(ContentSummaryRequest: $ContentSummaryRequest, PricingSummaryRequest: $PricingSummaryRequest) { propertyId content { informationSummary { displayName accommodationType address { city { name } } geoInfo { latitude longitude } rating } images { hotelImages { id urls { key value } } } reviews { cumulative { reviewCount score } } } pricing { isAvailable offers { roomOffers { room { pricing { currency price { perNight { exclusive { display originalPrice } inclusive { display originalPrice } } } } } } } } } } }";
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
async function expediaGroupSearch(ctx, site, impersonate, city, checkin, checkout) {
  const origin = `https://www.${site}`;
  const srpUrl = `${origin}/Hotel-Search?destination=${encodeURIComponent(`${city}, India`)}&d1=${checkin}&d2=${checkout}&rooms=1`;
  let cookies;
  const primed = await cffiFetch(srpUrl, { impersonate, timeoutMs: 3e4, returnCookies: true, cookies, headers: { Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" } });
  cookies = primed.cookies || cookies;
  if (primed.status === 429 || primed.status === 200 && /Bot or Not\?/.test(primed.body.slice(0, 4e3))) {
    throw new AcquisitionError("ACCESS_CHALLENGE", `${site} SRP edge returned a bot challenge (HTTP ${primed.status})`, primed.status);
  }
  if (primed.status !== 200) throw new AcquisitionError("SERVER_ERROR", `${site} SRP HTTP ${primed.status}`, primed.status);
  const duaid = (primed.body.match(/"duaid":"([0-9a-f-]{36})"/) || [])[1] || cookies?.DUAID || "";
  const y1 = +checkin.slice(0, 4), m1 = +checkin.slice(5, 7), d1 = +checkin.slice(8, 10);
  const y2 = +checkout.slice(0, 4), m2 = +checkout.slice(5, 7), d2 = +checkout.slice(8, 10);
  const siteId = site === "hotels.com" ? 19 : 1;
  const payload = JSON.stringify({
    operationName: "LodgingPropertySearch",
    query: EXPEDIA_GRAPHQL_QUERY,
    variables: {
      context: { currency: "USD", device: { type: "DESKTOP" }, eapid: 0, identity: { authState: "ANONYMOUS", duaid }, locale: "en_US", privacyTrackingState: "CAN_TRACK", siteId, tpid: siteId },
      criteria: { primary: {
        dateRange: { checkInDate: { year: y1, month: m1, day: d1 }, checkOutDate: { year: y2, month: m2, day: d2 } },
        destination: { regionName: `${city}, India` },
        rooms: [{ adults: 2 }]
      } }
    }
  });
  const r = await cffiFetch(`${origin}/graphql`, {
    method: "POST",
    impersonate,
    timeoutMs: 45e3,
    cookies,
    body: payload,
    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",
      Origin: origin,
      Referer: srpUrl,
      "client-info": `shopping-pwa,eb187b18bd35573abd2de93e9fd6a422a6206cfe,${site === "hotels.com" ? "us-west-2" : "us-east-1"}`,
      "x-page-id": "page.Hotel-Search,H,20"
    }
  });
  if (r.status === 429) throw new AcquisitionError("ACCESS_CHALLENGE", `${site} GraphQL edge returned a bot challenge (HTTP 429)`, 429);
  if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `${site} GraphQL HTTP ${r.status}: ${r.body.slice(0, 160)}`, r.status);
  const fx = await usdToInrRate();
  const items = parseExpediaGroup(r.body, ctx.source, site, checkin, checkout, fx);
  if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", `${site} GraphQL returned no priced LodgingCards for "${city}"`);
  return items;
}
var OYO_WEB_URL, ddmmyyyy2, agodaCityIdCache, hotelsWorker;
var init_hotels = __esm({
  "server/workers/verticals/hotels.ts"() {
    init_verticalWorker();
    init_logger();
    init_osmTravel();
    init_booking();
    init_expediaGroup();
    init_fxRates();
    init_wikidataHotels();
    init_cleartripHotels();
    init_goibiboHermes();
    init_airbnbHotels();
    init_ixigoHotels();
    init_goibiboHotels();
    init_goibiboHotelSsr();
    init_mmtHotelLanding();
    init_curlCffiFetch();
    init_contract();
    init_httpClient();
    init_cityAlias();
    init_oyoHotels();
    init_yatraHotels();
    init_emtHotels();
    init_saffronStays();
    init_agodaHotels();
    OYO_WEB_URL = "https://www.oyorooms.com";
    ddmmyyyy2 = (iso) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
      return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
    };
    agodaCityIdCache = /* @__PURE__ */ new Map();
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
          timeoutMs: 4e4,
          run: async (ctx) => {
            const city = cityFromQuery(ctx);
            if (!city || city.length < 3) return [];
            const slug2 = city.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-");
            const mmtChromeHeaders = {
              "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
              "sec-ch-ua-mobile": "?0",
              "sec-ch-ua-platform": '"Windows"',
              "Upgrade-Insecure-Requests": "1",
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
              "Sec-Fetch-Site": "none",
              "Sec-Fetch-Mode": "navigate",
              "Sec-Fetch-User": "?1",
              "Sec-Fetch-Dest": "document",
              "Accept-Language": "en-US,en;q=0.9",
              Referer: "https://www.google.com/"
            };
            let lastErr = null;
            for (const url of [
              `https://www.makemytrip.com/hotels-in-${slug2}/`,
              `https://www.makemytrip.com/hotels/hotels-in-${slug2}/`
            ]) {
              let bigBody = null;
              let r;
              try {
                r = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 25e3, headers: mmtChromeHeaders });
              } catch (e) {
                lastErr = new AcquisitionError("SERVER_ERROR", `MakeMyTrip hotels page unreachable: ${String(e?.message || e).slice(0, 70)}`);
                continue;
              }
              if (r.status === 301 || r.status === 302) {
                lastErr = new AcquisitionError("ACCESS_CHALLENGE", "MakeMyTrip redirected to Akamai geo-challenge (makemytrip.global) from this IP");
                continue;
              }
              if (r.status !== 200) {
                lastErr = new AcquisitionError("ACCESS_CHALLENGE", `MakeMyTrip HTTP ${r.status}`);
                continue;
              }
              if (r.body.length < 500) {
                lastErr = new AcquisitionError("ACCESS_CHALLENGE", "MakeMyTrip returned an empty Akamai edge body (no sensor cookie)");
                continue;
              }
              bigBody = r.body;
              const st = parseMmtHotelLanding(bigBody);
              if (st.rows.length) {
                st.rows.sort((a, b) => a.price - b.price);
                const offers = [];
                for (const h of st.rows.slice(0, 40)) {
                  offers.push(newRawItem(ctx.source, {
                    title: h.name,
                    seller: "MakeMyTrip",
                    sellerUrl: url,
                    // redirect only to the site that owns the price
                    currency: "INR",
                    price: h.price,
                    attributes: {
                      image_url: h.image || "",
                      rating: h.rating !== void 0 ? String(h.rating) : "",
                      locality: h.locality || "",
                      city,
                      price_basis: "per night for 1 room (page's own service dates picked by MakeMyTrip)",
                      data_note: "Live nightly rates from MakeMyTrip hotel landing page ($hotelReducerResponse)"
                    },
                    evidence: {
                      sourceUrl: url,
                      extractedFields: ["title", "price", "rating", "locality", "image_url"]
                    }
                  }));
                }
                return offers;
              }
              lastErr = new AcquisitionError("EMPTY_RESPONSE", "MakeMyTrip hotel page reached but $hotelReducerResponse carried no priced hotels (gate holds for this IP)");
            }
            throw lastErr || new AcquisitionError("NOT_FOUND", `MakeMyTrip has no hotels page for "${city}"`, 404);
          }
        },
        {
          // Goibibo hotels — owner-mandated mandatory source. /hotels/* SEO pages are
          // Akamai-stubbed (8-byte "200 - OK") from sandbox + Browserbase IPs while the
          // /flights/* SEO pages on the SAME IP serve full __NEXT_DATA__ SSR — a
          // path-scoped bot gate, not an IP burn. This is a SELF-DETECTING full-flow
          // probe (MMT-flights pattern): every search actually fetches the hotel SEO
          // page, so a clean production Hostinger IP activates it automatically.
          // The parser is shape-tolerant (walks __NEXT_DATA__ for hotel-shaped rows).
          sourceId: "w_hotels_goibibo",
          priority: 15,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const city = cityFromQuery(ctx);
            if (!city || city.length < 3) return [];
            const base = city.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-");
            const tomorrow = new Date(Date.now() + 864e5);
            const dayAfter = new Date(Date.now() + 2 * 864e5);
            const fmt = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
            const checkIn = fmt(tomorrow), checkOut = fmt(dayAfter);
            let lastHermesErr = null;
            const sq = encodeURIComponent(JSON.stringify({ Companion: { TA: "1DA" }, Pax: { A: "2" }, RoomCnt: "1", City: base, CheckIn: checkIn, CheckOut: checkOut }));
            const hermesUrl = `https://hermes.goibibo.com/hotels/v12/search/data/v3?searchQuery=${sq}`;
            try {
              const hr = await cffiFetch(hermesUrl, { impersonate: "chrome", timeoutMs: 1e4, headers: { Accept: "application/json", Referer: "https://www.goibibo.com/hotels/" } });
              if (hr.status === 200 && hr.body.length > 100) {
                const offers = parseHermesHotels(hr.body, ctx.source, city, checkIn, checkOut, hermesUrl);
                if (offers.length) return offers;
                lastHermesErr = new AcquisitionError("EMPTY_RESPONSE", `Goibibo hermes 200 (${hr.body.length}B) carried no parseable hotel rows; snippet=${JSON.stringify(hr.body.slice(0, 160))}`);
              } else if (hr.status !== 200) {
                lastHermesErr = new AcquisitionError(hr.status === 403 || hr.status === 429 ? "ACCESS_CHALLENGE" : "SERVER_ERROR", `Goibibo hermes HTTP ${hr.status}`);
              }
            } catch (e) {
              lastHermesErr = new AcquisitionError("TIMEOUT", `Goibibo hermes unreachable: ${String(e?.message || e).slice(0, 60)}`);
            }
            const giChromeHeaders = {
              "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
              "sec-ch-ua-mobile": "?0",
              "sec-ch-ua-platform": '"Windows"',
              "Upgrade-Insecure-Requests": "1",
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
              "Sec-Fetch-Site": "none",
              "Sec-Fetch-Mode": "navigate",
              "Sec-Fetch-User": "?1",
              "Sec-Fetch-Dest": "document",
              "Accept-Language": "en-US,en;q=0.9",
              Referer: "https://www.google.com/"
            };
            const attempts = [`hotels-in-${base}-ct`, `hotels-in-${base}`];
            let lastErr = null;
            const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
            for (const slug2 of attempts) {
              const url = `https://www.goibibo.com/hotels/${slug2}/`;
              let bigBody = null;
              for (let attempt = 1; attempt <= 3; attempt++) {
                let r;
                try {
                  r = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 25e3, headers: giChromeHeaders });
                } catch (e) {
                  lastErr = new AcquisitionError("SERVER_ERROR", `Goibibo hotels page unreachable (attempt ${attempt}/3): ${String(e?.message || e).slice(0, 80)}`);
                  await sleep(1500);
                  continue;
                }
                if (r.status === 404) break;
                if (r.status === 403 || r.status === 429) throw new AcquisitionError(r.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED", `Goibibo hotels edge-blocked (HTTP ${r.status}).`, r.status);
                if (r.status !== 200) {
                  lastErr = new AcquisitionError("ACCESS_CHALLENGE", `Goibibo hotels HTTP ${r.status}`);
                  await sleep(1500);
                  continue;
                }
                if (r.body.length >= 1e5) {
                  bigBody = r.body;
                  break;
                }
                lastErr = new AcquisitionError("ACCESS_CHALLENGE", `Goibibo hotels Akamai-sampled a ${r.body.length}B stub (attempt ${attempt}/3); ladder retries next search`);
                await sleep(2e3);
              }
              if (!bigBody) continue;
              const st = parseGoibiboHotelSsrState(bigBody);
              let rows = st.rows;
              if (!rows.length) rows = parseGoibiboHotelsSsr(bigBody);
              if (!rows.length) {
                lastErr = new AcquisitionError("EMPTY_RESPONSE", `Goibibo hotel page reached (${bigBody.length} bytes) but carried no parseable hotel listings`);
                continue;
              }
              rows.sort((a, b) => a.price - b.price);
              const dateLabel = st.checkIn ? ` for ${st.checkIn} \u2192 ${st.checkOut || ""}` : "";
              const offers = [];
              for (const h of rows.slice(0, 40)) {
                offers.push(newRawItem(ctx.source, {
                  title: h.name,
                  seller: "Goibibo",
                  sellerUrl: h.url || url,
                  // redirect only to the site that owns the price
                  currency: "INR",
                  price: h.price,
                  attributes: {
                    image_url: h.image || "",
                    rating: h.rating !== void 0 ? String(h.rating) : "",
                    locality: h.locality || "",
                    city,
                    price_basis: `per night for 1 room (page's own service date${dateLabel ? ": " + dateLabel.trim() : " picked by Goibibo"})`,
                    data_note: `Live nightly rates from Goibibo hotel search results (SEO page${st.hotelCount ? `, ${st.hotelCount} hotels in city` : ""})`
                  },
                  evidence: {
                    sourceUrl: url,
                    sourceReference: h.url,
                    extractedFields: ["title", "price", "rating", "locality", "image_url"]
                  }
                }));
              }
              return offers;
            }
            throw lastErr || lastHermesErr || new AcquisitionError("NOT_FOUND", `Goibibo has no hotels page for "${city}"`, 404);
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
            const rows = parseCleartripOffers(hotels, ctx.source);
            const firstImg = rows.find((r) => r.attributes?.image_url || r.attributes?.image_urls)?.attributes?.image_url;
            if (firstImg) {
              let live = false;
              try {
                const ctl = new AbortController();
                const t = setTimeout(() => ctl.abort(), 4e3);
                const res = await fetch(firstImg, { signal: ctl.signal, redirect: "follow" });
                clearTimeout(t);
                live = res.status === 200 && String(res.headers.get("content-type") || "").startsWith("image/");
              } catch {
                live = false;
              }
              if (!live) {
                for (const r of rows) {
                  if (r.attributes?.image_url) delete r.attributes.image_url;
                  if (r.attributes?.image_urls) delete r.attributes.image_urls;
                }
                log.warn("Hotels worker", "Cleartrip CDN art dead \u2014 images stripped for this batch (self-healing)", { probe: String(firstImg).slice(0, 80) });
              }
            }
            return rows;
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
            const UA3 = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" };
            let cookies = void 0;
            for (let attempt = 1; attempt <= 3; attempt++) {
              const r = await cffiFetch(url, { timeoutMs: 2e4, cookies, returnCookies: true, headers: { "Accept-Language": "en-IN,en;q=0.9" } });
              cookies = r.cookies || cookies;
              if (r.status !== 200 && r.status !== 202) throw new AcquisitionError("FORBIDDEN", `Booking.com HTTP ${r.status}`, r.status);
              const items = parseBookingHotels(r.body, ctx.source, url, checkin, checkout);
              if (items.length) return items;
              if (looksLikeChallenge(r.body) && attempt < 3) {
                await new Promise((res) => setTimeout(res, 2500 * attempt));
                continue;
              }
              throw new AcquisitionError("ACCESS_CHALLENGE", "Booking.com presented a challenge page (no parseable property cards)");
            }
            throw new AcquisitionError("EMPTY_RESPONSE", "Booking.com returned no property cards");
          }
        },
        {
          // Expedia Group "shopping-pwa" (Expedia.com + Hotels.com share one LodgingCard
          // GraphQL). Akamai accepts safari-TLS from datacenter IPs (chrome JA3 = 429
          // "Bot or Not?"). Recipe reverse-engineered 14 Oct 2026, sandbox-verified 50
          // priced cards per query; details in parsers/expediaGroup.ts.
          sourceId: "w_hotels_expedia",
          name: "Hotels worker: Expedia.com live rates (LodgingCard GraphQL)",
          priority: 11,
          maxPerMinute: 2,
          timeoutMs: 6e4,
          run: async (ctx) => {
            const city = cityFromQuery(ctx);
            if (!city) return [];
            const { checkin, checkout } = stayDates(ctx.query);
            return expediaGroupSearch(ctx, "expedia.com", "safari", city, checkin, checkout);
          }
        },
        {
          sourceId: "w_hotels_hotelscom",
          name: "Hotels worker: Hotels.com live rates (LodgingCard GraphQL)",
          priority: 11,
          maxPerMinute: 2,
          timeoutMs: 6e4,
          run: async (ctx) => {
            const city = cityFromQuery(ctx);
            if (!city) return [];
            const { checkin, checkout } = stayDates(ctx.query);
            let items;
            try {
              items = await expediaGroupSearch(ctx, "hotels.com", "safari17_0", city, checkin, checkout);
            } catch (e) {
              if (String(e?.failureClass) !== "ACCESS_CHALLENGE" && String(e?.failureClass) !== "RATE_LIMITED") throw e;
              items = await expediaGroupSearch(ctx, "hotels.com", "chrome_android", city, checkin, checkout);
            }
            return items;
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
          // Agoda LIVE (13 Oct 2026): the SSR shell resolves cityId via SEO city pages,
          // then the token-gated GraphQL /graphql/search endpoint (gate: x-gate-meta
          // base64 epoch + AG-* headers from pageConfig) returns 30 hotels with real
          // INR per-night rates. Verified Goa + Bali. Details: parsers/agodaHotels.ts.
          sourceId: "w_hotels_agoda",
          name: "Hotels worker: Agoda GraphQL live rates",
          priority: 6,
          maxPerMinute: 4,
          timeoutMs: 9e4,
          run: async (ctx) => {
            const city = cityFromQuery(ctx);
            if (!city) return [];
            const { checkin, checkout } = stayDates(ctx.query);
            let cityId = agodaCityIdCache.get(city.toLowerCase());
            if (!cityId) {
              for (const slug2 of agodaCitySlugs(city)) {
                const r = await cffiFetch(`https://www.agoda.com/city/${slug2}.html`, {
                  impersonate: "chrome",
                  timeoutMs: 2e4,
                  headers: { Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" }
                });
                if (r.status !== 200) continue;
                const id = extractAgodaCityId(r.body);
                if (id) {
                  cityId = id;
                  agodaCityIdCache.set(city.toLowerCase(), id);
                  break;
                }
              }
            }
            if (!cityId) throw new AcquisitionError("EMPTY_RESPONSE", `Agoda has no city page for "${city}"`);
            const los0 = Math.max(1, Math.round((Date.parse(`${checkout}T00:00:00Z`) - Date.parse(`${checkin}T00:00:00Z`)) / 864e5));
            const shell = await cffiFetch(`https://www.agoda.com/search?city=${cityId}&checkIn=${checkin}&los=${los0}`, {
              impersonate: "chrome",
              timeoutMs: 25e3,
              headers: { Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" }
            });
            if (shell.status === 403 || shell.status === 429) {
              throw new AcquisitionError(shell.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED", `Agoda blocked: ${shell.status}`, shell.status);
            }
            if (shell.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Agoda HTTP ${shell.status}`, shell.status);
            const cfg = extractAgodaPageConfig(shell.body);
            if (!cfg) throw new AcquisitionError("MALFORMED_RESPONSE", "Agoda SRP carried no pageConfig");
            const gqlHeaders = () => ({
              ...agodaGateHeaders(cfg, Date.now()),
              Referer: `https://www.agoda.com/search?city=${cityId}&checkIn=${checkin}&los=${los0}`,
              "AG-REQUEST-ID": crypto.randomUUID()
            });
            const hotels = [];
            const seenIds = /* @__PURE__ */ new Set();
            for (let page = 1; page <= 3; page++) {
              const gqlRes = await cffiFetch("https://www.agoda.com/graphql/search", {
                method: "POST",
                impersonate: "chrome",
                timeoutMs: 6e4,
                headers: gqlHeaders(),
                body: JSON.stringify({
                  query: AGODA_CITY_SEARCH_QUERY,
                  variables: buildAgodaCitySearchVars(cityId, checkin, checkout, page),
                  operationName: "citySearch"
                })
              });
              if (gqlRes.status === 403 || gqlRes.status === 429) {
                if (page > 1) break;
                throw new AcquisitionError(gqlRes.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED", `Agoda gate rejected: ${gqlRes.status}`, gqlRes.status);
              }
              if (gqlRes.status !== 200) {
                if (page > 1) break;
                throw new AcquisitionError("SERVER_ERROR", `Agoda GraphQL HTTP ${gqlRes.status}`, gqlRes.status);
              }
              let gql;
              try {
                gql = JSON.parse(gqlRes.body);
              } catch {
                if (page > 1) break;
                throw new AcquisitionError("MALFORMED_RESPONSE", "Agoda GraphQL response not valid JSON");
              }
              if (gql?.errors?.length && !gql?.data?.citySearch?.properties?.length) {
                if (page > 1) break;
                throw new AcquisitionError("MALFORMED_RESPONSE", `Agoda GraphQL errors: ${String(gql.errors[0]?.message || "").slice(0, 160)}`);
              }
              const pageHotels = parseAgodaHotels(extractAgodaProperties(gql));
              let fresh = 0;
              for (const h of pageHotels) {
                const k = String(h.propertyId ?? h.id ?? h.name);
                if (!seenIds.has(k)) {
                  seenIds.add(k);
                  hotels.push(h);
                  fresh++;
                }
              }
              if (fresh === 0) break;
            }
            const priced = hotels.filter((h) => h.pricePerNight);
            if (priced.length === 0) throw new AcquisitionError("EMPTY_RESPONSE", "Agoda GraphQL returned no priced hotels");
            return parseAgodaOffers(hotels, ctx.source, city, { cityId, checkin, los: los0 });
          }
        },
        {
          // OYO hotels — owner-mandated source (17 Oct). City SEO listing pages are full
          // SSR: window.__PRELOADED_STATE__ carries 20 real per-night prices + images.
          // SaffronStays — owner-mandated source (17 Oct). Boutique villas; search API
          // captured via stealth CDP interception, replayed browserless with curl_cffi.
          sourceId: "w_hotels_saffronstays",
          name: "Hotels worker: SaffronStays live villa rates",
          priority: 10,
          maxPerMinute: 6,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const city = cityFromQuery(ctx);
            if (!city || city.length < 3) return [];
            const r = await cffiFetch(SAFFRON_API, {
              impersonate: "chrome",
              method: "POST",
              timeoutMs: 25e3,
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json, text/plain, */*",
                Origin: "https://www.saffronstays.com",
                Referer: "https://www.saffronstays.com/"
              },
              body: JSON.stringify(saffronSearchBody(city))
            });
            if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `SaffronStays search-advance HTTP ${r.status}: ${r.body.slice(0, 160)}`, r.status);
            let body = null;
            try {
              body = JSON.parse(r.body);
            } catch {
            }
            const villas = Array.isArray(body?.data) ? parseSaffronVillas(body.data) : [];
            if (!villas.length) throw new AcquisitionError("EMPTY_RESPONSE", `SaffronStays returned no villas for "${city}"`);
            return parseSaffronOffers(villas, ctx.source, city);
          }
        },
        {
          sourceId: "w_hotels_oyo",
          name: "Hotels worker: OYO live per-night rates",
          priority: 8,
          maxPerMinute: 6,
          timeoutMs: 45e3,
          run: async (ctx) => {
            const city = cityFromQuery(ctx);
            if (!city || city.length < 3) return [];
            const { checkin, checkout } = stayDates(ctx.query);
            let lastStatus = 0;
            let lastBody = "";
            for (const path6 of oyoCityPaths(city)) {
              const r = await cffiFetch(`${OYO_WEB_URL}/${path6}/?checkin=${ddmmyyyy2(checkin)}&checkout=${ddmmyyyy2(checkout)}&guests=2&rooms=1`, {
                impersonate: "chrome",
                timeoutMs: 3e4,
                headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9" }
              });
              lastStatus = r.status;
              lastBody = r.body.slice(0, 400);
              if (r.status !== 200) continue;
              const state = parseOyoPreloadedState(r.body);
              const hotels = parseOyoHotels(state || {});
              if (hotels.length) return parseOyoOffers(hotels, ctx.source, city, { checkin, checkout, path: path6 });
            }
            if (lastStatus === 404) throw new AcquisitionError("EMPTY_RESPONSE", `OYO has no city page for "${city}"`);
            if (lastStatus !== 0) throw new AcquisitionError("SERVER_ERROR", `OYO city page HTTP ${lastStatus}: ${lastBody}`, lastStatus);
            throw new AcquisitionError("EMPTY_RESPONSE", `OYO listing for "${city}" carried no parseable PRELOADED_STATE`);
          }
        },
        {
          // EaseMyTrip hotels — owner-mandated source (17 Oct). City SEO pages are full
          // SSR with a JSON-LD ItemList of ~20 hotels incl. real per-night prices.
          sourceId: "w_hotels_emt",
          name: "Hotels worker: EaseMyTrip live per-night rates",
          priority: 9,
          maxPerMinute: 6,
          timeoutMs: 45e3,
          run: async (ctx) => {
            const city = cityFromQuery(ctx);
            if (!city || city.length < 3) return [];
            const { checkin, checkout } = stayDates(ctx.query);
            let lastStatus = 0;
            for (const path6 of emtCityPaths(city)) {
              const r = await cffiFetch(`https://www.easemytrip.com/${path6}/?checkin=${ddmmyyyyDash(checkin)}&checkout=${ddmmyyyyDash(checkout)}&c=IN&num_rooms=1&adults=2`, {
                impersonate: "chrome",
                timeoutMs: 3e4,
                headers: { Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" }
              });
              lastStatus = r.status;
              if (r.status !== 200) continue;
              const items = parseEmtLdJson(r.body);
              if (!items.length) continue;
              const links = parseEmtHotelLinks(r.body);
              const hotels = parseEmtHotels(items, links);
              if (hotels.length) return parseEmtOffers(hotels, ctx.source, city, { checkin, checkout, path: path6 });
            }
            if (lastStatus === 404) throw new AcquisitionError("EMPTY_RESPONSE", `EaseMyTrip has no city page for "${city}"`);
            if (lastStatus !== 0) throw new AcquisitionError("SERVER_ERROR", `EaseMyTrip city page HTTP ${lastStatus}`, lastStatus);
            throw new AcquisitionError("EMPTY_RESPONSE", `EaseMyTrip listing for "${city}" carried no hotels`);
          }
        },
        {
          // Yatra hotels — owner-mandated source, LIVE 17 Oct (TravelGuru tgapi pageSearch,
          // captured via stealth CDP interception, replayed browserless with curl_cffi).
          sourceId: "w_hotels_yatra",
          name: "Hotels worker: Yatra live per-night rates",
          priority: 7,
          maxPerMinute: 6,
          timeoutMs: 6e4,
          run: async (ctx) => {
            const city = cityFromQuery(ctx);
            if (!city || city.length < 3) return [];
            const { checkin, checkout } = stayDates(ctx.query);
            const headers = {
              "x-api-key": YATRA_HOTELS_API_KEY,
              // public — Yatra's own web app sends it
              "x-customer-ip": "106.51.30.10",
              // any client ip string the site expects
              Accept: "application/json",
              "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
              Origin: "https://hotel.yatra.com",
              Referer: "https://hotel.yatra.com/"
            };
            const hotels = [];
            let total = null;
            for (let page = 1; page <= 3; page++) {
              const r = await cffiFetch(yatraPageSearchUrl(city, checkin, checkout, page), {
                impersonate: "chrome",
                timeoutMs: 45e3,
                headers
              });
              if (r.status !== 200) {
                if (page === 1) throw new AcquisitionError("SERVER_ERROR", `Yatra pageSearch HTTP ${r.status}: ${r.body.slice(0, 160)}`, r.status);
                break;
              }
              let body = null;
              try {
                body = JSON.parse(r.body);
              } catch {
              }
              if (page === 1) total = body?.data?.content?.totalResultCount ?? null;
              const batch = body ? parseYatraHotels(body) : [];
              const fresh = batch.filter((h) => !hotels.some((seen) => seen.id === h.id));
              hotels.push(...fresh);
              if (fresh.length === 0 || body?.meta?.lastPage === true) break;
            }
            if (!hotels.length || total == null) throw new AcquisitionError("EMPTY_RESPONSE", `Yatra pageSearch returned no hotels for "${city}"`);
            return parseYatraOffers(hotels, ctx.source, city, { checkin, checkout });
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
  if (cache3 && Date.now() - cache3.at < 24 * 36e5) return cache3;
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
  cache3 = { at: Date.now(), airports, airlines, routes };
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
function canonicalAirlineName(name) {
  for (const [re, canon] of CANONICAL_AIRLINES) if (re.test(name)) return canon;
  return name.replace(/\s*(airlines|air lines|limited|ltd|pvt\.? ?ltd|co\.|inc)\.?$/i, "").trim() || name;
}
function parseRoute(airports, airlines, routes, source, fromCity, toCity, date, sourceUrl) {
  const fromAirports = matchAirports(airports, fromCity);
  const toAirports = matchAirports(airports, toCity);
  if (!fromAirports.length || !toAirports.length) return [];
  const srcIatas = new Set(fromAirports.map((a) => a.iata));
  const dstIatas = new Set(toAirports.map((a) => a.iata));
  const DEFUNCT = /\b(jet airways|kingfisher|spicejet cargo|silkair|tiger airways|air deccan|jetlite|go ?first|go ?air|air sahara|sahara|king ?fisher|virgin america|germanwings|monarch|thomas cook|air berlin|alitalia|malev|cargo|freight|express cargo|logistics|courier|dhl|fedex|ups)\b/i;
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
  for (const [airlineName2, rs] of matched) {
    const direct = rs.filter((r) => r.stops === 0).length;
    const r0 = rs[0];
    const srcAp = fromAirports.find((a) => a.iata === r0.srcIata);
    const dstAp = toAirports.find((a) => a.iata === r0.dstIata);
    out.push(newRawItem(source, {
      title: `${airlineName2}: ${srcAp.city} (${srcAp.iata}) \u2192 ${dstAp.city} (${dstAp.iata})`.slice(0, 200),
      seller: canonicalAirlineName(airlineName2).slice(0, 100),
      sellerUrl: airlineSiteFor(airlineName2) || sourceUrl,
      currency: "INR",
      travel: { route: `${srcAp.city} ${srcAp.iata} to ${dstAp.city} ${dstAp.iata}`.toLowerCase(), ...date ? { date } : {}, seatType: "unknown" },
      attributes: {
        airline: airlineName2.slice(0, 100),
        ...r0.airlineIata ? { airline_code: r0.airlineIata } : {},
        from_iata: srcAp.iata,
        to_iata: dstAp.iata,
        scheduled_services: String(rs.length),
        ...direct > 0 ? { direct_services: String(direct) } : {},
        data_note: "Airline-route schedules from OpenFlights open data; live fares require the airline (we never invent them)"
      },
      evidence: {
        sourceUrl,
        sourceReference: `${r0.srcIata}-${r0.dstIata}:${airlineName2}`,
        extractedFields: ["route", "airline", "airports"]
      }
    }));
  }
  return out.slice(0, 20);
}
var BASE, cache3, CITY_ALIASES, AIRLINE_SITES, CANONICAL_AIRLINES;
var init_openflights = __esm({
  "server/workers/parsers/openflights.ts"() {
    init_contract();
    BASE = "https://raw.githubusercontent.com/jpatokal/openflights/master/data";
    cache3 = null;
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
    CANONICAL_AIRLINES = [
      [/indigo/i, "IndiGo"],
      [/air india express/i, "Air India Express"],
      [/^air india(?!.*express)/i, "Air India"],
      [/spicejet/i, "SpiceJet"],
      [/akasa/i, "Akasa Air"],
      [/emirates/i, "Emirates"],
      [/vistara/i, "Vistara"],
      [/alliance air/i, "Alliance Air"],
      [/star air/i, "Star Air"],
      [/fly ?91/i, "Fly91"]
    ];
  }
});

// server/workers/parsers/ixigoFlights.ts
function ixigoRouteTokens(from, to, fromCode, toCode, iata = {}) {
  const iataOf = (city, code) => code && /^[A-Z]{3}$/.test(code) ? code.toUpperCase() : iata[city.toLowerCase().trim()] || null;
  const slug2 = (city) => city.toLowerCase().trim().replace(/\s+/g, "_");
  const fromTok = iataOf(from, fromCode) || slug2(from);
  const toTok = iataOf(to, toCode) || slug2(to);
  const alts = [];
  const altIata = iataOf(from, fromCode);
  if (altIata && altIata !== fromTok) alts.push(altIata);
  if (altIata) alts.push(slug2(from));
  if (fromTok.includes("_")) alts.push(fromTok.replace(/_/g, "-"));
  return { fromTok, toTok, alts };
}
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
function parseIxigoOffers(flights, source, from, to, date, listingUrl = `${IXIGO_WEB}/search/flight/`) {
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
      data_note: `Fare observed via Ixigo at ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 16)}Z; the ticket is SOLD by Ixigo (seller), operating carrier ${f.airline}. Price may change at checkout.`
    };
    out.push(newRawItem(source, {
      title: `${f.airline} ${f.flightNumber} \xB7 ${from} \u2192 ${to}`,
      seller: "Ixigo",
      sellerUrl: listingUrl,
      // deeplink to Ixigo's own SRP for this exact route/date
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
  return out.slice(0, 60);
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
function emtFareItems(fares, source, route, wantDate, fromCode = "", toCode = "") {
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const airline = (code) => code && EMT_AIRLINES[code] ? EMT_AIRLINES[code] : null;
  const exact = fares.find((f) => f.date === wantDate && airline(f.airlineCode));
  const upcoming = fares.filter((f) => airline(f.airlineCode)).sort((a, b) => a.fare - b.fare);
  const chosen = exact || upcoming[0];
  if (!chosen) return [];
  const al = airline(chosen.airlineCode);
  const emtSearchUrl = `https://www.easemytrip.com/flight-search?searchParams=${encodeURIComponent(`${fromCode}-${route.from}|${toCode}-${route.to}|${chosen.date}`)}`;
  const isExact = exact ? chosen.date === exact.date : false;
  const routeLabel = `${route.from} \u2192 ${route.to}`;
  return [newRawItem(source, {
    title: `${al.name} ${routeLabel} ${isExact ? `on ${chosen.date}` : `(cheapest upcoming, ${chosen.date})`} from \u20B9${chosen.fare}`,
    brand: al.name,
    price: chosen.fare,
    currency: "INR",
    seller: "EaseMyTrip",
    sellerUrl: emtSearchUrl,
    travel: { route: `${route.from.toLowerCase()} to ${route.to.toLowerCase()}` },
    attributes: {
      route: routeLabel,
      travel_date: chosen.date,
      fare: String(chosen.fare),
      airline_code: chosen.airlineCode || "",
      price_basis: `cheapest ${al.name} fare observed on EaseMyTrip's live fare calendar on ${today2} (EaseMyTrip is the selling website)`,
      data_note: `Fare acquired via EaseMyTrip fare calendar on ${today2}; the ticket is SOLD by EaseMyTrip (seller). Cheapest carrier fare for this route/date; may change at checkout.`,
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
      // Indian carriers (deeplink site kept for reference; seller is EaseMyTrip now)
      "6E": { name: "IndiGo", url: "https://www.goindigo.in/" },
      QP: { name: "Akasa Air", url: "https://www.akasaair.com/" },
      AI: { name: "Air India", url: "https://www.airindia.com/" },
      IX: { name: "Air India Express", url: "https://www.airindiaexpress.com/" },
      SG: { name: "SpiceJet", url: "https://www.spicejet.com/" },
      "9I": { name: "Alliance Air", url: "https://www.allianceair.in/" },
      // Major international carriers observed live in EMT's engine (name-only: honest
      // identification; ticket selling happens on EaseMyTrip, the seller).
      EK: { name: "Emirates" },
      QR: { name: "Qatar Airways" },
      EY: { name: "Etihad Airways" },
      WY: { name: "Oman Air" },
      GF: { name: "Gulf Air" },
      SV: { name: "Saudia" },
      FZ: { name: "flydubai" },
      G9: { name: "Air Arabia" },
      XY: { name: "Flynas" },
      RJ: { name: "Royal Jordanian" },
      MS: { name: "EgyptAir" },
      AT: { name: "Royal Air Maroc" },
      ET: { name: "Ethiopian Airlines" },
      KQ: { name: "Kenya Airways" },
      SA: { name: "South African Airways" },
      TK: { name: "Turkish Airlines" },
      BA: { name: "British Airways" },
      LH: { name: "Lufthansa" },
      LX: { name: "Swiss International Air Lines" },
      OS: { name: "Austrian Airlines" },
      AF: { name: "Air France" },
      KL: { name: "KLM Royal Dutch Airlines" },
      AZ: { name: "ITA Airways" },
      IB: { name: "Iberia" },
      TP: { name: "TAP Air Portugal" },
      AY: { name: "Finnair" },
      SK: { name: "SAS" },
      BT: { name: "airBaltic" },
      LO: { name: "LOT Polish Airlines" },
      AC: { name: "Air Canada" },
      AA: { name: "American Airlines" },
      DL: { name: "Delta Air Lines" },
      UA: { name: "United Airlines" },
      SQ: { name: "Singapore Airlines" },
      TR: { name: "Scoot" },
      TG: { name: "Thai Airways" },
      PG: { name: "Bangkok Airways" },
      VN: { name: "Vietnam Airlines" },
      VJ: { name: "VietJet Air" },
      MH: { name: "Malaysia Airlines" },
      OD: { name: "Batik Air Malaysia" },
      AK: { name: "AirAsia" },
      GA: { name: "Garuda Indonesia" },
      CX: { name: "Cathay Pacific" },
      CA: { name: "Air China" },
      MU: { name: "China Eastern Airlines" },
      CZ: { name: "China Southern Airlines" },
      KE: { name: "Korean Air" },
      OZ: { name: "Asiana Airlines" },
      NH: { name: "ANA" },
      JL: { name: "Japan Airlines" },
      QF: { name: "Qantas" },
      NZ: { name: "Air New Zealand" },
      UL: { name: "SriLankan Airlines" },
      BG: { name: "Biman Bangladesh Airlines" },
      PK: { name: "Pakistan International Airlines" },
      KC: { name: "Air Astana" },
      JD: { name: "Jordan Aviation" },
      H1: { name: "Hahn Air" },
      UK: { name: "Vistara (merged into Air India)" }
    };
  }
});

// server/workers/parsers/emtAirbus.ts
function emtEncrypt(plain) {
  const c = (0, import_crypto6.createCipheriv)("aes-128-cbc", Buffer.from(ENC_KEY, "utf8"), Buffer.from(ENC_KEY, "utf8"));
  return Buffer.concat([c.update(Buffer.from(plain, "utf8")), c.final()]).toString("base64");
}
function parseEmtAirbus(jsonText) {
  const d = JSON.parse(jsonText);
  const groups = Array.isArray(d?.j) ? d.j : [];
  const out = [];
  for (const g of groups) {
    for (const f of g?.s || []) {
      const segKey = String(f?.segMatchingKey || "");
      const legs = segKey.split("^").map((s) => s.trim());
      const parsed = legs.map((leg) => {
        const m = leg.match(SEG_RE);
        if (m) return { dep: m[1], arr: m[2], ac: m[3], fn: m[4], full: true };
        const n = leg.match(LEG_NO_ROUTE_RE);
        if (n) return { dep: "", arr: "", ac: n[1], fn: n[2], full: false };
        return null;
      }).filter(Boolean);
      if (parsed.length === 0 || !parsed.some((p) => p.full)) continue;
      const fullLegs = parsed.filter((p) => p.full);
      const depTime = fullLegs[0].dep;
      const arrTime = fullLegs[fullLegs.length - 1].arr;
      const airlineCode = parsed[0].ac;
      const flightNo2 = parsed.map((p) => p.fn).join("-");
      const fares = Array.isArray(f?.lstFr) ? f.lstFr : [];
      let fare = 0;
      let fareName = null;
      for (const fr of fares) {
        const tf = Number(fr?.TF) || 0;
        if (tf > 0 && (fare === 0 || tf < fare)) {
          fare = tf;
          fareName = fr?.FN || null;
        }
      }
      if (!fare || !depTime || !arrTime) continue;
      const sd = String(f?.SD || "");
      const stops = fullLegs.length === 1 ? "Non-stop" : `${fullLegs.length - 1} stop${fullLegs.length > 2 ? "s" : ""}`;
      const [dh, dm] = depTime.split(":").map(Number);
      const [ah, amm] = arrTime.split(":").map(Number);
      let durMin = ah * 60 + amm - (dh * 60 + dm);
      if (durMin < 0) durMin += 24 * 60;
      out.push({
        segKey,
        airlineCode,
        flightNo: flightNo2,
        depTime,
        arrTime,
        fare,
        fareName,
        seats: String(f?.SeatAv ?? ""),
        stops,
        durationMin: durMin
      });
    }
  }
  return out;
}
function emtAirbusItems(flights, source, route, fromCode, toCode, dateIso, fromCountry = "India", toCountry = "India", cap = 60) {
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const routeLabel = `${route.from} \u2192 ${route.to}`;
  const emtListing = `https://www.easemytrip.com/flight-search/listing?srch=${fromCode}-${encodeURIComponent(route.from)}-${encodeURIComponent(fromCountry || "India")}%7C${toCode}-${encodeURIComponent(route.to)}-${encodeURIComponent(toCountry || "India")}%7C${dateIso.split("-").reverse().join("/")}&px=1-0-0&cbn=Economy&isow=true&isdm=true`;
  const seen = /* @__PURE__ */ new Set();
  const items = [];
  for (const f of flights.sort((a, b) => a.fare - b.fare)) {
    const al = EMT_AIRLINES[f.airlineCode];
    const alName = al?.name || f.airlineCode;
    const key = `${alName}|${f.flightNo}|${f.depTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (items.length >= cap) break;
    items.push(newRawItem(source, {
      title: `${alName} ${f.airlineCode}${f.flightNo} \xB7 ${routeLabel}`,
      brand: alName,
      price: f.fare,
      currency: "INR",
      seller: "EaseMyTrip",
      sellerUrl: emtListing,
      travel: { route: `${route.from.toLowerCase()} to ${route.to.toLowerCase()}` },
      attributes: {
        route: routeLabel,
        travel_date: dateIso,
        departure: f.depTime,
        arrival: f.arrTime,
        duration: hhmm(f.durationMin),
        stops: f.stops,
        seats: f.seats ? `${f.seats} seats left` : "",
        fare_basis: f.fareName ? `${f.fareName} fare` : "",
        price_basis: `live ${f.fareName || alName} fare observed on EaseMyTrip's flight search on ${today2} (EaseMyTrip is the selling website)`,
        data_note: `Fare acquired via EaseMyTrip flight search API on ${today2}; the ticket is SOLD by EaseMyTrip (seller), operating carrier ${alName}. Fare may change at checkout.`,
        deep_link_ref: emtListing
      },
      identifiers: { sku: `emt-airbus-${f.airlineCode}-${f.flightNo}-${dateIso}` },
      evidence: {
        sourceUrl: AIRBUS_URL,
        extractedFields: ["segMatchingKey", "lstFr[].TF (INR)", "SeatAv", "SD (stops)"]
      }
    }));
  }
  return items;
}
var import_crypto6, ENC_KEY, AIRBUS_URL, SEG_RE, LEG_NO_ROUTE_RE, hhmm;
var init_emtAirbus = __esm({
  "server/workers/parsers/emtAirbus.ts"() {
    import_crypto6 = require("crypto");
    init_contract();
    init_emtFareCalendar();
    ENC_KEY = "hylW@zmEQdG@4Idr";
    AIRBUS_URL = "https://flightservice-node.easemytrip.com/AirAvail_Lights/AirBus_New";
    SEG_RE = /^[A-Z]{3}[A-Z]{3}[A-Za-z]{3}-\d{2}[A-Za-z]{3}\d{4}(\d{2}:\d{2})(\d{2}:\d{2})\s*([A-Z0-9]{2})\s*(\d+)$/;
    LEG_NO_ROUTE_RE = /^\s*([A-Z0-9]{2})\s*(\d+)$/;
    hhmm = (mins) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
  }
});

// server/common/airportLookup.ts
async function resolveAirport(city, codeHint) {
  if (codeHint && /^[A-Za-z]{3}$/.test(codeHint)) return { code: codeHint.toUpperCase(), city, country: "" };
  const s = IATA[city.toLowerCase().trim()];
  if (s) return { code: s, city, country: "India" };
  return cityToAirport(city);
}
async function loadAirports() {
  if (cache4 && Date.now() - cache4.at < TTL_OK) return cache4.byCity;
  const res = await fetch(URL_DAT, { signal: AbortSignal.timeout(15e3) });
  if (!res.ok) throw new Error(`airports.dat HTTP ${res.status}`);
  const text = await res.text();
  const byCity = /* @__PURE__ */ new Map();
  const splitCsv2 = (line) => {
    const out = [];
    let cur = "";
    let q3 = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q3 && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q3 = !q3;
      } else if (ch === "," && !q3) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const f = splitCsv2(line);
    const iata = (f[4] || "").trim();
    if (!iata || iata === "\\N" || !/^[A-Z]{3}$/.test(iata)) continue;
    const city = (f[2] || "").trim();
    const country = (f[3] || "").trim();
    if (!city || !country) continue;
    const ap = { iata, city, country, name: (f[1] || "").trim() };
    const key = norm2(city);
    const bucket = byCity.get(key);
    if (bucket) bucket.push(ap);
    else byCity.set(key, [ap]);
  }
  cache4 = { at: Date.now(), byCity };
  return byCity;
}
async function cityToAirport(city) {
  const key = norm2(city);
  if (!key) return { code: null, city, country: "" };
  const missAt = missCache.get(key);
  if (missAt && Date.now() - missAt < TTL_MISS) return { code: null, city, country: "" };
  try {
    const byCity = await loadAirports();
    let bucket = byCity.get(key);
    if (!bucket) {
      for (const [ck, aps] of byCity) {
        if (aps.some((a) => norm2(a.name).includes(key))) {
          bucket = aps;
          break;
        }
      }
    }
    if (!bucket || bucket.length === 0) {
      missCache.set(key, Date.now());
      return { code: null, city, country: "" };
    }
    const ranked = bucket.map((a) => ({ a, rank: PREF_RANK.has(a.iata) ? PREF_RANK.get(a.iata) : 999 })).sort((x, y) => x.rank - y.rank);
    const preferred = ranked[0]?.a || bucket[0];
    return { code: preferred.iata, city: preferred.city, country: preferred.country };
  } catch (e) {
    log.warn("AirportLookup", `airports.dat unavailable: ${String(e?.message || e)}`);
    return { code: null, city, country: "" };
  }
}
var URL_DAT, PREFERRED, PREF_RANK, IATA, TTL_OK, TTL_MISS, cache4, missCache, norm2;
var init_airportLookup = __esm({
  "server/common/airportLookup.ts"() {
    init_logger();
    URL_DAT = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat";
    PREFERRED = [
      "LHR",
      "JFK",
      "EWR",
      "LGA",
      "LGW",
      "DXB",
      "SIN",
      "CDG",
      "AMS",
      "FRA",
      "IST",
      "HND",
      "ICN",
      "PEK",
      "PVG",
      "SYD",
      "DOH",
      "AUH",
      "BKK",
      "MAD",
      "FCO",
      "MUC",
      "YYZ",
      "GRU",
      "MEX",
      "JNB",
      "CAI",
      "KUL",
      "CGK",
      "SVO",
      "MOW",
      "LAX",
      "SFO",
      "ORD",
      "ATL",
      "DFW",
      "MIA",
      "HKG",
      "TPE",
      "NRT",
      "AKL",
      "MEL",
      "ZRH",
      "VIE",
      "ARN",
      "OSL",
      "HEL",
      "DUB",
      "LIS",
      "ATH",
      "WAW",
      "PRG",
      "OTP",
      "SOF",
      "BEY",
      "AMM",
      "TLV",
      "KHI",
      "LHE",
      "ISB",
      "DAC",
      "KTM",
      "CMB",
      "ALA",
      "TAS",
      "TBS",
      "RUH",
      "JED",
      "MLE",
      "BOM",
      "DEL",
      "BLR",
      "MAA",
      "SHJ",
      "DWC",
      "LGW",
      "STN"
    ];
    PREF_RANK = new Map(PREFERRED.map((c, i) => [c, i]));
    IATA = {
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
    TTL_OK = 24 * 36e5;
    TTL_MISS = 10 * 6e4;
    cache4 = null;
    missCache = /* @__PURE__ */ new Map();
    norm2 = (s) => s.toLowerCase().replace(/[’'’.]/g, "").replace(/\s+/g, " ").trim();
  }
});

// server/workers/parsers/kiwiFlights.ts
async function kiwiSearch(fromIata, toIata, dateIso) {
  const res = await cffiFetch(GRAPHQL_URL, {
    impersonate: "chrome",
    timeoutMs: 4e4,
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://www.kiwi.com", Referer: "https://www.kiwi.com/" },
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: {
        search: {
          itinerary: {
            source: { ids: [`Station:airport:${fromIata}`] },
            destination: { ids: [`Station:airport:${toIata}`] },
            outboundDepartureDate: { start: `${dateIso}T00:00:00`, end: `${dateIso}T23:59:59` }
          },
          passengers: { adults: 1 }
        },
        options: { partner: "skypicker", currency: "INR", locale: "en" }
      }
    })
  });
  if (res.status === 403 || res.status === 429) return null;
  if (res.status !== 200) throw new Error(`Kiwi graphql HTTP ${res.status}`);
  const data = JSON.parse(res.body || "{}");
  const root = data?.data?.onewayItineraries;
  if (!root || root.__typename === "AppError") throw new Error(`Kiwi AppError ${root?.code || ""} ${root?.message || "no data"}`);
  const itineraries = root.itineraries || [];
  return { itineraries, total: root.metadata?.itinerariesCount ?? itineraries.length };
}
function kiwiItems(itineraries, source, route, fromCode, toCode, dateIso, cap = 60) {
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const it of itineraries) {
    if (out.length >= cap) break;
    const segs = (it.sector?.sectorSegments || []).map((s) => s.segment).filter(Boolean);
    if (segs.length === 0) continue;
    const depDay = (segs[0].source?.utcTimeIso || "").slice(0, 10);
    if (depDay !== dateIso) continue;
    const al0 = segs[0].carrier;
    if (!al0?.code) continue;
    const flightNos = segs.map((s) => `${s.carrier?.code || ""}${s.code || ""}`);
    const flightNoKey = flightNos.join("-");
    const depTime = (segs[0].source?.utcTimeIso || "").slice(11, 16);
    const arrTime = (segs[segs.length - 1]?.destination?.utcTimeIso || "").slice(11, 16);
    const stops = segs.length - 1;
    const key = `${al0.code}|${flightNoKey}|${depTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const fare = Number(it.price?.amount || 0);
    if (!fare || fare <= 0) continue;
    const rawUrl = it.bookingOptions?.edges?.[0]?.node?.bookingUrl || "";
    const bookingUrl = rawUrl.startsWith("http") ? rawUrl : rawUrl ? `https://www.kiwi.com${rawUrl}` : "";
    const routeLabel = `${route.from} \u2192 ${route.to}`;
    const alNames = [...new Set((it.sector?.carriers || []).map((c) => c.name))].join(" + ");
    out.push(newRawItem(source, {
      title: `${alNames || al0.name} ${flightNoKey} \xB7 ${routeLabel}`.slice(0, 200),
      brand: (alNames || al0.name).slice(0, 80),
      price: Math.round(fare),
      currency: it.price?.currency?.code || "INR",
      seller: "Kiwi.com",
      sellerUrl: bookingUrl || `https://www.kiwi.com/en/search/results/${fromCode.toLowerCase()}/${toCode.toLowerCase()}/${dateIso}`,
      travel: { route: `${route.from.toLowerCase()} to ${route.to.toLowerCase()}`, date: dateIso, seatType: "economy" },
      attributes: {
        route: routeLabel,
        travel_date: dateIso,
        airline: alNames || al0.name,
        airline_code: al0.code,
        flight_number: flightNoKey,
        departure: depTime,
        arrival: arrTime,
        stops: String(stops),
        price_basis: `live ${stops === 0 ? "nonstop" : `${stops}-stop`} fare observed on Kiwi.com's flight search on ${today2} (Kiwi.com is the selling website)`,
        data_note: `Fare acquired via Kiwi.com's search API on ${today2}; the ticket is SOLD by Kiwi.com (seller), operating carrier ${alNames || al0.name}. Price may change at checkout.`
      },
      identifiers: { sku: `kiwi-${flightNoKey}-${dateIso}-${depTime}`.slice(0, 120) },
      evidence: {
        sourceUrl: GRAPHQL_URL,
        sourceReference: it.id.slice(0, 160),
        extractedFields: ["itineraries[].price.amount (INR)", "sector.carriers", "segment.code/utcTimeIso", "bookingOptions.edges[].node.bookingUrl"]
      }
    }));
  }
  return out;
}
var GRAPHQL_URL, SEARCH_QUERY;
var init_kiwiFlights = __esm({
  "server/workers/parsers/kiwiFlights.ts"() {
    init_curlCffiFetch();
    init_contract();
    GRAPHQL_URL = "https://api.skypicker.com/umbrella/v2/graphql";
    SEARCH_QUERY = `query($search: SearchOnewayInput!, $options: ItinerariesOptionsInput) {
  onewayItineraries(search: $search, options: $options) {
    __typename
    ... on Itineraries {
      itineraries {
        ... on ItineraryOneWay {
          id
          sector {
            carriers { name code }
            duration
            sectorSegments {
              segment {
                code
                carrier { name code }
                source { utcTimeIso station { code } }
                destination { utcTimeIso station { code } }
              }
            }
          }
          price { amount currency { code } }
          bookingOptions { edges { node { bookingUrl } } }
        }
      }
      metadata { itinerariesCount }
    }
    ... on AppError { code message }
  }
}`;
  }
});

// server/workers/parsers/indigoFlights.ts
function pick2(o, keys) {
  for (const k of keys) if (o[k] !== void 0 && o[k] !== null && o[k] !== "") return o[k];
  return void 0;
}
function flightNo(o) {
  const direct = pick2(o, NO_KEYS);
  if (typeof direct === "string" && FLIGHT_NO.test(direct)) return direct.toUpperCase().replace(/\s+/, "-");
  for (const k of FLIGHT_DETAIL_KEYS) {
    const v = o[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const inner = flightNo(v);
      if (inner) return inner;
    }
  }
  return void 0;
}
function fillMeta(o, f) {
  const grab = (keys, assign) => {
    const v = pick2(o, keys);
    if (v !== void 0) assign(v);
  };
  if (!f.depTime) grab(DEP_KEYS, (v) => {
    f.depTime = timeish(v);
  });
  if (!f.arrTime) grab(ARR_KEYS, (v) => {
    f.arrTime = timeish(v);
  });
  if (!f.duration) grab(DUR_KEYS, (v) => {
    if (typeof v === "string") f.duration = v;
  });
  if (f.stops === void 0) grab(["stop", "stops", "numberOfStops", "stopCount"], (v) => {
    f.stops = num8(v);
  });
  if (!f.cabin) grab(["cabin", "cabinClass", "class", "fareFamily"], (v) => {
    if (typeof v === "string") f.cabin = v;
  });
  if (f.seatsLeft === void 0) grab(["seatsLeft", "seatsAvailable", "availableSeats", "seatLeft"], (v) => {
    const n = num8(v);
    f.seatsLeft = n !== void 0 ? n : typeof v === "string" ? v : void 0;
  });
  const stat = (keys) => {
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "string" && /^[A-Za-z]{3}$/.test(v.trim())) return v.trim().toUpperCase();
    }
    return void 0;
  };
  if (!f.depStation) f.depStation = stat(["origin", "from", "originStation", "fromStation", "departureStation", "originStationCode"]);
  if (!f.arrStation) f.arrStation = stat(["destination", "to", "destinationStation", "toStation", "arrivalStation", "destinationStationCode"]);
  if (!f.fareCurrency) {
    const c = pick2(o, ["currencyCode", "currency"]);
    if (typeof c === "string" && c.trim()) f.fareCurrency = c;
  }
}
function collectFlights(root) {
  const out = [];
  const walk2 = (node, depth) => {
    const mine = [];
    if (depth > 14 || node == null) return mine;
    if (Array.isArray(node)) {
      for (const v of node) mine.push(...walk2(v, depth + 1));
      return mine;
    }
    if (typeof node !== "object") return mine;
    const o = node;
    for (const [k, v] of Object.entries(o)) {
      if (FLIGHT_DETAIL_KEYS.includes(k) || v == null) continue;
      mine.push(...walk2(v, depth + 1));
    }
    const no = flightNo(o);
    if (no) {
      const f = { flightNo: no };
      for (const k of FLIGHT_DETAIL_KEYS) {
        const v = o[k];
        if (v && typeof v === "object" && !Array.isArray(v)) fillMeta(v, f);
      }
      fillMeta(o, f);
      mine.push(f);
    }
    const fare = num8(pick2(o, FARE_KEYS));
    if (fare !== void 0 && fare > 0) {
      const first = mine.find((f) => f.fare === void 0);
      if (first) {
        first.fare = fare;
        if (!first.fareCurrency) {
          const c = pick2(o, ["currencyCode", "currency"]);
          if (typeof c === "string" && c.trim()) first.fareCurrency = c;
        }
      }
    }
    if (!no) {
      const bare = mine.filter((f) => f.fare === void 0 && (!f.depTime || !f.arrTime));
      if (bare.length === 1) fillMeta(o, bare[0]);
    }
    return mine;
  };
  out.push(...walk2(root, 0));
  return out;
}
function parseIndigoSearch(body) {
  let root;
  try {
    root = JSON.parse(body);
  } catch {
    return [];
  }
  return collectFlights(root);
}
function indigoItems(flights, source, fromCity, toCity, fromCode, toCode, departIso) {
  const items = [];
  const seen = /* @__PURE__ */ new Set();
  for (const f of flights) {
    if (f.fare === void 0 || f.fare <= 0) continue;
    const key = `${f.flightNo}|${f.depTime || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const route = `${fromCity} to ${toCity}`.toLowerCase();
    const dep = f.depTime ? `, departs ${f.depTime}` : "";
    const arr = f.arrTime ? `, arrives ${f.arrTime}` : "";
    const deeplink = `https://www.goindigo.in/flight-booking/booking?journeyType=One%20Way&from=${fromCode}&to=${toCode}&depart=${departIso}&pax=A1`;
    items.push(newRawItem(source, {
      title: `IndiGo ${f.flightNo} ${fromCode} to ${toCode} on ${departIso}${dep}${arr}`,
      brand: "IndiGo",
      price: f.fare,
      currency: f.fareCurrency === "USD" ? "USD" : "INR",
      seller: "IndiGo",
      sellerUrl: deeplink,
      travel: { route, seatType: f.cabin || "Economy", date: departIso },
      attributes: {
        route,
        flight_no: f.flightNo || "",
        from_iata: fromCode,
        to_iata: toCode,
        departs: f.depTime || "",
        arrives: f.arrTime || "",
        duration: f.duration || "",
        stops: f.stops !== void 0 ? String(f.stops) : "0",
        seats_left: f.seatsLeft !== void 0 ? String(f.seatsLeft) : "",
        price_basis: `fare returned by IndiGo's own flight-search API for ${departIso}`
      },
      identifiers: { sku: `indigo-${f.flightNo}-${route.replace(/\s+/g, "-")}-${departIso}` },
      evidence: {
        sourceUrl: "https://api-prod-mobile-skyplus6e.goindigo.in/flightsearch/v1/flight/search",
        extractedFields: ["flightNumber", "totalFare", "departureTime", "arrivalTime"]
      }
    }));
    if (items.length >= 25) break;
  }
  return items;
}
async function indigoWebFareCalendar(cffiFetch2, fromCode, toCode, depIso) {
  const base = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Origin: "https://www.goindigo.in",
    Referer: "https://www.goindigo.in/",
    Accept: "application/json",
    "Content-Type": "application/json"
  };
  const rTok = await cffiFetch2(WEB_TOKEN_URL, {
    impersonate: "chrome",
    timeoutMs: 12e3,
    method: "POST",
    body: JSON.stringify({ strToken: "", subscriptionKey: WEB_BOOKING_KEY }),
    headers: { ...base, User_key: WEB_SESSION_KEY }
  });
  if (rTok.status !== 200) return [];
  let tok;
  const walk2 = (o) => {
    if (o && typeof o === "object") {
      for (const k of Object.keys(o)) {
        if (k === "token" && typeof o[k] === "string" && o[k].split(".").length === 3) return o[k];
        const r2 = walk2(o[k]);
        if (r2) return r2;
      }
    }
    return void 0;
  };
  try {
    let raw = JSON.parse(rTok.body);
    if (typeof raw === "string") raw = JSON.parse(raw);
    tok = walk2(raw);
  } catch {
    return [];
  }
  if (!tok) return [];
  const endIso = new Date((/* @__PURE__ */ new Date(`${depIso}T00:00:00Z`)).getTime() + 62 * 864e5).toISOString().slice(0, 10);
  const body = JSON.stringify({
    startDate: `${depIso}T00:00:00`,
    endDate: `${endIso}T00:00:00`,
    origin: fromCode,
    destination: toCode,
    currencyCode: "INR",
    promoCode: "",
    lowestIn: "M"
  });
  const r = await cffiFetch2(WEB_FARECAL_URL, {
    impersonate: "chrome",
    timeoutMs: 15e3,
    method: "POST",
    body,
    headers: { ...base, User_key: WEB_BOOKING_KEY, Authorization: `Bearer ${tok}` }
  });
  if (r.status !== 200) return [];
  try {
    const d = JSON.parse(r.body);
    const low = d?.data?.lowFares;
    if (!Array.isArray(low)) return [];
    return low.filter((e) => e?.date && Number(e?.price) > 0).map((e) => ({
      date: String(e.date).slice(0, 10),
      price: Math.round(Number(e.price)),
      category: String(e.category || "")
    }));
  } catch {
    return [];
  }
}
function indigoDayFareItems(fares, source, fromCity, toCity, fromCode, toCode, depIso) {
  const exact = fares.find((f) => f.date === depIso);
  if (!exact || exact.price <= 0) return [];
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const route = `${fromCity} to ${toCity}`.toLowerCase();
  const deeplink = `https://www.goindigo.in/flight-booking/booking?journeyType=One%20Way&from=${fromCode}&to=${toCode}&depart=${depIso}&pax=A1`;
  return [newRawItem(source, {
    title: `IndiGo ${fromCode} to ${toCode} on ${depIso} from \u20B9${exact.price}`,
    brand: "IndiGo",
    price: exact.price,
    currency: "INR",
    seller: "IndiGo",
    sellerUrl: deeplink,
    travel: { route, seatType: "Economy", date: depIso },
    attributes: {
      route: `${fromCity} \u2192 ${toCity}`,
      travel_date: depIso,
      fare_class: exact.category ? `${exact.category}-category fare` : "",
      price_basis: `cheapest economy fare returned by IndiGo's own fare-calendar API on ${today2} for this route and date`
    },
    identifiers: { sku: `indigo-farecal-${fromCode}-${toCode}-${depIso}` },
    evidence: {
      sourceUrl: WEB_FARECAL_URL,
      extractedFields: ["data.lowFares[].price (INR)", "date", "category"]
    }
  })];
}
var FLIGHT_NO, num8, timeish, FARE_KEYS, NO_KEYS, DEP_KEYS, ARR_KEYS, DUR_KEYS, FLIGHT_DETAIL_KEYS, WEB_SESSION_KEY, WEB_BOOKING_KEY, WEB_TOKEN_URL, WEB_FARECAL_URL;
var init_indigoFlights = __esm({
  "server/workers/parsers/indigoFlights.ts"() {
    init_contract();
    FLIGHT_NO = /\b6E[-\s]*(\d{2,4})\b/i;
    num8 = (v) => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && v.trim() !== "") {
        const n = Number(v.replace(/[₹,\s]/g, ""));
        if (Number.isFinite(n)) return n;
      }
      return void 0;
    };
    timeish = (v) => typeof v === "string" && /\d{1,2}:\d{2}/.test(v) ? v : void 0;
    FARE_KEYS = ["totalFare", "totalAmount", "fareAmount", "fare", "netFare", "totalPrice", "amount", "adultFare", "displayFare", "baseFareAmount"];
    NO_KEYS = ["flightNumber", "flightNo", "flight_number", "flightCode", "code", "flightIdentifier", "flightCodeWithSuffix"];
    DEP_KEYS = ["departureTime", "depTime", "departureDateTime", "std", "scheduledDeparture", "fromTime"];
    ARR_KEYS = ["arrivalTime", "arrTime", "arrivalDateTime", "sta", "scheduledArrival", "toTime"];
    DUR_KEYS = ["duration", "travelTime", "journeyDuration", "flightDuration", "totalDuration"];
    FLIGHT_DETAIL_KEYS = ["flightDetail", "flightInfo", "flightDetails", "segment", "leg"];
    WEB_SESSION_KEY = "654a6a3cc4998e498e5c0c8ead072915";
    WEB_BOOKING_KEY = "15faf8ddf1e8354e90e54fa098e8b1a8";
    WEB_TOKEN_URL = "https://api-prod-session-skyplus6e.goindigo.in/v2/token/create";
    WEB_FARECAL_URL = "https://api-prod-booking-skyplus6e.goindigo.in/v1/getfarecalendar";
  }
});

// server/workers/parsers/akasaFlights.ts
function akasaFareCalendarUrl(fromCode, toCode, depIso) {
  const start = `${depIso}T00:00:00%2B05:30`;
  return `${AKASA_API_BASE}/availability/v2/search?origin=${fromCode}&destination=${toCode}&startDate=${start}&numberOfPassengers=1&channel=WEB&currencyCode=INR`;
}
function parseAkasaFareCalendar(xml) {
  const out = [];
  const blocks = xml.match(/<data>[\s\S]*?<\/data>/g) || [];
  for (const b of blocks) {
    const date = b.match(/<date>([^<]+)<\/date>/)?.[1]?.slice(0, 10) || null;
    const price = Number(b.match(/<price>([^<]+)<\/price>/)?.[1] || 0);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    out.push({
      date,
      price,
      isLowest: /<isLowest>true<\/isLowest>/.test(b),
      noFlights: /<noFlights>true<\/noFlights>/.test(b),
      soldOut: /<soldOut>true<\/soldOut>/.test(b)
    });
  }
  return out;
}
function akasaDayFareItems(fares, source, fromCity, toCity, fromCode, toCode, depIso) {
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const bookable = fares.filter((f) => f.price > 0 && !f.noFlights && !f.soldOut);
  const exact = bookable.find((f) => f.date === depIso);
  const upcoming = [...bookable].sort((a, b) => a.price - b.price);
  const chosen = exact || upcoming[0];
  if (!chosen) return [];
  const isExact = Boolean(exact);
  const routeLabel = `${fromCity} \u2192 ${toCity}`;
  const deeplink = `${AKASA_WEB}/booking`;
  return [newRawItem(source, {
    title: `Akasa Air ${routeLabel} ${isExact ? `on ${chosen.date}` : `(cheapest upcoming, ${chosen.date})`} from \u20B9${Math.round(chosen.price)}`,
    brand: "Akasa Air",
    price: Math.round(chosen.price),
    currency: "INR",
    seller: "Akasa Air",
    sellerUrl: deeplink,
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: chosen.date },
    attributes: {
      route: routeLabel,
      travel_date: chosen.date,
      fare_class: "lowest economy fare (taxes included) from Akasa Air's own fare calendar",
      price_basis: `lowest Akasa Air fare returned by Akasa's own booking API on ${today2} for this route${isExact ? " and date" : " within the next 60 days"}`,
      data_note: `Fare acquired from Akasa Air's official low-fare calendar on ${today2}; booking is on Akasa Air's own website.`,
      image: ""
    },
    identifiers: { sku: `akasa-${fromCode}-${toCode}-${chosen.date}` },
    evidence: {
      sourceUrl: akasaFareCalendarUrl(fromCode, toCode, depIso),
      extractedFields: ["data[].date", "data[].price (INR)", "isLowest", "noFlights", "soldOut"]
    }
  })];
}
var AKASA_API_BASE, AKASA_WEB;
var init_akasaFlights = __esm({
  "server/workers/parsers/akasaFlights.ts"() {
    init_contract();
    AKASA_API_BASE = "https://prod-bl.qp.akasaair.com/api/ibe";
    AKASA_WEB = "https://www.akasaair.com";
  }
});

// server/workers/parsers/viaFlights.ts
function viaFareCalendarUrl() {
  return `${VIA_BASE}/apiv2/flight/fare-calendar?authToken=${VIA_AUTH_TOKEN}&requestSource=NODE_B2C&flowType=NODE&ajax=true&jsonData=true&__xreq__=true`;
}
function viaSearchUrl(fromCode, toCode, depIso) {
  const [y, m, d] = depIso.split("-");
  const usDate = `${m}/${d}/${y}`;
  return `${VIA_BASE}/flight/search?returnType=one-way&destination=${toCode}&bdestination=${toCode}&source=${fromCode}&bsource=${fromCode}&month=${Number(m)}&day=${Number(d)}&year=${y}&date=${encodeURIComponent(usDate)}&numAdults=1&numChildren=0&numInfants=0&validation_result=&domesinter=domestic&livequote=-1&flightClass=Economy&travType=DOM&routingType=ALL&isAjax=false`;
}
function parseViaFareCalendar(body) {
  let root;
  try {
    root = JSON.parse(body);
  } catch {
    return [];
  }
  const cd = root?.cd;
  if (!Array.isArray(cd)) return [];
  const out = [];
  for (const e of cd) {
    const dt = String(e?.dt || "");
    const pr = Number(e?.pr);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dt) && Number.isFinite(pr) && pr > 0) {
      out.push({ dt, pr, prType: String(e?.prType || "") });
    }
  }
  return out;
}
function viaDayFareItems(fares, source, fromCity, toCity, fromCode, toCode, depIso) {
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const exact = fares.find((f) => f.dt === depIso);
  const upcoming = [...fares].sort((a, b) => a.pr - b.pr);
  const chosen = exact || upcoming[0];
  if (!chosen) return [];
  const isExact = Boolean(exact);
  const routeLabel = `${fromCity} \u2192 ${toCity}`;
  return [newRawItem(source, {
    title: `Via.com ${routeLabel} ${isExact ? `on ${chosen.dt}` : `(cheapest upcoming, ${chosen.dt})`} from \u20B9${Math.round(chosen.pr)}`,
    brand: "Via.com",
    price: Math.round(chosen.pr),
    currency: "INR",
    seller: "Via.com",
    sellerUrl: viaSearchUrl(fromCode, toCode, chosen.dt),
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: chosen.dt },
    attributes: {
      route: routeLabel,
      travel_date: chosen.dt,
      fare_class: `lowest economy fare (${chosen.prType || "LOW"} bucket) from Via.com's own fare calendar`,
      price_basis: `lowest Via.com fare returned by via.com's fare-calendar API on ${today2} for this route${isExact ? " and date" : " within the returned calendar window"}`,
      data_note: `Fare acquired from Via.com's official fare calendar on ${today2}; booking continues on Via.com's own website.`,
      image: ""
    },
    identifiers: { sku: `via-${fromCode}-${toCode}-${chosen.dt}` },
    evidence: {
      sourceUrl: viaFareCalendarUrl(),
      extractedFields: ["cd[].dt", "cd[].pr (INR)", "cd[].prType"]
    }
  })];
}
var VIA_BASE, VIA_AUTH_TOKEN;
var init_viaFlights = __esm({
  "server/workers/parsers/viaFlights.ts"() {
    init_contract();
    VIA_BASE = "https://in.via.com";
    VIA_AUTH_TOKEN = "553f5767-373f-4d98-9e6d-08fa87400a42";
  }
});

// server/workers/parsers/yatraFlights.ts
function yatraTriggerUrl(from, to, depIso, countryFrom = "IN", countryTo = "IN") {
  const [y, m, d] = depIso.split("-");
  return `${YATRA_API}/air-service/dom2/trigger?ADT=1&CHD=0&INF=0&class=Economy&destination=${to}&destinationCountry=${countryTo}&flexi=0&flight_depart_date=${encodeURIComponent(`${d}/${m}/${y}`)}&hb=&noOfSegments=1&origin=${from}&originCountry=${countryFrom}&type=O&unique=${Date.now()}&viewName=normal`;
}
function yatraSrpUrl3(from, to, depIso) {
  const [y, m, d] = depIso.split("-");
  return `${YATRA_API}/air-search-ui/dom2/trigger?flex=0&viewName=normal&source=fresco-flights&type=O&class=Economy&ADT=1&CHD=0&INF=0&noOfSegments=1&origin=${from}&originCountry=IN&destination=${to}&destinationCountry=IN&flight_depart_date=${encodeURIComponent(`${d}/${m}/${y}`)}&arrivalDate=`;
}
function yatraCalendarUrl(from, to, fromIso, toIso) {
  const f = fromIso.split("-").reverse().join("-");
  const t = toIso.split("-").reverse().join("-");
  return `${YATRA_API}/lowest-fare-service/dom2/get-fare?origin=${from}&destination=${to}&from=${f}&to=${t}&tripType=O&airlines=all&_i=${Date.now()}&src=srp`;
}
function airlineName(code, map) {
  const n = map?.[code];
  if (typeof n === "string" && n.trim()) return n.trim();
  const e = EMT_AIRLINES[code];
  if (e?.name) return e.name;
  return code;
}
function hhmm2(iso, hm) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso} ${hm}` : `${iso} ${hm}`.trim();
}
function parseYatraBatch(body, source, srpUrl, routeKey, fromCity, toCity) {
  let root;
  try {
    root = JSON.parse(body);
  } catch {
    return [];
  }
  if (typeof root === "string") {
    try {
      root = JSON.parse(root);
    } catch {
      return [];
    }
  }
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const batches = Array.isArray(root?.resultData) ? root.resultData : [root];
  for (const batch of batches) {
    if (!batch || typeof batch !== "object") continue;
    if (String(batch.isError) === "1" && !batch.fltSchedule) continue;
    const sched = batch.fltSchedule;
    const airlineMap = sched?.airlineNames || {};
    const flights = sched?.[routeKey];
    const fares = batch.fareDetails?.[routeKey];
    if (!Array.isArray(flights) || !fares) continue;
    for (const f of flights) {
      const od = Array.isArray(f?.OD) ? f.OD[0] : null;
      if (!od) continue;
      const fid = String(od.fid || f.ID || "");
      if (!fid || seen.has(fid)) continue;
      const segs = Array.isArray(od.FS) ? od.FS : [];
      if (!segs.length) continue;
      const fare = fares?.[fid]?.O?.ADT;
      const price = Number(fare?.tf ?? fare?.ftf);
      if (!Number.isFinite(price) || price <= 0) continue;
      const first = segs[0];
      const last = segs[segs.length - 1];
      const ac = String(first.ac || "");
      const fl = String(first.fl || "");
      const name = airlineName(ac, airlineMap);
      const stops = segs.length - 1;
      const depDate = String(first.ddt || "").slice(0, 10);
      const routeLabel = `${fromCity} \u2192 ${toCity}`;
      seen.add(fid);
      out.push(newRawItem(source, {
        title: `${name} ${ac}${fl ? `-${fl}` : ""} ${routeLabel} ${stops ? `(${stops} stop${stops > 1 ? "s" : ""})` : "non-stop"}`.slice(0, 200),
        brand: name,
        price: Math.round(price),
        currency: "INR",
        seller: "Yatra",
        sellerUrl: srpUrl,
        travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: depDate },
        attributes: {
          airline: name,
          flight_number: `${ac}${fl}`,
          departure: hhmm2(depDate, String(first.dd || "")),
          arrival: hhmm2(String(last.adt || "").slice(0, 10), String(last.ad || "")),
          duration: String(od.tdu || first.du || ""),
          stops: String(stops),
          origin: String(first.dac || ""),
          destination: String(last.aac || ""),
          fare_basis: String(od.fareId || "Economy"),
          price_basis: `total Yatra fare for 1 adult from Yatra's own flight search API on ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`,
          data_note: `Fare acquired from Yatra's official flight search API on ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}; booking continues on Yatra's own website.`,
          image: ""
        },
        identifiers: { sku: fid },
        evidence: {
          sourceUrl: srpUrl,
          extractedFields: ["fltSchedule[].OD[].FS[].ac/fl/dd/ad/dac/aac", "fareDetails[][].O.ADT.tf (INR)", "airlineNames"]
        }
      }));
    }
  }
  return out;
}
function yatraCalendarItems(body, source, fromCity, toCity, fromCode, toCode, depIso) {
  let root;
  try {
    root = JSON.parse(body);
  } catch {
    return [];
  }
  if (typeof root === "string") {
    try {
      root = JSON.parse(root);
    } catch {
      return [];
    }
  }
  const day = root?.day;
  if (!day || typeof day !== "object") return [];
  const exact = day[depIso];
  let targetKey = null;
  if (exact && exact.af && Object.keys(exact.af).length) targetKey = depIso;
  else {
    const upcoming = Object.keys(day).filter((k) => k > depIso).sort();
    for (const k of upcoming) {
      if (day[k]?.af && Object.keys(day[k].af).length) {
        targetKey = k;
        break;
      }
    }
  }
  if (!targetKey) return [];
  const dateLabel = targetKey === depIso ? `on ${targetKey}` : `(cheapest upcoming, ${targetKey})`;
  const srp = yatraSrpUrl3(fromCode, toCode, targetKey);
  const items = [];
  for (const [code, af] of Object.entries(day[targetKey].af)) {
    const price = Number(af?.tf);
    if (!Number.isFinite(price) || price <= 0) continue;
    const ow = Array.isArray(af.ow) ? af.ow[0] : null;
    const name = String(ow?.an || EMT_AIRLINES[code]?.name || code);
    const fl = String(ow?.fl || "");
    const depT = String(ow?.ddt || "").slice(11, 16);
    const arrT = String(ow?.adt || "").slice(11, 16);
    items.push(newRawItem(source, {
      title: `${name} ${code}${fl ? `-${fl}` : ""} ${fromCity} \u2192 ${toCity} ${dateLabel} from \u20B9${Math.round(price)}`.slice(0, 200),
      brand: name,
      price: Math.round(price),
      currency: "INR",
      seller: "Yatra",
      sellerUrl: srp,
      travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: targetKey },
      attributes: {
        airline: name,
        flight_number: `${code}${fl}`,
        ...depT ? { departure: depT } : {},
        ...arrT ? { arrival: arrT } : {},
        fare_class: `lowest ${name} fare on Yatra's fare calendar for this route`,
        price_basis: `Yatra lowest-fare calendar value on ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`,
        data_note: `Fare acquired from Yatra's official fare calendar on ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}; booking continues on Yatra's own website.`,
        image: ""
      },
      identifiers: { sku: `yatra-cal-${fromCode}-${toCode}-${targetKey}-${code}` },
      evidence: {
        sourceUrl: yatraCalendarUrl(fromCode, toCode, targetKey, targetKey),
        extractedFields: ["day[][].af[].tf (INR)", "day[][].af[].ow[].fl/ddt/adt"]
      }
    }));
  }
  return items;
}
var YATRA_API, YATRA_SUPPLIERS;
var init_yatraFlights = __esm({
  "server/workers/parsers/yatraFlights.ts"() {
    init_contract();
    init_emtFareCalendar();
    YATRA_API = "https://flight.yatra.com";
    YATRA_SUPPLIERS = ["QPAPI", "6EAPI", "AIRASIAAPI", "1AWS4", "SGAPI"];
  }
});

// server/workers/parsers/goibiboFlights.ts
function goibiboRouteUrl(fromCity, toCity) {
  const slug2 = (c) => {
    const k = String(c).toLowerCase().trim().replace(/\s*\([^)]*\)/g, "").trim();
    return (SLUG_ALIASES[k] || k).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  };
  return `https://www.goibibo.com/flights/${slug2(fromCity)}-to-${slug2(toCity)}-flights/`;
}
function stripTags(s) {
  return String(s).replace(/<[^>]*>/g, "").trim();
}
function parseGoibiboSsr(html, source, pageUrl, fromCity, toCity) {
  let root = null;
  const m = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (m) {
    try {
      root = JSON.parse(m[1]);
    } catch {
      root = null;
    }
  }
  if (!root) {
    for (const s of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
      const b = s[1];
      if (b.includes('"journeyMap"') && b.trim().startsWith("{")) {
        try {
          root = JSON.parse(b);
          break;
        } catch {
        }
      }
    }
  }
  const listing = root?.props?.pageProps?.data?.state?.listing;
  if (!listing) return [];
  const itin = String(listing?.flightSearchParams?.itinerary || "");
  const dm = itin.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const fareDate = dm ? `${dm[3]}-${dm[2]}-${dm[1]}` : "";
  const jm = listing?.journeyMap?.data || {};
  const groups = listing?.journeys?.allJourneys;
  if (!Array.isArray(groups) || !groups.length) return [];
  const journeys = Array.isArray(groups[0]) ? groups[0] : [];
  const out = [];
  for (const j of journeys) {
    const price = Number(j.fare);
    if (!Number.isFinite(price) || price <= 0) continue;
    const keys = Array.isArray(j.journeyKeys) ? j.journeyKeys : [];
    if (!keys.length) continue;
    const legs = String(keys[0]).split("|");
    const firstKey = legs[0];
    const lastKey = legs[legs.length - 1];
    const firstSeg = jm[firstKey];
    const lastSeg = jm[lastKey];
    if (!firstSeg) continue;
    const stops = legs.length - 1;
    const name = stripTags(String(j.simpleAirlineHeading?.nm || "")) || EMT_AIRLINES[String(j.airlineCodes?.[0] || "")]?.name || "Flight";
    const flightNo2 = stripTags(String(j.flightNumber || j.simpleAirlineHeading?.cd || "")).slice(0, 40);
    const depT = String(firstSeg.depTime || "");
    const arrT = String(lastSeg?.arrTime || "");
    const routeLabel = `${fromCity} \u2192 ${toCity}`;
    const dateLabel = fareDate ? `on ${fareDate}` : "";
    out.push(newRawItem(source, {
      title: `${name} ${flightNo2} ${routeLabel} ${stops ? `(${stops} stop${stops > 1 ? "s" : ""})` : "non-stop"} ${dateLabel}`.slice(0, 200),
      brand: name,
      price: Math.round(price),
      currency: "INR",
      seller: "Goibibo",
      sellerUrl: pageUrl,
      travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: fareDate },
      attributes: {
        airline: name,
        flight_number: flightNo2,
        ...depT ? { departure: depT } : {},
        ...arrT ? { arrival: arrT } : {},
        stops: String(stops),
        origin: String(firstSeg.depCityCd || ""),
        destination: String(lastSeg?.arrCityCd || ""),
        ...firstSeg.duration ? { duration: `${firstSeg.duration.h || "00"}h ${firstSeg.duration.m || "00"}m` } : {},
        price_basis: `total Goibibo fare for 1 adult from Goibibo's own route-page listing on ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`,
        data_note: `Fare acquired from Goibibo's server-rendered route page on ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}${fareDate ? ` for its service date ${fareDate}` : ""}; booking continues on Goibibo's own website.`,
        image: ""
      },
      identifiers: { sku: `gi-${keys[0]}`.replace(/[^A-Za-z0-9$|.:-]/g, "-") },
      evidence: {
        sourceUrl: pageUrl,
        extractedFields: ["listing.journeys.allJourneys[].fare (INR)", "simpleAirlineHeading.nm", "journeyKeys", "journeyMap.data[].depTime/arrTime/stops"]
      }
    }));
  }
  return out;
}
var SLUG_ALIASES;
var init_goibiboFlights = __esm({
  "server/workers/parsers/goibiboFlights.ts"() {
    init_contract();
    init_emtFareCalendar();
    SLUG_ALIASES = {
      "new delhi": "delhi",
      delhi: "delhi",
      mumbai: "mumbai",
      bengaluru: "bangalore",
      bangalore: "bangalore",
      mysuru: "mysore",
      mysore: "mysore",
      gurgaon: "gurugram",
      gurugram: "gurugram",
      "kolkata": "kolkata",
      chennai: "chennai",
      hyderabad: "hyderabad",
      pune: "pune",
      goa: "goa",
      panaji: "goa",
      jaipur: "jaipur",
      ahmedabad: "ahmedabad",
      lucknow: "lucknow",
      indore: "indore",
      bhopal: "bhopal",
      nagpur: "nagpur",
      patna: "patna",
      guwahati: "guwahati",
      kochi: "kochi",
      coimbatore: "coimbatore",
      chandigarh: "chandigarh",
      varanasi: "varanasi",
      srinagar: "srinagar",
      dehradun: "dehradun",
      amritsar: "amritsar",
      udaipur: "udaipur",
      jodhpur: "jodhpur",
      trivandrum: "trivandrum",
      thiruvananthapuram: "trivandrum",
      vizag: "vizag",
      visakhapatnam: "vizag",
      surat: "surat",
      vadodara: "vadodara",
      rajkot: "rajkot",
      ranchi: "ranchi",
      bhubaneswar: "bhubaneswar",
      imphal: "imphal",
      agartala: "agartala"
    };
  }
});

// server/workers/parsers/mmtFareCalendar.ts
function mmtFareCalendarUrl(fromCode, toCode, depCompact) {
  return `https://flights-cb.makemytrip.com/api/fareCalendar?apiCallTimestamp=${Date.now()}&crId=${mmtCrid()}&it=${fromCode}-${toCode}-${depCompact}&tripType=O&pfm=DESKTOP&src=desktop&region=in&cur=INR&currency=INR&language=eng&pax=A-1_C-0_I-0&cc=E&cmpId=&dfs=0&forwardFlowRequired=true&shd=true&sortBy=rhino`;
}
function mmtCrid() {
  return "94338e88-73de-4bc6-b77c-b1baf7fdb58f";
}
function mmtCalendarHeaders(fromCode, toCode, depCompact) {
  const did = mmtCrid();
  return {
    Accept: "application/json",
    "app-ver": "1.0.0",
    "device-id": did,
    "entity-name": "india",
    os: "Windows",
    domain: "in",
    "user-country": "IN",
    currency: "INR",
    mcid: did,
    region: "in",
    pfm: "DESKTOP",
    src: "desktop",
    "profile-type": "b2c",
    Origin: "https://www.makemytrip.com",
    Referer: `https://www.makemytrip.com/flight/search?itinerary=${fromCode}-${toCode}-${depCompact}`
  };
}
function keyToIso(key) {
  if (!/^\d{6}$/.test(key)) return null;
  const dd = Number(key.slice(0, 2));
  const mm = Number(key.slice(2, 4));
  const yy = Number(key.slice(4, 6));
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return null;
  const year = 2e3 + yy;
  const iso = `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const check = /* @__PURE__ */ new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(check.getTime()) || check.getUTCDate() !== dd || check.getUTCMonth() !== mm - 1) return null;
  return iso;
}
function parseMmtFareCalendar(body) {
  let d;
  try {
    d = JSON.parse(body);
  } catch {
    return [];
  }
  const fares = d?.fares;
  if (!fares || typeof fares !== "object") return [];
  const out = [];
  for (const [key, fRaw] of Object.entries(fares)) {
    const dt = keyToIso(key);
    if (!dt) continue;
    const pr = Number(String(fRaw?.fr ?? "").replace(/[^\d.]/g, ""));
    if (!Number.isFinite(pr) || pr <= 0) continue;
    const airline = fRaw?.airlineInfo?.name ? String(fRaw.airlineInfo.name) : void 0;
    out.push({ dt, pr, airline, label: String(fRaw?.txt || "") });
  }
  return out;
}
function mmtSearchUrl(fromCode, toCode, depIso) {
  const [y, m, dd] = depIso.split("-");
  return `https://www.makemytrip.com/flight/search?itinerary=${fromCode}-${toCode}-${dd}/${m}/${y}&tripType=O&paxType=A-1_C-0_I-0&intl=false&cabinClass=E&lang=eng`;
}
function mmtDayFareItems(fares, source, fromCity, toCity, fromCode, toCode, depIso) {
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const exact = fares.find((f) => f.dt === depIso);
  const upcoming = [...fares].filter((f) => f.dt >= today2).sort((a, b) => a.pr - b.pr);
  const chosen = exact || upcoming[0];
  if (!chosen) return [];
  const isExact = Boolean(exact);
  const routeLabel = `${fromCity} \u2192 ${toCity}`;
  const airlineLabel = chosen.airline ? ` (${chosen.airline})` : "";
  return [newRawItem(source, {
    title: `MakeMyTrip ${routeLabel} ${isExact ? `on ${chosen.dt}` : `(cheapest upcoming, ${chosen.dt})`} from \u20B9${Math.round(chosen.pr)}${airlineLabel}`,
    brand: "MakeMyTrip",
    price: Math.round(chosen.pr),
    currency: "INR",
    seller: "MakeMyTrip",
    sellerUrl: mmtSearchUrl(fromCode, toCode, chosen.dt),
    travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: chosen.dt },
    attributes: {
      route: routeLabel,
      travel_date: chosen.dt,
      fare_class: chosen.airline ? `lowest economy fare on MakeMyTrip's calendar, flown by ${chosen.airline}` : "lowest economy fare on MakeMyTrip's fare calendar",
      price_basis: `lowest MakeMyTrip fare from the fare-calendar API on ${today2} for this route${isExact ? " and date" : " within the returned calendar window"}`,
      data_note: `Fare acquired from MakeMyTrip's fare calendar on ${today2} (date label "${chosen.label}"); booking continues on MakeMyTrip's own website.`,
      image: ""
    },
    identifiers: { sku: `mmt-${fromCode}-${toCode}-${chosen.dt}` },
    evidence: {
      sourceUrl: mmtFareCalendarUrl(fromCode, toCode, chosen.dt.replace(/-/g, "")),
      extractedFields: ["fares[].fr (INR)", "fares[].airlineInfo.name", "fares[].txt"]
    }
  })];
}
var init_mmtFareCalendar = __esm({
  "server/workers/parsers/mmtFareCalendar.ts"() {
    init_contract();
  }
});

// server/workers/parsers/cleartripFlights.ts
function cleartripSearchUrl(from, to, depDmy) {
  return `https://www.cleartrip.com/flight/search/v2?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&depart_date=${encodeURIComponent(depDmy)}&adults=1`;
}
function parseCleartripFlights(body, source, fromCity, toCity, depIso) {
  let d = null;
  try {
    d = JSON.parse(body);
  } catch {
    return [];
  }
  const cards = d?.cards?.J1;
  const subOptions = d?.subTravelOptions || {};
  const fares = d?.fares || {};
  if (!Array.isArray(cards) || !cards.length) return [];
  const out = [];
  for (const c of cards) {
    const s = c.summary || {};
    const legs = Array.isArray(s.flights) ? s.flights : [];
    if (!legs.length) continue;
    const airlineCode = String(legs[0].airlineCode || "");
    const flightNo2 = legs.map((l) => `${l.airlineCode || ""}${l.flightNumber || ""}`.trim()).join("/").slice(0, 40);
    const st = Array.isArray(c.subTravelOptionIds) ? subOptions[c.subTravelOptionIds[0]] : null;
    const fareId = st?.fareIds?.[0] || st?.cheapestFareId;
    const fare = fareId ? fares[fareId] : null;
    const price = Number(fare?.pricing?.totalPricing?.totalPrice);
    if (!Number.isFinite(price) || price <= 0) continue;
    const airlineName2 = EMT_AIRLINES[airlineCode]?.name || airlineCode || "Flight";
    const stops = Number(s.stops || 0);
    const depT = String(s.firstDeparture?.time || "").slice(11, 16);
    const arrT = String(s.lastArrival?.time || "").slice(11, 16);
    const dur = s.totalDuration ? `${String(s.totalDuration.hh || 0).padStart(2, "0")}h ${String(s.totalDuration.mm || 0).padStart(2, "0")}m` : "";
    const couponMsg = String(fare?.pricing?.totalPricing?.message || "").trim();
    const srpUrl = `https://www.cleartrip.com/flights/results?from=${s.firstDeparture?.airport?.code || ""}&to=${s.lastArrival?.airport?.code || ""}&depart_date=${depIso}&adults=1`;
    out.push(newRawItem(source, {
      title: `${airlineName2} ${flightNo2} ${fromCity} \u2192 ${toCity} ${stops ? `(${stops} stop${stops > 1 ? "s" : ""})` : "non-stop"}`.slice(0, 200),
      brand: airlineName2,
      price: Math.round(price),
      currency: "INR",
      seller: "Cleartrip",
      sellerUrl: srpUrl,
      travel: { route: `${fromCity.toLowerCase()} to ${toCity.toLowerCase()}`, date: depIso },
      attributes: {
        airline: airlineName2,
        flight_number: flightNo2,
        ...depT ? { departure: depT } : {},
        ...arrT ? { arrival: arrT } : {},
        stops: String(stops),
        origin: String(s.firstDeparture?.airport?.code || ""),
        destination: String(s.lastArrival?.airport?.code || ""),
        ...dur ? { duration: dur } : {},
        ...couponMsg ? { coupon: couponMsg } : {},
        price_basis: `total Cleartrip fare for 1 adult (base \u20B9${fare?.pricing?.totalPricing?.totalBaseFare ?? "?"} + tax \u20B9${fare?.pricing?.totalPricing?.totalTax ?? "?"}) from Cleartrip's own search API on ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`,
        data_note: `Fare acquired from Cleartrip's flight search API on ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}${couponMsg ? `; active Cleartrip coupon: ${couponMsg}` : ""}; booking continues on Cleartrip's own website.`,
        image: ""
      },
      identifiers: { sku: String(c.travelOptionId || flightNo2).slice(0, 120) },
      evidence: {
        sourceUrl: cleartripSearchUrl(s.firstDeparture?.airport?.code || "", s.lastArrival?.airport?.code || "", depIso.split("-").reverse().join("/")),
        extractedFields: ["cards.J1[].summary", "subTravelOptions[].fareIds[0]", "fares[].pricing.totalPricing.totalPrice (INR)"]
      }
    }));
  }
  return out;
}
var init_cleartripFlights = __esm({
  "server/workers/parsers/cleartripFlights.ts"() {
    init_contract();
    init_emtFareCalendar();
  }
});

// server/workers/parsers/expediaFlightsQuery.ts
var EXPEDIA_FLIGHTS_QUERY;
var init_expediaFlightsQuery = __esm({
  "server/workers/parsers/expediaFlightsQuery.ts"() {
    EXPEDIA_FLIGHTS_QUERY = `query FlightsSearchResultsLoadedQuery($context: ContextInput!, $flightsSearchContext: FlightsSearchContextInput, $journeyCriteria: [FlightsJourneyCriteriaInput!]!, $travelerDetails: [FlightsTravelerDetailsInput!], $searchFilterValuesList: [FlightsSearchFilterValuesInput!], $sortOption: FlightsSortOptionTypeInput, $queryState: FlightsQueryState, $searchPreferences: FlightsSearchPreferencesInput, $searchPagination: PaginationInput, $flightsSearchComponentCriteria: FlightsSearchComponentCriteriaInput, $shoppingContext: ShoppingContextInput, $faresSeparationType: FlightsFaresSeparationType, $rewardsOption: RewardsOption, $fareCalendarPrice: String, $flightsDisplayComponentValues: FlightsDisplayComponentValuesInput, $virtualAgentContext: VirtualAgentContextInput, $progressiveRenderingInput: FlightsProgressiveRenderingInput, $insuranceCriteria: InsuranceCriteriaInput) { flightsSearch(context: $context, flightsSearchContext: $flightsSearchContext, journeyCriteria: $journeyCriteria, travelerDetails: $travelerDetails, searchFilterValuesList: $searchFilterValuesList, sortOption: $sortOption, queryState: $queryState, searchPreferences: $searchPreferences, searchPagination: $searchPagination, flightsSearchComponentCriteria: $flightsSearchComponentCriteria, shoppingContext: $shoppingContext, faresSeparationType: $faresSeparationType, rewardsOption: $rewardsOption, fareCalendarPrice: $fareCalendarPrice, flightsDisplayComponentValues: $flightsDisplayComponentValues, virtualAgentContext: $virtualAgentContext, progressiveRenderingInput: $progressiveRenderingInput, insuranceCriteria: $insuranceCriteria) { flightsSheets { ...FlightsSheetTypeFragment } dialogs { ...FlightsDialogPresentationFragment } listingResult { ...FlightsLoadedListingResultFragment } clientMetadata { ...FlightsPWAMetadataFragment } noListingMessaging { ...FlightsErrorMessagingPresentationFragment } ...FlightsSearchLegacyFieldsFragment } }

fragment FlightsSheetTypeFragment on FlightsSheetType {
    id
    initialState
    displayAnalytics {
      ...ClientSideAnalyticsFragment
    }
    egcsDisplayAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    egcsCloseAnalytics
    title {
      ...EGDSHeadingFragment
    }
    sheet {
      ...EGDSSheetFragment
    }
    content {
      ...FlightsSheetInfoContentFragment
      ...FlightsSheetActionContentFragment
      ...FlightsSheetMessageContentFragment
      ...FlightsAncillaryRecommendationsContentFragment
      ...FlightsSheetRadioContentFragment
    }
  }

fragment FlightsDialogPresentationFragment on FlightsDialogPresentation {
    actions {
      ...FlightsActionFragment
    }
    animation
    displayedAnalytics {
      ...FlightsAnalyticsFragment
    }
    header
    message
    title
    ... on FlightsDialogStaleSession {
      timeoutInSeconds
    }
    ...FlightsForcedChoiceCrossSellDialogFragment
  }

fragment FlightsLoadedListingResultFragment on FlightsLoadedListingResult {
    toasts {
      ...EGDSToastFragment
    }
    changeForAnyReasonWarningBanner {
      ...FlightsBannerPlacardsFragment
    }
    listings {
      ...FlightsStandardOfferFragment
      ...FlightsCreditsAvailableListingFragment
      ...FlightsCrossSellMessageFragment
      ...FlightsCrossSellOfferFragment
      ...FlightsListingMessagingCardFragment
      ...FlightsSponsoredContentAdListingFragment
      ...FlightsHeaderListingFragment
      ...FlightsBargainFareOfferFragment
      ...FlightsCarryOverFiltersCardFragment
      ...FlightsInsurtechPrimingCardListingFragment
      ...FlightsFuzzyFilterCardFragment
      ... on FlightsQuickFiltersContainerListing {
        _noop
      }
      ...FlightsManagedBannerListingFragment
    }
    flightsListingsAnalytics {
      pinnedListingDisplayedAnalytics {
        ...FlightsAnalyticsFragment
      }
      bestSortDisplayedAnalytics {
        ...FlightsAnalyticsFragment
      }
      fareUpsellPercentageAnalytics {
        ...FlightsAnalyticsFragment
      }
      nonstopSectionDisplayedAnalytics {
        ...FlightsAnalyticsFragment
      }
      urgencyMessageAnalytics {
        ...FlightsAnalyticsFragment
      }
      moreListingsDisplayedAnalytics {
        ...FlightsAnalyticsFragment
      }
      onViewedAnalyticsList {
        ...FlightsAnalyticsFragment
      }
      sponsoredUpsellAvailableAnalytics {
        ...ClientSideAnalyticsFragment
      }
      fareCalendarAnalytics {
        ...FlightsAnalyticsFragment
      }
    }
    flightsListingsEGCSAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    moreListingsAvailable
    listingsAction {
      ...FlightsActionFragment
    }
    appliedSortingAccessibility
    appliedFilterAccessibility
    showMoreListingLoadedAccessibilityMessage
    pinnedListingUnavailableMessage
    flightsLoadedListingsStatus
    progressiveRenderingListingsStatus
  }

fragment FlightsPWAMetadataFragment on FlightsPWAMetadata {
    evaluatedExperiments {
      bucket
      id
    }
    pageNameAnalytics {
      ...FlightsAnalyticsFragment
    }
    pageName
    responseMetrics {
      name
      value
    }
    responseTags
  }

fragment FlightsErrorMessagingPresentationFragment on FlightsErrorMessagingPresentation {
    icon {
      ...IconFragments
    }
    message
    title
    egcsDisplayAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    ...FlightsActionableErrorMessagingFragment
    ...FlightsNoFlightsFoundWithFilterMessagingFragment
    ...FlightsNoFlightsFoundMessagingFragment
    ...FlightsSmartNoFlightsFoundMessagingFragment
  }

fragment FlightsSearchLegacyFieldsFragment on FlightsSearchResponse {
    sortAndFilterResult {
      __typename
    }
    rewardsPricingInfo {
      title {
        __typename
        longMessage
        shortMessage
      }
      options {
        ... on FlightsRewardsOption {
          label
          identifier
          selected
          accessibility {
            ... on FlightsAccessibilityMessage {
              usage
              onCompletion
            }
          }
        }
      }
      rewardsBanner {
        ...FlightsCollapsiblePlacard
      }
      subText {
        completeText
        delimeter
        items {
          __typename
          styles
          text
          ... on FlightsPhraseLinkNode {
            accessibility
            analytics {
              ...FlightsAnalyticsFragment
            }
            icon
            link
          }
          ... on FlightsPhraseDialogNode {
            dialog {
              __typename
              title
              message
              animation
              actions {
                ...FlightsActionFragment
              }
              displayedAnalytics {
                ...FlightsAnalyticsFragment
              }
            }
            actionableIcon {
              ... on Icon {
                id
                description
                token
              }
            }
          }
        }
      }
      loyaltyBanners {
        ...FlightsIconPlacard
        ...FlightsImagePlacard
        ...FlightsCollapsiblePlacard
      }
    }
    pointsToggle {
      checked
      checkedAccessibilityLabel
      checkedAnalytics {
        ...ClientSideAnalytics
      }
      checkedDescription
      checkedLabel
      enabled
      uncheckedAccessibilityLabel
      uncheckedAnalytics {
        ...ClientSideAnalytics
      }
      uncheckedDescription
      uncheckedLabel
      ... on FlightsSwitchToggle {
        impressionAnalytics
        checkedInteractionAnalytics
        uncheckedInteractionAnalytics
      }
    }
    pageTitle {
      date {
        longMessage
        shortMessage
      }
      disclaimerSubTitle {
        ...FlightsPhraseFragment
        size
      }
      title {
        longMessage
        shortMessage
      }
    }
    allBanners {
      ...FlightsIconPlacard
    }
    cheapestListingInfo {
      price
      analytics {
        ...FlightsAnalyticsFragment
      }
      nffAnalytics {
        ...FlightsAnalyticsFragment
      }
      deviationAnalytics {
        ...FlightsAnalyticsFragment
      }
    }
    gaiaId
    stepIndicator {
      errorAnalytics {
        ...FlightsAnalyticsFragment
      }
      journeyContinuationId
    }
    shoppingContext {
      multiItem {
        id
        packageType
      }
    }
    listingsHeaderPlacards {
      ...FlightsMessagingCardPlacardsFragment
    }
  }

fragment ClientSideAnalyticsFragment on ClientSideAnalytics {
    linkName
    referrerId
  }

fragment FlightsClickStreamAnalyticsFragment on FlightsClickStreamAnalytics {
  event {
    ...EGAnalyticsTrackingFragment
  }
  payload
}

fragment EGDSHeadingFragment on EGDSHeading {
  __typename
  text
  headingType
}

fragment EGDSSheetFragment on EGDSSheet {
  closeAccessibility
  closeAnalytics {
    ...ClientSideAnalytics
  }
  closeText
  sheetTypes {
    ...EGDSSheetTypePerViewSizeFragment
  }
}

fragment FlightsSheetInfoContentFragment on FlightsSheetInfoContent {
  heading {
    ...EGDSHeadingFragment
  }
  message {
    ...EGDSParagraphFragment
  }
}

fragment FlightsSheetActionContentFragment on FlightsSheetActionContent {
  graphic {
    ...UIGraphicFragment
  }
  heading {
    ...EGDSHeadingFragment
  }
  message {
    ...EGDSParagraphFragment
  }
  primaryButton {
    ...FlightsExperienceActionButtonFragment
  }
}

fragment FlightsSheetMessageContentFragment on FlightsSheetMessageContent {
    flightPills {
      ...FlightsPillFragment
    }
    content {
      ...FlightsMessageContentSuccessFragment
      ...FlightsMessageContentFailureFragment
    }
  }

fragment FlightsAncillaryRecommendationsContentFragment on FlightsAncillaryRecommendationsContent {
    subHeading
    contentList {
      ...EGDSTextIconListFragment
    }
    ancillaryPriceAndInfoSection {
      recommendedItems {
        ...EGDSSpannableTextFragment
      }
      totalPrice {
        primaryText {
          ...EGDSSpannableTextFragment
        }
        secondaryText {
          ...EGDSSpannableTextFragment
        }
        accessibilityInfo
      }
    }
    actionButtons: footer {
      ...FlightsExperienceActionButtonFragment
    }
  }

fragment FlightsSheetRadioContentFragment on FlightsSheetRadioContent {
    radioGroup {
      ...FlightsBaggageRadioButtonGroupFragment
    }
  }

fragment FlightsActionFragment on FlightsAction {
    analyticsList {
      linkName
      referrerId
    }
    displayType
    relativeURI {
      relativePath
    }
    displayAnalytics {
      linkName
      referrerId
    }
    clientSideAnalyticsList {
      ...ClientSideAnalyticsFragment
    }
    egcsOnClickAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    onClickAnalytics
    type
    enable
    disabledAccessibilityHint
    ...FlightActionContentFragment
  }

fragment FlightsAnalyticsFragment on FlightsAnalytics {
  __typename
  linkName
  referrerId
}

fragment FlightsForcedChoiceCrossSellDialogFragment on FlightsForcedChoiceCrossSellDialog {
    annotation {
      completeText
      accessibility
      items {
        styles
        text
        ...FlightsPhraseLinkNodeFragment
      }
    }
    checkInDate {
      ...FlightsSearchFormDateFieldFragment
    }
    checkOutDate {
      ...FlightsSearchFormDateFieldFragment
    }
    displayBlockedAnalytics {
      ...FlightsAnalyticsFragment
    }
    displayCounter
    hotelDatesTitle
    messageBody {
      ...EGDSTextFragment
    }
    recommendedHotels {
      ...FlightsForcedChoiceCrossSellLodgingCardFragment
    }
    recommendedCars {
      card {
        ...EGDSImageLinkCardFragment
      }
    }
    themeProvider {
      lightMode {
        themeProviderColor
      }
    }
  }

fragment EGDSToastFragment on EGDSToast {
    text
    actionText
    action {
      ...ActionFragment
    }
  }

fragment FlightsBannerPlacardsFragment on FlightsBannerPlacard {
    banner {
      actions {
        ...ActionFragment
      }
      icon {
        ...IconFragments
      }
      egdsElementId
      fullWidth
      heading
      message
      theme
    }
    onViewedAnalyticsList {
      ...ClientSideAnalyticsFragment
    }
    onViewedEgcsAnalytics
  }

fragment FlightsStandardOfferFragment on FlightsStandardOffer {
    pinnedOfferMessage
    badgesList {
      ...EGDSBadgeFragment
    }
    flightsShoppingOfferContent {
      ...FlightsShoppingOfferContentFragment
    }
    journeys {
      adjustedStayDatesMessage {
        ...AdjustedStayDatesMessageFragment
      }
      positiveHighlightsMessage
      urgencyMessage
      urgencyAccessibilityMessage
      detailsAndFares {
        ...FlightsDetailsAndFaresPresentationFragment
      }
      trigger {
        ...FlightsExperienceDialogTriggerFragment
      }
      triggerList {
        ...FlightsExperienceDialogTriggerFragment
      }
      dialogSheet {
        ...FlightsDialogSheetFragment
      }
      triggerDelimiter {
        ...EGDSStylizedTextFragment
      }
    }
    selectOfferAction {
      type
    }
    pricingInformation {
      partnerLoyaltyEarnMessage {
        ...FlightsMarkAndLabelFragment
      }
    }
    secondaryBadges {
      ...EGDSBadgeFragment
    }
    priceDisplay {
      ...FlightsPriceDisplayFragment
    }
    farePriceDisplayButtons {
      ...FlightsFarePriceDisplayButtonFragment
    }
    sponsoredAirline {
      ...FlightsOfferSponsoredAirlineFragment
    }
    sponsoredUpsell {
      ...FlightsOfferSponsoredUpsellFragment
    }
    stepIndicatorJcid
    offerInfoLink {
      ...OfferInfoLinkFragment
    }
    flightsOfferAnalytics {
      onViewedAnalyticsList {
        ...FlightsPhraseAnalyticsFragment
      }
    }
    onClickAnalyticsList {
      ...FlightsPhraseAnalyticsFragment
    }
    egcsDisplayAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    egcsClickAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
  }

fragment FlightsCreditsAvailableListingFragment on FlightsCreditsAvailableListing {
    toastNotification {
      ...EGDSToastFragment
    }
    messagingCardPlacard {
      ...FlightsMessagingCardPlacardsFragment
      button {
        ...FlightsActionButtonFragment
      }
    }
  }

fragment FlightsCrossSellMessageFragment on FlightsCrossSellMessage {
    multiItemFlightCrossSellPrimer {
      ...MultiItemFlightCrossSellPrimerFragment
    }
  }

fragment FlightsCrossSellOfferFragment on FlightsCrossSellOffer {
    multiItemFlightCrossSellOfferPrimer {
      multiItemSearchContext {
        ...MultiItemSearchContextFragment
      }
      multiItemPackageableProduct {
        ...MultiItemPackageableProductFragment
      }
      brandedDealFallBack {
        ...MultiItemFlightCrossSellPrimerFragment
      }
      multiItemPricedPackageableProducts {
        ...MultiItemPricedPackageableProductFragment
      }
      price {
        base {
          amount
        }
        taxesAndFees {
          amount
        }
      }
    }
  }

fragment FlightsListingMessagingCardFragment on FlightsListingMessagingCard {
    messagingCard {
      ...FlightsMessagingCardPlacardsFragment
    }
  }

fragment FlightsSponsoredContentAdListingFragment on FlightsSponsoredContentAdListing {
    sponsoredContentPlacement {
      ...SponsoredContentPlacementFragment
    }
  }

fragment FlightsHeaderListingFragment on FlightsHeaderListing {
    headingSize
    heading
    subHeading
    contents {
      ...EGDSSpannableTextFragment
    }
    items {
      ...EGDSSpannableTextFragment
      ...FlightsHeaderWithInlineDialogTriggerFragment
      ... on FlightsHeaderLoadingLineItem {
        loadingStatus
        loadingText: text {
          ...EGDSSpannableTextFragment
        }
      }
    }
  }

fragment FlightsBargainFareOfferFragment on FlightsBargainFareOffer {
    accessibilityHeading
    accessibilityMessage
    priceDisplay {
      ...FlightsPriceDisplayFragment
    }
    description {
      completeText
    }
    graphic {
      ...UIGraphicFragment
    }
    header {
      completeText
    }
    journeyContinuationId
    journeys {
      detailsAndFares {
        ...FlightsDetailsAndFaresPresentationFragment
      }
    }
    selectOfferAction {
      type
    }
    onClickAnalyticsList {
      linkName
      referrerId
    }
    stepIndicatorJcid
    egcsDisplayAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    egcsClickAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
  }

fragment FlightsCarryOverFiltersCardFragment on FlightsCarryOverFiltersCard {
    actionElement {
      ...FlightsActionLinkFragment
    }
    displayAnalytics {
      ...ClientSideAnalyticsFragment
    }
    icon {
      ...IconFragments
    }
    message
  }

fragment FlightsInsurtechPrimingCardListingFragment on InsurtechPrimingCardListing {
    insurtechSearchCriteria {
      ...InsurtechSearchCriteriaFragment
    }
    placement {
      placementContext {
        lob
        packageType
        path
        placement
      }
    }
  }

fragment FlightsFuzzyFilterCardFragment on FlightsFuzzyFilterCard {
    image {
      ...UIGraphicFragment
    }
    heading
    fuzzyFilterMessage: message
    clearFiltersAction {
      ...FlightsActionFragment
    }
    egcsDisplayAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    selectedFilterPills {
      ...AppliedFilterFragment
    }
  }

fragment FlightsManagedBannerListingFragment on FlightsManagedBannerListing {
    _noop
  }

fragment IconFragments on Icon {
    description
    id
    size
    theme
    title
    withBackground
    spotLight
  }

fragment FlightsActionableErrorMessagingFragment on FlightsActionableErrorMessaging {
    action {
      ...FlightsActionFragment
    }
    errorRecoveryButtons {
      ...FlightsActionFragment
    }
    subMessage
  }

fragment FlightsNoFlightsFoundWithFilterMessagingFragment on FlightsNoFlightsFoundWithFilterMessaging {
    clearFiltersAction {
      ...FlightsActionFragment
    }
  }

fragment FlightsNoFlightsFoundMessagingFragment on FlightsNoFlightsFoundMessaging {
    FlightsNoFlightsFoundMessagingAction: action {
      ...FlightsExperienceActionButtonFragment
    }
  }

fragment FlightsSmartNoFlightsFoundMessagingFragment on FlightsSmartNoFlightsFoundMessaging {
    alternateAirportOptions {
      ...AlternateAirportOptionsFragment
    }
    alternateDateOptions {
      ...AlternateDateOptionsFragment
    }
    editSearchButton {
      ...FlightsActionFragment
    }
    flightsDisplayComponentCountingValue {
      displayCount
      flightsDisplayComponent
    }
  }

fragment FlightsCollapsiblePlacard on FlightsCollapsiblePlacard {
  __typename
  heading
  message
  backgroundTheme
  graphic {
    ...UIGraphicFragment
  }
  messageWithMoreInfo {
    ...FlightsPointsMoreInfoLink
  }
  actions {
    ...FlightAction
  }
  onViewedAnalytics {
    ...FlightsAnalytics
  }
  onViewedAnalyticsList {
    ...ClientSideAnalytics
  }
}

fragment FlightsIconPlacard on FlightsIconPlacard {
  __typename
  heading
  message
  icon {
    description
    id
    size
    withBackground
  }
  actions {
    ...FlightAction
  }
  displayType
  backgroundTheme
}

fragment FlightsImagePlacard on FlightsImagePlacard {
  __typename
  heading
  message
  image {
    description
    url
  }
  actions {
    ...FlightAction
  }
  displayType
  backgroundTheme
}

fragment ClientSideAnalytics on ClientSideAnalytics {
  linkName
  referrerId
  uisPrimeMessages {
    messageContent
    schemaName
  }
}

fragment FlightsPhraseFragment on FlightsPhrase {
    accessibility
    completeText
    items {
      ...FlightsPhrasePartFragment
    }
  }

fragment FlightsMessagingCardPlacardsFragment on FlightsMessagingCardPlacard {
    actionElement {
      ...FlightsActionLinkFragment
    }
    backgroundTheme
    messagingCard {
      primary
      secondaries
      graphic {
        ...UIGraphicFragment
      }
      egdsElementId
    }
    flightsMessagingCard {
      header {
        ...EGDSSpannableTextFragment
      }
      contents {
        ...EGDSSpannableTextFragment
      }
      graphic {
        ...UIGraphicFragment
      }
    }
    actionPosition
    onViewedAnalyticsList {
      ...ClientSideAnalyticsFragment
    }
    onViewedEgcsAnalytics
  }

fragment EGAnalyticsTrackingFragment on EGClickstreamEvent {
  eventCategory
  eventName
  eventType
  eventVersion
  actionLocation
}

fragment EGDSSheetTypePerViewSizeFragment on EGDSSheetTypePerViewSize {
  sheetType
  viewSize
}

fragment EGDSParagraphFragment on EGDSParagraph {
  __typename
  text
  style
}

fragment UIGraphicFragment on UIGraphic {
  ...IconSearch
  ...MarkFragments
  ...EgdsGraphicIllustrationFragmentSearch
}

fragment FlightsExperienceActionButtonFragment on FlightsExperienceActionButton {
  __typename
  accessibility
  clientAction {
    __typename
    accessibility
    analyticsList {
      ...ClientSideAnalytics
    }
    ...FlightsSelectionAction
  }
  primary
}

fragment FlightsPillFragment on FlightsPill {
    actionAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    displayAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    pill {
      ...EGDSPillFragment
    }
  }

fragment FlightsMessageContentSuccessFragment on FlightsMessageContentSuccess {
    contentId
    additionalInformation {
      ...FlightsContentBlockFragment
    }
    egcsAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    infoCards {
      ...EGDSStandardMessagingCardFragment
    }
    messageCardContent {
      ...FlightsMessageCardContentFragment
    }
  }

fragment FlightsMessageContentFailureFragment on FlightsMessageContentFailure {
    contentId
    errors {
      ...FlightErrorMessagingPresentationFragment
    }
    egcsAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
  }

fragment EGDSTextIconListFragment on EGDSTextIconList {
    listItems {
      text
      icon {
        ...IconFragments
      }
    }
    textListSize: size
  }

fragment EGDSSpannableTextFragment on EGDSSpannableText {
  __typename
  text
  contents {
    __typename
    ... on EGDSHeading {
      text
      headingType
    }
    ... on EGDSParagraph {
      ...EGDSParagraphFragment
    }
    ... on EGDSIconText {
      text
      icon {
        id
        size
        theme
      }
    }
    ... on EGDSStandardLink {
      text
      size
      standardLinkIcon: icon {
        ...IconFragment
      }
      iconPosition
      action {
        __typename
        accessibility
        target
        resource {
          __typename
          value
        }
        analytics {
          __typename
          linkName
          referrerId
        }
      }
    }
    ... on EGDSPlainText {
      text
    }
    ... on EGDSStylizedText {
      decorative
      text
      theme
      weight
      stylizedSize: size
    }
  }
  inlineContent {
    __typename
    ... on EGDSHeading {
      text
      headingType
    }
    ... on EGDSGraphicText {
      ...EGDSGraphicTextFragment
    }
    ... on EGDSInlineLink {
      ...EGDSInlineLinkFragment
    }
    ... on EGDSStandardLink {
      text
      size
      standardLinkIcon: icon {
        ...IconFragment
      }
      iconPosition
      action {
        __typename
        accessibility
        target
        resource {
          __typename
          value
        }
        analytics {
          __typename
          linkName
          referrerId
        }
      }
    }
    ... on EGDSPlainText {
      text
    }
    ... on EGDSStylizedText {
      decorative
      text
      theme
      weight
      stylizedSize: size
    }
  }
}

fragment FlightsBaggageRadioButtonGroupFragment on FlightsBaggageRadioButtonGroup {
    baggageRadioButtons {
      ...FlightsBaggageRadioButtonFragment
    }
    errorMessage
    groupName
    label
    selected
    options {
      ...EGDSBasicRadioButtonFragment
    }
  }

fragment FlightActionContentFragment on FlightsAction {
    flightsActionContentA11yMessage: accessibilityMessage
    displayAction
  }

fragment FlightsPhraseLinkNodeFragment on FlightsPhraseLinkNode {
    accessibility
    analytics {
      ...FlightsPhraseAnalyticsFragment
    }
    displayAnalytics {
      ...FlightsPhraseAnalyticsFragment
    }
    scrollAnalytics {
      ...FlightsPhraseAnalyticsFragment
    }
    icon
    link
    styles
    text
  }

fragment FlightsSearchFormDateFieldFragment on FlightsSearchFormDateField {
    analytics {
      ...FlightsAnalyticsFragment
    }
    currentError
    date {
      day
      month
      year
      formatted(format: "d MMM uuuu")
      isoFormat
    }
    dateFormat
    daysBookableInAdvance
    label
    placeholder
    possibleErrors {
      analytics {
        ...FlightsAnalyticsFragment
      }
      message
      type
    }
    maxStayDurationAllowed
    possibleErrorsHeader {
      icon {
        id
        description
      }
      label {
        completeText
        items {
          styles
          text
        }
      }
    }
    doneAction
  }

fragment EGDSTextFragment on EGDSText {
    __typename
    ...EGDSHeadingFragment
    ...EGDSGraphicTextFragment
    ...EGDSSpannableTextFragment
    ...EGDSPlainTextFragment
    ...EGDSStylizedTextFragment
    ...EGDSIconTextFragment
    ...EGDSParagraphFragment
    ...EGDSStandardLinkFragment
    ...EGDSInlineLinkFragment
    ...EGDSTextStandardListItemFragment
  }

fragment FlightsForcedChoiceCrossSellLodgingCardFragment on FlightsForcedChoiceCrossSellLodgingCard {
    id
    header {
      heading
      messages {
        ... on EGDSPlainText {
          text
          accessibility
        }
      }
      amenities {
        ...EGDSGraphicTextFragment
      }
    }
    media {
      accessibilityHeadingText
      nextButtonText
      previousButtonText
      media {
        ... on FlightMediaItem {
          media {
            ... on Image {
              url
              description
            }
          }
        }
      }
    }
    summarySections {
      guestRatingSection {
        badge {
          text
          accessibility
          badgeTheme: theme
          badgeSize: size
        }
        phrases {
          accessibilityLabel
          phraseParts {
            ...EGDSStylizedTextFragment
          }
        }
      }
      amenities {
        ...EGDSGraphicTextFragment
      }
    }
    impressionAnalytics {
      linkName
      referrerId
      event
    }
    cardLink {
      resource {
        __typename
        value
      }
      analytics {
        linkName
        referrerId
      }
    }
  }

fragment EGDSImageLinkCardFragment on EGDSImageLinkCard {
    link {
      image {
        aspectRatio
        description
        url
      }
      action {
        ...UILinkActionFragment
      }
    }
  }

fragment ActionFragment on UILinkAction {
    accessibility
    analytics {
      linkName
      referrerId
    }
    resource {
      value
      ... on HttpURI {
        relativePath
      }
    }
    target
    useRelativePath
  }

fragment EGDSBadgeFragment on EGDSBadge {
  __typename
  accessibility
  text
  theme
  size
}

fragment FlightsShoppingOfferContentFragment on FlightsShoppingOfferContent {
    graphic {
      ...UIGraphicFragment
    }
    primarySection {
      ...FlightsShoppingPrimarySectionFragment
    }
    secondarySection {
      ...FlightsShoppingSecondarySectionFragment
    }
    tertiarySection {
      ...FlightShoppingCardTertiarySectionFragment
    }
    additionalMessageList {
      ...FlightsOfferAdditionalMessageFragment
    }
    additionalMessages {
      ...EGDSGraphicTextFragment
    }
  }

fragment AdjustedStayDatesMessageFragment on FlightsIconPhrases {
    icon {
      ...IconFragments
    }
    text {
      ...FlightsPhraseFragment
    }
  }

fragment FlightsDetailsAndFaresPresentationFragment on FlightsDetailsAndFaresPresentation {
  __typename
  content {
    ...FlightsDetailsAndFaresContentFragment
  }
  flightsFaresWrapper {
    ...FlightsDialogSheetFragment
  }
  footer {
    ...FlightsDetailsAndFaresFooterFragment
  }
  trigger {
    ...FlightsDialogTriggerFragment
  }
  sideSheetInformationText {
    ...TextWrapperFragment
  }
  airlineTabs {
    ...EGDSBasicTabsFragment
  }
}

fragment FlightsExperienceDialogTriggerFragment on FlightsExperienceDialogTrigger {
    dialogAction
    dialogId
    dynamicDialogId
    trigger {
      ...FlightsExperienceActionLinkFragment
      ...FlightsDialogTriggerTypeFragment
    }
  }

fragment FlightsDialogSheetFragment on FlightsDialogSheet {
  __typename
  dialog {
    ...FaresDialogsFragment
  }
  dialogId
  dynamicDialogId
  sheet {
    ...FlightsSideSheetFragment
  }
  sheetInfo {
    ...FlightsSheetFragment
  }
}

fragment EGDSStylizedTextFragment on EGDSStylizedText {
  decorative
  accessibility
  stylizedSize: size
  text
  theme
  weight
}

fragment FlightsMarkAndLabelFragment on FlightsMarkAndLabel {
    accessibility
    label
    subLabel
    mark {
      id
      description
    }
    stylisedText {
      ...EGDSSpannableTextFragment
    }
  }

fragment FlightsPriceDisplayFragment on FlightsPriceDisplay {
  rows {
    elements {
      ... on FlightsPriceMessageItem {
        price {
          ...EGDSStylizedTextFragment
        }
        disclaimer {
          ... on FlightsPricingDisclaimer {
            actionDialog {
              ... on EGDSActionDialog {
                footer {
                  buttons {
                    ...EGDSButtonFragment
                    ...UITertiaryButtonSearchFragment
                  }
                }
              }
            }
            triggerAnalytics {
              ... on FlightsClickStreamAnalytics {
                event {
                  ... on EGClickstreamEvent {
                    eventCategory
                    eventName
                    eventType
                    eventVersion
                    actionLocation
                  }
                }
                payload
              }
            }
            content
            accessibilityDialogTrigger
            dialogId
            graphicAlignment
            __typename
          }
        }
        __typename
      }
      ... on FlightsEnrichedMessageItem {
        value {
          ...EGDSStylizedTextFragment
        }
        leadingGraphic {
          ...UIGraphicFragment
        }
        __typename
      }
    }
  }
  alignment
  __typename
}

fragment FlightsFarePriceDisplayButtonFragment on FlightsFarePriceDisplayButton {
    action {
      accessibility
      analyticsList {
        ...ClientSideAnalyticsFragment
      }
      egcsAnalytics {
        ...FlightsClickStreamAnalyticsFragment
      }
      dialogAction
      dialogTriggerDialogId: dialogId
      dynamicDialogId
    }
    amenityStatusList {
      primaryIcon {
        ...IconFragment
      }
      availabilityStatus
      secondaryAlignment
    }
    fareName
    fareSelectedText
    priceDisplay {
      ...FlightsPriceDisplayFragment
    }
    accessibilityText
    amenityStatusListAccessibility
  }

fragment FlightsOfferSponsoredAirlineFragment on FlightsOfferSponsoredAirline {
    airlineName
    airlineImage {
      url
    }
    sponsoredHeader
    sponsoredText
    sponsoredBeacons {
      renderBeacons
      clickBeacons
      viewBeacons
    }
    adTransparencyTrigger {
      adTransparencyId
      adTransparencyButton {
        ...AdTransparencyButtonFragment
      }
      adTransparencyOverlaySkeleton {
        title
        error {
          description
          icon {
            id
            size
          }
          button {
            primary
          }
          allowedRetryAttempts
          exceededAttemptsMessage
        }
      }
    }
  }

fragment FlightsOfferSponsoredUpsellFragment on FlightsOfferSponsoredUpsell {
    __typename
    adBadge {
      ...EGDSBadgeFragment
      ... on AdTransparencyTrigger {
        adTransparencyId
        adTransparencyButton {
          __typename
          ... on AdTransparencyButton {
            primary
            accessibility
            disabled
            size
            icon {
              description
              id
              title
            }
            analyticsPayload
          }
        }
        adTransparencyOverlaySkeleton {
          ...TransparencyOverlaySkeletonFragment
        }
      }
    }
    expando {
      ...EGDSExpandoFragment
    }
    details {
      ...FlightsSponsoredUpsellDetails
    }
    sponsoredUpsellAction {
      ...FlightsActionButtonFragment
      ...FlightsDialogTriggerFragment
    }
    onViewedAnalytics {
      ...ClientSideAnalyticsFragment
    }
    beacons {
      ...SponsoredTrackingBeaconsFragement
    }
  }

fragment OfferInfoLinkFragment on FlightsInfoLink {
    actionLink {
      primary
      clientAction {
        analyticsList {
          ...ClientSideAnalyticsFragment
        }
      }
    }
    sheet {
      ...FlightsSheetTypeFragment
    }
  }

fragment FlightsPhraseAnalyticsFragment on FlightsAnalytics {
    linkName
    referrerId
  }

fragment FlightsActionButtonFragment on FlightsActionButton {
  __typename
  accessibility
  clientAction {
    ...FlightsDialogTriggerActionFIS
  }
  disabled
  egdsElementId
  icon {
    ...IconInformationLoaded
  }
  primary
  style
  action {
    __typename
    accessibility
    analytics {
      ...ClientAnalytics
    }
  }
}

fragment MultiItemFlightCrossSellPrimerFragment on MultiItemFlightCrossSellPrimer {
    flightCrossSellProductType
    multiItemSearchContext {
      ...MultiItemSearchContextFragment
    }
  }

fragment MultiItemSearchContextFragment on MultiItemSearchContext {
    flights {
      primary {
        journeyCriterias {
          departureDate {
            ...DateFragment
          }
          origin
          destination
        }
        searchPreferences {
          cabinClass
          advancedFilters
        }
        tripType
        travelers {
          age
          type
        }
      }
      secondary {
        booleans {
          id
          value
        }
      }
    }
  }

fragment MultiItemPackageableProductFragment on MultiItemPackageableProduct {
    flights {
      offerToken
      productTokens
      travelers {
        age
        type
      }
    }
  }

fragment MultiItemPricedPackageableProductFragment on MultiItemPricedPackageableProduct {
    flight {
      offerToken
      productTokens
      travelers {
        age
        type
      }
    }
    brandedDealPrice {
      base {
        amount
      }
      taxesAndFees {
        amount
      }
    }
    subjectToGovernmentApproval
  }

fragment SponsoredContentPlacementFragment on SponsoredContentPlacement {
    productType
    sponsoredContentContext {
      sponsoredContentId
      variant
      pageName
      targeting {
        adults
        dateEnd {
          day
          month
          year
        }
        dateStart {
          day
          month
          year
        }
        kids
        locationResolver
        destination
        origin
      }
    }
  }

fragment FlightsHeaderWithInlineDialogTriggerFragment on FlightsHeaderWithInlineDialogTrigger {
    items {
      text {
        ...EGDSSpannableTextFragment
      }
      trigger {
        ...FlightsExperienceDialogTriggerFragment
      }
    }
  }

fragment FlightsActionLinkFragment on FlightsActionLink {
  __typename
  clientAction {
    ...FlightsClientActionFragment
  }
  disabled
  primary
  icon {
    ...IconSearch
  }
  analytics {
    ...ClientSideAnalytics
  }
}

fragment InsurtechSearchCriteriaFragment on InsurtechSearchCriteria {
    flightSearchCriteria {
      primary {
        journeyCriterias {
          arrivalDate {
            day
            month
            year
          }
          departureDate {
            day
            month
            year
          }
          destination
          origin
        }
        travelers {
          age
          type
        }
        tripType
      }
    }
  }

fragment AppliedFilterFragment on ShoppingSortAndFilterAppliedFilter {
    pill {
      ...FlightsEGDSRemovablePillFragment
    }
    nextSearchCriteria {
      ...ShoppingSearchCriteriaFragment
    }
  }

fragment AlternateAirportOptionsFragment on AlternateAirportOptions {
    accessibilityTitle
    airportOptions {
      ...AirportOptionFragment
    }
    airportOptionAnalytics {
      ...FlightsAnalyticsFragment
    }
    alternateOptionTitle
  }

fragment AlternateDateOptionsFragment on AlternateDateOptions {
    accessibilityTitle
    alternateOptionTitle
    dateOptionAnalytics {
      ...FlightsAnalyticsFragment
    }
    dateOptions {
      ...DateOptionFragment
    }
  }

fragment FlightsPointsMoreInfoLink on FlightsPointsMoreInfoLink {
  __typename
  content {
    ...FlightsPointsInformationDialogContent
  }
  dialog {
    ...FaresDialogsFragment
  }
  text
}

fragment FlightAction on FlightsAction {
  __typename
  accessibilityMessage
  analytics {
    ...FlightsAnalytics
  }
  analyticsList {
    ...FlightsAnalytics
  }
  displayAnalytics {
    ...FlightsAnalytics
  }
  displayAction
  displayType
  accessibilityActionMessage {
    usage
    onCompletion
  }
  icon {
    ...IconSearch
  }
  journeySearchCriteria {
    previousFlightSelections {
      journeyIndex
      offerIdentifier
    }
    journeyCriteria {
      originAirportLocationType
      destinationAirportLocationType
      destination
      departureDate {
        day
        month
        year
      }
      origin
    }
    searchPreferences {
      cabinClass
    }
  }
  relativeURI {
    relativePath
    value
  }
  relativePackageableURI {
    relativePath
    value
  }
  stepIndicator {
    ...FlightsStepIndicator
  }
  searchPagination {
    ...Pagination
  }
  type
}

fragment FlightsAnalytics on FlightsAnalytics {
  __typename
  linkName
  referrerId
}

fragment FlightsPhrasePartFragment on FlightsPhrasePart {
  __typename
  ... on FlightsPhraseTextNode {
    ...FlightsPhraseTextNodeFragment
  }
}

fragment IconSearch on Icon {
  __typename
  description
  id
  size
  withBackground
  theme
  title
  spotLight
  token
}

fragment MarkFragments on Mark {
  __typename
  description
  id
  markSize: size
  url {
    ... on HttpURI {
      __typename
      relativePath
      value
    }
  }
}

fragment EgdsGraphicIllustrationFragmentSearch on Illustration {
  __typename
  link: url
  id
  description
  egdsElementId
}

fragment FlightsSelectionAction on FlightsSelectionAction {
  value
}

fragment EGDSPillFragment on EGDSPill {
    __typename
    ...EGDSBasicPillFragment
    ...EGDSBasicRemovablePillFragment
  }

fragment FlightsContentBlockFragment on FlightsContentBlock {
    heading {
      ...EGDSHeadingFragment
    }
    message {
      ...EGDSParagraphFragment
    }
  }

fragment EGDSStandardMessagingCardFragment on EGDSStandardMessagingCard {
  dismiss {
    ...EGDSDismissActionFragment
  }
  egdsElementId
  graphic {
    ...UIGraphicFragment
  }
  heading
  links {
    ...EGDSStandardLinkFragment
  }
  message
  rightIcon {
    ...IconSearch
  }
}

fragment FlightsMessageCardContentFragment on FlightsMessageCardContent {
    content {
      ...FlightsCategorizedListItemFragment
    }
    egcsAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    header {
      ...FlightsCategorizedListItemFragment
    }
  }

fragment FlightErrorMessagingPresentationFragment on FlightsErrorMessagingPresentation {
    __typename
    ...FlightsCriticalErrorMessagingFragment
    ...FlightsInfoMessagingPresentationFragment
  }

fragment IconFragment on Icon {
  description
  id
  size
  theme
  title
  withBackground
  spotLight
}

fragment EGDSGraphicTextFragment on EGDSGraphicText {
  textGraphic: graphic {
    ...UIGraphicFragment
  }
  text
  accessibility
}

fragment EGDSInlineLinkFragment on EGDSInlineLink {
  __typename
  action {
    ...UILinkActionFragment
  }
  disabled
  size
  text
}

fragment FlightsBaggageRadioButtonFragment on FlightsBaggageRadioButton {
    onClickAnalytics
    egcsOnClickAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    label {
      ...EGDSSpannableTextFragment
    }
    subLabel {
      ...EGDSSpannableTextFragment
    }
    weightLabel {
      ...EGDSSpannableTextFragment
    }
    weightSubLabel {
      ...EGDSSpannableTextFragment
    }
    radioButton {
      ...FlightSelectableBaggageFragment
    }
    baggageSelectionAccessibilityMessages {
      ...FlightsBaggageSelectionAccessibilityMessagesFragment
    }
  }

fragment EGDSBasicRadioButtonFragment on EGDSBasicRadioButton {
    __typename
    description
    disabled
    label
    labelSuffix
    value
  }

fragment EGDSPlainTextFragment on EGDSPlainText {
  text
}

fragment EGDSIconTextFragment on EGDSIconText {
  __typename
  icon {
    ...IconSearch
  }
  text
}

fragment EGDSStandardLinkFragment on EGDSStandardLink {
  action {
    ...UILinkActionFragment
  }
  disabled
  standardLinkIcon: icon {
    ...IconSearch
  }
  iconPosition
  size
  text
}

fragment EGDSTextStandardListItemFragment on EGDSTextStandardListItem {
    text
    nestedLevelOneList {
      ...EGDSNestedLevelOneListFragment
    }
  }

fragment UILinkActionFragment on UILinkAction {
  accessibility
  analytics {
    ...ClientSideAnalytics
  }
  resource {
    value
  }
  target
  useRelativePath
}

fragment FlightsShoppingPrimarySectionFragment on FlightsShoppingPrimarySection {
    ...EGDSMoreInfoTriggerComponentFragment
  }

fragment FlightsShoppingSecondarySectionFragment on FlightsShoppingSecondarySection {
    ...FlightShoppingCardDurationTimelineFragment
    ...EGDSTextSectionFragment
  }

fragment FlightShoppingCardTertiarySectionFragment on FlightsShoppingTertiarySection {
    ...EGDSTextSectionFragment
  }

fragment FlightsOfferAdditionalMessageFragment on FlightsOfferAdditionalMessage {
    ...EGDSSpannableTextFragment
    ...EGDSGraphicTextFragment
    ...EGDSPlainTextFragment
  }

fragment FlightsDetailsAndFaresContentFragment on FlightsDetailsAndFaresContent {
  __typename
  dialogId
  dynamicDialogId
  nestedDialogs {
    ...FaresDialogsFragment
  }
  priceMatchPromiseNestedDialogs {
    ...FaresDialogsFragment
  }
  sections {
    __typename
    ...FlightsJourneyHeaderFragment
    ...FlightsJourneyDetailsInformationFragment
    ...FlightsJourneyWithDetailsFragment
    ...TextWrapperFragment
    ...FlightsFaresInformationFragment
    ...FlightsSustainabilityCardFragment
    ...FlightsMessagingCardFragment
  }
  displayAnalytics {
    ...ClientSideAnalytics
  }
}

fragment FlightsDetailsAndFaresFooterFragment on FlightsDetailsAndFaresFooter {
  __typename
  action {
    ...FlightsActionButton
  }
  dialogId
  dynamicDialogId
  priceDisplay {
    ...FlightsPriceDisplayFragment
  }
  priceLockup {
    ...PriceLockupFragment
  }
}

fragment FlightsDialogTriggerFragment on FlightsDialogTrigger {
  __typename
  dialogAction
  dialogId
  dynamicDialogId
  trigger {
    __typename
    ...FlightsActionButton
    ...FlightsActionLinkFragment
    ...FlightsExperienceActionButtonFragment
    ...FlightsExperienceActionLinkFragment
  }
}

fragment TextWrapperFragment on TextWrapper {
  textA11yMessage: accessibilityMessage
  text {
    ...EgdsTextFragment
    ...EGDSSpannableTextFragment
    __typename
  }
  __typename
}

fragment EGDSBasicTabsFragment on EGDSBasicTabs {
  egdsElementId
  selectedTabId
  tabs {
    ... on EGDSBasicTab {
      ...EGDSBasicTabFragment
    }
  }
  __typename
}

fragment FlightsExperienceActionLinkFragment on FlightsExperienceActionLink {
  __typename
  accessibility
  clientAction {
    ...FlightsClientActionFragment
  }
  disabled
  primary
  analytics {
    ...ClientSideAnalytics
  }
  icon {
    ...IconFragment
  }
}

fragment FlightsDialogTriggerTypeFragment on FlightsDialogTriggerType {
    ...FlightsExperienceActionButtonFragment
  }

fragment FaresDialogsFragment on FlightsDialog {
  dialog {
    __typename
    ...EGDSDialogFragment
  }
  dialogContent: content {
    __typename
    ...EgdsElementFragment
    ... on FlightsDialogTrigger {
      ...FlightsDialogTriggerFragment
    }
  }
  displayAnalytics {
    ...ClientSideAnalytics
  }
  dialogId
  dynamicDialogId
  initialState
}

fragment FlightsSideSheetFragment on FlightsSideSheet {
  content {
    ...EgdsElementFragment
  }
  footer {
    ...EgdsElementFragment
  }
  title
  initialState
  closeText
  __typename
}

fragment FlightsSheetFragment on FlightsSheet {
  ... on FlightsDetailSheet {
    ...FlightsDetailSheetFragment
  }
}

fragment EGDSButtonFragment on EGDSButton {
  __typename
  ...FlightsActionButton
  ...FlightsDialogTriggerFragment
}

fragment UITertiaryButtonSearchFragment on UITertiaryButton {
  accessibility
  analytics {
    ...ClientSideAnalytics
  }
  disabled
  icon {
    ...IconFragment
  }
  primary
}

fragment AdTransparencyButtonFragment on AdTransparencyButton {
  primary
  icon {
    id
  }
}

fragment TransparencyOverlaySkeletonFragment on TransparencyOverlaySkeleton {
    title
    error {
      icon {
        id
        size
      }
      description
      button {
        primary
      }
      allowedRetryAttempts
      exceededAttemptsMessage
    }
  }

fragment EGDSExpandoFragment on EGDSExpando {
  __typename
  ... on EGDSExpandoPeek {
    ...EGDSExpandoPeekFragment
  }
  ... on EGDSExpandoListItem {
    ...EGDSExpandoListItemFragment
  }
  ... on EGDSExpandoLink {
    ...EGDSExpandoLinkFragment
  }
}

fragment FlightsSponsoredUpsellDetails on FlightsSponsoredFareInformation {
  __typename
  mediaSection {
    badge {
      ...EGDSBadgeFragment
      size
    }
    featureImage {
      url
      description
      thumbnailClickAnalytics {
        ...ClientSideAnalytics
      }
    }
  }
  heading {
    __typename
    accessibility
    text
  }
  description
  highlights {
    __typename
    listItems {
      __typename
      text
    }
  }
  priceDisplay {
    ...FlightsPriceDisplayFragment
  }
  priceLockup {
    ...PriceLockupFragment
  }
  sponsoredFareAnalyticsList {
    ...ClientSideAnalytics
  }
  onClickAnalyticsList {
    ...ClientSideAnalytics
  }
  showMoreExpando {
    ...EGDSExpandoFragment
    collapseAnalytics {
      ...ClientSideAnalytics
    }
    expanded
  }
}

fragment SponsoredTrackingBeaconsFragement on SponsoredTrackingBeacons {
  renderBeacons
  clickBeacons
  viewBeacons
  __typename
}

fragment FlightsDialogTriggerActionFIS on FlightsDialogTriggerAction {
  __typename
  dialog {
    ...EGDSActionDialogFragment
  }
  analyticsList {
    __typename
    ...ClientAnalytics
  }
  dialogContents {
    __typename
    ... on EGDSHeading {
      text
    }
    ... on EGDSParagraph {
      text
    }
  }
}

fragment IconInformationLoaded on Icon {
  __typename
  description
  id
  size
  withBackground
  theme
}

fragment ClientAnalytics on ClientSideAnalytics {
  __typename
  linkName
  referrerId
  uisPrimeMessages {
    messageContent
    schemaName
  }
}

fragment DateFragment on Date {
  month
  day
  year
}

fragment FlightsClientActionFragment on FlightsClientAction {
  accessibility
  analyticsList {
    ...ClientSideAnalytics
  }
  egcsAnalytics {
    ...FlightsClickStreamAnalyticsFragment
  }
  ... on FlightsCreditSelectionAction {
    originalBookingId
  }
  ...FlightsBoundNavigation
  ...FlightsNavigateToDetails
  ...FlightsResourceLinkAction
  ...FlightsSelectionAction
  ...MultiItemSelectPackage
  ...MultiItemSelectProducts
}

fragment FlightsEGDSRemovablePillFragment on EGDSRemovablePill {
    primary
    accessibility
    disabled
    action {
      accessibility
      ... on UIFlightAction {
        analyticsPayload
      }
    }
  }

fragment ShoppingSearchCriteriaFragment on ShoppingSearchCriteria {
    selections {
      id
      value
    }
    booleans {
      id
      value
    }
    counts {
      id
      value
    }
    dates {
      id
      value {
        day
        month
        year
      }
    }
    ranges {
      id
      max
      min
    }
  }

fragment AirportOptionFragment on AirportOption {
    accessibilityHeading
    accessibilityMessage
    destinationAirportDistance
    destinationCityName
    icon {
      ...IconFragments
    }
    originAirportDistance
    originCityName
    selectAction {
      ...SelectActionFragment
    }
  }

fragment DateOptionFragment on DateOption {
    accessibilityHeading
    accessibilityMessage
    numDaysDifference
    selectAction {
      ...SelectActionFragment
    }
    tripDates
    tripOD
  }

fragment FlightsPointsInformationDialogContent on FlightsPointsInformationDialogContent {
  __typename
  title
  body {
    ...FlightsPointsInformationDialogContentBodyElements
  }
}

fragment FlightsStepIndicator on FlightsStepIndicator {
  errorAnalytics {
    ...FlightsAnalytics
  }
  journeyContinuationId
}

fragment Pagination on Pagination {
  __typename
  size
  startingIndex
}

fragment FlightsPhraseTextNodeFragment on FlightsPhraseTextNode {
  styles
  text
}

fragment EGDSBasicPillFragment on EGDSBasicPill {
    accessibility
    deselectAnalytics {
      ...ClientSideAnalyticsFragment
    }
    disabled
    icon {
      ...UIGraphicFragment
    }
    name
    primary
    selectAnalytics {
      ...ClientSideAnalyticsFragment
    }
    selected
    value
  }

fragment EGDSBasicRemovablePillFragment on EGDSBasicRemovablePill {
    accessibility
    disabled
    icon {
      ...UIGraphicFragment
    }
    name
    primary
    remove {
      ...UIGraphicFragment
    }
    removeAnalytics {
      ...ClientSideAnalyticsFragment
    }
    selected
    value
  }

fragment EGDSDismissActionFragment on EGDSDismissAction {
  accessibility
  analytics {
    ...ClientSideAnalytics
  }
  label
}

fragment FlightsCategorizedListItemFragment on FlightsCategorizedListItem {
  __typename
  primary {
    ...EGDSSpannableTextFragment
  }
  secondary
  secondaryContent {
    ...EGDSSpannableTextFragment
  }
  tertiary
  tertiaryContent {
    ...EGDSStylizedTextFragment
  }
  graphic {
    ...UIGraphicFragment
  }
}

fragment FlightsCriticalErrorMessagingFragment on FlightsCriticalErrorMessaging {
    __typename
    egcsDisplayAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    primaryAction {
      ...FlightsExperienceActionButtonFragment
    }
    icon {
      ...IconFragments
    }
    message
    title
  }

fragment FlightsInfoMessagingPresentationFragment on FlightsInfoMessagingPresentation {
    egcsDisplayAnalytics {
      ...FlightsClickStreamAnalyticsFragment
    }
    icon {
      ...IconFragments
    }
    message
    title
  }

fragment FlightSelectableBaggageFragment on FlightSelectableBaggageAncillaryOption {
    __typename
    description
    disabled
    label
    labelSuffix
    value
    optionType
    selectableAncillaryToken
    selected
  }

fragment FlightsBaggageSelectionAccessibilityMessagesFragment on FlightsBaggageSelectionAccessibilityMessages {
    preSelectionAccessibilityMessage
    preSelectionPerTravelerAccessibilityMessage
    postSelectionAccessibilityMessage
    postSelectionPerTravelerAccessibilityMessage
  }

fragment EGDSNestedLevelOneListFragment on EGDSNestedLevelOneList {
    items {
      ...EGDSNestedLevelOneListItemFragment
    }
  }

fragment EGDSMoreInfoTriggerComponentFragment on EGDSMoreInfoTrigger {
    icon {
      ...IconFragments
    }
    text
    triggerAction {
      accessibility
      analytics {
        ...ClientSideAnalyticsFragment
      }
      sheet {
        ...EGDSSheetFragment
      }
      text
    }
    analytics {
      ...ClientSideAnalyticsFragment
    }
    accessibility
  }

fragment FlightShoppingCardDurationTimelineFragment on FlightShoppingCardDurationTimeline {
  __typename
  start {
    ...FlightShoppingDurationTimelineSideSectionFragment
  }
  end {
    ...FlightShoppingDurationTimelineSideSectionFragment
  }
  stops
  theme
  primaryMessage {
    ... on EGDSStylizedText {
      text
      weight
    }
  }
  secondaryMessage {
    ...EGDSTextSectionFragment
  }
}

fragment EGDSTextSectionFragment on EGDSTextSection {
  __typename
  contents {
    __typename
    ...EGDSStylizedAndSpannable
  }
  heading {
    __typename
    ...EGDSSectionHeadingFragment
  }
}

fragment FlightsJourneyHeaderFragment on FlightsJourneyHeaderInformation {
  __typename
  content {
    ...FlightsInformationTextFragment
  }
}

fragment FlightsJourneyDetailsInformationFragment on FlightsJourneyDetailsInformation {
  __typename
  content {
    ...FlightsJourneyDetailsFragment
  }
  expando {
    ...EGDSExpandoFragment
  }
}

fragment FlightsJourneyWithDetailsFragment on FlightsJourneyWithDetails {
  __typename
  details {
    ...EgdsTextFragment
  }
  footnotes {
    ...EgdsTextFragment
  }
  header
  subheader
}

fragment FlightsFaresInformationFragment on FlightsFaresInformation {
  __typename
  accessibility
  faresScrollDirection
  carousel {
    ...EGDSCarouselContainerFragment
  }
  faresCarousel {
    ...EGDSCarouselFragment
  }
  heading
  fares {
    ...FareInformationCardFragment
  }
  subheading
  scrollAnalytics {
    ...ClientSideAnalytics
  }
  faresScrollAnalytics {
    ...FlightsFaresScrollAnalytics
  }
  totalFareCount
  faresLoadingAnalytics {
    faresLoadErrorAnalytics {
      ...ClientSideAnalytics
    }
    faresLoadingDisplayedAnalytics {
      ...ClientSideAnalytics
    }
    faresLoadingTimeAnalytics {
      ...ClientSideAnalytics
    }
    continueButtonOnClickAnalytics {
      ...ClientSideAnalytics
    }
  }
}

fragment FlightsSustainabilityCardFragment on FlightsSustainabilityCard {
  __typename
  cardContent {
    text {
      ...FlightsPhrase
    }
    icon {
      ...IconSearch
    }
  }
}

fragment FlightsMessagingCardFragment on FlightsMessagingCard {
  cardContent {
    ...EGDSStandardMessagingCardFragment
  }
  displayAnalytics {
    ...ClientSideAnalytics
  }
}

fragment FlightsActionButton on FlightsActionButton {
  __typename
  accessibility
  clientAction {
    __typename
    accessibility
    analyticsList {
      ...ClientSideAnalytics
    }
    ...FlightsBoundNavigation
    ...FlightsCreditSelectorOpenAction
    ...FlightsNavigateToDetails
    ...FlightsResourceLinkAction
    ...FlightsSelectionAction
    ...MultiItemSelectPackage
    ...MultiItemSelectProducts
  }
  disabled
  egdsElementId
  icon {
    ...IconSearch
  }
  primary
  style
  buttonStyle: style
  action {
    __typename
    accessibility
    analytics {
      ...ClientSideAnalytics
    }
  }
}

fragment PriceLockupFragment on EGDSPriceLockup {
  accessibilityPrice
  leadingCaption
  lockupFormattedPoints
  isPointsFirst
  isStrikeThroughFirst
  lockupPrice
  priceSubtextFirst
  priceSubtextBold
  priceSubtextStandard
  strikeThroughPrice
}

fragment EgdsTextFragment on EGDSText {
  __typename
  ... on EGDSGraphicText {
    ...EGDSGraphicTextFragment
  }
  ... on EGDSHeading {
    text
    headingType
  }
  ... on EGDSParagraph {
    ...EGDSParagraphFragment
  }
  ... on EGDSIconText {
    text
    icon {
      id
      size
      theme
    }
  }
  ... on EGDSStandardLink {
    text
    size
    action {
      __typename
      accessibility
      target
      resource {
        __typename
        value
      }
      analytics {
        __typename
        linkName
        referrerId
      }
    }
  }
  ... on EGDSPlainText {
    text
  }
  ... on EGDSStylizedText {
    decorative
    text
    accessibility
    theme
    weight
    stylizedSize: size
  }
  ... on EGDSSpannableText {
    ...EGDSSpannableTextFragment
  }
}

fragment EGDSBasicTabFragment on EGDSBasicTab {
  tabId
  label
  accessibility
  clickAnalytics {
    ...ClientSideAnalyticsFragment
  }
  __typename
}

fragment EGDSDialogFragment on EGDSDialog {
  closeAnalytics {
    ...ClientSideAnalytics
  }
  ...EGDSFullScreenDialogFragment
  ... on EGDSActionDialog {
    __typename
    footer {
      __typename
      buttons {
        ...EGDSButtonFragment
      }
    }
  }
}

fragment EgdsElementFragment on EGDSElement {
  __typename
  ... on EGDSText {
    ...EgdsTextFragment
  }
  ... on Illustration {
    ...EgdsGraphicIllustrationFragmentSearch
  }
  ... on UIMessagingCard {
    primary
    secondaries
    graphic {
      __typename
      ... on Illustration {
        link: url
      }
      ...EgdsGraphicIllustrationFragmentSearch
    }
  }
  ... on EGDSBulletedList {
    listItems {
      __typename
      text
    }
  }
  ... on EGDSUnorderedList {
    listItems {
      __typename
      ... on EGDSTextStandardListItem {
        text
      }
      ... on EGDSTextIconListItem {
        text
        icon {
          ...IconFragment
        }
      }
      ... on FlightsTextContainerListItem {
        content {
          ...EgdsTextFragment
        }
      }
    }
    textListSize: size
  }
}

fragment FlightsDetailSheetFragment on FlightsDetailSheet {
  title
  closeAnalytics {
    ...ClientSideAnalytics
  }
  content {
    ...EgdsElementFragment
  }
  footer {
    ...EgdsElementFragment
  }
  initialState
  closeText
  actions {
    ...EGDSToolbarActionButtonFragment
  }
  sheetType
  __typename
}

fragment EGDSExpandoPeekFragment on EGDSExpandoPeek {
  __typename
  expandedLabel
  collapsedLabel
  expandAnalytics {
    ...ClientSideAnalytics
  }
  collapseAnalytics {
    ...ClientSideAnalytics
  }
  threshold
  minimalHeight
}

fragment EGDSExpandoListItemFragment on EGDSExpandoListItem {
  __typename
  collapseAnalytics {
    ...ClientSideAnalytics
  }
  collapsedLabel
  expandAnalytics {
    ...ClientSideAnalytics
  }
  expandedLabel
  expanded
}

fragment EGDSExpandoLinkFragment on EGDSExpandoLink {
  __typename
  collapseAnalytics {
    ...ClientSideAnalytics
  }
  collapsedLabel
  expandAnalytics {
    ...ClientSideAnalytics
  }
  expanded
  expandedLabel
}

fragment EGDSActionDialogFragment on EGDSActionDialog {
  __typename
  footer {
    ...EGDSActionDialogFooter
  }
}

fragment FlightsBoundNavigation on FlightsBoundNavigation {
  jcid
  mipt
  misId: multiItemSessionId
  pageId
  stepIndicatorJcid
}

fragment FlightsNavigateToDetails on FlightsNavigateToDetails {
  dialogId
  nextPage {
    ...HttpURI
  }
  packagesUrl {
    ...HttpURI
  }
}

fragment FlightsResourceLinkAction on FlightsResourceLinkAction {
  __typename
  accessibility
  analyticsList {
    ...ClientSideAnalytics
  }
  resource {
    ...HttpURI
  }
}

fragment MultiItemSelectPackage on MultiItemSelectPackage {
  packageOfferId
}

fragment MultiItemSelectProducts on MultiItemSelectProducts {
  flightsOfferNaturalKeys {
    ...FlightsOfferNaturalKeysFragment
  }
  multiItemPriceToken
  multiItemSessionId
}

fragment SelectActionFragment on FlightsAction {
    ...FlightsActionFragment
    journeySearchCriteria {
      ...JourneySearchCriteriaFragment
    }
  }

fragment FlightsPointsInformationDialogContentBodyElements on FlightsPointsInformationDialogContentBodyElements {
  __typename
  ...EGDSStylizedText
  ...EGDSSpannableTextFragment
  ...FlightsPointsEqualityPresentation
}

fragment EGDSNestedLevelOneListItemFragment on EGDSNestedLevelOneListItem {
    text
  }

fragment FlightShoppingDurationTimelineSideSectionFragment on FlightShoppingDurationTimelineSideSection {
  primary
  differentDayArrival
  secondary {
    ...FlightsResponsiveMessage
  }
}

fragment EGDSStylizedAndSpannable on EGDSText {
  __typename
  ... on EGDSStylizedText {
    text
    size
    weight
    theme
  }
  ... on EGDSSpannableText {
    text
    inlineContent {
      __typename
      ... on EGDSStylizedText {
        accessibility
        text
        size
        weight
        theme
      }
    }
  }
}

fragment EGDSSectionHeadingFragment on EGDSSectionHeading {
  heading {
    ...EGDSHeadingFragment
  }
  subheading
  ... on FlightsOfferSectionHeading {
    mark {
      ...MarkFragments
    }
  }
  ... on EGDSBasicSectionHeading {
    graphic {
      ...UIGraphicFragment
    }
  }
}

fragment FlightsInformationTextFragment on FlightsInformationText {
  __typename
  content {
    ...FlightsInformationTextItemFragment
  }
}

fragment FlightsJourneyDetailsFragment on FlightsJourneyDetails {
  __typename
  trigger {
    ...FlightsExperienceDialogTrigger
  }
  dialog {
    ...FaresDialogsFragment
  }
  journeySections {
    ...JourneySectionFragment
  }
  journeyAmenities {
    ...FlightsIconAndLabel
  }
  badge {
    ...JourneyDetailsBadgeFragment
  }
}

fragment EGDSCarouselContainerFragment on EGDSCarouselContainer {
  __typename
  accessibilityHeadingText
  nextButtonText
  previousButtonText
}

fragment EGDSCarouselFragment on EGDSCarousel {
  nextButton {
    ...EGDSButtonFragment
  }
  previousButton {
    ...EGDSButtonFragment
  }
}

fragment FareInformationCardFragment on FareInformationCard {
  __typename
  action {
    ...FareActionFragment
    clickAdaptExAnalytics {
      ...FlightsAdaptExAnalyticsFragment
    }
  }
  amenities {
    ...FlightsCategorizedListFragment
  }
  fareDetails {
    ...EgdsTextFragment
  }
  featuredHeader
  heading {
    ...FareHeadingFragmentSearch
  }
  fareMessage {
    decorative
    text
    theme
    weight
    stylizedSize: size
  }
  priceMatchPromise {
    ...FarePriceMatchPromisePresentationFragment
  }
  state
  highlighted
  fareCardIdentifier
  scrollAnalytics {
    ...ClientSideAnalytics
  }
  sponsoredContent {
    __typename
  }
  isPopularFare
  journeyContinuationId
  displayAdaptExAnalytics {
    ...FlightsAdaptExAnalyticsFragment
  }
}

fragment FlightsFaresScrollAnalytics on FlightsFaresScrollAnalytics {
  scrollUp {
    ...ClientSideAnalytics
  }
  scrollDown {
    ...ClientSideAnalytics
  }
  scrollDownButtonClick {
    ...ClientSideAnalytics
  }
}

fragment FlightsPhrase on FlightsPhrase {
  completeText
  delimeter
  theme
  items {
    __typename
    text
    styles
    ... on FlightsPhraseLinkNode {
      accessibility
      analytics {
        ...FlightsAnalytics
      }
      displayAnalytics {
        ...FlightsAnalytics
      }
      scrollAnalytics {
        ...FlightsAnalytics
      }
      link
      icon
    }
    ... on FlightsPhraseDialogNode {
      accessibility
      analytics {
        ...FlightsAnalytics
      }
      actionableIcon {
        id
        description
      }
      dialog {
        __typename
        title
        message
        animation
        actions {
          ...FlightAction
        }
        displayedAnalytics {
          ...FlightsAnalytics
        }
      }
    }
  }
}

fragment FlightsCreditSelectorOpenAction on FlightsCreditSelectorOpenAction {
  __typename
  accessibility
  analyticsList {
    ...ClientSideAnalytics
  }
}

fragment EGDSFullScreenDialogFragment on EGDSFullScreenDialog {
  ... on EGDSFullScreenDialog {
    toolbar {
      ...EGDSDialogToolbarFragment
    }
  }
}

fragment EGDSToolbarActionButtonFragment on EGDSToolbarActionButton {
  ...EGDSOverlayButtonTypeFragment
}

fragment EGDSActionDialogFooter on EGDSDialogFooter {
  __typename
  buttons {
    ...UITertiaryButtonFragment
    ... on FlightsActionButton {
      __typename
      style
      primary
      clientAction {
        analyticsList {
          ...ClientAnalytics
        }
        ... on FlightsRemovePriceMatchPromiseAction {
          journeyContinuationId
        }
      }
    }
  }
}

fragment HttpURI on HttpURI {
  __typename
  relativePath
  value
}

fragment FlightsOfferNaturalKeysFragment on FlightsOfferNaturalKeys {
  flightNaturalKey {
    offerToken
    productTokens
    travelers {
      age
      type
    }
    journeyContinuationId
  }
  packagedProductsNaturalKeys {
    __typename
    ... on CarNaturalKey {
      __typename
      offerToken
    }
    ... on PropertyNaturalKey {
      __typename
      id
      ratePlanId
      roomTypeId
      ratePlanType
      inventoryType
      checkOut {
        ...DateFragment
      }
      checkIn {
        ...DateFragment
      }
      rooms {
        childAges
        numberOfAdults
      }
      businessModelType
    }
  }
}

fragment JourneySearchCriteriaFragment on FlightsJourneySearchCriteria {
    previousFlightSelections {
      journeyIndex
      offerIdentifier
    }
    journeyCriteria {
      originAirportLocationType
      destinationAirportLocationType
      destination
      departureDate {
        day
        month
        year
      }
      origin
    }
    searchPreferences {
      cabinClass
    }
  }

fragment EGDSStylizedText on EGDSStylizedText {
  __typename
  text
  theme
  stylizedSize: size
  accessibility
  weight
  decorative
}

fragment FlightsPointsEqualityPresentation on FlightsPointsEqualityPresentation {
  __typename
  delimiter {
    ...EGDSStylizedText
  }
  primaryText {
    ...EGDSStylizedText
  }
  secondarySubText {
    ...EGDSStylizedText
  }
  secondaryText {
    ...EGDSStylizedText
  }
  subText {
    ...EGDSStylizedText
  }
}

fragment FlightsResponsiveMessage on FlightsResponsiveMessage {
  __typename
  longMessage
  shortMessage
}

fragment FlightsInformationTextItemFragment on FlightsInformationTextItem {
  ...MarkWrapperFragment
  ...TextWrapperFragment
  ...IconWrapperFragment
  ...SuperlativeTextFragment
  ...BadgeWrapperFragment
}

fragment FlightsExperienceDialogTrigger on FlightsExperienceDialogTrigger {
  dialogAction
  dialogId
  dynamicDialogId
  trigger {
    ...FlightsExperienceActionLinkFragment
    ...FlightsExperienceActionButtonFragment
  }
}

fragment JourneySectionFragment on JourneySection {
  __typename
  journeyConnectionInformation {
    ... on AdditionalInformation {
      ...AdditionalInformationFragment
    }
    ... on FlightsConnectionInformation {
      ...FlightsConnectionInformationFragment
    }
  }
  sectionLabel {
    ...EgdsTextFragment
  }
  messageList {
    ...EgdsTextFragment
  }
}

fragment FlightsIconAndLabel on FlightsIconAndLabel {
  __typename
  icon {
    ...IconSearch
  }
  label
  subLabel
  accessibility
  value
  theme
  displayAnalytics {
    ...FlightsAnalytics
  }
  subText {
    ... on EGDSStylizedText {
      decorative
      text
      theme
      weight
      size
    }
  }
}

fragment JourneyDetailsBadgeFragment on JourneyDetailsBadge {
  badge {
    ...EGDSBadgeFragment
  }
  link {
    ...EGDSStandardLinkFragment
  }
  label {
    ...EGDSPlainTextFragment
  }
}

fragment FareActionFragment on FareAction {
  __typename
  action {
    ...FlightsActionButton
  }
  states
}

fragment FlightsAdaptExAnalyticsFragment on FlightsAdaptExAnalytics {
  campaignId
  events {
    banditDisplayed
    eventProperties {
      name
      value
    }
    eventTarget
    eventType
    payloadId
  }
}

fragment FlightsCategorizedListFragment on FlightsCategorizedList {
  __typename
  sections {
    ...FlightsCategorizedListSectionFragment
  }
  expandableSection {
    ...FlightsExpandableCategorizedListSectionFragment
  }
}

fragment FareHeadingFragmentSearch on FareHeading {
  __typename
  badge {
    ...EGDSBadgeFragment
  }
  farePricing {
    ...FarePricingFragment
  }
}

fragment FarePriceMatchPromisePresentationFragment on FarePriceMatchPromisePresentation {
  __typename
  cards {
    ...FarePriceMatchPromiseSelectableCardFragment
    ...FarePriceMatchPromiseRemovableCardFragment
    ...FarePriceMatchPromiseStaticCardFragment
  }
  priceMatchPromiseState
}

fragment EGDSDialogToolbarFragment on EGDSDialogToolbar {
  title
  closeText
}

fragment EGDSOverlayButtonTypeFragment on EGDSOverlayButton {
  accessibility
  primary
  disabled
  egdsElementId
  action {
    ...UILinkActionFragment
  }
  analytics {
    ...ClientSideAnalytics
  }
  icon {
    ...IconFragment
  }
}

fragment UITertiaryButtonFragment on UITertiaryButton {
  __typename
  disabled
  primary
  action {
    ... on UIFlightAction {
      __typename
      analytics {
        ...ClientAnalytics
      }
    }
  }
}

fragment MarkWrapperFragment on MarkWrapper {
  __typename
  mark {
    ...MarkFragments
  }
}

fragment IconWrapperFragment on IconWrapper {
  __typename
  iconA11yMessage: accessibilityMessage
  icons {
    ...IconSearch
  }
}

fragment SuperlativeTextFragment on SuperlativeText {
  __typename
  superlativeTextA11yMessage: accessibilityMessage
  text {
    ...EgdsTextFragment
  }
}

fragment BadgeWrapperFragment on BadgeWrapper {
  __typename
  badge {
    ...EGDSBadgeFragment
  }
}

fragment AdditionalInformationFragment on AdditionalInformation {
  __typename
  durationAndStop
  nextFlightOriginAirportInfo {
    ...FlightsIconAndLabel
  }
  layoverInfo {
    ...FlightsIconAndLabelFragment
  }
}

fragment FlightsConnectionInformationFragment on FlightsConnectionInformation {
  __typename
  flightsConnection {
    aircraftModel
    airlineInfo
    cabinClassAndBookingCode
    detailList {
      ...FlightsLabelAndValueFragment
    }
    connectionArrival {
      ...CoordinateInformationSearch
    }
    connectionDeparture {
      ...CoordinateInformationSearch
    }
    duration
    durationAccessibilityMessage
    journeyAmenities {
      ...FlightsJourneyAmenities
    }
    airlineDetails {
      ...FlightsMarkPhrasesFragment
    }
    badge {
      ...JourneyDetailsBadgeFragment
    }
    flightInfoLinks {
      ...FlightsLabelAndLinkFragment
    }
  }
}

fragment FlightsCategorizedListSectionFragment on FlightsCategorizedListSection {
  __typename
  flightsCategorizedListSectionA11yMessage: accessibilityMessage
  footnote
  heading
  additionalInfo
  items {
    ...FlightsCategorizedListItemFragment
  }
}

fragment FlightsExpandableCategorizedListSectionFragment on FlightsExpandableCategorizedListSection {
  __typename
  expando {
    ...EGDSExpandoFragment
  }
  expandoContent {
    ...FlightsCategorizedListSectionFragment
  }
}

fragment FarePricingFragment on FarePricing {
  __typename
  priceDisplay {
    ...FlightsPriceDisplayFragment
  }
  priceLockup {
    ...PriceLockupFragment
  }
  states
}

fragment FarePriceMatchPromiseSelectableCardFragment on FarePriceMatchPromiseSelectableCard {
  __typename
  checkbox {
    ...FlightsActionCheckboxFragment
  }
  headingSection {
    ...PriceMatchPromiseCardHeadingFragment
  }
  infoTrigger {
    ...FlightsDialogTriggerFragment
  }
  descriptionDetailsLinkTrigger {
    ...FlightsDialogTriggerFragment
  }
  price
  priceMatchPromiseState
  description
}

fragment FarePriceMatchPromiseRemovableCardFragment on FarePriceMatchPromiseRemovableCard {
  __typename
  heading {
    ...EGDSIconTextFragment
  }
  priceMatchPromiseState
  removeAction {
    ...FlightsActionLinkFragment
  }
  subHeading
}

fragment FarePriceMatchPromiseStaticCardFragment on FarePriceMatchPromiseStaticCard {
  __typename
  heading {
    ...EGDSIconTextFragment
  }
  priceMatchPromiseState
  subHeading
}

fragment FlightsIconAndLabelFragment on FlightsIconAndLabel {
  __typename
  icon {
    ...IconFragment
  }
  label
  subLabel
  accessibility
  value
  theme
  displayAnalyticsList {
    ...ClientSideAnalytics
  }
  subText {
    ... on EGDSStylizedText {
      decorative
      text
      theme
      weight
      size
    }
  }
}

fragment FlightsLabelAndValueFragment on FlightsLabelAndValue {
  __typename
  label
  value
  accessibilityMessage
}

fragment CoordinateInformationSearch on CoordinateInformation {
  icon {
    ...IconSearch
  }
  flightDetailsWarningInfo {
    ...FlightsIconAndLabel
  }
  subtitle
  titleAndAccessibilityMessage {
    flightsMessageAndAccessibilityA11yMessage: accessibilityMessage
    text
  }
  terminal {
    ...EgdsTextFragment
  }
  journeyDateTime {
    ...EgdsTextFragment
  }
  isLayoverAirport
}

fragment FlightsJourneyAmenities on FlightsJourneyAmenities {
  __typename
  accessibilityMessage
  title {
    ...EGDSStylizedTextFragment
  }
  amenities {
    ...FlightsIconAndLabel
  }
  analytics {
    ...FlightsAnalytics
  }
}

fragment FlightsMarkPhrasesFragment on FlightsMarkPhrases {
  accessibility
  mark {
    ...MarkFragments
  }
  text {
    accessibility
    completeText
    items {
      ...FlightsPhrasePartFragment
    }
  }
}

fragment FlightsLabelAndLinkFragment on FlightsLabelAndLink {
  label {
    ...EGDSSpannableTextFragment
  }
  linkInfo {
    ...FlightsExperienceActionLinkFragment
  }
}

fragment FlightsActionCheckboxFragment on FlightsActionCheckbox {
  label {
    ...EgdsTextFragment
  }
  clientAction {
    ...FlightsClickActionFragment
    ...InsuranceSwitchToggleAction
  }
  checkedAccessibility
  checkedAnalytics {
    ...ClientSideAnalytics
  }
  uncheckedAccessibility
  uncheckedAnalytics {
    ...ClientSideAnalytics
  }
}

fragment PriceMatchPromiseCardHeadingFragment on FarePriceMatchPromiseCardHeadingType {
  __typename
  ...EGDSBasicSectionHeadingFragment
  ...EGDSGraphicTextFragment
}

fragment FlightsClickActionFragment on FlightsClickAction {
  __typename
  analyticsList {
    __typename
    ...ClientSideAnalytics
  }
  accessibility
}

fragment InsuranceSwitchToggleAction on InsuranceSwitchToggleAction {
  insuranceCriteria {
    freePmpCustomerPlacement
    selectedProductId
  }
  jcidValue: jcid
  checkedAccessibilityAnnouncement
  uncheckedAccessibilityAnnouncement
}

fragment EGDSBasicSectionHeadingFragment on EGDSBasicSectionHeading {
  __typename
  heading {
    __typename
    ...EGDSHeadingFragment
  }
  graphic {
    ...UIGraphicFragment
  }
}`;
  }
});

// server/workers/parsers/expediaFlights.ts
function listingPrice(L) {
  for (const row of L?.priceDisplay?.rows || []) {
    for (const el of row?.elements || []) {
      if (el?.__typename === "FlightsPriceMessageItem") {
        const m = String(el?.price?.text || "").replace(/\s/g, "").match(/(₹|\$|€|£)?([\d,]+(?:\.\d+)?)/);
        if (m) {
          const n = Number(m[2].replace(/,/g, ""));
          if (Number.isFinite(n) && n > 0) return n;
        }
      }
    }
  }
  return 0;
}
function listingTimeline(L) {
  for (const s of L?.flightsShoppingOfferContent?.secondarySection || []) {
    if (s?.__typename === "FlightShoppingCardDurationTimeline" || s?.start && s?.end) return s;
  }
  return null;
}
function listingAirlineName(L) {
  for (const s of L?.flightsShoppingOfferContent?.secondarySection || []) {
    if (s?.__typename !== "EGDSTextSection") continue;
    for (const c of s?.contents || []) {
      const t = String(c?.text || "").trim();
      if (t && /\b(air|airlines?|indigo|vistara|airasia|akasa)\b/i.test(t) && !/→|-/.test(t)) return t;
    }
  }
  return "";
}
function listingLogo(L) {
  const g = L?.flightsShoppingOfferContent?.graphic;
  const url = g?.url?.value || g?.url?.relativePath || "";
  return String(url || "").replace(/^http:/, "https:");
}
function listingLegs(L) {
  const legs = [];
  const sections = (L?.journeys || [])[0]?.detailsAndFares?.content?.sections || [];
  for (const sec of sections) {
    if (sec?.__typename !== "FlightsJourneyDetailsInformation" && !sec?.content) continue;
    for (const jd of sec?.content || []) {
      if (!jd?.journeySections) continue;
      for (const js of jd.journeySections) {
        for (const jci of js?.journeyConnectionInformation || []) {
          const fc = jci?.flightsConnection;
          if (!fc) continue;
          let flightNo2 = "";
          for (const ph of fc?.airlineDetails?.text || []) {
            for (const it of ph?.items || []) {
              if (it?.__typename === "FlightsPhraseTextNode" && /^\s*[A-Z0-9]{2}\d{2,4}\s*$/.test(String(it?.text || ""))) {
                flightNo2 = String(it.text).trim();
                break;
              }
            }
            if (flightNo2) break;
          }
          if (!flightNo2) {
            const m = String(fc?.airlineInfo || "").match(/\b([A-Z0-9]{2})\s?(\d{2,4})\b/);
            if (m) flightNo2 = `${m[1]}${m[2]}`;
          }
          const dt = (side) => String((side?.journeyDateTime || [])[0]?.text || "").trim();
          legs.push({
            flightNo: flightNo2,
            dep: dt(fc?.connectionDeparture),
            depAirport: String(fc?.connectionDeparture?.subtitle || "").trim(),
            arr: dt(fc?.connectionArrival),
            arrAirport: String(fc?.connectionArrival?.subtitle || "").trim(),
            aircraft: String(fc?.aircraftModel || "").trim()
          });
        }
      }
    }
  }
  return legs;
}
function listingDuration(L) {
  const tl = listingTimeline(L);
  const pm = String(tl?.primaryMessage?.text || "").trim();
  if (pm) return pm;
  const sections = (L?.journeys || [])[0]?.detailsAndFares?.content?.sections || [];
  for (const sec of sections) {
    for (const jd of sec?.content || []) {
      for (const js of jd?.journeySections || []) {
        for (const jci of js?.journeyConnectionInformation || []) {
          const d = String(jci?.flightsConnection?.duration || "").replace(/^Travel time:\s*/i, "").trim();
          if (d) return d;
        }
      }
    }
  }
  return "";
}
function parseStops(v) {
  if (v == null) return "";
  const n = Number(v);
  if (Number.isFinite(n)) return n === 0 ? "non-stop" : `${n} stop${n > 1 ? "s" : ""}`;
  return String(v);
}
function parseExpediaFlights(body, source, route, dateIso, srpUrl, fx, cap = 40) {
  let d;
  try {
    d = JSON.parse(body);
  } catch {
    return [];
  }
  const listings = d?.data?.flightsSearch?.listingResult?.listings || [];
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const routeLabel = `${route.from} \u2192 ${route.to}`;
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const L of listings) {
    if (!L || !L.priceDisplay || !L.flightsShoppingOfferContent) continue;
    const usd = listingPrice(L);
    if (!usd) continue;
    const tl = listingTimeline(L);
    const legs = listingLegs(L);
    const dep = legs[0]?.dep || String(tl?.start?.primary || "").trim();
    const arr = (legs[legs.length - 1] || {}).arr || String(tl?.end?.primary || "").trim();
    if (!dep || !arr) continue;
    const airline = listingAirlineName(L) || (legs[0]?.flightNo || "").slice(0, 2);
    if (!airline) continue;
    const flightNos = legs.map((l) => l.flightNo).filter(Boolean);
    const flightNo2 = flightNos.join("/");
    const stops = parseStops(tl?.stops);
    const duration = listingDuration(L);
    const depAirport = legs[0]?.depAirport || "";
    const arrAirport = legs[legs.length - 1]?.arrAirport || "";
    const aircraft = legs.map((l) => l.aircraft).filter(Boolean)[0] || "";
    const key = `${airline}|${flightNo2}|${dep}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (out.length >= cap) break;
    const { price, currency, dataNote } = fx && fx.rate > 0 ? {
      price: Math.round(usd * fx.rate),
      currency: "INR",
      dataNote: `$${usd} listed on expedia.com, converted to INR at live USD/INR ${fx.rate} (${fx.source}); live fare observed on Expedia flight search on ${today2}. Fare may change at checkout.`
    } : {
      price: usd,
      currency: "USD",
      dataNote: `Live fare observed on Expedia flight search on ${today2}; listed in USD on expedia.com (FX rate unavailable, price unconverted). Fare may change at checkout.`
    };
    const logo = listingLogo(L);
    out.push(newRawItem(source, {
      title: `${airline}${flightNo2 ? ` ${flightNo2}` : ""} \xB7 ${routeLabel}`,
      brand: airline,
      price,
      currency,
      seller: "Expedia",
      sellerUrl: srpUrl,
      travel: { route: `${route.from.toLowerCase()} to ${route.to.toLowerCase()}` },
      attributes: {
        route: routeLabel,
        travel_date: dateIso,
        departure: dep,
        arrival: arr,
        ...depAirport && arrAirport ? { airports: `${depAirport} \u2192 ${arrAirport}` } : {},
        ...duration ? { duration } : {},
        ...stops ? { stops } : {},
        ...aircraft ? { aircraft } : {},
        ...logo ? { image_url: logo } : {},
        price_basis: "live fare observed on expedia.com flight search",
        data_note: dataNote,
        deep_link_ref: srpUrl
      },
      identifiers: { sku: `expedia-${flightNo2 || dep}-${dateIso}`.replace(/\s+/g, "-").toLowerCase() },
      evidence: {
        sourceUrl: srpUrl,
        extractedFields: ["listingResult.listings[].priceDisplay", "journeyConnectionInformation.flightsConnection", "FlightShoppingCardDurationTimeline"]
      }
    }));
  }
  return out;
}
var init_expediaFlights = __esm({
  "server/workers/parsers/expediaFlights.ts"() {
    init_contract();
  }
});

// server/workers/verticals/flights.ts
function routeFromQuery(raw) {
  const KNOWN_CODES = /* @__PURE__ */ new Set(["DEL", "BOM", "BLR", "HYD", "MAA", "CCU", "PNQ", "AMD", "JAI", "GOI", "LKO", "NAG", "IDR", "STV", "PAT", "BHO", "CJB", "COK", "GAU", "IXC", "DED", "ATQ", "VNS", "SXR", "TRV", "VTZ", "IXM", "UDR", "JDH", "IXR", "RPR", "BBI", "IMF", "IXL", "IXB", "IXU", "IXE", "BDQ", "RAJ", "IXJ", "IXD", "GOP", "JRG", "DIB", "TEZ", "KNU", "MYQ", "HBX", "IXG", "KLH", "ISK", "SAG", "TIR", "DXB", "SIN", "LHR", "JFK", "BKK", "KUL", "DOH", "AUH", "SHJ"]);
  raw = raw.replace(/\b([a-zA-Z][a-zA-Z.]{2,})\s+([A-Za-z]{3})\b(?!\s*\))/g, (full, city, code) => {
    if (/^(to|from|and|the|via)$/i.test(city)) return full;
    const up = code.toUpperCase();
    if (code === code.toUpperCase() || KNOWN_CODES.has(up)) return `${city} (${up})`;
    return full;
  });
  const m = raw.match(/([a-zA-Z][a-zA-Z\s.]{1,28}?(?:\s*\([A-Za-z]{3}\))?)\s+(?:to|→|->|-)\s+([a-zA-Z][a-zA-Z\s.]{1,28}(?:\s*\([A-Za-z]{3}\))?)/);
  if (!m) return null;
  const codeOf = (s) => s.match(/\(([A-Za-z]{3})\)/)?.[1]?.toUpperCase();
  const clean3 = (s) => s.replace(/\([^)]*\)/g, " ").replace(/\b(flight|flights|ticket|tickets|air|fly|from|cheapest|cheap|direct|return|one-way|oneway|round trip|airport)\b/gi, " ").replace(/\b(on|for|tomorrow|today|tonight|night|morning|evening|at)\b.*$/i, " ").replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b.*$/i, " ").replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b.*$/, " ").replace(/,.*$/, "").replace(/\s+/g, " ").trim();
  const from = clean3(m[1]);
  const to = clean3(m[2]);
  if (!from || !to) return null;
  return { from, to, fromCode: codeOf(m[1]), toCode: codeOf(m[2]) };
}
async function expediaFlightsSearch(ctx, rt, dIso) {
  const from = rt.fromCode || IATA[rt.from.toLowerCase().trim()] || null;
  const to = rt.toCode || IATA[rt.to.toLowerCase().trim()] || null;
  if (!from || !to) return [];
  const srpUrl = `https://www.expedia.com/Flights-Search?flight-type=oneway&from-date=${dIso}&from=${encodeURIComponent(`${rt.from} (${from})`)}&to=${encodeURIComponent(`${rt.to} (${to})`)}&search-type=arsed&mode=search`;
  let cookies;
  const primed = await cffiFetch(srpUrl, {
    impersonate: "safari",
    timeoutMs: 3e4,
    returnCookies: true,
    cookies,
    headers: { Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" }
  });
  cookies = primed.cookies || cookies;
  if (primed.status === 429 || primed.status === 200 && /Bot or Not\?/.test(primed.body.slice(0, 4e3))) {
    throw new AcquisitionError("ACCESS_CHALLENGE", `expedia.com SRP edge returned a bot challenge (HTTP ${primed.status})`, primed.status);
  }
  if (primed.status !== 200) throw new AcquisitionError("SERVER_ERROR", `expedia.com SRP HTTP ${primed.status}`, primed.status);
  const duaid = (primed.body.match(/"duaid":"([0-9a-f-]{36})"/) || [])[1] || cookies?.DUAID || "";
  const y = +dIso.slice(0, 4), mo = +dIso.slice(5, 7), da = +dIso.slice(8, 10);
  const payload = JSON.stringify({
    operationName: "FlightsSearchResultsLoadedQuery",
    query: EXPEDIA_FLIGHTS_QUERY,
    variables: {
      context: { currency: "USD", device: { type: "DESKTOP" }, eapid: 0, identity: { authState: "ANONYMOUS", duaid }, locale: "en_US", privacyTrackingState: "CAN_TRACK", siteId: 1, tpid: 1 },
      journeyCriteria: [{ departureDate: { day: da, month: mo, year: y }, destination: to, origin: from }],
      travelerDetails: [{ ages: null, count: 1, travelerType: "ADULT" }],
      searchPagination: { startingIndex: 0, size: 50 }
    }
  });
  const r = await cffiFetch("https://www.expedia.com/graphql", {
    method: "POST",
    impersonate: "safari",
    timeoutMs: 45e3,
    cookies,
    body: payload,
    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",
      Origin: "https://www.expedia.com",
      Referer: srpUrl,
      "client-info": "flights-shopping-pwa,f658986df5e0a55d154dc12eef2e7d34978e8f73,us-west-2",
      "x-page-id": "page.Flights-Search,F,20"
    }
  });
  if (r.status === 429) throw new AcquisitionError("ACCESS_CHALLENGE", "expedia.com flights GraphQL edge returned a bot challenge (HTTP 429)", 429);
  if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `expedia.com flights GraphQL HTTP ${r.status}: ${r.body.slice(0, 160)}`, r.status);
  const fx = await usdToInrRate();
  const items = parseExpediaFlights(r.body, ctx.source, { from: rt.from, to: rt.to, fromCode: from, toCode: to }, dIso, srpUrl, fx);
  if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", `expedia.com GraphQL returned no priced flight listings for ${from}-${to} on ${dIso}`);
  return items;
}
var URL_AP, flightsWorker;
var init_flights = __esm({
  "server/workers/verticals/flights.ts"() {
    init_verticalWorker();
    init_openflights();
    init_ixigoFlights();
    init_httpClient();
    init_emtFareCalendar();
    init_emtAirbus();
    init_airportLookup();
    init_kiwiFlights();
    init_indigoFlights();
    init_akasaFlights();
    init_viaFlights();
    init_yatraFlights();
    init_goibiboFlights();
    init_mmtFareCalendar();
    init_cleartripFlights();
    init_expediaFlightsQuery();
    init_expediaFlights();
    init_fxRates();
    init_curlCffiFetch();
    URL_AP = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat";
    flightsWorker = {
      vertical: "flights",
      tasks: [
        {
          // EaseMyTrip AirBus_New flight search (reverse-engineered from EMT's public
          // Angular bundles): token flow GIT->GUT, then one POST returns EVERY flight
          // on the route/date with real INR fares. Works for ANY world route (EMT's
          // engine sells foreign carriers too). Seller = EaseMyTrip — the website
          // selling the ticket (owner policy 15 Oct: seller is the selling site,
          // never the operating airline); deeplink = EMT's own search page. The old
          // fare calendar stays as fallback when the search API is unavailable.
          sourceId: "w_flights_emt",
          name: "Flights worker: per-flight live fares via EMT search API (worldwide, seller = EaseMyTrip)",
          priority: 14,
          maxPerMinute: 2,
          timeoutMs: 4e4,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || "");
            const rt = routeFromQuery(raw);
            if (!rt) return [];
            const fromA = await resolveAirport(rt.from, rt.fromCode);
            const toA = await resolveAirport(rt.to, rt.toCode);
            const from = fromA.code;
            const to = toA.code;
            if (!from || !to) return [];
            const dIso = ctx.query?.travelDates?.depart && /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.travelDates.depart) ? ctx.query.travelDates.depart : new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
            const wantDate = dIso.split("-").reverse().join("/");
            let stk = "";
            try {
              const rGit = await cffiFetch("https://gi.easemytrip.com/etm/api/etoken/GIT", {
                impersonate: "chrome",
                timeoutMs: 1e4,
                method: "POST",
                body: "{}",
                headers: {
                  "Content-Type": "application/json; charset=utf-8",
                  Accept: "application/json",
                  Origin: "https://www.easemytrip.com",
                  Referer: "https://www.easemytrip.com/flight-search/listing",
                  ATK: "c0ruxuOD/XqyNXB3kRAqvRUliyqhyFOOUwgDTCP1tLx09TRNEbblvRQLgfPz2ivf"
                }
              });
              const git = JSON.parse(rGit.body || "{}");
              if (!git.ITK || !git.b) throw new Error("GIT token missing");
              const autk = emtEncrypt(`EMT|EMTWvggk6zYLVynBA56C3aNn4HLREMHV9bEP9Q|${git.b}|${git.ITK}`);
              const rGut = await cffiFetch("https://gi.easemytrip.com/etm/api/etoken/GUT", {
                impersonate: "chrome",
                timeoutMs: 1e4,
                method: "POST",
                body: JSON.stringify({ UserName: "EMT", ITK: emtEncrypt(git.ITK), IP: emtEncrypt(git.b) }),
                headers: {
                  "Content-Type": "application/json; charset=utf-8",
                  Accept: "application/json",
                  Origin: "https://www.easemytrip.com",
                  Referer: "https://www.easemytrip.com/flight-search/listing",
                  autk
                }
              });
              const gut = JSON.parse(rGut.body || "{}");
              if (!gut.STK) throw new Error("GUT STK missing");
              stk = gut.STK;
            } catch (e) {
              stk = "";
            }
            if (stk) {
              const traceId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
              const body2 = JSON.stringify({
                org: from,
                dept: to,
                deptDT: dIso,
                arrDT: "",
                adt: 1,
                chd: 0,
                inf: 0,
                isDomestic: true,
                isOneway: true,
                airline: "Any",
                Cabin: 3,
                currCode: "INR",
                appType: 1,
                isSingleView: false,
                ResType: 2,
                userid: "",
                IsDoubelSeat: false,
                IsArmedForce: false,
                IsFareFamily: false,
                IsNBA: false,
                CouponCode: "",
                AgentCode: "",
                IsWLAPP: false,
                serviceid: "EMTSERVICE",
                serviceDepatment: "",
                IpAddress: "",
                LoginKey: "",
                UUID: "",
                TKN: stk,
                TraceId: traceId,
                queryname: traceId
              });
              const r2 = await cffiFetch("https://flightservice-node.easemytrip.com/AirAvail_Lights/AirBus_New", {
                impersonate: "chrome",
                timeoutMs: 3e4,
                method: "POST",
                body: body2,
                headers: {
                  "Content-Type": "application/json; charset=utf-8",
                  Accept: "application/json",
                  Origin: "https://www.easemytrip.com",
                  Referer: "https://www.easemytrip.com/flight-search/listing"
                }
              });
              if (r2.status === 403 || r2.status === 429) {
                throw new AcquisitionError(r2.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED", `EMT search API blocked: HTTP ${r2.status}`, r2.status);
              }
              if (r2.status === 200) {
                let flights = [];
                try {
                  flights = parseEmtAirbus(r2.body);
                } catch {
                  flights = [];
                }
                const items2 = emtAirbusItems(flights, ctx.source, { from: rt.from, to: rt.to }, from, to, dIso, fromA.country, toA.country);
                if (items2.length) return items2;
              }
            }
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
            if (!fares.length) throw new AcquisitionError("EMPTY_RESPONSE", "EMT returned no fares for this route (search API and calendar both empty)");
            const items = emtFareItems(fares, ctx.source, { from: rt.from, to: rt.to }, wantDate, from, to);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", "EMT had no fare with a known Indian carrier for this route");
            return items;
          }
        },
        {
          // Ixigo SSRs the flight search page: __NEXT_DATA__ ships up to 100
          // real flight entries for the date (airline, flight number, total
          // fare, times, stops). Any world city works (IATA tokens resolved
          // globally). Seller = Ixigo, the ticket-selling website.
          sourceId: "w_flights_ixigo",
          name: "Flights worker: real fares via Ixigo SSR (worldwide, seller = Ixigo)",
          priority: 1,
          maxPerMinute: 6,
          timeoutMs: 35e3,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || ctx.query.entityName || "");
            const rt = routeFromQuery(raw);
            if (!rt) return [];
            const dep = ctx.query?.travelDates?.depart && /\d{4}-\d{2}-\d{2}/.test(ctx.query.travelDates.depart) ? ctx.query.travelDates.depart : new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
            const fromA = await resolveAirport(rt.from, rt.fromCode);
            const toA = await resolveAirport(rt.to, rt.toCode);
            const { fromTok, toTok, alts } = ixigoRouteTokens(rt.from, rt.to, fromA.code || rt.fromCode, toA.code || rt.toCode, IATA);
            const url = `https://www.ixigo.com/search/flight/${fromTok}/${toTok}/${dep}/1/0`;
            let res = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 3e4 });
            if (res.status === 403 || res.status === 429) {
              throw new AcquisitionError(res.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED", `Ixigo blocked: ${res.status}`, res.status);
            }
            if (res.status === 404) {
              for (const altFrom of alts) {
                const r2 = await cffiFetch(`https://www.ixigo.com/search/flight/${altFrom}/${toTok}/${dep}/1/0`, { impersonate: "chrome", timeoutMs: 3e4 });
                if (r2.status === 200) {
                  res = r2;
                  break;
                }
              }
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
            return parseIxigoOffers(flights, ctx.source, rt.from, rt.to, dep, url);
          }
        },
        {
          // Expedia flights (flights-shopping-pwa GraphQL): the SRP app POSTs
          // FlightsSearchResultsLoadedQuery to /graphql — we replay the exact
          // document the PWA ships (73KB, all fragments) after priming the SRP
          // with safari TLS. Real per-flight USD fares converted honestly via
          // live FX. Expedia is the price-owning OTA: seller = Expedia and the
          // deeplink goes to expedia.com (owner deeplink policy), with a
          // data_note crediting where the fare was observed.
          sourceId: "w_flights_expedia",
          name: "Flights worker: Expedia live fares (flights-shopping-pwa GraphQL)",
          priority: 8,
          maxPerMinute: 2,
          timeoutMs: 5e4,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || ctx.query.entityName || "");
            const rt = routeFromQuery(raw);
            if (!rt) return [];
            const dIso = ctx.query?.travelDates?.depart && /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.travelDates.depart) ? ctx.query.travelDates.depart : new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
            const rt2 = { ...rt, fromCode: (await resolveAirport(rt.from, rt.fromCode)).code || rt.fromCode, toCode: (await resolveAirport(rt.to, rt.toCode)).code || rt.toCode };
            return expediaFlightsSearch(ctx, rt2, dIso);
          }
        },
        {
          // Kiwi.com flights (umbrella/v2 GraphQL, cracked 15 Oct 2026 — no auth,
          // ~800ms, INR prices, works for ANY world route). Seller = Kiwi.com, the
          // ticket-selling website; operating airline stays in title/brand per owner
          // policy. Deeplink = Kiwi's per-itinerary booking URL (its own token).
          sourceId: "w_flights_kiwi",
          name: "Flights worker: Kiwi.com worldwide live fares (seller = Kiwi.com)",
          priority: 12,
          maxPerMinute: 2,
          timeoutMs: 4e4,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || "");
            const rt = routeFromQuery(raw);
            if (!rt) return [];
            const fromA = await resolveAirport(rt.from, rt.fromCode);
            const toA = await resolveAirport(rt.to, rt.toCode);
            const from = fromA.code;
            const to = toA.code;
            if (!from || !to) return [];
            const dIso = ctx.query?.travelDates?.depart && /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.travelDates.depart) ? ctx.query.travelDates.depart : new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
            const res = await kiwiSearch(from, to, dIso);
            if (res === null) throw new AcquisitionError("ACCESS_CHALLENGE", `kiwi.com graphql HTTP 403/429 for ${from}-${to} on ${dIso}`, 403);
            const items = kiwiItems(res.itineraries, ctx.source, { from: rt.from, to: rt.to }, from, to, dIso);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", `kiwi.com returned no itineraries departing ${from}-${to} on ${dIso} (search total ${res.total})`);
            return items;
          }
        },
        // ---- Owner-mandated flights sources: attempted live on every search, honestly reported ----
        {
          // MMT LIVE (21 Oct 2026): the SRP HTML + search-stream-dt SSE remain
          // Akamai sensor-gated from datacenter IPs (6B stub / 403), but
          // flights-cb.makemytrip.com/api/fareCalendar is OPEN browserless and
          // returns a full-year per-date lowest-fare calendar with the cheapest
          // airline named per date (verified: BOM-DEL 28 Oct 2026 "₹ 6,638" IndiGo,
          // 364 date keys). Same honest calendar pattern as Via.com/Akasa workers.
          // The SSE per-flight recipe (search-stream-dt + X-Cb-Preauth from SRP
          // window.__PRE_AUTH__, 17 Oct recon) stays documented here for the day a
          // clean IP mints the preauth; the calendar already delivers real MMT
          // fares today. Self-healing: a 403/edge-block here is reported honestly.
          sourceId: "w_flights_makemytrip",
          name: "Flights worker: MakeMyTrip fare calendar (flights-cb API)",
          priority: 15,
          maxPerMinute: 4,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || ctx.query.entityName || "");
            const rt = routeFromQuery(raw);
            if (!rt) return [];
            const fromA = await resolveAirport(rt.from, rt.fromCode);
            const toA = await resolveAirport(rt.to, rt.toCode);
            if (!fromA.code || !toA.code) return [];
            const dep = ctx.query?.travelDates?.depart && /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.travelDates.depart) ? ctx.query.travelDates.depart : new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
            const depCompact = dep.replace(/-/g, "");
            const url = mmtFareCalendarUrl(fromA.code, toA.code, depCompact);
            const r = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 25e3, headers: mmtCalendarHeaders(fromA.code, toA.code, depCompact) });
            if (r.status === 403 || r.status === 429) {
              throw new AcquisitionError("ACCESS_CHALLENGE", `MMT fare-calendar edge-blocked from this IP (HTTP ${r.status}). SRP SSE recipe ready: search-stream-dt + X-Cb-Preauth (17 Oct recon).`, r.status);
            }
            if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `MMT fare-calendar HTTP ${r.status}`, r.status);
            const fares = parseMmtFareCalendar(r.body);
            if (!fares.length) throw new AcquisitionError("EMPTY_RESPONSE", `MMT fare-calendar returned no fares for ${fromA.code}-${toA.code}`);
            return mmtDayFareItems(fares, ctx.source, rt.from, rt.to, fromA.code, toA.code, dep);
          }
        },
        {
          // Goibibo LIVE (17 Oct 2026): the SPA search tarpits on datacenter IPs, but
          // the SEO route landing pages are SERVER-RENDERED with the full listing
          // state in __NEXT_DATA__ (props.pageProps.data.state.listing): real per-flight
          // total INR fares, airline names, times, stops, and the page's own service
          // date (itinerary DEL-BOM-20/10/2026). Every offer is labelled with that
          // real date. Discovered via browser recon + verified browserless.
          sourceId: "w_flights_goibibo",
          name: "Flights worker: Goibibo SSR route-page fares",
          priority: 9,
          maxPerMinute: 4,
          timeoutMs: 35e3,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || ctx.query.entityName || "");
            const rt = routeFromQuery(raw);
            if (!rt) return [];
            const fromA = await resolveAirport(rt.from, rt.fromCode);
            const toA = await resolveAirport(rt.to, rt.toCode);
            if (!fromA.code || !toA.code) return [];
            const url = goibiboRouteUrl(rt.from, rt.to);
            const giHeaders = {
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              Referer: "https://www.google.com/"
            };
            let r;
            const lastErr = [];
            const attempts = [
              { label: "chrome-h2", opts: { impersonate: "chrome", timeoutMs: 3e4, headers: giHeaders } },
              { label: "chrome-h1", opts: { impersonate: "chrome", timeoutMs: 25e3, headers: giHeaders, httpVersion: "1.1" } },
              { label: "safari-h2", opts: { impersonate: "safari17_0", timeoutMs: 25e3, headers: giHeaders } }
            ];
            for (const a of attempts) {
              try {
                r = await cffiFetch(url, a.opts);
                if (r.status < 500) break;
                lastErr.push(`${a.label}: HTTP ${r.status}`);
                r = void 0;
              } catch (e) {
                lastErr.push(`${a.label}: ${String(e?.message || e).slice(0, 120)}`);
                r = void 0;
              }
            }
            if (!r) throw new AcquisitionError("SERVER_ERROR", `Goibibo route page unreachable after 3 attempts (${lastErr.join(" | ")})`);
            if (r.status === 404) return [];
            if (r.status === 403 || r.status === 429) {
              throw new AcquisitionError(r.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED", `Goibibo edge-blocked the route page (HTTP ${r.status}).`, r.status);
            }
            if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Goibibo route page HTTP ${r.status}`, r.status);
            const items = parseGoibiboSsr(r.body, ctx.source, url, rt.from, rt.to);
            if (!items.length) return [];
            items.sort((a, b) => (Number(a.price) || Infinity) - (Number(b.price) || Infinity));
            return items.slice(0, 40);
          }
        },
        {
          // Yatra FULL PER-FLIGHT (17 Oct 2026): the air-service JSON API behind the
          // Angular SRP is OPEN browserless (no cookie/sensor handshake; verified
          // from datacenter IPs). Flow: GET /air-service/dom2/trigger (mints the
          // searchId AND returns the first result batch), then per-airline polls
          // /air-service/dom2/poll?polling_id=<searchId>_<supplier> for 5 suppliers.
          // Fallback: the 60-day lowest-fare calendar. Discovered via live-browser
          // network capture; replayed and verified with curl_cffi only.
          sourceId: "w_flights_yatra",
          name: "Flights worker: Yatra live per-flight search (air-service API)",
          priority: 8,
          maxPerMinute: 3,
          timeoutMs: 45e3,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || ctx.query.entityName || "");
            const rt = routeFromQuery(raw);
            if (!rt) return [];
            const fromA = await resolveAirport(rt.from, rt.fromCode);
            const toA = await resolveAirport(rt.to, rt.toCode);
            const from = fromA.code;
            const to = toA.code;
            if (!from || !to) return [];
            if (!IATA[rt.from.toLowerCase().trim()] || !IATA[rt.to.toLowerCase().trim()]) return [];
            const dep = ctx.query?.travelDates?.depart && /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.travelDates.depart) ? ctx.query.travelDates.depart : new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
            const routeKey = `${from}${to}${dep.replace(/-/g, "")}`;
            const srp = yatraSrpUrl3(from, to, dep);
            const hdrs = {
              Accept: "application/json, text/plain, */*",
              Referer: "https://flight.yatra.com/air-search-ui/dom2/trigger",
              "X-Requested-With": "XMLHttpRequest"
            };
            const t0 = await cffiFetch(yatraTriggerUrl(from, to, dep), { impersonate: "chrome", timeoutMs: 3e4, headers: hdrs });
            if (t0.status === 403 || t0.status === 429) {
              throw new AcquisitionError(t0.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED", `Yatra air-service edge-blocked (HTTP ${t0.status}).`, t0.status);
            }
            if (t0.status >= 500) throw new AcquisitionError("SERVER_ERROR", `Yatra air-service HTTP ${t0.status}`, t0.status);
            if (t0.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Yatra air-service HTTP ${t0.status}: ${(t0.body || "").slice(0, 120)}`, t0.status);
            let items = parseYatraBatch(t0.body, ctx.source, srp, routeKey, rt.from, rt.to);
            const sidMatch = t0.body.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
            const sid = sidMatch ? sidMatch[0] : "";
            if (sid) {
              for (const sup of YATRA_SUPPLIERS) {
                try {
                  const r = await cffiFetch(
                    `https://flight.yatra.com/air-service/dom2/poll?polling_id=${sid}_${sup}&_i=${Date.now()}`,
                    { impersonate: "chrome", timeoutMs: 2e4, headers: hdrs }
                  );
                  if (r.status === 200) {
                    items = items.concat(parseYatraBatch(r.body, ctx.source, srp, routeKey, rt.from, rt.to));
                  }
                } catch {
                }
              }
            }
            const bySku = /* @__PURE__ */ new Map();
            for (const it of items) bySku.set(String(it.identifiers?.sku || it.title), it);
            const deduped = [...bySku.values()].sort((a, b) => (Number(a.price) || Infinity) - (Number(b.price) || Infinity));
            if (deduped.length) return deduped.slice(0, 40);
            try {
              const to2 = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
              const c = await cffiFetch(yatraCalendarUrl(from, to, dep.slice(0, 10), to2), { impersonate: "chrome", timeoutMs: 2e4, headers: hdrs });
              if (c.status === 200) {
                const cal = yatraCalendarItems(c.body, ctx.source, rt.from, rt.to, from, to, dep);
                if (cal.length) return cal.slice(0, 10);
              }
            } catch {
            }
            return [];
          }
        },
        {
          // Cleartrip LIVE (17 Oct): GET /flight/search/v2 (desktop search API) returns
          // the full fare matrix browserless — headers lifted from Cleartrip's own
          // Next.js bundle (x-client-id cleartrip, channel desktop, caller UI,
          // x-unified-header with uuid trackingId). 194 cards DEL-BOM with real INR
          // totals, base+tax split, times, stops, live coupon text. Old "client-side
          // only" verdict superseded.
          sourceId: "w_flights_cleartrip",
          name: "Flights worker: Cleartrip live fares (search v2 API)",
          priority: 8,
          maxPerMinute: 4,
          timeoutMs: 35e3,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || ctx.query.entityName || "");
            const rt = routeFromQuery(raw);
            if (!rt) return [];
            const fromA = await resolveAirport(rt.from, rt.fromCode);
            const toA = await resolveAirport(rt.to, rt.toCode);
            if (!fromA.code || !toA.code) return [];
            const dep = ctx.query?.travelDates?.depart && /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.travelDates.depart) ? ctx.query.travelDates.depart : new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
            const dmy = dep.split("-").reverse().join("/");
            const url = cleartripSearchUrl(fromA.code, toA.code, dmy);
            let r;
            try {
              r = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 3e4, headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "x-client-id": "cleartrip",
                "x-source-type": "Desktop",
                channel: "desktop",
                "app-agent": "DESKTOP",
                caller: "UI",
                "x-unified-header": JSON.stringify({ platform: "desktop", trackingId: crypto.randomUUID?.() || String(Date.now()), source: "CLEARTRIP" }),
                Referer: "https://www.cleartrip.com/flights"
              } });
            } catch (e) {
              throw new AcquisitionError("SERVER_ERROR", `Cleartrip search API unreachable: ${String(e?.message || e)}`);
            }
            if (r.status === 403 || r.status === 429) {
              throw new AcquisitionError(r.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED", `Cleartrip edge-blocked search v2 (HTTP ${r.status}).`, r.status);
            }
            if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Cleartrip search v2 HTTP ${r.status}`, r.status);
            const items = parseCleartripFlights(r.body, ctx.source, rt.from, rt.to, dep);
            if (!items.length) return [];
            items.sort((a, b) => (Number(a.price) || Infinity) - (Number(b.price) || Infinity));
            return items.slice(0, 40);
          }
        },
        {
          // IndiGo 6E official mobile flight-search API, reverse-engineered from the
          // Android app's Hermes bundle (browserless; static app user_key, no login):
          // POST api-prod-mobile-skyplus6e.goindigo.in/flightsearch/v1/flight/search.
          sourceId: "w_flights_indigo",
          name: "Flights worker: IndiGo 6E live fares (official app API)",
          priority: 6,
          maxPerMinute: 2,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || ctx.query.entityName || "");
            const rt = routeFromQuery(raw);
            if (!rt) return [];
            const from = (await resolveAirport(rt.from, rt.fromCode)).code;
            const to = (await resolveAirport(rt.to, rt.toCode)).code;
            if (!from || !to) return [];
            const dep = ctx.query?.travelDates?.depart && /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.travelDates.depart) ? ctx.query.travelDates.depart : new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
            const beginDate = dep.replace(/-/g, "");
            const body = JSON.stringify({
              criteria: [{
                dates: { beginDate, endDate: beginDate },
                flightFilters: { type: "All" },
                stations: { originStationCodes: [from], destinationStationCodes: [to] }
              }],
              tripType: "ONE_WAY",
              currencyCode: "INR",
              paxInfo: { travelPurpose: "", adultCount: 1, childrenCount: 0, infantCount: 0, seniorCitizenCount: 0, extraSeat: 0 },
              specialFare: "",
              promoCode: "",
              bookingPurpose: "",
              marketType: "",
              doubleSeatSelected: false,
              tripleSeatSelected: false,
              selectedTripIndex: 0
            });
            let r;
            try {
              r = await cffiFetch("https://api-prod-mobile-skyplus6e.goindigo.in/flightsearch/v1/flight/search", {
                impersonate: "chrome",
                timeoutMs: 28e3,
                method: "POST",
                body,
                headers: {
                  "user_key": "43b557c03fc85cc213e91df0f526cc7a",
                  // static app key shipped inside the public APK
                  "Content-Type": "application/json",
                  "Accept": "application/json"
                }
              });
            } catch (e) {
              throw new AcquisitionError("SERVER_ERROR", `IndiGo API unreachable: ${String(e?.message || e)}`);
            }
            if (r.status === 403 || r.status === 429) {
              try {
                const dayFares = await indigoWebFareCalendar(cffiFetch, from, to, dep);
                const calItems = indigoDayFareItems(dayFares, ctx.source, rt.from, rt.to, from, to, dep);
                if (calItems.length) return calItems;
              } catch {
              }
              throw new AcquisitionError(
                r.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED",
                `IndiGo mobile search API edge-blocked (Akamai ${r.status}) and web fare calendar returned no fare for this route/date.`,
                r.status
              );
            }
            if (r.status === 400 || r.status === 404 || r.status >= 500) {
              throw new AcquisitionError("SERVER_ERROR", `IndiGo API HTTP ${r.status}: ${(r.body || "").slice(0, 180)}`, r.status);
            }
            const flights = r.status === 200 ? parseIndigoSearch(r.body) : [];
            if (flights.length > 0) return indigoItems(flights, ctx.source, rt.from, rt.to, from, to, dep);
            try {
              const dayFares = await indigoWebFareCalendar(cffiFetch, from, to, dep);
              const calItems = indigoDayFareItems(dayFares, ctx.source, rt.from, rt.to, from, to, dep);
              if (calItems.length) return calItems;
            } catch {
            }
            const snippet = (r.body || "").replace(/\s+/g, " ").slice(0, 220);
            throw new AcquisitionError("EMPTY_RESPONSE", `IndiGo API no priced 6E flights for ${from}-${to} ${dep} (HTTP ${r.status}) body: ${snippet}`);
          }
        },
        {
          // Akasa Air official low-fare calendar (their own booking API, browserless):
          // GET /api/ibe/availability/v2/search returns a 61-day XML calendar of the
          // lowest Akasa fare per date for the route. Akasa is the operating airline,
          // so seller = Akasa Air and the deeplink goes to Akasa's booking flow.
          // The per-flight availability/search POST needs a generateToken call that
          // is edge-blocked (nginx 403) from datacenter IPs — calendar only.
          sourceId: "w_flights_akasa",
          name: "Flights worker: Akasa Air live fares (official IBE fare calendar)",
          priority: 7,
          maxPerMinute: 2,
          timeoutMs: 25e3,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || ctx.query.entityName || "");
            const rt = routeFromQuery(raw);
            if (!rt) return [];
            const fromA = await resolveAirport(rt.from, rt.fromCode);
            const toA = await resolveAirport(rt.to, rt.toCode);
            const from = fromA.code;
            const to = toA.code;
            if (!from || !to) return [];
            if (!IATA[rt.from.toLowerCase().trim()] || !IATA[rt.to.toLowerCase().trim()]) return [];
            const dep = ctx.query?.travelDates?.depart && /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.travelDates.depart) ? ctx.query.travelDates.depart : new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
            let r;
            try {
              r = await cffiFetch(akasaFareCalendarUrl(from, to, dep), {
                impersonate: "chrome",
                timeoutMs: 22e3,
                headers: { Origin: "https://www.akasaair.com", Referer: "https://www.akasaair.com/booking" }
              });
            } catch (e) {
              throw new AcquisitionError("SERVER_ERROR", `Akasa Air API unreachable: ${String(e?.message || e)}`);
            }
            if (r.status === 403 || r.status === 429) {
              throw new AcquisitionError(
                r.status === 403 ? "ACCESS_CHALLENGE" : "RATE_LIMITED",
                `Akasa Air fare-calendar API edge-blocked (HTTP ${r.status}).`,
                r.status
              );
            }
            if (r.status === 400 || r.status >= 500) {
              throw new AcquisitionError("SERVER_ERROR", `Akasa Air API HTTP ${r.status}: ${(r.body || "").replace(/\s+/g, " ").slice(0, 180)}`, r.status);
            }
            if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Akasa Air API HTTP ${r.status}`, r.status);
            const fares = parseAkasaFareCalendar(r.body);
            const items = akasaDayFareItems(fares, ctx.source, rt.from, rt.to, from, to, dep);
            return items;
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
        },
        // ---- Owner-requested flight sources (17 Oct 2026): Via.com LIVE, HEG/Paytm/Amazon honest probes ----
        {
          // Via.com: the B2C site's own fare-calendar API (open; public bundle authToken).
          // Per-flight results (/itinerary) 502 for browserless HTTP; the calendar gives
          // real per-day lowest fares for the route (~267-day window), like EMT/IndiGo/Akasa.
          sourceId: "w_flights_via",
          name: "Flights worker: Via.com fare calendar (B2C apiv2)",
          priority: 14,
          maxPerMinute: 6,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || ctx.query.entityName || "");
            const rt = routeFromQuery(raw);
            if (!rt) return [];
            const from = (await resolveAirport(rt.from, rt.fromCode)).code;
            const to = (await resolveAirport(rt.to, rt.toCode)).code;
            if (!from || !to) return [];
            const dep = ctx.query?.travelDates?.depart && /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.travelDates.depart) ? ctx.query.travelDates.depart : new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
            const endDate = new Date(Date.now() + 330 * 864e5).toISOString().slice(0, 10);
            const body = JSON.stringify({ src: from, dest: to, startDate: dep, endDate, fareType: "b2c", oneWay: true });
            const r = await cffiFetch(viaFareCalendarUrl(), {
              method: "POST",
              impersonate: "chrome",
              timeoutMs: 2e4,
              body,
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
                Referer: "https://in.via.com/flight-tickets",
                Origin: "https://in.via.com"
              }
            });
            if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Via.com fare-calendar HTTP ${r.status}`, r.status);
            const fares = parseViaFareCalendar(r.body);
            if (!fares.length) throw new AcquisitionError("EMPTY_RESPONSE", "Via.com fare-calendar returned no fares for this route");
            return viaDayFareItems(fares, ctx.source, rt.from, rt.to, from, to, dep);
          }
        },
        {
          // HappyEasyGo: flight.happyeasygo.com no longer resolves; www.happyeasygo.com/flight/
          // is a Vue/Nuxt client-rendered shell with no browserless API (apiproxy/apipro DNS dead).
          sourceId: "w_flights_happyeasygo",
          name: "Flights worker: HappyEasyGo (probe)",
          priority: 24,
          run: async () => {
            const res = await cffiFetch("https://www.happyeasygo.com/flight/", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError(
              res.status === 200 ? "EMPTY_RESPONSE" : "ACCESS_CHALLENGE",
              "HappyEasyGo flight search renders client-side only (flight.happyeasygo.com no longer resolves); no SSR fares and no open browserless API \u2014 no real prices to acquire."
            );
          }
        },
        {
          // Paytm flights: travel.paytm.com is Akamai-403 from datacenter IPs on all
          // fingerprints; paytm.com/flight-tickets is a client-rendered marketing shell.
          sourceId: "w_flights_paytm",
          name: "Flights worker: Paytm (probe)",
          priority: 25,
          run: async () => {
            const res = await cffiFetch("https://travel.paytm.com/flights/", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError(
              res.status === 403 ? "ACCESS_CHALLENGE" : "EMPTY_RESPONSE",
              res.status === 403 ? "Paytm travel (travel.paytm.com) denies datacenter IPs at the Akamai edge (403 on all TLS fingerprints); flight search loads only via sessioned app APIs." : "Paytm flights page rendered no SSR fares to browserless HTTP."
            );
          }
        },
        {
          // Amazon India does not have a flight booking product (recon 17 Oct 2026):
          // amazon.in/flights serves a generic page, /flight-search and /gp/flight-search are 404.
          sourceId: "w_flights_amazon",
          name: "Flights worker: Amazon India (no flights product)",
          priority: 26,
          run: async () => {
            throw new AcquisitionError(
              "EMPTY_RESPONSE",
              "Amazon India does not offer flight booking (no flights product exists on amazon.in; /flights is a generic page and /flight-search is 404) \u2014 no real fares to acquire, never fabricated."
            );
          }
        }
      ]
    };
    registerVerticalWorker(flightsWorker);
  }
});

// server/workers/parsers/zomato.ts
function parseZomatoRestaurants(html, source, searchUrl, platform) {
  const fingerprint = (0, import_crypto7.createHash)("sha256").update(html.slice(0, 5e4)).digest("hex");
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
  if (!node || depth > 22) return;
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
  if (!t && typeof node.name === "string" && (node.display_price !== void 0 || node.default_price !== void 0 || node.min_price !== void 0) && node.id) {
    const p = Number(node.price) > 0 ? Number(node.price) : Number(node.display_price ?? node.default_price ?? node.min_price);
    const nm = node.name.trim();
    if (Number.isFinite(p) && p >= 10 && p <= 12e3 && nm.length >= 3 && nm.length <= 160) {
      const img = String(node.item_image_url || "").replace(/^http:/, "https:");
      out.push({
        name: nm.slice(0, 160),
        price: Math.round(p),
        description: node.desc ? String(node.desc).slice(0, 200) : void 0,
        image: /^https:\/\//.test(img) ? img.split("?")[0] : void 0,
        veg: typeof node.is_veg === "boolean" ? node.is_veg : void 0
      });
    }
    return;
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
  const byKey = /* @__PURE__ */ new Map();
  const add = (d) => {
    const k = `${d.name.toLowerCase()}|${d.price}`;
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, d);
      dishes.push(d);
      return;
    }
    if (!prev.image && d.image) prev.image = d.image;
    if (!prev.description && d.description) prev.description = d.description;
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
  const wrapped = /window\.__PRELOADED_STATE__\s*=\s*JSON\.parse\("((?:[^"\\]|\\.)*)"\)/.exec(html);
  if (wrapped) {
    hints.preloadedState += 1;
    try {
      const tmp = [];
      walkMenuJson(JSON.parse(JSON.parse('"' + wrapped[1] + '"')), tmp);
      tmp.forEach(add);
    } catch (e) {
      if (process.env.ZOMATO_DEBUG) console.error("zomato state parse", e.message);
    }
    if (dishes.length) return { dishes, hints };
  }
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
  return { dishes: dishes.slice(0, 400), hints };
}
var import_crypto7;
var init_zomato = __esm({
  "server/workers/parsers/zomato.ts"() {
    import_crypto7 = require("crypto");
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
  const fingerprint = (0, import_crypto8.createHash)("sha256").update(json.slice(0, 5e4)).digest("hex");
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
var import_crypto8, IMG;
var init_swiggy = __esm({
  "server/workers/parsers/swiggy.ts"() {
    import_crypto8 = require("crypto");
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
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
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
      price_basis: `dominos.co.in web menu price (${matchNote}), scraped ${today2}`,
      data_note: `Price from Domino's India national web menu on ${today2}; final price at checkout may vary by city/store`
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

// server/workers/parsers/pizzaHut.ts
function sizeLabel(p) {
  const parts = [];
  if (p.size && p.size !== "medium") parts.push(String(p.size));
  if (p.crust) parts.push(String(p.crust).split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "));
  return parts.join(", ");
}
function pizzaHutItems(rawBody, source, query, pageUrl) {
  const m = rawBody.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  let root;
  try {
    root = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const kinds = root?.props?.pageProps?.itemsByKind || [];
  const products = [];
  const seen = /* @__PURE__ */ new Set();
  for (const kind of kinds) {
    for (const p of kind?.products || []) {
      const title = String(p?.title || "").trim();
      const price = Number(p?.price);
      if (!title || !Number.isFinite(price) || price <= 0) continue;
      const key = `${title}|${p.size || ""}|${price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      products.push(p);
    }
  }
  const q3 = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const words = q3.split(" ").filter((w) => w.length > 2 && !["the", "and", "for", "with", "order", "buy", "price"].includes(w));
  const scored = products.map((p) => {
    const hay = `${p.title} ${p.desc || ""} ${p.type || ""} ${sizeLabel(p)}`.toLowerCase();
    let score = 0;
    for (const w of words) if (hay.includes(w)) score += 1;
    if (q3 && hay.includes(q3)) score += 3;
    if (p.popular) score += 0.5;
    return { p, score };
  }).filter((x) => x.score >= 1).sort((a, b) => b.score - a.score || (a.p.price || 0) - (b.p.price || 0));
  let top = scored.slice(0, 12).map((x) => x.p);
  if (!top.length && PIZZAISH.test(q3)) {
    top = products.filter((p) => p.popular || p.new).slice(0, 8);
    if (!top.length) top = products.slice(0, 8);
  }
  if (!top.length) return [];
  const items = [];
  for (const p of top) {
    const size = sizeLabel(p);
    items.push(newRawItem(source, {
      title: `Pizza Hut ${p.title}${size ? ` (${size})` : ""}`.slice(0, 200),
      brand: "Pizza Hut",
      price: Number(p.price),
      currency: "INR",
      seller: "Pizza Hut India",
      sellerUrl: "https://www.pizzahut.co.in/menu/pizzas",
      attributes: {
        dish: p.title || "",
        size: p.size || "",
        crust: p.crust || "",
        image: p.img ? String(p.img).replace(/^http:/, "https:") : "",
        veg: p.veg === true ? "true" : "false",
        data_note: `Menu item as listed on pizzahut.co.in national menu, observed ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`
      },
      identifiers: p.id ? { sku: String(p.id) } : void 0,
      evidence: { sourceUrl: pageUrl, extractedFields: ["title", "price", "size", "crust", "image", "veg"] }
    }));
  }
  return items;
}
var PIZZAISH;
var init_pizzaHut = __esm({
  "server/workers/parsers/pizzaHut.ts"() {
    init_contract();
    PIZZAISH = /pizza|margherita|farmhouse|paneer|veggie|cheese|bbq|schezwan|chilli|habanero|nashville|korean|onion|corn|peppy|chicken|sausage|taco|hut/i;
  }
});

// server/workers/parsers/toing.ts
function toingShellGroups(json) {
  let d;
  try {
    d = JSON.parse(json);
  } catch {
    return { restaurants: [], dishesByRestaurant: /* @__PURE__ */ new Map(), ok: false };
  }
  const restaurants = [];
  const dishesByRestaurant = /* @__PURE__ */ new Map();
  const cards = d?.success?.cards || [];
  const seen = /* @__PURE__ */ new Set();
  for (const c of cards) {
    const g = c?.card?.card?.dishGroup;
    const info = g?.restaurant?.info;
    if (!info?.name || !info?.id) continue;
    if (seen.has(String(info.id))) continue;
    seen.add(String(info.id));
    const rest = {
      id: String(info.id),
      name: String(info.name),
      areaName: info.areaName ? String(info.areaName) : void 0,
      cuisines: Array.isArray(info.cuisines) ? info.cuisines.map(String) : void 0,
      avgRating: info.avgRating ?? void 0,
      costForTwo: info.costForTwo ? String(info.costForTwo) : void 0,
      eta: info.sla?.slaString ? String(info.sla.slaString) : void 0,
      cloudinaryImageId: info.cloudinaryImageId ? String(info.cloudinaryImageId) : void 0
    };
    restaurants.push(rest);
    const dishes = [];
    for (const dw of Array.isArray(g?.dishes) ? g.dishes : []) {
      const di = dw?.info;
      if (di?.name && typeof di.price === "number" && di.price > 0) dishes.push(di);
    }
    dishesByRestaurant.set(rest.id, dishes);
  }
  return { restaurants, dishesByRestaurant, ok: !!d?.success };
}
function toingShellCursor(json) {
  let d;
  try {
    d = JSON.parse(json);
  } catch {
    return {};
  }
  const po = d?.success?.pageOffset;
  if (!po?.nextOffset) return {};
  return { pageOffset: String(po.nextOffset), widgetOffset: po.widgetOffset };
}
function toingMenuDishes(json) {
  let d;
  try {
    d = JSON.parse(json);
  } catch {
    return [];
  }
  const cards = d?.success?.cards || [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const c of cards) {
    const cat = c?.card?.card;
    if (!cat || !String(cat["@type"] || "").endsWith("ItemCategory")) continue;
    for (const ic of Array.isArray(cat.itemCards) ? cat.itemCards : []) {
      const di = ic?.card?.card?.info ?? ic?.card?.info ?? ic?.info;
      if (di?.name && typeof di.price === "number" && di.price > 0) {
        const key = String(di.id || di.name);
        if (!seen.has(key)) {
          seen.add(key);
          out.push(di);
        }
      }
    }
  }
  return out;
}
function toingItem(source, sourceUrl, rest, di, city, fingerprint, priceBasis) {
  const img = di.imageId ? `${TOING_IMG}${String(di.imageId)}` : rest.cloudinaryImageId ? `${TOING_IMG}${rest.cloudinaryImageId}` : "";
  const rating = di.ratings?.aggregatedRating?.rating;
  const ratingCount = di.ratings?.aggregatedRating?.ratingCountV2;
  const inStock = di.inStock === 1 || di.inStock === true;
  return newRawItem(source, {
    title: String(di.name).slice(0, 200),
    price: Math.round(di.price) / 100,
    currency: "INR",
    seller: "Toing",
    // Toing has no web ordering; toingit.com is the official landing. The offer is
    // explicitly app-only per owner deeplink policy.
    sellerUrl: "https://www.toingit.com/",
    availability: inStock ? "in_stock" : "out_of_stock",
    location: { city },
    attributes: {
      restaurant: String(rest.name).slice(0, 120),
      ...rest.areaName ? { area: String(rest.areaName).slice(0, 80) } : {},
      ...img ? { image_url: img } : {},
      ...di.description ? { dish_description: String(di.description).replace(/\s+/g, " ").trim().slice(0, 220) } : {},
      ...rating ? { rating: String(rating) } : rest.avgRating ? { rating: String(rest.avgRating) } : {},
      ...ratingCount ? { rating_count: String(ratingCount) } : {},
      ...Array.isArray(rest.cuisines) && rest.cuisines.length ? { cuisines: rest.cuisines.slice(0, 4).join(", ") } : {},
      ...rest.eta ? { eta: String(rest.eta).toLowerCase() } : {},
      ...rest.costForTwo ? { cost_for_two: String(rest.costForTwo) } : {},
      ...di.isVeg === 1 ? { veg: "veg" } : {},
      ...di.isBestseller ? { bestseller: "yes" } : {},
      platform: "Toing",
      availability_note: "available only on app \u2014 Toing is an app-only platform; order via the Toing app",
      price_basis: priceBasis
    },
    evidence: {
      sourceUrl,
      sourceReference: `${rest.id}:${di.id || di.name}`,
      rawFingerprint: fingerprint,
      extractedFields: ["title", "price", ...img ? ["image"] : [], ...rating ? ["rating"] : [], "availability"]
    }
  });
}
function toingFingerprint(json) {
  return (0, import_crypto9.createHash)("sha256").update(json.slice(0, 5e4)).digest("hex");
}
var import_crypto9, TOING_IMG;
var init_toing = __esm({
  "server/workers/parsers/toing.ts"() {
    import_crypto9 = require("crypto");
    init_contract();
    TOING_IMG = "https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_400,h_400,c_fit/";
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
    init_pizzaHut();
    init_toing();
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
          // Pizza Hut India: Next.js SSR menu with real rupee prices for most items
          // (customisable variants carry price:null and are skipped).
          sourceId: "w_food_pizzahut",
          name: "Food worker: Pizza Hut India menu",
          priority: 13,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || "");
            const dishish = /pizza|margherita|farmhouse|paneer|veggie|cheese|bbq|schezwan|chilli|habanero|nashville|korean|taco|hut|mexican/i.test(raw);
            if (!dishish) return [];
            const url = "https://www.pizzahut.co.in/menu/pizzas";
            const r = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 25e3 });
            if (r.status !== 200) throw new AcquisitionError("ACCESS_CHALLENGE", `Pizza Hut HTTP ${r.status}`);
            const items = pizzaHutItems(r.body, ctx.source, raw, url);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", "Pizza Hut menu carried no priced item matching this query");
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
          // Uber Eats India: the service no longer operates in India — Uber sold Uber Eats India to
          // Zomato in January 2020. Verified live: www.ubereats.com/in/* returns HTTP 410 Gone, no
          // /in/ store URLs exist in the store sitemaps, and /city/mumbai returns 404. This probe
          // is registered so the source is honestly attempted and reported per search.
          sourceId: "w_food_ubereats",
          name: "Food worker: Uber Eats (India) probe",
          priority: 15,
          run: async () => {
            const r = await cffiFetch("https://www.ubereats.com/in/", { impersonate: "chrome", timeoutMs: 12e3 });
            throw new AcquisitionError("EMPTY_RESPONSE", `Uber Eats does not operate in India: Uber sold its India food-delivery business to Zomato in January 2020 (verified live: ubereats.com/in/* returns HTTP 410 Gone). No Indian menus or prices exist on Uber Eats.`);
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
            const slug2 = citySlug(ctx.query.location?.city, raw);
            if (!slug2) return [];
            const term = String(ctx.query.entityName || raw).replace(/\b(in|near)\s+[a-z\s]+$/i, "").trim();
            const url = `https://www.zomato.com/${slug2}/restaurants?q=${encodeURIComponent(term || "restaurants")}`;
            let r = await ctx.fetch(url);
            if (r.status === 403 || r.status === 202 || r.status === 429) {
              await new Promise((res) => setTimeout(res, 1500));
              r = await ctx.fetch(url);
            }
            if (r.status !== 200) throw new AcquisitionError("FORBIDDEN", `Zomato HTTP ${r.status}`, r.status);
            const items = parseZomatoRestaurants(r.body, ctx.source, url, "Zomato");
            if (!items.length && looksLikeChallenge(r.body)) throw new AcquisitionError("ACCESS_CHALLENGE", "Zomato presented a challenge page");
            const toOrder = (u) => u.replace(/\/(?:info|order)?\/?$/, "") + "/order";
            const restUrls = items.slice(0, 6).map((it) => String(it.sellerUrl || "")).filter((u) => /zomato\.com\//.test(u)).map(toOrder);
            const qTokens = term.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
            const dishItems = [];
            const hintAgg = {};
            for (const ru of restUrls) {
              const rr = await ctx.fetch(ru);
              if (rr.status !== 200) continue;
              const { dishes, hints } = parseZomatoMenuPage(rr.body);
              for (const [k, v] of Object.entries(hints)) hintAgg[k] = (hintAgg[k] || 0) + v;
              const baseUrl = ru.replace(/\/order$/, "");
              const found = items.find((it) => {
                const su = String(it.sellerUrl || "");
                return su.replace(/\/(?:info|order)?\/?$/, "") === baseUrl;
              });
              const restName = String(found?.title || baseUrl.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "restaurant");
              const wanted = qTokens.length ? dishes.filter((d) => qTokens.every((w) => (d.name + " " + (d.description || "")).toLowerCase().includes(w))) : dishes;
              for (const d of wanted.slice(0, 8)) {
                dishItems.push(newRawItem(ctx.source, {
                  title: d.name,
                  brand: "Zomato",
                  price: d.price,
                  currency: "INR",
                  seller: "Zomato",
                  sellerUrl: baseUrl + "/order",
                  location: { city: ctx.query.location?.city || "" },
                  attributes: {
                    dish: d.name.slice(0, 160),
                    restaurant: restName.slice(0, 160),
                    ...d.image ? { image_url: d.image } : {},
                    platform: "Zomato",
                    ...d.description ? { description: d.description } : {},
                    price_basis: "Menu price served in Zomato restaurant page embedded JSON",
                    data_note: "Dish price extracted from the restaurant page on zomato.com; final price at checkout may vary"
                  },
                  evidence: { sourceUrl: ru, sourceReference: d.name, extractedFields: ["dish", "price"] }
                }));
              }
              if (dishItems.length >= 24) break;
            }
            if (dishItems.length) return dishItems;
            if (restUrls.length && !hintAgg.priceHits) {
              throw new AcquisitionError("EMPTY_RESPONSE", `Zomato restaurant pages carried no embedded menu prices (hints: ${JSON.stringify(hintAgg)}) \u2014 dish prices stay unavailable to browserless HTTP`);
            }
            return items;
          }
        },
        {
          // Toing (Swiggy's budget food app) — reverse-engineered app-only platform.
          // disc.swiggy.com shell feed + dynamicmenu serve REAL Toing dish prices (paise)
          // without auth. No web ordering exists -> offers are labelled app-only per policy.
          sourceId: "w_food_toing",
          name: "Food worker: Toing dish prices (Swiggy disc shell feed)",
          priority: 8,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || "");
            const term = String(ctx.query.entityName || raw).replace(/\b(in|near)\s+[a-z\s]+$/i, "").trim();
            if (!term) return [];
            const cityKey = String(ctx.query.location?.city || "").toLowerCase().trim();
            const c = CITY_COORDS[cityKey] || CITY_COORDS["new delhi"];
            const city = ctx.query.location?.city || "New Delhi";
            const shellUrl = `https://disc.swiggy.com/api/v1/json/shell/toing-app?lat=${c[0]}&lng=${c[1]}`;
            const H = { "Accept": "application/json", "Content-Type": "application/json" };
            const qTokens = term.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
            const groups = /* @__PURE__ */ new Map();
            let body = "{}";
            let pages = 0;
            let firstJson = "";
            for (let i = 0; i < 3; i++) {
              const r = await cffiFetch(shellUrl, { impersonate: "chrome", method: "POST", body, timeoutMs: 22e3, headers: H });
              if (r.status !== 200) throw new AcquisitionError("FORBIDDEN", `Toing shell HTTP ${r.status}`, r.status);
              if (!firstJson) firstJson = r.body;
              const g = toingShellGroups(r.body);
              if (!g.ok) throw new AcquisitionError("EMPTY_RESPONSE", "Toing shell response carried no success block");
              for (const rest of g.restaurants) {
                if (!groups.has(rest.id)) groups.set(rest.id, { rest, dishes: g.dishesByRestaurant.get(rest.id) || [], fp: toingFingerprint(r.body) });
              }
              pages++;
              const cur = toingShellCursor(r.body);
              if (!cur.pageOffset || !cur.widgetOffset) break;
              body = JSON.stringify({ pageOffset: cur.pageOffset, widgetOffset: cur.widgetOffset });
              if (g.restaurants.length >= 25) break;
            }
            if (!groups.size) throw new AcquisitionError("EMPTY_RESPONSE", `Toing shell feed carried no restaurant dish groups (pages=${pages})`);
            const items = [];
            const seenDish = /* @__PURE__ */ new Set();
            const matchDish = (d) => {
              if (!qTokens.length) return true;
              const hay = `${d.name || ""} ${d.description || ""}`.toLowerCase();
              return qTokens.every((w) => hay.includes(w));
            };
            for (const { rest, dishes, fp } of groups.values()) {
              for (const d of dishes) {
                const key = `${rest.id}:${d.id || d.name}`;
                if (seenDish.has(key) || !matchDish(d)) continue;
                seenDish.add(key);
                items.push(toingItem(ctx.source, shellUrl, rest, d, city, fp, "Featured Toing dish price from the app home feed (disc.swiggy.com shell)"));
              }
            }
            if (items.length < 12) {
              const restSlice = Array.from(groups.values()).slice(0, 6);
              for (const { rest, fp } of restSlice) {
                if (items.length >= 24) break;
                try {
                  const m = await cffiFetch(`https://disc.swiggy.com/api/v2/dynamicmenu/${rest.id}?lat=${c[0]}&lng=${c[1]}`, { impersonate: "chrome", method: "POST", body: "{}", timeoutMs: 22e3, headers: H });
                  if (m.status !== 200) continue;
                  const dishes = toingMenuDishes(m.body);
                  for (const d of dishes) {
                    const key = `${rest.id}:${d.id || d.name}`;
                    if (seenDish.has(key) || !matchDish(d)) continue;
                    seenDish.add(key);
                    items.push(toingItem(ctx.source, shellUrl, rest, d, city, toingFingerprint(m.body), "Toing dish price from the restaurant menu (disc.swiggy.com dynamicmenu)"));
                    if (items.length >= 24) break;
                  }
                } catch {
                }
              }
            }
            if (!items.length) {
              throw new AcquisitionError("EMPTY_RESPONSE", `Toing feed listed ${groups.size} restaurants (pages=${pages}) but none matched "${term}"`);
            }
            return items.slice(0, 40);
          }
        }
      ]
    };
    registerVerticalWorker(foodWorker);
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
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
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
        price_basis: `route fare as published by savaari.com on ${today2}`,
        image: "",
        data_note: `Route fare scraped from savaari.com route page on ${today2}`
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
      const clean3 = (s) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
      parsed.push({ car: clean3(cells[0] ?? ""), price: clean3(cells[1] ?? "") });
    }
    const isFlat = parsed.length > 0 && parsed.every((p) => /^[₹rs\.]*\s?[\d,]{3,6}$/i.test(p.price)) && parsed.every((p) => !/km/i.test(p.price));
    if (isFlat) {
      for (const p of parsed) flat.push({ car: p.car, fare: Number(p.price.replace(/[₹rs\.,\s]/gi, "")) });
      break;
    }
  }
  const seen = flat.filter((f) => f.fare > 0 && f.car).slice(0, 8);
  if (!seen.length) return [];
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
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
      price_basis: `one-way route fare as published by bharattaxi.com on ${today2}`,
      data_note: `Route fare scraped from bharattaxi.com route page on ${today2}`
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
  const norm3 = (s) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const fare = (s) => {
    const m = /([\d,]{3,7})/.exec(norm3(s).replace(/[₹]/g, ""));
    return m ? Number(m[1].replace(/,/g, "")) : null;
  };
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  for (const row of rows) {
    const cells = row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g) || [];
    if (cells.length < 4) continue;
    const rf = norm3(cells[0] || "").toLowerCase();
    const rt = norm3(cells[1] || "").toLowerCase();
    const f = norm3(from || "").toLowerCase();
    const t = norm3(to || "").toLowerCase();
    const routeMatch = f && t && (rf.includes(f) || f.includes(rf)) && (rt.includes(t) || t.includes(rt));
    if (!routeMatch) continue;
    const oneWay = fare(cells[2] || "");
    const roundTrip = fare(cells[3] || "");
    if (oneWay && oneWay > 0) {
      items.push(newRawItem(source, {
        title: `${norm3(cells[0] || "")} to ${norm3(cells[1] || "")} cab (one-way)`,
        brand: "Quick Ride",
        price: Math.round(oneWay),
        currency: "INR",
        seller: "Quick Ride",
        sellerUrl: pageUrl,
        travel: { route: `${from} to ${to}`.toLowerCase(), seatType: "unknown" },
        attributes: {
          pickup: from,
          drop: to,
          route: `${norm3(cells[0] || "")} to ${norm3(cells[1] || "")}`,
          vehicle_type: "cab (outstation)",
          trip_type: "one-way",
          round_trip_fare: roundTrip ? String(roundTrip) : "",
          price_basis: `route fare as published on quickride.in on ${today2}`,
          image: "",
          data_note: `Route fare scraped from quickride.in outstation fare table on ${today2}`
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

// server/workers/parsers/indriveIntercity.ts
async function indriveCityLookup(term) {
  const q3 = term.trim().replace(/\s+/g, " ");
  if (q3.length < 2) return null;
  const url = `${HOST_API}/web/v1/cities?search=${encodeURIComponent(q3)}&country_id=${INDIA_COUNTRY_ID}`;
  const r = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 15e3, headers: HEADERS });
  if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `InDrive city search HTTP ${r.status}`, r.status);
  let cities;
  try {
    cities = JSON.parse(r.body || "[]");
  } catch {
    throw new AcquisitionError("MALFORMED_RESPONSE", "InDrive city search non-JSON");
  }
  if (!Array.isArray(cities) || !cities.length) return null;
  const pick3 = indrivePickCity(cities, q3);
  return pick3 || cities[0];
}
function indrivePickCity(cities, q3) {
  const t = q3.trim().replace(/\s+/g, " ").toLowerCase();
  if (!t) return null;
  const norm3 = (s) => String(s).toLowerCase().replace(/\s+/g, " ");
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(`^${esc}\\b`);
  return cities.find((c) => norm3(c.name) === t) || cities.find((c) => rx.test(norm3(c.name))) || cities.find((c) => norm3(c.name).includes(t)) || null;
}
async function indrivePrices(fromId, toId) {
  const url = `${HOST_API}/web/v1/prices?city_from_id=${fromId}&city_to_id=${toId}`;
  const r = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 15e3, headers: HEADERS });
  if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `InDrive prices HTTP ${r.status}`, r.status);
  let rows;
  try {
    rows = JSON.parse(r.body || "[]");
  } catch {
    throw new AcquisitionError("MALFORMED_RESPONSE", "InDrive prices non-JSON");
  }
  return Array.isArray(rows) ? rows : [];
}
function buildIndriveOffers(source, fromCity, toCity, from, to, rows) {
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const items = [];
  for (const row of rows) {
    const vehicle = ORDER_LABELS[row.order_type];
    if (!vehicle || !Number(row.min_price)) continue;
    const rangeNote = row.max_price > row.min_price ? `published range \u20B9${row.min_price}\u2013\u20B9${row.max_price}` : `published price \u20B9${row.min_price}`;
    items.push(newRawItem(source, {
      title: `${fromCity} to ${toCity} cab (InDrive Intercity, ${vehicle}, one-way)`,
      brand: "InDrive",
      price: Math.round(Number(row.min_price)),
      currency: "INR",
      seller: "InDrive",
      travel: { route: `${fromCity} to ${toCity}`.toLowerCase(), seatType: vehicle === "pool" ? "shared" : "unknown" },
      attributes: {
        pickup: fromCity,
        drop: toCity,
        route: `${fromCity} to ${toCity}`,
        vehicle_type: `InDrive Intercity (${vehicle})`,
        trip_type: "one-way",
        price_basis: `InDrive's own published intercity ${rangeNote} for ${from.name} \u2192 ${to.name}, retrieved ${today2}`,
        data_note: `InDrive rides are passenger-name-your-price; this is InDrive's published indicative band from its intercity web app (guest API), not a fixed fare. City pair resolved via InDrive's own city registry: ${from.name} (id ${from.id}) \u2192 ${to.name} (id ${to.id}).`
      },
      sellerUrl: WEB,
      identifiers: { sku: `indrive-ic-${from.id}-${to.id}-${row.order_type}` },
      evidence: { sourceUrl: `${HOST_API}/web/v1/prices?city_from_id=${from.id}&city_to_id=${to.id}`, extractedFields: ["min_price", "max_price", "order_type"] }
    }));
  }
  return items.sort((a, b) => a.price - b.price);
}
var HOST_API, WEB, INDIA_COUNTRY_ID, HEADERS, ORDER_LABELS;
var init_indriveIntercity = __esm({
  "server/workers/parsers/indriveIntercity.ts"() {
    init_contract();
    init_curlCffiFetch();
    init_httpClient();
    HOST_API = "https://ic3-gw-cf.euce1.indriverapp.com";
    WEB = "https://intercity.indrive.com/";
    INDIA_COUNTRY_ID = 14;
    HEADERS = {
      Accept: "application/json",
      Origin: "https://intercity.indrive.com",
      Referer: "https://intercity.indrive.com/",
      "Accept-Language": "en-IN,en;q=0.9"
    };
    ORDER_LABELS = {
      private: "private car",
      pool: "pool"
      // "parcel" is package delivery, not a passenger ride — never emitted
    };
  }
});

// server/workers/parsers/rapidoCabs.ts
function rapidoCitySlug(city) {
  const l = city.trim().toLowerCase();
  return CITY_SLUG_ALIASES[l] || l.replace(/\s+/g, "");
}
async function rapidoServedCities(fetchText) {
  if (citiesCache && Date.now() - citiesCache.at < 12 * 36e5) return citiesCache.cities;
  const xml = await fetchText(CITIES_SITEMAP);
  const cities = [];
  for (const m of xml.matchAll(/<loc>https:\/\/www\.rapido\.bike\/([^/]+)\/main-page<\/loc>/g)) {
    const path6 = m[1];
    if (!path6 || path6.includes(".")) continue;
    cities.push({ name: decodeURIComponent(path6).replace(/[_%20]/g, " ").trim(), mainPagePath: path6 });
  }
  if (!cities.length) throw new Error(`Rapido cities sitemap carried no city pages (len=${xml.length})`);
  citiesCache = { at: Date.now(), cities };
  return cities;
}
function canonCity(name) {
  const t = name.trim().toLowerCase();
  return CITY_NAME_ALIASES[t] || t;
}
function rapidoCityLookup(cities, city) {
  const t = canonCity(city);
  return cities.find((c) => canonCity(c.name) === t) || null;
}
function buildRapidoAvailability(inp) {
  const route = `${inp.from} \u2192 ${inp.to}`;
  return SERVICES.map((svc, i) => newRawItem(inp.source, {
    title: `${inp.from} to ${inp.to} Rapido ${svc.vehicle} (city ride, one-way)`,
    currency: "INR",
    seller: "Rapido",
    sellerUrl: inp.mainPageUrl,
    availability: "unknown",
    travel: { route },
    location: { city: inp.city },
    identifiers: { sku: `rapido-${rapidoCitySlug(inp.city)}-${svc.vehicle.toLowerCase().replace(/\s+/g, "-")}` },
    attributes: {
      pickup: inp.from,
      drop: inp.to,
      vehicle_type: svc.vehicle,
      service_blurb: svc.blurb,
      price_basis: "app_only_fares",
      app_only: "true",
      data_note: `Rapido operates in ${inp.city}: ${svc.blurb}. Rapido calculates fares in-app \u2014 no web pricing exists, so this row is priced "available only on app" rather than estimated. ` + (i === 0 ? `Availability verified from Rapido's own served-city registry (rapido.bike ${inp.city} city page).` : "")
    },
    evidence: {
      extractedFields: ["title", "seller", "currency"],
      sourceUrl: inp.mainPageUrl,
      sourceReference: "rapido.bike served-city page availability (app-only fares)"
    }
  }));
}
var CITIES_SITEMAP, CITY_SLUG_ALIASES, citiesCache, CITY_NAME_ALIASES, SERVICES;
var init_rapidoCabs = __esm({
  "server/workers/parsers/rapidoCabs.ts"() {
    init_contract();
    CITIES_SITEMAP = "https://www.rapido.bike/sitemaps/cities/sitemap.xml";
    CITY_SLUG_ALIASES = {
      bengaluru: "bangalore",
      mysuru: "mysore",
      "new delhi": "delhi",
      gurugram: "gurgaon",
      "gautam buddha nagar": "noida",
      vizag: "vishakapatnam",
      trivandrum: "thiruvananthapuram"
    };
    citiesCache = null;
    CITY_NAME_ALIASES = {
      gurgaon: "gurugram",
      bangalore: "bengaluru",
      mysore: "mysuru",
      "new delhi": "delhi",
      trivandrum: "thiruvananthapuram",
      vishakapatnam: "visakhapatnam",
      bombay: "mumbai",
      madras: "chennai",
      calcutta: "kolkata",
      // India Post districts that are not city names: NCR districts fold into their city
      "gautam buddha nagar": "noida",
      "central delhi": "delhi",
      "south west delhi": "delhi",
      "north west delhi": "delhi",
      "north east delhi": "delhi",
      "east delhi": "delhi",
      "west delhi": "delhi",
      "south delhi": "delhi",
      "north delhi": "delhi",
      shahdara: "delhi"
    };
    SERVICES = [
      { vehicle: "Bike Taxi", blurb: "bike rides" },
      { vehicle: "Auto", blurb: "auto rides for city travel" },
      { vehicle: "Cab", blurb: "sedan cabs" }
    ];
  }
});

// server/workers/parsers/uberIndiaCities.ts
function uberIndiaCityFor(place) {
  if (!place) return null;
  const t = canonCity(place);
  const hit = BY_CANON.get(t);
  if (hit) return hit;
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let best = null;
  let bestLen = 0;
  for (const [k, v] of BY_CANON) {
    if (new RegExp(`\\b${esc(k)}\\b`).test(t) || new RegExp(`\\b${esc(t)}\\b`).test(k)) {
      if (k.length > bestLen) {
        best = v;
        bestLen = k.length;
      }
    }
  }
  return best;
}
var UBER_IN_STATE_SUFFIXES, SLUGS, PARSED, BY_CANON, UBER_INDIA_PAGE_COUNT;
var init_uberIndiaCities = __esm({
  "server/workers/parsers/uberIndiaCities.ts"() {
    init_rapidoCabs();
    UBER_IN_STATE_SUFFIXES = /* @__PURE__ */ new Set([
      "andhra-pradesh",
      "arunachal-pradesh",
      "assam",
      "bihar",
      "chhattisgarh",
      "goa",
      "gujarat",
      "haryana",
      "himachal-pradesh",
      "jharkhand",
      "karnataka",
      "kerala",
      "madhya-pradesh",
      "maharashtra",
      "manipur",
      "meghalaya",
      "mizoram",
      "nagaland",
      "odisha",
      "punjab",
      "rajasthan",
      "sikkim",
      "tamil-nadu",
      "telangana",
      "tripura",
      "uttar-pradesh",
      "uttarakhand",
      "west-bengal",
      "delhi",
      "jammu-and-kashmir",
      "jammu-kashmir",
      "ladakh",
      "puducherry",
      "chandigarh",
      "andaman-and-nicobar",
      "dadra-and-nagar-haveli",
      "dadra-nagar-haveli",
      "daman-and-diu",
      "lakshadweep"
    ]);
    SLUGS = [
      "aali-odisha-in",
      "abhanpur-chhattisgarh-in",
      "abohar-punjab-in",
      "abu-road-rajasthan-in",
      "achampet-telangana-in",
      "adampur-haryana-in",
      "addakal-telangana-in",
      "adityapur-jharkhand-in",
      "adoni-andhra-pradesh-in",
      "adoor-kerala-in",
      "agartala-tripura-in",
      "agastheeswaram-tamil-nadu-in",
      "agiripalle-andhra-pradesh-in",
      "agra-uttar-pradesh-in",
      "ahmadabad-city-gujarat-in",
      "ahwa-gujarat-in",
      "ainthapali-odisha-in",
      "airfield-kapila-prasad-odisha-in",
      "aizawl-mizoram-in",
      "ajmer-rajasthan-in",
      "ajnala-punjab-in",
      "ajra-maharashtra-in",
      "akbarpur-uttar-pradesh-in",
      "akkalkot-maharashtra-in",
      "akola-maharashtra-in",
      "akrani-maharashtra-in",
      "alair-telangana-in",
      "alandur-tamil-nadu-in",
      "alathur-kerala-in",
      "alibag-maharashtra-in",
      "alladurg-telangana-in",
      "allahabad-uttar-pradesh-in",
      "almora-uttarakhand-in",
      "alur-karnataka-in",
      "aluva-kerala-in",
      "alwar-rajasthan-in",
      "amadalavalasa-andhra-pradesh-in",
      "amangal-telangana-in",
      "amaravathi-andhra-pradesh-in",
      "amarpur-tripura-in",
      "ambala-haryana-in",
      "ambalappuzha-kerala-in",
      "ambarnath-maharashtra-in",
      "ambasamudram-tamil-nadu-in",
      "ambassa-tripura-in",
      "ambattur-tamil-nadu-in",
      "ambegaon-maharashtra-in",
      "amber-rajasthan-in",
      "ambur-tamil-nadu-in",
      "amdanga-west-bengal-in",
      "amethi-uttar-pradesh-in",
      "amirgadh-gujarat-in",
      "amloh-punjab-in",
      "amnour-bihar-in",
      "amod-gujarat-in",
      "amrabad-telangana-in",
      "amravati-maharashtra-in",
      "amritsar-i-punjab-in",
      "amritsar-ii-punjab-in",
      "amroha-uttar-pradesh-in",
      "amta-i-west-bengal-in",
      "amta-ii-west-bengal-in",
      "anaicut-tamil-nadu-in",
      "anakapalle-andhra-pradesh-in",
      "anand-gujarat-in",
      "anandapuram-andhra-pradesh-in",
      "anandpur-sahib-punjab-in",
      "ananthagiri-andhra-pradesh-in",
      "andole-telangana-in",
      "anekal-karnataka-in",
      "anekal-tamil-nadu-in",
      "angara-jharkhand-in",
      "anjad-madhya-pradesh-in",
      "anklav-gujarat-in",
      "anklesvar-gujarat-in",
      "annur-tamil-nadu-in",
      "antah-rajasthan-in",
      "anugul-odisha-in",
      "anumula-telangana-in",
      "anupshahr-uttar-pradesh-in",
      "aonla-uttar-pradesh-in",
      "arakonam-tamil-nadu-in",
      "araku-valley-andhra-pradesh-in",
      "arambag-west-bengal-in",
      "arang-chhattisgarh-in",
      "arani-tamil-nadu-in",
      "aranthangi-tamil-nadu-in",
      "aravakurichi-tamil-nadu-in",
      "arcot-tamil-nadu-in",
      "ardhaveedu-andhra-pradesh-in",
      "arkalgud-karnataka-in",
      "arni-maharashtra-in",
      "arrah-bihar-in",
      "arsikere-karnataka-in",
      "arvi-maharashtra-in",
      "asansol-west-bengal-in",
      "ashta-madhya-pradesh-in",
      "ashti-maharashtra-in",
      "assandh-haryana-in",
      "astaranga-odisha-in",
      "atchampet-andhra-pradesh-in",
      "atchutapuram-andhra-pradesh-in",
      "athagad-odisha-in",
      "athmalgola-bihar-in",
      "atmakur-s-telangana-in",
      "atmakur-telangana-in",
      "atpadi-maharashtra-in",
      "atrauli-uttar-pradesh-in",
      "atru-rajasthan-in",
      "attili-andhra-pradesh-in",
      "aurai-uttar-pradesh-in",
      "aurangabad-bihar-in",
      "aurangabad-maharashtra-in",
      "ausgram-i-west-bengal-in",
      "ausgram-ii-west-bengal-in",
      "avanashi-tamil-nadu-in",
      "ayodhya-uttar-pradesh-in",
      "azamgarh-uttar-pradesh-in",
      "azara-assam-in",
      "b-k-pora-jammu-kashmir-in",
      "baba-bakala-punjab-in",
      "bachannapet-telangana-in",
      "badachana-odisha-in",
      "badamba-odisha-in",
      "badami-karnataka-in",
      "badangi-andhra-pradesh-in",
      "badarwas-madhya-pradesh-in",
      "baddi-himachal-pradesh-in",
      "badhra-haryana-in",
      "badi-madhya-pradesh-in",
      "badlapur-uttar-pradesh-in",
      "baduria-west-bengal-in",
      "bagalkot-karnataka-in",
      "bagepalli-karnataka-in",
      "bagha-purana-punjab-in",
      "baghpat-uttar-pradesh-in",
      "baglan-maharashtra-in",
      "bagli-madhya-pradesh-in",
      "bagnan-i-west-bengal-in",
      "bagnan-ii-west-bengal-in",
      "bah-uttar-pradesh-in",
      "bahadurgarh-haryana-in",
      "bahour-puducherry-in",
      "bahraich-uttar-pradesh-in",
      "baidyeswar-odisha-in",
      "bajali-assam-in",
      "bajpur-uttarakhand-in",
      "bakhtiarpur-bihar-in",
      "baksa-assam-in",
      "bakshika-talab-uttar-pradesh-in",
      "balachaur-punjab-in",
      "balagarh-west-bengal-in",
      "balanagar-telangana-in",
      "balasinor-gujarat-in",
      "baleshwar-m-odisha-in",
      "baleshwar-sadar-odisha-in",
      "bali-rajasthan-in",
      "balianta-odisha-in",
      "balichandrapur-odisha-in",
      "balijana-assam-in",
      "balijipeta-andhra-pradesh-in",
      "balipatna-odisha-in",
      "ballabgarh-haryana-in",
      "ballia-uttar-pradesh-in",
      "bally-jagachha-west-bengal-in",
      "balrampur-uttar-pradesh-in",
      "balugaon-odisha-in",
      "bamanwas-rajasthan-in",
      "bampada-odisha-in",
      "banapur-odisha-in",
      "banda-uttar-pradesh-in",
      "bangalore-east-karnataka-in",
      "bangalore-north-karnataka-in",
      "bangalore-south-karnataka-in",
      "bangar-i-west-bengal-in",
      "bangarapet-karnataka-in",
      "banki-odisha-in",
      "bankura-i-west-bengal-in",
      "bansada-odisha-in",
      "bansda-gujarat-in",
      "bansdih-uttar-pradesh-in",
      "banswada-telangana-in",
      "bantval-karnataka-in",
      "bapulapadu-andhra-pradesh-in",
      "bara-uttar-pradesh-in",
      "baram-jharkhand-in",
      "baramati-maharashtra-in",
      "barang-odisha-in",
      "barara-haryana-in",
      "barasat-i-west-bengal-in",
      "barasat-ii-west-bengal-in",
      "baraut-uttar-pradesh-in",
      "barbhag-assam-in",
      "barbigha-bihar-in",
      "bardez-goa-in",
      "bardoli-gujarat-in",
      "bareilly-uttar-pradesh-in",
      "barh-bihar-in",
      "barhaj-uttar-pradesh-in",
      "bari-ramachandrapur-odisha-in",
      "baripada-m-odisha-in",
      "barjora-west-bengal-in",
      "barkhetri-assam-in",
      "barnala-punjab-in",
      "barpeta-assam-in",
      "barrackpur-i-west-bengal-in",
      "barrackpur-ii-west-bengal-in",
      "barshi-maharashtra-in",
      "baruipur-west-bengal-in",
      "barwaha-madhya-pradesh-in",
      "barwala-gujarat-in",
      "barwani-madhya-pradesh-in",
      "basanti-west-bengal-in",
      "basheerabad-telangana-in",
      "basirhat-i-west-bengal-in",
      "basirhat-ii-west-bengal-in",
      "bassi-pathana-punjab-in",
      "bassi-rajasthan-in",
      "basta-odisha-in",
      "basti-uttar-pradesh-in",
      "baswa-rajasthan-in",
      "batala-punjab-in",
      "bathinda-punjab-in",
      "bavla-gujarat-in",
      "bawal-haryana-in",
      "bawani-khera-haryana-in",
      "bayad-gujarat-in",
      "becharaji-gujarat-in",
      "beejoliya-rajasthan-in",
      "begamganj-madhya-pradesh-in",
      "begunia-odisha-in",
      "behat-uttar-pradesh-in",
      "behror-rajasthan-in",
      "bejjanki-telangana-in",
      "beldanga-i-west-bengal-in",
      "beldanga-ii-west-bengal-in",
      "belgaum-karnataka-in",
      "beltangadi-karnataka-in",
      "berasia-madhya-pradesh-in",
      "berhampore-west-bengal-in",
      "berhampur-odisha-in",
      "beri-haryana-in",
      "bermo-jharkhand-in",
      "betul-madhya-pradesh-in",
      "bhabua-bihar-in",
      "bhadesar-rajasthan-in",
      "bhadohi-uttar-pradesh-in",
      "bhadra-rajasthan-in",
      "bhadrak-rural-odisha-in",
      "bhagawanpur-i-west-bengal-in",
      "bhagawanpur-ii-west-bengal-in",
      "bhagwanpur-bihar-in",
      "bhalki-karnataka-in",
      "bhandara-maharashtra-in",
      "bhander-madhya-pradesh-in",
      "bhangar-ii-west-bengal-in",
      "bharatpur-rajasthan-in",
      "bharthana-uttar-pradesh-in",
      "bharuch-gujarat-in",
      "bhatapara-chhattisgarh-in",
      "bhatar-west-bengal-in",
      "bhatwari-uttarakhand-in",
      "bhavani-tamil-nadu-in",
      "bheemadevarpalle-telangana-in",
      "bheemunipatnam-andhra-pradesh-in",
      "bhikiasain-uttarakhand-in",
      "bhiknoor-telangana-in",
      "bhiloda-gujarat-in",
      "bhilwara-rajasthan-in",
      "bhiwandi-maharashtra-in",
      "bhiwani-haryana-in",
      "bhogaon-uttar-pradesh-in",
      "bhogapuram-andhra-pradesh-in",
      "bhognipur-uttar-pradesh-in",
      "bhongir-telangana-in",
      "bhoothpur-telangana-in",
      "bhopal-madhya-pradesh-in",
      "bhor-maharashtra-in",
      "bhuban-odisha-in",
      "bhubaneswar-odisha-in",
      "bhupalpalle-telangana-in",
      "bhusawar-rajasthan-in",
      "bhushan-steel-ltd-odisha-in",
      "biaora-madhya-pradesh-in",
      "bibinagar-telangana-in",
      "bicholim-goa-in",
      "bid-maharashtra-in",
      "bidar-karnataka-in",
      "bidupur-bihar-in",
      "bighapur-uttar-pradesh-in",
      "bihar-bihar-in",
      "bihta-bihar-in",
      "bijinapalle-telangana-in",
      "bijnor-uttar-pradesh-in",
      "bikram-bihar-in",
      "bilari-uttar-pradesh-in",
      "bilaspur-chhattisgarh-in",
      "bilaspur-haryana-in",
      "bilaspur-sadar-himachal-pradesh-in",
      "bilaspur-uttar-pradesh-in",
      "bilhaur-uttar-pradesh-in",
      "biloli-maharashtra-in",
      "bina-madhya-pradesh-in",
      "bindki-uttar-pradesh-in",
      "binjharpur-odisha-in",
      "biramitrapur-odisha-in",
      "biridi-odisha-in",
      "bisalpur-uttar-pradesh-in",
      "bishalgarh-tripura-in",
      "bishnupur-i-west-bengal-in",
      "bishnupur-ii-west-bengal-in",
      "bishunpur-jharkhand-in",
      "bisra-odisha-in",
      "biswan-uttar-pradesh-in",
      "bobbili-andhra-pradesh-in",
      "bochaha-bihar-in",
      "bodeli-gujarat-in",
      "boden-odisha-in",
      "bodh-gaya-bihar-in",
      "bodhan-telangana-in",
      "bodinayakanur-tamil-nadu-in",
      "bokaro-jharkhand-in",
      "boko-assam-in",
      "bolagad-odisha-in",
      "bolpur-sriniketan-west-bengal-in",
      "bommalaramaram-telangana-in",
      "bondamunda-odisha-in",
      "bondapalle-andhra-pradesh-in",
      "bongaon-west-bengal-in",
      "bonli-rajasthan-in",
      "borsad-gujarat-in",
      "botad-gujarat-in",
      "brahmagiri-odisha-in",
      "brahmani-tarang-odisha-in",
      "brahmapur-ps-odisha-in",
      "brahmapur-sadar-odisha-in",
      "buchinaidu-kandriga-andhra-pradesh-in",
      "buchireddipalem-andhra-pradesh-in",
      "budalur-tamil-nadu-in",
      "budgam-jammu-kashmir-in",
      "budge-budge-i-west-bengal-in",
      "budge-budge-ii-west-bengal-in",
      "budhana-uttar-pradesh-in",
      "budhlada-punjab-in",
      "budni-madhya-pradesh-in",
      "buguda-odisha-in",
      "bulandshahr-uttar-pradesh-in",
      "bundi-rajasthan-in",
      "bundu-jharkhand-in",
      "burdwan-i-west-bengal-in",
      "burdwan-ii-west-bengal-in",
      "burhanpur-uttar-pradesh-in",
      "burja-andhra-pradesh-in",
      "buxar-bihar-in",
      "canacona-goa-in",
      "canning-i-west-bengal-in",
      "canning-ii-west-bengal-in",
      "central-jammu-kashmir-in",
      "chadipur-west-bengal-in",
      "chadoora-jammu-kashmir-in",
      "chail-uttar-pradesh-in",
      "chakdah-west-bengal-in",
      "chakrata-uttarakhand-in",
      "chaksu-rajasthan-in",
      "chalakudy-kerala-in",
      "challakere-karnataka-in",
      "chamarajanagar-karnataka-in",
      "chamkaur-sahib-punjab-in",
      "chanasma-gujarat-in",
      "chandaka-odisha-in",
      "chandam-pet-telangana-in",
      "chandanpur-odisha-in",
      "chandauli-uttar-pradesh-in",
      "chandausi-uttar-pradesh-in",
      "chandi-bihar-in",
      "chandigarh-chandigarh-in",
      "chandil-jharkhand-in",
      "chanditala-i-west-bengal-in",
      "chanditala-ii-west-bengal-in",
      "chandpur-uttar-pradesh-in",
      "chandragiri-andhra-pradesh-in",
      "chandrapur-assam-in",
      "chandvad-maharashtra-in",
      "changanassery-kerala-in",
      "channagiri-karnataka-in",
      "channapatna-karnataka-in",
      "channapora-jammu-kashmir-in",
      "channarayapatna-karnataka-in",
      "chapra-bihar-in",
      "chas-jharkhand-in",
      "chaubatttakhal-uttarakhand-in",
      "chauri-chaura-uttar-pradesh-in",
      "chavakkad-kerala-in",
      "chebrolu-andhra-pradesh-in",
      "cheedikada-andhra-pradesh-in",
      "cheepurupalle-andhra-pradesh-in",
      "chegunta-telangana-in",
      "chengalpattu-tamil-nadu-in",
      "chengam-tamil-nadu-in",
      "chengannur-kerala-in",
      "chennai-tamil-nadu-in",
      "cherial-telangana-in",
      "cherthala-kerala-in",
      "chevella-telangana-in",
      "cheyyar-tamil-nadu-in",
      "cheyyur-tamil-nadu-in",
      "chhachhrauli-haryana-in",
      "chhamanu-tripura-in",
      "chhata-uttar-pradesh-in",
      "chhaygaon-assam-in",
      "chhendipada-odisha-in",
      "chhipabarod-rajasthan-in",
      "chhoti-sadri-rajasthan-in",
      "chhuikhadan-chhattisgarh-in",
      "chhuria-chhattisgarh-in",
      "chidambaram-tamil-nadu-in",
      "chikballapur-karnataka-in",
      "chikhli-gujarat-in",
      "chikmagalur-karnataka-in",
      "chiknayakanhalli-karnataka-in",
      "chilamathur-andhra-pradesh-in",
      "chimakurthi-andhra-pradesh-in",
      "chinnachintakunta-telangana-in",
      "chinnakodur-telangana-in",
      "chinsurah-magra-west-bengal-in",
      "chintamani-karnataka-in",
      "chintha-palle-telangana-in",
      "chiplun-maharashtra-in",
      "chirawa-rajasthan-in",
      "chirayinkeezhu-kerala-in",
      "chitapur-karnataka-in",
      "chitradurga-karnataka-in",
      "chittaurgarh-rajasthan-in",
      "chittur-kerala-in",
      "chivvemla-telangana-in",
      "chodavaram-andhra-pradesh-in",
      "chomu-rajasthan-in",
      "chorasi-gujarat-in",
      "chotila-gujarat-in",
      "choudwar-odisha-in",
      "chuda-gujarat-in",
      "chunar-uttar-pradesh-in",
      "coimbatore-north-tamil-nadu-in",
      "coimbatore-south-tamil-nadu-in",
      "colonelganj-uttar-pradesh-in",
      "contai-i-west-bengal-in",
      "contai-iii-west-bengal-in",
      "coonoor-tamil-nadu-in",
      "crri-odisha-in",
      "cuddalore-tamil-nadu-in",
      "cuttack-sadar-odisha-in",
      "cuttack-town-m-c-odisha-in",
      "dabhoi-gujarat-in",
      "dabwali-haryana-in",
      "dadra-nagar-haveli-dadra-nagar-haveli-in",
      "dadri-haryana-in",
      "dadri-uttar-pradesh-in",
      "dahanu-maharashtra-in",
      "dalgaon-pt-assam-in",
      "dalmau-uttar-pradesh-in",
      "dalsinghsarai-bihar-in",
      "daman-daman-diu-in",
      "dammapeta-telangana-in",
      "daniawan-bihar-in",
      "danta-gujarat-in",
      "danta-ramgarh-rajasthan-in",
      "dantan-i-west-bengal-in",
      "dapoli-maharashtra-in",
      "darbhanga-bihar-in",
      "dariapur-bihar-in",
      "daringbadi-odisha-in",
      "darjeeling-pulbazar-west-bengal-in",
      "darlaghat-himachal-pradesh-in",
      "dasada-gujarat-in",
      "dasapalla-odisha-in",
      "dasda-tripura-in",
      "daskroi-gujarat-in",
      "daspur-i-west-bengal-in",
      "daspur-ii-west-bengal-in",
      "dasua-punjab-in",
      "dattirajeru-andhra-pradesh-in",
      "daund-maharashtra-in",
      "dausa-rajasthan-in",
      "davanagere-karnataka-in",
      "debai-uttar-pradesh-in",
      "debra-west-bengal-in",
      "dediapada-gujarat-in",
      "deganda-west-bengal-in",
      "dehgam-gujarat-in",
      "dehradun-uttarakhand-in",
      "delanga-odisha-in",
      "denkada-andhra-pradesh-in",
      "denkanikottai-tamil-nadu-in",
      "deoband-uttar-pradesh-in",
      "deola-maharashtra-in",
      "deori-jharkhand-in",
      "deori-maharashtra-in",
      "depalpur-madhya-pradesh-in",
      "dera-bassi-punjab-in",
      "derabsh-odisha-in",
      "derapur-uttar-pradesh-in",
      "desar-gujarat-in",
      "deshopran-west-bengal-in",
      "desri-bihar-in",
      "detroj-rampura-gujarat-in",
      "devadurga-karnataka-in",
      "devanahalli-karnataka-in",
      "devarakonda-telangana-in",
      "devarapalle-andhra-pradesh-in",
      "devgad-maharashtra-in",
      "devgadbaria-gujarat-in",
      "devikulam-kerala-in",
      "devprayag-uttarakhand-in",
      "dewas-madhya-pradesh-in",
      "dhamdha-chhattisgarh-in",
      "dhampur-uttar-pradesh-in",
      "dhanarua-bihar-in",
      "dhanaulti-uttarakhand-in",
      "dhanaura-uttar-pradesh-in",
      "dhanbad-cum-kenduadih-cum-jagata-jharkhand-in",
      "dhandhuka-gujarat-in",
      "dhaniakhali-west-bengal-in",
      "dhansura-gujarat-in",
      "dhanwada-telangana-in",
      "dhar-kalan-punjab-in",
      "dhar-madhya-pradesh-in",
      "dharamkot-punjab-in",
      "dharampur-gujarat-in",
      "dharampuri-madhya-pradesh-in",
      "dharapuram-tamil-nadu-in",
      "dharbandora-goa-in",
      "dharmapuri-tamil-nadu-in",
      "dharmasagar-telangana-in",
      "dharmavaram-andhra-pradesh-in",
      "dharmsala-himachal-pradesh-in",
      "dharur-telangana-in",
      "dhaulpur-rajasthan-in",
      "dhaurahara-uttar-pradesh-in",
      "dhenkanal-sadar-odisha-in",
      "dhod-rajasthan-in",
      "dholera-gujarat-in",
      "dholka-gujarat-in",
      "dhramshala-odisha-in",
      "dhrangadhra-gujarat-in",
      "dhule-maharashtra-in",
      "dhuri-punjab-in",
      "dhusuri-odisha-in",
      "diamond-harbour-i-west-bengal-in",
      "diamond-harbour-ii-west-bengal-in",
      "dibrugarh-east-assam-in",
      "dibrugarh-west-assam-in",
      "dichpalle-telangana-in",
      "didwana-rajasthan-in",
      "dighwara-bihar-in",
      "digod-rajasthan-in",
      "dimapur-sadar-nagaland-in",
      "dinapur-cum-khagaul-bihar-in",
      "dindigul-tamil-nadu-in",
      "dindori-madhya-pradesh-in",
      "dindori-maharashtra-in",
      "dispur-assam-in",
      "dod-ballapur-karnataka-in",
      "dohad-gujarat-in",
      "domakonda-telangana-in",
      "domchanch-jharkhand-in",
      "domjur-west-bengal-in",
      "donka-assam-in",
      "dooni-rajasthan-in",
      "doultabad-telangana-in",
      "dubbak-telangana-in",
      "dudhi-uttar-pradesh-in",
      "dudhnai-assam-in",
      "dudu-rajasthan-in",
      "duggirala-andhra-pradesh-in",
      "dukli-tripura-in",
      "dulhin-bazar-bihar-in",
      "dumra-bihar-in",
      "dungarpur-rajasthan-in",
      "durg-chhattisgarh-in",
      "durgawati-bihar-in",
      "dwarakatirumala-andhra-pradesh-in",
      "egra-ii-west-bengal-in",
      "eidgah-jammu-kashmir-in",
      "ekangarsarai-bihar-in",
      "elkathurthi-telangana-in",
      "ellanthakunta-telangana-in",
      "ellenabad-haryana-in",
      "eluru-andhra-pradesh-in",
      "english-bazar-west-bengal-in",
      "ernad-kerala-in",
      "erode-tamil-nadu-in",
      "ersama-odisha-in",
      "etah-uttar-pradesh-in",
      "etawah-uttar-pradesh-in",
      "etcherla-andhra-pradesh-in",
      "etmadpur-uttar-pradesh-in",
      "faizabad-uttar-pradesh-in",
      "falta-west-bengal-in",
      "faridabad-haryana-in",
      "faridkot-punjab-in",
      "faridpur-durgapur-west-bengal-in",
      "farooqnagar-telangana-in",
      "farrukhabad-uttar-pradesh-in",
      "farrukhnagar-haryana-in",
      "fategarh-odisha-in",
      "fatehabad-haryana-in",
      "fatehabad-uttar-pradesh-in",
      "fatehgarh-sahib-punjab-in",
      "fatehpur-pundri-haryana-in",
      "fatehpur-rajasthan-in",
      "fatehpur-uttar-pradesh-in",
      "fatwah-bihar-in",
      "fazilka-punjab-in",
      "ferozepur-jhirka-haryana-in",
      "firozabad-uttar-pradesh-in",
      "firozpur-punjab-in",
      "g-konduru-andhra-pradesh-in",
      "gabhana-uttar-pradesh-in",
      "gadarpur-uttarakhand-in",
      "gadbor-rajasthan-in",
      "gadwal-telangana-in",
      "gaighat-bihar-in",
      "gaighata-west-bengal-in",
      "gairsain-uttarakhand-in",
      "gajapathinagaram-andhra-pradesh-in",
      "gajuwaka-andhra-pradesh-in",
      "gajwel-telangana-in",
      "galsi-i-west-bengal-in",
      "galsi-ii-west-bengal-in",
      "galteshwar-gujarat-in",
      "gambegre-meghalaya-in",
      "gambhiraopet-telangana-in",
      "ganaur-haryana-in",
      "gandeed-telangana-in",
      "ganderbal-jammu-kashmir-in",
      "gandevi-gujarat-in",
      "gandhinagar-gujarat-in",
      "gandlapenta-andhra-pradesh-in",
      "ganganagar-rajasthan-in",
      "gangapur-city-rajasthan-in",
      "gangapur-maharashtra-in",
      "gangdhar-rajasthan-in",
      "gangtok-sikkim-in",
      "gannavaram-andhra-pradesh-in",
      "gantyada-andhra-pradesh-in",
      "garhmukteshwar-uttar-pradesh-in",
      "garide-palle-telangana-in",
      "garividi-andhra-pradesh-in",
      "garkha-bihar-in",
      "garudeshwar-gujarat-in",
      "gauribidanur-karnataka-in",
      "gauriganj-uttar-pradesh-in",
      "gautam-buddha-nagar-uttar-pradesh-in",
      "gawan-jharkhand-in",
      "gaya-town-bihar-in",
      "geesugonda-telangana-in",
      "georai-maharashtra-in",
      "ghanpur-station-telangana-in",
      "gharaunda-haryana-in",
      "ghasipura-odisha-in",
      "ghatal-west-bengal-in",
      "ghatampur-uttar-pradesh-in",
      "ghatanji-maharashtra-in",
      "ghatiya-madhya-pradesh-in",
      "ghatkesar-telangana-in",
      "ghatshila-jharkhand-in",
      "ghaziabad-uttar-pradesh-in",
      "ghazipur-uttar-pradesh-in",
      "ghumarwin-himachal-pradesh-in",
      "giddarbaha-punjab-in",
      "gingee-tamil-nadu-in",
      "giridih-jharkhand-in",
      "girwa-rajasthan-in",
      "gobichettipalayam-tamil-nadu-in",
      "gobindpur-jharkhand-in",
      "gobindpur-odisha-in",
      "godhra-gujarat-in",
      "goghat-i-west-bengal-in",
      "goghat-ii-west-bengal-in",
      "gogunda-rajasthan-in",
      "gohana-haryana-in",
      "goharganj-madhya-pradesh-in",
      "gokavaram-andhra-pradesh-in",
      "golanthara-odisha-in",
      "golmuri-cum-jugsalai-jharkhand-in",
      "gonda-uttar-pradesh-in",
      "gop-odisha-in",
      "gopalpur-odisha-in",
      "gorakhpur-uttar-pradesh-in",
      "gorantla-andhra-pradesh-in",
      "goraul-bihar-in",
      "goreswar-pt-assam-in",
      "gosaba-west-bengal-in",
      "govindgarh-rajasthan-in",
      "gubbi-karnataka-in",
      "gudalur-tamil-nadu-in",
      "gudibanda-karnataka-in",
      "gudiyatham-tamil-nadu-in",
      "guhagar-maharashtra-in",
      "gulbarga-karnataka-in",
      "gumla-jharkhand-in",
      "gummidipoondi-tamil-nadu-in",
      "guna-madhya-pradesh-in",
      "gundala-telangana-in",
      "gundla-palle-telangana-in",
      "gundlupet-karnataka-in",
      "gunnaur-uttar-pradesh-in",
      "guntur-andhra-pradesh-in",
      "gurdaspur-punjab-in",
      "gurgaon-haryana-in",
      "gurla-andhra-pradesh-in",
      "gurudijhatia-odisha-in",
      "guruharsahai-punjab-in",
      "guwahati-assam-in",
      "gwalior-madhya-pradesh-in",
      "gyanpur-uttar-pradesh-in",
      "habra-i-west-bengal-in",
      "habra-ii-west-bengal-in",
      "haidergarh-uttar-pradesh-in",
      "hajipur-bihar-in",
      "hajo-assam-in",
      "haldia-west-bengal-in",
      "haldibari-west-bengal-in",
      "haldwani-uttarakhand-in",
      "halol-gujarat-in",
      "halvad-gujarat-in",
      "hamirpur-uttar-pradesh-in",
      "hanamkonda-telangana-in",
      "handia-uttar-pradesh-in",
      "hansi-haryana-in",
      "hanskhali-west-bengal-in",
      "hansot-gujarat-in",
      "hanumangarh-rajasthan-in",
      "hanumanthuni-padu-andhra-pradesh-in",
      "hanwada-telangana-in",
      "haora-west-bengal-in",
      "hapur-uttar-pradesh-in",
      "harapanahalli-karnataka-in",
      "hardoi-uttar-pradesh-in",
      "hardwar-uttarakhand-in",
      "harihar-karnataka-in",
      "harij-gujarat-in",
      "haringhata-west-bengal-in",
      "haripal-west-bengal-in",
      "harnaut-bihar-in",
      "haroa-west-bengal-in",
      "haroli-himachal-pradesh-in",
      "harraiya-uttar-pradesh-in",
      "harur-tamil-nadu-in",
      "hasanganj-uttar-pradesh-in",
      "hasanparthy-telangana-in",
      "hasanpur-uttar-pradesh-in",
      "hasanpura-bihar-in",
      "hasnabad-west-bengal-in",
      "hassan-karnataka-in",
      "hathin-haryana-in",
      "hathnoora-telangana-in",
      "hathras-uttar-pradesh-in",
      "hatkanangle-maharashtra-in",
      "hatod-madhya-pradesh-in",
      "hatpiplya-madhya-pradesh-in",
      "haveli-maharashtra-in",
      "hayaghat-bihar-in",
      "hayathnagar-telangana-in",
      "hazaribag-jharkhand-in",
      "heggadadevankote-karnataka-in",
      "hezamara-tripura-in",
      "hilsa-bihar-in",
      "himatnagar-gujarat-in",
      "himayatnagar-maharashtra-in",
      "hindaun-rajasthan-in",
      "hindupur-andhra-pradesh-in",
      "hinganghat-maharashtra-in",
      "hingna-maharashtra-in",
      "hingoli-maharashtra-in",
      "hirakud-odisha-in",
      "hiramandalam-andhra-pradesh-in",
      "hiriyur-karnataka-in",
      "hisar-haryana-in",
      "hodal-haryana-in",
      "hole-narsipur-karnataka-in",
      "homnabad-karnataka-in",
      "hosadurga-karnataka-in",
      "hosakote-karnataka-in",
      "hosdurg-kerala-in",
      "hoshangabad-madhya-pradesh-in",
      "hoshiarpur-punjab-in",
      "hospet-karnataka-in",
      "hosur-tamil-nadu-in",
      "hubli-karnataka-in",
      "hunsur-karnataka-in",
      "huzur-madhya-pradesh-in",
      "hyderabad-telangana-in",
      "ibrahimpatnam-andhra-pradesh-in",
      "ibrahimpatnam-telangana-in",
      "idar-gujarat-in",
      "idukki-kerala-in",
      "igatpuri-maharashtra-in",
      "iglas-uttar-pradesh-in",
      "imphal-manipur-in",
      "indapur-maharashtra-in",
      "indi-karnataka-in",
      "indore-madhya-pradesh-in",
      "indri-haryana-in",
      "indukurpet-andhra-pradesh-in",
      "ishupur-bihar-in",
      "islampur-bihar-in",
      "israna-haryana-in",
      "itanagar-arunachal-pradesh-in",
      "itikyal-telangana-in",
      "itkhori-jharkhand-in",
      "ittarmati-odisha-in",
      "jabalpur-madhya-pradesh-in",
      "jadcherla-telangana-in",
      "jagadhri-haryana-in",
      "jagalur-karnataka-in",
      "jagatballavpur-west-bengal-in",
      "jagatpur-odisha-in",
      "jagatsinghapur-odisha-in",
      "jagdevpur-telangana-in",
      "jaggampeta-andhra-pradesh-in",
      "jaggayyapeta-andhra-pradesh-in",
      "jagraon-punjab-in",
      "jagtial-telangana-in",
      "jaijaipur-chhattisgarh-in",
      "jaipur-rajasthan-in",
      "jaisalmer-rajasthan-in",
      "jajapur-odisha-in",
      "jajapur-road-odisha-in",
      "jaji-reddi-gudem-telangana-in",
      "jakhanian-uttar-pradesh-in",
      "jakranpalle-telangana-in",
      "jalalabad-punjab-in",
      "jalalpore-gujarat-in",
      "jalandhar-i-punjab-in",
      "jalandhar-ii-punjab-in",
      "jalaun-uttar-pradesh-in",
      "jalesar-uttar-pradesh-in",
      "jalna-maharashtra-in",
      "jamalpur-west-bengal-in",
      "jamboo-marine-odisha-in",
      "jambughoda-gujarat-in",
      "jambusar-gujarat-in",
      "jami-andhra-pradesh-in",
      "jamkhed-maharashtra-in",
      "jammu-jammu-kashmir-in",
      "jamnagar-gujarat-in",
      "jampuijala-tripura-in",
      "jamshedpur-jharkhand-in",
      "jamuria-west-bengal-in",
      "jamwa-ramgarh-rajasthan-in",
      "jandaha-bihar-in",
      "jangaon-telangana-in",
      "jangipara-west-bengal-in",
      "jansath-uttar-pradesh-in",
      "jaoli-maharashtra-in",
      "jaridih-jharkhand-in",
      "jaspur-uttarakhand-in",
      "jaswantnagar-uttar-pradesh-in",
      "jat-maharashtra-in",
      "jatani-odisha-in",
      "jaunpur-uttar-pradesh-in",
      "jawhar-maharashtra-in",
      "jaynagar-i-west-bengal-in",
      "jaynagar-ii-west-bengal-in",
      "jaypur-west-bengal-in",
      "jehanabad-bihar-in",
      "jevargi-karnataka-in",
      "jewar-uttar-pradesh-in",
      "jhagadia-gujarat-in",
      "jhajjar-haryana-in",
      "jhalod-gujarat-in",
      "jhalrapatan-rajasthan-in",
      "jhanduta-himachal-pradesh-in",
      "jhansi-uttar-pradesh-in",
      "jharasangam-telangana-in",
      "jhargram-west-bengal-in",
      "jharia-cum-jorapokhar-cum-sindri-jharkhand-in",
      "jharsuguda-odisha-in",
      "jhunjhunun-rajasthan-in",
      "jind-haryana-in",
      "jinnaram-telangana-in",
      "jiran-madhya-pradesh-in",
      "jirang-meghalaya-in",
      "jirania-tripura-in",
      "jiyyammavalasa-andhra-pradesh-in",
      "jodhpur-rajasthan-in",
      "jorhat-east-assam-in",
      "jorhat-west-assam-in",
      "joshimath-uttarakhand-in",
      "jotana-gujarat-in",
      "joura-madhya-pradesh-in",
      "julana-haryana-in",
      "junnar-maharashtra-in",
      "k-kotapadu-andhra-pradesh-in",
      "k-v-b-puram-andhra-pradesh-in",
      "kabisuryanagar-odisha-in",
      "kadana-gujarat-in",
      "kadegaon-maharashtra-in",
      "kadi-gujarat-in",
      "kadiam-andhra-pradesh-in",
      "kadipur-uttar-pradesh-in",
      "kagaznagar-telangana-in",
      "kaij-maharashtra-in",
      "kairana-uttar-pradesh-in",
      "kaiserganj-uttar-pradesh-in",
      "kaithal-haryana-in",
      "kakatpur-odisha-in",
      "kakdwip-west-bengal-in",
      "kakinada-rural-andhra-pradesh-in",
      "kako-bihar-in",
      "kakraban-tripura-in",
      "kaladhungi-uttarakhand-in",
      "kalameshwar-maharashtra-in",
      "kalasapakkam-tamil-nadu-in",
      "kalher-telangana-in",
      "kaliganj-west-bengal-in",
      "kalimela-odisha-in",
      "kalinganagar-odisha-in",
      "kalka-haryana-in",
      "kalka-himachal-pradesh-in",
      "kalkulam-tamil-nadu-in",
      "kallakkurichi-tamil-nadu-in",
      "kallur-andhra-pradesh-in",
      "kalna-i-west-bengal-in",
      "kalol-gujarat-in",
      "kalsi-uttarakhand-in",
      "kalwakurthy-telangana-in",
      "kalwan-maharashtra-in",
      "kalyan-maharashtra-in",
      "kamalpur-assam-in",
      "kamareddy-telangana-in",
      "kamptee-maharashtra-in",
      "kamrej-gujarat-in",
      "kanaganapalle-andhra-pradesh-in",
      "kanakapura-karnataka-in",
      "kanayannur-kerala-in",
      "kancheepuram-tamil-nadu-in",
      "kanchikacherla-andhra-pradesh-in",
      "kandaghat-himachal-pradesh-in",
      "kandarpur-odisha-in",
      "kandukur-telangana-in",
      "kangeyam-tamil-nadu-in",
      "kaniha-odisha-in",
      "kanjirappally-kerala-in",
      "kankavli-maharashtra-in",
      "kanke-jharkhand-in",
      "kankipadu-andhra-pradesh-in",
      "kanksa-west-bengal-in",
      "kannad-maharashtra-in",
      "kannauj-uttar-pradesh-in",
      "kannod-madhya-pradesh-in",
      "kanpur-uttar-pradesh-in",
      "kanth-uttar-pradesh-in",
      "kanti-bihar-in",
      "kapadvanj-gujarat-in",
      "kapasan-rajasthan-in",
      "kaprada-gujarat-in",
      "kapurthala-punjab-in",
      "karad-maharashtra-in",
      "karai-parsurai-bihar-in",
      "karaikkudi-tamil-nadu-in",
      "karanpur-rajasthan-in",
      "karauli-rajasthan-in",
      "karchhana-uttar-pradesh-in",
      "kariapatti-tamil-nadu-in",
      "karimnagar-telangana-in",
      "karjan-gujarat-in",
      "karjat-maharashtra-in",
      "karkal-karnataka-in",
      "karmala-maharashtra-in",
      "karnal-haryana-in",
      "karra-jharkhand-in",
      "karthikappally-kerala-in",
      "karunagappally-kerala-in",
      "karur-tamil-nadu-in",
      "karvetinagar-andhra-pradesh-in",
      "karvir-maharashtra-in",
      "kasaragod-kerala-in",
      "kasauli-himachal-pradesh-in",
      "kashipur-uttarakhand-in",
      "kasimkota-andhra-pradesh-in",
      "kasrawad-madhya-pradesh-in",
      "katamdag-jharkhand-in",
      "kathlal-gujarat-in",
      "kathua-jammu-kashmir-in",
      "kathumar-rajasthan-in",
      "katol-maharashtra-in",
      "katpadi-tamil-nadu-in",
      "kattakada-kerala-in",
      "kattangoor-telangana-in",
      "keesara-telangana-in",
      "kekri-rajasthan-in",
      "kelapur-maharashtra-in",
      "kendrapada-odisha-in",
      "kendujhar-town-odisha-in",
      "keolari-madhya-pradesh-in",
      "keotiranway-bihar-in",
      "kerakat-uttar-pradesh-in",
      "keredari-jharkhand-in",
      "keshampet-telangana-in",
      "keshoraipatan-rajasthan-in",
      "keshpur-west-bengal-in",
      "kethe-palle-telangana-in",
      "khadur-sahib-punjab-in",
      "khair-uttar-pradesh-in",
      "khaira-odisha-in",
      "khalapur-maharashtra-in",
      "khalikote-odisha-in",
      "khalilabad-uttar-pradesh-in",
      "khamanon-punjab-in",
      "khambhat-gujarat-in",
      "khammam-rural-telangana-in",
      "khammam-urban-telangana-in",
      "khanakul-i-west-bengal-in",
      "khanakul-ii-west-bengal-in",
      "khanapur-maharashtra-in",
      "khandagiri-odisha-in",
      "khandala-maharashtra-in",
      "khandapada-odisha-in",
      "khandela-rajasthan-in",
      "khandwa-madhya-pradesh-in",
      "khanna-punjab-in",
      "khanyar-jammu-kashmir-in",
      "kharagpur-i-west-bengal-in",
      "kharagpur-ii-west-bengal-in",
      "kharar-punjab-in",
      "kharkhoda-haryana-in",
      "khatauli-uttar-pradesh-in",
      "khatav-maharashtra-in",
      "khatima-uttarakhand-in",
      "khed-maharashtra-in",
      "kheda-gujarat-in",
      "khejuri-i-west-bengal-in",
      "khekada-uttar-pradesh-in",
      "khelari-jharkhand-in",
      "kheragarh-uttar-pradesh-in",
      "khetri-rajasthan-in",
      "khoirabari-pt-assam-in",
      "khordha-odisha-in",
      "khordha-sadar-odisha-in",
      "khuldabad-maharashtra-in",
      "khunti-jharkhand-in",
      "khurja-uttar-pradesh-in",
      "khusrupur-bihar-in",
      "kichha-uttarakhand-in",
      "killa-tripura-in",
      "kilvelur-tamil-nadu-in",
      "kinathukadavu-tamil-nadu-in",
      "kiraoli-uttar-pradesh-in",
      "kishangarh-bas-rajasthan-in",
      "kishangarh-rajasthan-in",
      "kishangarh-renwal-rajasthan-in",
      "kishannagar-odisha-in",
      "kochi-kerala-in",
      "kodad-telangana-in",
      "kodaikanal-tamil-nadu-in",
      "kodakandla-telangana-in",
      "kodala-odisha-in",
      "kodangal-telangana-in",
      "kodungallur-kerala-in",
      "kohir-telangana-in",
      "koida-odisha-in",
      "koil-uttar-pradesh-in",
      "koilwar-bihar-in",
      "kokrajhar-pt-assam-in",
      "kolaghat-west-bengal-in",
      "kolar-karnataka-in",
      "kolkata-west-bengal-in",
      "kollam-kerala-in",
      "kollapur-telangana-in",
      "kollegal-karnataka-in",
      "kollipara-andhra-pradesh-in",
      "kollur-andhra-pradesh-in",
      "konark-odisha-in",
      "kondapak-telangana-in",
      "kondapur-telangana-in",
      "kondotty-kerala-in",
      "kondurg-telangana-in",
      "konni-kerala-in",
      "konta-chhattisgarh-in",
      "kopargaon-maharashtra-in",
      "korai-odisha-in",
      "koratagere-karnataka-in",
      "koregaon-maharashtra-in",
      "korukonda-andhra-pradesh-in",
      "kosgi-telangana-in",
      "kosli-haryana-in",
      "kosya-kutauli-uttarakhand-in",
      "kotabommali-andhra-pradesh-in",
      "kotagiri-tamil-nadu-in",
      "kotapalle-telangana-in",
      "kotda-sangani-gujarat-in",
      "kotdwara-uttarakhand-in",
      "kothagudem-telangana-in",
      "kothakota-telangana-in",
      "kothamangalam-kerala-in",
      "kothavalasa-andhra-pradesh-in",
      "kothur-telangana-in",
      "kotkasim-rajasthan-in",
      "kotkhawda-rajasthan-in",
      "kotputli-rajasthan-in",
      "kotri-rajasthan-in",
      "kottarakkara-kerala-in",
      "kottayam-kerala-in",
      "kotulpur-west-bengal-in",
      "kovilpatti-tamil-nadu-in",
      "kovur-andhra-pradesh-in",
      "kovvur-andhra-pradesh-in",
      "kowdipalle-telangana-in",
      "koya-assam-in",
      "koyyuru-andhra-pradesh-in",
      "kozhenchery-kerala-in",
      "kozhikode-kerala-in",
      "krishangarh-himachal-pradesh-in",
      "krishnagar-i-west-bengal-in",
      "krishnagar-ii-west-bengal-in",
      "krishnagiri-tamil-nadu-in",
      "krishnarajanagara-karnataka-in",
      "krishnarajpet-karnataka-in",
      "kuakhia-odisha-in",
      "kuchaman-city-rajasthan-in",
      "kuhi-maharashtra-in",
      "kukshi-madhya-pradesh-in",
      "kulathur-tamil-nadu-in",
      "kulcharam-telangana-in",
      "kulithalai-tamil-nadu-in",
      "kulkacharla-telangana-in",
      "kulpi-west-bengal-in",
      "kultali-west-bengal-in",
      "kumbakonam-tamil-nadu-in",
      "kumbhalgarh-rajasthan-in",
      "kumher-rajasthan-in",
      "kunda-uttar-pradesh-in",
      "kundapura-karnataka-in",
      "kunigal-karnataka-in",
      "kunnathunad-kerala-in",
      "kunnathur-kerala-in",
      "kurhani-bihar-in",
      "kurinjipadi-tamil-nadu-in",
      "kurnool-andhra-pradesh-in",
      "kurseong-west-bengal-in",
      "kuttanad-kerala-in",
      "lachhmangarh-rajasthan-in",
      "ladpura-rajasthan-in",
      "lakhimpur-uttar-pradesh-in",
      "lakhipur-assam-in",
      "lakhtar-gujarat-in",
      "lakkavarapukota-andhra-pradesh-in",
      "laksar-uttarakhand-in",
      "lalganj-bihar-in",
      "lalganj-uttar-pradesh-in",
      "lalgudi-tamil-nadu-in",
      "lalitpur-uttar-pradesh-in",
      "lalkuan-uttarakhand-in",
      "lalsot-rajasthan-in",
      "lambhua-uttar-pradesh-in",
      "lamphelpat-manipur-in",
      "lansdowne-uttarakhand-in",
      "laveru-andhra-pradesh-in",
      "lawan-rajasthan-in",
      "laxmangarh-rajasthan-in",
      "lehra-punjab-in",
      "limbdi-gujarat-in",
      "lingal-telangana-in",
      "lingalaghanpur-telangana-in",
      "lingaraj-odisha-in",
      "lodhika-gujarat-in",
      "lohardaga-jharkhand-in",
      "loharu-haryana-in",
      "loni-uttar-pradesh-in",
      "lucknow-uttar-pradesh-in",
      "ludhiana-east-punjab-in",
      "ludhiana-west-punjab-in",
      "lunawada-gujarat-in",
      "luni-rajasthan-in",
      "lunkaransar-rajasthan-in",
      "m-turkapalle-telangana-in",
      "macherla-andhra-pradesh-in",
      "machhlishahr-uttar-pradesh-in",
      "machilipatnam-andhra-pradesh-in",
      "madathukulm-tamil-nadu-in",
      "maddur-karnataka-in",
      "maddur-telangana-in",
      "madgul-telangana-in",
      "madha-maharashtra-in",
      "madhavaram-tamil-nadu-in",
      "madhugiri-karnataka-in",
      "madhupur-jharkhand-in",
      "madikeri-karnataka-in",
      "madugula-andhra-pradesh-in",
      "madukkarai-tamil-nadu-in",
      "madurai-east-tamil-nadu-in",
      "madurai-north-tamil-nadu-in",
      "madurai-south-tamil-nadu-in",
      "madurai-west-tamil-nadu-in",
      "maduranthakam-tamil-nadu-in",
      "maduravoyal-tamil-nadu-in",
      "magadi-karnataka-in",
      "maganoor-telangana-in",
      "magrahat-i-west-bengal-in",
      "magrahat-ii-west-bengal-in",
      "mahabaleshwar-maharashtra-in",
      "mahabubabad-telangana-in",
      "mahad-maharashtra-in",
      "mahadevpur-telangana-in",
      "maham-haryana-in",
      "mahanga-odisha-in",
      "maharajganj-uttar-pradesh-in",
      "mahasi-uttar-pradesh-in",
      "mahavan-uttar-pradesh-in",
      "mahbubnagar-telangana-in",
      "mahe-puducherry-in",
      "mahendragarh-haryana-in",
      "mahesana-gujarat-in",
      "maheshwar-madhya-pradesh-in",
      "maheswaram-telangana-in",
      "mahisadal-west-bengal-in",
      "mahmudabad-uttar-pradesh-in",
      "mahnar-bihar-in",
      "mahoba-uttar-pradesh-in",
      "mahua-bihar-in",
      "mahudha-gujarat-in",
      "mahwa-rajasthan-in",
      "mainpuri-uttar-pradesh-in",
      "maker-bihar-in",
      "makhdumpur-bihar-in",
      "malakhera-rajasthan-in",
      "malarna-doongar-rajasthan-in",
      "malavalli-karnataka-in",
      "malegaon-maharashtra-in",
      "malerkotla-punjab-in",
      "malihabad-uttar-pradesh-in",
      "malkajgiri-telangana-in",
      "malkangiri-odisha-in",
      "mallappally-kerala-in",
      "malout-punjab-in",
      "malpur-gujarat-in",
      "malpura-rajasthan-in",
      "malshiras-maharashtra-in",
      "malthon-madhya-pradesh-in",
      "malur-karnataka-in",
      "man-maharashtra-in",
      "manachanallur-tamil-nadu-in",
      "manakondur-telangana-in",
      "manbazar-ii-west-bengal-in",
      "manchal-telangana-in",
      "mancheswar-odisha-in",
      "mandai-tripura-in",
      "mandal-gujarat-in",
      "mandangad-maharashtra-in",
      "mandar-jharkhand-in",
      "mandasa-andhra-pradesh-in",
      "mandawar-rajasthan-in",
      "mandirbazar-west-bengal-in",
      "mandu-jharkhand-in",
      "mandvi-gujarat-in",
      "mandya-karnataka-in",
      "maner-bihar-in",
      "manesar-haryana-in",
      "mangalagiri-andhra-pradesh-in",
      "mangaldoi-pt-assam-in",
      "mangalore-karnataka-in",
      "mangalpur-odisha-in",
      "mangalvedhe-maharashtra-in",
      "mangaon-maharashtra-in",
      "manjeswaram-kerala-in",
      "manjhanpur-uttar-pradesh-in",
      "manjlegaon-maharashtra-in",
      "mankapur-uttar-pradesh-in",
      "manmangalam-tamil-nadu-in",
      "mannargudi-tamil-nadu-in",
      "mannarkad-kerala-in",
      "manpur-bihar-in",
      "mansa-gujarat-in",
      "mansa-punjab-in",
      "manteswar-west-bengal-in",
      "mantha-maharashtra-in",
      "manubolu-andhra-pradesh-in",
      "marhaura-bihar-in",
      "mariahu-uttar-pradesh-in",
      "marpalle-telangana-in",
      "marriguda-telangana-in",
      "marsaghai-odisha-in",
      "marwan-bihar-in",
      "marwar-junction-rajasthan-in",
      "masaurhi-bihar-in",
      "masuda-rajasthan-in",
      "mat-uttar-pradesh-in",
      "matanhail-haryana-in",
      "matar-gujarat-in",
      "matarbari-tripura-in",
      "mathura-uttar-pradesh-in",
      "mathurapur-i-west-bengal-in",
      "mathurapur-ii-west-bengal-in",
      "matigara-west-bengal-in",
      "mattam-palle-telangana-in",
      "mauda-maharashtra-in",
      "maujamabad-rajasthan-in",
      "maunath-bhanjan-uttar-pradesh-in",
      "mavelikkara-kerala-in",
      "mavli-rajasthan-in",
      "mawal-maharashtra-in",
      "mawana-uttar-pradesh-in",
      "mawryngkneng-meghalaya-in",
      "mawshynrut-meghalaya-in",
      "mayiladuthurai-tamil-nadu-in",
      "mayong-assam-in",
      "medak-telangana-in",
      "medchal-telangana-in",
      "medikonduru-andhra-pradesh-in",
      "meenachil-kerala-in",
      "meerganj-uttar-pradesh-in",
      "meerut-uttar-pradesh-in",
      "mehgaon-madhya-pradesh-in",
      "mehmedabad-gujarat-in",
      "melaghar-tripura-in",
      "memari-i-west-bengal-in",
      "merakamudidam-andhra-pradesh-in",
      "mettupalayam-tamil-nadu-in",
      "mettur-tamil-nadu-in",
      "mhasla-maharashtra-in",
      "mhow-madhya-pradesh-in",
      "midjil-telangana-in",
      "midnapore-west-bengal-in",
      "milkipur-uttar-pradesh-in",
      "minakhan-west-bengal-in",
      "miraj-maharashtra-in",
      "mirdoddi-telangana-in",
      "miryalaguda-telangana-in",
      "mirzapur-uttar-pradesh-in",
      "misrikh-uttar-pradesh-in",
      "modasa-gujarat-in",
      "modinagar-uttar-pradesh-in",
      "moga-punjab-in",
      "mohammdi-uttar-pradesh-in",
      "mohania-bihar-in",
      "mohanlalganj-uttar-pradesh-in",
      "mohanpur-jharkhand-in",
      "mohanpur-tripura-in",
      "mohol-maharashtra-in",
      "moinabad-telangana-in",
      "mokhada-maharashtra-in",
      "mominpet-telangana-in",
      "moonak-punjab-in",
      "moradabad-uttar-pradesh-in",
      "morena-madhya-pradesh-in",
      "mori-uttarakhand-in",
      "morigaon-assam-in",
      "mormugao-goa-in",
      "morvi-gujarat-in",
      "morwa-bihar-in",
      "motunga-odisha-in",
      "moyna-west-bengal-in",
      "muhammadabad-gohna-uttar-pradesh-in",
      "mukerian-punjab-in",
      "muktsar-punjab-in",
      "mukundapuram-kerala-in",
      "mulbagal-karnataka-in",
      "mulshi-maharashtra-in",
      "mulug-telangana-in",
      "mumbai-maharashtra-in",
      "mumbai-suburban-maharashtra-in",
      "munagala-telangana-in",
      "munagapaka-andhra-pradesh-in",
      "mungiakami-tripura-in",
      "muniguda-odisha-in",
      "munpalle-telangana-in",
      "murbad-maharashtra-in",
      "murhu-jharkhand-in",
      "murshidabad-jiaganj-west-bengal-in",
      "murud-maharashtra-in",
      "musabani-jharkhand-in",
      "musafirkhana-uttar-pradesh-in",
      "musahari-bihar-in",
      "musiri-tamil-nadu-in",
      "muthukur-andhra-pradesh-in",
      "muvattupuzha-kerala-in",
      "muzaffarnagar-uttar-pradesh-in",
      "muzaffarpur-bihar-in",
      "mylavaram-andhra-pradesh-in",
      "mylliem-meghalaya-in",
      "mysore-karnataka-in",
      "nabadwip-west-bengal-in",
      "nabha-punjab-in",
      "nadbai-rajasthan-in",
      "nadendla-andhra-pradesh-in",
      "nadiad-gujarat-in",
      "nadoti-rajasthan-in",
      "nagalapuram-andhra-pradesh-in",
      "nagamangala-karnataka-in",
      "nagaon-assam-in",
      "nagapattinam-tamil-nadu-in",
      "nagar-maharashtra-in",
      "nagar-rajasthan-in",
      "nagarbera-assam-in",
      "nagareddipet-telangana-in",
      "nagari-andhra-pradesh-in",
      "nagarkurnool-telangana-in",
      "nagaur-rajasthan-in",
      "nagbhir-maharashtra-in",
      "nagina-uttar-pradesh-in",
      "nagpur-rural-maharashtra-in",
      "nagpur-urban-maharashtra-in",
      "nagri-jharkhand-in",
      "nahan-himachal-pradesh-in",
      "naina-devi-himachal-pradesh-in",
      "nainital-uttarakhand-in",
      "najibabad-uttar-pradesh-in",
      "nakashipara-west-bengal-in",
      "nakkapalle-andhra-pradesh-in",
      "nakodar-punjab-in",
      "nakrekal-telangana-in",
      "nakur-uttar-pradesh-in",
      "nalagarh-himachal-pradesh-in",
      "nalbari-assam-in",
      "nalco-odisha-in",
      "nalgonda-telangana-in",
      "namakkal-tamil-nadu-in",
      "namkhana-west-bengal-in",
      "namkum-jharkhand-in",
      "nampalle-telangana-in",
      "nanda-kumar-west-bengal-in",
      "nandankanan-odisha-in",
      "nanded-maharashtra-in",
      "nandgaon-maharashtra-in",
      "nandod-gujarat-in",
      "nangal-punjab-in",
      "nangnoor-telangana-in",
      "nanjangud-karnataka-in",
      "naraingarh-haryana-in",
      "naraingarh-punjab-in",
      "narasannapeta-andhra-pradesh-in",
      "narasinghpur-odisha-in",
      "narayanapur-telangana-in",
      "narayanavanam-andhra-pradesh-in",
      "narbal-jammu-kashmir-in",
      "narendra-nagar-uttarakhand-in",
      "narhat-bihar-in",
      "narketpalle-telangana-in",
      "narkhed-maharashtra-in",
      "narnaul-haryana-in",
      "narnaund-haryana-in",
      "narsapur-telangana-in",
      "narsipatnam-andhra-pradesh-in",
      "narwana-haryana-in",
      "nashik-maharashtra-in",
      "nasvadi-gujarat-in",
      "nathdwara-rajasthan-in",
      "natrampalli-tamil-nadu-in",
      "naubatpur-bihar-in",
      "navalgund-karnataka-in",
      "navsari-gujarat-in",
      "nawa-rajasthan-in",
      "nawabganj-uttar-pradesh-in",
      "nawabpet-telangana-in",
      "nawada-bihar-in",
      "nawalgarh-rajasthan-in",
      "nawanshahr-punjab-in",
      "nawapur-maharashtra-in",
      "naxalbari-west-bengal-in",
      "nayagarh-odisha-in",
      "nayagarh-sadar-odisha-in",
      "nedumangad-kerala-in",
      "neem-ka-thana-rajasthan-in",
      "neemrana-rajasthan-in",
      "nelamangala-karnataka-in",
      "nellikudur-telangana-in",
      "nellimarla-andhra-pradesh-in",
      "nellore-andhra-pradesh-in",
      "nevasa-maharashtra-in",
      "new-delhi-new-delhi-in",
      "neyyattinkara-kerala-in",
      "niali-odisha-in",
      "nighasan-uttar-pradesh-in",
      "nihal-singhwala-punjab-in",
      "nikirai-odisha-in",
      "nilambur-kerala-in",
      "nilokheri-haryana-in",
      "nimapada-odisha-in",
      "nimbahera-rajasthan-in",
      "niphad-maharashtra-in",
      "nirakarpur-odisha-in",
      "nirmal-telangana-in",
      "nirsa-cum-chirkunda-west-bengal-in",
      "nischintakoli-odisha-in",
      "niwai-rajasthan-in",
      "nizamabad-telangana-in",
      "noorsarai-bihar-in",
      "north-guwahati-assam-in",
      "north-guwahati-pt-assam-in",
      "nuapada-odisha-in",
      "nuh-haryana-in",
      "nyalkal-telangana-in",
      "obra-bihar-in",
      "odagaon-odisha-in",
      "olatapur-odisha-in",
      "olpad-gujarat-in",
      "omalur-tamil-nadu-in",
      "onda-west-bengal-in",
      "ondal-west-bengal-in",
      "ongole-andhra-pradesh-in",
      "orai-uttar-pradesh-in",
      "orchha-chhattisgarh-in",
      "ormanjhi-jharkhand-in",
      "osian-rajasthan-in",
      "ottappalam-kerala-in",
      "ozhukarai-puducherry-in",
      "padampur-rajasthan-in",
      "paddhari-gujarat-in",
      "padmanabham-andhra-pradesh-in",
      "padra-gujarat-in",
      "padrauna-uttar-pradesh-in",
      "paithan-maharashtra-in",
      "pakala-andhra-pradesh-in",
      "palakkad-kerala-in",
      "palakkodu-tamil-nadu-in",
      "palakonda-andhra-pradesh-in",
      "palani-tamil-nadu-in",
      "palanpur-gujarat-in",
      "palasa-andhra-pradesh-in",
      "palasbari-assam-in",
      "palayamkottai-tamil-nadu-in",
      "palghar-maharashtra-in",
      "pali-rajasthan-in",
      "palia-uttar-pradesh-in",
      "paliganj-bihar-in",
      "palladam-tamil-nadu-in",
      "pallipattu-tamil-nadu-in",
      "palsana-gujarat-in",
      "palus-maharashtra-in",
      "palwal-haryana-in",
      "pamidimukkala-andhra-pradesh-in",
      "panagar-madhya-pradesh-in",
      "panchkula-haryana-in",
      "panchla-west-bengal-in",
      "pandavapura-karnataka-in",
      "pandharpur-maharashtra-in",
      "pandhurna-madhya-pradesh-in",
      "pandua-west-bengal-in",
      "panhala-maharashtra-in",
      "panikoili-odisha-in",
      "panipat-haryana-in",
      "panruti-tamil-nadu-in",
      "panskura-i-west-bengal-in",
      "panthachowk-jammu-kashmir-in",
      "panvel-maharashtra-in",
      "papannapet-telangana-in",
      "paradeep-luck-odisha-in",
      "paradip-odisha-in",
      "paranda-maharashtra-in",
      "paravada-andhra-pradesh-in",
      "paravur-kerala-in",
      "parbhani-maharashtra-in",
      "pardi-gujarat-in",
      "pargi-telangana-in",
      "parigi-andhra-pradesh-in",
      "parner-maharashtra-in",
      "parola-maharashtra-in",
      "parsa-bihar-in",
      "parseoni-maharashtra-in",
      "parvathipuram-andhra-pradesh-in",
      "patan-chhattisgarh-in",
      "patan-gujarat-in",
      "patan-madhya-pradesh-in",
      "patan-maharashtra-in",
      "patancheru-telangana-in",
      "pataudi-haryana-in",
      "patepur-bihar-in",
      "paterhi-belsar-bihar-in",
      "pathanapuram-kerala-in",
      "pathankot-punjab-in",
      "pathardi-maharashtra-in",
      "patharia-chhattisgarh-in",
      "patharpratima-west-bengal-in",
      "pathorighat-pt-assam-in",
      "patiala-punjab-in",
      "patiyali-uttar-pradesh-in",
      "patkura-odisha-in",
      "patna-rural-bihar-in",
      "patnagarh-odisha-in",
      "patoda-maharashtra-in",
      "patori-bihar-in",
      "patran-punjab-in",
      "patratu-jharkhand-in",
      "pattambi-kerala-in",
      "pattamundai-odisha-in",
      "patti-punjab-in",
      "pauni-maharashtra-in",
      "pauri-uttarakhand-in",
      "pavagada-karnataka-in",
      "payakaraopeta-andhra-pradesh-in",
      "payal-punjab-in",
      "pebbair-telangana-in",
      "peda-araveedu-andhra-pradesh-in",
      "pedagantyada-andhra-pradesh-in",
      "pedakakani-andhra-pradesh-in",
      "peddamandadi-telangana-in",
      "peddapuram-andhra-pradesh-in",
      "peddavoora-telangana-in",
      "peerumade-kerala-in",
      "pehowa-haryana-in",
      "pen-maharashtra-in",
      "penamaluru-andhra-pradesh-in",
      "pendurthi-andhra-pradesh-in",
      "pennagaram-tamil-nadu-in",
      "penugonda-andhra-pradesh-in",
      "penukonda-andhra-pradesh-in",
      "perambalur-tamil-nadu-in",
      "perinthalmanna-kerala-in",
      "pernem-goa-in",
      "perundurai-tamil-nadu-in",
      "perur-tamil-nadu-in",
      "petlad-gujarat-in",
      "phagi-rajasthan-in",
      "phagwara-punjab-in",
      "phaltan-maharashtra-in",
      "phansidewa-west-bengal-in",
      "phillaur-punjab-in",
      "phulabani-town-odisha-in",
      "phullen-mizoram-in",
      "phulpur-uttar-pradesh-in",
      "phulwari-bihar-in",
      "pichatur-andhra-pradesh-in",
      "pichhore-madhya-pradesh-in",
      "piduguralla-andhra-pradesh-in",
      "pilibhit-uttar-pradesh-in",
      "pindra-uttar-pradesh-in",
      "pindwara-rajasthan-in",
      "pipalda-rajasthan-in",
      "pipariya-madhya-pradesh-in",
      "pipili-odisha-in",
      "piriyapatna-karnataka-in",
      "piro-bihar-in",
      "pithapuram-andhra-pradesh-in",
      "pithoragarh-uttarakhand-in",
      "pitlam-telangana-in",
      "pochampalle-telangana-in",
      "pochampalli-tamil-nadu-in",
      "poladpur-maharashtra-in",
      "polaki-andhra-pradesh-in",
      "polba-dadpur-west-bengal-in",
      "pollachi-tamil-nadu-in",
      "polur-tamil-nadu-in",
      "ponda-goa-in",
      "ponduru-andhra-pradesh-in",
      "ponnani-kerala-in",
      "ponneri-tamil-nadu-in",
      "poonamallee-tamil-nadu-in",
      "poornagiri-uttarakhand-in",
      "porompat-manipur-in",
      "potka-jharkhand-in",
      "prantij-gujarat-in",
      "pratapgarh-uttar-pradesh-in",
      "prathipadu-andhra-pradesh-in",
      "puducherry-puducherry-in",
      "pudur-telangana-in",
      "pulkal-telangana-in",
      "punahana-haryana-in",
      "punalur-kerala-in",
      "punasa-madhya-pradesh-in",
      "pune-city-maharashtra-in",
      "punpun-bihar-in",
      "purandhar-maharashtra-in",
      "puranpur-uttar-pradesh-in",
      "purbasthali-i-west-bengal-in",
      "purbasthali-ii-west-bengal-in",
      "puri-ps-odisha-in",
      "purna-maharashtra-in",
      "pursura-west-bengal-in",
      "purulia-ii-west-bengal-in",
      "purunakot-odisha-in",
      "purwa-uttar-pradesh-in",
      "pusapatirega-andhra-pradesh-in",
      "pushkar-rajasthan-in",
      "puttaparthi-andhra-pradesh-in",
      "puttur-andhra-pradesh-in",
      "puttur-karnataka-in",
      "quepem-goa-in",
      "quilandy-kerala-in",
      "qutubullapur-telangana-in",
      "rae-bareli-uttar-pradesh-in",
      "raghunathapali-odisha-in",
      "raghunathganj-i-west-bengal-in",
      "raghunathpalle-telangana-in",
      "rahta-maharashtra-in",
      "rahui-bihar-in",
      "rahuri-maharashtra-in",
      "raichur-karnataka-in",
      "raikot-punjab-in",
      "railmagra-rajasthan-in",
      "raina-i-west-bengal-in",
      "raini-rajasthan-in",
      "raipur-chhattisgarh-in",
      "raisen-madhya-pradesh-in",
      "raja-pakar-bihar-in",
      "rajagangapur-odisha-in",
      "rajahmundry-andhra-pradesh-in",
      "rajahmundry-rural-andhra-pradesh-in",
      "rajahmundry-urban-andhra-pradesh-in",
      "rajam-andhra-pradesh-in",
      "rajanagaram-andhra-pradesh-in",
      "rajapet-telangana-in",
      "rajapur-maharashtra-in",
      "rajarhat-west-bengal-in",
      "rajendranagar-telangana-in",
      "rajganj-west-bengal-in",
      "rajgarh-rajasthan-in",
      "rajgarhi-uttarakhand-in",
      "rajgir-bihar-in",
      "rajkot-gujarat-in",
      "rajnagar-odisha-in",
      "rajnagar-tripura-in",
      "rajpura-punjab-in",
      "rajsamand-rajasthan-in",
      "ramachandi-odisha-in",
      "ramachandrapuram-telangana-in",
      "ramagundam-telangana-in",
      "ramanagaram-karnataka-in",
      "ramanathapuram-tamil-nadu-in",
      "ramayampet-telangana-in",
      "rambilli-andhra-pradesh-in",
      "rameswaram-tamil-nadu-in",
      "ramganj-mandi-rajasthan-in",
      "ramgarh-jharkhand-in",
      "ramgarh-rajasthan-in",
      "ramnagar-i-west-bengal-in",
      "ramnagar-ii-west-bengal-in",
      "ramnagar-uttar-pradesh-in",
      "ramnagar-uttarakhand-in",
      "rampur-maniharan-uttar-pradesh-in",
      "rampur-uttar-pradesh-in",
      "rampura-phul-punjab-in",
      "rampurhat-i-west-bengal-in",
      "rampurhat-ii-west-bengal-in",
      "ramsanehighat-uttar-pradesh-in",
      "ramtek-maharashtra-in",
      "ranaghat-i-west-bengal-in",
      "ranaghat-ii-west-bengal-in",
      "ranapur-odisha-in",
      "ranastalam-andhra-pradesh-in",
      "rangia-pt-assam-in",
      "rangjuli-assam-in",
      "raniganj-uttar-pradesh-in",
      "raniganj-west-bengal-in",
      "ranikhet-uttarakhand-in",
      "ranni-kerala-in",
      "rasipuram-tamil-nadu-in",
      "rasra-uttar-pradesh-in",
      "ratlam-madhya-pradesh-in",
      "ratnagiri-maharashtra-in",
      "ratu-jharkhand-in",
      "raurkela-industrial-township-its-odisha-in",
      "raurkela-m-odisha-in",
      "ravikamatham-andhra-pradesh-in",
      "ravulapalem-andhra-pradesh-in",
      "rawatbhata-rajasthan-in",
      "regidi-amadalavalasa-andhra-pradesh-in",
      "rehatgaon-madhya-pradesh-in",
      "remuna-odisha-in",
      "rengali-damsite-odisha-in",
      "renigunta-andhra-pradesh-in",
      "rewari-haryana-in",
      "rishikesh-uttarakhand-in",
      "robertsganj-uttar-pradesh-in",
      "roha-maharashtra-in",
      "rohtak-haryana-in",
      "rongara-meghalaya-in",
      "roorkee-uttarakhand-in",
      "rowthulapudi-andhra-pradesh-in",
      "rudauli-uttar-pradesh-in",
      "rudraprayag-uttarakhand-in",
      "rudrapur-uttarakhand-in",
      "runisaidpur-bihar-in",
      "rupbas-rajasthan-in",
      "rupnagar-punjab-in",
      "rupsa-odisha-in",
      "s-a-s-nagar-mohali-punjab-in",
      "s-rayavaram-andhra-pradesh-in",
      "sabbavaram-andhra-pradesh-in",
      "sadabad-uttar-pradesh-in",
      "sadak-arjuni-maharashtra-in",
      "sadar-odisha-in",
      "sadasivpet-telangana-in",
      "sadulshahar-rajasthan-in",
      "safidon-haryana-in",
      "safipur-uttar-pradesh-in",
      "sagar-madhya-pradesh-in",
      "sahadevkhunta-odisha-in",
      "saharanpur-uttar-pradesh-in",
      "sahdai-buzurg-bihar-in",
      "saheednagar-odisha-in",
      "sahid-matangini-west-bengal-in",
      "sahjanwa-uttar-pradesh-in",
      "saidapur-telangana-in",
      "saidpur-uttar-pradesh-in",
      "sakaldiha-uttar-pradesh-in",
      "sakhinetipalle-andhra-pradesh-in",
      "sakleshpur-karnataka-in",
      "sakra-bihar-in",
      "salanpur-west-bengal-in",
      "salbani-west-bengal-in",
      "salcete-goa-in",
      "salem-south-tamil-nadu-in",
      "salem-tamil-nadu-in",
      "salem-west-tamil-nadu-in",
      "salema-tripura-in",
      "salepur-odisha-in",
      "salur-andhra-pradesh-in",
      "samalkha-haryana-in",
      "samana-punjab-in",
      "samari-chhattisgarh-in",
      "samastipur-bihar-in",
      "sambalpur-m-odisha-in",
      "sambhal-uttar-pradesh-in",
      "sambhar-rajasthan-in",
      "sampatchak-bihar-in",
      "sampla-haryana-in",
      "samrala-punjab-in",
      "samudrapur-maharashtra-in",
      "sanand-gujarat-in",
      "sandeshkhali-i-west-bengal-in",
      "sandila-uttar-pradesh-in",
      "sangam-telangana-in",
      "sangameshwar-maharashtra-in",
      "sangamner-maharashtra-in",
      "sanganer-rajasthan-in",
      "sangareddy-telangana-in",
      "sangrur-punjab-in",
      "sanguem-goa-in",
      "sankari-tamil-nadu-in",
      "sankhavaram-andhra-pradesh-in",
      "sankheswar-gujarat-in",
      "sankrail-west-bengal-in",
      "santhabommali-andhra-pradesh-in",
      "santhakaviti-andhra-pradesh-in",
      "santipur-west-bengal-in",
      "sapotra-rajasthan-in",
      "sarada-rajasthan-in",
      "sarairanjan-bihar-in",
      "saraiya-bihar-in",
      "sarangapur-telangana-in",
      "sarankul-odisha-in",
      "sarasvati-patan-gujarat-in",
      "sardarpur-madhya-pradesh-in",
      "sardhana-uttar-pradesh-in",
      "sardulgarh-punjab-in",
      "saroornagar-telangana-in",
      "sarwar-rajasthan-in",
      "satara-maharashtra-in",
      "sathyamangalam-tamil-nadu-in",
      "satpuli-uttarakhand-in",
      "sattenapalle-andhra-pradesh-in",
      "satyabadi-odisha-in",
      "satyavedu-andhra-pradesh-in",
      "sausar-madhya-pradesh-in",
      "savli-gujarat-in",
      "savner-maharashtra-in",
      "sawai-madhopur-rajasthan-in",
      "sawer-madhya-pradesh-in",
      "sayla-gujarat-in",
      "sedam-karnataka-in",
      "seethanagaram-andhra-pradesh-in",
      "sehore-madhya-pradesh-in",
      "seloo-maharashtra-in",
      "semari-rajasthan-in",
      "seraikela-jharkhand-in",
      "serampur-uttarpara-west-bengal-in",
      "serilingampally-telangana-in",
      "shabad-telangana-in",
      "shahabad-uttar-pradesh-in",
      "shahapur-maharashtra-in",
      "shahbad-haryana-in",
      "shahganj-uttar-pradesh-in",
      "shahjahanpur-uttar-pradesh-in",
      "shahpur-bihar-in",
      "shahpura-madhya-pradesh-in",
      "shahpura-rajasthan-in",
      "shahuwadi-maharashtra-in",
      "shamgarh-madhya-pradesh-in",
      "shamirpet-telangana-in",
      "shamli-uttar-pradesh-in",
      "shamshabad-telangana-in",
      "shankarampet-r-telangana-in",
      "shankarpalle-telangana-in",
      "shevgaon-maharashtra-in",
      "shikarpur-uttar-pradesh-in",
      "shikohabad-uttar-pradesh-in",
      "shillong-meghalaya-in",
      "shimla-rural-himachal-pradesh-in",
      "shimla-urban-himachal-pradesh-in",
      "shirol-maharashtra-in",
      "shirur-maharashtra-in",
      "shivampet-telangana-in",
      "shivpuri-madhya-pradesh-in",
      "shohratgarh-uttar-pradesh-in",
      "sholinganallur-tamil-nadu-in",
      "shrigonda-maharashtra-in",
      "shrirampur-maharashtra-in",
      "shrirangapattana-karnataka-in",
      "shrivardhan-maharashtra-in",
      "shyampur-i-west-bengal-in",
      "shyampur-ii-west-bengal-in",
      "shyampur-madhya-pradesh-in",
      "siana-uttar-pradesh-in",
      "siddipet-telangana-in",
      "sidhauli-uttar-pradesh-in",
      "sidhpur-gujarat-in",
      "sidlaghatta-karnataka-in",
      "sikandra-rao-uttar-pradesh-in",
      "sikandrabad-uttar-pradesh-in",
      "sikar-rajasthan-in",
      "sikrai-rajasthan-in",
      "silao-bihar-in",
      "silchar-assam-in",
      "silonijan-assam-in",
      "simaria-jharkhand-in",
      "simdega-jharkhand-in",
      "simga-chhattisgarh-in",
      "simri-bihar-in",
      "sindgi-karnataka-in",
      "sindkhede-maharashtra-in",
      "singur-west-bengal-in",
      "sinnar-maharashtra-in",
      "sipajhar-assam-in",
      "sira-karnataka-in",
      "sirauli-gauspur-uttar-pradesh-in",
      "sircilla-telangana-in",
      "sirkali-tamil-nadu-in",
      "sironcha-maharashtra-in",
      "sirsa-haryana-in",
      "sirsi-karnataka-in",
      "sirvel-andhra-pradesh-in",
      "sitapur-uttar-pradesh-in",
      "sitarganj-uttarakhand-in",
      "siwan-bihar-in",
      "sohawal-uttar-pradesh-in",
      "sohna-haryana-in",
      "solan-himachal-pradesh-in",
      "solapur-north-maharashtra-in",
      "somandepalle-andhra-pradesh-in",
      "somvarpet-karnataka-in",
      "sonapur-assam-in",
      "sonarpur-west-bengal-in",
      "sonepur-bihar-in",
      "songadh-gujarat-in",
      "sonipat-haryana-in",
      "sonkatch-madhya-pradesh-in",
      "soraon-uttar-pradesh-in",
      "soro-odisha-in",
      "soso-odisha-in",
      "sri-madhopur-rajasthan-in",
      "srikakulam-andhra-pradesh-in",
      "srikalahasti-andhra-pradesh-in",
      "srinagar-north-jammu-kashmir-in",
      "srinagar-south-jammu-kashmir-in",
      "srinagar-uttarakhand-in",
      "srinivaspur-karnataka-in",
      "sriperumbudur-tamil-nadu-in",
      "srirangam-tamil-nadu-in",
      "srirangarajapuram-andhra-pradesh-in",
      "srisailam-andhra-pradesh-in",
      "srungavarapukota-andhra-pradesh-in",
      "sudhagad-maharashtra-in",
      "sujangarh-rajasthan-in",
      "sullurpeta-andhra-pradesh-in",
      "sultanabad-telangana-in",
      "sultanpur-lodhi-punjab-in",
      "sultanpur-uttar-pradesh-in",
      "sulthanbathery-kerala-in",
      "sulur-tamil-nadu-in",
      "sulya-karnataka-in",
      "sunam-punjab-in",
      "sundargarh-town-odisha-in",
      "sundarnagar-himachal-pradesh-in",
      "surajgarh-rajasthan-in",
      "surat-city-gujarat-in",
      "surgana-maharashtra-in",
      "suri-i-west-bengal-in",
      "suryapet-telangana-in",
      "sutahata-west-bengal-in",
      "swarupnagar-west-bengal-in",
      "tada-andhra-pradesh-in",
      "tadepalle-andhra-pradesh-in",
      "tadepalligudem-andhra-pradesh-in",
      "tadikonda-andhra-pradesh-in",
      "tajpur-bihar-in",
      "tala-maharashtra-in",
      "talakondapalle-telangana-in",
      "talappilly-kerala-in",
      "talasari-maharashtra-in",
      "talera-rajasthan-in",
      "taliparamba-kerala-in",
      "tallada-telangana-in",
      "talod-gujarat-in",
      "talwandi-sabo-punjab-in",
      "tamando-odisha-in",
      "tambaram-tamil-nadu-in",
      "tamluk-west-bengal-in",
      "tamulpur-assam-in",
      "tanakal-andhra-pradesh-in",
      "tanda-uttar-pradesh-in",
      "tandur-telangana-in",
      "tandwa-jharkhand-in",
      "tangarapali-odisha-in",
      "tangi-odisha-in",
      "taoru-haryana-in",
      "tapa-punjab-in",
      "tarabganj-uttar-pradesh-in",
      "taraiya-bihar-in",
      "tarakeswar-west-bengal-in",
      "tarana-madhya-pradesh-in",
      "tarapur-gujarat-in",
      "tarasingi-odisha-in",
      "tarikere-karnataka-in",
      "tarn-taran-punjab-in",
      "tasgaon-maharashtra-in",
      "tehri-uttarakhand-in",
      "tekkali-andhra-pradesh-in",
      "tekmal-telangana-in",
      "tenali-andhra-pradesh-in",
      "thakurdwara-uttar-pradesh-in",
      "thakurpukur-mahestola-west-bengal-in",
      "thalassery-kerala-in",
      "thamarassery-kerala-in",
      "thanagazi-rajasthan-in",
      "thane-maharashtra-in",
      "thanesar-haryana-in",
      "thanjavur-tamil-nadu-in",
      "tharangambadi-tamil-nadu-in",
      "tharthari-bihar-in",
      "thasra-gujarat-in",
      "theog-himachal-pradesh-in",
      "thimmajipet-telangana-in",
      "thipparthi-telangana-in",
      "thirumangalam-tamil-nadu-in",
      "thirunallar-puducherry-in",
      "thiruparangundram-tamil-nadu-in",
      "thiruporur-tamil-nadu-in",
      "thiruppuvanam-tamil-nadu-in",
      "thiruthuraipoondi-tamil-nadu-in",
      "thiruvalla-kerala-in",
      "thiruvallur-tamil-nadu-in",
      "thiruvananthapuram-kerala-in",
      "thiruvarur-tamil-nadu-in",
      "thiruverumbur-tamil-nadu-in",
      "thiruvidaimarudur-tamil-nadu-in",
      "thiruvottriyur-tamil-nadu-in",
      "thodupuzha-kerala-in",
      "thoguta-telangana-in",
      "thoothukkudi-tamil-nadu-in",
      "thorrur-telangana-in",
      "thotapalligudur-andhra-pradesh-in",
      "thotlavalluru-andhra-pradesh-in",
      "thottambedu-andhra-pradesh-in",
      "thottiyam-tamil-nadu-in",
      "thovala-tamil-nadu-in",
      "thrissur-kerala-in",
      "thullur-andhra-pradesh-in",
      "tihidi-odisha-in",
      "tijara-rajasthan-in",
      "tilakwada-gujarat-in",
      "tilda-chhattisgarh-in",
      "tiloi-uttar-pradesh-in",
      "timmapur-telangana-in",
      "tindivanam-tamil-nadu-in",
      "tinwari-rajasthan-in",
      "tiptur-karnataka-in",
      "tirtol-odisha-in",
      "tiruchengode-tamil-nadu-in",
      "tiruchirappalli-tamil-nadu-in",
      "tirukalukundram-tamil-nadu-in",
      "tirukkoyilur-tamil-nadu-in",
      "tirumakudal-narsipur-karnataka-in",
      "tirupathur-tamil-nadu-in",
      "tirupati-rural-andhra-pradesh-in",
      "tirupati-urban-andhra-pradesh-in",
      "tiruppur-south-tamil-nadu-in",
      "tiruppur-tamil-nadu-in",
      "tirur-kerala-in",
      "tirurangadi-kerala-in",
      "tiruttani-tamil-nadu-in",
      "tiruvannamalai-tamil-nadu-in",
      "tiryani-telangana-in",
      "tiswadi-goa-in",
      "titlagarh-odisha-in",
      "tlangnuam-mizoram-in",
      "todabhim-rajasthan-in",
      "todaraisingh-rajasthan-in",
      "tohana-haryana-in",
      "tonk-khurd-madhya-pradesh-in",
      "tonk-rajasthan-in",
      "topchanchi-jharkhand-in",
      "tosham-haryana-in",
      "trimbakeshwar-maharashtra-in",
      "tsundur-andhra-pradesh-in",
      "tullamulla-jammu-kashmir-in",
      "tulsipur-uttar-pradesh-in",
      "tumkur-karnataka-in",
      "tumsar-maharashtra-in",
      "tundla-uttar-pradesh-in",
      "tuni-andhra-pradesh-in",
      "tupran-telangana-in",
      "turuvekere-karnataka-in",
      "tushura-odisha-in",
      "udaipur-rajasthan-in",
      "udaipurwati-rajasthan-in",
      "udayarpalayam-tamil-nadu-in",
      "udaynarayanpur-west-bengal-in",
      "udhagamandalam-tamil-nadu-in",
      "udumalaipettai-tamil-nadu-in",
      "udumbanchola-kerala-in",
      "udupi-karnataka-in",
      "udwant-nagar-bihar-in",
      "ujiarpur-bihar-in",
      "ujjain-madhya-pradesh-in",
      "ukhimath-uttarakhand-in",
      "ulhasnagar-maharashtra-in",
      "uluberia-i-west-bengal-in",
      "uluberia-ii-west-bengal-in",
      "ulundurpettai-tamil-nadu-in",
      "umarkote-odisha-in",
      "umbergaon-gujarat-in",
      "umling-meghalaya-in",
      "umrala-gujarat-in",
      "umred-maharashtra-in",
      "umreth-gujarat-in",
      "umsning-meghalaya-in",
      "una-himachal-pradesh-in",
      "unguturu-andhra-pradesh-in",
      "unjha-gujarat-in",
      "unnao-uttar-pradesh-in",
      "uppal-telangana-in",
      "uppununthala-telangana-in",
      "uran-maharashtra-in",
      "uthamapalayam-tamil-nadu-in",
      "uthangarai-tamil-nadu-in",
      "uthiramerur-tamil-nadu-in",
      "uthukkottai-tamil-nadu-in",
      "uthukuli-tamil-nadu-in",
      "utraula-uttar-pradesh-in",
      "uttara-odisha-in",
      "vada-maharashtra-in",
      "vadakara-kerala-in",
      "vadali-gujarat-in",
      "vadamalapeta-andhra-pradesh-in",
      "vadgam-gujarat-in",
      "vadnagar-gujarat-in",
      "vadodara-gujarat-in",
      "vaghodia-gujarat-in",
      "vagra-gujarat-in",
      "vaijapur-maharashtra-in",
      "vaikom-kerala-in",
      "vaishali-bihar-in",
      "valia-gujarat-in",
      "vallabhnagar-rajasthan-in",
      "valod-gujarat-in",
      "valparai-tamil-nadu-in",
      "valsad-gujarat-in",
      "vandavasi-tamil-nadu-in",
      "vangoor-telangana-in",
      "vaniyambadi-tamil-nadu-in",
      "vanur-tamil-nadu-in",
      "vapi-gujarat-in",
      "varadaiahpalem-andhra-pradesh-in",
      "varanasi-uttar-pradesh-in",
      "varkala-kerala-in",
      "varni-telangana-in",
      "vasai-maharashtra-in",
      "vaso-gujarat-in",
      "vatticherukuru-andhra-pradesh-in",
      "vazhapadi-tamil-nadu-in",
      "vedurukuppam-andhra-pradesh-in",
      "veldanda-telangana-in",
      "veldurthi-andhra-pradesh-in",
      "velhe-maharashtra-in",
      "vellarikundu-kerala-in",
      "vellore-tamil-nadu-in",
      "vemulawada-telangana-in",
      "venkatachalam-andhra-pradesh-in",
      "vepada-andhra-pradesh-in",
      "veppur-tamil-nadu-in",
      "vicarabad-telangana-in",
      "vidisha-madhya-pradesh-in",
      "vijapur-gujarat-in",
      "vijayapuram-tamil-nadu-in",
      "vijayawada-rural-andhra-pradesh-in",
      "vijayawada-urban-andhra-pradesh-in",
      "vikas-nagar-uttarakhand-in",
      "vikramgad-maharashtra-in",
      "vikravandi-tamil-nadu-in",
      "vilavancode-tamil-nadu-in",
      "villianur-puducherry-in",
      "viluppuram-tamil-nadu-in",
      "virajpet-karnataka-in",
      "viramgam-gujarat-in",
      "viratnagar-rajasthan-in",
      "virudhachalam-tamil-nadu-in",
      "visakhapatnam-rural-andhra-pradesh-in",
      "visakhapatnam-urban-andhra-pradesh-in",
      "vishnupur-west-bengal-in",
      "visnagar-gujarat-in",
      "vizianagaram-andhra-pradesh-in",
      "vuyyuru-andhra-pradesh-in",
      "vyara-gujarat-in",
      "vythiri-kerala-in",
      "wadhwan-gujarat-in",
      "wai-maharashtra-in",
      "wakoora-jammu-kashmir-in",
      "wallajah-tamil-nadu-in",
      "walwa-maharashtra-in",
      "wanaparthy-telangana-in",
      "wankaner-gujarat-in",
      "warangal-telangana-in",
      "waraseoni-madhya-pradesh-in",
      "wardha-maharashtra-in",
      "wardhannapet-telangana-in",
      "wargal-telangana-in",
      "warisnagar-bihar-in",
      "warora-maharashtra-in",
      "wazirganj-bihar-in",
      "wazirpur-rajasthan-in",
      "weir-rajasthan-in",
      "yacharam-telangana-in",
      "yadagirigutta-telangana-in",
      "yadgir-karnataka-in",
      "yamkeshwar-uttarakhand-in",
      "yanam-puducherry-in",
      "yelamanchili-andhra-pradesh-in",
      "yelandur-karnataka-in",
      "yeldurthy-telangana-in",
      "yellareddipet-telangana-in",
      "yellareddy-telangana-in",
      "yemmiganur-andhra-pradesh-in",
      "yercaud-tamil-nadu-in",
      "yerpedu-andhra-pradesh-in",
      "yerrupalem-telangana-in",
      "yevla-maharashtra-in",
      "zahirabad-telangana-in",
      "zamania-uttar-pradesh-in",
      "zira-punjab-in"
    ];
    PARSED = SLUGS.map((slug2) => {
      let rest = slug2.endsWith("-in") ? slug2.slice(0, -3).split("-") : slug2.split("-");
      const tail2 = rest.length > 2 ? `${rest[rest.length - 2]}-${rest[rest.length - 1]}` : "";
      const tail1 = rest[rest.length - 1];
      if (UBER_IN_STATE_SUFFIXES.has(tail2)) rest = rest.slice(0, -2);
      else if (UBER_IN_STATE_SUFFIXES.has(tail1)) rest = rest.slice(0, -1);
      return { slug: slug2, city: rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") };
    });
    BY_CANON = /* @__PURE__ */ new Map();
    for (const e of PARSED) {
      const k = canonCity(e.city);
      if (!BY_CANON.has(k)) BY_CANON.set(k, e);
    }
    UBER_INDIA_PAGE_COUNT = SLUGS.length;
  }
});

// server/workers/verticals/cab.ts
function routeFromQuery2(raw) {
  const cleaned = raw.replace(/\b(cab|taxi|ride|auto|uber|ola|rapido|book|a|an|the|price|fare|for|drop|pickup|from|need|want|go|going)\b/gi, " ").replace(/\s+/g, " ").trim();
  const m = cleaned.match(/(.{2,40}?)\s+(?:to|→)\s+(.{2,40})/);
  if (!m) return null;
  return { from: m[1].trim(), to: m[2].trim() };
}
async function uberBearerToken(appId, appSecret) {
  if (_uberTokenCache && Date.now() < _uberTokenCache.expiresAt) return _uberTokenCache.token;
  const basic = Buffer.from(`${appId}:${appSecret}`).toString("base64");
  const r = await cffiFetch("https://login.uber.com/oauth/v2/token", {
    method: "POST",
    timeoutMs: 15e3,
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
    body: "grant_type=client_credentials"
  });
  if (r.status !== 200) return null;
  try {
    const j = JSON.parse(r.body || "{}");
    const token = String(j?.access_token || "");
    const ttl = Number(j?.expires_in || 0);
    if (!token || !ttl) return null;
    _uberTokenCache = { token, expiresAt: Date.now() + Math.max(ttl - 60, 60) * 1e3 };
    return token;
  } catch {
    return null;
  }
}
function uberCitySlugFor(place) {
  const p = place.toLowerCase();
  for (const c of UBER_CITY_SLUGS) if (c.keys.some((k) => p.includes(k))) return { slug: c.slug, city: c.city };
  return null;
}
function normPlace(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !["and", "the", "st", "station"].includes(t)).map((t) => canonCity(t));
}
function uberDestMatchScore(routeEnd, destName) {
  const a = normPlace(routeEnd);
  const b = normPlace(destName);
  if (!a.length || !b.length) return 0;
  let hits = 0;
  for (const t of a) if (b.includes(t) || b.some((x) => x.length > 3 && t.length > 3 && (x.includes(t) || t.includes(x)))) hits++;
  return hits / a.length;
}
async function uberCityFares(slug2, city) {
  const url = `https://www.uber.com/global/en/r/cities/${slug2}/`;
  const r = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 2e4, headers: { Accept: "text/html", "Accept-Language": "en-IN,en;q=0.9" } });
  if (r.status !== 200 || !(r.body || "").includes("Average price with UberX")) throw new AcquisitionError("EMPTY_RESPONSE", `Uber city guide page unavailable (HTTP ${r.status}) for ${city}`);
  const out = [];
  const re = /cmln__paragraph">([^<]{2,80})</g;
  const txts = [];
  let m;
  while (m = re.exec(r.body || "")) txts.push(m[1].trim());
  for (let i = 0; i + 1 < txts.length; i++) {
    const priceM = txts[i + 1].match(/^\s*(?:₹|Rs\.?\s*)([\d,]+)\s*$/);
    if (priceM && !/^\s*[₹]/.test(txts[i])) {
      const price = Number(priceM[1].replace(/,/g, ""));
      if (price > 0) out.push({ dest: txts[i], price, city, slug: slug2, fetchedUrl: url });
    }
  }
  return out;
}
async function uberSsrFallback(ctx, rt, reason) {
  const [fromCity, toCity] = await Promise.all([cityForPlace(rt.from), cityForPlace(rt.to)]);
  const curated = uberCitySlugFor(rt.from) || uberCitySlugFor(cityFromRouteText(rt.from)) || uberCitySlugFor(rt.to) || uberCitySlugFor(cityFromRouteText(rt.to));
  const registry = fromCity && uberIndiaCityFor(fromCity) || uberIndiaCityFor(rt.from) || toCity && uberIndiaCityFor(toCity) || uberIndiaCityFor(rt.to) || uberIndiaCityFor(cityFromRouteText(rt.to));
  const cityInfo = curated || registry;
  if (!cityInfo) throw new AcquisitionError("EMPTY_RESPONSE", `Uber live fare unavailable (${reason}); no Uber city page exists for this city in Uber's own sitemap, and no live guest fare API is available without credentials.`);
  let fares = [];
  let pricedRows = null;
  try {
    fares = await uberCityFares(cityInfo.slug, cityInfo.city);
  } catch {
    fares = [];
  }
  let best = null;
  const guideCityRe = new RegExp(`\\b${cityInfo.city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  const intraCity = guideCityRe.test(rt.from) && guideCityRe.test(rt.to);
  const altCity = cityFromRouteText(rt.to).toLowerCase();
  const altAllowed = !intraCity && altCity !== cityInfo.city.toLowerCase();
  for (const fare of fares) {
    const score = intraCity ? 0 : Math.max(uberDestMatchScore(rt.to, fare.dest), altAllowed ? uberDestMatchScore(altCity, fare.dest) : 0);
    if (score >= 0.5 && (!best || score > best.score)) best = { fare, score, end: rt.to };
  }
  if (!best) {
    pricedRows = null;
  }
  if (best) {
    const dropName = best.fare.dest;
    const drop = await photonGeocode(`${dropName}, ${cityInfo.city}`) || await geocodePlace(rt.to);
    const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const uberClientId = String(process.env.UBER_CLIENT_ID || "vjgXa6VEp5eVJNMBtlPEsYZ5agg9cy_w").trim();
    const ul = new URL("https://m.uber.com/ul/");
    ul.searchParams.set("client_id", uberClientId);
    ul.searchParams.set("action", "setPickup");
    ul.searchParams.set("pickup[my_location]", "true");
    if (drop) {
      ul.searchParams.set("dropoff[latitude]", String(drop.lat));
      ul.searchParams.set("dropoff[longitude]", String(drop.lon));
    }
    ul.searchParams.set("dropoff[nickname]", dropName.slice(0, 60));
    return [newRawItem(ctx.source, {
      title: `${cityInfo.city} to ${dropName} cab (UberX, published average)`,
      brand: "Uber",
      price: best.fare.price,
      currency: "INR",
      seller: "Uber",
      travel: { route: `${cityInfo.city} to ${dropName}`.toLowerCase(), seatType: "unknown" },
      attributes: {
        pickup: cityInfo.city,
        drop: dropName,
        route: `${cityInfo.city} to ${dropName}`,
        vehicle_type: "UberX",
        trip_type: "one-way",
        price_basis: `Uber-published ${cityInfo.city} average for ${dropName} (UberX) on ${today2}`,
        data_note: `Fare is Uber's own published city-guide average (SSR table on uber.com), not a live route quote; live quotes need official API credentials (${reason}). Deeplink is the Uber universal link with our client_id, routed via /api/out so an affiliate campaign (direct or network) attaches when available.`
      },
      sellerUrl: ul.toString(),
      identifiers: { sku: `uber-ssr-${best.fare.slug}-${dropName}`.toLowerCase().replace(/\s+/g, "-") },
      evidence: { sourceUrl: best.fare.fetchedUrl, extractedFields: ["SSR city-guide fare table row"] }
    })];
  }
  const cityPage = `https://www.uber.com/global/en/r/cities/${cityInfo.slug}/`;
  return [newRawItem(ctx.source, {
    title: `${rt.from} to ${rt.to} Uber cab (app booking)`,
    brand: "Uber",
    currency: "INR",
    seller: "Uber",
    sellerUrl: cityPage,
    travel: { route: `${rt.from} \u2192 ${rt.to}` },
    attributes: {
      pickup: rt.from,
      drop: rt.to,
      route: `${rt.from} \u2192 ${rt.to}`,
      vehicle_type: "Uber cab",
      trip_type: "one-way",
      price_basis: "app_only_fares",
      fare_table_note: fares.length ? `Uber's published ${cityInfo.city} fare table covers ${fares.length} other destinations` : "",
      data_note: `Uber operates in ${cityInfo.city} (Uber's own sitemap-published city page); live fares are quoted only in the Uber app or after web login \u2014 available only on app, never estimated (${reason}).`
    },
    identifiers: { sku: `uber-presence-${cityInfo.slug}`.toLowerCase().replace(/\s+/g, "-") },
    evidence: { sourceUrl: cityPage, extractedFields: ["title", "seller", "currency"], sourceReference: "Uber's sitemap-published city page (presence; app-only fares)" }
  })];
}
async function olaCityList() {
  if (_olaCityCache && Date.now() - _olaCityCache.at < 24 * 3600 * 1e3) return _olaCityCache.cities;
  const r = await cffiFetch(`${OLA_RC_BASE}/fleet/bpdproxy/bpd/rest/v1/city?country_code=IN`, { impersonate: "chrome", timeoutMs: 2e4, headers: { Accept: "application/json", "X-Client-Key": OLA_RC_KEY, "X-TraceId": `t1s-${Date.now()}`, Referer: `${OLA_RC_BASE}/merchandising/rate-card?api_ver=v1`, Origin: OLA_RC_BASE } });
  if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Ola BPD city list HTTP ${r.status}`, r.status);
  const j = JSON.parse(r.body || "[]");
  if (!Array.isArray(j) || !j.length) throw new AcquisitionError("EMPTY_RESPONSE", "Ola BPD city list empty");
  _olaCityCache = { at: Date.now(), cities: j };
  return j;
}
function olaCardFare(c, km, mins) {
  const base = Number(c.base_fare) || 0;
  const inclusive = Number(c.inclusive_km) || 0;
  const r1 = Number(c.rate_per_km) || Number(c.rate_per_unit_distance) || 0;
  const t1 = c.threshold_1 != null ? Number(c.threshold_1) : null;
  const t2 = c.threshold_2 != null ? Number(c.threshold_2) : null;
  const rA = Number(c.rate_after_threshold_1) || r1;
  const rB = Number(c.rate_after_threshold_2) || rA;
  const perMin = Number(c.rate_per_trip_minute) || 0;
  let fare = base;
  let rem = Math.max(km - inclusive, 0);
  if (rem > 0 && r1 > 0) {
    if (t1 != null) {
      const s1 = Math.min(rem, Math.max(t1 - inclusive, 0));
      fare += s1 * r1;
      rem -= s1;
      if (rem > 0 && t2 != null) {
        const s2 = Math.min(rem, Math.max(t2 - t1, 0));
        fare += s2 * rA;
        rem -= s2;
        if (rem > 0) fare += rem * rB;
      } else if (rem > 0) fare += rem * rA;
    } else fare += rem * r1;
  }
  fare += perMin * mins;
  const minF = Number(c.min_fare) || 0;
  return Math.max(Math.round(fare), Math.round(minF));
}
async function olaRateCards(cityId, timezone) {
  const p = await cffiFetch(`${OLA_RC_BASE}/merchandising/rate-card?api_ver=v1`, { impersonate: "chrome", timeoutMs: 2e4, returnCookies: true, headers: { Accept: "text/html", "Accept-Language": "en-IN,en;q=0.9" } });
  const jar = Object.entries(p.cookies || {}).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; ");
  const xsrf = (p.cookies || {})["XSRF-TOKEN"] || "";
  const H = { "Content-Type": "application/json", Accept: "application/json", "X-Client-Key": OLA_RC_KEY, "X-TraceId": `t1s-${Date.now()}`, "csrf-token": xsrf, Cookie: jar, Referer: `${OLA_RC_BASE}/merchandising/rate-card?api_ver=v1`, Origin: OLA_RC_BASE };
  const r = await cffiFetch(`${OLA_RC_BASE}/fleet/pricing/v1/ratecard/all`, { impersonate: "chrome", timeoutMs: 3e4, method: "POST", headers: { ...H, "x-timezone": timezone || "IST" }, body: JSON.stringify({ city_id: cityId, country: "IN", service_type: { p2p: null }, user_request_time: null }) });
  if (r.status !== 200 || !(r.body || "").includes("p2p")) throw new AcquisitionError("SERVER_ERROR", `Ola rate-card DB HTTP ${r.status}`, r.status);
  const j = JSON.parse(r.body || "{}");
  const now = Date.now();
  const isDate = (s) => s ? (/* @__PURE__ */ new Date(s.replace(" ", "T") + (s.includes("+") ? "" : "+05:30"))).getTime() : NaN;
  const cards = (j.p2p || []).filter((c) => !c.deleted_at && c.status === "approved" && c.rate_card_type === "base" && (!c.valid_to || isDate(c.valid_to) > now) && (!c.valid_from || isDate(c.valid_from) <= now) && (c.threshold_type == null || c.threshold_type === "distance_based") && (Number(c.base_fare) || 0) >= 0 && (Number(c.rate_per_km) || Number(c.rate_per_unit_distance) || 0) > 0);
  return cards;
}
function olaPickCards(cards) {
  const best = {};
  const rank = (x) => (x.time_of_day === "AL" || !x.time_of_day ? 1 : 0) * 1e12 + (/* @__PURE__ */ new Date(String(x.created_at || "").replace(" ", "T") + "+05:30")).getTime();
  for (const c of cards) {
    if (!OLA_CATEGORY_LABELS.some((l) => l.cat === c.category)) continue;
    const prev = best[c.category];
    if (!prev || rank(c) > rank(prev)) best[c.category] = c;
  }
  return best;
}
async function olaRateCardFallback(ctx, rt, reason) {
  const cities = await olaCityList();
  const pFrom = rt.from.toLowerCase();
  const pTo = rt.to.toLowerCase();
  const cFrom = cityFromRouteText(rt.from).toLowerCase();
  const cTo = cityFromRouteText(rt.to).toLowerCase();
  const nm = (c) => String(c.name || "").toLowerCase();
  let city = cities.find((c) => pFrom.includes(nm(c))) || cities.find((c) => cFrom.includes(nm(c))) || cities.find((c) => pTo.includes(nm(c))) || cities.find((c) => cTo.includes(nm(c)));
  if (!city) {
    throw new AcquisitionError("EMPTY_RESPONSE", `Ola fare unavailable (${reason}); "${rt.from}" is not an Ola operating city in Ola's own BPD registry (${cities.length} IN cities).`);
  }
  const [cards, a, b] = await Promise.all([olaRateCards(city.id, city.timezone), geocodePlace(rt.from), geocodePlace(rt.to)]);
  if (!a || !b) return [];
  const osrm = await cffiFetch(`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`, { timeoutMs: 15e3, headers: { Accept: "application/json" } });
  if (osrm.status !== 200) throw new AcquisitionError("SERVER_ERROR", `OSRM HTTP ${osrm.status}`, osrm.status);
  const route = (JSON.parse(osrm.body || "{}").routes || [])[0];
  if (!route) throw new AcquisitionError("NOT_FOUND", `OSRM found no road route between ${rt.from} and ${rt.to}`);
  const km = Number(route.distance) / 1e3;
  const mins = Number(route.duration) / 60;
  const best = olaPickCards(cards);
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const items = [];
  for (const { cat, label } of OLA_CATEGORY_LABELS) {
    const card = best[cat];
    if (!card) continue;
    const price = olaCardFare(card, km, mins);
    if (!price || price < 10 || price > 1e5) continue;
    const ul = new URL("https://book.olacabs.com/");
    ul.searchParams.set("lat", String(a.lat));
    ul.searchParams.set("lng", String(a.lon));
    items.push(newRawItem(ctx.source, {
      title: `${rt.from} to ${rt.to} cab (${label}, one-way)`,
      brand: "Ola",
      price,
      currency: "INR",
      seller: "Ola",
      travel: { route: `${rt.from} to ${rt.to}`.toLowerCase(), seatType: "unknown" },
      attributes: {
        pickup: rt.from,
        drop: rt.to,
        route: `${rt.from} to ${rt.to}`,
        vehicle_type: label,
        trip_type: "one-way",
        price_basis: `Estimate computed from Ola's own published ${city.name} rate card (${label}) + OSRM road distance (${km.toFixed(1)} km), retrieved ${today2}`,
        data_note: `Ola has no public guest fare API without OLA_API_KEY (${reason}). This estimate applies Ola's official BPD rate-card formula (base + distance slabs + per-minute) to the real OSRM road distance; it is not a live surge-adjusted quote. Deeplink opens Ola web booking with pickup set; complete the ride in the app.`
      },
      sellerUrl: ul.toString(),
      identifiers: { sku: `ola-rc-${city.id}-${cat}-${rt.from}-${rt.to}`.toLowerCase().replace(/\s+/g, "-") },
      evidence: { sourceUrl: `${OLA_RC_BASE}/merchandising/rate-card?api_ver=v1`, extractedFields: ["Ola BPD rate card (p2p, approved, base)"] }
    }));
  }
  if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", `Ola rate-card DB has no live consumer card for ${city.name}`);
  return items.sort((x, y) => x.price - y.price);
}
var _uberTokenCache, UBER_CITY_SLUGS, OLA_RC_BASE, OLA_RC_KEY, _olaCityCache, OLA_CATEGORY_LABELS, cabWorker;
var init_cab = __esm({
  "server/workers/verticals/cab.ts"() {
    init_verticalWorker();
    init_savaariCabs();
    init_bharatTaxi();
    init_quickRideCabs();
    init_indriveIntercity();
    init_curlCffiFetch();
    init_contract();
    init_osmTravel();
    init_rapidoCabs();
    init_uberIndiaCities();
    init_httpClient();
    _uberTokenCache = null;
    UBER_CITY_SLUGS = [
      { keys: ["delhi", "new delhi", "ndls"], slug: "new-delhi-new-delhi-in", city: "New Delhi" },
      { keys: ["mumbai", "bombay"], slug: "mumbai-maharashtra-in", city: "Mumbai" },
      { keys: ["bangalore", "bengaluru"], slug: "bangalore-karnataka-in", city: "Bangalore" },
      { keys: ["chennai", "madras"], slug: "chennai-tamil-nadu-in", city: "Chennai" },
      { keys: ["hyderabad"], slug: "hyderabad-telangana-in", city: "Hyderabad" },
      { keys: ["kolkata", "calcutta"], slug: "kolkata-west-bengal-in", city: "Kolkata" },
      { keys: ["ahmedabad", "ahmadabad"], slug: "ahmedabad-gujarat-in", city: "Ahmedabad" },
      { keys: ["jaipur"], slug: "jaipur-rajasthan-in", city: "Jaipur" },
      { keys: ["lucknow"], slug: "lucknow-uttar-pradesh-in", city: "Lucknow" },
      { keys: ["gurgaon", "gurugram"], slug: "gurgaon-haryana-in", city: "Gurgaon" },
      { keys: ["chandigarh"], slug: "chandigarh-chandigarh-in", city: "Chandigarh" },
      { keys: ["kochi", "ernakulam"], slug: "kochi-kerala-in", city: "Kochi" },
      { keys: ["guwahati"], slug: "guwahati-assam-in", city: "Guwahati" },
      { keys: ["indore"], slug: "indore-madhya-pradesh-in", city: "Indore" },
      { keys: ["thiruvananthapuram", "trivandrum"], slug: "thiruvananthapuram-kerala-in", city: "Thiruvananthapuram" },
      { keys: ["mysore", "mysuru"], slug: "mysore-karnataka-in", city: "Mysore" },
      { keys: ["vadodara", "baroda"], slug: "vadodara-gujarat-in", city: "Vadodara" },
      { keys: ["bhubaneswar"], slug: "bhubaneswar-odisha-in", city: "Bhubaneswar" },
      { keys: ["jodhpur"], slug: "jodhpur-rajasthan-in", city: "Jodhpur" }
    ];
    OLA_RC_BASE = "https://webapps.olacabs.com";
    OLA_RC_KEY = "a3abb50bpd6p4bcdb519df4f0a140f53jfkhqfad";
    _olaCityCache = null;
    OLA_CATEGORY_LABELS = [
      { cat: "auto", label: "Ola Auto" },
      { cat: "bike", label: "Ola Bike" },
      { cat: "mini_non_ac", label: "Ola Mini" },
      { cat: "compact", label: "Ola Compact" },
      { cat: "prime_play", label: "Ola Prime Play" },
      { cat: "prime_plus", label: "Ola Prime" },
      { cat: "economy_suv", label: "Ola SUV" },
      { cat: "luxury_sedan", label: "Ola Luxury Sedan" },
      { cat: "erick", label: "Ola e-Rick" }
    ];
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
            const rt = routeFromQuery2(String(ctx.query.rawQuery || ""));
            if (!rt) return [];
            if (!key) return olaRateCardFallback(ctx, rt, "OLA_API_KEY not configured in hPanel env");
            const [a, b] = await Promise.all([geocodePlace(rt.from), geocodePlace(rt.to)]);
            if (!a || !b) return [];
            const url = `https://devapi.olacabs.com/v1/products?pickup_lat=${a.lat}&pickup_lng=${a.lon}&drop_lat=${b.lat}&drop_lng=${b.lon}&category=sedan&response_type=json`;
            const r = await cffiFetch(url, { timeoutMs: 18e3, headers: { "X-APP-TOKEN": key, Accept: "application/json" } });
            if (r.status === 401 || r.status === 403) return olaRateCardFallback(ctx, rt, `official Ola API rejected the key (HTTP ${r.status})`);
            if (r.status !== 200) return olaRateCardFallback(ctx, rt, `official Ola API HTTP ${r.status}`);
            let j;
            try {
              j = JSON.parse(r.body);
            } catch {
              throw new AcquisitionError("MALFORMED_RESPONSE", "Ola API non-JSON");
            }
            const cats = Array.isArray(j?.categories) ? j.categories : [];
            const items = [];
            const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
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
                  price_basis: `Ola API fare estimate on ${today2}`,
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
          // Uber: official Uber API price estimates (developer.uber.com / v1.2). Auth: OAuth2
          // client_credentials (UBER_APPLICATION_ID + UBER_CLIENT_SECRET) with legacy UBER_SERVER_TOKEN
          // fallback. Token is fetched from login.uber.com/oauth/v2/token and cached in-process.
          sourceId: "w_cab_uber",
          name: "Cab worker: Uber India fare estimates (official API)",
          priority: 15,
          maxPerMinute: 10,
          timeoutMs: 25e3,
          run: async (ctx) => {
            const rt = routeFromQuery2(String(ctx.query.rawQuery || ""));
            if (!rt) return [];
            let authHeaders = null;
            const appId = String(process.env.UBER_APPLICATION_ID || "").trim();
            const appSecret = String(process.env.UBER_CLIENT_SECRET || "").trim();
            const serverToken = String(process.env.UBER_SERVER_TOKEN || "").trim();
            if (appId && appSecret) {
              const bearer = await uberBearerToken(appId, appSecret);
              if (bearer) authHeaders = { Authorization: `Bearer ${bearer}` };
            }
            if (!authHeaders && serverToken) authHeaders = { Authorization: `Token ${serverToken}` };
            if (!authHeaders) return uberSsrFallback(ctx, rt, "official Uber API credentials not configured (UBER_APPLICATION_ID/UBER_CLIENT_SECRET or UBER_SERVER_TOKEN)");
            const [a, b] = await Promise.all([geocodePlace(rt.from), geocodePlace(rt.to)]);
            if (!a || !b) return [];
            const apiHost = String(process.env.UBER_API_HOST || "api.uber.com").trim() || "api.uber.com";
            const url = `https://${apiHost}/v1.2/estimates/price?start_latitude=${a.lat}&start_longitude=${a.lon}&end_latitude=${b.lat}&end_longitude=${b.lon}`;
            const r = await cffiFetch(url, { timeoutMs: 18e3, headers: { ...authHeaders, Accept: "application/json" } });
            if (r.status === 401 || r.status === 403) return uberSsrFallback(ctx, rt, `official Uber API rejected credentials (HTTP ${r.status})`);
            if (r.status !== 200) throw new AcquisitionError("SERVER_ERROR", `Uber API HTTP ${r.status}`, r.status);
            let j;
            try {
              j = JSON.parse(r.body);
            } catch {
              throw new AcquisitionError("MALFORMED_RESPONSE", "Uber API non-JSON");
            }
            const prices = Array.isArray(j?.prices) ? j.prices : [];
            const items = [];
            const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
            for (const p of prices.slice(0, 5)) {
              const price = Math.round(Number(p.estimate ?? p.low_estimate ?? 0));
              if (!price) continue;
              const vehicle = String(p.localized_display_name || "Uber cab").slice(0, 60);
              const uberClientId = String(process.env.UBER_CLIENT_ID || "vjgXa6VEp5eVJNMBtlPEsYZ5agg9cy_w").trim();
              const ul = new URL("https://m.uber.com/ul/");
              ul.searchParams.set("client_id", uberClientId);
              ul.searchParams.set("action", "setPickup");
              ul.searchParams.set("pickup[my_location]", "true");
              ul.searchParams.set("dropoff[latitude]", String(b.lat));
              ul.searchParams.set("dropoff[longitude]", String(b.lon));
              ul.searchParams.set("dropoff[nickname]", rt.to.slice(0, 60));
              items.push(newRawItem(ctx.source, {
                title: `${rt.from} to ${rt.to} cab (${vehicle}, one-way)`,
                brand: "Uber",
                price,
                currency: String(p.currency_code || "INR"),
                seller: "Uber",
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
                  price_basis: `Uber API price estimate on ${today2}`,
                  data_note: `Fare estimate from the official Uber API (${apiHost} /v1.2/estimates/price); deeplink is the Uber universal link with our client_id, routed via /api/out so an affiliate campaign (direct or network) attaches when available`
                },
                sellerUrl: ul.toString(),
                identifiers: { sku: `uber-${rt.from}-${rt.to}-${vehicle}`.toLowerCase().replace(/\s+/g, "-") },
                evidence: { sourceUrl: url, extractedFields: ["Uber API estimates/price"] }
              }));
            }
            if (!items.length) return uberSsrFallback(ctx, rt, "official Uber API returned no fare estimate for this route");
            return items;
          }
        },
        {
          // Rapido (owner request 17 Oct: add without API). rapido.bike publishes NO fares on the web
          // (route/city pages are SEO content; the web bundle references only internal .svc hosts),
          // but it DOES publish which cities it serves (cities sitemap, 96 cities) and per-route pages.
          // For INTRA-CITY queries inside a served city we emit honest availability rows
          // (Bike Taxi / Auto / Cab) with the fare left "available only on app" — zero numbers invented.
          // Intercity queries return [] honestly: Rapido's published network is city-local.
          sourceId: "w_cab_rapido",
          name: "Cab worker: Rapido city availability (app-only fares: Bike/Auto/Cab)",
          priority: 15,
          run: async (ctx) => {
            const rt = routeFromQuery2(String(ctx.query.rawQuery || ""));
            if (!rt) return [];
            const fetchText = async (url) => {
              const r = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 15e3, headers: { Accept: "application/xml,text/xml,*/*" } });
              if (r.status !== 200) throw new AcquisitionError("EMPTY_RESPONSE", `Rapido sitemap HTTP ${r.status}`);
              return r.body || "";
            };
            const [cities, fromCity, toCity] = await Promise.all([
              rapidoServedCities(fetchText),
              cityForPlace(rt.from),
              cityForPlace(rt.to)
            ]);
            let a = fromCity ? rapidoCityLookup(cities, fromCity) : null;
            let b = toCity ? rapidoCityLookup(cities, toCity) : null;
            const cityInText = (place) => cities.find((c) => new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(place)) || null;
            if (!a) a = cityInText(`${rt.from} ${fromCity || ""}`);
            if (!b) b = cityInText(`${rt.to} ${toCity || ""}`);
            const namesCity = (place, city) => cityFromRouteText(place).toLowerCase().includes(city.toLowerCase()) || place.toLowerCase().includes(city.toLowerCase());
            if (!a && b && b.name && namesCity(rt.from, b.name)) a = b;
            if (!b && a && a.name && namesCity(rt.to, a.name)) b = a;
            if (!a || !b) return [];
            if (rapidoCitySlug(a.name) !== rapidoCitySlug(b.name)) return [];
            return buildRapidoAvailability({
              source: ctx.source,
              from: rt.from,
              to: rt.to,
              city: a.name,
              mainPageUrl: `https://www.rapido.bike/${a.mainPagePath}/main-page`
            });
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
            const url = `https://www.bharattaxi.com/${bharatTaxiSlug(cityFromRouteText(rt.from))}/to/${bharatTaxiSlug(cityFromRouteText(rt.to))}`;
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
            const from = savaariRouteSlug(cityFromRouteText(rt.from));
            const to = savaariRouteSlug(cityFromRouteText(rt.to));
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
          // InDrive (India): guest API of the intercity web app — published city-pair
          // price bands (ic3-gw-cf.euce1.indriverapp.com). Rides are name-your-price,
          // so offers carry InDrive's own indicative range, never a fixed fare.
          sourceId: "w_cab_indrive",
          name: "Cab worker: InDrive India intercity price bands",
          priority: 14,
          maxPerMinute: 10,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const rt = routeFromQuery2(String(ctx.query.rawQuery || ""));
            if (!rt) return [];
            const lookup2 = async (x) => {
              const byCity = await indriveCityLookup(cityFromRouteText(x));
              if (byCity) return byCity;
              return cityFromRouteText(x) !== x ? indriveCityLookup(x) : null;
            };
            const [from, to] = await Promise.all([lookup2(rt.from), lookup2(rt.to)]);
            if (!from || !to) throw new AcquisitionError("EMPTY_RESPONSE", `InDrive intercity registry has no match for ${!from ? rt.from : rt.to} (India registry only)`);
            if (from.id === to.id) throw new AcquisitionError("EMPTY_RESPONSE", `InDrive intercity: "${rt.from}" and "${rt.to}" resolved to the same city (${from.name})`);
            const rows = await indrivePrices(from.id, to.id);
            const items = buildIndriveOffers(ctx.source, rt.from, rt.to, from, to, rows);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", `InDrive intercity has no published price band for ${from.name} \u2192 ${to.name}`);
            return items;
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
  const fingerprint = (0, import_crypto10.createHash)("sha256").update(html.slice(0, 5e4)).digest("hex");
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
var import_crypto10, cheerio4;
var init_bankbazaarInsurance = __esm({
  "server/workers/parsers/bankbazaarInsurance.ts"() {
    import_crypto10 = require("crypto");
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
        startingPremium: premM ? premM[0].trim() : void 0,
        imageUrl: extractOgImage(r.body)
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

// server/workers/parsers/zeptoSsr.ts
function unescapeZeptoRsc(s) {
  return s.replace(/\\\\u0026/g, "&").replace(/\\\\"/g, '"').replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}
function parseZeptoSsr(html, max = 400) {
  const u = unescapeZeptoRsc(html);
  if (!u.includes(PACK_ANCHOR)) return [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  let idx = u.indexOf(PACK_ANCHOR);
  while (idx !== -1 && out.length < max) {
    const back = u.slice(Math.max(0, idx - 4500), idx);
    const fwd = u.slice(idx, idx + 2200);
    let price;
    const pm = [...back.matchAll(/"discountedSellingPrice":(\d+)/g)].pop();
    if (pm) price = Number(pm[1]) / 100;
    const bm = [...back.matchAll(/"brand":"([^"]{1,60})"/g)].pop();
    let name;
    if (bm) {
      const nm = back.slice(bm.index).match(/"name":"([^"]{2,160})"/);
      if (nm) name = nm[1];
    }
    const pack = (fwd.match(/"formattedPacksize":"([^"]{0,80})"/) || [])[1];
    const vid = (fwd.match(/"id":"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/) || [])[1];
    const mrpRaw = (fwd.match(/"mrp":(\d+)/) || [])[1];
    const imgPath = (fwd.match(/"path":"(cms\/[^"]{5,200}\.(?:jpe?g|png|webp))"/) || [])[1];
    const availRaw = (fwd.match(/"availableQuantity":(\d+)/) || [])[1];
    if (price && price > 0 && price < 5e5 && name && name.trim().length > 1) {
      const key = vid || `${brandName(bm)}|${name}|${price}`;
      if (!seen.has(key)) {
        seen.add(key);
        const mrp = mrpRaw ? Number(mrpRaw) / 100 : void 0;
        out.push({
          brand: brandName(bm),
          name: name.trim().slice(0, 140),
          price: Math.round(price * 100) / 100,
          mrp: mrp && mrp >= price ? Math.round(mrp * 100) / 100 : void 0,
          pack: pack ? pack.trim() : void 0,
          image: imgPath ? IMG_CDN + imgPath : void 0,
          variantId: vid,
          availableQuantity: availRaw !== void 0 ? Number(availRaw) : void 0
        });
      }
    }
    idx = u.indexOf(PACK_ANCHOR, idx + 1);
  }
  return out;
}
function brandName(m) {
  return m ? m[1] : "";
}
function zeptoSsrMatches(term, product) {
  const tokens2 = term.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  if (!tokens2.length) return true;
  const hay = `${product.brand} ${product.name} ${product.pack || ""}`.toLowerCase();
  return tokens2.every((t) => hay.includes(t) || hay.includes(t.replace(/s$/, "")));
}
var IMG_CDN, PACK_ANCHOR;
var init_zeptoSsr = __esm({
  "server/workers/parsers/zeptoSsr.ts"() {
    IMG_CDN = "https://cdn.zeptonow.com/production/";
    PACK_ANCHOR = '"productVariant":{"formattedPacksize"';
  }
});

// server/common/awsWafChallenge.ts
function makeAwsWafSolver(cffiFetch2) {
  const serializeFormData = (fd) => {
    const boundary = "----WebKitFormBoundary" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const parts = [];
    for (const [k, v] of fd.entries()) parts.push(`--${boundary}\r
Content-Disposition: form-data; name="${k}"\r
\r
${v}\r
`);
    parts.push(`--${boundary}--\r
`);
    return { body: parts.join(""), contentType: `multipart/form-data; boundary=${boundary}` };
  };
  async function mintAwsWafToken(url, opts = {}) {
    const host = new URL(url).hostname;
    const cached = tokenCache.get(host);
    if (cached && Date.now() - cached.mintedAt < CACHE_TTL_MS) return cached.token;
    const t0 = Date.now();
    const r = await cffiFetch2(url, { impersonate: "chrome", timeoutMs: 2e4, headers: { "User-Agent": UA, "Accept-Language": "en-IN,en;q=0.9" } });
    const html = r.body || "";
    if (r.status === 200 && !html.includes("gokuProps")) {
      tokenCache.set(host, { token: "", mintedAt: Date.now() });
      return "";
    }
    if (!html.includes("gokuProps")) throw new Error(`AWS WAF shell missing (HTTP ${r.status}, len ${html.length})`);
    const m = html.match(/<script src="(https:\/\/[^"]*awswaf\.com[^"]*challenge\.js)"><\/script>/);
    if (!m) throw new Error("challenge.js URL not found in shell");
    const cj = await cffiFetch2(m[1], { impersonate: "chrome", timeoutMs: 25e3, headers: { "User-Agent": UA } });
    if (!cj.body) throw new Error(`challenge.js fetch failed (HTTP ${cj.status})`);
    const { JSDOM } = await import("jsdom");
    const dom = new JSDOM(html.replace(m[0], ""), { url, runScripts: "outside-only", pretendToBeVisual: true });
    const w = dom.window;
    Object.defineProperty(w, "crypto", {
      value: { ...w.crypto || {}, subtle: import_node_crypto2.webcrypto.subtle, getRandomValues: (b) => import_node_crypto2.webcrypto.getRandomValues(b) },
      configurable: true,
      writable: true
    });
    w.TextEncoder = w.TextEncoder || TextEncoder;
    w.TextDecoder = w.TextDecoder || TextDecoder;
    Object.defineProperty(w.Location.prototype, "reload", { value: () => {
    }, configurable: true });
    Object.defineProperty(w.navigator, "userAgent", { get: () => UA, configurable: true });
    w.fetch = async (u, init = {}) => {
      let bodyStr;
      let ct = "";
      if (init.body) {
        if (init.body instanceof w.FormData) {
          const s = serializeFormData(init.body);
          bodyStr = s.body;
          ct = s.contentType;
        } else if (typeof init.body === "string") bodyStr = init.body;
        else if (init.body instanceof Uint8Array) bodyStr = Buffer.from(init.body).toString();
        else bodyStr = String(init.body);
      }
      const hdrs = { "User-Agent": UA, ...init.headers || {} };
      if (ct && !hdrs["Content-Type"] && !hdrs["content-type"]) hdrs["Content-Type"] = ct;
      const res = await cffiFetch2(String(u), { impersonate: "chrome", method: init.method || "GET", body: bodyStr, timeoutMs: 25e3, headers: hdrs });
      const body = res.body || "";
      return { ok: res.status >= 200 && res.status < 300, status: res.status, statusText: String(res.status), text: async () => body, json: async () => JSON.parse(body || "{}") };
    };
    try {
      dom.window.eval(cj.body);
    } catch (e) {
      throw new Error(`challenge.js eval failed: ${String(e).slice(0, 120)}`);
    }
    const deadline = Date.now() + (opts.maxMs ?? 6e4);
    while (Date.now() < deadline) {
      await new Promise((res) => setTimeout(res, 1e3));
      const mm = (w.document.cookie || "").match(/aws-waf-token=([^;]+)/);
      if (mm) {
        const token = decodeURIComponent(mm[1]);
        tokenCache.set(host, { token, mintedAt: Date.now() });
        return token;
      }
    }
    throw new Error("aws-waf-token not minted before deadline");
  }
  async function wafGet(url, extraHeaders = {}, opts = {}) {
    const token = await mintAwsWafToken(url, opts);
    const headers = { "User-Agent": UA, "Accept-Language": "en-IN,en;q=0.9", ...token ? { Cookie: "aws-waf-token=" + token } : {}, ...extraHeaders };
    let r = await cffiFetch2(url, { impersonate: "chrome", timeoutMs: 25e3, headers });
    if (r.status === 202) {
      tokenCache.delete(new URL(url).hostname);
      const fresh = await mintAwsWafToken(url, opts);
      r = await cffiFetch2(url, { impersonate: "chrome", timeoutMs: 25e3, headers: { ...headers, ...fresh ? { Cookie: "aws-waf-token=" + fresh } : {} } });
    }
    return r;
  }
  return { mintAwsWafToken, wafGet, isChallenged: (status, body) => status === 202 || status === 200 && body.includes("gokuProps") };
}
var import_node_crypto2, UA, CACHE_TTL_MS, tokenCache;
var init_awsWafChallenge = __esm({
  "server/common/awsWafChallenge.ts"() {
    import_node_crypto2 = require("node:crypto");
    UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
    CACHE_TTL_MS = 15e4;
    tokenCache = /* @__PURE__ */ new Map();
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
      const sp = num9(p.pricing?.discount?.prim_price?.sp);
      if (!sp) continue;
      const mrp = num9(p.pricing?.discount?.mrp);
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
var num9;
var init_bigbasket = __esm({
  "server/workers/parsers/bigbasket.ts"() {
    init_contract();
    num9 = (v) => {
      const n = Number(String(v ?? "").replace(/,/g, ""));
      return Number.isFinite(n) && n > 0 ? n : null;
    };
  }
});

// server/workers/verticals/grocery.ts
function zeptoSolver() {
  if (!zepSolver) zepSolver = makeAwsWafSolver((url, opts) => cffiFetch(url, opts));
  return zepSolver;
}
function zeptoBrandCandidates(term) {
  const low = term.toLowerCase();
  const slugs = [];
  for (const [kw, brands] of Object.entries(ZEPTO_TERM_BRANDS)) {
    if (low.includes(kw)) {
      for (const b of brands) if (slugs.length < 3 && !slugs.includes(b)) slugs.push(b);
    }
    if (slugs.length >= 3) return slugs.slice(0, 3);
  }
  for (const w of low.split(/[^a-z0-9]+/).filter((x) => x.length >= 4)) {
    if (!slugs.includes(w) && slugs.length < 2) slugs.push(w);
  }
  return slugs.slice(0, 3);
}
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
  for (const m of body.matchAll(/layoutId[\\":\s]+(\d{4,8})/g)) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push({ id: m[1], endpoint: "layout/v2" });
  }
  return out;
}
function imTokenize(term) {
  return term.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length >= 2 && !["the", "and"].includes(t));
}
function buildImItems(products, term, cityLabel, sourceUrl, cap) {
  const tokens2 = imTokenize(term);
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
    for (const t of tokens2) if (hay.includes(t) || t.endsWith("s") && hay.includes(t.slice(0, -1))) score++;
    if (score === 0) continue;
    if (tokens2.length > 1 && score < tokens2.length) score -= 0.5;
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
var GCITY_COORDS, zepSolver, ZEPTO_TERM_BRANDS, q2, QUICK_FAILS, IM_BASE, IM_HEADERS, groceryWorker;
var init_grocery = __esm({
  "server/workers/verticals/grocery.ts"() {
    init_verticalWorker();
    init_amazonIn();
    init_flipkart();
    init_blinkit();
    init_zeptoSsr();
    init_awsWafChallenge();
    init_bigbasket();
    init_httpClient();
    init_contract();
    init_curlCffiFetch();
    GCITY_COORDS = {
      "new delhi": [28.6315, 77.2167],
      delhi: [28.6315, 77.2167],
      noida: [28.5355, 77.391],
      gurgaon: [28.4595, 77.0266],
      gurugram: [28.4595, 77.0266],
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
      // Nagpur: city-center coords 21.1458/79.0882 return "location not serviceable" on the
      // api3.blinkit.com app gateway; 21.1582/79.0928 verified live (15 milk offers, 17 Oct).
      nagpur: [21.1582, 79.0928],
      // Verified live on the Blinkit app gateway 17 Oct (milk: Bhopal 19, Surat 19, Patna 13,
      // Coimbatore 19, Guwahati 13 offers).
      bhopal: [23.2599, 77.4126],
      surat: [21.1702, 72.8311],
      patna: [25.5941, 85.1376],
      coimbatore: [11.0168, 76.9558],
      guwahati: [26.1445, 91.7362]
    };
    ZEPTO_TERM_BRANDS = {
      milk: ["amul", "mother-dairy"],
      butter: ["amul"],
      curd: ["amul"],
      paneer: ["amul"],
      atta: ["aashirvaad", "fortune"],
      rice: ["daawat", "india-gate"],
      oil: ["fortune", "figaro"],
      biscuit: ["britannia", "parle"],
      biscuits: ["britannia", "parle"],
      chips: ["lays", "kurkure"],
      bread: ["britannia", "harvest"],
      cheese: ["amul", "go"],
      cream: ["amul"],
      ghee: ["amul", "mother-dairy"],
      coffee: ["nescafe", "tata-coffee"],
      tea: ["tata-tea", "lipton"],
      namkeen: ["haldirams", "bikano"],
      icecream: ["amul", "kwality-walls"],
      "ice cream": ["amul", "kwality-walls"],
      chocolate: ["amul", "dairy-milk"],
      juice: ["real", "tropicana"],
      soap: ["dove", "lux"],
      shampoo: ["head-shoulders", "dove"],
      detergent: ["surf-excel", "ariel"],
      surf: ["surf-excel"],
      lays: ["lays"],
      amul: ["amul"],
      nestle: ["nestle"],
      maggi: ["nestle"],
      britannia: ["britannia"],
      dal: ["tata-sampann"],
      sugar: ["dhampur", "madhur"],
      salt: ["tata", "aashirvaad"],
      maida: ["aashirvaad"],
      poha: ["tata-sampann"]
    };
    q2 = (ctx) => String(ctx.query.entityName || ctx.query.rawQuery || "").replace(/\b(grocery|quick|10 min|instant|order|buy)\b/gi, " ").replace(/\s+/g, " ").trim();
    QUICK_FAILS = [
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
          // Zepto LIVE (17 Oct breakthrough): zepto.com SSR rails behind an AWS WAF "Goku" JS
          // challenge. server/common/awsWafChallenge.ts mints the aws-waf-token browserlessly
          // (jsdom + cffi transport, PoW posted as multipart — verified from the sandbox IP),
          // then these pages return 200 with REAL priced product JSON in the RSC payload:
          //   - /delivery-in-<city-slug>  city rails (68 cities; Indore verified) — preferred
          //   - /                        homepage rails (~60 products, IP-city fallback)
          //   - /brand/<slug>            brand catalog (amul/nestle/britannia/dove verified)
          // Search pages are a client-side shell, so the worker filters rails client-side
          // (same honest pattern as Instamart). Keyword->brand routing lets generic terms
          // ("milk" -> amul/mother-dairy, "atta" -> aashirvaad/fortune) reach real catalog
          // pages; a page with zero parsed products is skipped, never fabricated.
          sourceId: "w_grocery_zepto",
          name: "Grocery worker: Zepto SSR rails (zepto.com, AWS WAF PoW-solved)",
          priority: 14,
          timeoutMs: 9e4,
          run: async (ctx) => {
            const term = q2(ctx);
            if (!term) return [];
            const loc = ctx.query.location || {};
            const cityLabel = loc.city ? String(loc.city) : "";
            const citySlug2 = String(cityLabel).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            const solver = zeptoSolver();
            const pages = [];
            pages.push(citySlug2 ? `https://www.zepto.com/delivery-in-${citySlug2}` : "https://www.zepto.com/");
            const brandSlugs = zeptoBrandCandidates(term);
            for (const b of brandSlugs) pages.push(`https://www.zepto.com/brand/${b}`);
            const products = /* @__PURE__ */ new Map();
            let pagesOk = 0;
            let pages404 = 0;
            let lastStatus = 0;
            for (const url of pages) {
              try {
                const r = await solver.wafGet(url);
                lastStatus = r.status;
                if (r.status === 200 && r.body && !r.body.includes("gokuProps")) {
                  pagesOk++;
                  for (const prod of parseZeptoSsr(r.body)) if (!products.has(prod.variantId || prod.name)) products.set(prod.variantId || prod.name, prod);
                  if (products.size > 240) break;
                } else if (r.status === 404) {
                  pages404++;
                  if (url.endsWith(".com/") === false && url.includes("/delivery-in-")) pages.push("https://www.zepto.com/");
                }
              } catch (e) {
                throw new AcquisitionError("ACCESS_CHALLENGE", `Zepto AWS WAF challenge unsolved: ${String(e?.message || e).slice(0, 140)}`);
              }
            }
            if (!products.size) {
              if (pagesOk > 0) throw new AcquisitionError("EMPTY_RESPONSE", `Zepto SSR pages returned no product JSON (pages ok: ${pagesOk}, 404: ${pages404}, last HTTP ${lastStatus})`);
              throw new AcquisitionError("ACCESS_CHALLENGE", `Zepto SSR unreachable (last HTTP ${lastStatus}, 404s ${pages404})`);
            }
            const all = [...products.values()];
            const matched = all.filter((p) => zeptoSsrMatches(term, p));
            const pool2 = matched.length ? matched : all.filter((p) => zeptoSsrMatches(term.split(/\s+/)[0] || "", p));
            if (!pool2.length) throw new AcquisitionError("EMPTY_RESPONSE", `Zepto rails had ${all.length} products, none matching "${term}" (search pages are app-side)`);
            const cityNote = cityLabel ? ` for ${cityLabel}` : "";
            return pool2.slice(0, 16).map((p) => newRawItem(ctx.source, {
              // SSR names usually already carry the brand ("Amul Gold...") — never double-prefix.
              title: `${p.brand && !p.name.toLowerCase().startsWith(p.brand.toLowerCase()) ? p.brand + " " : ""}${p.name}`.slice(0, 140),
              price: Math.round(p.price),
              listPrice: p.mrp && p.mrp > p.price ? Math.round(p.mrp) : void 0,
              currency: "INR",
              seller: "Zepto",
              sellerUrl: `https://www.zepto.com/search?query=${encodeURIComponent(p.name)}`,
              attributes: {
                pack_size: p.pack || "",
                eta_minutes: "10",
                outlet: cityLabel || "Zepto",
                in_stock: p.availableQuantity === void 0 ? "" : String(p.availableQuantity > 0),
                data_note: `Zepto's own published price${cityNote}, read from zepto.com server-rendered rails (AWS WAF challenge solved browserless; no API key). Deeplink lands on Zepto's site.`,
                ...p.image ? { image_url: p.image } : {}
              },
              identifiers: p.variantId ? { sku: `zepto-${p.variantId}` } : {},
              evidence: { extractedFields: ["title", "price", "listPrice", "image_url"], sourceReference: "zepto.com SSR rails" }
            }));
          }
        },
        {
          // Blinkit LIVE: /v1/layout/search answers real JSON to browserless HTTP when sent with the
          // web-app headers (app_client=consumer_web + lat/lon). Server-side search, location-aware prices.
          sourceId: "w_grocery_blinkit",
          name: "Grocery worker: Blinkit search API (app gateway + web fallback)",
          priority: 14,
          timeoutMs: 3e4,
          run: async (ctx) => {
            const term = q2(ctx);
            if (!term) return [];
            const loc = ctx.query.location || {};
            const coords = typeof loc.lat === "number" && typeof loc.lng === "number" && loc.lat ? [loc.lat, loc.lng] : GCITY_COORDS[String(loc.city || "").toLowerCase()] || GCITY_COORDS["mumbai"];
            const cityLabel = loc.city ? String(loc.city) : "Mumbai";
            const [lat, lng] = coords;
            const appUrl = `https://api3.blinkit.com/v1/layout/search?q=${encodeURIComponent(term)}&search_type=type_to_search`;
            const appHeaders = {
              lat: String(lat),
              lon: String(lng),
              Accept: "application/json",
              "Content-Type": "application/json",
              "User-Agent": "Grofers/17.65.0 (Android 13; com.grofers.customerapp)",
              platform: "android",
              app_version: "17.65.0"
            };
            let r = { status: 0, body: "" };
            let usedAppGateway = false;
            try {
              r = await cffiFetch(appUrl, { impersonate: "chrome", method: "POST", body: "{}", timeoutMs: 22e3, headers: appHeaders });
              if (r.status === 200 && r.body) usedAppGateway = true;
            } catch {
            }
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
            if (!usedAppGateway) {
              for (const profile of ["chrome", "safari17_0", "chrome110"]) {
                r = await cffiFetch(url, { impersonate: profile, method: "POST", body: "{}", timeoutMs: 22e3, headers: blHeaders });
                if (r.status === 200 && r.body) break;
                if (r.status === 403 || r.status === 429) await new Promise((res) => setTimeout(res, 1500));
              }
            }
            if (!usedAppGateway && (r.status === 403 || r.status === 202)) throw new AcquisitionError("ACCESS_CHALLENGE", `Blinkit search API HTTP ${r.status} (app gateway + 3 TLS web fingerprints all blocked)`);
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
            const homeCookies = home.status === 200 && home.cookies ? home.cookies : {};
            const svUrl = `${BB}/ui-svc/v1/serviceable/?lat=${lat}&lng=${lng}&send_all_serviceability=true`;
            const sv = await cffiFetch(svUrl, { impersonate: "chrome", headers: baseHeaders, timeoutMs: 15e3, cookies: homeCookies, returnCookies: true });
            let pi = {};
            try {
              pi = JSON.parse(sv.body).places_info || {};
            } catch {
            }
            const area = String(pi.area || cityLabel);
            const pincode = String(pi.pincode || "");
            const addrCookie = `${pi.lat ?? lat}_${pi.lng ?? lng}_${area}_${pincode}_1_false_true_true_Express`;
            const listingUrl = `${BB}/listing-svc/v2/products?type=ps&slug=${encodeURIComponent(term)}&page=1`;
            const listingCookies = { ...sv.cookies, _bb_addressinfo: addrCookie, _bb_pin_code: pincode, _bb_lat_long: Buffer.from(`${lat}|${lng}`).toString("base64") };
            let r = await cffiFetch(listingUrl, {
              impersonate: "chrome",
              timeoutMs: 25e3,
              headers: { ...baseHeaders, "x-latitude": String(pi.lat ?? lat), "x-longitude": String(pi.lng ?? lng) },
              cookies: listingCookies
            });
            if (r.status === 403) {
              await new Promise((res) => setTimeout(res, 2500));
              r = await cffiFetch(listingUrl, {
                impersonate: "safari17_0",
                timeoutMs: 25e3,
                headers: { ...baseHeaders, "x-latitude": String(pi.lat ?? lat), "x-longitude": String(pi.lng ?? lng) },
                cookies: { ...listingCookies, ...sv.cookies || {} }
              });
            }
            if (r.status === 403) throw new AcquisitionError("ACCESS_CHALLENGE", `BigBasket listing API HTTP 403 (Akamai, homepage ${home.status === 200 ? "ok" : "blocked"})`);
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
            try {
              collectImProducts(JSON.parse(home.body), products);
            } catch {
            }
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
          name: "Grocery worker: Amazon.in grocery listings (Imperva bm-verify bounce)",
          priority: 10,
          run: async (ctx) => {
            const term = q2(ctx);
            if (!term) return [];
            const url = `https://www.amazon.in/s?k=${encodeURIComponent(term)}`;
            let body = "";
            let status = 0;
            let jar;
            const bounce = async (startCookies) => {
              let r = await cffiFetch(url, { timeoutMs: 18e3, returnCookies: true, ...startCookies ? { cookies: startCookies } : {} });
              let b = r.body || "";
              let st = r.status;
              let ck = r.cookies || startCookies || {};
              for (let hop = 0; hop < 2 && st === 200 && b.includes("bm-verify"); hop++) {
                const m = b.match(/URL='([^']+)'/);
                if (!m) break;
                const vUrl = m[1].startsWith("/") ? "https://www.amazon.in" + m[1] : m[1];
                await new Promise((res) => setTimeout(res, 1200));
                r = await cffiFetch(vUrl, { cookies: ck, returnCookies: true, timeoutMs: 22e3 });
                b = r.body || "";
                st = r.status;
                ck = r.cookies || ck;
              }
              return { body: b, status: st, cookies: ck };
            };
            let out = await bounce();
            body = out.body;
            status = out.status;
            jar = out.cookies;
            if (status === 503) {
              await new Promise((res) => setTimeout(res, 2500));
              out = await bounce();
              body = out.body;
              status = out.status;
              jar = out.cookies;
            }
            if (status === 403) throw new AcquisitionError("ACCESS_CHALLENGE", "Amazon.in HTTP 403 (edge denied)", 403);
            if (status !== 200) throw new AcquisitionError("SERVER_ERROR", `Amazon.in HTTP ${status}`, status);
            const items = parseAmazonIn(body, ctx.source, url);
            if (items.length) return items;
            if (body.includes("bm-verify") || looksLikeChallenge(body)) {
              throw new AcquisitionError("ACCESS_CHALLENGE", "Amazon.in presented a challenge page");
            }
            throw new AcquisitionError("EMPTY_RESPONSE", `Amazon.in returned no grocery products for "${term}"`);
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
  const tokens2 = cleaned.split(" ").filter(Boolean);
  if (tokens2.length !== 1) return fallback;
  try {
    await resolveBmsRegion(fallback || tokens2[0], fetchJson);
    if (regionsCache) {
      const r = regionsCache.aliases.get(tokens2[0]);
      if (r) return r.regionName;
    }
  } catch {
  }
  return fallback;
}
function extractMovieQuery(entity, cityTokens) {
  const clean3 = entity.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !cityTokens.includes(w) && !["movie", "movies", "tickets", "ticket", "show", "shows", "today", "now", "showing", "near", "in", "the", "latest", "current"].includes(w));
  return clean3.join(" ");
}
function matchesQuery(title, query) {
  const toks2 = normCity(query).split(" ").filter((t) => t.length > 1 && !["in", "near", "movie", "movies", "tickets", "ticket", "show", "shows", "today", "now", "showing"].includes(t));
  if (!toks2.length) return true;
  const hay = normCity(title);
  return toks2.every((t) => hay.includes(t));
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
    const slug2 = ticketnewSlug(title);
    if (seen.has(slug2)) continue;
    seen.add(slug2);
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
      sellerUrl: slug2 ? `${TICKETNEW_BASE}/${cityKey}/movies/${slug2}` : `${TICKETNEW_BASE}/movies/${cityKey}`,
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
  const clean3 = (arr) => Array.isArray(arr) ? arr.filter((mv) => mv && typeof mv.Title === "string" && mv.Title.length > 0) : [];
  const np = pp.nowPlayingMoviesData;
  const nowPlaying = np && typeof np === "object" && !Array.isArray(np) ? clean3(Object.values(np)) : clean3(np);
  return { nowPlaying, comingSoon: clean3(pp.comingSoonMoviesData) };
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
function districtPriceBands(body) {
  const buckets2 = [];
  const bandRe = /\u20b9\s?([\d,]+)\s?-\s?\u20b9\s?([\d,]+)/g;
  let m;
  while ((m = bandRe.exec(body)) !== null) {
    const win = body.slice(m.index, Math.min(body.length, m.index + 400));
    if (!/price_[0-9_]+/.test(win)) continue;
    const sc = win.match(/sessionCount\\?"?:\s*(\d+)/);
    const sessions = sc ? Number(sc[1]) : 0;
    buckets2.push({ lo: Number(m[1].replace(/,/g, "")), hi: Number(m[2].replace(/,/g, "")), sessions });
  }
  const live = buckets2.filter((b) => b.sessions > 0);
  if (!live.length) return null;
  live.sort((a, b) => a.lo - b.lo);
  const firstPriced = live.find((b) => b.lo > 0);
  const from = firstPriced ? firstPriced.lo : live[0].hi;
  const to = live.reduce((mx, b) => Math.max(mx, b.hi), 0);
  return from > 0 && to >= from ? { from, to } : null;
}
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

// server/workers/parsers/districtGw.ts
function gwCitySlug(city) {
  return (city || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function gwGuestToken() {
  const rnd = (n, alphabet) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  const digits18 = String(Math.floor(Math.random() * 1e18)).padStart(18, "0");
  return `${Date.now()}_${digits18}_${rnd(10, "0123456789abcdefghijklmnopqrstuvwxyz")}`;
}
function gwHeaders(host) {
  return {
    Accept: "application/json",
    Referer: `${GW_HOSTS[host]}/movies`,
    "api_source": "district",
    "x-app-type": "ed_web",
    "x-guest-token": gwGuestToken()
  };
}
async function gwJson(host, path6, timeoutMs = 12e3) {
  try {
    const res = await cffiFetch(`${GW_HOSTS[host]}${path6}`, { headers: gwHeaders(host), timeoutMs });
    if (res.status !== 200) return null;
    return JSON.parse(res.body);
  } catch {
    return null;
  }
}
async function gwCityCinemas(host, citySlug2, timeoutMs = 12e3) {
  if (!citySlug2) return [];
  const d = await gwJson(host, `/gw/consumer/movies/v3/cinemas?city=${encodeURIComponent(citySlug2)}`, timeoutMs);
  const cinemas = d?.data?.cinemas || d?.cinemas || [];
  const out = [];
  for (const c of cinemas) {
    const id = Number(c?.id);
    const name = String(c?.name || "").trim();
    if (Number.isInteger(id) && name) out.push({ id, name });
  }
  return out;
}
async function gwCityMovieAggregates(host, citySlug2, maxCinemas = 10, timeoutMs = 12e3) {
  const byTitle = /* @__PURE__ */ new Map();
  const norm3 = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const cinemas = await gwCityCinemas(host, citySlug2, timeoutMs);
  for (const cinema of cinemas.slice(0, maxCinemas)) {
    const d = await gwJson(host, `/gw/consumer/movies/v3/cinema?meta=1&reqData=1&cinemaId=${cinema.id}`, timeoutMs);
    if (!d) continue;
    const meta = d?.meta || {};
    const moviesMeta = meta.movies || [];
    const grouped = meta.groupedMovies || [];
    const titleByMid = /* @__PURE__ */ new Map();
    for (const mv of moviesMeta) titleByMid.set(String(mv?.id || ""), String(mv?.name || "").trim());
    const contentByTitle = /* @__PURE__ */ new Map();
    for (const g of grouped) {
      const lbl = norm3(String(g?.label || ""));
      if (lbl && Number(g?.contentId)) contentByTitle.set(lbl, Number(g.contentId));
    }
    const posterByMid = /* @__PURE__ */ new Map();
    for (const mv of moviesMeta) posterByMid.set(String(mv?.id || ""), String(mv?.appImgPath || "") || "");
    const sessions = d?.pageData?.sessions || d?.pageData?.showtimes || [];
    for (const ss of sessions) {
      const mid = String(ss?.mid || "");
      const title = titleByMid.get(mid) || "";
      if (!title) continue;
      const key = norm3(title);
      if (!key) continue;
      const areas = [];
      for (const a of ss?.areas || []) {
        const price = Number(a?.price);
        if (!Number.isFinite(price) || price <= 0) continue;
        areas.push({ label: String(a?.label || ""), price, avail: Number(a?.sAvail) || 0 });
      }
      if (!areas.length) continue;
      let agg = byTitle.get(key);
      if (!agg) {
        agg = {
          mids: /* @__PURE__ */ new Set(),
          title,
          minPrice: Infinity,
          maxPrice: 0,
          showCount: 0,
          theatres: [],
          contentId: null,
          posterUrl: null,
          censor: null,
          durationMin: null,
          genres: null
        };
        byTitle.set(key, agg);
      }
      agg.mids.add(mid);
      agg.showCount += 1;
      if (!agg.theatres.includes(cinema.name)) agg.theatres.push(cinema.name);
      const contentId = contentByTitle.get(key);
      if (contentId && !agg.contentId) agg.contentId = contentId;
      const mvMeta = moviesMeta.find((mv) => String(mv?.id) === mid);
      if (mvMeta) {
        agg.posterUrl = agg.posterUrl || (String(mvMeta?.appImgPath || "") || null);
        agg.censor = agg.censor || (mvMeta?.censor ? String(mvMeta.censor) : null);
        agg.durationMin = agg.durationMin || (Number(mvMeta?.duration) || null);
        agg.genres = agg.genres || (Array.isArray(mvMeta?.grn) ? mvMeta.grn.join(", ") : null);
      }
      for (const a of areas) {
        agg.minPrice = Math.min(agg.minPrice, a.price);
        agg.maxPrice = Math.max(agg.maxPrice, a.price);
      }
    }
  }
  return byTitle;
}
async function gwCritique(host, contentId, timeoutMs = 12e3) {
  if (!Number.isInteger(contentId) || contentId <= 0) return null;
  const d = await gwJson(host, `/gw/consumer/movies/v1/content/critique?content_id=${contentId}`, timeoutMs);
  if (!d) return null;
  const out = { reviews: [], ratings: [] };
  for (const r of d?.reviews || []) {
    const text = String(r?.text || "").trim();
    if (!text) continue;
    out.reviews.push({
      text: text.slice(0, 600),
      reviewer: r?.reviewer ? String(r.reviewer) : null,
      source: r?.dwh_source?.name ? String(r.dwh_source.name) : null
    });
  }
  for (const rr of d?.ratings || []) {
    const value = String(rr?.value || "").trim();
    if (!value) continue;
    out.ratings.push({
      value,
      ratedBy: rr?.rated_by ? String(rr.rated_by) : rr?.dwh_source?.name ? String(rr.dwh_source.name) : "Critics",
      base: Number(rr?.dwh_source?.rating_base) || null
    });
  }
  return out.reviews.length || out.ratings.length ? out : null;
}
function extractTrailerUrl(body) {
  const re = /https:\/\/www\.youtube\.com\/(?:embed\/|watch\?v=|live\/)([\w-]{6,20})/g;
  let m;
  const skip = /trailer-page|\/channel|\/embed\/videoseries/i;
  while ((m = re.exec(body)) !== null) {
    const win = body.slice(Math.max(0, m.index - 80), m.index + 120);
    if (skip.test(win)) continue;
    if (/trailer|promo|teaser/i.test(win)) return `https://www.youtube.com/watch?v=${m[1]}`;
  }
  return null;
}
var GW_HOSTS;
var init_districtGw = __esm({
  "server/workers/parsers/districtGw.ts"() {
    init_curlCffiFetch();
    GW_HOSTS = {
      district: "https://www.district.in",
      ticketnew: "https://www.ticketnew.com"
    };
  }
});

// server/workers/parsers/imdbRatings.ts
async function fetchWithTimeout(url, ms, init = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}
async function ensureDataset() {
  try {
    const stale = !(0, import_node_fs3.existsSync)(RATINGS_FILE) || Date.now() - (0, import_node_fs3.statSync)(RATINGS_FILE).mtimeMs > RATINGS_TTL_MS;
    if (!stale) return true;
    const res = await fetchWithTimeout(RATINGS_URL, 6e4);
    if (!res.ok || !res.body) return (0, import_node_fs3.existsSync)(RATINGS_FILE);
    await (0, import_promises.pipeline)(res.body, (0, import_node_fs3.createWriteStream)(RATINGS_FILE));
    tconstIndex = null;
    return true;
  } catch {
    return (0, import_node_fs3.existsSync)(RATINGS_FILE);
  }
}
function datasetPromise() {
  datasetReady ??= ensureDataset().finally(() => {
    setTimeout(() => {
      datasetReady = null;
    }, 6e4).unref?.();
  });
  return datasetReady;
}
async function lookupTconst(tt) {
  if (ratingCache.has(tt)) return ratingCache.get(tt);
  if (!await datasetPromise()) {
    ratingCache.set(tt, null);
    return null;
  }
  const wanted = /* @__PURE__ */ new Set([tt]);
  for (const k of ratingCache.keys()) if (k) wanted.add(k);
  return new Promise((resolve) => {
    let found = null;
    const rl = import_node_readline.default.createInterface({ input: (0, import_node_fs3.createReadStream)(RATINGS_FILE).pipe((0, import_node_zlib.createGunzip)()) });
    rl.on("line", (line) => {
      const tab = line.indexOf("	");
      if (tab <= 0) return;
      const id = line.slice(0, tab);
      if (!wanted.has(id)) return;
      const rest = line.slice(tab + 1).split("	");
      const rating = Number(rest[0]);
      const votes = Number(rest[1]);
      if (Number.isFinite(rating) && rating > 0) {
        ratingCache.set(id, { rating, votes: Number.isFinite(votes) ? votes : 0, at: Date.now() });
        if (id === tt) found = ratingCache.get(tt);
      }
    });
    rl.on("close", () => {
      if (!ratingCache.has(tt)) ratingCache.set(tt, null);
      resolve(found);
    });
    rl.on("error", () => {
      ratingCache.set(tt, null);
      resolve(null);
    });
  });
}
async function imdbTconst(title) {
  const key = normTitle(title);
  if (!key) return null;
  const hit = titleCache.get(key);
  if (hit !== void 0) {
    if (hit === null) return null;
    return Date.now() - hit.at < CACHE_TTL_MS2 ? hit.tt : null;
  }
  try {
    const s = await fetchWithTimeout(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&uselang=en&type=item&limit=5&search=${encodeURIComponent(title)}`,
      1e4
    );
    if (!s.ok) {
      titleCache.set(key, null);
      return null;
    }
    const sj = await s.json();
    const candidates = sj?.search || [];
    const filmish = candidates.filter((c) => /film|movie|motion picture/i.test(String(c?.description || "")));
    const pick3 = (filmish[0] || candidates[0])?.id;
    if (!pick3) {
      titleCache.set(key, null);
      return null;
    }
    const e = await fetchWithTimeout(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&ids=${encodeURIComponent(pick3)}&props=claims`,
      1e4
    );
    if (!e.ok) {
      titleCache.set(key, null);
      return null;
    }
    const ej = await e.json();
    const claims = ej?.entities?.[pick3]?.claims || {};
    const p345 = claims?.P345?.[0]?.mainsnak?.datavalue?.value;
    const tt = typeof p345 === "string" && /^tt\d+$/.test(p345) ? p345 : null;
    titleCache.set(key, tt ? { tt, at: Date.now() } : null);
    return tt;
  } catch {
    titleCache.set(key, null);
    return null;
  }
}
async function imdbRatingFor(title) {
  try {
    const tt = await imdbTconst(title);
    if (!tt) return null;
    const row = await lookupTconst(tt);
    if (!row || Date.now() - row.at > CACHE_TTL_MS2) {
      if (row) return { tt, rating: row.rating, votes: row.votes };
    }
    if (!row) return null;
    return { tt, rating: row.rating, votes: row.votes };
  } catch {
    return null;
  }
}
var import_node_zlib, import_node_fs3, import_node_os, import_node_path3, import_promises, import_node_readline, RATINGS_URL, RATINGS_FILE, RATINGS_TTL_MS, CACHE_TTL_MS2, ratingCache, titleCache, tconstIndex, datasetReady, normTitle;
var init_imdbRatings = __esm({
  "server/workers/parsers/imdbRatings.ts"() {
    import_node_zlib = require("node:zlib");
    import_node_fs3 = require("node:fs");
    import_node_os = require("node:os");
    import_node_path3 = require("node:path");
    import_promises = require("node:stream/promises");
    import_node_readline = __toESM(require("node:readline"), 1);
    RATINGS_URL = "https://datasets.imdbws.com/title.ratings.tsv.gz";
    RATINGS_FILE = (0, import_node_path3.join)((0, import_node_os.tmpdir)(), "imdb-title-ratings.tsv.gz");
    RATINGS_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
    CACHE_TTL_MS2 = 24 * 60 * 60 * 1e3;
    ratingCache = /* @__PURE__ */ new Map();
    titleCache = /* @__PURE__ */ new Map();
    tconstIndex = null;
    datasetReady = null;
    normTitle = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
});

// server/workers/verticals/movies.ts
async function fetchJsonNode(url) {
  const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(2e4) });
  if (!r.ok) throw new AcquisitionError("SERVER_ERROR", `regions fetch ${r.status}`);
  return r.json();
}
function matchAgg(aggs, title) {
  if (!aggs || aggs.size === 0) return null;
  const toks2 = title.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 1);
  let best = null;
  let bestScore = 0;
  for (const agg of aggs.values()) {
    const hay = agg.title.toLowerCase();
    const score = toks2.filter((x) => hay.includes(x)).length;
    if (score === toks2.length && score > bestScore) {
      best = agg;
      bestScore = score;
    }
  }
  return best;
}
async function enrichWithGw(o, aggs, gwHost, forSite) {
  const agg = matchAgg(aggs, String(o.title || ""));
  if (agg) {
    o.price = agg.minPrice;
    o.attributes = o.attributes || {};
    o.attributes["price_band"] = agg.minPrice < agg.maxPrice ? `\u20B9${agg.minPrice}\u2013\u20B9${agg.maxPrice}` : `\u20B9${agg.minPrice}`;
    o.attributes["theatres"] = agg.theatres.slice(0, 6).join(" | ");
    o.attributes["theatre_count"] = agg.theatres.length;
    o.attributes["shows_today"] = agg.showCount;
    o.attributes["data_note"] = forSite ? `Seat prices (\u20B9${agg.minPrice}\u2013\u20B9${agg.maxPrice}) observed in live ${gwHost === "district" ? "District" : "TicketNew"} sessions across ${agg.theatres.length} theatres for this movie in this city. Exact fare on ${forSite} is shown at seat selection.` : `Real area-level seat prices (\u20B9${agg.minPrice}\u2013\u20B9${agg.maxPrice}) observed in live sessions across ${agg.theatres.length} theatres via District/TicketNew's public sessions gateway`;
    o.evidence.extractedFields = [...o.evidence.extractedFields || [], "price_min", "price_max", "theatres", "shows_today"];
    const crit = agg.contentId ? await gwCritique(gwHost, agg.contentId).catch(() => null) : null;
    if (crit) {
      if (crit.ratings.length) {
        o.attributes["critic_rating"] = crit.ratings.map((r) => `${r.value} (${r.ratedBy})`).slice(0, 3).join(" | ");
        o.evidence.extractedFields = [...o.evidence.extractedFields || [], "critic_rating"];
      }
      if (crit.reviews.length) {
        const r0 = crit.reviews[0];
        o.attributes["critic_review"] = `${r0.source ? `[${r0.source}] ` : ""}${r0.text}`;
        o.evidence.extractedFields = [...o.evidence.extractedFields || [], "critic_review"];
      }
    }
  }
  const imdb = await imdbRatingFor(String(o.title || "")).catch(() => null);
  if (imdb) {
    o.attributes = o.attributes || {};
    o.attributes["imdb_rating"] = `${imdb.rating.toFixed(1)} (${imdb.votes.toLocaleString("en-IN")} votes)`;
    o.attributes["imdb_id"] = imdb.tt;
    o.evidence.extractedFields = [...o.evidence.extractedFields || [], "imdb_rating"];
  }
}
var import_node_crypto3, bmsLastPrice, moviesWorker;
var init_movies = __esm({
  "server/workers/verticals/movies.ts"() {
    init_verticalWorker();
    init_httpClient();
    init_selfHeal();
    init_curlCffiFetch();
    init_bookmyshow();
    init_ticketnew();
    init_cinepolis();
    init_district();
    init_districtGw();
    init_imdbRatings();
    import_node_crypto3 = require("node:crypto");
    bmsLastPrice = /* @__PURE__ */ new Map();
    moviesWorker = {
      vertical: "movies",
      tasks: [
        {
          sourceId: "w_movies_bookmyshow",
          name: "Movies worker: BookMyShow now-showing discovery (posters + deeplinks, city-aware)",
          priority: 1,
          maxPerMinute: 6,
          timeoutMs: 6e4,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || "").trim();
            const entity = String(ctx.query.entityName || "").trim();
            const typedCity = await cityFromMovieQuery(String(ctx.query.rawQuery || ""), ctx.query.location?.city, fetchJsonNode);
            const region = await resolveBmsRegion(typedCity, fetchJsonNode);
            const healedBase = await getOverride("w_movies_bookmyshow", "explore_api_path").then(async (pth) => {
              const host2 = await getOverride("w_movies_bookmyshow", "api_host");
              return pth && host2 ? `${host2}${pth}/v1/discover` : null;
            }).catch(() => null);
            let res = await cffiFetch(bmsDiscoverUrl(region, healedBase), { headers: bmsDiscoverHeaders(region), timeoutMs: 25e3 });
            if ((res.status === 404 || res.status === 410) && !healedBase) {
              const rep = await dynamicScannerEngine.heal("w_movies_bookmyshow").catch(() => null);
              const fresh = rep?.healed ? await getOverride("w_movies_bookmyshow", "explore_api_path").then(async (pth) => {
                const host2 = await getOverride("w_movies_bookmyshow", "api_host");
                return pth && host2 ? `${host2}${pth}/v1/discover` : null;
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
            const fingerprint = (0, import_node_crypto3.createHash)("sha256").update(res.body).digest("hex").slice(0, 16);
            const cards = parseMovieCards(payload, ctx.source, region, queryTerm, fingerprint);
            const gwCity = gwCitySlug(typedCity || region.regionName || "");
            const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
            let aggs = null;
            let host = "district";
            if (gwCity) {
              aggs = await withTimeout(gwCityMovieAggregates("district", gwCity, 8).catch(() => null), 25e3);
              if (!aggs || aggs.size === 0) {
                host = "ticketnew";
                aggs = await withTimeout(gwCityMovieAggregates("ticketnew", gwCity, 6).catch(() => null), 15e3);
              }
            }
            const keyOf = (o) => `${normCity(region.regionName)}|${String(o.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
            for (const o of cards.slice(0, 14)) {
              try {
                const agg = matchAgg(aggs, String(o.title || ""));
                if (agg) {
                  o.price = agg.minPrice;
                  o.attributes = o.attributes || {};
                  o.attributes["price_band"] = agg.minPrice < agg.maxPrice ? `\u20B9${agg.minPrice}\u2013\u20B9${agg.maxPrice}` : `\u20B9${agg.minPrice}`;
                  o.attributes["theatres"] = agg.theatres.slice(0, 6).join(" | ");
                  o.attributes["theatre_count"] = String(agg.theatres.length);
                  o.attributes["shows_today"] = String(agg.showCount);
                  o.attributes["data_note"] = `Seat prices (\u20B9${agg.minPrice}\u2013\u20B9${agg.maxPrice}) observed in live ${host === "district" ? "District" : "TicketNew"} sessions across ${agg.theatres.length} theatres for this movie in this city. Exact fare on BookMyShow is shown at seat selection.`;
                  o.evidence.extractedFields = [...o.evidence.extractedFields || [], "price_min", "price_max", "theatres", "shows_today"];
                  bmsLastPrice.set(keyOf(o), { at: Date.now(), price: agg.minPrice, band: o.attributes["price_band"], note: o.attributes["data_note"] });
                } else {
                  const last = bmsLastPrice.get(keyOf(o));
                  if (last && Date.now() - last.at < 24 * 36e5) {
                    o.price = last.price;
                    o.attributes = o.attributes || {};
                    o.attributes["price_band"] = last.band || "";
                    o.attributes["data_note"] = `${last.note || "Seat price observed earlier"} (last observed ${Math.round((Date.now() - last.at) / 6e4)} min ago)`;
                  }
                }
              } catch {
              }
            }
            return cards;
          }
        },
        {
          sourceId: "w_movies_ticketnew",
          name: "Movies worker: TicketNew now-showing (Next.js __NEXT_DATA__, city-aware)",
          priority: 8,
          maxPerMinute: 6,
          timeoutMs: 45e3,
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
                const offers = parseTicketNewMovies(movies, ctx.source, key, queryTerm);
                const aggs = await gwCityMovieAggregates("ticketnew", key, 8).catch(() => null);
                for (const o of offers.slice(0, 5)) await enrichWithGw(o, aggs, "ticketnew");
                return offers;
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
          // PVR INOX (mandatory source): pvrinox.com + inoxmovies.com edge-gate datacenter IPs
          // (403 on every path); pvrx.io / m.inoxmovies.com / api.inoxmovies.com are DNS-dead.
          // Registered so every movie search attempts it live and reports honestly; if the
          // gate ever lifts, the HTML parsing work can begin on the returned page.
          sourceId: "w_movies_pvrinox",
          name: "Movies worker: PVR INOX (probe)",
          priority: 8,
          run: async () => {
            const r = await cffiFetch("https://www.pvrinox.com/", { impersonate: "chrome", timeoutMs: 12e3, headers: { Accept: "text/html", "Accept-Language": "en-IN,en;q=0.9" } });
            if (r.status === 200) throw new AcquisitionError("ACCESS_CHALLENGE", `PVR INOX gate unexpectedly open (HTTP 200) \u2014 parsing work needed, see docs/LIVE-ENDPOINTS.md`);
            throw new AcquisitionError("ACCESS_CHALLENGE", `PVR INOX movies is edge-gated (HTTP ${r.status} on pvrinox.com; inoxmovies.com same gate, pvrx.io and m./api. hosts DNS-dead) \u2014 showtimes and seat prices are available only on the PVR INOX app.`);
          }
        },
        {
          sourceId: "w_movies_district",
          name: "Movies worker: District by Zomato / Paytm movies (schema.org JSON-LD ItemList, web deeplinks)",
          priority: 8,
          maxPerMinute: 6,
          timeoutMs: 55e3,
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
            const offers = parseDistrictOffers(movies, ctx.source, queryTerm);
            const gwCity = gwCitySlug(city);
            const aggs = gwCity ? await gwCityMovieAggregates("district", gwCity, 10).catch(() => null) : null;
            for (const o of offers.slice(0, 5)) {
              await enrichWithGw(o, aggs, "district");
              const url = String(o.sellerUrl || "");
              if (!/^https:\/\/www\.district\.in\/movies\//.test(url)) continue;
              try {
                const page = await cffiFetch(url, { timeoutMs: 2e4 });
                if (page.status !== 200) continue;
                const trailer = extractTrailerUrl(page.body);
                if (trailer) {
                  o.attributes = o.attributes || {};
                  o.attributes["trailer_url"] = trailer;
                  o.evidence.extractedFields = [...o.evidence.extractedFields || [], "trailer_url"];
                }
                if (o.price == null) {
                  const band = districtPriceBands(page.body);
                  if (band) {
                    o.price = band.from;
                    o.attributes = o.attributes || {};
                    o.attributes["price_band"] = `\u20B9${band.from}\u2013\u20B9${band.to}`;
                    o.attributes["data_note"] = `Ticket prices from District's session price bands (\u20B9${band.from}\u2013\u20B9${band.to} across shows today); exact seat fare appears in the seat-selection flow`;
                    o.evidence.extractedFields = [...o.evidence.extractedFields || [], "price_band_from", "price_band_to"];
                  }
                }
              } catch {
              }
            }
            return offers;
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
  const fingerprint = (0, import_crypto11.createHash)("sha256").update(json.slice(0, 5e4)).digest("hex");
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
        ...busType ? { bus_type: busType.slice(0, 80) } : {},
        ...t.startTime ? { departure_time: String(t.startTime).slice(0, 5) } : {},
        // Normalized timing keys (owner bug 21 Oct: bus timings not showing) — web and
        // Flutter both read arrival_time + duration_minutes; derive them from AbhiBus's
        // own arriveTime/travelTime fields, never invented.
        ...t.arriveTime ? { arrival_time: String(t.arriveTime).slice(0, 5) } : {},
        ...t.travelTime ? (() => {
          const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(t.travelTime).trim());
          return m ? { duration_minutes: String(Number(m[1]) * 60 + Number(m[2])) } : {};
        })() : {},
        // structured facets from AbhiBus's own bus-type string (no invention)
        ac: /non[- ]?a\/?c/i.test(busType) ? "no" : /a\/?c|air conditioned/i.test(busType) ? "yes" : "",
        sleeper: /sleeper/i.test(busType) ? "yes" : /seater/i.test(busType) ? "no" : "",
        seater: /seater/i.test(busType) ? "yes" : "",
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
var import_crypto11;
var init_abhibus = __esm({
  "server/workers/parsers/abhibus.ts"() {
    import_crypto11 = require("crypto");
    init_contract();
  }
});

// server/workers/parsers/redbusRoute.ts
function extractRedBusRouteInfo(html) {
  const field = (key) => {
    const m = new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`).exec(html);
    return m ? m[1] : null;
  };
  const num10 = (key) => {
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
    servicecount: Number(num10("servicecount")) || 0,
    operators: field("operators") || num10("operators") || "",
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
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
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
      price_basis: `minimum route fare as published by redbus.in on ${today2}`,
      data_note: `Route-level fare summary (min fare across ${info.servicecount} services from ${info.operators} operators) scraped from redbus.in on ${today2}`
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

// server/workers/parsers/redbusSearch.ts
function resolveRedBusCity(docs, city) {
  if (!Array.isArray(docs) || !docs.length) return null;
  const flat = [];
  for (const g of docs) {
    if (g?.doclist?.docs) flat.push(...g.doclist.docs);
    else flat.push(g);
  }
  const lower = String(city || "").toLowerCase();
  const cities = flat.filter((d) => String(d?.locationType || "").toUpperCase() === "CITY" && Number(d?.ID) > 0);
  const pool2 = cities.length ? cities : flat.filter((d) => Number(d?.ID) > 0);
  const exact = pool2.find((d) => String(d?.Name || "").toLowerCase() === lower);
  const chosen = exact || pool2[0];
  return chosen ? { id: Number(chosen.ID), name: String(chosen.Name || city) } : null;
}
function parseRedBusSearch(json, source, route) {
  let d;
  try {
    d = JSON.parse(json);
  } catch {
    return [];
  }
  const inventories = Array.isArray(d?.data?.inventories) ? d.data.inventories : [];
  if (!inventories.length) return [];
  const fingerprint = (0, import_crypto12.createHash)("sha256").update(json.slice(0, 5e4)).digest("hex");
  const slug2 = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-");
  const searchUrl = `https://www.redbus.in/bus-tickets/${slug2(route.fromName)}-to-${slug2(route.toName)}.aspx`;
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const inv of inventories) {
    const fares = Array.isArray(inv?.fareList) ? inv.fareList.map(Number).filter((f) => f > 0) : [];
    if (!fares.length) continue;
    const fare = Math.min(...fares);
    const key = `${inv.serviceId}|${inv.routeId}|${inv.travelsName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const operator = String(inv.travelsName || "").trim() || "redBus operator";
    const busType = String(inv.busType || "").trim();
    const seats = Number(inv.availableSeats);
    const totalSeats = Number(inv.totalSeats);
    const rating = Number(inv.totalRatings) > 0 ? String(Math.round(Number(inv.totalRatings) * 10) / 10) : void 0;
    const durMin = Number(inv.journeyDurationMin);
    const duration = durMin > 0 ? `${Math.floor(durMin / 60)}h ${durMin % 60}m` : void 0;
    out.push(newRawItem(source, {
      title: `${operator} \xB7 ${busType}`.slice(0, 200),
      price: fare,
      currency: "INR",
      ...fares.length > 1 ? { listPrice: Math.max(...fares) } : {},
      seller: "redBus",
      sellerUrl: searchUrl,
      availability: seats > 0 ? "in_stock" : "out_of_stock",
      travel: { route: `${route.fromName} \u2192 ${route.toName}`, date: route.doj, seatType: busType || "unknown" },
      attributes: {
        operator,
        ...inv.departureTime ? { departure: `${inv.departureTime.slice(11, 16)}${inv.arrivalTime ? ` \u2192 ${inv.arrivalTime.slice(11, 16)} (+1)` : ""}` } : {},
        ...inv.departureTime ? { departure_time: inv.departureTime.slice(11, 16) } : {},
        ...duration ? { duration } : {},
        ...Number.isFinite(seats) ? { seats_available: String(seats) } : {},
        ...Number.isFinite(totalSeats) && totalSeats > 0 ? { total_seats: String(totalSeats) } : {},
        ...rating ? { rating, rating_count: String(inv.numberOfReviews || "") } : {},
        ...busType ? { bus_type: busType.slice(0, 80) } : {},
        // Structured facets for the bus filter chips (never invented: every flag
        // comes straight off the redBus inventory object).
        ac: inv.isAc === true || inv.isAc === false ? inv.isAc ? "yes" : "no" : /non[- ]?a\/?c/i.test(busType) ? "no" : /a\/?c|air conditioned/i.test(busType) ? "yes" : "",
        sleeper: inv.isSleeper === true || /sleeper/i.test(busType) ? "yes" : /seater/i.test(busType) ? "no" : "",
        seater: inv.isSeater === true ? "yes" : "",
        ...inv.isPremium === true ? { premium: "yes" } : {},
        ...String(inv.cancellationPolicy || "").includes(":100:") ? { free_cancellation: "yes" } : {},
        ...inv.isLiveTrackingAvailable === true ? { live_tracking: "yes" } : {},
        ...inv.isMticketEnabled === true ? { mticket: "yes" } : {},
        ...inv.isDirectBus === true ? { direct_bus: "yes" } : {},
        ...Number.isFinite(Number(inv.availableWindowSeats)) ? { window_seats: String(inv.availableWindowSeats) } : {},
        ...Array.isArray(inv.amenities) && inv.amenities.length ? { amenities: String(inv.amenities.length) } : {},
        ...inv.standardBpName ? { boarding_point: String(inv.standardBpName) } : {},
        ...inv.standardDpName ? { dropping_point: String(inv.standardDpName) } : {},
        platform: "redBus",
        data_note: "Live per-service fare and seats from redBus public web API"
      },
      evidence: {
        sourceUrl: searchUrl,
        rawFingerprint: fingerprint,
        extractedFields: ["travelsName", "busType", "fareList", "departureTime", "arrivalTime", "availableSeats", "serviceId", "routeId"]
      }
    }));
  }
  return out;
}
var import_crypto12;
var init_redbusSearch = __esm({
  "server/workers/parsers/redbusSearch.ts"() {
    import_crypto12 = require("crypto");
    init_contract();
  }
});

// server/workers/parsers/zingbus.ts
function zingbusSlug(city) {
  let c = city.toLowerCase().trim().replace(/\s*\((?:[a-z]{3})\)\s*/g, " ").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  c = ZING_ALIAS[c] || c;
  return c.replace(/\s+/g, "-");
}
function parseZingbusRoute(html, source, pageUrl, fromCity, toCity) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  let root;
  try {
    root = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const holder = {};
  const find = (o, depth) => {
    if (holder.pt || depth > 10 || o == null) return;
    if (Array.isArray(o)) {
      for (const v of o.slice(0, 60)) find(v, depth + 1);
      return;
    }
    if (typeof o === "object") {
      if (o.pTableData && typeof o.pTableData === "object") {
        holder.pt = o.pTableData;
        return;
      }
      for (const v of Object.values(o)) find(v, depth + 1);
    }
  };
  find(root, 0);
  const pTable = holder.pt;
  if (!pTable) return [];
  const fare = Number(pTable.minFare);
  if (!Number.isFinite(fare) || fare <= 0) return [];
  const from = String(pTable.fromCityName || fromCity);
  const to = String(pTable.toCityName || toCity);
  const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const route = `${from} to ${to}`.toLowerCase();
  const busTypes = Array.isArray(pTable.busTypeArr) ? pTable.busTypeArr.slice(0, 4).join("; ") : "";
  return [newRawItem(source, {
    title: `${from} to ${to} zingbus (lowest fare across ${pTable.busCount || "all"} services)`,
    brand: "zingbus",
    price: fare,
    currency: "INR",
    seller: "zingbus",
    sellerUrl: pageUrl,
    travel: { route, seatType: busTypes || "varies (seater/sleeper/AC)" },
    attributes: {
      route,
      min_fare: String(fare),
      max_fare: String(pTable.maxFare ?? ""),
      service_count: String(pTable.busCount ?? ""),
      avg_duration: String(pTable.travelTime ?? ""),
      first_departure: String(pTable.firstBusTime ?? ""),
      last_departure: String(pTable.lastBusTime ?? ""),
      image: "",
      price_basis: `minimum route fare as published by zingbus.com on ${today2}`,
      data_note: `Route-level fare summary (min Rs${fare}/max Rs${pTable.maxFare ?? "?"} across ${pTable.busCount ?? "?"} services) scraped from zingbus.com on ${today2}`
    },
    identifiers: { sku: `zingbus-${route.replace(/\s+/g, "-")}` },
    evidence: { sourceUrl: pageUrl, extractedFields: ["pTableData minFare", "maxFare", "busCount", "travelTime", "firstBusTime"] }
  })];
}
var ZING_ALIAS;
var init_zingbus = __esm({
  "server/workers/parsers/zingbus.ts"() {
    init_contract();
    ZING_ALIAS = {
      bengaluru: "bangalore",
      mysuru: "mysore",
      "mumbai (bombay)": "mumbai",
      bombay: "mumbai",
      calcutta: "kolkata",
      gurgaon: "gurugram",
      pondicherry: "puducherry",
      varanasi: "banaras",
      "new delhi": "delhi",
      "delhi ncr": "delhi"
    };
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
    init_httpClient();
    init_abhibus();
    init_redbusRoute();
    init_redbusSearch();
    init_curlCffiFetch();
    init_zingbus();
    busWorker = {
      vertical: "bus",
      tasks: [
        {
          // redBus LIVE per-service fares. The SRP bundle (indSearch) builds
          // POST /rpw/api/searchResults?fromCity&toCity&DOJ with a JSON body — the same
          // public web gateway the site's own SPA uses. City ids come from
          // GET /rpw/api/citySuggestion?search=<city>. Each inventory carries the real
          // fareList, timings, seat counts and operator rating. Falls back to the
          // route-page dataInfo summary when the ids can't be resolved (small towns).
          sourceId: "w_bus_redbus",
          name: "Bus worker: redBus live services (real fares, timings, seats)",
          priority: 2,
          maxPerMinute: 24,
          // City resolution + per-bus searchResults + (only if needed) route-page fallback:
          // three sequential round-trips legitimately need more than the 18s default budget.
          timeoutMs: 45e3,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || "");
            const rt = routeFromQuery3(raw);
            if (!rt) return [];
            const slug2 = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-");
            const pageUrl = `https://www.redbus.in/bus-tickets/${slug2(rt.from)}-to-${slug2(rt.to)}.aspx`;
            const steps = [];
            const t0 = Date.now();
            let resolved = {};
            try {
              const getJson2 = async (url) => {
                const s = Date.now();
                const r2 = await ctx.fetch(url, { expectJson: true, timeoutMs: 12e3, headers: { Accept: "application/json", Referer: "https://www.redbus.in/" } });
                steps.push(`suggest=${r2.latencyMs ?? Date.now() - s}ms/${r2.status}`);
                if (r2.status !== 200) throw new AcquisitionError("SERVER_ERROR", `redBus suggestion HTTP ${r2.status}`, r2.status);
                try {
                  return JSON.parse(r2.body);
                } catch {
                  throw new AcquisitionError("MALFORMED_RESPONSE", "redBus citySuggestion non-JSON");
                }
              };
              const [fromDocs, toDocs] = await Promise.all([
                getJson2(`https://www.redbus.in/rpw/api/citySuggestion?search=${encodeURIComponent(rt.from.slice(0, 40))}&limit=3`),
                getJson2(`https://www.redbus.in/rpw/api/citySuggestion?search=${encodeURIComponent(rt.to.slice(0, 40))}&limit=3`)
              ]);
              resolved = { from: resolveRedBusCity(fromDocs?.response?.docs, rt.from), to: resolveRedBusCity(toDocs?.response?.docs, rt.to) };
            } catch (e) {
              if (e instanceof AcquisitionError && e.failureClass === "TIMEOUT") steps.push(`suggest=TIMEOUT(${steps.join(" ") || "none"})`);
            }
            const depart = String(ctx.query.travelDates?.depart || "");
            const doj = /^\d{4}-\d{2}-\d{2}$/.test(depart) ? depart : new Date(Date.now() + 864e5).toISOString().slice(0, 10);
            if (resolved.from && resolved.to) {
              const route = { fromName: resolved.from.name, fromId: resolved.from.id, toName: resolved.to.name, toId: resolved.to.id, doj };
              const u = `https://www.redbus.in/rpw/api/searchResults?fromCity=${route.fromId}&toCity=${route.toId}&DOJ=${doj}&limit=15&offset=0&sort=0&sortOrder=0&from=web&meta=false&bT=1&getUuid=false`;
              let r2 = { status: 0, body: "" };
              for (let attempt = 1; attempt <= 2; attempt++) {
                const sr = Date.now();
                try {
                  r2 = await ctx.fetch(u, {
                    method: "POST",
                    expectJson: true,
                    maxBytes: 6e6,
                    timeoutMs: 12e3,
                    headers: { Accept: "application/json", "Content-Type": "application/json", Origin: "https://www.redbus.in", Referer: pageUrl },
                    body: "{}"
                  });
                } catch (e) {
                  steps.push(`searchResults#${attempt}=${e instanceof AcquisitionError && e.failureClass || "ERROR"}@${Date.now() - sr}ms`);
                  continue;
                }
                steps.push(`searchResults#${attempt}=${r2.latencyMs ?? Date.now() - sr}ms/${r2.status}`);
                break;
              }
              if (r2.status === 200) {
                const items2 = parseRedBusSearch(r2.body, ctx.source, route);
                if (items2.length) return items2;
                return [];
              }
            }
            const rp = Date.now();
            let r;
            try {
              r = await cffiFetch(pageUrl, { impersonate: "chrome", timeoutMs: 15e3 });
            } catch (e) {
              throw new AcquisitionError("ACCESS_CHALLENGE", `redBus domain unresponsive from this IP after ${Date.now() - t0}ms [${steps.join(" ") || "no steps recorded"}]`);
            }
            steps.push(`routePage=${Date.now() - rp}ms/${r.status}`);
            if (r.status === 404) return [];
            if (r.status !== 200) throw new AcquisitionError(r.status === 403 || r.status === 429 ? "ACCESS_CHALLENGE" : "SERVER_ERROR", `redBus HTTP ${r.status} [${steps.join(" ")}]`, r.status);
            const items = parseRedBusRoute(r.body, ctx.source, pageUrl);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", `redBus route page carried no parseable dataInfo fare [${steps.join(" ")}]`);
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
          maxPerMinute: 24,
          timeoutMs: 4e4,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || "");
            const rt = routeFromQuery3(raw);
            if (!rt) return [];
            const getJson2 = async (url) => {
              const r2 = await ctx.fetch(url, { expectJson: true, headers: { Accept: "application/json" } });
              if (r2.status !== 200) throw new AcquisitionError("FORBIDDEN", `AbhiBus HTTP ${r2.status} on ${url.split("?")[0]}`, r2.status);
              try {
                return JSON.parse(r2.body);
              } catch {
                throw new AcquisitionError("MALFORMED_RESPONSE", "AbhiBus non-JSON response");
              }
            };
            const [from, to] = await Promise.all([
              resolveAbhiBusCity(getJson2, rt.from),
              resolveAbhiBusCity(getJson2, rt.to)
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
          // zingbus: Next.js SEO route pages carry pTableData with the route's real
          // minFare/maxFare, busCount, duration, first/last departure (per-bus inventory
          // is sessioned-XHR only, so this is route-level fare data, like redBus route).
          sourceId: "w_bus_zingbus",
          name: "Bus worker: zingbus route fares (real min/max fare, timings)",
          priority: 4,
          maxPerMinute: 10,
          run: async (ctx) => {
            const raw = String(ctx.query.rawQuery || "");
            const rt = routeFromQuery3(raw);
            if (!rt) return [];
            const from = zingbusSlug(rt.from);
            const to = zingbusSlug(rt.to);
            if (!from || !to) return [];
            const url = `https://www.zingbus.com/bus-tickets/${from}-to-${to}-bus-route`;
            const r = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 2e4 });
            if (r.status === 404) throw new AcquisitionError("NOT_FOUND", `zingbus does not serve ${from}-to-${to} (no route page)`);
            if (r.status !== 200) throw new AcquisitionError("ACCESS_CHALLENGE", `zingbus HTTP ${r.status}`, r.status);
            const items = parseZingbusRoute(r.body, ctx.source, url, rt.from, rt.to);
            if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", `zingbus route page for ${from}-to-${to} carried no pTableData fare`);
            return items;
          }
        }
      ]
    };
    registerVerticalWorker(busWorker);
  }
});

// server/workers/parsers/cardInsider.ts
function feeToInr(fee) {
  if (!fee) return void 0;
  if (/lifetime\s*free|life\s*time\s*free|^nil$|^free$|no (joining|annual|renewal) fee/i.test(fee)) return 0;
  const m = /(?:₹|rs\.?\s?)\s*([\d,]+(?:\.\d+)?)/i.exec(fee);
  if (m) return Number(m[1].replace(/,/g, ""));
  return void 0;
}
function linesOf(html) {
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/gi, " ");
  return body.replace(/<[^>]+>/g, "\n").split("\n").map(clean).filter(Boolean);
}
function valueAfter(lines, label, from = 0, to = lines.length) {
  const i = lines.findIndex((l, k) => k >= from && k < to && l.toLowerCase() === label.toLowerCase());
  if (i < 0 || i + 1 >= lines.length) return void 0;
  const v = lines[i + 1];
  if (!v || NA.test(v)) return void 0;
  return v;
}
function detectNetwork(text) {
  if (/rupay/i.test(text)) return "RuPay";
  if (/diners/i.test(text)) return "Diners Club";
  if (/american express|\bamex\b/i.test(text)) return "American Express";
  if (/mastercard|master card/i.test(text)) return "Mastercard";
  if (/\bvisa\b/i.test(text)) return "Visa";
  return void 0;
}
function parseApr(interest) {
  if (!interest) return {};
  const ann = /(\d{1,2}(?:\.\d+)?)\s*%\s*(?:p\.?a\.?|annually|per annum|annual)/i.exec(interest) || /\((\d{1,2}(?:\.\d+)?)\s*%\s*annual/i.exec(interest);
  if (ann) return { apr: `${ann[1]}%`, aprMax: Number(ann[1]) };
  const mo = /(\d{1,2}(?:\.\d+)?)\s*%\s*(?:per\s*month|p\.?m\.?|monthly)/i.exec(interest);
  if (mo) {
    const a = Math.round(Number(mo[1]) * 12 * 10) / 10;
    return { apr: `${a}%`, aprMax: a };
  }
  return {};
}
function rewardRange(rate) {
  if (!rate) return void 0;
  const nums = [...rate.matchAll(/(\d{1,2}(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1])).filter((n) => n > 0 && n <= 30);
  if (!nums.length) return void 0;
  const lo = Math.min(...nums), hi = Math.max(...nums);
  return lo === hi ? `${hi}%` : `${lo}\u2013${hi}%`;
}
function parseCardInsiderCard(html, cardUrl) {
  const lines = linesOf(html);
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  let name = h1 ? clean(h1[1].replace(/<[^>]+>/g, " ")) : "";
  name = name.replace(/\s*[-–—|:]\s*(review|apply).*$/i, "").replace(/\s+review.*$/i, "").trim();
  if (!name || !/card/i.test(name)) return null;
  const feesFrom = Math.max(0, lines.findIndex((l) => /^fees and$/i.test(l)));
  const joining = valueAfter(lines, "Joining Fee", feesFrom) || valueAfter(lines, "Joining Fee");
  const renewal = valueAfter(lines, "Renewal Fee", feesFrom) || valueAfter(lines, "Renewal Fee") || valueAfter(lines, "Annual Fee");
  if (!joining && !renewal) return null;
  const rewardsFrom = Math.max(0, lines.findIndex((l) => /^rewards and$/i.test(l)));
  const rewardsTo = feesFrom > rewardsFrom ? feesFrom : lines.length;
  const rewardRate = valueAfter(lines, "Rewards Rate", rewardsFrom, rewardsTo) || valueAfter(lines, "Reward Rate", rewardsFrom, rewardsTo);
  const interest = valueAfter(lines, "Interest Rates", feesFrom) || valueAfter(lines, "Interest Rate", feesFrom);
  const { apr, aprMax } = parseApr(interest);
  const ratingM = /(\d(?:\.\d)?)\s*\/\s*5/.exec(lines.slice(0, 80).join(" "));
  const img = [...html.matchAll(/https:\/\/cardinsider\.com\/wp-content\/uploads\/[^"'\s)]+?\.(?:webp|png|jpg|jpeg)/gi)].map((m) => m[0]).filter((u) => !/-\d{2,4}x\d{2,4}\./.test(u))[0];
  const bankSlug = /cardinsider\.com\/([a-z0-9-]+)\//i.exec(cardUrl)?.[1] || "";
  return {
    name,
    bank: BANK_NAMES[bankSlug] || bankSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    network: detectNetwork(name) || detectNetwork(valueAfter(lines, "Card Network") || ""),
    joiningFee: joining,
    joiningFeeInr: feeToInr(joining),
    annualFee: renewal,
    annualFeeInr: feeToInr(renewal),
    rewardRate,
    welcomeBenefit: valueAfter(lines, "Welcome Benefits", rewardsFrom, rewardsTo) || valueAfter(lines, "Welcome Benefits"),
    domesticLounge: valueAfter(lines, "Domestic Lounge", rewardsFrom, rewardsTo),
    intlLounge: valueAfter(lines, "International Lounge", rewardsFrom, rewardsTo),
    forexMarkup: valueAfter(lines, "Forex Markup", feesFrom) || valueAfter(lines, "Forex Markup"),
    apr,
    aprMax,
    fuelWaiver: valueAfter(lines, "Fuel Surcharge Waiver", feesFrom),
    bestFor: valueAfter(lines, "Best Suitable For"),
    rating: ratingM ? Number(ratingM[1]) : void 0,
    imageUrl: img,
    cardUrl
  };
}
function parseIssuerIndex(html, bankSlug) {
  const re = new RegExp(`https://cardinsider\\.com/${bankSlug}/([a-z0-9-]+)/`, "gi");
  const out = /* @__PURE__ */ new Set();
  for (const m of html.matchAll(re)) {
    const slug2 = m[1];
    if (!/credit-card$/.test(slug2)) continue;
    if (/^(best|check|credit-card|hdfc-bank-credit-cards|how|add-on|.*-vs-.*|.*lifetime-free.*|.*forex.*|.*lounge.*|.*customer-care.*|.*bill-payment.*|.*pin-generation.*|.*eligibility.*|.*application-status.*|.*limit.*|.*login.*)/.test(slug2)) continue;
    out.add(m[0]);
  }
  return [...out];
}
function bankCardUrl(bankSlug, cardName) {
  const q3 = encodeURIComponent(cardName);
  const BASE2 = {
    "hdfc-bank": "https://www.hdfc.bank.in/credit-cards",
    "sbi-card": "https://www.sbicard.com/en/personal/credit-cards.page",
    "axis-bank": "https://www.axis.bank.in/cards/credit-card",
    "icici-bank": "https://www.icici.bank.in/personal-banking/cards/credit-card",
    "idfc-first-bank": "https://www.idfcfirst.bank.in/credit-card",
    "kotak-mahindra-bank": "https://www.kotak.com/en/personal-banking/cards/credit-cards.html",
    "indusind-bank": "https://www.indusind.bank.in/in/en/personal/cards/credit-card.html",
    "au-bank": "https://www.aubank.in/personal-banking/credit-cards",
    "yes-bank": "https://www.yesbank.in/personal-banking/yes-individual/cards/credit-cards",
    "bank-of-baroda": "https://www.bobcard.co.in/credit-cards",
    "american-express": "https://www.americanexpress.com/in/credit-cards/",
    "standard-chartered": "https://www.sc.com/in/credit-cards/",
    "rbl-bank": "https://www.rblbank.com/product/cards/credit-cards",
    "hsbc": "https://www.hsbc.co.in/credit-cards/"
  };
  return BASE2[bankSlug] || `https://cardinsider.com/${bankSlug}/`;
}
function cardToRawItem(c, source, bankSlug, fingerprintSeed) {
  const attrs = {
    bank: c.bank,
    ...c.network ? { network: c.network } : {},
    ...c.joiningFee ? { joining_fee: c.joiningFee } : {},
    ...c.joiningFeeInr !== void 0 ? { joining_fee_inr: String(c.joiningFeeInr) } : {},
    ...c.annualFee ? { annual_fee: c.annualFee } : {},
    ...c.annualFeeInr !== void 0 ? { annual_fee_inr: String(c.annualFeeInr) } : {},
    ...c.rewardRate ? { reward_rate_text: c.rewardRate.slice(0, 220) } : {},
    ...rewardRange(c.rewardRate) ? { reward_rate: rewardRange(c.rewardRate) } : {},
    ...c.welcomeBenefit ? { welcome_benefit: c.welcomeBenefit.slice(0, 160) } : {},
    ...c.domesticLounge ? { domestic_lounge: c.domesticLounge.slice(0, 160) } : {},
    ...c.intlLounge ? { international_lounge: c.intlLounge.slice(0, 160) } : {},
    ...c.forexMarkup ? { forex_markup: c.forexMarkup } : {},
    ...c.apr ? { apr: c.apr } : {},
    ...c.fuelWaiver ? { fuel_waiver: c.fuelWaiver.slice(0, 200) } : {},
    ...c.bestFor ? { best_for: c.bestFor } : {},
    ...c.rating !== void 0 ? { rating: String(c.rating) } : {},
    ...c.imageUrl ? { image_url: c.imageUrl } : {},
    card_page: c.cardUrl,
    price_basis: "annual (renewal) fee published for the card; rewards and APR as stated by the issuer",
    data_note: `Fees, rewards and APR as published (via CardInsider review of the issuer's terms), observed ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}; final eligibility and charges are decided by the bank on application`
  };
  return newRawItem(source, {
    title: c.name.slice(0, 200),
    seller: c.bank,
    sellerUrl: bankCardUrl(bankSlug, c.name),
    currency: "INR",
    price: c.annualFeeInr,
    // comparable metric: yearly fee (0 = lifetime free). undefined when the page does not state it
    attributes: attrs,
    evidence: {
      sourceUrl: c.cardUrl,
      sourceReference: `${bankSlug}:${c.name}`,
      rawFingerprint: (0, import_crypto13.createHash)("sha256").update(fingerprintSeed.slice(0, 4e4)).digest("hex"),
      extractedFields: ["name", "bank", ...c.joiningFee ? ["joining_fee"] : [], ...c.annualFee ? ["annual_fee"] : [], ...c.rewardRate ? ["reward_rate"] : [], ...c.apr ? ["apr"] : []]
    }
  });
}
var import_crypto13, NA, clean, BANK_NAMES;
var init_cardInsider = __esm({
  "server/workers/parsers/cardInsider.ts"() {
    import_crypto13 = require("crypto");
    init_contract();
    NA = /^(n\/?a|not applicable|nil|none|-+)$/i;
    clean = (s) => s.replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    BANK_NAMES = {
      "hdfc-bank": "HDFC Bank",
      "axis-bank": "Axis Bank",
      "sbi-card": "SBI Card",
      "icici-bank": "ICICI Bank",
      "kotak-mahindra-bank": "Kotak Mahindra Bank",
      "idfc-first-bank": "IDFC FIRST Bank",
      "au-bank": "AU Small Finance Bank",
      "indusind-bank": "IndusInd Bank",
      "yes-bank": "YES Bank",
      "bank-of-baroda": "Bank of Baroda",
      "american-express": "American Express",
      "standard-chartered": "Standard Chartered",
      "hsbc": "HSBC",
      "rbl-bank": "RBL Bank",
      "federal-bank": "Federal Bank",
      "indian-bank": "Indian Bank",
      "pnb": "Punjab National Bank",
      "bobcard": "BOBCARD",
      "onecard": "OneCard"
    };
  }
});

// server/workers/parsers/paisabazaarCards.ts
function parsePaisabazaarCard(html, url) {
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const name = h1 ? clean2(h1[1].replace(/<[^>]+>/g, " ")) : "";
  if (!name || !/credit card/i.test(name)) return null;
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/gi, " ");
  const L = body.replace(/<[^>]+>/g, "\n").split("\n").map(clean2).filter(Boolean);
  const feesAt = L.findIndex((l) => /^fees\s*&\s*charges$/i.test(l));
  const val = (label) => {
    const i = L.findIndex((l, k) => k >= Math.max(0, feesAt - 6) && l.toLowerCase() === label.toLowerCase());
    return i >= 0 ? L[i + 1] : void 0;
  };
  const joining = val("Joining Fee");
  const annual = val("Annual Fee");
  if (!joining && !annual) return null;
  const bankSlug = /paisabazaar\.com\/([a-z0-9-]+)\//i.exec(url)?.[1] || "";
  const imgs = [...html.matchAll(/https:\/\/www\.paisabazaar\.com\/wp-content\/uploads\/[^"'\s)]+\.(?:webp|png|jpg|jpeg)/gi)].map((m) => m[0]);
  const slugWords = name.toLowerCase().split(/\W+/).filter((w) => w.length > 3 && w !== "credit" && w !== "card");
  const img = imgs.find((u) => slugWords.some((w) => u.toLowerCase().includes(w)));
  return { name, bank: BANK_NAMES[bankSlug] || bankSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), joiningFee: joining, annualFee: annual, annualFeeInr: feeToInr(annual), imageUrl: img, network: detectNetwork(name), url };
}
function parsePaisabazaarIndex(html, bankSlug) {
  const out = /* @__PURE__ */ new Set();
  for (const m of html.matchAll(new RegExp(`https://www\\.paisabazaar\\.com/${bankSlug}/([a-z0-9-]+)/`, "gi"))) {
    const s = m[1];
    if (!/credit-card$/.test(s) || /^(credit-card|best|how|check|.*fees-charges|.*offers|.*-vs-.*|.*bill-payment.*|.*limit.*|.*login.*|.*customer-care.*|.*eligibility.*)$/.test(s)) continue;
    out.add(m[0]);
  }
  return [...out];
}
function pbToRawItem(c, source, bankSlug, seed) {
  return newRawItem(source, {
    title: c.name.slice(0, 200),
    seller: c.bank,
    sellerUrl: bankCardUrl(bankSlug, c.name),
    currency: "INR",
    price: c.annualFeeInr,
    attributes: {
      bank: c.bank,
      ...c.network ? { network: c.network } : {},
      ...c.joiningFee ? { joining_fee: c.joiningFee } : {},
      ...c.annualFee ? { annual_fee: c.annualFee } : {},
      ...c.annualFeeInr !== void 0 ? { annual_fee_inr: String(c.annualFeeInr) } : {},
      ...c.imageUrl ? { image_url: c.imageUrl } : {},
      card_page: c.url,
      price_basis: "annual (renewal) fee published for the card",
      data_note: `Fees as published on Paisabazaar's card page, observed ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}; the bank decides final charges on application`
    },
    evidence: {
      sourceUrl: c.url,
      sourceReference: `${bankSlug}:${c.name}`,
      rawFingerprint: (0, import_crypto14.createHash)("sha256").update(seed.slice(0, 4e4)).digest("hex"),
      extractedFields: ["name", "bank", ...c.joiningFee ? ["joining_fee"] : [], ...c.annualFee ? ["annual_fee"] : []]
    }
  });
}
var import_crypto14, clean2;
var init_paisabazaarCards = __esm({
  "server/workers/parsers/paisabazaarCards.ts"() {
    import_crypto14 = require("crypto");
    init_contract();
    init_cardInsider();
    clean2 = (s) => s.replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  }
});

// server/workers/parsers/bankCardLinks.ts
async function bankCardIndex(bankSlug) {
  const hub = HUBS[bankSlug];
  if (!hub) return [];
  const hit = CACHE.get(bankSlug);
  if (hit && Date.now() - hit.at < TTL) return hit.links;
  try {
    const seen = /* @__PURE__ */ new Map();
    const bodies = [];
    const r = await cffiFetch(hub.url, { impersonate: "chrome", timeoutMs: 2e4 });
    if (r.status === 200) bodies.push({ body: r.body, sitemap: false });
    if (hub.sitemap) {
      const sm = await cffiFetch(hub.sitemap, { impersonate: "chrome", timeoutMs: 2e4 });
      if (sm.status === 200) bodies.push({ body: sm.body, sitemap: true });
    }
    if (!bodies.length) return hit?.links || [];
    const hrefs = [];
    for (const b of bodies) {
      const re = b.sitemap ? /<loc>([^<]+)<\/loc>/g : /href="([^"#?]+)"/g;
      for (const m of b.body.matchAll(re)) hrefs.push(m[1]);
    }
    for (const raw of hrefs) {
      let h = raw;
      if (h.startsWith(hub.base)) h = h.slice(hub.base.length);
      if (!h.startsWith("/") || !hub.pathRe.test(h)) continue;
      const slug2 = h.split("/").pop().replace(/\.page$/, "");
      if (NOISE.test(slug2)) continue;
      seen.set(hub.base + h, slug2);
    }
    const links = [...seen].map(([url, slug2]) => ({ url, slug: slug2 }));
    CACHE.set(bankSlug, { at: Date.now(), links });
    return links;
  } catch {
    return hit?.links || [];
  }
}
async function resolveBankCardUrl(bankSlug, cardName) {
  const idx = await bankCardIndex(bankSlug);
  if (!idx.length) return null;
  const want = toks(cardName).filter((t) => !GENERIC.has(t));
  if (!want.length) return null;
  let best = null;
  for (const l of idx) {
    const st = new Set(toks(l.slug.replace(/-/g, " ")));
    const hit = want.filter((t) => st.has(t) || [...st].some((x) => x.startsWith(t) && t.length > 3)).length;
    if (hit < want.length) continue;
    const extra = [...st].filter((t) => !GENERIC.has(t) && !want.includes(t)).length;
    if (!best || extra < best.extra) best = { url: l.url, score: hit, extra };
  }
  return best ? best.url : null;
}
var HUBS, NOISE, CACHE, TTL, GENERIC, toks;
var init_bankCardLinks = __esm({
  "server/workers/parsers/bankCardLinks.ts"() {
    init_curlCffiFetch();
    HUBS = {
      "hdfc-bank": { url: "https://www.hdfc.bank.in/credit-cards", base: "https://www.hdfc.bank.in", pathRe: /^\/credit-cards\/[a-z0-9-]+$/ },
      "axis-bank": { url: "https://www.axis.bank.in/cards/credit-card", base: "https://www.axis.bank.in", pathRe: /^\/cards\/credit-card\/[a-z0-9-]+$/ },
      "icici-bank": { url: "https://www.icici.bank.in/personal-banking/cards/credit-card", base: "https://www.icici.bank.in", pathRe: /^\/personal-banking\/cards\/credit-card\/[a-z0-9-]+$/ },
      "idfc-first-bank": { url: "https://www.idfcfirst.bank.in/credit-card", base: "https://www.idfcfirst.bank.in", pathRe: /^\/credit-card\/[a-z0-9-]+$/, sitemap: "https://www.idfcfirst.bank.in/sitemap.xml" },
      // SBI Card's hub is client-rendered; its public sitemap lists every card page.
      "sbi-card": { url: "https://www.sbicard.com/en/personal/credit-cards.html", base: "https://www.sbicard.com", pathRe: /^\/en\/personal\/credit-cards\/[a-z0-9-]+\.html$/, sitemap: "https://www.sbicard.com/sitemap.xml" }
    };
    NOISE = /blog|calculator|emi|pin|bill|offers?$|apply-now|statement|faq|debit|kisan|business|nri|corporate|upgrade|limit|status|balance|against|add-on|secured|compare|documents|rewards$|benefits|services|programme|do-not-call|commercial|track|lounge-access|lifetime-free|metal|micro|wow|manage|login|register/i;
    CACHE = /* @__PURE__ */ new Map();
    TTL = 6 * 36e5;
    GENERIC = /* @__PURE__ */ new Set(["credit", "card", "cards", "bank", "hdfc", "axis", "icici", "sbi", "idfc", "first", "the", "and", "visa", "mastercard", "rupay", "world", "signature", "platinum", "lifetime", "free"]);
    toks = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 1);
  }
});

// server/workers/verticals/creditcards.ts
function queryPlan(raw) {
  const q3 = raw || "";
  const banks = BANK_ALIASES.filter((b) => b.re.test(q3)).map((b) => b.slug);
  const tokens2 = q3.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t) && !BANK_ALIASES.some((b) => b.re.test(t)));
  return { banks, tokens: tokens2, intents: INTENTS.filter((i) => i.re.test(q3)) };
}
function banksFor(plan, universe, map = (s) => s) {
  const wanted = plan.banks.map((b) => universe.find((u) => map(u) === b) || b).filter((b) => universe.includes(b));
  return wanted.length ? wanted : universe.slice(0, 6);
}
async function pool(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(...await Promise.all(items.slice(i, i + size).map(fn)));
  return out;
}
async function ciTask(ctx) {
  const plan = queryPlan(`${ctx.query.rawQuery || ""} ${ctx.query.entityName || ""}`);
  const banks = banksFor(plan, CI_BANKS);
  const indexes = await pool(banks, 4, async (b) => {
    const r = await cffiFetch(`https://cardinsider.com/${b}/`, { impersonate: "chrome", timeoutMs: 15e3 });
    return { b, status: r.status, links: r.status === 200 ? parseIssuerIndex(r.body, b) : [] };
  });
  if (indexes.every((i) => i.status !== 200)) throw new AcquisitionError("SERVER_ERROR", `CardInsider issuer pages HTTP ${indexes.map((i) => i.status).join("/")}`);
  let targets = indexes.flatMap((i) => i.links.map((u) => ({ b: i.b, u })));
  if (plan.tokens.length) targets = targets.filter((t) => nameMatches(t.u.split("/").filter(Boolean).pop().replace(/-/g, " "), plan.tokens));
  targets = targets.slice(0, plan.intents.length ? 90 : MAX_CARDS + 10);
  if (!targets.length) throw new AcquisitionError("EMPTY_RESPONSE", "CardInsider lists no card matching this search");
  const pages = await pool(targets, 8, async (t) => {
    try {
      const r = await cffiFetch(t.u, { impersonate: "chrome", timeoutMs: 15e3 });
      return { t, r };
    } catch {
      return { t, r: null };
    }
  });
  const out = [];
  for (const { t, r } of pages) {
    if (!r || r.status !== 200) continue;
    const c = parseCardInsiderCard(r.body, t.u);
    if (!c) continue;
    if (plan.intents.length) {
      const hay = `${c.name} ${c.bestFor || ""} ${c.rewardRate || ""} ${c.domesticLounge || ""} ${c.intlLounge || ""} ${c.joiningFee || ""} ${c.annualFee || ""} ${c.fuelWaiver || ""}`;
      if (!plan.intents.every((i) => i.test(hay))) continue;
    }
    const item = cardToRawItem(c, ctx.source, t.b, r.body);
    const official = await resolveBankCardUrl(t.b, c.name);
    if (official) {
      item.sellerUrl = official;
      item.attributes.official_page = official;
    } else item.attributes.apply_note = "Card-specific bank page not found; link opens the bank's credit-card hub";
    out.push(item);
    if (out.length >= MAX_CARDS) break;
  }
  if (!out.length) throw new AcquisitionError("EMPTY_RESPONSE", "No CardInsider card page matched this search");
  return out;
}
async function pbTask(ctx) {
  const plan = queryPlan(`${ctx.query.rawQuery || ""} ${ctx.query.entityName || ""}`);
  const banks = banksFor(plan, PB_BANKS, (s) => PB_TO_CI[s] || s);
  const indexes = await pool(banks, 4, async (b) => {
    const r = await cffiFetch(`https://www.paisabazaar.com/${b}/credit-card/`, { impersonate: "chrome", timeoutMs: 15e3 });
    return { b, status: r.status, links: r.status === 200 ? parsePaisabazaarIndex(r.body, b) : [] };
  });
  let targets = indexes.flatMap((i) => i.links.map((u) => ({ b: i.b, u })));
  if (!targets.length) throw new AcquisitionError(indexes.some((i) => i.status === 403) ? "ACCESS_CHALLENGE" : "EMPTY_RESPONSE", `Paisabazaar issuer pages gave no card links (HTTP ${indexes.map((i) => i.status).join("/")})`);
  if (plan.tokens.length) targets = targets.filter((t) => nameMatches(t.u.split("/").filter(Boolean).pop().replace(/-/g, " "), plan.tokens));
  targets = targets.slice(0, plan.intents.length ? 60 : 30);
  const pages = await pool(targets, 6, async (t) => {
    try {
      return { t, r: await cffiFetch(t.u, { impersonate: "chrome", timeoutMs: 15e3 }) };
    } catch {
      return { t, r: null };
    }
  });
  const out = [];
  for (const { t, r } of pages) {
    if (!r || r.status !== 200) continue;
    const c = parsePaisabazaarCard(r.body, t.u);
    if (!c) continue;
    if (plan.intents.length && !plan.intents.every((i) => i.test(`${c.name} ${c.joiningFee || ""} ${c.annualFee || ""}`))) continue;
    const ciSlug = PB_TO_CI[t.b] || t.b;
    const item = pbToRawItem(c, ctx.source, ciSlug, r.body);
    const official = await resolveBankCardUrl(ciSlug, c.name);
    if (official) {
      item.sellerUrl = official;
      item.attributes.official_page = official;
    }
    out.push(item);
    if (out.length >= MAX_CARDS) break;
  }
  if (!out.length) throw new AcquisitionError("EMPTY_RESPONSE", "No Paisabazaar card page matched this search");
  return out;
}
var CI_BANKS, PB_BANKS, PB_TO_CI, BANK_ALIASES, INTENTS, STOP, nameMatches, MAX_CARDS, creditCardsWorker;
var init_creditcards = __esm({
  "server/workers/verticals/creditcards.ts"() {
    init_verticalWorker();
    init_httpClient();
    init_curlCffiFetch();
    init_cardInsider();
    init_paisabazaarCards();
    init_bankCardLinks();
    CI_BANKS = ["hdfc-bank", "sbi-card", "axis-bank", "icici-bank", "idfc-first-bank", "indusind-bank", "au-bank", "yes-bank", "rbl-bank", "american-express", "bank-of-baroda", "standard-chartered", "kotak-mahindra-bank"];
    PB_BANKS = ["hdfc-bank", "axis-bank", "icici-bank", "sbi-card", "idfc-first-bank", "indusind-bank", "au-small-finance-bank", "yes-bank", "rbl-bank", "amex-bank", "bobcard", "kotak-mahindra-bank"];
    PB_TO_CI = { "au-small-finance-bank": "au-bank", "amex-bank": "american-express", bobcard: "bank-of-baroda" };
    BANK_ALIASES = [
      { slug: "hdfc-bank", re: /\bhdfc\b/i },
      { slug: "sbi-card", re: /\bsbi\b/i },
      { slug: "axis-bank", re: /\baxis\b/i },
      { slug: "icici-bank", re: /\bicici\b/i },
      { slug: "idfc-first-bank", re: /\bidfc\b/i },
      { slug: "indusind-bank", re: /indusind/i },
      { slug: "au-bank", re: /\bau\b|au small/i },
      { slug: "yes-bank", re: /\byes bank\b|\byes\b/i },
      { slug: "rbl-bank", re: /\brbl\b/i },
      { slug: "american-express", re: /amex|american express/i },
      { slug: "bank-of-baroda", re: /\bbob\b|baroda|bobcard/i },
      { slug: "standard-chartered", re: /standard chartered|\bsc\b/i },
      { slug: "kotak-mahindra-bank", re: /kotak/i }
    ];
    INTENTS = [
      { re: /travel|lounge|airport|miles/i, test: (t) => /lounge|miles|travel|air|vistara|indigo|atlas|flight/i.test(t) },
      { re: /cash\s*back|cashback/i, test: (t) => /cashback/i.test(t) },
      { re: /lifetime\s*free|\bltf\b|no annual fee|zero fee/i, test: (t) => /lifetime free/i.test(t) },
      { re: /fuel|petrol|diesel/i, test: (t) => /fuel|petrol|indian oil|bpcl|hpcl/i.test(t) },
      { re: /shopping|online|amazon|flipkart/i, test: (t) => /shopping|amazon|flipkart|myntra|online/i.test(t) },
      { re: /dining|food|swiggy|zomato/i, test: (t) => /dining|swiggy|zomato|food/i.test(t) },
      { re: /rupay|upi/i, test: (t) => /rupay/i.test(t) }
    ];
    STOP = /* @__PURE__ */ new Set(["credit", "card", "cards", "best", "top", "compare", "comparison", "india", "bank", "for", "with", "the", "and", "in", "a", "of", "to", "me", "my", "cc", "free", "lifetime", "travel", "cashback", "cash", "back", "fuel", "shopping", "online", "dining", "rupay", "lounge"]);
    nameMatches = (name, tokens2) => !tokens2.length || tokens2.every((t) => name.toLowerCase().includes(t));
    MAX_CARDS = 40;
    creditCardsWorker = {
      vertical: "creditcards",
      tasks: [
        { sourceId: "w_creditcards_cardinsider", name: "Credit cards worker: CardInsider issuer index + card pages (SSR)", priority: 10, timeoutMs: 4e4, run: ciTask },
        { sourceId: "w_creditcards_paisabazaar", name: "Credit cards worker: Paisabazaar issuer index + card pages (SSR)", priority: 11, timeoutMs: 4e4, run: pbTask },
        {
          sourceId: "w_creditcards_bankbazaar",
          name: "Credit cards worker: BankBazaar (probe)",
          priority: 20,
          run: async () => {
            const r = await cffiFetch("https://www.bankbazaar.com/credit-card.html", { impersonate: "chrome", timeoutMs: 15e3 });
            if (r.status !== 200) throw new AcquisitionError("FORBIDDEN", `BankBazaar HTTP ${r.status}`, r.status);
            if (looksLikeChallenge(r.body)) throw new AcquisitionError("ACCESS_CHALLENGE", "BankBazaar presented a challenge page");
            throw new AcquisitionError("EMPTY_RESPONSE", "BankBazaar credit-card hub is a client-rendered list: it publishes card names but no per-card fee or reward table to browserless HTTP.");
          }
        }
      ]
    };
    registerVerticalWorker(creditCardsWorker);
  }
});

// server/workers/parsers/bankbazaarAccounts.ts
function rateSlabs(text) {
  const nums = [...text.matchAll(/(\d{1,2}(?:\.\d{1,2})?)\s*%/g)].map((m) => Number(m[1])).filter((n) => n > 0 && n < 15);
  if (!nums.length) return {};
  return { min: Math.min(...nums), max: Math.max(...nums) };
}
function rupees2(text) {
  const lakh = /(\d+(?:\.\d+)?)\s*(?:lakh|lac)/i.exec(text);
  if (lakh) return Math.round(Number(lakh[1]) * 1e5);
  const m = /(?:₹|rs\.?\s*)\s*([\d,]+(?:\.\d+)?)/i.exec(text.replace(/&#8377;/g, "\u20B9"));
  if (!m) return void 0;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : void 0;
}
function parseBankBazaarSavings(html, source, pageUrl) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (cells.length < 2) continue;
    const name = cells[0];
    if (!name || !/bank/i.test(name) || name.length > 60) continue;
    const { min, max } = rateSlabs(cells[1]);
    if (max === void 0) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const href = /<a[^>]+href="([^"]+)"[^>]*>/i.exec(row)?.[1];
    const sellerUrl = href ? href.startsWith("http") ? href : `https://www.bankbazaar.com${href}` : pageUrl;
    out.push(newRawItem(source, {
      title: `${name} Savings Account`.slice(0, 120),
      price: max,
      // highest published slab — the number a saver compares on
      currency: "INR",
      seller: "BankBazaar",
      sellerUrl,
      availability: "in_stock",
      attributes: {
        account_type: "savings",
        interest_rate: String(max),
        interest_rate_min: String(min),
        interest_rate_max: String(max),
        price_unit: "% p.a. (highest slab)",
        rate_type: "indicative",
        price_basis: "published savings interest-rate slabs, indicative \u2014 never a guaranteed rate",
        data_note: `Rates published on BankBazaar's savings-account rate table, observed ${today()}`
      },
      evidence: { sourceUrl: pageUrl, extractedFields: ["interest_rate_min", "interest_rate_max", "account_type"] }
    }));
  }
  return out;
}
function parseBankBazaarCurrent(html, source, pageUrl) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (cells.length < 2) continue;
    const name = cells[0];
    if (!name || !/bank/i.test(name) || name.length > 60) continue;
    const mab = rupees2(cells[1]);
    if (mab === void 0) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(newRawItem(source, {
      title: `${name} Current Account`.slice(0, 120),
      price: mab,
      // monthly average balance requirement (₹)
      currency: "INR",
      seller: "BankBazaar",
      sellerUrl: pageUrl,
      availability: "in_stock",
      attributes: {
        account_type: "current",
        min_balance: String(mab),
        price_unit: "monthly average balance",
        ...cells[2] ? { deposit_limit: cells[2].slice(0, 100) } : {},
        price_basis: "published monthly-average-balance requirement, indicative",
        data_note: `MAB published on BankBazaar's current-account table, observed ${today()}`
      },
      evidence: { sourceUrl: pageUrl, extractedFields: ["min_balance", "account_type"] }
    }));
  }
  return out;
}
function parseBankBazaarDemat(html, source, pageUrl) {
  const out = [];
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  const attrs = {
    account_type: "demat",
    price_basis: "published general demat charges, indicative",
    data_note: `Charges published on BankBazaar's demat-account guide, observed ${today()}`
  };
  let sawChargeTable = false;
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim());
    if (cells.length < 2) continue;
    const label = cells[0];
    if (/^charge type/i.test(label)) {
      sawChargeTable = true;
      continue;
    }
    if (!sawChargeTable) continue;
    if (/account opening/i.test(label)) attrs.account_opening_fee = cells[1].slice(0, 80);
    else if (/annual maintenance|\bAMC\b/i.test(label)) attrs.amc = cells[1].slice(0, 80);
    else if (/transaction charge/i.test(label)) attrs.transaction_charge = cells[1].slice(0, 80);
    else if (/pledge/i.test(label)) attrs.pledge_charge = cells[1].slice(0, 80);
    else if (/delivery instruction/i.test(label)) attrs.dis_charge = cells[1].slice(0, 80);
    if (cells[2] && /BSDA/i.test(cells[2])) attrs.bsda_note = cells[2].slice(0, 160);
  }
  if (!attrs.account_opening_fee && !attrs.amc) return [];
  return [newRawItem(source, {
    title: "Basic Demat Account (across brokers)",
    currency: "INR",
    seller: "BankBazaar",
    sellerUrl: pageUrl,
    availability: "in_stock",
    attributes: attrs,
    evidence: { sourceUrl: pageUrl, extractedFields: Object.keys(attrs) }
  })];
}
function parsePaisabazaarSavings(html, source, pageUrl) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim());
    if (cells.length < 2) continue;
    const name = cells[0];
    if (!name || !/bank/i.test(name) || name.length > 60) continue;
    const { max } = rateSlabs(cells[1]);
    if (max === void 0) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const href = /<a[^>]+href="([^"]+)"[^>]*>/i.exec(row)?.[1];
    const sellerUrl = href ? href.startsWith("http") ? href : `https://www.paisabazaar.com${href}` : pageUrl;
    out.push(newRawItem(source, {
      title: `${name} Savings Account`.slice(0, 120),
      price: max,
      currency: "INR",
      seller: "Paisabazaar",
      sellerUrl,
      availability: "in_stock",
      attributes: {
        account_type: "savings",
        interest_rate: String(max),
        interest_rate_max: String(max),
        price_unit: "% p.a. (highest slab)",
        rate_type: "indicative",
        ...cells[2] ? { balance_requirement: cells[2].slice(0, 100) } : {},
        price_basis: "published highest savings interest slab, indicative \u2014 never a guaranteed rate",
        data_note: `Highest rate published on Paisabazaar's savings-account table, observed ${today()}`
      },
      evidence: { sourceUrl: pageUrl, extractedFields: ["interest_rate_max", "account_type"] }
    }));
  }
  return out;
}
function parseZerodhaCharges(html, source, pageUrl) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&#8377;/g, "\u20B9").replace(/\s+/g, " ");
  const m = /₹\s*(\d{2,5})[^₹]{0,80}Demat AMC/i.exec(text) || /Demat AMC[^₹]{0,80}₹\s*(\d{2,5})/i.exec(text);
  const amc = m ? Number(m[1]) : void 0;
  const freeFirstYear = /free for first year/i.test(text);
  if (amc === void 0 && !freeFirstYear) return [];
  return [newRawItem(source, {
    title: "Zerodha Demat Account",
    price: amc,
    // AMC per year from the second year (₹ per year, lower is better)
    currency: "INR",
    seller: "Zerodha",
    sellerUrl: pageUrl,
    availability: "in_stock",
    attributes: {
      account_type: "demat",
      ...amc !== void 0 ? { amc: `\u20B9${amc} per year${freeFirstYear ? " (free first year)" : ""}` } : {},
      account_opening_fee: "\u20B90 (equity account)",
      price_unit: "demat AMC per year",
      price_basis: "published on Zerodha's own charges page, indicative",
      data_note: `Demat charges published on Zerodha's charges page, observed ${today()}`
    },
    evidence: { sourceUrl: pageUrl, extractedFields: ["amc", "account_type"] }
  })];
}
function parseGrowwCharges(html, source, pageUrl) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&#8377;/g, "\u20B9").replace(/\s+/g, " ");
  const m = /Account Maintenance Charges[^₹0-9]{0,30}(₹|Rs\.?\s*)\s*([\d,]+)/i.exec(text) || /Account Maintenance Charges[^"]{0,10}"amount":"(\d+)"/i.exec(text);
  const amount = m ? Number((m[2] ?? m[1]).replace(/,/g, "")) : void 0;
  const brokerage = /equity brokerage[^₹]{0,10}₹\s*([\d.]+)/i.exec(text);
  if (amount === void 0 && !brokerage) return [];
  return [newRawItem(source, {
    title: "Groww Demat Account",
    price: amount,
    // ₹0 AMC means genuinely zero — price stays 0/undefined, honest
    currency: "INR",
    seller: "Groww",
    sellerUrl: pageUrl,
    availability: "in_stock",
    attributes: {
      account_type: "demat",
      amc: `\u20B9${amount ?? 0} per year`,
      account_opening_fee: "\u20B90",
      ...brokerage ? { brokerage: `\u20B9${brokerage[1]} or 0.1% per executed order, whichever is lower` } : {},
      price_unit: "demat AMC per year",
      price_basis: "published on Groww's own pricing page, indicative",
      data_note: `Demat charges published on Groww's pricing page, observed ${today()}`
    },
    evidence: { sourceUrl: pageUrl, extractedFields: ["amc", "account_type"] }
  })];
}
var today;
var init_bankbazaarAccounts = __esm({
  "server/workers/parsers/bankbazaarAccounts.ts"() {
    init_contract();
    today = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  }
});

// server/workers/verticals/account.ts
function accountTypeOf(ctx) {
  const q3 = `${ctx.query.rawQuery || ""} ${ctx.query.entityName || ""}`.toLowerCase();
  if (/demat|trading|share market|stock|broker|invest/.test(q3)) return "demat";
  if (/current|business account|msme|firm account/.test(q3)) return "current";
  return "savings";
}
async function acquire(ctx, url, parse, label) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await ctx.fetch(url, { timeoutMs: 2e4 });
      if (r.status !== 200) {
        if (looksLikeChallenge(r.body)) throw new AcquisitionError("ACCESS_CHALLENGE", `${label} presented a challenge page`);
        if (r.status >= 500 || r.status === 429) {
          lastErr = new AcquisitionError("SERVER_ERROR", `${label} HTTP ${r.status}${attempt === 0 ? " (will retry)" : ""}`, r.status);
          await new Promise((res) => setTimeout(res, 2500));
          continue;
        }
        throw new AcquisitionError("FORBIDDEN", `${label} HTTP ${r.status}`, r.status);
      }
      const items = parse(r.body);
      if (!items.length) throw new AcquisitionError("EMPTY_RESPONSE", `${label} page carried no publishable account data`);
      return items;
    } catch (e) {
      if (e instanceof AcquisitionError && ["ACCESS_CHALLENGE", "FORBIDDEN", "EMPTY_RESPONSE"].includes(e.failureClass)) throw e;
      lastErr = e;
      await new Promise((res) => setTimeout(res, 2500));
    }
  }
  throw lastErr instanceof AcquisitionError ? lastErr : new AcquisitionError("SERVER_ERROR", `${label} failed after retry: ${String(lastErr).slice(0, 120)}`);
}
var SAVINGS_URL, CURRENT_URL, DEMAT_URL, PAISA_URL, ZERODHA_URL, GROWW_URL, accountWorker;
var init_account = __esm({
  "server/workers/verticals/account.ts"() {
    init_verticalWorker();
    init_bankbazaarAccounts();
    init_httpClient();
    SAVINGS_URL = "https://www.bankbazaar.com/savings-account.html";
    CURRENT_URL = "https://www.bankbazaar.com/current-account.html";
    DEMAT_URL = "https://www.bankbazaar.com/demat-account.html";
    PAISA_URL = "https://www.paisabazaar.com/savings-account/";
    ZERODHA_URL = "https://zerodha.com/charges";
    GROWW_URL = "https://groww.in/pricing";
    accountWorker = {
      vertical: "banking",
      tasks: [
        {
          sourceId: "w_account_bankbazaar",
          name: "Account worker: BankBazaar bank-wise account tables",
          priority: 10,
          run: async (ctx) => {
            const type = accountTypeOf(ctx);
            const url = type === "demat" ? DEMAT_URL : type === "current" ? CURRENT_URL : SAVINGS_URL;
            const parse = (body) => type === "demat" ? parseBankBazaarDemat(body, ctx.source, url) : type === "current" ? parseBankBazaarCurrent(body, ctx.source, url) : parseBankBazaarSavings(body, ctx.source, url);
            return acquire(ctx, url, parse, "BankBazaar");
          }
        },
        {
          sourceId: "w_account_paisabazaar",
          name: "Account worker: Paisabazaar savings highest-rate table",
          priority: 12,
          run: async (ctx) => acquire(
            ctx,
            PAISA_URL,
            (body) => parsePaisabazaarSavings(body, ctx.source, PAISA_URL),
            "Paisabazaar"
          )
        },
        {
          sourceId: "w_account_zerodha",
          name: "Account worker: Zerodha published demat charges",
          priority: 14,
          run: async (ctx) => acquire(
            ctx,
            ZERODHA_URL,
            (body) => parseZerodhaCharges(body, ctx.source, ZERODHA_URL),
            "Zerodha"
          )
        },
        {
          sourceId: "w_account_groww",
          name: "Account worker: Groww published demat charges",
          priority: 16,
          run: async (ctx) => acquire(
            ctx,
            GROWW_URL,
            (body) => parseGrowwCharges(body, ctx.source, GROWW_URL),
            "Groww"
          )
        }
      ]
    };
    registerVerticalWorker(accountWorker);
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
    init_creditcards();
    init_account();
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
      // LEAK FIX (owner bug, 21 Oct): affiliate feed campaigns must NEVER serve the
      // banking/account vertical — a VCommission poll on 'sbi savings account' injected
      // 405 coupon rows into the account results. Affiliate offers live in coupons/
      // ecommerce/giftcards only.
      verticals: ["ecommerce", "coupons", "giftcards"],
      priority: 20,
      config: { apiKey: settings.cuelinks.apiKey, campaignId: settings.cuelinks.campaignId, subId: settings.cuelinks.subId },
      requiresAuthorization: true,
      // DISABLED 15 Oct: this registry feed source never had a feedUrl configured, so every
      // attempt failed EXPIRED_CREDENTIALS and poisoned the affiliate_cuelinks circuit (prod
      // logs 15 Oct) while the REAL offers sync (aggregator -> CuelinksProvider, 599 offers)
      // runs fine separately and upserts into the affiliate store. Pure noise — off.
      enabled: false
    }),
    // ---- Affiliate feed (VCommission) ----
    src({
      id: "affiliate_vcommission",
      name: "VCommission Affiliate Feed",
      method: "affiliate_feed",
      verticals: ["ecommerce", "coupons", "giftcards"],
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
      lastFailureMessage: h.lastFailureMessage,
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

// server/affiliate/linkinr/index.ts
var init_linkinr = __esm({
  "server/affiliate/linkinr/index.ts"() {
  }
});

// server/affiliate/deeplink.ts
var AFFILIATE_TTL_SEC;
var init_deeplink = __esm({
  "server/affiliate/deeplink.ts"() {
    init_settings();
    init_linkinr();
    init_logger();
    init_db();
    AFFILIATE_TTL_SEC = 24 * 60 * 60;
  }
});

// server/marketing/deals.ts
function merchantKeyOf(name) {
  const s = String(name || "").toLowerCase().replace(/\.(com|in|co\.in)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const first = s.split(" ")[0] || "";
  const alias = { amzn: "amazon", "tata": "tatacliq", bms: "bookmyshow", book: "bookmyshow", paytm: "district" };
  return alias[first] || first;
}
var init_deals = __esm({
  "server/marketing/deals.ts"() {
    init_db();
    init_deeplink();
  }
});

// server/marketing/merchantLogos.ts
var merchantLogos_exports = {};
__export(merchantLogos_exports, {
  decodeLogoDataUrl: () => decodeLogoDataUrl,
  deleteMerchantLogo: () => deleteMerchantLogo,
  ensureMerchantLogosTable: () => ensureMerchantLogosTable,
  getMerchantLogo: () => getMerchantLogo,
  listMerchantLogos: () => listMerchantLogos,
  merchantLogoMap: () => merchantLogoMap,
  upsertMerchantLogo: () => upsertMerchantLogo,
  validateLogoPayload: () => validateLogoPayload
});
async function ensureMerchantLogosTable() {
  if (ensured) return;
  await getStore().execute(`CREATE TABLE IF NOT EXISTS merchant_logos (
    name_key VARCHAR(80) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    logo MEDIUMTEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  ensured = true;
}
function validateLogoPayload(p) {
  const name = String(p.name || "").trim().slice(0, 120);
  const logo = String(p.logo || "").trim();
  if (!name) return { ok: false, error: "Merchant name is required" };
  if (!logo || !DATA_URL_RE.test(logo)) return { ok: false, error: "Logo must be a base64 PNG/JPEG/WebP data URL" };
  if (logo.length > 4e5) return { ok: false, error: "Logo too large (resize to \u2264256px before upload)" };
  return { ok: true, clean: { name_key: merchantKeyOf(name).slice(0, 80) || "brand", name, logo } };
}
async function listMerchantLogos() {
  await ensureMerchantLogosTable();
  return await getStore().query("SELECT name_key, name, logo, updated_at FROM merchant_logos ORDER BY name");
}
async function getMerchantLogo(nameKey) {
  await ensureMerchantLogosTable();
  const rows = await getStore().query("SELECT name_key, name, logo, updated_at FROM merchant_logos WHERE name_key = ? LIMIT 1", [
    String(nameKey || "").slice(0, 80)
  ]);
  return rows[0] || null;
}
function decodeLogoDataUrl(logo) {
  const m = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(String(logo || "").trim());
  if (!m) return null;
  try {
    return { mime: m[1] === "jpg" ? "jpeg" : m[1], bytes: Buffer.from(m[2], "base64") };
  } catch {
    return null;
  }
}
async function merchantLogoMap() {
  const rows = await listMerchantLogos();
  const out = {};
  for (const r of rows) out[r.name_key] = r.logo;
  return out;
}
async function upsertMerchantLogo(p) {
  const v = validateLogoPayload(p);
  if (!v.ok || !v.clean) return v;
  await ensureMerchantLogosTable();
  await getStore().execute(
    "INSERT INTO merchant_logos (name_key, name, logo, updated_at) VALUES (?, ?, ?, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE name=VALUES(name), logo=VALUES(logo), updated_at=UTC_TIMESTAMP()",
    [v.clean.name_key, v.clean.name, v.clean.logo]
  );
  return { ok: true, name_key: v.clean.name_key };
}
async function deleteMerchantLogo(nameKey) {
  await ensureMerchantLogosTable();
  await getStore().execute("DELETE FROM merchant_logos WHERE name_key = ?", [String(nameKey || "").slice(0, 80)]);
}
var ensured, DATA_URL_RE;
var init_merchantLogos = __esm({
  "server/marketing/merchantLogos.ts"() {
    init_db();
    init_deals();
    ensured = false;
    DATA_URL_RE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
  }
});

// server/cron/warm.ts
var warm_exports = {};
__export(warm_exports, {
  bootWarm: () => bootWarm,
  keepWarmDefaults: () => keepWarmDefaults,
  keepWarmDestinations: () => keepWarmDestinations
});
module.exports = __toCommonJS(warm_exports);
init_db();

// server/common/lastPrice.ts
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
init_settings();
var FILE = import_node_path.default.join(dataDir, "last-price.json");
var cache = null;
var lastSave = 0;
var saveTimer = null;
function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(import_node_fs.default.readFileSync(FILE, "utf8"));
  } catch {
    cache = {};
  }
  return cache;
}
function persistSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      import_node_fs.default.mkdirSync(dataDir, { recursive: true });
      import_node_fs.default.writeFileSync(FILE, JSON.stringify(cache ?? {}));
      lastSave = Date.now();
    } catch {
    }
  }, 250);
}
function recordSourcePrices(vertical, query, offers) {
  const store2 = load();
  const perSource = /* @__PURE__ */ new Map();
  for (const o of offers || []) {
    const sid = String(o.sourceId || "");
    if (!sid) continue;
    const p = Number(o.prices?.effectivePrice ?? o.prices?.mandatoryTotal ?? 0);
    if (!(p > 0)) continue;
    perSource.set(sid, Math.min(perSource.get(sid) ?? Infinity, p));
  }
  const now = Date.now();
  for (const [sid, price] of perSource) {
    store2[`${vertical}|${sid}`] = { price: Math.round(price * 100) / 100, query: String(query || "").slice(0, 80), at: now };
  }
  if (perSource.size) persistSoon();
}
function enrichFailedWithLastPrice(vertical, failed) {
  const store2 = load();
  return (failed || []).map((f) => {
    const e = store2[`${vertical}|${f.sourceId}`];
    return e ? { ...f, lastPrice: { ...e } } : f;
  });
}

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
  "creditcards",
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
  creditcards: ["credit card", "credit cards", "creditcard", "cc for", "best credit card", "lifetime free card", "travel card", "cashback card", "regalia", "millennia", "infinia", "amex", "rupay card", "annual fee card", "forex card"],
  movies: ["movie", "cinema", "pvr", "showtime", "show", "ticket for", "film", "concert", "event", "bookmyshow"],
  bus: ["bus", "buses", "volvo", "redbus", "sleeper bus", "bus ticket", "bus to"],
  coupons: ["coupon", "coupons", "promo code", "voucher", "discount code", "offer code", "cashback offer", "deal"],
  giftcards: ["gift card", "gift cards", "giftcard", "voucher card", "gift voucher"],
  banking: ["credit card offer", "credit card offers", "credit card discount", "credit card emi", "debit card", "card offer", "bank offer", "hdfc offer", "sbi offer", "axis offer", "icici offer", "no cost emi", "card discount"]
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
  const tokens2 = cleaned.split(/\s+/).filter((t) => t && !STOPWORDS.has(t.toLowerCase()));
  return tokens2.length > 0 ? tokens2.join(" ").slice(0, 160) : null;
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
{"vertical":"one of food|grocery|ecommerce|flights|hotels|cab|loans|insurance|movies|bus|creditcards|coupons|giftcards|banking","entity":"product/service name","city":"city if mentioned","pincode":"6-digit pincode if mentioned","dates":{"depart":"YYYY-MM-DD if mentioned"},"attributes":{"key":"value only for explicit configuration mentions"}}
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
var import_crypto15 = require("crypto");
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
            rawFingerprint: (0, import_crypto15.createHash)("sha256").update(res.body.slice(0, 5e4)).digest("hex"),
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
var import_crypto16 = require("crypto");
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
      const fingerprint = (0, import_crypto16.createHash)("sha256").update(res.body.slice(0, 5e4)).digest("hex");
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
var import_crypto17 = require("crypto");
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
              rawFingerprint: (0, import_crypto17.createHash)("sha256").update(res.body.slice(0, 5e4)).digest("hex"),
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
            rawFingerprint: (0, import_crypto17.createHash)("sha256").update(res.body.slice(0, 5e4)).digest("hex"),
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
            rawFingerprint: (0, import_crypto17.createHash)("sha256").update(res.body.slice(0, 5e4)).digest("hex"),
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
  const runWithDeadline = async (source) => {
    const remaining = opts.deadlineAt ? opts.deadlineAt - Date.now() : Infinity;
    if (remaining <= 0) {
      recordFailure(source.id, "DEADLINE_CUT", "Total search deadline reached before this source started");
      return { kind: "fail", sourceId: source.id, failureClass: "DEADLINE_CUT", error: "Total search deadline reached" };
    }
    let timer;
    const watchdog = new Promise((resolve) => {
      timer = setTimeout(() => resolve({ kind: "fail", sourceId: source.id, failureClass: "DEADLINE_CUT", error: `Cut at total deadline (+${Math.round(remaining / 1e3)}s budget)` }), remaining);
    });
    try {
      return await Promise.race([runSource(source), watchdog]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  const settled = await Promise.allSettled(sources2.map((source) => runWithDeadline(source)));
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
  if (out["image_urls"]) {
    const list = out["image_urls"].split("|").map((u) => u.trim().replace(/^\/\//, "https://").replace(/^http:\/\//i, "https://")).filter((u) => /^https:\/\//i.test(u));
    const uniq = [...new Set(list)].slice(0, 8);
    if (uniq.length) out["image_urls"] = uniq.join("|");
    else delete out["image_urls"];
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
  const stableAttrs = o.attributes && Object.keys(o.attributes).length ? JSON.stringify(Object.fromEntries(Object.entries(o.attributes).filter(([k]) => k !== "data_note"))) : "";
  const pin = ["loans", "insurance", "creditcards", "banking"].includes(String(o.vertical)) ? "" : o.location?.pincode || "";
  return `${identity}|${o.seller.toLowerCase()}|${pin}|${stableAttrs}`;
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
    { name: "identity", present: (o) => Boolean(o.identifiers.gtin || o.identifiers.sku || o.identifiers.asin || o.identifiers.vendorProductId || o.identifiers.vendor_product_id || o.brand || o.attributes["model"]) },
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
    // App-only platforms (Rapido): the fare honestly lives in the seller's app — an explicit
    // app_only_fares row passes with the fare flagged unverified, never a missing-price bug.
    { name: "fare", present: (o) => o.prices.mandatoryTotal !== void 0 || o.attributes["price_basis"] === "app_only_fares" },
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
  creditcards: [
    { name: "card", present: (o) => Boolean(o.title) },
    { name: "issuer", present: (o) => Boolean(o.vendor) },
    { name: "annual_fee", present: (o) => o.prices.mandatoryTotal !== void 0 || Boolean(o.attributes["annual_fee"]), blocking: false },
    { name: "published_flag", present: (o) => o.attributes["quote_type"] === "published_terms" || o.attributes["rate_type"] === "published", blocking: false }
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
var import_crypto18 = require("crypto");
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
    evidenceHash: raw.evidence?.rawFingerprint || (0, import_crypto18.createHash)("sha256").update(raw.title).digest("hex")
  };
}

// server/pipeline/lenderLogo.ts
var import_node_fs4 = __toESM(require("node:fs"), 1);
var import_node_path4 = __toESM(require("node:path"), 1);
var UA2 = "Try1Second/1.0 (contact: standardpetro.in@gmail.com)";
var CACHE_FILE = import_node_path4.default.join(process.cwd(), "data", "lender-logos.json");
var MISS_TTL_MS = 7 * 864e5;
var FETCH_TIMEOUT_MS = 4e3;
var cache5 = null;
var inflight2 = /* @__PURE__ */ new Map();
function load7() {
  if (cache5) return cache5;
  try {
    cache5 = JSON.parse(import_node_fs4.default.readFileSync(CACHE_FILE, "utf8"));
  } catch {
    cache5 = {};
  }
  return cache5;
}
var saveTimer2 = null;
function persist2() {
  if (saveTimer2) return;
  saveTimer2 = setTimeout(() => {
    saveTimer2 = null;
    try {
      import_node_fs4.default.mkdirSync(import_node_path4.default.dirname(CACHE_FILE), { recursive: true });
      import_node_fs4.default.writeFileSync(CACHE_FILE, JSON.stringify(cache5 || {}));
    } catch {
    }
  }, 1500);
}
function lenderNameFrom(raw) {
  return String(raw || "").replace(/\b(personal|home|car|auto|business|gold|education|two[- ]wheeler|bike|used car|property|credit card|loan|loans|insurance|health|term|life|motor|travel|plan|policy|emi|interest rates?|rates?)\b/gi, " ").replace(/[|:–—-].*$/, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}
async function getJson(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA2, Accept: "application/json" }, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}
var LENDER_ALIAS = {
  sbi: "State Bank of India",
  pnb: "Punjab National Bank",
  bob: "Bank of Baroda",
  hdfc: "HDFC Bank",
  hdfcl: "HDFC Bank",
  icici: "ICICI Bank",
  idbi: "IDBI Bank",
  idfc: "IDFC First Bank",
  "idfc first": "IDFC First Bank",
  hdbfs: "HDB Financial Services",
  "hdb financial": "HDB Financial Services",
  kotak: "Kotak Mahindra Bank",
  iob: "Indian Overseas Bank",
  ubi: "Union Bank of India",
  lic: "Life Insurance Corporation",
  canara: "Canara Bank",
  union: "Union Bank of India",
  axis: "Axis Bank",
  "yes bank": "Yes Bank"
};
async function lookup(nameRaw) {
  const name = LENDER_ALIAS[nameRaw.toLowerCase()] || nameRaw;
  const s = await getJson(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&limit=5&search=${encodeURIComponent(name)}`);
  const ids = (s?.search || []).map((x) => x.id).filter(Boolean);
  if (!ids.length) return null;
  const e = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|descriptions&ids=${ids.join("|")}`);
  for (const id of ids) {
    const ent = e?.entities?.[id];
    const desc = String(ent?.descriptions?.en?.value || "").toLowerCase();
    if (desc && !/(bank|insur|financ|lender|nbfc|credit|loan|capital|assurance|fintech|company|corporation|holding)/.test(desc)) continue;
    const file = ent?.claims?.P154?.[0]?.mainsnak?.datavalue?.value;
    if (file) return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(String(file).replace(/ /g, "_"))}?width=256`;
  }
  return null;
}
function resolveLenderLogo(rawName) {
  const name = lenderNameFrom(rawName);
  if (name.length < 3) return Promise.resolve(null);
  const key = name.toLowerCase();
  const c = load7();
  const hit = c[key];
  if (hit && (hit.url || Date.now() - hit.at < MISS_TTL_MS)) return Promise.resolve(hit.url);
  const running = inflight2.get(key);
  if (running) return running;
  const p = lookup(name).catch(() => null).then((url) => {
    c[key] = { url, at: Date.now() };
    persist2();
    return url;
  }).finally(() => inflight2.delete(key));
  inflight2.set(key, p);
  return p;
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
  [/ola\b/i, "book.olacabs.com"],
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
var LENDER_DOMAIN = [
  [/axis/i, "axisbank.com"],
  [/union bank/i, "unionbankofindia.co.in"],
  [/idfc/i, "idfcfirstbank.com"],
  [/\bsbi\b|state bank/i, "sbi.co.in"],
  [/\bpnb\b|punjab national/i, "pnbindia.in"],
  [/indusind/i, "indusind.com"],
  [/hdfc ergo/i, "hdfcergo.com"],
  [/hdfc/i, "hdfcbank.com"],
  [/icici lombard/i, "icicilombard.com"],
  [/icici pru|icici prudential/i, "iciciprulife.com"],
  [/icici/i, "icicibank.com"],
  [/kotak/i, "kotak.com"],
  // Brokers / demat + investment platforms (owner 22 Oct: "Zerodha Demat Account" card rendered blank)
  [/zerodha/i, "zerodha.com"],
  [/groww/i, "groww.in"],
  [/upstox/i, "upstox.com"],
  [/angel ?one|angel broking/i, "angelone.in"],
  [/5paisa/i, "5paisa.com"],
  [/dhan/i, "dhan.co"],
  [/paytm money/i, "paytmmoney.com"],
  [/smallcase/i, "smallcase.com"],
  [/yes bank/i, "yesbank.in"],
  [/bank of baroda|\bbob\b/i, "bankofbaroda.in"],
  [/canara/i, "canarabank.com"],
  [/bank of india/i, "bankofindia.co.in"],
  [/bank of maharashtra/i, "bankofmaharashtra.in"],
  [/central bank/i, "centralbankofindia.co.in"],
  [/indian bank/i, "indianbank.in"],
  [/indian overseas|\biob\b/i, "iob.in"],
  [/uco bank/i, "ucobank.com"],
  [/punjab (&|and) sind/i, "psbindia.com"],
  [/federal bank/i, "federalbank.co.in"],
  [/rbl/i, "rblbank.com"],
  [/au small|au bank/i, "aubank.in"],
  [/bandhan/i, "bandhanbank.com"],
  [/idbi/i, "idbibank.in"],
  [/south indian/i, "southindianbank.com"],
  [/karnataka bank/i, "karnatakabank.com"],
  [/city union/i, "cityunionbank.com"],
  [/standard chartered/i, "sc.com"],
  [/hsbc/i, "hsbc.co.in"],
  [/citi/i, "citibank.co.in"],
  [/american express|amex/i, "americanexpress.com"],
  [/dbs/i, "dbs.com"],
  [/tata capital/i, "tatacapital.com"],
  [/tata aig/i, "tataaig.com"],
  [/bajaj (finserv|finance)/i, "bajajfinserv.in"],
  [/bajaj allianz/i, "bajajallianz.com"],
  [/hero fincorp/i, "herofincorp.com"],
  [/fullerton|sumitomo/i, "smfgindia.com"],
  [/piramal/i, "piramalfinance.com"],
  [/aditya birla/i, "adityabirlacapital.com"],
  [/poonawalla/i, "poonawallafincorp.com"],
  [/lendingkart/i, "lendingkart.com"],
  [/navi/i, "navi.com"],
  [/kreditbee/i, "kreditbee.in"],
  [/money ?view/i, "moneyview.in"],
  [/cashe/i, "getcashe.com"],
  [/fibe|earlysalary/i, "myfibe.com"],
  [/mpokket/i, "mpokket.in"],
  [/stashfin/i, "stashfin.com"],
  [/lic\b|life insurance corp/i, "licindia.in"],
  [/star health/i, "starhealth.in"],
  [/care health/i, "careinsurance.com"],
  [/niva|max bupa/i, "nivabupa.com"],
  [/new india/i, "newindia.co.in"],
  [/national insurance/i, "nationalinsurance.nic.co.in"],
  [/oriental/i, "orientalinsurance.org.in"],
  [/united india/i, "uiic.co.in"],
  [/royal sundaram/i, "royalsundaram.in"],
  [/reliance general/i, "reliancegeneral.co.in"],
  [/sbi general/i, "sbigeneral.in"],
  [/sbi life/i, "sbilife.co.in"],
  [/future generali|generali/i, "generalicentral.com"],
  [/chola/i, "cholainsurance.com"],
  [/iffco/i, "iffcotokio.co.in"],
  [/acko/i, "acko.com"],
  [/digit/i, "godigit.com"],
  [/manipal/i, "manipalcigna.com"],
  [/aditya birla health/i, "adityabirlacapital.com"]
];
var LENDER_VERTICALS = /* @__PURE__ */ new Set(["loans", "insurance", "creditcards", "banking", "account"]);
var DATA_HOST = /(^|\.)(githubusercontent|github|wikidata|wikipedia|openstreetmap|project-osrm|osrm)\./i;
function hostOf(u) {
  try {
    return u ? new URL(u).hostname.replace(/^www\./, "") : void 0;
  } catch {
    return void 0;
  }
}
var HD_LOGO = [
  [/redbus/i, "/brand-logos/redbus.svg"],
  [/big ?basket|bb ?now/i, "/brand-logos/bigbasket.png"]
];
function brandImageFor(o) {
  const attrs = o.attributes || {};
  if (o.vertical === "flights") {
    const code = String(attrs.airline_code || "").toUpperCase();
    const iata = /^[A-Z0-9]{2}$/.test(code) ? code : AIRLINE_IATA[String(attrs.airline || o.seller || "").toLowerCase().trim()];
    if (iata) return `https://www.gstatic.com/flights/airline_logos/70px/${iata}.png`;
  }
  if (LENDER_VERTICALS.has(String(o.vertical))) {
    const lenderLabel = `${o.title || ""} ${attrs.bank || ""} ${attrs.provider || ""} ${attrs.insurer || ""} ${attrs.lender || ""}`;
    const ld = LENDER_DOMAIN.find(([re]) => re.test(lenderLabel))?.[1];
    if (ld) return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(ld)}&sz=128`;
  }
  const label = `${o.seller || ""} ${o.vendor || ""}`;
  const hd = HD_LOGO.find(([re]) => re.test(label))?.[1];
  if (hd) return hd;
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
var LENDER_VERTICAL_IDS = /* @__PURE__ */ new Set(["loans", "insurance", "creditcards", "account"]);
async function withLenderLogos(offers) {
  const targets = offers.filter((o) => {
    if (!LENDER_VERTICAL_IDS.has(String(o.vertical))) return false;
    const a = o.attributes || {};
    return !a.image_url || a.image_is_brand_logo === "true";
  });
  const names = Array.from(new Set(targets.map((o) => String(o.attributes?.bank || o.title || ""))));
  const logos = /* @__PURE__ */ new Map();
  await Promise.all(names.map(async (n) => {
    logos.set(n, await resolveLenderLogo(n));
  }));
  for (const o of targets) {
    const a = o.attributes || (o.attributes = {});
    const logo = logos.get(String(o.attributes?.bank || o.title || ""));
    if (logo) {
      a.image_url = logo;
      a.image_is_brand_logo = "true";
      a.image_is_lender_logo = "true";
    }
  }
  return offers;
}
var uploadedLogosCache = null;
async function uploadedLogoMap() {
  if (uploadedLogosCache && Date.now() - uploadedLogosCache.at < 3e5) return uploadedLogosCache.map;
  try {
    const { merchantLogoMap: merchantLogoMap2 } = await Promise.resolve().then(() => (init_merchantLogos(), merchantLogos_exports));
    const map = await merchantLogoMap2();
    uploadedLogosCache = { at: Date.now(), map };
    return map;
  } catch {
    return (uploadedLogosCache = { at: Date.now(), map: {} }).map;
  }
}
function logoKeyOf(name) {
  return String(name || "").toLowerCase().replace(/\.(com|in|co\.in)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ")[0] || "";
}
async function withMerchantLogos(offers) {
  const map = await uploadedLogoMap();
  if (!Object.keys(map).length) return offers;
  for (const o of offers) {
    const a = o.attributes || {};
    if (a.image_url && a.image_is_brand_logo !== "true") continue;
    const attrs = o.attributes || {};
    const label = [o.seller, o.vendor, o.title, attrs.bank, attrs.lender, attrs.insurer, attrs.provider].filter(Boolean).join(" ");
    const keys = [logoKeyOf(String(o.seller || "")), logoKeyOf(String(attrs.bank || "")), logoKeyOf(String(attrs.lender || "")), logoKeyOf(String(attrs.provider || ""))];
    for (const k of keys) {
      if (k && map[k]) {
        a.image_url = map[k];
        a.image_is_brand_logo = "true";
        break;
      }
    }
    void label;
  }
  return offers;
}

// server/pipeline/productImages.ts
init_db();
init_curlCffiFetch();
var BREAKER_MS = 10 * 6e4;
var breakerUntil = 0;
var ensured2 = false;
async function ensureTable() {
  if (ensured2) return;
  await getStore().execute(`CREATE TABLE IF NOT EXISTS product_images (
    img_key VARCHAR(160) PRIMARY KEY,
    url VARCHAR(600) NOT NULL,
    source VARCHAR(40) NOT NULL DEFAULT 'bing-images',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  ensured2 = true;
}
var STOP_RE = /logo|icon|store_|building|office|career|jobs?|realestate|furniture|coupon|banner|app-?store|flickr.*people|facebook/i;
var GOOD_PATH_RE = /menu|pizza|product|food|dish|media|photo|uploads?\b|zmtcdn|swiggy|dominos/i;
function slug(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 150);
}
function parseBingItems(html) {
  const out = [];
  const re = /class="iusc"[^>]*m="({[^"]+})"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"));
      if (j.murl) out.push({ murl: String(j.murl), t: String(j.t || "") });
    } catch {
    }
  }
  return out;
}
function scoreItem(it, tokens2, brandTok) {
  const url = String(it.murl || "");
  const hay = `${url} ${it.t || ""}`.toLowerCase();
  if (!/^https:\/\//.test(url)) return -1;
  if (!/\.(jpg|jpeg|webp)(\?|$)/i.test(url) && !/(zmtcdn|swiggy|media-assets|instacdn)/i.test(url)) return -1;
  if (STOP_RE.test(hay)) return -1;
  let sc = 0;
  for (const tk of tokens2) if (hay.includes(tk)) sc += 3;
  if (hay.includes(brandTok)) sc += 4;
  if (GOOD_PATH_RE.test(url)) sc += 2;
  return sc;
}
async function verifyImage(url) {
  try {
    const r = await cffiFetch(url, { impersonate: "chrome", timeoutMs: 8e3, headers: { Range: "bytes=0-63" } });
    if (r.status !== 200 && r.status !== 206) return false;
    const head = String(r.body || "").slice(0, 64);
    if (/^\x89PNG|\xff\xd8\xff/.test(head)) return true;
    if (/^(RIFF)/.test(head) && head.slice(8, 12) === "WEBP") return true;
    return false;
  } catch {
    return false;
  }
}
async function lookupProductImage(seller, dish) {
  if (Date.now() < breakerUntil) return null;
  const brand = seller.toLowerCase().includes("domino") ? "domino's" : String(seller || "").trim();
  const q3 = encodeURIComponent(`${brand} ${dish} menu`.replace(/\s+/g, " ").trim());
  let html = "";
  try {
    const r = await cffiFetch(`https://www.bing.com/images/async?q=${q3}&first=0&count=25&mmasync=1`, { impersonate: "chrome", timeoutMs: 1e4 });
    if (r.status !== 200) throw new Error(`bing HTTP ${r.status}`);
    html = String(r.body || "");
  } catch (e) {
    breakerUntil = Date.now() + BREAKER_MS;
    return null;
  }
  const items = parseBingItems(html);
  if (items.length < 3) {
    breakerUntil = Date.now() + BREAKER_MS;
    return null;
  }
  const brandTok = slug(brand).split("-")[0] || "pizza";
  const tokens2 = Array.from(/* @__PURE__ */ new Set([brandTok, ...slug(dish).split("-").filter((t) => t.length > 2 && !["pizza", "the", "and"].includes(t))]));
  const ranked = items.map((it) => ({ it, sc: scoreItem(it, tokens2, brandTok) })).filter((x) => x.sc > 2).sort((a, b) => b.sc - a.sc).slice(0, 3);
  for (const cand of ranked) {
    if (await verifyImage(cand.it.murl)) return String(cand.it.murl);
  }
  return null;
}
async function cachedImage(key) {
  await ensureTable();
  const rows = await getStore().query("SELECT url FROM product_images WHERE img_key = ?", [key]);
  const row = rows?.[0] || rows?.rows?.[0];
  return row?.url ? String(row.url) : null;
}
async function rememberImage(key, url) {
  await ensureTable();
  await getStore().execute("INSERT IGNORE INTO product_images (img_key, url, source) VALUES (?, ?, ?)", [key, url, "bing-images"]);
}
async function withProductImages(offers, budget = 5) {
  const food = offers.filter((o) => String(o.vertical) === "food");
  if (!food.length) return offers;
  let spent = 0;
  const tasks = [];
  for (const o of food) {
    const a = o.attributes || {};
    if (a.image_url && a.image_is_brand_logo !== "true") continue;
    const dish = String(a.dish || o.title || "").replace(/\s*\([^)]*\)\s*/g, " ").trim();
    if (!dish) continue;
    const seller = String(o.seller || a.restaurant || "");
    const key = slug(`${seller}|${dish}`).slice(0, 160);
    tasks.push((async () => {
      try {
        let url = await cachedImage(key);
        if (!url) {
          if (spent >= budget) return;
          spent += 1;
          url = await lookupProductImage(seller, dish);
          if (url) await rememberImage(key, url);
        }
        if (url) {
          a.image_url = url;
          a.image_is_brand_logo = "false";
          a.image_is_product_image = "true";
          a.image_source = "bing-images (cached per dish)";
        }
      } catch {
      }
    })());
  }
  await Promise.allSettled(tasks);
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
  const SERVICE_VERTICALS = /* @__PURE__ */ new Set(["loans", "insurance", "creditcards", "flights", "hotels", "bus", "cab", "movies"]);
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

// server/search/queryRelevance.ts
var STOP2 = /* @__PURE__ */ new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "best",
  "top",
  "new",
  "buy",
  "get",
  "off",
  "sale",
  "under",
  "over",
  "near",
  "me",
  "in",
  "on",
  "of",
  "to",
  "a",
  "an",
  "at",
  "by"
]);
var CANON = {
  television: "tv",
  telly: "tv",
  smartphones: "phone",
  smartphone: "phone",
  mobiles: "mobile",
  earphones: "headphone",
  earphone: "headphone",
  earbuds: "earbud",
  laptops: "laptop"
};
function tokens(text) {
  const out = /* @__PURE__ */ new Set();
  for (const raw of String(text || "").toLowerCase().split(/[^a-z0-9]+/)) {
    if (!raw || raw.length < 2 || STOP2.has(raw)) continue;
    let t = raw.replace(/(ies)$/, "y").replace(/(es|s)$/, "");
    if (!t) t = raw;
    out.add(CANON[raw] ?? CANON[t] ?? t);
  }
  return out;
}
function queryTokens(q3) {
  const parts = [];
  const raw = q3?.rawQuery || q3?.raw || q3?.query || "";
  const entity = q3?.entityName ? String(q3.entityName) : "";
  if (raw) parts.push(String(raw));
  if (entity) parts.push(entity);
  const t = q3?.terms;
  if (Array.isArray(t)) parts.push(t.join(" "));
  if (!parts.join("")) return /* @__PURE__ */ new Set();
  return tokens(parts.join(" "));
}
function rowTokens(offer) {
  const attrs = offer.attributes || {};
  const parts = [offer.title || "", offer.brand || "", attrs["brand"] || "", attrs["category"] || "", attrs["product_type"] || ""];
  return tokens(parts.join(" "));
}
function passesQueryRelevance(offer, parsed) {
  const q3 = parsed;
  const qt = queryTokens(q3);
  if (qt.size === 0) return true;
  const rt = rowTokens(offer);
  let hits = 0;
  for (const tok of qt) if (rt.has(tok)) hits++;
  return qt.size <= 1 ? hits >= 1 : hits / qt.size >= 0.6;
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
  "movies",
  "creditcards"
];
var CATEGORICAL_ATTR_KEYS = [
  "loan_type",
  "insurance_type",
  "plan_type",
  "card_type",
  "product_type",
  "service_type",
  "category",
  "provider_type"
];
var PROVIDER_QUERY_PATTERNS = [
  [/\bsbi\b|state bank of india/i, /state bank of india|\bsbi\b/i],
  [/\bpnb\b|punjab national bank/i, /punjab national bank|\bpnb\b/i],
  [/\bbob\b|bank of baroda/i, /bank of baroda|\bbob\b/i],
  [/\bhdfc\b/i, /hdfc/i],
  [/\bicici\b/i, /icici/i],
  [/\baxis\b/i, /axis/i],
  [/\bkotak\b/i, /kotak/i],
  [/\bcanara\w*/i, /canara/i],
  [/\bidfc\b/i, /idfc/i],
  [/\bindusind\b/i, /indusind/i],
  [/\brbl\b/i, /rbl/i],
  [/\byes bank\b/i, /yes bank/i],
  [/\bau bank\b|au small finance/i, /au small finance/i],
  [/\bequitas\b/i, /equitas/i],
  [/\bdbs\b/i, /dbs/i],
  [/\bfederal bank\b/i, /federal bank/i],
  [/\bunion bank\b/i, /union bank/i],
  [/\bbank of india\b/i, /bank of india/i],
  [/\bbank of maharashtra\b/i, /bank of maharashtra/i],
  [/\bkarnataka bank\b/i, /karnataka bank/i],
  [/\bsouth indian bank\b/i, /south indian bank/i],
  [/\bcatholic syrian\b|\bcsb bank\b/i, /catholic syrian|\bcsb\b/i],
  [/\bcity union bank\b/i, /city union bank/i],
  [/\btamilnad mercantile\b/i, /tamilnad mercantile/i],
  [/\bpaytm payments bank\b|\bpaytm bank\b/i, /paytm/i],
  [/\bairtel payments bank\b|\bairtel bank\b/i, /airtel/i],
  [/\bfino\b/i, /fino/i],
  [/\bujjivan\b/i, /ujjivan/i],
  [/\bzerodha\b/i, /zerodha/i],
  [/\bgroww\b/i, /groww/i],
  [/\bupstox\b/i, /upstox/i],
  [/\bangel one\b|angel broking/i, /angel/i],
  [/\b5paisa\b/i, /5paisa/i]
];
function filterByNamedProviders(offers, entityName) {
  if (!entityName) return offers;
  const requiredProviders = PROVIDER_QUERY_PATTERNS.filter(([qRe]) => qRe.test(String(entityName))).map(([, oRe]) => oRe);
  if (requiredProviders.length === 0) return offers;
  return offers.filter((o) => {
    const text = `${o.title} ${o.vendor || ""}`.toLowerCase();
    return requiredProviders.some((re) => re.test(text));
  });
}
function filterByQueryEntity(offers, query) {
  if (!query.entityName) return offers;
  const providerFiltered = filterByNamedProviders(offers, query.entityName);
  if (providerFiltered.length !== offers.length) return providerFiltered;
  const tokens2 = query.entityName.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (tokens2.length === 0) return offers;
  if ((query.intent === "browse" || tokens2.length > 2) && offers.length > 0 && offers.every((o) => NON_COMPARISON_VERTICALS.includes(o.vertical))) {
    return offers;
  }
  return offers.filter((o) => {
    const attrText = CATEGORICAL_ATTR_KEYS.map((k) => String(o.attributes?.[k] ?? "")).join(" ");
    const text = `${o.title} ${o.vendor || ""} ${attrText}`.toLowerCase();
    const hits = tokens2.filter((t) => text.includes(t)).length;
    return hits >= Math.ceil(tokens2.length / 2);
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
function normPlace2(x) {
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
  const m = raw.match(/([a-zA-Z][a-zA-Z0-9\s.,()\/&'-]{1,60}?(?:\s*\([A-Za-z]{3}\))?)\s+(?:to|→|->|-)\s+([a-zA-Z][a-zA-Z0-9\s.,()\/&'-]{1,60}(?:\s*\([A-Za-z]{3}\))?)/);
  if (!m) return null;
  const from = normPlace2(m[1].replace(/^\s*from\s+/i, "")), to = normPlace2(m[2]);
  if (!from.city || !to.city) return null;
  return { from, to };
}
function placeHit(text, side) {
  const s = (text || "").toLowerCase();
  const alias = Object.entries(PLACE_ALIASES).filter(([, v]) => v === side.city).map(([k]) => k);
  return !!(side.code && new RegExp(`\\b${side.code}\\b`, "i").test(s) || side.city && (s.includes(side.city) || alias.some((a) => s.includes(a))));
}
function routeSideHit(rawSide, side) {
  const s = normPlace2(rawSide).city;
  if (!s) return false;
  if (placeHit(s, side)) return true;
  const t = side.city || "";
  if (!t) return false;
  return s === t || t.includes(s) || s.includes(t);
}
function routeFilter(offers, query) {
  const rt = parseRouteQuery(query.rawQuery || "");
  if (!rt) return offers;
  return offers.filter((o) => {
    const r = String(o.travel?.route || o.attributes?.["route"] || "");
    if (!r) return false;
    const [src2 = "", dst = ""] = r.split(/\s+(?:to|→|->)\s+/);
    return routeSideHit(src2, rt.from) && routeSideHit(dst, rt.to);
  });
}
function destinationFilter(offers, query) {
  const head = String(query.rawQuery || "").split(",")[0];
  const q3 = normPlace2(head);
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
var CreditCardEngine = class extends VerticalEngine {
  constructor() {
    super({ vertical: "creditcards", displayName: "Credit Cards", postProcess: (offers) => offers.map((o) => ({
      ...o,
      attributes: { ...o.attributes, rate_type: o.attributes["rate_type"] || "published", quote_type: "published_terms" }
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
  creditcards: new CreditCardEngine(),
  movies: new MovieEventEngine(),
  bus: new BusEngine(),
  food: new FoodDeliveryEngine(),
  grocery: new QuickGroceryEngine(),
  coupons: new CouponEngine(),
  giftcards: new GiftCardEngine(),
  banking: new BankingOfferEngine()
};
var UnknownVerticalEngine = class extends VerticalEngine {
  constructor(vertical) {
    super({ vertical, displayName: "Unknown Vertical" });
  }
  // Unknown ids pass offers through untouched (honest ranking still applies) —
  // a bad vertical id must degrade gracefully, never crash the process.
  async execute(offers) {
    return offers;
  }
};
function getVerticalEngine(vertical) {
  return ENGINES[vertical] ?? new UnknownVerticalEngine(String(vertical));
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
async function purgeStaleBankingOffers() {
  const store2 = getStore();
  try {
    await store2.execute(
      `DELETE FROM offers WHERE vertical = 'banking' AND (attributes IS NULL OR attributes NOT LIKE '%"account_type"%')`
    );
  } catch (e) {
    log.debug("Catalogue", "Stale banking purge failed", { error: String(e).slice(0, 100) });
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
function parseCatalogueAttributes(raw) {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return p && typeof p === "object" ? p : {};
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" ? raw : {};
}
function rowToOffer(row, isLiveNow) {
  const status = row.freshness_status === "LIVE_VERIFIED" ? "CACHED_VERIFIED" : row.freshness_status;
  return {
    id: `cat_${row.id}`,
    canonicalEntityId: row.canonical_entity_id ?? null,
    canonicalVariantId: null,
    vertical: row.vertical,
    title: row.title,
    identifiers: {},
    // Catalogue rows persist their full attribute set (image_url, rating, city, gallery...).
    // Hydrate it — dropping it left every replayed hotel/flight row image-less, which
    // surfaced as the recurring "photo not published by source" placeholder bug.
    attributes: parseCatalogueAttributes(row.attributes),
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
var inflightPipelines = /* @__PURE__ */ new Map();
function progressiveCatalogueResponse(vertical, inputQuery, offers, start, pending) {
  const anyOffers = offers;
  for (const o of anyOffers) {
    if (o.freshnessStatus === "LIVE_VERIFIED") o.freshnessStatus = "CACHED_VERIFIED";
    if (o.provenance) o.provenance.replayedFromCache = true;
  }
  return {
    query: inputQuery,
    results: anyOffers,
    state: {
      servedFrom: "catalogue",
      sourcesAttempted: [],
      sourcesSucceeded: [],
      sourcesFailed: [],
      reusedCatalogue: true,
      triggeredRefresh: true,
      pendingRefresh: pending
    },
    latencyMs: Date.now() - start,
    totalSearchLatencyMs: Date.now() - start
  };
}
var RELEVANCE_GATED_CATALOGUE = /* @__PURE__ */ new Set(["ecommerce", "grocery", "food", "movies", "movie"]);
async function freshCatalogueOffers(vertical, input, parsed) {
  const rows = await findCatalogueOffers(vertical, { pincode: input.pincode, city: input.city, limit: 40 });
  const now = Date.now();
  let offers = rows.filter((r) => (now - new Date(r.fetched_at).getTime()) / 1e3 < 3600 && r.validation_status !== "INVALID").map((r) => rowToOffer(r, false));
  if (RELEVANCE_GATED_CATALOGUE.has(vertical)) {
    offers = offers.filter((o) => passesQueryRelevance(o, parsed));
  }
  return withBrandImages(filterByNamedProviders(offers, parsed?.entityName));
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
  const running = inflightPipelines.get(cacheKey);
  if (running) {
    const offers = await freshCatalogueOffers(vertical, input, parsed);
    if (offers.length >= 4) return progressiveCatalogueResponse(vertical, parsed, offers, totalStart, true);
    return running;
  }
  {
    const offers = await freshCatalogueOffers(vertical, input, parsed);
    if (offers.length >= 4) {
      const pipeline2 = runLivePipeline(input, parsed).then((response2) => {
        const { ttlSec: t, staleSec: st } = searchCacheTtl(vertical);
        if (response2.results.length === 0) cachePut(cacheKey, response2, 45, 45);
        else cachePut(cacheKey, response2, t, st);
        return response2;
      }).finally(() => {
        inflightPipelines.delete(cacheKey);
      });
      inflightPipelines.set(cacheKey, pipeline2);
      pipeline2.catch(() => {
      });
      return progressiveCatalogueResponse(vertical, parsed, offers, totalStart, true);
    }
  }
  const response = await runLivePipeline(input, parsed);
  if (response.results.length === 0) {
    cachePut(cacheKey, response, 45, 45);
  } else {
    cachePut(cacheKey, response, ttlSec, staleSec);
  }
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
    const deadlineAt = Date.now() + (Number(process.env.LIVE_SEARCH_BUDGET_MS) || 42e3);
    const outcome = await acquireParallel(parsed, { maxSources: 20, deadlineAt });
    state.sourcesAttempted = outcome.attempted;
    state.sourcesSucceeded = outcome.succeeded;
    state.sourcesFailed = outcome.failed.map((f) => ({ sourceId: f.sourceId, failureClass: f.failureClass, error: f.error }));
    liveOffers = await processAdapterResults(outcome.results, parsed);
    recordSourcePrices(String(vertical), String(input.query || ""), liveOffers);
    state.sourcesFailed = enrichFailedWithLastPrice(String(vertical), state.sourcesFailed);
  } else {
    state.sourcesAttempted = [];
  }
  const liveIdentity = (o) => `${o.vertical}|${o.title.toLowerCase()}|${o.seller.toLowerCase()}|${o.travel?.date || ""}|${o.travel?.route || ""}`;
  const liveKeys = new Set(liveOffers.map(liveIdentity));
  const supplementary = catalogueOffers.filter((o) => !liveKeys.has(liveIdentity(o)) && passesQueryRelevance(o, parsed));
  let combined = dedupeOffers([...liveOffers, ...supplementary]);
  const engine = getVerticalEngine(vertical);
  combined = await engine.execute(combined, parsed);
  combined = await attachAffiliateDeepLinks(combined);
  const ranked = rankOffers(await withProductImages(await withMerchantLogos(await withLenderLogos(withBrandImages(combined)))), { userPincode: input.pincode, userCity: input.city });
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
  let processed = 0;
  for (const result of results) {
    const source = getSource2(result.sourceId);
    if (!source) continue;
    for (const raw of result.rawItems) {
      if (++processed % 50 === 0) await new Promise((r) => setImmediate(r));
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
  { query: "hdfc credit card", vertical: "creditcards" },
  { query: "best credit card", vertical: "creditcards" },
  { query: "iphone", vertical: "ecommerce" },
  { query: "pizza", vertical: "food", city: "Indore" },
  { query: "delhi to jaipur", vertical: "bus" },
  { query: "goa", vertical: "hotels" },
  { query: "savings account", vertical: "banking" },
  { query: "demat account", vertical: "banking" },
  // Owner 22 Oct: Best-in-Tech section must span laptops/TVs/appliances, not just
  // phones — warm those catalogues so the section always has fresh rows to show.
  { query: "laptop", vertical: "ecommerce" },
  { query: "smart tv", vertical: "ecommerce" },
  { query: "refrigerator", vertical: "ecommerce" },
  { query: "washing machine", vertical: "ecommerce" }
];
var DESTINATION_WARM = [
  { query: "Indore to Goa", vertical: "flights", city: "Indore" },
  { query: "goa", vertical: "hotels" },
  { query: "Indore to Mumbai", vertical: "flights", city: "Indore" },
  { query: "mumbai", vertical: "hotels" },
  { query: "Indore to Delhi", vertical: "flights", city: "Indore" },
  { query: "delhi", vertical: "hotels" },
  { query: "Indore to Jaipur", vertical: "flights", city: "Indore" },
  { query: "jaipur", vertical: "hotels" },
  { query: "Indore to Udaipur", vertical: "flights", city: "Indore" },
  { query: "udaipur", vertical: "hotels" },
  { query: "Indore to Bengaluru", vertical: "flights", city: "Indore" },
  { query: "bengaluru", vertical: "hotels" },
  { query: "Indore to Hyderabad", vertical: "flights", city: "Indore" },
  { query: "hyderabad", vertical: "hotels" },
  { query: "Indore to Srinagar", vertical: "flights", city: "Indore" },
  { query: "srinagar", vertical: "hotels" },
  { query: "Indore to Dubai", vertical: "flights", city: "Indore" },
  { query: "dubai", vertical: "hotels" },
  { query: "Indore to Bangkok", vertical: "flights", city: "Indore" },
  { query: "bangkok", vertical: "hotels" },
  { query: "Indore to Singapore", vertical: "flights", city: "Indore" },
  { query: "singapore", vertical: "hotels" },
  { query: "Indore to Shimla", vertical: "flights", city: "Indore" },
  { query: "shimla", vertical: "hotels" },
  // Owner 22 Oct (min 6 destination cards): wider candidate pool — every extra
  // destination still needs its own real fare + real hotel art before a card
  // renders; the rotation just keeps them fresh like the original twelve.
  { query: "Indore to Ahmedabad", vertical: "flights", city: "Indore" },
  { query: "ahmedabad", vertical: "hotels" },
  { query: "Indore to Pune", vertical: "flights", city: "Indore" },
  { query: "pune", vertical: "hotels" },
  { query: "Indore to Kochi", vertical: "flights", city: "Indore" },
  { query: "kochi", vertical: "hotels" },
  { query: "Indore to Varanasi", vertical: "flights", city: "Indore" },
  { query: "varanasi", vertical: "hotels" },
  { query: "Indore to Amritsar", vertical: "flights", city: "Indore" },
  { query: "amritsar", vertical: "hotels" },
  { query: "Indore to Lucknow", vertical: "flights", city: "Indore" },
  { query: "lucknow", vertical: "hotels" },
  { query: "Indore to Chandigarh", vertical: "flights", city: "Indore" },
  { query: "chandigarh", vertical: "hotels" },
  { query: "Indore to Dehradun", vertical: "flights", city: "Indore" },
  { query: "dehradun", vertical: "hotels" }
];
var destWarmCursor = 0;
async function keepWarmDestinations() {
  if (DESTINATION_WARM.length === 0) return;
  const slice = [];
  for (let i = 0; i < 2; i++) {
    slice.push(DESTINATION_WARM[(destWarmCursor + i) % DESTINATION_WARM.length]);
  }
  destWarmCursor = (destWarmCursor + 2) % DESTINATION_WARM.length;
  await warmRows(slice, "DestWarm");
}
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
    await new Promise((r2) => setImmediate(r2));
  }
  log.info(tag, `Warmer finished: ${ok}/${rows.length} queries warmed`);
}
async function bootWarm() {
  try {
    await purgeStaleBankingOffers();
    const store2 = getStore();
    const rows = await store2.query(
      `SELECT raw_query, COALESCE(detected_vertical, vertical) AS v, pincode, city
       FROM searches WHERE created_at > (NOW() - INTERVAL 7 DAY)
       GROUP BY raw_query, v, pincode, city
       ORDER BY COUNT(*) DESC LIMIT 6`
    ).catch(() => []);
    const seen = /* @__PURE__ */ new Set();
    const targets = [];
    const push = (r) => {
      const key = `${String(r.raw_query || r.query || "")}|${String(r.v || r.vertical || "")}`;
      if (!seen.has(key)) {
        seen.add(key);
        targets.push(r);
      }
    };
    (rows.length > 0 ? rows : []).forEach(push);
    SEED_QUERIES.forEach(push);
    log.info("Cron", `Boot-warm starting (${targets.length} queries: all vertical defaults + top searches, background)`);
    void warmRows(targets, "BootWarm");
  } catch (e) {
    log.warn("Cron", "Boot-warm skipped", { error: String(e?.message || e).slice(0, 100) });
  }
}
async function keepWarmDefaults() {
  await warmRows(SEED_QUERIES, "KeepWarm");
}
async function warmPass(limit, verticalFilter, forceSeed) {
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
  ).catch(() => []);
  const useSeed = forceSeed || rows.length === 0;
  if (useSeed) {
    log.info("Cron", `Warmer: pre-warming ${SEED_QUERIES.length} seed queries (fresh install / --seed)`);
    await warmRows(SEED_QUERIES, "Cron");
    return;
  }
  await warmRows(rows, "Cron");
}
async function main() {
  const args = process.argv.slice(2);
  const limit = Number((args.find((a) => a.startsWith("--limit=")) || "--limit=20").split("=")[1]);
  const verticalFilter = args.find((a) => a.startsWith("--vertical="))?.split("=")[1];
  const forceSeed = args.includes("--seed");
  const intervalArg = Number((args.find((a) => a.startsWith("--interval=")) || "--interval=0").split("=")[1]);
  const intervalMin = intervalArg > 0 ? intervalArg : process.env.CRON_INTERVAL_MIN ? Number(process.env.CRON_INTERVAL_MIN) : 0;
  await runMigrations();
  if (!intervalMin || !Number.isFinite(intervalMin) || intervalMin <= 0) {
    await warmPass(limit, verticalFilter, forceSeed);
    process.exit(0);
  }
  log.info("Cron", `Interval mode: warm pass every ${intervalMin} min (no recent queries falls back to seeds)`);
  await warmPass(limit, verticalFilter, forceSeed);
  setInterval(() => {
    warmPass(limit, verticalFilter, forceSeed).catch((e) => {
      log.warn("Cron", "Interval warm pass failed (will retry next tick)", { error: String(e?.message || e).slice(0, 150) });
    });
  }, intervalMin * 6e4);
}
var invokedAsScript = /cron/.test(String(process.argv[1] || ""));
if (invokedAsScript) {
  main().catch((e) => {
    log.error("Cron", "Warmer crashed", { error: String(e) });
    process.exit(1);
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  bootWarm,
  keepWarmDefaults,
  keepWarmDestinations
});
