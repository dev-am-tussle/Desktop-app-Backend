import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

// Validate Stripe key is present
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️ WARNING: STRIPE_SECRET_KEY not found in environment variables');
  console.warn('⚠️ Add STRIPE_SECRET_KEY to .env file to enable Stripe integration');
}

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2025-11-17.clover',
  typescript: true,
});

// ============================================
// STRIPE PRODUCT OPERATIONS
// ============================================ 

/**
 * Create Stripe Product
 * Called when admin creates a new subscription plan
 */
export const createStripeProduct = async (planData: {
  name: string;
  description?: string;
}): Promise<Stripe.Product> => {
  try {
    const product = await stripe.products.create({
      name: planData.name,
      description: planData.description || `${planData.name} Subscription Plan`,
      active: true,
    });
    
    return product;
  } catch (error: any) {
    console.error('❌ Stripe Product Creation Error:', error);
    throw new Error(`Failed to create Stripe product: ${error.message}`);
  }
};

/**
 * Update Stripe Product
 * Product name/description can be updated
 */
export const updateStripeProduct = async (
  productId: string,
  updates: { name?: string; description?: string; active?: boolean }
): Promise<Stripe.Product> => {
  try {
    const product = await stripe.products.update(productId, updates);
    return product;
  } catch (error: any) {
    console.error('❌ Stripe Product Update Error:', error);
    throw new Error(`Failed to update Stripe product: ${error.message}`);
  }
};

/**
 * Archive Stripe Product
 */
export const archiveStripeProduct = async (productId: string): Promise<Stripe.Product> => {
  try {
    const product = await stripe.products.update(productId, { active: false });
    return product;
  } catch (error: any) {
    console.error('❌ Stripe Product Archive Error:', error);
    throw new Error(`Failed to archive Stripe product: ${error.message}`);
  }
};

// ============================================
// STRIPE PRICE OPERATIONS
// ============================================

/**
 * Create Stripe Price
 * Called when admin creates a new plan or updates price
 * NOTE: Prices are immutable - create new price if amount changes
 */
export const createStripePrice = async (priceData: {
  productId: string;
  amount: number; // Amount in base currency (e.g., 499 for ₹499)
  currency: string;
  billingPeriod: 'monthly' | 'yearly' | 'one-time';
}): Promise<Stripe.Price> => {
  try {
    const { productId, amount, currency, billingPeriod } = priceData;
    
    // Convert amount to smallest currency unit (paise for INR, cents for USD)
    const unitAmount = Math.round(amount * 100);
    
    const priceConfig: Stripe.PriceCreateParams = {
      product: productId,
      unit_amount: unitAmount,
      currency: currency.toLowerCase(),
      active: true,
    };
    
    // Add recurring interval for subscription plans
    if (billingPeriod !== 'one-time') {
      priceConfig.recurring = {
        interval: billingPeriod === 'monthly' ? 'month' : 'year',
      };
    }
    
    const price = await stripe.prices.create(priceConfig);
    return price;
  } catch (error: any) {
    console.error('❌ Stripe Price Creation Error:', error);
    throw new Error(`Failed to create Stripe price: ${error.message}`);
  }
};

/**
 * Archive Stripe Price
 * When plan price changes, archive old price
 */
export const archiveStripePrice = async (priceId: string): Promise<Stripe.Price> => {
  try {
    const price = await stripe.prices.update(priceId, { active: false });
    return price;
  } catch (error: any) {
    console.error('❌ Stripe Price Archive Error:', error);
    throw new Error(`Failed to archive Stripe price: ${error.message}`);
  }
};

// ============================================
// STRIPE CUSTOMER OPERATIONS
// ============================================

/**
 * Create Stripe Customer
 * Called when user makes first payment
 */
export const createStripeCustomer = async (customerData: {
  email: string;
  name: string;
  userId: string;
}): Promise<Stripe.Customer> => {
  try {
    const customer = await stripe.customers.create({
      email: customerData.email,
      name: customerData.name,
      metadata: {
        userId: customerData.userId,
      },
    });
    
    return customer;
  } catch (error: any) {
    console.error('❌ Stripe Customer Creation Error:', error);
    throw new Error(`Failed to create Stripe customer: ${error.message}`);
  }
};

/**
 * Get Stripe Customer
 */
export const getStripeCustomer = async (customerId: string): Promise<Stripe.Customer> => {
  try {
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    return customer;
  } catch (error: any) {
    console.error('❌ Stripe Customer Retrieval Error:', error);
    throw new Error(`Failed to retrieve Stripe customer: ${error.message}`);
  }
};

// ============================================
// STRIPE CHECKOUT SESSION OPERATIONS
// ============================================

/**
 * Create Stripe Checkout Session
 * Desktop app will open this URL in browser
 */
export const createCheckoutSession = async (sessionData: {
  customerId: string;
  priceId: string;
  userId: string;
  planId: string;
  mode: 'subscription' | 'payment';
}): Promise<Stripe.Checkout.Session> => {
  try {
    const { customerId, priceId, userId, planId, mode } = sessionData;
    
    const session = await stripe.checkout.sessions.create({
      mode,
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `myapp://payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `myapp://payment-cancel?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        userId,
        planId,
      },
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
    });
    
    return session;
  } catch (error: any) {
    console.error('❌ Stripe Checkout Session Creation Error:', error);
    throw new Error(`Failed to create checkout session: ${error.message}`);
  }
};

/**
 * Retrieve Checkout Session
 * Verify payment after redirect
 */
export const getCheckoutSession = async (
  sessionId: string
): Promise<Stripe.Checkout.Session> => {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
  } catch (error: any) {
    console.error('❌ Stripe Session Retrieval Error:', error);
    throw new Error(`Failed to retrieve checkout session: ${error.message}`);
  }
};

// ============================================
// STRIPE SUBSCRIPTION OPERATIONS
// ============================================

/**
 * Get Stripe Subscription
 */
export const getStripeSubscription = async (
  subscriptionId: string
): Promise<Stripe.Subscription> => {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error: any) {
    console.error('❌ Stripe Subscription Retrieval Error:', error);
    throw new Error(`Failed to retrieve subscription: ${error.message}`);
  }
};

/**
 * Cancel Stripe Subscription
 */
export const cancelStripeSubscription = async (
  subscriptionId: string
): Promise<Stripe.Subscription> => {
  try {
    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    return subscription;
  } catch (error: any) {
    console.error('❌ Stripe Subscription Cancellation Error:', error);
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }
};

// ============================================
// STRIPE WEBHOOK VERIFICATION
// ============================================

/**
 * Construct Stripe Event from Webhook
 * Verifies webhook signature for security
 */
export const constructWebhookEvent = (
  payload: string | Buffer,
  signature: string
): Stripe.Event => {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }
    
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    return event;
  } catch (error: any) {
    console.error('❌ Webhook Signature Verification Failed:', error);
    throw new Error(`Webhook verification failed: ${error.message}`);
  }
};

export default stripe;
