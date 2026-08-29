import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "property_manager" | "tenant";

interface UserRoleState {
  role: AppRole | null;
  loading: boolean;
  userId: string | null;
}

export const useUserRole = () => {
  const [state, setState] = useState<UserRoleState>({
    role: null,
    loading: true,
    userId: null,
  });

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setState({ role: null, loading: false, userId: null });
          return;
        }

        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (error) {
          // If no role exists, default to property_manager
          if (error.code === "PGRST116") {
            setState({ role: "property_manager", loading: false, userId: user.id });
            return;
          }
          console.error("Error fetching user role:", error);
          setState({ role: "property_manager", loading: false, userId: user.id });
          return;
        }

        setState({ 
          role: data.role as AppRole, 
          loading: false, 
          userId: user.id 
        });
      } catch (err) {
        console.error("Error in useUserRole:", err);
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    fetchUserRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = state.role === "admin";
  const isPropertyManager = state.role === "property_manager";
  const isTenant = state.role === "tenant";

  const canAccessPage = (page: string): boolean => {
    if (state.loading || !state.role) return false;

    const adminPages = [
      "/", "/properties", "/tenants", "/maintenance", "/financials", 
      "/communications", "/analytics", "/reports", "/settings", "/roles"
    ];
    
    const propertyManagerPages = [
      "/", "/properties", "/tenants", "/maintenance", "/financials", 
      "/communications", "/analytics", "/reports", "/settings"
    ];
    
    const tenantPages = ["/tenant-portal", "/settings", "/communications", "/maintenance/add"];

    switch (state.role) {
      case "admin":
        return adminPages.some(p => page === p || page.startsWith(p + "/"));
      case "property_manager":
        return propertyManagerPages.some(p => page === p || page.startsWith(p + "/"));
      case "tenant":
        return tenantPages.some(p => page === p || page.startsWith(p + "/"));
      default:
        return false;
    }
  };

  return {
    ...state,
    isAdmin,
    isPropertyManager,
    isTenant,
    canAccessPage,
  };
};
