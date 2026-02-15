// =============================================
// Marketing Command Centre — Data Model
// =============================================

export enum CampaignChannel {
  META = 'META',
  GOOGLE = 'GOOGLE',
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
  BLOG = 'BLOG',
  NEWSLETTER = 'NEWSLETTER',
}

export enum ContentChannel {
  INSTAGRAM = 'INSTAGRAM',
  FACEBOOK = 'FACEBOOK',
  LINKEDIN = 'LINKEDIN',
  YOUTUBE = 'YOUTUBE',
  X = 'X',
  BLOG = 'BLOG',
}

export enum ContentStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  PUBLISHED = 'PUBLISHED',
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
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  TOOLING = 'TOOLING',
  AGENCY = 'AGENCY',
  CREATIVE = 'CREATIVE',
  EVENT = 'EVENT',
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
  asset_links: string[];
  notes: string;
  // Placeholder perf fields
  impressions: number | null;
  engagement: number | null;
  clicks: number | null;
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
  base_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  generated_url: string;
  short_token: string;
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
