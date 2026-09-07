import axios from "./axios";

export interface Review {
    id: number;
    user_id: number;
    product_id: number;
    rating: number;
    review_text: string | null;
    title: string | null;
    images?: string[] | null;
    is_verified: boolean;
    is_approved: boolean;
    helpful_count: number;
    time_ago: string;
    user_name: string;
    created_at: string;
    updated_at: string;
    user?: {
        id: number;
        name: string;
        profile_picture?: string | null;
    };
}

export interface ReviewSummary {
    total_reviews: number;
    average_rating: number;
    rating_distribution: {
        [key: number]: number;
    };
}

export interface ReviewResponse {
    res: 'success' | 'error';
    reviews: {
        data: Review[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    summary: ReviewSummary;
    message?: string;
}

export interface CreateReviewData {
    product_id: number | string;
    rating: number;
    review_text?: string;
    title?: string;
    images?: File[];
}

export interface UpdateReviewData {
    rating: number;
    review_text?: string;
    title?: string;
    images?: File[];
    existing_images?: string[];
}

export const getProductReviews = async (
    productId: number | string,
    params?: {
        page?: number;
        per_page?: number;
        limit?: number;
        rating?: number;
        search?: string;
        sort_by?: 'newest' | 'oldest' | 'highest' | 'lowest' | 'helpful';
        verified_only?: boolean | string;
        media_only?: boolean | string;
        text_only?: boolean | string;
    }
): Promise<ReviewResponse> => {
    try {
        const response = await axios.get(`/api/products/${productId}/reviews`, { params });
        return response.data;
    } catch (error: any) {
        throw new Error(error.response?.data?.message || 'Failed to fetch reviews');
    }
};

export const createReview = async (reviewData: CreateReviewData): Promise<{
    res: 'success' | 'error';
    review?: Review;
    message: string;
}> => {
    try {
        const formData = new FormData();
        formData.append('product_id', reviewData.product_id.toString());
        formData.append('rating', reviewData.rating.toString());
        if (reviewData.title) formData.append('title', reviewData.title);
        if (reviewData.review_text) formData.append('review_text', reviewData.review_text);
        
        // Append images if present
        if (reviewData.images && reviewData.images.length > 0) {
            reviewData.images.forEach((image) => {
                formData.append('images', image);
            });
        }

        const response = await axios.post('/api/reviews', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error: any) {
        throw new Error(error.response?.data?.message || 'Failed to create review');
    }
};

export const updateReview = async (
    reviewId: number,
    reviewData: UpdateReviewData
): Promise<{
    res: 'success' | 'error';
    review?: Review;
    message: string;
}> => {
    try {
        const formData = new FormData();
        formData.append('rating', reviewData.rating.toString());
        if (reviewData.title) formData.append('title', reviewData.title);
        if (reviewData.review_text) formData.append('review_text', reviewData.review_text);
        
        // Append existing images
        if (reviewData.existing_images && reviewData.existing_images.length > 0) {
            reviewData.existing_images.forEach((imagePath) => {
                formData.append('existing_images', imagePath);
            });
        }
        
        // Append new images if present
        if (reviewData.images && reviewData.images.length > 0) {
            reviewData.images.forEach((image) => {
                formData.append('images', image);
            });
        }

        const response = await axios.put(`/api/reviews/${reviewId}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error: any) {
        throw new Error(error.response?.data?.message || 'Failed to update review');
    }
};

export const deleteReview = async (reviewId: number): Promise<{
    res: 'success' | 'error';
    message: string;
}> => {
    try {
        const response = await axios.delete(`/api/reviews/${reviewId}`);
        return response.data;
    } catch (error: any) {
        throw new Error(error.response?.data?.message || 'Failed to delete review');
    }
};

export const toggleReviewHelpful = async (reviewId: number): Promise<{
    res: 'success' | 'error';
    helpful_count: number;
    is_helpful: boolean;
    message: string;
}> => {
    try {
        const response = await axios.post(`/api/reviews/${reviewId}/helpful`);
        return response.data;
    } catch (error: any) {
        throw new Error(error.response?.data?.message || 'Failed to update helpful status');
    }
};

export const getUserProductReview = async (productId: number | string): Promise<{
    res: 'success' | 'error';
    review: Review | null;
}> => {
    try {
        const response = await axios.get(`/api/products/${productId}/my-review`);
        return response.data;
    } catch (error: any) {
        throw new Error(error.response?.data?.message || 'Failed to fetch user review');
    }
};