import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, MessageSquare, Wrench, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const activities = [
  {
    icon: DollarSign,
    iconBg: "bg-success",
    title: "Payment Received",
    description: "Oak Street Duplex - $2,400",
    time: "2 hours ago",
  },
  {
    icon: MessageSquare,
    iconBg: "bg-chart-3",
    title: "New Message",
    description: "From tenant at Riverside Apt",
    time: "4 hours ago",
  },
  {
    icon: Wrench,
    iconBg: "bg-chart-5",
    title: "Maintenance Scheduled",
    description: "HVAC service - Downtown Loft",
    time: "1 day ago",
  },
  {
    icon: AlertTriangle,
    iconBg: "bg-destructive",
    title: "Urgent: Late Payment",
    description: "River View Apt - 5 days overdue",
    time: "2 days ago",
  },
];

export const RecentActivity = () => {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity, index) => {
            const Icon = activity.icon;
            return (
              <div key={index} className="flex items-start gap-4">
                <div className={cn("rounded-lg p-2 text-primary-foreground", activity.iconBg)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{activity.title}</p>
                  <p className="text-sm text-muted-foreground">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
