import { useParams } from 'react-router-dom';
import { seedAccounts, seedNotes, getCalendarEventsForEntity, getNextUpcomingEvent } from '@/data/seedData';
import { EntityType, VerificationStatus, AccountStatus } from '@/types/core';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

const statusColors: Record<AccountStatus, string> = {
  [AccountStatus.LIVE]: 'bg-success/15 text-success',
  [AccountStatus.ONBOARDING_IN_PROGRESS]: 'bg-primary/15 text-primary',
  [AccountStatus.STALLED_ONBOARDING]: 'bg-destructive/15 text-destructive',
  [AccountStatus.DEACTIVATED]: 'bg-muted text-muted-foreground',
};

const verificationColors: Record<VerificationStatus, string> = {
  [VerificationStatus.NOT_STARTED]: 'bg-muted text-muted-foreground',
  [VerificationStatus.PENDING]: 'bg-warning/15 text-warning',
  [VerificationStatus.VERIFIED]: 'bg-success/15 text-success',
  [VerificationStatus.FAILED]: 'bg-destructive/15 text-destructive',
};

export default function AccountDetail() {
  const { accountId } = useParams();
  const account = seedAccounts.find(a => a.account_id === accountId);

  if (!account) {
    return <div className="p-6 text-center text-muted-foreground">Account not found</div>;
  }

  const notes = seedNotes.filter(n => account.notes_thread.includes(n.note_id));
  const events = getCalendarEventsForEntity(EntityType.ACCOUNT, account.account_id);
  const nextEvent = getNextUpcomingEvent(EntityType.ACCOUNT, account.account_id);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{account.account_name}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span>{account.city}</span><span>•</span>
            <span>{account.tenancy_type === 'AGENCY_BROKERAGE_CONSULTANCY' ? 'Agency' : 'Builder'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={statusColors[account.status]}>{account.status.replace(/_/g, ' ')}</Badge>
          <Badge className={verificationColors[account.verification_pan_status]}>PAN: {account.verification_pan_status}</Badge>
          <Badge className={verificationColors[account.verification_identity_status]}>ID: {account.verification_identity_status}</Badge>
        </div>
      </div>

      {nextEvent && (
        <Card className="border-primary/30">
          <CardContent className="p-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium">Next Action:</span>
            <span className="text-sm">{nextEvent.title}</span>
            <span className="text-xs text-muted-foreground">{format(new Date(nextEvent.scheduled_at), 'dd MMM yyyy, HH:mm')}</span>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="ingestion">Data Ingestion</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Account Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Owner: </span>{account.owner_name}</div>
              <div><span className="text-muted-foreground">Phone: </span>{account.owner_phone}</div>
              <div><span className="text-muted-foreground">Email: </span>{account.owner_email}</div>
              <div><span className="text-muted-foreground">Created: </span>{format(new Date(account.created_at), 'dd MMM yyyy')}</div>
              {account.created_from_enquiry_id && <div><span className="text-muted-foreground">From Enquiry: </span>{account.created_from_enquiry_id}</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onboarding" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Onboarding Checklist</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {account.onboarding_checklist.map(item => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 ${item.completed ? 'bg-primary border-primary' : 'border-muted-foreground'}`} />
                    <span className={item.completed ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                    {item.completed_at && <span className="text-xs text-muted-foreground ml-auto">{format(new Date(item.completed_at), 'dd MMM')}</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verification" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle className="text-base">PAN Verification</CardTitle></CardHeader><CardContent><Badge className={verificationColors[account.verification_pan_status]}>{account.verification_pan_status}</Badge></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Identity Verification</CardTitle></CardHeader><CardContent><Badge className={verificationColors[account.verification_identity_status]}>{account.verification_identity_status}</Badge></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="ingestion" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">Data Ingestion</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Import history and wizard will appear here.</p></CardContent></Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">Integrations</CardTitle></CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">Meta: </span>{account.integrations.meta?.connected ? '✓ Connected' : '✗ Not connected'}</div>
                <div><span className="text-muted-foreground">Google: </span>{account.integrations.google?.connected ? '✓ Connected' : '✗ Not connected'}</div>
                <div><span className="text-muted-foreground">Website: </span>{account.integrations.website?.connected ? '✓ Connected' : '✗ Not connected'}</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-3">
          {notes.length > 0 ? notes.map(n => (
            <Card key={n.note_id}><CardContent className="p-3"><p className="text-sm">{n.note_text}</p><p className="text-xs text-muted-foreground mt-1">{format(new Date(n.created_at), 'dd MMM yyyy, HH:mm')}</p></CardContent></Card>
          )) : <p className="text-sm text-muted-foreground">No notes yet.</p>}
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Document management will appear here.</p></CardContent></Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4 space-y-3">
          {events.length > 0 ? events.map(e => (
            <Card key={e.event_id}><CardContent className="p-3 flex items-center justify-between"><div><p className="font-medium text-sm">{e.title}</p><p className="text-xs text-muted-foreground">{format(new Date(e.scheduled_at), 'dd MMM yyyy, HH:mm')}</p></div><Badge variant="outline">{e.status}</Badge></CardContent></Card>
          )) : <p className="text-sm text-muted-foreground">No calendar events.</p>}
        </TabsContent>

        <TabsContent value="tickets" className="mt-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Linked tickets will appear here.</p></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
