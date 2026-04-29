"""Top-level extraction orchestrator.

Pipeline stages:
  1. ingest      — download signed URLs, sniff file types
  2. preprocess  — rasterise PDFs, run OCR on scanned pages, collect text per page
  3. extract     — regex/heuristic field extraction (project + configurations)
  4. floorplans  — OpenCV-based detection + carving from rendered pages
  5. normalize   — assemble final payload, derive plot config suggestions, build summary

Each stage is in its own module so heuristics can be tuned independently.
"""
from __future__ import annotations

import logging
import os
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
    log.info("[%s] starting extraction (files=%d, type=%s)", job_id, len(files), property_type)

    # 1. Ingest
    downloaded = download_files(files)
    if not downloaded:
        return {
            "jobId": job_id,
            "failed": True,
            "errorMessage": "no files could be downloaded",
            "errors": [{"code": "no_files", "message": "All file downloads failed"}],
        }

    # 2. Preprocess (render + OCR)
    pages = preprocess_files(downloaded, max_pages=MAX_PAGES)
    log.info("[%s] preprocessed %d page(s)", job_id, len(pages))

    # 3. Field extraction
    project_data, project_warnings = extract_project_fields(pages)
    configurations, config_warnings = extract_configurations(pages, property_type=property_type)

    # 4. Floor-plan carving (only meaningful for apartment/villa)
    floor_plans: List[Dict[str, Any]] = []
    if property_type in {"APARTMENT", "VILLA"}:
        floor_plans = detect_and_carve_floorplans(pages, configurations=configurations)

    # 5. Normalize + assemble
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
    return payload


def build_mock_payload(*, job_id: str, property_type: str) -> Dict[str, Any]:
    return _build_mock(job_id=job_id, property_type=property_type)
