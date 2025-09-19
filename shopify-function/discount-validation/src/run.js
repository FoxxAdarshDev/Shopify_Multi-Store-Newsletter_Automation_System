// SHOPIFY FUNCTION: Newsletter Discount Validation
// Prevents newsletter subscriber discount codes when cart exceeds configured threshold
// Only blocks when newsletter discount codes are actually applied

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

/**
 * @type {FunctionRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * Main validation function
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  // Get cart information
  const cart = input.cart;
  if (!cart) {
    console.error('No cart found in input');
    return NO_CHANGES;
  }

  // Get customer information
  const customer = cart.buyerIdentity?.customer;
  if (!customer) {
    // No customer logged in, allow all discounts
    console.log('No customer found - allowing all discounts');
    return NO_CHANGES;
  }

  // Configuration constants with default values
  // Note: Extension settings access may vary by Shopify API version
  // Using fallback defaults until proper settings integration is verified
  const subscriberMaxAmount = 100000; // $1,000.00 in cents
  const newsletterDiscountCodes = ['WELCOME50', 'WELCOME15'];

  // Get cart total in cents
  const cartTotalCents = Math.round(parseFloat(cart.cost.totalAmount.amount) * 100);
  
  console.log('Validation Setup:', {
    customerEmail: customer.email,
    cartTotal: `$${(cartTotalCents / 100).toFixed(2)}`,
    threshold: `$${(subscriberMaxAmount / 100).toFixed(2)}`,
    newsletterCodes: newsletterDiscountCodes
  });

  // Check if customer is a newsletter subscriber using correct hasTags structure
  let isNewsletterSubscriber = false;
  
  if (customer.hasTags && Array.isArray(customer.hasTags)) {
    isNewsletterSubscriber = customer.hasTags.some(tagResponse => {
      // Correctly use the hasTag boolean, not just the tag string
      if (tagResponse.hasTag) {
        const tag = tagResponse.tag.toLowerCase();
        return tag.includes('newsletter') || 
               tag.includes('subscriber') ||
               tag === 'newsletter subscribers';
      }
      return false;
    });
  }

  console.log('Subscriber Check:', {
    isNewsletterSubscriber,
    customerTags: customer.hasTags?.map(t => `${t.tag}:${t.hasTag}`)
  });

  // If customer is not a newsletter subscriber, allow all discounts
  if (!isNewsletterSubscriber) {
    console.log('Customer is not a newsletter subscriber - allowing all discounts');
    return NO_CHANGES;
  }

  // Check if cart total is within the subscriber limit
  if (cartTotalCents <= subscriberMaxAmount) {
    console.log(`Cart total $${(cartTotalCents / 100).toFixed(2)} is within subscriber limit $${(subscriberMaxAmount / 100).toFixed(2)} - allowing discounts`);
    return NO_CHANGES;
  }

  // Cart exceeds limit - check if newsletter discount codes are applied
  const appliedDiscounts = cart.discountCodes || [];
  
  // Only block if newsletter discount codes are actually being used
  const hasNewsletterDiscount = appliedDiscounts.some(discount => {
    const discountCode = discount.code?.toUpperCase() || '';
    return newsletterDiscountCodes.some(newsletterCode => 
      discountCode.includes(newsletterCode)
    );
  });

  console.log('Applied Discounts Check:', {
    appliedDiscounts: appliedDiscounts.map(d => d.code),
    hasNewsletterDiscount
  });

  // If no newsletter discount codes are applied, allow checkout
  if (!hasNewsletterDiscount) {
    console.log('No newsletter discount codes applied - allowing checkout');
    return NO_CHANGES;
  }

  // Newsletter discount codes are applied and cart exceeds limit - block checkout
  const excessAmount = cartTotalCents - subscriberMaxAmount;
  const appliedNewsletterCodes = appliedDiscounts
    .filter(discount => {
      const discountCode = discount.code?.toUpperCase() || '';
      return newsletterDiscountCodes.some(newsletterCode => 
        discountCode.includes(newsletterCode)
      );
    })
    .map(discount => discount.code)
    .join(', ');

  const errorMessage = `Newsletter subscriber discount codes (${appliedNewsletterCodes}) are only valid for orders up to $${(subscriberMaxAmount / 100).toFixed(2)}. Your current cart total is $${(cartTotalCents / 100).toFixed(2)}. Please remove $${(excessAmount / 100).toFixed(2)} worth of items to use your discount code.`;

  console.log('Blocking newsletter discount - cart exceeds limit and newsletter codes applied');

  // Return validation error that blocks checkout
  return {
    operations: [{
      message: errorMessage,
      target: "cart"
    }]
  };
}