import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantName: string;
  tenantEmail: string;
  tenantId: string;
  onEmailSent?: () => void;
}

export const SendEmailDialog = ({
  open,
  onOpenChange,
  tenantName,
  tenantEmail,
  tenantId,
  onEmailSent,
}: SendEmailDialogProps) => {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in both subject and message.");
      return;
    }
    if (subject.length > 200) {
      toast.error("Subject must be under 200 characters.");
      return;
    }
    if (message.length > 5000) {
      toast.error("Message must be under 5000 characters.");
      return;
    }

    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await supabase.functions.invoke("send-tenant-email", {
        body: {
          to: tenantEmail,
          subject: subject.trim(),
          message: message.trim(),
          tenantName,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.error) {
        throw new Error(res.error.message || "Failed to send email");
      }

      if (res.data?.error) {
        throw new Error(res.data.error);
      }

      // Save message to database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("messages").insert({
          user_id: user.id,
          tenant_id: tenantId,
          sender: "property_manager",
          channel: "email",
          subject: subject.trim(),
          body: message.trim(),
          status: "sent",
        });
      }

      toast.success(`Email sent to ${tenantName}`);
      setSubject("");
      setMessage("");
      onOpenChange(false);
      onEmailSent?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to send email. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Email {tenantName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="email-to">To</Label>
            <Input id="email-to" value={tenantEmail} disabled className="bg-muted" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              placeholder="e.g. Rent reminder for March"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              disabled={sending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email-message">Message</Label>
            <Textarea
              id="email-message"
              placeholder="Write your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={5000}
              disabled={sending}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{message.length}/5000</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !subject.trim() || !message.trim()}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
