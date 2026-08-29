import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

const data = [
  { name: "Oak Street", value: 100 },
  { name: "River View", value: 87 },
  { name: "Downtown", value: 95 },
  { name: "Suburb Plaza", value: 92 },
];

export const PropertyPerformanceChart = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Property Performance</CardTitle>
        <p className="text-sm text-muted-foreground">Occupancy rates by property</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data}>
            <XAxis dataKey="name" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
