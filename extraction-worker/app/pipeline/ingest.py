"""Download signed URLs to local temp files and sniff their type."""
from __future__ import annotations

import logging
import mimetypes
import os
import tempfile
from typing import Any, Dict, List
from urllib.parse import urlparse

import httpx

log = logging.getLogger("extraction-worker.ingest")


def download_files(files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Download each signed URL to a temp file. Returns enriched dicts with `local_path`."""
    out: List[Dict[str, Any]] = []
    tmpdir = tempfile.mkdtemp(prefix="extract-")
    with httpx.Client(timeout=120.0, follow_redirects=True) as client:
        for f in files:
            url = f.get("signedUrl")
            if not url:
                continue
            name = f.get("fileName") or os.path.basename(urlparse(url).path) or "file.bin"
            local_path = os.path.join(tmpdir, name)
            try:
                with client.stream("GET", url) as resp:
                    resp.raise_for_status()
                    with open(local_path, "wb") as fh:
                        for chunk in resp.iter_bytes():
                            fh.write(chunk)
            except Exception as exc:
                log.warning("download failed for %s: %s", name, exc)
                continue

            mime = f.get("mimeType") or mimetypes.guess_type(name)[0] or "application/octet-stream"
            out.append({
                **f,
                "local_path": local_path,
                "mime_type": mime,
                "size_bytes": os.path.getsize(local_path),
            })
    return out
