// Marketing module data access — typed CRUD helpers.
import { supabase } from '@/integrations/supabase/client';

export type TenancyTypeDb = 'AGENCY_BROKERAGE_CONSULTANCY' | 'BUILDER_DEVELOPER';
export type CostItemType = 'ONLINE' | 'OFFLINE';

export interface MarketingTarget {
  id: string;
  year: number;
  tenancy_type: TenancyTypeDb;
  q1: number; q2: number; q3: number; q4: number;
  total_target: number;
}

export interface MarketingSettings {
  id: string;
  total_spend_override: number;
}

export interface MarketingReferral {
  id: string;
  referrer_name: string;
  referrer_phone: string | null;
  referrer_email: string | null;
  referred_company: string | null;
  city: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface MarketingContact {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  notes: string | null;
  created_at: string;
}

export interface MarketingChampion {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  reach: number;
  city: string | null;
  notes: string | null;
  created_at: string;
}

export interface MarketingEvent {
  id: string;
  event_name: string;
  location: string | null;
  city: string | null;
  event_date: string | null;
  attendees: number;
  notes: string | null;
  created_at: string;
}

export interface MarketingCostItem {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  cost_type: CostItemType;
  spend_date: string | null;
  city: string | null;
  notes: string | null;
  created_at: string;
}

// ── Targets ────────────────────────────────────────────────
export async function fetchTargets(year: number): Promise<MarketingTarget[]> {
  const { data, error } = await supabase
    .from('marketing_targets')
    .select('*')
    .eq('year', year);
  if (error) throw error;
  return (data ?? []) as MarketingTarget[];
}

export async function upsertTarget(
  year: number,
  tenancy_type: TenancyTypeDb,
  patch: Partial<Pick<MarketingTarget, 'q1' | 'q2' | 'q3' | 'q4' | 'total_target'>>,
): Promise<MarketingTarget> {
  // Try update first
  const existing = await supabase
    .from('marketing_targets').select('*').eq('year', year).eq('tenancy_type', tenancy_type).maybeSingle();
  if (existing.data) {
    const { data, error } = await supabase
      .from('marketing_targets').update(patch).eq('id', existing.data.id).select('*').single();
    if (error) throw error;
    return data as MarketingTarget;
  }
  const { data, error } = await supabase
    .from('marketing_targets')
    .insert({ year, tenancy_type, q1: 0, q2: 0, q3: 0, q4: 0, total_target: 0, ...patch })
    .select('*').single();
  if (error) throw error;
  return data as MarketingTarget;
}

// ── Settings ───────────────────────────────────────────────
export async function fetchSettings(): Promise<MarketingSettings | null> {
  const { data, error } = await supabase
    .from('marketing_settings').select('*').limit(1).maybeSingle();
  if (error) throw error;
  return data as MarketingSettings | null;
}

export async function updateTotalSpendOverride(value: number): Promise<void> {
  const current = await fetchSettings();
  if (current) {
    const { error } = await supabase
      .from('marketing_settings').update({ total_spend_override: value }).eq('id', current.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('marketing_settings').insert({ total_spend_override: value });
    if (error) throw error;
  }
}

// ── Generic list/create/delete helpers ─────────────────────
type RecordTable =
  | 'marketing_referrals'
  | 'marketing_contacts'
  | 'marketing_champions'
  | 'marketing_events'
  | 'marketing_cost_items';

export async function listRecords<T>(table: RecordTable): Promise<T[]> {
  const { data, error } = await supabase
    .from(table as 'marketing_referrals')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as T[];
}

export async function createRecord(table: RecordTable, payload: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from(table as 'marketing_referrals').insert(payload as never);
  if (error) throw error;
}

export async function updateRecord(table: RecordTable, id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from(table as 'marketing_referrals').update(patch as never).eq('id', id);
  if (error) throw error;
}

export async function deleteRecord(table: RecordTable, id: string): Promise<void> {
  const { error } = await supabase.from(table as 'marketing_referrals').delete().eq('id', id);
  if (error) throw error;
}

// ── Geography count across all marketing records ───────────
export async function fetchGeographyCounts(): Promise<Record<string, number>> {
  const tables: RecordTable[] = [
    'marketing_referrals', 'marketing_contacts', 'marketing_champions', 'marketing_events', 'marketing_cost_items',
  ];
  const results = await Promise.all(
    tables.map(t => supabase.from(t as 'marketing_referrals').select('city')),
  );
  const counts: Record<string, number> = {};
  results.forEach(({ data }) => {
    (data ?? []).forEach((row: { city: string | null }) => {
      const c = (row.city ?? '').trim().toLowerCase();
      if (!c) return;
      counts[c] = (counts[c] ?? 0) + 1;
    });
  });
  return counts;
}
