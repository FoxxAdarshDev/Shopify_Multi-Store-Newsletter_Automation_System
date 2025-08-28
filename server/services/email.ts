import nodemailer from 'nodemailer';
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
    return nodemailer.createTransporter({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.username,
        pass: config.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async sendWelcomeEmail(
    userId: string,
    subscriberEmail: string,
    subscriberName: string | null,
    discountCode: string,
    discountPercentage: number
  ): Promise<boolean> {
    try {
      const config = await this.getEmailConfig(userId);
      if (!config) {
        throw new Error('Email configuration not found');
      }

      const transporter = await this.createTransporter(config);

      const mailOptions = {
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: subscriberEmail,
        subject: `Welcome to ${config.fromName} - Your Exclusive ${discountPercentage}% Discount Code`,
        html: this.generateWelcomeEmailTemplate(
          subscriberName || 'Valued Customer',
          discountCode,
          discountPercentage,
          config.fromName
        ),
      };

      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      return false;
    }
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

  private generateWelcomeEmailTemplate(
    customerName: string,
    discountCode: string,
    discountPercentage: number,
    companyName: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${companyName}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
          <h1 style="color: #2563eb; margin-bottom: 20px;">Welcome to ${companyName}!</h1>
          
          <p style="font-size: 18px; margin-bottom: 30px;">
            Hello ${customerName},
          </p>
          
          <p style="margin-bottom: 30px;">
            Thank you for subscribing to our newsletter! As promised, here's your exclusive discount code:
          </p>
          
          <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <h2 style="margin: 0; font-size: 24px;">${discountCode}</h2>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Save ${discountPercentage}% on your next order!</p>
          </div>
          
          <p style="margin-bottom: 20px;">
            This discount code is valid for one-time use and can be applied at checkout.
          </p>
          
          <p style="margin-bottom: 30px;">
            Stay tuned for exclusive product launches, special promotions, and bioprocess insights & updates!
          </p>
          
          <div style="border-top: 1px solid #dee2e6; padding-top: 20px; margin-top: 30px;">
            <p style="font-size: 14px; color: #6c757d; margin: 0;">
              Best regards,<br>
              The ${companyName} Team
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateAdminNotificationTemplate(
    subscriberEmail: string,
    storeName: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Newsletter Subscription</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
          <h1 style="color: #2563eb; margin-bottom: 20px;">New Newsletter Subscription</h1>
          
          <p><strong>Store:</strong> ${storeName}</p>
          <p><strong>Email:</strong> ${subscriberEmail}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          
          <p style="margin-top: 30px;">
            A new subscriber has joined your newsletter mailing list.
          </p>
        </div>
      </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();
