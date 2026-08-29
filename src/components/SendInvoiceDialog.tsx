import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface SendInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantName: string;
  tenantEmail: string;
  tenantId: string;
  monthlyRent: number;
  propertyName?: string;
  unitNumber?: string;
  onInvoiceSent?: () => void;
}

export const SendInvoiceDialog = ({
  open,
  onOpenChange,
  tenantName,
  tenantEmail,
  tenantId,
  monthlyRent,
  propertyName,
  unitNumber,
  onInvoiceSent,
}: SendInvoiceDialogProps) => {
  const [invoiceData, setInvoiceData] = useState({
    amount: monthlyRent?.toString() || "",
    dueDate: format(new Date(new Date().setDate(new Date().getDate() + 30)), "yyyy-MM-dd"),
    description: "Monthly Rent",
    category: "rent",
    notes: "",
  });
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!invoiceData.amount || parseFloat(invoiceData.amount) <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    if (!invoiceData.dueDate) {
      toast.error("Please select a due date.");
      return;
    }
    if (!invoiceData.description.trim()) {
      toast.error("Please enter a description.");
      return;
    }

    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const formattedAmount = parseFloat(invoiceData.amount).toLocaleString("en-US", {
        style: "currency",
        currency: "CAD",
      });

      const formattedDueDate = format(new Date(invoiceData.dueDate), "MMMM dd, yyyy");

      const invoiceSubject = `Invoice: ${invoiceData.description} - ${formattedAmount} Due ${formattedDueDate}`;

      const messageBody = `
You have a new invoice from your property manager.

Invoice Details:
• Description: ${invoiceData.description}
• Amount: ${formattedAmount}
• Due Date: ${formattedDueDate}
• Property: ${propertyName || "N/A"}
• Unit: ${unitNumber || "N/A"}
${invoiceData.notes ? `• Notes: ${invoiceData.notes}` : ""}

Please log in to your Tenant Portal to make your payment.
      `.trim();

      const res = await supabase.functions.invoke("send-tenant-email", {
        body: {
          to: tenantEmail,
          subject: invoiceSubject,
          message: messageBody,
          tenantName,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.error) {
        throw new Error(res.error.message || "Failed to send invoice");
      }
      if (res.data?.error) {
        throw new Error(res.data.error);
      }

      // Save to messages table
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("messages").insert({
          user_id: user.id,
          tenant_id: tenantId,
          sender: "property_manager",
          channel: "email",
          subject: invoiceSubject,
          body: messageBody,
          status: "sent",
        });
      }

      toast.success(`Invoice sent to ${tenantName}`);
      setInvoiceData({
        amount: monthlyRent?.toString() || "",
        dueDate: format(new Date(new Date().setDate(new Date().getDate() + 30)), "yyyy-MM-dd"),
        description: "Monthly Rent",
        category: "rent",
        notes: "",
      });
      onOpenChange(false);
      onInvoiceSent?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to send invoice. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Send Invoice to {tenantName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="invoice-to">To</Label>
            <Input id="invoice-to" value={tenantEmail} disabled className="bg-muted" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="invoice-amount">Amount ($)</Label>
              <Input
                id="invoice-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={invoiceData.amount}
                onChange={(e) => setInvoiceData({ ...invoiceData, amount: e.target.value })}
                disabled={sending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-due-date">Due Date</Label>
              <Input
                id="invoice-due-date"
                type="date"
                value={invoiceData.dueDate}
                onChange={(e) => setInvoiceData({ ...invoiceData, dueDate: e.target.value })}
                disabled={sending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invoice-category">Category</Label>
            <Select
              value={invoiceData.category}
              onValueChange={(value) => setInvoiceData({ ...invoiceData, category: value })}
              disabled={sending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rent">Rent</SelectItem>
                <SelectItem value="utilities">Utilities</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="late_fee">Late Fee</SelectItem>
                <SelectItem value="security_deposit">Security Deposit</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invoice-description">Description</Label>
            <Input
              id="invoice-description"
              placeholder="e.g. Monthly Rent - April 2026"
              value={invoiceData.description}
              onChange={(e) => setInvoiceData({ ...invoiceData, description: e.target.value })}
              maxLength={200}
              disabled={sending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invoice-notes">Additional Notes (Optional)</Label>
            <Textarea
              id="invoice-notes"
              placeholder="Any additional details for the tenant..."
              value={invoiceData.notes}
              onChange={(e) => setInvoiceData({ ...invoiceData, notes: e.target.value })}
              rows={3}
              maxLength={1000}
              disabled={sending}
              className="resize-none"
            />
          </div>

          <div className="rounded-md border p-3 bg-muted/50">
            <p className="text-sm font-medium mb-1">Invoice Preview</p>
            <p className="text-xs text-muted-foreground">
              Property: {propertyName || "N/A"} • Unit: {unitNumber || "N/A"}
            </p>
            <p className="text-xs text-muted-foreground">
              Amount: {invoiceData.amount ? `$${parseFloat(invoiceData.amount).toFixed(2)}` : "$0.00"} •
              Due: {invoiceData.dueDate ? format(new Date(invoiceData.dueDate), "MMM dd, yyyy") : "Not set"}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !invoiceData.amount || !invoiceData.dueDate}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Invoice
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
