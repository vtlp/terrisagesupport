"""HMAC signing/verification — must match supabase/functions/_shared/extraction.ts."""
from __future__ import annotations

import hashlib
import hmac
import time
from typing import Tuple


def sign_payload(secret: str, timestamp: str, raw_body: str) -> str:
    """hex(HMAC_SHA256(secret, f"{timestamp}.{raw_body}"))"""
    msg = f"{timestamp}.{raw_body}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def verify_signature(
    secret: str,
    timestamp: str,
    raw_body: str,
    provided_hex: str,
    tolerance_seconds: int = 300,
) -> Tuple[bool, str]:
    if not timestamp or not provided_hex:
        return False, "missing signature headers"
    try:
        ts = int(timestamp)
    except (TypeError, ValueError):
        return False, "invalid timestamp"
    if abs(int(time.time()) - ts) > tolerance_seconds:
        return False, "timestamp outside tolerance window"
    expected = sign_payload(secret, timestamp, raw_body)
    if not hmac.compare_digest(expected, provided_hex):
        return False, "signature mismatch"
    return True, ""
