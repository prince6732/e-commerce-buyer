import axios from './axios';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.zelton.co.in/api";

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
};

export const toggleProductLike = async (productId: number) => {
    try {
        const response = await axios.post(`${apiUrl}/api/likes/toggle`, 
            { product_id: productId },
            { headers: getAuthHeaders() }
        );
        return response.data;
    } catch (error) {
        console.error('Error toggling like:', error);
        throw error;
    }
};

export const getUserLikedProducts = async () => {
    try {
        const response = await axios.get(`${apiUrl}/api/likes`, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching liked products:', error);
        throw error;
    }
};

export const checkProductLikeStatus = async (productId: number) => {
    try {
        const response = await axios.post(`${apiUrl}/api/likes/check`,
            { product_id: productId },
            { headers: getAuthHeaders() }
        );
        return response.data;
    } catch (error) {
        console.error('Error checking like status:', error);
        throw error;
    }
};

export const bulkCheckProductsLikeStatus = async (productIds: number[]) => {
    try {
        const response = await axios.post(`${apiUrl}/api/likes/bulk-check`,
            { product_ids: productIds },
            { headers: getAuthHeaders() }
        );
        return response.data;
    } catch (error) {
        console.error('Error bulk checking likes:', error);
        throw error;
    }
};

export const isUserLoggedIn = (): boolean => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('token');
};