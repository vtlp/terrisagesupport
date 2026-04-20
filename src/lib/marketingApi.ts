// Marketing module data access — typed CRUD helpers.
import { supabase } from '@/integrations/supabase/client';

export type TenancyTypeDb = 'AGENCY_BROKERAGE_CONSULTANCY' | 'BUILDER_DEVELOPER';
export type CostItemType = 'ONLINE' | 'OFFLINE';

export type ContactType =
  | 'Adviser/Mentor'
  | 'Champion (non user)'
  | 'CRM CP'
  | 'Investor'
  | 'Media/PR'
  | 'Potential Hire'
  | 'Prospect Customer'
  | 'Strategic Partner'
  | 'Vendor/Service Provider'
  | 'VIP';

export const CONTACT_TYPES: ContactType[] = [
  'Adviser/Mentor',
  'Champion (non user)',
  'CRM CP',
  'Investor',
  'Media/PR',
  'Potential Hire',
  'Prospect Customer',
  'Strategic Partner',
  'Vendor/Service Provider',
  'VIP',
];

export const REFERRER_ELIGIBLE_TYPES: ContactType[] = [
  'Champion (non user)',
  'CRM CP',
  'Investor',
  'Media/PR',
  'Strategic Partner',
  'Vendor/Service Provider',
];

export type ReferralStatus = 'Closed' | 'In Process' | 'New' | 'Paid' | 'Pending' | 'Referred' | 'Rejected';
export const REFERRAL_STATUSES: ReferralStatus[] = ['Closed', 'In Process', 'New', 'Paid', 'Pending', 'Referred', 'Rejected'];

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

export interface ContactAttachment {
  path: string;
  name: string;
  size: number;
  mime: string | null;
  uploaded_at: string;
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
  contact_type: ContactType;
  attachments: ContactAttachment[];
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
  updated_at?: string;
}

export interface MarketingReferralRecord {
  id: string;
  contact_id: string;
  referral_date: string;
  status: ReferralStatus;
  seats_referred: number;
  commission_pct: number;
  price_per_seat: number;
  notes: string | null;
  created_at: string;
}

// ── Targets ────────────────────────────────────────────────
export async function fetchTargets(year: number): Promise<MarketingTarget[]> {
  const { data, error } = await supabase.from('marketing_targets').select('*').eq('year', year);
  if (error) throw error;
  return (data ?? []) as MarketingTarget[];
}

export async function upsertTarget(
  year: number,
  tenancy_type: TenancyTypeDb,
  patch: Partial<Pick<MarketingTarget, 'q1' | 'q2' | 'q3' | 'q4' | 'total_target'>>,
): Promise<MarketingTarget> {
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
  const { data, error } = await supabase.from('marketing_settings').select('*').limit(1).maybeSingle();
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
    const { error } = await supabase.from('marketing_settings').insert({ total_spend_override: value });
    if (error) throw error;
  }
}

// ── Contacts ───────────────────────────────────────────────
export async function listContacts(): Promise<MarketingContact[]> {
  const { data, error } = await supabase.from('marketing_contacts').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(d => ({ ...d, attachments: (d.attachments ?? []) as unknown as ContactAttachment[] })) as MarketingContact[];
}

export async function createContact(payload: Partial<MarketingContact> & { name: string; contact_type: ContactType }): Promise<MarketingContact> {
  const { data, error } = await supabase.from('marketing_contacts').insert({
    name: payload.name,
    contact_type: payload.contact_type,
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    city: payload.city ?? null,
    notes: payload.notes ?? null,
    title: payload.title ?? null,
    company: payload.company ?? null,
    attachments: (payload.attachments ?? []) as unknown as never,
  }).select('*').single();
  if (error) throw error;
  return { ...data, attachments: (data.attachments ?? []) as unknown as ContactAttachment[] } as MarketingContact;
}

export async function updateContact(id: string, patch: Partial<MarketingContact>): Promise<void> {
  const sanitized: Record<string, unknown> = { ...patch };
  if (sanitized.attachments) sanitized.attachments = sanitized.attachments as unknown;
  const { error } = await supabase.from('marketing_contacts').update(sanitized as never).eq('id', id);
  if (error) throw error;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from('marketing_contacts').delete().eq('id', id);
  if (error) throw error;
}

// ── Contact attachments (storage) ──────────────────────────
export async function uploadContactAttachment(contactId: string, file: File): Promise<ContactAttachment> {
  const path = `${contactId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('contact-attachments').upload(path, file, { upsert: false });
  if (error) throw error;
  return { path, name: file.name, size: file.size, mime: file.type || null, uploaded_at: new Date().toISOString() };
}

export async function getAttachmentSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('contact-attachments').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteAttachmentFile(path: string): Promise<void> {
  await supabase.storage.from('contact-attachments').remove([path]);
}

// ── Events / Cost items (generic helpers, kept simple) ─────
type RecordTable = 'marketing_events' | 'marketing_cost_items';

export async function listRecords<T>(table: RecordTable): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as T[];
}

export async function createRecord(table: RecordTable, payload: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from(table).insert(payload as never);
  if (error) throw error;
}

export async function updateRecord(table: RecordTable, id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from(table).update(patch as never).eq('id', id);
  if (error) throw error;
}

export async function deleteRecord(table: RecordTable, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

// ── Referral records ───────────────────────────────────────
export async function listReferralRecords(): Promise<MarketingReferralRecord[]> {
  const { data, error } = await supabase.from('marketing_referral_records').select('*').order('referral_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MarketingReferralRecord[];
}

export async function createReferralRecord(payload: Omit<MarketingReferralRecord, 'id' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('marketing_referral_records').insert(payload);
  if (error) throw error;
}

export async function updateReferralRecord(id: string, patch: Partial<MarketingReferralRecord>): Promise<void> {
  const { error } = await supabase.from('marketing_referral_records').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteReferralRecord(id: string): Promise<void> {
  const { error } = await supabase.from('marketing_referral_records').delete().eq('id', id);
  if (error) throw error;
}

// ── Geography count across marketing records ───────────────
export async function fetchGeographyCounts(): Promise<Record<string, number>> {
  const [contacts, events, costs] = await Promise.all([
    supabase.from('marketing_contacts').select('city'),
    supabase.from('marketing_events').select('city'),
    supabase.from('marketing_cost_items').select('city'),
  ]);
  const counts: Record<string, number> = {};
  [contacts, events, costs].forEach(({ data }) => {
    (data ?? []).forEach((row: { city: string | null }) => {
      const c = (row.city ?? '').trim().toLowerCase();
      if (!c) return;
      counts[c] = (counts[c] ?? 0) + 1;
    });
  });
  return counts;
}
