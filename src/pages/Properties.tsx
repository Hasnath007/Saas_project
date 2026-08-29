import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, MapPin, TrendingUp, Users, Plus, Eye, Settings, Search, Filter, AlertCircle, Calendar, TrendingDown, DollarSign, ChevronDown } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getEffectiveUnitStatus, getUnitRevenue } from "@/lib/unitStatus";

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
  units: number;
  timezone: string;
  monthly_rent: number;
  cashOnCash: number;
  occupancy: number;
}

interface MaintenanceRequest {
  id: string;
  property_id: string;
  unit_id: string | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  property_name?: string;
}

const Properties = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [properties, setProperties] = useState<PropertyWithMetrics[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState<string | null>(null);

  // Get unique property types from the properties
  const propertyTypes = Array.from(new Set(properties.map(p => p.property_type)));
  
  // Get search suggestions (properties that match the current search query)
  const searchSuggestions = properties.filter(property => {
    if (!searchQuery) return false;
    const query = searchQuery.toLowerCase();
    return (
      property.name.toLowerCase().includes(query) ||
      property.address.toLowerCase().includes(query) ||
      property.city.toLowerCase().includes(query)
    );
  }).slice(0, 5); // Limit to 5 suggestions
  
  // Filter properties based on search and selected types
  const filteredProperties = properties.filter(property => {
    const matchesSearch = searchQuery === "" || 
      property.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.city.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = selectedTypes.length === 0 || selectedTypes.includes(property.property_type);
    
    return matchesSearch && matchesType;
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

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Show suggestions if there's input - the filtering will happen based on the new value
    setShowSearchSuggestions(value.length > 0);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setShowSearchSuggestions(false);
    }
    if (e.key === 'Escape') {
      setShowSearchSuggestions(false);
    }
  };

  const handleSelectSuggestion = (property: PropertyWithMetrics) => {
    setSearchQuery(property.name);
    setShowSearchSuggestions(false);
  };

  const handleSearchBlur = () => {
    // Delay closing to allow clicking on suggestions
    setTimeout(() => {
      setShowSearchSuggestions(false);
    }, 200);
  };

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const { data: propertiesData, error: propertiesError } = await supabase
          .from("properties")
          .select("*")
          .order("created_at", { ascending: false });

        if (propertiesError) throw propertiesError;

        // Fetch tenants and units for each property to calculate metrics
        const propertiesWithMetrics = await Promise.all(
          (propertiesData || []).map(async (property) => {
            // Get units for this property with required_rent and lease info
            const { data: units } = await supabase
              .from("units")
              .select("id, status, required_rent, current_tenant, current_lease_start, current_lease_end, incoming_tenant, incoming_lease_start, incoming_lease_end")
              .eq("property_id", property.id);

            // Get maintenance requests for units in this property
            const { data: maintenanceForUnits } = await supabase
              .from("maintenance_requests")
              .select("unit_id")
              .eq("property_id", property.id)
              .in("status", ["pending", "in_progress"]);
            
            const unitsWithMaintenance = new Set(
              maintenanceForUnits?.map(m => m.unit_id).filter(Boolean) || []
            );

            // Get tenants for this property (for single-family properties without units)
            const { data: tenants } = await supabase
              .from("tenants")
              .select("monthly_rent, status, lease_start, lease_end")
              .eq("property_id", property.id);

            // Calculate monthly rent based on lease dates (not stored status):
            // - If property has units: use units.required_rent for units with active leases
            // - If property has no units (single-family): use tenants.monthly_rent for active tenants
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
                
                // Count occupied units based on effective status
                if (effectiveStatus !== 'vacant') {
                  occupiedUnitsCount++;
                }
                
                // Calculate monthly rent from units with active leases
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
              // For single-family properties without units, use tenant data
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

            // Calculate Cash On Cash (annual rent / down payment or purchase price * 100)
            const annual_rent = monthly_rent * 12;
            const downPayment = property.down_payment || property.purchase_price;
            const cashOnCash = downPayment > 0 
              ? (annual_rent / Number(downPayment)) * 100 
              : 0;

            // Calculate occupancy based on effective status
            const totalUnits = units?.length || property.units;
            const occupancy = totalUnits > 0 ? (occupiedUnitsCount / totalUnits) * 100 : 0;

            return {
              ...property,
              monthly_rent,
              cashOnCash,
              occupancy,
            };
          })
        );

        setProperties(propertiesWithMetrics);

        // Fetch maintenance requests (pending and in_progress)
        const { data: maintenanceData, error: maintenanceError } = await supabase
          .from("maintenance_requests")
          .select("*")
          .in("status", ["pending", "in_progress"])
          .order("created_at", { ascending: false });

        if (!maintenanceError && maintenanceData) {
          // Map property names to maintenance requests
          const maintenanceWithPropertyNames = maintenanceData.map(m => ({
            ...m,
            property_name: propertiesWithMetrics.find(p => p.id === m.property_id)?.name || "Unknown Property"
          }));
          setMaintenanceRequests(maintenanceWithPropertyNames);
        }
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">Loading properties...</div>
      </DashboardLayout>
    );
  }

  const totalValue = filteredProperties.reduce((sum, prop) => {
    const value = prop.current_value ? Number(prop.current_value) : Number(prop.purchase_price);
    return sum + value;
  }, 0);
  const totalUnits = filteredProperties.reduce((sum, prop) => sum + prop.units, 0);

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Properties</h1>
            <p className="text-muted-foreground">Manage your property portfolio</p>
          </div>
          <Button className="gap-2" onClick={() => navigate("/properties/add")}>
            <Plus className="h-4 w-4" />
            Add Property
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Portfolio Value"
            value={`$${totalValue >= 1000000 ? (totalValue / 1000000).toFixed(1) + 'M' : totalValue.toLocaleString()}`}
            change="12.5%"
            trend="up"
            subtitle={`${filteredProperties.length} properties`}
            icon={Building2}
            iconColor="bg-primary"
          />
          <StatCard
            title="Monthly Revenue"
            value={`$${filteredProperties.reduce((sum, p) => sum + p.monthly_rent, 0).toLocaleString()}`}
            change="8.2%"
            trend="up"
            subtitle="Expected Value"
            icon={DollarSign}
            iconColor="bg-success"
          />
          <StatCard
            title="Occupancy Rate"
            value={`${totalUnits > 0 ? ((filteredProperties.reduce((sum, p) => {
              // Count occupied units for each property
              return sum + Math.round((p.occupancy / 100) * p.units);
            }, 0) / totalUnits) * 100).toFixed(1) : 0}%`}
            change="2.1%"
            trend="up"
            subtitle={`${totalUnits} units`}
            icon={Users}
            iconColor="bg-info"
          />
          <StatCard
            title="Total Units"
            value={totalUnits.toString()}
            change="5%"
            trend="up"
            subtitle={`Across ${filteredProperties.length} properties`}
            icon={MapPin}
            iconColor="bg-accent"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="properties" className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList>
              <TabsTrigger value="properties" className="gap-2">
                <Building2 className="w-4 h-4" />
                Properties
              </TabsTrigger>
              <TabsTrigger value="performance" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Performance
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <TrendingDown className="w-4 h-4" />
                Analytics
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 z-10" />
                <Input
                  placeholder="Search properties..."
                  className="pl-10 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSearchSuggestions(true)}
                  onBlur={handleSearchBlur}
                />
                {showSearchSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50">
                    <Command>
                      <CommandList>
                        <CommandGroup heading="Properties">
                          {searchSuggestions.map((property) => (
                            <CommandItem
                              key={property.id}
                              value={property.name}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectSuggestion(property);
                              }}
                              className="cursor-pointer"
                            >
                              <Building2 className="mr-2 h-4 w-4" />
                              <div className="flex-1">
                                <p className="text-sm font-medium">{property.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {property.city}, {property.province}
                                </p>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </div>
                )}
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
          </div>

          {/* Properties Tab */}
          <TabsContent value="properties">
            {filteredProperties.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {properties.length === 0 ? "No Properties Yet" : "No Properties Found"}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {properties.length === 0 
                      ? "Get started by adding your first property"
                      : "Try adjusting your search or filters"}
                  </p>
                  {properties.length === 0 && (
                    <Button onClick={() => navigate("/properties/add")}>
                      Add Your First Property
                    </Button>
                  )}
                  {properties.length > 0 && (
                    <Button onClick={() => { setSearchQuery(""); clearFilters(); }}>
                      Clear Filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredProperties.map((property) => (
                  <Card key={property.id} className="overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-6">
                        {/* Left side - Property info */}
                        <div className="flex-1">
                          <div className="flex items-start gap-4 mb-4">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <h3 
                                className="text-xl font-semibold text-foreground mb-2 cursor-pointer hover:text-primary transition-colors"
                                onClick={() => navigate(`/properties/${property.id}`)}
                              >
                                {property.name}
                              </h3>
                              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                                <MapPin className="w-4 h-4" />
                                <span className="text-sm">{property.address}, {property.city}, {property.province}</span>
                              </div>
                              <div className="flex gap-2">
                                <Badge variant="secondary">{property.property_type.replace("-", " ")}</Badge>
                                <Badge variant="outline" className="capitalize">
                                  {property.occupancy_status?.replace("-", " ") || "owner-occupied"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right side - Metrics and actions */}
                        <div className="flex flex-col items-end gap-4">
                          <div className="grid grid-cols-3 gap-6 text-right">
                            <div>
                              <p className="text-sm font-bold text-foreground mb-1">Monthly Rent</p>
                              <p className="text-lg font-semibold text-foreground">
                                ${property.monthly_rent.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground mb-1">Cash On Cash</p>
                              <p className="text-lg font-semibold text-foreground">
                                {(property.cashOnCash ?? 0).toFixed(1)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground mb-1">Occupancy</p>
                              <p className="text-lg font-semibold text-foreground">
                                {(property.occupancy ?? 0).toFixed(0)}%
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="gap-2"
                              onClick={() => navigate(`/properties/${property.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="gap-2"
                              onClick={() => navigate(`/properties/${property.id}/edit`)}
                            >
                              <Settings className="h-4 w-4" />
                              Manage
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Property Performance Rankings */}
              <Card>
                <CardHeader>
                  <CardTitle>Property Performance Rankings</CardTitle>
                  <CardDescription>Click a property to filter maintenance alerts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {filteredProperties
                    .sort((a, b) => b.cashOnCash - a.cashOnCash)
                    .map((property, index) => (
                      <div 
                        key={property.id} 
                        className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedPropertyFilter === property.id 
                            ? 'border-primary bg-primary/5' 
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedPropertyFilter(
                          selectedPropertyFilter === property.id ? null : property.id
                        )}
                      >
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{property.name}</h4>
                          <p className="text-sm text-muted-foreground capitalize">{property.property_type.replace("-", " ")}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">{(property.cashOnCash ?? 0).toFixed(1)}% CoC</p>
                          <p className="text-sm text-muted-foreground">{(property.occupancy ?? 0).toFixed(0)}% Occupied</p>
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>

              {/* Maintenance Alerts */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Maintenance Alerts</CardTitle>
                      <CardDescription>
                        {selectedPropertyFilter 
                          ? `Showing alerts for ${filteredProperties.find(p => p.id === selectedPropertyFilter)?.name || 'selected property'}`
                          : 'All pending and in-progress maintenance'
                        }
                      </CardDescription>
                    </div>
                    {selectedPropertyFilter && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedPropertyFilter(null)}
                      >
                        Clear filter
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(() => {
                    const filteredMaintenance = selectedPropertyFilter
                      ? maintenanceRequests.filter(m => m.property_id === selectedPropertyFilter)
                      : maintenanceRequests;
                    
                    if (filteredMaintenance.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No pending or in-progress maintenance alerts</p>
                        </div>
                      );
                    }

                    return filteredMaintenance.map((request) => (
                      <div 
                        key={request.id}
                        className={`p-4 border rounded-lg ${
                          request.priority === 'high' || request.priority === 'urgent'
                            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                            : request.status === 'in_progress'
                            ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900'
                            : 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <AlertCircle className={`w-5 h-5 mt-0.5 ${
                            request.priority === 'high' || request.priority === 'urgent'
                              ? 'text-red-600'
                              : request.status === 'in_progress'
                              ? 'text-blue-600'
                              : 'text-orange-600'
                          }`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-foreground">{request.title}</h4>
                              <Badge variant={request.status === 'in_progress' ? 'default' : 'secondary'} className="text-xs">
                                {request.status.replace('_', ' ')}
                              </Badge>
                              {(request.priority === 'high' || request.priority === 'urgent') && (
                                <Badge variant="destructive" className="text-xs">
                                  {request.priority}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{request.property_name}</p>
                            <p className="text-sm text-muted-foreground mt-1">{request.description}</p>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Portfolio Trends */}
              <Card>
                <CardHeader>
                  <CardTitle>Portfolio Trends</CardTitle>
                  <CardDescription>6-month performance overview</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">Portfolio Value Growth</span>
                      <span className="text-sm font-bold text-green-600">+12.5%</span>
                    </div>
                    <Progress value={75} className="h-3" />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">Rental Income Growth</span>
                      <span className="text-sm font-bold text-green-600">+8.2%</span>
                    </div>
                    <Progress value={65} className="h-3" />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">Occupancy Rate</span>
                      <span className="text-sm font-bold text-foreground">96.8%</span>
                    </div>
                    <Progress value={96.8} className="h-3" />
                  </div>
                </CardContent>
              </Card>

              {/* Market Insights */}
              <Card>
                <CardHeader>
                  <CardTitle>Market Insights</CardTitle>
                  <CardDescription>AI-powered market analysis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                    <div className="flex items-start gap-3">
                      <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground">Market Opportunity</h4>
                        <p className="text-sm text-muted-foreground">Austin market showing 15% rent increase potential</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
                    <div className="flex items-start gap-3">
                      <DollarSign className="w-5 h-5 text-green-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground">Investment Recommendation</h4>
                        <p className="text-sm text-muted-foreground">Consider expanding in Riverside neighborhood</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground">Risk Alert</h4>
                        <p className="text-sm text-muted-foreground">Monitor vacancy rates in downtown area</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Properties;
