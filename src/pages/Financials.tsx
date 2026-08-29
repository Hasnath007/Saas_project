import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Percent, Building2, Users, Receipt, ChevronLeft, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CashFlowChart } from "@/components/CashFlowChart";
import { Last24HoursActivity } from "@/components/Last24HoursActivity";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { getUnitRevenue, getEffectiveUnitStatus } from "@/lib/unitStatus";

interface TenantInvoice {
  id: string;
  name: string;
  property: string;
  unit: string | null;
  rent: number;
  dueDate: string;
  balance: number;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  status: 'paid' | 'partial' | 'pending' | 'overdue';
}

interface IncomeRecord {
  id: string;
  tenantName: string | null;
  propertyName: string;
  unitName: string | null;
  category: string;
  amount: number;
  date: string;
  source: 'income' | 'tenant';
}

interface ExpenseRecord {
  id: string;
  propertyName: string;
  unitName: string | null;
  amount: number;
  date: string;
  category: string;
}

const RECORDS_PER_PAGE = 10;

const Financials = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tenantInvoices, setTenantInvoices] = useState<TenantInvoice[]>([]);
  const [incomeRecords, setIncomeRecords] = useState<IncomeRecord[]>([]);
  const [expenseRecords, setExpenseRecords] = useState<ExpenseRecord[]>([]);
  const [incomeTotals, setIncomeTotals] = useState({ total: 0, count: 0 });
  const [expenseTotals, setExpenseTotals] = useState({ total: 0, count: 0 });
  
  // Pagination state
  const [incomePage, setIncomePage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);
  const [incomeTotalPages, setIncomeTotalPages] = useState(1);
  const [expenseTotalPages, setExpenseTotalPages] = useState(1);
  
  const [stats, setStats] = useState({
    totalPortfolioValue: 0,
    totalProperties: 0,
    monthlyRevenue: 0,
    expectedRevenue: 0,
    occupancyRate: 0,
    totalUnits: 0,
    occupiedUnits: 0,
    vacantUnits: 0,
  });

  useEffect(() => {
    fetchFinancialsData();
  }, []);

  useEffect(() => {
    fetchIncomeExpenseData();
  }, [incomePage, expensePage]);

  useEffect(() => {
    const channel = supabase
      .channel('financials-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'units' },
        () => fetchFinancialsData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'properties' },
        () => {
          fetchFinancialsData();
          fetchIncomeExpenseData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        () => fetchFinancialsData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'property_income' },
        () => {
          // Reset to first page on data changes
          setIncomePage(1);
          fetchIncomeExpenseData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'property_expenses' },
        () => {
          // Reset to first page on data changes
          setExpensePage(1);
          fetchIncomeExpenseData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchFinancialsData = async () => {
    try {
      setLoading(true);

      const { data: properties, error: propertiesError } = await supabase
        .from("properties")
        .select("*");

      if (propertiesError) throw propertiesError;

      const { data: units, error: unitsError } = await supabase
        .from("units")
        .select("id, property_id, status, required_rent, current_lease_start, current_lease_end, incoming_lease_start, incoming_lease_end, current_tenant, incoming_tenant");

      if (unitsError) throw unitsError;

      // Fetch pending and in-progress maintenance requests
      const { data: maintenanceRequests, error: maintenanceError } = await supabase
        .from("maintenance_requests")
        .select("id, unit_id")
        .in("status", ["pending", "in_progress"]);

      if (maintenanceError) throw maintenanceError;
      
      // Create a set of unit IDs with active maintenance
      const unitsWithMaintenance = new Set(
        maintenanceRequests?.map(m => m.unit_id).filter(Boolean) || []
      );

      const { data: tenants, error: tenantsError } = await supabase
        .from("tenants")
        .select(`
          id, 
          name,
          property_id, 
          unit_id,
          monthly_rent, 
          status,
          balance,
          lease_start,
          lease_end,
          properties (name, address),
          units (unit_number)
        `);

      if (tenantsError) throw tenantsError;

      // Fetch payments for all tenants
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("tenant_id, amount, payment_date")
        .order("payment_date", { ascending: false });

      if (paymentsError) throw paymentsError;

      // Group payments by tenant_id, get most recent payment for each
      const latestPaymentByTenant: Record<string, { amount: number; date: string }> = {};
      payments?.forEach(payment => {
        if (!latestPaymentByTenant[payment.tenant_id]) {
          latestPaymentByTenant[payment.tenant_id] = {
            amount: Number(payment.amount),
            date: payment.payment_date,
          };
        }
      });

      // Build tenant invoices for payment collection status
      const currentDate = new Date();
      const dueDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      
      const invoices: TenantInvoice[] = (tenants || [])
        .filter(t => t.status === 'active')
        .map(tenant => {
          const lastPayment = latestPaymentByTenant[tenant.id];
          const rent = Number(tenant.monthly_rent || 0);
          const balance = Number(tenant.balance || 0);
          
          // Determine payment status for current month
          let status: TenantInvoice['status'] = 'pending';
          if (lastPayment) {
            const paymentDate = new Date(lastPayment.date);
            const isCurrentMonth = paymentDate.getMonth() === currentDate.getMonth() && 
                                   paymentDate.getFullYear() === currentDate.getFullYear();
            if (isCurrentMonth) {
              if (lastPayment.amount >= rent) {
                status = 'paid';
              } else if (lastPayment.amount > 0) {
                status = 'partial';
              }
            }
          }
          
          // If past due date and not paid, mark as overdue
          if (status === 'pending' && currentDate.getDate() > 5) {
            status = 'overdue';
          }
          
          return {
            id: tenant.id,
            name: tenant.name,
            property: tenant.properties?.address || tenant.properties?.name || 'Unknown',
            unit: tenant.units?.unit_number || null,
            rent,
            dueDate: format(dueDate, 'MMM d, yyyy'),
            balance,
            lastPaymentDate: lastPayment?.date || null,
            lastPaymentAmount: lastPayment?.amount || null,
            status,
          };
        });
      
      setTenantInvoices(invoices);

      const totalPortfolioValue = properties?.reduce((sum, prop) => {
        const value = prop.current_value ? Number(prop.current_value) : Number(prop.purchase_price);
        return sum + value;
      }, 0) || 0;

      const totalProperties = properties?.length || 0;

      const propertiesWithUnits = new Set(units?.map(u => u.property_id) || []);

      // Calculate revenue using lease-based status (same as Dashboard)
      let monthlyRevenue = 0;
      let expectedRevenue = 0;

      units?.forEach(unit => {
        const hasActiveMaintenance = unitsWithMaintenance.has(unit.id);
        
        const unitRevenue = getUnitRevenue({
          required_rent: unit.required_rent,
          current_lease_start: unit.current_lease_start,
          current_lease_end: unit.current_lease_end,
          incoming_lease_start: unit.incoming_lease_start,
          incoming_lease_end: unit.incoming_lease_end,
          hasActiveMaintenance,
        });
        
        monthlyRevenue += unitRevenue.monthlyRevenue;
        expectedRevenue += unitRevenue.expectedRevenue;
      });

      // Add tenant rent for properties without units (single-family)
      tenants?.forEach(tenant => {
        if (!propertiesWithUnits.has(tenant.property_id)) {
          const rent = Number(tenant.monthly_rent || 0);
          
          // Check if tenant lease is active
          if (tenant.lease_start && tenant.lease_end) {
            const today = new Date();
            const leaseStart = new Date(tenant.lease_start);
            const leaseEnd = new Date(tenant.lease_end);
            
            if (today >= leaseStart && today <= leaseEnd) {
              monthlyRevenue += rent;
              expectedRevenue += rent;
            }
          }
        }
      });

      // Calculate occupancy based on effective lease status (same as Dashboard)
      const totalUnits = units?.length || 0;
      const occupiedUnits = units?.filter(unit => {
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
        return effectiveStatus !== "vacant";
      }).length || 0;
      const vacantUnits = totalUnits - occupiedUnits;
      const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

      setStats({
        totalPortfolioValue,
        totalProperties,
        monthlyRevenue,
        expectedRevenue,
        occupancyRate,
        totalUnits,
        occupiedUnits,
        vacantUnits,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch financial data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchIncomeExpenseData = async () => {
    try {
      // Fetch properties for name mapping
      const { data: properties, error: propertiesError } = await supabase
        .from("properties")
        .select("id, name, address");

      if (propertiesError) throw propertiesError;

      const propertyMap = new Map(
        properties?.map(p => [p.id, p.name || p.address]) || []
      );

      // Fetch units for name mapping
      const { data: units, error: unitsError } = await supabase
        .from("units")
        .select("id, unit_number, property_id");

      if (unitsError) throw unitsError;

      const unitMap = new Map(
        units?.map(u => [u.id, u.unit_number]) || []
      );

      // Fetch all property income records
      const { data: allIncomeData, error: allIncomeError } = await supabase
        .from("property_income")
        .select("*")
        .order("created_at", { ascending: false });

      if (allIncomeError) throw allIncomeError;

      // Fetch all active tenants with their rent
      const { data: tenants, error: tenantsError } = await supabase
        .from("tenants")
        .select("id, name, property_id, unit_id, monthly_rent, status, created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (tenantsError) throw tenantsError;

      // Fetch payments for last payment mapping (for potential future use)
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("tenant_id, payment_date")
        .order("payment_date", { ascending: false });

      if (paymentsError) throw paymentsError;

      // Map property income records
      const incomeFromProperty: IncomeRecord[] = (allIncomeData || []).map(inc => {
        const incWithUnit = inc as typeof inc & { unit_id?: string | null };
        return {
          id: inc.id,
          tenantName: null,
          propertyName: propertyMap.get(inc.property_id) || 'Unknown Property',
          unitName: incWithUnit.unit_id ? unitMap.get(incWithUnit.unit_id) || null : null,
          category: inc.category,
          amount: Number(inc.amount),
          date: inc.created_at,
          source: 'income' as const,
        };
      });

      // Map tenant rent records
      const incomeFromTenants: IncomeRecord[] = (tenants || []).map(tenant => {
        return {
          id: `tenant-${tenant.id}`,
          tenantName: tenant.name,
          propertyName: propertyMap.get(tenant.property_id) || 'Unknown Property',
          unitName: tenant.unit_id ? unitMap.get(tenant.unit_id) || null : null,
          category: 'Rent',
          amount: Number(tenant.monthly_rent),
          date: tenant.created_at,
          source: 'tenant' as const,
        };
      });

      // Combine and sort by date (most recent first)
      const combinedIncome = [...incomeFromProperty, ...incomeFromTenants]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Calculate pagination
      const incomeOffset = (incomePage - 1) * RECORDS_PER_PAGE;
      const expenseOffset = (expensePage - 1) * RECORDS_PER_PAGE;

      const paginatedIncome = combinedIncome.slice(incomeOffset, incomeOffset + RECORDS_PER_PAGE);

      // Fetch expense records with pagination
      const { data: expenseData, error: expenseError, count: expenseCount } = await supabase
        .from("property_expenses")
        .select("*", { count: 'exact' })
        .order("created_at", { ascending: false })
        .range(expenseOffset, expenseOffset + RECORDS_PER_PAGE - 1);

      if (expenseError) throw expenseError;

      // Fetch all expenses for totals
      const { data: allExpenses, error: allExpensesError } = await supabase
        .from("property_expenses")
        .select("amount");

      if (allExpensesError) throw allExpensesError;

      // Map expense records
      const mappedExpenses: ExpenseRecord[] = (expenseData || []).map(exp => {
        const expWithUnit = exp as typeof exp & { unit_id?: string | null };
        return {
          id: exp.id,
          propertyName: propertyMap.get(exp.property_id) || 'Unknown Property',
          unitName: expWithUnit.unit_id ? unitMap.get(expWithUnit.unit_id) || null : null,
          amount: Number(exp.amount),
          date: exp.created_at,
          category: exp.category,
        };
      });

      setIncomeRecords(paginatedIncome);
      setExpenseRecords(mappedExpenses);
      
      // Update total pages
      setIncomeTotalPages(Math.ceil(combinedIncome.length / RECORDS_PER_PAGE) || 1);
      setExpenseTotalPages(Math.ceil((expenseCount || 0) / RECORDS_PER_PAGE) || 1);
      
      // Calculate income totals (property income + tenant rents)
      const totalPropertyIncome = allIncomeData?.reduce((sum, inc) => sum + Number(inc.amount), 0) || 0;
      const totalTenantRents = tenants?.reduce((sum, t) => sum + Number(t.monthly_rent), 0) || 0;
      setIncomeTotals({
        total: totalPropertyIncome + totalTenantRents,
        count: combinedIncome.length,
      });
      setExpenseTotals({
        total: allExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0,
        count: allExpenses?.length || 0,
      });
    } catch (error: any) {
      console.error("Error fetching income/expense data:", error);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatFrequencyBadge = (frequency: string) => {
    const colors: Record<string, string> = {
      'monthly': 'bg-primary/10 text-primary border-primary/20',
      'annually': 'bg-chart-3/10 text-chart-3 border-chart-3/20',
      'quarterly': 'bg-warning/10 text-warning border-warning/20',
      'one-time': 'bg-muted/50 text-muted-foreground border-muted',
    };
    return colors[frequency] || 'bg-muted/50 text-muted-foreground border-muted';
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Financial Management</h1>
            <p className="text-muted-foreground">Comprehensive financial overview with automated rent collection and deep insights</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/reports")}>Tax Documents</Button>
            <Button variant="outline" onClick={() => navigate("/reports")}>P&L Report</Button>
            <Button variant="outline" onClick={() => navigate("/reports")}>Owner Statements</Button>
            <Button onClick={() => navigate("/reports")}>Export All</Button>
          </div>
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
              <h3 className="text-2xl font-bold mb-1">{loading ? "Loading..." : formatCurrency(stats.totalPortfolioValue)}</h3>
              <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
              <p className="text-xs text-success mt-1">↑ 12.5%</p>
              <p className="text-xs text-muted-foreground">{stats.totalProperties} {stats.totalProperties === 1 ? 'property' : 'properties'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-success/10">
                  <DollarSign className="h-5 w-5 text-success" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">{loading ? "Loading..." : `$${stats.monthlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</h3>
              <p className="text-sm text-muted-foreground">Monthly Revenue</p>
              <p className="text-xs text-success mt-1">↑ 8.2%</p>
              <p className="text-xs text-muted-foreground">${stats.expectedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Expected Value</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-chart-3/10">
                  <Users className="h-5 w-5 text-chart-3" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">{loading ? "Loading..." : `${stats.occupancyRate.toFixed(1)}%`}</h3>
              <p className="text-sm text-muted-foreground">Occupancy Rate</p>
              <p className="text-xs text-success mt-1">↑ 2.1%</p>
              <p className="text-xs text-muted-foreground">{stats.occupiedUnits}/{stats.totalUnits} units</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-success/10">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">$32,400</h3>
              <p className="text-sm text-muted-foreground">Net Operating Income</p>
              <p className="text-xs text-success mt-1">71.7% margin</p>
              <p className="text-xs text-muted-foreground">After all operating expenses</p>
            </CardContent>
          </Card>
        </div>

        {/* Payment Collection Status – Income */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-success" />
                  Payment Collection Status – Income
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {incomeTotals.count} {incomeTotals.count === 1 ? 'record' : 'records'} • Total: ${incomeTotals.total.toLocaleString()}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No income records found
                    </TableCell>
                  </TableRow>
                ) : (
                  incomeRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.propertyName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.unitName || '—'}
                      </TableCell>
                      <TableCell>{record.category || '—'}</TableCell>
                      <TableCell className="text-success font-medium">
                        +${(record.amount ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {record.date ? format(new Date(record.date), 'MMM d, yyyy') : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            
            {/* Income Pagination Controls */}
            {incomeTotals.count > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {incomePage} of {incomeTotalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIncomePage(prev => Math.max(1, prev - 1))}
                    disabled={incomePage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIncomePage(prev => Math.min(incomeTotalPages, prev + 1))}
                    disabled={incomePage === incomeTotalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Collection Status – Expenses */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-destructive" />
                  Payment Collection Status – Expenses
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {expenseTotals.count} {expenseTotals.count === 1 ? 'record' : 'records'} • Total: ${expenseTotals.total.toLocaleString()}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No expense records found
                    </TableCell>
                  </TableRow>
                ) : (
                  expenseRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.propertyName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.unitName || '—'}
                      </TableCell>
                      <TableCell>{record.category}</TableCell>
                      <TableCell className="text-destructive font-medium">
                        -${record.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {format(new Date(record.date), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            
            {/* Expenses Pagination Controls */}
            {expenseTotals.count > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {expensePage} of {expenseTotalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpensePage(prev => Math.max(1, prev - 1))}
                    disabled={expensePage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpensePage(prev => Math.min(expenseTotalPages, prev + 1))}
                    disabled={expensePage === expenseTotalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cash Flow Analysis */}
        <div className="mb-8">
          <CashFlowChart />
        </div>

        {/* Automated Workflows */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Automated Workflows</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">4 active workflows • 532 total actions performed</p>
              </div>
              <Button variant="outline" size="sm">Configure</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">3-Day Payment Reminder</h4>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">Active</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Daily check • Last: Nov 15, 7:35 PM • Next: Nov 16, 7:35 PM</p>
                <p className="text-xs text-muted-foreground mt-1">147 actions</p>
              </div>
              <Switch checked />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">Auto Late Fee Application</h4>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">Active</Badge>
                </div>
                <p className="text-sm text-muted-foreground">After 5 days overdue • Last: Nov 14, 9:35 PM • Next: Nov 17, 9:35 PM</p>
                <p className="text-xs text-muted-foreground mt-1">23 actions</p>
              </div>
              <Switch checked />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">ACH Payment Processing</h4>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">Active</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Every business day • Last: Nov 15, 1:35 PM • Next: Nov 16, 1:35 PM</p>
                <p className="text-xs text-muted-foreground mt-1">342 actions</p>
              </div>
              <Switch checked />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">Monthly Owner Reports</h4>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">Active</Badge>
                </div>
                <p className="text-sm text-muted-foreground">1st of each month • Last: Nov 7, 9:35 PM • Next: Dec 7, 9:35 PM</p>
                <p className="text-xs text-muted-foreground mt-1">12 actions</p>
              </div>
              <Switch checked />
            </div>

            <Last24HoursActivity />
          </CardContent>
        </Card>

        {/* AI Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Schedule E Generation</CardTitle>
              <p className="text-sm text-muted-foreground">Tax document automation</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Automatically generate Schedule E tax forms with all income and expense categories properly categorized.</p>
              <Button variant="outline" className="w-full">Generate Tax Documents</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cash Flow Forecasting</CardTitle>
              <p className="text-sm text-muted-foreground">Predictive financial planning</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">AI-powered cash flow predictions based on lease terms, historical data, and market trends.</p>
              <Button variant="outline" className="w-full">View Forecasting</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Expense Categorization</CardTitle>
              <p className="text-sm text-muted-foreground">Smart expense tracking</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Automatically categorize expenses for accurate reporting and tax preparation with AI assistance.</p>
              <Button variant="outline" className="w-full">Review Categories</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Financials;
