import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import Pricing from "./pages/Pricing";

import Properties from "./pages/Properties";
import AddProperty from "./pages/AddProperty";
import PropertyDetail from "./pages/PropertyDetail";
import PropertyEdit from "./pages/PropertyEdit";
import UnitEdit from "./pages/UnitEdit";
import Tenants from "./pages/Tenants";
import AddTenant from "./pages/AddTenant";
import TenantDetail from "./pages/TenantDetail";
import TenantEdit from "./pages/TenantEdit";
import Maintenance from "./pages/Maintenance";
import AddMaintenanceRequest from "./pages/AddMaintenanceRequest";
import AddVendor from "./pages/AddVendor";
import Financials from "./pages/Financials";
import AuditTrail from "./pages/AuditTrail";
import Communications from "./pages/Communications";
import Analytics from "./pages/Analytics";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import RolesAndPermissions from "./pages/RolesAndPermissions";
import TenantPortal from "./pages/TenantPortal";
import R2Test from "./pages/R2Test";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            {/* Public routes */}
            <Route path="/home" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/pricing" element={<Pricing />} />
            
            
            {/* Protected routes */}
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/properties" element={<ProtectedRoute><Properties /></ProtectedRoute>} />
            <Route path="/properties/add" element={<ProtectedRoute><AddProperty /></ProtectedRoute>} />
            <Route path="/properties/:id" element={<ProtectedRoute><PropertyDetail /></ProtectedRoute>} />
            <Route path="/properties/:id/edit" element={<ProtectedRoute><PropertyEdit /></ProtectedRoute>} />
            <Route path="/units/:id/edit" element={<ProtectedRoute><UnitEdit /></ProtectedRoute>} />
            <Route path="/tenants" element={<ProtectedRoute><Tenants /></ProtectedRoute>} />
            <Route path="/add-tenant" element={<ProtectedRoute><AddTenant /></ProtectedRoute>} />
            <Route path="/tenants/:id" element={<ProtectedRoute><TenantDetail /></ProtectedRoute>} />
            <Route path="/tenants/:id/edit" element={<ProtectedRoute><TenantEdit /></ProtectedRoute>} />
            <Route path="/maintenance" element={<ProtectedRoute><Maintenance /></ProtectedRoute>} />
            <Route path="/maintenance/add" element={<ProtectedRoute><AddMaintenanceRequest /></ProtectedRoute>} />
            <Route path="/maintenance/edit/:id" element={<ProtectedRoute><AddMaintenanceRequest /></ProtectedRoute>} />
            <Route path="/vendors/add" element={<ProtectedRoute><AddVendor /></ProtectedRoute>} />
            <Route path="/vendors/edit/:id" element={<ProtectedRoute><AddVendor /></ProtectedRoute>} />
            <Route path="/vendors/view/:id" element={<ProtectedRoute><AddVendor /></ProtectedRoute>} />
            <Route path="/financials" element={<ProtectedRoute><Financials /></ProtectedRoute>} />
            <Route path="/financials/audit-trail" element={<ProtectedRoute><AuditTrail /></ProtectedRoute>} />
            <Route path="/communications" element={<ProtectedRoute><Communications /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/roles" element={<ProtectedRoute><RolesAndPermissions /></ProtectedRoute>} />
            <Route path="/tenant-portal" element={<ProtectedRoute><TenantPortal /></ProtectedRoute>} />
            <Route path="/r2-test" element={<R2Test />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

