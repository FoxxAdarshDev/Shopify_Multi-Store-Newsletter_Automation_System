// SHOPIFY CHECKOUT VALIDATION - URL PARAMETER BASED APPROACH
// This script works with Shopify's security restrictions by reading URL parameters
// Place this in Shopify Admin > Settings > Checkout > Additional scripts

(function() {
  'use strict';
  
  console.log('🔍 Foxx Checkout URL-Based Validation: Script started');
  console.log('🔍 Current URL:', window.location.href);
  console.log('🔍 URL Params:', window.location.search);
  
  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const validationBlocked = urlParams.get('foxx_validation') === 'blocked';
  const storeId = urlParams.get('foxx_store');
  const orderAmount = parseInt(urlParams.get('foxx_amount'), 10) || 0;
  const maxAmount = parseInt(urlParams.get('foxx_max'), 10) || 100000;
  
  console.log('🔍 Validation Parameters:', {
    validationBlocked,
    storeId,
    orderAmount,
    maxAmount,
    shouldBlock: validationBlocked && orderAmount > maxAmount
  });
  
  // Configuration
  const CONFIG = {
    STORE_ID: storeId || 'fa37fc5c-90ce-44d2-83d8-34835f3b45af',
    NEWSLETTER_DISCOUNT_CODES: ['WELCOME50', 'WELCOME15'],
    STORAGE_KEY_PREFIX: 'foxx_newsletter_'
  };
  
  // Enhanced logging
  const log = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}] [FOXX-CHECKOUT-URL]`;
    
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
  
  log('=== CHECKOUT VALIDATION STARTING ===', 'success');
  
  // Check if validation should be blocked based on URL parameters
  if (!validationBlocked) {
    log('No validation blocking required', 'info');
    return;
  }
  
  log('Validation blocking ACTIVE - order exceeds threshold', 'warn');
  
  // Format money
  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }
  
  // Check if discount code is newsletter-related
  function isNewsletterDiscountCode(code) {
    if (!code) return false;
    const upperCode = code.toUpperCase();
    return CONFIG.NEWSLETTER_DISCOUNT_CODES.some(discount => 
      upperCode.includes(discount.toUpperCase())
    );
  }
  
  // Show validation error banner
  function showValidationError() {
    const existingError = document.getElementById('foxx-checkout-validation-error');
    if (existingError) existingError.remove();
    
    const excess = orderAmount - maxAmount;
    
    const errorHtml = `
      <div id="foxx-checkout-validation-error" 
           role="alert"
           aria-live="polite"
           style="
        background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
        color: white;
        padding: 20px;
        margin: 0 0 20px 0;
        border-radius: 12px;
        border-left: 6px solid #b91c1c;
        box-shadow: 0 6px 20px rgba(220, 38, 38, 0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        position: relative;
        z-index: 10000;
        animation: slideInAlert 0.6s ease-out;
      ">
        <div style="display: flex; align-items: flex-start; gap: 16px;">
          <div style="
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            flex-shrink: 0;
          ">⚠️</div>
          <div style="flex: 1;">
            <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700;">
              WELCOME50 Discount Not Available
            </h2>
            <p style="margin: 0 0 12px 0; font-size: 16px; line-height: 1.5; opacity: 0.95;">
              Your order total is <strong>${formatMoney(orderAmount)}</strong>. 
              Newsletter subscriber discount codes are only valid for orders up to <strong>${formatMoney(maxAmount)}</strong>.
            </p>
            <div style="
              background: rgba(0, 0, 0, 0.2);
              padding: 14px;
              border-radius: 8px;
              font-size: 15px;
              line-height: 1.4;
              border: 1px solid rgba(255, 255, 255, 0.2);
            ">
              <strong>💡 To use your discount:</strong><br>
              Return to your cart and remove ${formatMoney(excess)} worth of items, 
              then proceed to checkout again.
            </div>
            <div style="
              margin-top: 12px;
              font-size: 13px;
              opacity: 0.8;
            ">
              ❌ Newsletter discount codes are blocked for this order
            </div>
          </div>
          <button onclick="this.parentElement.parentElement.remove()" 
                  style="
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            border-radius: 50%;
            width: 36px;
            height: 36px;
            cursor: pointer;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            flex-shrink: 0;
          " 
          onmouseover="this.style.background='rgba(255,255,255,0.3)'"
          onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
        </div>
      </div>
    `;
    
    // Try multiple insertion points
    const insertionTargets = [
      '.main',
      '.main__content',
      '.main__header',
      '.order-summary',
      '.checkout-step',
      '.step',
      '[role="main"]',
       'body'
    ];
    
    let inserted = false;
    for (const selector of insertionTargets) {
      try {
        const element = document.querySelector(selector);
        if (element && !inserted) {
          element.insertAdjacentHTML('afterbegin', errorHtml);
          inserted = true;
          log(`Error banner inserted at: ${selector}`, 'success');
          break;
        }
      } catch (e) {
        log(`Failed to insert at ${selector}: ${e.message}`, 'warn');
      }
    }
    
    if (!inserted) {
      document.body.insertAdjacentHTML('afterbegin', errorHtml);
      log('Error banner inserted at body (fallback)', 'warn');
    }
  }
  
  // Disable discount input fields
  function disableDiscountFields() {
    const discountSelectors = [
      'input[name*="reduction"]',
      'input[name*="discount"]',
      'input[placeholder*="discount" i]',
      'input[placeholder*="coupon" i]',
      'input[placeholder*="code" i]',
      '#discount',
      '.reduction-code input',
      '[data-reduction-code]'
    ];
    
    let fieldsDisabled = 0;
    
    discountSelectors.forEach(selector => {
      const inputs = document.querySelectorAll(selector);
      inputs.forEach(input => {
        input.disabled = true;
        input.style.backgroundColor = '#f5f5f5';
        input.style.color = '#999';
        input.style.cursor = 'not-allowed';
        input.placeholder = 'Newsletter discount not available (order over $1,000)';
        input.title = 'Newsletter subscriber discounts are not available for orders over $1,000';
        fieldsDisabled++;
        log(`Disabled discount input: ${selector}`);
      });
    });
    
    // Disable apply buttons
    const buttonSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      '.btn',
      '[data-discount-apply]'
    ];
    
    buttonSelectors.forEach(selector => {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach(button => {
        const buttonText = button.textContent || button.value || '';
        if (buttonText.toLowerCase().includes('apply') || 
            buttonText.toLowerCase().includes('discount') ||
            buttonText.toLowerCase().includes('coupon')) {
          button.disabled = true;
          button.style.opacity = '0.5';
          button.style.cursor = 'not-allowed';
          button.title = 'Newsletter discount not available for this order';
          fieldsDisabled++;
          log(`Disabled discount button: ${buttonText.trim()}`);
        }
      });
    });
    
    log(`Total fields/buttons disabled: ${fieldsDisabled}`, fieldsDisabled > 0 ? 'success' : 'warn');
  }
  
  // Block form submissions
  function blockDiscountSubmissions() {
    document.addEventListener('submit', function(e) {
      // Check if form contains discount-related inputs
      const form = e.target;
      const discountInput = form.querySelector('input[name*="reduction"], input[name*="discount"]');
      
      if (discountInput) {
        const discountCode = discountInput.value.trim().toUpperCase();
        
        if (isNewsletterDiscountCode(discountCode)) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          log(`BLOCKED newsletter discount submission: ${discountCode}`, 'warn');
          
          // Clear the input
          discountInput.value = '';
          discountInput.blur();
          
          // Show alert
          const alertMessage = `❌ DISCOUNT CODE BLOCKED\n\n` +
                             `The ${discountCode} discount code cannot be applied to orders over ${formatMoney(maxAmount)}.\n\n` +
                             `• Your current total: ${formatMoney(orderAmount)}\n` +
                             `• Maximum eligible amount: ${formatMoney(maxAmount)}\n` +
                             `• Amount to remove: ${formatMoney(orderAmount - maxAmount)}\n\n` +
                             `Please return to your cart and reduce your order total to use this discount.`;
          
          alert(alertMessage);
          
          return false;
        }
      }
      
      return true;
    }, true);
    
    log('Form submission blocking enabled', 'success');
  }
  
  // Monitor input changes
  function monitorDiscountInputs() {
    document.addEventListener('input', function(e) {
      if (e.target.matches('input[name*="reduction"], input[name*="discount"]')) {
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
    
    log('Input monitoring enabled', 'success');
  }
  
  // CSS for animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInAlert {
      from { transform: translateY(-30px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    
    .foxx-disabled-input {
      background-color: #f5f5f5 !important;
      color: #999 !important;
      cursor: not-allowed !important;
    }
    
    .foxx-disabled-button {
      opacity: 0.5 !important;
      cursor: not-allowed !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);
  
  // Initialize blocking mechanisms
  function initializeBlocking() {
    log('Initializing discount blocking mechanisms...', 'warn');
    
    // Show error banner immediately
    showValidationError();
    
    // Disable fields immediately
    disableDiscountFields();
    
    // Set up form blocking
    blockDiscountSubmissions();
    
    // Monitor input changes
    monitorDiscountInputs();
    
    // Re-apply restrictions after DOM updates
    setTimeout(() => {
      disableDiscountFields();
    }, 1000);
    
    setTimeout(() => {
      disableDiscountFields();
    }, 3000);
    
    log('Discount blocking mechanisms initialized', 'success');
  }
  
  // Watch for DOM changes (Shopify checkout updates)
  const observer = new MutationObserver(function(mutations) {
    let shouldReapply = false;
    
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (let node of mutation.addedNodes) {
          if (node.nodeType === 1 && (
            node.matches && (
              node.matches('input[name*="reduction"]') ||
              node.matches('input[name*="discount"]') ||
              node.matches('.reduction-code') ||
              node.matches('[data-discount]')
            ) || (
              node.querySelector && (
                node.querySelector('input[name*="reduction"]') ||
                node.querySelector('input[name*="discount"]') ||
                node.querySelector('.reduction-code') ||
                node.querySelector('[data-discount]')
              )
            )
          )) {
            shouldReapply = true;
            break;
          }
        }
      }
    });
    
    if (shouldReapply) {
      log('New discount fields detected - reapplying restrictions', 'warn');
      setTimeout(() => {
        disableDiscountFields();
      }, 500);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false
  });
  
  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBlocking);
  } else {
    // Small delay to ensure Shopify checkout is ready
    setTimeout(initializeBlocking, 500);
  }
  
  // Global debug interface
  window.FoxxCheckoutValidation = {
    config: CONFIG,
    urlParams: {
      validationBlocked,
      storeId,
      orderAmount,
      maxAmount
    },
    disableDiscountFields,
    showValidationError,
    version: '2.0.0-url-based'
  };
  
  log('=== CHECKOUT VALIDATION INITIALIZED ===', 'success');
  log('Validation will block newsletter discount codes for this order', 'warn');
  
})();