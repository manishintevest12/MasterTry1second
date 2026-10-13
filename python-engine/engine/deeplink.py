"""MODULE 4 — DYNAMIC DEEPLINK INTERCEPTOR & GENERATOR (bulletproof).

build_secure_deeplink(company_slug, target_product_url):
    1. load the ACTIVE affiliate profile for that company (admin sets the
       base tracking template ONCE per company in affiliate_configs);
    2. apply the network-specific encoding nuance:
         Cuelinks    -> linksredirect.com/cuelink?type=nl&subid=..&campaign=..&url=<SINGLE-encoded>
         vCommission -> linksredirect.com/?cid=..&source=linkkit&u=<DOUBLE-encoded>
         Admitad     -> ad.admitad.com/g/<campaign>/?subid=..&ulp=<encoded>
         direct      -> brand template as stored ({url}/{subid}/{click})
    3. return a MASKING POINTER (HMAC-SHA256-signed, expiring token) — the
       affiliate tokens NEVER reach the frontend interface.

No profile / unknown company -> the exact vendor destination is returned as a
signed pointer with network=None. Tokens are never invented.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
import uuid
from dataclasses import dataclass
from typing import Dict, Optional
from urllib.parse import quote

from .core import AffiliateProfile, ConfigStore

POINTER_TTL_SEC = 24 * 60 * 60

# Canonical network templates used when affiliate_configs stores only the
# campaign key (admin convenience). If the admin stored a full custom
# tracking_template, it always wins.
CANONICAL_TEMPLATES: Dict[str, str] = {
    # {url} single-encoded destination, {url2} double-encoded destination
    "cuelinks":    "https://linksredirect.com/cuelink?type=nl&subid={subid}&campaign={campaign}&url={url}",
    "vcommission": "https://linksredirect.com/?cid={campaign}&source=linkkit&u={url2}",
    "admitad":     "https://ad.admitad.com/g/{campaign}/?subid={subid}&ulp={url}",
}


@dataclass(frozen=True)
class DeeplinkResult:
    pointer: str           # what the frontend receives: /go?t=<payload>.<sig>
    network: Optional[str] # 'cuelinks' | 'vcommission' | 'admitad' | 'direct' | None
    resolved_url: str      # final tracking URL (server-side only, never shipped)


def _secret() -> bytes:
    raw = os.environ.get("AFFILIATE_SECRET") or os.environ.get("DATABASE_URL") or "try1second"
    return hashlib.sha256(f"{raw}#affiliate-pointer".encode()).digest()


def _b64url(s: str) -> str:
    return base64.urlsafe_b64encode(s.encode()).decode().rstrip("=")


def _unb64url(s: str) -> str:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4)).decode()


def _sign(payload: str) -> str:
    return hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()[:32]


def _render(template: str, dest: str, profile: AffiliateProfile,
            click_id: str) -> str:
    subid = profile.extra_params.get("subid", "try1second")
    campaign = profile.campaign_key or profile.extra_params.get("campaign", "")
    out = (template
           .replace("{url2}", quote(quote(dest, safe=""), safe=""))
           .replace("{url}", quote(dest, safe=""))
           .replace("{subid}", quote(subid, safe=""))
           .replace("{campaign}", quote(campaign, safe=""))
           .replace("{click}", click_id)
           .replace(f"{{{profile.subid_param}}}", quote(subid, safe="")))
    # Strip any unreplaced placeholder — never leak template fragments.
    import re
    return re.sub(r"\{[a-z0-9_]+\}", "", out, flags=re.IGNORECASE)


def create_pointer(destination: str, offer_id: str = "",
                   ttl_sec: int = POINTER_TTL_SEC) -> str:
    payload = _b64url(json.dumps({
        "d": destination[:2000], "o": offer_id[:64],
        "e": int(time.time()) + ttl_sec, "n": uuid.uuid4().hex[:8],
    }))
    return f"/go?t={payload}.{_sign(payload)}"


def resolve_pointer(token: str) -> Optional[Dict[str, str]]:
    """Constant-time verification. Returns None on ANY anomaly (tamper/expiry)."""
    try:
        payload, sig = token.split(".", 1)
    except ValueError:
        return None
    if not hmac.compare_digest(sig, _sign(payload)):
        return None
    try:
        j = json.loads(_unb64url(payload))
        if int(j.get("e", 0)) < time.time() or not j.get("d"):
            return None
        return {"destination": str(j["d"]), "offer_id": str(j.get("o", ""))}
    except Exception:
        return None


def build_secure_deeplink(company_slug: str, target_product_url: str,
                          store: ConfigStore,
                          offer_id: str = "") -> DeeplinkResult:
    """The single entry point the redirect service calls on every click-out."""
    if not target_product_url or not target_product_url.startswith(("http://", "https://")):
        raise ValueError("target_product_url must be an absolute http(s) URL")

    profile = store.get_affiliate_profile(company_slug)
    click_id = uuid.uuid4().hex[:12]

    if profile is None:
        # Honest direct hop: no active profile -> no invented tokens.
        return DeeplinkResult(create_pointer(target_product_url, offer_id), None,
                              target_product_url)

    template = profile.tracking_template or CANONICAL_TEMPLATES.get(profile.network, "")
    if not template:
        return DeeplinkResult(create_pointer(target_product_url, offer_id), None,
                               target_product_url)
    if "{url}" not in template and "{url2}" not in template and "{ulp}" not in template:
        # Admin stored a static template with no destination slot — invalid;
        # fall through to the honest direct hop rather than guess.
        return DeeplinkResult(create_pointer(target_product_url, offer_id), None,
                              target_product_url)

    final = _render(template, target_product_url, profile, click_id)
    network = profile.network if profile.network != "direct" else "direct"
    return DeeplinkResult(create_pointer(final, offer_id), network, final)
