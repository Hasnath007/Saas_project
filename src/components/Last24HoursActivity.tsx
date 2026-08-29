import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { subHours, format } from "date-fns";
import { DollarSign, Wrench, FileText, AlertCircle } from "lucide-react";

interface ActivityItem {
  id: string;
  type: "payment" | "maintenance";
  description: string;
  timestamp: string;
  icon: React.ReactNode;
}

export const Last24HoursActivity = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState({
    paymentsCount: 0,
    paymentsTotal: 0,
    maintenanceCreated: 0,
    maintenanceCompleted: 0,
  });

  useEffect(() => {
    fetchLast24HoursData();
  }, []);

  const fetchLast24HoursData = async () => {
    try {
      setLoading(true);
      const twentyFourHoursAgo = subHours(new Date(), 24).toISOString();

      // Fetch payments from last 24 hours
      const { data: payments } = await supabase
        .from("payments")
        .select("*, tenants(name)")
        .gte("created_at", twentyFourHoursAgo)
        .order("created_at", { ascending: false });

      // Fetch maintenance requests from last 24 hours
      const { data: maintenance } = await supabase
        .from("maintenance_requests")
        .select("*")
        .gte("created_at", twentyFourHoursAgo)
        .order("created_at", { ascending: false });

      // Calculate stats
      const paymentsCount = payments?.length || 0;
      const paymentsTotal = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const maintenanceCreated = maintenance?.filter(m => m.status === "pending").length || 0;
      const maintenanceCompleted = maintenance?.filter(m => m.status === "completed").length || 0;

      setStats({
        paymentsCount,
        paymentsTotal,
        maintenanceCreated,
        maintenanceCompleted,
      });

      // Build activity list
      const activityItems: ActivityItem[] = [];

      payments?.forEach(payment => {
        const tenant = payment.tenants as any;
        activityItems.push({
          id: payment.id,
          type: "payment",
          description: `$${payment.amount.toLocaleString()} payment received from ${tenant?.name || "Unknown"}`,
          timestamp: payment.created_at,
          icon: <DollarSign className="h-4 w-4 text-green-500" />,
        });
      });

      maintenance?.forEach(m => {
        const statusText = m.status === "completed" ? "completed" : 
                          m.status === "in_progress" ? "in progress" : "created";
        activityItems.push({
          id: m.id,
          type: "maintenance",
          description: `Maintenance request "${m.title}" ${statusText}`,
          timestamp: m.created_at,
          icon: <Wrench className="h-4 w-4 text-orange-500" />,
        });
      });

      // Sort by timestamp
      activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setActivities(activityItems.slice(0, 10)); // Show only first 10
    } catch (error) {
      console.error("Error fetching 24h activity:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 p-4 border-l-4 border-primary bg-muted/30 rounded">
      <h4 className="font-semibold mb-2 flex items-center justify-between">
        Last 24 Hours Activity
        <Button 
          variant="link" 
          size="sm"
          onClick={() => navigate("/financials/audit-trail")}
        >
          View Full Audit Trail
        </Button>
      </h4>
      
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
        </div>
      ) : activities.length === 0 ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2 py-2">
          <FileText className="h-4 w-4" />
          No activities recorded in the last 24 hours
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="flex flex-wrap gap-4 mb-3 text-sm">
            {stats.paymentsCount > 0 && (
              <span className="flex items-center gap-1 text-green-600">
                <DollarSign className="h-4 w-4" />
                {stats.paymentsCount} payment{stats.paymentsCount !== 1 ? "s" : ""} (${stats.paymentsTotal.toLocaleString()})
              </span>
            )}
            {stats.maintenanceCreated > 0 && (
              <span className="flex items-center gap-1 text-orange-600">
                <AlertCircle className="h-4 w-4" />
                {stats.maintenanceCreated} new maintenance request{stats.maintenanceCreated !== 1 ? "s" : ""}
              </span>
            )}
            {stats.maintenanceCompleted > 0 && (
              <span className="flex items-center gap-1 text-blue-600">
                <Wrench className="h-4 w-4" />
                {stats.maintenanceCompleted} maintenance completed
              </span>
            )}
          </div>

          {/* Activity List */}
          <ul className="space-y-1 text-sm text-muted-foreground">
            {activities.map((activity) => (
              <li key={activity.id} className="flex items-start gap-2">
                {activity.icon}
                <span className="flex-1">{activity.description}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(activity.timestamp), "h:mm a")}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
