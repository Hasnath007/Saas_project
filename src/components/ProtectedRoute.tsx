import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthAndRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setAuthenticated(!!session);
      
      if (session?.user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();
        
        setUserRole(roleData?.role || "property_manager");
      }
      
      setLoading(false);
    };

    checkAuthAndRole();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Clear cache on sign out or sign in to prevent data leakage between users
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
        queryClient.clear();
      }
      setAuthenticated(!!session);
      
      if (session?.user) {
        setTimeout(() => {
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .single()
            .then(({ data }) => {
              setUserRole(data?.role || "property_manager");
            });
        }, 0);
      } else {
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect tenants away from non-tenant pages to their portal
  if (userRole === "tenant") {
    const tenantAllowedPaths = ["/tenant-portal", "/settings", "/communications", "/maintenance/add"];
    const isAllowedPath = tenantAllowedPaths.some(
      path => location.pathname === path || location.pathname.startsWith(path + "/")
    );
    
    if (!isAllowedPath) {
      return <Navigate to="/tenant-portal" replace />;
    }
  }

  return <>{children}</>;
};