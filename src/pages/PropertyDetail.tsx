import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getEffectiveUnitStatus, UnitLeaseInfo } from "@/lib/unitStatus";
import { PropertyIncomeExpenses } from "@/components/PropertyIncomeExpenses";

interface Unit {
  id: string;
  unit_number: string;
  description: string | null;
  size_sqft: number | null;
  required_rent: number | null;
  required_deposit: number | null;
  current_tenant: string | null;
  current_lease_start: string | null;
  current_lease_end: string | null;
  incoming_tenant: string | null;
  incoming_lease_start: string | null;
  incoming_lease_end: string | null;
  status: string;
  status_until: string | null;
  hasActiveMaintenance?: boolean;
}

const PropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [property, setProperty] = useState<any>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPropertyAndUnits = async () => {
      try {
        const { data: propertyData, error: propertyError } = await supabase
          .from("properties")
          .select("*")
          .eq("id", id)
          .single();

        if (propertyError) throw propertyError;
        setProperty(propertyData);

        const { data: unitsData, error: unitsError } = await supabase
          .from("units")
          .select("*")
          .eq("property_id", id)
          .order("unit_number");

        if (unitsError && unitsError.code !== "PGRST116") throw unitsError;

        // Fetch maintenance requests for this property
        const { data: maintenanceData } = await supabase
          .from("maintenance_requests")
          .select("unit_id, status")
          .eq("property_id", id)
          .in("status", ["pending", "in_progress"]);

        // Create a set of unit IDs that have active maintenance
        const unitsWithMaintenance = new Set(
          maintenanceData?.map(m => m.unit_id).filter(Boolean) || []
        );

        // Mark units with active maintenance
        const unitsWithMaintenanceFlag = (unitsData || []).map(unit => ({
          ...unit,
          hasActiveMaintenance: unitsWithMaintenance.has(unit.id),
        }));

        setUnits(unitsWithMaintenanceFlag);
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

    fetchPropertyAndUnits();
  }, [id, navigate, toast]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this property?")) return;

    try {
      const { error } = await supabase
        .from("properties")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Property deleted successfully",
      });
      navigate("/properties");
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete property",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const getStatusBadge = (unit: Unit) => {
    // Calculate dynamic status based on lease dates
    const unitInfo: UnitLeaseInfo = {
      current_tenant: unit.current_tenant,
      current_lease_start: unit.current_lease_start,
      current_lease_end: unit.current_lease_end,
      incoming_tenant: unit.incoming_tenant,
      incoming_lease_start: unit.incoming_lease_start,
      incoming_lease_end: unit.incoming_lease_end,
      status: unit.status,
      hasActiveMaintenance: unit.hasActiveMaintenance,
    };
    
    const effectiveStatus = getEffectiveUnitStatus(unitInfo);
    
    const statusColors: Record<string, string> = {
      occupied: "bg-blue-500 hover:bg-blue-600",
      vacant: "bg-gray-500 hover:bg-gray-600",
      repairs: "bg-red-500 hover:bg-red-600",
    };

    return (
      <Badge className={statusColors[effectiveStatus] || statusColors.vacant}>
        {effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!property) return null;

  return (
    <DashboardLayout>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            className="gap-2 mb-4"
            onClick={() => navigate("/properties")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{property.name}</h1>
              <p className="text-muted-foreground mt-1">{property.address}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate(`/properties/${id}/edit`)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleDelete}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Property Details Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Property Name</label>
                <p className="text-base text-foreground mt-1">{property.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Property Type</label>
                <p className="text-base text-foreground mt-1 capitalize">
                  {property.property_type.replace("-", " ")}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Timezone
                </label>
                <p className="text-base text-foreground mt-1">{property.timezone}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Address</label>
                <p className="text-base text-foreground mt-1">
                  {property.address}, {property.city}, {property.province} {property.postal_code || ""}
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="text-base text-foreground mt-1">No description provided</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-4">
              {/* Column 1: Purchase Price, Down Payment, Monthly Rent */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-foreground">Purchase Price</label>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {formatCurrency(property.purchase_price)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-bold text-foreground">Down Payment</label>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {formatCurrency(property.down_payment)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-bold text-foreground">Monthly Rent</label>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {formatCurrency(units.reduce((sum, unit) => sum + (unit.required_rent || 0), 0))}
                  </p>
                </div>
              </div>

              {/* Column 2: Purchase Date, Cash On Cash */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-foreground">Purchase Date</label>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {formatDate(property.purchase_date)}
                  </p>
                </div>
                <div className="md:mt-[52px]">
                  <label className="text-sm font-bold text-foreground">Cash On Cash</label>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {(() => {
                      const monthlyRent = units.reduce((sum, unit) => sum + (unit.required_rent || 0), 0);
                      const annualRent = monthlyRent * 12;
                      const downPayment = property.down_payment || property.purchase_price;
                      const coc = downPayment > 0 ? (annualRent / downPayment) * 100 : 0;
                      return `${coc.toFixed(1)}%`;
                    })()}
                  </p>
                </div>
              </div>

              {/* Column 3: Current Value, Occupancy */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-foreground">Current Value</label>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {formatCurrency(property.current_value || property.purchase_price)}
                  </p>
                </div>
                <div className="md:mt-[52px]">
                  <label className="text-sm font-bold text-foreground">Occupancy</label>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {(() => {
                      const occupiedUnits = units.filter(u => u.status === 'occupied').length;
                      const totalUnits = units.length;
                      const occupancy = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
                      return `${occupancy.toFixed(0)}%`;
                    })()}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Units Section */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">Units</h2>
              <p className="text-sm text-muted-foreground">
                Manage individual units within this property
              </p>
            </div>

            {units.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No units added yet. Click "Edit" to add units to this property.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Size (sqft)</TableHead>
                      <TableHead>Required Rent</TableHead>
                      <TableHead>Req. Deposit</TableHead>
                      <TableHead>Current Tenant</TableHead>
                      <TableHead>Current Lease</TableHead>
                      <TableHead>Incoming Tenant</TableHead>
                      <TableHead>Incoming Lease</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {units.map((unit) => (
                      <TableRow key={unit.id}>
                        <TableCell className="font-medium">{unit.unit_number}</TableCell>
                        <TableCell>{unit.description || "-"}</TableCell>
                        <TableCell>{unit.size_sqft || "-"}</TableCell>
                        <TableCell>{unit.required_rent ? formatCurrency(unit.required_rent) : "$0"}</TableCell>
                        <TableCell>{unit.required_deposit ? formatCurrency(unit.required_deposit) : "$-"}</TableCell>
                        <TableCell>{unit.current_tenant || "-"}</TableCell>
                        <TableCell>
                          {unit.current_lease_start && unit.current_lease_end
                            ? `${formatDate(unit.current_lease_start)} to ${formatDate(unit.current_lease_end)}`
                            : "-"}
                        </TableCell>
                        <TableCell>{unit.incoming_tenant || "-"}</TableCell>
                        <TableCell>
                          {unit.incoming_lease_start && unit.incoming_lease_end
                            ? `${formatDate(unit.incoming_lease_start)} to ${formatDate(unit.incoming_lease_end)}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(unit)}
                          {unit.status_until && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Until {formatDate(unit.status_until)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="gap-1"
                            onClick={() => navigate(`/units/${unit.id}/edit`)}
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Income and Expenses Section */}
        <div className="mt-6">
          <h2 className="text-xl font-bold text-foreground mb-4">Income & Expenses</h2>
          <PropertyIncomeExpenses propertyId={id!} />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PropertyDetail;
