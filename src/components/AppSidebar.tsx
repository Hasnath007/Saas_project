import { LayoutDashboard, Building2, Users, Wrench, DollarSign, MessageSquare, TrendingUp, FileText, Settings, Check, Shield, Home } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, Link } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useUserRole } from "@/hooks/useUserRole";

const allItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["admin", "property_manager"] },
  { title: "My Portal", url: "/tenant-portal", icon: Home, roles: ["tenant"] },
  { title: "Properties", url: "/properties", icon: Building2, roles: ["admin", "property_manager"] },
  { title: "Tenants", url: "/tenants", icon: Users, roles: ["admin", "property_manager"] },
  { title: "Maintenance", url: "/maintenance", icon: Wrench, roles: ["admin", "property_manager"] },
  { title: "Financials", url: "/financials", icon: DollarSign, roles: ["admin", "property_manager"] },
  { title: "Communications", url: "/communications", icon: MessageSquare, roles: ["admin", "property_manager", "tenant"] },
  { title: "Analytics", url: "/analytics", icon: TrendingUp, roles: ["admin", "property_manager"] },
  { title: "Reports", url: "/reports", icon: FileText, roles: ["admin", "property_manager"] },
  { title: "Roles & Permissions", url: "/roles", icon: Shield, roles: ["admin"] },
  { title: "Settings", url: "/settings", icon: Settings, roles: ["admin", "property_manager", "tenant"] },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const { role, loading } = useUserRole();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  // Filter items based on user role
  const items = allItems.filter(item => {
    if (loading || !role) return false;
    return item.roles.includes(role);
  });

  // Determine home path based on role
  const homePath = role === "tenant" ? "/tenant-portal" : "/";

  return (
    <Sidebar collapsible="icon">
      {/* Logo */}
      <Link to={homePath} className="flex h-16 items-center gap-2 border-b border-border px-6 hover:opacity-80 transition-opacity">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary flex-shrink-0">
          <Building2 className="h-6 w-6 text-primary-foreground" />
        </div>
        {open && (
          <div className="flex items-center gap-1">
            <h1 className="text-xl font-bold text-foreground">Rentt</h1>
            <div className="flex items-center justify-center w-5 h-5 rounded bg-primary">
              <Check className="h-3 w-3 text-primary-foreground stroke-[3]" />
            </div>
            <span className="text-xl font-bold text-foreground ml-1">AI</span>
          </div>
        )}
      </Link>

      <SidebarContent>
        <SidebarGroup>
          {open && <SidebarGroupLabel>Navigation</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/" || item.url === "/tenant-portal"}
                        className="hover:bg-accent hover:text-accent-foreground"
                        activeClassName="bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                      >
                        <Icon className="h-5 w-5" />
                        {open && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
