import { Category } from "@/common/interface";
import axios from "./axios";

export const getSubcategories = async (parentId: string | number, params?: { page?: number; limit?: number; per_page?: number; search?: string; include_inactive?: boolean; paginate?: boolean }) => {
    const response = await axios.get(`/api/subcategories`, {
        params: { parent_id: parentId, include_inactive: true, ...params }
    });
    return response.data;
};

export const getSubcategoryById = async (id: string | number) => {
    const response = await axios.get(`/api/get-subcategory/${id}?include_inactive=true`);
    return response.data;
};

export const createSubcategory = async (data: FormData) => {
    const response = await axios.post<Category>("/api/create-subcategory", data);
    return response.data;
};

export const updateSubcategory = async (id: string, data: FormData) => {
    const response = await axios.put<Category>(`/api/update-subcategory/${id}`, data);
    return response.data;
};

export const deleteSubcategory = async (id: string) => {
    const response = await axios.delete(`/api/delete-subcategory/${id}`);
    return response.data;
};

export const toggleSubcategoryStatus = async (id: string | number) => {
    const response = await axios.patch(`/api/category/${id}/status`);
    return response.data;
};
