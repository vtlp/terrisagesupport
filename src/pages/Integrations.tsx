import { useState } from 'react';
import { Plug, CheckCircle2, AlertTriangle, Clock, ExternalLink, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { integrationConfigs, integrationPrerequisites, onboardingAccounts } from '@/data/onboardingData';
import { format } from 'date-fns';

export default function Integrations() {
  const [prerequisites, setPrerequisites] = useState(integrationPrerequisites);

  const togglePrereq = (id: string) => {
    setPrerequisites(prev => prev.map(p => 
      p.id === id ? { ...p, completed: !p.completed } : p
    ));
  };

  const getAccount = (accountId: string) => onboardingAccounts.find(a => a.id === accountId);

  const statusColors: Record<string, string> = {
    not_configured: 'bg-muted text-muted-foreground',
    pending: 'bg-amber-100 text-amber-800',
    active: 'bg-accent/20 text-accent-foreground',
    error: 'bg-destructive/10 text-destructive',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    not_configured: <Clock className="h-4 w-4" />,
    pending: <Clock className="h-4 w-4" />,
    active: <CheckCircle2 className="h-4 w-4" />,
    error: <AlertTriangle className="h-4 w-4" />,
  };

  const portalIntegrations = [
    { id: 'magicbricks', name: 'MagicBricks', description: 'Inbound leads from MagicBricks portal' },
    { id: '99acres', name: '99acres', description: 'Inbound leads from 99acres portal' },
    { id: 'housing', name: 'Housing.com', description: 'Inbound leads from Housing.com (coming soon)', disabled: true },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Portal integrations and inbound lead configuration
        </p>
      </div>

      {/* Prerequisites Card */}
      <Card className="border-border border-primary/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            CRM Admin Prerequisites
          </CardTitle>
          <CardDescription>
            Confirm these before configuring portal integrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {prerequisites.map((prereq) => (
              <div 
                key={prereq.id} 
                className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 cursor-pointer"
                onClick={() => togglePrereq(prereq.id)}
              >
                <Checkbox 
                  checked={prereq.completed} 
                  onCheckedChange={() => togglePrereq(prereq.id)}
                />
                <span className={`text-sm ${prereq.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {prereq.label}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              {prerequisites.filter(p => p.completed).length} of {prerequisites.length} prerequisites confirmed
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Available Integrations */}
      <div>
        <h2 className="text-lg font-medium mb-4">Portal Integrations</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {portalIntegrations.map((portal) => (
            <Card key={portal.id} className={`border-border ${portal.disabled ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{portal.name}</CardTitle>
                  {portal.disabled && (
                    <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                      Coming Soon
                    </Badge>
                  )}
                </div>
                <CardDescription>{portal.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {!portal.disabled ? (
                  <Button variant="outline" className="w-full">
                    <Plug className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    Not Available
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Active Integrations */}
      <div>
        <h2 className="text-lg font-medium mb-4">Configured Integrations</h2>
        {integrationConfigs.length > 0 ? (
          <div className="space-y-3">
            {integrationConfigs.map((integration) => {
              const account = getAccount(integration.accountId);
              return (
                <Card key={integration.id} className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${statusColors[integration.status]}`}>
                          {statusIcons[integration.status]}
                        </div>
                        <div>
                          <p className="font-medium">{account?.name || 'Unknown Account'}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {integration.type}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className={statusColors[integration.status]}>
                          {integration.status.replace('_', ' ')}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {integration.lastSyncAt && (
                      <p className="text-xs text-muted-foreground mt-3 pl-12">
                        Last sync: {format(integration.lastSyncAt, 'd MMM yyyy, HH:mm')}
                      </p>
                    )}
                    {integration.errorMessage && (
                      <div className="mt-3 p-2 bg-destructive/10 rounded text-sm text-destructive pl-12">
                        {integration.errorMessage}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-border">
            <CardContent className="p-8 text-center">
              <Plug className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No integrations configured yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
