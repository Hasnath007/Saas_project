import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedData?: {
    property_id: string;
    property_name: string;
    unit_id?: string;
    unit_number?: string;
    tenant_id: string;
    tenant_name: string;
  };
}

const INCOME_CATEGORIES = [
  "Rent",
  "Garage",
  "Parking",
  "Miscellaneous",
];

const EXPENSE_CATEGORIES = [
  "Taxes",
  "Insurance",
  "Hydro",
  "Gas/Propane/Oil",
  "Hot Water Tank",
  "Snow/Yard",
  "Water/Sewer",
  "Common Utilities",
  "Miscellaneous",
  "Maintenance",
  "Property Management",
  "Vacancy - Residential",
];

export const RecordPaymentDialog = ({ 
  open, 
  onOpenChange, 
  preselectedData 
}: RecordPaymentDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [paymentForm, setPaymentForm] = useState({
    payment_type: "income" as "income" | "expense",
    category: "",
    amount: "",
    payment_date: format(new Date(), "yyyy-MM-dd"),
    payment_method: "bank_transfer",
    note: "",
  });

  useEffect(() => {
    if (open) {
      setPaymentForm({
        payment_type: "income",
        category: "",
        amount: "",
        payment_date: format(new Date(), "yyyy-MM-dd"),
        payment_method: "bank_transfer",
        note: "",
      });
    }
  }, [open]);

  const categories = paymentForm.payment_type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const createPaymentMutation = useMutation({
    mutationFn: async (paymentData: {
      tenant_id: string;
      amount: number;
      payment_date: string;
      payment_method: string;
      note: string | null;
      payment_type: "income" | "expense";
      category: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Insert the payment record
      const { data, error } = await supabase
        .from("payments")
        .insert({
          tenant_id: paymentData.tenant_id,
          amount: paymentData.amount,
          payment_date: paymentData.payment_date,
          payment_method: paymentData.payment_method,
          note: paymentData.note,
          user_id: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Update tenant balance based on payment type
      // Income (payment received) = deduct from balance (tenant owes less)
      // Expense = add to balance (not typically used for tenant balance)
      if (paymentData.payment_type === "income") {
        const { data: tenant, error: tenantError } = await supabase
          .from("tenants")
          .select("balance")
          .eq("id", paymentData.tenant_id)
          .single();

        if (tenantError) throw tenantError;

        const currentBalance = Number(tenant?.balance || 0);
        const newBalance = currentBalance - paymentData.amount;

        const { error: updateError } = await supabase
          .from("tenants")
          .update({ balance: newBalance })
          .eq("id", paymentData.tenant_id);

        if (updateError) throw updateError;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["financials"] });
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast({
        title: "Success",
        description: "Payment recorded successfully",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to record payment",
        variant: "destructive",
      });
    },
  });

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!preselectedData?.tenant_id || !paymentForm.amount || !paymentForm.category) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createPaymentMutation.mutate({
      tenant_id: preselectedData.tenant_id,
      amount: parseFloat(paymentForm.amount),
      payment_date: paymentForm.payment_date,
      payment_method: paymentForm.payment_method,
      note: paymentForm.note || null,
      payment_type: paymentForm.payment_type,
      category: paymentForm.category,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmitPayment} className="space-y-4 mt-4">
          {/* Property (read-only) */}
          <div className="space-y-2">
            <Label>Property</Label>
            <Input
              value={preselectedData?.property_name || ""}
              disabled
              className="bg-muted"
            />
          </div>

          {/* Unit (read-only, if available) */}
          {preselectedData?.unit_number && (
            <div className="space-y-2">
              <Label>Unit</Label>
              <Input
                value={`Unit ${preselectedData.unit_number}`}
                disabled
                className="bg-muted"
              />
            </div>
          )}

          {/* Tenant (read-only) */}
          <div className="space-y-2">
            <Label>Tenant</Label>
            <Input
              value={preselectedData?.tenant_name || ""}
              disabled
              className="bg-muted"
            />
          </div>

          {/* Payment Type */}
          <div className="space-y-2">
            <Label>Payment Type</Label>
            <Select
              value={paymentForm.payment_type}
              onValueChange={(value: "income" | "expense") => 
                setPaymentForm({ ...paymentForm, payment_type: value, category: "" })
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

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={paymentForm.category}
              onValueChange={(value) => setPaymentForm({ ...paymentForm, category: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPaymentMutation.isPending}>
              Record Payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
