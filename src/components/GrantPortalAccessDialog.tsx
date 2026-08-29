import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff } from "lucide-react";

interface GrantPortalAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantEmail: string;
  tenantName: string;
  tenantId: string;
  propertyName?: string;
  propertyAddress?: string;
}

export function GrantPortalAccessDialog({
  open,
  onOpenChange,
  tenantEmail,
  tenantName,
  tenantId,
  propertyName,
  propertyAddress,
}: GrantPortalAccessDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email: tenantEmail,
    password: "",
    confirmPassword: "",
  });

  // Update email when tenantEmail prop changes
  useEffect(() => {
    setForm(prev => ({ ...prev, email: tenantEmail }));
  }, [tenantEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    if (form.password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Call edge function to create user without affecting current session
      const { data, error } = await supabase.functions.invoke("create-tenant-user", {
        body: {
          email: form.email,
          password: form.password,
          firstName: tenantName.split(" ")[0] || "",
          lastName: tenantName.split(" ").slice(1).join(" ") || "",
          propertyName: propertyName || "",
          propertyAddress: propertyAddress || "",
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Portal access granted",
        description: `An account has been created for ${form.email}. The tenant can now log in to access their portal.`,
      });

      onOpenChange(false);
      setForm({ email: tenantEmail, password: "", confirmPassword: "" });
    } catch (error: any) {
      console.error("Error creating tenant account:", error);
      toast({
        title: "Failed to grant portal access",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Grant Portal Access</DialogTitle>
          <DialogDescription>
            Create a login account for {tenantName} to access the tenant portal.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email / Username</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="tenant@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter password"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                placeholder="Confirm password"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
