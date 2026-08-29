import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Settings, RefreshCw, ChevronDown, ChevronUp, Building2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface AIInsight {
  id: string;
  title: string;
  priority: "High Priority" | "Medium Priority" | "Low Priority";
  confidence: number;
  description: string;
  actionRequired: boolean;
  type: "opportunity" | "risk" | "alert" | "recommendation";
  affectedProperties: Array<{
    id: string;
    name: string;
    reason: string;
  }>;
}

interface AIInsightsSectionProps {
  insights: AIInsight[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onPropertyClick?: (propertyId: string) => void;
}

const getInsightVariant = (type: AIInsight["type"]): "default" | "destructive" | "secondary" | "outline" => {
  switch (type) {
    case "opportunity":
      return "default";
    case "risk":
      return "destructive";
    case "alert":
      return "secondary";
    case "recommendation":
      return "outline";
    default:
      return "outline";
  }
};

const getPriorityVariant = (priority: string): "default" | "destructive" | "secondary" => {
  if (priority === "High Priority") return "destructive";
  if (priority === "Medium Priority") return "secondary";
  return "default";
};

export function AIInsightsSection({ 
  insights, 
  loading, 
  error, 
  onRefresh,
  onPropertyClick 
}: AIInsightsSectionProps) {
  const navigate = useNavigate();
  const [expandedInsights, setExpandedInsights] = useState<Record<string, boolean>>({});

  const toggleExpanded = (id: string) => {
    setExpandedInsights(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const highPriorityCount = insights.filter(i => i.priority === "High Priority").length;
  const actionRequiredCount = insights.filter(i => i.actionRequired).length;
  const avgConfidence = insights.length > 0 
    ? Math.round(insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length)
    : 0;

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              AI-Powered Insights
            </CardTitle>
            {insights.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {highPriorityCount} high priority {highPriorityCount === 1 ? 'alert' : 'alerts'} • {avgConfidence}% avg confidence
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {actionRequiredCount > 0 && (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                {actionRequiredCount} action required
              </Badge>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRefresh}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && insights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Analyzing your portfolio with AI...</p>
            <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : insights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Lightbulb className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No insights available</p>
            <p className="text-sm text-muted-foreground mt-1">Add more property data to generate insights</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {insights.map((insight) => (
                <Card 
                  key={insight.id} 
                  className={insight.actionRequired ? "border-destructive/20" : ""}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold mb-2">{insight.title}</h4>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge variant={getPriorityVariant(insight.priority)}>
                            {insight.priority}
                          </Badge>
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                            {insight.confidence}% confidence
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {insight.description}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {insight.actionRequired && (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                          Action Required
                        </Badge>
                      )}
                      <Badge variant={getInsightVariant(insight.type)}>{insight.type}</Badge>
                    </div>

                    {insight.affectedProperties.length > 0 && (
                      <Collapsible 
                        open={expandedInsights[insight.id]} 
                        onOpenChange={() => toggleExpanded(insight.id)}
                      >
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full justify-between mt-2">
                            <span className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              {insight.affectedProperties.length} {insight.affectedProperties.length === 1 ? 'property' : 'properties'} affected
                            </span>
                            {expandedInsights[insight.id] ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <div className="space-y-2 bg-muted/50 rounded-lg p-3">
                            {insight.affectedProperties.map((property, idx) => (
                              <div 
                                key={idx} 
                                className="flex items-start justify-between p-2 bg-background rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                                onClick={() => onPropertyClick?.(property.id)}
                              >
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{property.name}</p>
                                  <p className="text-xs text-muted-foreground">{property.reason}</p>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/properties/${property.id}`);
                                  }}
                                >
                                  View
                                </Button>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                <Settings className="h-4 w-4 mr-2" />
                Configure AI
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/reports')}>
                Generate Report
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
