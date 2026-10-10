var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// server/common/db.ts
var import_fs = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_promise = __toESM(require("mysql2/promise"), 1);

// server/common/settings.ts
var import_path = __toESM(require("path"), 1);
var settings = {
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
var dataDir = import_path.default.resolve(
  process.cwd(),
  process.env.DATA_DIR || (process.env.NODE_ENV === "test" ? `.data/test-${process.pid}` : ".data")
);

// server/common/logger.ts
var REDACT_KEYS = /api[-_]?key|secret|token|password|credential|authorization|bearer|session/i;
var SECRET_VALUE = "[REDACTED]";
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
var LEVELS = { debug: "DEBUG", info: "INFO", warn: "WARN", error: "ERROR" };
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
var log = {
  debug: (module2, message, meta) => {
    if (process.env.LOG_LEVEL === "debug") emit("debug", module2, message, meta);
  },
  info: (module2, message, meta) => emit("info", module2, message, meta),
  warn: (module2, message, meta) => emit("warn", module2, message, meta),
  error: (module2, message, meta) => emit("error", module2, message, meta)
};

// server/common/db.ts
function sanitizeBindParams(params) {
  return (params || []).map((p) => p === void 0 || typeof p === "number" && Number.isNaN(p) ? null : p);
}
var MysqlStore = class _MysqlStore {
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
var FileStore = class {
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
var store = null;
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

// server/affiliate/baseProvider.ts
var BaseAffiliateProvider = class {
  /** Capability-honest helper: providers without creds report and skip. */
  unconfigured() {
    return { offers: [], count: 0, warnings: [`${this.id}: credentials not configured (check .env)`] };
  }
};

// server/affiliate/providers/admitad.ts
var CATEGORY_MAP = [
  [/fashion|cloth|apparel/i, "fashion"],
  [/electronic|gadget|mobile|computer/i, "electronics"],
  [/travel|hotel|flight/i, "travel"],
  [/food|grocer|restaurant/i, "food"],
  [/beauty|cosmetic/i, "beauty"],
  [/home|furnish|kitchen/i, "home"],
  [/financ|bank|loan|credit|invest/i, "finance"],
  [/health|pharma|fitness|medic/i, "health"],
  [/education|course|learn/i, "education"],
  [/entertain|movie|game|music|stream/i, "entertainment"]
];
var AdmitadProvider = class extends BaseAffiliateProvider {
  constructor() {
    super(...arguments);
    this.id = "admitad";
    this.label = "Admitad";
    this.token = null;
  }
  isConfigured() {
    return Boolean(settings.admitad.clientId && settings.admitad.clientSecret);
  }
  tokenValid() {
    if (!this.token) return false;
    const ageSec = (Date.now() - this.token.fetchedAt) / 1e3;
    return ageSec < this.token.expires_in - 60;
  }
  async authenticate() {
    if (this.tokenValid()) return;
    if (!this.isConfigured()) throw new Error("admitad: ADMITAD_CLIENT_ID/ADMITAD_CLIENT_SECRET not set");
    const basic = Buffer.from(`${settings.admitad.clientId}:${settings.admitad.clientSecret}`).toString("base64");
    const res = await fetch(`${settings.admitad.baseUrl}/token/`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: settings.admitad.clientId,
        scope: settings.admitad.scope
      })
    });
    if (!res.ok) throw new Error(`admitad: token request failed (HTTP ${res.status})`);
    const j = await res.json();
    this.token = { access_token: j.access_token, expires_in: Number(j.expires_in || 300), fetchedAt: Date.now() };
    log.info("Affiliate", "Admitad OAuth2 token acquired", { expires_in: this.token.expires_in });
  }
  async apiGet(path3, params = {}) {
    await this.authenticate();
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${settings.admitad.baseUrl}${path3}${qs ? `?${qs}` : ""}`, {
      headers: { Authorization: `Bearer ${this.token.access_token}` }
    });
    if (res.status === 401) {
      this.token = null;
      await this.authenticate();
      return this.apiGet(path3, params);
    }
    if (!res.ok) throw new Error(`admitad: GET ${path3} failed (HTTP ${res.status})`);
    return res.json();
  }
  async fetchOffers(opts = {}) {
    if (!this.isConfigured()) return this.unconfigured();
    const maxOffers = opts.limit ?? 500;
    const maxPages = opts.pages ?? 5;
    const offers = [];
    const warnings = [];
    for (let page = 0; page < maxPages && offers.length < maxOffers; page++) {
      const j = await this.apiGet("/coupons/", { limit: Math.min(100, maxOffers - offers.length), offset: page * 100, region: "IN" });
      const results = j?.results || [];
      if (results.length === 0) break;
      for (const c of results) {
        try {
          offers.push(this.normalize(c));
        } catch (e) {
          warnings.push(`admitad: offer ${c?.id} skipped (${String(e).slice(0, 60)})`);
        }
      }
    }
    return { offers, count: offers.length, warnings };
  }
  /** Admitad coupon JSON → UnifiedAffiliateOffer. Only evidence-backed fields. */
  normalize(c) {
    const id = String(c.id ?? "");
    if (!id || !c.name) throw new Error("missing id/name");
    const frame = (c.frames || [])[0] || {};
    const rawCats = (c.categories || []).map((x) => String(x?.name || x)).concat(String(c.campaign?.category || ""));
    const type = /percent/i.test(String(frame.type || c.types?.[0]?.name_en || "")) ? "percentage" : /cashback/i.test(String(c.types?.[0]?.name_en || "")) ? "cashback" : /free.?ship|shipping/i.test(String(c.name)) ? "shipping" : frame.discount ? "flat" : "other";
    const expires = c.date_end ? new Date(String(c.date_end)) : null;
    return {
      network_source: "admitad",
      network_offer_id: id,
      merchant_name: String(c.campaign?.name || c.campaign?.site || "Unknown merchant"),
      merchant_logo: c.campaign?.image || null,
      title: String(c.name).slice(0, 500),
      description: c.description ? String(c.description).slice(0, 2e3) : null,
      coupon_code: c.code ? String(c.code) : Array.isArray(c.codewords) ? String(c.codewords[0]) : null,
      discount_value: frame.discount ? Number(frame.discount) : null,
      discount_type: type,
      affiliate_url: c.goto ? String(c.goto) : null,
      original_url: c.url || c.campaign?.site_url || null,
      categories: [...new Set(rawCats.map(this.mapCategory).filter(Boolean))],
      starts_at: c.date_start ? new Date(String(c.date_start)) : null,
      expires_at: expires,
      status: expires && expires.getTime() < Date.now() ? "expired" : "active",
      commission: c.campaign?.rate ? Number(String(c.campaign.rate).replace(/[^\d.]/g, "")) || null : null,
      commission_note: c.campaign?.rate ? String(c.campaign.rate) : null,
      raw: { campaign_id: c.campaign?.id, regions: c.regions }
    };
  }
  mapCategory(raw) {
    for (const [re, name] of CATEGORY_MAP) if (re.test(raw)) return name;
    return null;
  }
  async fetchCampaigns() {
    if (!this.isConfigured()) {
      log.warn("Affiliate", "Admitad campaigns skipped: not configured");
      return [];
    }
    const j = await this.apiGet("/advcampaigns/", { limit: 100, website: settings.admitad.websiteId });
    return (j?.results || []).map((r) => ({ id: r.id, name: r.name, site: r.site, status: r.status, categories: r.categories, gotolink: r.gotolink }));
  }
  async generateTrackingLink(targetUrl, subId) {
    await this.authenticate();
    if (settings.admitad.websiteId && settings.admitad.defaultCampaignId) {
      const u2 = new URL(`${settings.admitad.baseUrl.replace("api.", "ad.")}/deeplink/${settings.admitad.websiteId}/advcampaign/${settings.admitad.defaultCampaignId}/`);
      u2.searchParams.set("ulp", targetUrl);
      if (subId) u2.searchParams.set("subid", subId);
      return u2.toString();
    }
    const u = new URL(targetUrl);
    if (subId) u.searchParams.set("subid", subId);
    return u.toString();
  }
};

// server/affiliate/providers/vcommission.ts
var VCommissionProvider = class extends BaseAffiliateProvider {
  constructor() {
    super(...arguments);
    this.id = "vcommission";
    this.label = "VCommission";
    this.campaigns = [];
  }
  isConfigured() {
    return Boolean(settings.vcommission.enabled);
  }
  tokenValid() {
    return this.campaigns.length > 0;
  }
  async authenticate() {
    const res = await fetch(`${settings.vcommission.baseUrl}/publisher/campaigns?apiKey=${settings.vcommission.apiKey}`);
    if (!res.ok) throw new Error(`vcommission: campaigns HTTP ${res.status}`);
    const j = await res.json();
    this.campaigns = Array.isArray(j.data) ? j.data : [];
  }
  async fetchOffers(_opts = {}) {
    if (!this.isConfigured()) return this.unconfigured();
    if (!this.tokenValid()) await this.authenticate();
    const offers = this.campaigns.map((c) => this.normalize(c));
    return { offers, count: offers.length, warnings: [] };
  }
  normalize(c) {
    const cats = String(c.category || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    return {
      network_source: "vcommission",
      network_offer_id: String(c.campaign_id ?? c.id ?? ""),
      merchant_name: String(c.name || "VCommission merchant").slice(0, 255),
      merchant_logo: c.logo || null,
      title: String(c.name || "").slice(0, 500),
      description: c.description ? String(c.description).slice(0, 2e3) : null,
      coupon_code: null,
      discount_value: null,
      discount_type: "cashback",
      affiliate_url: c.link ? String(c.link) : c.url ? String(c.url) : null,
      original_url: c.url ? String(c.url) : null,
      categories: cats,
      starts_at: null,
      expires_at: null,
      status: "active",
      commission: Number(String(c.payout || "").replace(/[^\d.]/g, "")) || null,
      commission_note: c.payout || null,
      raw: { tracking: c.tracking || null }
    };
  }
  async fetchCampaigns() {
    if (!this.tokenValid()) await this.authenticate();
    return this.campaigns;
  }
  async generateTrackingLink(targetUrl, subId) {
    const c = this.campaigns.find((x) => x.link && String(x.link) === targetUrl) || this.campaigns.find((x) => x.url === targetUrl);
    const base = c?.link ? String(c.link) : targetUrl;
    const u = new URL(base);
    if (subId) u.searchParams.set("sub_id", subId);
    return u.toString();
  }
};

// server/affiliate/providers/cuelinks.ts
var CuelinksProvider = class extends BaseAffiliateProvider {
  constructor() {
    super(...arguments);
    this.id = "cuelinks";
    this.label = "Cuelinks";
  }
  isConfigured() {
    return Boolean(settings.cuelinks?.enabled);
  }
  tokenValid() {
    return false;
  }
  // TODO: cache Cuelinks JWT after /authenticate
  async authenticate() {
    throw new Error("cuelinks: adapter pending publisher approval");
  }
  async fetchOffers() {
    return this.unconfigured();
  }
  async fetchCampaigns() {
    return [];
  }
  async generateTrackingLink(targetUrl, subId) {
    const u = new URL(targetUrl);
    if (subId) u.searchParams.set("sub_id", subId);
    return u.toString();
  }
};

// server/affiliate/providers/optimise.ts
var OptimiseProvider = class extends BaseAffiliateProvider {
  constructor() {
    super(...arguments);
    this.id = "optimise";
    this.label = "Optimise Media";
  }
  isConfigured() {
    return false;
  }
  // TODO: OPTIMISE_API_KEY in settings + .env
  tokenValid() {
    return false;
  }
  async authenticate() {
    throw new Error("optimise: adapter pending publisher approval");
  }
  async fetchOffers() {
    return this.unconfigured();
  }
  async fetchCampaigns() {
    return [];
  }
  async generateTrackingLink(targetUrl, subId) {
    const u = new URL(targetUrl);
    if (subId) u.searchParams.set("sub_id", subId);
    return u.toString();
  }
};

// server/affiliate/providers/directMerchant.ts
var DirectMerchantProvider = class extends BaseAffiliateProvider {
  constructor() {
    super(...arguments);
    this.id = "direct";
    this.label = "Direct Merchant Feed";
    this.pending = [];
  }
  // TODO: CSV/webhook ingestion queue
  isConfigured() {
    return false;
  }
  // enabled per-merchant after B2B onboarding
  tokenValid() {
    return false;
  }
  async authenticate() {
  }
  async fetchOffers() {
    return { offers: this.pending, count: this.pending.length, warnings: [] };
  }
  async fetchCampaigns() {
    return [];
  }
  async generateTrackingLink(targetUrl, subId) {
    const u = new URL(targetUrl);
    if (subId) u.searchParams.set("sub_id", subId);
    return u.toString();
  }
};

// server/affiliate/store.ts
var COLS = "network_source, network_offer_id, merchant_name, merchant_logo, title, description, coupon_code, discount_value, discount_type, affiliate_url, original_url, categories, starts_at, expires_at, status, commission_note";
function iso(d) {
  return d ? new Date(d).toISOString().slice(0, 19).replace("T", " ") : null;
}
async function upsertOffers(offers) {
  const store2 = getStore();
  let n = 0;
  for (const o of offers) {
    const existing = await store2.query(
      "SELECT id FROM affiliate_offers WHERE network_source = ? AND network_offer_id = ?",
      [o.network_source, o.network_offer_id]
    );
    if (existing.length > 0) {
      await store2.execute(
        `UPDATE affiliate_offers SET title = ?, description = ?, coupon_code = ?, discount_value = ?, discount_type = ?,
         affiliate_url = ?, original_url = ?, categories = ?, starts_at = ?, expires_at = ?, status = ?, merchant_logo = ?, commission_note = ?, last_seen_at = NOW()
         WHERE network_source = ? AND network_offer_id = ?`,
        sanitizeBindParams([
          o.title,
          o.description ?? null,
          o.coupon_code ?? null,
          o.discount_value ?? null,
          o.discount_type ?? null,
          o.affiliate_url ?? null,
          o.original_url ?? null,
          (o.categories || []).join(","),
          iso(o.starts_at),
          iso(o.expires_at),
          o.status,
          o.merchant_logo ?? null,
          o.commission_note ?? null,
          o.network_source,
          o.network_offer_id
        ])
      );
    } else {
      await store2.execute(
        `INSERT INTO affiliate_offers (${COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        sanitizeBindParams([
          o.network_source,
          o.network_offer_id,
          o.merchant_name,
          o.merchant_logo ?? null,
          o.title,
          o.description ?? null,
          o.coupon_code ?? null,
          o.discount_value ?? null,
          o.discount_type ?? null,
          o.affiliate_url ?? null,
          o.original_url ?? null,
          (o.categories || []).join(","),
          iso(o.starts_at),
          iso(o.expires_at),
          o.status,
          o.commission_note ?? null
        ])
      );
    }
    n += 1;
  }
  return n;
}
async function expirePastOffers() {
  const store2 = getStore();
  const r = await store2.execute(
    `UPDATE affiliate_offers SET status = 'expired' WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < NOW()`,
    []
  );
  return r.affectedRows || 0;
}

// server/affiliate/aggregator.ts
var PROVIDERS = [
  new VCommissionProvider(),
  // already live
  new AdmitadProvider(),
  // activates when ADMITAD_* env vars are set
  new CuelinksProvider(),
  new OptimiseProvider(),
  new DirectMerchantProvider()
];
function dedupOffers(offers) {
  const byKey = /* @__PURE__ */ new Map();
  for (const o of offers) {
    const compound = `${o.network_source}|${o.network_offer_id}`;
    if (!byKey.has(compound)) byKey.set(compound, o);
  }
  const smart = /* @__PURE__ */ new Map();
  for (const o of byKey.values()) {
    if (!o.coupon_code) continue;
    const key = `${o.merchant_name.toLowerCase()}|${o.coupon_code.toLowerCase()}`;
    const prev = smart.get(key);
    if (!prev || (o.commission ?? 0) > (prev.commission ?? 0)) smart.set(key, o);
  }
  return [...byKey.values()].filter((o) => {
    if (!o.coupon_code) return true;
    const winner = smart.get(`${o.merchant_name.toLowerCase()}|${o.coupon_code.toLowerCase()}`);
    return winner ? winner.network_source === o.network_source && winner.network_offer_id === o.network_offer_id : true;
  });
}
async function syncAllAffiliates(opts = {}) {
  await runMigrations();
  const outcomes = await Promise.all(PROVIDERS.map(async (p) => {
    try {
      if (!p.isConfigured()) return { provider: p.id, ok: true, offers: 0, error: "not configured (skipped)" };
      const res = await p.fetchOffers({ limit: opts.limit });
      const upserted = await upsertOffers(dedupOffers(res.offers));
      for (const w of res.warnings) log.warn("Affiliate", w);
      return { provider: p.id, ok: true, offers: upserted };
    } catch (e) {
      log.warn("Affiliate", `Sync failed for ${p.id} (isolated)`, { error: String(e?.message || e).slice(0, 160) });
      return { provider: p.id, ok: false, offers: 0, error: String(e?.message || e).slice(0, 160) };
    }
  }));
  const expired = await expirePastOffers();
  log.info("Affiliate", "Sync complete", { outcomes, expired });
  return outcomes;
}

// server/cron/affiliateSync.ts
async function main() {
  await runMigrations();
  const outcomes = await syncAllAffiliates();
  const ok = outcomes.filter((o) => o.ok).length;
  log.info("Cron", "Affiliate sync finished", { ok, total: outcomes.length, outcomes });
  process.exit(0);
}
main().catch((e) => {
  log.error("Cron", "Affiliate sync crashed", { error: String(e) });
  process.exit(1);
});
