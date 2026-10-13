"""Unit tests for the browserless blueprint (offline, injectable fetch)."""
import json
import sys, os, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.core import (VERTICAL_TARGETS, COMPANY_DOMAINS, AffiliateProfile,
                         ScraperConfig)
from engine.scanner import DynamicScannerEngine, DEFAULT_HEALING_RULES
from engine.factory import ScraperFactory, AbhiBusScraper, SCRAPER_REGISTRY
from engine.deeplink import build_secure_deeplink, create_pointer, resolve_pointer


class MemoryStore:
    """In-memory ConfigStore for tests (matches the Protocol)."""
    def __init__(self):
        self.scrapers, self.affiliates, self.heals = {}, {}, []
    def get_scraper_config(self, slug):
        return self.scrapers.get(slug)
    def get_affiliate_profile(self, slug):
        return self.affiliates.get(slug)
    def save_scraper_config(self, cfg):
        self.scrapers[slug := cfg.company_slug] = cfg
    def record_heal(self, slug, endpoint, rules):
        self.heals.append((slug, endpoint))


FAKE_BUNDLE = 'const API_BASE="https://api.example-platform.com/";' \
    'fetch("/api/v4/search",{method:"POST"});' \
    'const r2 = new Endpoint("/buslist/v9/services");' \
    'var stale = "/buslist/v3/services";'


class TestVerticalRegistry(unittest.TestCase):
    def test_all_ten_verticals_and_domains(self):
        self.assertEqual(len(VERTICAL_TARGETS), 10)
        for slug in VERTICAL_TARGETS:
            for company in VERTICAL_TARGETS[slug]:
                self.assertIn(company, COMPANY_DOMAINS, f"{company} missing domain")
        # honest placeholders are explicitly marked, never silently invented
        self.assertEqual(COMPANY_DOMAINS["fastdeals"], "fastdeals.invalid")


class TestScanner(unittest.TestCase):
    def test_heal_finds_new_endpoint_from_bundle(self):
        store = MemoryStore()
        cfg = ScraperConfig(
            company_slug="abhibus",
            api_endpoint="https://www.abhibus.com/buslist/v3/services",
            http_method="POST",
            regex_healing_rules=[{"pattern": r"/buslist/v\d+/services", "priority": 20,
                                  "kind": "path_fragment"}])
        store.scrapers["abhibus"] = cfg

        def fake_fetch(method, url, **kw):
            if url.endswith("abhibus.com/"):
                return 200, '<html><script src="/static/main-abc123.js"></script></html>'
            if "main-abc123" in url:
                return 200, FAKE_BUNDLE
            raise AssertionError("unexpected " + url)

        session = type("S", (), {"get": staticmethod(lambda u, **k: fake_fetch("GET", u, **k))})()
        engine = DynamicScannerEngine(session, store)  # type: ignore[arg-type]
        report = engine.heal("abhibus")
        self.assertTrue(report.healed, f"candidates={report.candidates}")
        self.assertEqual(report.bundles_scanned, 1)
        # company rule (priority 20) outranks generic v3 remnant (priority 6)
        self.assertEqual(store.scrapers["abhibus"].api_endpoint,
                         "https://www.abhibus.com/buslist/v9/services")
        self.assertEqual(store.heals[0][0], "abhibus")

    def test_unknown_company_is_reported_not_crashed(self):
        engine = DynamicScannerEngine(None, MemoryStore())  # type: ignore[arg-type]
        report = engine.heal("does-not-exist")
        self.assertFalse(report.healed)


class TestFactory(unittest.TestCase):
    def test_registry_and_generic_fallback(self):
        store = MemoryStore()
        factory = ScraperFactory(None, store, None)  # type: ignore[arg-type]
        self.assertIsInstance(factory.create("abhibus"), AbhiBusScraper)
        fallback = factory.create("policybazaar", "loans")
        self.assertEqual(fallback.company_slug, "policybazaar")
        self.assertEqual(fallback.vertical, "loans")

    def test_abhibus_parser_extracts_real_fares_and_skips_fareless(self):
        data = {"services": [
            {"travelerAgentName": "TGSRTC", "busServiceTypeName": "Super Luxury",
             "fares": {"fare": 946, "offerPrice": 941},
             "timings": {"startTime": "08:00 PM", "arriveTime": "06:50 AM"},
             "seatStats": {"availableSeats": 22}, "rating": 3.2},
            {"travelerAgentName": "Ghost", "fares": {"fare": 0}},
        ]}
        scraper = AbhiBusScraper.__new__(AbhiBusScraper)
        offers = scraper.parse(data, "x")
        self.assertEqual(len(offers), 1)
        self.assertEqual(offers[0].price, 941.0)
        self.assertEqual(offers[0].attributes["departure"], "08:00 PM")


class TestDeeplink(unittest.TestCase):
    def setUp(self):
        self.store = MemoryStore()

    def test_network_encoding_nuances(self):
        self.store.affiliates["agoda"] = AffiliateProfile(
            "agoda", "cuelinks", "", campaign_key="cid-123")
        r = build_secure_deeplink("agoda", "https://www.agoda.com/hotel-x?cid=1",
                                  self.store)
        self.assertEqual(r.network, "cuelinks")
        # single-encoded destination inside url=
        self.assertIn("url=https%3A%2F%2Fwww.agoda.com%2Fhotel-x%3Fcid%3D1", r.resolved_url)
        self.assertIn("campaign=cid-123", r.resolved_url)

        self.store.affiliates["flipkart"] = AffiliateProfile(
            "flipkart", "vcommission", "", campaign_key="vc-77")
        r2 = build_secure_deeplink("flipkart", "https://www.flipkart.com/i/p/1",
                                  self.store)
        # vCommission double-encodes in u=
        self.assertIn("u=https%253A%252F%252Fwww.flipkart.com%252Fi%252Fp%252F1", r2.resolved_url)

        self.store.affiliates["mmt"] = AffiliateProfile(
            "mmt", "admitad", "https://ad.admitad.com/g/ADV22/?subid={subid}&ulp={url}",
            campaign_key="ADV22")
        r3 = build_secure_deeplink("mmt", "https://www.makemytrip.com/hotels/y",
                                   self.store)
        self.assertIn("subid=try1second", r3.resolved_url)
        self.assertIn("ulp=https%3A%2F%2Fwww.makemytrip.com", r3.resolved_url)

    def test_pointer_masks_tokens_and_is_tamperproof(self):
        self.store.affiliates["agoda"] = AffiliateProfile(
            "agoda", "cuelinks", "", campaign_key="cid-123")
        r = build_secure_deeplink("agoda", "https://www.agoda.com/x", self.store, "42")
        self.assertTrue(r.pointer.startswith("/go?t="))
        # the frontend NEVER sees the campaign token or destination
        self.assertNotIn("cid-123", r.pointer)
        self.assertNotIn("agoda.com", r.pointer)
        got = resolve_pointer(r.pointer.split("t=")[1])
        self.assertEqual(got["destination"], r.resolved_url)
        self.assertEqual(got["offer_id"], "42")
        # tampering
        bad = r.pointer.split("t=")[1][:-2] + "zz"
        self.assertIsNone(resolve_pointer(bad))
        self.assertIsNone(resolve_pointer("garbage"))

    def test_unconfigured_company_direct_honest_hop(self):
        r = build_secure_deeplink("meru", "https://www.merucabs.com/booking", self.store)
        self.assertIsNone(r.network)
        self.assertEqual(r.resolved_url, "https://www.merucabs.com/booking")
        got = resolve_pointer(r.pointer.split("t=")[1])
        self.assertEqual(got["destination"], "https://www.merucabs.com/booking")

    def test_rejects_non_http_targets(self):
        with self.assertRaises(ValueError):
            build_secure_deeplink("agoda", "javascript:alert(1)", self.store)


if __name__ == "__main__":
    unittest.main(verbosity=2)
