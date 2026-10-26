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
