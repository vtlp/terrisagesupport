import { useState } from 'react';
import { Search, Plus, FileText, Play, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supportActions } from '@/data/onboardingData';

export default function SupportActions() {
  const [search, setSearch] = useState('');

  const filteredActions = supportActions.filter(action =>
    action.name.toLowerCase().includes(search.toLowerCase()) ||
    action.description.toLowerCase().includes(search.toLowerCase())
  );

  const actionCategories = [
    {
      title: 'Verification',
      description: 'Help users complete verification flows',
      actions: filteredActions.filter(a => a.type === 'guide_verification'),
    },
    {
      title: 'Import Support',
      description: 'Assist with data imports and mapping',
      actions: filteredActions.filter(a => a.type === 'help_mapping'),
    },
    {
      title: 'Communication',
      description: 'Guides, nudges, and calendar actions',
      actions: filteredActions.filter(a => 
        ['send_screenshot_guide', 'nudge_unblock', 'send_calendar_invite'].includes(a.type)
      ),
    },
    {
      title: 'Configuration',
      description: 'Role and permission setup',
      actions: filteredActions.filter(a => 
        ['confirm_role_setup', 'fix_role_issues', 'habit_reinforcement'].includes(a.type)
      ),
    },
  ];

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

      {/* Action Categories */}
      <div className="space-y-6">
        {actionCategories.map((category) => (
          <div key={category.title}>
            <h2 className="text-lg font-medium mb-3">{category.title}</h2>
            <p className="text-sm text-muted-foreground mb-4">{category.description}</p>
            {category.actions.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.actions.map((action) => (
                  <Card key={action.id} className="border-border hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          Template
                        </Badge>
                      </div>
                      <CardTitle className="text-base mt-3">{action.name}</CardTitle>
                      <CardDescription>{action.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90">
                          <Play className="h-3 w-3 mr-1" />
                          Use
                        </Button>
                        <Button size="sm" variant="outline">
                          View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-border">
                <CardContent className="p-6 text-center text-muted-foreground">
                  No actions in this category
                </CardContent>
              </Card>
            )}
          </div>
        ))}
      </div>

      {/* Quick Reference */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Quick Reference</CardTitle>
          <CardDescription>When to use each action type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
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
                <span className="font-medium">Send screenshot guide</span>
                <p className="text-muted-foreground">User needs visual walkthrough for a feature</p>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
