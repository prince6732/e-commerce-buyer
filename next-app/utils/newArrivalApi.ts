import axios from "./axios";

export type NewArrivalSliderPayload = {
    title?: string | null;
    description?: string;
    link?: string;
    open_in_new_tab?: boolean;
    status: boolean;
    order?: number;
    image?: string;
};

export type NewArrivalSlider = {
    id: number;
    title?: string | null;
    description?: string;
    link?: string;
    open_in_new_tab?: boolean;
    image: string;
    status: boolean;
    order: number;
    created_at?: string;
    updated_at?: string;
};

export const fetchNewArrivalSliders = async (params?: { page?: number; limit?: number; per_page?: number; search?: string; status?: string | boolean; paginate?: boolean }): Promise<any> => {
    const response = await axios.get("/api/new-arrival-sliders", { params });
    return response.data;
};

export const createNewArrivalSlider = async (data: NewArrivalSliderPayload) => {
    const response = await axios.post("/api/create-new-arrival-sliders", data);
    return response.data;
};

export const updateNewArrivalSlider = async (id: number, data: NewArrivalSliderPayload) => {
    const response = await axios.put(`/api/update-new-arrival-sliders/${id}`, data);
    return response.data;
};

export const deleteNewArrivalSlider = async (id: number) => {
    const response = await axios.delete(`/api/delete-new-arrival-sliders/${id}`);
    return response.data;
};

export const toggleNewArrivalSliderStatus = async (id: number) => {
    const response = await axios.patch(`/api/new-arrival-sliders/${id}/status`);
    return response.data;
};

export const updateNewArrivalSliderOrder = async (orderIds: number[]) => {
    const response = await axios.post("/api/new-arrival-sliders-order", { order: orderIds });
    return response.data;
};

// Products with new_arrival tag
export const fetchNewArrivalProducts = async (params?: { page?: number; limit?: number; per_page?: number; paginate?: boolean }): Promise<any> => {
    const response = await axios.get("/api/new-arrival-products", { params });
    return response.data;
};

export const toggleProductNewArrival = async (productId: number) => {
    const response = await axios.patch(`/api/products/${productId}/toggle-new-arrival`);
    return response.data;
};
