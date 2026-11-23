# Try1Second render service (our own scraper API)

A paid per-call proxy (ScraperAPI) exists for one job: load a page in a real browser from a clean IP and hand back
the HTML. That is this service. Running it ourselves removes the per-call bill; the app reaches it through the
rescue ladder's `own` rung, which runs **before** any paid rung.

## Why we need it

Measured on production 22 Nov 2026, from our egress:

| Partner | What the edge answers |
|---|---|
| `goibibo.com` hotels | `200` with an **8-byte** Akamai stub (sensor cookie required) |
| `hermes.goibibo.com` | `403` |
| `booking.com/searchresults` | `202` DataDome/AWS-WAF challenge page |
| `m.goibibo.com` | `503` |

No header set or TLS impersonation defeats those; a real browser session does. So both mandated partners
(Goibibo + Booking.com) stay dark until a browser-backed fetch exists. This service is that fetch.

## Option A — Cloudflare Browser Rendering (no server to run, free tier)

1. Cloudflare dashboard → **Workers & Pages → Browser Rendering**, create an API token with *Browser Rendering: Edit*.
2. Set in the app's panel:
   - `CF_ACCOUNT_ID` = your Cloudflare account id
   - `CF_BROWSER_TOKEN` = the token
3. Restart. The `own` rung calls `browser-rendering/content` directly; nothing else to deploy.

## Option B — this service on a small VPS / Fly / Railway

```bash
# on the box (Ubuntu 22.04+, 1 vCPU / 1 GB is enough for 2 concurrent pages)
sudo apt-get update && sudo apt-get install -y docker.io
docker build -t t1s-render .
docker run -d --restart=always -p 8099:8099 \
  -e RENDER_TOKEN='<long-random-secret>' \
  -e RENDER_CONCURRENCY=2 \
  t1s-render
```

Then in the app's panel:

- `T1S_RENDER_URL=https://render.your-domain.tld`  (or `http://<vps-ip>:8099`)
- `T1S_RENDER_TOKEN=<the same secret>`

Restart the app. The ladder logs `Rescued ... via own` when it works.

## API

`POST /render` (bearer token when `RENDER_TOKEN` is set)

```json
{ "url": "https://www.booking.com/searchresults.html?ss=Goa&checkin=2026-11-25&checkout=2026-11-26",
  "timeoutMs": 30000, "waitUntil": "networkidle2", "scroll": true }
```

→ `{ "ok": true, "status": 200, "html": "<!doctype html>…", "ms": 4120 }`

`GET /health` → `{ "ok": true, "active": 0, "maxConcurrent": 2 }`

## Safety

- Bearer token required (`RENDER_TOKEN`); the service refuses to start unauthenticated traffic when the token is set.
- SSRF guard: only public `http(s)` URLs; loopback, RFC1918, `.local`/`.internal` and IPv6 private ranges refused.
- Images/fonts/media blocked inside the page (bandwidth only, never the prices we parse), body capped at 6 MB.
- Concurrency cap (`RENDER_CONCURRENCY`, default 2) answers `429 busy` instead of pegging the box; the app's ladder
  then falls through to its other rungs.
- Hard timeout per request (`RENDER_TIMEOUT_MS`, default 30 s).
