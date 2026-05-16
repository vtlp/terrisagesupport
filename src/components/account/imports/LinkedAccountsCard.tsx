import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

export function LinkedAccountsCard({ jobId }: { jobId: string }) {
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
      supabase.from('accounts').select('id, account_name, city').order('account_name'),
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
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setOpen(false);
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
              <LinkIcon className="h-4 w-4" /> Linked accounts
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Optionally tag tenants this project applies to. Visible from the account's Projects section.
            </p>
          </div>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Link to tenant
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Search account name…" />
                <CommandList>
                  <CommandEmpty>No accounts found.</CommandEmpty>
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
          <p className="text-xs text-muted-foreground">No tenants linked. Linking is optional.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {links.map(l => (
              <Badge key={l.id} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                <span>{l.accounts?.account_name ?? l.account_id.slice(0, 8)}</span>
                <button
                  onClick={() => removeLink(l.id)}
                  className="ml-1 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                  aria-label="Unlink"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
