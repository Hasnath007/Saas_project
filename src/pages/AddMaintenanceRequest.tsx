import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ArrowLeft, Check, ChevronsUpDown } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { getEffectiveUnitStatus } from "@/lib/unitStatus";
const AddMaintenanceRequest = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const isEditMode = !!id;
  const { isTenant, userId, loading: roleLoading } = useUserRole();
  
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");

  // Fetch tenant info if user is a tenant
  const { data: tenantInfo } = useQuery({
    queryKey: ["tenant-info-for-maintenance", userId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return null;
      
      const { data, error } = await supabase
        .from("tenants")
        .select(`
          id,
          name,
          property_id,
          unit_id,
          property:properties(id, name, address, city),
          unit:units(id, unit_number, status)
        `)
        .eq("email", user.email)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: isTenant,
  });

  // Auto-fill property and unit for tenants
  useEffect(() => {
    if (isTenant && tenantInfo && !isEditMode) {
      if (tenantInfo.property_id) {
        setSelectedProperty(tenantInfo.property_id);
      }
      if (tenantInfo.unit_id) {
        setSelectedUnit(tenantInfo.unit_id);
      }
    }
  }, [isTenant, tenantInfo, isEditMode]);

  // Fetch existing request if editing
  const { data: existingRequest } = useQuery({
    queryKey: ["maintenance-request", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("maintenance_requests")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: isEditMode,
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (existingRequest) {
      setSelectedProperty(existingRequest.property_id);
      setSelectedUnit(existingRequest.unit_id || "");
      setTitle(existingRequest.title);
      setDescription(existingRequest.description);
      setPriority(existingRequest.priority);
      setDueDate(existingRequest.due_date || "");
    }
  }, [existingRequest]);

  // Fetch properties from database (only for non-tenants)
  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data;
    },
    enabled: !isTenant,
  });

  // Fetch units for selected property (only for non-tenants)
  const { data: units = [] } = useQuery({
    queryKey: ["units", selectedProperty],
    queryFn: async () => {
      if (!selectedProperty) return [];
      
      const { data, error } = await supabase
        .from("units")
        .select("*")
        .eq("property_id", selectedProperty)
        .order("unit_number");
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProperty && !isTenant,
  });

  const selectedPropertyData = properties.find(p => p.id === selectedProperty);
  const selectedUnitData = units.find(u => u.id === selectedUnit);
  
  // Get current tenant name from the selected unit
  const currentTenantName = selectedUnitData?.current_tenant || null;

  // For tenants, use their property and unit info directly
  const tenantPropertyData = tenantInfo?.property as { id: string; name: string; address: string; city: string } | null;
  const tenantUnitData = tenantInfo?.unit as { id: string; unit_number: string; status: string } | null;

  const backPath = isTenant ? "/tenant-portal" : "/maintenance";

  // Create or update maintenance request mutation
  const saveRequestMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const requestData = {
        user_id: user.id,
        property_id: selectedProperty,
        unit_id: selectedUnit || null,
        title,
        description,
        priority,
        due_date: dueDate || null,
      };

      if (isEditMode) {
        const { error } = await supabase
          .from("maintenance_requests")
          .update(requestData)
          .eq("id", id);
        
        if (error) throw error;

        // Notify tenant about the edit (only for property managers)
        if (!isTenant) {
          try {
            await supabase.functions.invoke("notify-maintenance-update", {
              body: { requestId: id, updateType: "edited" },
            });
          } catch (err) {
            console.error("Failed to send edit notification:", err);
          }
        }
      } else {
        const { error } = await supabase
          .from("maintenance_requests")
          .insert(requestData);

        if (error) throw error;

        // Update unit status to "repairs" when creating a new maintenance request (only for property managers)
        if (selectedUnit && !isTenant) {
          const { error: unitError } = await supabase
            .from("units")
            .update({ status: "repairs" })
            .eq("id", selectedUnit);
          
          if (unitError) throw unitError;
        }

        // Send notification email to property manager (for tenant submissions)
        if (isTenant) {
          try {
            const propName = tenantPropertyData?.name || "";
            const unitNum = tenantUnitData?.unit_number || "";
            const tName = tenantInfo?.name || user.email || "";

            await supabase.functions.invoke("notify-maintenance", {
              body: {
                title,
                description,
                priority,
                propertyName: propName,
                unitNumber: unitNum,
                tenantName: tName,
              },
            });
          } catch (notifyErr) {
            console.error("Failed to send maintenance notification:", notifyErr);
            // Don't fail the request if notification fails
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-requests"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-messages"] });
      toast.success(`Maintenance request ${isEditMode ? 'updated' : 'submitted'} successfully`);
      navigate(backPath);
    },
    onError: (error: Error) => {
      toast.error(`Failed to ${isEditMode ? 'update' : 'submit'} request: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    if (!selectedProperty || !title || !description) {
      toast.error("Please fill in all required fields");
      return;
    }
    saveRequestMutation.mutate();
  };

  // Show loading while role is being determined
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
      <div className="p-8 max-w-4xl mx-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-6 gap-2"
          onClick={() => navigate(backPath)}
        >
          <ArrowLeft className="h-4 w-4" />
          {isTenant ? "Back to Portal" : "Back to Maintenance"}
        </Button>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>{isEditMode ? 'Edit Maintenance Request' : 'New Maintenance Request'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Property - Show as read-only for tenants */}
            {isTenant ? (
              <>
                <div className="space-y-2">
                  <Label>Property</Label>
                  <div className="p-3 border rounded-md bg-muted/50">
                    {tenantPropertyData ? (
                      <div>
                        <p className="font-medium">{tenantPropertyData.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {tenantPropertyData.address}, {tenantPropertyData.city}
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Loading...</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Unit</Label>
                  <div className="p-3 border rounded-md bg-muted/50">
                    {tenantUnitData ? (
                      <p className="font-medium">Unit {tenantUnitData.unit_number}</p>
                    ) : (
                      <p className="text-muted-foreground">Loading...</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Property Combobox for property managers */}
                <div className="space-y-2">
                  <Label htmlFor="property">Property *</Label>
                  <Popover open={propertyOpen} onOpenChange={setPropertyOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={propertyOpen}
                        className="w-full justify-between"
                      >
                        {selectedPropertyData ? (
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{selectedPropertyData.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {selectedPropertyData.address}, {selectedPropertyData.city}
                            </span>
                          </div>
                        ) : (
                          "Search by property name, address, or city..."
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[600px] p-0 z-50 bg-popover">
                      <Command>
                        <CommandInput placeholder="Type to search properties..." />
                        <CommandList>
                          <CommandEmpty>No property found.</CommandEmpty>
                          <CommandGroup>
                            {properties.map((property) => (
                              <CommandItem
                                key={property.id}
                                value={`${property.name} ${property.address} ${property.city}`}
                                onSelect={() => {
                                  setSelectedProperty(property.id);
                                  setSelectedUnit("");
                                  setPropertyOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedProperty === property.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{property.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {property.address}, {property.city}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Unit Combobox */}
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit {selectedProperty && "*"}</Label>
                  {!selectedProperty ? (
                    <Select disabled>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a property first" />
                      </SelectTrigger>
                    </Select>
                  ) : units.length === 0 ? (
                    <Select disabled>
                      <SelectTrigger>
                        <SelectValue placeholder="No units available for this property" />
                      </SelectTrigger>
                    </Select>
                  ) : (
                    <Popover open={unitOpen} onOpenChange={setUnitOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={unitOpen}
                          className="w-full justify-between"
                        >
                          {selectedUnitData ? (() => {
                            const effectiveStatus = getEffectiveUnitStatus({
                              status: selectedUnitData.status,
                              current_tenant: selectedUnitData.current_tenant,
                              current_lease_start: selectedUnitData.current_lease_start,
                              current_lease_end: selectedUnitData.current_lease_end,
                              incoming_tenant: selectedUnitData.incoming_tenant,
                              incoming_lease_start: selectedUnitData.incoming_lease_start,
                              incoming_lease_end: selectedUnitData.incoming_lease_end,
                            });
                            const displayStatus = effectiveStatus === "occupied" ? "Occupied" : "Vacant";
                            const tenantName = selectedUnitData.current_tenant;
                            return (
                              <div className="flex items-center gap-2">
                                <span className="font-medium">Unit {selectedUnitData.unit_number}</span>
                                <span className={cn(
                                  "text-xs px-2 py-0.5 rounded-full",
                                  effectiveStatus === "occupied" 
                                    ? "bg-primary/10 text-primary" 
                                    : "bg-muted text-muted-foreground"
                                )}>
                                  {displayStatus}
                                </span>
                                {tenantName && (
                                  <span className="text-xs text-muted-foreground">- {tenantName}</span>
                                )}
                              </div>
                            );
                          })() : (
                            "Select a unit..."
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[600px] p-0 z-50 bg-popover">
                        <Command>
                          <CommandInput placeholder="Search units..." />
                          <CommandList>
                            <CommandEmpty>No unit found.</CommandEmpty>
                            <CommandGroup>
                              {units.map((unit) => {
                                const effectiveStatus = getEffectiveUnitStatus({
                                  status: unit.status,
                                  current_tenant: unit.current_tenant,
                                  current_lease_start: unit.current_lease_start,
                                  current_lease_end: unit.current_lease_end,
                                  incoming_tenant: unit.incoming_tenant,
                                  incoming_lease_start: unit.incoming_lease_start,
                                  incoming_lease_end: unit.incoming_lease_end,
                                });
                                const displayStatus = effectiveStatus === "occupied" ? "Occupied" : "Vacant";
                                const tenantName = unit.current_tenant;
                                
                                return (
                                  <CommandItem
                                    key={unit.id}
                                    value={`${unit.unit_number} ${displayStatus} ${tenantName || ''}`}
                                    onSelect={() => {
                                      setSelectedUnit(unit.id);
                                      setUnitOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedUnit === unit.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">Unit {unit.unit_number}</span>
                                      <span className={cn(
                                        "text-xs px-2 py-0.5 rounded-full",
                                        effectiveStatus === "occupied" 
                                          ? "bg-primary/10 text-primary" 
                                          : "bg-muted text-muted-foreground"
                                      )}>
                                        {displayStatus}
                                      </span>
                                      {tenantName && (
                                        <span className="text-xs text-muted-foreground">- {tenantName}</span>
                                      )}
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                {/* Tenant Display */}
                {selectedUnit && (
                  <div className="space-y-2">
                    <Label>Current Tenant</Label>
                    <div className="p-3 border rounded-md bg-muted/50">
                      {currentTenantName ? (
                        <p className="font-medium">{currentTenantName}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">No tenant assigned to this unit</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Leaky faucet in bathroom"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Provide detailed information about the maintenance issue..."
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Priority and Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority *</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!isTenant && (
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate(backPath)}
                disabled={saveRequestMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={saveRequestMutation.isPending}
              >
                {saveRequestMutation.isPending 
                  ? (isEditMode ? "Updating..." : "Submitting...") 
                  : (isEditMode ? "Update Request" : "Submit Request")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AddMaintenanceRequest;