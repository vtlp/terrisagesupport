"""Floor-plan detection and carving.

Strategy:
  1. For each rendered page image, find large contiguous "drawing-like" regions:
     pages dominated by orthogonal line work + sparse text. These are floor plans.
  2. Carve the bounding box, expand by EXPAND_MARGIN_PX so labels/dimensions
     stay attached, clamp to page bounds.
  3. Save each crop as PNG, return a manifest. Caller is responsible for uploading.

Tuning knobs at top of file. Designed to be improved iteratively without changing
the contract.
"""
from __future__ import annotations

import logging
import os
import tempfile
from typing import Any, Dict, List

import cv2
import numpy as np

log = logging.getLogger("extraction-worker.floorplans")

# Floor plan must occupy at least this fraction of the page area to be considered.
MIN_PLAN_AREA_RATIO = 0.18
# Pad the detected bounding box so legends/dimensions remain attached.
EXPAND_MARGIN_PX = 60
# A page must have at least this density of long straight lines to look "drawing-like".
MIN_LINE_DENSITY = 0.0012


def detect_and_carve_floorplans(
    pages: List[Dict[str, Any]], *, configurations: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    out_dir = tempfile.mkdtemp(prefix="floorplans-")
    results: List[Dict[str, Any]] = []

    for page in pages:
        img_path = page.get("image_path")
        if not img_path or not os.path.exists(img_path):
            continue
        try:
            crop = _carve_floorplan(img_path)
        except Exception as exc:
            log.exception("carving failed on %s: %s", img_path, exc)
            continue
        if crop is None:
            continue

        out_path = os.path.join(
            out_dir, f"{page.get('file_id','f')}-p{page['page_no']}-floorplan.png"
        )
        cv2.imwrite(out_path, crop["image"])

        guessed_idx = _guess_config_index(page.get("text") or "", configurations)
        results.append({
            "source_file_id": page.get("file_id"),
            "source_page_no": page.get("page_no"),
            "extracted_image_path": out_path,
            "crop_type": crop["crop_type"],
            "guessed_configuration_name": configurations[guessed_idx]["name"] if guessed_idx is not None else None,
            "config_index": guessed_idx,
            "confidence": crop["confidence"],
            "preview_caption": _caption(page.get("text") or "", configurations, guessed_idx),
            "state": "detected",
            "warnings": crop.get("warnings", []),
        })

    return results


def _carve_floorplan(img_path: str) -> Dict[str, Any] | None:
    img = cv2.imread(img_path)
    if img is None:
        return None
    h, w = img.shape[:2]
    page_area = h * w

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Detect long lines: edges + dilation gives the "wall" skeleton typical of plans.
    edges = cv2.Canny(gray, 60, 180)
    line_density = float(edges.sum()) / (255.0 * page_area)
    if line_density < MIN_LINE_DENSITY:
        return None  # not drawing-like

    # Close gaps along walls so the plan becomes one big connected region.
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=2)

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    biggest = max(contours, key=cv2.contourArea)
    area_ratio = cv2.contourArea(biggest) / page_area
    if area_ratio < MIN_PLAN_AREA_RATIO:
        return None

    x, y, bw, bh = cv2.boundingRect(biggest)
    # Expand to keep labels/dimensions attached
    x0 = max(0, x - EXPAND_MARGIN_PX)
    y0 = max(0, y - EXPAND_MARGIN_PX)
    x1 = min(w, x + bw + EXPAND_MARGIN_PX)
    y1 = min(h, y + bh + EXPAND_MARGIN_PX)
    crop = img[y0:y1, x0:x1]

    warnings = []
    # Confidence: combine line density and area coverage
    confidence = min(1.0, 0.5 + area_ratio * 0.7 + min(line_density * 100, 0.3))
    crop_type = "page-region" if (x1 - x0) < w * 0.95 else "full-page"
    if crop_type == "full-page":
        warnings.append("crop covers nearly the full page; review to confirm bounds")

    return {
        "image": crop,
        "crop_type": crop_type,
        "confidence": round(confidence, 2),
        "warnings": warnings,
    }


def _guess_config_index(page_text: str, configurations: List[Dict[str, Any]]) -> int | None:
    if not configurations:
        return None
    pt = page_text.lower()
    best = None
    best_score = 0
    for i, cfg in enumerate(configurations):
        score = 0
        name = (cfg.get("name") or "").lower()
        if name and name in pt:
            score += 3
        bhk = cfg.get("bhk")
        if bhk and f"{bhk} bhk" in pt:
            score += 2
        if score > best_score:
            best_score = score
            best = i
    return best


def _caption(page_text: str, configurations: List[Dict[str, Any]], idx: int | None) -> str:
    if idx is not None and idx < len(configurations):
        return f"{configurations[idx].get('name','Floor plan')} - extracted from brochure"
    # Try to lift a heading-ish line from the page
    for line in (page_text or "").splitlines():
        s = line.strip()
        if 4 <= len(s) <= 60 and ("plan" in s.lower() or "bhk" in s.lower()):
            return s
    return "Floor plan"
