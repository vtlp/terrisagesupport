import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserProvider } from "@/context/UserContext";
import Dashboard from "@/pages/Dashboard";
import Accounts from "@/pages/Accounts";
import AccountDetail from "@/pages/AccountDetail";
import Enquiries from "@/pages/Enquiries";
import EnquiryDetail from "@/pages/EnquiryDetail";
import EnquiryPipelineDashboard from "@/pages/EnquiryPipelineDashboard";
import Tickets from "@/pages/Tickets";
import Knowledge from "@/pages/Knowledge";
import Marketing from "@/pages/Marketing";
import Reports from "@/pages/Reports";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminQueues from "@/pages/admin/AdminQueues";
import AdminLookups from "@/pages/admin/AdminLookups";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange={false}>
      <UserProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/enquiries" element={<Enquiries />} />
                <Route path="/enquiries/dashboard" element={<EnquiryPipelineDashboard />} />
                <Route path="/enquiries/:enquiryId" element={<EnquiryDetail />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/accounts/:accountId" element={<AccountDetail />} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/tickets/:ticketId" element={<Tickets />} />
                <Route path="/knowledge" element={<Knowledge />} />
                <Route path="/marketing" element={<Marketing />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/queues" element={<AdminQueues />} />
                <Route path="/admin/lookups" element={<AdminLookups />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </UserProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
