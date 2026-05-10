"""Download signed URLs to local temp files and sniff their type.

Emits very verbose logs so production failures can be diagnosed from container logs.
"""
from __future__ import annotations

import logging
import mimetypes
import os
import tempfile
import time
from typing import Any, Dict, List
from urllib.parse import urlparse

import httpx

log = logging.getLogger("extraction-worker.ingest")


def _redact_url(url: str) -> str:
    """Strip query string from signed URLs so they're safe to log."""
    try:
        p = urlparse(url)
        return f"{p.scheme}://{p.netloc}{p.path}"
    except Exception:
        return "<unparseable-url>"


def download_files(files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Download each signed URL to a temp file. Returns enriched dicts with `local_path`.

    Per-file errors are logged AND returned in the dict (`download_error`) so the
    caller / callback can surface the exact reason without log diving.
    """
    out: List[Dict[str, Any]] = []
    failures: List[Dict[str, Any]] = []
    tmpdir = tempfile.mkdtemp(prefix="extract-")
    log.info("ingest.start tmpdir=%s file_count=%d", tmpdir, len(files))

    if not files:
        log.warning("ingest.no_files_received — caller passed an empty files[] array")
        return out

    with httpx.Client(timeout=120.0, follow_redirects=True) as client:
        for idx, f in enumerate(files):
            url = f.get("signedUrl")
            name = f.get("fileName") or (os.path.basename(urlparse(url).path) if url else f"file-{idx}.bin")
            file_id = f.get("fileId") or f.get("id") or "<no-id>"
            log_ctx = {"idx": idx, "file_id": file_id, "name": name, "url": _redact_url(url or "")}

            if not url:
                log.error("ingest.missing_url %s", log_ctx)
                failures.append({**log_ctx, "error": "missing signedUrl"})
                continue

            local_path = os.path.join(tmpdir, name)
            t0 = time.time()
            try:
                log.info("ingest.download.start %s", log_ctx)
                with client.stream("GET", url) as resp:
                    log.info(
                        "ingest.download.response status=%s content_length=%s content_type=%s file=%s",
                        resp.status_code,
                        resp.headers.get("content-length"),
                        resp.headers.get("content-type"),
                        name,
                    )
                    if resp.status_code >= 400:
                        body_preview = ""
                        try:
                            body_preview = resp.read().decode("utf-8", errors="replace")[:500]
                        except Exception:
                            pass
                        log.error(
                            "ingest.download.http_error status=%s file=%s body=%r",
                            resp.status_code, name, body_preview,
                        )
                        failures.append({
                            **log_ctx,
                            "error": f"HTTP {resp.status_code}",
                            "body_preview": body_preview,
                        })
                        continue
                    written = 0
                    with open(local_path, "wb") as fh:
                        for chunk in resp.iter_bytes():
                            fh.write(chunk)
                            written += len(chunk)
                elapsed = round(time.time() - t0, 3)
                log.info(
                    "ingest.download.ok file=%s bytes=%d elapsed_s=%s path=%s",
                    name, written, elapsed, local_path,
                )
            except httpx.TimeoutException as exc:
                log.exception("ingest.download.timeout file=%s url=%s err=%s", name, _redact_url(url), exc)
                failures.append({**log_ctx, "error": f"timeout: {exc}"})
                continue
            except httpx.HTTPError as exc:
                log.exception("ingest.download.http_exc file=%s url=%s err=%s", name, _redact_url(url), exc)
                failures.append({**log_ctx, "error": f"http error: {exc}"})
                continue
            except Exception as exc:
                log.exception("ingest.download.unexpected file=%s err=%s", name, exc)
                failures.append({**log_ctx, "error": f"unexpected: {exc}"})
                continue

            mime = f.get("mimeType") or mimetypes.guess_type(name)[0] or "application/octet-stream"
            try:
                size_bytes = os.path.getsize(local_path)
            except OSError as exc:
                log.error("ingest.stat_failed file=%s err=%s", local_path, exc)
                failures.append({**log_ctx, "error": f"stat failed: {exc}"})
                continue

            log.info(
                "ingest.file.ready name=%s mime=%s size=%d",
                name, mime, size_bytes,
            )
            out.append({
                **f,
                "local_path": local_path,
                "mime_type": mime,
                "size_bytes": size_bytes,
            })

    log.info(
        "ingest.complete downloaded=%d failed=%d total=%d",
        len(out), len(failures), len(files),
    )
    if failures:
        log.warning("ingest.failures detail=%s", failures)
    # Stash failures on the first dict so runner can include them in the callback.
    if out:
        out[0].setdefault("_ingest_failures", failures)
    elif failures:
        # Return a sentinel so runner can still surface failures.
        return [{"_ingest_failures": failures, "_no_files": True}]
    return out
