import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

interface TenantData {
  id: string;
  name: string;
  property_name: string;
  unit_number: string | null;
  monthly_rent: number;
  lease_start: string | null;
  lease_end: string | null;
  balance: number;
  status: string;
}

interface MaintenanceData {
  id: string;
  property_name: string;
  unit_number: string | null;
  title: string;
  priority: string;
  status: string;
  estimated_cost: number | null;
  actual_cost: number | null;
  created_at: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { properties, tenants, maintenance } = await req.json() as {
      properties: PropertyData[];
      tenants: TenantData[];
      maintenance: MaintenanceData[];
    };

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // Prepare summary data
    const portfolioSummary = {
      totalProperties: properties.length,
      totalUnits: properties.reduce((sum, p) => sum + p.units, 0),
      occupiedUnits: properties.reduce((sum, p) => sum + p.occupiedUnits, 0),
      avgOccupancy: properties.length > 0
        ? properties.reduce((sum, p) => sum + p.occupancy, 0) / properties.length
        : 0,
      totalMonthlyRent: properties.reduce((sum, p) => sum + p.monthly_rent, 0),
      avgCashOnCash: properties.length > 0
        ? properties.reduce((sum, p) => sum + p.cashOnCash, 0) / properties.length
        : 0,
    };

    const tenantSummary = {
      totalTenants: tenants.length,
      activeTenants: tenants.filter(t => t.status === "active").length,
      totalBalance: tenants.reduce((sum, t) => sum + (t.balance || 0), 0),
      upcomingLeaseEnds: tenants.filter(t => {
        if (!t.lease_end) return false;
        const leaseEnd = new Date(t.lease_end);
        const today = new Date();
        const daysUntilEnd = Math.floor((leaseEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilEnd >= 0 && daysUntilEnd <= 90;
      }).length,
    };

    const maintenanceSummary = {
      totalRequests: maintenance.length,
      pendingRequests: maintenance.filter(m => m.status === "pending").length,
      inProgressRequests: maintenance.filter(m => m.status === "in_progress").length,
      highPriorityRequests: maintenance.filter(m => m.priority === "high").length,
      totalEstimatedCost: maintenance.reduce((sum, m) => sum + (m.estimated_cost || 0), 0),
      totalActualCost: maintenance.reduce((sum, m) => sum + (m.actual_cost || 0), 0),
    };

    const systemPrompt = `You are a real estate portfolio analytics AI assistant. Analyze the provided property management data and generate actionable insights.

Your analysis should focus on:
1. Rent Increase Opportunities - Properties that may be charging below market rates based on their performance
2. Tenant Turnover Risk - Properties with high vacancy risk or expiring leases
3. Maintenance Budget Alerts - Properties with concerning maintenance cost patterns
4. Portfolio Optimization - Strategic recommendations for the overall portfolio

For each insight, provide:
- A clear title
- Priority level (High Priority, Medium Priority, or Low Priority)
- Confidence score (0-100)
- Brief description
- Whether action is required
- Type: opportunity, risk, alert, or recommendation
- List of specific properties affected with reasons

Be specific about which properties are affected and why. Base your analysis on the actual data provided.`;

    const userPrompt = `Analyze this real estate portfolio data and provide insights:

PORTFOLIO SUMMARY:
- Total Properties: ${portfolioSummary.totalProperties}
- Total Units: ${portfolioSummary.totalUnits}
- Occupied Units: ${portfolioSummary.occupiedUnits}
- Average Occupancy: ${portfolioSummary.avgOccupancy.toFixed(1)}%
- Total Monthly Rent: $${portfolioSummary.totalMonthlyRent.toLocaleString()}
- Average Cash-on-Cash Return: ${portfolioSummary.avgCashOnCash.toFixed(1)}%

PROPERTIES DETAIL:
${properties.map(p => `- ${p.name} (${p.city}): ${p.property_type}, ${p.occupiedUnits}/${p.units} units occupied (${p.occupancy.toFixed(1)}%), $${p.monthly_rent}/mo rent, ${p.cashOnCash.toFixed(1)}% CoC return`).join('\n')}

TENANT SUMMARY:
- Total Tenants: ${tenantSummary.totalTenants}
- Active Tenants: ${tenantSummary.activeTenants}
- Total Outstanding Balance: $${tenantSummary.totalBalance.toLocaleString()}
- Leases Expiring in 90 days: ${tenantSummary.upcomingLeaseEnds}

TENANTS WITH EXPIRING LEASES (next 90 days):
${tenants.filter(t => {
  if (!t.lease_end) return false;
  const leaseEnd = new Date(t.lease_end);
  const today = new Date();
  const daysUntilEnd = Math.floor((leaseEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return daysUntilEnd >= 0 && daysUntilEnd <= 90;
}).map(t => `- ${t.name} at ${t.property_name}${t.unit_number ? ` Unit ${t.unit_number}` : ''}: Lease ends ${t.lease_end}, $${t.monthly_rent}/mo`).join('\n') || 'None'}

MAINTENANCE SUMMARY:
- Total Requests: ${maintenanceSummary.totalRequests}
- Pending: ${maintenanceSummary.pendingRequests}
- In Progress: ${maintenanceSummary.inProgressRequests}
- High Priority: ${maintenanceSummary.highPriorityRequests}
- Total Estimated Cost: $${maintenanceSummary.totalEstimatedCost.toLocaleString()}
- Total Actual Cost: $${maintenanceSummary.totalActualCost.toLocaleString()}

ACTIVE MAINTENANCE REQUESTS:
${maintenance.filter(m => m.status === "pending" || m.status === "in_progress").map(m => `- ${m.property_name}${m.unit_number ? ` Unit ${m.unit_number}` : ''}: ${m.title} (${m.priority} priority, ${m.status})`).join('\n') || 'None'}

Generate 4 insights based on this data. Return them using the generate_portfolio_insights function.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          tools: [{
            function_declarations: [{
              name: "generate_portfolio_insights",
              description: "Generate portfolio analytics insights based on property data analysis",
              parameters: {
                type: "object",
                properties: {
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "Unique identifier for the insight" },
                        title: { type: "string", description: "Short title for the insight" },
                        priority: { type: "string", enum: ["High Priority", "Medium Priority", "Low Priority"] },
                        confidence: { type: "number", description: "Confidence score 0-100" },
                        description: { type: "string", description: "Brief description of the insight" },
                        actionRequired: { type: "boolean", description: "Whether immediate action is needed" },
                        type: { type: "string", enum: ["opportunity", "risk", "alert", "recommendation"] },
                        affectedProperties: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "string", description: "Property ID" },
                              name: { type: "string", description: "Property name" },
                              reason: { type: "string", description: "Why this property is affected" }
                            },
                            required: ["id", "name", "reason"]
                          }
                        }
                      },
                      required: ["id", "title", "priority", "confidence", "description", "actionRequired", "type", "affectedProperties"]
                    }
                  }
                },
                required: ["insights"]
              }
            }]
          }],
          tool_config: { function_calling_config: { mode: "ANY", allowed_function_names: ["generate_portfolio_insights"] } }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Gemini API error: " + errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    console.log("Gemini Response:", JSON.stringify(aiResponse, null, 2));

    // Extract function call from Gemini response
    const candidate = aiResponse.candidates?.[0];
    const functionCallPart = candidate?.content?.parts?.find((p: any) => p.functionCall);
    
    if (!functionCallPart) {
      throw new Error("Unexpected Gemini response format - no function call found");
    }

    const insightsData = functionCallPart.functionCall.args;

    return new Response(JSON.stringify(insightsData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-portfolio error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
