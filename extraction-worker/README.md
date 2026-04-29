# Terrisage Brochure Extraction Worker

A FastAPI service that ingests real-estate brochures (text + scanned PDFs, images) and returns
normalized project data, configurations, floor-plan crops, media manifest, and review hints to
the Terrisage Support Console via an HMAC-signed webhook.

This service is **deployed separately** from the Lovable Support Console because Lovable's
edge runtime (Deno) cannot run Python, OCR, or OpenCV. The Support Console signs short-lived
URLs for each uploaded file, dispatches them here, and waits for an async callback.

## Architecture

```
[Support Console]
   │  POST /extract  (HMAC-signed payload with signed URLs + callbackUrl)
   ▼
[This worker]
   │  1. Verify HMAC signature
   │  2. Enqueue background task (BackgroundTasks)
   │  3. Return 202 immediately with workerJobId
   │
   │  [background]
   │   - Download each signed URL
   │   - PDF text extraction (pdfplumber) + OCR fallback (pytesseract)
   │   - Layout analysis & field extraction (regex + heuristics)
   │   - Floor-plan detection & carving (OpenCV)
   │   - Build normalized payload
   │
   │  POST {callbackUrl}  (HMAC-signed result)
   ▼
[Support Console extraction-callback]
```

## Endpoints

- `POST /extract` — accept a job. HMAC-verified. Returns 202.
- `GET  /healthz` — liveness probe.

## Required environment variables

| Var | Purpose |
|---|---|
| `EXTRACTION_HMAC_SECRET` | Shared secret with Support Console. **Must match** `EXTRACTION_HMAC_SECRET` set in Lovable. |
| `WORKER_PORT` | Port to bind (default 8080). |
| `LOG_LEVEL` | `INFO` / `DEBUG`. |
| `MAX_PAGES` | Hard cap on pages processed per file (default 80). |
| `OCR_DPI` | DPI for rasterising PDFs before OCR (default 200). |

## Local development

```bash
cd extraction-worker
cp .env.example .env
# edit .env and set EXTRACTION_HMAC_SECRET to the same value as the Lovable secret

# Option 1: Docker (recommended; bundles tesseract & poppler)
docker build -t terrisage-extraction .
docker run --rm -p 8080:8080 --env-file .env terrisage-extraction

# Option 2: Local Python (requires system tesseract + poppler-utils)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

Then point `EXTRACTION_SERVICE_URL` in Lovable Cloud secrets to your worker's public URL
(e.g. `https://terrisage-extraction.fly.dev`).

## Deploy

### Render (simplest)

1. New Web Service → connect this folder.
2. Runtime: **Docker**. Render auto-detects the `Dockerfile`.
3. Environment: add `EXTRACTION_HMAC_SECRET` (same value as Lovable).
4. Deploy. Copy the public URL.
5. In Lovable: set `EXTRACTION_SERVICE_URL` and `EXTRACTION_HMAC_SECRET` secrets.

### Fly.io

```bash
fly launch --no-deploy
fly secrets set EXTRACTION_HMAC_SECRET=<same-as-lovable>
fly deploy
```

### Railway

1. New project → Deploy from repo → choose `extraction-worker/`.
2. Add `EXTRACTION_HMAC_SECRET` env var.
3. Railway auto-uses `Dockerfile`.

## Security model

- **Inbound**: every `POST /extract` must carry `x-extraction-timestamp` and
  `x-extraction-signature` headers. Signature is `hex(HMAC_SHA256(secret, "{ts}.{rawBody}"))`.
  Requests outside a 5-minute window are rejected.
- **Outbound** (callback): the worker signs its callback the same way. The Support Console
  verifies before persisting.
- **File access**: the worker does NOT need Supabase credentials. It downloads via the
  short-lived signed URLs in the payload.

## Tuning the extraction pipeline

The pipeline lives in `app/pipeline/`:

- `ingest.py` — download files, sniff types
- `preprocess.py` — render PDF pages, OCR scanned pages, deskew/orient
- `extract_fields.py` — regex + keyword heuristics for project/config fields
- `floorplans.py` — OpenCV-based floor-plan detection and carving
- `normalize.py` — assemble final payload, derive plot config suggestions

Each module is independently improvable. Add new field heuristics in `extract_fields.py`
without touching the orchestrator. Tune carving thresholds in `floorplans.py`
(`MIN_PLAN_AREA_RATIO`, `EXPAND_MARGIN_PX`).

## Mock parity

The Lovable side has its own simulate mode that bypasses this worker entirely. This worker
also exposes `POST /extract` with `?mock=1` which returns the same canned payload via callback,
useful when you want to exercise the **real network path** (HMAC signing, callback flow,
DB persistence) without doing any real OCR.
