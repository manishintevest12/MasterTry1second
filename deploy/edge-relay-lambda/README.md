# Edge Relay — deploy guide (AWS Lambda preferred, Cloudflare Worker fallback)

## Why this exists

Some sources gate our production datacenter IPs (403 / Akamai behavioral
challenge / tiny stub pages). The server ALWAYS tries direct curl_cffi first;
only when that is **gated** does it replay the identical request through this
relay pool, which egresses from a different IP with Chrome impersonation.

Server side is already wired (commit *Edge relay layer*): no app or website
change is needed, ever. You just deploy a relay and set two env vars.

Preference order is fixed: **AWS Lambda first, Cloudflare Worker second.**

## Path A — AWS Lambda (recommended)

### 0. One-time: create the Lambda execution role

```bash
aws iam create-role --role-name try1second-edge-relay-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name try1second-edge-relay-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### 1. Deploy

Run from a machine with `docker` + `aws` CLI logged in (AWS CloudShell works):

```bash
cd deploy/edge-relay-lambda
RELAY_TOKEN="$(openssl rand -hex 24)" AWS_REGION=ap-south-1 ./deploy.sh
```

Choose the region closest to your users/sources (`ap-south-1` = Mumbai is a good
default for Indian sites). The script builds the container, pushes to ECR,
creates/updates the Lambda, opens a Function URL, and prints:

```
EDGE_RELAY_AWS_URL=https://xxxxx.lambda-url.ap-south-1.on.aws/
EDGE_RELAY_AWS_TOKEN=<the token you generated>
```

### 2. Turn it on in production

hPanel → Node app → **Environment Variables**:

```
EDGE_RELAY_AWS_URL=https://xxxxx.lambda-url.ap-south-1.on.aws/
EDGE_RELAY_AWS_TOKEN=<same token>
```

Restart the Node app. That's it — Uber, Rapido, Booking.com, Hotels.com,
Expedia, MakeMyTrip and Goibibo now auto-escalate to Lambda when gated.

## Path B — Cloudflare Worker (secondary, zero-docker)

```bash
cd deploy/edge-relay-cloudflare
npx wrangler deploy            # first run asks you to log in
npx wrangler secret put RELAY_TOKEN
```

Then set in hPanel:

```
EDGE_RELAY_CF_URL=https://try1second-edge-relay.<your-subdomain>.workers.dev/
EDGE_RELAY_CF_TOKEN=<same secret>
```

Note: a Worker egresses from Cloudflare IPs and cannot reproduce curl_cffi's TLS
fingerprint, so it beats some gates but not all. That is exactly why Lambda is
preferred and tried first.

## Verify

```bash
# from your laptop (public)
curl -s -X POST "$EDGE_RELAY_AWS_URL" -H "x-relay-token: $EDGE_RELAY_AWS_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"url":"https://m.uber.com/looking","impersonate":"chrome"}'
```

Admin view of relay health (login required):
`GET /api/admin/relay/health`

## Tuning / kill switch

| Env var | Meaning |
|---|---|
| `EDGE_RELAY_HOSTS` | CSV override of which hosts may escalate (default: the 7 named gated sources) |
| `EDGE_RELAY_DISABLE=1` | Force direct-only (instant kill switch) |
| `RELAY_TOKEN` (Lambda/Worker side) | Shared secret; must match the `EDGE_RELAY_*_TOKEN` in hPanel |
| `RELAY_MEM`, `RELAY_TIMEOUT` | Lambda memory/timeout during deploy (defaults 2048 MB / 60 s) |

## Cost

Lambda is pay-per-request (~1M free requests/month on the free tier) and only
runs when a source is actually gated, so normal traffic costs nothing.
