import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Ticket,
  BookOpen,
  BarChart3,
  Megaphone,
  Settings,
  ChevronDown,
  ChevronRight,
  Users,
  GitBranch,
  ListChecks,
  PhoneCall,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
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
import { useUser } from '@/context/UserContext';

interface AppSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const adminSubItems = [
  { title: 'Teams & Users', url: '/admin/users', icon: Users },
  { title: 'Lookup Management', url: '/admin/lookups', icon: ListChecks },
  { title: 'Assignment Rules', url: '/admin/queues', icon: GitBranch },
];

export function AppSidebar({ open }: AppSidebarProps) {
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { isAdmin } = useUser();

  const [adminOpen, setAdminOpen] = useState(
    location.pathname.startsWith('/admin')
  );

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');
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
              <NavItem to="/enquiries" icon={PhoneCall} label="Inquiry Pipeline" />
              <NavItem to="/accounts" icon={Building2} label="Accounts" />
              <NavItem to="/tickets" icon={Ticket} label="Support Tickets" />
              <NavItem to="/knowledge" icon={BookOpen} label="Knowledge Base" />
              {isAdmin && (
                <NavItem to="/marketing" icon={Megaphone} label="Marketing" />
              )}
              <NavItem to="/reports" icon={BarChart3} label="Reports" />

              {/* Admin collapsible */}
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
