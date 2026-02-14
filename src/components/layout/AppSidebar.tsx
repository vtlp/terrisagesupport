import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Ticket, BookOpen, BarChart3, Megaphone,
  Settings, ChevronDown, ChevronRight, Users, GitBranch, ListChecks,
  PhoneCall, CalendarDays, List,
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
import { seedEnquiries, seedTickets, seedAccounts } from '@/data/seedData';
import { EnquiryStage, TicketPriority, TicketStatus, AccountStatus } from '@/types/core';

interface AppSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const pipelineSubItems = [
  { title: 'All Enquiries', url: '/enquiries', icon: List },
  { title: 'Calendar & Dashboard', url: '/enquiries/dashboard', icon: CalendarDays },
];

const adminSubItems = [
  { title: 'Teams & Users', url: '/admin/users', icon: Users },
  { title: 'Lookup Management', url: '/admin/lookups', icon: ListChecks },
  { title: 'Assignment Rules', url: '/admin/queues', icon: GitBranch },
];

// Notification counts
function useNotificationCounts() {
  const newEnquiries = seedEnquiries.filter(e => e.stage === EnquiryStage.NEW_ENQUIRY).length;
  const urgentTickets = seedTickets.filter(t =>
    (t.priority === TicketPriority.URGENT || t.priority === TicketPriority.HIGH) &&
    t.status !== TicketStatus.RESOLVED && t.status !== TicketStatus.CLOSED
  ).length;
  const stalledAccounts = seedAccounts.filter(a => a.status === AccountStatus.STALLED_ONBOARDING).length;
  return { newEnquiries, urgentTickets, stalledAccounts };
}

export function AppSidebar({ open }: AppSidebarProps) {
  const location = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const { isAdmin } = useUser();
  const counts = useNotificationCounts();

  // Auto-close mobile sidebar on navigation
  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location.pathname, isMobile, setOpenMobile]);

  const [pipelineOpen, setPipelineOpen] = useState(
    location.pathname.startsWith('/enquiries')
  );
  const [adminOpen, setAdminOpen] = useState(
    location.pathname.startsWith('/admin')
  );

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');
  const isExact = (path: string) => location.pathname === path;
  const isGroupActive = (paths: string[]) =>
    paths.some((p) => location.pathname.startsWith(p));

  const NavItem = ({
    to, icon: Icon, label, badge,
  }: {
    to: string; icon: React.ElementType; label: string; badge?: number;
  }) => (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive(to)}
        className={cn(
          'text-sidebar-foreground hover:bg-sidebar-muted',
          isActive(to) && 'bg-sidebar-primary text-sidebar-primary-foreground'
        )}
      >
        <Link to={to} className="flex items-center justify-between w-full">
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {!collapsed && <span>{label}</span>}
          </span>
          {!collapsed && badge !== undefined && badge > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold px-1.5">
              {badge}
            </span>
          )}
          {collapsed && badge !== undefined && badge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 rounded-full bg-destructive" />
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const CollapsibleGroup = ({
    label, icon: Icon, items, open: groupOpen, onOpenChange, activePaths, badge,
  }: {
    label: string; icon: React.ElementType;
    items: { title: string; url: string; icon: React.ElementType }[];
    open: boolean; onOpenChange: (v: boolean) => void; activePaths: string[];
    badge?: number;
  }) => (
    <Collapsible open={groupOpen} onOpenChange={onOpenChange}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            className={cn(
              'text-sidebar-foreground hover:bg-sidebar-muted w-full justify-between',
              isGroupActive(activePaths) && 'bg-sidebar-muted border-l-2 border-sidebar-accent'
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {!collapsed && <span>{label}</span>}
            </div>
            <div className="flex items-center gap-1">
              {!collapsed && badge !== undefined && badge > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold px-1.5">
                  {badge}
                </span>
              )}
              {!collapsed && (groupOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
            </div>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((item) => (
              <SidebarMenuSubItem key={item.url}>
                <SidebarMenuSubButton
                  asChild
                  isActive={item.url === '/enquiries' ? isExact('/enquiries') : isActive(item.url)}
                  className={cn(
                    'text-sidebar-foreground hover:bg-sidebar-muted',
                    (item.url === '/enquiries' ? isExact('/enquiries') : isActive(item.url)) &&
                      'bg-sidebar-primary text-sidebar-primary-foreground'
                  )}
                >
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
    <Sidebar
      collapsible="icon"
      className={cn(
        'border-r border-sidebar-border bg-sidebar transition-all duration-300',
        collapsed ? 'w-14' : 'w-60'
      )}
    >
      <SidebarContent className="py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />

              <CollapsibleGroup
                label="Inquiry Pipeline"
                icon={PhoneCall}
                items={pipelineSubItems}
                open={pipelineOpen}
                onOpenChange={setPipelineOpen}
                activePaths={['/enquiries']}
                badge={counts.newEnquiries}
              />

              <NavItem to="/accounts" icon={Building2} label="Accounts" badge={counts.stalledAccounts} />
              <NavItem to="/tickets" icon={Ticket} label="Support Tickets" badge={counts.urgentTickets} />
              <NavItem to="/knowledge" icon={BookOpen} label="Knowledge Base" />
              {isAdmin && (
                <NavItem to="/marketing" icon={Megaphone} label="Marketing" />
              )}
              <NavItem to="/reports" icon={BarChart3} label="Reports" />

              <CollapsibleGroup
                label="Admin"
                icon={Settings}
                items={adminSubItems}
                open={adminOpen}
                onOpenChange={setAdminOpen}
                activePaths={['/admin']}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
