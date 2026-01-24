import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  ClipboardCheck,
  FileUp,
  Plug,
  Calendar,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  Users,
  GitBranch,
  Clock,
  History,
  Ticket,
  Search,
  BookOpen,
  BarChart3,
  PhoneCall,
  Video,
  Briefcase,
  Zap,
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

const accountsSubItems = [
  { title: 'All Accounts', url: '/accounts', icon: Building2 },
  { title: 'Onboarding Tracker', url: '/onboarding', icon: ClipboardCheck },
];

const operationsSubItems = [
  { title: 'Imports and Data Health', url: '/imports', icon: FileUp },
  { title: 'Integrations', url: '/integrations', icon: Plug },
  { title: 'Activation and Reviews', url: '/activation', icon: Calendar },
];

const adminSubItems = [
  { title: 'Teams and Users', url: '/admin/users', icon: Users },
  { title: 'Queues and Routing', url: '/admin/queues', icon: GitBranch },
  { title: 'SLA Policies', url: '/admin/sla', icon: Clock },
  { title: 'Audit Log', url: '/admin/audit', icon: History },
];

export function AppSidebar({ open }: AppSidebarProps) {
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  
  const [accountsOpen, setAccountsOpen] = useState(
    location.pathname.startsWith('/accounts') || location.pathname.startsWith('/onboarding')
  );
  const [operationsOpen, setOperationsOpen] = useState(
    location.pathname.startsWith('/imports') || 
    location.pathname.startsWith('/integrations') || 
    location.pathname.startsWith('/activation')
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

  const CollapsibleNav = ({
    label,
    icon: Icon,
    items,
    open,
    onOpenChange,
    activePaths,
  }: {
    label: string;
    icon: React.ElementType;
    items: { title: string; url: string; icon: React.ElementType }[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    activePaths: string[];
  }) => (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            className={cn(
              'text-sidebar-foreground hover:bg-sidebar-muted w-full justify-between',
              isGroupActive(activePaths) &&
                'bg-sidebar-muted border-l-2 border-sidebar-accent'
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {!collapsed && <span>{label}</span>}
            </div>
            {!collapsed &&
              (open ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              ))}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((item) => (
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
        {/* Main */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Pipeline */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">
            {!collapsed && 'Pipeline'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem to="/enquiries" icon={PhoneCall} label="Enquiries" />
              <NavItem to="/demos" icon={Video} label="Demos and Calendar" />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Accounts and Onboarding */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">
            {!collapsed && 'Accounts'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleNav
                label="Accounts"
                icon={Building2}
                items={accountsSubItems}
                open={accountsOpen}
                onOpenChange={setAccountsOpen}
                activePaths={['/accounts', '/onboarding']}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Operations */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">
            {!collapsed && 'Operations'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleNav
                label="Operations"
                icon={ClipboardCheck}
                items={operationsSubItems}
                open={operationsOpen}
                onOpenChange={setOperationsOpen}
                activePaths={['/imports', '/integrations', '/activation']}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tools */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">
            {!collapsed && 'Tools'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem to="/support-actions" icon={FileText} label="Support Actions" />
              <NavItem to="/tickets" icon={Ticket} label="Tickets" />
              <NavItem to="/search" icon={Search} label="Search" />
              <NavItem to="/knowledge" icon={BookOpen} label="Knowledge Base" />
              <NavItem to="/macros" icon={Zap} label="Macros" />
              <NavItem to="/reports" icon={BarChart3} label="Reports" />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Strategy */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">
            {!collapsed && 'Strategy'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem to="/playbooks" icon={Briefcase} label="Playbooks" />
              <NavItem to="/technical" icon={Settings} label="Technical View" />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">
            {!collapsed && 'Administration'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleNav
                label="Admin"
                icon={Settings}
                items={adminSubItems}
                open={adminOpen}
                onOpenChange={setAdminOpen}
                activePaths={['/admin']}
              />
              <NavItem to="/settings" icon={Settings} label="Settings" />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
