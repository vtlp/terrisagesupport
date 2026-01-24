// Onboarding and Account Management Types

export type Cohort = 'channel_partner' | 'broker_agency' | 'builder_venture';
export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'stalled';
export type ActivationStatus = 'pending' | 'pass' | 'at_risk' | 'failed';
export type TaskStatus = 'not_started' | 'in_progress' | 'blocked' | 'done' | 'not_applicable';
export type TaskOwner = 'user' | 'internal';
export type TaskWhen = 'session' | '48h';
export type BlockerCategory = 
  | 'verification' 
  | 'import_issues' 
  | 'data_quality' 
  | 'user_availability' 
  | 'technical' 
  | 'permissions' 
  | 'training' 
  | 'none';

export type SupportActionType = 
  | 'guide_verification'
  | 'help_mapping'
  | 'send_screenshot_guide'
  | 'nudge_unblock'
  | 'send_calendar_invite'
  | 'confirm_role_setup'
  | 'habit_reinforcement'
  | 'fix_role_issues';

export interface SupportAction {
  id: string;
  name: string;
  description: string;
  type: SupportActionType;
}

export interface ChecklistTask {
  id: string;
  taskNumber: number;
  task: string;
  owner: TaskOwner;
  when: TaskWhen;
  evidence: string;
  supportAction: string;
  status: TaskStatus;
  dueDate?: Date;
  blocker?: string;
  blockerCategory?: BlockerCategory;
  notes?: string;
  completedAt?: Date;
  completedBy?: string;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  cohort: Cohort;
  description: string;
  tasks: Omit<ChecklistTask, 'id' | 'status' | 'dueDate' | 'blocker' | 'notes' | 'completedAt' | 'completedBy'>[];
}

export interface AccountChecklist {
  id: string;
  accountId: string;
  templateId: string;
  cohort: Cohort;
  tasks: ChecklistTask[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OnboardingAccount {
  id: string;
  name: string;
  city: string;
  cohort: Cohort;
  onboardingOwnerId?: string;
  onboardingOwnerName?: string;
  onboardingStatus: OnboardingStatus;
  
  // Verification status only (no actual data stored)
  aadhaarVerified: boolean;
  aadhaarVerifiedAt?: Date;
  reraVerified: boolean;
  reraVerifiedAt?: Date;
  gstinVerified: boolean;
  gstinVerifiedAt?: Date;
  
  // Import tracking
  importType?: 'leads' | 'listings' | 'inventory' | 'enquiries' | 'mixed';
  importStartedAt?: Date;
  importCompletedAt?: Date;
  rowsImported: number;
  fixItQueueCount: number;
  duplicatesFound: number;
  
  // Activation
  activation48h: ActivationStatus;
  activationDate?: Date;
  sevenDaySuccess: ActivationStatus;
  sevenDayReviewDate?: Date;
  
  // Tracking
  topBlockerCategory?: BlockerCategory;
  nextSupportAction?: string;
  nextSupportActionDate?: Date;
  notes?: string;
  
  // Computed fields
  hoursImportStartToComplete?: number;
  daysActivationToToday?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityLogEntry {
  id: string;
  accountId: string;
  action: string;
  details: string;
  userId: string;
  userName: string;
  createdAt: Date;
}

export interface IntegrationConfig {
  id: string;
  accountId: string;
  type: 'magicbricks' | '99acres' | 'housing' | 'other';
  status: 'not_configured' | 'pending' | 'active' | 'error';
  lastSyncAt?: Date;
  errorMessage?: string;
}

export interface IntegrationPrerequisite {
  id: string;
  label: string;
  completed: boolean;
}

// Team and Permissions
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'manager' | 'agent';
  visibility: 'all' | 'team' | 'own';
  createdAt: Date;
}

// Import Health
export interface ImportJob {
  id: string;
  accountId: string;
  type: 'leads' | 'listings' | 'inventory' | 'enquiries';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  processedRows: number;
  errorRows: number;
  duplicateRows: number;
  startedAt: Date;
  completedAt?: Date;
}

// Activation Review
export interface ActivationReview {
  id: string;
  accountId: string;
  type: '48h' | '7day';
  status: ActivationStatus;
  scheduledDate?: Date;
  completedDate?: Date;
  notes?: string;
  reviewerId?: string;
  reviewerName?: string;
}

export const COHORT_LABELS: Record<Cohort, string> = {
  channel_partner: 'Channel Partner / Consultant',
  broker_agency: 'Broker / Agency',
  builder_venture: 'Builder / Venture',
};

export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  stalled: 'Stalled',
};

export const ACTIVATION_STATUS_LABELS: Record<ActivationStatus, string> = {
  pending: 'Pending',
  pass: 'Pass',
  at_risk: 'At Risk',
  failed: 'Failed',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
  not_applicable: 'N/A',
};

export const BLOCKER_CATEGORY_LABELS: Record<BlockerCategory, string> = {
  verification: 'Verification',
  import_issues: 'Import Issues',
  data_quality: 'Data Quality',
  user_availability: 'User Availability',
  technical: 'Technical',
  permissions: 'Permissions',
  training: 'Training',
  none: 'None',
};
