import { Injectable, Inject } from '@nestjs/common';
import { eq, desc, gte, sql } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import { users, orders, products, variants, orderItems, contactMessages, reviews, categories, brands } from '../database/schema';

@Injectable()
export class DashboardService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async getStatistics(query: any = {}) {
    const now = new Date();
    const period = query.period || '30days';
    const statusFilter = query.status && query.status !== 'all' ? query.status.toLowerCase() : null;
    const paymentMethodFilter = query.paymentMethod && query.paymentMethod !== 'all' ? query.paymentMethod.toLowerCase() : null;
    const paymentStatusFilter = query.paymentStatus && query.paymentStatus !== 'all' ? query.paymentStatus.toLowerCase() : null;
    const categoryIdFilter = query.categoryId && query.categoryId !== 'all' ? Number(query.categoryId) : null;
    const brandIdFilter = query.brandId && query.brandId !== 'all' ? Number(query.brandId) : null;
    const customerIdFilter = query.customerId && query.customerId !== 'all' ? Number(query.customerId) : null;

    // Determine current period date range
    let startDate = new Date();
    let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    } else if (period === 'yesterday') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    } else if (period === '7days') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === '30days') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    } else if (period === 'last_month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (period === 'this_year') {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
    } else if (period === 'custom' && query.startDate) {
      startDate = new Date(query.startDate);
      if (query.endDate) endDate = new Date(query.endDate);
    } else {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Previous period range calculation for percentage growth comparisons
    const durationMs = Math.max(endDate.getTime() - startDate.getTime(), 24 * 60 * 60 * 1000);
    const prevStartDate = new Date(startDate.getTime() - durationMs);
    const prevEndDate = new Date(startDate.getTime());

    // Fetch core database items with parallel single-table queries (avoids MariaDB lateral join syntax errors)
    const [
      allUsers,
      rawOrdersList,
      allOrderItemsList,
      allProductsList,
      allVariantsList,
      allCategories,
      allBrands,
      allMessages,
      allReviews,
    ]: [any[], any[], any[], any[], any[], any[], any[], any[], any[]] = await Promise.all([
      this.db.select().from(users).catch(() => []),
      this.db.select().from(orders).orderBy(desc(orders.createdAt)).catch(() => []),
      this.db.select().from(orderItems).catch(() => []),
      this.db.select().from(products).catch(() => []),
      this.db.select().from(variants).catch(() => []),
      this.db.select().from(categories).catch(() => []),
      this.db.select().from(brands).catch(() => []),
      this.db.select().from(contactMessages).catch(() => []),
      this.db.select().from(reviews).catch(() => []),
    ]);

    // Fast in-memory relational mapping
    const userMap = new Map<number, any>((allUsers || []).map((u: any) => [u.id, u]));
    const categoryMap = new Map<number, any>((allCategories || []).map((c: any) => [c.id, c]));
    const brandMap = new Map<number, any>((allBrands || []).map((b: any) => [b.id, b]));

    const productMap = new Map<number, any>((allProductsList || []).map((p: any) => [
      p.id,
      {
        ...p,
        category: categoryMap.get(p.categoryId) || null,
        brand: p.brandId ? (brandMap.get(p.brandId) || null) : null,
      },
    ]));

    const variantMap = new Map<number, any>((allVariantsList || []).map((v: any) => [
      v.id,
      {
        ...v,
        product: productMap.get(v.productId) || null,
      },
    ]));

    const allOrderItems = (allOrderItemsList || []).map((item: any) => ({
      ...item,
      product: productMap.get(item.productId) || null,
      variant: variantMap.get(item.variantId) || null,
    }));

    const orderItemsByOrderId = new Map<number, any[]>();
    for (const item of allOrderItems) {
      const list = orderItemsByOrderId.get(item.orderId) || [];
      list.push(item);
      orderItemsByOrderId.set(item.orderId, list);
    }

    const rawOrders = (rawOrdersList || []).map((o: any) => ({
      ...o,
      user: userMap.get(o.userId) || null,
      orderItems: orderItemsByOrderId.get(o.id) || [],
    }));

    const variantsByProductId = new Map<number, any[]>();
    for (const v of (allVariantsList || [])) {
      const list = variantsByProductId.get(v.productId) || [];
      list.push(variantMap.get(v.id) || v);
      variantsByProductId.set(v.productId, list);
    }

    const allProducts = (allProductsList || []).map((p: any) => ({
      ...p,
      category: categoryMap.get(p.categoryId) || null,
      brand: p.brandId ? (brandMap.get(p.brandId) || null) : null,
      variants: variantsByProductId.get(p.id) || [],
    }));

    const allVariants = (allVariantsList || []).map((v: any) => variantMap.get(v.id) || v);

    // Non-admin verified users
    const nonAdminUsers = (allUsers || []).filter((u: any) => (u.role || '').toLowerCase() !== 'admin' && (u.isVerified === 'true' || String(u.isVerified) === 'true' || u.emailVerifiedAt));
    const totalUsers = nonAdminUsers.length;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newUsersThisMonth = nonAdminUsers.filter((u: any) => new Date(u.createdAt) >= startOfMonth).length;

    // Filter orders according to user parameters (status, payment method, payment status, customerId, categoryId, brandId)
    let filteredOrders = rawOrders;
    if (statusFilter) {
      filteredOrders = filteredOrders.filter(o => (o.status || '').toLowerCase() === statusFilter);
    }
    if (paymentMethodFilter) {
      filteredOrders = filteredOrders.filter(o => (o.paymentMethod || '').toLowerCase() === paymentMethodFilter);
    }
    if (paymentStatusFilter) {
      filteredOrders = filteredOrders.filter(o => (o.paymentStatus || '').toLowerCase() === paymentStatusFilter);
    }
    if (customerIdFilter) {
      filteredOrders = filteredOrders.filter(o => Number(o.userId) === customerIdFilter);
    }
    if (categoryIdFilter) {
      filteredOrders = filteredOrders.filter(o => {
        return ((o as any).orderItems || []).some((item: any) => item.product?.categoryId === categoryIdFilter);
      });
    }
    if (brandIdFilter) {
      filteredOrders = filteredOrders.filter(o => {
        return ((o as any).orderItems || []).some((item: any) => item.product?.brandId === brandIdFilter);
      });
    }

    // Revenue-eligible statuses
    const revenueStatuses = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'completed'];

    // Current period orders
    const currentPeriodOrders = filteredOrders.filter(o => {
      const d = new Date(o.createdAt);
      return d >= startDate && d <= endDate;
    });

    // Previous period orders
    const prevPeriodOrders = filteredOrders.filter(o => {
      const d = new Date(o.createdAt);
      return d >= prevStartDate && d < prevEndDate;
    });

    // Calculate revenue totals across all active (non-cancelled) orders
    const calcRevenue = (orderList: any[]) =>
      orderList
        .filter(o => (o.status || '').toLowerCase() !== 'cancelled')
        .reduce((sum, o) => sum + (parseFloat(String(o.total || '0')) || 0), 0);

    const currentRevenue = calcRevenue(currentPeriodOrders);
    const prevRevenue = calcRevenue(prevPeriodOrders);

    // Percentage Growth Calculations
    const calcGrowth = (curr: number, prev: number) => {
      if (prev === 0 && curr > 0) return 100;
      if (prev === 0 && curr === 0) return 0;
      return Math.round(((curr - prev) / prev) * 1000) / 10;
    };

    const revenueGrowth = calcGrowth(currentRevenue, prevRevenue);
    const ordersGrowth = calcGrowth(currentPeriodOrders.length, prevPeriodOrders.length);

    const currentUsers = nonAdminUsers.filter(u => {
      const d = new Date(u.createdAt);
      return d >= startDate && d <= endDate;
    }).length;
    const prevUsers = nonAdminUsers.filter(u => {
      const d = new Date(u.createdAt);
      return d >= prevStartDate && d < prevEndDate;
    }).length;
    const usersGrowth = calcGrowth(currentUsers, prevUsers);

    // Today's revenue
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayRevenue = rawOrders
      .filter(o => new Date(o.createdAt) >= todayStart && (revenueStatuses.includes((o.status || '').toLowerCase()) || o.paymentStatus === 'paid'))
      .reduce((sum, o) => sum + (parseFloat(String(o.total || '0')) || 0), 0);

    // Average Order Value (AOV) & Growth
    const validRevOrders = currentPeriodOrders.filter(o => (o.status || '').toLowerCase() !== 'cancelled');
    const averageOrderValue = validRevOrders.length > 0 ? currentRevenue / validRevOrders.length : 0;

    const prevValidRevOrders = prevPeriodOrders.filter(o => (o.status || '').toLowerCase() !== 'cancelled');
    const prevAov = prevValidRevOrders.length > 0 ? prevRevenue / prevValidRevOrders.length : 0;
    const aovGrowth = calcGrowth(averageOrderValue, prevAov);

    // Status counts
    const statusCounts = {
      pending: filteredOrders.filter(o => o.status === 'pending').length,
      confirmed: filteredOrders.filter(o => o.status === 'confirmed').length,
      processing: filteredOrders.filter(o => o.status === 'processing').length,
      shipped: filteredOrders.filter(o => o.status === 'shipped').length,
      out_for_delivery: filteredOrders.filter(o => (o.status as string) === 'out_for_delivery').length,
      delivered: filteredOrders.filter(o => o.status === 'delivered').length,
      completed: filteredOrders.filter(o => o.status === 'completed').length,
      cancelled: filteredOrders.filter(o => o.status === 'cancelled').length,
    };

    const statusDistribution: Record<string, number> = {};
    for (const [key, val] of Object.entries(statusCounts)) statusDistribution[key] = val;

    // 1. REFUNDS, RETURNS & CANCELLATIONS ANALYTICS
    const cancelledOrders = currentPeriodOrders.filter(o => o.status === 'cancelled');
    const cancelledAmount = cancelledOrders.reduce((sum, o) => sum + (parseFloat(String(o.total || '0')) || 0), 0);
    const cancellationRate = currentPeriodOrders.length > 0
      ? Math.round((cancelledOrders.length / currentPeriodOrders.length) * 1000) / 10
      : 0;

    // Returned orders
    const returnedOrders = currentPeriodOrders.filter(o => (o.status as string) === 'returned');
    const returnRate = currentPeriodOrders.length > 0
      ? Math.round((returnedOrders.length / currentPeriodOrders.length) * 1000) / 10
      : 0;

    // Refunded orders (paid + cancelled/returned)
    const refundedOrders = currentPeriodOrders.filter(o => o.paymentStatus === 'paid' && (o.status === 'cancelled' || (o.status as string) === 'returned'));
    const refundTotalAmount = refundedOrders.reduce((sum, o) => sum + (parseFloat(String(o.total || '0')) || 0), 0);

    const refunds = {
      count: refundedOrders.length,
      amount: Math.round(refundTotalAmount * 100) / 100,
      pending: currentPeriodOrders.filter(o => o.paymentStatus === 'pending' && o.status === 'cancelled').length,
      completed: refundedOrders.length,
      failed: 0,
    };

    const returns = {
      total: returnedOrders.length,
      pending: currentPeriodOrders.filter(o => (o.status as string) === 'return_requested').length,
      approved: currentPeriodOrders.filter(o => (o.status as string) === 'return_approved').length,
      completed: returnedOrders.length,
      rejected: currentPeriodOrders.filter(o => (o.status as string) === 'return_rejected').length,
      rate: returnRate,
    };

    const cancellations = {
      count: cancelledOrders.length,
      rate: cancellationRate,
      amount: Math.round(cancelledAmount * 100) / 100,
    };

    // 2. PAYMENTS ANALYTICS (Cashfree Online vs COD)
    const onlineOrders = filteredOrders.filter(o => (o.paymentMethod || '').toLowerCase() === 'online');
    const codOrders = filteredOrders.filter(o => (o.paymentMethod || '').toLowerCase() === 'cash_on_delivery' || (o.paymentMethod || '').toLowerCase() === 'cod');

    const successfulOnline = onlineOrders.filter(o => o.paymentStatus === 'paid' || o.status === 'confirmed' || o.status === 'delivered');
    const failedOnline = onlineOrders.filter(o => o.paymentStatus === 'failed' || o.status === 'cancelled');
    const pendingOnline = onlineOrders.filter(o => o.paymentStatus === 'pending' && o.status === 'pending');

    const onlineTotalAmt = onlineOrders.reduce((sum, o) => sum + (parseFloat(String(o.total || '0')) || 0), 0);
    const successfulOnlineAmt = successfulOnline.reduce((sum, o) => sum + (parseFloat(String(o.total || '0')) || 0), 0);
    const failedOnlineAmt = failedOnline.reduce((sum, o) => sum + (parseFloat(String(o.total || '0')) || 0), 0);

    const payments = {
      online: {
        count: onlineOrders.length,
        total: Math.round(onlineTotalAmt * 100) / 100,
        successful: successfulOnline.length,
        successful_amount: Math.round(successfulOnlineAmt * 100) / 100,
        pending: pendingOnline.length,
        failed: failedOnline.length,
        failed_amount: Math.round(failedOnlineAmt * 100) / 100,
        refunded: refundedOrders.length,
        success_rate: onlineOrders.length > 0 ? Math.round((successfulOnline.length / onlineOrders.length) * 1000) / 10 : 100,
        failure_rate: onlineOrders.length > 0 ? Math.round((failedOnline.length / onlineOrders.length) * 1000) / 10 : 0,
      },
      cod: {
        count: codOrders.length,
        total: Math.round(codOrders.reduce((sum, o) => sum + (parseFloat(String(o.total || '0')) || 0), 0) * 100) / 100,
        collected: codOrders.filter(o => o.status === 'delivered' || o.paymentStatus === 'paid').length,
        pending: codOrders.filter(o => o.status !== 'delivered' && o.paymentStatus !== 'paid' && o.status !== 'cancelled').length,
        cancelled: codOrders.filter(o => o.status === 'cancelled').length,
        success_rate: codOrders.length > 0 ? Math.round((codOrders.filter(o => o.status === 'delivered' || o.paymentStatus === 'paid').length / codOrders.length) * 1000) / 10 : 100,
      },
    };

    // 3. SHIPPING & DELHIVERY ANALYTICS
    const shipmentsWithWaybill = currentPeriodOrders.filter(o => o.delhiveryWaybill || o.courierName);
    const inTransitShipments = currentPeriodOrders.filter(o => (o.delhiveryStatus || '').toLowerCase().includes('transit') || o.status === 'shipped');
    const outForDeliveryShipments = currentPeriodOrders.filter(o => (o.delhiveryStatus || '').toLowerCase().includes('out') || (o.status as string) === 'out_for_delivery');
    const deliveredShipments = currentPeriodOrders.filter(o => (o.delhiveryStatus || '').toLowerCase().includes('delivered') || o.status === 'delivered');
    const failedShipments = currentPeriodOrders.filter(o => (o.delhiveryStatus || '').toLowerCase().includes('fail') || (o.delhiveryStatus || '').toLowerCase().includes('rto'));

    const shipping = {
      total: shipmentsWithWaybill.length || currentPeriodOrders.filter(o => ['shipped', 'out_for_delivery', 'delivered'].includes(o.status)).length,
      created: shipmentsWithWaybill.length,
      in_transit: inTransitShipments.length,
      out_for_delivery: outForDeliveryShipments.length,
      delivered: deliveredShipments.length,
      failures: failedShipments.length,
      pending: currentPeriodOrders.filter(o => ['confirmed', 'processing'].includes(o.status) && !o.delhiveryWaybill).length,
      delivery_success_rate: currentPeriodOrders.length > 0
        ? Math.round((deliveredShipments.length / Math.max(shipmentsWithWaybill.length, 1)) * 1000) / 10
        : 100,
    };

    // 4. DISCOUNT & COUPON ANALYTICS
    const grossSales = currentPeriodOrders.reduce((sum, o) => sum + (parseFloat(String(o.subtotal || o.total || '0')) || 0), 0);
    const netSales = currentRevenue;
    const discountOrders = currentPeriodOrders.filter(o => {
      const sub = parseFloat(String(o.subtotal || '0'));
      const tot = parseFloat(String(o.total || '0'));
      return sub > tot;
    });
    const totalDiscountAmount = discountOrders.reduce((sum, o) => {
      const sub = parseFloat(String(o.subtotal || '0'));
      const tot = parseFloat(String(o.total || '0'));
      return sum + Math.max(0, sub - tot);
    }, 0);

    const discounts = {
      gross_sales: Math.round(grossSales * 100) / 100,
      net_sales: Math.round(netSales * 100) / 100,
      total_discount_amount: Math.round(totalDiscountAmount * 100) / 100,
      orders_with_discount_count: discountOrders.length,
      average_discount_per_order: discountOrders.length > 0 ? Math.round((totalDiscountAmount / discountOrders.length) * 100) / 100 : 0,
      discount_percentage: grossSales > 0 ? Math.round((totalDiscountAmount / grossSales) * 1000) / 10 : 0,
    };

    // 5. CATEGORY PERFORMANCE ANALYTICS
    const categoryStatsMap: Record<number, { id: number; name: string; orders_count: number; units_sold: number; revenue: number }> = {};
    for (const cat of allCategories) {
      categoryStatsMap[cat.id] = { id: cat.id, name: cat.name, orders_count: 0, units_sold: 0, revenue: 0 };
    }

    for (const item of allOrderItems) {
      const prod = (item as any).product;
      const catId = prod?.categoryId;
      if (catId && categoryStatsMap[catId]) {
        categoryStatsMap[catId].units_sold += item.quantity || 1;
        categoryStatsMap[catId].revenue += parseFloat(String(item.total || '0')) || 0;
        categoryStatsMap[catId].orders_count += 1;
      }
    }

    const categoryList = Object.values(categoryStatsMap).map(c => ({
      ...c,
      revenue: Math.round(c.revenue * 100) / 100,
      revenue_percentage: currentRevenue > 0 ? Math.round((c.revenue / currentRevenue) * 1000) / 10 : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    const bestCategory = categoryList.length > 0 ? categoryList[0] : null;
    const lowestCategory = categoryList.length > 1 ? categoryList[categoryList.length - 1] : null;

    const categoryPerformance = {
      total_categories: allCategories.length,
      active_categories_with_sales: categoryList.filter(c => c.units_sold > 0).length,
      categories: categoryList,
      best_category: bestCategory,
      lowest_category: lowestCategory,
    };

    // 6. INVENTORY VALUE & ASSET ANALYTICS
    const activeVariants = allVariants.filter(v => (v.status === true || String(v.status) === 'true') && !v.deletedAt);
    const lowStockItems = activeVariants.filter(v => v.stock > 0 && v.stock <= 5);
    const outOfStockItems = activeVariants.filter(v => v.stock === 0);

    const totalInventoryUnits = activeVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
    const totalInventoryCostValue = activeVariants.reduce((sum, v) => sum + ((v.stock || 0) * (parseFloat(String(v.bp || v.sp || '0')) || 0)), 0);
    const totalInventoryRetailValue = activeVariants.reduce((sum, v) => sum + ((v.stock || 0) * (parseFloat(String(v.sp || '0')) || 0)), 0);

    const lowStockProducts = lowStockItems.map((v: any) => ({
      id: v.productId || v.id,
      variant_id: v.id,
      name: v.product?.name || `Product #${v.productId}`,
      stock: v.stock,
      threshold: 5,
      sku: v.sku || `SKU-${v.id}`,
    }));

    const outOfStockProducts = outOfStockItems.map((v: any) => ({
      id: v.productId || v.id,
      variant_id: v.id,
      name: v.product?.name || `Product #${v.productId}`,
      stock: 0,
      sku: v.sku || `SKU-${v.id}`,
    }));

    const inventoryValue = {
      total_units: totalInventoryUnits,
      cost_value: Math.round(totalInventoryCostValue * 100) / 100,
      retail_value: Math.round(totalInventoryRetailValue * 100) / 100,
      potential_profit_margin: Math.round((totalInventoryRetailValue - totalInventoryCostValue) * 100) / 100,
      low_stock_units: lowStockItems.reduce((sum, v) => sum + v.stock, 0),
      out_of_stock_count: outOfStockItems.length,
    };

    // 7. EXPANDED ACTION REQUIRED ALERTS
    const actionRequired: any[] = [];

    if (outOfStockItems.length > 0) {
      actionRequired.push({
        id: 'act-out-of-stock',
        type: 'critical',
        title: 'Products Out of Stock',
        message: `${outOfStockItems.length} product variant(s) have 0 units remaining.`,
        count: outOfStockItems.length,
        link: '/dashboard/products?tab=out-of-stock',
      });
    }

    if (failedOnline.length > 0) {
      actionRequired.push({
        id: 'act-failed-payments',
        type: 'critical',
        title: 'Failed Online Transactions',
        message: `${failedOnline.length} Cashfree online order payment attempt(s) failed.`,
        count: failedOnline.length,
        link: '/dashboard/orders?paymentStatus=failed',
      });
    }

    if (failedShipments.length > 0) {
      actionRequired.push({
        id: 'act-failed-shipments',
        type: 'critical',
        title: 'Delhivery Shipment Failures',
        message: `${failedShipments.length} package delivery attempt(s) failed or returned to origin.`,
        count: failedShipments.length,
        link: '/dashboard/orders',
      });
    }

    if (lowStockItems.length > 0) {
      actionRequired.push({
        id: 'act-low-stock',
        type: 'warning',
        title: 'Low Stock Warning',
        message: `${lowStockItems.length} product variant(s) have 5 or fewer units remaining.`,
        count: lowStockItems.length,
        link: '/dashboard/products?tab=low-stock',
      });
    }

    if (cancellationRate > 10) {
      actionRequired.push({
        id: 'act-high-cancellation',
        type: 'warning',
        title: 'High Cancellation Rate',
        message: `Order cancellation rate is currently ${cancellationRate}%.`,
        count: cancelledOrders.length,
        link: '/dashboard/orders?status=cancelled',
      });
    }

    if (statusCounts.pending > 0) {
      actionRequired.push({
        id: 'act-pending-orders',
        type: 'pending',
        title: 'Orders Awaiting Action',
        message: `${statusCounts.pending} pending order(s) require processing/confirmation.`,
        count: statusCounts.pending,
        link: '/dashboard/orders?status=pending',
      });
    }

    const unreadMessages = allMessages.filter(m => !m.isRead);
    if (unreadMessages.length > 0) {
      actionRequired.push({
        id: 'act-unread-messages',
        type: 'info',
        title: 'Unread Customer Messages',
        message: `${unreadMessages.length} contact inquiry message(s) awaiting response.`,
        count: unreadMessages.length,
        link: '/dashboard/contact-messages',
      });
    }

    const lowReviews = allReviews.filter((r: any) => r.rating && r.rating <= 2);
    if (lowReviews.length > 0) {
      actionRequired.push({
        id: 'act-low-reviews',
        type: 'reviews',
        title: 'Low Rating Product Reviews',
        message: `${lowReviews.length} customer review(s) have a rating of 2 stars or lower.`,
        count: lowReviews.length,
        link: '/dashboard/products',
      });
    }

    // Revenue Timeline Bucket Calculation (for line chart)
    const chartBucketsCount = 7;
    const bucketDurationMs = (endDate.getTime() - startDate.getTime()) / chartBucketsCount;
    const revenueTimeline: any[] = [];

    for (let i = 0; i < chartBucketsCount; i++) {
      const bStart = new Date(startDate.getTime() + i * bucketDurationMs);
      const bEnd = new Date(startDate.getTime() + (i + 1) * bucketDurationMs);
      
      const bOrders = filteredOrders.filter(o => {
        const d = new Date(o.createdAt);
        return d >= bStart && d < bEnd && (o.status || '').toLowerCase() !== 'cancelled';
      });

      const bRev = bOrders.reduce((sum, o) => sum + (parseFloat(String(o.total || '0')) || 0), 0);
      const bCount = bOrders.length;
      const bAov = bCount > 0 ? bRev / bCount : 0;

      const dateLabel = bStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      revenueTimeline.push({
        date: dateLabel,
        raw_date: bStart.toISOString(),
        revenue: Math.round(bRev),
        orders: bCount,
        aov: Math.round(bAov),
      });
    }

    // Monthly Revenue (last 6 months) for historic bar chart
    const revenueByMonth: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthLabel = monthStart.toLocaleString('en-US', { month: 'short' });
      const monthOrders = rawOrders.filter(o => {
        const d = new Date(o.createdAt);
        return d >= monthStart && d <= monthEnd && (o.status || '').toLowerCase() !== 'cancelled';
      });
      revenueByMonth.push({
        month: monthLabel,
        revenue: Math.round(monthOrders.reduce((sum, o) => sum + (parseFloat(String(o.total || '0')) || 0), 0)),
        orders: monthOrders.length,
      });
    }

    // Top Selling & Poor Performing Products
    const productSales: Record<number, { id: number; name: string; category: string; image: string | null; total_sold: number; total_revenue: number; stock: number }> = {};
    for (const item of allOrderItems) {
      const prod = (item as any).product;
      const pId = item.productId;
      if (!productSales[pId]) {
        productSales[pId] = {
          id: pId,
          name: prod?.name || `Product #${pId}`,
          category: prod?.category?.name || 'General',
          image: prod?.imageUrl || prod?.imageJson?.[0] || null,
          total_sold: 0,
          total_revenue: 0,
          stock: prod?.stock ?? 10,
        };
      }
      productSales[pId].total_sold += item.quantity || 1;
      productSales[pId].total_revenue += parseFloat(String(item.total || '0')) || 0;
    }

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.total_sold - a.total_sold)
      .slice(0, 6);

    const poorPerformingProducts = allProducts
      .map(p => {
        const salesInfo = productSales[p.id] || { total_sold: 0, total_revenue: 0 };
        return {
          id: p.id,
          name: p.name,
          category: (p as any).category?.name || 'General',
          total_sold: salesInfo.total_sold,
          total_revenue: salesInfo.total_revenue,
          created_at: p.createdAt,
        };
      })
      .sort((a, b) => a.total_sold - b.total_sold)
      .slice(0, 6);

    // Latest 10 Orders
    const latestOrders = filteredOrders.slice(0, 10).map((o: any) => {
      const numTotal = parseFloat(String(o.total || '0')) || 0;
      return {
        id: o.id,
        order_id: o.orderNumber || `ORD-${o.id}`,
        order_number: o.orderNumber || `ORD-${o.id}`,
        customer_name: o.user?.name ?? 'Guest Customer',
        customer_email: o.user?.email ?? '',
        total_amount: numTotal,
        total: numTotal,
        status: o.status || 'pending',
        payment_method: o.paymentMethod || 'online',
        payment_status: o.paymentStatus || 'unpaid',
        items_count: (o.orderItems || []).length || 1,
        created_at: o.createdAt,
      };
    });

    // Recent Users
    const recentUsers = nonAdminUsers
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map(u => ({
        id: u.id,
        name: u.name || 'User',
        email: u.email || '',
        created_at: u.createdAt,
        role: u.role || 'Customer',
      }));

    // 8. DETERMINISTIC STORE INSIGHTS
    const storeInsights: string[] = [];
    if (revenueGrowth > 0) {
      storeInsights.push(`📈 Revenue increased by ${revenueGrowth}% compared to the previous period.`);
    } else if (revenueGrowth < 0) {
      storeInsights.push(`📉 Revenue decreased by ${Math.abs(revenueGrowth)}% compared to the previous period.`);
    }

    if (bestCategory) {
      storeInsights.push(`🏷️ "${bestCategory.name}" is your highest-performing category generating ₹${Math.round(bestCategory.revenue).toLocaleString('en-IN')} (${bestCategory.revenue_percentage}% of sales).`);
    }

    if (topProducts.length > 0) {
      storeInsights.push(`🏆 "${topProducts[0].name}" is your top-selling product (${topProducts[0].total_sold} units sold).`);
    }

    if (outOfStockItems.length > 0 || lowStockItems.length > 0) {
      storeInsights.push(`⚠️ ${outOfStockItems.length + lowStockItems.length} product variant(s) require inventory restocking (Total Inventory Value: ₹${Math.round(totalInventoryCostValue).toLocaleString('en-IN')}).`);
    }

    const totalOrderCount = onlineOrders.length + codOrders.length;
    if (totalOrderCount > 0) {
      const codPct = Math.round((codOrders.length / totalOrderCount) * 100);
      storeInsights.push(`💳 Cash on Delivery represents ${codPct}% of all store orders (Success Rate: ${payments.cod.success_rate}%).`);
    }

    if (shipping.delivery_success_rate > 0) {
      storeInsights.push(`🚚 Delhivery shipment success rate is currently ${shipping.delivery_success_rate}%.`);
    }

    if (statusCounts.pending > 0) {
      storeInsights.push(`⏰ You have ${statusCounts.pending} pending order(s) waiting for confirmation.`);
    }

    return {
      success: true,
      data: {
        period,
        filter: {
          period,
          status: statusFilter || 'all',
          payment_method: paymentMethodFilter || 'all',
          payment_status: paymentStatusFilter || 'all',
          category_id: categoryIdFilter,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        },
        overview: {
          total_users: totalUsers,
          total_products: allProducts.length,
          total_orders: filteredOrders.length,
          monthly_revenue: Math.round(currentRevenue * 100) / 100,
          today_revenue: Math.round(todayRevenue * 100) / 100,
          average_order_value: Math.round(averageOrderValue * 100) / 100,
          aov_growth: aovGrowth,
          revenue_growth: revenueGrowth,
          orders_growth: ordersGrowth,
          users_growth: usersGrowth,
          new_users_this_month: newUsersThisMonth,
          pending_action_count: actionRequired.length,
        },
        kpis: [
          { id: 'revenue', title: 'Total Revenue', value: currentRevenue, formatted: `₹${Math.round(currentRevenue).toLocaleString('en-IN')}`, growth: revenueGrowth, subtitle: `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth}% vs prev period` },
          { id: 'orders', title: 'Total Orders', value: currentPeriodOrders.length, growth: ordersGrowth, subtitle: `${statusCounts.delivered + statusCounts.completed} delivered` },
          { id: 'customers', title: 'Active Customers', value: totalUsers, growth: usersGrowth, subtitle: `+${newUsersThisMonth} new this month` },
          { id: 'inventory_value', title: 'Inventory Cost Value', value: totalInventoryCostValue, formatted: `₹${Math.round(totalInventoryCostValue).toLocaleString('en-IN')}`, subtitle: `Retail Value: ₹${Math.round(totalInventoryRetailValue).toLocaleString('en-IN')}` },
          { id: 'delivery_rate', title: 'Delivery Success Rate', value: shipping.delivery_success_rate, formatted: `${shipping.delivery_success_rate}%`, subtitle: `${deliveredShipments.length} delivered` },
          { id: 'stock_alerts', title: 'Stock Warnings', value: lowStockItems.length + outOfStockItems.length, subtitle: `${outOfStockItems.length} out of stock, ${lowStockItems.length} low` },
        ],
        orders: {
          ...statusCounts,
          status_distribution: statusDistribution,
        },
        refunds,
        returns,
        cancellations,
        payments,
        shipping,
        discounts,
        category_performance: categoryPerformance,
        inventory_value: inventoryValue,
        action_required: actionRequired,
        inventory: {
          total_products: allProducts.length,
          in_stock: activeVariants.length - (lowStockItems.length + outOfStockItems.length),
          low_stock: lowStockItems.length,
          out_of_stock: outOfStockItems.length,
          low_stock_products: lowStockProducts,
          out_of_stock_products: outOfStockProducts,
        },
        messages: {
          unread: unreadMessages.length,
        },
        charts: {
          revenue_timeline: revenueTimeline,
          revenue_by_month: revenueByMonth,
          top_products: topProducts,
          poor_performing_products: poorPerformingProducts,
        },
        latest_orders: latestOrders,
        recent_users: recentUsers,
        store_insights: storeInsights,
      },
    };
  }
}
