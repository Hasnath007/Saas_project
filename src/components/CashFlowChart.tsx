import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, subYears, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

interface ExpenseBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

type DatePreset = "month" | "quarter" | "6months" | "year" | "custom";

export const CashFlowChart = () => {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<MonthlyData[]>([]);
  const [totals, setTotals] = useState({ income: 0, expenses: 0, net: 0, profitMargin: 0 });
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdown[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  
  // Date range state
  const [datePreset, setDatePreset] = useState<DatePreset>("6months");
  const [startDate, setStartDate] = useState<Date>(subMonths(new Date(), 6));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  useEffect(() => {
    fetchCashFlowData();
  }, [startDate, endDate]);

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    
    switch (preset) {
      case "month":
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
      case "quarter":
        setStartDate(startOfQuarter(now));
        setEndDate(endOfQuarter(now));
        break;
      case "6months":
        setStartDate(subMonths(now, 6));
        setEndDate(now);
        break;
      case "year":
        setStartDate(subYears(now, 1));
        setEndDate(now);
        break;
      case "custom":
        // Keep current dates for custom
        break;
    }
  };

  const convertToMonthly = (amount: number, frequency: string): number => {
    switch (frequency) {
      case "one_time":
        return 0; // One-time doesn't contribute to recurring monthly
      case "annually":
        return amount / 12;
      case "quarterly":
        return amount / 3;
      default:
        return amount;
    }
  };

  const fetchCashFlowData = async () => {
    try {
      setLoading(true);

      // Fetch ALL income entries (we need to apply recurring amounts across all months)
      const { data: incomeData, error: incomeError } = await supabase
        .from("property_income")
        .select("category, amount, frequency, created_at");

      if (incomeError) throw incomeError;

      // Fetch ALL expense entries
      const { data: expenseData, error: expenseError } = await supabase
        .from("property_expenses")
        .select("category, amount, frequency, created_at");

      if (expenseError) throw expenseError;

      // Generate month keys for the selected period
      const monthsInRange: { key: string; label: string; start: Date; end: Date }[] = [];
      let current = startOfMonth(startDate);
      const rangeEnd = endOfMonth(endDate);
      
      while (current <= rangeEnd) {
        monthsInRange.push({
          key: format(current, "yyyy-MM"),
          label: format(current, "MMM"),
          start: startOfMonth(current),
          end: endOfMonth(current),
        });
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      }

      // Initialize monthly data with 0 for each month
      const monthlyIncomeMap: Record<string, number> = {};
      const monthlyExpenseMap: Record<string, number> = {};
      monthsInRange.forEach(m => {
        monthlyIncomeMap[m.key] = 0;
        monthlyExpenseMap[m.key] = 0;
      });

      // Process income entries - apply recurring amounts to each applicable month
      (incomeData || []).forEach((entry) => {
        const entryDate = new Date(entry.created_at);
        const amount = Number(entry.amount);
        const frequency = entry.frequency;

        monthsInRange.forEach(monthData => {
          // Check if this entry was created before or during this month
          if (entryDate <= monthData.end) {
            if (frequency === "monthly") {
              monthlyIncomeMap[monthData.key] += amount;
            } else if (frequency === "annually") {
              // Apply 1/12 of annual amount each month
              monthlyIncomeMap[monthData.key] += amount / 12;
            } else if (frequency === "quarterly") {
              // Apply 1/3 of quarterly amount each month
              monthlyIncomeMap[monthData.key] += amount / 3;
            } else if (frequency === "one_time" || frequency === "one-time") {
              // One-time: only add if the entry was created in this specific month
              if (format(entryDate, "yyyy-MM") === monthData.key) {
                monthlyIncomeMap[monthData.key] += amount;
              }
            }
          }
        });
      });

      // Process expense entries - apply recurring amounts to each applicable month
      (expenseData || []).forEach((entry) => {
        const entryDate = new Date(entry.created_at);
        const amount = Number(entry.amount);
        const frequency = entry.frequency;

        monthsInRange.forEach(monthData => {
          // Check if this entry was created before or during this month
          if (entryDate <= monthData.end) {
            if (frequency === "monthly") {
              monthlyExpenseMap[monthData.key] += amount;
            } else if (frequency === "annually") {
              monthlyExpenseMap[monthData.key] += amount / 12;
            } else if (frequency === "quarterly") {
              monthlyExpenseMap[monthData.key] += amount / 3;
            } else if (frequency === "one_time" || frequency === "one-time") {
              if (format(entryDate, "yyyy-MM") === monthData.key) {
                monthlyExpenseMap[monthData.key] += amount;
              }
            }
          }
        });
      });

      // Build chart data from monthly maps
      const months: MonthlyData[] = monthsInRange.map(m => ({
        month: m.label,
        income: Math.round(monthlyIncomeMap[m.key] * 100) / 100,
        expenses: Math.round(monthlyExpenseMap[m.key] * 100) / 100,
      }));
      setChartData(months);

      // Calculate totals for the period
      const totalIncome = months.reduce((sum, m) => sum + m.income, 0);
      const totalExpenses = months.reduce((sum, m) => sum + m.expenses, 0);
      const netIncome = totalIncome - totalExpenses;
      const profitMargin = totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0;

      setTotals({
        income: totalIncome,
        expenses: totalExpenses,
        net: netIncome,
        profitMargin,
      });

      // Calculate expense breakdown by category (average monthly)
      const categoryTotals: Record<string, number> = {};
      (expenseData || []).forEach((entry) => {
        const monthlyAmount = convertToMonthly(Number(entry.amount), entry.frequency);
        if (monthlyAmount > 0) {
          categoryTotals[entry.category] = (categoryTotals[entry.category] || 0) + monthlyAmount;
        }
      });

      const totalMonthlyExpenses = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
      
      const breakdown: ExpenseBreakdown[] = Object.entries(categoryTotals)
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: totalMonthlyExpenses > 0 ? (amount / totalMonthlyExpenses) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      setExpenseBreakdown(breakdown);
    } catch (error) {
      console.error("Error fetching cash flow data:", error);
    } finally {
      setLoading(false);
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

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleExportCSV = () => {
    const csvData = [
      ["Month", "Income", "Expenses"],
      ...chartData.map(row => [row.month, row.income.toString(), row.expenses.toString()]),
      [],
      ["Category", "Amount", "Percentage"],
      ...expenseBreakdown.map(row => [row.category, row.amount.toString(), `${row.percentage.toFixed(1)}%`])
    ];
    
    const csvContent = csvData.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash-flow-${format(startDate, "yyyy-MM-dd")}-to-${format(endDate, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cash Flow Analysis</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {loading ? "Loading..." : `Income vs expenses with ${totals.profitMargin.toFixed(1)}% profit margin`}
              </p>
            </div>
          </div>
          
          {/* Date Range Selection */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
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
                variant={datePreset === "6months" ? "default" : "outline"} 
                size="sm"
                onClick={() => handlePresetChange("6months")}
              >
                6 Months
              </Button>
              <Button 
                variant={datePreset === "year" ? "default" : "outline"} 
                size="sm"
                onClick={() => handlePresetChange("year")}
              >
                Year
              </Button>
            </div>
            
            <div className="flex items-center gap-2 ml-auto">
              {/* Start Date */}
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-start text-left font-normal min-w-[130px]",
                      !startDate && "text-muted-foreground"
                    )}
                    onClick={() => setDatePreset("custom")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "MMM d, yyyy") : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date) {
                        setStartDate(date);
                        setDatePreset("custom");
                      }
                      setStartDateOpen(false);
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              
              <span className="text-muted-foreground">to</span>
              
              {/* End Date */}
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-start text-left font-normal min-w-[130px]",
                      !endDate && "text-muted-foreground"
                    )}
                    onClick={() => setDatePreset("custom")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM d, yyyy") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      if (date) {
                        setEndDate(date);
                        setDatePreset("custom");
                      }
                      setEndDateOpen(false);
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              
              {/* Export Button with Collapsible */}
              <Collapsible open={exportOpen} onOpenChange={setExportOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                    {exportOpen ? (
                      <ChevronUp className="ml-2 h-4 w-4" />
                    ) : (
                      <ChevronDown className="ml-2 h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            </div>
          </div>
          
          {/* Export Options */}
          <Collapsible open={exportOpen} onOpenChange={setExportOpen}>
            <CollapsibleContent>
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="secondary" size="sm" onClick={handleExportCSV}>
                  <Download className="mr-2 h-4 w-4" />
                  Export as CSV
                </Button>
                <Button variant="secondary" size="sm" onClick={handleExportPDF}>
                  <Download className="mr-2 h-4 w-4" />
                  Print / Save as PDF
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <p className="text-3xl font-bold text-success">
              {loading ? "..." : formatCurrencyFull(totals.income)}
            </p>
            <p className="text-sm text-muted-foreground">Total Income</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-destructive">
              {loading ? "..." : formatCurrencyFull(totals.expenses)}
            </p>
            <p className="text-sm text-muted-foreground">Total Expenses</p>
          </div>
          <div>
            <p className={`text-3xl font-bold ${totals.net >= 0 ? "text-primary" : "text-destructive"}`}>
              {loading ? "..." : formatCurrencyFull(totals.net)}
            </p>
            <p className="text-sm text-muted-foreground">Net Income</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis dataKey="month" fontSize={12} />
            <YAxis fontSize={12} tickFormatter={(value) => formatCurrency(value)} />
            <Tooltip 
              formatter={(value: number) => formatCurrencyFull(value)}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              contentStyle={{ 
                backgroundColor: "hsl(var(--background))", 
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px"
              }}
            />
            <Legend />
            <Bar dataKey="income" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Income" />
            <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Expenses" />
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-6">
          <h4 className="font-semibold mb-4">Average Monthly Expense Breakdown</h4>
          {expenseBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recurring expenses logged yet</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {expenseBreakdown.map((expense) => (
                <div key={expense.category} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{expense.category.toLowerCase()}</span>
                    <span className="font-medium">{formatCurrencyFull(expense.amount)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{expense.percentage.toFixed(1)}%</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
