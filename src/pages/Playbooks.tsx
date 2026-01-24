import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Building2, Briefcase, AlertTriangle, CheckCircle2, Target, Globe } from 'lucide-react';

export default function Playbooks() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Playbooks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Segment strategies, rollout plans, and risk mitigations
        </p>
      </div>

      <Tabs defaultValue="segments">
        <TabsList>
          <TabsTrigger value="segments">Segments</TabsTrigger>
          <TabsTrigger value="rollout">Rollout Plan</TabsTrigger>
          <TabsTrigger value="risks">Risks and Mitigations</TabsTrigger>
          <TabsTrigger value="india">India Considerations</TabsTrigger>
        </TabsList>

        {/* Segments Tab */}
        <TabsContent value="segments" className="space-y-6 mt-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Solo Agent */}
            <Card className="border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Solo Agent</CardTitle>
                    <Badge variant="outline" className="mt-1">Low Touch</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Core Needs</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Lead capture from portals and referrals</li>
                    <li>• Simple follow-up reminders</li>
                    <li>• WhatsApp-friendly workflow</li>
                    <li>• Mobile-first experience</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Onboarding Intensity</h4>
                  <p className="text-sm text-muted-foreground">
                    30-minute demo, self-serve import, light touch support. Focus on habit formation.
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Success Metrics</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• First lead added within 48 hours</li>
                    <li>• Follow-up set for each lead</li>
                    <li>• Weekly login streak</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Agency */}
            <Card className="border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Briefcase className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Agency</CardTitle>
                    <Badge variant="outline" className="mt-1">Medium Touch</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Core Needs</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Team lead distribution</li>
                    <li>• Portal integration (MagicBricks, 99acres)</li>
                    <li>• Visibility controls for agents</li>
                    <li>• Listing management</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Onboarding Intensity</h4>
                  <p className="text-sm text-muted-foreground">
                    45-minute demo, assisted import, role setup session. Requires portal access prerequisites.
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Success Metrics</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• All team members onboarded</li>
                    <li>• Portal integration active</li>
                    <li>• Lead assignment rules configured</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Builder */}
            <Card className="border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Builder / Venture</CardTitle>
                    <Badge variant="outline" className="mt-1">High Touch</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Core Needs</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Project and unit inventory</li>
                    <li>• Multi-channel lead capture</li>
                    <li>• Channel partner management</li>
                    <li>• Sales pipeline tracking</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Onboarding Intensity</h4>
                  <p className="text-sm text-muted-foreground">
                    60-90 minute demo, white-glove inventory import, dedicated onboarding owner.
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Success Metrics</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Project created with full inventory</li>
                    <li>• Sales team pipeline configured</li>
                    <li>• First booking recorded</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Rollout Tab */}
        <TabsContent value="rollout" className="space-y-6 mt-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">1</span>
                  Pilot Phase
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-2xl font-bold">50 users</div>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                    High-touch handholding for every account
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                    Weekly check-ins with each user
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                    Rapid feedback loop to product
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                    Manual import assistance
                  </li>
                </ul>
                <div className="pt-2 border-t">
                  <div className="text-sm font-medium">Duration</div>
                  <div className="text-sm text-muted-foreground">4-6 weeks</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-secondary-foreground text-secondary text-sm flex items-center justify-center">2</span>
                  Self-Serve Onboarding
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-2xl font-bold">Scale to 500+</div>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                    Guided wizard for account setup
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                    Knowledge base and video tutorials
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                    Import templates by segment
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                    Automated 48h and 7-day checks
                  </li>
                </ul>
                <div className="pt-2 border-t">
                  <div className="text-sm font-medium">Support Model</div>
                  <div className="text-sm text-muted-foreground">Chat and email, 12h SLA</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-accent text-accent-foreground text-sm flex items-center justify-center">3</span>
                  Hybrid Support
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-2xl font-bold">Premium Tier</div>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                    Concierge onboarding for enterprise
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                    Paid white-glove data migration
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                    Dedicated account manager
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                    Custom training sessions
                  </li>
                </ul>
                <div className="pt-2 border-t">
                  <div className="text-sm font-medium">Pricing</div>
                  <div className="text-sm text-muted-foreground">Migration fee + premium plan</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Risks Tab */}
        <TabsContent value="risks" className="mt-6">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Data Quality Risk</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Messy data, duplicates, incomplete records
                    </p>
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm font-medium text-primary">Mitigation</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Validation rules on import, dedupe preview, Fix-It queue for corrections, mandatory field enforcement
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Adoption Risk</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Users reverting to WhatsApp and Excel habits
                    </p>
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm font-medium text-primary">Mitigation</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        48-hour activation checks, habit reinforcement nudges, simple daily task focus, mobile-first design
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Technical Risk</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Slow imports, portal sync failures, scaling issues
                    </p>
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm font-medium text-primary">Mitigation</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Background processing, retry mechanisms, import progress tracking, error notifications
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Support Risk</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Too much handholding demand, support overload
                    </p>
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm font-medium text-primary">Mitigation</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Self-serve knowledge base, import templates, guided wizards, tiered support by segment
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border md:col-span-2">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Regulatory Risk (India)</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      RERA compliance, privacy requirements, GST invoicing
                    </p>
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                      <div className="text-sm font-medium text-primary">Mitigation</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        RERA verification workflow, store only verification status (never Aadhaar details), GST invoice templates, audit logging
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* India Tab */}
        <TabsContent value="india" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Localisation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Language guides</span>
                  <Badge>English, Hindi, Telugu</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Low bandwidth design</span>
                  <Badge variant="outline">Optimised</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Mobile priority</span>
                  <Badge variant="outline">Android-first</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Payment method</span>
                  <Badge>UPI supported</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Trust Signals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm font-medium">RERA Verification</div>
                  <p className="text-xs text-muted-foreground mt-1">Display verified badge prominently</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm font-medium">Data Security</div>
                  <p className="text-xs text-muted-foreground mt-1">Clear privacy messaging, no Aadhaar storage</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm font-medium">Local Support</div>
                  <p className="text-xs text-muted-foreground mt-1">Support in regional languages, IST hours</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm font-medium">Testimonials</div>
                  <p className="text-xs text-muted-foreground mt-1">Feature local agency success stories</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
