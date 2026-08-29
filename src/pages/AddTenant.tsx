import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ArrowLeft, Upload, X, FileText } from "lucide-react";

export default function AddTenant() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Please upload a JPG, PNG, HEIC, or PDF file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setContractFile(file);
    }
  };

  const removeFile = () => {
    setContractFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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

  const selectedProperty = properties?.find(p => p.id === formData.propertyId);
  const propertyHasUnits = selectedProperty && selectedProperty.units > 1;

  const { data: availableUnits } = useQuery({
    queryKey: ["available-units", formData.propertyId],
    queryFn: async () => {
      if (!formData.propertyId) return [];

      // Fetch vacant units OR occupied units without an incoming tenant (for future lease starts)
      const { data, error } = await supabase
        .from("units")
        .select("*")
        .eq("property_id", formData.propertyId)
        .or("status.eq.vacant,and(status.eq.occupied,incoming_tenant.is.null)")
        .order("unit_number");

      if (error) throw error;
      return data;
    },
    enabled: !!formData.propertyId && propertyHasUnits,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let unitIdToAssign = formData.unitId || null;

      // For single-family properties (units <= 1), find a suitable unit
      if (!propertyHasUnits && formData.propertyId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const leaseStartDate = new Date(formData.leaseStart);
        const isIncomingTenant = leaseStartDate > today;

        // First try to find a vacant unit
        const { data: vacantUnit } = await supabase
          .from("units")
          .select("id")
          .eq("property_id", formData.propertyId)
          .eq("status", "vacant")
          .limit(1)
          .maybeSingle();

        if (vacantUnit) {
          unitIdToAssign = vacantUnit.id;
        } else if (isIncomingTenant) {
          // If no vacant unit but this is an incoming tenant (future lease start),
          // find an occupied unit without an incoming tenant already set
          const { data: occupiedUnit } = await supabase
            .from("units")
            .select("id")
            .eq("property_id", formData.propertyId)
            .eq("status", "occupied")
            .is("incoming_tenant", null)
            .limit(1)
            .maybeSingle();

          if (occupiedUnit) {
            unitIdToAssign = occupiedUnit.id;
          } else {
            throw new Error("No available units. All units already have tenants assigned.");
          }
        } else {
          throw new Error("No vacant units available. The property already has a tenant.");
        }
      }

      const { data: tenantData, error: tenantError } = await supabase.from("tenants").insert({
        user_id: user.id,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        property_id: formData.propertyId,
        unit_id: unitIdToAssign,
        lease_start: formData.leaseStart,
        lease_end: formData.leaseEnd,
        monthly_rent: Number(formData.monthlyRent),
        security_deposit: Number(formData.securityDeposit),
        emergency_contact_name: formData.emergencyContactName || null,
        emergency_contact_phone: formData.emergencyContactPhone || null,
        emergency_contact_relationship: formData.emergencyContactRelationship || null,
        status: "active",
      }).select().single();

      if (tenantError) throw tenantError;

      // Upload contract file if provided
      if (contractFile && tenantData) {
        const fileExt = contractFile.name.split('.').pop();
        const fileName = `${tenantData.id}/contract-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("tenant-documents")
          .upload(fileName, contractFile);

        if (uploadError) {
          console.error("File upload error:", uploadError);
          toast.error("Tenant created but contract upload failed");
        } else {
          // Save document reference to tenant_documents table
          const { error: docError } = await supabase.from("tenant_documents").insert({
            tenant_id: tenantData.id,
            user_id: user.id,
            document_title: "Contract",
            file_name: contractFile.name,
            file_path: fileName,
            file_size: contractFile.size,
            file_type: contractFile.type,
          });

          if (docError) {
            console.error("Document record error:", docError);
          }
        }
      }

      // Update unit status if we have a unit to update
      if (unitIdToAssign) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const leaseStartDate = new Date(formData.leaseStart);
        const isIncomingTenant = leaseStartDate > today;

        const unitUpdateData: Record<string, any> = {
          required_rent: Number(formData.monthlyRent),
          required_deposit: formData.securityDeposit ? Number(formData.securityDeposit) : null,
        };

        if (isIncomingTenant) {
          // Lease starts in the future - set as incoming tenant
          unitUpdateData.incoming_tenant = formData.name;
          unitUpdateData.incoming_lease_start = formData.leaseStart;
          unitUpdateData.incoming_lease_end = formData.leaseEnd;
        } else {
          // Lease starts today or in the past - set as current tenant
          unitUpdateData.status = "occupied";
          unitUpdateData.current_tenant = formData.name;
          unitUpdateData.current_lease_start = formData.leaseStart;
          unitUpdateData.current_lease_end = formData.leaseEnd;
        }

        const { error: unitError } = await supabase
          .from("units")
          .update(unitUpdateData)
          .eq("id", unitIdToAssign);

        if (unitError) throw unitError;
      }

      toast.success("Tenant added successfully");
      navigate("/tenants");
    } catch (error: any) {
      toast.error(error.message || "Failed to add tenant");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/tenants")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tenants
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Add New Tenant</CardTitle>
            <CardDescription>
              Create a new tenant record and assign them to a unit
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
                <Label htmlFor="property">Property *</Label>
                <Select
                  value={formData.propertyId}
                  onValueChange={(value) => setFormData({ ...formData, propertyId: value, unitId: "" })}
                  required
                >
                  <SelectTrigger id="property">
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties?.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {propertyHasUnits && (
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit Assignment</Label>
                  <Select
                    value={formData.unitId}
                    onValueChange={(value) => setFormData({ ...formData, unitId: value })}
                    disabled={!formData.propertyId}
                  >
                    <SelectTrigger id="unit">
                      <SelectValue placeholder="Select a unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUnits?.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          Unit {unit.unit_number} {unit.status === "occupied" ? "(Occupied - for incoming tenant)" : "(Vacant)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Vacant units are available immediately. Occupied units can accept incoming tenants with future lease start dates.
                  </p>
                </div>
              )}

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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="leaseStart">Lease Start Date *</Label>
                  <Input
                    id="leaseStart"
                    type="date"
                    value={formData.leaseStart}
                    onChange={(e) => setFormData({ ...formData, leaseStart: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leaseEnd">Lease End Date *</Label>
                  <Input
                    id="leaseEnd"
                    type="date"
                    value={formData.leaseEnd}
                    onChange={(e) => setFormData({ ...formData, leaseEnd: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-medium">Contract Document (Optional)</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="contractFile">Upload Contract File</Label>
                  <div className="flex items-center gap-4">
                    <input
                      ref={fileInputRef}
                      id="contractFile"
                      type="file"
                      accept=".jpg,.jpeg,.png,.heic,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {!contractFile ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-24 border-dashed flex flex-col gap-2"
                      >
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Click to upload (JPG, PNG, HEIC, PDF)
                        </span>
                      </Button>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/50 w-full">
                        <FileText className="h-8 w-8 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{contractFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(contractFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={removeFile}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-medium">Emergency Contact (Optional)</h3>
                
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
                <Button type="button" variant="outline" onClick={() => navigate("/tenants")} disabled={isUploading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isUploading}>
                  {isUploading ? "Adding..." : "Add Tenant"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
