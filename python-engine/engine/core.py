"""Core types, vertical registry and the config-store contract.

ALL 10 verticals map onto this single unified backend:
    hotels, flights, ecommerce, grocery, bus, cab, movies, food, loans, insurance
Every vertical-specific nuance lives in DATA (scraper_configs.request_template,
JSONPath specs on parser classes) — never in bespoke pipelines.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Protocol, runtime_checkable

# ---------------------------------------------------------------------------
# Exact target platforms per vertical (owner-mandated list).
# ---------------------------------------------------------------------------
VERTICAL_TARGETS: Dict[str, List[str]] = {
    "hotels":    ["makemytrip", "goibibo", "booking", "agoda", "yatra", "cleartrip"],
    "flights":   ["makemytrip", "easemytrip", "ixigo", "yatra", "cleartrip", "akasaair", "indigo"],
    "ecommerce": ["amazon", "flipkart", "meesho", "myntra", "ajio", "tatacliq"],
    "grocery":   ["blinkit", "zepto", "swiggy-instamart", "bigbasket", "flipkart-minutes"],
    "bus":       ["redbus", "abhibus", "makemytrip", "yatra", "ixigo"],
    "cab":       ["olacabs", "uber", "indrive", "meru", "fastdeals", "snap-e", "rapido"],
    "movies":    ["bookmyshow", "district", "paytm", "pvrinox", "cinepolis", "ticketnew"],
    "food":      ["zomato", "swiggy", "dominos", "ovenstory", "eatsure"],
    "loans":     ["paisabazaar", "bankbazaar", "policybazaar", "moneyview", "kreditbee", "navi"],
    "insurance": ["policybazaar", "ditto", "insurancedekho", "acko", "digit", "coverfox"],
}

# Exact production domains (single source of truth for the scanner + healing).
COMPANY_DOMAINS: Dict[str, str] = {
    "makemytrip": "www.makemytrip.com", "goibibo": "www.goibibo.com",
    "booking": "www.booking.com", "agoda": "www.agoda.com", "yatra": "www.yatra.com",
    "cleartrip": "www.cleartrip.com", "easemytrip": "www.easemytrip.com",
    "ixigo": "www.ixigo.com", "akasaair": "www.akasaair.com", "indigo": "www.goindigo.in",
    "amazon": "www.amazon.in", "flipkart": "www.flipkart.com", "meesho": "www.meesho.com",
    "myntra": "www.myntra.com", "ajio": "www.ajio.com", "tatacliq": "www.tatacliq.com",
    "blinkit": "blinkit.com", "zepto": "www.zeptonow.com", "swiggy-instamart": "www.swiggy.com",
    "bigbasket": "www.bigbasket.com", "flipkart-minutes": "www.flipkart.com",
    "redbus": "www.redbus.in", "abhibus": "www.abhibus.com",
    "olacabs": "www.olacabs.com", "uber": "www.uber.com", "indrive": "indrive.com",
    "meru": "www.merucabs.com", "rapido": "www.rapido.bike",
    "snap-e": "www.snape.io",
    # UNRESOLVED: exact domain not yet confirmed by the operator — never guessed.
    "fastdeals": "fastdeals.invalid",
    "bookmyshow": "www.bookmyshow.com", "district": "district.zomato.com",
    "paytm": "paytm.com", "pvrinox": "www.pvrcinemas.com", "cinepolis": "cinepolisindia.com",
    "ticketnew": "www.ticketnew.com",
    "zomato": "www.zomato.com", "swiggy": "www.swiggy.com", "dominos": "www.dominos.co.in",
    "ovenstory": "ovenstory.com", "eatsure": "www.eatsure.com",
    "paisabazaar": "www.paisabazaar.com", "bankbazaar": "www.bankbazaar.com",
    "policybazaar": "www.policybazaar.com", "moneyview": "moneyview.com",
    "kreditbee": "www.kreditbee.in", "navi": "navi.com",
    "ditto": "www.dittoinsurance.com", "insurancedekho": "www.insurancedekho.com",
    "acko": "www.acko.com", "digit": "www.godigit.com", "coverfox": "www.coverfox.com",
}


class AcquisitionError(Exception):
    """Base acquisition failure. Subclasses drive the healing state machine."""


class BlockedError(AcquisitionError):
    """HTTP 403/429 or challenge page — target fingerprinted the session."""


class EndpointDriftError(AcquisitionError):
    """HTTP 404/410 or schema validation failure — the platform moved its API."""


class ParseError(AcquisitionError):
    """The response arrived but the expected JSON shape was not found."""


@dataclass(frozen=True)
class Offer:
    """Normalized, vendor-agnostic offer. Prices/URLs are NEVER fabricated."""
    title: str
    price: Optional[float]                 # None -> 'price on seller site'
    currency: str = "INR"
    image_url: Optional[str] = None
    deep_link: Optional[str] = None
    vendor: str = ""
    attributes: Dict[str, Any] = field(default_factory=dict)
    vertical: str = ""
    source_endpoint: str = ""


@dataclass
class ScraperConfig:
    """Live view of scraper_configs for one company (the healing cache row)."""
    company_slug: str
    api_endpoint: str
    http_method: str = "GET"
    request_template: Dict[str, Any] = field(default_factory=dict)
    headers: Dict[str, str] = field(default_factory=dict)
    target_js_keywords: List[str] = field(default_factory=lambda: ["main", "app", "index", "chunk"])
    regex_healing_rules: List[Dict[str, Any]] = field(default_factory=list)
    max_bundle_bytes: int = 4_000_000
    consecutive_failures: int = 0
    status: str = "active"


@dataclass
class AffiliateProfile:
    company_slug: str
    network: str                # 'cuelinks' | 'vcommission' | 'admitad' | 'direct'
    tracking_template: str      # contains {url},{url2},{subid},{campaign},{click}
    campaign_key: Optional[str] = None
    subid_param: str = "subid"
    extra_params: Dict[str, str] = field(default_factory=dict)


@runtime_checkable
class ConfigStore(Protocol):
    """Persistence contract. PostgresStore in production; MemoryStore in tests."""

    def get_scraper_config(self, company_slug: str) -> Optional[ScraperConfig]: ...
    def get_affiliate_profile(self, company_slug: str) -> Optional[AffiliateProfile]: ...
    def save_scraper_config(self, config: ScraperConfig) -> None: ...
    def record_heal(self, company_slug: str, new_endpoint: str, rules_used: List[str]) -> None: ...
