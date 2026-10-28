"""pyfetch DNS self-healing (28 Oct).

Live evidence: three mandated bus sources failed on the production host with
"curl: (28) Resolving timed out after 12000 milliseconds" while redbus/abhibus answered.
The shared host's resolver was the fault, so the helper now retries the SAME request over
DNS-over-HTTPS and reports which path it used (dnsRecovered / "doh-retry failed").
"""
import importlib.util
import json
import os
import subprocess
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
HELPER = os.path.abspath(os.path.join(HERE, "..", "pyfetch.py"))


def _load_helper_module():
    spec = importlib.util.spec_from_file_location("pyfetch_helper", HELPER)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def _run(url: str, timeout_sec: int = 8) -> dict:
    proc = subprocess.run(
        [sys.executable, HELPER],
        input=json.dumps({"url": url, "timeoutSec": timeout_sec}),
        capture_output=True,
        text=True,
        timeout=60,
    )
    return json.loads(proc.stdout.strip() or "{}")


class PyfetchDnsTests(unittest.TestCase):
    def test_resolver_errors_are_classified(self):
        mod = _load_helper_module()
        self.assertTrue(mod.dns_failure("curl: (28) Resolving timed out after 12000 milliseconds"))
        self.assertTrue(mod.dns_failure("curl: (6) Could not resolve host: x.example"))
        self.assertFalse(mod.dns_failure("curl: (35) TLS handshake failure"))
        self.assertFalse(mod.dns_failure("HTTP 403 from edge"))

    def test_nonexistent_host_retries_over_doh_and_reports_both_attempts(self):
        out = _run("https://host-that-does-not-exist-t1s.invalid/")
        self.assertFalse(out.get("ok"))
        err = out.get("error") or ""
        # The retry must be visible: first attempt, then the DoH attempt.
        self.assertIn("doh-retry failed", err)

    def test_a_resolvable_host_answers_without_the_doh_path(self):
        out = _run("https://bus.makemytrip.com/", timeout_sec=10)
        if not out.get("ok"):
            self.skipTest("sandbox cannot reach makemytrip right now")
        self.assertEqual(out.get("status"), 200)
        self.assertFalse(out.get("dnsRecovered"), "healthy DNS must not pay for DoH")


if __name__ == "__main__":
    unittest.main()
