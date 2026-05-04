import CryptoJS from 'crypto-js';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secret-encryption-key-change-in-production';

/**
 * Encrypt sensitive data (credentials, tokens, etc.)
 * @param data Object or string to encrypt
 * @returns Encrypted base64 string
 */
export const encryptData = (data: any): string => {
  try {
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt sensitive data
 * @param encryptedData Encrypted base64 string
 * @returns Decrypted object or string
 */
export const decryptData = (encryptedData: string): any => {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY).toString(
      CryptoJS.enc.Utf8
    );
    
    // Try to parse as JSON, if it fails return as string
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Generate a secure token for API access
 * @param userId User ID
 * @param connector Connector name
 * @returns Secure token
 */
export const generateAccessToken = (userId: string, connector: string): string => {
  const randomPart = crypto.randomBytes(32).toString('hex');
  const timestamp = Date.now().toString();
  const connectorPart = Buffer.from(connector).toString('hex');
  const userPart = Buffer.from(userId).toString('hex');
  
  const token = `mcp_${userPart}_${connectorPart}_${timestamp}_${randomPart}`;
  return token;
};

/**
 * Calculate token expiry (default: 24 hours from now)
 * @param hoursFromNow Number of hours until expiry
 * @returns Date object
 */
export const calculateTokenExpiry = (hoursFromNow: number = 24): Date => {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + hoursFromNow);
  return expiryDate;
};

/**
 * Check if token is expired
 * @param expiryDate Date when token expires
 * @returns true if expired, false if still valid
 */
export const isTokenExpired = (expiryDate: Date): boolean => {
  return new Date() > expiryDate;
};

/**
 * Validate encryption key is set (should be in production)
 */
export const validateEncryptionKey = (): void => {
  if (!process.env.ENCRYPTION_KEY) {
    console.warn(
      '⚠️  WARNING: ENCRYPTION_KEY environment variable is not set. Using default key. This is NOT SECURE for production!'
    );
  }
};
