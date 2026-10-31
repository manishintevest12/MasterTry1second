# Try1Second API relay (Cloudflare Worker)

The app's API traffic goes **phone → Cloudflare → Hostinger**, so the resets the Hostinger
edge throws at Indian mobile carriers never reach the phone. Hostinger stays exactly as it is:
no DNS record, no nameserver and no hosting change, because a Worker answers on its own
`*.workers.dev` hostname.

## One-time setup (owner, ~2 minutes)

1. Sign up free at https://dash.cloudflare.com/sign-up (no card, no domain needed).
2. Copy the **Account ID** from the dashboard URL or the Workers page.
3. Create an API token: My Profile → API Tokens → Create Token → template
   **"Edit Cloudflare Workers"** (Account: Workers Scripts:Edit, Workers KV/Route:Edit).
4. Send both to the agent; it deploys the worker and sets `RELAY_KEY`.

## What gets deployed

`worker.js` forwards only `/api/*` and `/uploads/*` to `ORIGIN` (default
`https://www.try1second.com`), preserving method, body and headers, and retrying an upstream
reset up to 4 times with a fresh connection. `/__relay/health` proves it is alive.

## After deploy

The agent builds the app with `--dart-define=API_BASE=https://t1s-api-relay.<account>.workers.dev`
(already wired in `flutter_app/lib/core/api.dart`, `kDefaultApiBase`), so no UI or logic in the
app changes. Free plan covers 100,000 requests/day.

## Local check

```
node --check worker.js
npx wrangler dev            # then: curl localhost:8787/__relay/health
```

## If the relay is ever unwanted

`wrangler delete` (or delete the Worker in the dashboard). The app then needs one build with
`API_BASE=https://www.try1second.com` to go back to direct traffic.
