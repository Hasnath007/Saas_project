import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Upload, FileText, Image, Loader2, Download, CreditCard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { getLeaseStatus, getLeaseStatusBadgeVariant } from "@/lib/leaseStatus";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const TenantPortal = () => {
  const { isTenant, loading: roleLoading, userId } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Handle payment success redirect
  const searchParams = new URLSearchParams(window.location.search);
  const paymentStatus = searchParams.get("payment");
  const sessionId = searchParams.get("session_id");

  useQuery({
    queryKey: ["process-payment", sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      // Use raw fetch to call webhook - doesn't require auth session
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/tenant-payment-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": anonKey,
        },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Payment processing failed");
      // Clean URL
      window.history.replaceState({}, "", "/tenant-portal");
      queryClient.invalidateQueries({ queryKey: ["tenant-payments"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-by-email"] });
      toast({ title: "Payment Successful", description: "Your payment has been recorded and confirmation emails sent." });
      return result;
    },
    enabled: !!sessionId && paymentStatus === "success",
    retry: false,
  });

  // Fetch tenant data linked to the current user's email
  const { data: profile } = useQuery({
    queryKey: ["tenant-profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Fetch the user's email to find their tenant record
  const { data: userEmail } = useQuery({
    queryKey: ["user-email", userId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.email || null;
    },
    enabled: !!userId,
  });

  // Fetch tenant record by email
  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ["tenant-by-email", userEmail],
    queryFn: async () => {
      if (!userEmail) return null;
      const { data, error } = await supabase
        .from("tenants")
        .select(`
          *,
          property:properties(name, address, city, province, postal_code),
          unit:units(unit_number)
        `)
        .eq("email", userEmail)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!userEmail,
  });

  // Fetch payments for this tenant
  const { data: payments } = useQuery({
    queryKey: ["tenant-payments", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("payment_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  // Fetch maintenance requests for this tenant's unit
  const { data: maintenanceRequests } = useQuery({
    queryKey: ["tenant-maintenance", tenant?.unit_id],
    queryFn: async () => {
      if (!tenant?.unit_id) return [];
      const { data, error } = await supabase
        .from("maintenance_requests")
        .select("*")
        .eq("unit_id", tenant.unit_id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.unit_id,
  });

  // Fetch documents for this tenant
  const { data: documents } = useQuery({
    queryKey: ["tenant-documents-portal", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from("tenant_documents")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  // Fetch messages for this tenant
  const { data: tenantMessages } = useQuery({
    queryKey: ["tenant-messages-portal", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  if (roleLoading || tenantLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  // Redirect non-tenants away from this page
  if (!isTenant) {
    return <Navigate to="/" replace />;
  }

  if (!tenant) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <Card>
            <CardContent className="p-12 text-center">
              <h2 className="text-xl font-semibold mb-2">No Tenant Record Found</h2>
              <p className="text-muted-foreground">
                Your account is not linked to any tenant record. Please contact your property manager.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "default";
      case "in_progress":
        return "secondary";
      case "pending":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 bg-primary text-primary-foreground">
                  <AvatarFallback>{getInitials(tenant.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-2xl font-bold">{tenant.name}</h1>
                  <p className="text-muted-foreground">
                    {tenant.property?.address}, {tenant.property?.city}, {tenant.property?.province} {tenant.property?.postal_code} • Unit {tenant.unit?.unit_number || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-6 mb-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Email</p>
                <p className="font-medium">{tenant.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Phone</p>
                <p className="font-medium">{tenant.phone || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Monthly Rent</p>
                <p className="font-medium">${Number(tenant.monthly_rent).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Lease Status</p>
                <Badge variant={getLeaseStatusBadgeVariant(getLeaseStatus(tenant.lease_start, tenant.lease_end))}>
                  {getLeaseStatus(tenant.lease_start, tenant.lease_end)}
                </Badge>
              </div>
            </div>

            <Tabs defaultValue="lease" className="w-full">
              <TabsList>
                <TabsTrigger value="lease">Lease Details</TabsTrigger>
                <TabsTrigger value="payment">Payment History</TabsTrigger>
                <TabsTrigger value="communications">Communications</TabsTrigger>
                <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
              </TabsList>

              <TabsContent value="lease" className="space-y-6 mt-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Lease Information</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Property Address</p>
                      <p className="font-medium">
                        {tenant.property?.address || 'N/A'}, {tenant.property?.city || 'N/A'}, {tenant.property?.province || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Unit Assignment</p>
                      <p className="font-medium">Unit {tenant.unit?.unit_number || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Lease Start</p>
                      <p className="font-medium">{format(new Date(tenant.lease_start), "MMMM dd, yyyy")}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Lease End</p>
                      <p className="font-medium">{format(new Date(tenant.lease_end), "MMMM dd, yyyy")}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Security Deposit</p>
                      <p className="font-medium">${Number(tenant.security_deposit || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Tenancy Status</p>
                      <Badge variant={getLeaseStatusBadgeVariant(getLeaseStatus(tenant.lease_start, tenant.lease_end))} className="capitalize">
                        {getLeaseStatus(tenant.lease_start, tenant.lease_end)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="payment" className="mt-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">Payment History</h3>
                  <Button onClick={() => {
                    setPaymentAmount(String(tenant.monthly_rent || ""));
                    setPaymentNote("");
                    setPaymentDialogOpen(true);
                  }}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Make Payment
                  </Button>
                </div>

                {payments && payments.length > 0 ? (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Note</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{format(new Date(payment.payment_date), "MMM dd, yyyy")}</TableCell>
                            <TableCell className="font-medium">${Number(payment.amount).toLocaleString()}</TableCell>
                            <TableCell className="capitalize">{payment.payment_method.replace(/_/g, " ")}</TableCell>
                            <TableCell className="text-muted-foreground">{payment.note || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground border rounded-lg">
                    No payment history found
                  </div>
                )}
              </TabsContent>

              <TabsContent value="communications" className="mt-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">Communications</h3>
                  <Button variant="outline" onClick={() => navigate("/communications")}>
                    Open Full View
                  </Button>
                </div>
                {tenantMessages && tenantMessages.length > 0 ? (
                  <div className="space-y-4">
                    {tenantMessages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.sender === 'property_manager' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[75%] rounded-lg p-3 ${msg.sender === 'property_manager' ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                          {msg.subject && (
                            <p className={`text-xs font-semibold mb-1 ${msg.sender !== 'property_manager' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                              {msg.subject}
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                          <p className={`text-xs mt-2 ${msg.sender !== 'property_manager' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                            {format(new Date(msg.created_at), "MMM dd, yyyy h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground border rounded-lg">
                    No communications yet
                  </div>
                )}
              </TabsContent>

              <TabsContent value="maintenance" className="mt-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">Maintenance Requests</h3>
                  <Button onClick={() => navigate("/maintenance/add")}>
                    <Wrench className="mr-2 h-4 w-4" />
                    Submit New Request
                  </Button>
                </div>

                {maintenanceRequests && maintenanceRequests.length > 0 ? (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Submitted</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {maintenanceRequests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell className="font-medium">{request.title}</TableCell>
                            <TableCell className="capitalize">{request.priority}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(request.status)} className="capitalize">
                                {request.status.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>{format(new Date(request.created_at), "MMM dd, yyyy")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground border rounded-lg">
                    No maintenance requests found
                  </div>
                )}
              </TabsContent>

              <TabsContent value="documents" className="mt-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">Documents & Agreements</h3>
                </div>

                {/* Upload Section */}
                <Card className="mb-6">
                  <CardContent className="p-6">
                    <h4 className="font-medium mb-4 flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Upload Document
                    </h4>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="documentTitle">Document Title</Label>
                        <Input
                          id="documentTitle"
                          placeholder="e.g., Insurance Certificate, ID Copy"
                          value={documentTitle}
                          onChange={(e) => setDocumentTitle(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="documentFile">Select File</Label>
                        <div className="flex items-center gap-4">
                          <Input
                            id="documentFile"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            disabled={isUploading}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;

                              // Validate file type
                              const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
                              if (!allowedTypes.includes(file.type)) {
                                toast({
                                  title: "Invalid file type",
                                  description: "Please upload PDF, JPG, or PNG files only.",
                                  variant: "destructive",
                                });
                                e.target.value = '';
                                return;
                              }

                              // Validate file size (2MB)
                              const maxSize = 2 * 1024 * 1024; // 2MB in bytes
                              if (file.size > maxSize) {
                                toast({
                                  title: "File too large",
                                  description: "Maximum file size is 2MB.",
                                  variant: "destructive",
                                });
                                e.target.value = '';
                                return;
                              }

                              if (!documentTitle.trim()) {
                                toast({
                                  title: "Missing title",
                                  description: "Please enter a document title.",
                                  variant: "destructive",
                                });
                                return;
                              }

                              setIsUploading(true);
                              try {
                                // Upload to storage
                                const fileExt = file.name.split('.').pop();
                                const filePath = `${tenant.id}/${Date.now()}.${fileExt}`;

                                const { error: uploadError } = await supabase.storage
                                  .from('tenant-documents')
                                  .upload(filePath, file);

                                if (uploadError) throw uploadError;

                                // Create document record
                                const { error: dbError } = await supabase
                                  .from('tenant_documents')
                                  .insert({
                                    tenant_id: tenant.id,
                                    document_title: documentTitle.trim(),
                                    file_name: file.name,
                                    file_path: filePath,
                                    file_size: file.size,
                                    file_type: file.type,
                                    user_id: userId!,
                                  });

                                if (dbError) throw dbError;

                                toast({
                                  title: "Document uploaded",
                                  description: "Your document has been uploaded successfully.",
                                });

                                // Reset form and refresh documents
                                setDocumentTitle('');
                                e.target.value = '';
                                queryClient.invalidateQueries({ queryKey: ["tenant-documents-portal"] });
                              } catch (error: any) {
                                console.error("Error uploading document:", error);
                                toast({
                                  title: "Upload failed",
                                  description: error.message || "Failed to upload document.",
                                  variant: "destructive",
                                });
                              } finally {
                                setIsUploading(false);
                              }
                            }}
                          />
                          {isUploading && (
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <FileText className="h-3 w-3" /> PDF
                          <Image className="h-3 w-3 ml-2" /> JPG, PNG
                          <span className="ml-2">• Max 2MB</span>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {documents && documents.length > 0 ? (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Document Title</TableHead>
                          <TableHead>File Name</TableHead>
                          <TableHead>Uploaded Date</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {documents.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell className="font-medium">{doc.document_title}</TableCell>
                            <TableCell>{doc.file_name}</TableCell>
                            <TableCell>{format(new Date(doc.created_at), "MMM dd, yyyy")}</TableCell>
                            <TableCell>{(doc.file_size / 1024).toFixed(2)} KB</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const { data, error } = await supabase.storage
                                      .from('tenant-documents')
                                      .download(doc.file_path);
                                    
                                    if (error) throw error;
                                    
                                    const url = URL.createObjectURL(data);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = doc.file_name;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                  } catch (error) {
                                    toast({
                                      title: "Download failed",
                                      description: "Could not download the file. Please try again.",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground border rounded-lg">
                    No documents uploaded
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Make Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Make a Payment</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
                toast({ title: "Invalid amount", description: "Please enter a valid amount.", variant: "destructive" });
                return;
              }
              setIsProcessingPayment(true);
              try {
                const { data, error } = await supabase.functions.invoke("tenant-payment-checkout", {
                  body: {
                    amount: parseFloat(paymentAmount),
                    tenantId: tenant.id,
                    note: paymentNote,
                  },
                });
                if (error) throw error;
                if (data?.url) {
                  const isPreviewIframe = window.self !== window.top && window.location.hostname.includes("lovableproject.com");

                  if (isPreviewIframe) {
                    const link = document.createElement("a");
                    link.href = data.url;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                  } else {
                    window.location.assign(data.url);
                  }
                } else {
                  throw new Error("No checkout URL returned");
                }
              } catch (err) {
                toast({ title: "Error", description: "Failed to start payment. Please try again.", variant: "destructive" });
              } finally {
                setIsProcessingPayment(false);
              }
            }}
            className="space-y-4 mt-4"
          >
            <div className="space-y-2">
              <Label>Property</Label>
              <Input value={tenant.property?.name || tenant.property?.address || ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payAmount">Amount ($)</Label>
              <Input
                id="payAmount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payNote">Note (Optional)</Label>
              <Textarea
                id="payNote"
                placeholder="e.g., Rent for July 2025"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isProcessingPayment}>
                {isProcessingPayment ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : "Pay with Stripe"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default TenantPortal;
