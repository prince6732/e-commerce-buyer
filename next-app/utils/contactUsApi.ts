import axiosInstance from "./axios";

export interface ContactMessageData {
    name: string;
    email: string;
    phone_number: string;
    message: string;
}

export interface ContactMessage extends ContactMessageData {
    id: number;
    is_read: boolean;
    created_at: string;
    updated_at: string;
}

export interface ContactMessageResponse {
    success: boolean;
    message: string;
    data?: ContactMessage;
    errors?: Record<string, string[]>;
}

export interface ContactMessagesListResponse {
    success: boolean;
    data: {
        data: ContactMessage[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}

// Submit contact message (public)
export const submitContactMessage = async (data: ContactMessageData): Promise<ContactMessageResponse> => {
    const response = await axiosInstance.post('/api/contact-us', data);
    return response.data;
};

// Admin: Get all contact messages
export const getContactMessages = async (params?: { page?: number; limit?: number; per_page?: number; search?: string } | number, legacySearch?: string): Promise<ContactMessagesListResponse> => {
    let queryParams: any = {};
    if (typeof params === 'number') {
        queryParams = { page: params, search: legacySearch || '', limit: 10, per_page: 10 };
    } else if (params) {
        queryParams = { limit: 10, per_page: 10, ...params };
    } else {
        queryParams = { page: 1, limit: 10, per_page: 10 };
    }

    const response = await axiosInstance.get('/api/admin/contact-messages', {
        params: queryParams,
    });
    return response.data;
};

// Admin: Get single message
export const getContactMessage = async (id: number): Promise<ContactMessageResponse> => {
    const response = await axiosInstance.get(`/api/admin/contact-messages/${id}`);
    return response.data;
};

// Admin: Mark as read
export const markMessageAsRead = async (id: number): Promise<ContactMessageResponse> => {
    const response = await axiosInstance.patch(`/api/admin/contact-messages/${id}/mark-read`);
    return response.data;
};

// Admin: Delete message
export const deleteContactMessage = async (id: number): Promise<ContactMessageResponse> => {
    const response = await axiosInstance.delete(`/api/admin/contact-messages/${id}`);
    return response.data;
};
