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
      // Check for API_BASE_URL environment variable first
      if (process.env.API_BASE_URL) {
        scriptBaseUrl = process.env.API_BASE_URL;
      } else if (process.env.REPLIT_DEV_DOMAIN) {
        // For Replit environment
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
      // Check for API_BASE_URL environment variable first
      if (process.env.API_BASE_URL) {
        scriptBaseUrl = process.env.API_BASE_URL;
      } else if (process.env.REPLIT_DEV_DOMAIN) {
        // For Replit environment
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
  script.setAttribute('data-store-domain', '${shopifyUrl.replace(/^https?:\/\//, '')}');
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
      // Check for API_BASE_URL environment variable first
      if (process.env.API_BASE_URL) {
        apiBaseUrl = process.env.API_BASE_URL;
      } else if (process.env.REPLIT_DEV_DOMAIN) {
        // For Replit environment
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
  const SESSION_ID = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  let POPUP_CONFIG = null;
  
  // Prevent multiple script loading conflicts
  if (window.foxxNewsletterLoaded) {
    console.log('Foxx Newsletter: Script already loaded, skipping...');
    return;
  }
  window.foxxNewsletterLoaded = true;
  
  // Modern approach: Always check server first, use localStorage as UX enhancement only
  let shouldShowPopup = true;
  
  // Load configuration and check subscription status
  async function loadConfig() {
    try {
      // CRITICAL: Check session suppression FIRST before any other logic or API calls
      const sessionKey = STORAGE_KEY + '_session';
      const sessionSuppressed = sessionStorage.getItem(sessionKey);
      
      if (sessionSuppressed) {
        console.log('Foxx Newsletter: Regular popup suppressed for this browsing session');
        shouldShowPopup = false;
        // Still load config for exit intent functionality, but don't show regular popup
      }
      
      const response = await fetch(API_BASE + '/api/popup-config/' + STORE_ID);
      if (!response.ok) {
        throw new Error('Failed to load popup configuration');
      }
      POPUP_CONFIG = await response.json();
      
      if (!POPUP_CONFIG.isActive) {
        console.log('Foxx Newsletter: Popup is disabled for this store');
        return;
      }
      
      // Setup exit intent listener if feature is enabled OR display trigger is exit-intent (always register early, before verification gates)
      if (POPUP_CONFIG.showExitIntentIfNotSubscribed || POPUP_CONFIG.displayTrigger === 'exit-intent') {
        initExitIntentListener();
        console.log('Foxx Newsletter: Exit intent listener registered for this store');
      }
      
      // Check if script installation is verified before loading popup
      if (!POPUP_CONFIG.isVerified || !POPUP_CONFIG.hasActiveScript) {
        console.log('Foxx Newsletter: Script not verified or no active script version, popup blocked');
        return;
      }
      
      // Only proceed with subscription checks and popup initialization if not session suppressed
      if (!sessionSuppressed) {
        // Check if popup should be suppressed after subscription
        if (POPUP_CONFIG.suppressAfterSubscription) {
          await checkSubscriptionStatus();
        }
        
        if (shouldShowPopup) {
          initPopup();
        }
      }
    } catch (error) {
      console.error('Foxx Newsletter: Failed to load configuration', error);
    }
  }

  // Background cleanup: Check if sessionStorage should be cleared (independent of popup showing)
  async function backgroundCleanupCheck() {
    const sessionKey = STORAGE_KEY + '_session';
    const sessionSuppression = sessionStorage.getItem(sessionKey);
    
    // If sessionStorage exists, check if user is still subscribed
    if (sessionSuppression) {
      const lastSubscribedEmail = localStorage.getItem(STORAGE_KEY);
      
      // CRITICAL FIX: Only clear sessionStorage if we have a subscribed email that's no longer valid
      // Do NOT clear session suppression for users who simply dismissed the popup without subscribing
      if (lastSubscribedEmail && lastSubscribedEmail.includes('@')) {
        // If localStorage exists, verify with server
        try {
          const checkUrl = API_BASE + '/api/stores/' + STORE_ID + '/check-subscription/' + encodeURIComponent(lastSubscribedEmail);
          const checkResponse = await fetch(checkUrl);
          if (checkResponse.ok) {
            const result = await checkResponse.json();
            
            if (!result.isSubscribed) {
              // User no longer subscribed, clear sessionStorage
              sessionStorage.removeItem(sessionKey);
              console.log('Foxx Newsletter: User unsubscribed, sessionStorage cleared');
            }
          }
        } catch (error) {
          console.log('Foxx Newsletter: Background cleanup check failed');
        }
      } else {
        // No subscription localStorage but sessionStorage exists - this is normal for dismissed popups
        // DON'T clear sessionStorage as it's providing session suppression for dismissed popups
        console.log('Foxx Newsletter: Session suppression active (popup was dismissed without subscribing)');
      }
    }
  }

  // Check subscription status using multiple methods
  async function checkSubscriptionStatus() {
    // Method 1: Check localStorage for recent subscription (UX optimization)
    const lastSubscribedEmail = localStorage.getItem(STORAGE_KEY);
    const lastSubscribedTime = localStorage.getItem(STORAGE_KEY + '_time');
    
    // If subscribed recently (within 24 hours), verify with server
    if (lastSubscribedEmail && lastSubscribedTime) {
      const timeDiff = Date.now() - parseInt(lastSubscribedTime);
      const hoursAgo = timeDiff / (1000 * 60 * 60);
      
      if (hoursAgo < 24 && lastSubscribedEmail.includes('@')) {
        // Always verify with server when localStorage exists
        try {
          const checkUrl = API_BASE + '/api/stores/' + STORE_ID + '/check-subscription/' + encodeURIComponent(lastSubscribedEmail);
          const checkResponse = await fetch(checkUrl);
          if (checkResponse.ok) {
            const result = await checkResponse.json();
            
            if (result.isSubscribed) {
              shouldShowPopup = false;
              return;
            } else {
              // No longer subscribed, clear ALL storage (localStorage + sessionStorage)
              localStorage.removeItem(STORAGE_KEY);
              localStorage.removeItem(STORAGE_KEY + '_time');
              sessionStorage.removeItem(STORAGE_KEY + '_session');
              console.log('Foxx Newsletter: User no longer subscribed, all storage cleared');
            }
          }
        } catch (error) {
          console.log('Foxx Newsletter: Could not verify subscription status');
        }
      } else {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY + '_time');
      }
    }
    
    // Method 2: Check for regular popup session-based suppression (only if no localStorage check was performed)
    if (!lastSubscribedEmail) {
      const sessionKey = STORAGE_KEY + '_session_regular';
      const sessionSuppression = sessionStorage.getItem(sessionKey);
      
      if (sessionSuppression) {
        shouldShowPopup = false;
        return;
      }
    }
  }
  
  // Close popup and prevent showing again this session
  window.closePopupWithSession = function() {
    // Set session suppression ONLY for regular popup navigation-based triggers
    sessionStorage.setItem(STORAGE_KEY + '_session_regular', 'true');
    
    // Clear legacy dismissed flag that was blocking exit intent (migration)
    localStorage.removeItem(STORAGE_KEY + '_dismissed');
    
    // Track close time for analytics but don't use for suppression
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY + '_time', new Date().getTime().toString());
    }
    
    console.log('Foxx Newsletter: Regular popup closed, exit intent still available');
    closePopup();
  };
  
  // Create popup HTML
  function createPopupHTML() {
    const fields = POPUP_CONFIG.fields;
    let formFields = '';
    
    if (fields.email) {
      formFields += '<input type="email" name="email" placeholder="Enter your email address" style="width: 100%; padding: 12px; margin-bottom: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;" />';
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
        
        /* Mobile: align to top for better scrolling */
        @media (max-width: 640px) {
          align-items: flex-start;
          padding-block: 24px;
        }
      ">
        <div id="foxx-newsletter-popup" style="
          background: white;
          border-radius: 24px;
          padding: 28px;
          width: min(92vw, 680px);
          max-width: 680px;
          max-height: 90vh;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.8);
          position: relative;
          animation: foxxSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          
          /* Responsive design - mobile first */
          @media (max-width: 640px) {
            width: 95%;
            padding: 20px;
            margin: 16px;
            border-radius: 20px;
            max-height: 85vh;
          }
          @media (min-width: 768px) {
            max-width: 640px;
            padding: 28px;
          }
          @media (min-width: 1024px) {
            max-width: 680px;
            padding: 32px;
          }
        ">
          <button id="foxx-close-btn" style="
            position: absolute;
            top: 12px;
            right: 12px;
            background: rgba(156, 163, 175, 0.1);
            border: none;
            font-size: 20px;
            color: #6b7280;
            cursor: pointer;
            padding: 8px;
            line-height: 1;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
          " onclick="closePopupWithSession()" onmouseover="this.style.background='rgba(156, 163, 175, 0.2)'; this.style.color='#374151'" onmouseout="this.style.background='rgba(156, 163, 175, 0.1)'; this.style.color='#6b7280'">×</button>
          
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
            
            <button type="submit" id="foxx-submit-btn" style="
              width: 100%;
              background: #0071b9;
              color: white;
              border: none;
              padding: 14px;
              border-radius: 6px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s ease;
              position: relative;
              min-height: 48px;
            " onmouseover="if(!this.disabled) this.style.background='#005a94'" onmouseout="if(!this.disabled) this.style.background='#0071b9'">
              <span id="foxx-btn-text">\${POPUP_CONFIG.buttonText}</span>
              <div id="foxx-btn-spinner" style="display: none; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);">
                <div style="
                  width: 20px; 
                  height: 20px; 
                  border: 2px solid rgba(255,255,255,0.3); 
                  border-top: 2px solid white; 
                  border-radius: 50%; 
                  animation: spin 1s linear infinite;
                "></div>
              </div>
            </button>
            
            <!-- Loading messages container -->
            <div id="foxx-loading-messages" style="
              display: none;
              text-align: center;
              margin-top: 16px;
              padding: 12px;
              background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
              border-radius: 6px;
              border-left: 4px solid #0071b9;
            ">
              <div id="foxx-current-message" style="
                color: #0071b9;
                font-size: 14px;
                font-weight: 500;
                margin-bottom: 4px;
              "></div>
              <div style="color: #64748b; font-size: 12px;" id="foxx-sub-message"></div>
            </div>
          </form>

          <div id="foxx-social-links" style="
            display: flex;
            justify-content: center;
            gap: 16px;
            margin-top: 24px;
            color: #9ca3af;
          "></div>

          <div style="margin-top: 16px;">
            <label style="
              display: flex !important;
              align-items: flex-start !important;
              font-size: 12px !important;
              color: #6b7280 !important;
              line-height: 1.4 !important;
              cursor: pointer !important;
              user-select: none !important;
              position: relative !important;
              visibility: visible !important;
              opacity: 1 !important;
            ">
              <input type="checkbox" checked style="
                /* Bulletproof checkbox styling that cannot be overridden */
                appearance: none !important;
                -webkit-appearance: none !important;
                -moz-appearance: none !important;
                width: 16px !important;
                height: 16px !important;
                border: 2px solid #0071b9 !important;
                border-radius: 3px !important;
                background: #0071b9 !important;
                background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEwIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik04LjUgMS41TDMuNSA2LjUgMS41IDQuNSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K') !important;
                background-repeat: no-repeat !important;
                background-position: center !important;
                background-size: 10px 8px !important;
                margin-right: 8px !important;
                margin-top: 2px !important;
                flex-shrink: 0 !important;
                position: relative !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                display: inline-block !important;
                visibility: visible !important;
                opacity: 1 !important;
                outline: none !important;
                box-shadow: 0 0 0 0 transparent !important;
                vertical-align: top !important;
              " />
              <span style="
                font-size: 12px !important;
                color: #6b7280 !important;
                line-height: 1.4 !important;
                display: inline !important;
                visibility: visible !important;
                opacity: 1 !important;
                font-weight: normal !important;
              ">Stay Connected For: <strong style='font-weight: 600 !important; color: #374151 !important;'>Exclusive Product Launches</strong> • <strong style='font-weight: 600 !important; color: #374151 !important;'>Special Promotions</strong> • <strong style='font-weight: 600 !important; color: #374151 !important;'>Bioprocess Insights & Updates</strong></span>
            </label>
          </div>
        </div>
      </div>
    \`;
  }

  // Render social media links dynamically
  function renderSocialLinks() {
    const socialContainer = document.getElementById('foxx-social-links');
    if (!socialContainer || !POPUP_CONFIG.socialLinks) return;

    const socialIcons = {
      linkedin: {
        svg: '<svg style="width: 20px; height: 20px;" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>',
        color: '#2563eb'
      },
      twitter: {
        svg: '<svg style="width: 20px; height: 20px;" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>',
        color: '#3b82f6'
      },
      instagram: {
        svg: '<svg style="width: 20px; height: 20px;" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.79-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
        color: '#ec4899'
      },
      facebook: {
        svg: '<svg style="width: 20px; height: 20px;" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
        color: '#1d4ed8'
      },
      youtube: {
        svg: '<svg style="width: 20px; height: 20px;" fill="currentColor" viewBox="0 0 24 24"><path d="m10 15 5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73Z"/></svg>',
        color: '#dc2626'
      },
      reddit: {
        svg: '<svg style="width: 20px; height: 20px;" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>',
        color: '#ea580c'
      },
      quora: {
        svg: '<svg style="width: 20px; height: 20px;" fill="currentColor" viewBox="0 0 24 24"><path d="M12.555 17.025c-.16.31-.45.55-.8.68l1.88 2.795h-2.61l-1.315-2.115c-.18.03-.365.04-.55.04-2.32 0-4.2-1.88-4.2-4.2s1.88-4.2 4.2-4.2 4.2 1.88 4.2 4.2c0 1.01-.365 1.94-.945 2.66l.14.14zm7.445-5.025c0 6.628-5.373 12-12 12s-12-5.372-12-12 5.373-12 12-12 12 5.372 12 12zm-11.26-1.735c-1.045 0-1.89.845-1.89 1.89s.845 1.89 1.89 1.89c.995 0 1.82-.765 1.88-1.735l-.09-.255c-.06-.945-.83-1.69-1.79-1.69z"/></svg>',
        color: '#b91c1c'
      }
    };

    const validLinks = [];
    Object.keys(POPUP_CONFIG.socialLinks).forEach(platform => {
      const url = POPUP_CONFIG.socialLinks[platform];
      if (url && url.trim() !== '' && socialIcons[platform]) {
        validLinks.push({
          platform,
          url: url.trim(),
          icon: socialIcons[platform]
        });
      }
    });

    if (validLinks.length === 0) {
      socialContainer.style.display = 'none';
      return;
    }

    socialContainer.style.display = 'flex';
    socialContainer.innerHTML = validLinks.map(link => \`
      <a href="\${link.url}" target="_blank" rel="noopener noreferrer" style="
        color: \${link.icon.color};
        transition: all 0.2s ease;
        border-radius: 50%;
        padding: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #e5e7eb;
        background: white;
        text-decoration: none;
      " onmouseover="this.style.borderColor='#d1d5db'; this.style.backgroundColor='#f9fafb'; this.style.transform='scale(1.05)'" onmouseout="this.style.borderColor='#e5e7eb'; this.style.backgroundColor='white'; this.style.transform='scale(1)'">
        \${link.icon.svg}
      </a>
    \`).join('');
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
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    @keyframes successBounce {
      0% { 
        transform: scale(0) rotate(0deg); 
        opacity: 0;
      }
      50% {
        transform: scale(1.2) rotate(180deg);
        opacity: 0.8;
      }
      100% {
        transform: scale(1) rotate(360deg);
        opacity: 1;
      }
    }
    @keyframes pulseRing {
      0% {
        transform: scale(0.8);
        opacity: 1;
      }
      100% {
        transform: scale(1.2);
        opacity: 0;
      }
    }
    @keyframes shimmer {
      0% {
        left: -100%;
      }
      100% {
        left: 100%;
      }
    }
  \`;
  document.head.appendChild(style);
  
  // Custom notification system
  function showCustomNotification(message, type = 'error') {
    // Remove existing notifications
    const existing = document.getElementById('foxx-custom-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.id = 'foxx-custom-notification';
    notification.style.cssText = \`
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: \${type === 'error' ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)' : 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)'};
      border: 1px solid \${type === 'error' ? '#fca5a5' : '#86efac'};
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      z-index: 1000000;
      max-width: 400px;
      animation: foxxSlideIn 0.3s ease-out;
      backdrop-filter: blur(8px);
    \`;
    
    notification.innerHTML = \`
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="
          width: 6px;
          height: 24px;
          background: \${type === 'error' ? '#ef4444' : '#22c55e'};
          border-radius: 3px;
        "></div>
        <div style="
          color: \${type === 'error' ? '#7f1d1d' : '#14532d'};
          font-size: 14px;
          font-weight: 500;
          line-height: 1.4;
        ">\${message}</div>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: none;
          border: none;
          color: \${type === 'error' ? '#7f1d1d' : '#14532d'};
          font-size: 18px;
          cursor: pointer;
          opacity: 0.7;
          padding: 0;
          margin-left: auto;
        ">×</button>
      </div>
    \`;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification && notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }
  
  // Confetti animation function
  function fireConfetti() {
    // Create canvas for confetti
    const canvas = document.createElement('canvas');
    canvas.style.cssText = \`
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999998;
    \`;
    document.body.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const confettiPieces = [];
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
    
    // Create confetti pieces
    for (let i = 0; i < 100; i++) {
      confettiPieces.push({
        x: Math.random() * canvas.width,
        y: -10,
        vx: Math.random() * 4 - 2,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 10 - 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 6 + 3
      });
    }
    
    function animateConfetti() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      confettiPieces.forEach((piece, index) => {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.rotation += piece.rotationSpeed;
        
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate((piece.rotation * Math.PI) / 180);
        ctx.fillStyle = piece.color;
        ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
        ctx.restore();
        
        // Remove confetti that's off screen
        if (piece.y > canvas.height + 10) {
          confettiPieces.splice(index, 1);
        }
      });
      
      if (confettiPieces.length > 0) {
        requestAnimationFrame(animateConfetti);
      } else {
        // Clean up canvas
        document.body.removeChild(canvas);
      }
    }
    
    animateConfetti();
  }
  
  // Copy discount code to clipboard with toast notification
  window.copyDiscountCode = function(discountCode) {
    navigator.clipboard.writeText(discountCode).then(() => {
      showCustomNotification('Discount code "' + discountCode + '" copied to clipboard!', 'success');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = discountCode;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        showCustomNotification('Discount code "' + discountCode + '" copied to clipboard!', 'success');
      } catch (err) {
        showCustomNotification('Unable to copy code. Please copy manually: ' + discountCode, 'error');
      }
      
      document.body.removeChild(textArea);
    });
  };
  
  // Email validation with temporary email detection
  function validateEmail(email) {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, message: 'Please enter a valid email address.' };
    }
    
    const domain = email.split('@')[1].toLowerCase();
    
    // Check for temporary email domains
    const tempDomains = [
      'temp-mail.org', '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
      'yopmail.com', 'throwaway.email', 'tempmail.com', 'gettemp.mail',
      'temp-mail.io', 'mohmal.com', 'maildrop.cc', 'mailnesia.com',
      'tempail.com', 'sharklasers.com', 'guerrillamailblock.com', 'pokemail.net',
      'spam4.me', 'bccto.me', 'chacuo.net', 'dispostable.com', 'dmhubs.com'
    ];
    
    if (tempDomains.includes(domain)) {
      return { valid: false, message: 'Temporary email addresses are not allowed. Please use your permanent business email address.' };
    }
    
    const validation = POPUP_CONFIG.emailValidation;
    if (validation.companyEmailsOnly) {
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
    // Note: subscription checking is handled by checkSubscriptionStatus() which sets shouldShowPopup
    // Don't check localStorage here as it may contain stale data when records are deleted from database
    
    const popupHTML = createPopupHTML();
    document.body.insertAdjacentHTML('beforeend', popupHTML);
    
    // Render social links dynamically after HTML is inserted
    renderSocialLinks();
    
    // Event listener for backdrop close - use session-aware close
    document.getElementById('foxx-newsletter-backdrop').addEventListener('click', function(e) {
      if (e.target === this) {
        // Use same close function as the button for consistency
        closePopupWithSession();
      }
    });
    
    document.getElementById('foxx-newsletter-form').addEventListener('submit', handleSubmit);
  }
  
  // Close popup
  function closePopup() {
    const backdrop = document.getElementById('foxx-newsletter-backdrop');
    if (backdrop) {
      backdrop.remove();
      
      // Track that user dismissed popup without subscribing (for exit intent logic)
      if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY + '_dismissed', 'true');
      }
    }
  }
  
  // Progress messages for loading state
  const progressMessages = [
    { main: "Validating your email...", sub: "Making sure everything looks perfect" },
    { main: "Generating your discount code...", sub: "Creating a special 15% off just for you" },
    { main: "Preparing your welcome email...", sub: "Adding you to our exclusive updates list" },
    { main: "Almost there...", sub: "Finalizing your subscription benefits" }
  ];

  // Show progress message with animation
  function showProgressMessage(index) {
    const messageEl = document.getElementById('foxx-current-message');
    const subMessageEl = document.getElementById('foxx-sub-message');
    
    if (messageEl && subMessageEl && progressMessages[index]) {
      messageEl.style.animation = 'pulse 1.5s ease-in-out infinite';
      messageEl.textContent = progressMessages[index].main;
      subMessageEl.textContent = progressMessages[index].sub;
    }
  }

  // Handle form submission
  async function handleSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    // Add session ID to track this browser session
    data.sessionId = SESSION_ID;
    
    // Validate email
    const emailValidation = validateEmail(data.email);
    if (!emailValidation.valid) {
      showCustomNotification(emailValidation.message, 'error');
      return;
    }
    
    // Start loading state
    const submitBtn = document.getElementById('foxx-submit-btn');
    const btnText = document.getElementById('foxx-btn-text');
    const spinner = document.getElementById('foxx-btn-spinner');
    const loadingMessages = document.getElementById('foxx-loading-messages');
    
    // Disable button and show spinner
    submitBtn.disabled = true;
    submitBtn.style.background = '#94a3b8';
    btnText.style.opacity = '0';
    spinner.style.display = 'block';
    loadingMessages.style.display = 'block';
    
    // Show progress messages sequentially
    let messageIndex = 0;
    showProgressMessage(messageIndex);
    
    const messageInterval = setInterval(() => {
      messageIndex++;
      if (messageIndex < progressMessages.length) {
        showProgressMessage(messageIndex);
      }
    }, 1200);
    
    try {
      const response = await fetch(API_BASE + '/api/subscribe/' + STORE_ID, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      // Clear progress messages
      clearInterval(messageInterval);
      
      if (response.ok) {
        // Success
        // Store email and timestamp for smart suppression
        localStorage.setItem(STORAGE_KEY, data.email);
        localStorage.setItem(STORAGE_KEY + '_time', Date.now().toString());
        
        // Clear the dismissed and exit intent flags since user has now subscribed
        localStorage.removeItem(STORAGE_KEY + '_dismissed');
        localStorage.removeItem(STORAGE_KEY + '_exit_intent_shown');
        
        // Also set session flag to prevent showing again this session
        sessionStorage.setItem(STORAGE_KEY + '_session', 'true');
        
        // Fire confetti animation
        fireConfetti();
        
        // Show modern 2024 success confirmation with brand colors
        document.getElementById('foxx-newsletter-popup').innerHTML = \`
          <div id="foxx-success-content" style="
            text-align: center; 
            padding: 32px 24px; 
            position: relative;
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #2563eb 100%);
            border-radius: 24px;
            box-shadow: 0 20px 40px rgba(30, 64, 175, 0.3), 0 0 0 1px rgba(255,255,255,0.15);
            color: white;
            width: 100%;
            max-width: none;
            margin: 0;
            overflow: visible;
          ">
            <!-- Glassmorphism overlay -->
            <div style="
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(255,255,255,0.05);
              backdrop-filter: blur(20px);
              border-radius: 24px;
              pointer-events: none;
              z-index: 0;
            "></div>
            
            <!-- Content container -->
            <div style="position: relative; z-index: 2; padding-bottom: 20px;">
              <!-- Animated Success Icon -->
              <div style="
                width: 120px;
                height: 120px;
                background: linear-gradient(135deg, #00c68c, #00e699);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 32px;
                color: white;
                font-size: 60px;
                font-weight: bold;
                box-shadow: 0 15px 40px rgba(0, 198, 140, 0.4), 0 0 0 8px rgba(255,255,255,0.1);
                animation: successBounce 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                position: relative;
              ">
                ✓
                <!-- Pulse ring -->
                <div style="
                  position: absolute;
                  width: 140px;
                  height: 140px;
                  border: 3px solid rgba(0, 198, 140, 0.3);
                  border-radius: 50%;
                  animation: pulseRing 2s ease-out infinite;
                "></div>
              </div>
              
              <!-- Success Message -->
              <h2 style="
                color: #fff;
                margin-bottom: 16px;
                font-size: 32px;
                font-weight: 800;
                text-shadow: 0 2px 8px rgba(0,0,0,0.2);
                letter-spacing: -0.5px;
              ">Welcome to the Family!</h2>
              
              <!-- Email confirmation with user's email -->
              <div style="
                background: rgba(255,255,255,0.15);
                backdrop-filter: blur(10px);
                border-radius: 16px;
                padding: 20px;
                margin: 24px 0;
                border: 1px solid rgba(255,255,255,0.2);
              ">
                <div style="
                  font-size: 14px; 
                  color: rgba(255,255,255,0.8); 
                  margin-bottom: 8px;
                  text-transform: uppercase;
                  letter-spacing: 1px;
                  font-weight: 600;
                ">Confirmation sent to</div>
                <div style="
                  font-size: 18px;
                  font-weight: 700;
                  color: #fff;
                  margin-bottom: 12px;
                  word-break: break-all;
                ">\${data.email}</div>
                <div style="
                  font-size: 13px;
                  color: rgba(255,255,255,0.7);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 8px;
                ">
                  <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24"><path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.1 3.89 23 5 23H11V21H5V3H13V9H21Z"/></svg>
                  Email with discount code is on its way!
                </div>
              </div>
              
              <!-- Discount Code Section -->
              <div style="
                background: rgba(255,255,255,0.1);
                backdrop-filter: blur(15px);
                border: 2px dashed rgba(255,255,255,0.3);
                border-radius: 20px;
                padding: 24px;
                margin: 32px 0;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                overflow: hidden;
              " onclick="copyDiscountCode('\${result.discountCode}')" onmouseover="this.style.transform='scale(1.02)'; this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.transform='scale(1)'; this.style.background='rgba(255,255,255,0.1)'">
                <!-- Shimmer effect -->
                <div style="
                  position: absolute;
                  top: 0;
                  left: -100%;
                  width: 100%;
                  height: 100%;
                  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                  animation: shimmer 2s infinite;
                "></div>
                
                <div style="position: relative; z-index: 1;">
                  <div style="
                    font-size: 12px; 
                    color: rgba(255,255,255,0.8); 
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    font-weight: 600;
                  ">Your Exclusive Discount</div>
                  <div style="
                    font-size: 28px;
                    font-weight: 900;
                    letter-spacing: 3px;
                    color: #fff;
                    text-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    margin-bottom: 8px;
                  ">\${result.discountCode}</div>
                  <div style="
                    font-size: 13px; 
                    color: rgba(255,255,255,0.7); 
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                  ">
                    <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24"><path d="M19 21H8V7H19M19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1Z"/></svg>
                    Tap to copy • Save \${result.discountPercentage}%
                  </div>
                </div>
              </div>
              
              <!-- Email notification note -->
              <div style="
                background: rgba(0, 198, 140, 0.15);
                border: 1px solid rgba(0, 198, 140, 0.3);
                border-radius: 16px;
                padding: 16px;
                margin: 24px 0;
                color: rgba(255,255,255,0.9);
                font-size: 14px;
                line-height: 1.5;
              ">
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: 8px;
                  font-weight: 600;
                ">
                  <svg style="width: 18px; height: 18px; fill: currentColor;" viewBox="0 0 24 24"><path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z"/></svg>
                  Email Notification
                </div>
                We're sending you a welcome email with your discount code and exclusive updates. Check your inbox in the next few minutes!
              </div>
              
              <!-- Modern Close Button -->
              <button onclick="document.getElementById('foxx-newsletter-backdrop').remove()" style="
                background: rgba(255,255,255,0.15);
                backdrop-filter: blur(10px);
                color: white;
                border: 2px solid rgba(255,255,255,0.3);
                padding: 16px 32px;
                border-radius: 50px;
                font-weight: 700;
                font-size: 16px;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                min-width: 140px;
                margin-top: 24px;
              " onmouseover="this.style.background='rgba(255,255,255,0.25)'; this.style.transform='translateY(-2px)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'; this.style.transform='translateY(0)'">
                Continue Shopping
              </button>
            </div>
          </div>
        \`;
        
        // Add modern animations and copy function
        const confettiScript = \`
          <style>
            /* Success popup responsive styles */
            #foxx-success-content {
              padding: 32px 24px;
            }
            @media (max-width: 640px) {
              #foxx-newsletter-backdrop {
                align-items: flex-start !important;
                padding-top: 24px !important;
                padding-bottom: 24px !important;
              }
            }
            @media (min-width: 640px) {
              #foxx-success-content {
                padding: 40px 32px;
              }
            }
            @media (min-width: 768px) {
              #foxx-success-content {
                padding: 48px 40px;
              }
            }
            @media (min-width: 1024px) {
              #foxx-success-content {
                padding: 56px 48px;
              }
            }
            
            /* Animation keyframes */
            @keyframes successBounce {
              0% { transform: scale(0.3) rotate(-12deg); opacity: 0; }
              30% { transform: scale(1.1) rotate(12deg); opacity: 0.8; }
              50% { transform: scale(0.95) rotate(-6deg); opacity: 1; }
              70% { transform: scale(1.05) rotate(3deg); }
              100% { transform: scale(1) rotate(0deg); opacity: 1; }
            }
            @keyframes pulseRing {
              0% { transform: scale(0.8); opacity: 1; }
              100% { transform: scale(1.2); opacity: 0; }
            }
            @keyframes shimmer {
              0% { left: -100%; }
              100% { left: 100%; }
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
        // Clear progress messages and reset button
        clearInterval(messageInterval);
        submitBtn.disabled = false;
        submitBtn.style.background = '#0071b9';
        btnText.style.opacity = '1';
        spinner.style.display = 'none';
        loadingMessages.style.display = 'none';
        
        showCustomNotification(result.message || 'Subscription failed. Please try again.', 'error');
      }
    } catch (error) {
      // Clear progress messages and reset button on error
      clearInterval(messageInterval);
      submitBtn.disabled = false;
      submitBtn.style.background = '#0071b9';
      btnText.style.opacity = '1';
      spinner.style.display = 'none';
      loadingMessages.style.display = 'none';
      
      console.error('Foxx Newsletter: Subscription error', error);
      showCustomNotification('An error occurred. Please try again later.', 'error');
    }
  }
  
  // Trigger logic
  function canShowPopup() {
    return !localStorage.getItem(STORAGE_KEY) && POPUP_CONFIG && POPUP_CONFIG.isActive;
  }
  
  // Check if regular popup should be shown (respects session suppression)
  function canShowRegularPopup() {
    const sessionSuppressed = sessionStorage.getItem(STORAGE_KEY + '_session');
    const canShow = canShowPopup() && !sessionSuppressed;
    if (sessionSuppressed) {
      console.log('Foxx Newsletter: canShowRegularPopup() - Session suppressed, popup blocked');
    }
    return canShow;
  }
  
  // Check if exit intent popup should be shown (bypasses session suppression)
  function canShowExitIntentPopup() {
    console.log('Foxx Newsletter: Checking if exit intent popup can show...');
    
    // Note: subscription checking is handled by checkSubscriptionStatus() in loadConfig()
    // Don't check localStorage here as it may contain stale data when records are deleted from database
    console.log('Foxx Newsletter: Exit intent checking localStorage values...');
    console.log('Foxx Newsletter: localStorage STORAGE_KEY:', localStorage.getItem(STORAGE_KEY));
    console.log('Foxx Newsletter: localStorage time:', localStorage.getItem(STORAGE_KEY + '_time'));
    
    // Check if popup config is active
    if (!POPUP_CONFIG || !POPUP_CONFIG.isActive) {
      console.log('Foxx Newsletter: Exit intent blocked - popup config not active:', POPUP_CONFIG);
      return false;
    }
    
    // Check if user already subscribed
    const hasSubscribed = localStorage.getItem(STORAGE_KEY) === 'true';
    if (hasSubscribed && POPUP_CONFIG.suppressAfterSubscription) {
      console.log('Foxx Newsletter: Exit intent blocked - user already subscribed');
      return false;
    }
    
    // Use per-page exit intent suppression instead of global session suppression
    const currentPage = window.location.pathname || '/';
    const pageExitIntentKey = STORAGE_KEY + '_exit_shown_' + currentPage.replace(/[^a-zA-Z0-9]/g, '_');
    const exitIntentShownOnThisPage = sessionStorage.getItem(pageExitIntentKey) === 'true';
    
    console.log('Foxx Newsletter: Current page:', currentPage);
    console.log('Foxx Newsletter: Exit intent shown on this page:', exitIntentShownOnThisPage);
    
    if (exitIntentShownOnThisPage) {
      console.log('Foxx Newsletter: Exit intent blocked - already shown on this page');
      return false;
    }
    
    // Two scenarios for exit intent popup:
    // 1. Display trigger is set to "exit-intent" - show immediately on exit intent
    // 2. "Show popup on exit intent if user didn't subscribe initially" is enabled - show after dismissing regular popup
    
    const isExitIntentTrigger = POPUP_CONFIG.displayTrigger === 'exit-intent';
    const hasExitIntentFeature = POPUP_CONFIG.showExitIntentIfNotSubscribed;
    // For exit intent, we don't check regular session suppression - exit intent should work even if regular popup is suppressed
    const regularSessionSuppressed = sessionStorage.getItem(STORAGE_KEY + '_session_regular') === 'true';
    
    console.log('Foxx Newsletter: Display trigger:', POPUP_CONFIG.displayTrigger);
    console.log('Foxx Newsletter: Has exit intent feature:', hasExitIntentFeature);
    console.log('Foxx Newsletter: Regular session suppressed:', regularSessionSuppressed);
    
    let canShow = false;
    
    if (isExitIntentTrigger) {
      // If display trigger is exit-intent, show popup on exit intent (primary trigger)
      canShow = true;
      console.log('Foxx Newsletter: Exit intent can show - display trigger is exit-intent');
    } else if (hasExitIntentFeature) {
      // If exit intent feature is enabled, show it regardless of regular popup dismissal
      // This allows exit intent to work on inner pages even when regular popup was dismissed
      canShow = true;
      console.log('Foxx Newsletter: Exit intent can show - feature enabled for inner pages');
    }
    
    console.log('Foxx Newsletter: Exit intent final decision:', canShow);
    return canShow;
  }
  
  function initPopup() {
    if (!canShowRegularPopup()) {
      console.log('Foxx Newsletter: initPopup() - Cannot show regular popup, blocked');
      return;
    }
    
    // Check for suppress after subscription
    if (POPUP_CONFIG.suppressAfterSubscription && localStorage.getItem(STORAGE_KEY)) {
      console.log('Foxx Newsletter: initPopup() - Suppressed after subscription');
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
        // Exit intent is now handled by the dedicated initExitIntentListener() function
        // No need to register another listener here to avoid duplicates
        break;
      default:
        setTimeout(showPopup, 1000);
    }
  }
  
  // Separate function to setup exit intent listener (called unconditionally if feature enabled)
  function initExitIntentListener() {
    let exitIntentShown = false;
    let hasInteracted = false;
    let listenersActive = false;
    
    console.log('Foxx Newsletter: Exit intent listener initialized');
    
    // Function to activate exit intent detection after delay and user interaction
    function activateExitIntent() {
      if (listenersActive) return;
      listenersActive = true;
      
      console.log('Foxx Newsletter: Exit intent detection activated');
      
      // Primary exit intent detection using mouseleave (industry standard)
      function handleExitIntent(e) {
        console.log('Foxx Newsletter: Exit intent event triggered', {
          clientY: e.clientY,
          relatedTarget: e.relatedTarget,
          toElement: e.toElement,
          exitIntentShown: exitIntentShown
        });
        
        // Industry standard conditions for exit intent
        const isExitingUp = e.clientY <= 10; // Mouse near top of page (towards address bar)
        const isLeavingPage = !e.relatedTarget && !e.toElement; // Mouse leaving document completely
        
        if (!exitIntentShown && isExitingUp && isLeavingPage && canShowExitIntentPopup()) {
          exitIntentShown = true;
          console.log('Foxx Newsletter: Exit intent detected - showing popup');
          
          // Remove listeners to prevent multiple triggers
          document.removeEventListener('mouseleave', handleExitIntent);
          
          // Mark that exit intent was shown on this specific page
          const currentPage = window.location.pathname || '/';
          const pageExitIntentKey = STORAGE_KEY + '_exit_shown_' + currentPage.replace(/[^a-zA-Z0-9]/g, '_');
          sessionStorage.setItem(pageExitIntentKey, 'true');
          showPopup();
        }
      }
      
      // Alternative detection for mobile and edge cases
      function handleMouseOut(e) {
        // Only trigger if mouseleave hasn't worked
        if (exitIntentShown) return;
        
        const isExitingUp = e.clientY <= 5;
        const isLeavingDocument = (
          !e.relatedTarget || 
          e.relatedTarget.nodeName === 'HTML' ||
          e.target === document.documentElement
        );
        
        if (isExitingUp && isLeavingDocument && canShowExitIntentPopup()) {
          exitIntentShown = true;
          console.log('Foxx Newsletter: Exit intent detected via mouseout - showing popup');
          
          // Remove listeners
          document.removeEventListener('mouseleave', handleExitIntent);
          document.removeEventListener('mouseout', handleMouseOut);
          
          // Mark that exit intent was shown on this specific page
          const currentPage = window.location.pathname || '/';
          const pageExitIntentKey = STORAGE_KEY + '_exit_shown_' + currentPage.replace(/[^a-zA-Z0-9]/g, '_');
          sessionStorage.setItem(pageExitIntentKey, 'true');
          showPopup();
        }
      }
      
      // Add the event listeners
      document.addEventListener('mouseleave', handleExitIntent);
      document.addEventListener('mouseout', handleMouseOut);
    }
    
    // Track user interactions to ensure genuine engagement before showing exit intent
    function trackInteraction(eventType) {
      if (!hasInteracted) {
        hasInteracted = true;
        console.log('Foxx Newsletter: User interaction detected (' + eventType + ')');
        
        // Activate exit intent after user has interacted and a small delay
        setTimeout(activateExitIntent, 2000); // 2 second delay after first interaction
      }
    }
    
    // Set up interaction tracking
    document.addEventListener('click', () => trackInteraction('click'));
    document.addEventListener('scroll', () => trackInteraction('scroll'));
    document.addEventListener('keydown', () => trackInteraction('keydown'));
    document.addEventListener('mousemove', () => trackInteraction('mousemove'));
    
    // Also activate after a delay even without interaction (for exit-intent trigger mode)
    if (POPUP_CONFIG && POPUP_CONFIG.displayTrigger === 'exit-intent') {
      setTimeout(() => {
        if (!listenersActive) {
          console.log('Foxx Newsletter: Activating exit intent after delay (no interaction required for exit-intent trigger)');
          activateExitIntent();
        }
      }, 5000); // 5 seconds for exit-intent trigger mode
    }
  }
  
  // Initialize when DOM is ready with small delay
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        backgroundCleanupCheck(); // Check and clean up sessionStorage first
        loadConfig();
      }, 500);
    });
  } else {
    setTimeout(() => {
      backgroundCleanupCheck(); // Check and clean up sessionStorage first
      loadConfig();
    }, 500);
  }
})();`;
  }

  generateIntegrationFile(storeId?: string, shopifyUrl?: string, baseUrl?: string): string {
    const apiBase = baseUrl || 'http://localhost:5000';
    const storeDomain = shopifyUrl ? shopifyUrl.replace(/^https?:\/\//, '') : 'yourdomain.com';
    
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
