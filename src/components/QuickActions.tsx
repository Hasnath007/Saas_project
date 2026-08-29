import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, DollarSign, Check, ChevronsUpDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const QuickActions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [tenantOpen, setTenantOpen] = useState(false);
  
  const [paymentForm, setPaymentForm] = useState({
    property_id: "",
    unit_id: "",
    tenant_id: "",
    collection_status: "income" as "income" | "expense",
    amount: "",
    payment_date: format(new Date(), "yyyy-MM-dd"),
    payment_method: "bank_transfer",
    note: "",
  });

  // Fetch properties
  const { data: properties } = useQuery({
    queryKey: ["properties-for-payment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, units")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: isPaymentDialogOpen,
  });

  // Fetch units for selected property
  const { data: units } = useQuery({
    queryKey: ["units-for-payment", paymentForm.property_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("id, unit_number")
        .eq("property_id", paymentForm.property_id)
        .order("unit_number");
      if (error) throw error;
      return data;
    },
    enabled: !!paymentForm.property_id,
  });

  // Fetch tenants based on property and optionally unit
  const { data: tenants } = useQuery({
    queryKey: ["tenants-for-payment", paymentForm.property_id, paymentForm.unit_id],
    queryFn: async () => {
      let query = supabase
        .from("tenants")
        .select("id, name")
        .eq("property_id", paymentForm.property_id)
        .order("name");
      
      if (paymentForm.unit_id) {
        query = query.eq("unit_id", paymentForm.unit_id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!paymentForm.property_id,
  });

  const selectedProperty = properties?.find(p => p.id === paymentForm.property_id);
  const showUnitSelector = selectedProperty && selectedProperty.units > 1;

  const createPaymentMutation = useMutation({
    mutationFn: async (paymentData: {
      property_id: string;
      collection_status: "income" | "expense";
      amount: number;
      payment_date: string;
      note: string | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Save to property_income or property_expenses based on collection_status
      if (paymentData.collection_status === "income") {
        const { data, error } = await supabase
          .from("property_income")
          .insert({
            property_id: paymentData.property_id,
            user_id: userData.user.id,
            amount: paymentData.amount,
            category: "Rent",
            frequency: "one-time",
            description: paymentData.note,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("property_expenses")
          .insert({
            property_id: paymentData.property_id,
            user_id: userData.user.id,
            amount: paymentData.amount,
            category: "Miscellaneous",
            frequency: "one-time",
            description: paymentData.note,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property_income"] });
      queryClient.invalidateQueries({ queryKey: ["property_expenses"] });
      queryClient.invalidateQueries({ queryKey: ["financials"] });
      toast({
        title: "Saved successfully",
        description: "Payment has been recorded",
      });
      setIsPaymentDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to record payment",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setPaymentForm({
      property_id: "",
      unit_id: "",
      tenant_id: "",
      collection_status: "income",
      amount: "",
      payment_date: format(new Date(), "yyyy-MM-dd"),
      payment_method: "bank_transfer",
      note: "",
    });
  };

  const handlePropertyChange = (propertyId: string) => {
    setPaymentForm({
      ...paymentForm,
      property_id: propertyId,
      unit_id: "",
      tenant_id: "",
    });
    setPropertyOpen(false);
  };

  const handleUnitChange = (unitId: string) => {
    setPaymentForm({
      ...paymentForm,
      unit_id: unitId,
      tenant_id: "",
    });
    setUnitOpen(false);
  };

  const handleTenantChange = (tenantId: string) => {
    setPaymentForm({
      ...paymentForm,
      tenant_id: tenantId,
    });
    setTenantOpen(false);
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.property_id || !paymentForm.amount) {
      toast({
        title: "Missing information",
        description: "Please select a property and enter an amount",
        variant: "destructive",
      });
      return;
    }
    createPaymentMutation.mutate({
      property_id: paymentForm.property_id,
      collection_status: paymentForm.collection_status,
      amount: parseFloat(paymentForm.amount),
      payment_date: paymentForm.payment_date,
      note: paymentForm.note || null,
    });
  };

  return (
    <>
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2"
            onClick={() => navigate("/maintenance")}
          >
            <Calendar className="h-4 w-4" />
            Schedule Maintenance
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2"
            onClick={() => navigate("/communications")}
          >
            <FileText className="h-4 w-4" />
            Send Notice
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2"
            onClick={() => setIsPaymentDialogOpen(true)}
          >
            <DollarSign className="h-4 w-4" />
            Record Payment
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isPaymentDialogOpen} onOpenChange={(open) => {
        setIsPaymentDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitPayment} className="space-y-4 mt-4">
            {/* Property Selection */}
            <div className="space-y-2">
              <Label>Property</Label>
              <Popover open={propertyOpen} onOpenChange={setPropertyOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={propertyOpen}
                    className="w-full justify-between font-normal"
                  >
                    {paymentForm.property_id
                      ? properties?.find(p => p.id === paymentForm.property_id)?.name
                      : "Select a property..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search property..." />
                    <CommandList>
                      <CommandEmpty>No property found.</CommandEmpty>
                      <CommandGroup>
                        {properties?.map((property) => (
                          <CommandItem
                            key={property.id}
                            value={property.name}
                            onSelect={() => handlePropertyChange(property.id)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                paymentForm.property_id === property.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {property.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Unit Selection (conditional) */}
            {showUnitSelector && (
              <div className="space-y-2">
                <Label>Unit</Label>
                <Popover open={unitOpen} onOpenChange={setUnitOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={unitOpen}
                      className="w-full justify-between font-normal"
                    >
                      {paymentForm.unit_id
                        ? `Unit ${units?.find(u => u.id === paymentForm.unit_id)?.unit_number}`
                        : "Select a unit..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search unit..." />
                      <CommandList>
                        <CommandEmpty>No unit found.</CommandEmpty>
                        <CommandGroup>
                          {units?.map((unit) => (
                            <CommandItem
                              key={unit.id}
                              value={unit.unit_number}
                              onSelect={() => handleUnitChange(unit.id)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  paymentForm.unit_id === unit.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              Unit {unit.unit_number}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Tenant Selection */}
            {paymentForm.property_id && (
              <div className="space-y-2">
                <Label>Tenant</Label>
                <Popover open={tenantOpen} onOpenChange={setTenantOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={tenantOpen}
                      className="w-full justify-between font-normal"
                    >
                      {paymentForm.tenant_id
                        ? tenants?.find(t => t.id === paymentForm.tenant_id)?.name
                        : "Select a tenant..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search tenant..." />
                      <CommandList>
                        <CommandEmpty>No tenant found.</CommandEmpty>
                        <CommandGroup>
                          {tenants?.map((tenant) => (
                            <CommandItem
                              key={tenant.id}
                              value={tenant.name}
                              onSelect={() => handleTenantChange(tenant.id)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  paymentForm.tenant_id === tenant.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {tenant.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Collection Status */}
            <div className="space-y-2">
              <Label>Collection Status</Label>
              <Select
                value={paymentForm.collection_status}
                onValueChange={(value: "income" | "expense") => 
                  setPaymentForm({ ...paymentForm, collection_status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                required
              />
            </div>

            {/* Payment Date */}
            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment Date</Label>
              <Input
                id="payment_date"
                type="date"
                value={paymentForm.payment_date}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                required
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select
                value={paymentForm.payment_method}
                onValueChange={(value) => setPaymentForm({ ...paymentForm, payment_method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="online_payment">Online Payment</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="note">Note (Optional)</Label>
              <Textarea
                id="note"
                placeholder="Add any reference or notes"
                value={paymentForm.note}
                onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createPaymentMutation.isPending}>
                Record Payment
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
