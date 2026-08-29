import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const propertySchema = z.object({
  name: z.string().min(1, "Property name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  province: z.string().min(1, "Province/Territory is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  propertyType: z.string().min(1, "Property type is required"),
  occupancyStatus: z.string().min(1, "Occupancy status is required"),
  units: z.string().min(1, "Number of units is required"),
  timezone: z.string().min(1, "Timezone is required"),
  purchasePrice: z.string().min(1, "Purchase price is required"),
  downPayment: z.string().optional(),
  purchaseDate: z.string().optional(),
  currentValue: z.string().optional(),
});

type PropertyFormData = z.infer<typeof propertySchema>;

const PropertyEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  
  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      province: "",
      postalCode: "",
      propertyType: "",
      occupancyStatus: "",
      units: "1",
      timezone: "",
      purchasePrice: "",
      downPayment: "",
      purchaseDate: "",
      currentValue: "",
    },
  });


  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const { data, error } = await supabase
          .from("properties")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;

        form.reset({
          name: data.name,
          address: data.address,
          city: data.city,
          province: data.province,
          postalCode: data.postal_code || "",
          propertyType: data.property_type,
          occupancyStatus: data.occupancy_status || "owner-occupied",
          units: data.units.toString(),
          timezone: data.timezone,
          purchasePrice: data.purchase_price.toString(),
          downPayment: data.down_payment?.toString() || "",
          purchaseDate: data.purchase_date || "",
          currentValue: data.current_value?.toString() || "",
        });
      } catch (error: any) {
        toast({
          title: "Error",
          description: "Failed to load property details",
          variant: "destructive",
        });
        navigate("/properties");
      } finally {
        setLoading(false);
      }
    };

    fetchProperty();
  }, [id, navigate, toast, form]);

  const onSubmit = async (data: PropertyFormData) => {
    try {
      // Get current property data to check for changes
      const { data: currentProperty } = await supabase
        .from("properties")
        .select("units, property_type")
        .eq("id", id)
        .single();

      const { error: updateError } = await supabase
        .from("properties")
        .update({
          name: data.name,
          address: data.address,
          city: data.city,
          province: data.province,
          postal_code: data.postalCode,
          property_type: data.propertyType,
          occupancy_status: data.occupancyStatus,
          units: parseInt(data.units),
          timezone: data.timezone,
          purchase_price: parseFloat(data.purchasePrice),
          down_payment: data.downPayment ? parseFloat(data.downPayment) : null,
          purchase_date: data.purchaseDate || null,
          current_value: data.currentValue ? parseFloat(data.currentValue) : null,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Handle unit count changes for all property types
      const newUnits = parseInt(data.units);
      const oldUnits = currentProperty?.units || 0;
      
      if (newUnits !== oldUnits) {
        // Get existing units
        const { data: existingUnits } = await supabase
          .from("units")
          .select("id, unit_number")
          .eq("property_id", id)
          .order("unit_number");

        const existingCount = existingUnits?.length || 0;

        if (newUnits > existingCount) {
          // Add new units
          const unitsToCreate = Array.from({ length: newUnits - existingCount }, (_, i) => ({
            property_id: id,
            unit_number: `Unit ${existingCount + i + 1}`,
            status: "vacant",
          }));

          await supabase.from("units").insert(unitsToCreate);
        } else if (newUnits < existingCount) {
          // Remove excess units (keep the first N units)
          const unitsToDelete = existingUnits?.slice(newUnits).map(u => u.id) || [];
          if (unitsToDelete.length > 0) {
            await supabase.from("units").delete().in("id", unitsToDelete);
          }
        }
      }

      toast({
        title: "Property Updated",
        description: `${data.name} has been successfully updated.`,
      });
      navigate(`/properties/${id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">Loading...</div>
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
          onClick={() => navigate(`/properties/${id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Property Details
        </Button>

        {/* Form Card */}
        <Card>
          <CardContent className="p-8">
            <h1 className="text-2xl font-bold text-foreground mb-6">Edit Property</h1>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Property Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Riverside Apartments" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Address */}
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address *</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main Street" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* City and Province */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City *</FormLabel>
                        <FormControl>
                          <Input placeholder="Toronto" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="province"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Province/Territory *</FormLabel>
                        <FormControl>
                          <Input placeholder="ON" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Postal Code and Property Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code</FormLabel>
                        <FormControl>
                          <Input placeholder="M5H 2N2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="propertyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select property type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="single-family">Single Family</SelectItem>
                            <SelectItem value="multi-family">Multi-Family</SelectItem>
                            <SelectItem value="duplex">Duplex</SelectItem>
                            <SelectItem value="commercial">Commercial</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Occupancy Status */}
                <FormField
                  control={form.control}
                  name="occupancyStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Occupancy Status *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select occupancy status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="owner-occupied">Owner Occupied</SelectItem>
                          <SelectItem value="absentee">Absentee</SelectItem>
                          <SelectItem value="tenant-occupied">Tenant Occupied</SelectItem>
                          <SelectItem value="vacant">Vacant</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Number of Units */}
                <FormField
                  control={form.control}
                  name="units"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Units *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          max="9999" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Number of units for this property (max 9,999)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Timezone */}
                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone (Local Property Location) *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="america/toronto">America/Toronto — Eastern Time (Toronto, Canada)</SelectItem>
                          <SelectItem value="america/new_york">America/New_York — Eastern Time (New York, USA)</SelectItem>
                          <SelectItem value="america/chicago">America/Chicago — Central Time (Chicago, USA)</SelectItem>
                          <SelectItem value="america/denver">America/Denver — Mountain Time (Denver, USA)</SelectItem>
                          <SelectItem value="america/los_angeles">America/Los_Angeles — Pacific Time (Los Angeles, USA)</SelectItem>
                          <SelectItem value="america/vancouver">America/Vancouver — Pacific Time (Vancouver, Canada)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Lease transitions occur daily at midnight local property time.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Purchase Price */}
                <FormField
                  control={form.control}
                  name="purchasePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input
                            type="number"
                            placeholder="250,000"
                            className="pl-7"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Down Payment */}
                <FormField
                  control={form.control}
                  name="downPayment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Down Payment</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input
                            type="number"
                            placeholder="50,000"
                            className="pl-7"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Purchase Date and Current Value */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="purchaseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currentValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Value</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              placeholder="275,000"
                              className="pl-7"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/properties/${id}`)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PropertyEdit;
