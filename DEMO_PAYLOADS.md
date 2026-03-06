# Multi-Currency Plan Creation Demo Payloads

## Endpoint
**POST** `/api/admin/plans/create-with-entitlements`

**Authentication:** Required (Admin Token)

---

## Demo Payload 1: Pro Plan - Global (AUD base + Auto-convert)

```json
{
  "plan": {
    "name": "pro",
    "display_name": "Pro Plan",
    "slug": "pro-plan",
    "description": "Professional plan with advanced features for power users",
    "base_amount_monthly": 1999,
    "base_amount_yearly": 19999,
    "target_regions": [
      {
        "currency": "AUD"
      },
      {
        "currency": "USD"
      },
      {
        "currency": "INR"
      },
      {
        "currency": "GBP"
      },
      {
        "currency": "EUR"
      },
      {
        "currency": "CAD"
      }
    ],
    "features": [
      "50 AI model deployments",
      "100 API calls/min",
      "Custom training data",
      "Advanced analytics",
      "Priority support",
      "Custom domain"
    ],
    "category": "business",
    "is_contact_sales": false,
    "sort_order": 2
  },
  "entitlements": [
    {
      "entitlement_key": "max_deployments",
      "value": 50
    },
    {
      "entitlement_key": "api_rate_limit",
      "value": 100
    },
    {
      "entitlement_key": "custom_training_data",
      "value": true
    },
    {
      "entitlement_key": "advanced_analytics",
      "value": true
    },
    {
      "entitlement_key": "priority_support",
      "value": true
    },
    {
      "entitlement_key": "custom_domain",
      "value": true
    }
  ]
}
```

---

## Demo Payload 2: Enterprise Plan - Region-Specific Overrides

This plan uses custom amounts for specific regions instead of auto-conversion.

```json
{
  "plan": {
    "name": "enterprise",
    "display_name": "Enterprise Plan",
    "slug": "enterprise-plan",
    "description": "Unlimited everything - contact sales for custom pricing",
    "base_amount_monthly": 9999,
    "base_amount_yearly": 99999,
    "target_regions": [
      {
        "currency": "AUD",
        "custom_amount_monthly": 9999,
        "custom_amount_yearly": 99999
      },
      {
        "currency": "USD",
        "custom_amount_monthly": 6500,
        "custom_amount_yearly": 65000
      },
      {
        "currency": "INR",
        "custom_amount_monthly": 542500,
        "custom_amount_yearly": 5425000
      },
      {
        "currency": "GBP",
        "custom_amount_monthly": 5100,
        "custom_amount_yearly": 51000
      },
      {
        "currency": "EUR"
      },
      {
        "currency": "CAD",
        "custom_amount_monthly": 9000,
        "custom_amount_yearly": 90000
      }
    ],
    "features": [
      "Unlimited deployments",
      "Unlimited API calls",
      "Full API access",
      "Custom LLM training",
      "Dedicated account manager",
      "24/7 Premium support",
      "Custom integrations",
      "On-premise deployment option"
    ],
    "category": "enterprise",
    "is_contact_sales": true,
    "sort_order": 3
  },
  "entitlements": [
    {
      "entitlement_key": "max_deployments",
      "value": "unlimited"
    },
    {
      "entitlement_key": "api_rate_limit",
      "value": "unlimited"
    },
    {
      "entitlement_key": "custom_training_data",
      "value": true
    },
    {
      "entitlement_key": "advanced_analytics",
      "value": true
    },
    {
      "entitlement_key": "priority_support",
      "value": true
    },
    {
      "entitlement_key": "custom_domain",
      "value": true
    },
    {
      "entitlement_key": "dedicated_account_manager",
      "value": true
    },
    {
      "entitlement_key": "on_premise_deployment",
      "value": true
    }
  ]
}
```

---

## Demo Payload 3: Starter Plan - Minimal Setup (AUD only)

Simplest plan with just base currency.

```json
{
  "plan": {
    "name": "starter",
    "display_name": "Starter Plan",
    "slug": "starter-plan",
    "description": "Perfect for getting started with AI",
    "base_amount_monthly": 299,
    "base_amount_yearly": 2990,
    "target_regions": [
      {
        "currency": "AUD"
      }
    ],
    "features": [
      "5 AI model deployments",
      "10 API calls/min",
      "Basic analytics",
      "Community support"
    ],
    "category": "personal",
    "is_contact_sales": false,
    "sort_order": 1
  },
  "entitlements": [
    {
      "entitlement_key": "max_deployments",
      "value": 5
    },
    {
      "entitlement_key": "api_rate_limit",
      "value": 10
    },
    {
      "entitlement_key": "basic_analytics",
      "value": true
    }
  ]
}
```

---

## Demo Payload 4: Asia-Pacific Focus Plan

Optimized for Asia-Pacific regions with selective auto-conversion.

```json
{
  "plan": {
    "name": "apac-standard",
    "display_name": "Asia-Pacific Standard",
    "slug": "apac-standard-plan",
    "base_amount_monthly": 2499,
    "base_amount_yearly": 24990,
    "target_regions": [
      {
        "currency": "AUD",
        "custom_amount_monthly": 2499
      },
      {
        "currency": "INR",
        "custom_amount_monthly": 135000
      },
      {
        "currency": "SGD",
        "custom_amount_monthly": 2150
      },
      {
        "currency": "HKD"
      },
      {
        "currency": "JPY"
      },
      {
        "currency": "KRW"
      }
    ],
    "features": [
      "20 AI model deployments",
      "50 API calls/min",
      "Regional data storage",
      "Custom training data",
      "Standard analytics",
      "Email support"
    ],
    "category": "business",
    "is_contact_sales": false,
    "sort_order": 2
  },
  "entitlements": [
    {
      "entitlement_key": "max_deployments",
      "value": 20
    },
    {
      "entitlement_key": "api_rate_limit",
      "value": 50
    },
    {
      "entitlement_key": "custom_training_data",
      "value": true
    },
    {
      "entitlement_key": "regional_data_storage",
      "value": true
    }
  ]
}
```

---

## Expected Response Format

### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Plan with multi-currency pricing created successfully",
  "data": {
    "plan": {
      "id": "507f1f77bcf86cd799439011",
      "name": "pro",
      "display_name": "Pro Plan",
      "slug": "pro-plan",
      "prices": {
        "monthly": {
          "AUD": {
            "amount": 1999,
            "stripe_price_id": "price_1234567890",
            "source": "base"
          },
          "USD": {
            "amount": 1300,
            "stripe_price_id": "price_0987654321",
            "source": "auto_converted"
          },
          "INR": {
            "amount": 108400,
            "stripe_price_id": "price_abcdefghij",
            "source": "auto_converted"
          }
        },
        "yearly": {
          "AUD": {
            "amount": 19999,
            "stripe_price_id": "price_yearly_123",
            "source": "base"
          },
          "USD": {
            "amount": 13000,
            "stripe_price_id": "price_yearly_456",
            "source": "auto_converted"
          }
        }
      },
      "pricing_metadata": {
        "base_currency": "AUD",
        "base_amount_monthly": 1999,
        "base_amount_yearly": 19999,
        "supported_currencies": ["AUD", "USD", "INR", "GBP", "EUR", "CAD"],
        "conversion_applied_on": "2026-02-19T10:30:00.000Z",
        "conversion_source": "dynamic_rates"
      },
      "stripe_product_id": "prod_1A2B3C4D5E6F",
      "stripe_prices_created": 6,
      "status": "active"
    },
    "pricing_breakdown": [
      {
        "currency": "AUD",
        "monthly": {
          "amount": 1999,
          "source": "base"
        },
        "yearly": {
          "amount": 19999,
          "source": "base"
        }
      },
      {
        "currency": "USD",
        "monthly": {
          "amount": 1300,
          "source": "auto_converted"
        },
        "yearly": {
          "amount": 13000,
          "source": "auto_converted"
        }
      }
    ],
    "entitlements": {
      "summary": {
        "total": 6,
        "created": 6,
        "failed": 0
      },
      "created": [
        {
          "_id": "507f00000000000000000001",
          "plan_id": "507f1f77bcf86cd799439011",
          "entitlement_key": "max_deployments",
          "value": 50
        }
      ]
    },
    "warnings": [
      "Currency EUR has unusual conversion ratio (2.01x). Consider providing custom amount."
    ]
  }
}
```

### Error Response (400 Bad Request)

```json
{
  "success": false,
  "error": {
    "message": "Validation failed: Plan name is required and cannot be empty; Plan slug must be unique",
    "code": "VALIDATION_FAILED",
    "statusCode": 400
  }
}
```

---

## Testing with cURL

### Test Pro Plan Creation

```bash
curl -X POST http://localhost:8080/api/admin/plans/create-with-entitlements \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "plan": {
      "name": "pro",
      "display_name": "Pro Plan",
      "slug": "pro-plan",
      "base_amount_monthly": 1999,
      "base_amount_yearly": 19999,
      "target_regions": [
        { "currency": "AUD" },
        { "currency": "USD" },
        { "currency": "INR" }
      ],
      "features": ["50 deployments", "100 API calls/min"],
      "category": "business"
    },
    "entitlements": [
      {"entitlement_key": "max_deployments", "value": 50},
      {"entitlement_key": "api_rate_limit", "value": 100}
    ]
  }'
```

---

## Testing Plan Retrieval (Multi-Currency)

### Get All Plans with Localized Pricing

```bash
# Auto-detect user's region from IP
curl -X GET http://localhost:8080/api/subscriptions/plans \
  -H "Authorization: Bearer YOUR_TOKEN"

# Specify currency override
curl -X GET "http://localhost:8080/api/subscriptions/plans?currency=USD" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Filter by category
curl -X GET "http://localhost:8080/api/subscriptions/plans?category=business" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response includes localized prices:**

```json
{
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "pro",
      "display_name": "Pro Plan",
      "pricing": {
        "currency": "USD",
        "monthly": {
          "amount": 1300,
          "source": "auto_converted"
        },
        "yearly": {
          "amount": 13000,
          "source": "auto_converted"
        },
        "region_code": "US",
        "all_available_currencies": ["AUD", "USD", "INR", "GBP", "EUR", "CAD"]
      },
      "entitlements": {...}
    }
  ],
  "meta": {
    "detected_currency": "USD",
    "detected_region": "US",
    "total_plans": 3
  }
}
```

---

## Testing Checkout with Currency

### Create Checkout Session (Multi-Currency)

```bash
curl -X POST http://localhost:8080/api/payments/create-checkout-session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{
    "planId": "507f1f77bcf86cd799439011",
    "billingCycle": "monthly",
    "currency": "USD"
  }'
```

**Response:**

```json
{
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/pay/cs_live_xxxxxxxxxxx",
    "sessionId": "cs_live_xxxxxxxxxxx",
    "message": "Open this URL in browser to complete payment"
  }
}
```

---

## Supported Currencies & Countries

| Currency | Country Code | Base Rate |
|----------|-------------|-----------|
| AUD | AU, NZ | 1.0 |
| USD | US | 0.65 |
| INR | IN | 54.25 |
| GBP | GB | 0.51 |
| EUR | DE, FR, IT, ES, etc. | 0.60 |
| CAD | CA | 0.90 |
| JPY | JP | 101.50 |
| SGD | SG | 0.87 |
| HKD | HK | 5.06 |
| MYR | MY | 2.96 |
| THB | TH | 22.50 |
| VND | VN | 16400 |
| PHP | PH | 37.50 |
| IDR | ID | 10350 |
| KRW | KR | 850 |
| AED | AE | 2.39 |
| SAR | SA | 2.44 |
| EGP | EG | 20.15 |
| ZAR | ZA | 12.00 |
| BRL | BR | 3.25 |
| ARS | AR | 175.00 |
| MXN | MX | 17.50 |
| CLP | CL | 620.00 |

*Rates are as of 2026-02-19 and dynamically fetched from FX service. Values are cached for 6 hours.*

---

## Environment Variables for FX Rate Fetching

Add these to your `.env` file to enable dynamic rate fetching:

```env
# Option 1: Open Exchange Rates (https://openexchangerates.org)
OPEN_EXCHANGE_RATES_API_KEY=your_api_key_here

# Option 2: Fixer.io (https://fixer.io)
FIXER_IO_API_KEY=your_api_key_here

# Cache TTL in milliseconds (default: 6 hours = 21600000ms)
FX_CACHE_TTL_MS=21600000
```

If no API keys are configured, the system falls back to hardcoded rates.

---

## Notes

- All amounts are in **cents** (e.g., 1999 = $19.99)
- Base currency is always **AUD** (autralian dollars)
- Yearly prices are optional; if not provided, only monthly billing is supported
- "Contact Sales" plans (`is_contact_sales: true`) skip Stripe integration
- Conversion source is tracked for audit: `base`, `manual`, or `auto_converted`
- Suspicious conversion ratios (< 0.3x or > 5x) generate warnings but don't block creation
- All prices are rounded to nearest cent during conversion
