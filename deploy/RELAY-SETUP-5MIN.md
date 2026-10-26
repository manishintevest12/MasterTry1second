# Relay setup — 5 minutes, no coding

You do **not** have `EDGE_RELAY_AWS_URL` / `EDGE_RELAY_AWS_TOKEN` yet because the
relay has never been deployed. Those values are created **by the deploy**, they
are not something you look up. Pick one of the two paths below.

The server already supports both; it uses whichever you configure (AWS first).

---

## Path 1 — Cloudflare Worker (free, no credit card, 3 minutes)

Fastest. Workers egress from Cloudflare IPs. Cannot reproduce curl_cffi's TLS
fingerprint, so it beats some gates but not all — use it now, add Lambda later.

1. Sign up free: https://dash.cloudflare.com/sign-up
2. Left menu → **Workers & Pages** → **Create** → **Worker** → name it
   `try1second-edge-relay` → **Deploy**.
3. Click **Edit code**, delete everything, paste the contents of
   `deploy/edge-relay-cloudflare/worker.js` → **Deploy**.
4. Back on the worker page → **Settings** → **Variables and Secrets** →
   **Add** → type **Secret**:
   - Name: `RELAY_TOKEN`
   - Value: any long random string (generate one, e.g. 40+ chars) — keep a copy
5. Copy the worker URL shown at the top, e.g.
   `https://try1second-edge-relay.yourname.workers.dev/`
6. hPanel → Node app → **Environment Variables**, add:

```
EDGE_RELAY_CF_URL=https://try1second-edge-relay.yourname.workers.dev/
EDGE_RELAY_CF_TOKEN=<the RELAY_TOKEN you generated>
```

7. Restart the Node app. Done — gated sources now retry through the Worker.

Test it from your laptop:

```bash
curl -s -X POST "https://try1second-edge-relay.yourname.workers.dev/" \
  -H "x-relay-token: YOUR_TOKEN" -H 'content-type: application/json' \
  -d '{"url":"https://m.uber.com/looking"}'
```

Expect JSON with `"status": 200` and a big `body`.

---

## Path 2 — AWS Lambda (preferred egress, 5 minutes, needs an AWS account)

Real Chrome TLS fingerprint inside Lambda (curl_cffi). Zone/bot managers that
block Cloudflare's egress often let Lambda through, so this is the strong leg.

You need an AWS account (free tier is fine; signup asks for a card for identity
verification, you are not charged for this usage level).

1. Log in to AWS → set region **ap-south-1 (Mumbai)** (top-right selector).
2. Open **CloudShell** (search "CloudShell" in the top bar).
3. Open the file `deploy/edge-relay-lambda/cloudshell-one-shot.sh` from your repo,
   copy **the whole file**, paste it into CloudShell, press Enter.
4. Wait ~3-4 minutes. It creates the IAM role, ECR repo, container image,
   Lambda function, Function URL, runs a smoke test, and finally prints:

```
EDGE_RELAY_AWS_URL=https://xxxxx.lambda-url.ap-south-1.on.aws/
EDGE_RELAY_AWS_TOKEN=<random secret>
```

5. hPanel → Node app → **Environment Variables**, add both lines exactly as
   printed, then restart the Node app.

---

## Which sources use it

Policy (server-side, no app change): `uber.com`, `rapido.bike`, `booking.com`,
`hotels.com`, `expedia.com`, `makemytrip.com`, `goibibo.com`.

Direct fetch is always tried first. Relay is used **only** when the direct
response is a gate (403/429/503, Akamai/Cloudflare challenge, tiny stub page) or
the fetch itself fails. Normal traffic therefore costs nothing extra.

## If something looks off

| Symptom | Check |
|---|---|
| Relay not being used at all | hPanel env vars set? Node restarted? `EDGE_RELAY_DISABLE` not `1`? |
| 401 from relay | `EDGE_RELAY_*_TOKEN` must equal the relay's `RELAY_TOKEN` |
| 404 from relay | URL must be the full `.../workers.dev/` or Lambda URL ending in `/` |
| Still empty results | `GET /api/admin/relay/health` (logged in as admin) — shows legs, breaker state, escalation counts |

## Kill switch

Set `EDGE_RELAY_DISABLE=1` in hPanel and restart: everything goes back to
direct-only instantly, no deploy needed.
