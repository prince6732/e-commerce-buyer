import axios from "./axios";

export type VariantPayload = {
    title: string;
    sku?: string | null;
    stock: number;
    mrp: number;
    sp?: number | null;
    bp?: number | null;
    product_id: number;
    status: boolean;
    image_url?: File | string | null;
    image_json?: string | null;
};

export const fetchVariants = async (productId: number) => {
    const response = await axios.get(`/api/products/${productId}/variants`);
    return response.data;
};

export const createVariant = async (data: VariantPayload) => {
    const fd = new FormData();
    fd.append("title", data.title);
    fd.append("sku", data.sku ?? "");
    fd.append("stock", String(data.stock));
    fd.append("mrp", String(data.mrp));
    if (data.sp !== undefined) fd.append("sp", String(data.sp));
    if (data.bp !== undefined) fd.append("bp", String(data.bp));
    fd.append("product_id", String(data.product_id));
    fd.append("status", data.status ? "1" : "0");
    fd.append("image_json", data.image_json ?? "");

    if (data.image_url && data.image_url instanceof File) {
        fd.append("image_url", data.image_url);
    }

    const response = await axios.post(`/api/products/${data.product_id}/variants`, fd);
    return response.data;
};

export const updateVariant = async (id: number, productId: number, data: VariantPayload) => {
    const fd = new FormData();
    fd.append("title", data.title);
    fd.append("sku", data.sku ?? "");
    fd.append("stock", String(data.stock));
    fd.append("mrp", String(data.mrp));
    if (data.sp !== undefined) fd.append("sp", String(data.sp));
    if (data.bp !== undefined) fd.append("bp", String(data.bp));
    fd.append("product_id", String(data.product_id));
    fd.append("status", data.status ? "1" : "0");
    fd.append("image_json", data.image_json ?? "");

    if (data.image_url && data.image_url instanceof File) {
        fd.append("image_url", data.image_url);
    }

    fd.append("_method", "PUT"); 

    const response = await axios.post(`/api/products/${productId}/variants/${id}`, fd);
    return response.data;
};

export const deleteVariant = async (id: number, productId: number) => {
    const response = await axios.delete(`/api/products/${productId}/variants/${id}`);
    return response.data;
};

export const toggleVariantStatus = async (id: string | number) => {
    const response = await axios.patch(`/api/variant/${id}/status`);
    return response.data;
};
