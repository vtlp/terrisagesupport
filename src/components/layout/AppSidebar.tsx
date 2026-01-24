import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Ticket,
  Search,
  BookOpen,
  FileText,
  BarChart3,
  Settings,
  Users,
  GitBranch,
  Clock,
  Tags,
  History,
  Plug,
  ChevronDown,
  ChevronRight,
  Inbox,
  AlertTriangle,
  AlertCircle,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';

interface AppSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ticketSubItems = [
  { title: 'My Queue', url: '/tickets/my-queue', icon: Inbox },
  { title: 'Unassigned', url: '/tickets/unassigned', icon: List },
  { title: 'Breaching Soon', url: '/tickets/breaching-soon', icon: AlertTriangle },
  { title: 'Breached Today', url: '/tickets/breached-today', icon: AlertCircle },
  { title: 'All Tickets', url: '/tickets', icon: Ticket },
];

const adminSubItems = [
  { title: 'Teams & Users', url: '/admin/users', icon: Users },
  { title: 'Queues & Routing', url: '/admin/queues', icon: GitBranch },
  { title: 'SLA Policies', url: '/admin/sla', icon: Clock },
  { title: 'Categories & Tags', url: '/admin/categories', icon: Tags },
  { title: 'Audit Log', url: '/admin/audit', icon: History },
  { title: 'Integrations', url: '/admin/integrations', icon: Plug },
];

export function AppSidebar({ open }: AppSidebarProps) {
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  
  const [ticketsOpen, setTicketsOpen] = useState(
    location.pathname.startsWith('/tickets')
  );
  const [adminOpen, setAdminOpen] = useState(
    location.pathname.startsWith('/admin')
  );

  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (paths: string[]) =>
    paths.some((p) => location.pathname.startsWith(p));

  const NavItem = ({
    to,
    icon: Icon,
    label,
  }: {
    to: string;
    icon: React.ElementType;
    label: string;
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
        <Link to={to}>
          <Icon className="h-4 w-4" />
          {!collapsed && <span>{label}</span>}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible open={ticketsOpen} onOpenChange={setTicketsOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className={cn(
                        'text-sidebar-foreground hover:bg-sidebar-muted w-full justify-between',
                        isGroupActive(['/tickets']) &&
                          'bg-sidebar-muted border-l-2 border-sidebar-accent'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4" />
                        {!collapsed && <span>Tickets</span>}
                      </div>
                      {!collapsed &&
                        (ticketsOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        ))}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {ticketSubItems.map((item) => (
                        <SidebarMenuSubItem key={item.url}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isActive(item.url)}
                            className={cn(
                              'text-sidebar-foreground hover:bg-sidebar-muted',
                              isActive(item.url) &&
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem to="/search" icon={Search} label="Search" />
              <NavItem to="/knowledge" icon={BookOpen} label="Knowledge Base" />
              <NavItem to="/macros" icon={FileText} label="Macros" />
              <NavItem to="/reports" icon={BarChart3} label="Reports" />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">
            {!collapsed && 'Administration'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className={cn(
                        'text-sidebar-foreground hover:bg-sidebar-muted w-full justify-between',
                        isGroupActive(['/admin']) &&
                          'bg-sidebar-muted border-l-2 border-sidebar-accent'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        {!collapsed && <span>Admin</span>}
                      </div>
                      {!collapsed &&
                        (adminOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        ))}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {adminSubItems.map((item) => (
                        <SidebarMenuSubItem key={item.url}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isActive(item.url)}
                            className={cn(
                              'text-sidebar-foreground hover:bg-sidebar-muted',
                              isActive(item.url) &&
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
