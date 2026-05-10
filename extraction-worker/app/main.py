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
    log.info("extract.request received bytes=%d ts_header=%s sig_present=%s",
             len(raw), x_extraction_timestamp, bool(x_extraction_signature))

    # ---- HMAC verification ----
    if HMAC_SECRET:
        if not x_extraction_timestamp or not x_extraction_signature:
            log.warning("extract.auth.missing_headers")
            raise HTTPException(status_code=401, detail="Missing signature headers")
        ok, reason = verify_signature(
            HMAC_SECRET, x_extraction_timestamp, raw.decode("utf-8"), x_extraction_signature
        )
        if not ok:
            log.warning("extract.auth.failed reason=%s", reason)
            raise HTTPException(status_code=401, detail=f"signature invalid: {reason}")
        log.info("extract.auth.ok")

    try:
        payload = await request.json()
    except Exception as exc:
        log.exception("extract.invalid_json err=%s", exc)
        raise HTTPException(status_code=400, detail="invalid JSON")

    job_id = payload.get("jobId")
    callback_url = payload.get("callbackUrl")
    files = payload.get("files") or []
    property_type = (payload.get("propertyType") or "APARTMENT").upper()
    account_id = payload.get("accountId")

    log.info(
        "extract.payload job_id=%s account_id=%s property_type=%s files=%d callback=%s",
        job_id, account_id, property_type, len(files), callback_url,
    )
    for i, f in enumerate(files):
        log.info(
            "extract.payload.file[%d] name=%s mime=%s size=%s id=%s has_url=%s",
            i, f.get("fileName"), f.get("mimeType"), f.get("sizeBytes"),
            f.get("fileId"), bool(f.get("signedUrl")),
        )

    if not job_id or not callback_url:
        log.error("extract.bad_request job_id=%s callback_url=%s", job_id, callback_url)
        raise HTTPException(status_code=400, detail="jobId and callbackUrl required")

    is_mock = request.query_params.get("mock") == "1"

    worker_job_id = str(uuid.uuid4())
    log.info("extract.accepted job_id=%s worker_ref=%s files=%d mock=%s",
             job_id, worker_job_id, len(files), is_mock)

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
    log.info("background.start job_id=%s files=%d mock=%s", job_id, len(files), is_mock)
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
        log.exception("background.extraction_crashed job_id=%s err=%s", job_id, exc)
        payload = {
            "jobId": job_id,
            "failed": True,
            "errorMessage": str(exc),
            "errors": [{"code": "extraction_exception", "message": str(exc)}],
        }

    payload.setdefault("jobId", job_id)
    elapsed = round(time.time() - started, 2)
    payload.setdefault("summary", {})["elapsedSeconds"] = elapsed
    log.info("background.done job_id=%s failed=%s elapsed_s=%.2f errors=%d",
             job_id, bool(payload.get("failed")), elapsed, len(payload.get("errors") or []))

    try:
        await post_callback(callback_url, payload, secret=HMAC_SECRET)
        log.info("background.callback.delivered job_id=%s elapsed_s=%.2f", job_id, elapsed)
    except Exception as exc:
        log.exception("background.callback.failed job_id=%s err=%s", job_id, exc)
