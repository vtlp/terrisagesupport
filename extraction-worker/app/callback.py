"""POST signed callback to the Support Console."""
from __future__ import annotations

import json
import time

import httpx

from .security import sign_payload


async def post_callback(callback_url: str, payload: dict, *, secret: str) -> None:
    raw = json.dumps(payload, separators=(",", ":"), default=str)
    headers = {"Content-Type": "application/json"}
    if secret:
        ts = str(int(time.time()))
        headers["x-extraction-timestamp"] = ts
        headers["x-extraction-signature"] = sign_payload(secret, ts, raw)

    # Retry up to 3 times with linear backoff.
    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(callback_url, content=raw, headers=headers)
                if resp.status_code < 500:
                    return  # don't retry 4xx — likely a contract bug
        except Exception as exc:
            last_exc = exc
        await _sleep(2 ** attempt)
    if last_exc:
        raise last_exc


async def _sleep(seconds: float) -> None:
    import asyncio

    await asyncio.sleep(seconds)
