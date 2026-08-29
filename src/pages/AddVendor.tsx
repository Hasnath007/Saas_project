import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const vendorSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  company_name: z.string().trim().max(100).nullable().optional(),
  service_type: z.string().trim().min(1, "Service type is required").max(100),
  contact_phone: z.string().trim().min(7, "Valid phone number required").max(20),
  contact_email: z.string().trim().email("Valid email required").max(255).nullable().optional().or(z.literal("")).or(z.literal(null)),
  address: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  province: z.string().trim().max(100).nullable().optional(),
  postal_code: z.string().trim().max(20).nullable().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  jobs_completed: z.number().min(0).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

const AddVendor = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const isEditMode = !!id;
  const isViewMode = window.location.pathname.includes("/view/");
  
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [rating, setRating] = useState("0");
  const [jobsCompleted, setJobsCompleted] = useState("0");
  const [isPreferred, setIsPreferred] = useState(false);
  const [notes, setNotes] = useState("");

  // Fetch existing vendor if editing/viewing
  const { data: existingVendor } = useQuery({
    queryKey: ["vendor", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: isEditMode || isViewMode,
  });

  // Pre-fill form when editing/viewing
  useEffect(() => {
    if (existingVendor) {
      setName(existingVendor.name);
      setCompanyName(existingVendor.company_name || "");
      setServiceType(existingVendor.service_type);
      setContactPhone(existingVendor.contact_phone);
      setContactEmail(existingVendor.contact_email || "");
      setAddress(existingVendor.address || "");
      setCity(existingVendor.city || "");
      setProvince(existingVendor.province || "");
      setPostalCode(existingVendor.postal_code || "");
      setRating(existingVendor.rating?.toString() || "0");
      setJobsCompleted(existingVendor.jobs_completed?.toString() || "0");
      setIsPreferred(existingVendor.is_preferred || false);
      setNotes(existingVendor.notes || "");
    }
  }, [existingVendor]);

  // Create or update vendor mutation
  const saveVendorMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const formData = {
        name: name.trim(),
        company_name: companyName.trim() || null,
        service_type: serviceType.trim(),
        contact_phone: contactPhone.trim(),
        contact_email: contactEmail.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        province: province.trim() || null,
        postal_code: postalCode.trim() || null,
        rating: parseFloat(rating) || 0,
        jobs_completed: parseInt(jobsCompleted) || 0,
        notes: notes.trim() || "",
      };

      // Validate form data
      vendorSchema.parse(formData);

      const vendorData = {
        ...formData,
        user_id: user.id,
        is_preferred: isPreferred,
      };

      if (isEditMode) {
        const { error } = await supabase
          .from("vendors")
          .update(vendorData)
          .eq("id", id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("vendors")
          .insert(vendorData);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success(`Vendor ${isEditMode ? 'updated' : 'created'} successfully`);
      navigate("/maintenance?tab=vendors");
    },
    onError: (error: Error) => {
      toast.error(`Failed to ${isEditMode ? 'update' : 'create'} vendor: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    if (!name || !serviceType || !contactPhone) {
      toast.error("Please fill in all required fields");
      return;
    }
    saveVendorMutation.mutate();
  };

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl mx-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-6 gap-2"
          onClick={() => navigate("/maintenance?tab=vendors")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Vendor Directory
        </Button>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>
              {isViewMode ? 'Vendor Profile' : isEditMode ? 'Edit Vendor' : 'New Vendor'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name and Company */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Contact Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., John Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isViewMode}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company Name</Label>
                <Input
                  id="company"
                  placeholder="e.g., Quick Fix Plumbing"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={isViewMode}
                  maxLength={100}
                />
              </div>
            </div>

            {/* Service Type */}
            <div className="space-y-2">
              <Label htmlFor="serviceType">Service Type *</Label>
              <Select value={serviceType} onValueChange={setServiceType} disabled={isViewMode}>
                <SelectTrigger id="serviceType">
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  <SelectItem value="Plumbing">Plumbing</SelectItem>
                  <SelectItem value="Electrical">Electrical</SelectItem>
                  <SelectItem value="HVAC">HVAC</SelectItem>
                  <SelectItem value="Appliance Repair">Appliance Repair</SelectItem>
                  <SelectItem value="Landscaping">Landscaping</SelectItem>
                  <SelectItem value="Painting">Painting</SelectItem>
                  <SelectItem value="Carpentry">Carpentry</SelectItem>
                  <SelectItem value="Roofing">Roofing</SelectItem>
                  <SelectItem value="General Maintenance">General Maintenance</SelectItem>
                  <SelectItem value="Cleaning">Cleaning</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="e.g., +1 (555) 456-7890"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  disabled={isViewMode}
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="e.g., contact@vendor.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  disabled={isViewMode}
                  maxLength={255}
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="Street address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={isViewMode}
                maxLength={200}
              />
            </div>

            {/* City, Province, Postal Code */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={isViewMode}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="province">Province</Label>
                <Input
                  id="province"
                  placeholder="Province"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  disabled={isViewMode}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal">Postal Code</Label>
                <Input
                  id="postal"
                  placeholder="Postal code"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  disabled={isViewMode}
                  maxLength={20}
                />
              </div>
            </div>

            {/* Rating and Jobs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rating">Rating (0-5)</Label>
                <Input
                  id="rating"
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  disabled={isViewMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobs">Jobs Completed</Label>
                <Input
                  id="jobs"
                  type="number"
                  min="0"
                  value={jobsCompleted}
                  onChange={(e) => setJobsCompleted(e.target.value)}
                  disabled={isViewMode}
                />
              </div>
            </div>

            {/* Preferred Vendor */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="preferred">Preferred Vendor</Label>
                <p className="text-sm text-muted-foreground">
                  Mark this vendor as a preferred service provider
                </p>
              </div>
              <Switch
                id="preferred"
                checked={isPreferred}
                onCheckedChange={setIsPreferred}
                disabled={isViewMode}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes about this vendor..."
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isViewMode}
                maxLength={1000}
              />
            </div>

            {/* Action Buttons */}
            {!isViewMode && (
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate("/maintenance?tab=vendors")}
                  disabled={saveVendorMutation.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={saveVendorMutation.isPending}
                >
                  {saveVendorMutation.isPending 
                    ? (isEditMode ? "Updating..." : "Creating...") 
                    : (isEditMode ? "Update Vendor" : "Create Vendor")}
                </Button>
              </div>
            )}

            {isViewMode && (
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate("/maintenance?tab=vendors")}
                >
                  Back
                </Button>
                <Button 
                  onClick={() => navigate(`/vendors/edit/${id}`)}
                >
                  Edit Vendor
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AddVendor;
