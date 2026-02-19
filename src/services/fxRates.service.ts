/**
 * Dynamic FX Rates Service
 * Fetches and caches exchange rates from MongoDB (admin-managed)
 * with fallback to hardcoded rates
 * 
 * Features:
 * - Fetch rates from MongoDB (admin-managed)
 * - Admin can update rates in real-time
 * - TTL-based caching with configurable duration
 * - Support for multiple currencies
 */

import axios from 'axios';
import FXRate from '../models/FXRate.model';

interface FXRateCache {
  rates: Record<string, number>;
  timestamp: Date;
  source: string;
}

// In-memory cache with TTL (default 6 hours = 21600000 ms)
let fxRateCache: FXRateCache | null = null;
const CACHE_TTL = process.env.FX_CACHE_TTL_MS ? parseInt(process.env.FX_CACHE_TTL_MS) : 6 * 60 * 60 * 1000;  // 6 hours

// Fallback hardcoded rates (as of 2026-02-19)
const FALLBACK_FX_RATES: Record<string, number> = {
  'AUD': 1.0,      // Base currency
  'USD': 0.65,
  'INR': 54.25,
  'GBP': 0.51,
  'EUR': 0.60,
  'CAD': 0.90,
  'JPY': 101.50,
  'CNY': 4.70,
  'HKD': 5.06,
  'SGD': 0.87,
  'MYR': 2.96,
  'THB': 22.50,
  'VND': 16400,
  'PHP': 37.50,
  'IDR': 10350,
  'KRW': 850,
  'AED': 2.39,
  'SAR': 2.44,
  'EGP': 20.15,
  'ZAR': 12.00,
  'BRL': 3.25,
  'ARS': 175.00,
  'MXN': 17.50,
  'CLP': 620.00,
};

/**
 * Fetch exchange rates from Stripe
 * Stripe provides real-time exchange rates via their API
 */
async function fetchFromStripe(): Promise<Record<string, number> | null> {
  try {
    const stripeApiKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeApiKey) {
      console.warn('⚠️  STRIPE_SECRET_KEY not configured, skipping Stripe rate fetch');
      return null;
    }

    // Stripe doesn't have a public FX rates endpoint
    // This is a placeholder for future implementation
    // You can implement this using Stripe's Currency API or pricing API
    console.log('📡 Fetching FX rates from Stripe...');
    
    // For now, return null to use fallback
    return null;
  } catch (error: any) {
    console.warn('⚠️  Failed to fetch rates from Stripe:', error.message);
    return null;
  }
}

/**
 * Fetch exchange rates from Open Exchange Rates API
 * Free tier available at https://openexchangerates.org
 */
async function fetchFromOpenExchangeRates(): Promise<Record<string, number> | null> {
  try {
    const apiKey = process.env.OPEN_EXCHANGE_RATES_API_KEY;
    if (!apiKey) {
      console.warn('⚠️  OPEN_EXCHANGE_RATES_API_KEY not configured');
      return null;
    }

    console.log('📡 Fetching FX rates from Open Exchange Rates...');
    const response = await axios.get(`https://openexchangerates.org/api/latest.json`, {
      params: {
        app_id: apiKey,
        base: 'AUD',
        symbols: Object.keys(FALLBACK_FX_RATES).join(','),
      },
      timeout: 5000,
    });

    if (response.data && response.data.rates) {
      console.log('✅ FX rates fetched from Open Exchange Rates');
      return response.data.rates;
    }

    return null;
  } catch (error: any) {
    console.warn('⚠️  Failed to fetch rates from Open Exchange Rates:', error.message);
    return null;
  }
}

/**
 * Fetch exchange rates from Fixer.io API
 * Fixer.io is another popular FX API
 */
async function fetchFromFixerIO(): Promise<Record<string, number> | null> {
  try {
    const apiKey = process.env.FIXER_IO_API_KEY;
    if (!apiKey) {
      console.warn('⚠️  FIXER_IO_API_KEY not configured');
      return null;
    }

    console.log('📡 Fetching FX rates from Fixer.io...');
    const response = await axios.get(`https://api.fixer.io/latest`, {
      params: {
        access_key: apiKey,
        base: 'AUD',
        symbols: Object.keys(FALLBACK_FX_RATES).join(','),
      },
      timeout: 5000,
    });

    if (response.data && response.data.rates) {
      console.log('✅ FX rates fetched from Fixer.io');
      return response.data.rates;
    }

    return null;
  } catch (error: any) {
    console.warn('⚠️  Failed to fetch rates from Fixer.io:', error.message);
    return null;
  }
}

/**
 * Check if cache is still valid (not expired)
 */
function isCacheValid(): boolean {
  if (!fxRateCache) return false;
  const now = new Date();
  const cacheAge = now.getTime() - fxRateCache.timestamp.getTime();
  return cacheAge < CACHE_TTL;
}

/**
 * Get FX rates with caching and fallback
 * 
 * Priority order:
 * 1. Return cached rates if valid
 * 2. Fetch fresh rates from MongoDB (admin-managed)
 * 3. Try external APIs (Stripe -> Open Exchange Rates -> Fixer.io)
 * 4. Fall back to hardcoded rates if all fail
 */
export async function getFXRates(): Promise<Record<string, number>> {
  // Return cached rates if valid
  if (isCacheValid() && fxRateCache) {
    console.log('✅ Using cached FX rates');
    return fxRateCache.rates;
  }

  console.log('🔄 FX rates cache expired or empty, fetching fresh rates...');

  let rates: Record<string, number> | null = null;
  let source = 'fallback';

  // ✅ PRIORITY 1: Try MongoDB first (admin-managed)
  try {
    console.log('📊 Fetching FX rates from MongoDB...');
    const dbRates = await FXRate.find({
      is_active: true,
      effective_from: { $lte: new Date() },
    }).lean();

    if (dbRates && dbRates.length > 0) {
      rates = { 'AUD': 1.0 };
      for (const rate of dbRates) {
        if (rate.from_currency === 'AUD') {
          rates[rate.to_currency] = rate.rate;
        }
      }
      source = 'mongodb';
      console.log('✅ FX rates fetched from MongoDB');
    }
  } catch (error: any) {
    console.warn('⚠️  Failed to fetch rates from MongoDB:', error.message);
  }

  // Try Stripe if MongoDB failed
  if (!rates) {
    rates = await fetchFromStripe();
    if (rates) {
      source = 'stripe';
    }
  }

  // Try Open Exchange Rates
  if (!rates) {
    rates = await fetchFromOpenExchangeRates();
    if (rates) {
      source = 'open-exchange-rates';
    }
  }

  // Try Fixer.io
  if (!rates) {
    rates = await fetchFromFixerIO();
    if (rates) {
      source = 'fixer.io';
    }
  }

  // Fall back to hardcoded rates
  if (!rates) {
    console.warn('⚠️  All FX sources failed, using fallback hardcoded rates');
    rates = FALLBACK_FX_RATES;
    source = 'fallback';
  }

  // Cache the rates
  fxRateCache = {
    rates,
    timestamp: new Date(),
    source,
  };

  console.log(`✅ FX rates updated from ${source} (cached for ${CACHE_TTL / 1000 / 60 / 60} hours)`);

  return rates;
}

/**
 * Convert amount from one currency to another
 * Uses cached FX rates
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<{ amount: number; rate: number; source: string }> {
  if (fromCurrency === toCurrency) {
    return {
      amount,
      rate: 1.0,
      source: 'same-currency',
    };
  }

  const rates = await getFXRates();

  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];

  if (!fromRate || !toRate) {
    throw new Error(`Unsupported currency conversion: ${fromCurrency} -> ${toCurrency}`);
  }

  // Convert: convert to base (AUD), then to target
  const baseAmount = amount / fromRate;
  const convertedAmount = baseAmount * toRate;

  const rate = toRate / fromRate;

  return {
    amount: Math.round(convertedAmount),  // Round to nearest cent
    rate,
    source: fxRateCache?.source || 'fallback',
  };
}

/**
 * Clear cache manually (useful for tests or manual updates)
 */
export function clearFXCache(): void {
  fxRateCache = null;
  console.log('✅ FX rates cache cleared');
}

/**
 * Get cache stats for debugging
 */
export function getCacheStats(): { isCached: boolean; age?: number; source?: string; nextRefresh?: number } {
  if (!fxRateCache) {
    return { isCached: false };
  }

  const now = new Date();
  const age = now.getTime() - fxRateCache.timestamp.getTime();
  const nextRefresh = CACHE_TTL - age;

  return {
    isCached: true,
    age,
    source: fxRateCache.source,
    nextRefresh: Math.max(0, nextRefresh),
  };
}

/**
 * Get supported currencies
 * Priority: Cache -> Fallback list
 */
export function getSupportedCurrencies(): string[] {
  if (fxRateCache && fxRateCache.rates) {
    return Object.keys(fxRateCache.rates);
  }
  // Return a sensible default list if cache is empty
  return ['AUD', 'USD', 'INR', 'GBP', 'EUR', 'CAD', 'SGD', 'JPY', 'NZD'];
}
