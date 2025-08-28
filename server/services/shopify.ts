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

export class ShopifyService {
  private makeRequest = async (config: ShopifyConfig, endpoint: string, options: RequestInit = {}) => {
    const url = `https://${config.shopUrl}/admin/api/2023-10/${endpoint}`;
    
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

  async verifyConnection(config: ShopifyConfig): Promise<boolean> {
    try {
      await this.makeRequest(config, 'shop.json');
      return true;
    } catch (error) {
      console.error('Shopify connection verification failed:', error);
      return false;
    }
  }

  async getCustomerByEmail(config: ShopifyConfig, email: string): Promise<ShopifyCustomer | null> {
    try {
      const response = await this.makeRequest(config, `customers/search.json?query=email:${encodeURIComponent(email)}`);
      
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
      const response = await this.makeRequest(config, 'discount_codes.json');
      
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
      const ordersResponse = await this.makeRequest(config, `customers/${customer.id}/orders.json`);
      
      if (ordersResponse.orders) {
        return ordersResponse.orders.some((order: any) => 
          order.discount_codes && 
          order.discount_codes.some((dc: any) => 
            dc.code.toLowerCase() === discountCode.toLowerCase()
          )
        );
      }
      
      return false;
    } catch (error) {
      console.error('Failed to check customer discount usage:', error);
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

      const response = await this.makeRequest(config, 'discount_codes.json', {
        method: 'POST',
        body: JSON.stringify(discountData),
      });

      return response.discount_code || null;
    } catch (error) {
      console.error('Failed to create discount code:', error);
      return null;
    }
  }
}

export const shopifyService = new ShopifyService();
