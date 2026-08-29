import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { AIInsight } from "@/components/AIInsightsSection";

interface PropertyData {
  id: string;
  name: string;
  address: string;
  city: string;
  property_type: string;
  purchase_price: number;
  current_value: number | null;
  monthly_rent: number;
  occupancy: number;
  units: number;
  occupiedUnits: number;
  cashOnCash: number;
}

export function useAIInsights(properties: PropertyData[]) {
  const { toast } = useToast();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    if (properties.length === 0) {
      setInsights([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch tenants data
      const { data: tenantsData, error: tenantsError } = await supabase
        .from("tenants")
        .select(`
          id,
          name,
          monthly_rent,
          lease_start,
          lease_end,
          balance,
          status,
          property:properties(name),
          unit:units(unit_number)
        `);

      if (tenantsError) throw tenantsError;

      // Fetch maintenance data
      const { data: maintenanceData, error: maintenanceError } = await supabase
        .from("maintenance_requests")
        .select(`
          id,
          title,
          priority,
          status,
          created_at,
          property:properties(name),
          unit:units(unit_number)
        `);

      if (maintenanceError) throw maintenanceError;

      // Transform data for the edge function
      const tenants = (tenantsData || []).map(t => ({
        id: t.id,
        name: t.name,
        property_name: (t.property as any)?.name || "Unknown",
        unit_number: (t.unit as any)?.unit_number || null,
        monthly_rent: Number(t.monthly_rent || 0),
        lease_start: t.lease_start,
        lease_end: t.lease_end,
        balance: Number(t.balance || 0),
        status: t.status || "unknown",
      }));

      const maintenance = (maintenanceData || []).map(m => ({
        id: m.id,
        property_name: (m.property as any)?.name || "Unknown",
        unit_number: (m.unit as any)?.unit_number || null,
        title: m.title,
        priority: m.priority,
        status: m.status,
        estimated_cost: null,
        actual_cost: null,
        created_at: m.created_at,
      }));

      // Call the edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-portfolio`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            properties,
            tenants,
            maintenance,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          throw new Error("AI rate limit exceeded. Please try again in a moment.");
        }
        if (response.status === 402) {
          throw new Error("AI credits exhausted. Please add credits to continue.");
        }
        throw new Error(errorData.error || "Failed to analyze portfolio");
      }

      const data = await response.json();
      
      // Map property IDs from the response to actual property IDs
      const mappedInsights = (data.insights || []).map((insight: AIInsight) => ({
        ...insight,
        affectedProperties: insight.affectedProperties.map(ap => {
          // Try to find matching property by name
          const matchedProperty = properties.find(p => 
            p.name.toLowerCase().includes(ap.name.toLowerCase()) ||
            ap.name.toLowerCase().includes(p.name.toLowerCase())
          );
          return {
            ...ap,
            id: matchedProperty?.id || ap.id,
          };
        }),
      }));

      setInsights(mappedInsights);
    } catch (err) {
      console.error("Error fetching AI insights:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to generate insights";
      setError(errorMessage);
      toast({
        title: "AI Analysis Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [properties, toast]);

  return {
    insights,
    loading,
    error,
    fetchInsights,
  };
}
