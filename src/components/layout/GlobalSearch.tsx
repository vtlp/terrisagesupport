import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, PhoneCall, Building2, Ticket, FolderKanban, Users, BookOpen, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type Hit = {
  id: string;
  group: 'Enquiries' | 'Accounts' | 'Tickets' | 'Projects' | 'Contacts' | 'Knowledge';
  title: string;
  subtitle?: string;
  to: string;
};

const ICONS: Record<Hit['group'], React.ComponentType<{ className?: string }>> = {
  Enquiries: PhoneCall,
  Accounts: Building2,
  Tickets: Ticket,
  Projects: FolderKanban,
  Contacts: Users,
  Knowledge: BookOpen,
};

async function runSearch(term: string): Promise<Hit[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const limit = 6;

  const [enq, acc, tix, proj, ctc, kbf, kba] = await Promise.all([
    supabase.from('enquiries')
      .select('id, full_name, phone, company_name, city, stage')
      .or(`full_name.ilike.${like},phone.ilike.${like},company_name.ilike.${like},email.ilike.${like}`)
      .limit(limit),
    supabase.from('accounts')
      .select('id, account_name, owner_name, owner_phone, city, status')
      .or(`account_name.ilike.${like},owner_name.ilike.${like},owner_phone.ilike.${like}`)
      .limit(limit),
    supabase.from('tickets')
      .select('id, subject, ticket_code, requester_name, status, account_id')
      .or(`subject.ilike.${like},ticket_code.ilike.${like},requester_name.ilike.${like}`)
      .limit(limit),
    supabase.from('crm_projects')
      .select('id, name, account_id, city, locality')
      .or(`name.ilike.${like},city.ilike.${like},locality.ilike.${like}`)
      .limit(limit),
    supabase.from('marketing_contacts')
      .select('id, full_name, phone, email, company')
      .or(`full_name.ilike.${like},phone.ilike.${like},email.ilike.${like},company.ilike.${like}`)
      .limit(limit),
    supabase.from('kb_files')
      .select('id, name, folder_id')
      .ilike('name', like)
      .limit(limit),
    supabase.from('kb_articles')
      .select('id, title')
      .ilike('title', like)
      .limit(limit),
  ]);

  const hits: Hit[] = [];

  (enq.data ?? []).forEach((r: any) => hits.push({
    id: `enq-${r.id}`, group: 'Enquiries',
    title: r.full_name,
    subtitle: [r.company_name, r.city, r.phone].filter(Boolean).join(' • '),
    to: `/enquiries/${r.id}`,
  }));
  (acc.data ?? []).forEach((r: any) => hits.push({
    id: `acc-${r.id}`, group: 'Accounts',
    title: r.account_name,
    subtitle: [r.owner_name, r.city, r.owner_phone].filter(Boolean).join(' • '),
    to: `/accounts/${r.id}`,
  }));
  (tix.data ?? []).forEach((r: any) => hits.push({
    id: `tix-${r.id}`, group: 'Tickets',
    title: `${r.ticket_code ? r.ticket_code + ' · ' : ''}${r.subject}`,
    subtitle: [r.requester_name, r.status].filter(Boolean).join(' • '),
    to: `/tickets?id=${r.id}`,
  }));
  (proj.data ?? []).forEach((r: any) => hits.push({
    id: `proj-${r.id}`, group: 'Projects',
    title: r.name,
    subtitle: [r.locality, r.city].filter(Boolean).join(' • '),
    to: r.account_id ? `/accounts/${r.account_id}?tab=projects` : '/accounts',
  }));
  (ctc.data ?? []).forEach((r: any) => hits.push({
    id: `ctc-${r.id}`, group: 'Contacts',
    title: r.full_name,
    subtitle: [r.company, r.email, r.phone].filter(Boolean).join(' • '),
    to: `/marketing?tab=contacts&id=${r.id}`,
  }));
  (kbf.data ?? []).forEach((r: any) => hits.push({
    id: `kbf-${r.id}`, group: 'Knowledge',
    title: r.name,
    subtitle: 'File',
    to: `/knowledge?file=${r.id}`,
  }));
  (kba.data ?? []).forEach((r: any) => hits.push({
    id: `kba-${r.id}`, group: 'Knowledge',
    title: r.title,
    subtitle: 'Article',
    to: `/knowledge?article=${r.id}`,
  }));

  return hits;
}

function useDebouncedSearch(term: string) {
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (term.trim().length < 2) { setHits([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try { setHits(await runSearch(term)); }
      catch { setHits([]); }
      finally { setLoading(false); }
    }, 220);
    return () => clearTimeout(t);
  }, [term]);
  return { hits, loading };
}

function groupHits(hits: Hit[]) {
  const out: Record<string, Hit[]> = {};
  for (const h of hits) {
    (out[h.group] ||= []).push(h);
  }
  return out;
}

/** Inline header search with dropdown + Cmd/Ctrl+K palette. */
export function GlobalSearch() {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteTerm, setPaletteTerm] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const { hits, loading } = useDebouncedSearch(term);
  const palette = useDebouncedSearch(paletteTerm);

  // Cmd/Ctrl+K to open palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Click-outside to close inline dropdown
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = useCallback((to: string) => {
    setOpen(false);
    setPaletteOpen(false);
    setTerm('');
    setPaletteTerm('');
    navigate(to);
  }, [navigate]);

  const grouped = useMemo(() => groupHits(hits), [hits]);
  const paletteGrouped = useMemo(() => groupHits(palette.hits), [palette.hits]);

  return (
    <>
      <div ref={wrapRef} className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          value={term}
          onChange={e => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => term.length >= 2 && setOpen(true)}
          placeholder="Search enquiries, accounts, tickets…  (⌘K)"
          className="pl-9 pr-16 bg-sidebar-muted border-sidebar-border text-secondary-foreground placeholder:text-muted-foreground focus:ring-accent"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:inline-flex h-5 select-none items-center gap-0.5 rounded border border-sidebar-border bg-sidebar px-1.5 text-[10px] text-muted-foreground">
          ⌘K
        </kbd>

        {open && term.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-md border bg-popover text-popover-foreground shadow-lg overflow-hidden">
            <Command shouldFilter={false}>
              <CommandList className="max-h-[60vh]">
                {loading && (
                  <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Searching…
                  </div>
                )}
                {!loading && hits.length === 0 && (
                  <CommandEmpty>No matches for “{term}”.</CommandEmpty>
                )}
                {!loading && Object.entries(grouped).map(([group, items]) => {
                  const Icon = ICONS[group as Hit['group']];
                  return (
                    <CommandGroup key={group} heading={group}>
                      {items.map(h => (
                        <CommandItem
                          key={h.id}
                          value={h.id}
                          onSelect={() => go(h.to)}
                          className="cursor-pointer"
                        >
                          <Icon className="h-4 w-4 mr-2 text-muted-foreground" />
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-sm">{h.title}</span>
                            {h.subtitle && (
                              <span className="truncate text-xs text-muted-foreground">{h.subtitle}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </CommandList>
            </Command>
          </div>
        )}
      </div>

      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput
          value={paletteTerm}
          onValueChange={setPaletteTerm}
          placeholder="Search across enquiries, accounts, tickets, projects, contacts, knowledge…"
        />
        <CommandList className={cn('max-h-[70vh]')}>
          {paletteTerm.trim().length < 2 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search.
            </div>
          )}
          {palette.loading && (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Searching…
            </div>
          )}
          {!palette.loading && paletteTerm.trim().length >= 2 && palette.hits.length === 0 && (
            <CommandEmpty>No matches for “{paletteTerm}”.</CommandEmpty>
          )}
          {!palette.loading && Object.entries(paletteGrouped).map(([group, items]) => {
            const Icon = ICONS[group as Hit['group']];
            return (
              <CommandGroup key={group} heading={group}>
                {items.map(h => (
                  <CommandItem key={h.id} value={h.id} onSelect={() => go(h.to)} className="cursor-pointer">
                    <Icon className="h-4 w-4 mr-2 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-sm">{h.title}</span>
                      {h.subtitle && (
                        <span className="truncate text-xs text-muted-foreground">{h.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
