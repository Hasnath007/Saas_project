import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

const convertToMonthly = (amount: number, frequency: string): number => {
  switch (frequency) {
    case "one_time":
      return 0;
    case "annually":
      return amount / 12;
    case "quarterly":
      return amount / 3;
    default:
      return amount;
  }
};

export const RevenueChart = () => {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<MonthlyData[]>([]);

  useEffect(() => {
    fetchRevenueData();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('revenue-chart-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'property_income' },
        () => fetchRevenueData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'property_expenses' },
        () => fetchRevenueData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRevenueData = async () => {
    try {
      setLoading(true);

      // Get last 6 months of data
      const endDate = new Date();
      const startDate = subMonths(endDate, 5);

      // Fetch ALL income entries
      const { data: incomeData, error: incomeError } = await supabase
        .from("property_income")
        .select("amount, frequency, created_at");

      if (incomeError) throw incomeError;

      // Fetch ALL expense entries
      const { data: expenseData, error: expenseError } = await supabase
        .from("property_expenses")
        .select("amount, frequency, created_at");

      if (expenseError) throw expenseError;

      // Generate month keys for the last 6 months
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

      // Initialize monthly data
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
          if (entryDate <= monthData.end) {
            if (frequency === "monthly") {
              monthlyIncomeMap[monthData.key] += amount;
            } else if (frequency === "annually") {
              monthlyIncomeMap[monthData.key] += amount / 12;
            } else if (frequency === "quarterly") {
              monthlyIncomeMap[monthData.key] += amount / 3;
            } else if (frequency === "one_time" || frequency === "one-time") {
              if (format(entryDate, "yyyy-MM") === monthData.key) {
                monthlyIncomeMap[monthData.key] += amount;
              }
            }
          }
        });
      });

      // Process expense entries
      (expenseData || []).forEach((entry) => {
        const entryDate = new Date(entry.created_at);
        const amount = Number(entry.amount);
        const frequency = entry.frequency;

        monthsInRange.forEach(monthData => {
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

      // Build chart data
      const data: MonthlyData[] = monthsInRange.map(m => {
        const revenue = Math.round(monthlyIncomeMap[m.key] * 100) / 100;
        const expenses = Math.round(monthlyExpenseMap[m.key] * 100) / 100;
        return {
          month: m.label,
          revenue,
          expenses,
          profit: revenue - expenses,
        };
      });

      setChartData(data);
    } catch (error) {
      console.error("Error fetching revenue data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
          <CardDescription>Monthly revenue, expenses, and profit</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full h-[350px]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Overview</CardTitle>
        <CardDescription>Monthly revenue, expenses, and profit</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" className="text-xs" />
            <YAxis className="text-xs" tickFormatter={(value) => formatCurrency(value)} />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
            />
            <Legend />
            <Bar 
              dataKey="revenue" 
              fill="hsl(var(--chart-1))" 
              name="Revenue"
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="expenses" 
              fill="hsl(var(--chart-2))" 
              name="Expenses"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
