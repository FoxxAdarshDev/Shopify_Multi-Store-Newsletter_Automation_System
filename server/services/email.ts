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
      <html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <o:OfficeDocumentSettings>
            <o:AllowPNG/>
            <o:PixelsPerInch>96</o:PixelsPerInch>
          </o:OfficeDocumentSettings>
        </xml>
        <![endif]-->
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
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" 
                           href="${trackingUrl}" style="height:50px;v-text-anchor:middle;width:200px;" 
                           arcsize="50%" strokecolor="${template.primaryColor}" fillcolor="${template.primaryColor}">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:18px;font-weight:bold;">Visit Our Website</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${trackingUrl}" 
                 style="display: inline-block; background: ${template.primaryColor}; 
                 color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; 
                 font-weight: bold; font-size: 18px; border: 2px solid ${template.primaryColor};">
                Visit Our Website
              </a>
              <!--<![endif]-->
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; text-align: center; border-top: 1px solid #e9ecef;">
            <!-- Social Media Links -->
            <div style="margin-bottom: 20px;">
              <!--[if mso]>
              <table border="0" cellspacing="0" cellpadding="0" align="center">
                <tr>
              <![endif]-->
              ${socialLinks.website ? `
              <!--[if mso]>
                <td align="center" style="padding: 5px;">
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${socialLinks.website}" 
                               style="height:30px;v-text-anchor:middle;width:90px;" arcsize="67%" 
                               fillcolor="${template.primaryColor}" strokecolor="${template.primaryColor}">
                    <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">Website</center>
                  </v:roundrect>
                </td>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${socialLinks.website}" style="display: inline-block; margin: 5px 15px; background: ${template.primaryColor}; color: white; padding: 8px 16px; text-decoration: none; border-radius: 20px; font-size: 14px; font-weight: bold;">
                🌐 Website</a>
              <!--<![endif]-->` : ''}
              ${socialLinks.linkedin ? `
              <!--[if mso]>
                <td align="center" style="padding: 5px;">
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${socialLinks.linkedin}" 
                               style="height:30px;v-text-anchor:middle;width:90px;" arcsize="67%" 
                               fillcolor="#0077B5" strokecolor="#0077B5">
                    <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">LinkedIn</center>
                  </v:roundrect>
                </td>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${socialLinks.linkedin}" style="display: inline-block; margin: 5px 15px; background: #0077B5; color: white; padding: 8px 16px; text-decoration: none; border-radius: 20px; font-size: 14px; font-weight: bold;">
                💼 LinkedIn</a>
              <!--<![endif]-->` : ''}
              ${socialLinks.twitter ? `
              <!--[if mso]>
                <td align="center" style="padding: 5px;">
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${socialLinks.twitter}" 
                               style="height:30px;v-text-anchor:middle;width:90px;" arcsize="67%" 
                               fillcolor="#1DA1F2" strokecolor="#1DA1F2">
                    <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">Twitter</center>
                  </v:roundrect>
                </td>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${socialLinks.twitter}" style="display: inline-block; margin: 5px 15px; background: #1DA1F2; color: white; padding: 8px 16px; text-decoration: none; border-radius: 20px; font-size: 14px; font-weight: bold;">
                🐦 Twitter</a>
              <!--<![endif]-->` : ''}
              ${socialLinks.facebook ? `
              <!--[if mso]>
                <td align="center" style="padding: 5px;">
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${socialLinks.facebook}" 
                               style="height:30px;v-text-anchor:middle;width:90px;" arcsize="67%" 
                               fillcolor="#1877F2" strokecolor="#1877F2">
                    <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">Facebook</center>
                  </v:roundrect>
                </td>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${socialLinks.facebook}" style="display: inline-block; margin: 5px 15px; background: #1877F2; color: white; padding: 8px 16px; text-decoration: none; border-radius: 20px; font-size: 14px; font-weight: bold;">
                📘 Facebook</a>
              <!--<![endif]-->` : ''}
              ${socialLinks.instagram ? `
              <!--[if mso]>
                <td align="center" style="padding: 5px;">
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${socialLinks.instagram}" 
                               style="height:30px;v-text-anchor:middle;width:90px;" arcsize="67%" 
                               fillcolor="#E4405F" strokecolor="#E4405F">
                    <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">Instagram</center>
                  </v:roundrect>
                </td>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${socialLinks.instagram}" style="display: inline-block; margin: 5px 15px; background: #E4405F; color: white; padding: 8px 16px; text-decoration: none; border-radius: 20px; font-size: 14px; font-weight: bold;">
                📷 Instagram</a>
              <!--<![endif]-->` : ''}
              <!--[if mso]>
                </tr>
              </table>
              <![endif]-->
            </div>
            
            <!-- Company Address -->
            ${template.companyAddress ? `
              <div style="margin: 20px 0; padding: 15px; background: rgba(255,255,255,0.7); border-radius: 8px; color: #666; font-size: 13px; line-height: 1.4;">
                <div>${template.companyAddress}</div>
              </div>
            ` : ''}
            
            <p style="color: #666; font-size: 12px; margin: 10px 0;">${template.footerText}</p>
            ${template.footerNote ? `<p style="color: #666; font-size: 12px; margin: 15px 0 5px 0; font-style: italic; border-top: 1px solid #eee; padding-top: 15px;">${template.footerNote}</p>` : ''}
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