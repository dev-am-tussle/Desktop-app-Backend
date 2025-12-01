import { Request, Response } from 'express';
import { User, Subscription, PaymentSession, Payment } from '../models';
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
    
    if (!signature) {
      return res.status(400).json({ error: 'No signature provided' });
    }

    // Verify webhook signature and construct event
    let event: Stripe.Event;
    try {
      event = stripeService.constructWebhookEvent(req.body, signature);
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    console.log(`🔔 Stripe Webhook Event: ${event.type}`);
 
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

    // Get user and subscription
    const [user, subscription] = await Promise.all([
      User.findById(userId),
      Subscription.findOne({ userId, status: { $in: ['trial', 'active'] } }),
    ]);

    if (!user || !subscription) {
      console.error('❌ User or subscription not found');
      return;
    }

    // Update user with Stripe customer and subscription IDs
    user.stripeCustomerId = session.customer as string;
    
    if (session.subscription) {
      user.stripeSubscriptionId = session.subscription as string;
    }
    
    await user.save();

    // Activate subscription
    subscription.planId = planId as any;
    subscription.status = 'active';
    
    if (session.subscription) {
      subscription.stripeSubscriptionId = session.subscription as string;
      
      // Set next billing date from Stripe subscription
      try {
        const stripeSubscription = await stripeService.getStripeSubscription(
          session.subscription as string
        );
        
        // Access current_period_end safely
        const periodEnd = (stripeSubscription as any).current_period_end;
        if (periodEnd && typeof periodEnd === 'number') {
          subscription.nextBillingDate = new Date(periodEnd * 1000);
        } else {
          // Fallback: Set to 30 days from now
          const fallbackDate = new Date();
          fallbackDate.setDate(fallbackDate.getDate() + 30);
          subscription.nextBillingDate = fallbackDate;
          console.log('⚠️ Using fallback billing date (30 days from now)');
        }
      } catch (err) {
        console.error('⚠️ Error fetching Stripe subscription:', err);
        // Fallback: Set to 30 days from now
        const fallbackDate = new Date();
        fallbackDate.setDate(fallbackDate.getDate() + 30);
        subscription.nextBillingDate = fallbackDate;
      }
    } else {
      // One-time payment - set billing date to 30 days
      const fallbackDate = new Date();
      fallbackDate.setDate(fallbackDate.getDate() + 30);
      subscription.nextBillingDate = fallbackDate;
    }

    subscription.trialEndsAt = undefined;
    await subscription.save();

    // Create payment record
    await Payment.create({
      userId,
      planId,
      amount: (session.amount_total || 0) / 100,
      currency: session.currency?.toUpperCase() || 'USD',
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

    // Update subscription next billing date
    const periodEnd = (stripeSubscription as any).current_period_end;
    const nextBilling = periodEnd && typeof periodEnd === 'number' 
      ? new Date(periodEnd * 1000) 
      : new Date(Date.now() + 30*24*60*60*1000); // Fallback: 30 days

    await Subscription.findOneAndUpdate(
      { userId, stripeSubscriptionId: subscriptionId },
      {
        $set: {
          status: 'active',
          nextBillingDate: nextBilling,
        },
      }
    );

    // Create payment record for renewal
    await Payment.create({
      userId,
      planId: null, // Could extract from subscription if needed
      amount: (invoice.amount_paid || 0) / 100,
      currency: invoice.currency?.toUpperCase() || 'USD',
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
    let status: 'active' | 'paused' | 'cancelled' | 'trial' = 'active';
    
    if (stripeSubscription.status === 'canceled') {
      status = 'cancelled';
    } else if (stripeSubscription.status === 'paused') {
      status = 'paused';
    } else if (stripeSubscription.status === 'trialing') {
      status = 'trial';
    }

    // Update subscription
    const periodEnd = (stripeSubscription as any).current_period_end;
    const nextBilling = periodEnd && typeof periodEnd === 'number'
      ? new Date(periodEnd * 1000)
      : new Date(Date.now() + 30*24*60*60*1000); // Fallback: 30 days

    await Subscription.findOneAndUpdate(
      { userId, stripeSubscriptionId: stripeSubscription.id },
      {
        $set: {
          status,
          nextBillingDate: nextBilling,
        },
      }
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

    // Mark subscription as cancelled
    await Subscription.findOneAndUpdate(
      { userId, stripeSubscriptionId: stripeSubscription.id },
      { $set: { status: 'cancelled' } }
    );

    // Clear user's Stripe subscription ID
    await User.findByIdAndUpdate(userId, {
      $set: { stripeSubscriptionId: null },
    });

    console.log('✅ Subscription cancelled for user:', userId);
  } catch (error) {
    console.error('❌ Error handling subscription deletion:', error);
  }
}
