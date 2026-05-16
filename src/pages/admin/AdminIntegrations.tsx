import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, AlertCircle, ExternalLink, Copy } from 'lucide-react';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export default function AdminIntegrations() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [calendarId, setCalendarId] = useState('primary');
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [hasRefreshToken, setHasRefreshToken] = useState(false);

  const redirectUri = `${window.location.origin}/admin/integrations`;

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('provider', 'google_calendar')
      .maybeSingle();
    if (error) toast.error('Failed to load settings');
    if (data) {
      setClientId(data.google_client_id ?? '');
      setClientSecret(data.google_client_secret ?? '');
      setCalendarId(data.google_calendar_id ?? 'primary');
      setConnectedEmail(data.google_account_email);
      setConnectedAt(data.connected_at);
      setHasRefreshToken(!!data.google_refresh_token);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Handle OAuth redirect back
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const err = params.get('error');
    if (err) {
      toast.error(`Google denied access: ${err}`);
      window.history.replaceState({}, '', '/admin/integrations');
      return;
    }
    if (!code) return;
    (async () => {
      setExchanging(true);
      const { data, error } = await supabase.functions.invoke('google-oauth-callback', {
        body: { code, redirect_uri: redirectUri },
      });
      setExchanging(false);
      window.history.replaceState({}, '', '/admin/integrations');
      if (error || (data as { error?: string })?.error) {
        toast.error((data as { error?: string })?.error ?? error?.message ?? 'OAuth exchange failed');
      } else {
        toast.success(`Connected to ${(data as { email?: string })?.email ?? 'Google'}`);
        load();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('integration_settings').update({
      google_client_id: clientId.trim() || null,
      google_client_secret: clientSecret.trim() || null,
      google_calendar_id: calendarId.trim() || 'primary',
    }).eq('provider', 'google_calendar');
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success('Saved');
  };

  const connect = async () => {
    if (!clientId.trim()) {
      toast.error('Save your Client ID first');
      return;
    }
    // Ensure latest values are saved before redirect
    await save();
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId.trim());
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', GOOGLE_SCOPES);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    window.location.href = url.toString();
  };

  const disconnect = async () => {
    const { error } = await supabase.from('integration_settings').update({
      google_refresh_token: null,
      google_account_email: null,
      connected_at: null,
    }).eq('provider', 'google_calendar');
    if (error) toast.error(error.message);
    else { toast.success('Disconnected'); load(); }
  };

  const copyRedirect = () => {
    navigator.clipboard.writeText(redirectUri);
    toast.success('Redirect URI copied');
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Configure third-party connections used across Terrisage.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Google Calendar</CardTitle>
              <CardDescription>
                One-way sync of calendar events to a single Google account.
              </CardDescription>
            </div>
            {hasRefreshToken ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <AlertCircle className="h-3 w-3" /> Not connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-2">
                <p className="font-medium">Setup steps</p>
                <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                  <li>
                    Open{' '}
                    <a className="underline inline-flex items-center gap-1"
                       href="https://console.cloud.google.com/apis/credentials"
                       target="_blank" rel="noreferrer">
                      Google Cloud Console <ExternalLink className="h-3 w-3" />
                    </a>{' '}
                    and create an OAuth 2.0 Client ID (type: Web application).
                  </li>
                  <li>Add the redirect URI below to your OAuth client.</li>
                  <li>Paste the Client ID and Secret here, save, then click Connect.</li>
                </ol>
                <div className="flex items-center gap-2 pt-1">
                  <code className="flex-1 rounded bg-background px-2 py-1 text-xs break-all">
                    {redirectUri}
                  </code>
                  <Button size="sm" variant="outline" onClick={copyRedirect}>
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cid">Google OAuth Client ID</Label>
                <Input id="cid" value={clientId} onChange={(e) => setClientId(e.target.value)}
                       placeholder="xxxx.apps.googleusercontent.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="csecret">Google OAuth Client Secret</Label>
                <Input id="csecret" type="password" value={clientSecret}
                       onChange={(e) => setClientSecret(e.target.value)}
                       placeholder="GOCSPX-..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calid">Calendar ID</Label>
                <Input id="calid" value={calendarId}
                       onChange={(e) => setCalendarId(e.target.value)}
                       placeholder="primary" />
                <p className="text-xs text-muted-foreground">
                  Use <code>primary</code> for the connected account's main calendar, or paste a specific calendar ID.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={save} disabled={saving} variant="outline">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
                </Button>
                <Button onClick={connect} disabled={saving || exchanging || !clientId || !clientSecret}>
                  {exchanging && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {hasRefreshToken ? 'Reconnect Google account' : 'Connect Google account'}
                </Button>
                {hasRefreshToken && (
                  <Button variant="ghost" onClick={disconnect}>Disconnect</Button>
                )}
              </div>

              {hasRefreshToken && (
                <>
                  <Separator />
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Connected account:</span> <span className="font-medium">{connectedEmail ?? '—'}</span></p>
                    <p><span className="text-muted-foreground">Connected at:</span> {connectedAt ? new Date(connectedAt).toLocaleString() : '—'}</p>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <TerrisageAmenityCard />
    </div>
  );
}

function TerrisageAmenityCard() {
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('terrisage_amenity_master' as never)
      .select('fetched_at', { count: 'exact', head: false })
      .order('fetched_at', { ascending: false })
      .limit(1)
      .then(({ data, count }) => {
        setCount(count ?? (data?.length ?? 0));
        const row = (data?.[0] as { fetched_at?: string } | undefined);
        setLastFetched(row?.fetched_at ?? null);
      });
  }, [busy]);

  const refresh = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('terrisage-project-push', {
      body: { action: 'refresh-amenities' },
    });
    setBusy(false);
    if (error || !(data as { ok?: boolean })?.ok) {
      toast.error((data as { errors?: unknown })?.errors ? 'Some property types failed. See logs.' : (error?.message ?? 'Refresh failed'));
    } else {
      toast.success(`Refreshed ${(data as { total?: number })?.total ?? 0} amenities`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Terrisage amenity master</CardTitle>
        <CardDescription>
          Cache of the amenity catalogue from Terrisage. Required to convert free-text amenities into amenityId UUIDs on project push.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          {count != null ? `${count} cached` : '—'}
          {lastFetched ? ` · Last refreshed ${new Date(lastFetched).toLocaleString()}` : ' · Never refreshed'}
        </div>
        <Button onClick={refresh} disabled={busy} variant="outline" size="sm">
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Refresh amenity master
        </Button>
      </CardContent>
    </Card>
  );
}
