"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import imgPlaceholder from "@/public/imagePlaceholder.png";
import { useLoader } from "@/context/LoaderContext";
import axios from "../../utils/axios";
import { X } from "lucide-react";
import ProductCard from "@/components/(frontend)/ProductCard";

const basePath = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";

type ProductShowProps = {
    subcategoryId: number;
    subcategoryName?: string;
};

const ProductShowComponent: React.FC<ProductShowProps> = ({ subcategoryId, subcategoryName }) => {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const observerTargetRef = useRef<HTMLDivElement | null>(null);

    // Backend Filter & Sort States (matching /products page)
    const [priceRange, setPriceRange] = useState<string>('all');
    const [sortBy, setSortBy] = useState<string>('newest');

    const router = useRouter();
    const { hideLoader } = useLoader();

    useEffect(() => {
        if (subcategoryId) {
            fetchProducts(1, false);
        }
    }, [subcategoryId, priceRange, sortBy]);

    const fetchProducts = async (pageToFetch = 1, isAppend = false) => {
        if (isAppend) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }
        try {
            const params: any = {
                category_id: subcategoryId,
                page: pageToFetch,
                per_page: 20,
            };

            if (priceRange && priceRange !== 'all') {
                params.price_range = priceRange;
            }

            if (sortBy) {
                params.sort_by = sortBy;
            }

            const response = await axios.get('/api/products-paginated', { params });

            if (response.data.success || response.data.res === 'success') {
                const rawData = response.data.data;
                const productList = Array.isArray(rawData)
                    ? rawData
                    : (Array.isArray(rawData?.products) ? rawData.products : []);

                const pagination = response.data.pagination;
                const totalPagesCount = pagination?.last_page ?? 1;
                setHasMore(pageToFetch < totalPagesCount && productList.length > 0);

                if (isAppend) {
                    setProducts((prev) => [...prev, ...productList]);
                } else {
                    setProducts(productList);
                }
                setCurrentPage(pageToFetch);
                setErrorMessage(null);
            } else {
                if (!isAppend) setProducts([]);
                setHasMore(false);
            }
        } catch (err) {
            console.error("Error fetching products:", err);
            if (!isAppend) setErrorMessage("Failed to load products");
            setHasMore(false);
        } finally {
            hideLoader();
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // IntersectionObserver for Infinite Scroll
    useEffect(() => {
        const target = observerTargetRef.current;
        if (!target) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
                    fetchProducts(currentPage + 1, true);
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(target);
        return () => observer.disconnect();
    }, [hasMore, loading, loadingMore, currentPage, subcategoryId, priceRange, sortBy]);

    const clearFilters = () => {
        setPriceRange('all');
        setSortBy('newest');
    };

    if (loading && products.length === 0) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-200 border-t-[#007FFF] rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-sm font-semibold text-gray-600">Loading products...</p>
                </div>
            </div>
        );
    }

    if (errorMessage && products.length === 0) {
        return (
            <div className="py-12 text-center">
                <p className="text-red-500 font-semibold mb-4">{errorMessage}</p>
                <button
                    onClick={() => fetchProducts(1, false)}
                    className="px-6 py-2 bg-[#007FFF] text-white text-sm font-semibold rounded-full hover:bg-blue-600 transition-colors"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Top Header Controls Bar (Matching /products page layout) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                {/* Left: Category Title & Product Counter */}
                <div className="flex-shrink-0">
                    <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#0c2340] capitalize">
                        {subcategoryName || "All Products"}
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">{products.length} products available</p>
                </div>

                {/* Right: Price & Sort Dropdowns Controls (No outer box border) */}
                <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap justify-start sm:justify-end">
                    {/* PRICE Dropdown */}
                    <div className="flex items-center gap-1.5">
                        <select
                            value={priceRange}
                            onChange={(e) => setPriceRange(e.target.value)}
                            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#007FFF] cursor-pointer"
                        >
                            <option value="all">All Prices</option>
                            <option value="under1000">Under ₹1,000</option>
                            <option value="1000to2000">₹1,000 - ₹2,000</option>
                            <option value="above2000">Above ₹2,000</option>
                        </select>
                    </div>

                    {/* SORT Dropdown */}
                    <div className="flex items-center gap-1.5">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#007FFF] cursor-pointer"
                        >
                            <option value="newest">Newest First</option>
                            <option value="price_low">Price: Low to High</option>
                            <option value="price_high">Price: High to Low</option>
                            <option value="rating">Highest Rated</option>
                        </select>
                    </div>

                    {/* Reset Button */}
                    {(priceRange !== 'all' || sortBy !== 'newest') && (
                        <button
                            onClick={clearFilters}
                            className="text-xs font-semibold text-[#007FFF] hover:text-[#0066CC] bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-200 transition-all flex items-center gap-1"
                        >
                            <X className="w-3.5 h-3.5" />
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {/* Products Grid (5-Column Grid Layout matching /products) */}
            {products.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-3xl border border-gray-200/80 shadow-xs">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No Products Found</h3>
                    <p className="text-gray-500 text-sm mb-6">No products match the selected price or category filters.</p>
                    {(priceRange !== 'all' || sortBy !== 'newest') && (
                        <button
                            onClick={clearFilters}
                            className="px-6 py-2.5 bg-[#007FFF] text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-all"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-3.5 sm:gap-4.5 mb-6">
                        {products.map((product) => {
                            const formattedProduct = {
                                ...product,
                                image_url: product.image_url
                                    ? (product.image_url.startsWith('http') ? product.image_url : `${basePath}${product.image_url}`)
                                    : (product.variants?.[0]?.image_url
                                        ? (product.variants[0].image_url.startsWith('http') ? product.variants[0].image_url : `${basePath}${product.variants[0].image_url}`)
                                        : imgPlaceholder.src)
                            };

                            return (
                                <ProductCard
                                    key={product.id}
                                    product={formattedProduct}
                                />
                            );
                        })}
                    </div>

                    {/* Infinite Scroll Sentinel & Animated Scrollable Loader */}
                    <div ref={observerTargetRef} className="w-full py-8 flex flex-col items-center justify-center">
                        {loadingMore && (
                            <div className="flex items-center gap-3 px-6 py-3 bg-white shadow-md rounded-full border border-gray-100 text-[#007FFF] font-semibold text-sm animate-pulse">
                                <div className="w-5 h-5 border-2 border-[#007FFF] border-t-transparent rounded-full animate-spin" />
                                <span>Loading more products...</span>
                            </div>
                        )}
                        {!hasMore && products.length > 0 && (
                            <p className="text-xs text-gray-400 font-medium py-2">You've reached the end of products.</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default ProductShowComponent;
