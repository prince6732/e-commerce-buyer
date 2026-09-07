import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  Logger,
  HttpException,
  HttpStatus,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import {
  orders,
  orderItems,
  carts,
  products,
  variants,
  orderTrackingRecords,
} from '../database/schema';
import { sql } from 'drizzle-orm';

import { OrdersService } from '../orders/orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProductsService } from '../products/products.service';
import { validateAndSanitizeShippingAddress } from '../common/utils/address-validator';
import { getOrderSlug } from '../common/utils/slug.util';
import { calculateItemTax } from '../common/utils/tax.util';

// In-memory store for pending payment orders (single-server)
const pendingOrders = new Map<string, any>();

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private appId: string;
  private secretKey: string;
  private apiVersion: string;
  private baseUrl: string;

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private config: ConfigService,
    private ordersService: OrdersService,
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => ProductsService)) private productsService: ProductsService,
  ) {
    /* 
     ===========================================================================
     CASHFREE PAYMENT GATEWAY CONFIGURATION (LOCAL / SANDBOX vs LIVE / PRODUCTION)
     ===========================================================================
     LOCAL / TEST (SANDBOX):
     baseUrl = 'https://sandbox.cashfree.com/pg'
     
     LIVE / PRODUCTION:
     baseUrl = 'https://api.cashfree.com/pg'
     ===========================================================================
    */
    // All credentials & configuration loaded strictly from .env file via ConfigService
    this.appId = this.config.get<string>('CASHFREE_APP_ID', '');
    this.secretKey = this.config.get<string>('CASHFREE_SECRET_KEY', '');
    this.apiVersion = this.config.get<string>('CASHFREE_API_VERSION', '2023-08-01');
    
    const envBaseUrl = this.config.get<string>('CASHFREE_BASE_URL');
    if (envBaseUrl) {
      this.baseUrl = envBaseUrl;
    } else {
      this.baseUrl = this.appId.startsWith('TEST')
        ? 'https://sandbox.cashfree.com/pg'
        : 'https://api.cashfree.com/pg';
    }
  }

  private generateOrderNumber(): string {
    return `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  async initiatePayment(userId: number, user: any, body: any) {
    let cartItems: any[] = [];
    let isSingleItem = false;

    if (body.product_id && body.variant_id) {
      isSingleItem = true;
      const product = await this.db.query.products.findFirst({ where: eq(products.id, body.product_id) });
      const variant = await this.db.query.variants.findFirst({ where: eq(variants.id, body.variant_id) });

      if (!product || product.status === false) throw new BadRequestException('Sorry! The selected product is currently unavailable.');
      if (!variant || variant.status === false || variant.deletedAt !== null) throw new BadRequestException('Sorry! The selected variant is currently unavailable.');
      if (variant.productId !== product.id) throw new BadRequestException('Invalid variant for the selected product');
      if (variant.stock <= 0) {
        throw new BadRequestException(`Sorry! "${product.name}${variant.title ? ` (${variant.title})` : ''}" is currently out of stock.`);
      }
      if (variant.stock < body.quantity) {
        throw new BadRequestException(`Sorry! Only ${variant.stock} items are currently available for this product.`);
      }

      const itemTotal = parseFloat(variant.sp as string) * body.quantity;
      cartItems = [{
        product_id: product.id,
        variant_id: variant.id,
        quantity: body.quantity,
        price: variant.sp,
        total: itemTotal,
        selected_attributes: body.selected_attributes ?? null,
      }];
    } else {
      // Cart-based checkout
      const dbCartItems = await this.db.query.carts.findMany({
        where: eq(carts.userId, userId),
        with: { product: true, variant: true } as any,
      });

      let filtered = dbCartItems;
      if (body.cart_items?.length) {
        filtered = dbCartItems.filter((c: any) => body.cart_items.includes(c.id));
      }

      if (!filtered.length) throw new BadRequestException('Your cart is empty. Please add items before placing an order.');

      for (const item of filtered) {
        const freshProd = await this.db.query.products.findFirst({ where: eq(products.id, item.productId) });
        if (!freshProd || freshProd.status === false) {
          throw new BadRequestException(`Sorry! "${freshProd?.name || 'A product in your cart'}" is currently unavailable.`);
        }

        const freshVar = await this.db.query.variants.findFirst({ where: eq(variants.id, item.variantId) });
        if (!freshVar || freshVar.status === false || freshVar.deletedAt !== null) {
          throw new BadRequestException(`Sorry! The variant for "${freshProd.name}" is currently unavailable.`);
        }

        if (freshVar.stock <= 0) {
          throw new BadRequestException(`Sorry! "${freshProd.name}${freshVar.title ? ` (${freshVar.title})` : ''}" is currently out of stock. Please remove it from your cart.`);
        }

        if (freshVar.stock < item.quantity) {
          throw new BadRequestException(`Sorry! Only ${freshVar.stock} items are currently available for "${freshProd.name}${freshVar.title ? ` (${freshVar.title})` : ''}". You requested ${item.quantity}.`);
        }
      }

      cartItems = filtered.map((item: any) => {
        const unitPrice = parseFloat(item.variant?.sp ?? item.product?.sp ?? '0');
        return {
          product_id: item.productId,
          variant_id: item.variantId,
          quantity: item.quantity,
          price: unitPrice.toFixed(2),
          total: (unitPrice * item.quantity).toFixed(2),
          selected_attributes: item.selectedAttributes,
        };
      });
    }

    const subtotal = cartItems.reduce((sum, c) => sum + parseFloat(c.total), 0);
    const total = subtotal;
    const orderNumber = this.generateOrderNumber();
    const invoiceNumber = await this.ordersService.generateUniqueInvoiceNumber();

    // Validate and sanitize shipping address
    const { sanitizedAddress } = validateAndSanitizeShippingAddress(body.shipping_address);

    // Store pending order in DB so it is persistent across server restarts
    const [r] = await this.db.insert(orders).values({
      orderNumber,
      invoiceNumber,
      userId,
      status: 'pending',
      paymentMethod: 'online',
      paymentStatus: 'pending',
      subtotal: subtotal.toFixed(2),
      shippingFee: '0.00',
      tax: '0.00',
      total: total.toFixed(2),
      shippingAddress: sanitizedAddress,
      billingAddress: body.billing_address ? validateAndSanitizeShippingAddress(body.billing_address).sanitizedAddress : sanitizedAddress,
      notes: body.notes ?? null,
    }).$returningId();

    for (const item of cartItems) {
      const hydratedProd = (await this.productsService.findProductWithRelations(item.product_id)) || null;
      const itemTax = calculateItemTax(hydratedProd, parseFloat(item.total), sanitizedAddress);

      await this.db.insert(orderItems).values({
        orderId: r.id,
        productId: item.product_id,
        variantId: item.variant_id,
        quantity: item.quantity,
        price: String(item.price),
        total: parseFloat(item.total).toFixed(2),
        selectedAttributes: item.selected_attributes ?? null,
        hsn: itemTax.hsn,
        taxRate: itemTax.taxRate,
        taxableAmount: itemTax.taxableAmount,
        taxAmount: itemTax.taxAmount,
        cgstRate: itemTax.cgstRate,
        cgstAmount: itemTax.cgstAmount,
        sgstRate: itemTax.sgstRate,
        sgstAmount: itemTax.sgstAmount,
        igstRate: itemTax.igstRate,
        igstAmount: itemTax.igstAmount,
      });
    }

    // Keep memory fallback
    pendingOrders.set(orderNumber, {
      cart_items: cartItems,
      is_single_item: isSingleItem,
      shipping_address: body.shipping_address,
      billing_address: body.billing_address ?? body.shipping_address,
      notes: body.notes ?? null,
      subtotal,
      shipping_fee: 0,
      tax: 0,
      total,
      user_id: userId,
      cart_item_ids: body.cart_items ?? [],
      db_order_id: r.id,
    });

    // Determine return URL (Sandbox allows HTTP for local dev; Production enforces HTTPS)
    let returnUrl = body.return_url;
    if (!returnUrl) {
      let origin = body.origin ?? this.config.get('FRONTEND_URL', 'http://localhost:3000');
      if (!this.baseUrl.includes('sandbox') && origin.startsWith('http://')) {
        origin = origin.replace(/^http:\/\//i, 'https://');
      }
      returnUrl = `${origin}/checkout?order_id={order_id}`;
    }

    const customerPhoneRaw = user.phoneNumber ?? user.phone_number ?? body.phone ?? '9999999999';
    const cleanCustomerPhone = customerPhoneRaw.replace(/[^0-9]/g, '').slice(-10) || '9999999999';
    const customerEmail = user.email ?? body.email ?? 'customer@example.com';
    const customerName = user.name ?? body.name ?? 'Customer';

    this.logger.log(`Initiating Cashfree payment for order: ${orderNumber}, amount: ${total}`);

    try {
      const response = await axios.post(
        `${this.baseUrl}/orders`,
        {
          order_id: orderNumber,
          order_amount: parseFloat(total.toFixed(2)),
          order_currency: 'INR',
          customer_details: {
            customer_id: String(userId),
            customer_email: customerEmail,
            customer_phone: cleanCustomerPhone,
            customer_name: customerName,
          },
          order_meta: { return_url: returnUrl },
        },
        {
          headers: {
            'x-client-id': this.appId,
            'x-client-secret': this.secretKey,
            'x-api-version': this.apiVersion,
            'Content-Type': 'application/json',
          },
        },
      );

      const mode = this.baseUrl.includes('sandbox') || this.appId.startsWith('TEST') ? 'sandbox' : 'production';

      return {
        success: true,
        payment_session_id: response.data.payment_session_id,
        order_number: orderNumber,
        cashfree_mode: mode,
        mode,
      };
    } catch (err: any) {
      // Clean up pending DB order on failure
      await this.db.delete(orderItems).where(eq(orderItems.orderId, r.id));
      await this.db.delete(orders).where(eq(orders.id, r.id));
      pendingOrders.delete(orderNumber);
      const errData = err.response?.data;
      const detailedMessage = errData?.message || err.message || 'Failed to initiate payment gateway. Please try again.';
      this.logger.error(`Cashfree initiation failed: ${detailedMessage}`, errData);
      throw new HttpException(
        { success: false, message: detailedMessage, error: errData },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async verifyPayment(body: any): Promise<any> {
    const orderNumber = body.order_id;

    try {
      const response = await axios.get(`${this.baseUrl}/orders/${orderNumber}`, {
        headers: {
          'x-client-id': this.appId,
          'x-client-secret': this.secretKey,
          'x-api-version': this.apiVersion,
        },
      });

      const orderData = response.data;
      const orderStatus = orderData.order_status;

      // Check if order exists in DB
      const existingOrder = await this.db.query.orders.findFirst({
        where: eq(orders.orderNumber, orderNumber),
        with: { orderItems: true } as any,
      });

      if (orderStatus === 'PAID') {
        if (existingOrder && existingOrder.paymentStatus === 'paid') {
          return { success: true, status: orderStatus, data: existingOrder };
        }

        // Process paid order (either existing pending DB order or memory fallback)
        const targetOrderId = existingOrder ? existingOrder.id : null;
        const targetUserId = existingOrder ? existingOrder.userId : pendingOrders.get(orderNumber)?.user_id;

        if (!existingOrder && !pendingOrders.has(orderNumber)) {
          this.logger.error(`Pending order data not found for: ${orderNumber}`);
          throw new BadRequestException('Order session expired. Please contact support.');
        }

        const itemsList = existingOrder ? (existingOrder as any).orderItems : pendingOrders.get(orderNumber)?.cart_items;

        // Deduct stock for all items
        const deductedVariants: { variantId: number; productId: number }[] = [];
        for (const item of itemsList) {
          const vId = item.variantId ?? item.variant_id;
          const pId = item.productId ?? item.product_id;
          const qty = item.quantity;
          await this.db.update(variants).set({ stock: sql`stock - ${qty}` }).where(eq(variants.id, vId));
          if (vId && pId) {
            deductedVariants.push({ variantId: Number(vId), productId: Number(pId) });
          }
        }

        if (deductedVariants.length > 0) {
          this.ordersService.broadcastVariantStockUpdates(deductedVariants).catch(err => this.logger.error('Failed to broadcast stock updates on payment success:', err));
        }

        if (existingOrder) {
          const invNum = existingOrder.invoiceNumber || await this.ordersService.generateUniqueInvoiceNumber();
          await this.db.update(orders).set({
            paymentStatus: 'paid',
            status: 'pending',
            invoiceNumber: invNum,
            transactionId: String(orderData.cf_order_id ?? ''),
          }).where(eq(orders.id, existingOrder.id));

          await this.db.insert(orderTrackingRecords).values({
            orderId: existingOrder.id,
            status: 'pending',
            description: 'Online payment received successfully - Awaiting admin confirmation',
            location: 'Online Store',
            trackedAt: new Date(),
          });

          // Clear cart for user
          if (targetUserId) {
            await this.db.delete(carts).where(eq(carts.userId, targetUserId));
          }

          pendingOrders.delete(orderNumber);

          // 1. Send Order Placed Email (Pending Admin Confirmation)
          this.ordersService.sendOrderPlacedEmail(existingOrder.id).catch(err => this.logger.error('Failed to send order placed email:', err));

          const updatedOrder = await this.db.query.orders.findFirst({
            where: eq(orders.id, existingOrder.id),
            with: { orderItems: { with: { product: true, variant: true } as any } } as any,
          });

          const paymentOrderSlug = getOrderSlug(updatedOrder) || updatedOrder?.orderNumber || existingOrder.orderNumber;

          // Emit real-time notification to Customer
          if (targetUserId) {
            this.notificationsService.createAndEmitNotification({
              userId: targetUserId,
              recipientGroup: 'customer',
              title: '🎉 Order Placed Successfully',
              message: `Your order #${updatedOrder?.orderNumber || existingOrder.orderNumber} for ₹${(updatedOrder as any)?.total || existingOrder.total} has been received!`,
              type: 'ORDER_PLACED',
              priority: 'HIGH',
              entityType: 'order',
              entityId: existingOrder.id,
              referenceKey: `ORDER_PLACED_${existingOrder.id}`,
              link: `/orders/${paymentOrderSlug}`,
              metadata: { orderId: existingOrder.id, orderNumber: updatedOrder?.orderNumber || existingOrder.orderNumber, totalAmount: (updatedOrder as any)?.total }
            }).catch(err => this.logger.error('Failed to emit customer order notification:', err));
          }

          // Emit real-time notification to Admin Dashboard
          this.notificationsService.createAndEmitNotification({
            recipientGroup: 'admin',
            title: '🛒 New Order Placed',
            message: `New order #${updatedOrder?.orderNumber || existingOrder.orderNumber} placed for ₹${(updatedOrder as any)?.total || existingOrder.total}`,
            type: 'ORDER_PLACED',
            priority: 'HIGH',
            entityType: 'order',
            entityId: existingOrder.id,
            referenceKey: `ADMIN_ORDER_PLACED_${existingOrder.id}`,
            link: `/dashboard/orders/${paymentOrderSlug}`,
            metadata: { orderId: existingOrder.id, orderNumber: updatedOrder?.orderNumber || existingOrder.orderNumber, totalAmount: (updatedOrder as any)?.total }
          }).catch(err => this.logger.error('Failed to emit admin order notification:', err));

          return { success: true, status: orderStatus, data: updatedOrder };
        } else {
          // Fallback legacy memory creation if DB order was absent
          const pendingData = pendingOrders.get(orderNumber);
          const invNum = await this.ordersService.generateUniqueInvoiceNumber();
          const [r] = await this.db.insert(orders).values({
            orderNumber,
            invoiceNumber: invNum,
            userId: pendingData.user_id,
            status: 'pending',
            paymentMethod: 'online',
            paymentStatus: 'paid',
            subtotal: pendingData.subtotal.toFixed(2),
            shippingFee: '0.00',
            tax: '0.00',
            total: pendingData.total.toFixed(2),
            shippingAddress: pendingData.shipping_address,
            billingAddress: pendingData.billing_address,
            notes: pendingData.notes,
            transactionId: orderData.cf_order_id ? String(orderData.cf_order_id) : null,
          }).$returningId();

          for (const item of pendingData.cart_items) {
            const hydratedProd = (await this.productsService.findProductWithRelations(item.product_id)) || null;
            const itemTax = calculateItemTax(hydratedProd, parseFloat(item.total), pendingData.shipping_address);

            await this.db.insert(orderItems).values({
              orderId: r.id,
              productId: item.product_id,
              variantId: item.variant_id,
              quantity: item.quantity,
              price: String(item.price),
              total: parseFloat(item.total).toFixed(2),
              selectedAttributes: item.selected_attributes ?? null,
              hsn: itemTax.hsn,
              taxRate: itemTax.taxRate,
              taxableAmount: itemTax.taxableAmount,
              taxAmount: itemTax.taxAmount,
              cgstRate: itemTax.cgstRate,
              cgstAmount: itemTax.cgstAmount,
              sgstRate: itemTax.sgstRate,
              sgstAmount: itemTax.sgstAmount,
              igstRate: itemTax.igstRate,
              igstAmount: itemTax.igstAmount,
            });
          }

          await this.db.insert(orderTrackingRecords).values({
            orderId: r.id,
            status: 'pending',
            description: 'Online payment received successfully - Awaiting admin confirmation',
            location: 'Online Store',
            trackedAt: new Date(),
          });

          await this.db.delete(carts).where(eq(carts.userId, pendingData.user_id));
          pendingOrders.delete(orderNumber);

          // 1. Send Order Placed Email (Pending Admin Confirmation)
          this.ordersService.sendOrderPlacedEmail(r.id).catch(err => this.logger.error('Failed to send order placed email:', err));

          const createdOrder = await this.db.query.orders.findFirst({
            where: eq(orders.id, r.id),
            with: { orderItems: { with: { product: true, variant: true } as any } } as any,
          });

          const fallbackOrderSlug = getOrderSlug(createdOrder) || createdOrder?.orderNumber || orderNumber;

          // Emit real-time notification to Customer
          this.notificationsService.createAndEmitNotification({
            userId: pendingData.user_id,
            recipientGroup: 'customer',
            title: '🎉 Order Placed Successfully',
            message: `Your order #${createdOrder?.orderNumber || orderNumber} for ₹${(createdOrder as any)?.total || pendingData.total} has been received!`,
            type: 'ORDER_PLACED',
            priority: 'HIGH',
            entityType: 'order',
            entityId: r.id,
            referenceKey: `ORDER_PLACED_${r.id}`,
            link: `/orders/${fallbackOrderSlug}`,
            metadata: { orderId: r.id, orderNumber: createdOrder?.orderNumber || orderNumber, totalAmount: (createdOrder as any)?.total }
          }).catch(err => this.logger.error('Failed to emit customer order notification:', err));

          // Emit real-time notification to Admin Dashboard
          this.notificationsService.createAndEmitNotification({
            recipientGroup: 'admin',
            title: '🛒 New Order Placed',
            message: `New order #${createdOrder?.orderNumber || orderNumber} placed for ₹${(createdOrder as any)?.total || pendingData.total}`,
            type: 'ORDER_PLACED',
            priority: 'HIGH',
            entityType: 'order',
            entityId: r.id,
            referenceKey: `ADMIN_ORDER_PLACED_${r.id}`,
            link: `/dashboard/orders/${fallbackOrderSlug}`,
            metadata: { orderId: r.id, orderNumber: createdOrder?.orderNumber || orderNumber, totalAmount: (createdOrder as any)?.total }
          }).catch(err => this.logger.error('Failed to emit admin order notification:', err));

          return { success: true, status: orderStatus, data: createdOrder };
        }
      } else if (orderStatus === 'ACTIVE') {
        return { success: false, status: orderStatus, message: 'Payment is still being processed. Please wait.' };
      } else {
        pendingOrders.delete(orderNumber);
        return { success: false, status: orderStatus, message: 'Payment was not successful. Please try again.' };
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Cashfree verification failed: ${err.message}`);
      throw new HttpException({ success: false, message: 'Error verifying payment.', error: err.message }, 500);
    }
  }

  async testCredentials() {
    return {
      app_id: this.appId,
      secret_key_preview: this.secretKey ? this.secretKey.substring(0, 10) + '...' : 'not-set',
      api_version: this.apiVersion,
      base_url: this.baseUrl,
      credentials_loaded: !!(this.appId && this.secretKey),
    };
  }
}
