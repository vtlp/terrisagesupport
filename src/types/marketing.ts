// =============================================
// Marketing Command Centre — Data Model
// =============================================

export enum CampaignChannel {
  META = 'META',
  GOOGLE = 'GOOGLE',
  YOUTUBE = 'YOUTUBE',
  LINKEDIN = 'LINKEDIN',
  X = 'X',
  REDDIT = 'REDDIT',
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
  REFERRAL = 'REFERRAL',
  OFFLINE = 'OFFLINE',
}

export enum CampaignObjective {
  LEAD_GEN = 'LEAD_GEN',
  TRAFFIC = 'TRAFFIC',
  RETARGETING = 'RETARGETING',
  BRAND = 'BRAND',
  EVENT = 'EVENT',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum SegmentTarget {
  AGENCY = 'AGENCY',
  BUILDER = 'BUILDER',
  BOTH = 'BOTH',
}

export enum ContentType {
  POST = 'POST',
  REEL = 'REEL',
  STORY = 'STORY',
  CAROUSEL = 'CAROUSEL',
  VIDEO = 'VIDEO',
  BLOG = 'BLOG',
  NEWSLETTER = 'NEWSLETTER',
}

export enum ContentChannel {
  INSTAGRAM = 'INSTAGRAM',
  FACEBOOK = 'FACEBOOK',
  LINKEDIN = 'LINKEDIN',
  YOUTUBE = 'YOUTUBE',
  X = 'X',
  REDDIT = 'REDDIT',
  BLOG = 'BLOG',
}

export enum ContentStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  PUBLISHED = 'PUBLISHED',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED',
}

export enum OfflineActivityType {
  EVENT = 'EVENT',
  MEETUP = 'MEETUP',
  ASSOCIATION_VISIT = 'ASSOCIATION_VISIT',
  PRINT = 'PRINT',
  COLD_CALL_DRIVE = 'COLD_CALL_DRIVE',
  PARTNER_PROGRAMME = 'PARTNER_PROGRAMME',
}

export enum CostType {
  ONLINE_ADS = 'ONLINE_ADS',
  OFFLINE_EVENT = 'OFFLINE_EVENT',
  TOOLING = 'TOOLING',
  CREATIVE = 'CREATIVE',
  AGENCY_FEE = 'AGENCY_FEE',
  TRAVEL = 'TRAVEL',
  OTHER = 'OTHER',
}

export enum MktActivityType {
  CAMPAIGN_CREATED = 'CAMPAIGN_CREATED',
  CAMPAIGN_UPDATED = 'CAMPAIGN_UPDATED',
  UTM_GENERATED = 'UTM_GENERATED',
  BUDGET_CHANGED = 'BUDGET_CHANGED',
  COST_ADDED = 'COST_ADDED',
  COST_EDITED = 'COST_EDITED',
  OFFLINE_LOGGED = 'OFFLINE_LOGGED',
  CREATIVE_UPDATED = 'CREATIVE_UPDATED',
  CONTENT_SCHEDULED = 'CONTENT_SCHEDULED',
  SYNC_COMPLETED = 'SYNC_COMPLETED',
  SYNC_FAILED = 'SYNC_FAILED',
}

export enum MetricSource {
  MANUAL = 'MANUAL',
  SYNCED = 'SYNCED',
}

export enum SyncStatus {
  CONNECTED = 'CONNECTED',
  NOT_CONNECTED = 'NOT_CONNECTED',
  NEEDS_REAUTH = 'NEEDS_REAUTH',
}

export enum SyncHealth {
  OK = 'OK',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

export enum UTMContext {
  META_PAID = 'META_PAID',
  META_ORGANIC = 'META_ORGANIC',
  YOUTUBE_ORGANIC = 'YOUTUBE_ORGANIC',
  YOUTUBE_ADS = 'YOUTUBE_ADS',
  LINKEDIN_PAID = 'LINKEDIN_PAID',
  GOOGLE_SEARCH = 'GOOGLE_SEARCH',
  GOOGLE_DISPLAY = 'GOOGLE_DISPLAY',
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
  OFFLINE_QR = 'OFFLINE_QR',
  REFERRAL = 'REFERRAL',
}

export enum LandingPageCategory {
  DEMO = 'DEMO',
  PRICING = 'PRICING',
  BLOG = 'BLOG',
  WEBINAR = 'WEBINAR',
  CONTACT = 'CONTACT',
  OTHER = 'OTHER',
}

// ── Interfaces ─────────────────────────────────

export interface Campaign {
  campaign_id: string;
  campaign_name: string;
  channel: CampaignChannel;
  objective: CampaignObjective;
  segment_target: SegmentTarget;
  geo_cities: string[];
  start_date: string;
  end_date: string;
  status: CampaignStatus;
  owner_user_id: string;
  planned_budget: number;
  notes: string;
  linked_assets: string[];
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  created_at: string;
  updated_at: string;
}

export interface ContentEntry {
  content_id: string;
  content_type: ContentType;
  channel: ContentChannel;
  title: string;
  publish_date: string;
  owner_user_id: string;
  status: ContentStatus;
  linked_campaign_id: string | null;
  city: string;
  asset_links: string[];
  notes: string;
  metric_source: MetricSource;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  engagement_total: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  video_views: number | null;
  avg_watch_time_seconds: number | null;
  follower_delta: number | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface OfflineActivity {
  activity_id: string;
  type: OfflineActivityType;
  title: string;
  city: string;
  start_date: string;
  end_date: string;
  target_segment: SegmentTarget;
  linked_campaign_id: string | null;
  planned_cost: number | null;
  notes: string;
  owner_user_id: string;
  created_at: string;
}

export interface CostItem {
  cost_item_id: string;
  date: string;
  type: CostType;
  channel: CampaignChannel | null;
  linked_campaign_id: string | null;
  vendor: string;
  amount: number;
  notes: string;
  attachment_url: string | null;
  created_at: string;
}

export interface UTMBundle {
  utm_id: string;
  campaign_id: string;
  link_name: string;
  landing_page_id: string;
  base_url: string;
  utm_context: UTMContext | '';
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  generated_url: string;
  short_token: string;
  status: 'active' | 'paused';
  created_by: string;
  created_at: string;
}

export interface LandingPage {
  landing_page_id: string;
  name: string;
  url: string;
  category: LandingPageCategory;
  active: boolean;
  created_at: string;
}

export interface MktActivityLog {
  id: string;
  type: MktActivityType;
  description: string;
  user_id: string;
  linked_campaign_id: string | null;
  city: string | null;
  created_at: string;
}

export interface SocialAccount {
  account_id: string;
  platform: ContentChannel;
  handle: string;
  status: SyncStatus;
  last_sync_at: string | null;
}

export interface SyncConnector {
  connector_id: string;
  name: string;
  description: string;
  status: SyncStatus;
  health: SyncHealth;
  last_sync_at: string | null;
  syncs: string[];
  phase: number;
}

export interface LeadSyncMapping {
  mapping_id: string;
  source_name: string;
  connector_id: string;
  default_campaign_id: string | null;
  default_city: string;
  default_segment: SegmentTarget;
  assignment_rule: 'unassigned' | 'assign_to_owner' | 'round_robin';
  field_mappings: { external: string; internal: string }[];
  active: boolean;
}

export interface WebTrackingEvent {
  event_id: string;
  page_path: string;
  event_type: 'page_view' | 'cta_click' | 'form_submit';
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  campaign_id: string | null;
  device: 'desktop' | 'mobile' | 'tablet';
  city: string;
  session_id: string;
  visitor_id: string;
  created_at: string;
}
