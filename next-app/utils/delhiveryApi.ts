import axios from "./axios";

// Create Delhivery shipment for an order (Admin)
export const createDelhiveryShipment = async (orderId: number | string) => {
  try {
    const response = await axios.post(`/api/delhivery/orders/${orderId}/create-shipment`);
    return response.data;
  } catch (error: any) {
    console.error('Error creating Delhivery shipment:', error);
    throw error?.response?.data || error;
  }
};

// Bulk Create Delhivery shipments (Admin)
export const bulkCreateDelhiveryShipments = async (orderIds: number[]) => {
  try {
    const response = await axios.post(`/api/delhivery/bulk-create-shipments`, { orderIds });
    return response.data;
  } catch (error: any) {
    console.error('Error creating bulk Delhivery shipments:', error);
    throw error?.response?.data || error;
  }
};

// Track order by order ID (User authenticated)
export const trackOrderDelhivery = async (orderId: number | string) => {
  try {
    const response = await axios.get(`/api/orders/${orderId}/delhivery-tracking`);
    return response.data;
  } catch (error: any) {
    console.error('Error tracking order:', error);
    throw error?.response?.data || error;
  }
};

// Track by waybill number (Public)
export const trackByWaybill = async (waybill: string) => {
  try {
    const response = await axios.post(`/api/delhivery/track-waybill`, { waybill });
    return response.data;
  } catch (error: any) {
    console.error('Error tracking waybill:', error);
    throw error?.response?.data || error;
  }
};

// Check pincode serviceability (Public)
export const checkServiceability = async (pincode: string) => {
  try {
    const response = await axios.post(`/api/delhivery/check-serviceability`, { pincode });
    return response.data;
  } catch (error: any) {
    console.error('Error checking serviceability:', error);
    throw error?.response?.data || error;
  }
};

// Sync tracking data (Admin)
export const syncDelhiveryTracking = async (orderId: number | string) => {
  try {
    const response = await axios.get(`/api/delhivery/orders/${orderId}/sync-tracking`);
    return response.data;
  } catch (error: any) {
    console.error('Error syncing tracking:', error);
    throw error?.response?.data || error;
  }
};

// Get warehouses (Admin)
export const getDelhiveryWarehouses = async () => {
  try {
    const response = await axios.get(`/api/delhivery/warehouses`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching warehouses:', error);
    throw error?.response?.data || error;
  }
};

// Types
export type DelhiveryTrackingData = {
  waybill: string;
  status: string;
  status_code: string;
  status_date: string;
  current_location: string;
  expected_delivery?: string;
  scans: {
    scan_date: string;
    scan_type: string;
    scan_detail: string;
    location: string;
    instructions?: string;
  }[];
};

export type ServiceabilityResponse = {
  serviceable: boolean;
  delivery_codes?: Record<string, string>;
  cod_available?: boolean;
  prepaid_available?: boolean;
  estimated_delivery_days?: string;
};
