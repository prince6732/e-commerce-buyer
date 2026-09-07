import { Category } from "@/common/interface";
import axios from "./axios";

export const getCategories = async (params?: { page?: number; limit?: number; per_page?: number; search?: string; include_inactive?: boolean; paginate?: boolean }) => {
    const response = await axios.get("/api/categories", {
        params: { include_inactive: true, ...params }
    });
    return response.data;
};

export const getCategoryById = async (id: number | string) => {
    const response = await axios.get(`/api/get-category/${id}?include_inactive=true`);
    return response.data;
};

export const getCategoryByIdForProduct = async (id: number | string) => {
    const response = await axios.get(`/api/get-category-for-product/${id}?include_inactive=true`);
    return response.data;
};

export const createCategory = async (data: FormData) => {
    const response = await axios.post<Category>(`/api/create-categories`, data);
    return response.data;
};

export const updateCategory = async (id: string, data: FormData) => {
    const response = await axios.put<Category>(`/api/update-category/${id}`, data);
    return response.data;
};

export const deleteCategory = async (id: string) => {
    const response = await axios.delete(`/api/delete-category/${id}`);
    return response.data;
};

export const toggleCategoryStatus = async (id: string | number) => {
    const response = await axios.patch(`/api/category/${id}/status`);
    return response.data;
};
