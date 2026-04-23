// CRM Integration Handover — three tabs (Our Setup, Their Setup, API Reference).
// Mirrors /mnt/documents/CRM_Integration_Handover_v1.md so the contract lives next to the API key card.
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Copy, ArrowRightLeft, Inbox, Send, ServerCog, Building2, FileCode2 } from 'lucide-react';
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
          Integration handover between the Terrisage Support Console (billing & seats) and the CRM app (user lifecycle).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Authentication & base URL</CardTitle>
          <CardDescription>Every request needs the per-account API key.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm">
            Header on every call: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">x-account-api-key: &lt;key&gt;</code>.
            Generate / revoke from the account's <strong>API keys</strong> card.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-2 py-1 text-xs break-all">{PROJECT_BASE}</code>
            <CopyBtn value={PROJECT_BASE} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="ours" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ours"><Building2 className="h-3.5 w-3.5 mr-1.5" /> Our setup</TabsTrigger>
          <TabsTrigger value="theirs"><ServerCog className="h-3.5 w-3.5 mr-1.5" /> CRM team setup</TabsTrigger>
          <TabsTrigger value="api"><FileCode2 className="h-3.5 w-3.5 mr-1.5" /> API reference</TabsTrigger>
        </TabsList>

        {/* ────────── OUR SETUP ────────── */}
        <TabsContent value="ours" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What the Console team owns</CardTitle>
              <CardDescription>Configure once per account, then hand credentials to the CRM developer.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal pl-5 text-sm space-y-2">
                <li>Create the account (Accounts → New Account). Sets <code>tenancy_type</code>, <code>country</code>, GST, owner contact.</li>
                <li>Confirm <strong>Billing settings</strong>: <code>seats_purchased</code>, <code>seat_rate</code>, <code>gst_pct</code>, <code>billing_cycle</code>, <code>current_period_start/end</code>, <code>auto_renew</code>.</li>
                <li>Generate API key from <strong>Account → API Keys</strong>. Stored as SHA-256 hash; the plaintext is shown <em>once</em>.</li>
                <li>Hand to CRM team via secure channel: <code>account_id</code> (UUID), the plaintext key, and the base URL above.</li>
                <li>Approve <strong>seat-increase requests</strong> from the Seats tab → emits a <code>REQUEST_FULFILLED</code> event with prorated invoice.</li>
                <li>Run <strong>renewals</strong> from the Billing tab → emits a <code>RENEWAL</code> event and releases <code>DELETED</code> seats.</li>
                <li>Initiate <strong>superuser transfers</strong> from the Seats tab → emits a <code>SUPERUSER_TRANSFER</code> event.</li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Handled automatically by the Console</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm space-y-1.5 text-muted-foreground">
                <li>Computing Reserved / Consumed / Available on every <code>/seat-usage</code> call.</li>
                <li>Bell notifications: <code>OVER_CAPACITY</code>, <code>CRM_SYNC_STALE</code>, <code>RENEWAL_DUE</code> (T-30/T-7/T-1).</li>
                <li>Writing every allocation delta to <code>seat_change_events</code> for CRM polling.</li>
                <li>Hourly cron scans for stale heartbeats and upcoming renewals.</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────────── CRM TEAM SETUP ────────── */}
        <TabsContent value="theirs" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What the CRM developer must build</CardTitle>
              <CardDescription>Nine concrete responsibilities — all driven by the five endpoints below.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal pl-5 text-sm space-y-2.5">
                <li><strong>Credential store.</strong> Persist <code>account_id</code> + API key per tenant. Treat the key like a password — never expose to the browser.</li>
                <li><strong>Boot read.</strong> Call <code>GET /seat-capacity</code> on app start and on tenant switch. Cache for the session.</li>
                <li><strong>Heartbeat.</strong> Call <code>POST /seat-usage</code> on every member state change <em>and</em> at least every 5 minutes with the <strong>full member roster</strong> (no diffs).</li>
                <li><strong>Invite TTL.</strong> Set <code>invitation_expires_at</code> (recommended 7 days). Run a sweeper that flips expired invites out of <code>INVITED</code> so they stop counting as Reserved.</li>
                <li><strong>Block invites.</strong> Hide / disable the "Invite user" CTA when the latest <code>/seat-capacity</code> returns <code>available = 0</code>.</li>
                <li><strong>Poll deltas.</strong> Call <code>GET /seat-events?since=&lt;last_ts&gt;</code> every 5 minutes. Persist <code>last_seen_event_ts</code> per tenant. React per <code>reason</code>: <code>REQUEST_FULFILLED</code>/<code>RENEWAL</code> → unlock invites, <code>CANCELLATION</code> → freeze invites, <code>SUPERUSER_TRANSFER</code> → update <code>is_superuser</code>.</li>
                <li><strong>Seat-increase request.</strong> Wire <code>POST /seat-request</code> to the "Request more seats" button.</li>
                <li><strong>Subscription metadata screen.</strong> Use <code>GET /account-profile</code> for plan, cycle, GST %, country, period dates, auto-renew, cancellation status.</li>
                <li><strong>Superuser transfer reflection.</strong> Console initiates; CRM only reads via <code>SUPERUSER_TRANSFER</code> events and the next <code>/seat-usage</code> round-trip.</li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reconciliation & error handling</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm space-y-1.5 text-muted-foreground">
                <li><strong>Idempotency.</strong> <code>/seat-usage</code> is a full-snapshot upsert. <code>/seat-request</code> dedupes by pending status.</li>
                <li><strong>Over-capacity.</strong> <code>consumed &gt; allocated</code> raises <code>OVER_CAPACITY</code>; <code>/seat-capacity</code> then forces <code>available = 0</code>.</li>
                <li><strong>Stale sync.</strong> No heartbeat for 24h ⇒ Console raises <code>CRM_SYNC_STALE</code>.</li>
                <li><strong>Retries.</strong> Exponential backoff on 5xx (1s/2s/4s/8s, max 60s, jitter). Don't retry 4xx except 429.</li>
                <li><strong>Soft rate targets.</strong> ≤ 12 <code>/seat-usage</code>/min, ≤ 12 <code>/seat-events</code>/min, ≤ 60 <code>/seat-capacity</code>/hour.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Out of scope</CardTitle>
              <CardDescription>So the CRM team doesn't expect these.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm space-y-1 text-muted-foreground">
                <li>Concurrent-seat (floating) licensing — seats are named.</li>
                <li>Open-work reassignment signal on user delete.</li>
                <li>Razorpay auto-collection for proration / renewal (invoices stay DRAFT, finalised manually).</li>
                <li>Direct database access — integration is exclusively through the five edge functions.</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────────── API REFERENCE ────────── */}
        <TabsContent value="api" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Inbox className="h-4 w-4" /> CRM → Console (writes)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="default">POST</Badge>
                  <code className="text-xs">/seat-usage</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Heartbeat. Send the <strong>full member roster</strong> on every change AND at least every 5 minutes.
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
                  <strong>state</strong> ∈ <code>INVITED</code>, <code>ACTIVE</code>, <code>TEMP_DEACTIVATED</code>,{' '}
                  <code>DELETION_REQUESTED</code>, <code>DELETED</code>.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="default">POST</Badge>
                  <code className="text-xs">/seat-request</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Commercial request to add seats. Idempotent on pending status.
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
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">GET</Badge>
                  <code className="text-xs">/seat-capacity</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Current entitlement and live counts. Used to gate "Invite user" and render the CRM dashboard.
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
                <p className="text-sm text-muted-foreground">Subscription metadata for the CRM admin screen.</p>
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
                  Allocation deltas (approved increases, renewals, cancellations, superuser transfers, manual adjustments).
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
                <p className="text-[11px] text-muted-foreground">
                  <strong>reason</strong> ∈ <code>REQUEST_FULFILLED</code>, <code>RENEWAL</code>, <code>MANUAL_ADJUSTMENT</code>,{' '}
                  <code>CANCELLATION</code>, <code>SUPERUSER_TRANSFER</code>.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> Reconciliation rules</CardTitle>
              <CardDescription>Console-side invariants on every <code>/seat-usage</code> call.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal pl-5 text-sm space-y-1.5 text-muted-foreground">
                <li><strong>Consumed</strong> = members in <code>ACTIVE</code>, <code>TEMP_DEACTIVATED</code>, <code>DELETION_REQUESTED</code> or <code>DELETED</code> within the current cycle.</li>
                <li><strong>Reserved</strong> = members in <code>INVITED</code> with a future <code>invitation_expires_at</code>. Expired invites don't count.</li>
                <li><strong>Available</strong> = Allocated − Reserved − Consumed. Negative ⇒ Console raises Over-capacity and forces <code>available = 0</code>.</li>
                <li>Console releases <code>DELETED</code> seats only at cycle rollover via <code>renew_subscription</code>.</li>
                <li>No snapshot for &gt; 24h on a LIVE account ⇒ Console raises a "CRM sync stale" notification.</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
