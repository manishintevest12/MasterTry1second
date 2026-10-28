"""DNS self-healing (28 Oct): a dead resolver must not delete mandated sources.

Live evidence: on the production host, ixigo/yatra/makemytrip bus workers all died with
"curl: (28) Resolving timed out after 12000 milliseconds" while redbus/abhibus answered
fine — so the resolver, not the sites, was the failure. The session now retries that same
request over DNS-over-HTTPS and remembers the host.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.http_client import BrowserlessSession, is_dns_failure


class DnsFailure(Exception):
    pass


def resolver_timeout():
    return DnsFailure(
        "Failed to perform, curl: (28) Resolving timed out after 12000 milliseconds."
    )


class FakeTransport:
    """Records the kwargs of every attempt; fails with a DNS error until DoH is used."""

    def __init__(self, fail_times=99):
        self.calls = []
        self.fail_times = fail_times

    def __call__(self, method, url, **kw):
        self.calls.append(dict(kw))
        if kw.get("doh_url"):
            return 200, '{"ok":true}'
        if self.fail_times > 0:
            self.fail_times -= 1
            raise resolver_timeout()
        return 200, '{"ok":true}'


class DnsSelfHealTests(unittest.TestCase):
    def test_resolver_timeout_is_classified_as_dns(self):
        self.assertTrue(is_dns_failure(resolver_timeout()))
        self.assertFalse(is_dns_failure(TimeoutError("worker task exceeded 18s")))

    def test_request_retries_over_doh_when_resolution_dies(self):
        transport = FakeTransport()
        s = BrowserlessSession(fetch=transport)
        status, text = s.request("GET", "https://www.ixigo.com/api/bus", expect_json=True, retries=2)
        self.assertEqual(status, 200)
        self.assertEqual(len(transport.calls), 2, "one plain attempt, then one DoH retry")
        self.assertIsNone(transport.calls[0].get("doh_url"))
        self.assertTrue(transport.calls[1].get("doh_url"), "retry must resolve over HTTPS DNS")

    def test_host_that_failed_dns_skips_the_broken_resolver_next_time(self):
        transport = FakeTransport()
        s = BrowserlessSession(fetch=transport)
        s.request("GET", "https://buses.makemytrip.com/x", retries=2)
        before = len(transport.calls)
        # Second logical request to the SAME host: straight to DoH, no wasted timeout.
        s.request("GET", "https://buses.makemytrip.com/y", retries=2)
        first_of_second = transport.calls[before]
        self.assertTrue(first_of_second.get("doh_url"))

    def test_doh_stays_sticky_then_probes_the_resolver_again(self):
        transport = FakeTransport()
        s = BrowserlessSession(fetch=transport)
        s.request("GET", "https://www.yatra.com/bus", retries=2)
        self.assertIn("www.yatra.com", s._dns_failures, "DoH sticks while the resolver is suspect")
        # TTL expiry -> the next call probes the plain resolver again (self-heal back).
        s._dns_failures["www.yatra.com"] = 0
        s._dns_failures.pop("www.yatra.com")
        transport.calls.clear()
        s.request("GET", "https://www.yatra.com/bus", retries=2)
        self.assertIsNone(transport.calls[0].get("doh_url"))

    def test_a_plain_success_clears_the_failure_memory(self):
        transport = FakeTransport(fail_times=0)
        s = BrowserlessSession(fetch=transport)
        s._dns_failures["www.ixigo.com"] = 0  # expired marker
        s.request("GET", "https://www.ixigo.com/api", retries=1)
        self.assertEqual(s._dns_failures, {})

    def test_a_healthy_host_never_pays_for_doh(self):
        transport = FakeTransport(fail_times=0)
        s = BrowserlessSession(fetch=transport)
        s.request("GET", "https://www.redbus.in/api/search", retries=2)
        self.assertEqual(len(transport.calls), 1)
        self.assertIsNone(transport.calls[0].get("doh_url"))

    def test_doh_urls_are_configurable_for_the_host(self):
        s = BrowserlessSession(fetch=FakeTransport(fail_times=0))
        self.assertIn("dns-query", s.doh_url)
        self.assertTrue(s.doh_fallback_url.startswith("https://"))


if __name__ == "__main__":
    unittest.main()
