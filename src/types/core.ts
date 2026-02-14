// =============================================
// Terrisage Support UI — Authoritative Data Model
// =============================================

// ── Enums ──────────────────────────────────────

export enum UserRole {
  ADMIN = 'ADMIN',
  SUPPORT_AGENT = 'SUPPORT_AGENT',
}

export enum TenancyType {
  AGENCY_BROKERAGE_CONSULTANCY = 'AGENCY_BROKERAGE_CONSULTANCY',
  BUILDER_DEVELOPER = 'BUILDER_DEVELOPER',
}

export enum EnquiryStage {
  NEW_ENQUIRY = 'NEW_ENQUIRY',
  CONTACTED = 'CONTACTED',
  DEMO_SCHEDULED = 'DEMO_SCHEDULED',
  DEMO_COMPLETED = 'DEMO_COMPLETED',
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
}

export enum EnquirySource {
  CALL_DIRECT = 'CALL_DIRECT',
  LANDING_PAGE = 'LANDING_PAGE',
  META_ADS = 'META_ADS',
  CHAMPION_PARTNER = 'CHAMPION_PARTNER',
  CP_REQUEST_PROJECTS = 'CP_REQUEST_PROJECTS',
}

export enum EnquiryOutcome {
  INTERESTED = 'INTERESTED',
  CALL_LATER = 'CALL_LATER',
  SCHEDULE_DEMO = 'SCHEDULE_DEMO',
  NOT_INTERESTED = 'NOT_INTERESTED',
  WRONG_OR_BOUNCED_NUMBER = 'WRONG_OR_BOUNCED_NUMBER',
}

export enum NotInterestedReason {
  OTHER_CRM_IN_USE = 'OTHER_CRM_IN_USE',
  NOT_RIGHT_PERSON = 'NOT_RIGHT_PERSON',
  NOT_RIGHT_TIME = 'NOT_RIGHT_TIME',
  TOO_MANY_REQUIREMENTS = 'TOO_MANY_REQUIREMENTS',
  BUDGET_CONCERN = 'BUDGET_CONCERN',
  OTHER = 'OTHER',
}

export enum DemoOutcome {
  NO_SHOW = 'NO_SHOW',
  LIKED_WANT_ONBOARD_SOON = 'LIKED_WANT_ONBOARD_SOON',
  GHOSTED = 'GHOSTED',
}

export enum FocusArea {
  SALES = 'SALES',
  RENTALS = 'RENTALS',
}

export enum SalesFocus {
  PRIMARY_ONLY = 'PRIMARY_ONLY',
  PRIMARY_AND_SECONDARY = 'PRIMARY_AND_SECONDARY',
  LUXURY_ONLY = 'LUXURY_ONLY',
}

export enum PrimaryPropertyType {
  PLOT = 'PLOT',
  APARTMENT = 'APARTMENT',
  VILLA = 'VILLA',
  OTHER = 'OTHER',
}

export enum AccountStatus {
  LIVE = 'LIVE',
  ONBOARDING_IN_PROGRESS = 'ONBOARDING_IN_PROGRESS',
  DEACTIVATED = 'DEACTIVATED',
  STALLED_ONBOARDING = 'STALLED_ONBOARDING',
}

export enum VerificationStatus {
  NOT_STARTED = 'NOT_STARTED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
}

export enum CalendarEventStatus {
  UPCOMING = 'UPCOMING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum EntityType {
  ENQUIRY = 'ENQUIRY',
  ACCOUNT = 'ACCOUNT',
  TICKET = 'TICKET',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TicketStatus {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_ON_CLIENT = 'WAITING_ON_CLIENT',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum KBBucket {
  SALES_CONTENT = 'SALES_CONTENT',
  CHECKLISTS = 'CHECKLISTS',
  SUPPORT_UI_GUIDE = 'SUPPORT_UI_GUIDE',
  PLATFORM_GUIDES = 'PLATFORM_GUIDES',
  BUILDER_WORKSHEETS = 'BUILDER_WORKSHEETS',
  CRM_TEMPLATES = 'CRM_TEMPLATES',
  BULK_IMPORT_TEMPLATES = 'BULK_IMPORT_TEMPLATES',
  DEMO_TIPS = 'DEMO_TIPS',
  ONBOARDING_PACKS = 'ONBOARDING_PACKS',
}

export enum MarketingObjectType {
  REFERRAL = 'REFERRAL',
  CONTACT = 'CONTACT',
  CHAMPION = 'CHAMPION',
  COLD_CALL_LEAD = 'COLD_CALL_LEAD',
  LEAD_SOURCE_REPOSITORY_ITEM = 'LEAD_SOURCE_REPOSITORY_ITEM',
  EVENT = 'EVENT',
  COST_ITEM = 'COST_ITEM',
}

export enum MarketingCostType {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

export enum ImportType {
  LEADS = 'LEADS',
  PROJECTS = 'PROJECTS',
  SECONDARY_LISTINGS = 'SECONDARY_LISTINGS',
  ENQUIRIES = 'ENQUIRIES',
}

export enum IngestionStatus {
  FAILED = 'FAILED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum KBFileType {
  PDF = 'pdf',
  XLSX = 'xlsx',
  CSV = 'csv',
  DOCX = 'docx',
  PPTX = 'pptx',
  PNG = 'png',
  JPG = 'jpg',
  JSON = 'json',
  TXT = 'txt',
  OTHER = 'other',
}

export enum SeatRequestUrgency {
  NORMAL = 'NORMAL',
  URGENT = 'URGENT',
}

// ── Interfaces ─────────────────────────────────

export interface User {
  user_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
}

export interface Note {
  note_id: string;
  entity_type: EntityType;
  entity_id: string;
  note_text: string;
  created_by_user_id: string;
  created_at: string;
}

export interface DocumentAttachment {
  document_id: string;
  entity_type: EntityType;
  entity_id: string;
  folder_path: string;
  file_name: string;
  file_url: string;
  uploaded_by_user_id: string;
  created_at: string;
}

export interface CalendarEvent {
  event_id: string;
  entity_type: EntityType;
  entity_id: string;
  title: string;
  scheduled_at: string;
  created_by_user_id: string;
  notes?: string;
  status: CalendarEventStatus;
  created_at: string;
  updated_at: string;
}

export interface Enquiry {
  enquiry_id: string;
  company_name: string;
  contact_name: string;
  contact_phone: string;
  contact_phone_alt: string;
  contact_email: string;
  whatsapp_enabled: boolean;
  tenancy_type: TenancyType | null;
  city: string;
  source: EnquirySource;
  stage: EnquiryStage;
  outcome: EnquiryOutcome | null;
  not_interested_reason: NotInterestedReason | null;
  not_interested_text: string;
  demo_outcome: DemoOutcome | null;
  assigned_to_user_id: string | null;
  notes_thread: string[]; // note_ids
  focus_area: FocusArea[];
  sales_focus: SalesFocus[];
  primary_property_types: PrimaryPropertyType[];
  team_size_estimate: number | null;
  current_system_text: string;
  approx_onboarding_date: string | null;
  portals_in_use: string[];
  demo_event_id: string | null;
  onboarding_pack_sent: boolean;
  onboarding_pack_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  completed_at: string | null;
  completed_by_user_id: string | null;
}

export interface Account {
  account_id: string;
  account_name: string;
  city: string;
  tenancy_type: TenancyType;
  status: AccountStatus;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  verification_pan_status: VerificationStatus;
  verification_identity_status: VerificationStatus;
  overview_fields: Record<string, unknown>;
  onboarding_pack_id: string | null;
  onboarding_checklist: ChecklistItem[];
  checklist_template_id: string | null;
  notes_thread: string[]; // note_ids
  documents: string[]; // document_ids
  next_calendar_event_id: string | null;
  support_ticket_ids: string[];
  integrations: {
    meta?: { connected: boolean; last_sync?: string };
    google?: { connected: boolean; last_sync?: string };
    website?: { connected: boolean; url?: string };
  };
  data_ingestion_jobs: string[]; // job_ids
  created_from_enquiry_id: string | null;
  live_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportTicket {
  ticket_id: string;
  linked_entity_type: EntityType | null;
  linked_entity_id: string | null;
  subject: string;
  description: string;
  tags: string[];
  market_field: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to_user_id: string | null;
  attachments: string[]; // document_ids
  notes_thread: string[]; // note_ids
  due_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseItem {
  kb_id: string;
  bucket: KBBucket;
  title: string;
  content_rich_text: string;
  attachments: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

// ── KB Folder & File System ──────────────────

export interface KBFolder {
  id: string;
  name: string;
  parent_folder_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface KBFile {
  id: string;
  folder_id: string;
  title: string;
  file_type: KBFileType;
  storage_url: string;
  tags: string[];
  description: string;
  version: number;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

// ── KB Checklist Templates ───────────────────

export interface KBChecklistTemplateItem {
  id: string;
  label: string;
  default_due_offset_days: number;
  guidance_text: string;
}

export interface KBChecklistTemplate {
  id: string;
  name: string;
  tenancy_type: TenancyType | 'BOTH';
  items: KBChecklistTemplateItem[];
  version: number;
  updated_at: string;
}

export interface AccountChecklistInstance {
  account_id: string;
  template_id: string;
  template_version: number;
  items: {
    item_id: string;
    label: string;
    status: 'not_started' | 'in_progress' | 'done' | 'blocked' | 'archived';
    completed_at: string | null;
    completed_by_user_id: string | null;
  }[];
  template_updated: boolean;
}

// ── CRM Usage Snapshot ───────────────────────

export interface CRMUsageSnapshot {
  account_id: string;
  period: string; // e.g. '2025-01', '2025-W05'
  dau: number;
  wau: number;
  mau: number;
  leads_created: number;
  leads_updated: number;
  projects_actions: number;
  tasks_created: number;
  tasks_completed: number;
  logins: number;
  inactivity_streak_days: number;
}

// ── Seat Request ─────────────────────────────

export interface SeatRequest {
  id: string;
  account_id: string;
  seats_requested: number;
  reason: string;
  urgency: SeatRequestUrgency;
  requested_by_user_id: string;
  notes: string;
  ticket_id: string;
  event_id: string;
  created_at: string;
}

export interface MarketingLog {
  log_id: string;
  object_type: MarketingObjectType;
  object_payload: Record<string, unknown>;
  city_geo_tags: string[];
  tenancy_type_target: TenancyType | null;
  cost_amount: number | null;
  cost_type: MarketingCostType | null;
  notes: string;
  created_at: string;
}

export interface DataIngestionJob {
  job_id: string;
  account_id: string;
  import_type: ImportType;
  file_names: string[];
  mapping_config: Record<string, string>;
  status: IngestionStatus;
  imported_count: number;
  error_count: number;
  duplicate_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface AuditTrailEntry {
  id: string;
  action: string;
  entity_type: EntityType;
  entity_id: string;
  performed_by_user_id: string;
  details: string;
  created_at: string;
}
