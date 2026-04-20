import { supabase } from '@/integrations/supabase/client';
import {
  TicketPriority, TicketStatus, TicketType, TicketCategory,
  EntityType, TimelineEventType, type SupportTicket, type TimelineEntry,
} from '@/types/core';

// ── DB row shapes (what we select) ─────────────
export interface DbTicketRow {
  id: string;
  ticket_code: string | null;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  type: TicketType;
  category: TicketCategory;
  account_id: string | null;
  requester_name: string;
  requester_email: string | null;
  requester_phone: string | null;
  assigned_to: string | null;
  queue_id: string | null;
  tags: string[];
  market_city: string | null;
  sla_first_response_at: string | null;
  sla_resolution_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbTicketMessage {
  id: string;
  ticket_id: string;
  body: string;
  is_internal: boolean;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
}

export interface DbActivityRow {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  summary: string;
  actor_id: string | null;
  created_at: string;
}

export interface QueueRow { id: string; name: string; key: string; description: string | null; default_assignee: string | null; is_active: boolean; sort_order: number }
export interface ProfileRow { id: string; full_name: string; email: string }
export interface AccountRow { id: string; account_name: string; owner_phone: string | null; owner_email: string | null }

// ── SLA defaults (hours) ───────────────────────
const SLA_HOURS: Record<TicketPriority, { first: number; res: number }> = {
  [TicketPriority.P1]: { first: 1, res: 4 },
  [TicketPriority.P2]: { first: 4, res: 24 },
  [TicketPriority.P3]: { first: 24, res: 72 },
  [TicketPriority.P4]: { first: 48, res: 120 },
};

export function computeSla(priority: TicketPriority, base = new Date()) {
  const h = SLA_HOURS[priority];
  return {
    sla_first_response_at: new Date(base.getTime() + h.first * 3600000).toISOString(),
    sla_resolution_at: new Date(base.getTime() + h.res * 3600000).toISOString(),
  };
}

// ── DB → UI mapping ────────────────────────────
export function mapDbTicketToUi(
  row: DbTicketRow,
  queueName: string | undefined,
  messages: DbTicketMessage[],
  activity: DbActivityRow[],
): SupportTicket {
  const timeline: TimelineEntry[] = [
    ...activity.map<TimelineEntry>(a => ({
      id: `A_${a.id}`,
      type: a.event_type === 'STAGE_CHANGE' ? TimelineEventType.STATUS_CHANGE
        : a.event_type === 'FIELD_EDIT' ? TimelineEventType.SYSTEM
        : TimelineEventType.SYSTEM,
      content: a.summary,
      user_id: a.actor_id,
      created_at: a.created_at,
    })),
    ...messages.map<TimelineEntry>(m => ({
      id: `M_${m.id}`,
      type: m.is_internal ? TimelineEventType.INTERNAL_NOTE : TimelineEventType.AGENT_REPLY,
      content: m.body,
      user_id: m.author_id,
      created_at: m.created_at,
    })),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return {
    ticket_id: row.id,
    ticket_code: row.ticket_code,
    subject: row.subject,
    description: row.description ?? '',
    status: row.status,
    priority: row.priority,
    type: row.type,
    category: row.category,
    account_id: row.account_id,
    requester_name: row.requester_name,
    requester_email: row.requester_email ?? '',
    assigned_to_user_id: row.assigned_to,
    queue: queueName ?? '',
    tags: row.tags ?? [],
    sla_first_response: row.sla_first_response_at,
    sla_resolution: row.sla_resolution_at,
    first_response_at: row.first_response_at,
    resolved_at: row.resolved_at,
    timeline,
    attachments: [],
    notes_thread: [],
    linked_entity_type: row.related_entity_type as EntityType | null,
    linked_entity_id: row.related_entity_id,
    market_field: row.market_city ?? '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── Fetchers ───────────────────────────────────
export async function fetchTicketList() {
  const [{ data: tickets, error }, { data: queues }] = await Promise.all([
    supabase.from('tickets').select('*').order('updated_at', { ascending: false }).limit(500),
    supabase.from('ticket_queues').select('id,name'),
  ]);
  if (error) throw error;
  const queueMap = new Map<string, string>((queues ?? []).map(q => [q.id, q.name]));
  const rows = (tickets ?? []) as DbTicketRow[];
  return rows.map(r => mapDbTicketToUi(r, queueMap.get(r.queue_id ?? ''), [], []));
}

export async function fetchTicketDetail(ticketId: string): Promise<SupportTicket | null> {
  const [{ data: row }, { data: msgs }, { data: acts }, { data: queues }] = await Promise.all([
    supabase.from('tickets').select('*').eq('id', ticketId).maybeSingle(),
    supabase.from('ticket_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
    supabase.from('activity_log').select('id,entity_type,entity_id,event_type,summary,actor_id,created_at')
      .eq('entity_type', 'TICKET').eq('entity_id', ticketId).order('created_at', { ascending: true }),
    supabase.from('ticket_queues').select('id,name'),
  ]);
  if (!row) return null;
  const queueMap = new Map<string, string>((queues ?? []).map(q => [q.id, q.name]));
  return mapDbTicketToUi(
    row as DbTicketRow,
    queueMap.get((row as DbTicketRow).queue_id ?? ''),
    (msgs ?? []) as DbTicketMessage[],
    (acts ?? []) as DbActivityRow[],
  );
}

export async function fetchProfiles(): Promise<ProfileRow[]> {
  const { data } = await supabase.from('profiles').select('id,full_name,email').eq('is_active', true);
  return (data ?? []) as ProfileRow[];
}

export async function fetchAccountsLite(): Promise<AccountRow[]> {
  const { data } = await supabase.from('accounts').select('id,account_name,owner_phone,owner_email').order('account_name');
  return (data ?? []) as AccountRow[];
}

export async function fetchQueues(): Promise<QueueRow[]> {
  const { data } = await supabase.from('ticket_queues').select('*').order('sort_order');
  return (data ?? []) as QueueRow[];
}

// ── Mutations ─────────────────────────────────
export interface CreateTicketInput {
  subject: string;
  description: string;
  priority: TicketPriority;
  status?: TicketStatus;
  type: TicketType;
  category: TicketCategory;
  account_id: string | null;
  requester_name: string;
  requester_email: string | null;
  assigned_to: string | null;
  queue_id: string | null;
  tags: string[];
  market_city: string | null;
}

export async function createTicket(input: CreateTicketInput): Promise<SupportTicket> {
  const sla = computeSla(input.priority);
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('tickets')
    .insert({
      subject: input.subject,
      description: input.description,
      priority: input.priority,
      status: input.status ?? TicketStatus.OPEN,
      type: input.type,
      category: input.category,
      account_id: input.account_id,
      requester_name: input.requester_name,
      requester_email: input.requester_email,
      assigned_to: input.assigned_to,
      queue_id: input.queue_id,
      tags: input.tags,
      market_city: input.market_city,
      created_by: user?.id ?? null,
      ...sla,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbTicketToUi(data as DbTicketRow, undefined, [], []);
}

export interface UpdateTicketInput {
  subject?: string;
  description?: string;
  priority?: TicketPriority;
  status?: TicketStatus;
  type?: TicketType;
  category?: TicketCategory;
  account_id?: string | null;
  requester_name?: string;
  requester_email?: string | null;
  assigned_to?: string | null;
  queue_id?: string | null;
  tags?: string[];
  market_city?: string | null;
  resolution_notes?: string | null;
}

export async function updateTicket(id: string, patch: UpdateTicketInput) {
  const { error } = await supabase.from('tickets').update(patch).eq('id', id);
  if (error) throw error;
}

export async function addTicketMessage(ticketId: string, body: string, isInternal: boolean) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle() : { data: null };
  const { error } = await supabase.from('ticket_messages').insert({
    ticket_id: ticketId,
    body,
    is_internal: isInternal,
    author_id: user?.id ?? null,
    author_name: profile?.full_name ?? null,
  });
  if (error) throw error;
}

export function subscribeTicketChanges(onChange: () => void) {
  const channel = supabase
    .channel('tickets-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_messages' }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
