import { PopupConfig } from '@shared/schema';

export class PopupGeneratorService {
  // Legacy method - kept for backward compatibility
  generateScript(config: PopupConfig): string {
    return this.getNewsletterScript();
  }

  generateIntegrationScript(storeId: string, shopifyUrl: string, baseUrl?: string): string {
    // Use provided baseUrl or detect from environment
    let scriptBaseUrl = baseUrl;
    
    if (!scriptBaseUrl) {
      // For Replit environment
      if (process.env.REPLIT_DEV_DOMAIN) {
        scriptBaseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
      } else if (process.env.NODE_ENV === 'production') {
        scriptBaseUrl = 'https://your-app-domain.com';
      } else {
        scriptBaseUrl = 'http://localhost:5000';
      }
    }
    
    console.log('Script baseUrl determined:', scriptBaseUrl);
    
    // Generate unique ID for each script generation for strict verification
    const timestamp = Date.now();
    const storeHash = storeId.split('-')[0]; // Use first part of store UUID
    const uniqueId = `${storeHash}_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;
      
    return this._generateScriptWithVersion(storeId, shopifyUrl, scriptBaseUrl, uniqueId, timestamp.toString());
  }

  generateIntegrationScriptWithVersion(storeId: string, shopifyUrl: string, scriptVersion: string, timestamp: string, baseUrl?: string): string {
    // Use provided baseUrl or detect from environment
    let scriptBaseUrl = baseUrl;
    
    if (!scriptBaseUrl) {
      // For Replit environment
      if (process.env.REPLIT_DEV_DOMAIN) {
        scriptBaseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
      } else if (process.env.NODE_ENV === 'production') {
        scriptBaseUrl = 'https://your-app-domain.com';
      } else {
        scriptBaseUrl = 'http://localhost:5000';
      }
    }
    
    console.log('Script baseUrl determined:', scriptBaseUrl);
    
    return this._generateScriptWithVersion(storeId, shopifyUrl, scriptBaseUrl, scriptVersion, timestamp);
  }

  private _generateScriptWithVersion(storeId: string, shopifyUrl: string, scriptBaseUrl: string, uniqueId: string, timestamp: string): string {
    return `<!-- Foxx Newsletter Popup Integration Script -->
<!-- Add this code to your theme.liquid file, just before the closing </body> tag -->
<!-- Generated: ${new Date().toISOString()} | Unique ID: ${uniqueId} -->
<script>
(function() {
  var script = document.createElement('script');
  script.src = '${scriptBaseUrl}/js/newsletter-popup.js?v=${timestamp}&id=${uniqueId}';
  script.async = true;
  script.setAttribute('data-store-id', '${storeId}');
  script.setAttribute('data-popup-config', 'auto');
  script.setAttribute('data-integration-type', 'shopify');
  script.setAttribute('data-store-domain', '${new URL(shopifyUrl).hostname}');
  script.setAttribute('data-script-version', '${uniqueId}');
  script.setAttribute('data-generated-at', '${timestamp}');
  document.head.appendChild(script);
})();
</script>`;
  }

  getNewsletterScript(baseUrl?: string): string {
    // Determine base URL for API calls
    let apiBaseUrl = baseUrl;
    if (!apiBaseUrl) {
      // For Replit environment
      if (process.env.REPLIT_DEV_DOMAIN) {
        apiBaseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
      } else if (process.env.NODE_ENV === 'production') {
        apiBaseUrl = 'https://your-app-domain.com';
      } else {
        apiBaseUrl = 'http://localhost:5000';
      }
    }
    
    return `/**
 * Foxx Newsletter Popup Script
 * Dynamic newsletter popup system with domain verification
 * Version: 2.0.0
 */
(function() {
  'use strict';
  
  // Get configuration from script tag
  const scriptTag = document.currentScript || document.querySelector('script[data-store-id]');
  if (!scriptTag) {
    console.warn('Foxx Newsletter: Script tag with data-store-id not found');
    return;
  }
  
  const STORE_ID = scriptTag.getAttribute('data-store-id');
  const STORE_DOMAIN = scriptTag.getAttribute('data-store-domain');
  
  if (!STORE_ID) {
    console.error('Foxx Newsletter: Missing data-store-id attribute');
    return;
  }
  
  // Domain verification
  if (STORE_DOMAIN && !window.location.hostname.includes(STORE_DOMAIN)) {
    console.warn('Foxx Newsletter: Domain mismatch - script not authorized for this domain');
    return;
  }
  
  // Configuration
  const API_BASE = '${apiBaseUrl}';
  const STORAGE_KEY = 'foxx_newsletter_' + STORE_ID;
  
  let POPUP_CONFIG = null;
  
  // Prevent multiple script loading conflicts
  if (window.foxxNewsletterLoaded) {
    console.log('Foxx Newsletter: Script already loaded, skipping...');
    return;
  }
  window.foxxNewsletterLoaded = true;
  
  // Load configuration and check subscription status
  async function loadConfig() {
    try {
      const response = await fetch(API_BASE + '/api/popup-config/' + STORE_ID);
      if (!response.ok) {
        throw new Error('Failed to load popup configuration');
      }
      POPUP_CONFIG = await response.json();
      
      if (!POPUP_CONFIG.isActive) {
        console.log('Foxx Newsletter: Popup is disabled for this store');
        return;
      }
      
      // Check if script installation is verified before loading popup
      if (!POPUP_CONFIG.isVerified || !POPUP_CONFIG.hasActiveScript) {
        console.log('Foxx Newsletter: Script not verified or no active script version, popup blocked');
        return;
      }
      console.log('Foxx Newsletter: Script verification passed, loading popup configuration');
      
      // Check if popup should be suppressed after subscription
      if (POPUP_CONFIG.suppressAfterSubscription) {
        await checkSubscriptionStatus();
      }
      
      if (shouldShowPopup) {
        initPopup();
      }
    } catch (error) {
      console.error('Foxx Newsletter: Failed to load configuration', error);
    }
  }
  
  // Modern approach: Always check server first, use localStorage as UX enhancement only
  let shouldShowPopup = true;

  // Check subscription status using multiple methods
  async function checkSubscriptionStatus() {
    // Method 1: Check localStorage for recent subscription (UX optimization)
    const lastSubscribedEmail = localStorage.getItem(STORAGE_KEY);
    const lastSubscribedTime = localStorage.getItem(STORAGE_KEY + '_time');
    
    // If subscribed recently (within 24 hours), don't show popup
    if (lastSubscribedEmail && lastSubscribedTime) {
      const timeDiff = Date.now() - parseInt(lastSubscribedTime);
      const hoursAgo = timeDiff / (1000 * 60 * 60);
      
      if (hoursAgo < 24 && lastSubscribedEmail.includes('@')) {
        console.log('Foxx Newsletter: Recently subscribed, checking server status...');
        
        // Verify with server
        try {
          const checkResponse = await fetch(API_BASE + '/api/stores/' + STORE_ID + '/check-subscription/' + encodeURIComponent(lastSubscribedEmail));
          if (checkResponse.ok) {
            const result = await checkResponse.json();
            if (result.isSubscribed) {
              shouldShowPopup = false;
              console.log('Foxx Newsletter: User still subscribed, popup suppressed');
              return;
            } else {
              // No longer subscribed, clear localStorage
              localStorage.removeItem(STORAGE_KEY);
              localStorage.removeItem(STORAGE_KEY + '_time');
              console.log('Foxx Newsletter: User no longer subscribed, localStorage cleared');
            }
          }
        } catch (error) {
          console.log('Foxx Newsletter: Could not verify subscription status');
        }
      }
    }
    
    // Method 2: Check for session-based suppression (popup shown this session)
    const sessionKey = STORAGE_KEY + '_session';
    if (sessionStorage.getItem(sessionKey)) {
      shouldShowPopup = false;
      console.log('Foxx Newsletter: Popup already shown this session');
      return;
    }
    
    console.log('Foxx Newsletter: Popup will show - no active subscription or session suppression found');
  }
  
  // Close popup and prevent showing again this session
  window.closePopupWithSession = function() {
    sessionStorage.setItem(STORAGE_KEY + '_session', 'true');
    closePopup();
  };
  
  // Create popup HTML
  function createPopupHTML() {
    const fields = POPUP_CONFIG.fields;
    let formFields = '';
    
    if (fields.email) {
      formFields += '<input type="email" name="email" placeholder="Enter your email address" required style="width: 100%; padding: 12px; margin-bottom: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;" />';
    }
    
    if (fields.name) {
      formFields += '<input type="text" name="name" placeholder="Full Name" style="width: 100%; padding: 12px; margin-bottom: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;" />';
    }
    
    if (fields.phone) {
      formFields += '<input type="tel" name="phone" placeholder="Phone Number" style="width: 100%; padding: 12px; margin-bottom: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;" />';
    }
    
    if (fields.company) {
      formFields += '<input type="text" name="company" placeholder="Company Name" style="width: 100%; padding: 12px; margin-bottom: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;" />';
    }
    
    if (fields.address) {
      formFields += '<textarea name="address" placeholder="Address" style="width: 100%; padding: 12px; margin-bottom: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; min-height: 80px; resize: vertical;"></textarea>';
    }
    
    return \`
      <div id="foxx-newsletter-backdrop" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: foxxFadeIn 0.3s ease-out;
      ">
        <div id="foxx-newsletter-popup" style="
          background: white;
          border-radius: 12px;
          padding: 32px;
          width: 90%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          position: relative;
          animation: foxxSlideIn 0.3s ease-out;
        ">
          <button id="foxx-close-btn" style="
            position: absolute;
            top: 16px;
            right: 16px;
            background: none;
            border: none;
            font-size: 24px;
            color: #9ca3af;
            cursor: pointer;
            padding: 4px;
            line-height: 1;
          " onclick="closePopupWithSession()">×</button>
          
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="
              font-size: 24px;
              font-weight: bold;
              color: #0071b9;
              margin: 0 0 12px 0;
              line-height: 1.2;
            ">\${POPUP_CONFIG.title}</h2>
            <p style="
              color: #6b7280;
              margin: 0;
              font-size: 14px;
              line-height: 1.5;
            ">\${POPUP_CONFIG.subtitle}</p>
          </div>

          <form id="foxx-newsletter-form">
            \${formFields}
            
            <button type="submit" style="
              width: 100%;
              background: #0071b9;
              color: white;
              border: none;
              padding: 14px;
              border-radius: 6px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: background-color 0.2s;
            " onmouseover="this.style.background='#005a94'" onmouseout="this.style.background='#0071b9'">
              \${POPUP_CONFIG.buttonText}
            </button>
          </form>

          <div style="
            display: flex;
            justify-content: center;
            gap: 16px;
            margin-top: 24px;
            color: #9ca3af;
          ">
            <i style="font-size: 18px;">📘</i>
            <i style="font-size: 18px;">📷</i>
            <i style="font-size: 18px;">📌</i>
            <i style="font-size: 18px;">🎥</i>
            <i style="font-size: 18px;">🐦</i>
          </div>

          <div style="margin-top: 16px;">
            <label style="
              display: flex;
              align-items: flex-start;
              font-size: 12px;
              color: #6b7280;
              line-height: 1.4;
            ">
              <input type="checkbox" style="margin-right: 8px; margin-top: 2px;" />
              Stay Connected For: ✓ Exclusive Product Launches ✓ Special Promotions ✓ Bioprocess Insights & Updates
            </label>
          </div>
        </div>
      </div>
    \`;
  }
  
  // CSS animations
  const style = document.createElement('style');
  style.textContent = \`
    @keyframes foxxFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes foxxSlideIn {
      from { 
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
      }
      to { 
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  \`;
  document.head.appendChild(style);
  
  // Email validation
  function validateEmail(email) {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, message: 'Please enter a valid email address.' };
    }
    
    const validation = POPUP_CONFIG.emailValidation;
    if (validation.companyEmailsOnly) {
      const domain = email.split('@')[1].toLowerCase();
      
      // Check blocked domains
      if (validation.blockedDomains.includes(domain)) {
        return { valid: false, message: 'Please use your company email address.' };
      }
      
      // Check allowed domains (if specified)
      if (validation.allowedDomains.length > 0 && !validation.allowedDomains.includes(domain)) {
        return { valid: false, message: 'Please use an approved company email domain.' };
      }
    }
    
    return { valid: true };
  }
  
  // Show popup
  function showPopup() {
    if (localStorage.getItem(STORAGE_KEY) === 'subscribed') {
      return;
    }
    
    const popupHTML = createPopupHTML();
    document.body.insertAdjacentHTML('beforeend', popupHTML);
    
    // Event listeners
    document.getElementById('foxx-close-btn').addEventListener('click', closePopup);
    document.getElementById('foxx-newsletter-backdrop').addEventListener('click', function(e) {
      if (e.target === this) closePopup();
    });
    
    document.getElementById('foxx-newsletter-form').addEventListener('submit', handleSubmit);
  }
  
  // Close popup
  function closePopup() {
    const backdrop = document.getElementById('foxx-newsletter-backdrop');
    if (backdrop) {
      backdrop.remove();
    }
  }
  
  // Handle form submission
  async function handleSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    // Validate email
    const emailValidation = validateEmail(data.email);
    if (!emailValidation.valid) {
      alert(emailValidation.message);
      return;
    }
    
    try {
      const response = await fetch(API_BASE + '/api/subscribe/' + STORE_ID, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Success
        // Store email and timestamp for smart suppression
        localStorage.setItem(STORAGE_KEY, data.email);
        localStorage.setItem(STORAGE_KEY + '_time', Date.now().toString());
        
        // Also set session flag to prevent showing again this session
        sessionStorage.setItem(STORAGE_KEY + '_session', 'true');
        
        // Show success message with confetti
        document.getElementById('foxx-newsletter-popup').innerHTML = \`
          <div style="
            text-align: center; 
            padding: 40px 30px; 
            position: relative;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.15);
            color: white;
            max-width: 450px;
            margin: 0 auto;
          ">
            <!-- Confetti Animation -->
            <div id="confetti-container" style="
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              overflow: hidden;
              pointer-events: none;
              border-radius: 20px;
            "></div>
            
            <!-- Success Icon -->
            <div style="
              width: 100px;
              height: 100px;
              background: #00c68c;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 30px;
              color: white;
              font-size: 48px;
              font-weight: bold;
              box-shadow: 0 10px 30px rgba(0, 198, 140, 0.4);
              animation: bounceIn 0.6s ease-out;
            ">✓</div>
            
            <!-- Success Message -->
            <h2 style="
              color: #fff;
              margin-bottom: 15px;
              font-size: 28px;
              font-weight: 700;
              text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">🎉 Awesome!</h2>
            
            <p style="
              color: rgba(255,255,255,0.9);
              margin-bottom: 25px;
              font-size: 16px;
              line-height: 1.5;
            ">
              You're all set! Check your email for your exclusive <strong>\${result.discountPercentage}%</strong> discount.
            </p>
            
            <!-- Clickable Coupon Code -->
            <div style="
              background: rgba(255,255,255,0.2);
              backdrop-filter: blur(10px);
              border: 2px dashed rgba(255,255,255,0.3);
              border-radius: 12px;
              padding: 20px;
              margin: 30px 0;
              cursor: pointer;
              transition: all 0.3s ease;
            " onclick="copyToClipboard('\${result.discountCode}')">
              <div style="font-size: 12px; color: rgba(255,255,255,0.8); margin-bottom: 8px;">YOUR DISCOUNT CODE</div>
              <div style="
                font-size: 24px;
                font-weight: 800;
                letter-spacing: 2px;
                color: #fff;
                text-shadow: 0 2px 4px rgba(0,0,0,0.3);
              ">\${result.discountCode}</div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 8px;">👆 Click to copy</div>
            </div>
            
            <!-- Big Close Button -->
            <button onclick="document.getElementById('foxx-newsletter-backdrop').remove()" style="
              background: rgba(255,255,255,0.2);
              backdrop-filter: blur(10px);
              color: white;
              border: 2px solid rgba(255,255,255,0.3);
              padding: 15px 30px;
              border-radius: 50px;
              font-weight: 700;
              font-size: 16px;
              cursor: pointer;
              transition: all 0.3s ease;
              min-width: 120px;
            " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
              ✕ Close
            </button>
            
            <div style="
              margin-top: 20px;
              font-size: 13px;
              color: rgba(255,255,255,0.7);
            ">
              Save \${result.discountPercentage}% on your next purchase!
            </div>
          </div>
        \`;
        
        // Add confetti animation and copy function
        const confettiScript = \`
          <style>
            @keyframes bounceIn {
              0% { transform: scale(0.3); opacity: 0; }
              50% { transform: scale(1.05); }
              70% { transform: scale(0.9); }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes confetti-fall {
              to { transform: translateY(100vh) rotate(360deg); }
            }
          </style>
          <script>
            function copyToClipboard(text) {
              navigator.clipboard.writeText(text).then(() => {
                // Show copy feedback
                const button = event.currentTarget;
                const originalContent = button.innerHTML;
                button.innerHTML = button.innerHTML.replace('👆 Click to copy', '✅ Copied!');
                button.style.background = 'rgba(0, 198, 140, 0.3)';
                setTimeout(() => {
                  button.innerHTML = originalContent;
                  button.style.background = 'rgba(255,255,255,0.2)';
                }, 2000);
              });
            }
            
            function createConfetti() {
              const container = document.getElementById('confetti-container');
              const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#f368e0'];
              
              for (let i = 0; i < 50; i++) {
                const confetti = document.createElement('div');
                confetti.style.position = 'absolute';
                confetti.style.width = Math.random() * 10 + 5 + 'px';
                confetti.style.height = Math.random() * 10 + 5 + 'px';
                confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.left = Math.random() * 100 + '%';
                confetti.style.top = '-10px';
                confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
                confetti.style.animation = 'confetti-fall ' + (Math.random() * 3 + 2) + 's linear infinite';
                confetti.style.animationDelay = Math.random() * 2 + 's';
                container.appendChild(confetti);
              }
              
              // Clean up confetti after animation
              setTimeout(() => {
                if (container) container.innerHTML = '';
              }, 6000);
            }
            
            // Start confetti animation
            setTimeout(createConfetti, 100);
          </script>
        \`;
        
        // Inject confetti script
        document.head.insertAdjacentHTML('beforeend', confettiScript);
        
        // NO AUTO-CLOSE - User must click close button
        
        // Add completion status update
        console.log('Foxx Newsletter: Enhanced confirmation popup displayed with confetti effects');
      } else {
        alert(result.message || 'Subscription failed. Please try again.');
      }
    } catch (error) {
      console.error('Foxx Newsletter: Subscription error', error);
      alert('An error occurred. Please try again later.');
    }
  }
  
  // Trigger logic
  function canShowPopup() {
    return !localStorage.getItem(STORAGE_KEY) && POPUP_CONFIG && POPUP_CONFIG.isActive;
  }
  
  function initPopup() {
    if (!canShowPopup()) return;
    
    // Check for suppress after subscription
    if (POPUP_CONFIG.suppressAfterSubscription && localStorage.getItem(STORAGE_KEY)) {
      return;
    }
    
    const trigger = POPUP_CONFIG.displayTrigger;
    
    switch (trigger) {
      case 'immediate':
        setTimeout(showPopup, 1000);
        break;
      case 'after-5s':
        setTimeout(showPopup, 5000);
        break;
      case 'scroll-50':
        let hasShown = false;
        window.addEventListener('scroll', function() {
          if (hasShown) return;
          const scrolled = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
          if (scrolled >= 50) {
            hasShown = true;
            showPopup();
          }
        });
        break;
      case 'exit-intent':
        let intentShown = false;
        document.addEventListener('mouseleave', function(e) {
          if (!intentShown && e.clientY <= 0) {
            intentShown = true;
            showPopup();
          }
        });
        break;
      default:
        setTimeout(showPopup, 1000);
    }
    
    // Additional exit intent if user didn't subscribe initially
    if (POPUP_CONFIG.showExitIntentIfNotSubscribed) {
      let exitIntentShown = false;
      let hasInteracted = false;
      
      // Track if user has interacted with the page
      document.addEventListener('click', function() { hasInteracted = true; });
      document.addEventListener('scroll', function() { hasInteracted = true; });
      
      document.addEventListener('mouseleave', function(e) {
        // Only show if user has interacted, hasn't subscribed, and popup hasn't been shown via exit intent
        if (!exitIntentShown && hasInteracted && e.clientY <= 0 && !localStorage.getItem(STORAGE_KEY)) {
          exitIntentShown = true;
          showPopup();
        }
      });
    }
  }
  
  // Initialize when DOM is ready with small delay
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(loadConfig, 500);
    });
  } else {
    setTimeout(loadConfig, 500);
  }
})();`;
  }

  generateIntegrationFile(storeId?: string, shopifyUrl?: string, baseUrl?: string): string {
    const apiBase = baseUrl || 'http://localhost:5000';
    const storeDomain = shopifyUrl ? new URL(shopifyUrl).hostname : 'yourdomain.com';
    
    return `
// Foxx Newsletter Manager Service Worker
// Store ID: ${storeId || 'N/A'}
// Store Domain: ${storeDomain}
// This file should be placed in the root directory of your website

const STORE_ID = '${storeId || ''}';
const API_BASE = '${apiBase}';
const STORE_DOMAIN = '${storeDomain}';

self.addEventListener('install', function(event) {
  console.log('Foxx Newsletter Manager service worker installed for store:', STORE_ID);
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('Foxx Newsletter Manager service worker activated for store:', STORE_ID);
  event.waitUntil(self.clients.claim());
});

// Handle push notifications with store-specific branding
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || 'New newsletter update available!',
        icon: data.icon || '/icon-192x192.png',
        badge: data.badge || '/badge-72x72.png',
        data: {
          url: data.url || 'https://' + STORE_DOMAIN,
          storeId: STORE_ID
        },
        tag: 'foxx-newsletter-' + STORE_ID,
        requireInteraction: true,
        actions: [
          {
            action: 'view',
            title: 'View Offer',
            icon: '/icon-view.png'
          },
          {
            action: 'dismiss',
            title: 'Dismiss',
            icon: '/icon-close.png'
          }
        ]
      };
      
      event.waitUntil(
        self.registration.showNotification(
          data.title || 'Newsletter Update - ' + STORE_DOMAIN, 
          options
        )
      );
    } catch (error) {
      console.error('Push notification error:', error);
    }
  }
});

// Handle notification clicks with analytics
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const { action, data } = event;
  
  if (action === 'dismiss') {
    // Track dismissal
    if (STORE_ID) {
      fetch(API_BASE + '/api/stores/' + STORE_ID + '/notification-dismissed', {
        method: 'POST',
        body: JSON.stringify({ timestamp: Date.now() }),
        headers: { 'Content-Type': 'application/json' }
      }).catch(console.error);
    }
    return;
  }
  
  // Default action or 'view' action
  const urlToOpen = event.notification.data?.url || 'https://' + STORE_DOMAIN;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Check if there's already a window open with this URL
        for (let client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Track click analytics
        if (STORE_ID) {
          fetch(API_BASE + '/api/stores/' + STORE_ID + '/notification-clicked', {
            method: 'POST',
            body: JSON.stringify({ 
              timestamp: Date.now(),
              url: urlToOpen 
            }),
            headers: { 'Content-Type': 'application/json' }
          }).catch(console.error);
        }
        
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background sync for newsletter subscriptions (when offline)
self.addEventListener('sync', function(event) {
  if (event.tag === 'newsletter-sync-' + STORE_ID) {
    event.waitUntil(
      // Retry failed newsletter subscriptions
      syncNewsletterSubscriptions()
    );
  }
});

// Function to sync offline newsletter subscriptions
async function syncNewsletterSubscriptions() {
  try {
    // Get pending subscriptions from IndexedDB
    const pending = await getPendingSubscriptions();
    
    for (let subscription of pending) {
      try {
        const response = await fetch(API_BASE + '/api/stores/' + STORE_ID + '/subscribers', {
          method: 'POST',
          body: JSON.stringify(subscription.data),
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          await removePendingSubscription(subscription.id);
        }
      } catch (error) {
        console.error('Failed to sync subscription:', error);
      }
    }
  } catch (error) {
    console.error('Background sync error:', error);
  }
}

// Helper functions for IndexedDB operations
async function getPendingSubscriptions() {
  // Simple mock for now - in production, use IndexedDB
  return [];
}

async function removePendingSubscription(id) {
  // Simple mock for now - in production, use IndexedDB
  return true;
}

// Newsletter integration events
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'NEWSLETTER_SUBSCRIBED') {
    // Newsletter popup successfully subscribed
    console.log('Newsletter subscription confirmed for store:', STORE_ID);
    
    // Optional: Show a confirmation notification
    if (event.data.showNotification) {
      self.registration.showNotification('Welcome!', {
        body: 'Thanks for subscribing to our newsletter!',
        icon: '/icon-success.png',
        tag: 'welcome-' + STORE_ID
      });
    }
  }
});
`;
  }
}

export const popupGeneratorService = new PopupGeneratorService();
