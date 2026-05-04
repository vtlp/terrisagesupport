import { useState, useEffect, useCallback } from 'react';
import { Bell, Search, Menu, ChevronDown, Plus, PhoneCall, Ticket, LogOut, AlertTriangle, Users, ExternalLink, Calendar as CalendarIcon, Inbox, FileCheck, CheckCheck, UserCog } from 'lucide-react';
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
import { formatDistanceToNow } from 'date-fns';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useUser } from '@/context/UserContext';
import { CreateEnquiryDialog } from '@/components/shared/CreateEnquiryDialog';
import { CreateTicketDialog } from '@/components/shared/CreateTicketDialog';


type NotifType =
  | 'EVENT_DUE' | 'EVENT_OVERDUE' | 'REMINDER'
  | 'ENQUIRY_SUBMISSION' | 'SLA_BREACH' | 'ACCOUNT_STALLED'
  | 'DEMO_NOT_COMPLETED' | 'SEAT_REQUEST' | 'TICKET_ASSIGNED'
  | 'TICKET_UPDATED' | 'EXTERNAL' | 'GENERAL';

type Severity = 'INFO' | 'WARNING' | 'CRITICAL';

interface NotificationRow {
  id: string;
  type: NotifType;
  severity: Severity;
  title: string;
  body: string | null;
  link_path: string | null;
  is_read: boolean;
  created_at: string;
}

const ICONS: Record<NotifType, React.ComponentType<{ className?: string }>> = {
  EVENT_DUE: CalendarIcon,
  EVENT_OVERDUE: AlertTriangle,
  REMINDER: CalendarIcon,
  ENQUIRY_SUBMISSION: Inbox,
  SLA_BREACH: AlertTriangle,
  ACCOUNT_STALLED: AlertTriangle,
  DEMO_NOT_COMPLETED: AlertTriangle,
  SEAT_REQUEST: Users,
  TICKET_ASSIGNED: Ticket,
  TICKET_UPDATED: Ticket,
  EXTERNAL: ExternalLink,
  GENERAL: Bell,
};

const SEVERITY_COLOR: Record<Severity, string> = {
  INFO: 'text-muted-foreground',
  WARNING: 'text-warning',
  CRITICAL: 'text-destructive',
};

export function AppHeader() {
  const navigate = useNavigate();
  const { currentUser, signOut } = useUser();
  const { toggleSidebar } = useSidebar();
  const [createEnquiryOpen, setCreateEnquiryOpen] = useState(false);
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const load = useCallback(async () => {
    // Trigger overdue scan (best-effort) so the bell stays current
    supabase.rpc('scan_overdue_events').then(() => {});
    const { data } = await supabase
      .from('notifications')
      .select('id, type, severity, title, body, link_path, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data ?? []) as NotificationRow[]);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('header-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, load)
      .subscribe();
    // Refresh overdue scan periodically while the app is open
    const t = setInterval(load, 5 * 60 * 1000);
    return () => { supabase.removeChannel(channel); clearInterval(t); };
  }, [load]);

  const handleClickNotification = async (n: NotificationRow) => {
    if (!n.is_read) {
      await supabase.rpc('mark_notifications_read', { _ids: [n.id] });
    }
    if (n.link_path) navigate(n.link_path);
  };

  const markAllRead = async () => {
    await supabase.rpc('mark_notifications_read', { _ids: null });
    toast.success('All notifications marked read');
  };

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
        <GlobalSearch />
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
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
              aria-label={`${unreadCount} unread notifications`}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 bg-accent text-accent-foreground text-xs">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96 bg-card p-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-[10px]">{unreadCount} new</Badge>
                )}
              </div>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
                  <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark all read
                </Button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                <FileCheck className="h-6 w-6 mx-auto mb-2 opacity-50" />
                You're all caught up.
              </div>
            ) : (
              <ScrollArea className="h-[420px]">
                {notifications.map(n => {
                  const Icon = ICONS[n.type] ?? Bell;
                  return (
                    <DropdownMenuItem
                      key={n.id}
                      className={`flex-col items-start gap-0.5 px-3 py-2.5 rounded-none border-b border-border/50 last:border-b-0 ${!n.is_read ? 'bg-accent/30' : ''}`}
                      onClick={() => handleClickNotification(n)}
                    >
                      <div className="flex items-start gap-2 w-full">
                        <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${SEVERITY_COLOR[n.severity]}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm truncate flex-1 ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>
                              {n.title}
                            </span>
                            {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                          </div>
                          {n.body && (
                            <div className="text-[11px] text-muted-foreground truncate mt-0.5">{n.body}</div>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </div>
                        </div>
                        {n.link_path && <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />}
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </ScrollArea>
            )}
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
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <UserCog className="h-4 w-4 mr-2" />
              My Profile
            </DropdownMenuItem>
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
          navigate(`/tickets/${ticket.ticket_id}`);
        }}
      />
    </header>
  );
}
