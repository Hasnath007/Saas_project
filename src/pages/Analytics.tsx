import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target, Percent, Lightbulb, Building2, ChevronDown, Filter, MapPin, TrendingDown, AlertCircle } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getEffectiveUnitStatus, getUnitRevenue } from "@/lib/unitStatus";
import { AIInsightsSection } from "@/components/AIInsightsSection";
import { useAIInsights } from "@/hooks/useAIInsights";

interface PropertyWithMetrics {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  property_type: string;
  occupancy_status: string;
  purchase_price: number;
  current_value: number | null;
  down_payment: number | null;
  units: number;
  monthly_rent: number;
  cashOnCash: number;
  occupancy: number;
  occupiedUnits: number;
}

// Static market conditions data
const marketConditions = [
  {
    title: "Rental Market Conditions",
    confidence: "94% confidence",
    description: "Strong demand in urban areas with positive rent growth",
    metric: "+8.2%",
    icon: TrendingUp,
  },
  {
    title: "Demographic Shifts",
    confidence: "87% confidence",
    description: "Young professionals moving to downtown areas",
    metric: "+15%",
    icon: MapPin,
  },
  {
    title: "Economic Indicators",
    confidence: "91% confidence",
    description: "Local employment growth supporting rental demand",
    metric: "+3.1%",
    icon: TrendingUp,
  },
  {
    title: "Competitive Analysis",
    confidence: "89% confidence",
    description: "Your properties priced competitively vs market average",
    metric: "-5%",
    icon: TrendingDown,
  },
];

const Analytics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [properties, setProperties] = useState<PropertyWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  // AI Insights hook
  const { insights, loading: aiLoading, error: aiError, fetchInsights } = useAIInsights(properties);

  // Get unique property types from the properties
  const propertyTypes = Array.from(new Set(properties.map(p => p.property_type)));

  // Filter properties based on selected types
  const filteredProperties = properties.filter(property => {
    return selectedTypes.length === 0 || selectedTypes.includes(property.property_type);
  });

  const togglePropertyType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const clearFilters = () => {
    setSelectedTypes([]);
  };

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const { data: propertiesData, error: propertiesError } = await supabase
          .from("properties")
          .select("*")
          .order("created_at", { ascending: false });

        if (propertiesError) throw propertiesError;

        // Fetch metrics for each property
        const propertiesWithMetrics = await Promise.all(
          (propertiesData || []).map(async (property) => {
            const { data: units } = await supabase
              .from("units")
              .select("id, status, required_rent, current_tenant, current_lease_start, current_lease_end, incoming_tenant, incoming_lease_start, incoming_lease_end")
              .eq("property_id", property.id);

            const { data: maintenanceForUnits } = await supabase
              .from("maintenance_requests")
              .select("unit_id")
              .eq("property_id", property.id)
              .in("status", ["pending", "in_progress"]);
            
            const unitsWithMaintenance = new Set(
              maintenanceForUnits?.map(m => m.unit_id).filter(Boolean) || []
            );

            const { data: tenants } = await supabase
              .from("tenants")
              .select("monthly_rent, status, lease_start, lease_end")
              .eq("property_id", property.id);

            let monthly_rent = 0;
            let occupiedUnitsCount = 0;
            
            if (units && units.length > 0) {
              units.forEach(unit => {
                const hasActiveMaintenance = unitsWithMaintenance.has(unit.id);
                const effectiveStatus = getEffectiveUnitStatus({
                  current_tenant: unit.current_tenant,
                  current_lease_start: unit.current_lease_start,
                  current_lease_end: unit.current_lease_end,
                  incoming_tenant: unit.incoming_tenant,
                  incoming_lease_start: unit.incoming_lease_start,
                  incoming_lease_end: unit.incoming_lease_end,
                  status: unit.status,
                  hasActiveMaintenance,
                });
                
                if (effectiveStatus !== 'vacant') {
                  occupiedUnitsCount++;
                }
                
                const unitRevenue = getUnitRevenue({
                  required_rent: unit.required_rent,
                  current_lease_start: unit.current_lease_start,
                  current_lease_end: unit.current_lease_end,
                  incoming_lease_start: unit.incoming_lease_start,
                  incoming_lease_end: unit.incoming_lease_end,
                  hasActiveMaintenance,
                });
                monthly_rent += unitRevenue.monthlyRevenue;
              });
            } else {
              tenants?.forEach(tenant => {
                if (tenant.lease_start && tenant.lease_end) {
                  const today = new Date();
                  const leaseStart = new Date(tenant.lease_start);
                  const leaseEnd = new Date(tenant.lease_end);
                  
                  if (today >= leaseStart && today <= leaseEnd) {
                    monthly_rent += Number(tenant.monthly_rent || 0);
                    occupiedUnitsCount++;
                  }
                }
              });
            }

            const annual_rent = monthly_rent * 12;
            const downPayment = property.down_payment || property.purchase_price;
            const cashOnCash = downPayment > 0 
              ? (annual_rent / Number(downPayment)) * 100 
              : 0;

            const totalUnits = units?.length || property.units;
            const occupancy = totalUnits > 0 ? (occupiedUnitsCount / totalUnits) * 100 : 0;

            return {
              ...property,
              monthly_rent,
              cashOnCash,
              occupancy,
              occupiedUnits: occupiedUnitsCount,
            };
          })
        );

        setProperties(propertiesWithMetrics);
      } catch (error: any) {
        toast({
          title: "Error",
          description: "Failed to load properties",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, [toast]);

  // Fetch AI insights when properties are loaded
  useEffect(() => {
    if (properties.length > 0 && insights.length === 0 && !aiLoading && !aiError) {
      fetchInsights();
    }
  }, [properties, insights.length, aiLoading, aiError, fetchInsights]);

  // Calculate totals based on filtered properties
  const totalValue = filteredProperties.reduce((sum, prop) => {
    const value = prop.current_value ? Number(prop.current_value) : Number(prop.purchase_price);
    return sum + value;
  }, 0);
  const totalMonthlyRent = filteredProperties.reduce((sum, p) => sum + p.monthly_rent, 0);
  const totalUnits = filteredProperties.reduce((sum, p) => sum + p.units, 0);
  const totalOccupied = filteredProperties.reduce((sum, p) => sum + p.occupiedUnits, 0);
  const avgOccupancy = totalUnits > 0 ? (totalOccupied / totalUnits) * 100 : 0;
  const avgROI = filteredProperties.length > 0 
    ? filteredProperties.reduce((sum, p) => sum + p.cashOnCash, 0) / filteredProperties.length 
    : 0;

  // Prepare chart data from real properties
  const roiData = filteredProperties.map(p => ({
    name: p.name.split(' ')[0].substring(0, 8),
    roi: parseFloat(p.cashOnCash.toFixed(1))
  }));

  // Group by property type for pie chart
  const occupancyByType = filteredProperties.reduce((acc, prop) => {
    const type = prop.property_type || 'Other';
    if (!acc[type]) {
      acc[type] = { totalUnits: 0, occupiedUnits: 0 };
    }
    acc[type].totalUnits += prop.units;
    acc[type].occupiedUnits += prop.occupiedUnits;
    return acc;
  }, {} as Record<string, { totalUnits: number; occupiedUnits: number }>);

  const occupancyByTypeData = Object.entries(occupancyByType).map(([type, data], index) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' '),
    occupancy: data.totalUnits > 0 ? Math.round((data.occupiedUnits / data.totalUnits) * 100) : 0,
    fill: index === 0 ? "hsl(var(--primary))" : index === 1 ? "hsl(var(--success))" : "hsl(var(--warning))"
  }));

  // Group by city for geographic performance
  const neighborhoodData = filteredProperties.reduce((acc, prop) => {
    const city = prop.city || 'Unknown';
    if (!acc[city]) {
      acc[city] = { properties: 0, totalROI: 0, totalOccupancy: 0, totalUnits: 0, occupiedUnits: 0 };
    }
    acc[city].properties++;
    acc[city].totalROI += prop.cashOnCash;
    acc[city].totalUnits += prop.units;
    acc[city].occupiedUnits += prop.occupiedUnits;
    return acc;
  }, {} as Record<string, { properties: number; totalROI: number; totalOccupancy: number; totalUnits: number; occupiedUnits: number }>);

  const neighborhoods = Object.entries(neighborhoodData).map(([name, data]) => ({
    name,
    properties: data.properties,
    roi: `${(data.totalROI / data.properties).toFixed(1)}%`,
    occupancy: `${data.totalUnits > 0 ? ((data.occupiedUnits / data.totalUnits) * 100).toFixed(1) : 0}%`,
    rentGrowth: "5.0%",
    badge: data.totalROI / data.properties > 10 ? "Top Performer" : null,
  }));

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">Loading analytics...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Portfolio Analytics</h1>
            <p className="text-muted-foreground">Advanced insights and performance analysis for strategic decision making</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                {selectedTypes.length > 0 ? `${selectedTypes.length} Selected` : "All Types"}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover">
              <DropdownMenuCheckboxItem 
                checked={selectedTypes.length === 0} 
                onCheckedChange={clearFilters}
                className="font-medium"
              >
                All Types
              </DropdownMenuCheckboxItem>
              {selectedTypes.length > 0 && (
                <div 
                  className="px-2 py-1.5 text-sm text-destructive cursor-pointer hover:bg-muted rounded-sm mx-1 mb-1 flex items-center gap-2"
                  onClick={clearFilters}
                >
                  <span className="text-xs">✕</span> Clear Filters
                </div>
              )}
              <div className="h-px bg-border my-1" />
              <DropdownMenuCheckboxItem
                checked={selectedTypes.includes("single-family")}
                onCheckedChange={() => togglePropertyType("single-family")}
                className="font-semibold"
              >
                Single Family
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={selectedTypes.includes("multi-family")}
                onCheckedChange={() => togglePropertyType("multi-family")}
                className="font-semibold"
              >
                Multi-Family
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={selectedTypes.includes("commercial")}
                onCheckedChange={() => togglePropertyType("commercial")}
                className="font-semibold"
              >
                Commercial
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">
                ${totalValue >= 1000000 ? (totalValue / 1000000).toFixed(1) + 'M' : totalValue.toLocaleString()}
              </h3>
              <p className="text-sm text-muted-foreground">Portfolio Value</p>
              <p className="text-xs text-muted-foreground mt-1">{filteredProperties.length} properties</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-success/10">
                  <Target className="h-5 w-5 text-success" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">{avgROI.toFixed(1)}%</h3>
              <p className="text-sm text-muted-foreground">Average ROI</p>
              <p className="text-xs text-success mt-1">Cash on Cash Return</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Percent className="h-5 w-5 text-warning" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">{avgOccupancy.toFixed(1)}%</h3>
              <p className="text-sm text-muted-foreground">Occupancy Rate</p>
              <p className="text-xs text-muted-foreground mt-1">{totalOccupied}/{totalUnits} units occupied</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-chart-3/10">
                  <Lightbulb className="h-5 w-5 text-chart-3" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">${totalMonthlyRent.toLocaleString()}</h3>
              <p className="text-sm text-muted-foreground">Monthly Revenue</p>
              <p className="text-xs text-success mt-1">Expected rental income</p>
            </CardContent>
          </Card>
        </div>

        {/* Property Performance */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Property Performance</h2>
            {selectedTypes.length > 0 && (
              <Badge variant="secondary">
                Showing {filteredProperties.length} of {properties.length} properties
              </Badge>
            )}
          </div>

          {filteredProperties.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium text-muted-foreground">No properties found</p>
                <p className="text-sm text-muted-foreground">
                  {selectedTypes.length > 0 
                    ? "Try adjusting your filters" 
                    : "Add properties to see analytics"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProperties.map((property) => (
                <Card key={property.id} className="overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1">{property.name}</h3>
                        <p className="text-sm text-muted-foreground">{property.city}, {property.province} • {property.units} units</p>
                      </div>
                      <Badge variant="secondary" className="capitalize">{property.property_type}</Badge>
                    </div>

                    <div className="bg-muted/30 rounded-lg h-24 flex items-center justify-center mb-4">
                      <Building2 className="h-8 w-8 text-muted-foreground/40" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`h-2 w-2 rounded-full ${property.occupancy >= 90 ? 'bg-success' : property.occupancy >= 70 ? 'bg-warning' : 'bg-destructive'}`} />
                          <span className="text-xs text-muted-foreground">Occupancy</span>
                        </div>
                        <p className="text-lg font-bold">{property.occupancy.toFixed(0)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          Monthly Rent
                          <TrendingUp className="h-3 w-3" />
                        </p>
                        <p className="text-lg font-bold text-success">
                          ${property.monthly_rent.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          Cash on Cash
                          <TrendingUp className="h-3 w-3" />
                        </p>
                        <p className={`text-lg font-bold ${property.cashOnCash < 0 ? 'text-destructive' : 'text-success'}`}>
                          {property.cashOnCash.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          Market Value
                          <TrendingUp className="h-3 w-3" />
                        </p>
                        <p className="text-lg font-bold">
                          ${((property.current_value || property.purchase_price) / 1000).toFixed(0)}K
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Performance</p>
                        <Badge 
                          variant={property.cashOnCash >= 8 ? "default" : property.cashOnCash >= 5 ? "secondary" : "destructive"}
                        >
                          {property.cashOnCash >= 8 ? "Excellent" : property.cashOnCash >= 5 ? "Good" : "Needs Attention"}
                        </Badge>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/properties/${property.id}`)}>
                        View Details
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Charts Section */}
        {filteredProperties.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>ROI Comparison</CardTitle>
                <p className="text-sm text-muted-foreground">Cash on Cash return by property</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={roiData}>
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value) => [`${value}%`, 'ROI']} />
                    <Bar dataKey="roi" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Occupancy by Property Type</CardTitle>
                <p className="text-sm text-muted-foreground">Average occupancy rates across property categories</p>
              </CardHeader>
              <CardContent>
                {occupancyByTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={occupancyByTypeData}
                        dataKey="occupancy"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ type, occupancy }) => `${type}: ${occupancy}%`}
                      >
                        {occupancyByTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value}%`, 'Occupancy']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* AI-Powered Insights */}
        <AIInsightsSection
          insights={insights}
          loading={aiLoading}
          error={aiError}
          onRefresh={fetchInsights}
          onPropertyClick={(propertyId) => navigate(`/properties/${propertyId}`)}
        />
        {neighborhoods.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Geographic Performance</CardTitle>
              <p className="text-sm text-muted-foreground">Performance metrics by city/location</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {neighborhoods.map((area, idx) => (
                  <Card key={idx}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold mb-1">{area.name}</h4>
                          <p className="text-sm text-muted-foreground">{area.properties} {area.properties === 1 ? 'property' : 'properties'}</p>
                        </div>
                        {area.badge && (
                          <Badge className="bg-success/10 text-success border-success/20">
                            {area.badge}
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Avg ROI</span>
                          <span className="text-sm font-semibold">{area.roi}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Occupancy</span>
                          <span className="text-sm font-semibold">{area.occupancy}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rental Market Conditions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {marketConditions.map((condition, idx) => (
            <Card key={idx}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <condition.icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <h3 className="font-semibold mb-2">{condition.title}</h3>
                <p className="text-xs text-success mb-2">{condition.confidence}</p>
                <p className="text-sm text-muted-foreground mb-3">{condition.description}</p>
                <div className="flex items-center justify-between">
                  <span className={`text-2xl font-bold ${condition.metric.includes('-') ? 'text-destructive' : 'text-success'}`}>
                    {condition.metric}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Market Alerts & Opportunities */}
        <Card>
          <CardHeader>
            <CardTitle>Market Alerts & Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Card className="border-success/20 bg-success/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-success/10">
                      <TrendingUp className="h-5 w-5 text-success" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">Prime Investment Window</h4>
                        <Badge className="bg-success/10 text-success border-success/20">High Confidence</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Current market conditions show strong rental demand growth in your portfolio areas.
                      </p>
                      <Button variant="outline" size="sm">View Analysis</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-warning/20 bg-warning/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-warning/10">
                      <AlertCircle className="h-5 w-5 text-warning" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">Competition Alert</h4>
                        <Badge className="bg-warning/10 text-warning border-warning/20">Monitor</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        New developments in your market areas may impact competitive positioning.
                      </p>
                      <Button variant="outline" size="sm">Review Impact</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Analytics;
