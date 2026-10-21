/**
 * LinkInR affiliate campaign registry (owner sheet, 21 Oct 2026).
 *
 * The owner exported 169 LinkInR campaigns (campaign CSV with campaign_id,
 * inventory_id and per-campaign tracking links). OWNER RULE: use LinkInR
 * wherever the existing monetization is low or the merchant has no direct
 * partner, so affiliate links earn money. Direct partners (Amazon Associates,
 * Cuelinks-joined MakeMyTrip/Goibibo, admin affiliate_configs) resolve EARLIER
 * in buildSecureDeeplink and always win; this module monetizes everyone else.
 *
 * - The sheet ships with the repo at server/affiliate/linkinr/campaigns.csv and
 *   is parsed once at boot (self-contained, no API keys, shared-hosting safe).
 * - Tracking link format (verified live 302 -> CJ network):
 *   https://linkinr.com?campaign_id=<ID>&inventory_id=<inv>&sub_id1=<sub>
 * - LinkInR does NOT deep-link (&url= is ignored): the hop lands on the
 *   campaign's own destination. For merchants where we currently earn nothing
 *   that trade is worth it (owner's explicit call); deep-linked partners
 *   (Amazon/MMT/Goibibo) are untouched by priority order.
 * - Duplicate domains (Kotak811 x3, SBI Card x3): the campaign with the
 *   highest flat payout wins, deterministically.
 * - Kill switch: set LINKINR_ENABLED=0 in env to disable the layer.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

export interface LinkInRCampaign {
  id: string;
  name: string;
  type: string;              // CPS / CPL / CPA
  payout: string;            // raw sheet text, e.g. 'Flat ₹1900'
  payoutScore: number;       // parsed rupee/percent weight for dedupe
  inventoryId: string;
  destination: string;
  domain: string;
  categories: string;
}

let campaignByDomain: Map<string, LinkInRCampaign> | null = null;

/** Minimal RFC-4180 CSV parser (quoted fields, embedded commas/quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch === '\r') { /* skip */ }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** 'Flat ₹1900' -> 1900, 'Upto 8.64%' -> 8.64, unknown -> 0. Higher = better. */
function payoutScore(raw: string): number {
  const pct = /([\d.]+)\s*%/.exec(raw);
  if (pct) return Number(pct[1]) * 10;           // percent scored above flat fees
  const rs = /₹\s*([\d,.]+)/.exec(raw);
  if (rs) return Number(rs[1].replace(/,/g, ''));
  const any = /([\d.]+)/.exec(raw);
  return any ? Number(any[1]) : 0;
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

function loadRegistry(): Map<string, LinkInRCampaign> {
  if (campaignByDomain) return campaignByDomain;
  const map = new Map<string, LinkInRCampaign>();
  try {
    // Works under CJS (__dirname) AND ESM test runners (import.meta.url).
    const dir: string = (typeof (globalThis as any).__dirname === 'string')
      ? (globalThis as any).__dirname
      : path.dirname(fileURLToPath(import.meta.url));
    const csvPath = path.join(dir, 'campaigns.csv');
    const text = fs.readFileSync(csvPath, 'utf8');
    const rows = parseCsv(text);
    if (!rows.length) return (campaignByDomain = map);
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const col = (name: string) => header.indexOf(name);
    for (const r of rows.slice(1)) {
      const get = (i: number) => (i >= 0 && i < r.length ? r[i].trim() : '');
      const id = get(col('id'));
      const status = get(col('status')).toLowerCase();
      const access = get(col('campaign access')).toLowerCase();
      const dest = get(col('destination url'));
      if (!id || status !== 'active' || access !== 'yes' || !/^https?:\/\//.test(dest)) continue;
      const tracking = get(col('tracking link'));
      const inv = /inventory_id=([A-Za-z0-9_-]+)/.exec(tracking)?.[1] || '';
      const domain = domainOf(dest);
      if (!domain) continue;
      const c: LinkInRCampaign = {
        id,
        name: get(col('name')),
        type: get(col('type')),
        payout: get(col('payout')),
        payoutScore: payoutScore(get(col('payout'))),
        inventoryId: inv,
        destination: dest,
        domain,
        categories: get(col('categories')),
      };
      const prev = map.get(domain);
      if (!prev || c.payoutScore > prev.payoutScore) map.set(domain, c);
    }
  } catch { /* unreadable sheet -> empty registry, direct links stay honest */ }
  return (campaignByDomain = map);
}

export function linkinrEnabled(): boolean {
  return process.env.LINKINR_ENABLED !== '0';
}

/** Resolve the owner's LinkInR campaign for a destination URL's domain. */
export function linkinrCampaignFor(dest: string): LinkInRCampaign | null {
  const domain = domainOf(dest);
  if (!domain) return null;
  const m = loadRegistry();
  return m.get(domain) || m.get(domain.replace(/^[a-z0-9-]+\./, '')) || null;
}

/** Build the LinkInR tracking URL for a destination, or null when no campaign. */
export function linkinrTrackingUrl(dest: string): string | null {
  if (!linkinrEnabled()) return null;
  const c = linkinrCampaignFor(dest);
  if (!c) return null;
  const sub = process.env.LINKINR_SUB_ID || 'try1second';
  const click = crypto.randomBytes(4).toString('hex');
  return `https://linkinr.com?campaign_id=${encodeURIComponent(c.id)}&inventory_id=${encodeURIComponent(c.inventoryId)}&sub_id1=${encodeURIComponent(`${sub}-${click}`)}`;
}

/** Registry stats for admin/logging. */
export function linkinrStats(): { campaigns: number; domains: number; enabled: boolean } {
  const m = loadRegistry();
  return { campaigns: m.size, domains: m.size, enabled: linkinrEnabled() };
}
