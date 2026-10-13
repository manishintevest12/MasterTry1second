#!/usr/bin/env python3
"""
curl_cffi stdio fetch helper (Try1Second browserless acquisition).

Reads one JSON request on stdin:
  {"url": "...", "method": "GET"|"POST", "headers": {...}, "body": "...",
   "impersonate": "safari17_0", "timeoutSec": 20}
Writes one JSON response on stdout:
  {"ok": true, "status": 200, "body": "..."} | {"ok": false, "error": "..."}

Why: Akamai fronting in.bookmyshow.com (and several other Indian platforms)
fingerprints the TLS ClientHello/HTTP2 stack. Node's undici/OpenSSL and plain
curl are blocked with 403 while curl_cffi's Chrome/Safari BoringSSL
impersonation passes. This helper keeps the acquisition pipeline 100%
browserless: no Selenium/Playwright, just a real-browser TLS fingerprint with
an honest HTTP JSON contract. Anti-bot WAFs are never solved or bypassed with
puzzles/CAPTCHAs — a hard block is reported as blocked, per owner policy.
"""
import json
import sys

import os


def _vendor_paths():
    """Shared-hosting friendly: no pip/root. Prebuilt manylinux wheels are vendored in
    python-vendor/ (shared curl_cffi + per-Python-version cffi backend)."""
    here = os.path.dirname(os.path.abspath(__file__))
    for root in (os.path.join(here, '..', '..', 'python-vendor'), os.path.join(os.getcwd(), 'python-vendor')):
        root = os.path.abspath(root)
        lib = os.path.join(root, 'lib_py%d%d' % sys.version_info[:2])
        if os.path.isdir(lib):
            return [lib, os.path.join(root, 'shared')]
    return []


_PROBE = len(sys.argv) > 1 and sys.argv[1] == '--probe'

try:
    from curl_cffi import requests as cffi_requests
    if _PROBE:
        print(json.dumps({"version": "%d.%d" % sys.version_info[:2], "cffi": True}))
        sys.exit(0)
except Exception:  # system install missing: fall back to the vendored wheels
    _err = None
    for _p in _vendor_paths():
        if _p not in sys.path:
            sys.path.insert(0, _p)
    try:
        from curl_cffi import requests as cffi_requests
        if _PROBE:
            print(json.dumps({"version": "%d.%d" % sys.version_info[:2], "cffi": True, "vendored": True}))
            sys.exit(0)
    except Exception as exc:  # pragma: no cover - deployment guard
        if _PROBE:
            print(json.dumps({"version": "%d.%d" % sys.version_info[:2], "cffi": False, "error": str(exc)[:160]}))
            sys.exit(0)
        print(json.dumps({"ok": False, "error": "curl_cffi not installed (python %d.%d, vendored: %s): %s" % (sys.version_info[0], sys.version_info[1], bool(_vendor_paths()), exc)}))
        sys.exit(0)


def main() -> None:
    try:
        req = json.loads(sys.stdin.read() or "{}")
    except Exception as exc:
        print(json.dumps({"ok": False, "error": f"bad request json: {exc}"}))
        return

    url = str(req.get("url") or "")
    if not url.startswith("https://"):
        print(json.dumps({"ok": False, "error": "only https urls allowed"}))
        return

    method = str(req.get("method") or "GET").upper()
    headers = {str(k): str(v) for k, v in (req.get("headers") or {}).items()}
    body = req.get("body")
    timeout = float(req.get("timeoutSec") or 20)
    impersonate = str(req.get("impersonate") or "safari17_0")

    try:
        with cffi_requests.Session(impersonate=impersonate) as s:
            if method == "POST":
                r = s.post(url, headers=headers, data=body, timeout=timeout)
            else:
                r = s.get(url, headers=headers, timeout=timeout)
        print(json.dumps({"ok": True, "status": int(r.status_code), "body": r.text}))
    except Exception as exc:
        print(json.dumps({"ok": False, "error": f"{type(exc).__name__}: {exc}"}))


if __name__ == "__main__":
    main()
