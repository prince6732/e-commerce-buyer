"use client";
import React, { useState, useEffect } from "react";
import { FaStar, FaStarHalfAlt, FaEye, FaArrowLeft } from "react-icons/fa";
import { getMostOrderedProducts } from "../../../../utils/product";
import { getImageUrl } from "../../../../utils/imageUtils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProductCard from "@/components/(frontend)/ProductCard";

interface PopularProduct {
    id: number;
    name: string;
    description: string;
    image_url: string | null;
    category: {
        id: number;
        name: string;
    } | null;
    brand: {
        id: number;
        name: string;
    } | null;
    price_range: {
        min: string | number;
        max: string | number;
        currency: string;
    };
    total_stock: number;
    likes_count: number;
    variants_count: number;
    best_variant: {
        id: number;
        title: string | null;
        sku: string;
        sp: string | number;
        mrp: string | number;
        stock: number;
        image_url: string | null;
    } | null;
    total_ordered_quantity: number;
    total_orders_count: number;
    total_revenue: number;
    average_rating: string | number;
    reviews_count: number;
    created_at: string;
}

interface Analytics {
    total_units_sold: number;
    total_revenue: number;
    total_orders: number;
    average_rating: number;
}

const Popular_Products = () => {
    const router = useRouter();
    const [products, setProducts] = useState<PopularProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPopularProducts = async () => {
            try {
                setLoading(true);
                const response = await getMostOrderedProducts(8);

                if (response.success && response.result) {
                    const products = response.result.products || [];

                    setProducts(products);

                    if (products.length === 0) {
                        console.warn("No products found in response");
                    }
                } else {
                    console.error("Response not successful:", response);
                    setError(response.message || "Failed to fetch popular products");
                }
            } catch (err) {
                setError("An error occurred while fetching products");
                console.error("Error fetching popular products:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchPopularProducts();
    }, []);

    const Rating = ({ rating, reviewsCount }: { rating: number; reviewsCount: number }) => {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 !== 0;

        return (
            <div className="flex items-center">
                <div className="flex text-amber-400 text-sm">
                    {Array.from({ length: fullStars }).map((_, i) => (
                        <FaStar key={i} />
                    ))}
                    {hasHalfStar && <FaStarHalfAlt />}
                    {Array.from({ length: 5 - fullStars - (hasHalfStar ? 1 : 0) }).map((_, i) => (
                        <FaStar key={`empty-${i}`} className="text-gray-300" />
                    ))}
                </div>
                <span className="text-xs text-gray-500 ml-1">({reviewsCount})</span>
            </div>
        );
    };

    const formatPrice = (price: number, currency: string = "USD") => {
        return currency === "INR" ? `₹${price.toLocaleString()}` : `$${price.toFixed(2)}`;
    };

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    if (loading) {
        return (
            <section className="">
                <div className="container">
                    {/* Skeleton Header */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 sm:mb-8 md:mb-12">
                        <div className="w-full">
                            <div className="h-6 sm:h-7 md:h-8 bg-gray-300 rounded w-64 sm:w-72 md:w-80 mb-2 animate-pulse"></div>
                            <div className="h-3 sm:h-4 bg-gray-200 rounded w-72 sm:w-80 md:w-96 animate-pulse"></div>
                        </div>
                    </div>

                    {/* Skeleton Product Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                        {Array.from({ length: 8 }).map((_, index) => (
                            <div key={index} className="group bg-white rounded-lg shadow-md overflow-hidden">
                                {/* Skeleton Product Image */}
                                <div className="relative overflow-hidden rounded-t-lg">
                                    <div className="w-full h-48 sm:h-56 md:h-64 lg:h-80 bg-gradient-to-br from-gray-200 via-gray-300 to-gray-200 animate-pulse" />
                                    {/* Shimmer Effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 animate-shimmer" />
                                </div>

                                {/* Skeleton Product Details */}
                                <div className="p-2 sm:p-3 md:px-4 md:pb-4 space-y-2 sm:space-y-3">
                                    {/* Skeleton Title */}
                                    <div className="space-y-1 sm:space-y-2">
                                        <div className="h-3 sm:h-4 bg-gray-300 rounded animate-pulse w-full" />
                                        <div className="h-3 sm:h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                                    </div>

                                    {/* Skeleton Rating */}
                                    <div className="flex items-center space-x-1">
                                        <div className="flex space-x-0.5 sm:space-x-1">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <div key={i} className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-gray-300 rounded animate-pulse" />
                                            ))}
                                        </div>
                                        <div className="h-2.5 sm:h-3 bg-gray-200 rounded animate-pulse w-6 sm:w-8" />
                                    </div>

                                    {/* Skeleton Price */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1 sm:gap-2">
                                            <div className="h-4 sm:h-5 bg-gray-300 rounded animate-pulse w-12 sm:w-16" />
                                            <div className="h-3 sm:h-4 bg-gray-200 rounded animate-pulse w-10 sm:w-12" />
                                        </div>
                                        <div className="h-3 sm:h-4 bg-red-100 rounded animate-pulse w-10 sm:w-12" />
                                    </div>

                                    {/* Skeleton Category and Orders */}
                                    <div className="flex items-center justify-between">
                                        <div className="h-2.5 sm:h-3 bg-gray-200 rounded animate-pulse w-12 sm:w-16" />
                                        <div className="h-2.5 sm:h-3 bg-gray-200 rounded animate-pulse w-16 sm:w-20" />
                                    </div>

                                    {/* Skeleton Stock Info - Hidden on mobile */}
                                    <div className="hidden sm:flex justify-between">
                                        <div className="h-3 bg-gray-200 rounded animate-pulse w-20" />
                                        <div className="h-3 bg-gray-200 rounded animate-pulse w-24" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="py-8 sm:py-12 md:py-16">
                <div className="container mx-auto px-3 sm:px-4 md:px-6">
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 sm:mb-8 md:mb-12">Most Ordered Products</h2>
                    <div className="text-center py-8 sm:py-10 md:py-12 bg-gray-50 rounded-lg">
                        <p className="text-red-500 mb-4 text-sm sm:text-base">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            style={{ backgroundColor: 'var(--theme-blue)', color: '#FFFAFB' }}
                            className="px-4 sm:px-6 py-2 text-sm sm:text-base rounded-lg hover:bg-[#0066CC] transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="py-8 sm:py-12 md:py-16">
            <div className="container mx-auto px-3 sm:px-4 md:px-6">
                {/* Header with Analytics */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 sm:mb-8 md:mb-12">
                    <div>
                        <div className="flex items-center gap-3 sm:gap-4 mb-1 sm:mb-2">
                            <button
                                onClick={() => router.back()}
                                className="text-gray-600 hover:text-[#007FFF] transition-colors group flex-shrink-0"
                                aria-label="Go back"
                            >
                                <FaArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 group-hover:-translate-x-1 transition-transform duration-200" />
                            </button>
                            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Most Ordered Products</h2>
                        </div>
                        <p className="text-xs sm:text-sm md:text-base text-gray-600 ml-0 sm:ml-10">Based on actual order data and customer purchases</p>
                    </div>
                </div>

                {/* Product Grid - Real Data */}
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                    {products.length > 0 ? (
                        products.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))
                    ) : (
                        <div className="col-span-full text-center py-8 sm:py-10 md:py-12">
                            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full mb-3 sm:mb-4">
                                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                            </div>
                            <p className="text-gray-500 text-base sm:text-lg font-medium">No popular products found</p>
                            <p className="text-gray-400 text-xs sm:text-sm mt-2">Products will appear here once customers start placing orders</p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default Popular_Products;