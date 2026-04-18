import { useState, useEffect } from 'react';
import { Bell, Search, Menu, ChevronDown, Plus, PhoneCall, Ticket, LogOut, AlertTriangle, Users, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useUser } from '@/context/UserContext';
import { CreateEnquiryDialog } from '@/components/shared/CreateEnquiryDialog';
import { CreateTicketDialog } from '@/components/shared/CreateTicketDialog';
import { seedAccounts } from '@/data/seedData';
import { AccountStatus } from '@/types/core';

interface SeatReqItem {
  id: string;
  account_id: string;
  requested_seats: number;
  requested_by_email: string | null;
  created_at: string;
  account_name?: string;
}

interface UrgentTicketItem {
  id: string;
  ticket_code: string | null;
  subject: string;
  priority: string;
  status: string;
}

export function AppHeader() {
  const navigate = useNavigate();
  const { currentUser, signOut } = useUser();
  const { toggleSidebar } = useSidebar();
  const [createEnquiryOpen, setCreateEnquiryOpen] = useState(false);
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [pendingSeatReqs, setPendingSeatReqs] = useState<SeatReqItem[]>([]);
  const [urgentTickets, setUrgentTickets] = useState<UrgentTicketItem[]>([]);

  const stalledAccounts = seedAccounts.filter(a => a.status === AccountStatus.STALLED_ONBOARDING);
  const attentionCount = urgentTickets.length + stalledAccounts.length + pendingSeatReqs.length;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ data: seatData }, { data: ticketData }] = await Promise.all([
        supabase
          .from('seat_requests')
          .select('id, account_id, requested_seats, requested_by_email, created_at')
          .eq('status', 'PENDING')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('tickets')
          .select('id, ticket_code, subject, priority, status')
          .in('priority', ['P1', 'P2'])
          .in('status', ['OPEN', 'PENDING_CUSTOMER', 'PENDING_INTERNAL'])
          .order('updated_at', { ascending: false })
          .limit(20),
      ]);
      if (cancelled) return;
      const rows = (seatData ?? []) as Omit<SeatReqItem, 'account_name'>[];
      const ids = Array.from(new Set(rows.map(r => r.account_id)));
      let nameMap = new Map<string, string>();
      if (ids.length > 0) {
        const { data: accts } = await supabase
          .from('accounts')
          .select('id, account_name')
          .in('id', ids);
        nameMap = new Map((accts ?? []).map(a => [a.id, a.account_name]));
      }
      if (cancelled) return;
      setPendingSeatReqs(rows.map(r => ({ ...r, account_name: nameMap.get(r.account_id) })));
      setUrgentTickets((ticketData ?? []) as UrgentTicketItem[]);
    };
    load();
    const channel = supabase
      .channel('header-attention')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seat_requests' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out');
    navigate('/auth', { replace: true });
  };

  return (
    <header className="h-14 bg-secondary border-b border-sidebar-border flex items-center justify-between px-4 shrink-0">
      {/* Left */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="text-secondary-foreground hover:bg-sidebar-muted lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">T</span>
          </div>
          <span className="text-secondary-foreground font-semibold hidden sm:inline">
            Terrisage Support
          </span>
        </div>
      </div>

      {/* Centre — Search */}
      <div className="flex-1 max-w-xl mx-4 hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search enquiries, accounts, tickets..."
            className="pl-9 bg-sidebar-muted border-sidebar-border text-secondary-foreground placeholder:text-muted-foreground focus:ring-accent"
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Quick Create */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="bg-primary hover:bg-primary/90 hidden sm:flex">
              <Plus className="h-4 w-4 mr-1" />
              Quick Create
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setCreateEnquiryOpen(true)}>
              <PhoneCall className="h-4 w-4 mr-2" />
              New Enquiry
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCreateTicketOpen(true)}>
              <Ticket className="h-4 w-4 mr-2" />
              New Support Ticket
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-secondary-foreground hover:bg-sidebar-muted relative"
              aria-label={`${attentionCount} notifications`}
            >
              <Bell className="h-5 w-5" />
              {attentionCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 bg-accent text-accent-foreground text-xs">
                  {attentionCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-card">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              <span className="text-xs text-muted-foreground font-normal">{attentionCount} item{attentionCount === 1 ? '' : 's'}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {attentionCount === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                You're all caught up.
              </div>
            )}

            <ScrollArea className="max-h-96">
              {pendingSeatReqs.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground py-1">
                    Pending seat requests
                  </DropdownMenuLabel>
                  {pendingSeatReqs.map(r => (
                    <DropdownMenuItem
                      key={r.id}
                      className="flex-col items-start gap-0.5 py-2"
                      onClick={() => navigate(`/accounts/${r.account_id}?tab=seats`)}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Users className="h-3.5 w-3.5 text-warning shrink-0" />
                        <span className="text-sm font-medium truncate flex-1">
                          +{r.requested_seats} seats · {r.account_name ?? 'Account'}
                        </span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                      </div>
                      <div className="text-[11px] text-muted-foreground pl-5 truncate w-full">
                        {r.requested_by_email ? `${r.requested_by_email} · ` : ''}{format(new Date(r.created_at), 'dd MMM, HH:mm')}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </>
              )}

              {urgentTickets.length > 0 && (
                <>
                  {pendingSeatReqs.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground py-1">
                    Urgent tickets ({urgentTickets.length})
                  </DropdownMenuLabel>
                  {urgentTickets.slice(0, 6).map(t => (
                    <DropdownMenuItem
                      key={t.ticket_id}
                      className="flex-col items-start gap-0.5 py-2"
                      onClick={() => navigate(`/tickets/${t.ticket_id}`)}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        <span className="text-sm font-medium truncate flex-1">{t.subject}</span>
                        <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground pl-5 truncate w-full">{t.ticket_id} · {t.status}</div>
                    </DropdownMenuItem>
                  ))}
                </>
              )}

              {stalledAccounts.length > 0 && (
                <>
                  {(pendingSeatReqs.length > 0 || urgentTickets.length > 0) && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground py-1">
                    Stalled onboarding ({stalledAccounts.length})
                  </DropdownMenuLabel>
                  {stalledAccounts.slice(0, 5).map(a => (
                    <DropdownMenuItem
                      key={a.account_id}
                      className="flex-col items-start gap-0.5 py-2"
                      onClick={() => navigate(`/accounts/${a.account_id}`)}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                        <span className="text-sm font-medium truncate flex-1">{a.account_name}</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                      </div>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-secondary-foreground hover:bg-sidebar-muted"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {currentUser.full_name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-sm font-medium">{currentUser.full_name}</span>
                <span className="text-xs text-muted-foreground">{currentUser.role}</span>
              </div>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card">
            <DropdownMenuItem disabled>
              <div className="flex flex-col">
                <span className="text-sm">{currentUser.full_name}</span>
                <span className="text-xs text-muted-foreground">{currentUser.email}</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CreateEnquiryDialog
        open={createEnquiryOpen}
        onOpenChange={setCreateEnquiryOpen}
      />
      <CreateTicketDialog
        open={createTicketOpen}
        onOpenChange={setCreateTicketOpen}
        onCreated={(ticket) => {
          seedTickets.unshift(ticket);
          navigate(`/tickets/${ticket.ticket_id}`);
        }}
      />
    </header>
  );
}
