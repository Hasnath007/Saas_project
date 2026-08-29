import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Building2, Check, ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { STRIPE_PLANS } from "@/lib/stripePlans";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Pricing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAnnual, setIsAnnual] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const plans = [
    {
      key: "basic" as const,
      description: "Essential tools for small portfolios",
      buttonText: "Select Basic",
      features: [
        "Up to 50 Units",
        "Rent Collection",
        "Tenant Screening (basic)",
        "Maintenance Tracking",
        "Basic Reporting",
        "Email Support"
      ]
    },
    {
      key: "standard" as const,
      description: "Advanced features for growing businesses",
      buttonText: "Select Standard",
      popular: true,
      features: [
        "Everything in Basic, plus:",
        "Online Owner Portal",
        "Automated Late Fees",
        "Digital Lease Signing",
        "SSO",
        "Vendor Management",
        "Priority Support"
      ],
      newFeatures: ["Digital Lease Signing"]
    },
    {
      key: "premium" as const,
      description: "Built for large orgs needing scale and governance",
      buttonText: "Select Premium",
      features: [
        "Unlimited Units",
        "Everything in Standard",
        "Portfolio Support",
        "Portfolio Analytics",
        "Dedicated Support",
        "Open API Access",
        "Custom Integrations"
      ],
      newFeatures: ["Portfolio Analytics"]
    }
  ];

  const handleSelectPlan = async (planKey: "basic" | "standard" | "premium") => {
    setLoadingPlan(planKey);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      const plan = STRIPE_PLANS[planKey];
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: plan.price_id },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({
        title: "Checkout Error",
        description: err.message || "Failed to start checkout",
        variant: "destructive",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <nav className="border-b border-border/20 bg-[#0a0a0a]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/home" className="flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-white">PropManage</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/login">
                <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10">Sign In</Button>
              </Link>
              <Link to="/signup">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-16 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto text-center">
          <Link to="/home" className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Property Management Software
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Choose the perfect plan for your business.
          </p>
        </div>
      </div>

      <div className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const stripe = STRIPE_PLANS[plan.key];
              return (
                <Card
                  key={plan.key}
                  className={`bg-[#151515] border-border/30 relative ${plan.popular ? 'ring-2 ring-primary' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <CardHeader className="pb-0">
                    <h3 className="text-xl font-bold text-white">{stripe.name}</h3>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="mb-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-white">
                          ${isAnnual ? stripe.annualPrice : stripe.monthlyPrice}
                        </span>
                        <span className="text-muted-foreground">per month</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {isAnnual ? 'billed annually' : 'billed monthly'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 mb-6 pb-6 border-b border-border/30">
                      <Switch checked={isAnnual} onCheckedChange={setIsAnnual} className="data-[state=checked]:bg-primary" />
                      <span className="text-sm text-muted-foreground">Annual</span>
                      {isAnnual && <span className="text-xs text-primary ml-auto">Save 20%</span>}
                    </div>

                    <Button
                      className={`w-full mb-6 ${
                        plan.key === 'basic'
                          ? 'bg-primary hover:bg-primary/90'
                          : 'bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white border-0'
                      }`}
                      onClick={() => handleSelectPlan(plan.key)}
                      disabled={loadingPlan !== null}
                    >
                      {loadingPlan === plan.key ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                      ) : (
                        plan.buttonText
                      )}
                    </Button>

                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => {
                        const isNew = plan.newFeatures?.includes(feature);
                        const isHeader = feature.includes("plus:");
                        return (
                          <li key={i} className={`flex items-start gap-3 ${isHeader ? 'text-white font-medium' : 'text-muted-foreground'}`}>
                            {!isHeader && <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />}
                            <span className="text-sm">
                              {feature}
                              {isNew && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/20 text-primary">New</span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-border/20">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          © 2024 PropManage. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Pricing;
