'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Search,
    Star,
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    ChevronRight,
    SlidersHorizontal,
    X,
    RotateCcw,
    Check,
} from 'lucide-react';
import axios from '../../../../utils/axios';
import ProductCard from '@/components/(frontend)/ProductCard';
import { useProductSync, ProductEventData } from '@/context/ProductSyncContext';

interface Variant {
    id: number;
    title?: string;
    mrp: number;
    sp: number;
    stock: number;
    image_url?: string;
    color?: string;
}

interface Product {
    id: number;
    name: string;
    description?: string;
    image_url?: string;
    category?: { id: number; name: string };
    brand?: { id: number; name: string };
    brand_name?: string;
    category_name?: string;
    average_rating?: number;
    reviews_count?: number;
    total_stock?: number;
    is_bestseller?: boolean;
    is_new_arrival?: boolean;
    variants: Variant[];
    best_variant?: Variant | null;
}

interface NarrowOption {
    label: string;
    tag: string;
    icon?: string;
    count: number;
}

interface FacetCategory {
    id: number;
    name: string;
    count: number;
}

interface FacetBrand {
    id: number;
    name: string;
    count: number;
}

interface FacetColor {
    name: string;
    count: number;
}

interface Facets {
    narrow_options: NarrowOption[];
    available_categories: FacetCategory[];
    available_brands: FacetBrand[];
    available_colors: FacetColor[];
    price_stats: { min: number; max: number };
    rating_counts: {
        four_star: number;
        three_star: number;
        two_star: number;
        one_star: number;
    };
    discount_counts: {
        ten_plus: number;
        twentyfive_plus: number;
        fifty_plus: number;
        seventy_plus: number;
    };
}

interface SearchResponse {
    res: string;
    message: string;
    data: {
        products: Product[];
        facets?: Facets;
        pagination: {
            current_page: number;
            total_count: number;
            per_page: number;
            total_pages: number;
            has_more: boolean;
        };
        search_info: {
            query: string;
            results_count: number;
            total_results: number;
        };
    };
}

// Color map helper for visual swatches
const COLOR_HEX_MAP: Record<string, { bg: string; border: string }> = {
    black: { bg: "#1f2937", border: "#111827" },
    white: { bg: "#ffffff", border: "#d1d5db" },
    blue: { bg: "#2563eb", border: "#1d4ed8" },
    navy: { bg: "#1e3a8a", border: "#172554" },
    red: { bg: "#dc2626", border: "#b91c1c" },
    maroon: { bg: "#831843", border: "#701a75" },
    green: { bg: "#16a34a", border: "#15803d" },
    olive: { bg: "#365314", border: "#1a2e05" },
    yellow: { bg: "#eab308", border: "#ca8a04" },
    brown: { bg: "#78350f", border: "#451a03" },
    beige: { bg: "#f5f5dc", border: "#d6d3d1" },
    grey: { bg: "#6b7280", border: "#4b5563" },
    gray: { bg: "#6b7280", border: "#4b5563" },
    pink: { bg: "#ec4899", border: "#db2777" },
    purple: { bg: "#9333ea", border: "#7e22ce" },
    orange: { bg: "#ea580c", border: "#c2410c" },
    silver: { bg: "#e2e8f0", border: "#cbd5e1" },
    gold: { bg: "#fbbf24", border: "#d97706" },
};

const SearchPage = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const query = searchParams?.get('q') || '';

    // Results & Facets State from Backend
    const [products, setProducts] = useState<Product[]>([]);
    const [facets, setFacets] = useState<Facets | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [pagination, setPagination] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const observerTargetRef = useRef<HTMLDivElement | null>(null);
    const pillScrollRef = useRef<HTMLDivElement | null>(null);

    // Active Filter State
    const [sortBy, setSortBy] = useState('featured');
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
    const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>([]);
    const [priceBracket, setPriceBracket] = useState<string | null>(null);
    const [customMinPrice, setCustomMinPrice] = useState<string>('');
    const [customMaxPrice, setCustomMaxPrice] = useState<string>('');
    const [minRating, setMinRating] = useState<number | null>(null);
    const [minDiscount, setMinDiscount] = useState<number | null>(null);
    const [freeShippingOnly, setFreeShippingOnly] = useState<boolean>(false);
    const [selectedColors, setSelectedColors] = useState<string[]>([]);
    const [activeNarrowTag, setActiveNarrowTag] = useState<string | null>(null);

    // Sidebar expand states
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [showAllBrands, setShowAllBrands] = useState(false);
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

    // Compute effective min / max price for API request
    const effectiveMinPrice = useMemo(() => {
        if (customMinPrice) return customMinPrice;
        if (priceBracket === "500-1000") return '500';
        if (priceBracket === "1000-2000") return '1000';
        if (priceBracket === "above-2000") return '2000';
        return undefined;
    }, [customMinPrice, priceBracket]);

    const effectiveMaxPrice = useMemo(() => {
        if (customMaxPrice) return customMaxPrice;
        if (priceBracket === "under-500") return '500';
        if (priceBracket === "500-1000") return '1000';
        if (priceBracket === "1000-2000") return '2000';
        return undefined;
    }, [customMaxPrice, priceBracket]);

    // Backend Search Fetcher
    const fetchSearchResults = useCallback(async (pageToFetch = 1, isAppend = false) => {
        if (!query.trim()) return;

        if (isAppend) {
            setLoadingMore(true);
        } else {
            setIsLoading(true);
        }

        try {
            const params: any = {
                q: query,
                page: pageToFetch,
                limit: 40,
                sort_by: sortBy,
            };

            if (selectedCategoryIds.length > 0) {
                params.category_ids = selectedCategoryIds.join(',');
            }
            if (selectedBrandIds.length > 0) {
                params.brand_ids = selectedBrandIds.join(',');
            }
            if (effectiveMinPrice !== undefined) {
                params.min_price = effectiveMinPrice;
            }
            if (effectiveMaxPrice !== undefined) {
                params.max_price = effectiveMaxPrice;
            }
            if (minRating !== null) {
                params.min_rating = minRating;
            }
            if (minDiscount !== null) {
                params.min_discount = minDiscount;
            }
            if (selectedColors.length > 0) {
                params.colors = selectedColors.join(',');
            }
            if (activeNarrowTag) {
                params.narrow_tag = activeNarrowTag;
            }
            if (freeShippingOnly) {
                params.free_shipping = true;
            }

            const response = await axios.get<SearchResponse>(`/api/search-products`, { params });

            if (response.data.res === 'success') {
                const results = response.data.data?.products || [];
                const pag = response.data.data?.pagination;
                const newFacets = response.data.data?.facets;

                if (newFacets && (!facets || (!isAppend && selectedCategoryIds.length === 0 && selectedBrandIds.length === 0 && !activeNarrowTag))) {
                    setFacets(newFacets);
                } else if (newFacets && !facets) {
                    setFacets(newFacets);
                }

                setHasMore(pag?.has_more ?? false);

                if (isAppend) {
                    setProducts((prev) => [...prev, ...results]);
                } else {
                    setProducts(results);
                }

                setCurrentPage(pageToFetch);
                setPagination(pag);
            } else {
                if (!isAppend) setProducts([]);
                setHasMore(false);
            }
        } catch (error) {
            console.error('Search error:', error);
            if (!isAppend) setProducts([]);
            setHasMore(false);
        } finally {
            setIsLoading(false);
            setLoadingMore(false);
        }
    }, [
        query,
        sortBy,
        selectedCategoryIds,
        selectedBrandIds,
        effectiveMinPrice,
        effectiveMaxPrice,
        minRating,
        minDiscount,
        selectedColors,
        activeNarrowTag,
        freeShippingOnly,
        facets
    ]);

    const { subscribeToAll } = useProductSync();

    // Real-time synchronization for search results
    useEffect(() => {
        const unsubscribe = subscribeToAll((event: ProductEventData) => {
            const updatedProd = event.product;
            const pid = event.productId || (updatedProd?.id ? Number(updatedProd.id) : undefined);
            if (!pid) return;

            if (event.action === "deleted" || (event.action === "status_changed" && event.status === false)) {
                setProducts((prev) => prev.filter((p) => Number(p.id) !== pid));
            } else if (event.action === "updated" && updatedProd) {
                setProducts((prev) =>
                    prev.map((p) => {
                        if (Number(p.id) !== pid) return p;
                        return {
                            ...p,
                            ...updatedProd,
                            name: updatedProd.name ?? p.name,
                            image_url: updatedProd.image_url ?? p.image_url,
                            variants: updatedProd.variants ?? p.variants,
                        };
                    })
                );
            }
        });

        return () => {
            unsubscribe();
        };
    }, [subscribeToAll]);

    // Reset and search when query changes
    useEffect(() => {
        setFacets(null);
        setSelectedCategoryIds([]);
        setSelectedBrandIds([]);
        setPriceBracket(null);
        setCustomMinPrice('');
        setCustomMaxPrice('');
        setMinRating(null);
        setMinDiscount(null);
        setSelectedColors([]);
        setActiveNarrowTag(null);
        setFreeShippingOnly(false);
        fetchSearchResults(1, false);
    }, [query]);

    // Re-fetch when filter options change
    useEffect(() => {
        fetchSearchResults(1, false);
    }, [
        sortBy,
        selectedCategoryIds,
        selectedBrandIds,
        priceBracket,
        customMinPrice,
        customMaxPrice,
        minRating,
        minDiscount,
        selectedColors,
        activeNarrowTag,
        freeShippingOnly
    ]);

    // Clear all filters
    const handleClearAllFilters = () => {
        setSelectedCategoryIds([]);
        setSelectedBrandIds([]);
        setPriceBracket(null);
        setCustomMinPrice('');
        setCustomMaxPrice('');
        setMinRating(null);
        setMinDiscount(null);
        setSelectedColors([]);
        setActiveNarrowTag(null);
        setFreeShippingOnly(false);
    };

    const hasActiveFilters = Boolean(
        selectedCategoryIds.length > 0 ||
        selectedBrandIds.length > 0 ||
        priceBracket ||
        customMinPrice ||
        customMaxPrice ||
        minRating !== null ||
        minDiscount !== null ||
        selectedColors.length > 0 ||
        activeNarrowTag !== null ||
        freeShippingOnly
    );

    // Scroll Narrow carousel
    const scrollPillCarousel = (direction: 'left' | 'right') => {
        if (pillScrollRef.current) {
            const offset = direction === 'left' ? -300 : 300;
            pillScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
        }
    };

    // Infinite scroll observer
    useEffect(() => {
        const target = observerTargetRef.current;
        if (!target) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isLoading && !loadingMore) {
                    fetchSearchResults(currentPage + 1, true);
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(target);
        return () => observer.disconnect();
    }, [hasMore, isLoading, loadingMore, currentPage, fetchSearchResults]);

    if (!query) {
        return (
            <div className="min-h-[70vh] bg-white flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-blue-50 text-[#007FFF] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                        <Search className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Search Products on Zelton</h2>
                    <p className="text-sm text-gray-500 mb-6">Type any search term above to explore official products, categories, and brands.</p>
                    <button
                        onClick={() => router.push("/")}
                        className="px-6 py-2.5 bg-[#007FFF] hover:bg-[#0066CC] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition active:scale-95 cursor-pointer"
                    >
                        Return to Store Home
                    </button>
                </div>
            </div>
        );
    }

    // Dynamic Narrow Options from Backend
    const narrowOptions = facets?.narrow_options || [];

    // Dynamic Categories from Backend
    const availableCategories = facets?.available_categories || [];

    // Dynamic Brands from Backend
    const availableBrands = facets?.available_brands || [];

    // Dynamic Colors from Backend
    const availableColors = facets?.available_colors || [];

    // Sidebar Content (used in Desktop Sidebar and Mobile Slideout Drawer)
    const SidebarFilterContent = (
        <div className="space-y-6 text-sm text-gray-800">
            {/* Active Filters Clear */}
            {hasActiveFilters && (
                <div className="pb-3 border-b border-gray-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 uppercase">Active Filters</span>
                    <button
                        onClick={handleClearAllFilters}
                        className="text-xs font-semibold text-[#007FFF] hover:underline cursor-pointer flex items-center gap-1"
                    >
                        <RotateCcw className="w-3 h-3" />
                        Clear All
                    </button>
                </div>
            )}

            {/* 1. Dynamic Categories matching search */}
            {availableCategories.length > 0 && (
                <div>
                    <h3 className="font-bold text-gray-900 text-sm mb-2.5">Category</h3>
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {availableCategories
                            .slice(0, showAllCategories ? undefined : 6)
                            .map((cat) => {
                                const isSelected = selectedCategoryIds.includes(cat.id);
                                return (
                                    <label
                                        key={cat.id}
                                        className="flex items-center gap-2.5 cursor-pointer select-none text-xs hover:text-[#007FFF]"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => {
                                                setSelectedCategoryIds((prev) =>
                                                    isSelected ? prev.filter((id) => id !== cat.id) : [...prev, cat.id]
                                                );
                                            }}
                                            className="rounded border-gray-300 text-[#007FFF] focus:ring-[#007FFF] cursor-pointer"
                                        />
                                        <span className="text-gray-800 line-clamp-1 flex-1 font-normal">{cat.name}</span>
                                        <span className="text-[10px] text-gray-400">({cat.count})</span>
                                    </label>
                                );
                            })}
                    </div>
                    {availableCategories.length > 6 && (
                        <button
                            onClick={() => setShowAllCategories(!showAllCategories)}
                            className="text-xs font-semibold text-[#007FFF] hover:underline mt-2 flex items-center gap-0.5 cursor-pointer"
                        >
                            {showAllCategories ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            <span>{showAllCategories ? "See less" : `See more (${availableCategories.length - 6})`}</span>
                        </button>
                    )}
                </div>
            )}

            <hr className="border-gray-200" />

            {/* 2. Eligible for Free Delivery */}
            <div>
                <h3 className="font-bold text-gray-900 text-sm mb-2">Delivery & Services</h3>
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={freeShippingOnly}
                        onChange={(e) => setFreeShippingOnly(e.target.checked)}
                        className="mt-0.5 rounded border-gray-300 text-[#007FFF] focus:ring-[#007FFF] cursor-pointer"
                    />
                    <div>
                        <span className="text-xs font-semibold text-gray-900 block">Eligible for Free Delivery</span>
                        <span className="text-[11px] text-gray-500 block leading-tight">Get FREE Shipping on eligible orders shipped by Zelton</span>
                    </div>
                </label>
            </div>

            <hr className="border-gray-200" />

            {/* 3. Dynamic Brands for searched product */}
            {availableBrands.length > 0 && (
                <div>
                    <h3 className="font-bold text-gray-900 text-sm mb-2.5">Brands</h3>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {availableBrands
                            .slice(0, showAllBrands ? undefined : 6)
                            .map((brand) => {
                                const isChecked = selectedBrandIds.includes(brand.id);
                                return (
                                    <label
                                        key={brand.id}
                                        className="flex items-center gap-2.5 cursor-pointer select-none text-xs hover:text-[#007FFF]"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {
                                                setSelectedBrandIds((prev) =>
                                                    isChecked ? prev.filter((id) => id !== brand.id) : [...prev, brand.id]
                                                );
                                            }}
                                            className="rounded border-gray-300 text-[#007FFF] focus:ring-[#007FFF] cursor-pointer"
                                        />
                                        <span className="text-gray-800 line-clamp-1 flex-1 font-normal">{brand.name}</span>
                                        <span className="text-[10px] text-gray-400">({brand.count})</span>
                                    </label>
                                );
                            })}
                    </div>

                    {availableBrands.length > 6 && (
                        <button
                            onClick={() => setShowAllBrands(!showAllBrands)}
                            className="text-xs font-semibold text-[#007FFF] hover:underline mt-2 flex items-center gap-0.5 cursor-pointer"
                        >
                            {showAllBrands ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            <span>{showAllBrands ? "See less" : `See more (${availableBrands.length - 6})`}</span>
                        </button>
                    )}
                </div>
            )}

            <hr className="border-gray-200" />

            {/* 4. Price Filter */}
            <div>
                <h3 className="font-bold text-gray-900 text-sm mb-2.5">Price</h3>
                <div className="space-y-1.5 text-xs">
                    {[
                        { label: "Under ₹500", key: "under-500" },
                        { label: "₹500 - ₹1,000", key: "500-1000" },
                        { label: "₹1,000 - ₹2,000", key: "1000-2000" },
                        { label: "Over ₹2,000", key: "above-2000" },
                    ].map(({ label, key }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setPriceBracket(priceBracket === key ? null : key)}
                            className={`block text-left w-full transition-colors hover:text-[#007FFF] cursor-pointer ${priceBracket === key ? "font-bold text-[#007FFF]" : "text-gray-700"
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Custom Min / Max Inputs */}
                <div className="flex items-center gap-2 mt-3 pt-2">
                    <input
                        type="number"
                        placeholder="₹ Min"
                        value={customMinPrice}
                        onChange={(e) => {
                            setPriceBracket(null);
                            setCustomMinPrice(e.target.value);
                        }}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-[#007FFF]"
                    />
                    <span className="text-gray-400 text-xs">-</span>
                    <input
                        type="number"
                        placeholder="₹ Max"
                        value={customMaxPrice}
                        onChange={(e) => {
                            setPriceBracket(null);
                            setCustomMaxPrice(e.target.value);
                        }}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-[#007FFF]"
                    />
                </div>
            </div>

            <hr className="border-gray-200" />

            {/* 5. Customer Reviews Rating */}
            <div>
                <h3 className="font-bold text-gray-900 text-sm mb-2.5">Avg. Customer Review</h3>
                <div className="space-y-1.5">
                    {[
                        { stars: 4, count: facets?.rating_counts?.four_star },
                        { stars: 3, count: facets?.rating_counts?.three_star },
                        { stars: 2, count: facets?.rating_counts?.two_star },
                        { stars: 1, count: facets?.rating_counts?.one_star },
                    ].map(({ stars, count }) => (
                        <button
                            key={stars}
                            type="button"
                            onClick={() => setMinRating(minRating === stars ? null : stars)}
                            className={`flex items-center justify-between text-xs w-full text-left transition-colors hover:text-[#007FFF] cursor-pointer ${minRating === stars ? "font-bold text-[#007FFF]" : "text-gray-700"
                                }`}
                        >
                            <div className="flex items-center gap-1.5">
                                <div className="flex items-center text-amber-500">
                                    {[...Array(5)].map((_, i) => (
                                        <Star
                                            key={i}
                                            className={`w-3.5 h-3.5 ${i < stars ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"
                                                }`}
                                        />
                                    ))}
                                </div>
                                <span className="text-xs">& Up</span>
                            </div>
                            {count !== undefined && <span className="text-[10px] text-gray-400">({count})</span>}
                        </button>
                    ))}
                </div>
            </div>

            <hr className="border-gray-200" />

            {/* 6. Discount */}
            <div>
                <h3 className="font-bold text-gray-900 text-sm mb-2.5">Discount</h3>
                <div className="space-y-1.5 text-xs">
                    {[
                        { pct: 10, count: facets?.discount_counts?.ten_plus },
                        { pct: 25, count: facets?.discount_counts?.twentyfive_plus },
                        { pct: 50, count: facets?.discount_counts?.fifty_plus },
                        { pct: 70, count: facets?.discount_counts?.seventy_plus },
                    ].map(({ pct, count }) => (
                        <button
                            key={pct}
                            type="button"
                            onClick={() => setMinDiscount(minDiscount === pct ? null : pct)}
                            className={`flex items-center justify-between text-left w-full transition-colors hover:text-[#007FFF] cursor-pointer ${minDiscount === pct ? "font-bold text-[#007FFF]" : "text-gray-700"
                                }`}
                        >
                            <span>{pct}% Off or more</span>
                            {count !== undefined && <span className="text-[10px] text-gray-400">({count})</span>}
                        </button>
                    ))}
                </div>
            </div>

            {/* 7. Dynamic Colors */}
            {availableColors.length > 0 && (
                <>
                    <hr className="border-gray-200" />
                    <div>
                        <h3 className="font-bold text-gray-900 text-sm mb-2.5">Colour</h3>
                        <div className="grid grid-cols-5 gap-2">
                            {availableColors.map((colorItem) => {
                                const cLower = colorItem.name.toLowerCase();
                                const swatch = COLOR_HEX_MAP[cLower] || { bg: "#94a3b8", border: "#64748b" };
                                const isSelected = selectedColors.includes(colorItem.name);
                                return (
                                    <button
                                        key={colorItem.name}
                                        type="button"
                                        onClick={() => {
                                            setSelectedColors((prev) =>
                                                isSelected ? prev.filter((c) => c !== colorItem.name) : [...prev, colorItem.name]
                                            );
                                        }}
                                        style={{ backgroundColor: swatch.bg }}
                                        title={`${colorItem.name} (${colorItem.count})`}
                                        className={`w-6 h-6 rounded-full border shadow-xs transition-all relative flex items-center justify-center cursor-pointer ${isSelected
                                            ? "ring-2 ring-[#007FFF] scale-110"
                                            : "hover:scale-110"
                                            }`}
                                    >
                                        {isSelected && (
                                            <Check
                                                className={`w-3 h-3 ${cLower === "white" || cLower === "beige" || cLower === "yellow" ? "text-gray-900" : "text-white"
                                                    }`}
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-white">
            {/* Top Amazon Results Header Bar */}
            <div className="border-b border-gray-200 bg-white">
                <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Results Count */}
                    <div className="text-sm text-gray-700 font-normal">
                        <span>
                            1-{products.length} of {pagination?.total_count || products.length} results for{" "}
                        </span>
                        <span className="font-bold text-[#e67a00]">&quot;{query}&quot;</span>
                        {hasActiveFilters && (
                            <span className="ml-2 text-xs font-semibold text-gray-500">
                                (Filtered: {products.length} items)
                            </span>
                        )}
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center gap-3 self-end sm:self-auto">
                        <button
                            onClick={() => setIsMobileFilterOpen(true)}
                            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md border border-gray-300 shadow-2xs cursor-pointer"
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>Filters</span>
                            {hasActiveFilters && (
                                <span className="w-2 h-2 rounded-full bg-[#007FFF]" />
                            )}
                        </button>

                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-600 hidden md:inline">Sort by:</span>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-md focus:ring-1 focus:ring-[#007FFF] focus:border-[#007FFF] block px-2.5 py-1.5 font-medium shadow-2xs cursor-pointer"
                            >
                                <option value="featured">Featured</option>
                                <option value="price_low_high">Price: Low to High</option>
                                <option value="price_high_low">Price: High to Low</option>
                                <option value="avg_rating">Avg. Customer Review</option>
                                <option value="newest">Newest Arrivals</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* "Narrow your search" Horizontal Pill Carousel */}
            {narrowOptions.length > 0 && (
                <div className="border-b border-gray-200 bg-white py-3.5">
                    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-sm font-bold text-gray-900">Narrow your search</h2>
                        </div>

                        <div className="relative group/pills">
                            <button
                                onClick={() => scrollPillCarousel('left')}
                                className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/95 border border-gray-300 shadow-md rounded-full items-center justify-center hover:bg-gray-50 z-10 transition opacity-0 group-hover/pills:opacity-100 cursor-pointer"
                                aria-label="Scroll left"
                            >
                                <ChevronLeft className="w-4 h-4 text-gray-700" />
                            </button>

                            <div
                                ref={pillScrollRef}
                                className="flex items-center gap-2.5 overflow-x-auto scrollbar-hide py-1"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                                {narrowOptions.map((pill) => {
                                    const isSelected = activeNarrowTag === pill.tag;
                                    return (
                                        <button
                                            key={pill.tag}
                                            type="button"
                                            onClick={() => setActiveNarrowTag(isSelected ? null : pill.tag)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs whitespace-nowrap transition-all shadow-2xs cursor-pointer flex-shrink-0 ${isSelected
                                                ? "bg-[#007FFF] text-white border-[#007FFF] font-bold shadow-xs"
                                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 font-medium"
                                                }`}
                                        >
                                            <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs flex-shrink-0">
                                                {pill.icon || "🏷️"}
                                            </span>
                                            <span>{pill.label}</span>
                                            {pill.count > 0 && (
                                                <span className={`text-[10px] ${isSelected ? "text-blue-100" : "text-gray-400"}`}>
                                                    ({pill.count})
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => scrollPillCarousel('right')}
                                className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/95 border border-gray-300 shadow-md rounded-full items-center justify-center hover:bg-gray-50 z-10 transition opacity-0 group-hover/pills:opacity-100 cursor-pointer"
                                aria-label="Scroll right"
                            >
                                <ChevronRight className="w-4 h-4 text-gray-700" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Layout: Filters on far Left + 5 Columns Results Grid */}
            <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex flex-col lg:flex-row gap-4 xl:gap-5 items-start">
                    {/* Left Sidebar Filters */}
                    <aside className="hidden lg:block w-52 xl:w-56 2xl:w-60 flex-shrink-0 border-r border-gray-200 pr-3.5 sticky top-20 max-h-[calc(100vh-5.5rem)] overflow-y-auto">
                        {SidebarFilterContent}
                    </aside>

                    {/* Right Results Grid */}
                    <main className="flex-1 min-w-0">
                        <div className="mb-3.5 flex items-center justify-between">
                            <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">Results</h2>
                            {products.length > 0 && (
                                <span className="text-xs text-gray-500 font-normal">
                                    Check each product page for other buying options.
                                </span>
                            )}
                        </div>

                        {/* Skeletons on initial load */}
                        {isLoading && products.length === 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3 lg:gap-3.5 py-4">
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="bg-[#F7F7F7] rounded-2xl border border-gray-200/80 p-2.5 sm:p-3 animate-pulse flex flex-col justify-between h-[320px]"
                                    >
                                        <div className="w-full aspect-square bg-gray-200 rounded-xl mb-2.5" />
                                        <div className="h-3.5 bg-gray-200 rounded w-3/4 mb-1.5" />
                                        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                                        <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between">
                                            <div className="h-4 bg-gray-200 rounded w-16" />
                                            <div className="h-4 bg-gray-200 rounded w-12" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : products.length > 0 ? (
                            <>
                                {/* Product Grid matching 5 products in a line */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3 lg:gap-3.5">
                                    {products.map((product) => (
                                        <ProductCard key={product.id} product={product} />
                                    ))}
                                </div>

                                {/* Infinite Scroll Sentinel */}
                                <div ref={observerTargetRef} className="w-full py-10 flex flex-col items-center justify-center">
                                    {loadingMore && (
                                        <div className="flex items-center gap-2.5 px-5 py-2.5 bg-white shadow-md rounded-full border border-gray-200 text-[#007FFF] font-semibold text-xs animate-pulse">
                                            <div className="w-4 h-4 border-2 border-[#007FFF] border-t-transparent rounded-full animate-spin" />
                                            <span>Loading more results...</span>
                                        </div>
                                    )}
                                    {!hasMore && products.length > 0 && (
                                        <div className="text-center pt-6">
                                            <p className="text-xs text-gray-400 font-medium">You&apos;ve reached the end of search results.</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            /* Empty State */
                            <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center max-w-md mx-auto my-12 shadow-xs">
                                <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Search className="w-8 h-8" />
                                </div>
                                <h3 className="text-base font-bold text-gray-900 mb-1">No results matching your filters</h3>
                                <p className="text-xs text-gray-500 mb-5">Try checking your spelling or adjusting active filters to see more results.</p>
                                {hasActiveFilters ? (
                                    <button
                                        onClick={handleClearAllFilters}
                                        className="px-5 py-2 bg-[#007FFF] hover:bg-[#0066CC] text-white text-xs font-bold rounded-xl shadow transition active:scale-95 cursor-pointer"
                                    >
                                        Clear All Filters
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => router.push("/")}
                                        className="px-5 py-2 bg-[#007FFF] hover:bg-[#0066CC] text-white text-xs font-bold rounded-xl shadow transition active:scale-95 cursor-pointer"
                                    >
                                        Back to Home
                                    </button>
                                )}
                            </div>
                        )}
                    </main>
                </div>
            </div>

            {/* Mobile Filter Slide-out Drawer */}
            {isMobileFilterOpen && (
                <div className="fixed inset-0 z-50 lg:hidden flex">
                    <div
                        onClick={() => setIsMobileFilterOpen(false)}
                        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
                    />

                    <div className="relative ml-auto w-full max-w-xs bg-white h-full shadow-2xl flex flex-col z-10">
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 text-sm">Filters</h3>
                            <button
                                onClick={() => setIsMobileFilterOpen(false)}
                                className="p-1 text-gray-500 hover:text-gray-800 rounded-full hover:bg-gray-100 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto flex-1">
                            {SidebarFilterContent}
                        </div>

                        <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-3">
                            {hasActiveFilters && (
                                <button
                                    onClick={handleClearAllFilters}
                                    className="flex-1 py-2 text-xs font-bold bg-white border border-gray-300 text-gray-700 rounded-md cursor-pointer"
                                >
                                    Reset
                                </button>
                            )}
                            <button
                                onClick={() => setIsMobileFilterOpen(false)}
                                className="flex-1 py-2 text-xs font-bold bg-[#007FFF] hover:bg-[#0066CC] text-white rounded-md shadow cursor-pointer"
                            >
                                Apply Filters ({products.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchPage;