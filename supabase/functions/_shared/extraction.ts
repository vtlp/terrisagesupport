// Shared utilities for the extraction service edge functions.
// Keep this file dependency-free apart from std crypto.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-extraction-signature, x-extraction-timestamp',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export function errorResponse(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return jsonResponse({ error: message, ...extra }, status);
}

// ----------- HMAC signing / verification -----------
// Convention: signature = hex(HMAC_SHA256(secret, `${timestamp}.${rawBody}`))
// Header `x-extraction-timestamp` (unix seconds), `x-extraction-signature`.
// We accept a 5-minute clock skew window to mitigate replay.

const enc = new TextEncoder();

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signPayload(secret: string, timestamp: string, rawBody: string): Promise<string> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${rawBody}`));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifySignature(
  secret: string,
  timestamp: string,
  rawBody: string,
  providedHex: string,
  toleranceSeconds = 300,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!timestamp || !providedHex) return { ok: false, reason: 'missing signature headers' };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'invalid timestamp' };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSeconds) return { ok: false, reason: 'timestamp outside tolerance window' };

  const expected = await signPayload(secret, timestamp, rawBody);
  // constant-time compare
  if (expected.length !== providedHex.length) return { ok: false, reason: 'signature mismatch' };
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ providedHex.charCodeAt(i);
  }
  return diff === 0 ? { ok: true } : { ok: false, reason: 'signature mismatch' };
}

// ----------- State machine -----------
export type ExtractionStatus =
  | 'DRAFT'
  | 'QUEUED'
  | 'PREPROCESSING'
  | 'EXTRACTING'
  | 'NEEDS_REVIEW'
  | 'FAILED'
  | 'READY_TO_IMPORT'
  | 'IMPORTED'
  | 'PARTIALLY_IMPORTED';

const TRANSITIONS: Record<ExtractionStatus, ExtractionStatus[]> = {
  DRAFT: ['QUEUED', 'FAILED'],
  QUEUED: ['PREPROCESSING', 'EXTRACTING', 'FAILED'],
  PREPROCESSING: ['EXTRACTING', 'FAILED'],
  EXTRACTING: ['NEEDS_REVIEW', 'FAILED'],
  NEEDS_REVIEW: ['READY_TO_IMPORT', 'EXTRACTING', 'FAILED'], // EXTRACTING = retry
  FAILED: ['QUEUED', 'EXTRACTING'], // retry
  READY_TO_IMPORT: ['IMPORTED', 'PARTIALLY_IMPORTED', 'NEEDS_REVIEW'],
  IMPORTED: [],
  PARTIALLY_IMPORTED: ['IMPORTED'],
};

export function canTransition(from: ExtractionStatus, to: ExtractionStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// ----------- Auth helper -----------
export function getBearer(req: Request): string | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice('Bearer '.length);
}
