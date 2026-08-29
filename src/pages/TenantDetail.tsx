import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Edit, Trash2, Plus, Upload, Download, FileText } from "lucide-react";
import { format } from "date-fns";
import { getLeaseStatus, getLeaseStatusBadgeVariant } from "@/lib/leaseStatus";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { GrantPortalAccessDialog } from "@/components/GrantPortalAccessDialog";
import { SendInvoiceDialog } from "@/components/SendInvoiceDialog";

export default function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isTenant } = useUserRole();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isGrantAccessDialogOpen, setIsGrantAccessDialogOpen] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    document_title: "",
    file: null as File | null,
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_date: format(new Date(), "yyyy-MM-dd"),
    payment_method: "bank_transfer",
    note: "",
  });

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select(`
          *,
          property:properties(name, address, city, province),
          unit:units(unit_number)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["payments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("tenant_id", id)
        .order("payment_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: documents } = useQuery({
    queryKey: ["tenant-documents", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_documents")
        .select("*")
        .eq("tenant_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch maintenance requests for this tenant's unit
  const { data: maintenanceRequests } = useQuery({
    queryKey: ["tenant-maintenance", id, tenant?.unit_id, tenant?.property_id],
    queryFn: async () => {
      if (!tenant?.property_id) return [];
      let query = supabase
        .from("maintenance_requests")
        .select("*")
        .eq("property_id", tenant.property_id)
        .order("created_at", { ascending: false });
      if (tenant.unit_id) {
        query = query.eq("unit_id", tenant.unit_id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!tenant?.property_id,
  });

  // Fetch messages for this tenant
  const { data: tenantMessages } = useQuery({
    queryKey: ["tenant-messages", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("tenant_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("payments")
        .insert({
          ...paymentData,
          tenant_id: id,
          user_id: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments", id] });
      toast({
        title: "Success",
        description: "Payment recorded successfully",
      });
      setIsDialogOpen(false);
      setPaymentForm({
        amount: "",
        payment_date: format(new Date(), "yyyy-MM-dd"),
        payment_method: "bank_transfer",
        note: "",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to record payment",
        variant: "destructive",
      });
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (formData: { document_title: string; file: File }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("User not authenticated");

      // Upload file to Supabase Storage
      const fileExt = formData.file.name.split(".").pop();
      const fileName = `${userData.user.id}/${id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("tenant-documents")
        .upload(fileName, formData.file);

      if (uploadError) throw uploadError;

      // Create database record
      const { data, error } = await supabase
        .from("tenant_documents")
        .insert({
          tenant_id: id,
          user_id: userData.user.id,
          document_title: formData.document_title,
          file_name: formData.file.name,
          file_path: fileName,
          file_size: formData.file.size,
          file_type: formData.file.type,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-documents", id] });
      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
      setIsUploadDialogOpen(false);
      setUploadForm({ document_title: "", file: null });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to upload document",
        variant: "destructive",
      });
    },
  });

  const deleteTenantMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("tenants")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast({
        title: "Success",
        description: "Tenant deleted successfully",
      });
      navigate("/tenants");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete tenant",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (3MB = 3 * 1024 * 1024 bytes)
    const maxSize = 3 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "File size must not exceed 3MB",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Only PDF, DOCX, JPG, and PNG files are allowed",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

    setUploadForm({ ...uploadForm, file });
  };

  const handleSubmitUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file || !uploadForm.document_title) {
      toast({
        title: "Missing information",
        description: "Please provide document title and select a file",
        variant: "destructive",
      });
      return;
    }
    uploadDocumentMutation.mutate({
      document_title: uploadForm.document_title,
      file: uploadForm.file,
    });
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    createPaymentMutation.mutate({
      amount: parseFloat(paymentForm.amount),
      payment_date: paymentForm.payment_date,
      payment_method: paymentForm.payment_method,
      note: paymentForm.note || null,
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-8">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!tenant) {
    return (
      <DashboardLayout>
        <div className="p-8">Tenant not found</div>
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
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 bg-primary text-primary-foreground">
                  <AvatarFallback>{getInitials(tenant.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-2xl font-bold">{tenant.name}</h1>
                  <p className="text-muted-foreground">
                    {tenant.property?.name || 'Unknown Property'} • Unit {tenant.unit?.unit_number || 'N/A'}
                  </p>
                </div>
              </div>
              {!isTenant && (
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => navigate(`/tenants/${id}/edit`)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {tenant.name}? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            deleteTenantMutation.mutate();
                            setIsDeleteDialogOpen(false);
                          }}
                          disabled={deleteTenantMutation.isPending}
                        >
                          {deleteTenantMutation.isPending ? "Deleting..." : "Delete"}
                        </Button>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button onClick={() => setIsGrantAccessDialogOpen(true)}>Grant Portal Access</Button>
                  <GrantPortalAccessDialog
                    open={isGrantAccessDialogOpen}
                    onOpenChange={setIsGrantAccessDialogOpen}
                    tenantEmail={tenant.email}
                    tenantName={tenant.name}
                    tenantId={id!}
                    propertyName={tenant.property?.name}
                    propertyAddress={tenant.property?.address}
                  />
                </div>
              )}
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
                  <div className="flex gap-2">
                    {!isTenant && (
                      <Button variant="outline" onClick={() => setIsInvoiceDialogOpen(true)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Send Invoice
                      </Button>
                    )}
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="mr-2 h-4 w-4" />
                          Record Payment
                        </Button>
                      </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Record Payment</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleSubmitPayment} className="space-y-4 mt-4">
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
                          <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createPaymentMutation.isPending}>
                            Record Payment
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                  </div>
                </div>
                {!isTenant && tenant && (
                  <SendInvoiceDialog
                    open={isInvoiceDialogOpen}
                    onOpenChange={setIsInvoiceDialogOpen}
                    tenantName={tenant.name}
                    tenantEmail={tenant.email}
                    tenantId={id!}
                    monthlyRent={Number(tenant.monthly_rent)}
                    propertyName={tenant.property?.name}
                    unitNumber={tenant.unit?.unit_number}
                    onInvoiceSent={() => queryClient.invalidateQueries({ queryKey: ["tenant-messages", id] })}
                  />
                )}

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
                    No payment schedule found
                  </div>
                )}
              </TabsContent>

              <TabsContent value="communications" className="mt-6">
                <h3 className="text-lg font-semibold mb-4">Communications</h3>
                {tenantMessages && tenantMessages.length > 0 ? (
                  <div className="space-y-4">
                    {tenantMessages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.sender === 'property_manager' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-lg p-3 ${msg.sender === 'property_manager' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          {msg.subject && (
                            <p className={`text-xs font-semibold mb-1 ${msg.sender === 'property_manager' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                              {msg.subject}
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                          <p className={`text-xs mt-2 ${msg.sender === 'property_manager' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
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
                {!maintenanceRequests || maintenanceRequests.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No maintenance requests found for this tenant
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {maintenanceRequests.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="font-medium">{req.title}</TableCell>
                          <TableCell>
                            <Badge variant={req.priority === "high" ? "destructive" : req.priority === "medium" ? "default" : "secondary"}>
                              {req.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{req.status}</Badge>
                          </TableCell>
                          <TableCell>{format(new Date(req.created_at), "MMM d, yyyy")}</TableCell>
                          <TableCell className="max-w-[300px] truncate">{req.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="documents" className="mt-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">Documents & Agreements</h3>
                  <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Lease
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Upload Lease Agreement</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleSubmitUpload} className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="document_title">Document Title</Label>
                          <Input
                            id="document_title"
                            placeholder="Lease Agreement 2024"
                            value={uploadForm.document_title}
                            onChange={(e) => setUploadForm({ ...uploadForm, document_title: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="file">File</Label>
                          <Input
                            id="file"
                            type="file"
                            accept=".pdf,.docx,.jpg,.jpeg,.png"
                            onChange={handleFileChange}
                            required
                          />
                          <p className="text-sm text-muted-foreground">
                            Supported formats: PDF, DOCX, JPG, PNG (Max 20MB)
                          </p>
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                          <Button type="button" variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={uploadDocumentMutation.isPending}>
                            Upload
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

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
    </DashboardLayout>
  );
}
