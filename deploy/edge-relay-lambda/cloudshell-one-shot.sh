#!/usr/bin/env bash
# Try1Second Edge Relay — ONE-SHOT deploy in AWS CloudShell.
#
# HOW: AWS Console -> CloudShell (region: ap-south-1 / Mumbai) -> paste this
# whole file -> Enter. It writes the Lambda container, deploys it, and prints
# the two hPanel env vars at the end. Nothing to install locally.
set -euo pipefail
REGION="${AWS_REGION:-ap-south-1}"
export AWS_DEFAULT_REGION="$REGION"
FN="try1second-edge-relay"
REPO="try1second-edge-relay"
TOKEN="$(openssl rand -hex 24)"
WORK="$HOME/t1s-edge-relay"

mkdir -p "$WORK" && cd "$WORK"

cat > handler.py <<'HANDLER_EOF'
"""
Try1Second Edge Relay — AWS Lambda handler (container image).

A dumb, authenticated pipe: it replays an HTTP request from a DIFFERENT egress
IP with Chrome TLS impersonation (curl_cffi), and returns the raw response.

Request (POST JSON):
  { "url": "...", "method": "GET|POST", "headers": {...}, "body": "...",
    "impersonate": "chrome", "timeoutSec": 25, "httpVersion": "1.1" }

Response (JSON):
  { "status": 200, "body": "...", "headers": {...} }   # or { "error": "..." }

Auth: header `x-relay-token` must equal env RELAY_TOKEN (when RELAY_TOKEN is set).

Deploy: see README.md in this folder.
"""
import base64
import json
import os

from curl_cffi import requests as cffi_requests

MAX_BODY = 6 * 1024 * 1024  # keep well under the Function URL response cap


def _resp(status, payload):
    return {
        "statusCode": 200,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(payload),
    }


def lambda_handler(event, context):
    # Function URL payloads arrive as a JSON string in `body`.
    if isinstance(event, dict) and "body" in event and isinstance(event.get("body"), str):
        try:
            body_json = json.loads(event["body"])
        except Exception:
            return _resp(400, {"error": "invalid json body"})
        headers_in = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    else:
        body_json = event or {}
        headers_in = {}

    token = os.environ.get("RELAY_TOKEN", "")
    if token and headers_in.get("x-relay-token") != token:
        return _resp(401, {"error": "unauthorized"})

    url = str(body_json.get("url") or "")
    if not url.startswith(("http://", "https://")):
        return _resp(400, {"error": "url required"})

    method = str(body_json.get("method") or "GET").upper()
    req_headers = body_json.get("headers") or {}
    req_body = body_json.get("body")
    impersonate = str(body_json.get("impersonate") or "chrome")
    timeout = max(3, min(int(body_json.get("timeoutSec") or 25), 55))
    http_version = body_json.get("httpVersion")

    kwargs = {
        "headers": req_headers,
        "timeout": timeout,
        "impersonate": impersonate,
        "allow_redirects": True,
    }
    if http_version == "1.1":
        kwargs["http_version"] = cffi_requests.CurlHttpVersion.V1_1

    try:
        if method == "POST":
            r = cffi_requests.post(url, data=req_body, **kwargs)
        else:
            r = cffi_requests.get(url, **kwargs)
    except Exception as e:  # noqa: BLE001 — the caller decides what a failure means
        return _resp(200, {"error": f"{type(e).__name__}: {str(e)[:200]}"})

    try:
        text = r.text
    except Exception:
        text = base64.b64encode(r.content).decode("ascii")

    return _resp(200, {
        "status": r.status_code,
        "body": text[:MAX_BODY],
        "headers": {k: v for k, v in r.headers.items()},
    })
HANDLER_EOF

cat > Dockerfile <<'DOCKER_EOF'
# Try1Second Edge Relay — AWS Lambda (container image)
#
# curl_cffi ships native code, so a container image is the reliable Lambda
# packaging (no manylinux wheel juggling). Build & push with deploy.sh.
FROM public.ecr.aws/lambda/python:3.12

# curl_cffi: Chrome/Safari TLS impersonation inside Lambda
RUN pip install --no-cache-dir "curl_cffi==0.13.0"

COPY handler.py ${LAMBDA_TASK_ROOT}/

# 2048 MB gives ~1 vCPU+ and fast TLS handshakes; raise for more concurrency.
CMD ["handler.lambda_handler"]
DOCKER_EOF

echo "==> IAM role"
if ! aws iam get-role --role-name try1second-edge-relay-role >/dev/null 2>&1; then
  aws iam create-role --role-name try1second-edge-relay-role \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  aws iam attach-role-policy --role-name try1second-edge-relay-role \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole >/dev/null
  sleep 12
fi
ROLE_ARN="$(aws iam get-role --role-name try1second-edge-relay-role --query Role.Arn --output text)"

echo "==> ECR"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
ECR="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"
aws ecr describe-repositories --repository-names "$REPO" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "$REPO" >/dev/null

echo "==> docker build + push"
docker build --platform linux/amd64 -t "${REPO}:latest" . >/dev/null
aws ecr get-login-password | docker login --username AWS --password-stdin "$ECR" >/dev/null
docker tag "${REPO}:latest" "${ECR}/${REPO}:latest"
docker push "${ECR}/${REPO}:latest" >/dev/null

echo "==> lambda"
if aws lambda get-function --function-name "$FN" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$FN" --image-uri "${ECR}/${REPO}:latest" >/dev/null
  aws lambda wait function-updated --function-name "$FN"
  aws lambda update-function-configuration --function-name "$FN" \
    --timeout 60 --memory-size 2048 --environment "Variables={RELAY_TOKEN=${TOKEN}}" >/dev/null
else
  aws lambda create-function --function-name "$FN" --package-type Image \
    --code "ImageUri=${ECR}/${REPO}:latest" --role "$ROLE_ARN" \
    --timeout 60 --memory-size 2048 --environment "Variables={RELAY_TOKEN=${TOKEN}}" >/dev/null
  aws lambda wait function-active --function-name "$FN"
fi

echo "==> Function URL"
URL="$(aws lambda get-function-url-config --function-name "$FN" --query FunctionUrl --output text 2>/dev/null || true)"
if [ -z "${URL:-}" ] || [ "${URL:-}" = "None" ]; then
  URL="$(aws lambda create-function-url-config --function-name "$FN" --auth-type NONE --query FunctionUrl --output text)"
  aws lambda add-permission --function-name "$FN" --statement-id FunctionURLAllowPublicAccess \
    --action lambda:InvokeFunctionUrl --principal '*' --function-url-auth-type NONE >/dev/null 2>&1 || true
fi

echo "==> smoke test"
curl -s -X POST "$URL" -H "x-relay-token: ${TOKEN}" -H 'content-type: application/json' \
  -d '{"url":"https://m.uber.com/looking","impersonate":"chrome"}' | head -c 160; echo

cat <<EOF

============================================================
DONE. Paste these two into hPanel -> Node app -> Environment Variables:

EDGE_RELAY_AWS_URL=${URL}
EDGE_RELAY_AWS_TOKEN=${TOKEN}

Then restart the Node app. No app/website build needed.
============================================================
EOF
