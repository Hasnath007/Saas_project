import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Wrench, CheckCircle2, Clock, Plus, Edit, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import React, { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AssignWorkDialog } from "@/components/AssignWorkDialog";

const Maintenance = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "work-orders";
  
  const [assignWorkOpen, setAssignWorkOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<{ id: string; name: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Fetch maintenance requests from database with tenant and vendor info
  const { data: maintenanceRequests = [] } = useQuery({
    queryKey: ["maintenance-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_requests")
        .select(`
          *,
          properties:property_id (name, address, city, property_type),
          units:unit_id (unit_number, current_tenant),
          vendors:vendor_id (name, company_name)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return data || [];
    },
  });

  // Helper function to check if request is overdue
  const isOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate || status === "completed") return false;
    return new Date(dueDate) < new Date();
  };

  // Calculate stats with urgent being overdue requests
  const pendingCount = maintenanceRequests.filter(r => r.status === "pending").length;
  const inProgressCount = maintenanceRequests.filter(r => r.status === "in_progress").length;
  const completedCount = maintenanceRequests.filter(r => r.status === "completed").length;
  const urgentCount = maintenanceRequests.filter(r => isOverdue(r.due_date, r.status)).length;

  // Filter maintenance requests based on status filter
  const filteredMaintenanceRequests = statusFilter 
    ? statusFilter === "urgent"
      ? maintenanceRequests.filter(r => isOverdue(r.due_date, r.status))
      : maintenanceRequests.filter(r => r.status === statusFilter)
    : maintenanceRequests;

  const handleStatusCardClick = (status: string) => {
    setStatusFilter(statusFilter === status ? null : status);
  };

  // Helper to notify tenant of maintenance updates
  const notifyTenantUpdate = async (requestId: string, updateType: string, extra?: Record<string, string>) => {
    try {
      await supabase.functions.invoke("notify-maintenance-update", {
        body: { requestId, updateType, ...extra },
      });
    } catch (err) {
      console.error("Failed to send tenant notification:", err);
    }
  };

  // Mutation to update status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, unitId }: { id: string; status: string; unitId?: string | null }) => {
      const { error } = await supabase
        .from("maintenance_requests")
        .update({ status })
        .eq("id", id);
      
      if (error) throw error;

      // Update unit status to "occupied" when maintenance is completed
      if (status === "completed" && unitId) {
        const { error: unitError } = await supabase
          .from("units")
          .update({ status: "occupied" })
          .eq("id", unitId);
        
        if (unitError) throw unitError;
      }

      // Notify tenant about status change
      await notifyTenantUpdate(id, "status_change", { newStatus: status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-requests"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      toast.success("Status updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update status");
      console.error(error);
    },
  });

  // Mutation to assign vendor
  const assignVendorMutation = useMutation({
    mutationFn: async ({ requestId, vendorId, vendorName }: { requestId: string; vendorId: string | null; vendorName?: string }) => {
      const { error } = await supabase
        .from("maintenance_requests")
        .update({ 
          vendor_id: vendorId,
          assigned_at: vendorId ? new Date().toISOString() : null
        })
        .eq("id", requestId);
      
      if (error) throw error;

      // Notify tenant about vendor assignment
      if (vendorId) {
        await notifyTenantUpdate(requestId, "vendor_assigned", { vendorName: vendorName || "A vendor" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-requests"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor assigned successfully");
    },
    onError: (error) => {
      toast.error("Failed to assign vendor");
      console.error(error);
    },
  });

  // Mutation to delete maintenance request
  const deleteRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("maintenance_requests")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-requests"] });
      toast.success("Request deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete request");
      console.error(error);
    },
  });

  // Fetch vendors from database with their assigned maintenance requests
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .order("name");
      
      if (error) throw error;
      
      // Fetch assigned work orders for each vendor
      const vendorsWithWorks = await Promise.all(
        (data || []).map(async (vendor) => {
          const { data: works } = await supabase
            .from("maintenance_requests")
            .select(`
              id,
              title,
              status,
              priority,
              due_date,
              properties:property_id (name),
              units:unit_id (unit_number)
            `)
            .eq("vendor_id", vendor.id)
            .order("created_at", { ascending: false });
          
          return { ...vendor, assignedWorks: works || [] };
        })
      );
      
      return vendorsWithWorks;
    },
  });

  // Filter vendors based on status filter (show vendors with assigned works matching the status)
  const filteredVendors = statusFilter
    ? vendors.filter(vendor => 
        vendor.assignedWorks?.some((work: any) => 
          statusFilter === "urgent"
            ? isOverdue(work.due_date, work.status)
            : work.status === statusFilter
        )
      )
    : vendors;

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Maintenance Management</h1>
            <p className="text-muted-foreground">Streamline work orders, vendor relationships, and preventive maintenance</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/reports")}>Export Report</Button>
            <Button variant="outline" onClick={() => navigate("/settings")}>Settings</Button>
            <Button className="gap-2" onClick={() => navigate("/maintenance/add")}>
              <Plus className="h-4 w-4" />
              New Request
            </Button>
          </div>
        </div>

        {/* Alert */}
        {urgentCount > 0 && (
          <Alert className="mb-6 border-warning bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-foreground">
              <span className="font-semibold">Attention Required:</span> {urgentCount} urgent {urgentCount === 1 ? 'item needs' : 'items need'} immediate attention.
              <Button variant="link" className="ml-2 h-auto p-0 text-primary" onClick={() => setStatusFilter("urgent")}>View All</Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${
              statusFilter === "pending" ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => handleStatusCardClick("pending")}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wrench className="h-5 w-5 text-primary" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">{pendingCount}</h3>
              <p className="text-sm text-muted-foreground">Pending</p>
              <Badge variant="outline" className="mt-2 bg-success/10 text-success border-success/20">{pendingCount} Pending</Badge>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${
              statusFilter === "in_progress" ? "ring-2 ring-warning" : ""
            }`}
            onClick={() => handleStatusCardClick("in_progress")}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">{inProgressCount}</h3>
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-xs text-muted-foreground mt-2">Active work orders</p>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${
              statusFilter === "completed" ? "ring-2 ring-success" : ""
            }`}
            onClick={() => handleStatusCardClick("completed")}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-success/10">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">{completedCount}</h3>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-xs text-muted-foreground mt-2">Total completed</p>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-destructive/20 ${
              statusFilter === "urgent" ? "ring-2 ring-destructive" : ""
            }`}
            onClick={() => handleStatusCardClick("urgent")}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1 text-destructive">{urgentCount}</h3>
              <p className="text-sm text-muted-foreground">Urgent</p>
              <p className="text-xs text-muted-foreground mt-2">High priority items</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={defaultTab} className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="work-orders">Work Orders</TabsTrigger>
              <TabsTrigger value="preventive">Preventive Maintenance</TabsTrigger>
              <TabsTrigger value="vendors">Vendor Directory</TabsTrigger>
            </TabsList>
            {statusFilter && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-sm">
                  Filtered by: {statusFilter === "in_progress" ? "In Progress" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                </Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setStatusFilter(null)}
                >
                  Clear Filter
                </Button>
              </div>
            )}
          </div>

          <TabsContent value="work-orders" className="mt-6">
            {filteredMaintenanceRequests.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">
                    {statusFilter ? "No maintenance requests found" : "No maintenance requests yet"}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {statusFilter 
                      ? `No maintenance requests match the "${statusFilter}" filter`
                      : "Create your first maintenance request to get started"
                    }
                  </p>
                  {statusFilter ? (
                    <Button onClick={() => setStatusFilter(null)}>
                      Clear Filter
                    </Button>
                  ) : (
                    <Button onClick={() => navigate("/maintenance/add")}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Request
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredMaintenanceRequests.map((request) => {
                  const overdue = isOverdue(request.due_date, request.status);
                  const tenantName = request.units?.current_tenant;
                  
                  return (
                    <Card key={request.id}>
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="text-3xl">🔧</div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-lg">{request.title}</h3>
                                  <Badge 
                                    variant="outline" 
                                    className={
                                      request.priority === "high" 
                                        ? "bg-destructive/10 text-destructive border-destructive/20" 
                                        : request.priority === "medium"
                                        ? "bg-warning/10 text-warning border-warning/20"
                                        : "bg-success/10 text-success border-success/20"
                                    }
                                  >
                                    {request.priority}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mb-4">{request.description}</p>
                              </div>
                              <Select
                                value={request.status}
                                onValueChange={(value) => {
                                  updateStatusMutation.mutate({ id: request.id, status: value, unitId: request.unit_id });
                                }}
                              >
                                <SelectTrigger 
                                  className={`w-[140px] ${
                                    overdue
                                      ? "bg-destructive text-destructive-foreground border-destructive"
                                      : request.status === "pending"
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : request.status === "in_progress"
                                      ? "bg-warning text-warning-foreground border-warning"
                                      : "bg-chart-3 text-chart-3-foreground border-chart-3"
                                  }`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="grid grid-cols-4 gap-6 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Property</p>
                                <p className="font-medium">{request.properties?.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {request.properties?.property_type}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Tenant</p>
                                <p className="font-medium">
                                  {tenantName || "N/A"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {request.units ? `Unit ${request.units.unit_number}` : "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Assigned To</p>
                                <p className="font-medium">
                                  {request.vendors?.name || "Unassigned"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {request.vendors?.company_name || "No vendor assigned"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Timeline</p>
                                <p className="text-xs text-muted-foreground">
                                  Created: {new Date(request.created_at).toLocaleDateString()}
                                </p>
                                {request.due_date && (
                                  <p className={`text-sm font-semibold mt-1 ${overdue ? 'text-destructive' : 'text-destructive'}`}>
                                    Due: {new Date(request.due_date).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Vendor Assignment Section */}
                            <div className="mt-4 p-3 bg-muted/50 border rounded-md">
                              <div className="flex items-center gap-4">
                                <div className="flex-1">
                                  <p className="text-xs text-muted-foreground mb-1">Assign Vendor</p>
                                  <Select
                                    value={request.vendor_id || "unassigned"}
                                    onValueChange={(value) => {
                                      const selectedVendorObj = vendors.find(v => v.id === value);
                                      assignVendorMutation.mutate({ 
                                        requestId: request.id, 
                                        vendorId: value === "unassigned" ? null : value,
                                        vendorName: selectedVendorObj?.name
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="w-full max-w-xs">
                                      <SelectValue placeholder="Select a vendor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unassigned">Unassigned</SelectItem>
                                      {vendors.map((vendor) => (
                                        <SelectItem key={vendor.id} value={vendor.id}>
                                          {vendor.name} {vendor.company_name ? `(${vendor.company_name})` : ""}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                {request.assigned_at && (
                                  <p className="text-xs text-muted-foreground">
                                    Assigned on: {new Date(request.assigned_at).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>

                            {overdue && (
                              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                                <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                                  <AlertTriangle className="h-4 w-4" />
                                  Overdue by {Math.floor((new Date().getTime() - new Date(request.due_date!).getTime()) / (1000 * 60 * 60 * 24))} days
                                </div>
                              </div>
                            )}

                            <div className="mt-4 flex justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => navigate(`/maintenance/edit/${request.id}`)}
                                className="gap-2"
                              >
                                <Edit className="h-4 w-4" />
                                Edit Order
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this maintenance request?")) {
                                    deleteRequestMutation.mutate(request.id);
                                  }
                                }}
                                className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="preventive" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-1">Work Order Efficiency</h3>
                  <p className="text-sm text-muted-foreground mb-4">Average completion time</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold">4.2 days</p>
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20">12% improvement</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-1">Vendor Performance</h3>
                  <p className="text-sm text-muted-foreground mb-4">Average satisfaction rating</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold">4.7/5</p>
                    <p className="text-sm text-muted-foreground">Based on tenant feedback</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-4">Preventive Maintenance Schedule</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-semibold">HVAC Filter Replacement</h4>
                      <p className="text-sm text-muted-foreground">Quarterly maintenance • All properties</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Next: Dec 15, 2024</p>
                      <p className="text-xs text-muted-foreground">12 units scheduled</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-semibold">Fire Alarm Testing</h4>
                      <p className="text-sm text-muted-foreground">Annual inspection • Multi-family properties</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Next: Jan 20, 2025</p>
                      <p className="text-xs text-muted-foreground">3 properties</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-semibold">Gutter Cleaning</h4>
                      <p className="text-sm text-muted-foreground">Bi-annual • All properties</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Next: Feb 1, 2025</p>
                      <p className="text-xs text-muted-foreground">24 properties</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <Button variant="outline" className="w-full">Add Preventive Maintenance Task</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendors" className="mt-6">
            <div className="space-y-4">
              {filteredVendors.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">
                      {statusFilter ? "No vendors found" : "No vendors yet"}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {statusFilter
                        ? `No vendors have assigned work matching the "${statusFilter}" filter`
                        : "Add your first vendor to start managing service providers"
                      }
                    </p>
                    {statusFilter ? (
                      <Button onClick={() => setStatusFilter(null)}>
                        Clear Filter
                      </Button>
                    ) : (
                      <Button onClick={() => navigate("/vendors/add")}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Vendor
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <>
                  {filteredVendors.map((vendor) => (
                    <Card key={vendor.id}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-semibold text-lg">
                              {vendor.company_name || vendor.name}
                            </h3>
                            <p className="text-sm text-muted-foreground">{vendor.service_type}</p>
                          </div>
                          {vendor.is_preferred && (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                              Preferred
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Contact</p>
                            <p className="font-medium">{vendor.contact_phone}</p>
                            {vendor.contact_email && (
                              <p className="text-xs text-muted-foreground">{vendor.contact_email}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-muted-foreground">Rating</p>
                            <p className="font-medium">{vendor.rating}/5.0</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Jobs Completed</p>
                            <p className="font-medium">{vendor.jobs_completed}</p>
                          </div>
                        </div>

                        {/* Assigned Works Section */}
                        {vendor.assignedWorks && vendor.assignedWorks.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
                              Assigned Work Orders ({statusFilter 
                                ? vendor.assignedWorks.filter((work: any) => 
                                    statusFilter === "urgent"
                                      ? isOverdue(work.due_date, work.status)
                                      : work.status === statusFilter
                                  ).length 
                                : vendor.assignedWorks.length})
                            </h4>
                            <div className="space-y-2">
                              {(statusFilter 
                                ? vendor.assignedWorks.filter((work: any) => 
                                    statusFilter === "urgent"
                                      ? isOverdue(work.due_date, work.status)
                                      : work.status === statusFilter
                                  )
                                : vendor.assignedWorks
                              ).map((work: any) => (
                                <div 
                                  key={work.id} 
                                  className="p-3 bg-muted/50 rounded-lg border hover:bg-muted transition-colors"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <p className="font-medium text-sm">{work.title}</p>
                                        <Badge 
                                          variant="outline" 
                                          className={`text-xs ${
                                            work.status === "pending" 
                                              ? "bg-primary/10 text-primary border-primary/20"
                                              : work.status === "in_progress"
                                              ? "bg-warning/10 text-warning border-warning/20"
                                              : "bg-success/10 text-success border-success/20"
                                          }`}
                                        >
                                          {work.status.replace("_", " ")}
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {work.properties?.name} • {work.units ? `Unit ${work.units.unit_number}` : 'General'}
                                      </p>
                                    </div>
                                    {work.due_date && (
                                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                                        Due: {new Date(work.due_date).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 mt-4">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/vendors/view/${vendor.id}`)}
                          >
                            View Profile
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedVendor({ 
                                id: vendor.id, 
                                name: vendor.company_name || vendor.name 
                              });
                              setAssignWorkOpen(true);
                            }}
                          >
                            Assign Work
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}

              <Button 
                className="w-full" 
                size="lg"
                onClick={() => navigate("/vendors/add")}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Vendor
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Assign Work Dialog */}
      {selectedVendor && (
        <AssignWorkDialog
          open={assignWorkOpen}
          onOpenChange={setAssignWorkOpen}
          vendorId={selectedVendor.id}
          vendorName={selectedVendor.name}
        />
      )}
    </DashboardLayout>
  );
};

export default Maintenance;
