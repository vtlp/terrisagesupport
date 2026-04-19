// Centralised lookup hook — reads from DB tables, caches in-memory, refreshes via realtime.
// Any change in Admin → Lookup Management instantly propagates everywhere.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type LookupKind = 'tags' | 'cities' | 'portals' | 'sources';

export interface LookupRow {
  id: string;
  name: string;
  key?: string | null;
  state?: string | null;
  is_active: boolean;
  sort_order: number;
}

const TABLES: Record<LookupKind, string> = {
  tags: 'lookup_tags',
  cities: 'lookup_cities',
  portals: 'lookup_portals',
  sources: 'lookup_enquiry_sources',
};

// ── In-memory cache shared across all consumers ─────────────────
type Cache = Record<LookupKind, LookupRow[]>;
const cache: Cache = { tags: [], cities: [], portals: [], sources: [] };
const listeners = new Set<() => void>();
const loaded: Record<LookupKind, boolean> = { tags: false, cities: false, portals: false, sources: false };
const loading: Record<LookupKind, Promise<void> | null> = { tags: null, cities: null, portals: null, sources: null };

function notify() { listeners.forEach(fn => fn()); }

async function loadKind(kind: LookupKind) {
  if (loading[kind]) return loading[kind]!;
  const p = (async () => {
    const { data, error } = await supabase
      .from(TABLES[kind] as 'lookup_tags')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (!error && data) {
      cache[kind] = data as unknown as LookupRow[];
      loaded[kind] = true;
      notify();
    }
  })();
  loading[kind] = p;
  await p;
  loading[kind] = null;
}

// Realtime — single subscription for the whole app
let realtimeStarted = false;
function ensureRealtime() {
  if (realtimeStarted) return;
  realtimeStarted = true;
  const channel = supabase.channel('lookups-live');
  (Object.keys(TABLES) as LookupKind[]).forEach(kind => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: TABLES[kind] }, () => {
      loaded[kind] = false;
      loadKind(kind);
    });
  });
  channel.subscribe();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function getSnapshot(kind: LookupKind): LookupRow[] {
  return cache[kind];
}

// ── Public hook ────────────────────────────────────────────────
export function useLookup(kind: LookupKind, opts?: { activeOnly?: boolean }) {
  const items = useSyncExternalStore(subscribe, () => getSnapshot(kind), () => getSnapshot(kind));
  useEffect(() => {
    ensureRealtime();
    if (!loaded[kind]) loadKind(kind);
  }, [kind]);
  const filtered = opts?.activeOnly === false ? items : items.filter(i => i.is_active);
  return filtered;
}

// Convenience: just the names (active, sorted)
export function useLookupNames(kind: LookupKind): string[] {
  const items = useLookup(kind);
  return items.map(i => i.name);
}

// ── CRUD (admin only — RLS enforces) ───────────────────────────
function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export async function createLookup(kind: LookupKind, name: string, extra?: { state?: string }) {
  const v = name.trim();
  if (!v) throw new Error('Name required');
  if (cache[kind].some(i => i.name.toLowerCase() === v.toLowerCase())) {
    throw new Error('Already exists');
  }
  const max = cache[kind].reduce((a, i) => Math.max(a, i.sort_order), -1);
  const payload: Record<string, unknown> = { name: v, sort_order: max + 1, is_active: true };
  if (kind === 'tags' || kind === 'portals' || kind === 'sources') payload.key = slugify(v);
  if (kind === 'cities' && extra?.state) payload.state = extra.state;
  if (kind === 'portals') payload.prerequisites = [];
  const { error } = await supabase.from(TABLES[kind] as 'lookup_tags').insert(payload as never);
  if (error) throw error;
  await loadKind(kind);
}

export async function updateLookup(kind: LookupKind, id: string, patch: Partial<Pick<LookupRow, 'name' | 'is_active' | 'sort_order' | 'state'>>) {
  const { error } = await supabase.from(TABLES[kind] as 'lookup_tags').update(patch as never).eq('id', id);
  if (error) throw error;
  await loadKind(kind);
}

export async function deleteLookup(kind: LookupKind, id: string) {
  const { error } = await supabase.from(TABLES[kind] as 'lookup_tags').delete().eq('id', id);
  if (error) throw error;
  await loadKind(kind);
}

// ── One-shot async fetch (for non-React contexts e.g. validators, edge logic) ──
export async function fetchLookupOnce(kind: LookupKind): Promise<string[]> {
  if (!loaded[kind]) await loadKind(kind);
  return cache[kind].filter(i => i.is_active).map(i => i.name);
}

// ── Eager preload helper (call once at app boot) ───────────────
export function preloadAllLookups() {
  ensureRealtime();
  (Object.keys(TABLES) as LookupKind[]).forEach(k => { if (!loaded[k]) loadKind(k); });
}
