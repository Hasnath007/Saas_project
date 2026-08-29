import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ArrowLeft, Check, ChevronsUpDown, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const unitSchema = z.object({
  unit_number: z.string().min(1, "Unit number is required"),
  description: z.string().optional(),
  size_sqft: z.string().optional(),
  required_rent: z.string().optional(),
  required_deposit: z.string().optional(),
  current_tenant: z.string().optional(),
  current_lease_start: z.string().optional(),
  current_lease_end: z.string().optional(),
  incoming_tenant: z.string().optional(),
  incoming_lease_start: z.string().optional(),
  incoming_lease_end: z.string().optional(),
  status: z.string().min(1, "Status is required"),
  status_until: z.string().optional(),
});

type UnitFormData = z.infer<typeof unitSchema>;

interface Tenant {
  id: string;
  name: string;
  email: string;
}

const UnitEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [propertyId, setPropertyId] = useState<string>("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenantOpen, setCurrentTenantOpen] = useState(false);
  const [incomingTenantOpen, setIncomingTenantOpen] = useState(false);
  
  const form = useForm<UnitFormData>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      unit_number: "",
      description: "",
      size_sqft: "",
      required_rent: "",
      required_deposit: "",
      current_tenant: "",
      current_lease_start: "",
      current_lease_end: "",
      incoming_tenant: "",
      incoming_lease_start: "",
      incoming_lease_end: "",
      status: "vacant",
      status_until: "",
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch unit data
        const { data: unitData, error: unitError } = await supabase
          .from("units")
          .select("*")
          .eq("id", id)
          .single();

        if (unitError) throw unitError;

        setPropertyId(unitData.property_id);
        form.reset({
          unit_number: unitData.unit_number,
          description: unitData.description || "",
          size_sqft: unitData.size_sqft?.toString() || "",
          required_rent: unitData.required_rent?.toString() || "",
          required_deposit: unitData.required_deposit?.toString() || "",
          current_tenant: unitData.current_tenant || "",
          current_lease_start: unitData.current_lease_start || "",
          current_lease_end: unitData.current_lease_end || "",
          incoming_tenant: unitData.incoming_tenant || "",
          incoming_lease_start: unitData.incoming_lease_start || "",
          incoming_lease_end: unitData.incoming_lease_end || "",
          status: unitData.status,
          status_until: unitData.status_until || "",
        });

        // Fetch all tenants for dropdown
        const { data: tenantsData, error: tenantsError } = await supabase
          .from("tenants")
          .select("id, name, email")
          .order("name");

        if (tenantsError) throw tenantsError;
        setTenants(tenantsData || []);

      } catch (error: any) {
        toast({
          title: "Error",
          description: "Failed to load unit details",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, toast, form]);

  const onSubmit = async (data: UnitFormData) => {
    try {
      const { error } = await supabase
        .from("units")
        .update({
          unit_number: data.unit_number,
          description: data.description || null,
          size_sqft: data.size_sqft ? parseFloat(data.size_sqft) : null,
          required_rent: data.required_rent ? parseFloat(data.required_rent) : null,
          required_deposit: data.required_deposit ? parseFloat(data.required_deposit) : null,
          current_tenant: data.current_tenant || null,
          current_lease_start: data.current_lease_start || null,
          current_lease_end: data.current_lease_end || null,
          incoming_tenant: data.incoming_tenant || null,
          incoming_lease_start: data.incoming_lease_start || null,
          incoming_lease_end: data.incoming_lease_end || null,
          status: data.status,
          status_until: data.status_until || null,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Unit Updated",
        description: `${data.unit_number} has been successfully updated.`,
      });
      navigate(`/properties/${propertyId}`);
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
        <Button
          variant="ghost"
          className="mb-6 gap-2"
          onClick={() => navigate(`/properties/${propertyId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Property Details
        </Button>

        <Card>
          <CardContent className="p-8">
            <h1 className="text-2xl font-bold text-foreground mb-6">Edit Unit</h1>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="unit_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="Unit 1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Unit description..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="size_sqft"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Size (sqft)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="800" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="vacant">Vacant</SelectItem>
                            <SelectItem value="occupied">Occupied</SelectItem>
                            <SelectItem value="repairs">Repairs</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="required_rent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Required Rent</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input type="number" placeholder="1200" className="pl-7" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="required_deposit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Required Deposit</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input type="number" placeholder="1200" className="pl-7" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Current Lease</h3>
                  
                  <FormField
                    control={form.control}
                    name="current_tenant"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Current Tenant</FormLabel>
                        <Popover open={currentTenantOpen} onOpenChange={setCurrentTenantOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={currentTenantOpen}
                                className={cn(
                                  "w-full justify-between",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value || "Select tenant..."}
                                <div className="flex items-center gap-1">
                                  {field.value && (
                                    <X
                                      className="h-4 w-4 opacity-50 hover:opacity-100"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        field.onChange("");
                                      }}
                                    />
                                  )}
                                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                </div>
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0 bg-popover" align="start">
                            <Command>
                              <CommandInput placeholder="Search tenants..." />
                              <CommandList>
                                <CommandEmpty>No tenant found.</CommandEmpty>
                                <CommandGroup>
                                  {tenants.map((tenant) => (
                                    <CommandItem
                                      key={tenant.id}
                                      value={tenant.name}
                                      onSelect={() => {
                                        field.onChange(tenant.name);
                                        setCurrentTenantOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value === tenant.name ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{tenant.name}</span>
                                        <span className="text-xs text-muted-foreground">{tenant.email}</span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="current_lease_start"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lease Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="current_lease_end"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lease End Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Incoming Lease</h3>
                  
                  <FormField
                    control={form.control}
                    name="incoming_tenant"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Incoming Tenant</FormLabel>
                        <Popover open={incomingTenantOpen} onOpenChange={setIncomingTenantOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={incomingTenantOpen}
                                className={cn(
                                  "w-full justify-between",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value || "Select tenant..."}
                                <div className="flex items-center gap-1">
                                  {field.value && (
                                    <X
                                      className="h-4 w-4 opacity-50 hover:opacity-100"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        field.onChange("");
                                      }}
                                    />
                                  )}
                                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                </div>
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0 bg-popover" align="start">
                            <Command>
                              <CommandInput placeholder="Search tenants..." />
                              <CommandList>
                                <CommandEmpty>No tenant found.</CommandEmpty>
                                <CommandGroup>
                                  {tenants.map((tenant) => (
                                    <CommandItem
                                      key={tenant.id}
                                      value={tenant.name}
                                      onSelect={() => {
                                        field.onChange(tenant.name);
                                        setIncomingTenantOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value === tenant.name ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{tenant.name}</span>
                                        <span className="text-xs text-muted-foreground">{tenant.email}</span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="incoming_lease_start"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lease Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="incoming_lease_end"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lease End Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="status_until"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status Until Date (Optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/properties/${propertyId}`)}
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

export default UnitEdit;
