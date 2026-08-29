export const STRIPE_PLANS = {
  basic: {
    name: "Basic",
    price_id: "price_1TI6oGRvHIi3epj7lKgRNrD4",
    product_id: "prod_UGe6ohUFjpxvGm",
    monthlyPrice: 250,
    annualPrice: 200,
  },
  standard: {
    name: "Standard",
    price_id: "price_1TI6oaRvHIi3epj7uXESORKk",
    product_id: "prod_UGe6ITkMJDm8iS",
    monthlyPrice: 550,
    annualPrice: 450,
  },
  premium: {
    name: "Premium",
    price_id: "price_1TI6opRvHIi3epj7KVI9tmhv",
    product_id: "prod_UGe7UQJJ4UJrVp",
    monthlyPrice: 1050,
    annualPrice: 850,
  },
} as const;

export type PlanKey = keyof typeof STRIPE_PLANS;

export const getProductTier = (productId: string): PlanKey | null => {
  for (const [key, plan] of Object.entries(STRIPE_PLANS)) {
    if (plan.product_id === productId) return key as PlanKey;
  }
  return null;
};
