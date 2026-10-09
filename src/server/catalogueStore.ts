import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { ComparisonItem, CplLead, ResidentialProxyConfig } from '../types';

export interface ProvenanceLog {
  id: string;
  itemId: string;
  sourceUrl: string;
  sourceDomain: string;
  sourceType: 'searchapi' | 'live_http' | 'curl_stealth' | 'partner_api' | 'cached_catalogue';
  httpStatus: number;
  fetchedAt: string;
  latencyMs: number;
  rawFingerprint?: string;
  locationContext?: string;
}

export interface CatalogueDatabaseState {
  items: ComparisonItem[];
  leads: CplLead[];
  proxies: ResidentialProxyConfig[];
  provenanceLogs: ProvenanceLog[];
  searchApiConfig: {
    apiKey: string;
    isEnabled: boolean;
  };
  lastSavedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const CATALOGUE_FILE = path.join(DATA_DIR, 'catalogue.json');

// MySQL Pool (lazily initialized if DATABASE_URL or MYSQL_URL is available)
let mysqlPool: mysql.Pool | null = null;

export function getMysqlPool(): mysql.Pool | null {
  if (mysqlPool) return mysqlPool;
  const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
  if (!dbUrl) return null;

  try {
    mysqlPool = mysql.createPool({
      uri: dbUrl,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 5000,
    });
    console.log('[CatalogueStore] Initialized native MySQL connection pool from environment');
    return mysqlPool;
  } catch (err: any) {
    console.warn('[CatalogueStore] Failed to create MySQL pool, falling back to persistent file store:', err.message);
    return null;
  }
}

// In-Memory cache backed by local disk and optional MySQL
let memoryState: CatalogueDatabaseState = {
  items: [],
  leads: [],
  proxies: [],
  provenanceLogs: [],
  searchApiConfig: {
    apiKey: process.env.SEARCHAPI_API_KEY || '',
    isEnabled: Boolean(process.env.SEARCHAPI_API_KEY),
  },
  lastSavedAt: new Date().toISOString(),
};

// Initialize Catalogue from disk or initialize directory
export function initCatalogueStore(): CatalogueDatabaseState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(CATALOGUE_FILE)) {
      const raw = fs.readFileSync(CATALOGUE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      memoryState = {
        items: Array.isArray(parsed.items) ? parsed.items : [],
        leads: Array.isArray(parsed.leads) ? parsed.leads : [],
        proxies: Array.isArray(parsed.proxies) ? parsed.proxies : [],
        provenanceLogs: Array.isArray(parsed.provenanceLogs) ? parsed.provenanceLogs : [],
        searchApiConfig: {
          apiKey: process.env.SEARCHAPI_API_KEY || parsed.searchApiConfig?.apiKey || '',
          isEnabled: Boolean(process.env.SEARCHAPI_API_KEY || parsed.searchApiConfig?.isEnabled),
        },
        lastSavedAt: parsed.lastSavedAt || new Date().toISOString(),
      };
      console.log(`[CatalogueStore] Loaded ${memoryState.items.length} items from persistent catalogue.`);
    } else {
      // First boot: create empty file
      saveCatalogueStore(memoryState);
      console.log('[CatalogueStore] Initialized brand-new persistent catalogue file.');
    }
  } catch (err: any) {
    console.error('[CatalogueStore] Error during catalogue store init:', err.message);
  }

  // Attempt async MySQL sync table creation if pool is available
  syncWithMysqlSchema().catch(() => {});

  return memoryState;
}

export function saveCatalogueStore(state: Partial<CatalogueDatabaseState>): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    memoryState = {
      ...memoryState,
      ...state,
      lastSavedAt: new Date().toISOString(),
    };

    fs.writeFileSync(CATALOGUE_FILE, JSON.stringify(memoryState, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[CatalogueStore] Error saving persistent catalogue to disk:', err.message);
  }
}

export function getCatalogueState(): CatalogueDatabaseState {
  return memoryState;
}

export function saveItemToCatalogue(item: ComparisonItem): void {
  const existingIdx = memoryState.items.findIndex((i) => i.id === item.id);
  if (existingIdx >= 0) {
    memoryState.items[existingIdx] = item;
  } else {
    memoryState.items.unshift(item);
  }
  // Cap at 1000 items in catalogue
  if (memoryState.items.length > 1000) {
    memoryState.items = memoryState.items.slice(0, 1000);
  }
  saveCatalogueStore({ items: memoryState.items });
}

export function recordProvenance(log: ProvenanceLog): void {
  memoryState.provenanceLogs.unshift(log);
  if (memoryState.provenanceLogs.length > 500) {
    memoryState.provenanceLogs = memoryState.provenanceLogs.slice(0, 500);
  }
  saveCatalogueStore({ provenanceLogs: memoryState.provenanceLogs });
}

export function updateSearchApiKey(apiKey: string): void {
  memoryState.searchApiConfig = {
    apiKey,
    isEnabled: Boolean(apiKey.trim()),
  };
  saveCatalogueStore({ searchApiConfig: memoryState.searchApiConfig });
}

async function syncWithMysqlSchema(): Promise<void> {
  const pool = getMysqlPool();
  if (!pool) return;

  try {
    const conn = await pool.getConnection();
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS try1second_catalogue (
          id VARCHAR(128) PRIMARY KEY,
          vertical VARCHAR(64) NOT NULL,
          title TEXT NOT NULL,
          category VARCHAR(128),
          provider VARCHAR(128),
          primary_price DECIMAL(10,2) NOT NULL,
          original_price DECIMAL(10,2),
          rating DECIMAL(3,2),
          review_count INT DEFAULT 0,
          payload_json LONGTEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_vertical (vertical)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await conn.query(`
        CREATE TABLE IF NOT EXISTS try1second_provenance (
          id VARCHAR(128) PRIMARY KEY,
          item_id VARCHAR(128) NOT NULL,
          source_url TEXT NOT NULL,
          source_domain VARCHAR(128) NOT NULL,
          source_type VARCHAR(64) NOT NULL,
          http_status INT NOT NULL,
          latency_ms INT DEFAULT 0,
          location_context VARCHAR(128),
          fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_item (item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      console.log('[CatalogueStore] MySQL persistent tables verified & synchronized.');
    } finally {
      conn.release();
    }
  } catch (err: any) {
    console.warn('[CatalogueStore] MySQL table sync skipped:', err.message);
  }
}
