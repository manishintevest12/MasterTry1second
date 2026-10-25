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

    http_version = str(req.get("httpVersion") or "").strip()

    seed_cookies = req.get("cookies") or {}
    return_cookies = bool(req.get("returnCookies"))
    return_headers = bool(req.get("returnHeaders"))

    def _seed_domain(url: str) -> str:
        """Seed cookies on the registrable domain of the request URL (e.g. .bigbasket.com)."""
        try:
            from urllib.parse import urlparse
            host = (urlparse(url).hostname or "").split(".")
            return "." + ".".join(host[-2:]) if len(host) >= 2 else "." + ".".join(host)
        except Exception:
            return ""

    try:
        with cffi_requests.Session(impersonate=impersonate) as s:
            if isinstance(seed_cookies, dict) and seed_cookies:
                dom = _seed_domain(url)
                for k, v in seed_cookies.items():
                    try:
                        s.cookies.set(str(k), str(v), domain=dom)
                    except Exception:
                        pass
            kw = {}
            if http_version == "1.1":
                # Goibibo (Akamai) intermittently resets HTTP/2 streams from
                # datacenter IPs; the same pages serve fine over HTTP/1.1.
                try:
                    from curl_cffi import CurlHttpVersion
                    kw["http_version"] = CurlHttpVersion.V1_1
                except Exception:
                    pass
            if method == "POST":
                r = s.post(url, headers=headers, data=body, timeout=timeout, **kw)
            else:
                r = s.get(url, headers=headers, timeout=timeout, **kw)
            out = {"ok": True, "status": int(r.status_code), "body": r.text}
            if return_cookies:
                try:
                    out["cookies"] = {k: str(v) for k, v in s.cookies.get_dict().items()}
                except Exception:
                    out["cookies"] = {}
            if return_headers:
                try:
                    # Response headers for flows that mint tokens in headers
                    # (e.g. Air India /flight-information/v1/auth/token -> x-access-token).
                    out["headers"] = {str(k): str(v) for k, v in r.headers.items()}
                except Exception:
                    out["headers"] = {}
        print(json.dumps(out))
    except Exception as exc:
        print(json.dumps({"ok": False, "error": f"{type(exc).__name__}: {exc}"}))


if __name__ == "__main__":
    main()
