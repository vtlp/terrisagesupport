"""Top-level extraction orchestrator.

Pipeline stages:
  1. ingest      — download signed URLs, sniff file types
  2. preprocess  — rasterise PDFs, run OCR on scanned pages, collect text per page
  3. extract     — regex/heuristic field extraction (project + configurations)
  4. floorplans  — OpenCV-based detection + carving from rendered pages
  5. normalize   — assemble final payload, derive plot config suggestions, build summary

Each stage logs entry/exit + key counts so production failures are diagnosable from logs.
"""
from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List

from .ingest import download_files
from .preprocess import preprocess_files
from .extract_fields import extract_project_fields, extract_configurations
from .floorplans import detect_and_carve_floorplans
from .normalize import assemble_payload, build_mock as _build_mock

log = logging.getLogger("extraction-worker.pipeline")

MAX_PAGES = int(os.getenv("MAX_PAGES", "80"))


def run_extraction(*, job_id: str, files: List[Dict[str, Any]], property_type: str) -> Dict[str, Any]:
    """Synchronous entry point — called inside asyncio.to_thread."""
    overall_start = time.time()
    log.info(
        "[%s] pipeline.start files=%d property_type=%s max_pages=%d",
        job_id, len(files), property_type, MAX_PAGES,
    )
    if not files:
        log.error("[%s] pipeline.no_files_in_request — extraction-trigger sent files=[]", job_id)
        return {
            "jobId": job_id,
            "failed": True,
            "errorMessage": "extraction-trigger sent zero files",
            "errors": [{"code": "no_files_in_request", "message": "files[] was empty in /extract payload"}],
        }

    # Log file metadata up-front (without secrets).
    for i, f in enumerate(files):
        log.info(
            "[%s] pipeline.file[%d] name=%s mime=%s size=%s id=%s",
            job_id, i, f.get("fileName"), f.get("mimeType"), f.get("sizeBytes"), f.get("fileId"),
        )

    # 1. Ingest
    t0 = time.time()
    downloaded = download_files(files)
    log.info("[%s] pipeline.ingest.done elapsed_s=%.2f returned=%d",
             job_id, time.time() - t0, len(downloaded))

    ingest_failures: List[Dict[str, Any]] = []
    if downloaded and downloaded[0].get("_ingest_failures"):
        ingest_failures = downloaded[0].get("_ingest_failures") or []
    if downloaded and downloaded[0].get("_no_files"):
        downloaded = []

    if not downloaded:
        log.error("[%s] pipeline.ingest.all_failed failures=%s", job_id, ingest_failures)
        return {
            "jobId": job_id,
            "failed": True,
            "errorMessage": "All file downloads failed",
            "errors": [
                {"code": "download_failed", "message": ff.get("error"), "file": ff.get("name"), "url": ff.get("url")}
                for ff in ingest_failures
            ] or [{"code": "no_files", "message": "No files could be downloaded"}],
        }

    # 2. Preprocess (render + OCR)
    t0 = time.time()
    try:
        pages = preprocess_files(downloaded, max_pages=MAX_PAGES)
    except Exception as exc:
        log.exception("[%s] pipeline.preprocess.crashed err=%s", job_id, exc)
        return {
            "jobId": job_id,
            "failed": True,
            "errorMessage": f"preprocess crashed: {exc}",
            "errors": [{"code": "preprocess_crashed", "message": str(exc)}],
        }
    log.info(
        "[%s] pipeline.preprocess.done elapsed_s=%.2f pages=%d scanned_pages=%d",
        job_id, time.time() - t0, len(pages),
        sum(1 for p in pages if p.get("is_scanned")),
    )

    if not pages:
        log.error("[%s] pipeline.preprocess.no_pages — every file failed to render", job_id)
        return {
            "jobId": job_id,
            "failed": True,
            "errorMessage": "No pages produced from uploaded files",
            "errors": [{"code": "no_pages", "message": "Preprocess produced 0 pages"}],
        }

    # 3. Field extraction
    t0 = time.time()
    project_data, project_warnings = extract_project_fields(pages)
    configurations, config_warnings = extract_configurations(pages, property_type=property_type)
    log.info(
        "[%s] pipeline.extract.done elapsed_s=%.2f configs=%d warnings=%d",
        job_id, time.time() - t0, len(configurations),
        len(project_warnings) + len(config_warnings),
    )

    # 4. Floor-plan carving (only meaningful for apartment/villa)
    floor_plans: List[Dict[str, Any]] = []
    if property_type in {"APARTMENT", "VILLA"}:
        t0 = time.time()
        try:
            floor_plans = detect_and_carve_floorplans(pages, configurations=configurations)
            log.info("[%s] pipeline.floorplans.done elapsed_s=%.2f detected=%d",
                     job_id, time.time() - t0, len(floor_plans))
        except Exception as exc:
            log.exception("[%s] pipeline.floorplans.crashed err=%s", job_id, exc)
    else:
        log.info("[%s] pipeline.floorplans.skipped property_type=%s", job_id, property_type)

    # 5. Normalize + assemble
    t0 = time.time()
    payload = assemble_payload(
        job_id=job_id,
        property_type=property_type,
        project_data=project_data,
        configurations=configurations,
        floor_plans=floor_plans,
        pages=pages,
        warnings=project_warnings + config_warnings,
    )
    payload["pagesProcessed"] = len(pages)
    if ingest_failures:
        payload.setdefault("errors", []).extend([
            {"code": "download_failed", "message": ff.get("error"), "file": ff.get("name")}
            for ff in ingest_failures
        ])
    log.info(
        "[%s] pipeline.complete total_elapsed_s=%.2f pages=%d configs=%d floor_plans=%d",
        job_id, time.time() - overall_start, len(pages), len(configurations), len(floor_plans),
    )
    return payload


def build_mock_payload(*, job_id: str, property_type: str) -> Dict[str, Any]:
    log.info("[%s] mock.payload property_type=%s", job_id, property_type)
    return _build_mock(job_id=job_id, property_type=property_type)
