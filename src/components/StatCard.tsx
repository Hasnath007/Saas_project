import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
  subtitle: string;
  icon: LucideIcon;
  iconColor: string;
  linkTo?: string;
}

export const StatCard = ({ title, value, change, trend, subtitle, icon: Icon, iconColor, linkTo }: StatCardProps) => {
  const navigate = useNavigate();

  return (
    <Card 
      className={cn("transition-all", linkTo && "cursor-pointer hover:shadow-md")}
      onClick={() => linkTo && navigate(linkTo)}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-2">{title}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-bold text-foreground">{value}</h3>
              <span
                className={cn(
                  "flex items-center text-sm font-medium",
                  trend === "up" ? "text-success" : "text-destructive"
                )}
              >
                {trend === "up" ? "↑" : "↓"} {change}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div className={cn("rounded-lg p-3", iconColor)}>
            <Icon className="h-6 w-6 text-primary-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
