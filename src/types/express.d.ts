import 'express';

declare global {
  namespace Express {
    interface Request {
      user_region?: {
        country_code: string;
        country_name: string;
        city: string;
        ip?: string;
        currency: string;
      };
    }
  }
}
