import { Router } from 'express';
import express from 'express';
import { handleStripeWebhook } from '../controllers/webhook.controller';

const router = Router();

/**
 * POST /webhook/stripe
 * Stripe webhook endpoint
 * 
 * IMPORTANT: This route uses express.raw() middleware
 * to preserve the raw body for signature verification
 * 
 * No authentication required - Stripe signature verification handles security
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

export default router;
