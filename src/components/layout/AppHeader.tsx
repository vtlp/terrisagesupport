import { useState } from 'react';
import { Bell, Search, Menu, ChevronDown, Plus, PhoneCall, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useUser } from '@/context/UserContext';
import { UserRole } from '@/types/core';
import { CreateEnquiryDialog } from '@/components/shared/CreateEnquiryDialog';
import { CreateTicketDialog } from '@/components/shared/CreateTicketDialog';
import { seedEnquiries, seedTickets } from '@/data/seedData';

interface AppHeaderProps {
  onMenuClick: () => void;
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser, isAdmin } = useUser();
  const [createEnquiryOpen, setCreateEnquiryOpen] = useState(false);
  const [createTicketOpen, setCreateTicketOpen] = useState(false);

  const toggleRole = () => {
    setCurrentUser({
      ...currentUser,
      role: isAdmin ? UserRole.SUPPORT_AGENT : UserRole.ADMIN,
    });
    toast.success(`Switched to ${isAdmin ? 'Support Agent' : 'Admin'} role`);
  };

  return (
    <header className="h-14 bg-secondary border-b border-sidebar-border flex items-center justify-between px-4 shrink-0">
      {/* Left */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
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

        <Button
          variant="ghost"
          size="icon"
          className="text-secondary-foreground hover:bg-sidebar-muted relative"
          onClick={() => toast.info('3 items due in next 24 hours')}
        >
          <Bell className="h-5 w-5" />
          <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 bg-accent text-accent-foreground text-xs">
            3
          </Badge>
        </Button>

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
            <DropdownMenuItem>My Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={toggleRole}>
              Switch to {isAdmin ? 'Support Agent' : 'Admin'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Sign Out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CreateEnquiryDialog
        open={createEnquiryOpen}
        onOpenChange={setCreateEnquiryOpen}
        onCreated={(enquiry) => {
          seedEnquiries.unshift(enquiry);
        }}
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
