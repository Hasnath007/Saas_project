import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, Calendar, CreditCard, FileText, Send, Phone, Mail, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { SendEmailDialog } from "@/components/SendEmailDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

const Communications = () => {
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [tenantSubject, setTenantSubject] = useState("");
  const [tenantMessage, setTenantMessage] = useState("");
  const [tenantSending, setTenantSending] = useState(false);
  const [tenantComposeOpen, setTenantComposeOpen] = useState(false);
  const queryClient = useQueryClient();
  const { isTenant, userId } = useUserRole();

  // For tenant users: get their email and tenant record
  const { data: userEmail } = useQuery({
    queryKey: ["user-email-comms", userId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.email || null;
    },
    enabled: isTenant && !!userId,
  });

  const { data: myTenantRecord } = useQuery({
    queryKey: ["my-tenant-record", userEmail],
    queryFn: async () => {
      if (!userEmail) return null;
      const { data, error } = await supabase
        .from("tenants")
        .select(`*, properties:property_id (name, address, city, user_id)`)
        .eq("email", userEmail)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: isTenant && !!userEmail,
  });


  // For admin/PM users: get all tenants
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["tenants-communications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select(`
          *,
          properties:property_id (name, address, city)
        `)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !isTenant,
  });

  // For tenants, wrap their single record in an array for the tenant list
  const displayTenants = isTenant ? (myTenantRecord ? [myTenantRecord] : []) : tenants;
  const activeTenant = isTenant ? myTenantRecord : (selectedTenant || tenants[0]);

  const { data: messages = [] } = useQuery({
    queryKey: ["tenant-messages", activeTenant?.id],
    queryFn: async () => {
      if (!activeTenant?.id) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("tenant_id", activeTenant.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!activeTenant?.id,
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleTenantSendMessage = async () => {
    if (!tenantMessage.trim()) {
      toast.error("Please enter a message.");
      return;
    }
    if (!myTenantRecord || !userId) return;

    setTenantSending(true);
    try {
      const subject = tenantSubject.trim() || "Message from Tenant";
      const body = tenantMessage.trim();

      // Save message to database
      const { error: insertError } = await supabase.from("messages").insert({
        user_id: myTenantRecord.properties.user_id,
        tenant_id: myTenantRecord.id,
        sender: "tenant",
        channel: "email",
        subject,
        body,
        status: "sent",
      });

      if (insertError) throw insertError;

      // Send email notification to property manager
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      await supabase.functions.invoke("send-tenant-to-pm-email", {
        body: {
          subject,
          message: body,
          tenantName: myTenantRecord.name,
          pmUserId: myTenantRecord.properties?.user_id,
          propertyName: myTenantRecord.properties?.name,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      toast.success("Message sent successfully!");
      setTenantSubject("");
      setTenantMessage("");
      setTenantComposeOpen(false);
      queryClient.invalidateQueries({ queryKey: ["tenant-messages", myTenantRecord.id] });
    } catch (err: any) {
      console.error("Error sending message:", err);
      toast.error(err.message || "Failed to send message.");
    } finally {
      setTenantSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Communications</h1>

        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
          {/* Tenants List */}
          <Card className="col-span-4 flex flex-col">
            <CardHeader>
              <div className="space-y-4">
                <Input placeholder="Search tenants..." />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">All</Button>
                  <Button variant="outline" size="sm">Email</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              {isLoading && !isTenant ? (
                <div className="p-4 text-center text-muted-foreground">Loading tenants...</div>
              ) : displayTenants.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">No tenants found</div>
              ) : (
                displayTenants.map((tenant, index) => (
                  <div key={tenant.id}>
                    <div 
                      className={`p-4 hover:bg-accent cursor-pointer ${activeTenant?.id === tenant.id ? 'bg-accent' : ''}`}
                      onClick={() => !isTenant && setSelectedTenant(tenant)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium flex-shrink-0">
                          {getInitials(tenant.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1">
                            <span className="font-semibold text-sm">{tenant.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {tenant.properties?.name || tenant.properties?.address}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{tenant.phone || "No phone"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{tenant.email}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {index < displayTenants.length - 1 && <Separator />}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Chat Window */}
          <Card className="col-span-5 flex flex-col">
            <CardHeader className="border-b">
              {activeTenant ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">
                      {getInitials(activeTenant.name)}
                    </div>
                    <div>
                      <CardTitle className="text-base">{activeTenant.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{activeTenant.email}</p>
                      <p className="text-xs text-muted-foreground">{activeTenant.phone || "No phone"}</p>
                    </div>
                  </div>
                  {!isTenant && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setEmailDialogOpen(true)}
                      className="gap-1.5"
                    >
                      <Mail className="h-4 w-4" />
                      Send Email
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground">Select a tenant to view conversation</div>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <p>No messages yet</p>
                  {isTenant && <p className="text-sm mt-2">Send a message to your property manager below.</p>}
                  {!isTenant && <p className="text-sm mt-2">Click "Send Email" to compose a message.</p>}
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'property_manager' ? (isTenant ? 'justify-start' : 'justify-end') : (isTenant ? 'justify-end' : 'justify-start')}`}>
                    <div className={`max-w-[75%] rounded-lg p-3 ${msg.sender === 'property_manager' ? (isTenant ? 'bg-muted' : 'bg-primary text-primary-foreground') : (isTenant ? 'bg-primary text-primary-foreground' : 'bg-muted')}`}>
                      {msg.subject && (
                        <p className={`text-xs font-semibold mb-1 ${(msg.sender === 'property_manager' && !isTenant) || (msg.sender !== 'property_manager' && isTenant) ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                          {msg.subject}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                      <div className={`flex items-center gap-2 mt-2 text-xs ${(msg.sender === 'property_manager' && !isTenant) || (msg.sender !== 'property_manager' && isTenant) ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                        <Mail className="h-3 w-3" />
                        <span>{formatMessageTime(msg.created_at)}</span>
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${(msg.sender === 'property_manager' && !isTenant) || (msg.sender !== 'property_manager' && isTenant) ? 'border-primary-foreground/30 text-primary-foreground/70' : ''}`}>
                          {msg.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
            {/* Compose area */}
            {!isTenant && (
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Button
                    className="w-full gap-2"
                    onClick={() => setEmailDialogOpen(true)}
                    disabled={!activeTenant}
                  >
                    <Send className="h-4 w-4" />
                    Compose Email
                  </Button>
                </div>
              </div>
            )}
            {isTenant && activeTenant && (
              <div className="border-t p-4">
                <Button
                  className="w-full gap-2"
                  onClick={() => setTenantComposeOpen(true)}
                >
                  <Mail className="h-4 w-4" />
                  Compose Mail
                </Button>
              </div>
            )}
          </Card>

          {/* Right Sidebar */}
          <Card className="col-span-3 overflow-auto">
            <CardHeader>
              <CardTitle>Tenant Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {activeTenant ? (
                <>
                  <div>
                    <p className="text-sm font-medium mb-2">{activeTenant.properties?.address || "N/A"}</p>
                    <p className="text-xs text-muted-foreground">{activeTenant.properties?.city}</p>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Monthly Rent</p>
                      <p className="font-semibold">${activeTenant.monthly_rent?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Lease Ends</p>
                      <p className="font-semibold">{new Date(activeTenant.lease_end).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium mb-1">Status</p>
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20">{activeTenant.status}</Badge>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-1">Balance</p>
                    <p className={`text-lg font-bold ${(activeTenant.balance || 0) > 0 ? 'text-destructive' : 'text-success'}`}>
                      ${(activeTenant.balance || 0).toLocaleString()}
                    </p>
                  </div>

                  {!isTenant && (
                    <>
                      <Separator />
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium mb-3">Quick Actions</p>
                        <div className="space-y-2">
                          <Button variant="outline" className="w-full justify-start gap-2">
                            <Wrench className="h-4 w-4" />
                            Create Work Order
                          </Button>
                          <Button variant="outline" className="w-full justify-start gap-2">
                            <CreditCard className="h-4 w-4" />
                            Send Payment Reminder
                          </Button>
                          <Button variant="outline" className="w-full justify-start gap-2">
                            <FileText className="h-4 w-4" />
                            Generate Report
                          </Button>
                          <Button variant="outline" className="w-full justify-start gap-2">
                            <Calendar className="h-4 w-4" />
                            Schedule Inspection
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="text-center text-muted-foreground">Select a tenant to view details</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {activeTenant && !isTenant && (
        <SendEmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          tenantName={activeTenant.name}
          tenantEmail={activeTenant.email}
          tenantId={activeTenant.id}
          onEmailSent={() => queryClient.invalidateQueries({ queryKey: ["tenant-messages", activeTenant.id] })}
        />
      )}

      {/* Tenant Compose Mail Dialog */}
      {isTenant && activeTenant && (
        <Dialog open={tenantComposeOpen} onOpenChange={setTenantComposeOpen}>
          <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Compose Mail
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>To</Label>
                <Input value="Property Manager" disabled className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label>Property</Label>
                <Input value={activeTenant.properties?.name || "N/A"} disabled className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tenant-subject">Subject</Label>
                <Input
                  id="tenant-subject"
                  placeholder="e.g. Question about lease renewal"
                  value={tenantSubject}
                  onChange={(e) => setTenantSubject(e.target.value)}
                  disabled={tenantSending}
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tenant-body">Message</Label>
                <Textarea
                  id="tenant-body"
                  placeholder="Type your message here..."
                  value={tenantMessage}
                  onChange={(e) => setTenantMessage(e.target.value)}
                  disabled={tenantSending}
                  className="resize-none"
                  rows={5}
                  maxLength={5000}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTenantComposeOpen(false)} disabled={tenantSending}>
                Cancel
              </Button>
              <Button onClick={handleTenantSendMessage} disabled={tenantSending || !tenantMessage.trim()}>
                {tenantSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Message
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
};

export default Communications;
