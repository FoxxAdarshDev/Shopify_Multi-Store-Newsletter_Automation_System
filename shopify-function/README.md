# Newsletter Discount Validation - Shopify Function

This Shopify Function validates newsletter subscriber discount codes at checkout, preventing their use when the cart total exceeds $1,000.

## Problem Solved

- ✅ **Cart validation works** - Shows warnings on cart page
- ❌ **Checkout validation doesn't work** - JavaScript blocked by Shopify security
- ✅ **This Function works** - Server-side validation at checkout

## How It Works

1. **Customer Check**: Verifies if customer has newsletter subscriber tags using correct `hasTag` boolean
2. **Discount Code Check**: Only validates when newsletter discount codes are actually applied
3. **Cart Total Check**: Calculates if cart exceeds $1,000 threshold for newsletter codes  
4. **Selective Block**: Only prevents checkout when newsletter codes are applied AND cart exceeds limit
5. **Clear Message**: Shows specific error with amount to remove

## Key Features

✅ **Scoped Validation**: Only blocks when newsletter discount codes are applied
✅ **Correct Tag Checking**: Uses `hasTag` boolean, not just tag strings
✅ **Named Export**: Uses proper `export function run()` for Shopify Functions
✅ **Production Safe**: No sensitive token logging in production

## Features

- ✅ Works with existing Shopify discount codes (WELCOME50, etc.)
- ✅ Integrates with customer segments
- ✅ Blocks all express checkouts (Shop Pay, Apple Pay, etc.)
- ✅ Shows clear error messages to customers
- ✅ Configurable via Shopify Admin

## Setup Instructions

### 1. Install Shopify CLI
```bash
npm install -g @shopify/cli @shopify/theme
```

### 2. Create Shopify App (if you don't have one)
```bash
shopify app init newsletter-discount-validation
cd newsletter-discount-validation
```

### 3. Add the Function
Copy the function files to your app:
```
your-shopify-app/
├── extensions/
│   └── newsletter-discount-validation/
│       ├── src/
│       │   └── run.js
│       ├── input.graphql
│       ├── shopify.extension.toml
│       └── package.json
```

### 4. Deploy the Function
```bash
shopify app deploy
```

### 5. Activate in Shopify Admin

1. Go to **Settings > Checkout**
2. Scroll to **Checkout Rules**  
3. Click **Add rule**
4. Select your **Newsletter Discount Validation** function
5. Configure settings:
   - **Maximum Amount**: 100000 (= $1,000.00)
   - **Discount Codes**: WELCOME50,WELCOME15
6. Click **Activate**

## Configuration

The function can be configured in Shopify Admin under Checkout Rules:

- **Subscriber Maximum Amount**: Cart limit in cents (100000 = $1,000)
- **Newsletter Discount Codes**: Comma-separated list of codes to validate
- **Error Message Template**: Custom error message with placeholders

## Customer Segment Requirements

Ensure your Shopify customer segment is set up correctly:

1. **Shopify Admin > Customers > Segments**
2. **Segment Name**: "Newsletter Subscribers" (exact match)
3. **Criteria**: Email marketing status = Subscribed
4. **Save the segment**

## Testing

### Test Case 1: Cart Under $1,000
- ✅ Newsletter subscriber
- ✅ Cart total: $800
- ✅ Expected: Discount works normally

### Test Case 2: Cart Over $1,000  
- ✅ Newsletter subscriber
- ✅ Cart total: $1,200
- ❌ Expected: Checkout blocked with error message

### Test Case 3: Non-subscriber
- ❌ Not a newsletter subscriber  
- ✅ Cart total: $1,200
- ✅ Expected: All discounts work normally (no restriction)

## Error Messages

When validation fails, customers see:

> **Newsletter subscriber discount codes (WELCOME50) are only valid for orders up to $1,000.00. Your current cart total is $1,200.00. Please remove $200.00 worth of items to use your discount code.**

## Integration with Existing System

This function works alongside your existing:
- ✅ Cart page validation (shows warnings)
- ✅ Newsletter popup and subscription tracking
- ✅ Shopify discount configuration  
- ✅ Customer segmentation

## Troubleshooting

### Function Not Working
1. Check that function is **Active** in Checkout Rules
2. Verify customer segment name matches exactly
3. Check function logs in Shopify Partner Dashboard

### Validation Too Strict
1. Adjust "Subscriber Maximum Amount" in settings
2. Update discount code list if needed
3. Modify error message template

### Customer Segment Issues  
1. Ensure segment criteria includes newsletter subscribers
2. Check that customers are properly tagged
3. Verify segment name matches function configuration

## Advanced Features

The function supports:
- Multiple discount codes
- Configurable thresholds
- Custom error messages
- Express checkout blocking
- Customer segment flexibility

## Support

For issues or questions:
1. Check Shopify Function logs in Partner Dashboard
2. Verify customer segments in Shopify Admin
3. Test with different cart totals and customer types