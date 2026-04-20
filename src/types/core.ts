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
  PAYMENT_LINK_SENT = 'PAYMENT_LINK_SENT',
  ONBOARDING_PACK_SENT = 'ONBOARDING_PACK_SENT',
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

export enum CalendarEventType {
  DEMO = 'DEMO',
  FOLLOW_UP = 'FOLLOW_UP',
  CALL_BACK = 'CALL_BACK',
  CHECK_IN = 'CHECK_IN',
  ONBOARDING = 'ONBOARDING',
  GENERAL = 'GENERAL',
}

export enum EntityType {
  ENQUIRY = 'ENQUIRY',
  ACCOUNT = 'ACCOUNT',
  TICKET = 'TICKET',
}

export enum TicketPriority {
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
  P4 = 'P4',
}

export enum TicketStatus {
  OPEN = 'OPEN',
  PENDING_CUSTOMER = 'PENDING_CUSTOMER',
  PENDING_INTERNAL = 'PENDING_INTERNAL',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum TicketType {
  INCIDENT = 'INCIDENT',
  QUESTION = 'QUESTION',
  TASK = 'TASK',
  FEEDBACK = 'FEEDBACK',
}

export enum TicketCategory {
  LISTINGS_INVENTORY = 'LISTINGS_INVENTORY',
  BILLING_PLAN = 'BILLING_PLAN',
  API_INTEGRATIONS = 'API_INTEGRATIONS',
  ONBOARDING_MIGRATION = 'ONBOARDING_MIGRATION',
  SECURITY_ACCESS = 'SECURITY_ACCESS',
  COMPLIANCE_LEGAL = 'COMPLIANCE_LEGAL',
  PERFORMANCE_RELIABILITY = 'PERFORMANCE_RELIABILITY',
  OTHER = 'OTHER',
}

// Legacy mapping helpers (for backward compat during transition)
export const LegacyTicketPriority = {
  LOW: TicketPriority.P4,
  MEDIUM: TicketPriority.P3,
  HIGH: TicketPriority.P2,
  URGENT: TicketPriority.P1,
} as const;

export const LegacyTicketStatus = {
  NEW: TicketStatus.OPEN,
  IN_PROGRESS: TicketStatus.PENDING_INTERNAL,
  WAITING_ON_CLIENT: TicketStatus.PENDING_CUSTOMER,
  RESOLVED: TicketStatus.RESOLVED,
  CLOSED: TicketStatus.CLOSED,
} as const;

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

export enum SubmissionStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// ── Timeline Event Types ─────────────────────────
export enum TimelineEventType {
  CUSTOMER_MESSAGE = 'CUSTOMER_MESSAGE',
  AGENT_REPLY = 'AGENT_REPLY',
  INTERNAL_NOTE = 'INTERNAL_NOTE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  ASSIGNMENT = 'ASSIGNMENT',
  PRIORITY_CHANGE = 'PRIORITY_CHANGE',
  SYSTEM = 'SYSTEM',
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
  event_type: CalendarEventType;
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
  onboarding_form_link: string | null;
  onboarding_submission: OnboardingFormSubmission | null;
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
  whatsapp_enabled: boolean;
  account_overview_text: string;
  verification_pan_status: VerificationStatus;
  verification_identity_status: VerificationStatus;
  overview_fields: Record<string, unknown>;
  onboarding_pack_id: string | null;
  onboarding_checklist: ChecklistItem[];
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
  seats: AccountSeat[];
  created_from_enquiry_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportTicket {
  ticket_id: string;
  ticket_code?: string | null;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  type: TicketType;
  category: TicketCategory;
  account_id: string | null;
  requester_name: string;
  requester_email: string;
  assigned_to_user_id: string | null;
  queue: string;
  tags: string[];
  sla_first_response: string | null;
  sla_resolution: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  timeline: TimelineEntry[];
  attachments: string[];
  notes_thread: string[];
  // Legacy fields for backward compat
  linked_entity_type: EntityType | null;
  linked_entity_id: string | null;
  market_field: string;
  created_at: string;
  updated_at: string;
}

export interface TimelineEntry {
  id: string;
  type: TimelineEventType;
  content: string;
  user_id: string | null;
  created_at: string;
  metadata?: Record<string, unknown>;
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

export interface KBFolder {
  folder_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface KBFile {
  file_id: string;
  folder_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  tags: string[];
  uploaded_by_user_id: string;
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

export interface AccountSeat {
  seat_id: string;
  account_id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  permissions: string[];
  is_active: boolean;
  onboarded: boolean;
  onboarded_at: string | null;
  created_at: string;
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

// ── Onboarding Form Submission ─────────────────
export interface OnboardingTeamMember {
  name: string;
  email: string;
  phone: string;
  role: string;
}

export interface OnboardingProject {
  project_name: string;
  location: string;
  units: number;
  type: string;
}

export interface OnboardingFormSubmission {
  submission_id: string;
  enquiry_id: string;
  status: SubmissionStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
  // Business info from form
  company_name: string;
  company_address: string;
  city: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  gst_number: string;
  pan_number: string;
  rera_number: string;
  website_url: string;
  team_members: OnboardingTeamMember[];
  projects: OnboardingProject[];
  // Files uploaded
  uploaded_files: string[];
  // Additional notes from the form
  additional_notes: string;
}
