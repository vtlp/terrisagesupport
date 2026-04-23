// Reference page: documents the API contract between the CRM app and the
// Support Console for seat / billing / sync. Read-only; no API calls.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Copy, ArrowRightLeft, Inbox, Send } from 'lucide-react';
import { toast } from 'sonner';

const PROJECT_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co`;

const Code = ({ children }: { children: React.ReactNode }) => (
  <pre className="rounded bg-muted/50 border p-3 text-[11px] leading-relaxed overflow-x-auto whitespace-pre">
    <code>{children}</code>
  </pre>
);

function CopyBtn({ value }: { value: string }) {
  return (
    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(value); toast.success('Copied'); }}>
      <Copy className="h-3 w-3 mr-1" /> Copy
    </Button>
  );
}

export default function AdminCrmSyncContract() {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">CRM Sync Contract</h1>
        <p className="text-sm text-muted-foreground">
          API contract the CRM app uses to keep seat allocation, billing, and member states in sync with Terrisage Support.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Authentication</CardTitle>
          <CardDescription>Every request must include the account's API key.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm">
            Send the header <code className="rounded bg-muted px-1.5 py-0.5 text-xs">x-account-api-key: &lt;key&gt;</code> on every call.
            Keys are managed per-account from the account's <strong>API keys</strong> card.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-2 py-1 text-xs break-all">{PROJECT_BASE}</code>
            <CopyBtn value={PROJECT_BASE} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Inbox className="h-4 w-4" /> CRM → Console (writes)</CardTitle>
          <CardDescription>Calls made by the CRM app to keep the Console in sync.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default">POST</Badge>
              <code className="text-xs">/seat-usage</code>
            </div>
            <p className="text-sm text-muted-foreground">
              Heartbeat. Send the <strong>full member roster</strong> on every change AND at least every 5 minutes.
              Console computes Reserved, Consumed and Available from this payload.
            </p>
            <Code>{`POST ${PROJECT_BASE}/seat-usage
x-account-api-key: <key>
Content-Type: application/json

{
  "as_of": "2026-04-23T10:00:00Z",
  "members": [
    {
      "external_id": "user-101",
      "full_name": "Asha N.",
      "email": "asha@example.com",
      "phone": "+919876543210",
      "role": "Superuser",
      "permissions": ["leads.write","listings.write"],
      "state": "ACTIVE",
      "is_superuser": true,
      "invited_at": null,
      "invitation_expires_at": null,
      "activated_at": "2026-01-04T08:12:00Z",
      "deactivated_at": null,
      "deleted_at": null,
      "last_active_at": "2026-04-23T09:55:00Z"
    }
  ]
}`}</Code>
            <p className="text-[11px] text-muted-foreground">
              <strong>state</strong> is one of: <code>INVITED</code>, <code>ACTIVE</code>,{' '}
              <code>TEMP_DEACTIVATED</code>, <code>DELETION_REQUESTED</code>, <code>DELETED</code>.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default">POST</Badge>
              <code className="text-xs">/seat-request</code>
            </div>
            <p className="text-sm text-muted-foreground">
              Commercial request to add seats. Creates a <code>PENDING</code> seat request that staff approves manually.
            </p>
            <Code>{`POST ${PROJECT_BASE}/seat-request
x-account-api-key: <key>
Content-Type: application/json

{
  "requested_seats": 5,
  "requested_by_email": "owner@example.com",
  "reason": "Two new agents joining next week"
}`}</Code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" /> CRM → Console (reads)</CardTitle>
          <CardDescription>Read-only endpoints the CRM app polls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">GET</Badge>
              <code className="text-xs">/seat-capacity</code>
            </div>
            <p className="text-sm text-muted-foreground">
              Current entitlement and live counts. CRM uses this to gate "Invite user" and to render its own dashboard.
            </p>
            <Code>{`GET ${PROJECT_BASE}/seat-capacity
x-account-api-key: <key>

→ {
  "account_id": "...",
  "account_name": "...",
  "owner_name": "...",
  "country": "IN",
  "plan_name": "Standard",
  "billing_cycle": "ANNUAL",
  "auto_renew": true,
  "subscription_status": "ACTIVE",
  "current_period_start": "2026-01-01T00:00:00Z",
  "current_period_end": "2027-01-01T00:00:00Z",
  "next_renewal_at": "2027-01-01T00:00:00Z",
  "allocated": 30,
  "reserved": 2,
  "consumed": 25,
  "available": 3,
  "requested_pending": 0,
  "as_of": "2026-04-23T10:00:00Z"
}`}</Code>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">GET</Badge>
              <code className="text-xs">/account-profile</code>
            </div>
            <p className="text-sm text-muted-foreground">
              Subscription metadata for the CRM admin screen.
            </p>
            <Code>{`GET ${PROJECT_BASE}/account-profile
x-account-api-key: <key>

→ {
  "account": { "id": "...", "account_name": "...", "owner_name": "...", "tenancy_type": "..." },
  "subscription": {
    "plan_name": "Standard",
    "billing_cycle": "ANNUAL",
    "gst_pct": 18,
    "country": "IN",
    "status": "ACTIVE",
    "subscription_started_at": "2026-01-01T00:00:00Z",
    "current_period_start": "2026-01-01T00:00:00Z",
    "current_period_end": "2027-01-01T00:00:00Z",
    "next_renewal_at": "2027-01-01T00:00:00Z",
    "auto_renew": true,
    "cancellation_requested_at": null,
    "cancellation_effective_at": null
  }
}`}</Code>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">GET</Badge>
              <code className="text-xs">/seat-events?since=&lt;ISO timestamp&gt;</code>
            </div>
            <p className="text-sm text-muted-foreground">
              Allocation deltas (approved increases, renewals, manual adjustments) so the CRM can unlock invite slots
              without polling <code>/seat-capacity</code> aggressively.
            </p>
            <Code>{`GET ${PROJECT_BASE}/seat-events?since=2026-04-22T00:00:00Z
x-account-api-key: <key>

→ {
  "since": "2026-04-22T00:00:00Z",
  "server_time": "2026-04-23T10:00:00Z",
  "events": [
    {
      "id": "...",
      "delta": 5,
      "new_total": 35,
      "reason": "REQUEST_FULFILLED",
      "effective_at": "2026-04-22T11:30:00Z",
      "prorated_amount": 12500.00,
      "invoice_id": "...",
      "notes": null
    }
  ]
}`}</Code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> Reconciliation rules</CardTitle>
          <CardDescription>Console-side invariants enforced on every <code>/seat-usage</code> call.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal pl-5 text-sm space-y-1.5 text-muted-foreground">
            <li><strong>Consumed</strong> = members in state <code>ACTIVE</code>, <code>TEMP_DEACTIVATED</code>, <code>DELETION_REQUESTED</code> or <code>DELETED</code> within the current cycle.</li>
            <li><strong>Reserved</strong> = members in state <code>INVITED</code> with a future <code>invitation_expires_at</code>. Expired invites are not counted.</li>
            <li><strong>Available</strong> = Allocated − Reserved − Consumed. If this would go negative, Console raises an Over-capacity notification and the next <code>/seat-capacity</code> response forces <code>available = 0</code> to block further invites.</li>
            <li>Console releases seats marked <code>DELETED</code> only at cycle rollover via <code>renew_subscription</code>.</li>
            <li>If no snapshot is received for more than 24 hours on a LIVE account, Console raises a "CRM sync stale" notification.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
