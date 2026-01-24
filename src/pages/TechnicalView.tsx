import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Database, Zap, BarChart3, Shield, Globe } from 'lucide-react';
import { toast } from 'sonner';

export default function TechnicalView() {
  const [defaults, setDefaults] = useState({
    rentalsDefaultIntent: true,
    englishDefault: true,
    hindiEnabled: true,
    teluguEnabled: false,
    autoDedupeLeads: true,
    autoDedupeContacts: true,
    importAuditEnabled: true,
    eventTrackingEnabled: true,
  });

  const handleToggle = (key: keyof typeof defaults) => {
    setDefaults(prev => ({ ...prev, [key]: !prev[key] }));
    toast.success('Setting updated');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Technical View</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform configuration, enablers, and tracking
        </p>
      </div>

      <Tabs defaultValue="defaults">
        <TabsList>
          <TabsTrigger value="defaults">Tenant Defaults</TabsTrigger>
          <TabsTrigger value="enablers">Platform Enablers</TabsTrigger>
          <TabsTrigger value="tracking">Event Tracking</TabsTrigger>
          <TabsTrigger value="pilot">Pilot Metrics</TabsTrigger>
        </TabsList>

        {/* Defaults Tab */}
        <TabsContent value="defaults" className="space-y-6 mt-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Tenant-Level Defaults
              </CardTitle>
              <CardDescription>
                Configure default behaviours for new accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <div className="font-medium">Rentals Default Intent</div>
                  <div className="text-sm text-muted-foreground">
                    If tenant is rentals-focused, default the "Add Lead" intent to Rent
                  </div>
                </div>
                <Switch 
                  checked={defaults.rentalsDefaultIntent} 
                  onCheckedChange={() => handleToggle('rentalsDefaultIntent')} 
                />
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="font-medium mb-3">Lead Source Enum</div>
                <div className="flex flex-wrap gap-2">
                  {['Call', 'Website', 'Referral', 'Manual', 'Meta Ads', 'Google Ads', 'MagicBricks', '99acres', 'Walk-in'].map(source => (
                    <Badge key={source} variant="outline">{source}</Badge>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="font-medium mb-3">Language Settings</div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">English (Default)</span>
                    <Switch checked={defaults.englishDefault} disabled />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Hindi</span>
                    <Switch 
                      checked={defaults.hindiEnabled} 
                      onCheckedChange={() => handleToggle('hindiEnabled')} 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Telugu</span>
                    <Switch 
                      checked={defaults.teluguEnabled} 
                      onCheckedChange={() => handleToggle('teluguEnabled')} 
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Enablers Tab */}
        <TabsContent value="enablers" className="space-y-6 mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Data Services
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium text-sm">Bulk Import API</div>
                    <div className="text-xs text-muted-foreground">CSV and Excel processing</div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium text-sm">Lead Dedupe Service</div>
                    <div className="text-xs text-muted-foreground">Phone and email matching</div>
                  </div>
                  <Switch 
                    checked={defaults.autoDedupeLeads} 
                    onCheckedChange={() => handleToggle('autoDedupeLeads')} 
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium text-sm">Contact Dedupe Service</div>
                    <div className="text-xs text-muted-foreground">Cross-account matching</div>
                  </div>
                  <Switch 
                    checked={defaults.autoDedupeContacts} 
                    onCheckedChange={() => handleToggle('autoDedupeContacts')} 
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium text-sm">Import Audit Logs</div>
                    <div className="text-xs text-muted-foreground">Full import history</div>
                  </div>
                  <Switch 
                    checked={defaults.importAuditEnabled} 
                    onCheckedChange={() => handleToggle('importAuditEnabled')} 
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Access Control
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 border rounded-lg">
                  <div className="font-medium text-sm mb-2">Role Hierarchy</div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span className="text-sm">Agency Admin</span>
                      <span className="text-xs text-muted-foreground ml-auto">Full access</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary/70" />
                      <span className="text-sm">Agent</span>
                      <span className="text-xs text-muted-foreground ml-auto">Team visibility</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary/40" />
                      <span className="text-sm">Assistant</span>
                      <span className="text-xs text-muted-foreground ml-auto">Own leads only</span>
                    </div>
                  </div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="font-medium text-sm mb-2">Visibility Rules</div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Admins see all leads and listings</li>
                    <li>• Agents see team leads by default</li>
                    <li>• Assistants see only assigned leads</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tracking Tab */}
        <TabsContent value="tracking" className="space-y-6 mt-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Adoption Events
              </CardTitle>
              <CardDescription>
                Key events tracked for activation and adoption metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">first_login</span>
                    <Badge className="bg-emerald-100 text-emerald-700">Tracked</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    User logs in for the first time after account creation
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">first_lead_created</span>
                    <Badge className="bg-emerald-100 text-emerald-700">Tracked</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    User creates their first lead manually or via import
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">import_completed</span>
                    <Badge className="bg-emerald-100 text-emerald-700">Tracked</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Import job completes successfully (includes row count)
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">activation_outcome_set</span>
                    <Badge className="bg-emerald-100 text-emerald-700">Tracked</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    48-hour activation check completed (Pass or At Risk)
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">follow_up_set</span>
                    <Badge className="bg-emerald-100 text-emerald-700">Tracked</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    User sets a follow-up date on a lead
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">portal_integration_active</span>
                    <Badge className="bg-emerald-100 text-emerald-700">Tracked</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Portal integration receives first enquiry
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pilot Metrics Tab */}
        <TabsContent value="pilot" className="space-y-6 mt-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg">Adoption Heatmap</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Lead Created</span>
                      <span className="font-medium">87%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: '87%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Follow-up Set</span>
                      <span className="font-medium">72%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: '72%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Import Completed</span>
                      <span className="font-medium">65%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: '65%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Portal Connected</span>
                      <span className="font-medium">34%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: '34%' }} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg">Activation Pass Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-4">
                  <div className="text-4xl font-bold text-primary">78%</div>
                  <div className="text-sm text-muted-foreground mb-1">48-hour check</div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-emerald-50 rounded-lg">
                    <div className="font-medium text-emerald-700">Pass</div>
                    <div className="text-2xl font-bold text-emerald-700">39</div>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <div className="font-medium text-amber-700">At Risk</div>
                    <div className="text-2xl font-bold text-amber-700">11</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg">7-Day Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-4">
                  <div className="text-4xl font-bold text-primary">85%</div>
                  <div className="text-sm text-muted-foreground mb-1">of activated</div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-emerald-50 rounded-lg">
                    <div className="font-medium text-emerald-700">Success</div>
                    <div className="text-2xl font-bold text-emerald-700">33</div>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <div className="font-medium text-red-700">Churned</div>
                    <div className="text-2xl font-bold text-red-700">6</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
