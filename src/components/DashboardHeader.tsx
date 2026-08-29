import { Search, Bell, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export const DashboardHeader = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userName, setUserName] = useState<string>("");

  // Fetch user profile
  const { data: profile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Get the full avatar URL from Supabase Storage
  const avatarUrl = profile?.avatar_url 
    ? supabase.storage.from("profile-pictures").getPublicUrl(profile.avatar_url).data.publicUrl
    : null;

  useEffect(() => {
    if (profile?.first_name) {
      setUserName(profile.first_name);
    }
  }, [profile]);

  const handleLogout = async () => {
    try {
      // Clear all cached queries before logout
      queryClient.clear();
      
      await supabase.auth.signOut();
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
      navigate("/login");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    return "U";
  };

  return (
    <header className="fixed left-64 right-0 top-0 z-10 h-16 border-b border-border bg-card">
      <div className="flex h-full items-center justify-between px-8">
        {/* Search */}
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search properties, tenants... (⌘K)"
              className="pl-10 bg-background"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative" 
            onClick={() => navigate("/communications")}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
              3
            </span>
          </Button>
          
          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 h-auto py-2">
                <Avatar className="h-8 w-8">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={userName} />
                  ) : null}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">
                  Welcome! {userName || "User"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 z-50 bg-popover">
              <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
