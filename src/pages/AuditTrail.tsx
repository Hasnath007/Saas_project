import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Download, ChevronDown, ArrowUpRight, ArrowDownRight, DollarSign, FileText, ClipboardList } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type DatePreset = "6months" | "month" | "quarter" | "year" | "custom";

interface AuditEntry {
  id: string;
  type: "income" | "expense" | "payment";
  category: string;
  description: string;
  amount: number;
  date: string;
  propertyName: string;
  tenantName?: string;
  paymentMethod?: string;
}

const AuditTrail = () => {
  const [loading, setLoading] = useState(true);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>("6months");
  const [startDate, setStartDate] = useState<Date>(subMonths(new Date(), 6));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    fetchAuditData();
  }, [startDate, endDate]);

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    
    switch (preset) {
      case "6months":
        setStartDate(subMonths(now, 6));
        setEndDate(now);
        break;
      case "month":
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
      case "quarter":
        setStartDate(startOfQuarter(now));
        setEndDate(endOfQuarter(now));
        break;
      case "year":
        setStartDate(startOfYear(now));
        setEndDate(endOfYear(now));
        break;
      case "custom":
        break;
    }
  };

  const fetchAuditData = async () => {
    try {
      setLoading(true);
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      // Fetch properties for names
      const { data: properties } = await supabase
        .from("properties")
        .select("id, name, address");

      const propertyMap = new Map(properties?.map(p => [p.id, { name: p.name, address: p.address }]) || []);

      // Fetch income entries
      const { data: incomeData } = await supabase
        .from("property_income")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr + "T23:59:59");

      // Fetch expense entries
      const { data: expenseData } = await supabase
        .from("property_expenses")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr + "T23:59:59");

      // Fetch payments with tenant info - need to fetch tenants separately since no FK
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr + "T23:59:59");
      
      if (paymentsError) {
        console.error("Error fetching payments:", paymentsError);
      }

      // Fetch tenants to map tenant names
      const { data: tenantsData } = await supabase
        .from("tenants")
        .select("id, name, property_id");
      
      const tenantMap = new Map(tenantsData?.map(t => [t.id, { name: t.name, property_id: t.property_id }]) || []);

      const entries: AuditEntry[] = [];

      // Add income entries
      incomeData?.forEach(income => {
        const property = propertyMap.get(income.property_id);
        entries.push({
          id: income.id,
          type: "income",
          category: income.category,
          description: income.description || `${income.category} income`,
          amount: income.amount,
          date: income.created_at,
          propertyName: property?.name || "Unknown",
        });
      });

      // Add expense entries
      expenseData?.forEach(expense => {
        const property = propertyMap.get(expense.property_id);
        entries.push({
          id: expense.id,
          type: "expense",
          category: expense.category,
          description: expense.description || `${expense.category} expense`,
          amount: expense.amount,
          date: expense.created_at,
          propertyName: property?.name || "Unknown",
        });
      });

      // Add payment entries
      paymentsData?.forEach(payment => {
        const tenant = tenantMap.get(payment.tenant_id);
        const property = propertyMap.get(tenant?.property_id || "");
        entries.push({
          id: payment.id,
          type: "payment",
          category: "Rent Payment",
          description: payment.note || "Monthly rent payment",
          amount: payment.amount,
          date: payment.created_at,
          propertyName: property?.name || "Unknown",
          tenantName: tenant?.name || "Unknown Tenant",
          paymentMethod: payment.payment_method,
        });
      });

      // Sort by date descending
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setAuditEntries(entries);
    } catch (error) {
      console.error("Error fetching audit data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = typeFilter === "all" 
    ? auditEntries 
    : auditEntries.filter(e => e.type === typeFilter);

  const exportToCSV = () => {
    const headers = ["Date", "Type", "Category", "Description", "Tenant", "Payment Method", "Property", "Amount"];
    const rows = filteredEntries.map(entry => [
      format(new Date(entry.date), "yyyy-MM-dd HH:mm"),
      entry.type.charAt(0).toUpperCase() + entry.type.slice(1),
      entry.category,
      entry.description,
      entry.tenantName || "—",
      entry.paymentMethod || "—",
      entry.propertyName,
      entry.type === "expense" ? `-$${entry.amount.toFixed(2)}` : `$${entry.amount.toFixed(2)}`
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `financial-audit-${format(startDate, "yyyy-MM-dd")}-to-${format(endDate, "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "income":
        return <ArrowUpRight className="h-4 w-4 text-green-500" />;
      case "expense":
        return <ArrowDownRight className="h-4 w-4 text-red-500" />;
      case "payment":
        return <DollarSign className="h-4 w-4 text-blue-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, string> = {
      income: "bg-green-100 text-green-700 border-green-200",
      expense: "bg-red-100 text-red-700 border-red-200",
      payment: "bg-blue-100 text-blue-700 border-blue-200",
    };
    return (
      <Badge variant="outline" className={cn("capitalize font-medium", variants[type])}>
        {type}
      </Badge>
    );
  };

  const formatPaymentMethod = (method: string) => {
    const methodLabels: Record<string, string> = {
      bank_transfer: "Bank Transfer",
      cash: "Cash",
      check: "Check",
      credit_card: "Credit Card",
      manual: "Manual Entry",
    };
    return methodLabels[method] || method;
  };

  const totals = {
    income: auditEntries.filter(e => e.type === "income").reduce((sum, e) => sum + e.amount, 0),
    expense: auditEntries.filter(e => e.type === "expense").reduce((sum, e) => sum + e.amount, 0),
    payments: auditEntries.filter(e => e.type === "payment").reduce((sum, e) => sum + e.amount, 0),
  };

  const netCashFlow = totals.income + totals.payments - totals.expense;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Professional Header */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl p-6 border">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <ClipboardList className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Financial Audit Report</h1>
                <p className="text-muted-foreground">
                  Complete financial transaction history • {format(startDate, "MMM d, yyyy")} - {format(endDate, "MMM d, yyyy")}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Net Cash Flow</p>
              <p className={cn("text-2xl font-bold", netCashFlow >= 0 ? "text-green-600" : "text-red-600")}>
                {netCashFlow >= 0 ? "+" : ""} ${netCashFlow.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card 
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              typeFilter === "income" && "ring-2 ring-green-500"
            )} 
            onClick={() => setTypeFilter(typeFilter === "income" ? "all" : "income")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Income</p>
                  <p className="text-2xl font-bold text-green-600">${totals.income.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {auditEntries.filter(e => e.type === "income").length} transactions
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <ArrowUpRight className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              typeFilter === "expense" && "ring-2 ring-red-500"
            )} 
            onClick={() => setTypeFilter(typeFilter === "expense" ? "all" : "expense")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600">${totals.expense.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {auditEntries.filter(e => e.type === "expense").length} transactions
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <ArrowDownRight className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              typeFilter === "payment" && "ring-2 ring-blue-500"
            )} 
            onClick={() => setTypeFilter(typeFilter === "payment" ? "all" : "payment")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Rent Payments Received</p>
                  <p className="text-2xl font-bold text-blue-600">${totals.payments.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {auditEntries.filter(e => e.type === "payment").length} payments
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Date Range & Export */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Filter & Export</CardTitle>
                {typeFilter !== "all" && (
                  <Badge variant="secondary" className="capitalize">
                    {typeFilter} only
                    <button 
                      className="ml-1 hover:text-destructive" 
                      onClick={(e) => { e.stopPropagation(); setTypeFilter("all"); }}
                    >
                      ×
                    </button>
                  </Badge>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                {/* Date Presets */}
                <div className="flex gap-1">
                  <Button
                    variant={datePreset === "6months" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePresetChange("6months")}
                  >
                    6 Months
                  </Button>
                  <Button
                    variant={datePreset === "month" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePresetChange("month")}
                  >
                    Month
                  </Button>
                  <Button
                    variant={datePreset === "quarter" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePresetChange("quarter")}
                  >
                    Quarter
                  </Button>
                  <Button
                    variant={datePreset === "year" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePresetChange("year")}
                  >
                    Year
                  </Button>
                </div>

                {/* Custom Date Pickers */}
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Calendar className="h-4 w-4" />
                        {format(startDate, "MMM d, yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => {
                          if (date) {
                            setStartDate(date);
                            setDatePreset("custom");
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground">to</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Calendar className="h-4 w-4" />
                        {format(endDate, "MMM d, yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => {
                          if (date) {
                            setEndDate(date);
                            setDatePreset("custom");
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Collapsible open={isExportOpen} onOpenChange={setIsExportOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export Options
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", isExportOpen && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={exportToCSV} className="gap-2">
                    <Download className="h-4 w-4" />
                    Export as CSV
                  </Button>
                  <Button variant="outline" onClick={() => window.print()} className="gap-2">
                    <FileText className="h-4 w-4" />
                    Print / Save as PDF
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* Audit Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Transaction Details ({filteredEntries.length} entries)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No transactions found</p>
                <p className="text-sm">Try adjusting the date range or filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold">Category</TableHead>
                      <TableHead className="font-semibold">Tenant</TableHead>
                      <TableHead className="font-semibold">Payment Method</TableHead>
                      <TableHead className="font-semibold">Property</TableHead>
                      <TableHead className="font-semibold">Description</TableHead>
                      <TableHead className="text-right font-semibold">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((entry) => (
                      <TableRow key={`${entry.type}-${entry.id}`} className="hover:bg-muted/30">
                        <TableCell className="whitespace-nowrap font-medium">
                          {format(new Date(entry.date), "MMM d, yyyy")}
                          <span className="block text-xs text-muted-foreground">
                            {format(new Date(entry.date), "h:mm a")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTypeIcon(entry.type)}
                            {getTypeBadge(entry.type)}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{entry.category}</TableCell>
                        <TableCell>
                          {entry.tenantName ? (
                            <span className="font-medium">{entry.tenantName}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.paymentMethod ? (
                            <Badge variant="outline" className="text-xs">
                              {formatPaymentMethod(entry.paymentMethod)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{entry.propertyName}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {entry.description}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          <span className={entry.type === "expense" ? "text-red-600" : "text-green-600"}>
                            {entry.type === "expense" ? "-" : "+"}${entry.amount.toLocaleString()}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AuditTrail;
