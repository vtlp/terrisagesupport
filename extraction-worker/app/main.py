"""FastAPI entry point for the Terrisage extraction worker.

Endpoints:
- POST /extract  — accept a job, verify HMAC, run extraction in background, callback when done.
- GET  /healthz  — liveness probe.

The worker is intentionally thin: orchestration only. All real work lives in app/pipeline/.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request

from .security import sign_payload, verify_signature
from .pipeline.runner import run_extraction, build_mock_payload
from .callback import post_callback

load_dotenv()
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
log = logging.getLogger("extraction-worker")

HMAC_SECRET = os.getenv("EXTRACTION_HMAC_SECRET", "")
if not HMAC_SECRET:
    log.warning("EXTRACTION_HMAC_SECRET is empty — running in INSECURE dev mode")

app = FastAPI(title="Terrisage Brochure Extraction Worker", version="1.0.0")


@app.get("/healthz")
async def healthz() -> Dict[str, Any]:
    return {"ok": True, "service": "extraction-worker", "secure": bool(HMAC_SECRET)}


@app.post("/extract")
async def extract(
    request: Request,
    background: BackgroundTasks,
    x_extraction_timestamp: str | None = Header(default=None),
    x_extraction_signature: str | None = Header(default=None),
) -> Dict[str, Any]:
    raw = await request.body()

    # ---- HMAC verification ----
    if HMAC_SECRET:
        if not x_extraction_timestamp or not x_extraction_signature:
            raise HTTPException(status_code=401, detail="Missing signature headers")
        ok, reason = verify_signature(
            HMAC_SECRET, x_extraction_timestamp, raw.decode("utf-8"), x_extraction_signature
        )
        if not ok:
            log.warning("HMAC verification failed: %s", reason)
            raise HTTPException(status_code=401, detail=f"signature invalid: {reason}")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="invalid JSON")

    job_id = payload.get("jobId")
    callback_url = payload.get("callbackUrl")
    files = payload.get("files") or []
    property_type = (payload.get("propertyType") or "APARTMENT").upper()

    if not job_id or not callback_url:
        raise HTTPException(status_code=400, detail="jobId and callbackUrl required")

    is_mock = request.query_params.get("mock") == "1"

    worker_job_id = str(uuid.uuid4())
    log.info("Accepted job %s (worker_ref=%s, files=%d, mock=%s)", job_id, worker_job_id, len(files), is_mock)

    background.add_task(
        _process_in_background,
        job_id=job_id,
        callback_url=callback_url,
        files=files,
        property_type=property_type,
        is_mock=is_mock,
    )

    return {"ok": True, "workerJobId": worker_job_id, "accepted": True}


async def _process_in_background(
    *, job_id: str, callback_url: str, files: list[dict], property_type: str, is_mock: bool
) -> None:
    started = time.time()
    try:
        if is_mock:
            payload = build_mock_payload(job_id=job_id, property_type=property_type)
        else:
            # Run blocking extraction in a thread to keep the event loop responsive.
            payload = await asyncio.to_thread(
                run_extraction,
                job_id=job_id,
                files=files,
                property_type=property_type,
            )
    except Exception as exc:
        log.exception("Extraction failed for job %s", job_id)
        payload = {
            "jobId": job_id,
            "failed": True,
            "errorMessage": str(exc),
            "errors": [{"code": "extraction_exception", "message": str(exc)}],
        }

    payload.setdefault("jobId", job_id)
    elapsed = round(time.time() - started, 2)
    payload.setdefault("summary", {})["elapsedSeconds"] = elapsed

    try:
        await post_callback(callback_url, payload, secret=HMAC_SECRET)
        log.info("Callback delivered for job %s in %.2fs", job_id, elapsed)
    except Exception:
        log.exception("Callback delivery failed for job %s", job_id)
