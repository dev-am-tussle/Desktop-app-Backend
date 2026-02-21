/**
 * Price Conversion & Validation Service
 * Handles multi-currency price calculations, FX conversion, and Stripe price creation
 */

import * as stripeService from '../utils/stripe';
import { getFXRates, getSupportedCurrencies as getDynamicSupportedCurrencies } from './fxRates.service';
import {
  CreatePlanRequestPayload,
  ConversionResult,
  PricingBreakdown,
} from '../types/admin.types';

// ===========================================
// VALIDATION FUNCTIONS
// ===========================================

/**
 * Validates if yearly price is a reasonable multiple of monthly price
 * Yearly should be between 8-14 months cost (accounting for annual discount)
 */
function validateYearlyToMonthlyRatio(monthly: number, yearly: number, currency: string): string | null {
  if (monthly === 0) return null; // Skip validation for free plans
  
  const ratio = yearly / monthly;
  const MIN_RATIO = 8;   // At least 8 months cost
  const MAX_RATIO = 14;  // At most 14 months cost (2 months free discount)

  if (ratio < MIN_RATIO) {
    return `${currency}: Yearly price ($${yearly}) is too cheap compared to monthly ($${monthly}). Expected at least ${MIN_RATIO}x monthly (ratio: ${ratio.toFixed(2)}). Yearly should be ≥ ${(monthly * MIN_RATIO).toLocaleString()} cents.`;
  }

  if (ratio > MAX_RATIO) {
    return `${currency}: Yearly price ($${yearly}) is too expensive compared to monthly ($${monthly}). Expected at most ${MAX_RATIO}x monthly (ratio: ${ratio.toFixed(2)}). Yearly should be ≤ ${(monthly * MAX_RATIO).toLocaleString()} cents.`;
  }

  return null;
}

export async function validateCreatePlanPayload(payload: CreatePlanRequestPayload): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Basic validations
  if (!payload.name || payload.name.trim().length === 0) {
    errors.push('Plan name is required and cannot be empty');
  }

  if (!payload.display_name || payload.display_name.trim().length === 0) {
    errors.push('Display name is required');
  }

  if (!payload.slug || payload.slug.trim().length === 0) {
    errors.push('Slug is required');
  }

  // Pricing validations
  if (typeof payload.base_amount_monthly !== 'number' || payload.base_amount_monthly < 0) {
    errors.push('Base amount monthly must be a positive number (in cents)');
  }

  if (payload.base_amount_yearly && (typeof payload.base_amount_yearly !== 'number' || payload.base_amount_yearly < 0)) {
    errors.push('Base amount yearly must be a positive number (in cents)');
  }

  // Validate base yearly to monthly ratio
  if (payload.base_amount_yearly && payload.base_amount_monthly > 0) {
    const baseRatioError = validateYearlyToMonthlyRatio(
      payload.base_amount_monthly,
      payload.base_amount_yearly,
      'AUD (Base Currency)'
    );
    if (baseRatioError) {
      errors.push(baseRatioError);
    }
  }

  // Target regions validation
  if (!Array.isArray(payload.target_regions) || payload.target_regions.length === 0) {
    errors.push('At least one target region is required');
  }

  for (const region of payload.target_regions) {
    const supportedCurrencies = getDynamicSupportedCurrencies();
    if (!region.currency || !supportedCurrencies.includes(region.currency)) {
      errors.push(`Unsupported currency: ${region.currency}. Supported: ${supportedCurrencies.join(', ')}`);
    }

    if (region.custom_amount_monthly && (region.custom_amount_monthly < 0)) {
      errors.push(`Custom amount for ${region.currency} must be positive`);
    }

    if (region.custom_amount_yearly && (region.custom_amount_yearly < 0)) {
      errors.push(`Custom yearly amount for ${region.currency} must be positive`);
    }

    // Validate custom yearly to monthly ratio
    if (region.custom_amount_yearly && region.custom_amount_monthly && region.custom_amount_monthly > 0) {
      const ratioError = validateYearlyToMonthlyRatio(
        region.custom_amount_monthly,
        region.custom_amount_yearly,
        region.currency
      );
      if (ratioError) {
        errors.push(ratioError);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ===========================================
// CONVERSION LOGIC
// ===========================================

/**
 * Convert base AUD amount to target currency
 * If admin provided custom amount, use that instead
 * Uses cached/dynamic FX rates
 */
export function convertPrice(
  baseAmountAUD: number,
  targetCurrency: string,
  fxRates: Record<string, number>,
  customAmount?: number
): ConversionResult {
  // If custom amount provided, use as-is
  if (customAmount !== undefined && customAmount !== null) {
    return {
      currency: targetCurrency,
      amount: Math.round(customAmount),
      source: 'manual',
      manual_override_applied: true,
    };
  }

  // Auto-convert from AUD to target currency
  const fxRate = fxRates[targetCurrency] || 1.0;
  const convertedAmount = Math.round(baseAmountAUD * fxRate);

  return {
    currency: targetCurrency,
    amount: convertedAmount,
    source: 'auto_converted',
    fx_rate_used: fxRate,
    manual_override_applied: false,
  };
}

/**
 * Generate all price points for a plan
 * Returns breakdown showing source of each price (base, manual, auto_converted)
 * Now uses dynamic FX rates with caching
 */
export async function generatePriceBreakdown(payload: CreatePlanRequestPayload): Promise<{
  breakdown: PricingBreakdown[];
  warnings: string[];
}> {
  const breakdown: PricingBreakdown[] = [];
  const warnings: string[] = [];

  // Fetch FX rates (cached if available, expires after TTL)
  const fxRates = await getFXRates();

  // Always include AUD as base
  const baseRegion = payload.target_regions.find(r => r.currency === 'AUD');
  if (!baseRegion) {
    payload.target_regions.unshift({
      currency: 'AUD',
      custom_amount_monthly: payload.base_amount_monthly,
      custom_amount_yearly: payload.base_amount_yearly,
    });
    warnings.push('AUD was not in target regions, automatically added as base');
  }

  // Process each region
  for (const region of payload.target_regions) {
    const monthlyConversion = convertPrice(
      payload.base_amount_monthly,
      region.currency,
      fxRates,
      region.custom_amount_monthly
    );

    const yearlyConversion = payload.base_amount_yearly
      ? convertPrice(payload.base_amount_yearly, region.currency, fxRates, region.custom_amount_yearly)
      : null;

    breakdown.push({
      currency: region.currency,
      monthly: {
        amount: monthlyConversion.amount,
        prev_amount: region.prev_amount_monthly,
        source: monthlyConversion.source,
        stripe_price_id: '', // Will be populated after Stripe creation
      },
      ...(yearlyConversion && {
        yearly: {
          amount: yearlyConversion.amount,
          prev_amount: region.prev_amount_yearly,
          source: yearlyConversion.source,
          stripe_price_id: '',
        },
      }),
    });

    // Warning if suspicious conversion ratios
    if (monthlyConversion.source === 'auto_converted') {
      const ratio = monthlyConversion.amount / payload.base_amount_monthly;
      if (ratio < 0.3 || ratio > 5) {
        warnings.push(
          `Currency ${region.currency} has unusual conversion ratio (${ratio.toFixed(2)}x). Consider providing custom amount.`
        );
      }
    }
  }

  return { breakdown, warnings };
}

// ===========================================
// STRIPE PRICE CREATION
// ===========================================

/**
 * Create Stripe prices for all currencies
 * Returns map of currency -> Stripe Price ID
 */
export async function createStripePrices(
  productId: string,
  breakdown: PricingBreakdown[]
): Promise<{
  monthly: Record<string, string>;  // currency -> price ID
  yearly?: Record<string, string>;
  errors: { currency: string; error: string }[];
}> {
  const result = {
    monthly: {} as Record<string, string>,
    yearly: {} as Record<string, string>,
    errors: [] as { currency: string; error: string }[],
  };

  for (const pricing of breakdown) {
    try {
      // Create monthly price
      const monthlyPrice = await stripeService.createStripePrice({
        productId,
        amount: pricing.monthly.amount,
        currency: pricing.currency.toLowerCase(),
        billingPeriod: 'monthly',
      });
      result.monthly[pricing.currency] = monthlyPrice.id;

      // Create yearly price if available
      if (pricing.yearly) {
        const yearlyPrice = await stripeService.createStripePrice({
          productId,
          amount: pricing.yearly.amount,
          currency: pricing.currency.toLowerCase(),
          billingPeriod: 'yearly',
        });
        result.yearly[pricing.currency] = yearlyPrice.id;
      }
    } catch (error: any) {
      result.errors.push({
        currency: pricing.currency,
        error: error.message || 'Unknown error during price creation',
      });
    }
  }

  return result;
}

// ===========================================
// METADATA GENERATION
// ===========================================

/**
 * Generate pricing metadata to store in MongoDB
 */
export function generatePricingMetadata(payload: CreatePlanRequestPayload, supportedCurrencies: string[]) {
  return {
    base_currency: 'AUD',
    base_amount_monthly: payload.base_amount_monthly,
    base_amount_yearly: payload.base_amount_yearly || null,
    supported_currencies: supportedCurrencies,
    conversion_applied_on: new Date(),
    conversion_source: 'dynamic_rates',  // Using dynamic FX rates service
  };
}

// ===========================================
// HELPER: Get supported currencies
// ===========================================

export function getSupportedCurrencies(): string[] {
  return getDynamicSupportedCurrencies();
}
