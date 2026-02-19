import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

/**
 * Region Detection Middleware
 * Detects user's country/region from IP and maps to preferred currency
 * Attaches user_region and preferred_currency to req object
 * 
 * Supports two IP geolocation services:
 * 1. FreeGeoIP (free, no API key required)
 * 2. IPGeolocation API (requires API key, more accurate)
 */

// Mapping of country codes to preferred currencies
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  // North America
  'US': 'USD',
  'CA': 'CAD',
  
  // Europe
  'GB': 'GBP',
  'DE': 'EUR',
  'FR': 'EUR',
  'IT': 'EUR',
  'ES': 'EUR',
  'NL': 'EUR',
  'BE': 'EUR',
  'AT': 'EUR',
  'IE': 'EUR',
  'SE': 'EUR',
  'NO': 'EUR',
  'DK': 'EUR',
  'CH': 'EUR',
  'PL': 'EUR',
  'CZ': 'EUR',
  'RU': 'EUR',
  
  // Asia-Pacific
  'AU': 'AUD',
  'NZ': 'AUD',
  'IN': 'INR',
  'JP': 'JPY',
  'CN': 'CNY',
  'HK': 'HKD',
  'SG': 'SGD',
  'MY': 'MYR',
  'TH': 'THB',
  'VN': 'VND',
  'PH': 'PHP',
  'ID': 'IDR',
  'KR': 'KRW',
  
  // Middle East & Africa
  'AE': 'AED',
  'SA': 'SAR',
  'EG': 'EGP',
  'ZA': 'ZAR',
  
  // South America
  'BR': 'BRL',
  'AR': 'ARS',
  'MX': 'MXN',
  'CL': 'CLP',
};

/**
 * IP Geolocation Provider
 * Returns: { country_code: string, country_name: string, city: string }
 */
async function getLocationFromIP(ip: string): Promise<{ country_code?: string; country_name?: string; city?: string; error?: string }> {
  try {
    // Try FreeGeoIP first (free, no API key)
    const response = await axios.get(`https://freegeoip.app/json/${ip}`, {
      timeout: 5000,
    });
    
    return {
      country_code: response.data.country_code,
      country_name: response.data.country_name,
      city: response.data.city,
    };
  } catch (error: any) {
    console.warn(`⚠️  IP geolocation failed for ${ip}:`, error.message);
    return {
      error: error.message,
    };
  }
}

/**
 * Extract user's IP address from request
 * Handles proxied requests (X-Forwarded-For, X-Real-IP)
 */
function getUserIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') {
    return realIp;
  }
  
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Region Detection Middleware
 * Should be used early in request pipeline
 * 
 * Usage:
 * app.use(detectRegion);
 * 
 * Then access via:
 * req.user_region = { country_code, country_name, city, currency }
 */
export const detectRegion = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const userIP = getUserIP(req);
    
    // Skip detection for localhost/internal IPs
    if (['localhost', '127.0.0.1', '::1'].includes(userIP) || userIP.startsWith('192.168.') || userIP.startsWith('10.')) {
      // Default to AUD for local development
      (req as any).user_region = {
        country_code: 'AU',
        country_name: 'Australia',
        city: 'Local Dev',
        currency: 'AUD',
      };
      return next();
    }
    
    // Fetch location from IP
    const location = await getLocationFromIP(userIP);
    
    if (location.error || !location.country_code) {
      console.warn(`⚠️  Could not detect region for IP ${userIP}, defaulting to AUD`);
      (req as any).user_region = {
        country_code: 'AU',
        country_name: 'Australia',
        city: 'Unknown',
        currency: 'AUD',
      };
      return next();
    }
    
    // Map country to currency
    const currency = COUNTRY_TO_CURRENCY[location.country_code] || 'AUD';
    
    // Attach to request
    (req as any).user_region = {
      country_code: location.country_code,
      country_name: location.country_name,
      city: location.city,
      ip: userIP,
      currency,
    };
    
    console.log(`✅ Region detected: ${location.country_name} (${location.country_code}) -> ${currency}`);
    
    next();
  } catch (error: any) {
    console.error('❌ Region detection error:', error.message);
    // Graceful fallback - don't block request
    (req as any).user_region = {
      country_code: 'AU',
      country_name: 'Unknown',
      currency: 'AUD',
    };
    next();
  }
};

/**
 * Helper: Get currency from region context
 * Usage in controllers:
 * const currency = getCurrencyFromRequest(req);
 */
export function getCurrencyFromRequest(req: any): string {
  return req.user_region?.currency || 'AUD';
}

/**
 * Helper: Get country code from region context
 */
export function getCountryFromRequest(req: any): string {
  return req.user_region?.country_code || 'AU';
}

/**
 * Helper: Create TypeScript augmentation for request object
 * Add this to types/express.d.ts:
 * 
 * declare global {
 *   namespace Express {
 *     interface Request {
 *       user_region?: {
 *         country_code: string;
 *         country_name: string;
 *         city: string;
 *         ip?: string;
 *         currency: string;
 *       };
 *     }
 *   }
 * }
 */
