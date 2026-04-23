import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserProvider } from "@/context/UserContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { preloadAllLookups } from "@/hooks/useLookups";
import Auth from "@/pages/Auth";
import OnboardingForm from "@/pages/OnboardingForm";
import AgencyOnboarding from "@/pages/onboarding/AgencyOnboarding";
import BuilderOnboarding from "@/pages/onboarding/BuilderOnboarding";
import OnboardingSuccess from "@/pages/onboarding/OnboardingSuccess";
import Dashboard from "@/pages/Dashboard";
import Accounts from "@/pages/Accounts";
import AccountDetail from "@/pages/AccountDetail";
import Enquiries from "@/pages/Enquiries";
import EnquiryDetail from "@/pages/EnquiryDetail";
import EnquiryPipelineDashboard from "@/pages/EnquiryPipelineDashboard";
import CalendarPage from "@/pages/CalendarPage";
import Tickets from "@/pages/Tickets";
import Knowledge from "@/pages/Knowledge";
import Marketing from "@/pages/Marketing";
import Reports from "@/pages/Reports";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminQueues from "@/pages/admin/AdminQueues";
import AdminLookups from "@/pages/admin/AdminLookups";
import AdminIntegrations from "@/pages/admin/AdminIntegrations";
import AdminCrmSyncContract from "@/pages/admin/AdminCrmSyncContract";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  // Honour "Stay signed in": if user opted out and the tab was fully closed,
  // sign out on next boot. sessionStorage clears on tab close; localStorage persists.
  useEffect(() => {
    const persist = localStorage.getItem('session_persist');
    const alive = sessionStorage.getItem('session_alive');
    if (persist === '0' && !alive) {
      supabase.auth.signOut();
      localStorage.removeItem('session_persist');
    }
    sessionStorage.setItem('session_alive', '1');
    // Hydrate global lookup cache + start realtime once at app boot
    preloadAllLookups();
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange={false}>
      <BrowserRouter>
        <UserProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Routes>
              {/* Public routes */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/onboarding/agency" element={<AgencyOnboarding />} />
              <Route path="/onboarding/builder" element={<BuilderOnboarding />} />
              <Route path="/onboarding/agency/success" element={<OnboardingSuccess />} />
              <Route path="/onboarding/builder/success" element={<OnboardingSuccess />} />
              <Route path="/onboarding/:tenancy" element={<OnboardingForm />} />

              {/* Protected app */}
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/enquiries" element={<Enquiries />} />
                <Route path="/enquiries/dashboard" element={<EnquiryPipelineDashboard />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/enquiries/:enquiryId" element={<EnquiryDetail />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/accounts/:accountId" element={<AccountDetail />} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/tickets/:ticketId" element={<Tickets />} />
                <Route path="/knowledge" element={<Knowledge />} />
                <Route path="/marketing" element={<Marketing />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
                <Route path="/admin/queues" element={<ProtectedRoute adminOnly><AdminQueues /></ProtectedRoute>} />
                <Route path="/admin/lookups" element={<ProtectedRoute adminOnly><AdminLookups /></ProtectedRoute>} />
                <Route path="/admin/integrations" element={<ProtectedRoute adminOnly><AdminIntegrations /></ProtectedRoute>} />
                <Route path="/admin/crm-sync-contract" element={<ProtectedRoute adminOnly><AdminCrmSyncContract /></ProtectedRoute>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </UserProvider>
      </BrowserRouter>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;
