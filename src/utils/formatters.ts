/**
 * Format subscription plan pricing from cents (base-100) to real currency units (decimal).
 * Used for API responses to ensure the frontend displays correct values.
 * 
 * @param plan SubscriptionPlan object (mongoose doc or POJO)
 * @returns Formatted plan object
 */
export const formatPlanPricing = (plan: any) => {
  if (!plan) return plan;
  
  const planData = plan.toJSON ? plan.toJSON() : JSON.parse(JSON.stringify(plan));

  // Convert localized prices
  if (planData.prices) {
    if (planData.prices.monthly) {
      Object.keys(planData.prices.monthly).forEach(curr => {
        if (planData.prices.monthly[curr]) {
          planData.prices.monthly[curr].amount /= 100;
        }
      });
    }
    if (planData.prices.yearly) {
      Object.keys(planData.prices.yearly).forEach(curr => {
        if (planData.prices.yearly[curr]) {
          planData.prices.yearly[curr].amount /= 100;
        }
      });
    }
  }

  // Convert metadata base amounts
  if (planData.pricing_metadata) {
    if (planData.pricing_metadata.base_amount_monthly) {
      planData.pricing_metadata.base_amount_monthly /= 100;
    }
    if (planData.pricing_metadata.base_amount_yearly) {
      planData.pricing_metadata.base_amount_yearly /= 100;
    }
  }

  // Convert legacy fields if they exist
  if (planData.price_monthly) planData.price_monthly /= 100;
  if (planData.price_yearly) planData.price_yearly /= 100;

  return planData;
};
