"""MODULE 2 — GENERIC SELF-HEALING ENGINE (pure browserless reverse engineering).

When a target platform ships a new bundle and its internal API moves
(403/404/schema validation failure), DynamicScannerEngine:

    1. silently hits the root landing domain with the hardened session;
    2. parses the HTML with BeautifulSoup and enumerates <script src> assets,
       filtering for production bundles (main|app|index|chunk + per-company
       allowlist);
    3. downloads each minified JS bundle as plain text (size-capped);
    4. applies the company's regex_healing_rules plus generic patterns to
       extract fresh base URLs, path-routing arrays and internal API shapes;
    5. writes the winning endpoint back to the config cache immediately
       (store.save_scraper_config + record_heal) and returns a HealingReport.

No browser, no driver, no fingerprint leaks — only static code analysis.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin

try:
    from bs4 import BeautifulSoup
except ImportError:  # pragma: no cover
    BeautifulSoup = None  # type: ignore

from .core import COMPANY_DOMAINS, ConfigStore, ScraperConfig
from .http_client import BrowserlessSession

log = logging.getLogger("try1second.scanner")

# Generic fallback rules: every serious Indian platform's bundle leaks
# absolute API hosts and quoted path fragments like "/api/v3/search".
GENERIC_HEALING_PATTERNS: List[Dict[str, object]] = [
    {"pattern": r'https?://[a-z0-9.-]*%(domain)s/[a-zA-Z0-9/_.?=&-]+', "priority": 10,
     "kind": "absolute_url"},
    {"pattern": r'["\']/(api|v\d+)/[a-zA-Z0-9/_-]{2,80}["\']', "priority": 6,
     "kind": "path_fragment"},
    {"pattern": r'["\']([a-z0-9-]+\.%(tld)s(?:/[a-zA-Z0-9/_-]*)?)["\']', "priority": 4,
     "kind": "host_hint"},
]

DEFAULT_HEALING_RULES: List[Dict[str, object]] = [
    # Example company rule (abhibus): the services endpoint family is stable,
    # only the version token drifts — capture the whole family.
    {"pattern": r'/buslist/v\d+/services', "priority": 20, "kind": "path_fragment"},
    {"pattern": r'/wap/[A-Za-z]+', "priority": 12, "kind": "path_fragment"},
]


@dataclass
class HealingReport:
    company_slug: str
    healed: bool
    old_endpoint: str
    new_endpoint: Optional[str] = None
    bundles_scanned: int = 0
    candidates: List[str] = field(default_factory=list)
    rules_matched: List[str] = field(default_factory=list)


class DynamicScannerEngine:
    """Static-JS self-healing scanner. One engine serves all 10 verticals:
    hotels, flights, ecommerce, grocery, bus, cab, movies, food, loans,
    insurance — only scraper_configs rows differ."""

    def __init__(self, session: BrowserlessSession, store: ConfigStore,
                 max_bundles: int = 4) -> None:
        self.session = session
        self.store = store
        self.max_bundles = max_bundles

    # ------------------------------------------------------------------ public
    def heal(self, company_slug: str) -> HealingReport:
        domain = COMPANY_DOMAINS.get(company_slug)
        if not domain:
            return HealingReport(company_slug, False, "")
        config = self.store.get_scraper_config(company_slug) or ScraperConfig(
            company_slug=company_slug, api_endpoint=f"https://{domain}/")
        report = HealingReport(company_slug, False, config.api_endpoint)

        bundles = self._discover_bundles(domain, config)
        report.bundles_scanned = len(bundles)
        if not bundles:
            log.warning("heal(%s): no JS bundles discovered", company_slug)
            return report

        candidates, rules_used = self._extract_candidates(domain, bundles, config)
        report.candidates = candidates[:10]
        report.rules_matched = rules_used
        winner = self._pick_winner(candidates, config)
        if winner and winner != config.api_endpoint:
            report.new_endpoint = winner
            report.healed = True
            config.api_endpoint = winner
            config.status = "active"
            config.consecutive_failures = 0
            self.store.save_scraper_config(config)
            self.store.record_heal(company_slug, winner, rules_used)
            log.info("heal(%s): %s -> %s", company_slug, report.old_endpoint, winner)
        else:
            # Honest outcome: no fresh endpoint found in static analysis.
            config.status = "blocked"
            self.store.save_scraper_config(config)
        return report

    # ---------------------------------------------------------------- internal
    def _discover_bundles(self, domain: str, config: ScraperConfig) -> List[str]:
        """Root landing page -> <script src> assets filtered by keywords."""
        root_url = f"https://{domain}/"
        try:
            status, html = self.session.get(root_url, expect_json=False, max_bytes=2_000_000)
        except Exception as exc:
            log.warning("heal: root fetch failed for %s: %s", domain, exc)
            return []
        if status != 200 or BeautifulSoup is None:
            return self._regex_script_srcs(html, root_url, config)
        soup = BeautifulSoup(html, "html.parser")
        srcs = [s.get("src") for s in soup.find_all("script") if s.get("src")]
        return self._filter_bundles(srcs, root_url, domain, config)

    @staticmethod
    def _regex_script_srcs(html: str, root_url: str, config: ScraperConfig) -> List[str]:
        """BS4-free fallback: raw regex over src="..." attributes."""
        raw = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html)
        return DynamicScannerEngine._filter_bundles(raw, root_url, COMPANY_DOMAINS.get(
            config.company_slug, ""), config)

    def _filter_bundles(self, srcs: List[str], root_url: str, domain: str,
                        config: ScraperConfig) -> List[str]:
        seen, out = set(), []
        allow = set(config.js_bundle_allowlist if hasattr(config, "js_bundle_allowlist") else set())
        keywords = config.target_js_keywords
        for src in srcs:
            url = urljoin(root_url, src)
            name = url.rsplit("/", 1)[-1].lower()
            if allow and not any(a.lower() in name for a in allow):
                continue
            if not any(k.lower() in name for k in keywords):
                continue
            if not url.startswith("https://") or url in seen:
                continue
            # Same-origin or known CDN only — never download third-party junk.
            if domain not in url and "cdn" not in url:
                continue
            seen.add(url)
            out.append(url)
            if len(out) >= self.max_bundles:
                break
        return out

    def _extract_candidates(self, domain: str, bundles: List[str],
                             config: ScraperConfig) -> Tuple[List[str], List[str]]:
        """Download each bundle as plain text and regex-scan it for API
        structures. Company rules run first (highest priority), then generic."""
        rules: List[Tuple[int, str, str]] = []
        for r in list(config.regex_healing_rules) + list(DEFAULT_HEALING_RULES) \
                + list(GENERIC_HEALING_PATTERNS):
            pattern = str(r.get("pattern", "")).replace(
                "%(domain)s", re.escape(domain)).replace(
                "%(tld)s", domain.rsplit(".", 1)[-1])
            rules.append((int(r.get("priority", 1)), pattern, str(r.get("kind", ""))))

        scored: Dict[str, int] = {}
        matched_rules: List[str] = []
        for url in bundles:
            try:
                _, js = self.session.get(url, expect_json=False,
                                         max_bytes=config.max_bundle_bytes)
            except Exception as exc:
                log.debug("bundle fetch failed %s: %s", url, exc)
                continue
            for priority, pattern, kind in sorted(rules, reverse=True):
                rx = re.compile(pattern, re.IGNORECASE)
                for m in rx.finditer(js):
                    cand = (m.group(1) if m.lastindex and kind == "host_hint"
                            else m.group(0)).strip("\"'")
                    cand = self._normalize(cand, domain)
                    if cand:
                        scored[cand] = max(scored.get(cand, 0), priority)
                        if pattern not in matched_rules:
                            matched_rules.append(pattern)
        # Highest priority first; stable sort keeps discovery order.
        ranked = [c for c, _ in sorted(scored.items(), key=lambda kv: -kv[1])]
        return ranked, matched_rules

    @staticmethod
    def _normalize(cand: str, domain: str) -> Optional[str]:
        cand = cand.strip().rstrip("/")
        if not cand:
            return None
        if cand.startswith("/"):
            return f"https://{domain}{cand}"
        if cand.startswith("https://"):
            return cand
        if "." in cand and not cand.startswith("http"):   # bare host hint
            return f"https://{cand}"
        return None

    @staticmethod
    def _pick_winner(candidates: List[str], config: ScraperConfig) -> Optional[str]:
        """Choose the candidate most likely to be the drifted endpoint.
        Preference order (the OLD endpoint itself is always excluded — a
        stale remnant of it usually still sits inside the bundle):
          1. same path family as the old endpoint (e.g. /buslist/...) but newer;
          2. any /api/ or /vN/ shaped candidate;
          3. first remaining candidate.
        """
        old = config.api_endpoint
        fresh = [c for c in candidates if c != old]
        if not fresh:
            return None

        def family(u: str) -> str:
            m = re.search(r"https?://[^/]+/([a-z0-9_-]+)", u)
            return (m.group(1) if m else "").lower()

        fam_old = family(old)
        same_family = [c for c in fresh if fam_old and family(c) == fam_old]
        if same_family:
            return same_family[0]
        api_shaped = [c for c in fresh if re.search(r"/(api|v\d+)/", c)]
        if api_shaped:
            return api_shaped[0]
        return fresh[0]
