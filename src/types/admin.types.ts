/**
 * Admin Plan Creation Types
 * Defines expected payloads and responses for multi-currency plan management
 */

// ===========================================
// REQUEST TYPES (What admin sends)
// ===========================================

export interface CreatePlanRequestPayload {
  // Basic Info
  name: string;                    // "pro", "business", etc.
  display_name: string;            // "Pro Plan"
  slug: string;                    // "pro-plan"
  description?: string;
  
  // Features & Category
  features: string[];              // ["Feature 1", "Feature 2"]
  category: 'personal' | 'business' | 'enterprise';
  
  // Base Pricing (AUD - always)
  base_amount_monthly: number;     // in cents (1999 = $19.99 AUD)
  base_amount_yearly?: number;      // optional annual pricing
  
  // Target Regions for multi-currency support
  target_regions: RegionPricing[];
  
  // Contact sales flag
  is_contact_sales?: boolean;
  
  // Display order
  sort_order?: number;

  // Marketing Labels
  marketing_labels?: {
    badge_text?: string;
    offer_tags?: string[];
    is_on_sale?: boolean;
    sale_end_date?: string;
  };
}

export interface RegionPricing {
  currency: string;                // "USD", "INR", "GBP", etc.
  custom_amount_monthly?: number;  // optional override in that currency (cents)
  custom_amount_yearly?: number;   // optional override for yearly
  prev_amount_monthly?: number;    // optional previous amount (cents)
  prev_amount_yearly?: number;     // optional previous amount (cents)
  // If custom amounts are null/undefined, backend will auto-convert from AUD
}

// ===========================================
// ENTITLEMENT LINKING (After plan creation)
// ===========================================

export interface LinkEntitlementsRequest {
  plan_id: string;
  entitlements: {
    entitlement_key: string;       // e.g., "features.compare_mode"
    value: any;                    // true, 5, "unlimited", etc.
  }[];
}

// ===========================================
// RESPONSE TYPES (What server sends back)
// ===========================================

export interface CreatePlanResponseData {
  success: boolean;
  plan: {
    id: string;
    name: string;
    display_name: string;
    slug: string;
    
    // Pricing details
    prices: {
      monthly: Record<string, PriceDetails>;
      yearly?: Record<string, PriceDetails>;
    };
    
    pricing_metadata: {
      base_currency: string;
      base_amount_monthly: number;
      base_amount_yearly?: number;
      supported_currencies: string[];
      conversion_applied_on: string;
      conversion_source: string;
    };
    
    // Stripe info summary
    stripe_product_id: string;
    stripe_prices_created: number;  // How many price IDs were created
    
    status: 'active' | 'archived';
  };
  
  detailed_pricing: PricingBreakdown[];
  warnings: string[];              // Any issues encountered
  next_steps: string[];            // What to do next
}

export interface PriceDetails {
  amount: number;                  // Amount in cents
  stripe_price_id: string;         // Stripe price object ID
  source: 'base' | 'manual' | 'auto_converted';
  currency: string;                // Redundant but helpful
}

export interface PricingBreakdown {
  currency: string;
  monthly: {
    amount: number;
    prev_amount?: number;
    source: 'base' | 'manual' | 'auto_converted';
    stripe_price_id: string;
  };
  yearly?: {
    amount: number;
    prev_amount?: number;
    source: 'base' | 'manual' | 'auto_converted';
    stripe_price_id: string;
  };
}

// ===========================================
// INTERNAL PROCESSING TYPES
// ===========================================

export interface PriceConversionInput {
  base_amount: number;             // AUD amount in cents
  from_currency: string;           // "AUD"
  to_currency: string;             // "USD", "INR", etc.
  use_manual_override?: number;    // If admin provided custom amount
}

export interface ConversionResult {
  currency: string;
  amount: number;                  // Calculated or overridden amount
  source: 'base' | 'manual' | 'auto_converted';
  fx_rate_used?: number;           // The conversion rate applied
  manual_override_applied: boolean;
}

// ===========================================
// ERROR RESPONSE TYPES
// ===========================================

export interface CreatePlanErrorResponse {
  success: false;
  error: string;
  code: string;
  details: {
    field?: string;
    message: string;
  }[];
  metadata?: {
    partial_success: boolean;
    prices_created_before_error: number;
    rollback_attempted: boolean;
  };
}
