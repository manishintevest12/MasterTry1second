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
import os
import random
import time
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlsplit

from .core import BlockedError, EndpointDriftError, ParseError

log = logging.getLogger("try1second.http")

try:  # curl_cffi is the engine's only hard transport dependency
    from curl_cffi import requests as cffi_requests  # type: ignore
    _CURL_CFFI = True
except ImportError:  # pragma: no cover - CI without curl_cffi uses injectable fetch
    cffi_requests = None  # type: ignore
    _CURL_CFFI = False

IMPERSONATION_POOL = ("chrome", "chrome124", "chrome123", "edge101")

# OWNER RULE (self-healing, 21 Oct): a source that breaks must repair itself before the
# owner reports it. Live evidence 28 Oct (bus vertical): ixigo, yatra and makemytrip all
# failed with "curl: (28) Resolving timed out after 12000 milliseconds" — the HOST's
# resolver was saturated/flaky, not the sites. Three of five mandated bus sources
# vanished from every comparison because of a resolver hiccup.
#
# Fix: when a request dies on name resolution, retry the SAME request over DNS-over-HTTPS
# (libcurl resolves the name through an HTTPS endpoint instead of getaddrinfo), and
# remember the host so its later calls skip the broken resolver entirely for a while.
DOH_URL = os.environ.get("T1S_DOH_URL", "https://cloudflare-dns.com/dns-query").strip()
DOH_FALLBACK_URL = os.environ.get("T1S_DOH_FALLBACK_URL", "https://dns.google/dns-query").strip()
DNS_FAIL_TTL_SEC = float(os.environ.get("T1S_DNS_FAIL_TTL_SEC", "900"))


def is_dns_failure(exc: BaseException) -> bool:
    """True when a transport error is name resolution, not the site itself."""
    text = str(exc).lower()
    return any(
        marker in text
        for marker in (
            "resolving timed out",
            "could not resolve",
            "couldn't resolve host",
            "name or service not known",
            "temporary failure in name resolution",
            "getaddrinfo",
        )
    )


class BrowserlessSession:
    """Hardened session: Chrome-impersonated TLS, per-host pacing, retry with
    jittered backoff, response-size caps, and honest error classification."""

    def __init__(self, fetch: Optional[Any] = None) -> None:
        # `fetch` is injectable for unit tests (no network, deterministic).
        self._fetch = fetch or self._native_fetch
        # host -> epoch when the resolver last failed for it (self-healing memory).
        self._dns_failures: Dict[str, float] = {}
        self.doh_url = DOH_URL
        self.doh_fallback_url = DOH_FALLBACK_URL

    # -- DNS self-healing ----------------------------------------------------
    @staticmethod
    def _host_of(url: str) -> str:
        try:
            return (urlsplit(url).hostname or "").lower()
        except Exception:
            return ""

    def _dns_suspect(self, url: str) -> bool:
        host = self._host_of(url)
        if not host:
            return False
        failed_at = self._dns_failures.get(host)
        if not failed_at:
            return False
        if time.time() - failed_at > DNS_FAIL_TTL_SEC:
            self._dns_failures.pop(host, None)
            return False
        return True

    def _mark_dns_failure(self, url: str) -> None:
        host = self._host_of(url)
        if host:
            self._dns_failures[host] = time.time()

    def _mark_dns_ok(self, url: str) -> None:
        host = self._host_of(url)
        if host:
            self._dns_failures.pop(host, None)

    # -- transport -----------------------------------------------------------
    def _native_fetch(self, method: str, url: str, **kw: Any) -> Tuple[int, str]:
        if not _CURL_CFFI:
            raise RuntimeError("curl_cffi is not installed: pip install curl_cffi")
        impersonate = random.choice(IMPERSONATION_POOL)
        doh = kw.get("doh_url")
        with cffi_requests.Session(impersonate=impersonate) as s:
            r = s.request(method, url, timeout=kw.get("timeout", 20), **{
                k: v for k, v in kw.items() if k not in ("timeout", "doh_url")},
                **({"doh_url": doh} if doh else {}))
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
        # A host that already failed name resolution goes straight to DoH.
        use_doh = self._dns_suspect(url)
        for attempt in range(retries + 1):
            try:
                status, text = self._fetch(
                    method, url,
                    **({**kw_args, "doh_url": self.doh_url if use_doh else None}),
                )
            except BlockedError:
                raise
            except Exception as exc:  # transport-level: connection reset, TLS, DNS
                last_exc = exc
                if is_dns_failure(exc) and not use_doh:
                    # Resolver, not the site: retry immediately over DoH instead of
                    # paying another full DNS timeout. Never counted as a block.
                    log.warning("DNS failure on %s -> retrying over DoH", url)
                    self._mark_dns_failure(url)
                    use_doh = True
                    continue
                self._sleep_backoff(attempt)
                continue
            if use_doh:
                # Sticky for DNS_FAIL_TTL_SEC: the resolver just failed for this host, so
                # keep resolving over HTTPS instead of paying another 12s timeout on the
                # very next call. After the TTL a plain attempt probes it again, so the
                # session heals back to the normal fast path on its own.
                self._mark_dns_failure(url)
            else:
                self._mark_dns_ok(url)
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
