# ⚠️ DEPRECATED CONTROLLERS - MIGRATION NEEDED

The following controller files contain legacy code that references old `SubscriptionPlan` model fields that have been restructured for the entitlement system.

## Files Requiring Updates

### 1. **src/controllers/payments.controller.ts**
**Old Fields Used:**
- `plan.stripePriceId` → Use `plan.stripe_price_monthly_id` or `plan.stripe_price_yearly_id`
- `plan.price` → Use `plan.price_monthly` or `plan.price_yearly`
- `plan.billingPeriod` → Removed (billing period now determined by which price ID is used)

**Lines Affected:** 223, 251, 254, 266, 324, 346, 348, 413

**Recommended Action:**
- Update payment creation to accept `billingPeriod` parameter ('monthly' | 'yearly')
- Select appropriate price ID based on billing period
- Use `price_monthly` or `price_yearly` for amount validation

---

### 2. **src/controllers/public.controller.ts**
**Old Fields Used:**
- `plan.price` → Use `plan.price_monthly`
- `plan.billingPeriod` → Need to pass explicitly from request

**Lines Affected:** 330, 345, 347, 355

**Recommended Action:**
- Default to monthly pricing in public endpoints
- Add billing period selection to desktop app UI

---

### 3. **src/controllers/subscriptions.controller.ts**
**Old Fields Used:**
- `plan.price` → Use `plan.price_monthly` or `plan.price_yearly`
- `plan.stripePriceId` → Use `plan.stripe_price_monthly_id` or `plan.stripe_price_yearly_id`
- `plan.stripeProductId` → Use `plan.stripe_product_id`
- `plan.billingPeriod` → Removed

**Lines Affected:** 126, 130, 131, 136, 139, 147, 148, 189, 190, 192, 193, 274, 275, 277, 278, 498, 499

**Recommended Action:**
- Complete rewrite to work with new plan structure
- Update plan management to support monthly/yearly pricing separately
- Fix Stripe integration to use new field names

---

## New Plan Structure

```typescript
interface ISubscriptionPlan {
  name: string;                      // "free", "pro", "business", "enterprise"
  display_name: string;              // "Pro Plan"
  slug: string;                      // URL-friendly
  description?: string;
  
  price_monthly: number;             // Monthly price
  price_yearly?: number;             // Annual price (optional)
  currency: string;                  // "AUD"
  is_contact_sales: boolean;         // For Enterprise
  
  stripe_product_id?: string;
  stripe_price_monthly_id?: string;
  stripe_price_yearly_id?: string;
  
  status: 'active' | 'archived';
  sort_order: number;
}
```

## Migration Strategy

**Option 1: Quick Fix (Temporary)**
- Comment out broken endpoints
- Focus on new entitlement system endpoints
- Users manage subscriptions through Stripe portal

**Option 2: Full Migration**
- Rewrite all payment/subscription controllers
- Update Stripe webhooks to handle new structure
- Add billing period selection to all payment flows
- Update admin panel to manage new plan structure

---

## Current Status

**Working:**
- ✅ User authentication
- ✅ Entitlement system (new)
- ✅ Chat endpoints with capability checks

**Needs Migration:**
- ❌ Payment creation endpoints
- ❌ Subscription management endpoints
- ❌ Public plan listing (payment flow)

---

**Recommendation:** Since you're rebuilding from scratch and testing with Postman, focus on the entitlement system first. Payment integration can be added after core functionality is validated.
