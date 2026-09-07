import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { eq, and, or, desc, like, ne, sql, gte, lte, inArray, isNull } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import { randomBytes } from 'crypto';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import {
  orders,
  orderItems,
  orderTrackingRecords,
  carts,
  variants,
  products,
  users,
  settings,
} from '../database/schema';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { InvoicePdfService } from './invoice-pdf.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DelhiveryService } from '../delhivery/delhivery.service';
import { validateAndSanitizeShippingAddress } from '../common/utils/address-validator';
import { getOrderSlug } from '../common/utils/slug.util';
import { calculateItemTax } from '../common/utils/tax.util';
import { ProductsGateway } from '../products/products.gateway';
import { ProductsService } from '../products/products.service';

@Injectable()
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private mailService: MailService,
    private config: ConfigService,
    private invoicePdfService: InvoicePdfService,
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => DelhiveryService)) private delhiveryService: DelhiveryService,
    @Inject(forwardRef(() => ProductsService)) private productsService: ProductsService,
    private productsGateway: ProductsGateway,
  ) {}

  public async broadcastVariantStockUpdates(items: { variantId: number; productId: number }[]) {
    try {
      const seenVariantIds = new Set<number>();
      for (const item of items) {
        if (!item.variantId || seenVariantIds.has(item.variantId)) continue;
        seenVariantIds.add(item.variantId);

        const [freshVar] = await this.db.select().from(variants).where(eq(variants.id, item.variantId)).limit(1);
        const [prod] = await this.db.select().from(products).where(eq(products.id, item.productId)).limit(1);

        if (prod && freshVar) {
          const prodVariants = await this.db.select().from(variants).where(eq(variants.productId, item.productId));
          const fullProd = { ...prod, variants: prodVariants };
          const formatted = this.productsService?.formatProduct ? this.productsService.formatProduct(fullProd) : fullProd;
          this.productsGateway.emitProductStockUpdated({
            productId: Number(item.productId),
            variantId: Number(item.variantId),
            stock: Number(freshVar.stock ?? 0),
            totalStock: (prodVariants || []).reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0),
            product: formatted,
          });
        }
      }
    } catch (err) {
      this.logger.error('Error broadcasting variant stock updates:', err);
    }
  }

  async onModuleInit() {
    try {
      const unassigned = await this.db.select().from(orders).where(isNull(orders.invoiceNumber)).orderBy(orders.createdAt);
      for (const order of unassigned) {
        const invNum = await this.generateUniqueInvoiceNumber(order.createdAt || new Date());
        await this.db.update(orders).set({ invoiceNumber: invNum }).where(eq(orders.id, order.id));
        this.logger.log(`Auto-assigned missing invoice number ${invNum} to order #${order.id}`);
      }
    } catch (err: any) {
      this.logger.error('Failed to auto-assign missing invoice numbers:', err);
    }
  }

  private generateOrderNumber(): string {
    return `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  private getFinancialYear(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11 (3 = April)
    let startYear: number, endYear: number;
    if (month >= 3) { // April onwards
      startYear = year;
      endYear = year + 1;
    } else {
      startYear = year - 1;
      endYear = year;
    }
    const startStr = String(startYear).slice(-2);
    const endStr = String(endYear).slice(-2);
    return `${startStr}${endStr}`;
  }

  public async generateInvoiceNumber(date: Date = new Date(), offset: number = 0): Promise<string> {
    const currentFY = this.getFinancialYear(date);
    const prefix = `ZT/${currentFY}/`;

    const existingInvoices = await this.db.select({ invoiceNumber: orders.invoiceNumber }).from(orders).where(like(orders.invoiceNumber, `${prefix}%`));

    let maxSeq = 0;
    for (const inv of existingInvoices) {
      if (inv.invoiceNumber) {
        const parts = inv.invoiceNumber.split('/');
        const seqStr = parts[parts.length - 1];
        const seqNum = parseInt(seqStr, 10);
        if (!isNaN(seqNum) && seqNum > maxSeq) {
          maxSeq = seqNum;
        }
      }
    }

    const nextSeq = maxSeq + 1 + offset;
    const formattedSeq = String(nextSeq).padStart(5, '0');
    return `${prefix}${formattedSeq}`;
  }

  public async generateUniqueInvoiceNumber(date: Date = new Date()): Promise<string> {
    for (let offset = 0; offset < 50; offset++) {
      const candidate = await this.generateInvoiceNumber(date, offset);
      const [existing] = await this.db.select({ id: orders.id }).from(orders).where(eq(orders.invoiceNumber, candidate)).limit(1);
      if (!existing) {
        return candidate;
      }
    }
    return `ZT/${this.getFinancialYear(date)}/${Date.now()}`;
  }

  private generateDeliveryToken(): string {
    return randomBytes(32).toString('hex');
  }

  private async addTracking(
    orderId: number,
    status: string,
    description: string,
    location?: string,
  ) {
    await this.db.insert(orderTrackingRecords).values({
      orderId,
      status,
      description,
      location: location ?? null,
      trackedAt: new Date(),
    });
  }

  // ─── Relation Population Helper (Safe on MariaDB & MySQL) ────────────────
  public async populateOrders(orderList: any[]): Promise<any[]> {
    if (!orderList || orderList.length === 0) return [];

    const orderIds = orderList.map(o => o.id).filter(id => id !== undefined && id !== null);
    if (orderIds.length === 0) return orderList;

    const userIds = Array.from(new Set(orderList.map(o => o.userId).filter(Boolean)));

    const [items, tracking, userRows] = await Promise.all([
      this.db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)).catch(() => []),
      this.db.select().from(orderTrackingRecords).where(inArray(orderTrackingRecords.orderId, orderIds)).catch(() => []),
      userIds.length > 0 ? this.db.select().from(users).where(inArray(users.id, userIds)).catch(() => []) : Promise.resolve([]),
    ]);

    const productIds = Array.from(new Set((items as any[]).map(i => i.productId).filter(Boolean)));
    const variantIds = Array.from(new Set((items as any[]).map(i => i.variantId).filter(Boolean)));

    const [prodRows, varRows] = await Promise.all([
      productIds.length > 0 ? this.db.select().from(products).where(inArray(products.id, productIds)).catch(() => []) : Promise.resolve([]),
      variantIds.length > 0 ? this.db.select().from(variants).where(inArray(variants.id, variantIds)).catch(() => []) : Promise.resolve([]),
    ]);

    const userMap = new Map<number, any>();
    for (const u of (userRows || [])) userMap.set(u.id, u);

    const prodMap = new Map<number, any>();
    for (const p of (prodRows || [])) prodMap.set(p.id, p);

    const varMap = new Map<number, any>();
    for (const v of (varRows || [])) varMap.set(v.id, v);

    const itemsWithRelations = (items || []).map((item: any) => ({
      ...item,
      product: prodMap.get(item.productId) || null,
      variant: varMap.get(item.variantId) || null,
    }));

    const itemsByOrderId = new Map<number, any[]>();
    for (const it of itemsWithRelations) {
      const list = itemsByOrderId.get(it.orderId) || [];
      list.push(it);
      itemsByOrderId.set(it.orderId, list);
    }

    const trackingByOrderId = new Map<number, any[]>();
    for (const tr of ((tracking as any[]) || [])) {
      const list = trackingByOrderId.get(tr.orderId) || [];
      list.push(tr);
      trackingByOrderId.set(tr.orderId, list);
    }

    return orderList.map((o: any) => ({
      ...o,
      user: userMap.get(o.userId) || null,
      orderItems: itemsByOrderId.get(o.id) || [],
      trackingRecords: (trackingByOrderId.get(o.id) || []).sort(
        (a: any, b: any) => new Date(a.trackedAt || a.createdAt).getTime() - new Date(b.trackedAt || b.createdAt).getTime()
      ),
    }));
  }

  public async populateSingleOrder(order: any): Promise<any> {
    if (!order) return null;
    const populated = await this.populateOrders([order]);
    return populated[0] || null;
  }

  // ─── User: list own orders ────────────────────────────────────────────────
  async index(userId: number, query: any): Promise<any> {
    const perPage = parseInt(query.per_page ?? '10');
    const page = parseInt(query.page ?? '1');

    const rawOrders = await this.db.select().from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage);

    const allOrders = await this.populateOrders(rawOrders);
    return { success: true, data: { data: allOrders, current_page: page, per_page: perPage } };
  }

  private async findUserOrderByIdOrNumber(userId: number, idOrNumber: string | number) {
    const numId = Number(idOrNumber);
    let rawOrder: any = null;
    if (!isNaN(numId) && numId > 0 && String(idOrNumber).trim() === String(numId)) {
      const rows = await this.db.select().from(orders)
        .where(and(eq(orders.id, numId), eq(orders.userId, userId)))
        .limit(1);
      if (rows.length > 0) rawOrder = rows[0];
    }
    if (!rawOrder) {
      const cleanStr = String(idOrNumber).trim();
      const rows = await this.db.select().from(orders)
        .where(
          and(
            eq(orders.userId, userId),
            or(
              eq(orders.orderNumber, cleanStr),
              eq(orders.invoiceNumber, cleanStr),
              eq(orders.delhiveryWaybill, cleanStr),
            ),
          ),
        )
        .limit(1);
      if (rows.length > 0) rawOrder = rows[0];
    }
    if (!rawOrder) return null;
    return this.populateSingleOrder(rawOrder);
  }

  // ─── User: show single order ──────────────────────────────────────────────
  async show(userId: number, idOrNumber: string | number): Promise<any> {
    const order = await this.findUserOrderByIdOrNumber(userId, idOrNumber);
    if (!order) throw new NotFoundException('Order not found');
    return { success: true, data: order };
  }

  // ─── User: place order from cart ─────────────────────────────────────────
  async placeOrderFromCart(userId: number, body: any): Promise<any> {
    const cartItemsRaw = await this.db.select().from(carts).where(eq(carts.userId, userId));
    let cartItems = cartItemsRaw;
    if (body.cart_items?.length) {
      cartItems = cartItems.filter((c: any) => body.cart_items.includes(c.id));
    }
    if (!cartItems.length) {
      throw new BadRequestException('Your cart is empty. Please add items to your cart before placing an order.');
    }

    // Strict fresh database stock & active status pre-validation
    const validatedCartItems: any[] = [];
    for (const item of cartItems) {
      const [freshProd] = await this.db.select().from(products).where(eq(products.id, item.productId)).limit(1);
      if (!freshProd || freshProd.status === false) {
        throw new BadRequestException(
          `Sorry! "${freshProd?.name || 'A product in your cart'}" is currently unavailable. Please remove it from your cart.`,
        );
      }

      const [freshVar] = await this.db.select().from(variants).where(eq(variants.id, item.variantId)).limit(1);
      if (!freshVar || freshVar.status === false || freshVar.deletedAt !== null) {
        throw new BadRequestException(
          `Sorry! The variant for "${freshProd.name}" is currently unavailable. Please remove it from your cart.`,
        );
      }

      if (freshVar.stock <= 0) {
        throw new BadRequestException(
          `Sorry! "${freshProd.name}${freshVar.title ? ` (${freshVar.title})` : ''}" is currently out of stock. Please remove it to proceed.`,
        );
      }

      if (freshVar.stock < item.quantity) {
        throw new BadRequestException(
          `Sorry! Only ${freshVar.stock} items are currently available for "${freshProd.name}${freshVar.title ? ` (${freshVar.title})` : ''}". You requested ${item.quantity}. Please update your cart quantity.`,
        );
      }

      const hydratedProd = (await this.productsService.findProductWithRelations(item.productId)) || freshProd;
      validatedCartItems.push({
        ...item,
        freshProduct: hydratedProd,
        freshVariant: freshVar,
      });
    }

    const subtotal = validatedCartItems.reduce((sum: number, c: any) => {
      const unitPrice = parseFloat(c.freshVariant?.sp ?? c.freshProduct?.sp ?? '0');
      return sum + unitPrice * c.quantity;
    }, 0);
    const shippingFee = 0;
    const tax = 0;
    const total = subtotal + shippingFee + tax;
    const orderNumber = this.generateOrderNumber();
    const invoiceNumber = await this.generateUniqueInvoiceNumber();

    // Validate and sanitize shipping address
    const { sanitizedAddress } = validateAndSanitizeShippingAddress(body.shipping_address);

    const [r] = await this.db.insert(orders).values({
      orderNumber,
      invoiceNumber,
      userId,
      subtotal: subtotal.toFixed(2),
      shippingFee: '0.00',
      tax: '0.00',
      total: total.toFixed(2),
      shippingAddress: sanitizedAddress,
      billingAddress: body.billing_address ? validateAndSanitizeShippingAddress(body.billing_address).sanitizedAddress : sanitizedAddress,
      paymentMethod: 'cash_on_delivery',
      paymentStatus: 'pending',
      status: 'pending',
      notes: body.notes ?? null,
    }).$returningId();

    for (const cartItem of validatedCartItems) {
      const unitPrice = parseFloat(cartItem.freshVariant?.sp ?? cartItem.freshProduct?.sp ?? '0');
      const itemTotal = unitPrice * cartItem.quantity;
      const itemTax = calculateItemTax(cartItem.freshProduct, itemTotal, sanitizedAddress);

      await this.db.insert(orderItems).values({
        orderId: r.id,
        productId: cartItem.productId,
        variantId: cartItem.variantId,
        quantity: cartItem.quantity,
        price: unitPrice.toFixed(2),
        total: itemTotal.toFixed(2),
        selectedAttributes: cartItem.selectedAttributes,
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

      // Atomic conditional decrement to protect against concurrent purchases
      const prevStock = Number(cartItem.freshVariant?.stock ?? 0);
      const newStock = Math.max(0, prevStock - cartItem.quantity);

      await this.db
        .update(variants)
        .set({ stock: sql`stock - ${cartItem.quantity}` })
        .where(and(eq(variants.id, cartItem.variantId), gte(variants.stock, cartItem.quantity)));

      this.notificationsService.checkAndTriggerStockAlert({
        productId: cartItem.productId,
        variantId: cartItem.variantId,
        title: cartItem.freshProduct?.name || `Product #${cartItem.productId}`,
        currentStock: newStock,
        previousStock: prevStock,
      }).catch(err => this.logger.error('Failed to trigger stock alert:', err));
    }

    await this.addTracking(r.id, 'pending', 'Order placed successfully', 'Online Store');

    // Clear cart
    if (body.cart_items?.length) {
      await this.db.delete(carts).where(and(eq(carts.userId, userId), inArray(carts.id, body.cart_items)));
    } else {
      await this.db.delete(carts).where(eq(carts.userId, userId));
    }

    const orderRows = await this.db.select().from(orders).where(eq(orders.id, r.id)).limit(1);
    const order = await this.populateSingleOrder(orderRows[0]);

    // Broadcast real-time stock updates to all connected clients & carts
    this.broadcastVariantStockUpdates(
      validatedCartItems.map((c) => ({ variantId: c.variantId, productId: c.productId })),
    ).catch((err) => this.logger.error('Failed to broadcast stock updates after cart order:', err));

    // 1. Send Order Placed Email (Pending Admin Confirmation)
    this.sendOrderPlacedEmail(r.id).catch(err => this.logger.error('Failed to send order placed email:', err));

    const orderSlug = getOrderSlug(order) || order?.orderNumber || r.id;

    // Emit real-time notification to Customer
    this.notificationsService.createAndEmitNotification({
      userId,
      recipientGroup: 'customer',
      title: '🎉 Order Placed Successfully',
      message: `Your order #${order?.orderNumber || r.id} for ₹${(order as any)?.total || '0'} has been received!`,
      type: 'ORDER_PLACED',
      priority: 'HIGH',
      entityType: 'order',
      entityId: r.id,
      referenceKey: `ORDER_PLACED_${r.id}`,
      link: `/orders/${orderSlug}`,
      metadata: { orderId: r.id, orderNumber: order?.orderNumber, totalAmount: (order as any)?.total }
    }).catch(err => this.logger.error('Failed to emit customer order notification:', err));

    // Emit real-time notification to Admin Dashboard
    this.notificationsService.createAndEmitNotification({
      recipientGroup: 'admin',
      title: '🛒 New Order Placed',
      message: `New order #${order?.orderNumber || r.id} placed for ₹${(order as any)?.total || '0'}`,
      type: 'ORDER_PLACED',
      priority: 'HIGH',
      entityType: 'order',
      entityId: r.id,
      referenceKey: `ADMIN_ORDER_PLACED_${r.id}`,
      link: `/dashboard/orders/${orderSlug}`,
      metadata: { orderId: r.id, orderNumber: order?.orderNumber, totalAmount: (order as any)?.total }
    }).catch(err => this.logger.error('Failed to emit admin order notification:', err));

    return { success: true, message: 'Order placed successfully', data: order };
  }

  // ─── User: place single item order ───────────────────────────────────────
  async placeSingleItemOrder(userId: number, body: any): Promise<any> {
    const [product] = await this.db.select().from(products).where(eq(products.id, body.product_id)).limit(1);
    if (!product || product.status === false) {
      throw new BadRequestException(`Sorry! "${product?.name || 'This product'}" is currently unavailable.`);
    }

    const [variant] = await this.db.select().from(variants).where(eq(variants.id, body.variant_id)).limit(1);
    if (!variant || variant.status === false || variant.deletedAt !== null) {
      throw new BadRequestException('Sorry! The selected product variant is currently unavailable.');
    }

    if (variant.productId !== product.id) {
      throw new BadRequestException('Invalid variant for the selected product');
    }

    if (variant.stock <= 0) {
      throw new BadRequestException(`Sorry! "${product.name}${variant.title ? ` (${variant.title})` : ''}" is currently out of stock.`);
    }

    if (variant.stock < body.quantity) {
      throw new BadRequestException(`Sorry! Only ${variant.stock} items are currently available for this product.`);
    }

    const itemTotal = parseFloat(variant.sp as string) * body.quantity;
    const subtotal = itemTotal;
    const total = subtotal;
    const orderNumber = this.generateOrderNumber();
    const invoiceNumber = await this.generateUniqueInvoiceNumber();

    // Validate and sanitize shipping address
    const { sanitizedAddress } = validateAndSanitizeShippingAddress(body.shipping_address);

    const [r] = await this.db.insert(orders).values({
      orderNumber,
      invoiceNumber,
      userId,
      subtotal: subtotal.toFixed(2),
      shippingFee: '0.00',
      tax: '0.00',
      total: total.toFixed(2),
      shippingAddress: sanitizedAddress,
      billingAddress: body.billing_address ? validateAndSanitizeShippingAddress(body.billing_address).sanitizedAddress : sanitizedAddress,
      paymentMethod: 'cash_on_delivery',
      paymentStatus: 'pending',
      status: 'pending',
      notes: body.notes ?? null,
    }).$returningId();

    const hydratedProd = (await this.productsService.findProductWithRelations(body.product_id)) || product;
    const itemTax = calculateItemTax(hydratedProd, itemTotal, sanitizedAddress);

    await this.db.insert(orderItems).values({
      orderId: r.id,
      productId: body.product_id,
      variantId: body.variant_id,
      quantity: body.quantity,
      price: variant.sp,
      total: itemTotal.toFixed(2),
      selectedAttributes: body.selected_attributes ?? null,
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

    // Atomic conditional decrement stock
    const prevStock = Number(variant.stock ?? 0);
    const newStock = Math.max(0, prevStock - body.quantity);

    await this.db
      .update(variants)
      .set({ stock: sql`stock - ${body.quantity}` })
      .where(and(eq(variants.id, body.variant_id), gte(variants.stock, body.quantity)));

    this.notificationsService.checkAndTriggerStockAlert({
      productId: body.product_id,
      variantId: body.variant_id,
      title: product.name,
      currentStock: newStock,
      previousStock: prevStock,
    }).catch(err => this.logger.error('Failed to trigger stock alert:', err));

    await this.addTracking(r.id, 'pending', 'Order placed successfully', 'Online Store');

    const orderRows = await this.db.select().from(orders).where(eq(orders.id, r.id)).limit(1);
    const order = await this.populateSingleOrder(orderRows[0]);

    // Broadcast real-time stock update
    this.broadcastVariantStockUpdates([
      { variantId: body.variant_id, productId: body.product_id },
    ]).catch((err) => this.logger.error('Failed to broadcast stock update for single item order:', err));

    // 1. Send Order Placed Email (Pending Admin Confirmation)
    this.sendOrderPlacedEmail(r.id).catch(err => this.logger.error('Failed to send order placed email:', err));

    const singleOrderSlug = getOrderSlug(order) || order?.orderNumber || r.id;

    // Emit real-time notification to Customer
    this.notificationsService.createAndEmitNotification({
      userId,
      recipientGroup: 'customer',
      title: '🎉 Order Placed Successfully',
      message: `Your order #${order?.orderNumber || r.id} for ₹${(order as any)?.total || '0'} has been received!`,
      type: 'ORDER_PLACED',
      priority: 'HIGH',
      entityType: 'order',
      entityId: r.id,
      referenceKey: `ORDER_PLACED_${r.id}`,
      link: `/orders/${singleOrderSlug}`,
      metadata: { orderId: r.id, orderNumber: order?.orderNumber, totalAmount: (order as any)?.total }
    }).catch(err => this.logger.error('Failed to emit customer order notification:', err));

    // Emit real-time notification to Admin Dashboard
    this.notificationsService.createAndEmitNotification({
      recipientGroup: 'admin',
      title: '🛒 New Order Placed',
      message: `New order #${order?.orderNumber || r.id} placed for ₹${(order as any)?.total || '0'}`,
      type: 'ORDER_PLACED',
      priority: 'HIGH',
      entityType: 'order',
      entityId: r.id,
      referenceKey: `ADMIN_ORDER_PLACED_${r.id}`,
      link: `/dashboard/orders/${singleOrderSlug}`,
      metadata: { orderId: r.id, orderNumber: order?.orderNumber, totalAmount: (order as any)?.total }
    }).catch(err => this.logger.error('Failed to emit admin order notification:', err));

    return { success: true, message: 'Order placed successfully', data: order };
  }

  // ─── User: cancel order ───────────────────────────────────────────────────
  async cancelOrder(userId: number, idOrNumber: string | number): Promise<any> {
    const order = await this.findUserOrderByIdOrNumber(userId, idOrNumber);
    if (!order) throw new NotFoundException('Order not found');
    const id = order.id;

    if (!['pending', 'confirmed'].includes(order.status)) {
      throw new BadRequestException('Order cannot be cancelled');
    }

    // Restore stock
    const restoredItems: { variantId: number; productId: number }[] = [];
    for (const item of (order as any).orderItems ?? []) {
      await this.db
        .update(variants)
        .set({ stock: sql`stock + ${item.quantity}` })
        .where(eq(variants.id, item.variantId));
      restoredItems.push({ variantId: item.variantId, productId: item.productId });
    }

    if (restoredItems.length > 0) {
      this.broadcastVariantStockUpdates(restoredItems).catch(err => this.logger.error('Failed to broadcast stock update after cancellation:', err));
    }

    const previousStatus = order.status;

    await this.db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, id));
    await this.addTracking(id, 'cancelled', 'Order cancelled by customer');

    // Send status-based cancellation email
    if (previousStatus === 'confirmed') {
      this.sendConfirmedOrderCancelledEmail(id, 'Cancelled by customer').catch(err => this.logger.error('Failed to send cancellation email:', err));
    } else {
      this.sendPendingOrderCancelledEmail(id, 'Cancelled by customer').catch(err => this.logger.error('Failed to send cancellation email:', err));
    }

    const cancelOrderSlug = getOrderSlug(order) || order.orderNumber || id;

    // Emit cancellation notification to customer
    this.notificationsService.createAndEmitNotification({
      userId,
      recipientGroup: 'customer',
      title: '❌ Order Cancelled',
      message: `Your order #${order.orderNumber} has been successfully cancelled.`,
      type: 'ORDER_CANCELLED',
      priority: 'HIGH',
      entityType: 'order',
      entityId: id,
      referenceKey: `ORDER_CANCELLED_${id}`,
      link: `/orders/${cancelOrderSlug}`,
      metadata: { orderId: id, orderNumber: order.orderNumber }
    }).catch(err => this.logger.error('Failed to emit cancel notification:', err));

    const updatedRows = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    const updated = await this.populateSingleOrder(updatedRows[0]);
    return { success: true, message: 'Order cancelled successfully', data: updated };
  }

  // ─── User: get tracking ───────────────────────────────────────────────────
  async getTracking(userId: number, idOrNumber: string | number): Promise<any> {
    let order = await this.findUserOrderByIdOrNumber(userId, idOrNumber);
    if (!order) throw new NotFoundException('Order not found');
    const orderId = order.id;

    if (order.delhiveryWaybill) {
      try {
        await this.delhiveryService.syncTracking(orderId);
        const refRows = await this.db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
        if (refRows.length > 0) {
          const refreshedOrder = await this.populateSingleOrder(refRows[0]);
          if (refreshedOrder) {
            return { success: true, data: { order: refreshedOrder, tracking_records: (refreshedOrder as any).trackingRecords } };
          }
        }
      } catch (err: any) {
        this.logger.warn(`Auto-sync Delhivery tracking failed for order #${orderId}: ${err.message}`);
      }
    }

    return { success: true, data: { order, tracking_records: (order as any).trackingRecords } };
  }

  // ─── Public: Track Order by ID/Order Number and Email ───────────────────────
  async publicTrackOrder(identifier?: string, email?: string): Promise<any> {
    if (!identifier || !identifier.trim()) {
      throw new BadRequestException('Please enter your Order Number or Order ID.');
    }
    if (!email || !email.trim()) {
      throw new BadRequestException('Please enter your Email Address.');
    }

    const cleanIdentifier = identifier.trim();
    const cleanEmail = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new BadRequestException('Please enter a valid email address (e.g. customer@example.com).');
    }

    // Search conditions: exact orderNumber, numeric ID, invoiceNumber, delhiveryWaybill, or substring match
    const isNum = !isNaN(Number(cleanIdentifier));
    const cond = isNum
      ? sql`${orders.id} = ${Number(cleanIdentifier)} OR ${orders.orderNumber} = ${cleanIdentifier} OR ${orders.delhiveryWaybill} = ${cleanIdentifier} OR ${orders.orderNumber} LIKE ${`%${cleanIdentifier}%`}`
      : sql`${orders.orderNumber} = ${cleanIdentifier} OR ${orders.invoiceNumber} = ${cleanIdentifier} OR ${orders.delhiveryWaybill} = ${cleanIdentifier} OR ${orders.orderNumber} LIKE ${`%${cleanIdentifier}%`}`;

    const rows = await this.db.select().from(orders).where(cond).limit(1);
    if (rows.length === 0) {
      throw new NotFoundException(`No order found matching Order ID / Number "${cleanIdentifier}". Please check your order details.`);
    }

    let foundOrder = await this.populateSingleOrder(rows[0]);
    if (!foundOrder) {
      throw new NotFoundException(`No order found matching Order ID / Number "${cleanIdentifier}". Please check your order details.`);
    }

    // Verify email match
    const userEmail = (foundOrder as any).user?.email ? (foundOrder as any).user.email.toLowerCase().trim() : '';
    if (!userEmail || userEmail !== cleanEmail) {
      throw new BadRequestException('The provided Email Address does not match this Order. Please check your email and try again.');
    }

    // Auto-sync Delhivery if waybill present
    if (foundOrder.delhiveryWaybill) {
      try {
        await this.delhiveryService.syncTracking(foundOrder.id);
        const refRows = await this.db.select().from(orders).where(eq(orders.id, foundOrder.id)).limit(1);
        if (refRows.length > 0) {
          const refreshed = await this.populateSingleOrder(refRows[0]);
          if (refreshed) foundOrder = refreshed;
        }
      } catch (err: any) {
        this.logger.warn(`Auto-sync Delhivery failed for order #${foundOrder.id}: ${err.message}`);
      }
    }

    return {
      success: true,
      message: 'Order tracking retrieved successfully',
      data: {
        order: foundOrder,
        tracking_records: (foundOrder as any).trackingRecords || [],
      },
    };
  }

  // ─── Admin: list orders (non-completed) ───────────────────────────────────
  // ─── Admin: list active / in-processing orders (excludes completed & cancelled) ─────
  async adminIndex(query: any): Promise<any> {
    const perPage = parseInt(query.limit ?? query.per_page ?? '10');
    const page = parseInt(query.page ?? '1');
    const search = (query.search ?? '').trim().toLowerCase();
    const status = query.status;
    const paymentMethod = query.payment_method;
    const paymentStatus = query.payment_status;
    const delhiveryStatus = query.delhivery_status;
    const fromDate = query.from_date ? new Date(query.from_date) : null;
    const toDate = query.to_date ? new Date(query.to_date) : null;

    const rawOrders = await this.db.select().from(orders)
      .where(and(ne(orders.status, 'completed'), ne(orders.status, 'cancelled')))
      .orderBy(desc(orders.createdAt));

    let all = await this.populateOrders(rawOrders);

    if (status && status !== 'all' && status !== 'all_orders') {
      all = all.filter(o => o.status === status);
    }
    if (paymentMethod) {
      all = all.filter(o => o.paymentMethod === paymentMethod);
    }
    if (paymentStatus) {
      all = all.filter(o => o.paymentStatus === paymentStatus);
    }
    if (delhiveryStatus) {
      all = all.filter(o => o.delhiveryStatus === delhiveryStatus);
    }
    if (fromDate) {
      all = all.filter(o => new Date(o.createdAt) >= fromDate);
    }
    if (toDate) {
      const endOfDay = new Date(toDate);
      endOfDay.setHours(23, 59, 59, 999);
      all = all.filter(o => new Date(o.createdAt) <= endOfDay);
    }
    if (search) {
      all = all.filter(o =>
        o.orderNumber?.toLowerCase().includes(search) ||
        (o as any).user?.name?.toLowerCase().includes(search) ||
        (o as any).user?.email?.toLowerCase().includes(search) ||
        o.invoiceNumber?.toLowerCase().includes(search),
      );
    }

    const total = all.length;
    const paginated = all.slice((page - 1) * perPage, page * perPage);
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const hasNextPage = page < lastPage;

    return {
      success: true,
      data: {
        data: paginated,
        current_page: page,
        per_page: perPage,
        limit: perPage,
        total,
        last_page: lastPage,
        hasNextPage,
        has_next_page: hasNextPage,
        has_more: hasNextPage,
      },
    };
  }

  // ─── Helper: resolve order by ID, orderNumber, or invoiceNumber ───────────
  private async _resolveAdminOrder(idOrNumber: string | number, withRelations: boolean = true) {
    let order: any = null;
    const numId = Number(idOrNumber);
    if (!isNaN(numId) && numId > 0 && String(idOrNumber).trim() === String(numId)) {
      const rows = await this.db.select().from(orders).where(eq(orders.id, numId)).limit(1);
      if (rows.length > 0) order = rows[0];
    }

    if (!order) {
      const orderNumStr = String(idOrNumber).trim();
      const rows = await this.db.select().from(orders).where(
        or(
          eq(orders.orderNumber, orderNumStr),
          eq(orders.invoiceNumber, orderNumStr),
        ),
      ).limit(1);
      if (rows.length > 0) order = rows[0];
    }

    if (!order) {
      const orderNumLower = String(idOrNumber).trim().toLowerCase();
      const allOrders = await this.db.select().from(orders);
      order = allOrders.find(o =>
        (o.orderNumber && o.orderNumber.toLowerCase() === orderNumLower) ||
        (o.invoiceNumber && o.invoiceNumber.toLowerCase() === orderNumLower),
      );
    }

    if (!order) throw new NotFoundException('Order not found');
    if (!withRelations) return order;
    return this.populateSingleOrder(order);
  }

  // ─── Admin: show single order ─────────────────────────────────────────────
  async adminShow(idOrNumber: string | number): Promise<any> {
    const order = await this._resolveAdminOrder(idOrNumber, true);
    return { success: true, order };
  }

  // ─── Admin: update order status ───────────────────────────────────────────
  async adminUpdateStatus(idOrNumber: string | number, body: any): Promise<any> {
    const order = await this._resolveAdminOrder(idOrNumber, true);
    const id = Number(order.id);

    const allowedStatuses = ['confirmed', 'cancelled'];
    if (!allowedStatuses.includes(body.status)) {
      throw new BadRequestException(
        'Admin can only Accept (Confirm) or Reject (Cancel) orders. Shipping, transit, and delivery statuses are automatically managed by Delhivery.'
      );
    }

    const previousStatus = order.status;
    const newStatus = body.status;

    // 0. Avoid duplicate action/emails if status is already the same
    if (previousStatus === newStatus) {
      const refRows = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
      const updatedSame = await this.populateSingleOrder(refRows[0]);
      return { success: true, message: `Order status is already "${newStatus}"`, data: updatedSame };
    }

    const updateData: any = { status: newStatus };

    // Restore stock if cancelling
    if (newStatus === 'cancelled' && previousStatus !== 'cancelled') {
      const restoredItems: { variantId: number; productId: number }[] = [];
      for (const item of (order as any).orderItems ?? []) {
        await this.db
          .update(variants)
          .set({ stock: sql`stock + ${item.quantity}` })
          .where(eq(variants.id, item.variantId));
        restoredItems.push({ variantId: item.variantId, productId: item.productId });
      }
      if (restoredItems.length > 0) {
        this.broadcastVariantStockUpdates(restoredItems).catch(err => this.logger.error('Failed to broadcast stock update on admin cancellation:', err));
      }
    }

    await this.db.update(orders).set(updateData).where(eq(orders.id, id));
    await this.addTracking(
      id,
      newStatus,
      body.description || (newStatus === 'confirmed' ? 'Order accepted by admin' : 'Order rejected by admin'),
      body.location ?? 'Warehouse',
    );

    // ─── STRICT STATUS-BASED EMAIL NOTIFICATION TRIGGERS ───────────────────────
    if (newStatus === 'confirmed' && previousStatus !== 'confirmed') {
      // 2. Admin Accepts Order -> Send "Your Order Has Been Confirmed" + Tax Invoice PDF
      this.sendOrderConfirmedEmail(id).catch(err => this.logger.error('Failed to send order confirmed email:', err));
    } else if (newStatus === 'cancelled' && previousStatus !== 'cancelled') {
      const cancelReason = body.description || body.reason || (previousStatus === 'confirmed' ? 'Order cancelled by store administrator prior to dispatch' : 'Order rejected by store administrator');
      if (previousStatus === 'confirmed') {
        // 4. Admin Accepts First, Then Cancels Later -> Send "Your Confirmed Order Has Been Cancelled"
        this.sendConfirmedOrderCancelledEmail(id, cancelReason).catch(err => this.logger.error('Failed to send confirmed cancellation email:', err));
      } else {
        // 3. Admin Cancels a Pending Order -> Send "Your Order Has Been Cancelled"
        this.sendPendingOrderCancelledEmail(id, cancelReason).catch(err => this.logger.error('Failed to send pending cancellation email:', err));
      }
    }

    if (order.userId) {
      const statusTypeMap: Record<string, string> = {
        shipped: 'ORDER_SHIPPED',
        delivered: 'ORDER_DELIVERED',
        processing: 'ORDER_PROCESSING',
        packed: 'ORDER_PACKED',
        out_for_delivery: 'ORDER_OUT_FOR_DELIVERY',
        cancelled: 'ORDER_CANCELLED',
        confirmed: 'ORDER_CONFIRMED',
      };

      const notificationType = statusTypeMap[newStatus.toLowerCase()] || 'ORDER';
      const statusOrderSlug = getOrderSlug(order) || order.orderNumber || id;
      const customerLink = ['shipped', 'delivered', 'out_for_delivery'].includes(newStatus.toLowerCase())
        ? `/orders/${statusOrderSlug}/tracking`
        : `/orders/${statusOrderSlug}`;

      this.notificationsService.createAndEmitNotification({
        userId: order.userId,
        recipientGroup: 'customer',
        title: `📦 Order Status: ${newStatus.toUpperCase()}`,
        message: `Your order #${order.orderNumber} status is now "${newStatus.toUpperCase()}".`,
        type: notificationType,
        entityType: 'order',
        entityId: id,
        referenceKey: `ORDER_STATUS_${id}_${newStatus.toUpperCase()}_${Date.now()}`,
        link: customerLink,
        metadata: { orderId: id, orderNumber: order.orderNumber, status: newStatus }
      }).catch(err => this.logger.error('Failed to emit customer order update notification:', err));
    }

    const updatedRows = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    const updated = await this.populateSingleOrder(updatedRows[0]);

    return { success: true, message: 'Order status updated successfully', data: updated };
  }

  // ─── Admin: Bulk Accept Orders ────────────────────────────────────────────
  async bulkAcceptOrders(body: { orderIds: number[] }): Promise<any> {
    const { orderIds } = body;
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      throw new BadRequestException('Please provide an array of order IDs to accept.');
    }

    const uniqueOrderIds = Array.from(new Set(orderIds.map(Number))).filter(id => !isNaN(id) && id > 0);
    if (uniqueOrderIds.length === 0) {
      throw new BadRequestException('No valid order IDs provided.');
    }

    const results: Array<{ orderId: number; orderNumber?: string; status: string; success: boolean; reason?: string; message: string }> = [];
    let acceptedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const id of uniqueOrderIds) {
      try {
        const rows = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
        if (rows.length === 0) {
          failedCount++;
          results.push({ orderId: id, status: 'failed', success: false, reason: 'Not found', message: 'Order not found' });
          continue;
        }

        const order = await this.populateSingleOrder(rows[0]);
        if (!order) {
          failedCount++;
          results.push({ orderId: id, status: 'failed', success: false, reason: 'Not found', message: 'Order not found' });
          continue;
        }

        const orderNum = order.orderNumber || `ORD-${order.id}`;

        if (order.status === 'confirmed') {
          skippedCount++;
          results.push({ orderId: id, orderNumber: orderNum, status: 'skipped', success: false, reason: 'Already confirmed', message: 'Order is already confirmed' });
          continue;
        }

        if (order.status === 'cancelled') {
          skippedCount++;
          results.push({ orderId: id, orderNumber: orderNum, status: 'skipped', success: false, reason: 'Already cancelled', message: 'Cancelled order cannot be accepted' });
          continue;
        }

        if (['shipped', 'delivered', 'completed'].includes(order.status)) {
          skippedCount++;
          results.push({ orderId: id, orderNumber: orderNum, status: 'skipped', success: false, reason: `Already ${order.status}`, message: `Order already ${order.status}` });
          continue;
        }

        if (order.status !== 'pending') {
          skippedCount++;
          results.push({ orderId: id, orderNumber: orderNum, status: 'skipped', success: false, reason: `Status is ${order.status}`, message: `Cannot accept order in ${order.status} status` });
          continue;
        }

        // Generate invoice number if missing
        const invNum = order.invoiceNumber || await this.generateUniqueInvoiceNumber();

        // Update to confirmed
        await this.db.update(orders).set({
          status: 'confirmed',
          invoiceNumber: invNum,
        }).where(eq(orders.id, id));

        await this.addTracking(
          id,
          'confirmed',
          'Order accepted by admin in bulk',
          'Warehouse',
        );

        // Send order confirmation email with Tax Invoice PDF
        this.sendOrderConfirmedEmail(id).catch(err => this.logger.error(`Failed to send order confirmed email for order #${id}:`, err));

        // Send in-app notification
        if (order.userId) {
          const bulkAcceptSlug = getOrderSlug(order) || orderNum;
          this.notificationsService.createAndEmitNotification({
            userId: order.userId,
            recipientGroup: 'customer',
            title: '📦 Order Status: CONFIRMED',
            message: `Your order #${orderNum} status is now "CONFIRMED".`,
            type: 'ORDER_CONFIRMED',
            entityType: 'order',
            entityId: id,
            referenceKey: `ORDER_STATUS_${id}_CONFIRMED_${Date.now()}`,
            link: `/orders/${bulkAcceptSlug}`,
            metadata: { orderId: id, orderNumber: orderNum, status: 'confirmed' }
          }).catch(err => this.logger.error('Failed to emit customer order notification:', err));
        }

        acceptedCount++;
        results.push({ orderId: id, orderNumber: orderNum, status: 'confirmed', success: true, message: 'Order accepted successfully' });
      } catch (err: any) {
        failedCount++;
        results.push({ orderId: id, status: 'failed', success: false, reason: err.message, message: err.message || 'Failed to accept order' });
      }
    }

    return {
      success: true,
      processedCount: acceptedCount,
      acceptedCount,
      skippedCount,
      failedCount,
      totalRequested: uniqueOrderIds.length,
      results,
      message: `${acceptedCount} order(s) accepted successfully${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}${failedCount > 0 ? `, ${failedCount} failed` : ''}.`,
    };
  }

  // ─── Admin: Bulk Cancel Orders ────────────────────────────────────────────
  async bulkCancelOrders(body: { orderIds: number[]; reason?: string }): Promise<any> {
    const { orderIds, reason } = body;
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      throw new BadRequestException('Please provide an array of order IDs to cancel.');
    }

    const uniqueOrderIds = Array.from(new Set(orderIds.map(Number))).filter(id => !isNaN(id) && id > 0);
    if (uniqueOrderIds.length === 0) {
      throw new BadRequestException('No valid order IDs provided.');
    }

    const cancelReason = reason?.trim() || 'Order cancelled by admin in bulk';
    const results: Array<{ orderId: number; orderNumber?: string; status: string; success: boolean; reason?: string; message: string }> = [];
    let cancelledCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const allRestoredItems: { variantId: number; productId: number }[] = [];

    for (const id of uniqueOrderIds) {
      try {
        const rows = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
        if (rows.length === 0) {
          failedCount++;
          results.push({ orderId: id, status: 'failed', success: false, reason: 'Not found', message: 'Order not found' });
          continue;
        }

        const order = await this.populateSingleOrder(rows[0]);
        if (!order) {
          failedCount++;
          results.push({ orderId: id, status: 'failed', success: false, reason: 'Not found', message: 'Order not found' });
          continue;
        }

        const orderNum = order.orderNumber || `ORD-${order.id}`;
        const previousStatus = order.status;

        if (previousStatus === 'cancelled') {
          skippedCount++;
          results.push({ orderId: id, orderNumber: orderNum, status: 'skipped', success: false, reason: 'Already cancelled', message: 'Order is already cancelled' });
          continue;
        }

        if (['shipped', 'delivered', 'completed'].includes(previousStatus)) {
          skippedCount++;
          results.push({ orderId: id, orderNumber: orderNum, status: 'skipped', success: false, reason: `Already ${previousStatus}`, message: `Cannot cancel order in "${previousStatus}" status` });
          continue;
        }

        // Restore stock
        for (const item of (order as any).orderItems ?? []) {
          await this.db
            .update(variants)
            .set({ stock: sql`stock + ${item.quantity}` })
            .where(eq(variants.id, item.variantId));
          allRestoredItems.push({ variantId: item.variantId, productId: item.productId });
        }

        // Update to cancelled
        await this.db.update(orders).set({
          status: 'cancelled',
        }).where(eq(orders.id, id));

        await this.addTracking(
          id,
          'cancelled',
          cancelReason,
          'Warehouse',
        );

        // Send status-based cancellation email
        if (previousStatus === 'confirmed') {
          this.sendConfirmedOrderCancelledEmail(id, cancelReason).catch(err => this.logger.error(`Failed to send cancellation email for #${id}:`, err));
        } else {
          this.sendPendingOrderCancelledEmail(id, cancelReason).catch(err => this.logger.error(`Failed to send cancellation email for #${id}:`, err));
        }

        // Send in-app notification
        if (order.userId) {
          const bulkCancelSlug = getOrderSlug(order) || orderNum;
          this.notificationsService.createAndEmitNotification({
            userId: order.userId,
            recipientGroup: 'customer',
            title: '📦 Order Status: CANCELLED',
            message: `Your order #${orderNum} status is now "CANCELLED". Reason: ${cancelReason}`,
            type: 'ORDER_CANCELLED',
            entityType: 'order',
            entityId: id,
            referenceKey: `ORDER_STATUS_${id}_CANCELLED_${Date.now()}`,
            link: `/orders/${bulkCancelSlug}`,
            metadata: { orderId: id, orderNumber: orderNum, status: 'cancelled', reason: cancelReason }
          }).catch(err => this.logger.error('Failed to emit customer order notification:', err));
        }

        cancelledCount++;
        results.push({ orderId: id, orderNumber: orderNum, status: 'cancelled', success: true, message: 'Order cancelled successfully' });
      } catch (err: any) {
        failedCount++;
        results.push({ orderId: id, status: 'failed', success: false, reason: err.message, message: err.message || 'Failed to cancel order' });
      }
    }

    if (allRestoredItems.length > 0) {
      this.broadcastVariantStockUpdates(allRestoredItems).catch(err => this.logger.error('Failed to broadcast stock updates on bulk cancellation:', err));
    }

    return {
      success: true,
      processedCount: cancelledCount,
      cancelledCount,
      skippedCount,
      failedCount,
      totalRequested: uniqueOrderIds.length,
      results,
      message: `${cancelledCount} order(s) cancelled successfully${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}${failedCount > 0 ? `, ${failedCount} failed` : ''}.`,
    };
  }

  // ─── Admin: Bulk Create Shipments ─────────────────────────────────────────
  async bulkCreateShipments(body: { orderIds: number[] }): Promise<any> {
    return this.delhiveryService.bulkCreateShipments(body);
  }

  // ─── Admin: order stats ───────────────────────────────────────────────────
  async getOrderStats(): Promise<any> {
    const all = await this.db.select().from(orders);
    const now = new Date();
    const stats = {
      total_orders: all.length,
      pending_orders: all.filter(o => o.status === 'pending').length,
      confirmed_orders: all.filter(o => o.status === 'confirmed').length,
      processing_orders: all.filter(o => o.status === 'processing').length,
      shipped_orders: all.filter(o => o.status === 'shipped').length,
      delivered_orders: all.filter(o => o.status === 'delivered').length,
      cancelled_orders: all.filter(o => o.status === 'cancelled').length,
      completed_orders: all.filter(o => o.status === 'completed').length,
      total_revenue: all
        .filter(o => ['delivered', 'completed'].includes(o.status))
        .reduce((sum, o) => sum + parseFloat(o.total as string), 0),
      todays_orders: all.filter(o => {
        const d = new Date(o.createdAt);
        return d.toDateString() === now.toDateString();
      }).length,
      this_month_orders: all.filter(o => {
        const d = new Date(o.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
    };
    return { success: true, data: stats };
  }

  // ─── Admin: completed orders ──────────────────────────────────────────────
  async getCompletedOrders(query: any): Promise<any> {
    const perPage = parseInt(query.limit ?? query.per_page ?? '10');
    const page = parseInt(query.page ?? '1');
    const search = (query.search ?? '').trim().toLowerCase();
    const fromDate = query.from_date ? new Date(query.from_date) : null;
    const toDate = query.to_date ? new Date(query.to_date) : null;

    const rawOrders = await this.db
      .select()
      .from(orders)
      .where(eq(orders.status, 'completed'))
      .orderBy(desc(orders.deliveryConfirmedAt));

    let all = await this.populateOrders(rawOrders);

    if (fromDate) {
      all = all.filter(o => o.deliveryConfirmedAt && new Date(o.deliveryConfirmedAt) >= fromDate);
    }
    if (toDate) {
      const endOfDay = new Date(toDate);
      endOfDay.setHours(23, 59, 59, 999);
      all = all.filter(o => o.deliveryConfirmedAt && new Date(o.deliveryConfirmedAt) <= endOfDay);
    }
    if (search) {
      all = all.filter(o =>
        o.orderNumber?.toLowerCase().includes(search) ||
        (o as any).user?.name?.toLowerCase().includes(search) ||
        (o as any).user?.email?.toLowerCase().includes(search),
      );
    }

    const total = all.length;
    const paginated = all.slice((page - 1) * perPage, page * perPage);
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const hasNextPage = page < lastPage;

    return {
      success: true,
      data: {
        data: paginated,
        current_page: page,
        per_page: perPage,
        limit: perPage,
        total,
        last_page: lastPage,
        hasNextPage,
        has_next_page: hasNextPage,
        has_more: hasNextPage,
      },
    };
  }

  // ─── Admin: cancelled orders ──────────────────────────────────────────────
  async getCancelledOrders(query: any): Promise<any> {
    const perPage = parseInt(query.limit ?? query.per_page ?? '10');
    const page = parseInt(query.page ?? '1');
    const search = (query.search ?? '').trim().toLowerCase();
    const paymentMethod = query.payment_method;
    const paymentStatus = query.payment_status;
    const fromDate = query.from_date ? new Date(query.from_date) : null;
    const toDate = query.to_date ? new Date(query.to_date) : null;

    const rawOrders = await this.db
      .select()
      .from(orders)
      .where(eq(orders.status, 'cancelled'))
      .orderBy(desc(orders.updatedAt));

    let all = await this.populateOrders(rawOrders);

    if (paymentMethod) {
      all = all.filter(o => o.paymentMethod === paymentMethod);
    }
    if (paymentStatus) {
      all = all.filter(o => o.paymentStatus === paymentStatus);
    }
    if (fromDate) {
      all = all.filter(o => new Date(o.createdAt) >= fromDate);
    }
    if (toDate) {
      const endOfDay = new Date(toDate);
      endOfDay.setHours(23, 59, 59, 999);
      all = all.filter(o => new Date(o.createdAt) <= endOfDay);
    }
    if (search) {
      all = all.filter(o =>
        o.orderNumber?.toLowerCase().includes(search) ||
        (o as any).user?.name?.toLowerCase().includes(search) ||
        (o as any).user?.email?.toLowerCase().includes(search) ||
        o.invoiceNumber?.toLowerCase().includes(search),
      );
    }

    const total = all.length;
    const paginated = all.slice((page - 1) * perPage, page * perPage);
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const hasNextPage = page < lastPage;

    return {
      success: true,
      data: {
        data: paginated,
        current_page: page,
        per_page: perPage,
        limit: perPage,
        total,
        last_page: lastPage,
        hasNextPage,
        has_next_page: hasNextPage,
        has_more: hasNextPage,
      },
    };
  }

  // ─── Admin: completed order details ──────────────────────────────────────
  async getCompletedOrderDetails(idOrNumber: string | number): Promise<any> {
    const order = await this._resolveAdminOrder(idOrNumber, true);
    if (order.status !== 'completed') {
      throw new NotFoundException('Completed order not found');
    }

    const trackingList = ((order as any).trackingRecords ?? []).sort(
      (a: any, b: any) => new Date(a.trackedAt).getTime() - new Date(b.trackedAt).getTime(),
    );

    const timeline = trackingList.map((r: any) => ({
      id: r.id,
      status: r.status,
      description: r.description,
      location: r.location,
      tracked_at: r.trackedAt,
      formatted_date: new Date(r.trackedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    }));

    const statusDurations: Record<string, string> = {};
    for (let i = 0; i < trackingList.length - 1; i++) {
      const curr = trackingList[i];
      const next = trackingList[i + 1];
      const diffMs = new Date(next.trackedAt).getTime() - new Date(curr.trackedAt).getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      statusDurations[curr.status] = `${diffHours} hours`;
    }

    const orderPlacedAt = new Date(order.createdAt);
    const orderCompletedAt = order.deliveryConfirmedAt ? new Date(order.deliveryConfirmedAt) : null;
    const durationMs = orderCompletedAt ? orderCompletedAt.getTime() - orderPlacedAt.getTime() : 0;
    const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));
    const durationHours = Math.floor(durationMs / (1000 * 60 * 60));

    return {
      success: true,
      data: {
        order,
        timeline,
        duration: {
          days: durationDays,
          hours: durationHours,
          formatted: durationDays > 0 ? `${durationDays} days` : `${durationHours} hours`,
        },
        status_durations: statusDurations,
        order_placed_at: orderPlacedAt,
        order_completed_at: orderCompletedAt,
        shipped_at: order.shippedAt ?? null,
        delivered_at: order.deliveredAt ?? null,
      },
    };
  }

  // ─── Public: get order by delivery token ─────────────────────────────────
  async getOrderByToken(token: string): Promise<any> {
    const [raw] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.deliveryConfirmationToken, token))
      .limit(1);
    if (!raw) throw new NotFoundException('Invalid confirmation link');
    const order = await this.populateSingleOrder(raw);
    return { success: true, data: order };
  }

  // ─── Public: confirm delivery ─────────────────────────────────────────────
  async confirmDelivery(token: string): Promise<any> {
    const [raw] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.deliveryConfirmationToken, token))
      .limit(1);
    if (!raw) throw new NotFoundException('Invalid or expired confirmation link');
    const order = await this.populateSingleOrder(raw);
    if (order.deliveryConfirmedAt) {
      return {
        success: false,
        message: 'This order has already been confirmed',
        data: { order, confirmed_at: order.deliveryConfirmedAt },
      };
    }
    if (order.status !== 'delivered') {
      throw new BadRequestException('This order is not in delivered status');
    }

    await this.db.update(orders).set({
      status: 'completed',
      deliveryConfirmedAt: new Date(),
    }).where(eq(orders.id, order.id));

    await this.addTracking(order.id, 'completed', 'Delivery confirmed by customer', 'Customer');

    const [updatedRaw] = await this.db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    const updated = await this.populateSingleOrder(updatedRaw);

    return {
      success: true,
      message: 'Thank you! Your order has been confirmed and marked as completed.',
      data: updated,
    };
  }

  // ─── Invoice PDF & Email ──────────────────────────────────────────────────
  async getInvoicePdfBuffer(orderIdOrNumber: number | string, userId?: number): Promise<{ filename: string; buffer: Buffer }> {
    let order: any = null;
    if (userId) {
      const numId = Number(orderIdOrNumber);
      const isNum = !isNaN(numId) && numId > 0 && String(orderIdOrNumber).trim() === String(numId);
      const whereCondition = isNum
        ? and(eq(orders.id, numId), eq(orders.userId, userId))
        : and(
            or(eq(orders.orderNumber, String(orderIdOrNumber).trim()), eq(orders.invoiceNumber, String(orderIdOrNumber).trim())),
            eq(orders.userId, userId),
          );

      const [raw] = await this.db.select().from(orders).where(whereCondition).limit(1);
      order = raw ? await this.populateSingleOrder(raw) : null;
    } else {
      order = await this._resolveAdminOrder(orderIdOrNumber, true);
    }

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const allSettings = await this.db.select().from(settings);
    const settingsMap: Record<string, string> = {};
    for (const s of allSettings) {
      if (s.key && s.value) settingsMap[s.key] = s.value;
    }

    const pdfBuffer = await this.invoicePdfService.generateInvoicePdf(order, settingsMap);
    const invNum = (order as any).invoiceNumber || order.orderNumber || `ORD-${order.id}`;

    return {
      filename: `Tax_Invoice_${invNum}.pdf`,
      buffer: pdfBuffer,
    };
  }

  // ─── Status-Based Order Emails ──────────────────────────────────────────
  async sendOrderPlacedEmail(orderId: number): Promise<void> {
    try {
      const [raw] = await this.db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!raw) return;
      const order = await this.populateSingleOrder(raw);
      const user = (order as any)?.user;
      if (!user?.email) return;

      await this.mailService.sendOrderPlacedEmail(user.email, order);
      this.logger.log(`[EMAIL_DISPATCH] 📋 Order placed receipt email sent for order #${orderId} to ${user.email}`);
    } catch (err: any) {
      this.logger.error(`Failed to send order placed email for order #${orderId}: ${err.message}`);
    }
  }

  async sendOrderConfirmedEmail(orderId: number): Promise<void> {
    try {
      const [raw] = await this.db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!raw) return;
      const order = await this.populateSingleOrder(raw);
      const user = (order as any)?.user;
      if (!user?.email) return;

      const allSettings = await this.db.select().from(settings);
      const settingsMap: Record<string, string> = {};
      for (const s of allSettings) {
        if (s.key && s.value) settingsMap[s.key] = s.value;
      }

      const pdfBuffer = await this.invoicePdfService.generateInvoicePdf(order, settingsMap);
      await this.mailService.sendOrderConfirmedWithInvoice(user.email, order, pdfBuffer);
      this.logger.log(`[EMAIL_DISPATCH] 🛍️ Order confirmation & invoice email sent for order #${orderId} to ${user.email}`);
    } catch (err: any) {
      this.logger.error(`Failed to send order confirmed email for order #${orderId}: ${err.message}`);
    }
  }

  async sendPendingOrderCancelledEmail(orderId: number, reason?: string): Promise<void> {
    try {
      const [raw] = await this.db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!raw) return;
      const order = await this.populateSingleOrder(raw);
      const user = (order as any)?.user;
      if (!user?.email) return;

      await this.mailService.sendPendingOrderCancelledEmail(user.email, order, reason);
      this.logger.log(`[EMAIL_DISPATCH] ❌ Pending order cancelled email sent for order #${orderId} to ${user.email}`);
    } catch (err: any) {
      this.logger.error(`Failed to send pending order cancelled email for order #${orderId}: ${err.message}`);
    }
  }

  async sendConfirmedOrderCancelledEmail(orderId: number, reason?: string): Promise<void> {
    try {
      const [raw] = await this.db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!raw) return;
      const order = await this.populateSingleOrder(raw);
      const user = (order as any)?.user;
      if (!user?.email) return;

      await this.mailService.sendConfirmedOrderCancelledEmail(user.email, order, reason);
      this.logger.log(`[EMAIL_DISPATCH] ⚠️ Confirmed order cancelled email sent for order #${orderId} to ${user.email}`);
    } catch (err: any) {
      this.logger.error(`Failed to send confirmed order cancelled email for order #${orderId}: ${err.message}`);
    }
  }

  async sendOrderInvoiceEmail(orderId: number): Promise<void> {
    return this.sendOrderConfirmedEmail(orderId);
  }

  // ─── Admin: Build Filtered GST Rows Helper ──────────────────────────────
  private async buildFilteredGSTRows(query: any): Promise<any[]> {
    const fromDate = query.from_date ? new Date(query.from_date) : null;
    const toDate = query.to_date ? new Date(query.to_date) : null;
    const statusFilter: string | null = query.status ?? null;
    const stateFilter: string | null = query.customer_state ?? null;
    const docTypeFilter: string | null = query.document_type ?? null;
    const paymentTypeFilter: string | null = query.payment_type ?? null;
    const paymentMethodFilter: string | null = query.payment_method ?? null;

    // Fetch ALL orders (active + completed) for the report
    const rawOrders = await this.db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt));

    let allOrders = await this.populateOrders(rawOrders);

    // Date filter
    if (fromDate) {
      allOrders = allOrders.filter(o => new Date(o.createdAt) >= fromDate);
    }
    if (toDate) {
      const endOfDay = new Date(toDate);
      endOfDay.setHours(23, 59, 59, 999);
      allOrders = allOrders.filter(o => new Date(o.createdAt) <= endOfDay);
    }
    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      allOrders = allOrders.filter(o => o.status === statusFilter);
    }

    const HOME_STATE = 'Haryana';
    const INDIAN_STATES = [
      'Andaman and Nicobar Islands','Andhra Pradesh','Arunachal Pradesh','Assam',
      'Bihar','Chandigarh','Chhattisgarh','Dadra and Nagar Haveli and Daman and Diu',
      'Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu and Kashmir',
      'Jharkhand','Karnataka','Kerala','Ladakh','Lakshadweep','Madhya Pradesh',
      'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Puducherry',
      'Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
      'Uttar Pradesh','Uttarakhand','West Bengal',
    ];

    const extractState = (address: string): string => {
      if (!address) return 'Unknown';
      const lower = address.toLowerCase();
      for (const s of INDIAN_STATES) {
        if (lower.includes(s.toLowerCase())) return s;
      }
      const parts = address.split(',').map(p => p.trim());
      return parts.length >= 2 ? parts[parts.length - 2] || 'Unknown' : 'Unknown';
    };

    const normalizePayment = (raw: string): string => {
      const r = (raw || '').toLowerCase();
      if (r.includes('upi') || r.includes('gpay') || r.includes('phonepe') || r.includes('paytm')) return 'UPI';
      if (r.includes('credit')) return 'Credit Card';
      if (r.includes('debit')) return 'Debit Card';
      if (r.includes('net') || r.includes('neft') || r.includes('imps')) return 'Net Banking';
      if (r.includes('cod') || r.includes('cash')) return 'Cash';
      return raw || 'Other';
    };

    const formatDT = (d: Date): string => {
      if (!d || isNaN(d.getTime())) return 'N/A';
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      const ap = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${day}-${month}-${year} ${h}:${m} ${ap}`;
    };

    const r2 = (n: number) => Math.round(n * 100) / 100;

    const buildRows = (order: any) => {
      const rows: any[] = [];
      const orderId = `#${order.orderNumber || order.id}`;
      const createdAt = new Date(order.createdAt || '');
      const docDateTime = formatDT(createdAt);
      const shippingAddr = order.shippingAddress || '';
      const statePOS = extractState(shippingAddr);
      const paymentMode = normalizePayment(order.paymentMethod || '');
      const customerGSTIN = order.customerGstin || '';
      const items: any[] = order.orderItems || [];
      const shippingFee = r2(parseFloat(order.shippingFee || '0'));
      const firstItem = items[0] ?? {};
      const hsnCode: string =
        firstItem.hsn ||
        firstItem.product?.hsn ||
        firstItem.product?.category?.hsn ||
        firstItem.product?.category?.parent?.hsn ||
        firstItem.product?.hsnCode ||
        firstItem.product?.hsn_code ||
        'N/A';
      const gstRate = r2(parseFloat(
        firstItem.taxRate ||
        firstItem.product?.gstRate ||
        firstItem.product?.tax_rate ||
        firstItem.product?.category?.gstRate ||
        order.gstRate ||
        firstItem.gstRate ||
        firstItem.gst_rate ||
        '18'
      ));
      const hasSnapshots = items.some((it: any) => it.taxableAmount !== null && it.taxableAmount !== undefined);
      const taxableValue = hasSnapshots
        ? r2(items.reduce((sum: number, it: any) => sum + parseFloat(it.taxableAmount || '0'), 0))
        : r2(parseFloat(order.subtotal || '0') / (1 + (gstRate / 100)));

      const computeRow = (
        docType: string, docNum: string, dt: string,
        tv: number, sc: number, ds: number,
      ) => {
        const isLocal = statePOS.toLowerCase() === HOME_STATE.toLowerCase();
        const totalGST = r2(Math.abs(tv) * (gstRate / 100));
        const sign = tv < 0 ? -1 : 1;
        let cgst = 0, sgst = 0, igst = 0;
        if (isLocal) { cgst = r2(totalGST / 2 * sign); sgst = r2(totalGST / 2 * sign); }
        else { igst = r2(totalGST * sign); }
        const beforeRound = tv + sc - ds + cgst + sgst + igst;
        const rounded = Math.round(beforeRound);
        const roundOff = r2(rounded - beforeRound);
        return {
          orderId,
          documentType: docType,
          docType,
          documentNumber: docNum,
          docNumber: docNum,
          documentDateTime: dt,
          docDateTime: dt,
          customerState: statePOS,
          statePOS,
          hsnCode,
          taxableValue: r2(tv),
          shippingCharged: r2(sc),
          deductedShipping: r2(ds),
          gstRate,
          cgstAmount: cgst,
          cgst,
          sgstAmount: sgst,
          sgst,
          igstAmount: igst,
          igst,
          roundOff,
          grossAmount: r2(rounded),
          paymentMode,
          paymentMethod: paymentMode,
          customerGSTIN,
        };
      };

      // Invoice row
      const docNum = order.invoiceNumber || order.invoice_number || `INV-${order.orderNumber || order.id}`;
      const invRow = computeRow(
        'Invoice', docNum,
        docDateTime, taxableValue, shippingFee, 0,
      );
      rows.push(invRow);

      // Credit Note for returned orders
      const status = (order.status || '').toLowerCase();
      if (status === 'returned' || status === 'return') {
        const returnedAt = new Date(order.updatedAt || order.createdAt || '');
        const cnRow = computeRow(
          'Credit Note', `CN-${String(order.id).padStart(3, '0')}`,
          formatDT(returnedAt), -taxableValue, 0, shippingFee,
        );
        rows.push(cnRow);
      }
      return rows;
    };

    // Build all GST rows
    let gstRows: any[] = [];
    for (const order of allOrders) {
      gstRows.push(...buildRows(order));
    }

    // Apply additional filters on the rows
    if (stateFilter && stateFilter !== 'All') {
      gstRows = gstRows.filter(r => r.statePOS === stateFilter);
    }
    if (docTypeFilter && docTypeFilter !== 'All') {
      if (docTypeFilter === 'Invoices Only (Sales)') gstRows = gstRows.filter(r => r.docType === 'Invoice');
      if (docTypeFilter === 'Credit Notes Only (Returns)') gstRows = gstRows.filter(r => r.docType === 'Credit Note');
    }
    if (paymentTypeFilter && paymentTypeFilter !== 'All') {
      const isCOD = (r: any) => r.paymentMode === 'Cash';
      if (paymentTypeFilter === 'COD') gstRows = gstRows.filter(isCOD);
      if (paymentTypeFilter === 'Prepaid') gstRows = gstRows.filter(r => !isCOD(r));
    }
    if (paymentMethodFilter && paymentMethodFilter !== 'All') {
      gstRows = gstRows.filter(r => r.paymentMode === paymentMethodFilter);
    }

    return gstRows;
  }

  // ─── Admin: Get GST Report Paginated Data ────────────────────────────────
  async getGSTReportData(query: any): Promise<any> {
    const perPage = parseInt(query.limit ?? query.per_page ?? '10');
    const page = parseInt(query.page ?? '1');
    const search = (query.search ?? query.q ?? '').trim().toLowerCase();

    let gstRows = await this.buildFilteredGSTRows(query);

    if (search) {
      gstRows = gstRows.filter(r =>
        r.orderId.toLowerCase().includes(search) ||
        r.docNumber.toLowerCase().includes(search) ||
        r.statePOS.toLowerCase().includes(search) ||
        r.hsnCode.toLowerCase().includes(search) ||
        r.paymentMode.toLowerCase().includes(search) ||
        r.customerGSTIN.toLowerCase().includes(search)
      );
    }

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const totals = gstRows.reduce((acc, r) => ({
      taxableValue: r2(acc.taxableValue + r.taxableValue),
      shippingCharged: r2(acc.shippingCharged + r.shippingCharged),
      deductedShipping: r2(acc.deductedShipping + r.deductedShipping),
      cgstAmount: r2(acc.cgstAmount + r.cgst),
      sgstAmount: r2(acc.sgstAmount + r.sgst),
      igstAmount: r2(acc.igstAmount + r.igst),
      roundOff: r2(acc.roundOff + r.roundOff),
      grossAmount: r2(acc.grossAmount + r.grossAmount),
    }), { taxableValue: 0, shippingCharged: 0, deductedShipping: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, roundOff: 0, grossAmount: 0 });

    const invoicesCount = gstRows.filter(r => r.docType === 'Invoice').length;
    const creditNotesCount = gstRows.filter(r => r.docType === 'Credit Note').length;

    const total = gstRows.length;
    const start = (page - 1) * perPage;
    const paginated = gstRows.slice(start, start + perPage);
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const hasNextPage = page < lastPage;

    return {
      success: true,
      data: {
        rows: paginated,
        totals,
        invoices_count: invoicesCount,
        credit_notes_count: creditNotesCount,
        pagination: {
          current_page: page,
          per_page: perPage,
          limit: perPage,
          total,
          last_page: lastPage,
          hasNextPage,
          has_next_page: hasNextPage,
          has_more: hasNextPage,
        },
      },
    };
  }

  // ─── Admin: Generate GST Report Excel ────────────────────────────────────
  async generateGSTReportExcel(query: any): Promise<Buffer> {
    const gstRows = await this.buildFilteredGSTRows(query);
    const r2 = (n: number) => Math.round(n * 100) / 100;

    // Build Excel workbook
    const headers = [
      'Order ID', 'Document Type', 'Document Number', 'Document Date & Time',
      'State (POS)', 'HSN Code', 'Taxable Value (₹)', 'Shipping Charged (₹)',
      'Deducted Shipping (₹)', 'GST Rate (%)', 'CGST Amount (₹)', 'SGST Amount (₹)',
      'IGST Amount (₹)', 'Round-Off (₹)', 'Gross Amount (₹)', 'Payment Mode', 'Customer GSTIN',
    ];

    const dataRows = gstRows.map(r => [
      r.orderId, r.docType, r.docNumber, r.docDateTime,
      r.statePOS, r.hsnCode, r.taxableValue, r.shippingCharged,
      r.deductedShipping, `${r.gstRate}%`, r.cgst, r.sgst,
      r.igst, r.roundOff, r.grossAmount, r.paymentMode, r.customerGSTIN,
    ]);

    // Grand totals row
    const totals = gstRows.reduce((acc, r) => ({
      taxableValue: r2(acc.taxableValue + r.taxableValue),
      shippingCharged: r2(acc.shippingCharged + r.shippingCharged),
      deductedShipping: r2(acc.deductedShipping + r.deductedShipping),
      cgst: r2(acc.cgst + r.cgst),
      sgst: r2(acc.sgst + r.sgst),
      igst: r2(acc.igst + r.igst),
      roundOff: r2(acc.roundOff + r.roundOff),
      grossAmount: r2(acc.grossAmount + r.grossAmount),
    }), { taxableValue: 0, shippingCharged: 0, deductedShipping: 0, cgst: 0, sgst: 0, igst: 0, roundOff: 0, grossAmount: 0 });

    const totalsRow = [
      'GRAND TOTALS', '', '', '', '', '',
      totals.taxableValue, totals.shippingCharged, totals.deductedShipping,
      '', totals.cgst, totals.sgst, totals.igst, totals.roundOff, totals.grossAmount, '', '',
    ];

    const wsData = [headers, ...dataRows, totalsRow];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 24 },
      { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 20 },
      { wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 16 },
      { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 22 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GST Sales Report');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buffer as Buffer;
  }
}
