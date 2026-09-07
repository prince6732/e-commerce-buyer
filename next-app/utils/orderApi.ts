import axios from "./axios";

export function normalizeOrder(order: any): any {
  if (!order || typeof order !== 'object') return order;

  const rawItems = order.order_items || order.orderItems || [];
  const normalizedItems = Array.isArray(rawItems)
    ? rawItems.map((item: any) => {
      const prod = item.product || {};
      const varnt = item.variant || {};

      const normalizedProd = {
        ...prod,
        image_url: prod.image_url ?? prod.imageUrl ?? null,
        imageUrl: prod.imageUrl ?? prod.image_url ?? null,
        image_json: prod.image_json ?? prod.imageJson ?? null,
        imageJson: prod.imageJson ?? prod.image_json ?? null,
        item_code: prod.item_code ?? prod.itemCode ?? null,
        itemCode: prod.itemCode ?? prod.item_code ?? null,
        category_id: prod.category_id ?? prod.categoryId ?? null,
        categoryId: prod.categoryId ?? prod.category_id ?? null,
        brand_id: prod.brand_id ?? prod.brandId ?? null,
        brandId: prod.brandId ?? prod.brand_id ?? null,
        is_new_arrival: prod.is_new_arrival ?? prod.isNewArrival ?? false,
        isNewArrival: prod.isNewArrival ?? prod.is_new_arrival ?? false,
        created_at: prod.created_at ?? prod.createdAt ?? null,
        createdAt: prod.createdAt ?? prod.created_at ?? null,
      };

      const normalizedVarnt = {
        ...varnt,
        image_url: varnt.image_url ?? varnt.imageUrl ?? null,
        imageUrl: varnt.imageUrl ?? varnt.image_url ?? null,
        image_json: varnt.image_json ?? varnt.imageJson ?? null,
        imageJson: varnt.imageJson ?? varnt.image_json ?? null,
        product_id: varnt.product_id ?? varnt.productId ?? null,
        productId: varnt.productId ?? varnt.product_id ?? null,
        created_at: varnt.created_at ?? varnt.createdAt ?? null,
        createdAt: varnt.createdAt ?? varnt.created_at ?? null,
      };

      const price = typeof item.price === 'string' ? parseFloat(item.price) : (item.price || 0);
      const total = typeof item.total === 'string' ? parseFloat(item.total) : (item.total || 0);

      return {
        ...item,
        order_id: item.order_id ?? item.orderId,
        orderId: item.orderId ?? item.order_id,
        product_id: item.product_id ?? item.productId,
        productId: item.productId ?? item.product_id,
        variant_id: item.variant_id ?? item.variantId,
        variantId: item.variantId ?? item.variant_id,
        price,
        total,
        selected_attributes: item.selected_attributes ?? item.selectedAttributes ?? null,
        selectedAttributes: item.selectedAttributes ?? item.selected_attributes ?? null,
        product: normalizedProd,
        variant: normalizedVarnt,
      };
    })
    : [];

  const rawTracking = order.tracking_records || order.trackingRecords || [];
  const normalizedTracking = Array.isArray(rawTracking)
    ? rawTracking.map((tr: any) => ({
      ...tr,
      order_id: tr.order_id ?? tr.orderId,
      orderId: tr.orderId ?? tr.order_id,
      tracked_at: tr.tracked_at ?? tr.trackedAt,
      trackedAt: tr.trackedAt ?? tr.tracked_at,
      created_at: tr.created_at ?? tr.createdAt,
      createdAt: tr.createdAt ?? tr.created_at,
    }))
    : [];

  const subtotal = typeof order.subtotal === 'string' ? parseFloat(order.subtotal) : (order.subtotal || 0);
  const shipping_fee = typeof order.shipping_fee === 'string' ? parseFloat(order.shipping_fee) : (typeof order.shippingFee === 'string' ? parseFloat(order.shippingFee) : (order.shipping_fee ?? order.shippingFee ?? 0));
  const tax = typeof order.tax === 'string' ? parseFloat(order.tax) : (order.tax || 0);
  const total = typeof order.total === 'string' ? parseFloat(order.total) : (order.total || 0);

  return {
    ...order,
    order_number: order.order_number ?? order.orderNumber,
    orderNumber: order.orderNumber ?? order.order_number,
    user_id: order.user_id ?? order.userId,
    userId: order.userId ?? order.user_id,
    payment_method: order.payment_method ?? order.paymentMethod,
    paymentMethod: order.paymentMethod ?? order.payment_method,
    payment_status: order.payment_status ?? order.paymentStatus,
    paymentStatus: order.paymentStatus ?? order.payment_status,
    shipping_fee,
    shippingFee: shipping_fee,
    subtotal,
    tax,
    total,
    shipping_address: order.shipping_address ?? order.shippingAddress,
    shippingAddress: order.shippingAddress ?? order.shipping_address,
    billing_address: order.billing_address ?? order.billingAddress,
    billingAddress: order.billingAddress ?? order.billing_address,
    created_at: order.created_at ?? order.createdAt,
    createdAt: order.createdAt ?? order.created_at,
    updated_at: order.updated_at ?? order.updatedAt,
    updatedAt: order.updatedAt ?? order.updated_at,
    order_items: normalizedItems,
    orderItems: normalizedItems,
    tracking_records: normalizedTracking,
    trackingRecords: normalizedTracking,
  };
}

export function normalizeOrdersApiResponse(resData: any): any {
  if (!resData) return resData;

  if (resData.order && typeof resData.order === 'object') {
    resData.order = normalizeOrder(resData.order);
  }

  if (resData.data) {
    if (Array.isArray(resData.data.data)) {
      resData.data.data = resData.data.data.map(normalizeOrder);
    } else if (Array.isArray(resData.data)) {
      resData.data = resData.data.map(normalizeOrder);
    } else if (typeof resData.data === 'object') {
      resData.data = normalizeOrder(resData.data);
    }
  }
  return resData;
}

export const getOrders = async (params?: {
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}) => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.per_page) queryParams.append('per_page', params.per_page.toString());

    const response = await axios.get(`/api/orders?${queryParams.toString()}`);
    return normalizeOrdersApiResponse(response.data);
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
};

export const getOrder = async (orderId: number | string) => {
  try {
    const response = await axios.get(`/api/orders/${orderId}`);
    return normalizeOrdersApiResponse(response.data);
  } catch (error) {
    console.error('Error fetching order:', error);
    throw error;
  }
};

export const placeOrderFromCart = async (orderData: {
  shipping_address: string;
  billing_address?: string;
  notes?: string;
  cart_items?: number[];
}) => {
  try {
    const response = await axios.post(`/api/orders/place-from-cart`, orderData);
    return normalizeOrdersApiResponse(response.data);
  } catch (error) {
    console.error('Error placing order from cart:', error);
    throw error;
  }
};

export const placeSingleItemOrder = async (orderData: {
  product_id: number;
  variant_id: number;
  quantity: number;
  selected_attributes?: Record<string, string>;
  shipping_address: string;
  billing_address?: string;
  notes?: string;
}) => {
  try {
    const response = await axios.post(`/api/orders/place-single-item`, orderData);
    return normalizeOrdersApiResponse(response.data);
  } catch (error) {
    console.error('Error placing single item order:', error);
    throw error;
  }
};

export const cancelOrder = async (orderId: number | string) => {
  try {
    const response = await axios.patch(`/api/orders/${orderId}/cancel`);
    return normalizeOrdersApiResponse(response.data);
  } catch (error) {
    console.error('Error cancelling order:', error);
    throw error;
  }
};

export const getOrderTracking = async (orderId: number | string) => {
  try {
    const response = await axios.get(`/api/orders/${orderId}/tracking`);
    return normalizeOrdersApiResponse(response.data);
  } catch (error) {
    console.error('Error fetching order tracking:', error);
    throw error;
  }
};

export const getAdminOrders = async (params?: {
  status?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  per_page?: number;
}) => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.from_date) queryParams.append('from_date', params.from_date);
    if (params?.to_date) queryParams.append('to_date', params.to_date);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.per_page) queryParams.append('per_page', params.per_page.toString());

    const response = await axios.get(`/api/admin/orders?${queryParams.toString()}`);
    return normalizeOrdersApiResponse(response.data);
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    throw error;
  }
};

export const getAdminOrder = async (orderId: number | string) => {
  try {
    const response = await axios.get(`/api/admin/orders/${orderId}`);
    return normalizeOrdersApiResponse(response.data);
  } catch (error) {
    console.error('Error fetching admin order:', error);
    throw error;
  }
};

export const updateOrderStatus = async (orderId: number | string, statusData: {
  status: string;
  description: string;
  location?: string;
}) => {
  try {
    const response = await axios.patch(`/api/admin/orders/${orderId}/status`, statusData);
    return normalizeOrdersApiResponse(response.data);
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
};

export const getOrderStats = async () => {
  try {
    const response = await axios.get(`/api/admin/orders/stats`);
    return response.data;
  } catch (error) {
    console.error('Error fetching order stats:', error);
    throw error;
  }
};

export const getCompletedOrders = async (params?: {
  search?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  per_page?: number;
  limit?: number;
}) => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.from_date) queryParams.append('from_date', params.from_date);
    if (params?.to_date) queryParams.append('to_date', params.to_date);
    if (params?.page) queryParams.append('page', params.page.toString());
    const limit = params?.limit ?? params?.per_page;
    if (limit) {
      queryParams.append('per_page', limit.toString());
      queryParams.append('limit', limit.toString());
    }

    const response = await axios.get(`/api/admin/orders/completed?${queryParams.toString()}`);
    return normalizeOrdersApiResponse(response.data);
  } catch (error) {
    console.error('Error fetching completed orders:', error);
    throw error;
  }
};

export const getCompletedOrderDetails = async (orderId: number | string) => {
  try {
    const response = await axios.get(`/api/admin/orders/completed/${orderId}`);
    return normalizeOrdersApiResponse(response.data);
  } catch (error) {
    console.error('Error fetching completed order details:', error);
    throw error;
  }
};

export const getCancelledOrders = async (params?: {
  search?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  per_page?: number;
  limit?: number;
}) => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.from_date) queryParams.append('from_date', params.from_date);
    if (params?.to_date) queryParams.append('to_date', params.to_date);
    if (params?.page) queryParams.append('page', params.page.toString());
    const limit = params?.limit ?? params?.per_page;
    if (limit) {
      queryParams.append('per_page', limit.toString());
      queryParams.append('limit', limit.toString());
    }

    const response = await axios.get(`/api/admin/orders/cancelled?${queryParams.toString()}`);
    return normalizeOrdersApiResponse(response.data);
  } catch (error) {
    console.error('Error fetching cancelled orders:', error);
    throw error;
  }
};

export const formatOrderStatus = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export const getOrderStatusColor = (status: string): string => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'confirmed':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'processing':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'shipped':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'delivered':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'completed':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount);
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const ORDER_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export const PAYMENT_METHODS = {
  CASH_ON_DELIVERY: 'cash_on_delivery',
  ONLINE: 'online'
} as const;

export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed'
} as const;

export interface OrderItem {
  id: number;
  quantity: number;
  price: number;
  total: number;
  selected_attributes?: Record<string, string> | null;
  selectedAttributes?: Record<string, string> | null;
  product: {
    id: number;
    name: string;
    image_url?: string | null;
    imageUrl?: string | null;
  };
  variant: {
    id: number;
    title?: string | null;
    sku?: string | null;
    image_url?: string | null;
    imageUrl?: string | null;
  };
}

export interface TrackingRecord {
  id: number;
  status: string;
  description: string;
  location: string | null;
  tracked_at?: string;
  trackedAt?: string;
}

export interface Order {
  id: number;
  order_number?: string;
  orderNumber?: string;
  status: string;
  payment_method?: string;
  paymentMethod?: string;
  payment_status?: string;
  paymentStatus?: string;
  subtotal: number;
  shipping_fee?: number;
  shippingFee?: number;
  tax: number;
  total: number;
  shipping_address?: string;
  shippingAddress?: string;
  billing_address?: string | null;
  billingAddress?: string | null;
  notes?: string | null;
  created_at?: string;
  createdAt?: string;
  order_items?: OrderItem[];
  orderItems?: OrderItem[];
  tracking_records?: TrackingRecord[];
  trackingRecords?: TrackingRecord[];
}

export interface OrderStats {
  total_orders: number;
  pending_orders: number;
  confirmed_orders: number;
  processing_orders: number;
  shipped_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  total_revenue: number;
  todays_orders: number;
  this_month_orders: number;
}

export const downloadOrderInvoice = async (orderId: number | string, isAdmin: boolean = false): Promise<void> => {
  const endpoint = isAdmin ? `/api/admin/orders/${orderId}/invoice` : `/api/orders/${orderId}/invoice`;
  const response = await axios.get(endpoint, {
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: 'application/pdf' });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', `Tax_Invoice_Order_${orderId}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
};

export const bulkAcceptOrders = async (orderIds: number[]): Promise<any> => {
  const response = await axios.post('/api/admin/orders/bulk-accept', { orderIds });
  return response.data;
};

export const bulkCancelOrders = async (orderIds: number[], reason?: string): Promise<any> => {
  const response = await axios.post('/api/admin/orders/bulk-cancel', { orderIds, reason });
  return response.data;
};

export const bulkCreateShipments = async (orderIds: number[]): Promise<any> => {
  const response = await axios.post('/api/admin/orders/bulk-create-shipments', { orderIds });
  return response.data;
};