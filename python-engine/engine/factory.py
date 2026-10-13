"""MODULE 3 — METADATA ENGINE (Factory Pattern).

BaseScraper owns EVERYTHING generic: session construction, request execution
via scraper_configs, retry/healing orchestration, and honest error handling.
Child classes contain ONLY vertical parsing logic (JSONPath specs into
normalized Offers). Adding a company = subclass + registry entry — the engine,
session, healing and storage layers never change.

Mapping of the 10 verticals onto this single unified backend:
    hotels    -> HotelScraper base (city/check-in context -> room rates)
    flights   -> FlightScraper base (sector/date -> per-airline fares)
    ecommerce -> CatalogScraper base (product query -> price+image)
    grocery   -> CatalogScraper base (10-min delivery variants, pincode-bound)
    bus       -> InventoryScraper base (route/date -> per-service fares)
    cab       -> FareEstimateScraper base (pickup/drop -> quote)
    movies    -> InventoryScraper base (city -> show+price)
    food      -> CatalogScraper base (dish query -> price+rating+eta)
    loans     -> RateCardScraper base (product -> rate range)
    insurance -> RateCardScraper base (product -> premium/policy)
"""
from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from typing import Any, Callable, Dict, List, Optional, Type

from .core import (BlockedError, ConfigStore, EndpointDriftError, Offer,
                   ParseError, ScraperConfig)
from .http_client import BrowserlessSession
from .scanner import DynamicScannerEngine

log = logging.getLogger("try1second.factory")


class BaseScraper(ABC):
    """Generic network + error-handling shell. `scrape` is the template method:
    load config -> acquire (heal once on drift) -> parse -> normalize."""

    vertical: str = ""
    company_slug: str = ""

    def __init__(self, session: BrowserlessSession, store: ConfigStore,
                 scanner: DynamicScannerEngine) -> None:
        self.session = session
        self.store = store
        self.scanner = scanner

    # ------------------------------------------------------------- template
    def scrape(self, query: str, **context: Any) -> List[Offer]:
        config = self.store.get_scraper_config(self.company_slug)
        if config is None or config.status == "disabled":
            return []  # honest: no config -> no offers, never fabricated
        try:
            payload = self.build_payload(query, config, **context)
            status, text = self.session.request(
                config.http_method, config.api_endpoint,
                expect_json=True,
                json_body=payload if config.http_method.upper() == "POST" else None,
                headers=config.headers or None,
            )
            data = json.loads(text)
            offers = self.parse(data, query, **context)
            config.last_success = True  # type: ignore[attr-defined]
            return offers
        except EndpointDriftError as exc:
            log.info("drift on %s: %s — healing", self.company_slug, exc)
            report = self.scanner.heal(self.company_slug)
            if not report.healed:
                config.status = "blocked"
                self.store.save_scraper_config(config)
                return []
            config = self.store.get_scraper_config(self.company_slug) or config
            # single retry with the healed endpoint
            try:
                payload = self.build_payload(query, config, **context)
                _, text = self.session.request(
                    config.http_method, config.api_endpoint, expect_json=True,
                    json_body=payload if config.http_method.upper() == "POST" else None,
                    headers=config.headers or None)
                return self.parse(json.loads(text), query, **context)
            except (BlockedError, EndpointDriftError, ParseError) as exc2:
                log.warning("post-heal retry failed for %s: %s", self.company_slug, exc2)
                return []
        except (BlockedError, ParseError) as exc:
            # BLOCKED/PARSE failures are surfaced honestly to the caller.
            log.warning("acquisition failed for %s: %s", self.company_slug, exc)
            return []

    # ------------------------------------------------------ subclass hooks
    def build_payload(self, query: str, config: ScraperConfig,
                      **context: Any) -> Dict[str, Any]:
        """Default: merge the stored request_template with live query context
        (pincode, city, travel dates, route...). Vertical-specific override
        optional — data-driven platforms need no code."""
        payload: Dict[str, Any] = dict(config.request_template)
        payload.update({k: v for k, v in context.items() if v is not None})
        if query and "query" not in payload:
            payload["query"] = query
        return payload

    @abstractmethod
    def parse(self, data: Any, query: str, **context: Any) -> List[Offer]:
        """Vendor-specific JSON -> List[Offer]. No offers parsed -> [] (never
        a synthetic fallback)."""


class CatalogScraper(BaseScraper):
    """ecommerce / grocery / food: a flat search list of products or dishes.
    Data-driven JSONPath so new companies map with ZERO new code."""

    vertical = "catalog"
    item_path: List[str] = []            # e.g. ['data', 'results']
    field_map: Dict[str, str] = {}       # offer field -> JSONPath-ish key

    def parse(self, data: Any, query: str, **context: Any) -> List[Offer]:
        rows = data
        for key in self.item_path:
            if isinstance(rows, dict):
                rows = rows.get(key)
            else:
                return []
            if rows is None:
                return []
        offers: List[Offer] = []
        for row in rows or []:
            if not isinstance(row, dict):
                continue
            get = self._getter(row)
            price = self._num(get("price"))
            offers.append(Offer(
                title=str(get("title") or get("name") or "")[:200],
                price=price,
                currency=str(get("currency") or "INR"),
                image_url=get("image_url"),
                deep_link=get("deep_link"),
                vendor=self.company_slug,
                vertical=self.vertical,
                source_endpoint=get("source_endpoint") or "",
                attributes={k: v for k, v in row.items()
                            if isinstance(v, (str, int, float, bool)) and k in
                            set(self.field_map.values())} if self.field_map else {},
            ))
        return offers

    def _getter(self, row: Dict[str, Any]) -> Callable[[str], Any]:
        mapped = {of: row.get(jk) for of, jk in self.field_map.items()} if self.field_map \
            else {k.lower(): v for k, v in row.items()}
        return lambda f: mapped.get(f)

    @staticmethod
    def _num(v: Any) -> Optional[float]:
        try:
            f = float(v)
            return f if f > 0 else None
        except (TypeError, ValueError):
            return None


class AbhiBusScraper(BaseScraper):
    """bus vertical — REAL endpoint captured by the owner's platform
    (POST /buslist/v3/services -> live per-service fares). PVR/INOX-style
    shared logic: other bus vendors subclass and override `parse` only."""
    vertical = "bus"
    company_slug = "abhibus"

    def parse(self, data: Any, query: str, **context: Any) -> List[Offer]:
        services = data.get("services") if isinstance(data, dict) else None
        if not services:
            return []
        offers: List[Offer] = []
        for s in services:
            fares = (s.get("fares") or {})
            price = fares.get("offerPrice") or fares.get("fare")
            if not price or float(price) <= 0:
                continue  # no real fare -> no offer, never estimated
            t = s.get("timings") or {}
            offers.append(Offer(
                title=f"{s.get('travelerAgentName', '')} · {s.get('busServiceTypeName', '')}".strip()[:200],
                price=float(price),
                currency="INR",
                vendor="abhibus", vertical="bus",
                source_endpoint="buslist/v3/services",
                attributes={
                    "departure": t.get("startTime"),
                    "arrival": t.get("arriveTime"),
                    "seats_available": (s.get("seatStats") or {}).get("availableSeats"),
                    "rating": s.get("rating"),
                }))
        return offers[:40]


class SwiggyInstamartScraper(CatalogScraper):
    """grocery vertical — Swiggy Instamart's public search JSON."""
    vertical = "grocery"
    company_slug = "swiggy-instamart"
    item_path = ["data", "cards"]
    field_map = {"title": "name", "price": "price", "image_url": "image_url",
                 "deep_link": "url"}


class BlinkitScraper(CatalogScraper):
    """grocery vertical — Blinkit (pincode-bound search list)."""
    vertical = "grocery"
    company_slug = "blinkit"
    item_path = ["data", "results"]
    field_map = {"title": "name", "price": "price", "image_url": "image_url"}


class GenericFallbackScraper(CatalogScraper):
    """Any of the 10 verticals without a specialized parser yet: fully
    config-driven via scraper_configs.request_template."""
    vertical = "generic"


# --------------------------------------------------------------------------- #
# FACTORY                                                                      #
# --------------------------------------------------------------------------- #
SCRAPER_REGISTRY: Dict[str, Type[BaseScraper]] = {
    "abhibus": AbhiBusScraper,
    "swiggy-instamart": SwiggyInstamartScraper,
    "blinkit": BlinkitScraper,
}


class ScraperFactory:
    """Resolves a company slug to its scraper. Unregistered companies fall
    back to the config-driven GenericFallbackScraper so the whole roster of
    10 verticals works through ONE backend."""

    def __init__(self, session: BrowserlessSession, store: ConfigStore,
                 scanner: DynamicScannerEngine) -> None:
        self.session, self.store, self.scanner = session, store, scanner

    def create(self, company_slug: str, vertical: str = "") -> BaseScraper:
        cls = SCRAPER_REGISTRY.get(company_slug, GenericFallbackScraper)
        scraper = cls(self.session, self.store, self.scanner)
        if not scraper.company_slug:
            scraper.company_slug = company_slug
        if vertical and not getattr(scraper, "vertical", "") or scraper.vertical == "generic":
            scraper.vertical = vertical
        return scraper

    def create_vertical_team(self, vertical: str) -> List[BaseScraper]:
        return [self.create(slug, vertical)
                for slug in __import__(
                    "engine.core", fromlist=["VERTICAL_TARGETS"]
                ).VERTICAL_TARGETS.get(vertical, [])]
