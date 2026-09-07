import axiosInstance from "./axios";

export interface DashboardFilterParams {
    period?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    categoryId?: string;
    brandId?: string;
    customerId?: string;
}

export interface DashboardStatistics {
    success: boolean;
    data: {
        period: string;
        filter: {
            period: string;
            status: string;
            payment_method: string;
            payment_status: string;
            category_id?: number | null;
            start_date?: string;
            end_date?: string;
        };
        overview: {
            total_users: number;
            total_products: number;
            total_orders: number;
            monthly_revenue: number;
            today_revenue: number;
            average_order_value: number;
            aov_growth?: number;
            revenue_growth: number;
            orders_growth: number;
            users_growth: number;
            new_users_this_month: number;
            pending_action_count: number;
        };
        kpis: Array<{
            id: string;
            title: string;
            value: number;
            formatted?: string;
            growth?: number;
            subtitle?: string;
        }>;
        orders: {
            pending: number;
            confirmed?: number;
            processing: number;
            shipped: number;
            out_for_delivery?: number;
            delivered: number;
            completed?: number;
            cancelled: number;
            status_distribution: Record<string, number>;
        };
        refunds: {
            count: number;
            amount: number;
            pending: number;
            completed: number;
            failed: number;
        };
        returns: {
            total: number;
            pending: number;
            approved: number;
            completed: number;
            rejected: number;
            rate: number;
        };
        cancellations: {
            count: number;
            rate: number;
            amount: number;
        };
        payments: {
            online: {
                count: number;
                total: number;
                successful: number;
                successful_amount: number;
                pending: number;
                failed: number;
                failed_amount: number;
                refunded: number;
                success_rate: number;
                failure_rate: number;
            };
            cod: {
                count: number;
                total: number;
                collected: number;
                pending: number;
                cancelled: number;
                success_rate: number;
            };
        };
        shipping: {
            total: number;
            created: number;
            in_transit: number;
            out_for_delivery: number;
            delivered: number;
            failures: number;
            pending: number;
            delivery_success_rate: number;
        };
        discounts: {
            gross_sales: number;
            net_sales: number;
            total_discount_amount: number;
            orders_with_discount_count: number;
            average_discount_per_order: number;
            discount_percentage: number;
        };
        category_performance: {
            total_categories: number;
            active_categories_with_sales: number;
            categories: Array<{
                id: number;
                name: string;
                orders_count: number;
                units_sold: number;
                revenue: number;
                revenue_percentage: number;
            }>;
            best_category?: { id: number; name: string; revenue: number; revenue_percentage: number } | null;
            lowest_category?: { id: number; name: string; revenue: number; revenue_percentage: number } | null;
        };
        inventory_value: {
            total_units: number;
            cost_value: number;
            retail_value: number;
            potential_profit_margin: number;
            low_stock_units: number;
            out_of_stock_count: number;
        };
        action_required: Array<{
            id: string;
            type: 'critical' | 'warning' | 'pending' | 'info' | 'reviews';
            title: string;
            message: string;
            count: number;
            link: string;
        }>;
        inventory: {
            total_products?: number;
            in_stock?: number;
            low_stock: number;
            out_of_stock: number;
            low_stock_products?: Array<{
                id: number;
                variant_id: number;
                name: string;
                stock: number;
                threshold: number;
                sku?: string;
            }>;
            out_of_stock_products?: Array<{
                id: number;
                variant_id: number;
                name: string;
                stock: number;
                sku?: string;
            }>;
        };
        messages: {
            unread: number;
        };
        charts: {
            revenue_timeline?: Array<{
                date: string;
                revenue: number;
                orders: number;
                aov: number;
            }>;
            revenue_by_month: Array<{
                month: string;
                revenue: number;
                orders: number;
            }>;
            top_products: Array<{
                id: number;
                name: string;
                category?: string;
                image?: string | null;
                total_sold: number;
                total_revenue: number;
                stock?: number;
            }>;
            poor_performing_products?: Array<{
                id: number;
                name: string;
                category?: string;
                total_sold: number;
                total_revenue: number;
                created_at?: string;
            }>;
        };
        latest_orders: Array<{
            id: number;
            order_id?: string;
            order_number?: string;
            customer_name: string;
            customer_email: string;
            total_amount?: number;
            total?: number;
            status: string;
            payment_method?: string;
            payment_status?: string;
            items_count?: number;
            created_at: string;
        }>;
        recent_users: Array<{
            id: number;
            name: string;
            email: string;
            created_at: string;
            role?: string;
        }>;
        store_insights: string[];
    };
}

export const getDashboardStatistics = async (params?: DashboardFilterParams): Promise<DashboardStatistics> => {
    const response = await axiosInstance.get('/api/admin/dashboard/statistics', { params });
    return response.data;
};
