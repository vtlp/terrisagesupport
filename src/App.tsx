import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Accounts from "@/pages/Accounts";
import AccountDetail from "@/pages/AccountDetail";
import Onboarding from "@/pages/Onboarding";
import Imports from "@/pages/Imports";
import Integrations from "@/pages/Integrations";
import Activation from "@/pages/Activation";
import SupportActions from "@/pages/SupportActions";
import Settings from "@/pages/Settings";
import Tickets from "@/pages/Tickets";
import NewTicket from "@/pages/NewTicket";
import Knowledge from "@/pages/Knowledge";
import SearchPage from "@/pages/SearchPage";
import Macros from "@/pages/Macros";
import Reports from "@/pages/Reports";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminQueues from "@/pages/admin/AdminQueues";
import AdminSLA from "@/pages/admin/AdminSLA";
import AdminAudit from "@/pages/admin/AdminAudit";
import Enquiries from "@/pages/Enquiries";
import Demos from "@/pages/Demos";
import Playbooks from "@/pages/Playbooks";
import TechnicalView from "@/pages/TechnicalView";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            {/* Main */}
            <Route path="/" element={<Dashboard />} />
            
            {/* Pipeline */}
            <Route path="/enquiries" element={<Enquiries />} />
            <Route path="/demos" element={<Demos />} />
            
            {/* Accounts */}
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/accounts/:accountId" element={<AccountDetail />} />
            <Route path="/onboarding" element={<Onboarding />} />
            
            {/* Operations */}
            <Route path="/imports" element={<Imports />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/activation" element={<Activation />} />
            
            {/* Tools */}
            <Route path="/support-actions" element={<SupportActions />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/tickets/:ticketId" element={<Tickets />} />
            <Route path="/tickets/my-queue" element={<Tickets />} />
            <Route path="/tickets/unassigned" element={<Tickets />} />
            <Route path="/tickets/breaching-soon" element={<Tickets />} />
            <Route path="/tickets/breached-today" element={<Tickets />} />
            <Route path="/tickets/new" element={<NewTicket />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/knowledge" element={<Knowledge />} />
            <Route path="/macros" element={<Macros />} />
            <Route path="/reports" element={<Reports />} />
            
            {/* Strategy */}
            <Route path="/playbooks" element={<Playbooks />} />
            <Route path="/technical" element={<TechnicalView />} />
            
            {/* Admin */}
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/queues" element={<AdminQueues />} />
            <Route path="/admin/sla" element={<AdminSLA />} />
            <Route path="/admin/audit" element={<AdminAudit />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
