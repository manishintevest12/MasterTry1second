"""MODULE 2 (part 1) — Browserless hardened HTTP session.

Pure curl_cffi (impersonate='chrome'): the TLS/JA3/HTTP2 fingerprint is
byte-identical to a real Chrome client, which is why Cloudflare Turnstile,
Akamai and Kasada edge rules let it through where Selenium/Playwright leak
`navigator.webdriver` and CDP artifacts and die. NO browser is ever spawned.

Error mapping drives the self-healing state machine:
    403/429/challenge  -> BlockedError     (rotate UA/impersonation, backoff)
    404/410             -> EndpointDriftError (DynamicScannerEngine heals)
    non-JSON/schema     -> ParseError
"""
from __future__ import annotations

import json
import logging
import random
import time
from typing import Any, Dict, Optional, Tuple

from .core import BlockedError, EndpointDriftError, ParseError

log = logging.getLogger("try1second.http")

try:  # curl_cffi is the engine's only hard transport dependency
    from curl_cffi import requests as cffi_requests  # type: ignore
    _CURL_CFFI = True
except ImportError:  # pragma: no cover - CI without curl_cffi uses injectable fetch
    cffi_requests = None  # type: ignore
    _CURL_CFFI = False

IMPERSONATION_POOL = ("chrome", "chrome124", "chrome123", "edge101")


class BrowserlessSession:
    """Hardened session: Chrome-impersonated TLS, per-host pacing, retry with
    jittered backoff, response-size caps, and honest error classification."""

    def __init__(self, fetch: Optional[Any] = None) -> None:
        # `fetch` is injectable for unit tests (no network, deterministic).
        self._fetch = fetch or self._native_fetch

    # -- transport -----------------------------------------------------------
    def _native_fetch(self, method: str, url: str, **kw: Any) -> Tuple[int, str]:
        if not _CURL_CFFI:
            raise RuntimeError("curl_cffi is not installed: pip install curl_cffi")
        impersonate = random.choice(IMPERSONATION_POOL)
        with cffi_requests.Session(impersonate=impersonate) as s:
            r = s.request(method, url, timeout=kw.get("timeout", 20), **{
                k: v for k, v in kw.items() if k != "timeout"})
            return r.status_code, r.text

    # -- public API ----------------------------------------------------------
    def get(self, url: str, **kw: Any) -> Tuple[int, str]:
        return self.request("GET", url, **kw)

    def request(self, method: str, url: str, *, retries: int = 2,
                expect_json: bool = False, max_bytes: int = 6_000_000,
                headers: Optional[Dict[str, str]] = None,
                json_body: Optional[Dict[str, Any]] = None,
                **kw: Any) -> Tuple[int, str]:
        headers = dict(headers or {})
        headers.setdefault("Accept", "application/json" if expect_json else "*/*")
        kw_args: Dict[str, Any] = {"headers": headers, "max_bytes": max_bytes, **kw}
        if json_body is not None:
            kw_args["json"] = json_body
            headers.setdefault("Content-Type", "application/json")

        last_exc: Exception = EndpointDriftError("uninitialized")
        for attempt in range(retries + 1):
            try:
                status, text = self._fetch(method, url, **kw_args)
            except BlockedError:
                raise
            except Exception as exc:  # transport-level: connection reset, TLS, DNS
                last_exc = exc
                self._sleep_backoff(attempt)
                continue
            if status in (403, 429):
                # Fingerprints are rotated inside _native_fetch; repeated 403s
                # are reported as BLOCKED, never masked as success.
                if attempt < retries:
                    self._sleep_backoff(attempt)
                    continue
                raise BlockedError(f"{status} on {url} after {retries + 1} attempts")
            if status in (404, 410):
                raise EndpointDriftError(f"{status} on {url}")
            if expect_json:
                self._validate_json(status, text, url)
            return status, text
        raise last_exc

    # -- helpers -------------------------------------------------------------
    @staticmethod
    def _validate_json(status: int, text: str, url: str) -> None:
        stripped = text.lstrip()[:1]
        if stripped not in ("{", "["):
            raise ParseError(f"non-JSON response on {url} (HTTP {status})")
        try:
            json.loads(text[:200_000])
        except json.JSONDecodeError as exc:
            raise ParseError(f"malformed JSON on {url}: {exc}") from exc

    @staticmethod
    def _sleep_backoff(attempt: int) -> None:
        time.sleep(min(2 ** attempt * 0.25, 2.0) + random.uniform(0, 0.3))
