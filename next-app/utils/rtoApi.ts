import axios from "./axios";

export interface NdrActionPayload {
  action: "reattempt" | "reschedule" | "update_address" | "update_phone" | "rto";
  remarks?: string;
  reschedule_date?: string;
  updated_address?: string;
  updated_city?: string;
  updated_state?: string;
  updated_pincode?: string;
  updated_phone?: string;
}

export interface RtoQcPayload {
  qc_status: "passed" | "damaged" | "lost" | "tampered";
  qc_remarks?: string;
  restock?: boolean;
}

export interface ProcessRtoRefundPayload {
  refund_amount?: number;
  notes?: string;
  transaction_id?: string;
}

export const rtoApi = {
  async getAllRtoCases(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    ndrAging?: string;
  }) {
    const res = await axios.get("/api/admin/rto", { params });
    return res.data;
  },

  async getRtoAnalytics() {
    const res = await axios.get("/api/admin/rto/analytics");
    return res.data;
  },

  async getRtoCaseDetails(id: number) {
    const res = await axios.get(`/api/admin/rto/${id}`);
    return res.data;
  },

  async executeNdrAction(id: number, data: NdrActionPayload) {
    const res = await axios.post(`/api/admin/rto/${id}/ndr-action`, data);
    return res.data;
  },

  async markDelivered(id: number) {
    const res = await axios.post(`/api/admin/rto/${id}/mark-delivered`);
    return res.data;
  },

  async qualityCheck(id: number, data: RtoQcPayload) {
    const res = await axios.post(`/api/admin/rto/${id}/qc`, data);
    return res.data;
  },

  async processRefund(id: number, data?: ProcessRtoRefundPayload) {
    const res = await axios.post(`/api/admin/rto/${id}/refund`, data || {});
    return res.data;
  },
};
