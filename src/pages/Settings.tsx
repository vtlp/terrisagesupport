import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export default function Settings() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Internal configuration for the Support Interface
        </p>
      </div>

      {/* Notifications */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>Configure when you receive alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify-48h">48-hour activation due</Label>
              <p className="text-sm text-muted-foreground">Alert when activation checks are due</p>
            </div>
            <Switch id="notify-48h" defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify-overdue">Overdue reviews</Label>
              <p className="text-sm text-muted-foreground">Alert for overdue activation reviews</p>
            </div>
            <Switch id="notify-overdue" defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify-import">Import failures</Label>
              <p className="text-sm text-muted-foreground">Alert when imports fail</p>
            </div>
            <Switch id="notify-import" defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify-blocker">Blockers identified</Label>
              <p className="text-sm text-muted-foreground">Alert when accounts are flagged as blocked</p>
            </div>
            <Switch id="notify-blocker" />
          </div>
        </CardContent>
      </Card>

      {/* Display */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Display</CardTitle>
          <CardDescription>Customise the interface appearance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="compact-tables">Compact tables</Label>
              <p className="text-sm text-muted-foreground">Reduce row height in tables</p>
            </div>
            <Switch id="compact-tables" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="show-ids">Show account IDs</Label>
              <p className="text-sm text-muted-foreground">Display IDs in account lists</p>
            </div>
            <Switch id="show-ids" />
          </div>
        </CardContent>
      </Card>

      {/* Defaults */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Defaults</CardTitle>
          <CardDescription>Set default values for new items</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Default onboarding owner</Label>
              <p className="text-sm text-muted-foreground">Auto-assign new accounts to you</p>
            </div>
            <Switch />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-schedule 7-day review</Label>
              <p className="text-sm text-muted-foreground">Automatically schedule reviews on activation pass</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Data */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Data Management</CardTitle>
          <CardDescription>Export and manage your data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Export all data</Label>
              <p className="text-sm text-muted-foreground">Download a CSV of all onboarding data</p>
            </div>
            <Button variant="outline" size="sm">Export</Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Activity log retention</Label>
              <p className="text-sm text-muted-foreground">Activity logs are retained for 90 days</p>
            </div>
            <span className="text-sm text-muted-foreground">90 days</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
