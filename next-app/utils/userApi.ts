import axios from "./axios";

export interface User {
    id: number;
    name: string;
    email: string;
    phone_number?: string | null;
    address?: string | null;
    profile_picture?: string | null;
    status: boolean;
    is_verified: boolean;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    roles?: string[];
    orders_count?: number;
    reviews_count?: number;
    likes_count?: number;
}

export interface UserStats {
    total_orders: number;
    total_reviews: number;
    total_likes: number;
    total_spent: number;
    average_order_value: number;
    account_status: 'active' | 'blocked';
    is_verified: boolean;
    member_since: string;
}

export interface UserOrder {
    id: number;
    order_number: string;
    total_amount: number;
    status: string;
    payment_status: string;
    items_count: number;
    items?: {
        id: number;
        product_name: string;
        product_image: string | null;
        quantity: number;
        price: number;
        total: number;
    }[];
    created_at: string;
    formatted_date: string;
}

export interface UserReview {
    id: number;
    product_id: number;
    product_name: string;
    product_image: string | null;
    rating: number;
    title: string | null;
    review_text: string | null;
    is_approved: boolean;
    helpful_count: number;
    created_at: string;
    formatted_date: string;
}

export interface LikedProduct {
    id: number;
    name: string;
    image_url: string | null;
    price: number;
}

export interface UserDetailResponse {
    res: 'success' | 'error';
    user: User;
    stats: UserStats;
    recent_orders: UserOrder[];
    recent_reviews: UserReview[];
    liked_products: LikedProduct[];
    message: string;
}

export interface UsersListResponse {
    res: 'success' | 'error';
    users: {
        data: User[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from: number;
        to: number;
    };
    message: string;
}

export interface UserStatistics {
    total_users: number;
    active_users: number;
    blocked_users: number;
    verified_users: number;
    new_users_this_month: number;
    verification_rate: number;
}

export interface UserStatisticsResponse {
    res: 'success' | 'error';
    statistics: UserStatistics;
}

/**
 * Get all users with pagination and filters (Admin only)
 */
export const getAllUsers = async (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    status?: 'active' | 'blocked' | 'all';
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}): Promise<UsersListResponse> => {
    try {
        const response = await axios.get('/api/admin/users', { params });
        return response.data;
    } catch (error: any) {
        throw new Error(error.response?.data?.message || 'Failed to fetch users');
    }
};

/**
 * Get detailed user information by ID (Admin only)
 */
export const getUserDetails = async (userId: number | string): Promise<UserDetailResponse> => {
    try {
        const response = await axios.get(`/api/admin/users/${userId}`);
        return response.data;
    } catch (error: any) {
        throw new Error(error.response?.data?.message || 'Failed to fetch user details');
    }
};

/**
 * Block a user (Admin only)
 */
export const blockUser = async (userId: number | string): Promise<{ res: 'success' | 'error'; message: string; user?: User }> => {
    try {
        const response = await axios.post(`/api/admin/users/${userId}/block`);
        return response.data;
    } catch (error: any) {
        throw new Error(error.response?.data?.message || 'Failed to block user');
    }
};

/**
 * Unblock a user (Admin only)
 */
export const unblockUser = async (userId: number | string): Promise<{ res: 'success' | 'error'; message: string; user?: User }> => {
    try {
        const response = await axios.post(`/api/admin/users/${userId}/unblock`);
        return response.data;
    } catch (error: any) {
        throw new Error(error.response?.data?.message || 'Failed to unblock user');
    }
};

/**
 * Toggle user status (block/unblock) (Admin only)
 */
export const toggleUserStatus = async (userId: number | string): Promise<{ res: 'success' | 'error'; message: string; user?: User }> => {
    try {
        const response = await axios.post(`/api/admin/users/${userId}/toggle-status`);
        return response.data;
    } catch (error: any) {
        throw new Error(error.response?.data?.message || 'Failed to toggle user status');
    }
};

/**
 * Get user statistics for dashboard (Admin only)
 */
export const getUserStatistics = async (): Promise<UserStatisticsResponse> => {
    try {
        const response = await axios.get('/api/admin/users/statistics');
        return response.data;
    } catch (error: any) {
        throw new Error(error.response?.data?.message || 'Failed to fetch user statistics');
    }
};
