import {
  type Campaign, type ContentEntry, type OfflineActivity,
  type CostItem, type UTMBundle, type MktActivityLog,
  type LandingPage, type SocialAccount, type SyncConnector,
  type LeadSyncMapping, type WebTrackingEvent,
  CampaignChannel, CampaignObjective, CampaignStatus, SegmentTarget,
  ContentType, ContentChannel, ContentStatus,
  OfflineActivityType, CostType, MktActivityType,
  MetricSource, SyncStatus, SyncHealth,
  UTMContext, LandingPageCategory,
} from '@/types/marketing';

// ── Campaigns ──────────────────────────────────
export const seedCampaigns: Campaign[] = [
  { campaign_id: 'CMP001', campaign_name: 'Q1 Agency Lead Gen — Meta', channel: CampaignChannel.META, objective: CampaignObjective.LEAD_GEN, segment_target: SegmentTarget.AGENCY, geo_cities: ['Mumbai', 'Pune', 'Delhi'], start_date: '2025-01-01', end_date: '2025-03-31', status: CampaignStatus.ACTIVE, owner_user_id: 'U001', planned_budget: 150000, notes: 'Primary agency acquisition campaign for Q1', linked_assets: [], utm_source: 'meta', utm_medium: 'paid_social', utm_campaign: 'q1_agency_leadgen', utm_content: '', utm_term: '', created_at: '2024-12-20T10:00:00Z', updated_at: '2025-01-05T10:00:00Z' },
  { campaign_id: 'CMP002', campaign_name: 'Builder Awareness — Google', channel: CampaignChannel.GOOGLE, objective: CampaignObjective.BRAND, segment_target: SegmentTarget.BUILDER, geo_cities: ['Bangalore', 'Chennai', 'Hyderabad'], start_date: '2025-01-15', end_date: '2025-04-15', status: CampaignStatus.ACTIVE, owner_user_id: 'U005', planned_budget: 200000, notes: 'Brand awareness for builder segment in South India', linked_assets: [], utm_source: 'google', utm_medium: 'display', utm_campaign: 'builder_awareness_south', utm_content: '', utm_term: 'crm builder', created_at: '2025-01-10T10:00:00Z', updated_at: '2025-01-15T10:00:00Z' },
  { campaign_id: 'CMP003', campaign_name: 'Referral Programme Q1', channel: CampaignChannel.REFERRAL, objective: CampaignObjective.LEAD_GEN, segment_target: SegmentTarget.BOTH, geo_cities: ['Mumbai', 'Pune', 'Delhi', 'Bangalore'], start_date: '2025-01-01', end_date: '2025-03-31', status: CampaignStatus.ACTIVE, owner_user_id: 'U001', planned_budget: 50000, notes: 'Champion partner referral incentives', linked_assets: [], utm_source: 'referral', utm_medium: 'partner', utm_campaign: 'q1_referral', utm_content: '', utm_term: '', created_at: '2024-12-28T10:00:00Z', updated_at: '2025-01-02T10:00:00Z' },
  { campaign_id: 'CMP004', campaign_name: 'LinkedIn Thought Leadership', channel: CampaignChannel.LINKEDIN, objective: CampaignObjective.BRAND, segment_target: SegmentTarget.BOTH, geo_cities: [], start_date: '2025-01-01', end_date: '2025-06-30', status: CampaignStatus.ACTIVE, owner_user_id: 'U005', planned_budget: 75000, notes: 'Organic + sponsored posts on LinkedIn for brand building', linked_assets: [], utm_source: 'linkedin', utm_medium: 'organic', utm_campaign: 'thought_leadership_2025', utm_content: '', utm_term: '', created_at: '2024-12-25T10:00:00Z', updated_at: '2025-01-01T10:00:00Z' },
  { campaign_id: 'CMP005', campaign_name: 'Pune Developer Meetup', channel: CampaignChannel.OFFLINE, objective: CampaignObjective.EVENT, segment_target: SegmentTarget.BUILDER, geo_cities: ['Pune'], start_date: '2025-02-20', end_date: '2025-02-20', status: CampaignStatus.DRAFT, owner_user_id: 'U001', planned_budget: 35000, notes: 'Networking event with Pune builder associations', linked_assets: [], utm_source: 'offline', utm_medium: 'event', utm_campaign: 'pune_dev_meetup_feb', utm_content: '', utm_term: '', created_at: '2025-02-01T10:00:00Z', updated_at: '2025-02-01T10:00:00Z' },
  { campaign_id: 'CMP006', campaign_name: 'WhatsApp Drip — Agency Nurture', channel: CampaignChannel.WHATSAPP, objective: CampaignObjective.RETARGETING, segment_target: SegmentTarget.AGENCY, geo_cities: ['Mumbai', 'Pune'], start_date: '2025-02-01', end_date: '2025-03-31', status: CampaignStatus.ACTIVE, owner_user_id: 'U001', planned_budget: 15000, notes: 'Automated WhatsApp sequences for warm leads', linked_assets: [], utm_source: 'whatsapp', utm_medium: 'drip', utm_campaign: 'agency_nurture_q1', utm_content: '', utm_term: '', created_at: '2025-01-25T10:00:00Z', updated_at: '2025-02-01T10:00:00Z' },
  { campaign_id: 'CMP007', campaign_name: 'Email Newsletter — Feb', channel: CampaignChannel.EMAIL, objective: CampaignObjective.TRAFFIC, segment_target: SegmentTarget.BOTH, geo_cities: [], start_date: '2025-02-01', end_date: '2025-02-28', status: CampaignStatus.COMPLETED, owner_user_id: 'U005', planned_budget: 5000, notes: 'February product updates + case study', linked_assets: [], utm_source: 'email', utm_medium: 'newsletter', utm_campaign: 'feb_2025_newsletter', utm_content: '', utm_term: '', created_at: '2025-01-28T10:00:00Z', updated_at: '2025-02-15T10:00:00Z' },
  { campaign_id: 'CMP008', campaign_name: 'Google Search — CRM Keywords', channel: CampaignChannel.GOOGLE, objective: CampaignObjective.LEAD_GEN, segment_target: SegmentTarget.AGENCY, geo_cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad'], start_date: '2025-01-10', end_date: '2025-03-31', status: CampaignStatus.ACTIVE, owner_user_id: 'U005', planned_budget: 180000, notes: 'Search ads for real estate CRM keywords', linked_assets: [], utm_source: 'google', utm_medium: 'search', utm_campaign: 'crm_keywords_q1', utm_content: '', utm_term: 'real estate crm', created_at: '2025-01-05T10:00:00Z', updated_at: '2025-01-10T10:00:00Z' },
];

// ── Landing Pages ──────────────────────────────
export const seedLandingPages: LandingPage[] = [
  { landing_page_id: 'LP001', name: 'Demo Page', url: 'https://terrisage.com/demo', category: LandingPageCategory.DEMO, active: true, created_at: '2024-12-01T10:00:00Z' },
  { landing_page_id: 'LP002', name: 'Pricing Page', url: 'https://terrisage.com/pricing', category: LandingPageCategory.PRICING, active: true, created_at: '2024-12-01T10:00:00Z' },
  { landing_page_id: 'LP003', name: 'Builder Landing', url: 'https://terrisage.com/builders', category: LandingPageCategory.OTHER, active: true, created_at: '2025-01-01T10:00:00Z' },
  { landing_page_id: 'LP004', name: 'Agency Landing', url: 'https://terrisage.com/agency', category: LandingPageCategory.OTHER, active: true, created_at: '2025-01-01T10:00:00Z' },
  { landing_page_id: 'LP005', name: 'Blog', url: 'https://terrisage.com/blog', category: LandingPageCategory.BLOG, active: true, created_at: '2024-12-01T10:00:00Z' },
  { landing_page_id: 'LP006', name: 'Contact Us', url: 'https://terrisage.com/contact', category: LandingPageCategory.CONTACT, active: true, created_at: '2024-12-01T10:00:00Z' },
  { landing_page_id: 'LP007', name: 'CRM Features', url: 'https://terrisage.com/crm', category: LandingPageCategory.OTHER, active: true, created_at: '2025-01-05T10:00:00Z' },
];

// ── Content Entries ────────────────────────────
export const seedContent: ContentEntry[] = [
  { content_id: 'CNT001', content_type: ContentType.POST, channel: ContentChannel.LINKEDIN, title: '5 Ways CRM Transforms Agency Sales', publish_date: '2025-02-10', owner_user_id: 'U005', status: ContentStatus.PUBLISHED, linked_campaign_id: 'CMP004', city: '', asset_links: [], notes: 'High engagement expected', metric_source: MetricSource.MANUAL, impressions: 4500, reach: 3800, clicks: 85, engagement_total: 320, likes: 210, comments: 45, shares: 38, saves: 27, video_views: null, avg_watch_time_seconds: null, follower_delta: 12, last_synced_at: null, created_at: '2025-02-08T10:00:00Z' },
  { content_id: 'CNT002', content_type: ContentType.REEL, channel: ContentChannel.INSTAGRAM, title: 'Platform walkthrough — 60s', publish_date: '2025-02-12', owner_user_id: 'U001', status: ContentStatus.PUBLISHED, linked_campaign_id: 'CMP001', city: '', asset_links: [], notes: '', metric_source: MetricSource.MANUAL, impressions: 12000, reach: 9500, clicks: 150, engagement_total: 890, likes: 620, comments: 85, shares: 120, saves: 65, video_views: 8500, avg_watch_time_seconds: 28, follower_delta: 45, last_synced_at: null, created_at: '2025-02-10T10:00:00Z' },
  { content_id: 'CNT003', content_type: ContentType.BLOG, channel: ContentChannel.BLOG, title: 'Why Builders Need a Dedicated CRM in 2025', publish_date: '2025-02-15', owner_user_id: 'U005', status: ContentStatus.SCHEDULED, linked_campaign_id: 'CMP002', city: '', asset_links: [], notes: 'SEO optimised', metric_source: MetricSource.MANUAL, impressions: null, reach: null, clicks: null, engagement_total: null, likes: null, comments: null, shares: null, saves: null, video_views: null, avg_watch_time_seconds: null, follower_delta: null, last_synced_at: null, created_at: '2025-02-12T10:00:00Z' },
  { content_id: 'CNT004', content_type: ContentType.NEWSLETTER, channel: ContentChannel.BLOG, title: 'Feb 2025 Product Update', publish_date: '2025-02-01', owner_user_id: 'U005', status: ContentStatus.PUBLISHED, linked_campaign_id: 'CMP007', city: '', asset_links: [], notes: 'Sent to 2.4k subscribers', metric_source: MetricSource.MANUAL, impressions: 2400, reach: 2400, clicks: 95, engagement_total: 180, likes: null, comments: null, shares: null, saves: null, video_views: null, avg_watch_time_seconds: null, follower_delta: null, last_synced_at: null, created_at: '2025-01-28T10:00:00Z' },
  { content_id: 'CNT005', content_type: ContentType.POST, channel: ContentChannel.FACEBOOK, title: 'Client success story — Skyline Realty', publish_date: '2025-02-18', owner_user_id: 'U001', status: ContentStatus.DRAFT, linked_campaign_id: null, city: 'Mumbai', asset_links: [], notes: 'Awaiting client approval', metric_source: MetricSource.MANUAL, impressions: null, reach: null, clicks: null, engagement_total: null, likes: null, comments: null, shares: null, saves: null, video_views: null, avg_watch_time_seconds: null, follower_delta: null, last_synced_at: null, created_at: '2025-02-14T10:00:00Z' },
  { content_id: 'CNT006', content_type: ContentType.STORY, channel: ContentChannel.INSTAGRAM, title: 'Behind the scenes — team day', publish_date: '2025-02-14', owner_user_id: 'U001', status: ContentStatus.PUBLISHED, linked_campaign_id: null, city: '', asset_links: [], notes: '', metric_source: MetricSource.MANUAL, impressions: 3200, reach: 2800, clicks: null, engagement_total: 450, likes: 280, comments: 50, shares: 30, saves: 90, video_views: null, avg_watch_time_seconds: null, follower_delta: 8, last_synced_at: null, created_at: '2025-02-14T08:00:00Z' },
  { content_id: 'CNT007', content_type: ContentType.CAROUSEL, channel: ContentChannel.LINKEDIN, title: 'Real estate tech trends 2025', publish_date: '2025-02-20', owner_user_id: 'U005', status: ContentStatus.SCHEDULED, linked_campaign_id: 'CMP004', city: '', asset_links: [], notes: '10-slide carousel', metric_source: MetricSource.MANUAL, impressions: null, reach: null, clicks: null, engagement_total: null, likes: null, comments: null, shares: null, saves: null, video_views: null, avg_watch_time_seconds: null, follower_delta: null, last_synced_at: null, created_at: '2025-02-16T10:00:00Z' },
  { content_id: 'CNT008', content_type: ContentType.VIDEO, channel: ContentChannel.YOUTUBE, title: 'Terrisage CRM Full Demo Walkthrough', publish_date: '2025-02-25', owner_user_id: 'U001', status: ContentStatus.DRAFT, linked_campaign_id: 'CMP002', city: '', asset_links: [], notes: 'Long-form demo for YouTube', metric_source: MetricSource.MANUAL, impressions: null, reach: null, clicks: null, engagement_total: null, likes: null, comments: null, shares: null, saves: null, video_views: null, avg_watch_time_seconds: null, follower_delta: null, last_synced_at: null, created_at: '2025-02-18T10:00:00Z' },
];

// ── Social Accounts ────────────────────────────
export const seedSocialAccounts: SocialAccount[] = [
  { account_id: 'SA001', platform: ContentChannel.INSTAGRAM, handle: '@terrisage_crm', status: SyncStatus.NOT_CONNECTED, last_sync_at: null },
  { account_id: 'SA002', platform: ContentChannel.FACEBOOK, handle: 'Terrisage CRM', status: SyncStatus.NOT_CONNECTED, last_sync_at: null },
  { account_id: 'SA003', platform: ContentChannel.LINKEDIN, handle: 'Terrisage', status: SyncStatus.NOT_CONNECTED, last_sync_at: null },
  { account_id: 'SA004', platform: ContentChannel.YOUTUBE, handle: 'Terrisage CRM', status: SyncStatus.NOT_CONNECTED, last_sync_at: null },
  { account_id: 'SA005', platform: ContentChannel.X, handle: '@terrisage', status: SyncStatus.NOT_CONNECTED, last_sync_at: null },
];

// ── Offline Activities ─────────────────────────
export const seedOfflineActivities: OfflineActivity[] = [
  { activity_id: 'OFL001', type: OfflineActivityType.EVENT, title: 'Pune Builder Association Meet', city: 'Pune', start_date: '2025-02-20', end_date: '2025-02-20', target_segment: SegmentTarget.BUILDER, linked_campaign_id: 'CMP005', planned_cost: 25000, notes: 'Sponsoring refreshments + 15min presentation slot', owner_user_id: 'U001', created_at: '2025-02-01T10:00:00Z' },
  { activity_id: 'OFL002', type: OfflineActivityType.COLD_CALL_DRIVE, title: 'Mumbai Agency Cold-Call Sprint', city: 'Mumbai', start_date: '2025-02-10', end_date: '2025-02-14', target_segment: SegmentTarget.AGENCY, linked_campaign_id: 'CMP001', planned_cost: null, notes: 'Target: 200 calls across Bandra-Andheri belt', owner_user_id: 'U002', created_at: '2025-02-05T10:00:00Z' },
  { activity_id: 'OFL003', type: OfflineActivityType.PARTNER_PROGRAMME, title: 'Champion Partner Onboarding — Bangalore', city: 'Bangalore', start_date: '2025-02-15', end_date: '2025-03-15', target_segment: SegmentTarget.BOTH, linked_campaign_id: 'CMP003', planned_cost: 10000, notes: '5 new partners targeted', owner_user_id: 'U003', created_at: '2025-02-10T10:00:00Z' },
  { activity_id: 'OFL004', type: OfflineActivityType.MEETUP, title: 'Real Estate Tech Roundtable — Delhi', city: 'Delhi', start_date: '2025-03-05', end_date: '2025-03-05', target_segment: SegmentTarget.BOTH, linked_campaign_id: null, planned_cost: 15000, notes: 'Co-hosted with PropTech India', owner_user_id: 'U005', created_at: '2025-02-12T10:00:00Z' },
  { activity_id: 'OFL005', type: OfflineActivityType.PRINT, title: 'Quarter-page ad — RE Times Feb', city: 'Mumbai', start_date: '2025-02-01', end_date: '2025-02-28', target_segment: SegmentTarget.AGENCY, linked_campaign_id: null, planned_cost: 45000, notes: 'Print ad in Real Estate Times monthly', owner_user_id: 'U005', created_at: '2025-01-25T10:00:00Z' },
];

// ── Cost Items ─────────────────────────────────
export const seedCostItems: CostItem[] = [
  { cost_item_id: 'CST001', date: '2025-01-15', type: CostType.ONLINE_ADS, channel: CampaignChannel.META, linked_campaign_id: 'CMP001', vendor: 'Meta Ads', amount: 45000, notes: 'Jan spend — Meta lead gen', attachment_url: null, created_at: '2025-01-31T10:00:00Z' },
  { cost_item_id: 'CST002', date: '2025-02-01', type: CostType.ONLINE_ADS, channel: CampaignChannel.META, linked_campaign_id: 'CMP001', vendor: 'Meta Ads', amount: 52000, notes: 'Feb spend — Meta lead gen', attachment_url: null, created_at: '2025-02-15T10:00:00Z' },
  { cost_item_id: 'CST003', date: '2025-01-20', type: CostType.ONLINE_ADS, channel: CampaignChannel.GOOGLE, linked_campaign_id: 'CMP002', vendor: 'Google Ads', amount: 60000, notes: 'Jan spend — Display builder awareness', attachment_url: null, created_at: '2025-01-31T10:00:00Z' },
  { cost_item_id: 'CST004', date: '2025-02-05', type: CostType.ONLINE_ADS, channel: CampaignChannel.GOOGLE, linked_campaign_id: 'CMP008', vendor: 'Google Ads', amount: 55000, notes: 'Feb spend — Search CRM keywords', attachment_url: null, created_at: '2025-02-15T10:00:00Z' },
  { cost_item_id: 'CST005', date: '2025-02-01', type: CostType.OFFLINE_EVENT, channel: null, linked_campaign_id: 'CMP005', vendor: 'Pune Convention Centre', amount: 25000, notes: 'Venue + refreshments deposit', attachment_url: null, created_at: '2025-02-01T10:00:00Z' },
  { cost_item_id: 'CST006', date: '2025-01-25', type: CostType.OFFLINE_EVENT, channel: null, linked_campaign_id: null, vendor: 'RE Times Magazine', amount: 45000, notes: 'Print ad Feb issue', attachment_url: null, created_at: '2025-01-25T10:00:00Z' },
  { cost_item_id: 'CST007', date: '2025-02-01', type: CostType.CREATIVE, channel: null, linked_campaign_id: 'CMP001', vendor: 'DesignPro Agency', amount: 18000, notes: 'Creative set for Feb Meta campaign', attachment_url: null, created_at: '2025-02-01T10:00:00Z' },
  { cost_item_id: 'CST008', date: '2025-01-15', type: CostType.TOOLING, channel: null, linked_campaign_id: null, vendor: 'Mailchimp', amount: 3500, notes: 'Email platform Jan', attachment_url: null, created_at: '2025-01-31T10:00:00Z' },
  { cost_item_id: 'CST009', date: '2025-02-10', type: CostType.ONLINE_ADS, channel: CampaignChannel.LINKEDIN, linked_campaign_id: 'CMP004', vendor: 'LinkedIn Ads', amount: 22000, notes: 'Sponsored post boost — Feb', attachment_url: null, created_at: '2025-02-10T10:00:00Z' },
  { cost_item_id: 'CST010', date: '2025-01-10', type: CostType.ONLINE_ADS, channel: CampaignChannel.GOOGLE, linked_campaign_id: 'CMP008', vendor: 'Google Ads', amount: 48000, notes: 'Jan spend — Search CRM keywords', attachment_url: null, created_at: '2025-01-31T10:00:00Z' },
];

// ── UTM Bundles ────────────────────────────────
export const seedUTMBundles: UTMBundle[] = [
  { utm_id: 'UTM001', campaign_id: 'CMP001', link_name: 'Meta CTA v1', landing_page_id: 'LP001', base_url: 'https://terrisage.com/demo', utm_context: UTMContext.META_PAID, utm_source: 'meta', utm_medium: 'paid_social', utm_campaign: 'q1_agency_leadgen', utm_content: 'cta_v1', utm_term: '', generated_url: 'https://terrisage.com/demo?utm_source=meta&utm_medium=paid_social&utm_campaign=q1_agency_leadgen&utm_content=cta_v1', short_token: 'tsg-q1ag', status: 'active', created_by: 'U001', created_at: '2025-01-02T10:00:00Z' },
  { utm_id: 'UTM002', campaign_id: 'CMP002', link_name: 'Google Display Banner', landing_page_id: 'LP003', base_url: 'https://terrisage.com/builders', utm_context: UTMContext.GOOGLE_DISPLAY, utm_source: 'google', utm_medium: 'display', utm_campaign: 'builder_awareness_south', utm_content: 'banner_300x250', utm_term: 'crm builder', generated_url: 'https://terrisage.com/builders?utm_source=google&utm_medium=display&utm_campaign=builder_awareness_south&utm_content=banner_300x250&utm_term=crm+builder', short_token: 'tsg-bldaw', status: 'active', created_by: 'U005', created_at: '2025-01-12T10:00:00Z' },
  { utm_id: 'UTM003', campaign_id: 'CMP008', link_name: 'Google Search CRM', landing_page_id: 'LP007', base_url: 'https://terrisage.com/crm', utm_context: UTMContext.GOOGLE_SEARCH, utm_source: 'google', utm_medium: 'search', utm_campaign: 'crm_keywords_q1', utm_content: '', utm_term: 'real estate crm', generated_url: 'https://terrisage.com/crm?utm_source=google&utm_medium=search&utm_campaign=crm_keywords_q1&utm_term=real+estate+crm', short_token: 'tsg-gscrm', status: 'active', created_by: 'U005', created_at: '2025-01-08T10:00:00Z' },
];

// ── Sync Connectors ────────────────────────────
export const seedSyncConnectors: SyncConnector[] = [
  { connector_id: 'CONN001', name: 'Meta Lead Forms', description: 'Sync leads from Meta/Facebook lead form ads directly into Inquiry module.', status: SyncStatus.NOT_CONNECTED, health: SyncHealth.OK, last_sync_at: null, syncs: ['Lead Sync'], phase: 1 },
  { connector_id: 'CONN002', name: 'Web Forms', description: 'Capture leads from website contact/demo forms and route to Inquiry.', status: SyncStatus.NOT_CONNECTED, health: SyncHealth.OK, last_sync_at: null, syncs: ['Lead Sync'], phase: 1 },
  { connector_id: 'CONN003', name: 'Google Ads / YouTube', description: 'Sync campaign metrics, spend data, and conversion stats from Google Ads.', status: SyncStatus.NOT_CONNECTED, health: SyncHealth.OK, last_sync_at: null, syncs: ['Metrics Sync', 'Spend Sync'], phase: 2 },
  { connector_id: 'CONN004', name: 'LinkedIn Ads', description: 'Pull campaign performance, impressions, clicks, and leads from LinkedIn.', status: SyncStatus.NOT_CONNECTED, health: SyncHealth.OK, last_sync_at: null, syncs: ['Metrics Sync'], phase: 2 },
  { connector_id: 'CONN005', name: 'WhatsApp Business', description: 'Send and track WhatsApp drip campaigns. Sync delivery and read receipts.', status: SyncStatus.NOT_CONNECTED, health: SyncHealth.OK, last_sync_at: null, syncs: ['Messaging Sync'], phase: 2 },
];

// ── Lead Sync Mappings ─────────────────────────
export const seedLeadSyncMappings: LeadSyncMapping[] = [
  {
    mapping_id: 'LSM001', source_name: 'Meta Lead Form — Agency Demo', connector_id: 'CONN001',
    default_campaign_id: 'CMP001', default_city: 'Mumbai', default_segment: SegmentTarget.AGENCY,
    assignment_rule: 'round_robin',
    field_mappings: [
      { external: 'full_name', internal: 'contact_name' },
      { external: 'email', internal: 'contact_email' },
      { external: 'phone_number', internal: 'contact_phone' },
      { external: 'company_name', internal: 'company_name' },
    ],
    active: true,
  },
  {
    mapping_id: 'LSM002', source_name: 'Website Demo Form', connector_id: 'CONN002',
    default_campaign_id: null, default_city: '', default_segment: SegmentTarget.BOTH,
    assignment_rule: 'unassigned',
    field_mappings: [
      { external: 'name', internal: 'contact_name' },
      { external: 'email', internal: 'contact_email' },
      { external: 'phone', internal: 'contact_phone' },
      { external: 'company', internal: 'company_name' },
      { external: 'city', internal: 'city' },
    ],
    active: true,
  },
];

// ── Web Tracking Events ────────────────────────
export const seedWebTrackingEvents: WebTrackingEvent[] = [
  { event_id: 'WTE001', page_path: '/demo', event_type: 'page_view', utm_source: 'meta', utm_medium: 'paid_social', utm_campaign: 'q1_agency_leadgen', campaign_id: 'CMP001', device: 'desktop', city: 'Mumbai', session_id: 'S001', visitor_id: 'V001', created_at: '2025-02-10T09:00:00Z' },
  { event_id: 'WTE002', page_path: '/demo', event_type: 'form_submit', utm_source: 'meta', utm_medium: 'paid_social', utm_campaign: 'q1_agency_leadgen', campaign_id: 'CMP001', device: 'desktop', city: 'Mumbai', session_id: 'S001', visitor_id: 'V001', created_at: '2025-02-10T09:02:00Z' },
  { event_id: 'WTE003', page_path: '/builders', event_type: 'page_view', utm_source: 'google', utm_medium: 'display', utm_campaign: 'builder_awareness_south', campaign_id: 'CMP002', device: 'mobile', city: 'Bangalore', session_id: 'S002', visitor_id: 'V002', created_at: '2025-02-10T10:00:00Z' },
  { event_id: 'WTE004', page_path: '/pricing', event_type: 'page_view', utm_source: 'google', utm_medium: 'search', utm_campaign: 'crm_keywords_q1', campaign_id: 'CMP008', device: 'desktop', city: 'Delhi', session_id: 'S003', visitor_id: 'V003', created_at: '2025-02-10T11:00:00Z' },
  { event_id: 'WTE005', page_path: '/pricing', event_type: 'cta_click', utm_source: 'google', utm_medium: 'search', utm_campaign: 'crm_keywords_q1', campaign_id: 'CMP008', device: 'desktop', city: 'Delhi', session_id: 'S003', visitor_id: 'V003', created_at: '2025-02-10T11:01:00Z' },
  { event_id: 'WTE006', page_path: '/demo', event_type: 'page_view', utm_source: 'linkedin', utm_medium: 'organic', utm_campaign: 'thought_leadership_2025', campaign_id: 'CMP004', device: 'desktop', city: 'Pune', session_id: 'S004', visitor_id: 'V004', created_at: '2025-02-11T08:00:00Z' },
  { event_id: 'WTE007', page_path: '/demo', event_type: 'form_submit', utm_source: 'linkedin', utm_medium: 'organic', utm_campaign: 'thought_leadership_2025', campaign_id: 'CMP004', device: 'desktop', city: 'Pune', session_id: 'S004', visitor_id: 'V004', created_at: '2025-02-11T08:05:00Z' },
  { event_id: 'WTE008', page_path: '/blog', event_type: 'page_view', utm_source: 'email', utm_medium: 'newsletter', utm_campaign: 'feb_2025_newsletter', campaign_id: 'CMP007', device: 'mobile', city: 'Chennai', session_id: 'S005', visitor_id: 'V005', created_at: '2025-02-11T12:00:00Z' },
  { event_id: 'WTE009', page_path: '/crm', event_type: 'page_view', utm_source: 'google', utm_medium: 'search', utm_campaign: 'crm_keywords_q1', campaign_id: 'CMP008', device: 'tablet', city: 'Hyderabad', session_id: 'S006', visitor_id: 'V006', created_at: '2025-02-12T09:00:00Z' },
  { event_id: 'WTE010', page_path: '/crm', event_type: 'cta_click', utm_source: 'google', utm_medium: 'search', utm_campaign: 'crm_keywords_q1', campaign_id: 'CMP008', device: 'tablet', city: 'Hyderabad', session_id: 'S006', visitor_id: 'V006', created_at: '2025-02-12T09:03:00Z' },
  { event_id: 'WTE011', page_path: '/agency', event_type: 'page_view', utm_source: 'meta', utm_medium: 'paid_social', utm_campaign: 'q1_agency_leadgen', campaign_id: 'CMP001', device: 'mobile', city: 'Pune', session_id: 'S007', visitor_id: 'V007', created_at: '2025-02-12T14:00:00Z' },
  { event_id: 'WTE012', page_path: '/demo', event_type: 'page_view', utm_source: 'referral', utm_medium: 'partner', utm_campaign: 'q1_referral', campaign_id: 'CMP003', device: 'desktop', city: 'Mumbai', session_id: 'S008', visitor_id: 'V008', created_at: '2025-02-13T10:00:00Z' },
  { event_id: 'WTE013', page_path: '/demo', event_type: 'form_submit', utm_source: 'referral', utm_medium: 'partner', utm_campaign: 'q1_referral', campaign_id: 'CMP003', device: 'desktop', city: 'Mumbai', session_id: 'S008', visitor_id: 'V008', created_at: '2025-02-13T10:02:00Z' },
  { event_id: 'WTE014', page_path: '/contact', event_type: 'page_view', utm_source: '', utm_medium: '', utm_campaign: '', campaign_id: null, device: 'desktop', city: 'Delhi', session_id: 'S009', visitor_id: 'V009', created_at: '2025-02-13T15:00:00Z' },
  { event_id: 'WTE015', page_path: '/contact', event_type: 'form_submit', utm_source: '', utm_medium: '', utm_campaign: '', campaign_id: null, device: 'desktop', city: 'Delhi', session_id: 'S009', visitor_id: 'V009', created_at: '2025-02-13T15:03:00Z' },
  { event_id: 'WTE016', page_path: '/builders', event_type: 'page_view', utm_source: 'google', utm_medium: 'display', utm_campaign: 'builder_awareness_south', campaign_id: 'CMP002', device: 'desktop', city: 'Chennai', session_id: 'S010', visitor_id: 'V010', created_at: '2025-02-14T08:00:00Z' },
  { event_id: 'WTE017', page_path: '/builders', event_type: 'cta_click', utm_source: 'google', utm_medium: 'display', utm_campaign: 'builder_awareness_south', campaign_id: 'CMP002', device: 'desktop', city: 'Chennai', session_id: 'S010', visitor_id: 'V010', created_at: '2025-02-14T08:02:00Z' },
  { event_id: 'WTE018', page_path: '/pricing', event_type: 'page_view', utm_source: 'whatsapp', utm_medium: 'drip', utm_campaign: 'agency_nurture_q1', campaign_id: 'CMP006', device: 'mobile', city: 'Mumbai', session_id: 'S011', visitor_id: 'V011', created_at: '2025-02-14T10:00:00Z' },
  { event_id: 'WTE019', page_path: '/demo', event_type: 'page_view', utm_source: 'meta', utm_medium: 'paid_social', utm_campaign: 'q1_agency_leadgen', campaign_id: 'CMP001', device: 'desktop', city: 'Delhi', session_id: 'S012', visitor_id: 'V012', created_at: '2025-02-14T11:00:00Z' },
  { event_id: 'WTE020', page_path: '/demo', event_type: 'form_submit', utm_source: 'meta', utm_medium: 'paid_social', utm_campaign: 'q1_agency_leadgen', campaign_id: 'CMP001', device: 'desktop', city: 'Delhi', session_id: 'S012', visitor_id: 'V012', created_at: '2025-02-14T11:05:00Z' },
];

// ── Activity Log ───────────────────────────────
export const seedMktActivityLog: MktActivityLog[] = [
  { id: 'MAL001', type: MktActivityType.CAMPAIGN_CREATED, description: 'Created campaign "Q1 Agency Lead Gen — Meta"', user_id: 'U001', linked_campaign_id: 'CMP001', city: null, created_at: '2024-12-20T10:00:00Z' },
  { id: 'MAL002', type: MktActivityType.UTM_GENERATED, description: 'Generated UTM link for CMP001 — cta_v1', user_id: 'U001', linked_campaign_id: 'CMP001', city: null, created_at: '2025-01-02T10:00:00Z' },
  { id: 'MAL003', type: MktActivityType.CAMPAIGN_CREATED, description: 'Created campaign "Builder Awareness — Google"', user_id: 'U005', linked_campaign_id: 'CMP002', city: null, created_at: '2025-01-10T10:00:00Z' },
  { id: 'MAL004', type: MktActivityType.COST_ADDED, description: 'Added ₹45,000 cost — Meta Ads Jan spend', user_id: 'U001', linked_campaign_id: 'CMP001', city: null, created_at: '2025-01-31T10:00:00Z' },
  { id: 'MAL005', type: MktActivityType.BUDGET_CHANGED, description: 'Updated CMP002 planned budget to ₹200,000', user_id: 'U005', linked_campaign_id: 'CMP002', city: null, created_at: '2025-01-15T10:00:00Z' },
  { id: 'MAL006', type: MktActivityType.OFFLINE_LOGGED, description: 'Logged offline activity: Mumbai Cold-Call Sprint', user_id: 'U002', linked_campaign_id: 'CMP001', city: 'Mumbai', created_at: '2025-02-05T10:00:00Z' },
  { id: 'MAL007', type: MktActivityType.CONTENT_SCHEDULED, description: 'Scheduled blog: "Why Builders Need a Dedicated CRM"', user_id: 'U005', linked_campaign_id: 'CMP002', city: null, created_at: '2025-02-12T10:00:00Z' },
  { id: 'MAL008', type: MktActivityType.COST_ADDED, description: 'Added ₹52,000 cost — Meta Ads Feb spend', user_id: 'U001', linked_campaign_id: 'CMP001', city: null, created_at: '2025-02-15T10:00:00Z' },
  { id: 'MAL009', type: MktActivityType.CAMPAIGN_CREATED, description: 'Created campaign "Pune Developer Meetup"', user_id: 'U001', linked_campaign_id: 'CMP005', city: 'Pune', created_at: '2025-02-01T10:00:00Z' },
  { id: 'MAL010', type: MktActivityType.CREATIVE_UPDATED, description: 'Updated creatives for CMP001 — Feb set', user_id: 'U001', linked_campaign_id: 'CMP001', city: null, created_at: '2025-02-01T10:00:00Z' },
];

// ── Helpers ─────────────────────────────────────
export function getCampaignName(id: string | null): string {
  if (!id) return '—';
  return seedCampaigns.find(c => c.campaign_id === id)?.campaign_name ?? id;
}

// UTM context defaults
export const utmContextDefaults: Record<UTMContext, { source: string; medium: string }> = {
  [UTMContext.META_PAID]: { source: 'meta', medium: 'paid_social' },
  [UTMContext.META_ORGANIC]: { source: 'meta', medium: 'social' },
  [UTMContext.YOUTUBE_ORGANIC]: { source: 'youtube', medium: 'video' },
  [UTMContext.YOUTUBE_ADS]: { source: 'youtube', medium: 'paid_video' },
  [UTMContext.LINKEDIN_PAID]: { source: 'linkedin', medium: 'paid_social' },
  [UTMContext.GOOGLE_SEARCH]: { source: 'google', medium: 'search' },
  [UTMContext.GOOGLE_DISPLAY]: { source: 'google', medium: 'display' },
  [UTMContext.EMAIL]: { source: 'email', medium: 'email' },
  [UTMContext.WHATSAPP]: { source: 'whatsapp', medium: 'messaging' },
  [UTMContext.OFFLINE_QR]: { source: 'offline', medium: 'qr' },
  [UTMContext.REFERRAL]: { source: 'referral', medium: 'partner' },
};
