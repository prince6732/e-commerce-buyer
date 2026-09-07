import axios from "./axios";
import { ProductDetail } from "@/common/interface";

export interface SimilarProductsResponse {
    products: ProductDetail[];
    pagination: {
        current_page: number;
        per_page: number;
        total: number;
        last_page: number;
        has_more: boolean;
    };
}

export const getSimilarProducts = async (
    productId: number | string,
    page: number = 1,
    perPage: number = 10
): Promise<SimilarProductsResponse> => {
    try {
        const response = await axios.get(`/api/get-similar-products/${productId}`, {
            params: { page, per_page: perPage }
        });
        if (response.data.res === 'success') {
            return {
                products: response.data.products,
                pagination: response.data.pagination
            };
        }
        return {
            products: [],
            pagination: {
                current_page: 1,
                per_page: perPage,
                total: 0,
                last_page: 1,
                has_more: false
            }
        };
    } catch (error) {
        console.error('Error fetching similar products:', error);
        return {
            products: [],
            pagination: {
                current_page: 1,
                per_page: perPage,
                total: 0,
                last_page: 1,
                has_more: false
            }
        };
    }
};
