"""POST signed callback to the Support Console — with verbose logging."""
from __future__ import annotations

import json
import logging
import time

import httpx

from .security import sign_payload

log = logging.getLogger("extraction-worker.callback")


async def post_callback(callback_url: str, payload: dict, *, secret: str) -> None:
    raw = json.dumps(payload, separators=(",", ":"), default=str)
    headers = {"Content-Type": "application/json"}
    if secret:
        ts = str(int(time.time()))
        headers["x-extraction-timestamp"] = ts
        headers["x-extraction-signature"] = sign_payload(secret, ts, raw)

    log.info(
        "callback.start url=%s job_id=%s payload_bytes=%d signed=%s",
        callback_url, payload.get("jobId"), len(raw), bool(secret),
    )

    last_exc: Exception | None = None
    for attempt in range(3):
        t0 = time.time()
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(callback_url, content=raw, headers=headers)
                elapsed = round(time.time() - t0, 3)
                body_preview = ""
                try:
                    body_preview = resp.text[:500]
                except Exception:
                    pass
                log.info(
                    "callback.response attempt=%d status=%s elapsed_s=%s body=%r",
                    attempt + 1, resp.status_code, elapsed, body_preview,
                )
                if resp.status_code < 500:
                    if resp.status_code >= 400:
                        log.error("callback.4xx_no_retry status=%s body=%r", resp.status_code, body_preview)
                    return  # don't retry 4xx — likely a contract bug
        except Exception as exc:
            last_exc = exc
            log.exception("callback.exception attempt=%d err=%s", attempt + 1, exc)
        backoff = 2 ** attempt
        log.info("callback.retry sleeping=%ss", backoff)
        await _sleep(backoff)
    if last_exc:
        log.error("callback.giving_up err=%s", last_exc)
        raise last_exc


async def _sleep(seconds: float) -> None:
    import asyncio

    await asyncio.sleep(seconds)
