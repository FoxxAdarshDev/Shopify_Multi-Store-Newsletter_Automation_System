/**
 * Shopify Cart Validation Script for Foxx Newsletter Subscribers
 * Add this script to your cart.liquid and checkout.liquid files
 * 
 * This script:
 * 1. Prevents auto-application of discount codes when cart exceeds threshold
 * 2. Removes already applied coupons if cart exceeds threshold
 * 3. Shows real-time validation messages
 * 4. Only allows discount for subscribed users under threshold
 */

(function() {
  'use strict';
  
  // Configuration - Update this with your actual store ID from the popup builder
  const STORE_ID = 'fa37fc5c-90ce-44d2-83d8-34835f3b45af'; // Replace with your actual store ID
  const CART_THRESHOLD = 1000; // $1000 threshold from your popup builder settings
  const DISCOUNT_CODE = 'WELCOME50'; // Your discount code from popup builder
  
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
   * Get current cart total (original cart total before discounts)
   * This works with Shopify's cart object
   */
  function getCartTotal() {
    try {
      // Get ORIGINAL cart total (before discounts)
      if (window.Shopify && window.Shopify.cart) {
        // Use items_subtotal_price for original total or total_price if no discounts
        const originalTotal = window.Shopify.cart.items_subtotal_price || window.Shopify.cart.total_price;
        return originalTotal / 100; // Convert from cents to dollars
      }
      
      // Fallback: Try to get from cart.liquid template variables  
      if (window.cart && window.cart.total_price) {
        return window.cart.total_price / 100;
      }
      
      // Try to find original subtotal before discounts
      const subtotalElement = document.querySelector('[data-cart-subtotal]') || 
                             document.querySelector('.cart-subtotal') ||
                             document.querySelector('.subtotal-price');
      
      if (subtotalElement) {
        const subtotalText = subtotalElement.textContent || subtotalElement.innerText;
        const subtotalMatch = subtotalText.match(/[\d,]+\.?\d*/);
        if (subtotalMatch) {
          return parseFloat(subtotalMatch[0].replace(',', ''));
        }
      }
      
      // Final fallback: Parse from any total element
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
   * Remove applied discount codes if cart exceeds threshold
   */
  function removeInvalidDiscountCodes() {
    try {
      // For checkout page - remove discount codes via Shopify API
      if (window.location.pathname.includes('/checkout')) {
        // Try to remove discount via Shopify checkout API
        if (window.Shopify && window.Shopify.checkout) {
          // Clear discount codes from checkout
          const currentDiscounts = document.querySelectorAll('[data-discount-code], .discount-code-tag, .tag');
          currentDiscounts.forEach(discountTag => {
            if (discountTag.textContent.includes(DISCOUNT_CODE) || discountTag.textContent.includes('WELCOME')) {
              // Try to remove the discount by clicking remove button
              const removeBtn = discountTag.querySelector('[data-discount-remove], .remove, .tag__remove');
              if (removeBtn) {
                removeBtn.click();
              }
            }
          });
        }
        
        // Also try to clear the discount input field
        const discountInput = document.querySelector('input[name="discount_code"]') ||
                             document.querySelector('[data-discount-field]') ||
                             document.querySelector('#discount_code');
        
        if (discountInput && (discountInput.value.includes(DISCOUNT_CODE) || discountInput.value.includes('WELCOME'))) {
          discountInput.value = '';
          // Trigger form update
          const form = discountInput.closest('form');
          if (form) {
            const event = new Event('input', { bubbles: true });
            discountInput.dispatchEvent(event);
          }
        }
      }

      // For cart page - redirect to remove discount
      if (window.location.pathname.includes('/cart')) {
        // Check if discount is already applied by looking at URL or cart state
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.has('discount') || 
            document.querySelector('.cart-discount, [data-cart-discount]')) {
          
          // Show warning and offer to remove discount
          const messageDiv = document.getElementById('foxx-cart-validation-message');
          if (messageDiv) {
            messageDiv.innerHTML = `
              <span style="font-size: 16px; margin-top: -2px;">⚠️</span>
              <div>
                <strong>Discount Code Not Applicable</strong><br>
                Your cart total is $${getCartTotal().toFixed(2)}, which exceeds our $${CART_THRESHOLD.toLocaleString()} discount eligibility threshold.
                <br>
                The discount code <strong>${DISCOUNT_CODE}</strong> you received from our newsletter signup is only valid for orders under $${CART_THRESHOLD.toLocaleString()}.
                <br><br>
                💡 <strong>Tip:</strong> Remove some items to bring your cart under $${CART_THRESHOLD.toLocaleString()} and the discount code will be applicable at checkout.
                <br><br>
                <button onclick="window.location.href='/cart/clear?return_to=/cart'" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; margin-right: 10px;">Remove Discount</button>
                <button onclick="this.parentElement.parentElement.parentElement.style.display='none'" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px;">Dismiss</button>
              </div>
            `;
          }
        }
      }
    } catch (error) {
      console.log('Foxx Cart Validation: Could not remove discount codes', error);
    }
  }
  
  /**
   * Create and show the validation message with real-time cart calculations
   */
  function showCartValidationMessage() {
    // Remove any existing validation message
    const existingMessage = document.getElementById('foxx-cart-validation-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    const cartTotal = getCartTotal();
    const overage = cartTotal - CART_THRESHOLD;
    
    // Create the validation message
    const messageDiv = document.createElement('div');
    messageDiv.id = 'foxx-cart-validation-message';
    messageDiv.style.cssText = `
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      color: #856404;
      padding: 16px;
      margin: 16px 0;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.5;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    
    messageDiv.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <span style="font-size: 18px; margin-top: 2px;">⚠️</span>
        <div style="flex: 1;">
          <strong style="color: #856404; font-size: 16px;">Discount Code Not Applicable</strong><br>
          <div style="margin-top: 8px; color: #6c5400;">
            Your cart total is <strong>$${cartTotal.toFixed(2)}</strong>, which exceeds our <strong>$${CART_THRESHOLD.toLocaleString()}</strong> discount eligibility threshold.
            <br><br>
            The discount code <strong>${DISCOUNT_CODE}</strong> you received from our newsletter signup is only valid for orders under $${CART_THRESHOLD.toLocaleString()}.
            <br><br>
            💡 <strong>Tip:</strong> Remove some items to bring your cart under $${CART_THRESHOLD.toLocaleString()} and the discount code will be applicable at checkout.
            <br>
            <small style="color: #997404; margin-top: 8px; display: block;">
              <strong>Current cart:</strong> $${cartTotal.toFixed(2)} | <strong>Needs to be under:</strong> $${CART_THRESHOLD.toFixed(2)} | <strong>Remove:</strong> $${overage.toFixed(2)} worth of items
            </small>
          </div>
        </div>
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
   * Create and show checkout validation message with automatic discount removal
   */
  function showCheckoutValidationMessage() {
    // Remove any existing validation message
    const existingMessage = document.getElementById('foxx-checkout-validation-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    const cartTotal = getCartTotal();
    const overage = cartTotal - CART_THRESHOLD;
    
    // Try to remove any applied discount codes first
    removeInvalidDiscountCodes();
    
    // Find discount code input field or applied discount tags
    const discountInput = document.querySelector('input[name="discount_code"]') ||
                         document.querySelector('[data-discount-field]') ||
                         document.querySelector('#discount_code') ||
                         document.querySelector('.discount-code');
    
    // Look for applied discount tags
    const discountTags = document.querySelectorAll('[data-discount-code], .discount-code-tag, .tag');
    const hasAppliedDiscount = Array.from(discountTags).some(tag => 
      tag.textContent.includes(DISCOUNT_CODE) || tag.textContent.includes('WELCOME')
    );
    
    // Create the validation message
    const messageDiv = document.createElement('div');
    messageDiv.id = 'foxx-checkout-validation-message';
    messageDiv.style.cssText = `
      background: ${hasAppliedDiscount ? '#f8d7da' : '#fff3cd'};
      border: 1px solid ${hasAppliedDiscount ? '#f1aeb5' : '#ffeaa7'};
      color: ${hasAppliedDiscount ? '#721c24' : '#856404'};
      padding: 12px 16px;
      margin: 12px 0;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.4;
      position: relative;
    `;
    
    if (hasAppliedDiscount) {
      messageDiv.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 10px;">
          <span style="font-size: 16px;">🚫</span>
          <div>
            <strong>Invalid Discount Applied</strong><br>
            The <strong>${DISCOUNT_CODE}</strong> discount has been automatically removed because your order total ($${cartTotal.toFixed(2)}) exceeds the $${CART_THRESHOLD.toLocaleString()} eligibility threshold.
            <br><br>
            <small style="opacity: 0.9;">Reduce your cart by $${overage.toFixed(2)} to apply the discount.</small>
          </div>
        </div>
      `;
    } else {
      messageDiv.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 10px;">
          <span style="font-size: 16px;">ℹ️</span>
          <div>
            <strong>Discount Not Available</strong><br>
            Your <strong>${DISCOUNT_CODE}</strong> newsletter discount is not applicable for orders over $${CART_THRESHOLD.toLocaleString()}.
            <br>
            <small style="opacity: 0.9;">Current total: $${cartTotal.toFixed(2)} | Threshold: $${CART_THRESHOLD.toFixed(2)}</small>
          </div>
        </div>
      `;
    }
    
    // Insert message in the most appropriate place
    if (discountInput) {
      const discountContainer = discountInput.closest('.field') || 
                               discountInput.closest('.form-group') ||
                               discountInput.closest('.section') ||
                               discountInput.closest('div') ||
                               discountInput.parentElement;
      
      if (discountContainer) {
        // Insert after the discount container
        discountContainer.parentElement.insertBefore(messageDiv, discountContainer.nextSibling);
      }
    } else {
      // Fallback: Insert near order summary
      const orderSummary = document.querySelector('.order-summary') ||
                          document.querySelector('[data-order-summary]') ||
                          document.querySelector('.sidebar') ||
                          document.querySelector('aside');
      
      if (orderSummary) {
        orderSummary.insertBefore(messageDiv, orderSummary.firstChild);
      }
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
   * Main validation function - handles all validation logic
   */
  function performCartValidation() {
    const isSubscribed = isUserSubscribed();
    const cartTotal = getCartTotal();
    
    console.log(`Foxx Cart Validation: User subscribed: ${isSubscribed}, cart total: $${cartTotal}, threshold: $${CART_THRESHOLD}`);
    
    // Always check for and remove any existing validation messages if cart is under threshold
    if (cartTotal <= CART_THRESHOLD) {
      const existingCartMessage = document.getElementById('foxx-cart-validation-message');
      if (existingCartMessage) {
        existingCartMessage.remove();
      }
      
      const existingCheckoutMessage = document.getElementById('foxx-checkout-validation-message');
      if (existingCheckoutMessage) {
        existingCheckoutMessage.remove();
      }
      
      console.log('Foxx Cart Validation: Cart under threshold, validation messages removed');
      return;
    }
    
    // Only proceed with validation if user is subscribed (has access to discount)
    if (!isSubscribed) {
      console.log('Foxx Cart Validation: User not subscribed, no validation needed');
      return;
    }
    
    // Cart exceeds threshold - show appropriate messages and restrict discounts
    if (cartTotal > CART_THRESHOLD) {
      console.log(`Foxx Cart Validation: Cart exceeds threshold ($${cartTotal} > $${CART_THRESHOLD}), applying restrictions`);
      
      // Handle cart page validation
      if (window.location.pathname.includes('/cart')) {
        showCartValidationMessage();
        // Try to prevent auto-discount application on cart page
        removeInvalidDiscountCodes();
      }
      
      // Handle checkout page validation  
      if (window.location.pathname.includes('/checkout')) {
        showCheckoutValidationMessage();
        // This function already calls removeInvalidDiscountCodes()
      }
      
      // Restrict manual discount code application
      restrictDiscountApplication();
    }
  }

  /**
   * Enhanced function to prevent auto-application of discounts
   */
  function preventAutoDiscountApplication() {
    const isSubscribed = isUserSubscribed();
    const cartTotal = getCartTotal();
    
    // Only prevent auto-application for subscribed users with carts over threshold
    if (isSubscribed && cartTotal > CART_THRESHOLD) {
      // Monitor for automatic discount application
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'childList') {
            // Check for newly added discount elements
            const addedNodes = Array.from(mutation.addedNodes);
            addedNodes.forEach(node => {
              if (node.nodeType === 1) { // Element node
                const discountElements = node.querySelectorAll ? 
                  node.querySelectorAll('[data-discount-code], .discount-code-tag, .tag') : [];
                
                discountElements.forEach(element => {
                  if (element.textContent.includes(DISCOUNT_CODE) || 
                      element.textContent.includes('WELCOME')) {
                    console.log('Foxx Cart Validation: Auto-applied discount detected, removing...');
                    removeInvalidDiscountCodes();
                    performCartValidation();
                  }
                });
              }
            });
          }
        });
      });
      
      // Start observing changes to detect auto-applied discounts
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // Store observer reference for cleanup
      window.foxxDiscountObserver = observer;
    }
  }
  
  /**
   * Initialize the validation system with enhanced functionality
   */
  function initCartValidation() {
    console.log('Foxx Cart Validation: Initializing validation system...');
    
    // Run initial validation on page load
    performCartValidation();
    
    // Setup auto-discount prevention monitoring
    preventAutoDiscountApplication();
    
    // Re-run validation when cart updates (for AJAX cart updates)
    if (window.Shopify && window.Shopify.onCartUpdate) {
      window.Shopify.onCartUpdate.push(performCartValidation);
    }
    
    // Listen for various cart update events
    document.addEventListener('cart:updated', performCartValidation);
    document.addEventListener('cart:changed', performCartValidation);
    document.addEventListener('cart:rebuild', performCartValidation);
    
    // Listen for Shopify checkout events
    document.addEventListener('shopify:checkout:updated', performCartValidation);
    document.addEventListener('shopify:discount:applied', performCartValidation);
    
    // For checkout page, provide enhanced monitoring
    if (window.location.pathname.includes('/checkout')) {
      console.log('Foxx Cart Validation: Setting up checkout monitoring...');
      
      // Multiple validation runs to catch all checkout scenarios
      setTimeout(performCartValidation, 500);
      setTimeout(performCartValidation, 1500);
      setTimeout(performCartValidation, 3000);
      setTimeout(performCartValidation, 5000);
      
      // Monitor for checkout form changes
      const checkoutForm = document.querySelector('form');
      if (checkoutForm) {
        checkoutForm.addEventListener('change', function() {
          setTimeout(performCartValidation, 500);
        });
      }
      
      // Monitor discount input field specifically
      const discountInput = document.querySelector('input[name="discount_code"]');
      if (discountInput) {
        discountInput.addEventListener('input', function() {
          setTimeout(performCartValidation, 300);
        });
        discountInput.addEventListener('blur', function() {
          setTimeout(performCartValidation, 500);
        });
      }
    }
    
    // For cart page, monitor cart updates more frequently
    if (window.location.pathname.includes('/cart')) {
      console.log('Foxx Cart Validation: Setting up cart monitoring...');
      
      // Monitor quantity changes
      document.addEventListener('change', function(e) {
        if (e.target.matches('[name*="quantity"], [data-quantity-input]')) {
          setTimeout(performCartValidation, 500);
        }
      });
      
      // Monitor remove item buttons
      document.addEventListener('click', function(e) {
        if (e.target.matches('[data-cart-remove], .cart-remove, [href*="/cart/change"]')) {
          setTimeout(performCartValidation, 1000);
        }
      });
    }
    
    console.log('Foxx Cart Validation: Validation system initialized successfully');
  }

  // Cleanup function for page navigation
  function cleanup() {
    if (window.foxxDiscountObserver) {
      window.foxxDiscountObserver.disconnect();
      window.foxxDiscountObserver = null;
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
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanup);
  
})();