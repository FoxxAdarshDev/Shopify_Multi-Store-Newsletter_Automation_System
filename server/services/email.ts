import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { storage } from '../storage';

export interface EmailConfig {
  host: string;
  port: number;
  fromEmail: string;
  fromName: string;
  username: string;
  password: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  async getEmailConfig(userId: string): Promise<EmailConfig | null> {
    const settings = await storage.getEmailSettings(userId);
    if (!settings || !settings.isConfigured) {
      return null;
    }

    return {
      host: settings.smtpHost,
      port: settings.smtpPort,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      username: settings.smtpUsername,
      password: settings.smtpPassword,
    };
  }

  async createTransporter(config: EmailConfig): Promise<nodemailer.Transporter> {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.username,
        pass: config.password,
      },
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3',
      },
      // Enhanced deliverability settings
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5,
    });
  }

  private extractFirstNameFromEmail(email: string): string {
    const prefix = email.split('@')[0];
    // Handle common separators and capitalize first letter
    const cleanName = prefix.replace(/[._-]/g, ' ')
                            .split(' ')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                            .join(' ');
    return cleanName || 'Valued Customer';
  }

  async sendWelcomeEmail(
    userId: string,
    subscriberEmail: string,
    subscriberName: string | null,
    discountCode: string,
    discountPercentage: number,
    storeId?: string
  ): Promise<boolean> {
    try {
      const config = await this.getEmailConfig(userId);
      if (!config) {
        throw new Error('Email configuration not found');
      }

      const transporter = await this.createTransporter(config);
      
      // Extract first name from email prefix if no name provided
      const firstName = subscriberName || this.extractFirstNameFromEmail(subscriberEmail);
      
      // Get email template or use default
      let template = await storage.getEmailTemplate(userId);
      if (!template) {
        // Create default template for user
        template = await storage.createEmailTemplate({
          userId,
          templateName: 'Welcome Email Template',
          subject: 'Thank You for Registering – Here\'s Your 15% Discount!',
          headerLogo: '/assets/foxx-logo.png',
          headerText: 'Foxx Bioprocess',
          bodyContent: `Dear [First Name],

Thank you for registering your email with Foxx Bioprocess. We're excited to have you as part of our community!

As a token of our appreciation, here's a 15% discount code you can use on your next purchase through our website:

[DISCOUNT_CODE]

Simply apply this code at checkout on www.foxxbioprocess.com to enjoy your savings.

We look forward to supporting your Single-Use Technology needs with the world's first and largest Bioprocess SUT library.

Happy shopping!
Warm regards,
Team Foxx Bioprocess`,
          footerText: '© 2024 Foxx Bioprocess. All rights reserved.',
          socialMediaLinks: {
            website: 'https://www.foxxbioprocess.com',
            linkedin: '',
            twitter: '',
            facebook: '',
            instagram: ''
          },
          primaryColor: '#0071b9',
          secondaryColor: '#00c68c',
          isActive: true
        });
      }
      
      // Create click tracking if storeId provided
      let trackingUrl = 'https://www.foxxbioprocess.com';
      console.log('sendWelcomeEmail: storeId provided:', storeId);
      if (storeId) {
        // Fetch store information to get the correct domain
        const store = await storage.getStore(storeId);
        if (!store) {
          console.error('sendWelcomeEmail: Store not found for ID:', storeId);
          // Use fallback URL if store not found
          trackingUrl = 'https://www.foxxbioprocess.com';
        } else {

        // Determine the correct store URL - prioritize customDomain, fallback to shopifyStoreName
        let storeUrl = 'https://www.foxxbioprocess.com'; // fallback
        if (store.customDomain) {
          storeUrl = store.customDomain.startsWith('http') ? store.customDomain : `https://${store.customDomain}`;
        } else if (store.shopifyStoreName) {
          storeUrl = `https://${store.shopifyStoreName}`;
        } else if (store.shopifyUrl) {
          storeUrl = store.shopifyUrl;
        }
        
        console.log('sendWelcomeEmail: Using store-specific URL:', storeUrl);

        // Generate store-specific tracking ID for better debugging and organization
        const randomId = crypto.randomBytes(12).toString('hex');
        const storePrefix = storeId.slice(0, 8); // First 8 chars of store ID
        const trackingId = `${storePrefix}_${Date.now()}_${randomId}`;
        console.log('sendWelcomeEmail: Creating store-specific tracking record with trackingId:', trackingId);
        
        try {
          await storage.createEmailClickTracking({
            subscriberEmail,
            storeId,
            trackingId,
            originalUrl: storeUrl, // Use the store-specific URL
            utmSource: 'newsletter',
            utmMedium: 'email',
            utmCampaign: 'welcome-discount',
            isClicked: false,
            clickCount: 0
          });
          
          // Get the current domain from environment or use Replit domain
          const baseUrl = process.env.API_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5000';
          trackingUrl = `${baseUrl}/track/${trackingId}`;
          console.log('sendWelcomeEmail: Generated tracking URL:', trackingUrl);
        } catch (error) {
          console.error('sendWelcomeEmail: Failed to create tracking record:', error);
          // Fallback to store-specific URL if tracking fails  
          trackingUrl = storeUrl;
        }
        }
      } else {
        console.log('sendWelcomeEmail: No storeId provided, using direct URL');
      }

      const mailOptions = {
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: subscriberEmail,
        subject: template.subject,
        html: this.generateCustomWelcomeEmailTemplate(
          firstName,
          discountCode,
          discountPercentage,
          template,
          trackingUrl
        ),
        // Improved deliverability headers (avoid spam triggers)
        headers: {
          'List-Unsubscribe': `<mailto:unsubscribe@foxxbioprocess.com?subject=unsubscribe>, <${trackingUrl}/unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'List-ID': `<newsletter.foxxbioprocess.com>`,
          'Message-ID': `<${Date.now()}-${Math.random().toString(36).substr(2, 9)}@foxxbioprocess.com>`,
          'Return-Path': config.fromEmail,
          'Reply-To': config.fromEmail,
          'Organization': 'Foxx Bioprocess',
          'X-Mailer': 'Foxx Newsletter System',
          'Content-Type': 'text/html; charset=utf-8',
          'MIME-Version': '1.0',
        },
      };

      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      return false;
    }
  }

  private generateCustomWelcomeEmailTemplate(
    firstName: string,
    discountCode: string,
    discountPercentage: number,
    template: any,
    trackingUrl: string
  ): string {
    const socialLinks = template.socialMediaLinks || {};
    
    // Convert relative logo URL to full URL for email
    const apiBaseUrl = process.env.API_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5000';
    let headerLogoUrl = template.headerLogo;
    if (headerLogoUrl && headerLogoUrl.startsWith('/')) {
      headerLogoUrl = `${apiBaseUrl}${headerLogoUrl}`;
    }
    
    // Replace placeholders in body content
    let bodyContent = template.bodyContent
      .replace(/\[First Name\]/g, firstName)
      .replace(/\[DISCOUNT_CODE\]/g, `<div style="background: ${template.primaryColor}; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; font-size: 24px; font-weight: bold;">${discountCode}</div>`);
      
    return `
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>${template.subject}</title>
        <style type="text/css">
          /* Email-safe CSS reset */
          body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
          table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
          img { -ms-interpolation-mode: bicubic; border: 0; }
          
          @media only screen and (max-width: 600px) {
            .container { width: 100% !important; padding: 10px !important; }
            .content { padding: 20px !important; }
          }
        </style>
      </head>
      <body style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div class="container" style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <!-- Header -->
          <div style="background: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; border-bottom: 3px solid ${template.primaryColor};">
            ${headerLogoUrl ? `<img src="${headerLogoUrl}" alt="${template.headerText}" style="max-height: 80px; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;">` : ''}
            <h1 style="color: ${template.primaryColor}; margin: 0; font-size: 28px;">${template.headerText}</h1>
          </div>
          
          <!-- Main Content -->
          <div class="content" style="background: white; padding: 40px; text-align: left;">
            ${bodyContent.split('\n').map((line: string) => `<p style="margin-bottom: 15px; font-size: 16px; line-height: 1.6;">${line}</p>`).join('')}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, ${template.primaryColor}, ${template.secondaryColor}); 
                 color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; 
                 font-weight: bold; font-size: 18px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                Visit Our Website
              </a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; text-align: center; border-top: 1px solid #e9ecef;">
            <!-- Social Media Links -->
            <div style="margin-bottom: 20px;">
              ${socialLinks.website ? `<a href="${socialLinks.website}" style="display: inline-block; margin: 0 10px; color: ${template.primaryColor}; text-decoration: none; font-weight: bold; vertical-align: middle;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 5px;">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                Website</a>` : ''}
              ${socialLinks.linkedin ? `<a href="${socialLinks.linkedin}" style="display: inline-block; margin: 0 10px; color: ${template.primaryColor}; text-decoration: none; font-weight: bold; vertical-align: middle;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 5px;">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                LinkedIn</a>` : ''}
              ${socialLinks.twitter ? `<a href="${socialLinks.twitter}" style="display: inline-block; margin: 0 10px; color: ${template.primaryColor}; text-decoration: none; font-weight: bold; vertical-align: middle;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 5px;">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
                Twitter</a>` : ''}
              ${socialLinks.facebook ? `<a href="${socialLinks.facebook}" style="display: inline-block; margin: 0 10px; color: ${template.primaryColor}; text-decoration: none; font-weight: bold; vertical-align: middle;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 5px;">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook</a>` : ''}
              ${socialLinks.instagram ? `<a href="${socialLinks.instagram}" style="display: inline-block; margin: 0 10px; color: ${template.primaryColor}; text-decoration: none; font-weight: bold; vertical-align: middle;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 5px;">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                Instagram</a>` : ''}
            </div>
            
            <!-- Company Address -->
            ${(template.companyAddress || template.companyCity || template.companyState || template.companyZipCode || template.companyCountry) ? `
              <div style="margin: 20px 0; padding: 15px; background: rgba(255,255,255,0.7); border-radius: 8px; color: #666; font-size: 13px; line-height: 1.4;">
                ${template.companyAddress ? `<div style="margin-bottom: 5px;">${template.companyAddress}</div>` : ''}
                ${(template.companyCity || template.companyState || template.companyZipCode) ? `<div style="margin-bottom: 5px;">
                  ${template.companyCity ? template.companyCity : ''}${template.companyCity && (template.companyState || template.companyZipCode) ? ', ' : ''}${template.companyState ? template.companyState : ''}${template.companyState && template.companyZipCode ? ' ' : ''}${template.companyZipCode ? template.companyZipCode : ''}
                </div>` : ''}
                ${template.companyCountry ? `<div>${template.companyCountry}</div>` : ''}
              </div>
            ` : ''}
            
            <p style="color: #666; font-size: 12px; margin: 10px 0;">${template.footerText}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generatePreviewEmail(templateForm: any, baseUrl?: string): string {
    // Sample data for preview
    const firstName = "John Smith";
    const discountCode = templateForm.discountCode || "WELCOME15";
    // Show preview tracking URL so users can see what the actual email looks like
    // Use API_BASE_URL or provided baseUrl for logo assets
    const apiBaseUrl = baseUrl || process.env.API_BASE_URL || 'http://localhost:5000';
    const trackingUrl = `${apiBaseUrl}/track/preview-tracking-id-example`;
    
    
    // Convert relative logo URL to full URL for preview
    const updatedTemplate = { ...templateForm };
    if (updatedTemplate.headerLogo && updatedTemplate.headerLogo.startsWith('/')) {
      // If it's a relative path (starts with /), prepend the domain
      updatedTemplate.headerLogo = `${apiBaseUrl}${updatedTemplate.headerLogo}`;
    }
    
    return this.generateCustomWelcomeEmailTemplate(
      firstName,
      discountCode,
      templateForm.discountPercentage || 15,
      updatedTemplate,
      trackingUrl
    );
  }

  async sendAdminNotification(
    userId: string,
    subscriberEmail: string,
    storeName: string
  ): Promise<boolean> {
    try {
      const config = await this.getEmailConfig(userId);
      if (!config) {
        return false;
      }

      const transporter = await this.createTransporter(config);

      const mailOptions = {
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: config.fromEmail,
        subject: `New Newsletter Subscription - ${storeName}`,
        html: this.generateAdminNotificationTemplate(subscriberEmail, storeName),
      };

      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Failed to send admin notification:', error);
      return false;
    }
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    isNewMember: boolean = false
  ): Promise<boolean> {
    try {
      // Use admin email settings for system emails
      const adminUser = await storage.getUserByEmail('updates@foxxbioprocess.com');
      if (!adminUser) {
        throw new Error('Admin user not found');
      }

      const config = await this.getEmailConfig(adminUser.id);
      if (!config) {
        throw new Error('Email configuration not found');
      }

      const transporter = await this.createTransporter(config);
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;

      const mailOptions = {
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: email,
        subject: isNewMember ? 'Welcome - Set Your Password' : 'Password Reset Request',
        html: this.generatePasswordResetTemplate(email, resetUrl, isNewMember),
      };

      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      return false;
    }
  }

  private generateAdminNotificationTemplate(subscriberEmail: string, storeName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Newsletter Subscription</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
          <h1 style="color: #2563eb; margin-bottom: 20px;">New Newsletter Subscription</h1>
          
          <p style="font-size: 18px; margin-bottom: 20px;">
            You have a new newsletter subscriber for <strong>${storeName}</strong>:
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
            <p style="margin: 0; font-size: 16px;">
              <strong>Email:</strong> ${subscriberEmail}
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            This is an automated notification from your newsletter management system.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  private generatePasswordResetTemplate(email: string, resetUrl: string, isNewMember: boolean): string {
    const title = isNewMember ? 'Welcome - Set Your Password' : 'Password Reset Request';
    const message = isNewMember 
      ? 'Welcome! Please click the button below to set your password and access your account.'
      : 'You requested a password reset. Click the button below to reset your password.';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
          <h1 style="color: #2563eb; margin-bottom: 20px;">${title}</h1>
          
          <p style="font-size: 16px; margin-bottom: 30px;">
            Hello,
          </p>
          
          <p style="margin-bottom: 30px;">
            ${message}
          </p>
          
          <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0;">
            ${isNewMember ? 'Set Password' : 'Reset Password'}
          </a>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            If you didn't request this, please ignore this email. The link will expire in 1 hour.
          </p>
          
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <span style="word-break: break-all;">${resetUrl}</span>
          </p>
        </div>
      </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();