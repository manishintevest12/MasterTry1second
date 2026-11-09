/**
 * Try1Second — POST /mcp: a REAL Model Context Protocol endpoint (JSON-RPC 2.0 over HTTP).
 *
 * Owner 9 Nov: "Site exposes WebMCP tools to in-browser agents / MCP Server Card is published".
 * A card that points at a URL nobody answers is worse than no card, so this is the actual server the
 * card describes: initialize, tools/list and tools/call for `search_prices`, backed by the same search
 * pipeline the website uses (awaitSettledAnswer joins the in-flight pipeline; it never starts a
 * second scrape). Rows are returned as compact JSON: price, seller and the outbound link only.
 *
 * Nothing new is claimed: if the pipeline has no priced rows for the query, the tool answers with an
 * honest empty list plus the note the API itself uses.
 */
import { Response } from 'express';
import { awaitSettledAnswer } from '../search/searchOrchestrator';
import { MCP_TOOLS, SUMMARY, CONTACT_EMAIL } from './agentReady';
import { SEO_HOST } from './data';

const PROTOCOL_VERSION = '2025-06-18';
const PRICE_VERTICALS = new Set([
  'flights', 'hotels', 'bus', 'cab', 'cabs', 'ecommerce', 'grocery', 'food', 'movies', 'loans', 'insurance',
]);

type Json = Record<string, any>;

function ok(id: any, result: Json) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}
function fail(id: any, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

/** Run the real search and keep only what an agent needs. */
async function searchPrices(args: Json): Promise<Json> {
  const query = String(args?.query || '').trim();
  if (!query) throw new Error('query is required');
  const rawVertical = String(args?.vertical || 'ecommerce').toLowerCase();
  const vertical = (rawVertical === 'cabs' ? 'cab' : rawVertical) as any;
  if (!PRICE_VERTICALS.has(rawVertical)) {
    throw new Error(`Unsupported vertical "${rawVertical}". Use one of: ${[...PRICE_VERTICALS].join(', ')}`);
  }
  const depart = /^\d{4}-\d{2}-\d{2}$/.test(String(args?.depart || '')) ? String(args.depart) : undefined;
  const input: any = {
    query,
    vertical,
    city: String(args?.city || 'Indore'),
    pincode: String(args?.pincode || '452001'),
    ...(depart ? { travelDates: { depart } } : {}),
  };
  const res: any = await awaitSettledAnswer(input, 9000);
  const rows = Array.isArray(res?.results) ? res.results : [];
  const compact = rows.slice(0, 12).map((r: any) => ({
    title: String(r?.title || '').slice(0, 140),
    seller: String(r?.seller || r?.provider || (Array.isArray(r?.sellers) ? r.sellers[0]?.name : '') || ''),
    price: Number(r?.primaryPrice || (r?.prices && r.prices.effectivePrice) || 0) || 0,
    link: String(r?.sellers?.[0]?.url || r?.goUrl || ''),
  })).filter((r: any) => r.title);
  return {
    vertical,
    query,
    city: input.city,
    ...(depart ? { depart } : {}),
    count: compact.length,
    rows: compact,
    note: compact.length
      ? 'Live rows from the same pipeline the website uses. Prices are the seller’s own.'
      : 'No priced rows were available from live sources for this query just now. Try a fuller query (e.g. "Indore to Delhi") or another vertical.',
  };
}

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

async function callTool(name: string, args: Json): Promise<ToolResult> {
  if (name === 'search_prices') {
    try {
      const payload = await searchPrices(args || {});
      return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    } catch (e: any) {
      return { content: [{ type: 'text', text: `search_prices failed: ${e?.message || 'unknown error'}` }], isError: true };
    }
  }
  return { content: [{ type: 'text', text: `Unknown tool "${name}". Available: ${MCP_TOOLS.map((t) => t.name).join(', ')}` }], isError: true };
}

/** POST /mcp handler (JSON-RPC 2.0, single message or batch). */
export function registerMcpRoute(app: any): void {
  app.post('/mcp', async (req: any, res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    const body = req.body;
    const batch = Array.isArray(body);
    const messages: Json[] = batch ? body : [body];

    const handle = async (msg: Json): Promise<Json | null> => {
      const id = msg?.id;
      const method = String(msg?.method || '');
      // Notifications (no id) get no response body.
      if (id === undefined && method.startsWith('notifications/')) return null;
      if (method === 'initialize') {
        return ok(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'try1second', version: '1.0.0', title: 'Try1Second Price Search' },
          instructions: `${SUMMARY} Use search_prices with a vertical (flights|hotels|bus|cab|ecommerce|grocery|food|movies|loans|insurance). Contact: ${CONTACT_EMAIL}. Docs: ${SEO_HOST}/llms.txt`,
        });
      }
      if (method === 'ping') return ok(id, {});
      if (method === 'tools/list') {
        return ok(id, { tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) });
      }
      if (method === 'tools/call') {
        const name = String(msg?.params?.name || '');
        const args = (msg?.params?.arguments || {}) as Json;
        return ok(id, await callTool(name, args));
      }
      if (method === 'resources/list') return ok(id, { resources: [] });
      if (method === 'prompts/list') return ok(id, { prompts: [] });
      return fail(id, -32601, `Method not found: ${method}`);
    };

    try {
      if (batch) {
        const out: Json[] = [];
        for (const m of messages) {
          const r = await handle(m);
          if (r) out.push(r);
        }
        res.status(200).json(out);
        return;
      }
      const single = await handle(messages[0] || {});
      if (single === null) { res.status(202).end(); return; }
      res.status(200).json(single);
    } catch (e: any) {
      res.status(200).json(fail(messages[0]?.id ?? null, -32603, e?.message || 'internal error'));
    }
  });

  // A browser hitting /mcp directly should see what it is, not a 404.
  app.get('/mcp', (_req: any, res: Response) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      mcp: true,
      protocolVersion: PROTOCOL_VERSION,
      endpoint: `${SEO_HOST}/mcp`,
      method: 'POST JSON-RPC 2.0 (initialize, tools/list, tools/call)',
      tools: MCP_TOOLS.map((t) => t.name),
      card: `${SEO_HOST}/.well-known/mcp/server-card.json`,
    });
  });
}
