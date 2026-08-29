import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ArrowLeft } from "lucide-react";

export default function TenantEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    propertyId: "",
    unitId: "",
    leaseStart: "",
    leaseEnd: "",
    monthlyRent: "",
    securityDeposit: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
  });

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { data: properties } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const { data: availableUnits } = useQuery({
    queryKey: ["units", formData.propertyId],
    queryFn: async () => {
      if (!formData.propertyId || formData.propertyId === "-") return [];

      const { data, error } = await supabase
        .from("units")
        .select("*")
        .eq("property_id", formData.propertyId)
        .order("unit_number");

      if (error) throw error;
      return data;
    },
    enabled: !!formData.propertyId && formData.propertyId !== "-",
  });

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || "",
        email: tenant.email || "",
        phone: tenant.phone || "",
        propertyId: tenant.property_id || "",
        unitId: tenant.unit_id || "",
        leaseStart: tenant.lease_start || "",
        leaseEnd: tenant.lease_end || "",
        monthlyRent: tenant.monthly_rent?.toString() || "",
        securityDeposit: tenant.security_deposit?.toString() || "",
        emergencyContactName: tenant.emergency_contact_name || "",
        emergencyContactPhone: tenant.emergency_contact_phone || "",
        emergencyContactRelationship: tenant.emergency_contact_relationship || "",
      });
    }
  }, [tenant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const unitId = formData.unitId && formData.unitId.trim() !== "" ? formData.unitId : null;
      
      const { error: tenantError } = await supabase
        .from("tenants")
        .update({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          property_id: formData.propertyId,
          unit_id: unitId,
          lease_start: formData.leaseStart,
          lease_end: formData.leaseEnd,
          monthly_rent: Number(formData.monthlyRent),
          security_deposit: Number(formData.securityDeposit),
          emergency_contact_name: formData.emergencyContactName || null,
          emergency_contact_phone: formData.emergencyContactPhone || null,
          emergency_contact_relationship: formData.emergencyContactRelationship || null,
        })
        .eq("id", id);

      if (tenantError) throw tenantError;

      // Update unit status only if a unit is selected
      if (unitId) {
        const { error: unitError } = await supabase
          .from("units")
          .update({
            current_tenant: formData.name,
            current_lease_start: formData.leaseStart,
            current_lease_end: formData.leaseEnd,
          })
          .eq("id", unitId);

        if (unitError) throw unitError;
      }

      toast.success("Tenant updated successfully");
      navigate(`/tenants/${id}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update tenant");
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-8">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!tenant) {
    return (
      <DashboardLayout>
        <div className="p-8">Tenant not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <Button
          variant="ghost"
          onClick={() => navigate(`/tenants/${id}`)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tenant Details
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Edit Tenant</CardTitle>
            <CardDescription>
              Update tenant information and lease details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="905-415-2288"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={formData.unitId || undefined}
                  onValueChange={(value) => setFormData({ ...formData, unitId: value })}
                  disabled={!formData.propertyId}
                >
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Select a unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUnits?.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        Unit {unit.unit_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="leaseStart">Lease Start *</Label>
                  <Input
                    id="leaseStart"
                    type="date"
                    value={formData.leaseStart}
                    onChange={(e) => setFormData({ ...formData, leaseStart: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leaseEnd">Lease End *</Label>
                  <Input
                    id="leaseEnd"
                    type="date"
                    value={formData.leaseEnd}
                    onChange={(e) => setFormData({ ...formData, leaseEnd: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="monthlyRent">Monthly Rent *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="monthlyRent"
                      type="number"
                      step="0.01"
                      placeholder="1,500"
                      className="pl-7"
                      value={formData.monthlyRent}
                      onChange={(e) => setFormData({ ...formData, monthlyRent: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="securityDeposit">Security Deposit</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="securityDeposit"
                      type="number"
                      step="0.01"
                      placeholder="1,500"
                      className="pl-7"
                      value={formData.securityDeposit}
                      onChange={(e) => setFormData({ ...formData, securityDeposit: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-medium">Emergency Contact</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactName">Name</Label>
                  <Input
                    id="emergencyContactName"
                    placeholder="Jane Doe"
                    value={formData.emergencyContactName}
                    onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactPhone">Phone</Label>
                    <Input
                      id="emergencyContactPhone"
                      type="tel"
                      placeholder="905-415-2288"
                      value={formData.emergencyContactPhone}
                      onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactRelationship">Relationship</Label>
                    <Input
                      id="emergencyContactRelationship"
                      placeholder="Spouse, Parent, etc."
                      value={formData.emergencyContactRelationship}
                      onChange={(e) => setFormData({ ...formData, emergencyContactRelationship: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 justify-end pt-4">
                <Button type="button" variant="outline" onClick={() => navigate(`/tenants/${id}`)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
