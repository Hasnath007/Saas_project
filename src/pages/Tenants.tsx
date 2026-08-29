import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, AlertTriangle, DollarSign, Plus, Calendar, MessageSquare, CreditCard } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { getLeaseStatus, getLeaseStatusBadgeVariant } from "@/lib/leaseStatus";
import { RecordPaymentDialog } from "@/components/RecordPaymentDialog";

const Tenants = () => {
  const navigate = useNavigate();
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [leaseRenewalFilter, setLeaseRenewalFilter] = useState(false);
  const [selectedTenantForPayment, setSelectedTenantForPayment] = useState<{
    property_id: string;
    property_name: string;
    unit_id?: string;
    unit_number?: string;
    tenant_id: string;
    tenant_name: string;
  } | null>(null);

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("tenants")
        .select(`
          *,
          property:properties(name),
          unit:units(unit_number)
        `)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const activeTenants = tenants?.filter((t) => t.status === "active").length || 0;
  const expiringLeases = tenants?.filter((t) => {
    const daysUntilEnd = differenceInDays(new Date(t.lease_end), new Date());
    return daysUntilEnd <= 90 && daysUntilEnd > 0;
  }).length || 0;
  const totalBalance = tenants?.reduce((sum, t) => sum + Number(t.balance), 0) || 0;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-8">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Tenant Management</h1>
            <p className="text-muted-foreground">Build better relationships and manage all tenant interactions</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant={leaseRenewalFilter ? "default" : "outline"}
              onClick={() => setLeaseRenewalFilter(!leaseRenewalFilter)}
            >
              Lease Renewals
            </Button>
            <Button className="gap-2" onClick={() => navigate("/add-tenant")}>
              <Plus className="h-4 w-4" />
              Add Tenant
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">{activeTenants}</h3>
              <p className="text-sm text-muted-foreground">Active Tenants</p>
              <p className="text-xs text-muted-foreground mt-1">{tenants?.length || 0} total tenants</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-warning/10">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">{expiringLeases}</h3>
              <p className="text-sm text-muted-foreground">Expiring Leases</p>
              <p className="text-xs text-muted-foreground mt-1">Need renewal attention</p>
            </CardContent>
          </Card>


          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <DollarSign className="h-5 w-5 text-destructive" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">${totalBalance.toLocaleString()}</h3>
              <p className="text-sm text-muted-foreground">Outstanding Balance</p>
              <p className="text-xs text-muted-foreground mt-1">Across all tenants</p>
            </CardContent>
          </Card>
        </div>

        {/* Automation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Lease Renewals</CardTitle>
              </div>
              <CardDescription>Automated reminders</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Automatic renewal reminders at 90, 60, and 30 days with market rate analysis.
              </p>
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                  3 reminders sent
                </Badge>
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                  2 renewals due
                </Badge>
              </div>
            </CardContent>
          </Card>


          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Payment Automation</CardTitle>
              </div>
              <CardDescription>Smart reminders</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Payment reminders with personalized messaging based on tenant history and preferences.
              </p>
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                  97.8% collection rate
                </Badge>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  3.2 day avg
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tenants List */}
        <div className="space-y-4">
          {(() => {
            // Filter tenants based on lease renewal filter (30-60 days until lease end)
            const filteredTenants = leaseRenewalFilter
              ? tenants?.filter((t) => {
                  const daysUntilEnd = differenceInDays(new Date(t.lease_end), new Date());
                  return daysUntilEnd >= 30 && daysUntilEnd <= 60;
                })
              : tenants;

            if (!filteredTenants || filteredTenants.length === 0) {
              return (
                <Card>
                  <CardContent className="p-12 text-center">
                    <p className="text-muted-foreground mb-4">
                      {leaseRenewalFilter 
                        ? "No tenants with leases expiring in 30-60 days." 
                        : "No tenants yet. Add your first tenant to get started."}
                    </p>
                    {!leaseRenewalFilter && (
                      <Button onClick={() => navigate("/add-tenant")} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Tenant
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            }

            return filteredTenants.map((tenant) => (
              <Card key={tenant.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <Avatar className="h-12 w-12 flex-shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground">{getInitials(tenant.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 min-w-0">
                        <div className="min-w-0">
                          <button
                            onClick={() => navigate(`/tenants/${tenant.id}`)}
                            className="font-semibold mb-1 hover:underline text-left truncate block max-w-full"
                          >
                            {tenant.name}
                          </button>
                          <p className="text-sm text-muted-foreground truncate">
                            {tenant.property.name}
                            {tenant.unit && ` • Unit ${tenant.unit.unit_number}`}
                          </p>
                          <Badge variant={getLeaseStatusBadgeVariant(getLeaseStatus(tenant.lease_start, tenant.lease_end))} className="mt-2 capitalize">{getLeaseStatus(tenant.lease_start, tenant.lease_end)}</Badge>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground mb-1">Phone</p>
                          <p className="text-sm mb-1 truncate">{tenant.phone || "N/A"}</p>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="text-sm truncate">{tenant.email}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Monthly Rent</p>
                          <p className="text-sm font-semibold mb-2">${Number(tenant.monthly_rent).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground mb-1">Balance</p>
                          <p className={`text-sm font-semibold ${Number(tenant.balance) > 0 ? 'text-destructive' : Number(tenant.balance) < 0 ? 'text-success' : ''}`}>
                            ${Number(tenant.balance).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Lease Ends</p>
                          <p className="text-sm">{format(new Date(tenant.lease_end), "MMM dd, yyyy")}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 lg:self-center">
                      <Button variant="outline" size="sm" className="gap-1">
                        <MessageSquare className="h-3 w-3" />
                        Message
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-1"
                        onClick={() => {
                          setSelectedTenantForPayment({
                            property_id: tenant.property_id,
                            property_name: tenant.property.name,
                            unit_id: tenant.unit_id || undefined,
                            unit_number: tenant.unit?.unit_number || undefined,
                            tenant_id: tenant.id,
                            tenant_name: tenant.name,
                          });
                          setIsPaymentDialogOpen(true);
                        }}
                      >
                        <CreditCard className="h-3 w-3" />
                        Payment
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ));
          })()}
        </div>

        <RecordPaymentDialog
          open={isPaymentDialogOpen}
          onOpenChange={setIsPaymentDialogOpen}
          preselectedData={selectedTenantForPayment || undefined}
        />
      </div>
    </DashboardLayout>
  );
};

export default Tenants;
