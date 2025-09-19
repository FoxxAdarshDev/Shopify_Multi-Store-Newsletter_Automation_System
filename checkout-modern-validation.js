// MODERN SHOPIFY CHECKOUT VALIDATION SCRIPT - 2024
// This script addresses JavaScript execution issues and uses modern approaches

(function() {
  'use strict';
  
  // Configuration - UPDATE THESE VALUES
  const CONFIG = {
    STORE_ID: 'fa37fc5c-90ce-44d2-83d8-34835f3b45af',
    SUBSCRIBER_MAXIMUM_AMOUNT: 100000, // $1000 in cents
    NEWSLETTER_DISCOUNT_CODES: ['WELCOME50', 'WELCOME15'],
    STORAGE_KEY_PREFIX: 'foxx_newsletter_'
  };
  
  // Enhanced console logging for debugging
  const log = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}] [FOXX-CHECKOUT-VALIDATION]`;
    
    switch(type) {
      case 'error':
        console.error(`${prefix} ❌`, message);
        break;
      case 'warn':
        console.warn(`${prefix} ⚠️`, message);
        break;
      case 'success':
        console.log(`${prefix} ✅`, message);
        break;
      default:
        console.log(`${prefix} 🔍`, message);
    }
  };
  
  log('Checkout validation script loaded and starting...');
  
  // Check if user is subscribed
  function isUserSubscribed() {
    try {
      const storageKey = CONFIG.STORAGE_KEY_PREFIX + CONFIG.STORE_ID;
      const subscribedEmail = localStorage.getItem(storageKey);
      const subscribedTime = localStorage.getItem(storageKey + '_time');
      
      const isSubscribed = subscribedEmail && 
                          subscribedEmail.includes('@') && 
                          subscribedTime;
                          
      log(`Subscription check: ${isSubscribed ? 'SUBSCRIBED' : 'NOT SUBSCRIBED'}`, isSubscribed ? 'success' : 'info');
      log(`Email: ${subscribedEmail}, Time: ${subscribedTime}`);
      
      return isSubscribed;
    } catch (error) {
      log(`Error checking subscription: ${error.message}`, 'error');
      return false;
    }
  }
  
  // Get current order total with multiple fallback methods
  function getCurrentOrderTotal() {
    let total = 0;
    
    // Method 1: Shopify checkout object
    if (typeof Shopify !== 'undefined' && Shopify.checkout && Shopify.checkout.total_price) {
      total = Shopify.checkout.total_price;
      log(`Order total from Shopify.checkout: $${(total/100).toFixed(2)}`);
      return total;
    }
    
    // Method 2: Search DOM for total amount
    const totalSelectors = [
      '[data-checkout-payment-due-target]',
      '.payment-due__price',
      '.total-line__price',
      '.order-summary__emphasis',
      '[data-total-price]'
    ];
    
    for (const selector of totalSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent || element.innerText || '';
        const match = text.match(/[\d,]+\.?\d*/);
        if (match) {
          const amount = parseFloat(match[0].replace(/,/g, ''));
          if (!isNaN(amount) && amount > 0) {
            total = Math.round(amount * 100); // Convert to cents
            log(`Order total from DOM (${selector}): $${(total/100).toFixed(2)}`);
            return total;
          }
        }
      }
    }
    
    // Method 3: Try to get from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const urlTotal = urlParams.get('total_price');
    if (urlTotal) {
      total = parseInt(urlTotal, 10);
      log(`Order total from URL: $${(total/100).toFixed(2)}`);
      return total;
    }
    
    log('Could not determine order total', 'warn');
    return 0;
  }
  
  // Check if a discount code is newsletter-related
  function isNewsletterDiscountCode(code) {
    if (!code) return false;
    const upperCode = code.toUpperCase();
    return CONFIG.NEWSLETTER_DISCOUNT_CODES.some(discount => 
      upperCode.includes(discount.toUpperCase())
    );
  }
  
  // Show validation error message
  function showValidationError(orderTotal) {
    // Remove existing error
    const existingError = document.getElementById('foxx-discount-validation-error');
    if (existingError) existingError.remove();
    
    const excess = orderTotal - CONFIG.SUBSCRIBER_MAXIMUM_AMOUNT;
    
    const errorHtml = `
      <div id="foxx-discount-validation-error" style="
        background: #fee2e2;
        border: 2px solid #dc2626;
        border-radius: 8px;
        padding: 16px;
        margin: 16px 0;
        color: #dc2626;
        font-size: 14px;
        font-weight: 500;
        position: relative;
        z-index: 9999;
        animation: slideInFromTop 0.5s ease-out;
      ">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <span style="font-size: 24px; flex-shrink: 0;">⚠️</span>
          <div style="flex: 1;">
            <div style="font-weight: 600; margin-bottom: 8px;">
              WELCOME50 Discount Not Available
            </div>
            <div style="margin-bottom: 8px;">
              Your order total is <strong>$${(orderTotal/100).toFixed(2)}</strong>. Newsletter subscriber discount codes are only valid for orders up to <strong>$1,000.00</strong>.
            </div>
            <div style="font-size: 13px; background: rgba(0,0,0,0.1); padding: 8px; border-radius: 4px;">
              To use your <strong>WELCOME50</strong> discount code, remove $${(excess/100).toFixed(2)} worth of items from your cart.
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Insert error message in multiple locations
    const insertLocations = [
      '.main__header',
      '.main__content',
      '.order-summary',
      '.checkout-step',
      '.step__sections',
      'main'
    ];
    
    let inserted = false;
    for (const selector of insertLocations) {
      const element = document.querySelector(selector);
      if (element && !inserted) {
        element.insertAdjacentHTML('afterbegin', errorHtml);
        inserted = true;
        log(`Validation error inserted at: ${selector}`, 'success');
        break;
      }
    }
    
    if (!inserted) {
      document.body.insertAdjacentHTML('afterbegin', errorHtml);
      log('Validation error inserted at body (fallback)', 'warn');
    }
  }
  
  // Hide/disable discount field
  function disableDiscountField() {
    const discountSelectors = [
      'input[name*="reduction"]',
      'input[name*="discount"]',
      'input[placeholder*="discount" i]',
      'input[placeholder*="coupon" i]',
      '.reduction-code input',
      '#discount'
    ];
    
    discountSelectors.forEach(selector => {
      const inputs = document.querySelectorAll(selector);
      inputs.forEach(input => {
        input.disabled = true;
        input.style.backgroundColor = '#f5f5f5';
        input.style.color = '#999';
        input.placeholder = 'Newsletter discount not available (order over $1,000)';
        log(`Disabled discount input: ${selector}`);
      });
    });
    
    // Disable submit buttons
    const submitSelectors = [
      'button[type="submit"]',
      '.btn--disabled',
      '.reduction-code button'
    ];
    
    submitSelectors.forEach(selector => {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach(button => {
        if (button.textContent && (
          button.textContent.toLowerCase().includes('apply') ||
          button.textContent.toLowerCase().includes('discount')
        )) {
          button.disabled = true;
          button.style.opacity = '0.5';
          button.style.cursor = 'not-allowed';
          log(`Disabled discount button: ${button.textContent.trim()}`);
        }
      });
    });
  }
  
  // Block discount form submission
  function blockDiscountSubmission(event) {
    const formElement = event.target;
    const discountInput = formElement.querySelector('input[name*="reduction"], input[name*="discount"]');
    
    if (discountInput) {
      const discountCode = discountInput.value.trim().toUpperCase();
      
      if (isNewsletterDiscountCode(discountCode)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        log(`BLOCKED newsletter discount application: ${discountCode}`, 'warn');
        
        // Clear the input
        discountInput.value = '';
        
        // Show alert
        alert(`❌ WELCOME50 discount code cannot be applied to orders over $1,000.\n\nYour current total: $${(getCurrentOrderTotal()/100).toFixed(2)}\nMaximum eligible amount: $1,000.00\n\nPlease reduce your order total to use this discount.`);
        
        return false;
      }
    }
    
    return true;
  }
  
  // Main validation function
  function runValidation() {
    const orderTotal = getCurrentOrderTotal();
    const isSubscribed = isUserSubscribed();
    
    log(`Running validation - Total: $${(orderTotal/100).toFixed(2)}, Subscribed: ${isSubscribed}`);
    
    if (isSubscribed && orderTotal > CONFIG.SUBSCRIBER_MAXIMUM_AMOUNT) {
      log(`Order exceeds threshold ($${CONFIG.SUBSCRIBER_MAXIMUM_AMOUNT/100}) - applying restrictions`, 'warn');
      
      // Show error message
      showValidationError(orderTotal);
      
      // Disable discount fields
      disableDiscountField();
      
      // Block form submissions
      document.addEventListener('submit', blockDiscountSubmission, true);
      
      // Block input events
      document.addEventListener('input', function(e) {
        if (e.target.matches('input[name*="reduction"], input[name*="discount"]')) {
          const code = e.target.value.trim().toUpperCase();
          if (isNewsletterDiscountCode(code)) {
            e.target.style.borderColor = '#dc2626';
            e.target.style.backgroundColor = '#fee2e2';
            log(`Newsletter discount code detected in input: ${code}`, 'warn');
          }
        }
      });
      
      log('Validation restrictions applied', 'success');
    } else if (isSubscribed) {
      log(`Order eligible for newsletter discount ($${(orderTotal/100).toFixed(2)} ≤ $1,000)`, 'success');
    } else {
      log('User not subscribed - no restrictions needed');
    }
  }
  
  // CSS for animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInFromTop {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  // Initialize with multiple triggers
  function initialize() {
    log('Initializing checkout validation...');
    
    // Run immediately
    runValidation();
    
    // Run after DOM updates
    setTimeout(runValidation, 1000);
    setTimeout(runValidation, 3000);
    
    // Watch for Shopify checkout updates
    if (typeof Shopify !== 'undefined' && Shopify.Checkout) {
      try {
        Shopify.Checkout.OrderSummary.subscribe(function() {
          log('Shopify checkout updated, re-running validation');
          setTimeout(runValidation, 500);
        });
      } catch (e) {
        log(`Could not subscribe to Shopify updates: ${e.message}`, 'warn');
      }
    }
    
    // Watch for DOM changes
    const observer = new MutationObserver(function(mutations) {
      let shouldRerun = false;
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (let node of mutation.addedNodes) {
            if (node.nodeType === 1 && (
              node.matches('.order-summary') ||
              node.querySelector('.order-summary') ||
              node.matches('[data-checkout-payment-due-target]') ||
              node.querySelector('[data-checkout-payment-due-target]')
            )) {
              shouldRerun = true;
              break;
            }
          }
        }
      });
      
      if (shouldRerun) {
        log('DOM changes detected, re-running validation');
        setTimeout(runValidation, 500);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    log('Checkout validation initialized successfully', 'success');
  }
  
  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
  // Global reference for debugging
  window.FoxxCheckoutValidation = {
    runValidation,
    getCurrentOrderTotal,
    isUserSubscribed,
    config: CONFIG
  };
  
  log('Script setup complete - validation ready!', 'success');
  
})();