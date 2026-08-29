import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export const MaintenanceStatus = () => {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ['maintenance-status-chart'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select('status, due_date');
      
      if (error) throw error;
      
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      let completed = 0;
      let inProgress = 0;
      let pending = 0;
      let overdue = 0;
      
      (data || []).forEach(request => {
        const isOverdue = request.due_date && new Date(request.due_date) < now && request.status !== 'completed';
        
        if (isOverdue) {
          overdue++;
        } else if (request.status === 'completed') {
          completed++;
        } else if (request.status === 'in_progress') {
          inProgress++;
        } else if (request.status === 'pending') {
          pending++;
        }
      });
      
      return [
        { name: "Completed", value: completed, color: "hsl(var(--chart-4))" },
        { name: "In Progress", value: inProgress, color: "hsl(var(--chart-3))" },
        { name: "Pending", value: pending, color: "hsl(var(--chart-5))" },
        { name: "Overdue", value: overdue, color: "hsl(var(--chart-2))" },
      ].filter(item => item.value > 0);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Maintenance Status</CardTitle>
        <CardDescription>Overview of all maintenance requests</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[350px] w-full" />
        ) : chartData && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Legend
                verticalAlign="bottom"
                height={50}
                formatter={(value, entry: any) => (
                  <span className="text-sm text-foreground">
                    {value}: <span className="font-medium">{entry.payload.value}</span>
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            No maintenance requests
          </div>
        )}
      </CardContent>
    </Card>
  );
};
