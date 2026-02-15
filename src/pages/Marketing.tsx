import { useState } from 'react';
import { useUser } from '@/context/UserContext';
import { Navigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LayoutDashboard, Crosshair, Share2, MapPin, DollarSign, Link2, Activity, Globe, Plug,
} from 'lucide-react';
import MktOverviewTab from '@/components/marketing/MktOverviewTab';
import MktCampaignsTab from '@/components/marketing/MktCampaignsTab';
import MktSocialTab from '@/components/marketing/MktSocialTab';
import MktOfflineTab from '@/components/marketing/MktOfflineTab';
import MktCostsTab from '@/components/marketing/MktCostsTab';
import MktUTMStudioTab from '@/components/marketing/MktUTMStudioTab';
import MktWebTrackingTab from '@/components/marketing/MktWebTrackingTab';
import MktSyncTab from '@/components/marketing/MktSyncTab';
import MktActivityLogTab from '@/components/marketing/MktActivityLogTab';

export default function Marketing() {
  const { isAdmin } = useUser();
  const [activeTab, setActiveTab] = useState('overview');

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Marketing Command Centre</h1>
          <p className="text-sm text-muted-foreground">Campaigns, spend, content & performance — all in one view</p>
        </div>
        <Badge variant="outline" className="text-xs font-medium">Admin Only</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap bg-muted/50 p-1 h-auto gap-0.5">
          <TabsTrigger value="overview" className="text-xs gap-1.5 data-[state=active]:bg-background">
            <LayoutDashboard className="h-3.5 w-3.5" />Overview
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="text-xs gap-1.5 data-[state=active]:bg-background">
            <Crosshair className="h-3.5 w-3.5" />Campaigns
          </TabsTrigger>
          <TabsTrigger value="utm" className="text-xs gap-1.5 data-[state=active]:bg-background">
            <Link2 className="h-3.5 w-3.5" />UTM Studio
          </TabsTrigger>
          <TabsTrigger value="tracking" className="text-xs gap-1.5 data-[state=active]:bg-background">
            <Globe className="h-3.5 w-3.5" />Web Tracking
          </TabsTrigger>
          <TabsTrigger value="social" className="text-xs gap-1.5 data-[state=active]:bg-background">
            <Share2 className="h-3.5 w-3.5" />Social & Content
          </TabsTrigger>
          <TabsTrigger value="offline" className="text-xs gap-1.5 data-[state=active]:bg-background">
            <MapPin className="h-3.5 w-3.5" />Offline Activities
          </TabsTrigger>
          <TabsTrigger value="costs" className="text-xs gap-1.5 data-[state=active]:bg-background">
            <DollarSign className="h-3.5 w-3.5" />Costs & ROI
          </TabsTrigger>
          <TabsTrigger value="sync" className="text-xs gap-1.5 data-[state=active]:bg-background">
            <Plug className="h-3.5 w-3.5" />Sync & Integrations
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs gap-1.5 data-[state=active]:bg-background">
            <Activity className="h-3.5 w-3.5" />Activity Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><MktOverviewTab /></TabsContent>
        <TabsContent value="campaigns"><MktCampaignsTab /></TabsContent>
        <TabsContent value="utm"><MktUTMStudioTab /></TabsContent>
        <TabsContent value="tracking"><MktWebTrackingTab /></TabsContent>
        <TabsContent value="social"><MktSocialTab /></TabsContent>
        <TabsContent value="offline"><MktOfflineTab /></TabsContent>
        <TabsContent value="costs"><MktCostsTab /></TabsContent>
        <TabsContent value="sync"><MktSyncTab /></TabsContent>
        <TabsContent value="activity"><MktActivityLogTab /></TabsContent>
      </Tabs>
    </div>
  );
}
