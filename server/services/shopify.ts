export interface ShopifyConfig {
  shopUrl: string;
  accessToken: string;
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  orders_count: number;
  total_spent: string;
}

export interface ShopifyDiscountCode {
  id: number;
  code: string;
  value: string;
  usage_count: number;
  usage_limit: number | null;
}

import { decrypt } from "../utils/encryption.js";

export class ShopifyService {
  private makeRequest = async (config: ShopifyConfig, endpoint: string, options: RequestInit = {}) => {
    // Normalize shop URL - remove protocol if present and add .myshopify.com if needed
    let shopUrl = config.shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // If it doesn't contain a dot and doesn't end with .myshopify.com, add .myshopify.com
    if (!shopUrl.includes('.') || (!shopUrl.endsWith('.myshopify.com') && !shopUrl.includes('.com'))) {
      shopUrl = `${shopUrl}.myshopify.com`;
    }
    
    const url = `https://${shopUrl}/admin/api/2023-10/${endpoint}`;
    
    // Debug: check for Unicode characters in the access token
    console.log('Access token length:', config.accessToken.length);
    console.log('Access token has non-ASCII:', /[^\x00-\x7F]/.test(config.accessToken));
    if (/[^\x00-\x7F]/.test(config.accessToken)) {
      console.log('Non-ASCII character found at:', config.accessToken.search(/[^\x00-\x7F]/));
      console.log('Character code:', config.accessToken.charCodeAt(config.accessToken.search(/[^\x00-\x7F]/)));
    }
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'X-Shopify-Access-Token': config.accessToken,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  };

  // Helper to decrypt access token before making API calls
  private decryptConfig(config: ShopifyConfig): ShopifyConfig {
    const decryptedToken = decrypt(config.accessToken);
    // Sanitize the decrypted token to remove any Unicode characters that might cause ByteString errors
    const sanitizedToken = decryptedToken.replace(/[^\x00-\x7F]/g, '').trim();
    return {
      ...config,
      accessToken: sanitizedToken
    };
  }

  async verifyConnection(config: ShopifyConfig): Promise<boolean> {
    try {
      const decryptedConfig = this.decryptConfig(config);
      await this.makeRequest(decryptedConfig, 'shop.json');
      return true;
    } catch (error) {
      console.error('Shopify connection verification failed:', error);
      return false;
    }
  }

  async getCustomerByEmail(config: ShopifyConfig, email: string): Promise<ShopifyCustomer | null> {
    try {
      const decryptedConfig = this.decryptConfig(config);
      const response = await this.makeRequest(decryptedConfig, `customers/search.json?query=email:${encodeURIComponent(email)}`);
      
      if (response.customers && response.customers.length > 0) {
        return response.customers[0];
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get customer by email:', error);
      return null;
    }
  }

  async getDiscountCodeUsage(config: ShopifyConfig, discountCode: string): Promise<ShopifyDiscountCode | null> {
    try {
      // Get all discount codes and find the matching one
      const decryptedConfig = this.decryptConfig(config);
      const response = await this.makeRequest(decryptedConfig, 'discount_codes.json');
      
      if (response.discount_codes) {
        const matchingCode = response.discount_codes.find(
          (dc: ShopifyDiscountCode) => dc.code.toLowerCase() === discountCode.toLowerCase()
        );
        return matchingCode || null;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get discount code usage:', error);
      return null;
    }
  }

  async checkCustomerDiscountUsage(
    config: ShopifyConfig, 
    customerEmail: string, 
    discountCode: string
  ): Promise<boolean> {
    try {
      const customer = await this.getCustomerByEmail(config, customerEmail);
      if (!customer) {
        return false;
      }

      // Get customer's orders and check if any used the discount code
      const decryptedConfig = this.decryptConfig(config);
      const ordersResponse = await this.makeRequest(decryptedConfig, `customers/${customer.id}/orders.json`);
      
      if (ordersResponse.orders) {
        return ordersResponse.orders.some((order: any) => {
          // Check discount_codes (customer-entered codes)
          const foundInDiscountCodes = order.discount_codes && 
            order.discount_codes.some((dc: any) => 
              dc.code.toLowerCase() === discountCode.toLowerCase()
            );

          // Check discount_applications (all types of discounts)
          const foundInDiscountApplications = order.discount_applications && 
            order.discount_applications.some((da: any) => {
              // For discount_code type applications, check if the title or code matches
              if (da.type === 'discount_code') {
                return da.title && da.title.toLowerCase().includes(discountCode.toLowerCase());
              }
              // For other types (automatic, manual, script), check title
              return da.title && da.title.toLowerCase().includes(discountCode.toLowerCase());
            });

          return foundInDiscountCodes || foundInDiscountApplications;
        });
      }
      
      return false;
    } catch (error) {
      console.error('Failed to check customer discount usage:', error);
      return false;
    }
  }

  async syncSubscriberCouponUsage(
    config: ShopifyConfig,
    subscriberEmail: string,
    discountCode: string
  ): Promise<{ hasUsedCoupon: boolean; orderInfo?: any }> {
    try {
      const customer = await this.getCustomerByEmail(config, subscriberEmail);
      if (!customer) {
        return { hasUsedCoupon: false };
      }

      // Get customer's orders and find the specific order where discount was used
      const decryptedConfig = this.decryptConfig(config);
      const ordersResponse = await this.makeRequest(decryptedConfig, `customers/${customer.id}/orders.json`);
      
      if (ordersResponse.orders) {
        console.log(`   📦 Found ${ordersResponse.orders.length} orders for customer`);
        
        // Check both discount_codes and discount_applications fields
        const orderWithDiscount = ordersResponse.orders.find((order: any, index: number) => {
          console.log(`\n   📋 ORDER ${index + 1}:`);
          console.log(`      Order ID: ${order.id}`);
          console.log(`      Order Number: ${order.order_number}`);
          console.log(`      Date: ${order.created_at}`);
          console.log(`      Total: $${order.total_price}`);
          
          // Log discount codes
          console.log(`      Discount Codes:`, JSON.stringify(order.discount_codes, null, 6));
          
          // Log discount applications
          console.log(`      Discount Applications:`, JSON.stringify(order.discount_applications, null, 6));
          
          // Check discount_codes (customer-entered codes)
          const foundInDiscountCodes = order.discount_codes && 
            order.discount_codes.some((dc: any) => {
              const match = dc.code.toLowerCase() === discountCode.toLowerCase();
              console.log(`         Checking discount code "${dc.code}" vs "${discountCode}": ${match ? '✅ MATCH' : '❌ no match'}`);
              return match;
            });

          // Check discount_applications (all types of discounts)
          const foundInDiscountApplications = order.discount_applications && 
            order.discount_applications.some((da: any) => {
              console.log(`         Checking discount application: type="${da.type}", title="${da.title}"`);
              // For discount_code type applications, check if the title or code matches
              if (da.type === 'discount_code') {
                const match = da.title && da.title.toLowerCase().includes(discountCode.toLowerCase());
                console.log(`            Discount code type check: "${da.title}" contains "${discountCode}": ${match ? '✅ MATCH' : '❌ no match'}`);
                return match;
              }
              // For other types (automatic, manual, script), check title
              const match = da.title && da.title.toLowerCase().includes(discountCode.toLowerCase());
              console.log(`            General discount check: "${da.title}" contains "${discountCode}": ${match ? '✅ MATCH' : '❌ no match'}`);
              return match;
            });

          const overallMatch = foundInDiscountCodes || foundInDiscountApplications;
          console.log(`      🎯 Overall match for order: ${overallMatch ? '✅ YES' : '❌ NO'}`);
          
          return overallMatch;
        });

        if (orderWithDiscount) {
          console.log(`   🎉 COUPON USAGE FOUND! Order ${orderWithDiscount.order_number} used the discount code.`);
          return {
            hasUsedCoupon: true,
            orderInfo: {
              orderId: orderWithDiscount.id,
              orderNumber: orderWithDiscount.order_number,
              totalPrice: orderWithDiscount.total_price,
              createdAt: orderWithDiscount.created_at,
              discountCodes: orderWithDiscount.discount_codes,
              discountApplications: orderWithDiscount.discount_applications
            }
          };
        } else {
          console.log(`   ❌ No orders found with discount code "${discountCode}"`);
        }
      } else {
        console.log(`   ❌ No orders response received from Shopify`);
      }
      
      return { hasUsedCoupon: false };
    } catch (error) {
      console.error('Failed to sync subscriber coupon usage:', error);
      return { hasUsedCoupon: false };
    }
  }

  async verifyDiscountCode(
    shopUrl: string,
    accessToken: string,
    discountCode: string
  ): Promise<boolean> {
    try {
      const config = { shopUrl, accessToken };
      const result = await this.getDiscountCodeUsage(config, discountCode);
      return result !== null;
    } catch (error) {
      console.error('Failed to verify discount code:', error);
      return false;
    }
  }

  async createDiscountCode(
    config: ShopifyConfig,
    codeName: string,
    percentage: number,
    usageLimit?: number
  ): Promise<ShopifyDiscountCode | null> {
    try {
      const discountData = {
        discount_code: {
          code: codeName,
          amount: percentage.toString(),
          type: 'percentage',
          usage_limit: usageLimit || null,
          applies_to_id: null,
          minimum_order_amount: null,
        }
      };

      const decryptedConfig = this.decryptConfig(config);
      const response = await this.makeRequest(decryptedConfig, 'discount_codes.json', {
        method: 'POST',
        body: JSON.stringify(discountData),
      });

      return response.discount_code || null;
    } catch (error) {
      console.error('Failed to create discount code:', error);
      return null;
    }
  }

  async tagNewsletterSubscriber(
    config: ShopifyConfig,
    email: string,
    subscriberData: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      company?: string;
    } = {}
  ): Promise<{ success: boolean; customerId?: number; message?: string }> {
    try {
      const decryptedConfig = this.decryptConfig(config);
      
      // First, check if customer already exists
      let customer = await this.getCustomerByEmail(config, email);
      
      if (customer) {
        // Customer exists, update their tags
        console.log(`Found existing customer: ${customer.email} (ID: ${customer.id})`);
        
        // Get current customer data to preserve existing tags
        const customerResponse = await this.makeRequest(decryptedConfig, `customers/${customer.id}.json`);
        const existingTags = customerResponse.customer.tags || '';
        
        // Add newsletter subscriber tag if not already present
        const tagsArray = existingTags ? existingTags.split(',').map((tag: string) => tag.trim()) : [];
        if (!tagsArray.includes('newsletter-subscriber')) {
          tagsArray.push('newsletter-subscriber');
        }
        
        // Update customer with newsletter tag
        const updateData = {
          customer: {
            id: customer.id,
            tags: tagsArray.join(', '),
            // Update any additional data if provided
            ...(subscriberData.firstName && { first_name: subscriberData.firstName }),
            ...(subscriberData.lastName && { last_name: subscriberData.lastName }),
            ...(subscriberData.phone && { phone: subscriberData.phone }),
            ...(subscriberData.company && { 
              note: `Company: ${subscriberData.company}${customerResponse.customer.note ? '\n' + customerResponse.customer.note : ''}` 
            })
          }
        };

        await this.makeRequest(decryptedConfig, `customers/${customer.id}.json`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });

        console.log(`✅ Tagged existing customer ${email} as newsletter-subscriber`);
        return { 
          success: true, 
          customerId: customer.id, 
          message: 'Existing customer tagged as newsletter subscriber' 
        };
        
      } else {
        // Customer doesn't exist, create new customer with newsletter tag
        console.log(`Creating new customer: ${email}`);
        
        const customerData = {
          customer: {
            email: email,
            first_name: subscriberData.firstName || '',
            last_name: subscriberData.lastName || '',
            phone: subscriberData.phone || '',
            tags: 'newsletter-subscriber',
            note: subscriberData.company ? `Company: ${subscriberData.company}` : '',
            verified_email: true,
            send_email_welcome: false // Don't send Shopify welcome email
          }
        };

        const response = await this.makeRequest(decryptedConfig, 'customers.json', {
          method: 'POST',
          body: JSON.stringify(customerData),
        });

        console.log(`✅ Created new customer ${email} with newsletter-subscriber tag`);
        return { 
          success: true, 
          customerId: response.customer.id, 
          message: 'New customer created and tagged as newsletter subscriber' 
        };
      }
    } catch (error) {
      console.error('Failed to tag newsletter subscriber:', error);
      return { 
        success: false, 
        message: `Failed to tag customer: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  async removeNewsletterSubscriberTag(
    config: ShopifyConfig,
    email: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const customer = await this.getCustomerByEmail(config, email);
      if (!customer) {
        return { success: false, message: 'Customer not found' };
      }

      const decryptedConfig = this.decryptConfig(config);
      
      // Get current customer data
      const customerResponse = await this.makeRequest(decryptedConfig, `customers/${customer.id}.json`);
      const existingTags = customerResponse.customer.tags || '';
      
      // Remove newsletter subscriber tag
      const tagsArray = existingTags ? existingTags.split(',').map((tag: string) => tag.trim()) : [];
      const updatedTags = tagsArray.filter((tag: string) => tag !== 'newsletter-subscriber');
      
      // Update customer
      const updateData = {
        customer: {
          id: customer.id,
          tags: updatedTags.join(', ')
        }
      };

      await this.makeRequest(decryptedConfig, `customers/${customer.id}.json`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      console.log(`✅ Removed newsletter-subscriber tag from ${email}`);
      return { success: true, message: 'Newsletter subscriber tag removed' };
      
    } catch (error) {
      console.error('Failed to remove newsletter subscriber tag:', error);
      return { 
        success: false, 
        message: `Failed to remove tag: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}

export const shopifyService = new ShopifyService();
