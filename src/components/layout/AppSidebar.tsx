import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Ticket, BookOpen, BarChart3, Megaphone,
  Settings, ChevronDown, ChevronRight, Users, GitBranch, ListChecks,
  PhoneCall, CalendarDays, Plug,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub,
  SidebarMenuSubButton, SidebarMenuSubItem, useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState, useEffect } from 'react';
import { useUser } from '@/context/UserContext';
import { seedEnquiries, seedAccounts } from '@/data/seedData';
import { EnquiryStage, AccountStatus } from '@/types/core';
import { supabase } from '@/integrations/supabase/client';

interface AppSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const adminSubItems = [
  { title: 'Teams & Users', url: '/admin/users', icon: Users },
  { title: 'Lookup Management', url: '/admin/lookups', icon: ListChecks },
  { title: 'Assignment Rules', url: '/admin/queues', icon: GitBranch },
  { title: 'Integrations', url: '/admin/integrations', icon: Plug },
];

function useNotificationCounts() {
  const newEnquiries = seedEnquiries.filter(e => e.stage === EnquiryStage.NEW_ENQUIRY).length;
  const stalledAccounts = seedAccounts.filter(a => a.status === AccountStatus.STALLED_ONBOARDING).length;
  const [urgentTickets, setUrgentTickets] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { count } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .in('priority', ['P1', 'P2'])
        .in('status', ['OPEN', 'PENDING_CUSTOMER', 'PENDING_INTERNAL']);
      if (!cancelled) setUrgentTickets(count ?? 0);
    };
    load();
    const ch = supabase.channel('sidebar-tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);
  return { newEnquiries, urgentTickets, stalledAccounts };
}

export function AppSidebar({ open }: AppSidebarProps) {
  const location = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const { isAdmin } = useUser();
  const counts = useNotificationCounts();

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [location.pathname, isMobile, setOpenMobile]);

  const [adminOpen, setAdminOpen] = useState(location.pathname.startsWith('/admin'));

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');
  const isGroupActive = (paths: string[]) => paths.some((p) => location.pathname.startsWith(p));

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string; badge?: number }) => (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive(to)} className={cn('text-sidebar-foreground hover:bg-sidebar-muted', isActive(to) && 'bg-sidebar-primary text-sidebar-primary-foreground')}>
        <Link to={to} className="flex items-center gap-2 w-full">
          <Icon className="h-4 w-4" />
          {!collapsed && <span>{label}</span>}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const CollapsibleGroup = ({ label, icon: Icon, items, open: groupOpen, onOpenChange, activePaths, badge }: {
    label: string; icon: React.ElementType;
    items: { title: string; url: string; icon: React.ElementType }[];
    open: boolean; onOpenChange: (v: boolean) => void; activePaths: string[]; badge?: number;
  }) => (
    <Collapsible open={groupOpen} onOpenChange={onOpenChange}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className={cn('text-sidebar-foreground hover:bg-sidebar-muted w-full justify-between', isGroupActive(activePaths) && 'bg-sidebar-muted border-l-2 border-sidebar-accent')}>
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {!collapsed && <span>{label}</span>}
            </div>
            {!collapsed && (groupOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((item) => (
              <SidebarMenuSubItem key={item.url}>
                <SidebarMenuSubButton asChild isActive={isActive(item.url)} className={cn('text-sidebar-foreground hover:bg-sidebar-muted', isActive(item.url) && 'bg-sidebar-primary text-sidebar-primary-foreground')}>
                  <Link to={item.url}>
                    <item.icon className="h-3.5 w-3.5" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );

  return (
    <Sidebar collapsible="icon" className={cn('border-r border-sidebar-border bg-sidebar transition-all duration-300', collapsed ? 'w-14' : 'w-60')}>
      <SidebarContent className="py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
              <NavItem to="/enquiries" icon={PhoneCall} label="Enquiry Pipeline" badge={counts.newEnquiries} />
              <NavItem to="/calendar" icon={CalendarDays} label="Calendar" />
              <NavItem to="/accounts" icon={Building2} label="Accounts" badge={counts.stalledAccounts} />
              <NavItem to="/tickets" icon={Ticket} label="Support Tickets" badge={counts.urgentTickets} />
              <NavItem to="/knowledge" icon={BookOpen} label="Knowledge Base" />
              {isAdmin && <NavItem to="/marketing" icon={Megaphone} label="Marketing" />}
              <NavItem to="/reports" icon={BarChart3} label="Reports" />
              <CollapsibleGroup label="Admin" icon={Settings} items={adminSubItems} open={adminOpen} onOpenChange={setAdminOpen} activePaths={['/admin']} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
