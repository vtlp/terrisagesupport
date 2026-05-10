"""Render PDF pages to images and extract text per page (with OCR fallback).

Returns a flat list of page dicts:
  {
    "file_id": str,
    "file_name": str,
    "file_type": str,           # BROCHURE / LAYOUT / IMAGE / ...
    "page_no": int,             # 1-based; for image files always 1
    "text": str,
    "image_path": str,          # rendered/source PNG path on disk
    "is_scanned": bool,
    "width": int,
    "height": int,
  }
"""
from __future__ import annotations

import logging
import os
import tempfile
from typing import Any, Dict, List

from PIL import Image

log = logging.getLogger("extraction-worker.preprocess")

OCR_DPI = int(os.getenv("OCR_DPI", "200"))
MIN_TEXT_CHARS_PER_PAGE = 40  # below this we treat the page as scanned and run OCR


def preprocess_files(files: List[Dict[str, Any]], *, max_pages: int = 80) -> List[Dict[str, Any]]:
    pages: List[Dict[str, Any]] = []
    page_budget = max_pages
    log.info("preprocess.start files=%d max_pages=%d", len(files), max_pages)

    for f in files:
        if page_budget <= 0:
            log.warning("preprocess.budget_exhausted skipping remaining files")
            break
        local = f["local_path"]
        mime = (f.get("mime_type") or "").lower()
        ftype = (f.get("fileType") or "OTHER").upper()
        log.info("preprocess.file.start name=%s mime=%s type=%s size=%s path=%s",
                 f.get("fileName"), mime, ftype, f.get("size_bytes"), local)

        try:
            if mime == "application/pdf" or local.lower().endswith(".pdf"):
                rendered = _process_pdf(f, local, page_budget)
            elif mime.startswith("image/"):
                rendered = _process_image(f, local)
            else:
                log.info("preprocess.file.skipped_unsupported name=%s mime=%s", f.get("fileName"), mime)
                continue

            log.info("preprocess.file.done name=%s pages_rendered=%d", f.get("fileName"), len(rendered))
            for p in rendered:
                pages.append(p)
                page_budget -= 1
                if page_budget <= 0:
                    break
        except Exception as exc:
            log.exception("preprocess.file.failed name=%s err=%s", f.get("fileName"), exc)

    log.info("preprocess.complete total_pages=%d remaining_budget=%d", len(pages), page_budget)
    return pages


def _process_pdf(file_meta: Dict[str, Any], path: str, budget: int) -> List[Dict[str, Any]]:
    import pdfplumber
    from pdf2image import convert_from_path

    out: List[Dict[str, Any]] = []
    text_per_page: List[str] = []
    log.info("pdf.open path=%s budget=%d dpi=%d", path, budget, OCR_DPI)
    try:
        with pdfplumber.open(path) as pdf:
            total_pages = len(pdf.pages)
            n = min(total_pages, budget)
            log.info("pdf.opened path=%s total_pages=%d will_process=%d", path, total_pages, n)
            for i in range(n):
                try:
                    txt = pdf.pages[i].extract_text() or ""
                    text_per_page.append(txt)
                    log.debug("pdf.text page=%d chars=%d", i + 1, len(txt))
                except Exception as exc:
                    log.warning("pdf.text.page_failed page=%d err=%s", i + 1, exc)
                    text_per_page.append("")
    except Exception as exc:
        log.exception("pdf.open.failed path=%s err=%s", path, exc)
        raise

    n = len(text_per_page)
    if n == 0:
        log.warning("pdf.empty path=%s — pdfplumber found 0 pages", path)
        return out

    log.info("pdf.rasterise path=%s pages=%d dpi=%d", path, n, OCR_DPI)
    try:
        images = convert_from_path(path, dpi=OCR_DPI, first_page=1, last_page=n)
    except Exception as exc:
        log.exception("pdf.rasterise.failed path=%s err=%s (is poppler installed?)", path, exc)
        raise
    tmpdir = tempfile.mkdtemp(prefix="pages-")
    log.info("pdf.rasterised path=%s images=%d tmpdir=%s", path, len(images), tmpdir)

    for idx, img in enumerate(images):
        page_no = idx + 1
        img_path = os.path.join(tmpdir, f"{file_meta.get('id','f')}-p{page_no}.png")
        img.save(img_path, "PNG")
        text = text_per_page[idx] if idx < len(text_per_page) else ""
        is_scanned = len(text.strip()) < MIN_TEXT_CHARS_PER_PAGE
        if is_scanned:
            log.info("pdf.page.ocr page=%d text_chars=%d (below threshold %d)",
                     page_no, len(text.strip()), MIN_TEXT_CHARS_PER_PAGE)
            text = _ocr(img_path)
            log.info("pdf.page.ocr.done page=%d ocr_chars=%d", page_no, len(text))
        else:
            log.debug("pdf.page.text page=%d chars=%d (no OCR needed)", page_no, len(text))
        out.append({
            "file_id": file_meta.get("id"),
            "file_name": file_meta.get("fileName"),
            "file_type": file_meta.get("fileType", "OTHER"),
            "page_no": page_no,
            "text": text,
            "image_path": img_path,
            "is_scanned": is_scanned,
            "width": img.width,
            "height": img.height,
        })
    log.info("pdf.done path=%s pages_out=%d", path, len(out))
    return out


def _process_image(file_meta: Dict[str, Any], path: str) -> List[Dict[str, Any]]:
    img = Image.open(path).convert("RGB")
    text = _ocr(path)
    return [{
        "file_id": file_meta.get("id"),
        "file_name": file_meta.get("fileName"),
        "file_type": file_meta.get("fileType", "IMAGE"),
        "page_no": 1,
        "text": text,
        "image_path": path,
        "is_scanned": True,
        "width": img.width,
        "height": img.height,
    }]


def _ocr(image_path: str) -> str:
    try:
        import pytesseract
        return pytesseract.image_to_string(Image.open(image_path)) or ""
    except Exception as exc:
        log.warning("OCR failed for %s: %s", image_path, exc)
        return ""
