import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
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
            <Route path="/" element={<Dashboard />} />
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
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/queues" element={<AdminQueues />} />
            <Route path="/admin/sla" element={<AdminSLA />} />
            <Route path="/admin/audit" element={<AdminAudit />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
