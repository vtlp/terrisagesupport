import type {
  OnboardingAccount,
  ChecklistTemplate,
  AccountChecklist,
  SupportAction,
  ActivityLogEntry,
  IntegrationConfig,
  ImportJob,
  ActivationReview,
  ChecklistTask,
} from '@/types/onboarding';

const now = new Date();
const subDays = (date: Date, days: number) => new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
const subHours = (date: Date, hours: number) => new Date(date.getTime() - hours * 60 * 60 * 1000);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

// Support Actions Library
export const supportActions: SupportAction[] = [
  { id: 'sa1', name: 'Guide verification flow', description: 'Walk user through Aadhaar or RERA verification', type: 'guide_verification' },
  { id: 'sa2', name: 'Help mapping import fields', description: 'Assist with CSV/Excel column mapping', type: 'help_mapping' },
  { id: 'sa3', name: 'Send screenshot guide', description: 'Send visual guide for specific feature', type: 'send_screenshot_guide' },
  { id: 'sa4', name: 'Nudge and unblock', description: 'Follow up to remove blockers', type: 'nudge_unblock' },
  { id: 'sa5', name: 'Send calendar invite', description: 'Schedule review meeting', type: 'send_calendar_invite' },
  { id: 'sa6', name: 'Confirm role setup', description: 'Verify permissions and visibility', type: 'confirm_role_setup' },
  { id: 'sa7', name: 'Habit reinforcement', description: 'Encourage daily CRM usage patterns', type: 'habit_reinforcement' },
  { id: 'sa8', name: 'Fix role issues', description: 'Resolve team permission conflicts', type: 'fix_role_issues' },
];

// Checklist Templates
export const checklistTemplates: ChecklistTemplate[] = [
  {
    id: 'tmpl-cp',
    name: 'Channel Partners / Consultants',
    cohort: 'channel_partner',
    description: 'Primary market onboarding for channel partners and consultants',
    tasks: [
      { taskNumber: 1, task: 'Complete Aadhaar verification', owner: 'user', when: 'session', evidence: 'Aadhaar Verified = Yes', supportAction: 'Guide user through flow' },
      { taskNumber: 2, task: 'Complete RERA verification', owner: 'user', when: 'session', evidence: 'RERA Verified = Yes', supportAction: 'Support if fails' },
      { taskNumber: 3, task: 'Import leads (minimum 20)', owner: 'user', when: 'session', evidence: 'Rows Imported ≥ 20; Fix-It ≤ 10%', supportAction: 'Help mapping if needed' },
      { taskNumber: 4, task: 'Set ownership rules (lead allocation)', owner: 'internal', when: 'session', evidence: 'Ownership is unambiguous', supportAction: 'Confirm role setup' },
      { taskNumber: 5, task: 'Create SLA follow-up rule', owner: 'internal', when: 'session', evidence: 'Follow-up date set for each lead', supportAction: 'Teach minimal habit' },
      { taskNumber: 6, task: 'Pin reporting view (weekly snapshot)', owner: 'internal', when: '48h', evidence: 'Report view saved/pinned', supportAction: 'Send screenshot guide' },
      { taskNumber: 7, task: '48-hour activation check', owner: 'internal', when: '48h', evidence: 'Activation status = Pass or At Risk', supportAction: 'Nudge and unblock' },
      { taskNumber: 8, task: '7-day review scheduled', owner: 'internal', when: '48h', evidence: 'Meeting booked', supportAction: 'Send calendar invite' },
    ],
  },
  {
    id: 'tmpl-ba',
    name: 'Brokers / Agencies',
    cohort: 'broker_agency',
    description: 'Secondary market and rentals onboarding for brokers and agencies',
    tasks: [
      { taskNumber: 1, task: 'Complete Aadhaar verification', owner: 'user', when: 'session', evidence: 'Aadhaar Verified = Yes', supportAction: 'Guide user through flow' },
      { taskNumber: 2, task: 'Complete RERA verification', owner: 'user', when: 'session', evidence: 'RERA Verified = Yes', supportAction: 'Support if fails' },
      { taskNumber: 3, task: 'Import leads (minimum 10)', owner: 'user', when: 'session', evidence: 'Rows Imported ≥ 10', supportAction: 'Help mapping if needed' },
      { taskNumber: 4, task: 'Import listings (minimum 5)', owner: 'user', when: 'session', evidence: 'Listings Imported ≥ 5', supportAction: 'Help with locality + price fields' },
      { taskNumber: 5, task: 'Set follow-ups for all imported leads', owner: 'user', when: '48h', evidence: 'Every lead has Next Action + Date', supportAction: 'Habit reinforcement' },
      { taskNumber: 6, task: 'Confirm team visibility (agency only)', owner: 'internal', when: '48h', evidence: 'Roles/permissions correct; visibility works', supportAction: 'Fix role issues' },
      { taskNumber: 7, task: '48-hour activation check', owner: 'internal', when: '48h', evidence: 'Activation status = Pass or At Risk', supportAction: 'Nudge and unblock' },
      { taskNumber: 8, task: '7-day review scheduled', owner: 'internal', when: '48h', evidence: 'Meeting booked', supportAction: 'Send calendar invite' },
    ],
  },
  {
    id: 'tmpl-bv',
    name: 'Builders / Ventures',
    cohort: 'builder_venture',
    description: 'Projects and inventory onboarding for builders and ventures',
    tasks: [
      { taskNumber: 1, task: 'Complete Aadhaar verification', owner: 'user', when: 'session', evidence: 'Aadhaar Verified = Yes', supportAction: 'Guide user through flow' },
      { taskNumber: 2, task: 'Complete RERA verification', owner: 'user', when: 'session', evidence: 'RERA Verified = Yes', supportAction: 'Support if fails' },
      { taskNumber: 3, task: 'Create one project', owner: 'user', when: 'session', evidence: 'Project created with basic details', supportAction: 'Confirm naming + location' },
      { taskNumber: 4, task: 'Import minimum viable inventory', owner: 'user', when: 'session', evidence: 'Inventory rows imported; no critical errors', supportAction: 'Help mapping fields' },
      { taskNumber: 5, task: 'Import enquiries/leads (optional if available)', owner: 'user', when: '48h', evidence: 'Lead pipeline has initial leads', supportAction: 'Provide template' },
      { taskNumber: 6, task: 'Assign owners to pipeline stages', owner: 'internal', when: '48h', evidence: 'Ownership defined', supportAction: 'Configure roles' },
      { taskNumber: 7, task: '48-hour activation check', owner: 'internal', when: '48h', evidence: 'Activation status = Pass or At Risk', supportAction: 'Nudge and unblock' },
      { taskNumber: 8, task: '7-day review scheduled', owner: 'internal', when: '48h', evidence: 'Meeting booked', supportAction: 'Send calendar invite' },
    ],
  },
];

// Integration Prerequisites for Broker/Agency cohort
export const integrationPrerequisites = [
  { id: 'prereq-1', label: 'Access to the MagicBricks or 99acres account that receives enquiries (admin login or equivalent access)', completed: false },
  { id: 'prereq-2', label: 'Clarity on where enquiries are currently delivered: portal inbox, email, CRM export, or partner feed', completed: false },
  { id: 'prereq-3', label: 'At least one active listing on the portal (recommended) to run a real test enquiry', completed: false },
];

// Mock Onboarding Accounts
export const onboardingAccounts: OnboardingAccount[] = [
  {
    id: 'oa1',
    name: 'PropFirst Realty',
    city: 'Mumbai',
    cohort: 'channel_partner',
    onboardingOwnerId: 'u1',
    onboardingOwnerName: 'Sarah Chen',
    onboardingStatus: 'in_progress',
    aadhaarVerified: true,
    aadhaarVerifiedAt: subDays(now, 2),
    reraVerified: true,
    reraVerifiedAt: subDays(now, 2),
    gstinVerified: false,
    importType: 'leads',
    importStartedAt: subHours(now, 4),
    importCompletedAt: subHours(now, 3),
    rowsImported: 45,
    fixItQueueCount: 3,
    duplicatesFound: 2,
    activation48h: 'pending',
    sevenDaySuccess: 'pending',
    topBlockerCategory: 'none',
    nextSupportAction: 'Pin reporting view',
    nextSupportActionDate: addDays(now, 1),
    hoursImportStartToComplete: 1,
    daysActivationToToday: 0,
    createdAt: subDays(now, 3),
    updatedAt: now,
  },
  {
    id: 'oa2',
    name: 'Elite Homes Agency',
    city: 'Delhi',
    cohort: 'broker_agency',
    onboardingOwnerId: 'u2',
    onboardingOwnerName: 'James Wilson',
    onboardingStatus: 'in_progress',
    aadhaarVerified: true,
    aadhaarVerifiedAt: subDays(now, 1),
    reraVerified: false,
    gstinVerified: false,
    importType: 'listings',
    importStartedAt: subHours(now, 2),
    rowsImported: 8,
    fixItQueueCount: 12,
    duplicatesFound: 0,
    activation48h: 'at_risk',
    activationDate: subDays(now, 1),
    sevenDaySuccess: 'pending',
    topBlockerCategory: 'verification',
    nextSupportAction: 'Support RERA verification',
    nextSupportActionDate: now,
    hoursImportStartToComplete: undefined,
    daysActivationToToday: 1,
    createdAt: subDays(now, 2),
    updatedAt: now,
  },
  {
    id: 'oa3',
    name: 'Skyline Builders',
    city: 'Bangalore',
    cohort: 'builder_venture',
    onboardingOwnerId: 'u3',
    onboardingOwnerName: 'Emma Thompson',
    onboardingStatus: 'completed',
    aadhaarVerified: true,
    aadhaarVerifiedAt: subDays(now, 10),
    reraVerified: true,
    reraVerifiedAt: subDays(now, 10),
    gstinVerified: true,
    gstinVerifiedAt: subDays(now, 9),
    importType: 'inventory',
    importStartedAt: subDays(now, 9),
    importCompletedAt: subDays(now, 9),
    rowsImported: 120,
    fixItQueueCount: 0,
    duplicatesFound: 5,
    activation48h: 'pass',
    activationDate: subDays(now, 8),
    sevenDaySuccess: 'pass',
    sevenDayReviewDate: subDays(now, 3),
    topBlockerCategory: 'none',
    hoursImportStartToComplete: 2,
    daysActivationToToday: 8,
    createdAt: subDays(now, 12),
    updatedAt: subDays(now, 3),
  },
  {
    id: 'oa4',
    name: 'HomeConnect Partners',
    city: 'Pune',
    cohort: 'channel_partner',
    onboardingOwnerId: 'u4',
    onboardingOwnerName: 'Michael Brown',
    onboardingStatus: 'stalled',
    aadhaarVerified: true,
    aadhaarVerifiedAt: subDays(now, 5),
    reraVerified: false,
    gstinVerified: false,
    importType: 'leads',
    importStartedAt: subDays(now, 4),
    rowsImported: 12,
    fixItQueueCount: 8,
    duplicatesFound: 1,
    activation48h: 'at_risk',
    activationDate: subDays(now, 3),
    sevenDaySuccess: 'pending',
    topBlockerCategory: 'import_issues',
    nextSupportAction: 'Help mapping import fields',
    nextSupportActionDate: now,
    hoursImportStartToComplete: undefined,
    daysActivationToToday: 3,
    createdAt: subDays(now, 6),
    updatedAt: now,
  },
  {
    id: 'oa5',
    name: 'Urban Nest Realtors',
    city: 'Hyderabad',
    cohort: 'broker_agency',
    onboardingStatus: 'not_started',
    aadhaarVerified: false,
    reraVerified: false,
    gstinVerified: false,
    rowsImported: 0,
    fixItQueueCount: 0,
    duplicatesFound: 0,
    activation48h: 'pending',
    sevenDaySuccess: 'pending',
    topBlockerCategory: 'user_availability',
    nextSupportAction: 'Schedule onboarding session',
    nextSupportActionDate: addDays(now, 2),
    createdAt: subDays(now, 1),
    updatedAt: now,
  },
  {
    id: 'oa6',
    name: 'Prestige Developers',
    city: 'Chennai',
    cohort: 'builder_venture',
    onboardingOwnerId: 'u1',
    onboardingOwnerName: 'Sarah Chen',
    onboardingStatus: 'in_progress',
    aadhaarVerified: true,
    aadhaarVerifiedAt: subDays(now, 3),
    reraVerified: true,
    reraVerifiedAt: subDays(now, 3),
    gstinVerified: true,
    gstinVerifiedAt: subDays(now, 2),
    importType: 'mixed',
    importStartedAt: subHours(now, 6),
    importCompletedAt: subHours(now, 4),
    rowsImported: 85,
    fixItQueueCount: 5,
    duplicatesFound: 3,
    activation48h: 'pending',
    sevenDaySuccess: 'pending',
    topBlockerCategory: 'none',
    nextSupportAction: '48-hour activation check',
    nextSupportActionDate: addDays(now, 1),
    hoursImportStartToComplete: 2,
    createdAt: subDays(now, 4),
    updatedAt: now,
  },
];

// Generate checklists for accounts
const generateChecklist = (account: OnboardingAccount): AccountChecklist => {
  const template = checklistTemplates.find(t => t.cohort === account.cohort)!;
  const tasks: ChecklistTask[] = template.tasks.map((t, idx) => ({
    id: `${account.id}-task-${idx + 1}`,
    ...t,
    status: idx < 3 ? 'done' : idx < 5 ? 'in_progress' : 'not_started',
    dueDate: t.when === 'session' ? account.createdAt : addDays(account.createdAt, 2),
    completedAt: idx < 3 ? subDays(now, 1) : undefined,
    completedBy: idx < 3 ? account.onboardingOwnerName : undefined,
  }));
  
  return {
    id: `cl-${account.id}`,
    accountId: account.id,
    templateId: template.id,
    cohort: account.cohort,
    tasks,
    createdAt: account.createdAt,
    updatedAt: now,
  };
};

export const accountChecklists: AccountChecklist[] = onboardingAccounts
  .filter(a => a.onboardingStatus !== 'not_started')
  .map(generateChecklist);

// Activity Log
export const activityLog: ActivityLogEntry[] = [
  { id: 'al1', accountId: 'oa1', action: 'Checklist started', details: 'Channel Partner checklist instantiated', userId: 'u1', userName: 'Sarah Chen', createdAt: subDays(now, 3) },
  { id: 'al2', accountId: 'oa1', action: 'Aadhaar verified', details: 'User completed verification', userId: 'u1', userName: 'Sarah Chen', createdAt: subDays(now, 2) },
  { id: 'al3', accountId: 'oa1', action: 'RERA verified', details: 'RERA ID confirmed', userId: 'u1', userName: 'Sarah Chen', createdAt: subDays(now, 2) },
  { id: 'al4', accountId: 'oa1', action: 'Import completed', details: '45 leads imported, 3 in Fix-It queue', userId: 'u1', userName: 'Sarah Chen', createdAt: subHours(now, 3) },
  { id: 'al5', accountId: 'oa2', action: 'Checklist started', details: 'Broker/Agency checklist instantiated', userId: 'u2', userName: 'James Wilson', createdAt: subDays(now, 2) },
  { id: 'al6', accountId: 'oa2', action: 'Blocker identified', details: 'RERA verification failing, user needs support', userId: 'u2', userName: 'James Wilson', createdAt: now },
  { id: 'al7', accountId: 'oa3', action: '7-day review completed', details: 'Account fully activated, all tasks done', userId: 'u3', userName: 'Emma Thompson', createdAt: subDays(now, 3) },
];

// Integration configs
export const integrationConfigs: IntegrationConfig[] = [
  { id: 'int1', accountId: 'oa2', type: 'magicbricks', status: 'pending', errorMessage: undefined },
  { id: 'int2', accountId: 'oa2', type: '99acres', status: 'not_configured' },
  { id: 'int3', accountId: 'oa3', type: 'magicbricks', status: 'active', lastSyncAt: subHours(now, 2) },
];

// Import Jobs
export const importJobs: ImportJob[] = [
  { id: 'ij1', accountId: 'oa1', type: 'leads', status: 'completed', totalRows: 48, processedRows: 45, errorRows: 3, duplicateRows: 2, startedAt: subHours(now, 4), completedAt: subHours(now, 3) },
  { id: 'ij2', accountId: 'oa2', type: 'listings', status: 'processing', totalRows: 20, processedRows: 8, errorRows: 12, duplicateRows: 0, startedAt: subHours(now, 2) },
  { id: 'ij3', accountId: 'oa3', type: 'inventory', status: 'completed', totalRows: 125, processedRows: 120, errorRows: 0, duplicateRows: 5, startedAt: subDays(now, 9), completedAt: subDays(now, 9) },
  { id: 'ij4', accountId: 'oa4', type: 'leads', status: 'failed', totalRows: 50, processedRows: 12, errorRows: 8, duplicateRows: 1, startedAt: subDays(now, 4) },
];

// Activation Reviews
export const activationReviews: ActivationReview[] = [
  { id: 'ar1', accountId: 'oa1', type: '48h', status: 'pending', scheduledDate: addDays(now, 1) },
  { id: 'ar2', accountId: 'oa2', type: '48h', status: 'at_risk', scheduledDate: now, notes: 'RERA verification blocking progress' },
  { id: 'ar3', accountId: 'oa3', type: '48h', status: 'pass', completedDate: subDays(now, 8), reviewerId: 'u3', reviewerName: 'Emma Thompson' },
  { id: 'ar4', accountId: 'oa3', type: '7day', status: 'pass', scheduledDate: subDays(now, 3), completedDate: subDays(now, 3), reviewerId: 'u3', reviewerName: 'Emma Thompson' },
  { id: 'ar5', accountId: 'oa4', type: '48h', status: 'at_risk', completedDate: subDays(now, 1), notes: 'High Fix-It count, needs import support' },
];

// Dashboard metrics
export const onboardingMetrics = {
  totalAccounts: onboardingAccounts.length,
  inProgress: onboardingAccounts.filter(a => a.onboardingStatus === 'in_progress').length,
  completed: onboardingAccounts.filter(a => a.onboardingStatus === 'completed').length,
  stalled: onboardingAccounts.filter(a => a.onboardingStatus === 'stalled').length,
  activation48hPass: onboardingAccounts.filter(a => a.activation48h === 'pass').length,
  activation48hAtRisk: onboardingAccounts.filter(a => a.activation48h === 'at_risk').length,
  sevenDayPass: onboardingAccounts.filter(a => a.sevenDaySuccess === 'pass').length,
  pendingReviews: activationReviews.filter(r => r.status === 'pending').length,
  overdueActions: onboardingAccounts.filter(a => a.nextSupportActionDate && a.nextSupportActionDate < now).length,
};
