import axios from "./axios";

export interface ReturnItemPayload {
  order_item_id: number;
  quantity: number;
  exchange_variant_id?: number;
}

export interface BankDetailsPayload {
  account_holder?: string;
  account_number?: string;
  ifsc_code?: string;
  bank_name?: string;
  upi_id?: string;
}

export interface PickupAddressPayload {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export interface RequestReturnPayload {
  order_id: number | string;
  return_type: "return" | "exchange";
  reason: string;
  reason_details?: string;
  items: ReturnItemPayload[];
  customer_images?: string[];
  refund_mode?: "original_source" | "bank_transfer_upi" | "store_credit" | "manual_cash";
  bank_details?: BankDetailsPayload;
  pickup_address?: PickupAddressPayload;
}

export interface ReturnQcPayload {
  qc_status: "passed" | "failed";
  qc_remarks?: string;
  item_qc?: Array<{
    item_id: number;
    qc_status: "passed" | "failed";
    qc_remarks?: string;
  }>;
}

export interface ProcessRefundPayload {
  refund_amount?: number;
  deductions?: number;
  transaction_id?: string;
  notes?: string;
}

export const returnApi = {
  // Customer
  async checkEligibility(orderId: number | string) {
    const res = await axios.get(`/api/orders/${orderId}/return-eligibility`);
    return res.data;
  },

  async requestReturn(data: RequestReturnPayload) {
    const res = await axios.post("/api/returns/request", data);
    return res.data;
  },

  async getMyReturns(params?: { page?: number; limit?: number; status?: string }) {
    const res = await axios.get("/api/returns/my", { params });
    return res.data;
  },

  async getReturnDetails(identifier: string | number) {
    const res = await axios.get(`/api/returns/${identifier}`);
    return res.data;
  },

  async cancelReturn(returnId: number, reason?: string) {
    const res = await axios.post(`/api/returns/${returnId}/cancel`, { reason });
    return res.data;
  },

  // Admin
  async getAllReturns(params?: {
    page?: number;
    limit?: number;
    status?: string;
    returnType?: string;
    search?: string;
  }) {
    const res = await axios.get("/api/admin/returns", { params });
    return res.data;
  },

  async getAdminReturnDetails(identifier: string | number) {
    const res = await axios.get(`/api/admin/returns/${identifier}`);
    return res.data;
  },

  async approveReturn(returnId: number, data?: { admin_notes?: string }) {
    const res = await axios.post(`/api/admin/returns/${returnId}/approve`, data || {});
    return res.data;
  },

  async rejectReturn(returnId: number, data: { rejection_reason: string }) {
    const res = await axios.post(`/api/admin/returns/${returnId}/reject`, data);
    return res.data;
  },

  async scheduleReversePickup(returnId: number, data?: { pickup_date?: string }) {
    const res = await axios.post(`/api/admin/returns/${returnId}/schedule-pickup`, data || {});
    return res.data;
  },

  async markReceived(returnId: number) {
    const res = await axios.post(`/api/admin/returns/${returnId}/mark-received`);
    return res.data;
  },

  async qualityCheck(returnId: number, data: ReturnQcPayload) {
    const res = await axios.post(`/api/admin/returns/${returnId}/qc`, data);
    return res.data;
  },

  async processRefund(returnId: number, data?: ProcessRefundPayload) {
    const res = await axios.post(`/api/admin/returns/${returnId}/refund`, data || {});
    return res.data;
  },
};
