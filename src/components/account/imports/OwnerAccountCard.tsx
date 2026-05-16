import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Loader2, X, Building2, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';

type BuilderAccount = { id: string; account_name: string; city: string | null; tenant_id: string | null };

export function OwnerAccountCard({ jobId, onOwnerChange }: { jobId: string; onOwnerChange?: (hasOwner: boolean) => void }) {
  const [owner, setOwner] = useState<BuilderAccount | null>(null);
  const [accounts, setAccounts] = useState<BuilderAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: job }, { data: a }] = await Promise.all([
      supabase.from('import_jobs').select('owner_account_id').eq('id', jobId).maybeSingle(),
      supabase
        .from('accounts')
        .select('id, account_name, city, tenant_id')
        .eq('tenancy_type', 'BUILDER_DEVELOPER')
        .order('account_name'),
    ]);
    const list = (a ?? []) as BuilderAccount[];
    setAccounts(list);
    const ownerId = (job as { owner_account_id: string | null } | null)?.owner_account_id ?? null;
    setOwner(ownerId ? list.find(x => x.id === ownerId) ?? null : null);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const setOwnerAccount = async (accountId: string | null) => {
    setBusy(true);
    const { error } = await supabase
      .from('import_jobs')
      .update({ owner_account_id: accountId } as never)
      .eq('id', jobId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setOpen(false);
    setOwner(accountId ? accounts.find(a => a.id === accountId) ?? null : null);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Link to owner
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              The builder account that owns this project. Their tenant ID is sent as projectOwnerOrgId on push.
            </p>
          </div>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" disabled={busy || loading}>
                {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ChevronsUpDown className="h-4 w-4 mr-1" />}
                {owner ? 'Change owner' : 'Select builder'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Search builder accounts…" />
                <CommandList>
                  <CommandEmpty>No builder accounts found.</CommandEmpty>
                  <CommandGroup>
                    {accounts.map(a => (
                      <CommandItem
                        key={a.id}
                        value={`${a.account_name} ${a.city ?? ''}`}
                        onSelect={() => setOwnerAccount(a.id)}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm">{a.account_name}</span>
                          {a.city && <span className="text-xs text-muted-foreground">{a.city}</span>}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : !owner ? (
          <p className="text-xs text-muted-foreground">No owner selected. Only builder accounts can own a project.</p>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{owner.account_name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {owner.city ? `${owner.city} · ` : ''}
                {owner.tenant_id ? `Tenant ${owner.tenant_id.slice(0, 8)}…` : 'No tenant ID'}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOwnerAccount(null)}
              aria-label="Clear owner"
              className="text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
