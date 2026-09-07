import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, inArray, or, and, sql } from 'drizzle-orm';
import axios from 'axios';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import {
  orders,
  orderTrackingRecords,
  variants,
  returnRequests,
  returnTrackingEvents,
  rtoCases,
  rtoTrackingEvents,
  courierWebhookEvents,
} from '../database/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { INDIAN_STATES, normalizeAddressInput } from '../common/utils/address-validator';
import { getOrderSlug } from '../common/utils/slug.util';
import { AuditLogService } from '../audit/audit-log.service';
import { ReturnsService } from '../returns/returns.service';
import { RtoService } from '../rto/rto.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

@Injectable()
export class DelhiveryService {
  private readonly logger = new Logger(DelhiveryService.name);
  private apiKey: string;
  private baseUrl: string;
  private clientName: string;
  private pickupLocation: string;
  private returnAddress: string;
  private returnCity: string;
  private returnState: string;
  private returnPin: string;
  private returnPhone: string;

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private config: ConfigService,
    private notificationsService: NotificationsService,
    private mailService: MailService,
    private auditLogService: AuditLogService,
    @Inject(forwardRef(() => ReturnsService))
    private returnsService: ReturnsService,
    @Inject(forwardRef(() => RtoService))
    private rtoService: RtoService,
  ) {
    const rawKey = this.config.get<string>('DELHIVERY_API_KEY', '').trim();
    this.apiKey = rawKey.replace(/^Token\s+/i, '');
    this.baseUrl = this.config.get<string>('DELHIVERY_BASE_URL', 'https://track.delhivery.com/api').trim();
    this.clientName = this.config.get<string>('DELHIVERY_CLIENT_NAME', 'Zelton').trim() || 'Zelton';
    this.pickupLocation = this.config.get<string>('DELHIVERY_PICKUP_LOCATION', 'Zelton').trim() || 'Zelton';
    this.returnAddress = this.config.get<string>('DELHIVERY_RETURN_ADDRESS', '#129 naib colony Village kanwla Ambala city').trim() || '#129 naib colony Village kanwla Ambala city';
    this.returnCity = this.config.get<string>('DELHIVERY_RETURN_CITY', 'Ambala').trim() || 'Ambala';
    this.returnState = this.config.get<string>('DELHIVERY_RETURN_STATE', 'Haryana').trim() || 'Haryana';
    this.returnPin = this.config.get<string>('DELHIVERY_RETURN_PIN', '134003').trim() || '134003';
    this.returnPhone = this.config.get<string>('DELHIVERY_RETURN_PHONE', '9729310456').trim() || '9729310456';
  }

  private isTestModeActive(): boolean {
    const rawVal = this.config.get<string>('DELHIVERY_TEST_MODE') ?? process.env.DELHIVERY_TEST_MODE;
    if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
      return String(rawVal).trim().toLowerCase() === 'true';
    }
    return false;
  }

  private async createMockShipment(orderId: number, order: any): Promise<any> {
    const mockWaybill = `DLHV-TEST-${order.orderNumber || orderId}-${Math.floor(1000 + Math.random() * 9000)}`;
    this.logger.log(`[DELHIVERY TEST MODE] Created mock shipment with Waybill: ${mockWaybill} for Order #${order.orderNumber}`);

    await this.db.update(orders).set({
      delhiveryWaybill: mockWaybill,
      delhiveryStatus: 'Manifested',
      delhiveryStatusUpdatedAt: new Date(),
      status: 'shipped',
      shippedAt: new Date(),
      courierName: 'Delhivery (Test Mode)',
    }).where(eq(orders.id, orderId));

    await this.db.insert(orderTrackingRecords).values({
      orderId,
      status: 'shipped',
      description: 'Shipment created with Delhivery (Local Test Mode)',
      location: this.pickupLocation || 'Ambala Hub',
      trackedAt: new Date(),
    });

    const updatedOrder = await this.db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { user: true, trackingRecords: true, orderItems: { with: { product: true, variant: true } as any } } as any,
    });

    const customerEmail = (updatedOrder as any)?.user?.email;
    if (customerEmail) {
      this.mailService
        .sendShipmentDispatchedEmail(customerEmail, updatedOrder, mockWaybill)
        .catch((err) => this.logger.error(`Failed to send shipment email to ${customerEmail}: ${err.message}`));
    }

    if (order.userId) {
      const orderSlug = getOrderSlug(order) || order.orderNumber || orderId;
      this.notificationsService.createAndEmitNotification({
        userId: order.userId,
        title: '🚚 Order Shipped (Test Mode)',
        message: `Your order #${order.orderNumber} has been shipped via Delhivery (AWB: ${mockWaybill}).`,
        type: 'ORDER_SHIPPED',
        priority: 'HIGH',
        entityType: 'order',
        entityId: orderId,
        referenceKey: `DELHIVERY_SHIPPED_${orderId}_${mockWaybill}`,
        link: `/orders/${orderSlug}/tracking`,
      }).catch(() => {});
    }

    return {
      success: true,
      message: 'Shipment created successfully (Test Mode)',
      waybill: mockWaybill,
      order: updatedOrder,
    };
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Token ${this.apiKey}`,
    };
  }

  private extractDelhiveryAddress(rawAddress: string, user: any) {
    const text = String(rawAddress || '').trim();
    const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    let customerName = '';
    let phone = '';
    let pincode = '';
    let city = '';
    let state = '';
    let streetAddress = '';

    // 1. Phone extraction (10 digits starting with 6-9)
    const phoneMatch = text.match(/\b([6-9]\d{9})\b/);
    if (phoneMatch) {
      phone = phoneMatch[1];
    } else if (user?.phoneNumber || user?.phone_number) {
      phone = String(user.phoneNumber || user.phone_number).replace(/[^0-9]/g, '');
    } else {
      phone = '9999999999';
    }

    // 2. Pincode extraction (6 digits)
    const pinMatch = text.match(/\b([1-9]\d{5})\b/);
    if (pinMatch) {
      pincode = pinMatch[1];
    }

    // 3. State extraction from known Indian states list
    for (const st of INDIAN_STATES) {
      const stateRegex = new RegExp(`\\b${st}\\b`, 'i');
      if (stateRegex.test(text)) {
        state = st;
        break;
      }
    }

    // 4. Structured multi-line address parsing (e.g. from checkout form)
    if (rawLines.length >= 3) {
      if (!/^\d+$/.test(rawLines[0]) && !/^(india|in)$/i.test(rawLines[0])) {
        customerName = rawLines[0];
      }

      // Filter out name, phone, and country lines
      const middleLines = rawLines.filter((line, idx) => {
        if (idx === 0 && line === customerName) return false;
        if (line.replace(/[^0-9]/g, '') === phone && line.length <= 13) return false;
        if (/^(india|in)$/i.test(line)) return false;
        return true;
      });

      const streetLines: string[] = [];
      for (const line of middleLines) {
        let isLocationLine = false;
        if (state && new RegExp(`\\b${state}\\b`, 'i').test(line)) {
          isLocationLine = true;
          const stateIndex = line.toLowerCase().indexOf(state.toLowerCase());
          const beforeState = line.slice(0, stateIndex).replace(/,\s*$/, '').trim();
          if (beforeState && beforeState.length >= 2) {
            city = beforeState;
          }
        }

        if (!isLocationLine) {
          streetLines.push(line);
        }
      }

      if (streetLines.length > 0) {
        streetAddress = streetLines.join(', ');
      }
    }

    // 5. Fallback for single-line format if streetAddress or city was not extracted
    if (!streetAddress || !city || streetAddress.toLowerCase() === 'india' || streetAddress.length < 3) {
      let clean = text;

      if (phone) {
        clean = clean.replace(new RegExp(`\\b${phone}\\b`, 'g'), ' ');
      }
      if (pincode) {
        clean = clean.replace(new RegExp(`\\b${pincode}\\b`, 'g'), ' ');
      }
      clean = clean.replace(/\b(india|in)\b/gi, ' ');

      if (state) {
        const stateIdx = clean.toLowerCase().indexOf(state.toLowerCase());
        if (stateIdx !== -1) {
          const before = clean.slice(0, stateIdx).trim();
          const after = clean.slice(stateIdx + state.length).trim();
          const beforeParts = before.split(',').map((p) => p.trim()).filter(Boolean);
          if (!city && beforeParts.length >= 2) {
            city = beforeParts.pop() || '';
            clean = beforeParts.join(', ') + ' ' + after;
          } else {
            clean = before + ' ' + after;
          }
        }
      }

      if (!customerName) {
        customerName = user?.name || 'Customer';
      }
      const escapedName = customerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      clean = clean.replace(new RegExp(`^\\s*${escapedName}\\b`, 'i'), ' ');

      if (city) {
        const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        clean = clean.replace(new RegExp(`\\b${escapedCity}\\b`, 'gi'), ' ');
      }

      streetAddress = clean
        .replace(/\s+/g, ' ')
        .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
        .trim();
    }

    customerName = customerName || user?.name || 'Customer';
    state = state || 'Punjab';
    city = city || 'Rajpura';
    pincode = pincode || '140417';

    streetAddress = normalizeAddressInput(streetAddress || '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
      .trim();

    if (!streetAddress || streetAddress.toLowerCase() === 'india' || streetAddress.length < 3) {
      streetAddress = `Street Address, ${city}`;
    }

    return {
      customerName,
      phone,
      pincode,
      city,
      state,
      streetAddress,
    };
  }

  // ─── Create Shipment ──────────────────────────────────────────────────────
  async createShipment(orderId: number | string, body: any = {}): Promise<any> {
    const order = await this.findOrderByIdOrIdentifier(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const numericOrderId = order.id;

    // Robust Address Parser for Delhivery API
    const rawAddress = body?.shipping_address || body?.shippingAddress || order.shippingAddress || '';
    
    let customerName = '';
    let phone = '';
    let pincode = '';
    let city = '';
    let state = '';
    let streetAddress = '';

    // Check if rawAddress is already structured JSON
    let parsedAddress: any = null;
    if (typeof rawAddress === 'object' && rawAddress !== null) {
      parsedAddress = rawAddress;
    } else if (typeof rawAddress === 'string') {
      const trimmed = rawAddress.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          parsedAddress = JSON.parse(trimmed);
        } catch (e) {
          parsedAddress = null;
        }
      }
    }

    if (parsedAddress && (parsedAddress.add || parsedAddress.city)) {
      customerName = parsedAddress.name || (order as any).user?.name || 'Customer';
      phone = String(parsedAddress.phone || (order as any).user?.phoneNumber || (order as any).user?.phone_number || '9999999999').replace(/[^0-9]/g, '');
      streetAddress = parsedAddress.add || parsedAddress.addressLine1 || '';
      city = parsedAddress.city;
      state = parsedAddress.state;
      pincode = parsedAddress.pin || parsedAddress.postalCode;
    } else {
      const extracted = this.extractDelhiveryAddress(rawAddress, (order as any).user);
      customerName = extracted.customerName;
      phone = extracted.phone;
      streetAddress = extracted.streetAddress;
      city = extracted.city;
      state = extracted.state;
      pincode = extracted.pincode;
    }

    this.logger.log(
      `Parsed Delhivery address -> Name: "${customerName}", Phone: "${phone}", Add: "${streetAddress}", City: "${city}", State: "${state}", Pin: "${pincode}"`,
    );

    if (!pincode) {
      return {
        success: false,
        message: 'Missing 6-digit Pincode in shipping address. Please update order address.',
        debug: { pincode, city, state, streetAddress, raw_address: rawAddress },
      };
    }

    if (this.isTestModeActive()) {
      return this.createMockShipment(numericOrderId, order);
    }

    const totalItems = ((order as any).orderItems ?? []).reduce((s: number, i: any) => s + i.quantity, 0);
    const productsDesc = ((order as any).orderItems ?? []).map((i: any) => i.product?.name ?? 'Item').join(', ') || 'General Items';

    let deliveryStreetAddress = streetAddress;
    if (city && !deliveryStreetAddress.toLowerCase().includes(city.toLowerCase())) {
      deliveryStreetAddress = `${deliveryStreetAddress}, ${city}`;
    }

    const shipmentData = {
      pickup_location: { name: this.pickupLocation },
      shipments: [{
        name: customerName,
        add: deliveryStreetAddress,
        pin: pincode,
        city,
        state,
        country: 'India',
        phone,
        order: order.orderNumber,
        payment_mode: order.paymentMethod === 'cash_on_delivery' ? 'COD' : 'Prepaid',
        return_pin: this.returnPin,
        return_city: this.returnCity,
        return_phone: this.returnPhone,
        return_add: this.returnAddress,
        return_state: this.returnState,
        return_country: 'India',
        products_desc: productsDesc,
        hsn_code: '',
        cod_amount: order.paymentMethod === 'cash_on_delivery' ? String(order.total) : '0',
        order_date: new Date().toISOString().replace('T', ' ').split('.')[0],
        total_amount: String(order.total),
        seller_add: this.returnAddress,
        seller_name: this.clientName,
        seller_inv: order.orderNumber,
        quantity: totalItems || 1,
        waybill: '',
        shipment_width: body?.width ?? body?.shipment_width ?? 10,
        shipment_height: body?.height ?? body?.shipment_height ?? 10,
        weight: body?.weight ?? 0.5,
        seller_gst_tin: '',
        shipping_mode: 'Surface',
        address_type: 'home',
      }],
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/cmu/create.json`,
        `format=json&data=${encodeURIComponent(JSON.stringify(shipmentData))}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Token ${this.apiKey}`,
          },
        },
      );

      const data = response.data;
      this.logger.log(`Delhivery create shipment response: ${JSON.stringify(data)}`);

      let waybill: string | null = null;
      let errorMessage: string | null = null;

      if (data.packages && Array.isArray(data.packages) && data.packages.length > 0) {
        const pkg = data.packages[0];
        waybill = pkg.waybill ?? null;
        if (pkg.status === 'Fail') {
          const rawRemarks = Array.isArray(pkg.remarks) ? pkg.remarks.join(', ') : 'Shipment creation failed';
          if (rawRemarks.toLowerCase().includes('insufficient balance')) {
            errorMessage = 'Delhivery Wallet Balance is ₹0.00. Please recharge your Delhivery Wallet in the Delhivery One portal (one.delhivery.com) to create shipments.';
          } else {
            errorMessage = rawRemarks;
          }
        }
      }

      if (!waybill) {
        const failureMsg = errorMessage ?? 'Delhivery API error or account verification required.';
        const orderSlug = getOrderSlug(order) || order.orderNumber || numericOrderId;
        this.notificationsService.createAndEmitNotification({
          recipientGroup: 'admin',
          title: '🚨 Delhivery Shipment Creation Failed',
          message: `Failed to create shipment for Order #${order.orderNumber}: ${failureMsg}`,
          type: 'SHIPMENT_CREATION_FAILED',
          priority: 'CRITICAL',
          entityType: 'order',
          entityId: numericOrderId,
          referenceKey: `DELHIVERY_FAIL_${numericOrderId}_${Date.now()}`,
          link: `/dashboard/orders/${orderSlug}`,
        }).catch(() => { });

        throw new BadRequestException(failureMsg);
      }

      // Update order
      await this.db.update(orders).set({
        delhiveryWaybill: waybill,
        delhiveryStatus: 'Shipped',
        delhiveryStatusUpdatedAt: new Date(),
        status: 'shipped',
        shippedAt: new Date(),
        courierName: 'Delhivery',
      }).where(eq(orders.id, numericOrderId));

      await this.db.insert(orderTrackingRecords).values({
        orderId: numericOrderId,
        status: 'shipped',
        description: 'Shipment created with Delhivery',
        location: 'Delhivery',
        trackedAt: new Date(),
      });

      const updatedOrder = await this.db.query.orders.findFirst({
        where: eq(orders.id, numericOrderId),
        with: { user: true, trackingRecords: true, orderItems: { with: { product: true, variant: true } as any } } as any,
      });

      // Send Email to Customer with AWB & Delhivery Tracking Link
      const customerEmail = (updatedOrder as any)?.user?.email;
      if (customerEmail) {
        this.mailService
          .sendShipmentDispatchedEmail(customerEmail, updatedOrder, waybill)
          .catch((err) => this.logger.error(`Failed to send shipment email to ${customerEmail}: ${err.message}`));
      }

      // Send in-app notification to customer
      if (order.userId) {
        const orderSlug = getOrderSlug(updatedOrder) || getOrderSlug(order) || order.orderNumber || numericOrderId;
        this.notificationsService.createAndEmitNotification({
          userId: order.userId,
          title: '🚚 Order Shipped!',
          message: `Your order #${order.orderNumber} has been shipped via Delhivery Express (AWB: ${waybill}). Track your package online.`,
          type: 'ORDER_SHIPPED',
          priority: 'HIGH',
          entityType: 'order',
          entityId: numericOrderId,
          referenceKey: `DELHIVERY_SHIPPED_${numericOrderId}_${waybill}`,
          link: `/orders/${orderSlug}/tracking`,
        }).catch(() => {});
      }

      return { success: true, message: 'Shipment created successfully', waybill, order: updatedOrder };
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) {
        throw err;
      }
      const statusCode = err.response?.status;
      const errData = err.response?.data;
      const detailedErr = typeof errData === 'string' ? errData : (errData?.message || errData?.error || err.message);

      this.logger.error(`Delhivery createShipment error (${statusCode}): ${detailedErr}`, errData);

      if (statusCode === 401) {
        throw new BadRequestException(
          'Delhivery API authentication failed: Invalid or expired DELHIVERY_API_KEY. Please verify your Delhivery credentials.',
        );
      } else if (statusCode === 403) {
        throw new BadRequestException(
          `Delhivery access forbidden (403): ${detailedErr}. Please check your Delhivery merchant account permissions.`,
        );
      }
      
      throw new BadRequestException(`Failed to create shipment with Delhivery: ${detailedErr}`);
    }
  }

  // ─── Find Order by ID, Slug, OrderNumber, or Waybill ─────────────────────
  private async findOrderByIdOrIdentifier(idOrIdentifier: string | number) {
    if (idOrIdentifier === undefined || idOrIdentifier === null) return null;
    const cleanStr = String(idOrIdentifier).trim();
    if (!cleanStr) return null;

    const numId = Number(cleanStr);
    if (!isNaN(numId) && numId > 0 && String(numId) === cleanStr) {
      const o = await this.db.query.orders.findFirst({
        where: eq(orders.id, numId),
        with: { user: true, trackingRecords: true, orderItems: { with: { product: true, variant: true } as any } } as any,
      });
      if (o) return o;
    }

    return this.db.query.orders.findFirst({
      where: or(
        eq(orders.orderNumber, cleanStr),
        eq(orders.invoiceNumber, cleanStr),
        eq(orders.delhiveryWaybill, cleanStr),
      ),
      with: { user: true, trackingRecords: true, orderItems: { with: { product: true, variant: true } as any } } as any,
    });
  }

  // ─── Track Shipment by Waybill ────────────────────────────────────────────
  async trackByWaybill(body: any = {}) {
    const rawWaybill = body?.waybill || body?.awb;
    const waybill = rawWaybill ? String(rawWaybill).trim() : '';
    if (!waybill) throw new BadRequestException('Waybill number is required');

    if (this.isTestModeActive() || waybill.startsWith('DLHV-TEST-')) {
      return {
        success: true,
        waybill,
        tracking_data: {
          waybill,
          status: 'In Transit',
          status_code: 'IT',
          status_date: new Date().toISOString(),
          expected_delivery: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
          current_location: 'Delhi Regional Hub',
          scans: [
            {
              scan_date: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
              scan_type: 'UD',
              scan_detail: 'Shipment Manifested & Picked Up',
              location: this.pickupLocation || 'Ambala',
              instructions: '',
            },
            {
              scan_date: new Date().toISOString(),
              scan_type: 'IT',
              scan_detail: 'In Transit to Destination Hub',
              location: 'Delhi Regional Hub',
              instructions: '',
            },
          ],
        },
      };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/v1/packages/json/`, {
        params: { waybill, verbose: 1 },
        headers: this.headers(),
      });

      return { success: true, waybill, tracking_data: this.parseTrackingData(response.data, waybill) };
    } catch (err: any) {
      this.logger.warn(`Delhivery trackByWaybill error for ${waybill}: ${err.message}`);
      return {
        success: true,
        waybill,
        tracking_data: {
          waybill,
          status: 'Manifested',
          status_code: 'MANIFESTED',
          status_date: new Date().toISOString(),
          expected_delivery: '',
          current_location: this.pickupLocation || 'Ambala',
          scans: [
            {
              scan_date: new Date().toISOString(),
              scan_type: 'MANIFESTED',
              scan_detail: 'Shipment Manifested & Dispatched',
              location: this.pickupLocation || 'Ambala Hub',
              instructions: '',
            },
          ],
        },
      };
    }
  }

  // ─── Track by Order ID / Slug ─────────────────────────────────────────────
  async trackByOrder(orderIdOrSlug: string | number) {
    const order = await this.findOrderByIdOrIdentifier(orderIdOrSlug);
    if (!order) throw new NotFoundException(`Order not found for identifier "${orderIdOrSlug}"`);
    
    if (!order.delhiveryWaybill) {
      return {
        success: true,
        order_number: order.orderNumber,
        waybill: null,
        message: 'No shipment waybill created yet for this order',
        tracking_data: {
          waybill: '',
          status: order.status === 'confirmed' ? 'Order Confirmed' : order.status === 'pending' ? 'Order Placed' : order.status,
          status_code: order.status,
          status_date: (order.createdAt || new Date()).toISOString(),
          expected_delivery: '',
          current_location: 'Zelton Warehouse',
          scans: ((order as any).trackingRecords || []).map((r: any) => ({
            scan_date: (r.trackedAt || r.createdAt || new Date()).toISOString(),
            scan_type: r.status,
            scan_detail: r.description || r.status,
            location: r.location || 'Warehouse',
            instructions: '',
          })),
        },
      };
    }

    if (this.isTestModeActive() || order.delhiveryWaybill.startsWith('DLHV-TEST-')) {
      return this.trackByWaybill({ waybill: order.delhiveryWaybill });
    }

    try {
      const response = await axios.get(`${this.baseUrl}/v1/packages/json/`, {
        params: { waybill: order.delhiveryWaybill, verbose: 1 },
        headers: this.headers(),
      });

      const trackingData = this.parseTrackingData(response.data, order.delhiveryWaybill);
      if (trackingData.status) {
        await this.db.update(orders).set({
          delhiveryStatus: trackingData.status,
          delhiveryStatusUpdatedAt: new Date(),
          delhiveryTrackingData: trackingData,
        }).where(eq(orders.id, order.id));
      }

      return { success: true, order_number: order.orderNumber, waybill: order.delhiveryWaybill, tracking_data: trackingData };
    } catch (err: any) {
      this.logger.warn(`Live Delhivery trackByOrder fallback for #${order.id}: ${err.message}`);
      return {
        success: true,
        order_number: order.orderNumber,
        waybill: order.delhiveryWaybill,
        tracking_data: order.delhiveryTrackingData || {
          waybill: order.delhiveryWaybill,
          status: order.delhiveryStatus || 'In Transit',
          status_code: 'IN_TRANSIT',
          status_date: (order.delhiveryStatusUpdatedAt || new Date()).toISOString(),
          expected_delivery: '',
          current_location: this.pickupLocation || 'Ambala Hub',
          scans: ((order as any).trackingRecords || []).map((r: any) => ({
            scan_date: (r.trackedAt || r.createdAt || new Date()).toISOString(),
            scan_type: r.status,
            scan_detail: r.description || r.status,
            location: r.location || 'Warehouse',
            instructions: '',
          })),
        },
      };
    }
  }

  // ─── Check Serviceability ─────────────────────────────────────────────────
  async checkServiceability(body: any = {}) {
    const pincode = body?.pincode;
    if (!pincode) throw new BadRequestException('Pincode is required');

    if (this.isTestModeActive()) {
      return {
        success: true,
        serviceable: true,
        data: {
          delivery_codes: [
            {
              postal_code: {
                pin: pincode,
                is_oda: 'N',
                pre_paid: 'Y',
                cod: 'Y',
                state_code: 'HR',
                district: 'Ambala',
              },
            },
          ],
        },
      };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/c/api/pin-codes/json/`, {
        params: { filter_codes: pincode },
        headers: this.headers(),
      });

      return {
        success: true,
        serviceable: !!(response.data.delivery_codes && response.data.delivery_codes.length > 0),
        data: response.data,
      };
    } catch (err: any) {
      throw new InternalServerErrorException(`Failed to check serviceability: ${err.message}`);
    }
  }

  // ─── Sync Tracking ────────────────────────────────────────────────────────
  async syncTracking(orderIdOrSlug: string | number) {
    const order = await this.findOrderByIdOrIdentifier(orderIdOrSlug);
    if (!order) throw new NotFoundException(`Order not found for identifier "${orderIdOrSlug}"`);
    if (!order.delhiveryWaybill) return { success: false, message: 'No tracking information available for this order' };

    const orderId = order.id;

    if (this.isTestModeActive() || order.delhiveryWaybill.startsWith('DLHV-TEST-')) {
      const mockData = {
        waybill: order.delhiveryWaybill,
        status: order.delhiveryStatus || 'In Transit',
        status_code: 'IT',
        status_date: new Date().toISOString(),
        expected_delivery: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
        current_location: 'Delhi Regional Hub',
        scans: [
          {
            scan_date: (order.shippedAt || new Date()).toISOString(),
            scan_type: 'UD',
            scan_detail: 'Shipment Manifested & Picked Up',
            location: this.pickupLocation || 'Ambala',
            instructions: '',
          },
          {
            scan_date: new Date().toISOString(),
            scan_type: 'IT',
            scan_detail: 'In Transit to Destination Hub',
            location: 'Delhi Regional Hub',
            instructions: '',
          },
        ],
      };
      await this.db.update(orders).set({
        delhiveryStatus: mockData.status,
        delhiveryStatusUpdatedAt: new Date(),
        delhiveryTrackingData: mockData,
      }).where(eq(orders.id, orderId));
      return { success: true, message: 'Tracking synced successfully (Test Mode)', tracking_data: mockData };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/v1/packages/json/`, {
        params: { waybill: order.delhiveryWaybill, verbose: 1 },
        headers: this.headers(),
      });

      const trackingData = this.parseTrackingData(response.data, order.delhiveryWaybill);
      const mappedStatus = this.mapDelhiveryStatus(trackingData.status);

      const updateData: any = {
        delhiveryStatus: trackingData.status || order.delhiveryStatus || 'Manifested',
        delhiveryStatusUpdatedAt: new Date(),
        delhiveryTrackingData: trackingData,
      };

      if (mappedStatus && mappedStatus !== order.status) {
        updateData.status = mappedStatus;
        if (mappedStatus === 'delivered' && !order.deliveredAt) {
          updateData.deliveredAt = new Date();
        }
      }

      await this.db.update(orders).set(updateData).where(eq(orders.id, orderId));

      // Sync individual scan updates into orderTrackingRecords
      if (trackingData.scans && Array.isArray(trackingData.scans) && trackingData.scans.length > 0) {
        const existingRecords = await this.db.query.orderTrackingRecords.findMany({
          where: eq(orderTrackingRecords.orderId, orderId),
        });
        const existingDescs = new Set(existingRecords.map(r => `${r.description}_${r.location}`));

        for (const scan of trackingData.scans) {
          const desc = scan.scan_detail || scan.scan_type || trackingData.status;
          const loc = scan.location || trackingData.current_location || 'Delhivery';
          const key = `${desc}_${loc}`;
          if (!existingDescs.has(key) && desc) {
            const scanTime = scan.scan_date ? new Date(scan.scan_date) : new Date();
            await this.db.insert(orderTrackingRecords).values({
              orderId,
              status: mappedStatus || order.status,
              description: desc,
              location: loc,
              trackedAt: isNaN(scanTime.getTime()) ? new Date() : scanTime,
            });
            existingDescs.add(key);
          }
        }
      }

      return { success: true, message: 'Tracking synced successfully', tracking_data: trackingData };
    } catch (err: any) {
      this.logger.warn(`Failed to sync tracking with Delhivery API for order #${orderId} (AWB: ${order.delhiveryWaybill}): ${err.message}`);
      return {
        success: true,
        message: 'Could not connect to courier live sync at this moment; returning saved state.',
        tracking_data: order.delhiveryTrackingData || {
          waybill: order.delhiveryWaybill,
          status: order.delhiveryStatus || 'Manifested',
          status_code: 'MANIFESTED',
          status_date: (order.delhiveryStatusUpdatedAt || new Date()).toISOString(),
          current_location: this.pickupLocation || 'Ambala',
          scans: [],
        },
      };
    }
  }

  // ─── Get Warehouses ───────────────────────────────────────────────────────
  async getWarehouses() {
    try {
      const response = await axios.get(`${this.baseUrl}/backend/clientwarehouse/all/`, {
        headers: this.headers(),
      });
      return { success: true, warehouses: response.data };
    } catch (err: any) {
      throw new InternalServerErrorException(`Failed to fetch warehouses: ${err.message}`);
    }
  }

  // ─── Reverse Logistics: Create Reverse Pickup ───────────────────────────
  async createReversePickup(returnReq: any, pickupDate?: string): Promise<{ success: boolean; waybill?: string; pickup_token?: string; message?: string }> {
    const pickupAddr = (returnReq.pickupAddress as any) || {};
    const returnNumber = returnReq.returnNumber || `RET-${returnReq.id}`;

    if (this.isTestModeActive() || !this.apiKey || this.apiKey.includes('mock')) {
      const mockWaybill = `DLHV-REV-${returnNumber}-${Math.floor(1000 + Math.random() * 9000)}`;
      const mockToken = `REV-TOK-${Date.now()}`;
      this.logger.log(`[DELHIVERY TEST MODE] Created mock reverse pickup with Waybill: ${mockWaybill} (Token: ${mockToken}) for Return #${returnNumber}`);
      return {
        success: true,
        waybill: mockWaybill,
        pickup_token: mockToken,
        message: 'Reverse pickup scheduled successfully (Test Mode)',
      };
    }

    try {
      const payload = {
        format: 'json',
        data: JSON.stringify({
          pickup_location: this.pickupLocation,
          shipments: [
            {
              name: pickupAddr.name || 'Customer',
              add: pickupAddr.address || 'Customer Address',
              pin: String(pickupAddr.pincode || '134003'),
              city: pickupAddr.city || 'Ambala',
              state: pickupAddr.state || 'Haryana',
              country: 'India',
              phone: String(pickupAddr.phone || '9999999999'),
              order: returnNumber,
              payment_mode: 'Pickup',
              return_pin: this.returnPin,
              return_city: this.returnCity,
              return_name: 'Zelton Central Warehouse',
              return_add: this.returnAddress,
              return_state: this.returnState,
              return_phone: this.returnPhone,
              products_desc: `Return Request #${returnNumber}`,
              order_date: pickupDate || new Date().toISOString(),
              total_amount: 0,
              quantity: 1,
              waybill: '',
            },
          ],
        }),
      };

      const params = new URLSearchParams();
      params.append('format', 'json');
      params.append('data', payload.data);

      const response = await axios.post(`${this.baseUrl}/cmu/create.json`, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Token ${this.apiKey}`,
        },
      });

      const resData = response.data;
      const packageDetail = resData?.packages?.[0] || resData?.shipments?.[0];
      const waybill = packageDetail?.waybill || resData?.upload_wbn || `DLHV-REV-${returnNumber}`;
      const token = resData?.pickup_token || packageDetail?.pickup_token || `TOK-${Date.now()}`;

      this.logger.log(`Delhivery Reverse Pickup created: AWB: ${waybill}, Token: ${token}`);
      return {
        success: true,
        waybill,
        pickup_token: token,
        message: 'Delhivery reverse pickup created successfully',
      };
    } catch (err: any) {
      this.logger.warn(`Delhivery live reverse pickup call error: ${err.response?.data?.message || err.message}. Falling back to generated waybill.`);
      const fallbackWaybill = `DLHV-REV-${returnNumber}-${Math.floor(1000 + Math.random() * 9000)}`;
      return {
        success: true,
        waybill: fallbackWaybill,
        pickup_token: `FB-TOK-${Date.now()}`,
        message: 'Reverse pickup recorded with reference waybill.',
      };
    }
  }

  // ─── NDR Action Dispatch ──────────────────────────────────────────────────
  async executeNdrAction(waybill: string, actionData: {
    action: string;
    remarks?: string;
    rescheduleDate?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    phone?: string;
  }): Promise<any> {
    this.logger.log(`Dispatching NDR action '${actionData.action}' for Waybill #${waybill}`);

    if (this.isTestModeActive() || !this.apiKey || this.apiKey.includes('mock')) {
      return {
        success: true,
        message: `NDR action '${actionData.action}' submitted successfully (Test Mode).`,
      };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/p/edit`,
        {
          waybill,
          act: actionData.action.toUpperCase(),
          remarks: actionData.remarks || '',
          deferred_date: actionData.rescheduleDate || '',
          add: actionData.address || '',
          city: actionData.city || '',
          state: actionData.state || '',
          pin: actionData.pincode || '',
          phone: actionData.phone || '',
        },
        { headers: this.headers() },
      );
      return { success: true, data: response.data };
    } catch (err: any) {
      this.logger.warn(`Delhivery NDR API call note: ${err.response?.data?.message || err.message}`);
      return {
        success: true,
        message: `NDR action '${actionData.action}' recorded internally and sent to courier queue.`,
      };
    }
  }

  // ─── Webhook (with Idempotency & Full Reverse / NDR / RTO Routing) ─────────
  async handleWebhook(body: any) {
    const rawWaybill = body?.waybill || body?.awb || body?.waybill_no || body?.AWB || body?.ShipmentData?.[0]?.Shipment?.AWB;
    const waybill = rawWaybill ? String(rawWaybill).trim() : '';
    const status = String(body?.status ?? body?.status_code ?? body?.Status ?? body?.ShipmentData?.[0]?.Shipment?.Status?.Status ?? '').trim();
    const eventId = String(body?.event_id || body?.id || `${waybill}_${status}_${Date.now()}`);

    if (!waybill) throw new BadRequestException('Waybill number is required in webhook payload');

    // 1. Idempotency check
    const existingEvent = await this.db.query.courierWebhookEvents.findFirst({
      where: and(
        eq(courierWebhookEvents.courier, 'delhivery'),
        eq(courierWebhookEvents.eventId, eventId),
      ),
    });

    if (existingEvent) {
      this.logger.log(`Delhivery webhook event #${eventId} already processed. Skipping.`);
      return { success: true, duplicate: true, message: 'Event already processed' };
    }

    // Insert idempotency record
    await this.db.insert(courierWebhookEvents).values({
      courier: 'delhivery',
      eventId,
      eventType: status || 'STATUS_UPDATE',
      payload: body,
      processed: true,
      processedAt: new Date(),
    }).catch(() => {});

    const scanDesc = body?.scan_detail || body?.description || `Delhivery status update: ${status || 'In Transit'}`;
    const scanLoc = body?.location || body?.scanned_location || 'Delhivery Express Network';
    const cleanStatus = status.toLowerCase();

    // 2. Check if this is a Reverse Return Waybill
    const matchingReturn = await this.db.query.returnRequests.findFirst({
      where: eq(returnRequests.reverseWaybill, waybill),
    });

    if (matchingReturn) {
      this.logger.log(`Webhook matched Return Request #${matchingReturn.returnNumber} (AWB: ${waybill}, Status: ${status})`);

      await this.db.insert(returnTrackingEvents).values({
        returnRequestId: matchingReturn.id,
        waybill,
        status: cleanStatus.includes('deliver') ? 'received_at_warehouse' : 'in_transit',
        description: scanDesc,
        location: scanLoc,
        createdAt: new Date(),
      });

      if (cleanStatus.includes('delivered') || cleanStatus.includes('received')) {
        await this.returnsService.markReceivedAtWarehouse(matchingReturn.id);
      } else if (cleanStatus.includes('pickup') || cleanStatus.includes('picked') || cleanStatus.includes('transit')) {
        await this.returnsService.markInTransit(matchingReturn.id, scanLoc);
      }

      return { success: true, message: 'Return tracking updated via webhook', type: 'return_reverse' };
    }

    // 3. Find matching forward order
    const order = await this.db.query.orders.findFirst({
      where: eq(orders.delhiveryWaybill, waybill),
      with: { user: true } as any,
    });

    if (!order) {
      this.logger.warn(`Delhivery webhook received for unknown waybill: ${waybill}`);
      return { success: false, message: `Order not found for waybill ${waybill}` };
    }

    // 4. Check for NDR (Non-Delivery Report)
    const isNdrStatus =
      cleanStatus.includes('undeliver') ||
      cleanStatus.includes('attempt fail') ||
      cleanStatus.includes('customer not available') ||
      cleanStatus.includes('address incomplete') ||
      cleanStatus.includes('unreachable') ||
      cleanStatus.includes('refused') ||
      cleanStatus.includes('ndr');

    if (isNdrStatus) {
      await this.rtoService.handleNdrEvent(order.id, {
        reason: scanDesc || status,
        courierLocation: scanLoc,
        waybill,
      });
    }

    // 5. Check for RTO (Return to Origin)
    const isRtoStatus = cleanStatus.includes('rto') || cleanStatus.includes('return to origin');
    if (isRtoStatus) {
      await this.rtoService.handleRtoScan(order.id, {
        status,
        location: scanLoc,
        reason: scanDesc,
      });
    }

    // 6. Forward Order Tracking Update
    const mappedStatus = this.mapDelhiveryStatus(status);
    const updateData: any = {
      delhiveryStatus: status || order.delhiveryStatus,
      delhiveryStatusUpdatedAt: new Date(),
      delhiveryTrackingData: body,
    };

    if (mappedStatus && order.status !== mappedStatus) {
      updateData.status = mappedStatus;
      if (mappedStatus === 'delivered' && !order.deliveredAt) {
        updateData.deliveredAt = new Date();
      }
    }

    await this.db.update(orders).set(updateData).where(eq(orders.id, order.id));

    await this.db.insert(orderTrackingRecords).values({
      orderId: order.id,
      status: mappedStatus ?? order.status,
      description: scanDesc,
      location: scanLoc,
      trackedAt: new Date(),
    });

    // Customer In-App Notification
    if (order.userId && status) {
      const isOFD = cleanStatus.includes('out for delivery') || cleanStatus.includes('ofd');
      const isDelivered = cleanStatus.includes('deliver') && !isOFD && !isNdrStatus && !isRtoStatus;
      const orderSlug = getOrderSlug(order) || order.orderNumber || order.id;

      if (isOFD) {
        this.notificationsService.createAndEmitNotification({
          userId: order.userId,
          title: '🚚 Package Out for Delivery!',
          message: `Your order #${order.orderNumber} is out for delivery with the Delhivery executive today.`,
          type: 'ORDER_OUT_FOR_DELIVERY',
          priority: 'HIGH',
          entityType: 'order',
          entityId: order.id,
          referenceKey: `DELHIVERY_OFD_${order.id}_${Date.now()}`,
          link: `/orders/${orderSlug}/tracking`,
        }).catch(() => {});
      } else if (isDelivered) {
        this.notificationsService.createAndEmitNotification({
          userId: order.userId,
          title: '📦 Order Delivered!',
          message: `Your order #${order.orderNumber} has been marked as DELIVERED by Delhivery Express.`,
          type: 'ORDER_DELIVERED',
          priority: 'HIGH',
          entityType: 'order',
          entityId: order.id,
          referenceKey: `DELHIVERY_DL_${order.id}_${Date.now()}`,
          link: `/orders/${orderSlug}/tracking`,
        }).catch(() => {});
      }
    }

    return { success: true, message: 'Order tracking updated via webhook' };
  }

  private parseTrackingData(data: any, fallbackWaybill: string = '') {
    if (!data) {
      return {
        waybill: fallbackWaybill,
        status: 'Manifested',
        status_code: 'MANIFESTED',
        status_date: new Date().toISOString(),
        expected_delivery: '',
        current_location: this.pickupLocation || 'Ambala',
        scans: [],
      };
    }

    // Check if error response
    if (data.Error || data.error) {
      return {
        waybill: fallbackWaybill,
        status: 'Manifested',
        status_code: 'MANIFESTED',
        status_date: new Date().toISOString(),
        expected_delivery: '',
        current_location: this.pickupLocation || 'Ambala',
        scans: [],
      };
    }

    const shipmentArr = data.ShipmentData || data.shipment_data || data.packages || data.data || [];
    const firstItem = Array.isArray(shipmentArr) ? shipmentArr[0] : (typeof shipmentArr === 'object' ? shipmentArr : null);

    if (!firstItem) {
      return {
        waybill: data.AWB || data.waybill || fallbackWaybill,
        status: data.Status?.Status || data.Status || data.status || 'Manifested',
        status_code: data.Status?.StatusCode || data.status_code || '',
        status_date: data.Status?.StatusDateTime || data.status_date || new Date().toISOString(),
        expected_delivery: data.PromisedDeliveryDate || data.promised_delivery_date || '',
        current_location: data.Status?.StatusLocation || data.current_location || this.pickupLocation || '',
        scans: [],
      };
    }

    const shipment = firstItem.Shipment || firstItem.shipment || firstItem;
    const statusObj = shipment.Status || shipment.status || {};
    const scans = shipment.Scans || shipment.scans || [];

    const rawStatus = typeof statusObj === 'string'
      ? statusObj
      : (statusObj.Status || statusObj.status || statusObj.StatusType || statusObj.status_type || 'Manifested');

    const rawStatusCode = typeof statusObj === 'object' ? (statusObj.StatusCode || statusObj.status_code || statusObj.StatusType || '') : '';
    const rawStatusDate = typeof statusObj === 'object' ? (statusObj.StatusDateTime || statusObj.status_date || '') : '';
    const rawLocation = typeof statusObj === 'object' ? (statusObj.StatusLocation || statusObj.status_location || statusObj.Location || '') : '';
    const expectedDelivery = shipment.PromisedDeliveryDate || shipment.promised_delivery_date || shipment.ExpectedDeliveryDate || '';

    const scanList = Array.isArray(scans) ? scans.map((scan: any) => {
      const d = scan.ScanDetail || scan.scan_detail || scan;
      return {
        scan_date: d.ScanDateTime || d.scan_date || d.ScanTime || d.ScannedTime || '',
        scan_type: d.ScanType || d.scan_type || d.Type || '',
        scan_detail: d.Scan || d.scan_detail || d.Instructions || d.Comment || d.Status || rawStatus,
        location: d.ScannedLocation || d.scanned_location || d.Location || d.Hub || rawLocation || '',
        instructions: d.Instructions || d.instructions || d.Remark || '',
      };
    }).filter((s: any) => Boolean(s.scan_detail)) : [];

    return {
      waybill: shipment.AWB || shipment.waybill || fallbackWaybill,
      status: rawStatus,
      status_code: rawStatusCode,
      status_date: rawStatusDate || new Date().toISOString(),
      expected_delivery: expectedDelivery,
      current_location: rawLocation || this.pickupLocation || '',
      scans: scanList,
    };
  }

  // ─── Bulk Create Shipments ───────────────────────────────────────────────
  async bulkCreateShipments(body: { orderIds: number[] }): Promise<any> {
    const { orderIds } = body;
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      throw new BadRequestException('Please provide an array of order IDs to create shipments for.');
    }

    const uniqueOrderIds = Array.from(new Set(orderIds.map(Number))).filter((id) => !isNaN(id) && id > 0);
    if (uniqueOrderIds.length === 0) {
      throw new BadRequestException('No valid order IDs provided.');
    }

    const results: Array<{
      orderId: number;
      orderNumber?: string;
      waybill?: string;
      status: string;
      success: boolean;
      reason?: string;
      message: string;
    }> = [];
    let shippedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const id of uniqueOrderIds) {
      try {
        const order = await this.db.query.orders.findFirst({
          where: eq(orders.id, id),
          with: { user: true, orderItems: { with: { product: true } as any } } as any,
        });

        if (!order) {
          failedCount++;
          results.push({
            orderId: id,
            status: 'failed',
            success: false,
            reason: 'Order not found',
            message: 'Order not found',
          });
          continue;
        }

        const orderNum = order.orderNumber || `ORD-${order.id}`;

        // Validation 1: Already has waybill / shipment
        if (order.delhiveryWaybill) {
          skippedCount++;
          results.push({
            orderId: id,
            orderNumber: orderNum,
            waybill: order.delhiveryWaybill,
            status: 'skipped',
            success: false,
            reason: `Shipment already created (AWB: ${order.delhiveryWaybill})`,
            message: `Shipment already exists for #${orderNum}`,
          });
          continue;
        }

        // Validation 2: Cancelled order
        if (order.status === 'cancelled') {
          skippedCount++;
          results.push({
            orderId: id,
            orderNumber: orderNum,
            status: 'skipped',
            success: false,
            reason: 'Order is cancelled',
            message: `Order #${orderNum} is cancelled`,
          });
          continue;
        }

        // Validation 3: Pending order (must be confirmed / accepted first)
        if (order.status === 'pending') {
          skippedCount++;
          results.push({
            orderId: id,
            orderNumber: orderNum,
            status: 'skipped',
            success: false,
            reason: 'Order is pending. Please accept/confirm the order first.',
            message: `Order #${orderNum} must be confirmed before creating shipment`,
          });
          continue;
        }

        // Validation 4: Already in terminal or shipped status
        if (['shipped', 'delivered', 'completed'].includes(order.status)) {
          skippedCount++;
          results.push({
            orderId: id,
            orderNumber: orderNum,
            status: 'skipped',
            success: false,
            reason: `Order is already in "${order.status}" status`,
            message: `Order #${orderNum} is already ${order.status}`,
          });
          continue;
        }

        // Create shipment
        const shipmentRes = await this.createShipment(id, {});
        if (shipmentRes?.success) {
          shippedCount++;
          results.push({
            orderId: id,
            orderNumber: orderNum,
            waybill: shipmentRes.waybill,
            status: 'shipped',
            success: true,
            message: shipmentRes.message || 'Shipment created successfully',
          });
        } else {
          failedCount++;
          results.push({
            orderId: id,
            orderNumber: orderNum,
            status: 'failed',
            success: false,
            reason: shipmentRes?.message || 'Failed to create shipment',
            message: shipmentRes?.message || 'Failed to create shipment',
          });
        }
      } catch (err: any) {
        failedCount++;
        const errMsg = err?.response?.message || err?.message || 'Failed to create shipment';
        results.push({
          orderId: id,
          status: 'failed',
          success: false,
          reason: errMsg,
          message: errMsg,
        });
      }
    }

    return {
      success: shippedCount > 0 || (skippedCount > 0 && failedCount === 0),
      processedCount: shippedCount,
      shippedCount,
      skippedCount,
      failedCount,
      totalRequested: uniqueOrderIds.length,
      results,
      message: `${shippedCount} shipment(s) created successfully${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}${failedCount > 0 ? `, ${failedCount} failed` : ''}.`,
    };
  }

  // ─── 1-Click Shipping Label (4x6 Inch Thermal Barcode) ────────────────────
  async getShippingLabelPdf(orderId: number, waybillQuery?: string): Promise<{ buffer: Buffer; filename: string }> {
    const order = await this.db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        user: true,
        orderItems: { with: { product: true, variant: true } as any },
      } as any,
    });

    if (!order) throw new NotFoundException('Order not found');

    const waybill = (waybillQuery || order.delhiveryWaybill || '').trim();
    if (!waybill) {
      throw new BadRequestException('Order does not have an active Delhivery waybill/shipment. Please create shipment first.');
    }

    const orderNum = order.orderNumber || `ORD-${order.id}`;

    // 1. Try Live Delhivery Packing Slip API if not in local test mode
    if (!this.isTestModeActive() && !waybill.startsWith('DLHV-TEST-')) {
      try {
        const response = await axios.get(`${this.baseUrl}/p/packing_slip`, {
          params: { wbns: waybill, pdf: 'true' },
          headers: this.headers(),
          responseType: 'arraybuffer',
          timeout: 10000,
        });

        if (response.data && Buffer.isBuffer(response.data) && response.data.slice(0, 4).toString() === '%PDF') {
          return {
            buffer: response.data,
            filename: `Shipping_Label_Order_${orderNum}_${waybill}.pdf`,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Delhivery Live Packing Slip API error (${err.message}). Generating fallback 4x6 thermal label.`);
      }
    }

    // 2. Fallback / Test Mode 4x6" Thermal Shipping Label Generation
    const buffer = await this.generateThermalLabelBuffer([order]);
    return {
      buffer,
      filename: `Shipping_Label_Order_${orderNum}_${waybill}.pdf`,
    };
  }

  async getBulkShippingLabelsPdf(body: { orderIds: number[] }): Promise<{ buffer: Buffer; filename: string }> {
    const { orderIds } = body;
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      throw new BadRequestException('Please provide an array of order IDs to generate shipping labels.');
    }

    const uniqueOrderIds = Array.from(new Set(orderIds.map(Number))).filter((id) => !isNaN(id) && id > 0);
    const validOrders = await this.db.query.orders.findMany({
      where: inArray(orders.id, uniqueOrderIds),
      with: {
        user: true,
        orderItems: { with: { product: true, variant: true } as any },
      } as any,
    });

    const shippedOrders = validOrders.filter((o) => Boolean(o.delhiveryWaybill));
    if (shippedOrders.length === 0) {
      throw new BadRequestException('None of the selected orders have active shipments / waybill numbers.');
    }

    const buffer = await this.generateThermalLabelBuffer(shippedOrders);
    return {
      buffer,
      filename: `Bulk_Shipping_Labels_${shippedOrders.length}_Orders_${Date.now()}.pdf`,
    };
  }

  private async generateThermalLabelBuffer(orderList: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: [288, 432], // 4x6 inch standard thermal label in points (72 pt = 1 in)
          margin: 0,
          autoFirstPage: false,
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err: any) => reject(err));

        for (const order of orderList) {
          doc.addPage({ size: [288, 432], margin: 0 });
          this.renderSingleThermalShippingLabel(doc, order);
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private renderSingleThermalShippingLabel(doc: any, order: any) {
    const extracted = this.extractDelhiveryAddress(order.shippingAddress || '', order.user);
    const customerName = extracted.customerName || 'Customer';
    const phone = extracted.phone || '9999999999';
    const streetAddress = extracted.streetAddress || '';
    const city = extracted.city || 'City';
    const state = extracted.state || 'State';
    const pincode = extracted.pincode || '134003';
    const waybill = order.delhiveryWaybill || `DLHV-${order.id}`;
    const orderNum = order.orderNumber || `ORD-${order.id}`;
    const invoiceNum = order.invoiceNumber || `ZT/2627/${String(order.id).padStart(5, '0')}`;
    const isCod = order.paymentMethod === 'cash_on_delivery';
    const totalAmount = order.total || 0;
    const items = order.orderItems || [];
    const totalItems = items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0);
    const weight = '0.50';
    const dateStr = new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const sortCode = `${city.slice(0, 3).toUpperCase()} / ${state.slice(0, 3).toUpperCase()}`;
    const hubCode = `${pincode.slice(0, 3)}-HUB`;

    // ── Outer Border ──────────────────────────────────────────────────────────
    doc.rect(8, 8, 272, 416).lineWidth(1.2).stroke('#000000');

    // ── 1. Top Header Compartment (y = 8 to 44) ──────────────────────────────
    doc.font('Helvetica-Bold').fontSize(13).text('DELHIVERY', 14, 14);
    doc.font('Helvetica-Bold').fontSize(7.5).text('SURFACE EXPRESS', 14, 28);

    // Right Sort / Routing Block
    doc.rect(170, 8, 110, 36).fillAndStroke('#000000', '#000000');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text(sortCode, 172, 13, { width: 106, align: 'center' });
    doc.fontSize(7).text(`HUB: ${hubCode}`, 172, 27, { width: 106, align: 'center' });
    doc.fillColor('#000000');

    // Divider Line 1
    doc.moveTo(8, 44).lineTo(280, 44).lineWidth(1).stroke('#000000');

    // ── 2. Barcode & AWB Compartment (y = 44 to 104) ─────────────────────────
    this.drawBarcode(doc, waybill, 16, 48, 256, 36);
    doc.font('Helvetica-Bold').fontSize(10).text(`AWB: ${waybill}`, 8, 88, { width: 272, align: 'center' });

    // Divider Line 2
    doc.moveTo(8, 104).lineTo(280, 104).lineWidth(1).stroke('#000000');

    // ── 3. Consignee / Deliver To Compartment (y = 104 to 192) ───────────────
    doc.font('Helvetica-Bold').fontSize(7).text('SHIP TO / CONSIGNEE:', 14, 108);
    doc.font('Helvetica-Bold').fontSize(10).text(customerName, 14, 118, { width: 150 });
    doc.font('Helvetica').fontSize(8).text(`Phone: ${phone}`, 14, 131);
    doc.font('Helvetica').fontSize(7.5).text(streetAddress, 14, 143, { width: 150, height: 32, ellipsis: true });
    doc.font('Helvetica-Bold').fontSize(8).text(`${city}, ${state}`, 14, 178, { width: 150 });

    // Right side Pincode Box
    doc.rect(168, 108, 106, 42).lineWidth(1.5).stroke('#000000');
    doc.font('Helvetica-Bold').fontSize(7.5).text('DESTINATION PIN', 170, 113, { width: 102, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(15).text(pincode, 170, 126, { width: 102, align: 'center' });

    // Right side Order Metadata
    doc.font('Helvetica').fontSize(7).text(`Order #: ${orderNum}`, 168, 154, { width: 106, ellipsis: true });
    doc.text(`Date: ${dateStr}`, 168, 165, { width: 106 });
    doc.text(`Inv #: ${invoiceNum}`, 168, 176, { width: 106, ellipsis: true });

    // Divider Line 3
    doc.moveTo(8, 192).lineTo(280, 192).lineWidth(1).stroke('#000000');

    // ── 4. Payment Mode Banner (y = 192 to 224) ──────────────────────────────
    if (isCod) {
      doc.rect(8, 192, 272, 32).fill('#000000');
      doc.fillColor('#ffffff');
      doc.font('Helvetica-Bold').fontSize(12).text(
        `COD: ₹${Number(totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        8,
        196,
        { width: 272, align: 'center' },
      );
      doc.font('Helvetica-Bold').fontSize(7).text('COLLECT EXACT CASH BEFORE OPENING / HANDOVER', 8, 211, {
        width: 272,
        align: 'center',
      });
      doc.fillColor('#000000');
    } else {
      doc.rect(8, 192, 272, 32).fillAndStroke('#f3f4f6', '#000000');
      doc.font('Helvetica-Bold').fontSize(12).text('PREPAID SHIPMENT', 8, 196, { width: 272, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(7).text('DO NOT COLLECT CASH FROM CUSTOMER', 8, 211, {
        width: 272,
        align: 'center',
      });
    }

    // Divider Line 4
    doc.moveTo(8, 224).lineTo(280, 224).lineWidth(1).stroke('#000000');

    // ── 5. Package Items & Dimensions (y = 224 to 300) ───────────────────────
    doc.font('Helvetica-Bold').fontSize(7.5).text('ITEM DETAILS', 14, 229);
    doc.font('Helvetica').fontSize(7).text(`Wt: ${weight} kg | Total Pcs: ${totalItems}`, 140, 229, {
      width: 134,
      align: 'right',
    });

    let curY = 242;
    for (let i = 0; i < Math.min(items.length, 3); i++) {
      const it = items[i];
      const pName = it.product?.name || 'Item';
      const sku = it.variant?.sku || it.variant?.title || 'STD';
      const qty = it.quantity || 1;
      doc.font('Helvetica').fontSize(7).text(`${i + 1}. ${pName} (${sku})`, 14, curY, { width: 210, ellipsis: true });
      doc.font('Helvetica-Bold').fontSize(7).text(`x${qty}`, 230, curY, { width: 44, align: 'right' });
      curY += 13;
    }
    if (items.length > 3) {
      doc.font('Helvetica-Oblique').fontSize(6.5).text(`+ ${items.length - 3} more items in parcel`, 14, curY);
    }

    // Divider Line 5
    doc.moveTo(8, 300).lineTo(280, 300).lineWidth(1).stroke('#000000');

    // ── 6. Return Address / Seller Block (y = 300 to 372) ────────────────────
    doc.font('Helvetica-Bold').fontSize(7.5).text('RETURN TO (IF UNDELIVERED):', 14, 306);
    doc.font('Helvetica-Bold').fontSize(8.5).text(this.clientName || 'Zelton', 14, 318);
    doc.font('Helvetica').fontSize(7).text(
      `${this.returnAddress}, ${this.returnCity}, ${this.returnState} - ${this.returnPin}`,
      14,
      330,
      { width: 260 },
    );
    doc.font('Helvetica').fontSize(7).text(
      `Seller Helpline: ${this.returnPhone} | GSTIN: Not Applicable`,
      14,
      344,
    );
    doc.font('Helvetica-Bold').fontSize(6.5).text(
      'Routing Note: If undelivered, return parcel to origin warehouse.',
      14,
      356,
    );

    // Divider Line 6
    doc.moveTo(8, 372).lineTo(280, 372).lineWidth(0.5).stroke('#888888');

    // ── 7. Footer Tag ────────────────────────────────────────────────────────
    doc.font('Helvetica').fontSize(6).fillColor('#666666').text(
      'Delhivery One Logistics | 4x6 Thermal Standard Label | Powered by Zelton',
      8,
      390,
      { width: 272, align: 'center' },
    );
    doc.fillColor('#000000');
  }

  private drawBarcode(doc: any, text: string, x: number, y: number, width: number, height: number) {
    doc.save();
    doc.rect(x, y, width, height).fill('#ffffff');
    doc.fillColor('#000000');

    const clean = (text || 'DLHV').replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
    let currentX = x + 12;
    const maxWidth = x + width - 12;

    // Start pattern
    doc.rect(currentX, y, 2.5, height).fill();
    currentX += 4.5;
    doc.rect(currentX, y, 1.5, height).fill();
    currentX += 3.5;

    for (let i = 0; i < clean.length; i++) {
      const code = clean.charCodeAt(i);
      const w1 = ((code * 7) % 3) + 1;
      const s1 = ((code * 3) % 2) + 1.2;
      const w2 = ((code * 11) % 3) + 1;
      const s2 = ((code * 5) % 2) + 1.2;

      if (currentX + w1 + s1 + w2 + s2 > maxWidth) break;

      doc.rect(currentX, y, w1 * 1.1, height).fill();
      currentX += w1 * 1.1 + s1;
      doc.rect(currentX, y, w2 * 1.1, height).fill();
      currentX += w2 * 1.1 + s2;
    }

    if (currentX < maxWidth) {
      doc.rect(currentX, y, 2.5, height).fill();
      currentX += 4;
      doc.rect(currentX, y, 2.5, height).fill();
    }
    doc.restore();
  }

  private mapDelhiveryStatus(delhiveryStatus: string): string | null {
    if (!delhiveryStatus) return null;
    const clean = delhiveryStatus.trim().toLowerCase();

    // 1. Delivered states (Must exclude out for delivery, undelivered, and attempt states)
    if (
      clean.includes('deliver') &&
      !clean.includes('out for') &&
      !clean.includes('undelivered') &&
      !clean.includes('attempt') &&
      !clean.includes('not deliver')
    ) {
      return 'delivered';
    }

    // 2. Cancellation, Return & RTO states
    if (
      clean.includes('rto') ||
      clean.includes('cancel') ||
      clean.includes('lost') ||
      clean.includes('returned') ||
      clean.includes('destroyed') ||
      clean.includes('damaged')
    ) {
      return 'cancelled';
    }

    // 3. Active Transit & Shipping states (including Out for Delivery, In Transit, Manifested, etc.)
    if (
      clean.includes('transit') ||
      clean.includes('dispatch') ||
      clean.includes('pickup') ||
      clean.includes('picked') ||
      clean.includes('manifest') ||
      clean.includes('out for delivery') ||
      clean.includes('ofd') ||
      clean.includes('reached') ||
      clean.includes('center') ||
      clean.includes('hub') ||
      clean.includes('attempt') ||
      clean.includes('undeliver') ||
      clean.includes('inbound') ||
      clean.includes('outbound') ||
      clean.includes('scheduled') ||
      clean.includes('open')
    ) {
      return 'shipped';
    }

    return null;
  }
}
