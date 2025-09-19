// ====================================================================
// SHOPIFY CHECKOUT VALIDATION - 2024 WORKING VERSION
// This addresses Shopify's modern checkout security restrictions
// ====================================================================

// CRITICAL: This script has been updated to work with Shopify's checkout restrictions
// It uses multiple strategies to handle validation properly

(function() {
  'use strict';
  
  // === CONFIGURATION ===
  const CONFIG = {
    STORE_ID: 'fa37fc5c-90ce-44d2-83d8-34835f3b45af',
    SUBSCRIBER_MAXIMUM_AMOUNT: 100000, // $1000 in cents
    NEWSLETTER_DISCOUNT_CODES: ['WELCOME50', 'WELCOME15'],
    STORAGE_KEY_PREFIX: 'foxx_newsletter_'
  };
  
  // === ENHANCED LOGGING ===
  const log = (message, type = 'info', force = false) => {
    // Always log to help with debugging
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}] [FOXX-CHECKOUT-V2]`;
    
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
  
  log('=== CHECKOUT VALIDATION SCRIPT STARTING ===', 'success');
  log('Script location: ' + window.location.href);
  log('Page type: ' + (window.location.pathname.includes('checkouts') ? 'CHECKOUT' : 'OTHER'));
  
  // === SUBSCRIPTION CHECK ===
  function isUserSubscribed() {
    try {
      const storageKey = CONFIG.STORAGE_KEY_PREFIX + CONFIG.STORE_ID;
      const subscribedEmail = localStorage.getItem(storageKey);
      const subscribedTime = localStorage.getItem(storageKey + '_time');
      
      const isSubscribed = subscribedEmail && 
                          subscribedEmail.includes('@') && 
                          subscribedTime;
                          
      log(`Subscription check: ${isSubscribed ? 'SUBSCRIBED' : 'NOT SUBSCRIBED'}`, isSubscribed ? 'success' : 'info');
      log(`Email: ${subscribedEmail || 'none'}, Time: ${subscribedTime || 'none'}`);
      
      // Also save to sessionStorage for backup
      if (isSubscribed) {
        sessionStorage.setItem(CONFIG.STORAGE_KEY_PREFIX + 'cart_validation_session', 'true');
        
        // Create validation data object
        const validationData = {
          enabled: true,
          validationType: 'below_threshold',
          minimumAmount: 0,
          maximumAmount: CONFIG.SUBSCRIBER_MAXIMUM_AMOUNT,
          discountCode: 'WELCOME50',
          subscribedAt: subscribedTime
        };
        
        sessionStorage.setItem(CONFIG.STORAGE_KEY_PREFIX + CONFIG.STORE_ID + '_cart_validation', JSON.stringify(validationData));
        
        log('Validation data saved to sessionStorage', 'success');
      }
      
      return isSubscribed;
    } catch (error) {
      log(`Error checking subscription: ${error.message}`, 'error');
      return false;
    }
  }
  
  // === ORDER TOTAL DETECTION ===
  function getCurrentOrderTotal() {
    let total = 0;
    
    // Strategy 1: Shopify checkout object (most reliable)
    if (typeof Shopify !== 'undefined' && Shopify.checkout && Shopify.checkout.total_price) {
      total = Shopify.checkout.total_price;
      log(`Order total from Shopify.checkout: $${(total/100).toFixed(2)}`, 'success');
      return total;
    }
    
    // Strategy 2: Modern Shopify selectors (updated for 2024)
    const modernSelectors = [
      '[data-checkout-payment-due-target]',
      '[data-order-summary-section="total"] [data-payment-due-target]',
      '.payment-due__price',
      '.total-line__price .order-summary__emphasis',
      '.total-recap__final-price',
      '[data-order-summary-section="total"] .notranslate'
    ];
    
    for (const selector of modernSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent || element.innerText || '';
          // Enhanced regex to handle various currency formats
          const match = text.match(/[\$£€¥₹]?\s*([0-9,]+\.?[0-9]*)/);
          if (match && match[1]) {
            const amount = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(amount) && amount > 0) {
              total = Math.round(amount * 100);
              log(`Order total from DOM (${selector}): $${(total/100).toFixed(2)}`, 'success');
              return total;
            }
          }
        }
      } catch (e) {
        log(`Selector ${selector} failed: ${e.message}`, 'warn');
      }
    }
    
    // Strategy 3: URL-based detection
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTotal = urlParams.get('total_price') || urlParams.get('total');
      if (urlTotal) {
        total = parseInt(urlTotal, 10);
        log(`Order total from URL: $${(total/100).toFixed(2)}`, 'success');
        return total;
      }
    } catch (e) {
      log(`URL parsing failed: ${e.message}`, 'warn');
    }
    
    // Strategy 4: Meta tag fallback
    try {
      const metaTotal = document.querySelector('meta[name="checkout-total"]');
      if (metaTotal) {
        total = parseInt(metaTotal.content, 10);
        log(`Order total from meta: $${(total/100).toFixed(2)}`, 'success');
        return total;
      }
    } catch (e) {
      log(`Meta tag parsing failed: ${e.message}`, 'warn');
    }
    
    log('Could not determine order total - will retry', 'warn');
    return 0;
  }
  
  // === DISCOUNT CODE VALIDATION ===
  function isNewsletterDiscountCode(code) {
    if (!code) return false;
    const upperCode = code.toUpperCase().trim();
    return CONFIG.NEWSLETTER_DISCOUNT_CODES.some(discount => 
      upperCode.includes(discount.toUpperCase())
    );
  }
  
  // === ERROR MESSAGE DISPLAY ===
  function showValidationError(orderTotal) {
    // Remove existing errors
    const existingErrors = document.querySelectorAll('[id*="foxx-discount-validation"]');
    existingErrors.forEach(el => el.remove());
    
    const excess = orderTotal - CONFIG.SUBSCRIBER_MAXIMUM_AMOUNT;
    
    const errorHtml = `
      <div id="foxx-discount-validation-error" 
           data-testid="foxx-discount-error"
           role="alert"
           aria-live="polite" 
           style="
        background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
        color: white;
        padding: 16px;
        margin: 16px 0;
        border-radius: 12px;
        border-left: 4px solid #b91c1c;
        box-shadow: 0 4px 16px rgba(220, 38, 38, 0.25);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        position: relative;
        z-index: 10000;
        animation: slideInError 0.5s ease-out;
      ">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <div style="
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            flex-shrink: 0;
          ">⚠️</div>
          <div style="flex: 1;">
            <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700;">
              WELCOME50 Discount Not Available
            </h3>
            <p style="margin: 0 0 8px 0; font-size: 15px; line-height: 1.4; opacity: 0.95;">
              Your order total is <strong>$${(orderTotal/100).toFixed(2)}</strong>. 
              Newsletter subscriber discount codes are only valid for orders up to <strong>$1,000.00</strong>.
            </p>
            <div style="
              background: rgba(0, 0, 0, 0.15);
              padding: 12px;
              border-radius: 8px;
              font-size: 14px;
              line-height: 1.3;
            ">
              <strong>💡 Solution:</strong> Remove $${(excess/100).toFixed(2)} worth of items from your cart to use your WELCOME50 discount code.
            </div>
          </div>
          <button onclick="this.parentElement.parentElement.remove()" 
                  style="
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            cursor: pointer;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          " 
          onmouseover="this.style.background='rgba(255,255,255,0.3)'"
          onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
        </div>
      </div>
    `;
    
    // Find the best insertion point
    const insertionTargets = [
      '.main__header',
      '.main__content',
      '.order-summary',
      '.checkout-step',
      '.step__sections',
      '[data-order-summary]',
      '[data-checkout-step]',
      'main',
      'body'
    ];
    
    let inserted = false;
    for (const selector of insertionTargets) {
      try {
        const element = document.querySelector(selector);
        if (element && !inserted) {
          element.insertAdjacentHTML('afterbegin', errorHtml);
          inserted = true;
          log(`Error message inserted at: ${selector}`, 'success');
          break;
        }
      } catch (e) {
        log(`Failed to insert at ${selector}: ${e.message}`, 'warn');
      }
    }
    
    if (!inserted) {
      document.body.insertAdjacentHTML('afterbegin', errorHtml);
      log('Error message inserted at body (fallback)', 'warn');
    }
  }
  
  // === FORM BLOCKING ===
  function blockDiscountSubmission(event) {
    try {
      const formElement = event.target;
      const discountInput = formElement.querySelector('input[name*="reduction"], input[name*="discount"], input[placeholder*="discount" i]');
      
      if (discountInput) {
        const discountCode = discountInput.value.trim().toUpperCase();
        
        if (isNewsletterDiscountCode(discountCode)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          
          log(`BLOCKED newsletter discount application: ${discountCode}`, 'warn');
          
          // Clear the input
          discountInput.value = '';
          discountInput.blur();
          
          // Show enhanced alert
          const orderTotal = getCurrentOrderTotal();
          const message = `❌ DISCOUNT CODE BLOCKED\n\n` +
                         `The WELCOME50 discount code cannot be applied to orders over $1,000.\n\n` +
                         `• Your current total: $${(orderTotal/100).toFixed(2)}\n` +
                         `• Maximum eligible amount: $1,000.00\n` +
                         `• Amount to remove: $${((orderTotal - CONFIG.SUBSCRIBER_MAXIMUM_AMOUNT)/100).toFixed(2)}\n\n` +
                         `Please reduce your order total to use this discount.`;
          
          alert(message);
          
          // Show visual error
          showValidationError(orderTotal);
          
          return false;
        }
      }
    } catch (error) {
      log(`Error in blockDiscountSubmission: ${error.message}`, 'error');
    }
    
    return true;
  }
  
  // === MAIN VALIDATION LOGIC ===
  function runValidation() {
    try {
      const orderTotal = getCurrentOrderTotal();
      const isSubscribed = isUserSubscribed();
      
      log(`=== VALIDATION STATUS ===`, 'info');
      log(`Order Total: $${(orderTotal/100).toFixed(2)}`);
      log(`User Subscribed: ${isSubscribed}`);
      log(`Threshold: $${(CONFIG.SUBSCRIBER_MAXIMUM_AMOUNT/100).toFixed(2)}`);
      log(`Over Threshold: ${orderTotal > CONFIG.SUBSCRIBER_MAXIMUM_AMOUNT}`);
      
      if (isSubscribed && orderTotal > CONFIG.SUBSCRIBER_MAXIMUM_AMOUNT) {
        log(`Order exceeds threshold - applying restrictions`, 'warn');
        
        // Show error message
        showValidationError(orderTotal);
        
        // Block form submissions
        document.addEventListener('submit', blockDiscountSubmission, true);
        
        // Block input attempts
        document.addEventListener('input', function(e) {
          if (e.target.matches('input[name*="reduction"], input[name*="discount"], input[placeholder*="discount" i]')) {
            const code = e.target.value.trim().toUpperCase();
            if (isNewsletterDiscountCode(code)) {
              e.target.style.borderColor = '#dc2626';
              e.target.style.backgroundColor = '#fee2e2';
              e.target.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.1)';
              log(`Newsletter discount code detected in input: ${code}`, 'warn');
            } else {
              e.target.style.borderColor = '';
              e.target.style.backgroundColor = '';
              e.target.style.boxShadow = '';
            }
          }
        });
        
        log('Validation restrictions applied successfully', 'success');
        
      } else if (isSubscribed) {
        log(`Order eligible for newsletter discount ($${(orderTotal/100).toFixed(2)} ≤ $1,000)`, 'success');
        
        // Show eligible message
        const eligibleHtml = `
          <div id="foxx-discount-validation-eligible" 
               style="
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            color: white;
            padding: 12px 16px;
            margin: 16px 0;
            border-radius: 8px;
            border-left: 4px solid #047857;
            box-shadow: 0 2px 8px rgba(5, 150, 105, 0.15);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            animation: slideInSuccess 0.5s ease-out;
          ">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 18px;">✅</span>
              <div>
                <strong>Newsletter Discount Available!</strong><br>
                <span style="font-size: 14px; opacity: 0.9;">
                  Your order total is $${(orderTotal/100).toFixed(2)}. You can apply your WELCOME50 discount code.
                </span>
              </div>
            </div>
          </div>
        `;
        
        const insertTarget = document.querySelector('.main__content, .order-summary, main');
        if (insertTarget) {
          insertTarget.insertAdjacentHTML('afterbegin', eligibleHtml);
        }
        
      } else {
        log('User not subscribed - no restrictions needed', 'info');
      }
      
    } catch (error) {
      log(`Error in runValidation: ${error.message}`, 'error');
    }
  }
  
  // === CSS ANIMATIONS ===
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInError {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes slideInSuccess {
      from { transform: translateY(-10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .foxx-validation-button:hover {
      transform: scale(1.05);
    }
  `;
  document.head.appendChild(style);
  
  // === INITIALIZATION ===
  function initialize() {
    log('=== INITIALIZING CHECKOUT VALIDATION ===', 'success');
    
    // Run validation immediately
    setTimeout(runValidation, 100);
    
    // Run validation after DOM updates
    setTimeout(runValidation, 1000);
    setTimeout(runValidation, 3000);
    
    // Monitor for Shopify checkout updates
    if (typeof Shopify !== 'undefined' && Shopify.Checkout) {
      try {
        if (Shopify.Checkout.OrderSummary && typeof Shopify.Checkout.OrderSummary.subscribe === 'function') {
          Shopify.Checkout.OrderSummary.subscribe(function() {
            log('Shopify checkout updated - re-running validation', 'info');
            setTimeout(runValidation, 500);
          });
        }
      } catch (e) {
        log(`Could not subscribe to Shopify updates: ${e.message}`, 'warn');
      }
    }
    
    // Monitor DOM changes for dynamic content
    const observer = new MutationObserver(function(mutations) {
      let shouldRerun = false;
      
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (let node of mutation.addedNodes) {
            if (node.nodeType === 1 && (
              node.matches && (
                node.matches('.order-summary') ||
                node.matches('[data-checkout-payment-due-target]') ||
                node.matches('[data-order-summary]') ||
                node.querySelector && (
                  node.querySelector('.order-summary') ||
                  node.querySelector('[data-checkout-payment-due-target]') ||
                  node.querySelector('[data-order-summary]')
                )
              )
            )) {
              shouldRerun = true;
              break;
            }
          }
        }
      });
      
      if (shouldRerun) {
        log('Significant DOM changes detected - re-running validation', 'info');
        setTimeout(runValidation, 800);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });
    
    log('DOM observer started', 'success');
    log('=== CHECKOUT VALIDATION INITIALIZED ===', 'success');
  }
  
  // === STARTUP LOGIC ===
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
    log('Waiting for DOMContentLoaded...', 'info');
  } else {
    initialize();
  }
  
  // === GLOBAL DEBUG INTERFACE ===
  window.FoxxCheckoutValidation = {
    runValidation,
    getCurrentOrderTotal,
    isUserSubscribed,
    showValidationError,
    config: CONFIG,
    version: '2.0.0'
  };
  
  log('=== SCRIPT SETUP COMPLETE ===', 'success');
  log('Debug interface available at: window.FoxxCheckoutValidation');
  
})();