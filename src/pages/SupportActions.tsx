import { useState } from 'react';
import { Search, Plus, FileText, Play, CheckCircle2, Copy, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface SupportActionTemplate {
  id: string;
  name: string;
  description: string;
  purpose: string;
  whenToUse: string;
  steps: string[];
  defaultMessage: string;
  outcomes: ('done' | 'blocked' | 'needs_followup')[];
  category: 'verification' | 'import' | 'communication' | 'configuration' | 'escalation';
}

const actionTemplates: SupportActionTemplate[] = [
  {
    id: 'sa1',
    name: 'Guide verification flow',
    description: 'Walk user through Aadhaar or RERA verification',
    purpose: 'Help users complete identity and regulatory verification',
    whenToUse: 'User stuck on Aadhaar or RERA verification step',
    steps: [
      'Confirm user has required documents ready',
      'Guide through verification screen step by step',
      'Verify status updates correctly in system',
      'Log completion in activity timeline',
    ],
    defaultMessage: 'I will walk you through the verification process. Please have your Aadhaar card ready.',
    outcomes: ['done', 'blocked', 'needs_followup'],
    category: 'verification',
  },
  {
    id: 'sa2',
    name: 'Help mapping import fields',
    description: 'Assist with CSV/Excel column mapping',
    purpose: 'Ensure clean data import with minimal errors',
    whenToUse: 'High error count on import or user confused about field mapping',
    steps: [
      'Review uploaded file structure',
      'Identify required vs optional fields',
      'Map columns to CRM fields',
      'Run validation preview',
      'Address any mapping conflicts',
    ],
    defaultMessage: 'Let me help you map your data fields. Please share your import file.',
    outcomes: ['done', 'blocked', 'needs_followup'],
    category: 'import',
  },
  {
    id: 'sa3',
    name: 'Send screenshot guide',
    description: 'Send visual guide for specific feature',
    purpose: 'Provide clear visual instructions for complex features',
    whenToUse: 'User needs visual walkthrough for a feature',
    steps: [
      'Identify the feature user needs help with',
      'Select appropriate screenshot guide',
      'Send via preferred channel',
      'Confirm user received and understands',
    ],
    defaultMessage: 'I am sending you a visual guide for this feature. Please check your messages.',
    outcomes: ['done', 'needs_followup'],
    category: 'communication',
  },
  {
    id: 'sa4',
    name: 'Nudge and unblock',
    description: 'Follow up to remove blockers',
    purpose: 'Re-engage stalled accounts and resolve blocking issues',
    whenToUse: 'Account stalled, need to follow up and remove blockers',
    steps: [
      'Review current blocker status',
      'Contact account via preferred channel',
      'Identify specific blocking issue',
      'Provide resolution or escalate',
      'Update status and set next action',
    ],
    defaultMessage: 'I noticed you have not completed the next step. How can I help you move forward?',
    outcomes: ['done', 'blocked', 'needs_followup'],
    category: 'communication',
  },
  {
    id: 'sa5',
    name: 'Send calendar invite',
    description: 'Schedule review meeting',
    purpose: 'Book 7-day review or training session',
    whenToUse: 'Account ready for 7-day review or needs training session',
    steps: [
      'Confirm preferred time with account',
      'Create calendar event',
      'Send invite with agenda',
      'Log scheduled event in timeline',
    ],
    defaultMessage: 'I will send you a calendar invite for our review session.',
    outcomes: ['done', 'needs_followup'],
    category: 'communication',
  },
  {
    id: 'sa6',
    name: 'Confirm role setup',
    description: 'Verify permissions and visibility',
    purpose: 'Ensure team roles and visibility are correctly configured',
    whenToUse: 'After team members added or visibility issues reported',
    steps: [
      'Review current role assignments',
      'Verify visibility settings match requirements',
      'Test access for each role type',
      'Document configuration',
    ],
    defaultMessage: 'I will verify your team roles and permissions are set up correctly.',
    outcomes: ['done', 'blocked'],
    category: 'configuration',
  },
  {
    id: 'sa7',
    name: 'Habit reinforcement',
    description: 'Encourage daily CRM usage patterns',
    purpose: 'Build sustainable usage habits for long-term adoption',
    whenToUse: 'Account showing low engagement or inconsistent usage',
    steps: [
      'Review current usage patterns',
      'Identify key daily actions to reinforce',
      'Share tips for building CRM habit',
      'Set follow-up to check progress',
    ],
    defaultMessage: 'Here are some tips to make CRM usage part of your daily routine.',
    outcomes: ['done', 'needs_followup'],
    category: 'communication',
  },
  {
    id: 'sa8',
    name: 'Fix role issues',
    description: 'Resolve team permission conflicts',
    purpose: 'Diagnose and fix visibility or permission problems',
    whenToUse: 'Team members cannot see expected data or have wrong access',
    steps: [
      'Identify specific permission issue',
      'Review role assignments',
      'Check visibility rules',
      'Apply corrections',
      'Verify fix with user',
    ],
    defaultMessage: 'I will investigate the permission issue and fix it for you.',
    outcomes: ['done', 'blocked', 'needs_followup'],
    category: 'configuration',
  },
  {
    id: 'sa9',
    name: 'Request portal prerequisites',
    description: 'Gather requirements for portal integration',
    purpose: 'Collect necessary access and information for MagicBricks/99acres setup',
    whenToUse: 'Before starting portal integration for broker/agency',
    steps: [
      'Share prerequisites checklist with account',
      'Confirm access to portal admin account',
      'Verify enquiry delivery method',
      'Confirm active listing for test',
    ],
    defaultMessage: 'Before we set up portal integration, please confirm you have the following ready.',
    outcomes: ['done', 'blocked', 'needs_followup'],
    category: 'configuration',
  },
  {
    id: 'sa10',
    name: 'Escalate role and visibility issue',
    description: 'Escalate complex permission problems',
    purpose: 'Route difficult permission issues to technical support',
    whenToUse: 'Standard role fixes not resolving the issue',
    steps: [
      'Document issue details',
      'Collect relevant screenshots',
      'Create escalation ticket',
      'Notify account of escalation',
      'Track until resolution',
    ],
    defaultMessage: 'I am escalating this to our technical team. You will hear back within 24 hours.',
    outcomes: ['done'],
    category: 'escalation',
  },
];

const categoryLabels: Record<string, string> = {
  verification: 'Verification',
  import: 'Import Support',
  communication: 'Communication',
  configuration: 'Configuration',
  escalation: 'Escalation',
};

export default function SupportActions() {
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState<SupportActionTemplate | null>(null);

  const filteredActions = actionTemplates.filter(action =>
    action.name.toLowerCase().includes(search.toLowerCase()) ||
    action.description.toLowerCase().includes(search.toLowerCase())
  );

  const categories = ['verification', 'import', 'communication', 'configuration', 'escalation'] as const;

  const handleUseAction = (action: SupportActionTemplate) => {
    toast.success('Action applied', {
      description: `${action.name} logged to timeline`,
    });
    setSelectedAction(null);
  };

  const handleCopyMessage = (message: string) => {
    navigator.clipboard.writeText(message);
    toast.success('Message copied');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Support Actions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Templates, guides, and playbooks for support operations
          </p>
        </div>
        <Button variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          New Action
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search actions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs by Category */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {categories.map(cat => (
            <TabsTrigger key={cat} value={cat}>{categoryLabels[cat]}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredActions.map((action) => (
              <ActionCard 
                key={action.id} 
                action={action} 
                onView={() => setSelectedAction(action)}
                onUse={() => handleUseAction(action)}
              />
            ))}
          </div>
        </TabsContent>

        {categories.map(cat => (
          <TabsContent key={cat} value={cat} className="mt-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredActions.filter(a => a.category === cat).map((action) => (
                <ActionCard 
                  key={action.id} 
                  action={action} 
                  onView={() => setSelectedAction(action)}
                  onUse={() => handleUseAction(action)}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Quick Reference */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Quick Reference</CardTitle>
          <CardDescription>When to use each action type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <span className="font-medium">Guide verification flow</span>
                <p className="text-muted-foreground">User stuck on Aadhaar or RERA verification</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <span className="font-medium">Help mapping import fields</span>
                <p className="text-muted-foreground">High error count or confused about column mapping</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <span className="font-medium">Nudge and unblock</span>
                <p className="text-muted-foreground">Account stalled, need to follow up and remove blockers</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <span className="font-medium">Send calendar invite</span>
                <p className="text-muted-foreground">Schedule 7-day review or training session</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
              <div>
                <span className="font-medium">Escalate role issue</span>
                <p className="text-muted-foreground">Standard fixes not working, needs technical review</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <span className="font-medium">Request portal prerequisites</span>
                <p className="text-muted-foreground">Before MagicBricks or 99acres integration</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Detail Dialog */}
      <Dialog open={!!selectedAction} onOpenChange={() => setSelectedAction(null)}>
        <DialogContent className="max-w-lg">
          {selectedAction && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle>{selectedAction.name}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Purpose</div>
                  <p className="text-sm mt-1">{selectedAction.purpose}</p>
                </div>

                <div>
                  <div className="text-sm font-medium text-muted-foreground">When to Use</div>
                  <p className="text-sm mt-1">{selectedAction.whenToUse}</p>
                </div>

                <div>
                  <div className="text-sm font-medium text-muted-foreground">Steps</div>
                  <ol className="text-sm mt-1 space-y-1 list-decimal list-inside">
                    {selectedAction.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-medium text-muted-foreground">Default Message</div>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleCopyMessage(selectedAction.defaultMessage)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <p className="text-sm p-3 bg-muted/50 rounded-lg">{selectedAction.defaultMessage}</p>
                </div>

                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">Outcome Options</div>
                  <div className="flex gap-2">
                    {selectedAction.outcomes.map(outcome => (
                      <Badge key={outcome} variant="outline" className="capitalize">
                        {outcome.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  className="flex-1 bg-primary hover:bg-primary/90"
                  onClick={() => handleUseAction(selectedAction)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Use Action
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleCopyMessage(selectedAction.defaultMessage)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Message
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionCard({ 
  action, 
  onView, 
  onUse 
}: { 
  action: SupportActionTemplate; 
  onView: () => void;
  onUse: () => void;
}) {
  return (
    <Card className="border-border hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="p-2 bg-primary/10 rounded-lg">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <Badge variant="secondary" className="text-xs capitalize">
            {categoryLabels[action.category]}
          </Badge>
        </div>
        <CardTitle className="text-base mt-3">{action.name}</CardTitle>
        <CardDescription>{action.description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90" onClick={onUse}>
            <Play className="h-3 w-3 mr-1" />
            Use
          </Button>
          <Button size="sm" variant="outline" onClick={onView}>
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
