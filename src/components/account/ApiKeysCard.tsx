import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Copy, Key } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `sk_acct_${raw}`;
}

export function ApiKeysCard({ accountId }: { accountId: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('CRM integration');
  const [newKey, setNewKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('account_api_keys')
      .select('id, name, key_prefix, is_active, last_used_at, created_at, revoked_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setKeys((data ?? []) as ApiKey[]);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setBusy(true);
    const key = generateKey();
    const hash = await sha256Hex(key);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('account_api_keys').insert({
      account_id: accountId,
      name: name.trim() || 'CRM integration',
      key_prefix: key.slice(0, 14),
      key_hash: hash,
      created_by: user?.id ?? null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setNewKey(key);
    toast.success('Key created — copy it now, it will not be shown again');
    load();
  };

  const revoke = async (id: string) => {
    if (!confirm('Revoke this API key? The CRM will lose access immediately.')) return;
    const { error } = await supabase.from('account_api_keys')
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Revoked'); load(); }
  };

  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success('Copied'); };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Key className="h-4 w-4" /> CRM API keys
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Used by the customer's CRM app to read seat capacity and post seat requests. Each key is per-account; share securely.
        </p>

        {newKey && (
          <div className="border border-success/40 bg-success/5 rounded p-3 space-y-2">
            <p className="text-xs font-medium text-success">New key — copy now, it will not be shown again:</p>
            <div className="flex gap-2 items-center">
              <code className="text-xs bg-background border rounded px-2 py-1 flex-1 break-all">{newKey}</code>
              <Button size="sm" variant="outline" onClick={() => copy(newKey)}><Copy className="h-3 w-3" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setNewKey(null)}>Done</Button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Key name (e.g. CRM production)" />
          <Button onClick={create} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} Generate
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No keys yet.</p>
        ) : (
          <div className="space-y-2">
            {keys.map(k => (
              <div key={k.id} className="flex items-center justify-between border rounded p-2 gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{k.name}</span>
                    <code className="text-xs text-muted-foreground">{k.key_prefix}…</code>
                    {!k.is_active && <Badge variant="outline" className="text-[10px]">Revoked</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Created {format(new Date(k.created_at), 'dd MMM yyyy')}
                    {k.last_used_at && ` · Last used ${format(new Date(k.last_used_at), 'dd MMM, HH:mm')}`}
                  </p>
                </div>
                {k.is_active && (
                  <Button variant="ghost" size="sm" onClick={() => revoke(k.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
