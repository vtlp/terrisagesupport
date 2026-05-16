import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, Loader2, Plus, X, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/context/UserContext';
import { cn } from '@/lib/utils';

type AccountLite = { id: string; account_name: string; city: string | null };
type LinkRow = {
  id: string;
  account_id: string;
  notes: string | null;
  linked_at: string;
  accounts?: AccountLite | null;
};

export function LinkedAccountsCard({ jobId, disabled = false }: { jobId: string; disabled?: boolean }) {
  const { currentUser } = useUser();
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: l }, { data: a }] = await Promise.all([
      supabase
        .from('import_job_account_links' as never)
        .select('id, account_id, notes, linked_at, accounts:account_id(id, account_name, city)')
        .eq('job_id', jobId)
        .order('linked_at', { ascending: false }),
      supabase
        .from('accounts')
        .select('id, account_name, city')
        .eq('tenancy_type', 'AGENCY_BROKERAGE_CONSULTANCY')
        .order('account_name'),
    ]);
    setLinks((l ?? []) as unknown as LinkRow[]);
    setAccounts((a ?? []) as AccountLite[]);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const linkedIds = useMemo(() => new Set(links.map(l => l.account_id)), [links]);
  const available = useMemo(() => accounts.filter(a => !linkedIds.has(a.id)), [accounts, linkedIds]);

  const addLink = async (accountId: string) => {
    setBusy(true);
    const { error } = await supabase.from('import_job_account_links' as never).insert([{
      job_id: jobId, account_id: accountId, linked_by: currentUser?.user_id ?? null,
    }] as never);
    if (error) { setBusy(false); toast.error(error.message); return; }
    setOpen(false);

    // Call Terrisage to link the existing project to this agency.
    const { data: resp, error: fnErr } = await supabase.functions.invoke('terrisage-project-push', {
      body: { action: 'link-agency', jobId, accountId },
    });
    setBusy(false);
    if (fnErr || !(resp as { ok?: boolean })?.ok) {
      const msg = (resp as { error?: string })?.error ?? fnErr?.message ?? 'Failed to link agency in Terrisage';
      toast.error(msg);
    } else {
      toast.success('Agency linked in Terrisage');
    }
    await load();
  };

  const removeLink = async (linkId: string) => {
    const prev = links;
    setLinks(ls => ls.filter(l => l.id !== linkId));
    const { error } = await supabase.from('import_job_account_links' as never).delete().eq('id', linkId);
    if (error) { setLinks(prev); toast.error(error.message); }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <LinkIcon className="h-4 w-4" /> Linked agencies
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {disabled
                ? 'Disabled while a builder owner is selected. Clear the owner to link agencies instead.'
                : 'Link agency accounts that should see this project. Each link is registered with Terrisage.'}
            </p>
          </div>
          <Popover open={open} onOpenChange={(v) => !disabled && setOpen(v)}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" disabled={busy || disabled}>
                {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Link to agency
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Search agency name…" />
                <CommandList>
                  <CommandEmpty>No agencies found.</CommandEmpty>
                  <CommandGroup>
                    {available.map(a => (
                      <CommandItem
                        key={a.id}
                        value={`${a.account_name} ${a.city ?? ''}`}
                        onSelect={() => addLink(a.id)}
                      >
                        <Check className={cn('mr-2 h-4 w-4 opacity-0')} />
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
        ) : links.length === 0 ? (
          <p className="text-xs text-muted-foreground">No agencies linked.</p>
        ) : (
          <div className={cn('divide-y rounded-md border', disabled && 'opacity-60')}>
            {links.map(l => (
              <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {l.accounts?.account_name ?? l.account_id.slice(0, 8)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {l.accounts?.city ? `${l.accounts.city} · ` : ''}
                    Linked {new Date(l.linked_at).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeLink(l.id)}
                  disabled={disabled}
                  aria-label="Unlink"
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-1" /> Unlink
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
