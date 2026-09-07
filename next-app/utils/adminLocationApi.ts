import axios from './axios';

export interface AdminStateItem {
  id: number;
  name: string;
  status: boolean;
  cities_count: number;
  active_cities_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface AdminCityItem {
  id: number;
  name: string;
  state_id: number;
  state_name: string;
  state_status: boolean;
  status: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StateFormData {
  name: string;
  status: boolean;
}

export interface CityFormData {
  name: string;
  state_id: number;
  status: boolean;
}

export interface LocationStats {
  total: number;
  active: number;
  inactive: number;
}

export interface LocationMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_more: boolean;
  stats: LocationStats;
}

// ==========================================
// ADMIN STATES API
// ==========================================

export const getAdminStates = async (query?: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ success: boolean; data: AdminStateItem[]; meta: LocationMeta }> => {
  const response = await axios.get('/api/admin/locations/states', {
    params: query,
  });
  return response.data;
};

export const getAllAdminStatesList = async (): Promise<{
  success: boolean;
  data: { id: number; name: string; status: boolean }[];
}> => {
  const response = await axios.get('/api/admin/locations/states/all');
  return response.data;
};

export const getStateById = async (id: number) => {
  const response = await axios.get(`/api/admin/locations/states/${id}`);
  return response.data;
};

export const createAdminState = async (data: StateFormData) => {
  const response = await axios.post('/api/admin/locations/states', data);
  return response.data;
};

export const updateAdminState = async (id: number, data: Partial<StateFormData>) => {
  const response = await axios.put(`/api/admin/locations/states/${id}`, data);
  return response.data;
};

export const toggleStateStatus = async (id: number) => {
  const response = await axios.patch(`/api/admin/locations/states/${id}/toggle-status`);
  return response.data;
};

export const deleteAdminState = async (id: number) => {
  const response = await axios.delete(`/api/admin/locations/states/${id}`);
  return response.data;
};

// ==========================================
// ADMIN CITIES API
// ==========================================

export const getAdminCities = async (query?: {
  state_id?: number | string;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ success: boolean; data: AdminCityItem[]; meta: LocationMeta }> => {
  const response = await axios.get('/api/admin/locations/cities', {
    params: query,
  });
  return response.data;
};

export const getCityById = async (id: number) => {
  const response = await axios.get(`/api/admin/locations/cities/${id}`);
  return response.data;
};

export const createAdminCity = async (data: CityFormData) => {
  const response = await axios.post('/api/admin/locations/cities', data);
  return response.data;
};

export const updateAdminCity = async (id: number, data: Partial<CityFormData>) => {
  const response = await axios.put(`/api/admin/locations/cities/${id}`, data);
  return response.data;
};

export const toggleCityStatus = async (id: number) => {
  const response = await axios.patch(`/api/admin/locations/cities/${id}/toggle-status`);
  return response.data;
};

export const deleteAdminCity = async (id: number) => {
  const response = await axios.delete(`/api/admin/locations/cities/${id}`);
  return response.data;
};
