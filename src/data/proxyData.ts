import { ResidentialProxyConfig } from '../types';

export const INITIAL_RESIDENTIAL_PROXIES: ResidentialProxyConfig[] = [
  {
    id: 'prx-in-01',
    host: 'in-res.brightdata.com',
    port: 22225,
    username: 't1s_customer_in_delhi',
    password: '••••••••••••',
    protocol: 'http',
    provider: 'Bright Data',
    country: 'IN',
    city: 'New Delhi',
    status: 'active',
    latencyMs: 118,
    successRate: 99.4,
    requestsCount: 4210,
    lastUsedAt: '2s ago',
    failCount: 0,
  },
  {
    id: 'prx-in-02',
    host: 'in.smartproxy.com',
    port: 10000,
    username: 'sp_res_india_session',
    password: '••••••••••••',
    protocol: 'http',
    provider: 'Smartproxy',
    country: 'IN',
    city: 'Bengaluru',
    status: 'active',
    latencyMs: 134,
    successRate: 98.9,
    requestsCount: 3890,
    lastUsedAt: '4s ago',
    failCount: 1,
  },
  {
    id: 'prx-in-03',
    host: 'pr.oxylabs.io',
    port: 7777,
    username: 'customer-try1second-cc-in',
    password: '••••••••••••',
    protocol: 'https',
    provider: 'Oxylabs',
    country: 'IN',
    city: 'Mumbai',
    status: 'active',
    latencyMs: 142,
    successRate: 99.1,
    requestsCount: 5120,
    lastUsedAt: '12s ago',
    failCount: 0,
  },
  {
    id: 'prx-in-04',
    host: 'p.webshare.io',
    port: 80,
    username: 'ws_india_residential_pool',
    password: '••••••••••••',
    protocol: 'socks5',
    provider: 'Webshare',
    country: 'IN',
    city: 'Hyderabad',
    status: 'active',
    latencyMs: 165,
    successRate: 97.6,
    requestsCount: 2980,
    lastUsedAt: '25s ago',
    failCount: 2,
  },
  {
    id: 'prx-in-05',
    host: 'geo.iproyal.com',
    port: 12321,
    username: 'royal_res_in_chennai',
    password: '••••••••••••',
    protocol: 'http',
    provider: 'IPRoyal',
    country: 'IN',
    city: 'Chennai',
    status: 'cooldown',
    latencyMs: 310,
    successRate: 94.2,
    requestsCount: 1840,
    lastUsedAt: '3m ago',
    failCount: 4,
  },
];

/**
 * Bulk parse proxies from raw string (supports standard formats):
 * host:port:user:pass
 * http://user:pass@host:port
 */
export function parseBulkProxies(text: string): Omit<ResidentialProxyConfig, 'id'>[] {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const results: Omit<ResidentialProxyConfig, 'id'>[] = [];

  for (const line of lines) {
    try {
      if (line.includes('@')) {
        // e.g. http://user:pass@host:port
        const url = new URL(line);
        results.push({
          host: url.hostname,
          port: parseInt(url.port || '80', 10),
          username: url.username || undefined,
          password: url.password || undefined,
          protocol: (url.protocol.replace(':', '') as any) || 'http',
          provider: 'Custom',
          country: 'IN',
          status: 'active',
          latencyMs: Math.floor(110 + Math.random() * 90),
          successRate: 99.0,
          requestsCount: 0,
          failCount: 0,
        });
      } else if (line.includes(':')) {
        const parts = line.split(':');
        if (parts.length >= 2) {
          results.push({
            host: parts[0],
            port: parseInt(parts[1], 10),
            username: parts[2] || undefined,
            password: parts[3] || undefined,
            protocol: 'http',
            provider: 'Custom',
            country: 'IN',
            status: 'active',
            latencyMs: Math.floor(120 + Math.random() * 80),
            successRate: 99.0,
            requestsCount: 0,
            failCount: 0,
          });
        }
      }
    } catch {
      // ignore invalid line
    }
  }

  return results;
}
