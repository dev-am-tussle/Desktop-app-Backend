import { Request, Response } from 'express';
import { User, PaymentSession, Payment, SubscriptionPlan, EntitlementCache } from '../models';
import * as stripeService from '../utils/stripe';
import Stripe from 'stripe';

/**
 * Stripe Webhook Handler
 * Handles all Stripe events (payment success, subscription updates, etc.)
 * 
 * IMPORTANT: This endpoint must have raw body parsing enabled
 * Add express.raw() middleware for this route specifically
 */
export const handleStripeWebhook = async (req: Request, res: Response): Promise<any> => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    // Diagnostic logging before verification
    const mask = (s?: string) => {
      if (!s) return '<not-set>';
      if (s.length <= 8) return '****';
      return `${s.slice(0, 8)}****${s.slice(-4)}`;
    };

    console.log('🔔 Incoming Stripe webhook');
    console.log('   STRIPE_SECRET_KEY prefix:', mask(process.env.STRIPE_SECRET_KEY));
    console.log('   STRIPE_WEBHOOK_SECRET:', mask(process.env.STRIPE_WEBHOOK_SECRET));
    console.log('   Received signature header (masked):', signature ? `${signature.slice(0,16)}...` : '<none>');
    console.log('   Raw payload size:', req.body ? (Buffer.isBuffer(req.body) ? req.body.length : String(req.body).length) : 0);

    if (!signature) {
      return res.status(400).json({ error: 'No signature provided' });
    }

    // Verify webhook signature and construct event
    let event: Stripe.Event;
    try {
      event = stripeService.constructWebhookEvent(req.body, signature);
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', err.message);
      console.error('   Verification failed for signature (masked):', signature ? `${signature.slice(0,16)}...` : '<none>');
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    console.log(`🔔 Stripe Webhook Event: ${event.type}`);

    // Additional diagnostic dump for checkout.session.completed payloads
    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('   Checkout Session details:');
        console.log('     id:', session.id);
        console.log('     amount_total:', session.amount_total);
        console.log('     currency:', session.currency);
        console.log('     payment_status:', session.payment_status);
        console.log('     subscription:', session.subscription);
        console.log('     payment_intent:', session.payment_intent);
        console.log('     customer:', session.customer);
        console.log('     metadata:', session.metadata);
        // If line_items were expanded by Stripe, log first line item and price id
        // (Note: line_items are not always present in webhook payload)
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (session.line_items && session.line_items.data && session.line_items.data.length > 0) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const li = session.line_items.data[0];
          console.log('     line_item[0] description:', li.description || li.price?.product || li.price?.id);
          console.log('     line_item[0] price id:', li.price?.id || '<unknown>');
        }
      }
    } catch (dumpErr) {
      console.warn('⚠️ Failed to dump checkout session details:', dumpErr);
    }
 
    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    // Acknowledge receipt of the event
    res.json({ received: true });
  } catch (error: any) {
    console.error('❌ Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
};

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Handle checkout.session.completed
 * Payment successful - activate subscription
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  try {
    console.log('✅ Checkout session completed:', session.id);
    console.log('   session metadata:', session.metadata);
    console.log('   session amount_total:', session.amount_total, 'currency:', session.currency);
    console.log('   session payment_intent:', session.payment_intent, 'subscription:', session.subscription);

    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;

    if (!userId || !planId) {
      console.error('❌ Missing metadata in session');
      return;
    }

    // Update payment session status
    await PaymentSession.findOneAndUpdate(
      { stripeSessionId: session.id },
      { 
        $set: { 
          status: 'completed',
          stripeCustomerId: session.customer as string,
        } 
      }
    );

    // Get user and plan
    const [user, plan] = await Promise.all([
      User.findById(userId),
      SubscriptionPlan.findById(planId),
    ]);

    if (!user || !plan) {
      console.error('❌ User or plan not found');
      return;
    }

    // Update user with Stripe customer and subscription IDs
    user.stripeCustomerId = session.customer as string;
    user.plan_id = planId as any;
    user.subscription_status = 'active';
    
    if (session.subscription) {
      user.stripeSubscriptionId = session.subscription as string;
      
      // Set subscription end date from Stripe subscription
      try {
        const stripeSubscription = await stripeService.getStripeSubscription(
          session.subscription as string
        );
        
        // Access current_period_end safely
        const periodEnd = (stripeSubscription as any).current_period_end;
        if (periodEnd && typeof periodEnd === 'number') {
          user.subscription_ends_at = new Date(periodEnd * 1000);
        } else {
          // Fallback: Set to 30 days from now
          const fallbackDate = new Date();
          fallbackDate.setDate(fallbackDate.getDate() + 30);
          user.subscription_ends_at = fallbackDate;
          console.log('⚠️ Using fallback subscription end date (30 days from now)');
        }
      } catch (err) {
        console.error('⚠️ Error fetching Stripe subscription:', err);
        // Fallback: Set to 30 days from now
        const fallbackDate = new Date();
        fallbackDate.setDate(fallbackDate.getDate() + 30);
        user.subscription_ends_at = fallbackDate;
      }
    } else {
      // One-time payment - set end date to 30 days
      const fallbackDate = new Date();
      fallbackDate.setDate(fallbackDate.getDate() + 30);
      user.subscription_ends_at = fallbackDate;
    }
    
    await user.save();
    
    // Invalidate old entitlement cache (user upgraded)
    await EntitlementCache.updateMany(
      { user_id: userId },
      { $set: { revoked: true } }
    );

    // Create payment record
    await Payment.create({
      userId,
      planId,
      amount: (session.amount_total || 0) / 100,
      currency: session.currency?.toUpperCase() || 'AUD',
      method: 'card',
      status: 'completed',
      transactionId: session.payment_intent as string,
      date: new Date(),
    });

    // Update user onboarding phase
    await User.findByIdAndUpdate(userId, {
      $set: {
        onboardingPhase: 'payment_processing',
        'phaseCompletedAt.paymentProcessing': new Date(),
      },
    });

    console.log('✅ Subscription activated for user:', userId);
  } catch (error) {
    console.error('❌ Error handling checkout session:', error);
  }
}

/**
 * Handle invoice.payment_succeeded
 * Subscription renewal successful
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    console.log('✅ Invoice payment succeeded:', invoice.id);

    const subscriptionId = (invoice as any).subscription as string;
    if (!subscriptionId) return;

    // Get Stripe subscription
    const stripeSubscription = await stripeService.getStripeSubscription(subscriptionId);
    const userId = stripeSubscription.metadata?.userId;

    if (!userId) return;

    // Update user subscription end date
    const periodEnd = (stripeSubscription as any).current_period_end;
    const subscriptionEnds = periodEnd && typeof periodEnd === 'number' 
      ? new Date(periodEnd * 1000) 
      : new Date(Date.now() + 30*24*60*60*1000); // Fallback: 30 days

    await User.findOneAndUpdate(
      { _id: userId, stripeSubscriptionId: subscriptionId },
      {
        $set: {
          subscription_status: 'active',
          subscription_ends_at: subscriptionEnds,
        },
      }
    );
    
    // Invalidate old cache on renewal
    await EntitlementCache.updateMany(
      { user_id: userId },
      { $set: { revoked: true } }
    );

    // Create payment record for renewal
    await Payment.create({
      userId,
      planId: null, // Could extract from subscription if needed
      amount: (invoice.amount_paid || 0) / 100,
      currency: invoice.currency?.toUpperCase() || 'AUD',
      method: 'card',
      status: 'completed',
      transactionId: (invoice as any).payment_intent as string,
      date: new Date(),
      metadata: {
        type: 'renewal',
        invoiceId: invoice.id,
      },
    });

    console.log('✅ Subscription renewed for user:', userId);
  } catch (error) {
    console.error('❌ Error handling invoice payment:', error);
  }
}

/**
 * Handle payment_intent.payment_failed
 * Payment failed - mark session as failed
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log('❌ Payment failed:', paymentIntent.id);

    // Update payment session status
    await PaymentSession.findOneAndUpdate(
      { stripeSessionId: paymentIntent.id },
      { $set: { status: 'failed' } }
    );

    // TODO: Send email notification to user
  } catch (error) {
    console.error('❌ Error handling payment failure:', error);
  }
}

/**
 * Handle customer.subscription.updated
 * Subscription status changed (paused, resumed, etc.)
 */
async function handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription) {
  try {
    console.log('🔄 Subscription updated:', stripeSubscription.id);

    const userId = stripeSubscription.metadata?.userId;
    if (!userId) return;

    // Map Stripe status to our status
    let status: 'active' | 'past_due' | 'cancelled' | 'trial' | 'expired' = 'active';
    
    if (stripeSubscription.status === 'canceled') {
      status = 'cancelled';
    } else if (stripeSubscription.status === 'past_due') {
      status = 'past_due';
    } else if (stripeSubscription.status === 'trialing') {
      status = 'trial';
    }

    // Update user subscription status
    const periodEnd = (stripeSubscription as any).current_period_end;
    const subscriptionEnds = periodEnd && typeof periodEnd === 'number'
      ? new Date(periodEnd * 1000)
      : new Date(Date.now() + 30*24*60*60*1000); // Fallback: 30 days

    await User.findOneAndUpdate(
      { _id: userId, stripeSubscriptionId: stripeSubscription.id },
      {
        $set: {
          subscription_status: status,
          subscription_ends_at: subscriptionEnds,
        },
      }
    );
    
    // Invalidate cache on status change
    await EntitlementCache.updateMany(
      { user_id: userId },
      { $set: { revoked: true } }
    );

    console.log('✅ Subscription updated for user:', userId);
  } catch (error) {
    console.error('❌ Error handling subscription update:', error);
  }
}

/**
 * Handle customer.subscription.deleted
 * Subscription cancelled/deleted
 */
async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
  try {
    console.log('🗑️ Subscription deleted:', stripeSubscription.id);

    const userId = stripeSubscription.metadata?.userId;
    if (!userId) return;

    // Mark user subscription as cancelled and clear Stripe ID
    await User.findByIdAndUpdate(userId, {
      $set: { 
        subscription_status: 'cancelled',
        stripeSubscriptionId: null,
      },
    });
    
    // Invalidate entitlement cache
    await EntitlementCache.updateMany(
      { user_id: userId },
      { $set: { revoked: true } }
    );

    console.log('✅ Subscription cancelled for user:', userId);
  } catch (error) {
    console.error('❌ Error handling subscription deletion:', error);
  }
}
