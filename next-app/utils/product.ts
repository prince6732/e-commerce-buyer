import { ApiResponse, Product } from "@/common/interface";
import axios from "./axios";

export type ProductPayload = {
    name: string;
    description?: string;
    item_code?: string;
    category_id: number;
    brand_id?: number | null;
    status: boolean;
    feature_json?: string | null;
    image_url?: File | string | null;
    image_json?: string | null;
};

export const fetchProducts = async () => {
    const response = await axios.get("/api/products");
    return response.data;
};

export const createProduct = async (data: any): Promise<ApiResponse<string>> => {
    const response = await axios.post(`/api/create-product`, data);
    const res = response.data;

    return {
        success: res.res === "success",
        message: res.message || "",
        result: res.product || null,
        errors: res.errors || [],
    };
};

export const updateProduct = async (id: string, data: FormData): Promise<ApiResponse<string>> => {
    const response = await axios.put(`/api/update-product/${id}`, data);
    const res = response.data;

    return {
        success: res.res === "success",
        message: res.message || "",
        result: res.product || null,
        errors: res.errors || [],
    };
};

export const deleteProduct = async (id: number) => {
    const response = await axios.delete(`/api/delete-product/${id}`);
    return response.data;
};

export const toggleProductStatus = async (id: string | number) => {
    const response = await axios.patch(`/api/product/${id}/status`);
    return response.data;
};

export const getSubcategoryProducts = async (categoryId: number) => {
    const response = await axios.get(`/api/get-products-by-category/${categoryId}`);
    return response.data;
};

export const getProductById = async (id: number | string): Promise<ApiResponse<Product>> => {
    try {
        const response = await axios.get(`/api/get-product/${id}`);
        const res = response.data;

        return {
            success: res.res === "success",
            message: res.message || "",
            result: res.product || null,
            errors: res.errors || [],
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || "Failed to fetch product",
            errors: [],
        };
    }
};

export const getMostOrderedProducts = async (limit?: number): Promise<ApiResponse<any>> => {
    try {
        const params = limit ? { limit: limit.toString() } : {};
        const response = await axios.get('/api/most-ordered-products', { params });
        const res = response.data;

        return {
            success: res.res === "success",
            message: res.message || "",
            result: res.data || null,
            errors: res.errors || [],
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || "Failed to fetch most ordered products",
            errors: [],
        };
    }
};

export const getTopSellingProducts = async (limit?: number): Promise<ApiResponse<any>> => {
    try {
        const params = limit ? { limit: limit.toString() } : {};
        const response = await axios.get('/api/top-selling-products', { params });
        const res = response.data;

        return {
            success: res.res === "success",
            message: res.message || "",
            result: res.data || null,
            errors: res.errors || [],
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || "Failed to fetch top selling products",
            errors: [],
        };
    }
};

export const getAdminProducts = async (page: number = 1, perPage: number = 10, filters?: any): Promise<ApiResponse<any>> => {
    try {
        const params = { page, per_page: perPage, limit: perPage, ...filters };
        const response = await axios.get('/api/admin-products', { params });
        const res = response.data;

        return {
            success: res.res === "success",
            message: res.message || "",
            result: res.data || null,
            errors: res.errors || [],
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || "Failed to fetch admin products",
            errors: [],
        };
    }
};

export const getProductDetails = async (id: number | string): Promise<ApiResponse<Product>> => {
    try {
        const response = await axios.get(`/api/admin-product-details/${id}`);
        const res = response.data;

        return {
            success: res.res === "success",
            message: res.message || "",
            result: res.product || null,
            errors: res.errors || [],
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || "Failed to fetch product details",
            errors: [],
        };
    }
};

export const deleteVariant = async (id: number): Promise<ApiResponse<string>> => {
    try {
        const response = await axios.delete(`/api/delete-variant/${id}`);
        const res = response.data;

        return {
            success: res.res === "success",
            message: res.message || "",
            result: undefined,
            errors: res.errors || [],
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.response?.data?.message || error.response?.data?.error || error.message || "Failed to delete variant",
            errors: [],
        };
    }
};

const EDIT_PRODUCT_ID_KEY = "zelton_edit_product_id";

export const setEditProductId = (id: string | number | null | undefined) => {
    if (typeof window !== "undefined") {
        if (id != null && id !== "") {
            sessionStorage.setItem(EDIT_PRODUCT_ID_KEY, String(id));
        } else {
            sessionStorage.removeItem(EDIT_PRODUCT_ID_KEY);
        }
    }
};

export const getEditProductId = (): string | null => {
    if (typeof window !== "undefined") {
        return sessionStorage.getItem(EDIT_PRODUCT_ID_KEY);
    }
    return null;
};

export const clearEditProductId = () => {
    if (typeof window !== "undefined") {
        sessionStorage.removeItem(EDIT_PRODUCT_ID_KEY);
    }
};