import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { getOrderSlug } from '../common/utils/slug.util';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    const rawPass = this.config.get<string>('MAIL_PASS', '');
    const cleanPass = rawPass ? rawPass.replace(/\s+/g, '') : '';

    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('MAIL_HOST', 'smtp.gmail.com'),
      port: this.config.get<number>('MAIL_PORT', 587),
      secure: false,
      auth: {
        user: this.config.get<string>('MAIL_USER'),
        pass: cleanPass,
      },
      tls: { rejectUnauthorized: false },
    });
  }

  private fromAddress(): string {
    const name = this.config.get<string>('MAIL_FROM_NAME', 'Zelton');
    const addr = this.config.get<string>('MAIL_FROM_ADDRESS');
    return `"${name}" <${addr}>`;
  }

  async sendOtp(to: string, name: string, otp: string): Promise<void> {
    const subject = 'Verify Your Email - OTP Code';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; letter-spacing: 1px; }
          .body { padding: 40px 30px; }
          .otp-box { background: #f8f9ff; border: 2px dashed #6366f1; border-radius: 8px; text-align: center; padding: 24px; margin: 24px 0; }
          .otp-code { font-size: 42px; font-weight: bold; letter-spacing: 12px; color: #6366f1; }
          .note { color: #666; font-size: 14px; margin-top: 8px; }
          .footer { background: #f8f9ff; padding: 20px 30px; text-align: center; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✉️ Zelton</h1>
          </div>
          <div class="body">
            <h2>Hello, ${name}!</h2>
            <p>Thank you for registering with Zelton. Please use the OTP below to verify your email address:</p>
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
              <div class="note">This OTP expires in <strong>10 minutes</strong></div>
            </div>
            <p>If you didn't create an account, please ignore this email.</p>
          </div>
          <div class="footer">© 2026 Zelton. All rights reserved.</div>
        </div>
      </body>
      </html>
    `;
    await this.send(to, subject, html);
  }

  async sendPasswordReset(to: string, code: string): Promise<void> {
    const subject = 'Password Reset Code - Zelton';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .body { padding: 40px 30px; }
          .code-box { background: #fff5f5; border: 2px dashed #ef4444; border-radius: 8px; text-align: center; padding: 24px; margin: 24px 0; }
          .reset-code { font-size: 42px; font-weight: bold; letter-spacing: 12px; color: #ef4444; }
          .note { color: #666; font-size: 14px; margin-top: 8px; }
          .footer { background: #fff5f5; padding: 20px 30px; text-align: center; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>🔐 Zelton</h1></div>
          <div class="body">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password. Use the code below:</p>
            <div class="code-box">
              <div class="reset-code">${code}</div>
              <div class="note">This code expires in <strong>15 minutes</strong></div>
            </div>
            <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
          </div>
          <div class="footer">© 2026 Zelton. All rights reserved.</div>
        </div>
      </body>
      </html>
    `;
    await this.send(to, subject, html);
  }

  async sendDeliveryConfirmation(
    to: string,
    order: any,
    confirmationUrl: string,
  ): Promise<void> {
    const subject = `Confirm Your Order Delivery - Order #${order.orderNumber}`;
    const itemsHtml = (order.orderItems || [])
      .map(
        (item: any) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product?.name ?? 'Product'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${item.total}</td>
        </tr>`,
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .body { padding: 40px 30px; }
          .btn { display: inline-block; background-color: #10b981; color: #ffffff !important; text-decoration: none !important; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: bold; margin: 20px 0; }
          a.btn, a.btn:visited { color: #ffffff !important; text-decoration: none !important; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          th { background: #f0fdf4; padding: 10px 8px; text-align: left; font-size: 13px; color: #666; }
          .total { font-weight: bold; font-size: 18px; color: #10b981; }
          .footer { background: #f0fdf4; padding: 20px 30px; text-align: center; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📦 Order Delivered!</h1>
            <p>Order #${order.orderNumber}</p>
          </div>
          <div class="body">
            <h2>Your order has been delivered!</h2>
            <p>Please confirm that you have received your order by clicking the button below. This helps us complete your order.</p>
            <div style="text-align: center;">
              <a href="${confirmationUrl}" class="btn" style="display: inline-block; background-color: #10b981; color: #ffffff !important; text-decoration: none !important; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: bold; margin: 20px 0;">
                <span style="color: #ffffff !important; text-decoration: none !important;">✅ Confirm Delivery</span>
              </a>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th style="text-align:center;">Qty</th>
                  <th style="text-align:right;">Amount</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
              <tfoot>
                <tr>
                  <td colspan="2" style="padding: 12px 8px; font-weight: bold;">Total</td>
                  <td style="padding: 12px 8px; text-align: right;" class="total">₹${order.total}</td>
                </tr>
              </tfoot>
            </table>
            <p style="color:#666; font-size:13px;">If you did not receive your order, please do not confirm and contact our support team.</p>
            <p style="color:#999; font-size:12px;">Or copy this link: ${confirmationUrl}</p>
          </div>
          <div class="footer">© 2026 Zelton. All rights reserved.</div>
        </div>
      </body>
      </html>
    `;
    await this.send(to, subject, html);
  }

  // ─── 1. Order Placed Successfully (Pending Admin Confirmation) ───────────
  async sendOrderPlacedEmail(to: string, order: any): Promise<void> {
    const orderNum = order.orderNumber || order.order_number || `ORD-${order.id}`;
    const orderSlug = getOrderSlug(order) || orderNum;
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const orderUrl = `${frontendUrl}/orders/${orderSlug}`;
    const subject = `🎉 Order Placed Successfully - Order #${orderNum}`;

    const itemsList = order.orderItems || order.order_items || [];
    const itemsHtml = itemsList
      .map(
        (item: any) => `
        <tr>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0;">
            <strong style="color: #0f172a; font-size: 14px;">${item.product?.name ?? 'Product'}</strong>
            ${item.variant?.title ? `<br><small style="color: #64748b; font-size: 12px;">Variant: ${item.variant.title}</small>` : ''}
          </td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #334155;">${item.quantity}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #0f172a;">₹${item.total}</td>
        </tr>`,
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
          .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 36px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
          .header p { margin: 8px 0 0 0; font-size: 13px; color: #94a3b8; line-height: 1.5; }
          .body { padding: 32px 28px; }
          .badge { display: inline-block; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; border: 1px solid #fde68a; }
          .details-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0; }
          .details-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px dashed #e2e8f0; }
          .details-row:last-child { border-bottom: none; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #f1f5f9; padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; font-weight: 700; letter-spacing: 0.5px; }
          .notice-box { background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin-top: 24px; font-size: 13px; color: #92400e; line-height: 1.6; }
          .footer { background: #f8fafc; padding: 22px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Order Placed Successfully</h1>
            <p>We have received your order request for Order #${orderNum}</p>
          </div>
          <div class="body">
            <div class="badge">⏳ Pending Confirmation</div>
            <h2 style="margin: 0 0 10px 0; font-size: 20px; color: #0f172a; font-weight: 800;">Thank You for Your Order!</h2>
            <p style="font-size: 14px; color: #475569; margin: 0 0 20px 0; line-height: 1.5;">
              We have received your order. Our warehouse team is currently reviewing your order details. Your order will remain in a <strong>Pending Confirmation</strong> state until accepted by our team.
            </p>

            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Payment Method:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a; font-size: 13px;">
                  ${order.paymentMethod === 'cash_on_delivery' || order.payment_method === 'cash_on_delivery' || order.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'Online Payment (Prepaid)'}
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Payment Status:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a; font-size: 13px;">
                  ${order.paymentStatus === 'paid' ? '✅ Paid' : '⏳ Pending'}
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Shipping Fee:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #16a34a; font-size: 13px;">FREE Express</td>
              </tr>
              <tr style="border-top: 1px solid #e2e8f0;">
                <td style="padding: 10px 0 0 0; font-weight: 800; font-size: 15px; color: #0f172a;">Total Amount:</td>
                <td style="padding: 10px 0 0 0; text-align: right; font-weight: 900; font-size: 18px; color: #0f172a;">₹${order.total}</td>
              </tr>
            </table>

            <h3 style="margin: 24px 0 10px 0; font-size: 15px; color: #0f172a; font-weight: 800;">Items Ordered</h3>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th style="text-align:center;">Qty</th>
                  <th style="text-align:right;">Amount</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>

            <div style="text-align: center; margin: 24px 0;">
              <a href="${orderUrl}" class="btn" style="display: inline-block; background-color: #0f172a; color: #ffffff !important; text-decoration: none !important; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 700; box-shadow: 0 2px 6px rgba(15,23,42,0.3);">
                <span style="color: #ffffff !important; text-decoration: none !important; font-weight: 700;">🛍️ View Order Details</span>
              </a>
            </div>

            <div class="notice-box">
              ℹ️ <strong>What happens next?</strong><br/>
              Our staff will verify stock availability and shipping route. You will receive an official <strong>“Your Order Has Been Confirmed”</strong> email with the downloadable Tax Invoice as soon as the order is accepted.
            </div>
          </div>
          <div class="footer">
            © 2026 Zelton Retail. All rights reserved. • High Performance Audio &amp; Gadgets
          </div>
        </div>
      </body>
      </html>
    `;

    await this.send(to, subject, html);
  }

  // ─── 2. Admin Confirms/Accepts the Order (With Invoice PDF) ───────────────
  async sendOrderConfirmedWithInvoice(
    to: string,
    order: any,
    pdfBuffer: Buffer,
  ): Promise<void> {
    const orderNum = order.orderNumber || order.order_number || `ORD-${order.id}`;
    const orderSlug = getOrderSlug(order) || orderNum;
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const orderTrackingUrl = `${frontendUrl}/orders/${orderSlug}/tracking`;
    const subject = `🛍️ Your Order Has Been Confirmed - Order #${orderNum}`;

    const itemsList = order.orderItems || order.order_items || [];
    const itemsHtml = itemsList
      .map(
        (item: any) => `
        <tr>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0;">
            <strong style="color: #0f172a; font-size: 14px;">${item.product?.name ?? 'Product'}</strong>
            ${item.variant?.title ? `<br><small style="color: #64748b; font-size: 12px;">Variant: ${item.variant.title}</small>` : ''}
          </td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #334155;">${item.quantity}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #0f172a;">₹${item.total}</td>
        </tr>`,
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
          .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 36px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
          .header p { margin: 8px 0 0 0; font-size: 13px; color: #94a3b8; }
          .body { padding: 32px 28px; }
          .badge { display: inline-block; background: #dcfce7; color: #166534; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; border: 1px solid #bbf7d0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #f1f5f9; padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; font-weight: 700; letter-spacing: 0.5px; }
          .total-row { font-weight: 800; font-size: 15px; color: #0f172a; }
          .invoice-box { background: #eff6ff; border: 1px solid #dbeafe; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 8px; margin-top: 24px; font-size: 13px; color: #1e40af; line-height: 1.6; }
          .footer { background: #f8fafc; padding: 22px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛍️ Order Confirmed!</h1>
            <p>Your order #${orderNum} has been accepted and confirmed by Zelton</p>
          </div>
          <div class="body">
            <div class="badge">✅ Order Confirmed</div>
            <h2 style="margin: 0 0 10px 0; font-size: 20px; color: #0f172a; font-weight: 800;">Great News! Your Order is Confirmed</h2>
            <p style="font-size: 14px; color: #475569; margin: 0 0 20px 0; line-height: 1.5;">
              Our team has officially accepted your order. It is now being packed and prepared for express courier pickup with Delhivery logistics.
            </p>

            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Payment Method:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a; font-size: 13px;">
                  ${order.paymentMethod === 'cash_on_delivery' || order.payment_method === 'cash_on_delivery' || order.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'Online Payment (Prepaid)'}
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Delivery Service:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #16a34a; font-size: 13px;">Delhivery Express Logistics</td>
              </tr>
              <tr style="border-top: 1px solid #e2e8f0;">
                <td style="padding: 10px 0 0 0; font-weight: 800; font-size: 15px; color: #0f172a;">Grand Total:</td>
                <td style="padding: 10px 0 0 0; text-align: right; font-weight: 900; font-size: 18px; color: #0f172a;">₹${order.total}</td>
              </tr>
            </table>

            <h3 style="margin: 24px 0 10px 0; font-size: 15px; color: #0f172a; font-weight: 800;">Confirmed Items</h3>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th style="text-align:center;">Qty</th>
                  <th style="text-align:right;">Amount</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>

            <div style="text-align: center; margin: 24px 0;">
              <a href="${orderTrackingUrl}" class="btn" style="display: inline-block; background-color: #10b981; color: #ffffff !important; text-decoration: none !important; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 700; box-shadow: 0 2px 6px rgba(16,185,129,0.3);">
                <span style="color: #ffffff !important; text-decoration: none !important; font-weight: 700;">📍 Track &amp; View Order</span>
              </a>
            </div>

            <div class="invoice-box">
              📄 <strong>Official Tax Invoice Attached:</strong><br/>
              We have attached the official Tax Invoice PDF (<code>Tax_Invoice_${orderNum}.pdf</code>) for Order #${orderNum} to this email for your accounting and warranty records.
            </div>
          </div>
          <div class="footer">
            © 2026 Zelton Retail. All rights reserved. • Need assistance? Contact support@zelton.co.in
          </div>
        </div>
      </body>
      </html>
    `;

    const attachments = [
      {
        filename: `Tax_Invoice_${orderNum}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ];

    await this.send(to, subject, html, attachments);
  }

  // ─── 3. Admin Cancels/Rejects a Pending Order ─────────────────────────────
  async sendPendingOrderCancelledEmail(to: string, order: any, reason?: string): Promise<void> {
    const orderNum = order.orderNumber || order.order_number || `ORD-${order.id}`;
    const subject = `❌ Your Order Has Been Cancelled - Order #${orderNum}`;

    const itemsList = order.orderItems || order.order_items || [];
    const itemsHtml = itemsList
      .map(
        (item: any) => `
        <tr>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0;">
            <strong style="color: #0f172a; font-size: 13px;">${item.product?.name ?? 'Product'}</strong>
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #475569;">${item.quantity}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #0f172a;">₹${item.total}</td>
        </tr>`,
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
          .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%); color: white; padding: 36px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; }
          .header p { margin: 8px 0 0 0; font-size: 13px; color: #fecaca; }
          .body { padding: 32px 28px; }
          .badge { display: inline-block; background: #fee2e2; color: #991b1b; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; border: 1px solid #fecaca; }
          .reason-box { background: #fff1f2; border: 1px solid #fecdd3; border-left: 4px solid #e11d48; padding: 14px 16px; border-radius: 8px; margin: 18px 0; font-size: 13px; color: #9f1239; line-height: 1.5; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          th { background: #f1f5f9; padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; }
          .refund-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; padding: 14px 16px; border-radius: 8px; margin-top: 20px; font-size: 13px; color: #166534; line-height: 1.5; }
          .footer { background: #f8fafc; padding: 22px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Order Cancelled</h1>
            <p>Notice regarding Order #${orderNum}</p>
          </div>
          <div class="body">
            <div class="badge">Order Cancelled</div>
            <h2 style="margin: 0 0 10px 0; font-size: 19px; color: #0f172a; font-weight: 800;">Your Order Has Been Cancelled</h2>
            <p style="font-size: 14px; color: #475569; margin: 0 0 16px 0; line-height: 1.5;">
              We regret to inform you that your pending order <strong>#${orderNum}</strong> has been cancelled by our store before confirmation.
            </p>

            ${reason ? `
            <div class="reason-box">
              <strong>Cancellation Reason:</strong> ${reason}
            </div>` : ''}

            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Order Amount:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 800; color: #0f172a; font-size: 14px;">₹${order.total}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Payment Method:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #0f172a; font-size: 13px;">
                  ${order.paymentMethod === 'cash_on_delivery' || order.payment_method === 'cash_on_delivery' || order.paymentMethod === 'cod' ? 'Cash on Delivery (No charges incurred)' : 'Online Payment (Prepaid)'}
                </td>
              </tr>
            </table>

            <h4 style="margin: 20px 0 8px 0; font-size: 13px; color: #0f172a;">Cancelled Order Summary</h4>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th style="text-align:center;">Qty</th>
                  <th style="text-align:right;">Amount</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>

            ${order.paymentStatus === 'paid' ? `
            <div class="refund-box">
              💳 <strong>Refund Details:</strong> Since your payment was received, a full refund of <strong>₹${order.total}</strong> has been initiated and will be credited back to your original payment method within 3–5 business days.
            </div>` : ''}
          </div>
          <div class="footer">
            © 2026 Zelton Retail. All rights reserved. • Questions? Contact support@zelton.co.in
          </div>
        </div>
      </body>
      </html>
    `;

    await this.send(to, subject, html);
  }

  // ─── 4. Admin Cancels a Previously Confirmed Order ────────────────────────
  async sendConfirmedOrderCancelledEmail(to: string, order: any, reason?: string): Promise<void> {
    const orderNum = order.orderNumber || order.order_number || `ORD-${order.id}`;
    const subject = `⚠️ Your Confirmed Order Has Been Cancelled - Order #${orderNum}`;

    const itemsList = order.orderItems || order.order_items || [];
    const itemsHtml = itemsList
      .map(
        (item: any) => `
        <tr>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0;">
            <strong style="color: #0f172a; font-size: 13px;">${item.product?.name ?? 'Product'}</strong>
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #475569;">${item.quantity}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #0f172a;">₹${item.total}</td>
        </tr>`,
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
          .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #7c2d12 0%, #9a3412 100%); color: white; padding: 36px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; }
          .header p { margin: 8px 0 0 0; font-size: 13px; color: #fed7aa; }
          .body { padding: 32px 28px; }
          .badge { display: inline-block; background: #ffedd5; color: #9a3412; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; border: 1px solid #fed7aa; }
          .reason-box { background: #fff7ed; border: 1px solid #ffedd5; border-left: 4px solid #ea580c; padding: 14px 16px; border-radius: 8px; margin: 18px 0; font-size: 13px; color: #9a3412; line-height: 1.5; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          th { background: #f1f5f9; padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; }
          .refund-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; padding: 14px 16px; border-radius: 8px; margin-top: 20px; font-size: 13px; color: #166534; line-height: 1.5; }
          .footer { background: #f8fafc; padding: 22px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Confirmed Order Cancelled</h1>
            <p>Important update regarding your confirmed order #${orderNum}</p>
          </div>
          <div class="body">
            <div class="badge">Confirmed Order Cancelled</div>
            <h2 style="margin: 0 0 10px 0; font-size: 19px; color: #0f172a; font-weight: 800;">Your Confirmed Order Has Been Cancelled</h2>
            <p style="font-size: 14px; color: #475569; margin: 0 0 16px 0; line-height: 1.5;">
              We are writing to inform you that your previously confirmed order <strong>#${orderNum}</strong> has now been cancelled prior to dispatch. We apologize for any inconvenience caused.
            </p>

            ${reason ? `
            <div class="reason-box">
              <strong>Cancellation Reason:</strong> ${reason}
            </div>` : ''}

            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Order Amount:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 800; color: #0f172a; font-size: 14px;">₹${order.total}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Payment Method:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #0f172a; font-size: 13px;">
                  ${order.paymentMethod === 'cash_on_delivery' || order.payment_method === 'cash_on_delivery' || order.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'Online Payment (Prepaid)'}
                </td>
              </tr>
            </table>

            <h4 style="margin: 20px 0 8px 0; font-size: 13px; color: #0f172a;">Cancelled Items</h4>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th style="text-align:center;">Qty</th>
                  <th style="text-align:right;">Amount</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>

            ${order.paymentStatus === 'paid' ? `
            <div class="refund-box">
              💳 <strong>Refund Information:</strong> A full refund of <strong>₹${order.total}</strong> has been initiated to your original payment method and will reflect in your account within 3–5 business days.
            </div>` : ''}
          </div>
          <div class="footer">
            © 2026 Zelton Retail. All rights reserved. • Dedicated support: support@zelton.co.in
          </div>
        </div>
      </body>
      </html>
    `;

    await this.send(to, subject, html);
  }

  async sendNotificationEmail(
    to: string,
    subject: string,
    title: string,
    message: string,
    actionUrl?: string | null,
    priority: string = 'NORMAL',
  ): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const fullActionUrl = actionUrl
      ? (actionUrl.startsWith('http') ? actionUrl : `${frontendUrl}${actionUrl.startsWith('/') ? '' : '/'}${actionUrl}`)
      : frontendUrl;

    const badgeBg = priority === 'CRITICAL' ? '#ef4444' : priority === 'HIGH' ? '#f59e0b' : '#3b82f6';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06); }
          .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 32px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; letter-spacing: 0.5px; }
          .body { padding: 32px 30px; }
          .badge { display: inline-block; background: ${badgeBg}; color: white; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 16px; }
          .title { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
          .message { font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px; }
          .btn-container { text-align: center; margin: 28px 0; }
          .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none !important; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 2px 6px rgba(37,99,235,0.3); }
          a.btn, a.btn:visited { color: #ffffff !important; text-decoration: none !important; }
          .footer { background: #f8fafc; padding: 20px 30px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 Zelton Store Alert</h1>
          </div>
          <div class="body">
            <div class="badge">${priority}</div>
            <div class="title">${title}</div>
            <div class="message">${message}</div>
            ${
              actionUrl
                ? `<div class="btn-container"><a href="${fullActionUrl}" class="btn" style="display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none !important; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 2px 6px rgba(37,99,235,0.3);"><span style="color: #ffffff !important; text-decoration: none !important; font-weight: 600;">View Details</span></a></div>`
                : ''
            }
          </div>
          <div class="footer">
            © 2026 Zelton. All rights reserved. | <a href="${frontendUrl}/notifications" style="color:#64748b; text-decoration:underline;">Manage Notification Preferences</a>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.send(to, subject, html);
  }

  async sendAdminAlertEmail(
    to: string,
    subject: string,
    title: string,
    message: string,
    actionUrl?: string | null,
    priority: string = 'HIGH',
  ): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const fullActionUrl = actionUrl
      ? (actionUrl.startsWith('http') ? actionUrl : `${frontendUrl}${actionUrl.startsWith('/') ? '' : '/'}${actionUrl}`)
      : `${frontendUrl}/dashboard/notifications`;

    const badgeBg = priority === 'CRITICAL' ? '#ef4444' : priority === 'HIGH' ? '#ff9903' : '#3b82f6';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff8ef; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #fee6cc; }
          .header { background: linear-gradient(135deg, #0A0908 0%, #1a1918 100%); color: white; padding: 32px 30px; text-align: center; border-bottom: 3px solid #ff9903; }
          .header h1 { margin: 0; font-size: 24px; color: #ff9903; letter-spacing: 0.5px; }
          .header p { margin: 4px 0 0; color: #999; font-size: 13px; }
          .body { padding: 32px 30px; }
          .badge { display: inline-block; background: ${badgeBg}; color: white; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 16px; }
          .title { font-size: 20px; font-weight: 800; color: #0A0908; margin-bottom: 12px; }
          .message { font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px; background: #fafafa; padding: 16px; border-radius: 8px; border-left: 4px solid #ff9903; }
          .btn-container { text-align: center; margin: 28px 0; }
          .btn { display: inline-block; background-color: #ff9903; color: #ffffff !important; text-decoration: none !important; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 700; box-shadow: 0 4px 10px rgba(255,153,3,0.3); }
          a.btn, a.btn:visited { color: #ffffff !important; text-decoration: none !important; }
          .footer { background: #fafafa; padding: 20px 30px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>👑 Zelton Super Admin Alert</h1>
            <p>E-Commerce Store Owner Notification</p>
          </div>
          <div class="body">
            <div class="badge">${priority}</div>
            <div class="title">${title}</div>
            <div class="message">${message}</div>
            <div class="btn-container">
              <a href="${fullActionUrl}" class="btn" style="display: inline-block; background-color: #ff9903; color: #ffffff !important; text-decoration: none !important; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 700; box-shadow: 0 4px 10px rgba(255,153,3,0.3);">
                <span style="color: #ffffff !important; text-decoration: none !important; font-weight: 700;">Open Admin Dashboard</span>
              </a>
            </div>
          </div>
          <div class="footer">
            © 2026 Zelton Admin Panel. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    await this.send(to, subject, html);
  }

  async sendShipmentDispatchedEmail(
    to: string,
    order: any,
    waybill: string,
  ): Promise<void> {
    const orderNum = order.orderNumber || order.order_number || `ORD-${order.id}`;
    const orderSlug = getOrderSlug(order) || orderNum;
    const subject = `🚚 Your Order #${orderNum} Has Been Shipped! Track Your Package`;
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const storeTrackingUrl = `${frontendUrl}/orders/${orderSlug}/tracking`;
    const delhiveryTrackingUrl = `https://www.delhivery.com/tracking?waybill=${waybill}`;

    const itemsList = order.orderItems || order.order_items || [];
    const itemsHtml = itemsList
      .map(
        (item: any) => `
        <tr>
          <td style="padding: 10px 8px; border-bottom: 1px solid #eee;">
            <strong>${item.product?.name ?? 'Product'}</strong>
            ${item.variant?.title ? `<br><small style="color:#666;">${item.variant.title}</small>` : ''}
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #eee; text-align: right;">₹${item.total}</td>
        </tr>`,
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f7; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 36px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 26px; letter-spacing: 0.5px; }
          .header p { margin: 6px 0 0; opacity: 0.9; font-size: 14px; }
          .body { padding: 32px 30px; }
          .awb-card { background: #f0fdf4; border: 2px dashed #22c55e; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
          .awb-label { font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
          .awb-number { font-size: 28px; font-weight: 800; color: #15803d; letter-spacing: 3px; font-family: monospace; }
          .courier-name { font-size: 13px; color: #4b5563; margin-top: 6px; }
          .btn-container { text-align: center; margin: 26px 0 16px; }
          .btn-delhivery { display: inline-block; background-color: #dc2626; color: #ffffff !important; text-decoration: none !important; padding: 13px 24px; border-radius: 8px; font-size: 14px; font-weight: 700; box-shadow: 0 3px 8px rgba(220,38,38,0.3); margin: 6px; }
          .btn-store { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none !important; padding: 13px 24px; border-radius: 8px; font-size: 14px; font-weight: 700; box-shadow: 0 3px 8px rgba(37,99,235,0.3); margin: 6px; }
          a.btn-delhivery, a.btn-delhivery:visited, a.btn-store, a.btn-store:visited { color: #ffffff !important; text-decoration: none !important; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #f1f5f9; padding: 10px 8px; text-align: left; font-size: 12px; text-transform: uppercase; color: #475569; }
          .footer { background: #f8fafc; padding: 20px 30px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚚 Your Order is on the Way!</h1>
            <p>Order #${orderNum} has been shipped</p>
          </div>
          <div class="body">
            <p style="font-size: 15px; color: #334155; line-height: 1.6;">
              Great news! Your order has been dispatched via our official courier partner <strong>Delhivery Express</strong>.
            </p>

            <div class="awb-card">
              <div class="awb-label">Delhivery Tracking / Waybill (AWB) Number</div>
              <div class="awb-number">${waybill}</div>
              <div class="courier-name">Courier Partner: <strong>Delhivery Express</strong></div>
            </div>

            <div class="btn-container">
              <a href="${delhiveryTrackingUrl}" class="btn-delhivery" target="_blank" style="display: inline-block; background-color: #dc2626; color: #ffffff !important; text-decoration: none !important; padding: 13px 24px; border-radius: 8px; font-size: 14px; font-weight: 700; box-shadow: 0 3px 8px rgba(220,38,38,0.3); margin: 6px;">
                <span style="color: #ffffff !important; text-decoration: none !important; font-weight: 700;">📍 Track on Delhivery.com</span>
              </a>
              <a href="${storeTrackingUrl}" class="btn-store" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none !important; padding: 13px 24px; border-radius: 8px; font-size: 14px; font-weight: 700; box-shadow: 0 3px 8px rgba(37,99,235,0.3); margin: 6px;">
                <span style="color: #ffffff !important; text-decoration: none !important; font-weight: 700;">🛍️ Track on Zelton Store</span>
              </a>
            </div>

            <h3 style="margin-top: 30px; margin-bottom: 12px; font-size: 16px; color: #0f172a;">Items in this Shipment</h3>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th style="text-align:center;">Qty</th>
                  <th style="text-align:right;">Amount</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>

            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-top: 20px; font-size: 13px; color: #64748b;">
              💡 <strong>Delivery Tip:</strong> Keep your phone handy. The delivery executive will contact you when the package is out for delivery.
            </div>
          </div>
          <div class="footer">
            © 2026 Zelton. All rights reserved. | Need assistance? Contact us at support@zelton.co.in
          </div>
        </div>
      </body>
      </html>
    `;

    await this.send(to, subject, html);
  }

  async sendReturnRequestedEmail(to: string, returnReq: any): Promise<void> {
    const subject = `Return Request Received - #${returnReq.returnNumber}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
          .header { background: #007FFF; color: white; padding: 32px 24px; text-align: center; }
          .body { padding: 32px 24px; }
          .pill { background: #eff6ff; color: #007FFF; font-weight: 700; padding: 6px 14px; border-radius: 9999px; display: inline-block; font-size: 13px; }
          .footer { background: #f8fafc; padding: 20px 24px; text-align: center; color: #94a3b8; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0; font-size: 24px;">📦 Return Request Received</h1>
            <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Return #${returnReq.returnNumber}</p>
          </div>
          <div class="body">
            <p style="font-size: 15px; color: #334155;">Hello,</p>
            <p style="font-size: 15px; color: #334155; line-height: 1.6;">
              We have received your ${returnReq.returnType === 'exchange' ? 'Exchange' : 'Return'} request for order <strong>#${returnReq.order?.orderNumber || returnReq.orderId}</strong>.
            </p>
            <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;"><strong>Return Reference:</strong> ${returnReq.returnNumber}</p>
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;"><strong>Type:</strong> ${returnReq.returnType === 'exchange' ? 'Product Exchange' : 'Refund Return'}</p>
              <p style="margin: 0; font-size: 13px; color: #64748b;"><strong>Current Status:</strong> Under Review by Team</p>
            </div>
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">
              Our team is reviewing your request and photos. Once approved, Delhivery reverse pickup will be scheduled at your doorstep.
            </p>
          </div>
          <div class="footer">© 2026 Zelton. All rights reserved.</div>
        </div>
      </body>
      </html>
    `;
    await this.send(to, subject, html);
  }

  async sendReturnApprovedEmail(to: string, returnReq: any): Promise<void> {
    const subject = `Return Request Approved - #${returnReq.returnNumber}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
          .header { background: #059669; color: white; padding: 32px 24px; text-align: center; }
          .body { padding: 32px 24px; }
          .footer { background: #f8fafc; padding: 20px 24px; text-align: center; color: #94a3b8; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0; font-size: 24px;">✅ Return Approved</h1>
            <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Return #${returnReq.returnNumber}</p>
          </div>
          <div class="body">
            <p style="font-size: 15px; color: #334155;">Hello,</p>
            <p style="font-size: 15px; color: #334155; line-height: 1.6;">
              Your return request <strong>#${returnReq.returnNumber}</strong> has been <strong>approved</strong>.
            </p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 6px 0; font-weight: 700; color: #166534;">📦 Next Step: Doorstep Reverse Pickup</p>
              <p style="margin: 0; font-size: 13px; color: #15803d; line-height: 1.5;">
                Our courier partner Delhivery will pick up the package from your address in 1-2 business days. Please keep the original tags and packaging intact.
              </p>
            </div>
            ${returnReq.reverseWaybill ? `<p style="font-size: 14px;"><strong>Reverse Waybill AWB:</strong> ${returnReq.reverseWaybill}</p>` : ''}
          </div>
          <div class="footer">© 2026 Zelton. All rights reserved.</div>
        </div>
      </body>
      </html>
    `;
    await this.send(to, subject, html);
  }

  async sendReturnRejectedEmail(to: string, returnReq: any, reason: string): Promise<void> {
    const subject = `Update Regarding Return Request - #${returnReq.returnNumber}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
          .header { background: #dc2626; color: white; padding: 32px 24px; text-align: center; }
          .body { padding: 32px 24px; }
          .footer { background: #f8fafc; padding: 20px 24px; text-align: center; color: #94a3b8; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0; font-size: 24px;">Return Request Update</h1>
            <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Return #${returnReq.returnNumber}</p>
          </div>
          <div class="body">
            <p style="font-size: 15px; color: #334155;">Hello,</p>
            <p style="font-size: 15px; color: #334155; line-height: 1.6;">
              After careful review by our inspection team, your return request <strong>#${returnReq.returnNumber}</strong> could not be approved at this time.
            </p>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 4px 0; font-weight: 700; color: #991b1b; font-size: 13px;">Reason for Decision:</p>
              <p style="margin: 0; font-size: 14px; color: #7f1d1d;">${reason}</p>
            </div>
            <p style="font-size: 13px; color: #64748b;">
              If you have further questions, please contact our support team at support@zelton.co.in.
            </p>
          </div>
          <div class="footer">© 2026 Zelton. All rights reserved.</div>
        </div>
      </body>
      </html>
    `;
    await this.send(to, subject, html);
  }

  async sendNdrAlertEmail(to: string, order: any, remarks?: string): Promise<void> {
    const subject = `⚠️ Delivery Attempted for Order #${order.orderNumber}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
          .header { background: #f59e0b; color: white; padding: 32px 24px; text-align: center; }
          .body { padding: 32px 24px; }
          .footer { background: #f8fafc; padding: 20px 24px; text-align: center; color: #94a3b8; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0; font-size: 24px;">⚠️ Delivery Attempted</h1>
            <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Order #${order.orderNumber}</p>
          </div>
          <div class="body">
            <p style="font-size: 15px; color: #334155;">Hello,</p>
            <p style="font-size: 15px; color: #334155; line-height: 1.6;">
              Delhivery attempted to deliver your package today but was unable to complete the delivery.
            </p>
            ${remarks ? `<div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; margin: 16px 0; font-size: 13px; color: #92400e;"><strong>Courier Remark:</strong> ${remarks}</div>` : ''}
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">
              A reattempt will be made on the next working day. Please ensure your contact phone is reachable when the courier calls.
            </p>
          </div>
          <div class="footer">© 2026 Zelton. All rights reserved.</div>
        </div>
      </body>
      </html>
    `;
    await this.send(to, subject, html);
  }

  async sendCustomEmail(to: string, subject: string, htmlContent: string): Promise<void> {
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
          .header { background: #0A0908; color: white; padding: 24px; text-align: center; }
          .body { padding: 32px 24px; }
          .footer { background: #f8fafc; padding: 20px 24px; text-align: center; color: #94a3b8; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1 style="margin:0; font-size: 22px; letter-spacing: 2px;">ZELTON</h1></div>
          <div class="body">${htmlContent}</div>
          <div class="footer">© 2026 Zelton. All rights reserved.</div>
        </div>
      </body>
      </html>
    `;
    await this.send(to, subject, fullHtml);
  }

  private async send(to: string, subject: string, html: string, attachments?: any[]): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress(),
        to,
        subject,
        html,
        attachments,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${to}: ${err.message}`);
    }
  }
}


