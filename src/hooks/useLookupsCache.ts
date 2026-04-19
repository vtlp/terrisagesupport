// Tiny non-React accessor for the lookup cache populated by useLookups.
// Lets non-hook helpers (e.g. getCityOptions) read live values without
// pulling React into the data layer.

import type { LookupKind, LookupRow } from './useLookups';

const cache: Record<LookupKind, LookupRow[]> = {
  tags: [], cities: [], portals: [], sources: [],
};

export function __setLookupCache(kind: LookupKind, rows: LookupRow[]) {
  cache[kind] = rows;
}

export function __lookupCacheNames(kind: LookupKind): string[] {
  return cache[kind].filter(r => r.is_active).map(r => r.name);
}
