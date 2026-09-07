import axios from "./axios";

export type SliderPayload = {
    title?: string | null;
    description?: string;
    link?: string;
    open_in_new_tab?: boolean;
    order?: number;
    status: boolean;
    image?: string;
    show_buttons?: boolean;
    button1_text?: string;
    button1_link?: string;
    button2_text?: string;
    button2_link?: string;
};

export const fetchSliders = async (params?: { page?: number; limit?: number; per_page?: number; search?: string; status?: string | boolean; paginate?: boolean }): Promise<any> => {
    const response = await axios.get("/api/sliders", { params });
    return response.data;
};

export const createSlider = async (data: SliderPayload) => {
    const response = await axios.post("/api/create-sliders", data);
    return response.data;
};

export const updateSlider = async (id: number, data: SliderPayload) => {
    const response = await axios.put(`/api/update-sliders/${id}`, data);
    return response.data;
};

export const deleteSlider = async (id: number) => {
    const response = await axios.delete(`/api/delete-sliders/${id}`);
    return response.data;
};

export const updateSliderOrder = async (orderIds: number[]) => {
    const response = await axios.post("/api/order", { order: orderIds });
    return response.data;
};

export const toggleSliderStatus = async (id: number) => {
    const response = await axios.patch(`/api/sliders/${id}/status`);
    return response.data;
};
