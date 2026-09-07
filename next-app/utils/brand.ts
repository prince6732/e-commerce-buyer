import { Brand } from "@/common/interface";
import axios from "./axios";

export const fetchBrands = async (params?: { page?: number; limit?: number; per_page?: number; search?: string; status?: string; paginate?: boolean }) => {
    const response = await axios.get<any>("/api/brands", { params });
    return response.data;
};

export const getBrandById = async (id: string | number) => {
    const response = await axios.get<Brand>(`/api/brands/${id}`);
    return response.data;
};

export const createBrand = async (data: FormData) => {
    const response = await axios.post<Brand>(`/api/create-brand`, data);
    return response.data;
};

export const updateBrand = async (id: string, data: FormData) => {
    const response = await axios.put<Brand>(`/api/update-brand/${id}`, data);
    return response.data;
};

export const deleteBrand = async (id: string) => {
    const response = await axios.delete(`/api/delete-brand/${id}`);
    return response.data;
};

export const toggleBrandStatus = async (id: string | number) => {
    const response = await axios.patch(`/api/brand/${id}/status`);
    return response.data;
};
