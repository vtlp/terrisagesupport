// Enquiry and Demo Management Types

export type EnquirySource = 
  | 'call' 
  | 'website' 
  | 'referral' 
  | 'manual' 
  | 'meta_ads' 
  | 'google_ads' 
  | 'magicbricks' 
  | '99acres' 
  | 'walkin';

export type EnquirySegment = 
  | 'solo_agent' 
  | 'agency' 
  | 'builder' 
  | 'venture_owner' 
  | 'builder_group';

export type PipelineStage = 
  | 'enquiry_received'
  | 'qualified'
  | 'demo_scheduled'
  | 'demo_completed'
  | 'account_created'
  | 'verification_started'
  | 'import_in_progress'
  | 'activation_48h'
  | 'review_7day_scheduled'
  | 'review_7day_success'
  | 'ongoing_maintenance';

export type DemoOutcome = 
  | 'completed' 
  | 'no_show' 
  | 'reschedule' 
  | 'not_a_fit';

export type DemoType = 'zoom' | 'google_meet' | 'phone';

export interface Enquiry {
  id: string;
  name: string;
  phone: string;
  email?: string;
  city: string;
  segment: EnquirySegment;
  source: EnquirySource;
  stage: PipelineStage;
  preferredLanguage?: 'english' | 'hindi' | 'telugu';
  notes?: string;
  
  // Qualification
  segmentConfirmed: boolean;
  cityConfirmed: boolean;
  dataMigrationSourceConfirmed: boolean;
  dataMigrationSource?: 'excel' | 'whatsapp' | 'portal' | 'manual' | 'other_crm';
  demoRequired: boolean;
  
  // Agency/Builder specific
  teamSize?: number;
  rentalsOnly?: boolean;
  currentSystem?: 'excel' | 'whatsapp' | 'other_crm' | 'none';
  portalUsage?: ('magicbricks' | '99acres' | 'none')[];
  
  // Builder specific
  inventoryType?: ('apartments' | 'plots' | 'commercial')[];
  projectsCount?: number;
  leadSources?: ('walkins' | 'digital_ads' | 'channel_partners' | 'portals')[];
  
  assignedAgentId?: string;
  assignedAgentName?: string;
  nextAction?: string;
  nextActionDate?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Demo {
  id: string;
  enquiryId?: string;
  accountId?: string;
  accountName?: string;
  contactName: string;
  contactPhone: string;
  city: string;
  segment: EnquirySegment;
  
  scheduledDate: Date;
  duration: number; // minutes
  type: DemoType;
  meetingLink?: string;
  
  outcome?: DemoOutcome;
  outcomeNotes?: string;
  nextSupportAction?: string;
  
  agendaItems: string[];
  hostId: string;
  hostName: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarSlot {
  date: Date;
  time: string;
  available: boolean;
}

export const ENQUIRY_SOURCE_LABELS: Record<EnquirySource, string> = {
  call: 'Call',
  website: 'Website',
  referral: 'Referral',
  manual: 'Manual Entry',
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  magicbricks: 'MagicBricks',
  '99acres': '99acres',
  walkin: 'Walk-in',
};

export const SEGMENT_LABELS: Record<EnquirySegment, string> = {
  solo_agent: 'Solo Agent',
  agency: 'Agency',
  builder: 'Builder',
  venture_owner: 'Venture Owner',
  builder_group: 'Builder Group',
};

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  enquiry_received: 'Enquiry Received',
  qualified: 'Qualified',
  demo_scheduled: 'Demo Scheduled',
  demo_completed: 'Demo Completed',
  account_created: 'Account Created',
  verification_started: 'Verification Started',
  import_in_progress: 'Import in Progress',
  activation_48h: 'Activation (48h)',
  review_7day_scheduled: '7-Day Review Scheduled',
  review_7day_success: '7-Day Success',
  ongoing_maintenance: 'Ongoing Maintenance',
};

export const DEMO_OUTCOME_LABELS: Record<DemoOutcome, string> = {
  completed: 'Completed',
  no_show: 'No Show',
  reschedule: 'Reschedule Required',
  not_a_fit: 'Not a Fit',
};

export type SupportRole = 'support_agent' | 'onboarding_owner' | 'support_admin';

export const SUPPORT_ROLE_LABELS: Record<SupportRole, string> = {
  support_agent: 'Support Agent',
  onboarding_owner: 'Onboarding Owner',
  support_admin: 'Support Admin',
};

export interface SupportUser {
  id: string;
  name: string;
  email: string;
  role: SupportRole;
  avatar?: string;
}
