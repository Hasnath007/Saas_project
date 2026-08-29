import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Shield, Users, Search, Key, UserCog, RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";

interface UserWithRole {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: AppRole;
  created_at: string;
}

const RolesAndPermissions = () => {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<AppRole>("property_manager");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Redirect non-admins
  if (!roleLoading && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Fetch all users with their roles using edge function
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-list-users`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch users");
      }
      
      return result.users as UserWithRole[];
    },
    enabled: isAdmin,
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("User role updated successfully");
      setIsRoleDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update role");
    },
  });

  // Reset password mutation (using edge function)
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ targetUserId: userId, newPassword: password }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to reset password");
      }
      return result;
    },
    onSuccess: () => {
      toast.success("Password reset successfully");
      setIsPasswordDialogOpen(false);
      setNewPassword("");
      setConfirmPassword("");
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reset password");
    },
  });

  // Delete user mutation (using edge function)
  const deleteUserMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ targetUserId: userId }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to delete user");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("User deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete user");
    },
  });

  const handleRoleChange = () => {
    if (selectedUser) {
      updateRoleMutation.mutate({ userId: selectedUser.user_id, role: newRole });
    }
  };

  const handlePasswordReset = () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (selectedUser) {
      resetPasswordMutation.mutate({ userId: selectedUser.user_id, password: newPassword });
    }

  };

  const openRoleDialog = (user: UserWithRole) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setIsRoleDialogOpen(true);
  };

  const openPasswordDialog = (user: UserWithRole) => {
    setSelectedUser(user);
    setNewPassword("");
    setConfirmPassword("");
    setIsPasswordDialogOpen(true);
  };

  const openDeleteDialog = (user: UserWithRole) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteUser = () => {
    if (selectedUser) {
      deleteUserMutation.mutate({ userId: selectedUser.user_id });
    }
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "property_manager":
        return "default";
      case "tenant":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRoleDisplayName = (role: AppRole) => {
    switch (role) {
      case "admin":
        return "Admin";
      case "property_manager":
        return "Property Manager";
      case "tenant":
        return "Tenant";
      default:
        return role;
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      (user.first_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (user.last_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Roles & Permissions</h1>
          </div>
          <p className="text-muted-foreground">Manage user roles and access permissions across the platform</p>
        </div>

        {/* Role Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Admins</CardTitle>
              <Shield className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.role === "admin").length}
              </div>
              <p className="text-xs text-muted-foreground">Full system access</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Property Managers</CardTitle>
              <UserCog className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.role === "property_manager").length}
              </div>
              <p className="text-xs text-muted-foreground">Manage own properties</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tenants</CardTitle>
              <Users className="h-4 w-4 text-secondary-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.role === "tenant").length}
              </div>
              <p className="text-xs text-muted-foreground">Limited portal access</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="property_manager">Property Manager</SelectItem>
                  <SelectItem value="tenant">Tenant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading users...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No users found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.first_name && user.last_name 
                          ? `${user.first_name} ${user.last_name}` 
                          : "N/A"}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {getRoleDisplayName(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRoleDialog(user)}
                            className="gap-1"
                          >
                            <UserCog className="h-3 w-3" />
                            Role
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPasswordDialog(user)}
                            className="gap-1"
                          >
                            <Key className="h-3 w-3" />
                            Password
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(user)}
                            className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Role Change Dialog */}
        <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
          <DialogContent className="bg-background">
            <DialogHeader>
              <DialogTitle>Change User Role</DialogTitle>
              <DialogDescription>
                Update the role for {selectedUser?.first_name} {selectedUser?.last_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>New Role</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="admin">Admin - Full system access</SelectItem>
                    <SelectItem value="property_manager">Property Manager - Manage own properties</SelectItem>
                    <SelectItem value="tenant">Tenant - Limited portal access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleRoleChange}
                disabled={updateRoleMutation.isPending}
              >
                {updateRoleMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Role"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Password Reset Dialog */}
        <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
          <DialogContent className="bg-background">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Set a new password for {selectedUser?.first_name} {selectedUser?.last_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handlePasswordReset}
                disabled={resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete User Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="bg-background">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Delete User
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete{" "}
                <span className="font-semibold">
                  {selectedUser?.first_name} {selectedUser?.last_name}
                </span>
                ? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive">
                  Warning: All data associated with this user will be permanently deleted, including:
                </p>
                <ul className="text-sm text-destructive mt-2 list-disc list-inside">
                  <li>User profile and settings</li>
                  <li>Role assignments</li>
                  <li>Associated records and permissions</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDeleteUser}
                disabled={deleteUserMutation.isPending}
              >
                {deleteUserMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Yes, Delete User
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default RolesAndPermissions;
