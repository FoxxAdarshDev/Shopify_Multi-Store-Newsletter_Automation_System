/**
 * Shopify Cart Validation Script for Foxx Newsletter Subscribers
 * Add this script to your cart.liquid and checkout.liquid files
 * 
 * This script checks if:
 * 1. User is subscribed (from popup session storage)
 * 2. Cart value exceeds the threshold ($1000)
 * 3. Shows appropriate messages for coupon restrictions
 */

(function() {
  'use strict';
  
  // Configuration - Update this with your actual store ID from the popup builder
  const STORE_ID = 'fa37fc5c-90ce-44d2-83d8-34835f3b45af'; // Replace with your actual store ID
  const CART_THRESHOLD = 1000; // $1000 threshold from your popup builder settings
  const DISCOUNT_CODE = 'WELCOME15'; // Your discount code from popup builder
  
  // Session storage keys (matching the popup system)
  const STORAGE_KEY = `foxx_newsletter_${STORE_ID}`;
  const SESSION_KEY = `${STORAGE_KEY}_session`;
  const CART_VALIDATION_SESSION_KEY = `${STORAGE_KEY}_cart_validation_session`;
  
  /**
   * Check if user is subscribed based on session storage
   */
  function isUserSubscribed() {
    try {
      // Check multiple session storage keys that indicate subscription
      const hasRegularSession = sessionStorage.getItem(SESSION_KEY) === 'true';
      const hasCartValidationSession = sessionStorage.getItem(CART_VALIDATION_SESSION_KEY) === 'true';
      const hasLocalStorageSubscription = localStorage.getItem(STORAGE_KEY) !== null;
      
      return hasRegularSession || hasCartValidationSession || hasLocalStorageSubscription;
    } catch (error) {
      console.log('Foxx Cart Validation: Could not check subscription status', error);
      return false;
    }
  }
  
  /**
   * Get current cart total in cents
   * This works with Shopify's cart object
   */
  function getCartTotal() {
    try {
      // Try to get cart total from Shopify's global cart object
      if (window.Shopify && window.Shopify.cart) {
        return window.Shopify.cart.total_price / 100; // Convert from cents to dollars
      }
      
      // Fallback: Try to get from cart.liquid template variables
      if (window.cart && window.cart.total_price) {
        return window.cart.total_price / 100;
      }
      
      // Another fallback: Parse from page content
      const cartTotalElement = document.querySelector('[data-cart-total]') || 
                              document.querySelector('.cart-total') ||
                              document.querySelector('.total-price');
      
      if (cartTotalElement) {
        const totalText = cartTotalElement.textContent || cartTotalElement.innerText;
        const totalMatch = totalText.match(/[\d,]+\.?\d*/);
        if (totalMatch) {
          return parseFloat(totalMatch[0].replace(',', ''));
        }
      }
      
      return 0;
    } catch (error) {
      console.log('Foxx Cart Validation: Could not get cart total', error);
      return 0;
    }
  }
  
  /**
   * Create and show the validation message
   */
  function showCartValidationMessage() {
    // Remove any existing validation message
    const existingMessage = document.getElementById('foxx-cart-validation-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // Create the validation message
    const messageDiv = document.createElement('div');
    messageDiv.id = 'foxx-cart-validation-message';
    messageDiv.style.cssText = `
      background: #f8d7da;
      border: 1px solid #f1aeb5;
      color: #721c24;
      padding: 12px 16px;
      margin: 16px 0;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.4;
      display: flex;
      align-items: flex-start;
      gap: 8px;
    `;
    
    messageDiv.innerHTML = `
      <span style="font-size: 16px; margin-top: -2px;">⚠️</span>
      <div>
        <strong>Discount Not Applicable</strong><br>
        Your cart total exceeds $${CART_THRESHOLD.toLocaleString()}. The discount code <strong>${DISCOUNT_CODE}</strong> 
        is only valid for orders under $${CART_THRESHOLD.toLocaleString()}. 
        Please reduce your cart value to apply the discount.
      </div>
    `;
    
    // Find the best place to insert the message
    const cartForm = document.querySelector('form[action="/cart"]') ||
                    document.querySelector('.cart-form') ||
                    document.querySelector('.cart') ||
                    document.querySelector('#cart');
    
    if (cartForm) {
      cartForm.insertBefore(messageDiv, cartForm.firstChild);
    } else {
      // Fallback: Insert at top of main content
      const mainContent = document.querySelector('main') || document.querySelector('.main') || document.body;
      mainContent.insertBefore(messageDiv, mainContent.firstChild);
    }
  }
  
  /**
   * Create and show checkout validation message
   */
  function showCheckoutValidationMessage() {
    // Remove any existing validation message
    const existingMessage = document.getElementById('foxx-checkout-validation-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // Find discount code input field
    const discountInput = document.querySelector('input[name="discount_code"]') ||
                         document.querySelector('[data-discount-field]') ||
                         document.querySelector('#discount_code') ||
                         document.querySelector('.discount-code');
    
    if (!discountInput) return;
    
    // Create the validation message
    const messageDiv = document.createElement('div');
    messageDiv.id = 'foxx-checkout-validation-message';
    messageDiv.style.cssText = `
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      color: #856404;
      padding: 10px 12px;
      margin: 8px 0;
      border-radius: 6px;
      font-size: 13px;
      line-height: 1.3;
    `;
    
    messageDiv.innerHTML = `
      <strong>Note:</strong> Your ${DISCOUNT_CODE} discount code is not applicable for orders over $${CART_THRESHOLD.toLocaleString()}.
    `;
    
    // Insert message near the discount input
    const discountContainer = discountInput.closest('.field') || 
                             discountInput.closest('.form-group') ||
                             discountInput.closest('div') ||
                             discountInput.parentElement;
    
    if (discountContainer) {
      discountContainer.appendChild(messageDiv);
    }
  }
  
  /**
   * Prevent discount code application if cart exceeds threshold
   */
  function restrictDiscountApplication() {
    const discountForms = document.querySelectorAll('form[action*="discount"]');
    const discountButtons = document.querySelectorAll('[data-discount-apply], .discount-apply, input[type="submit"][value*="Apply"]');
    
    // Add event listeners to discount forms
    discountForms.forEach(form => {
      form.addEventListener('submit', function(e) {
        const cartTotal = getCartTotal();
        const isSubscribed = isUserSubscribed();
        
        if (isSubscribed && cartTotal > CART_THRESHOLD) {
          e.preventDefault();
          alert(`Sorry, the ${DISCOUNT_CODE} discount code is only valid for orders under $${CART_THRESHOLD.toLocaleString()}. Your current cart total is $${cartTotal.toFixed(2)}.`);
          return false;
        }
      });
    });
    
    // Add event listeners to discount buttons
    discountButtons.forEach(button => {
      button.addEventListener('click', function(e) {
        const cartTotal = getCartTotal();
        const isSubscribed = isUserSubscribed();
        
        if (isSubscribed && cartTotal > CART_THRESHOLD) {
          e.preventDefault();
          alert(`Sorry, the ${DISCOUNT_CODE} discount code is only valid for orders under $${CART_THRESHOLD.toLocaleString()}. Your current cart total is $${cartTotal.toFixed(2)}.`);
          return false;
        }
      });
    });
  }
  
  /**
   * Main validation function
   */
  function performCartValidation() {
    const isSubscribed = isUserSubscribed();
    const cartTotal = getCartTotal();
    
    if (!isSubscribed) {
      console.log('Foxx Cart Validation: User not subscribed, no validation needed');
      return;
    }
    
    console.log(`Foxx Cart Validation: User subscribed, cart total: $${cartTotal}, threshold: $${CART_THRESHOLD}`);
    
    if (cartTotal > CART_THRESHOLD) {
      // Show validation message on cart page
      if (window.location.pathname.includes('/cart')) {
        showCartValidationMessage();
      }
      
      // Show validation message on checkout page
      if (window.location.pathname.includes('/checkout')) {
        showCheckoutValidationMessage();
      }
      
      // Restrict discount code application
      restrictDiscountApplication();
    }
  }
  
  /**
   * Initialize the validation system
   */
  function initCartValidation() {
    // Run validation on page load
    performCartValidation();
    
    // Re-run validation when cart updates (for AJAX cart updates)
    if (window.Shopify && window.Shopify.onCartUpdate) {
      window.Shopify.onCartUpdate.push(performCartValidation);
    }
    
    // Listen for cart update events
    document.addEventListener('cart:updated', performCartValidation);
    document.addEventListener('cart:changed', performCartValidation);
    
    // For checkout page, monitor for changes
    if (window.location.pathname.includes('/checkout')) {
      // Re-run validation after a short delay to ensure checkout is fully loaded
      setTimeout(performCartValidation, 1000);
      setTimeout(performCartValidation, 3000);
    }
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCartValidation);
  } else {
    initCartValidation();
  }
  
  // Also initialize on window load as fallback
  window.addEventListener('load', initCartValidation);
  
})();