"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "../../../../utils/axios";
import imgPlaceholder from "@/public/imagePlaceholder.png";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "@/components/(frontend)/ProductCard";
import { getCategorySlug, getProductSlug } from "../../../../utils/slugUtils";
import { useProductSync, ProductEventData } from "@/context/ProductSyncContext";

type Product = {
    id: number;
    name: string;
    description: string;
    image_url: string;
    min_price: number;
    max_price: number;
    is_bestseller?: boolean | number;
    sales_count?: number;
    average_rating?: number;
    reviews_count?: number;
    brand: { id: number; name: string } | null;
    category: { id: number; name: string } | null;
    best_variant?: {
        id: number;
        sku: string;
        sp: string | number;
        mrp: string | number;
        stock: number;
        image_url: string | null;
        bs?: number | null;
    } | null;
    variants?: any[];
};

type Category = {
    id: number;
    name: string;
};

const imageUrl = `${process.env.NEXT_PUBLIC_UPLOAD_BASE}`;

export default function ProductSlider() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const filterScrollRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Mouse drag-to-scroll state for products slider
    const isDraggingRef = useRef(false);
    const dragStartXRef = useRef(0);
    const dragScrollLeftRef = useRef(0);
    const [isDragging, setIsDragging] = useState(false);
    const hasDraggedRef = useRef(false);

    // Auto-scroll loop and pause controls for Category Slider
    const isFilterPausedRef = useRef(false);
    const filterAnimFrameIdRef = useRef<number | null>(null);
    const filterResumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Mouse drag-to-scroll state for Category Slider
    const isFilterDraggingRef = useRef(false);
    const filterDragStartXRef = useRef(0);
    const filterDragScrollLeftRef = useRef(0);
    const filterHasDraggedRef = useRef(false);
    const [isFilterDragging, setIsFilterDragging] = useState(false);

    const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = scrollContainerRef.current;
        if (!el) return;
        isDraggingRef.current = true;
        hasDraggedRef.current = false;
        dragStartXRef.current = e.pageX - el.offsetLeft;
        dragScrollLeftRef.current = el.scrollLeft;
        setIsDragging(true);
    };

    const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return;
        e.preventDefault();
        const el = scrollContainerRef.current;
        if (!el) return;
        const x = e.pageX - el.offsetLeft;
        const walk = (x - dragStartXRef.current) * 1.5;
        if (Math.abs(x - dragStartXRef.current) > 5) {
            hasDraggedRef.current = true;
        }
        el.scrollLeft = dragScrollLeftRef.current - walk;
    };

    const onMouseUp = () => {
        isDraggingRef.current = false;
        setIsDragging(false);
    };

    const onMouseLeave = () => {
        if (isDraggingRef.current) {
            isDraggingRef.current = false;
            setIsDragging(false);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await axios.get(`/api/products`);
            if (res.data.success && Array.isArray(res.data.data)) {
                let data = res.data.data.map((prod: Product) => {
                    let productImage = prod.image_url
                        ? prod.image_url.startsWith('http') ? prod.image_url : `${imageUrl}${prod.image_url}`
                        : prod.variants?.[0]?.image_url
                            ? prod.variants[0].image_url.startsWith('http') ? prod.variants[0].image_url : `${imageUrl}${prod.variants[0].image_url}`
                            : imgPlaceholder.src;

                    return {
                        ...prod,
                        image_url: productImage,
                    };
                });

                // Display most selling products FIRST, followed by other products
                data.sort((a: any, b: any) => {
                    const aScore = (a.is_bestseller ? 1000 : 0) + (a.sales_count || 0) + (a.best_variant?.bs ? 500 : 0);
                    const bScore = (b.is_bestseller ? 1000 : 0) + (b.sales_count || 0) + (b.best_variant?.bs ? 500 : 0);
                    return bScore - aScore;
                });

                setProducts(data);
            }
        } catch (error) {
            console.error("Failed to fetch bestseller products", error);
        } finally {
            setLoading(false);
        }
    };

    const { subscribeToAll } = useProductSync();

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
                        };
                    })
                );
            }
        });

        return () => {
            unsubscribe();
        };
    }, [subscribeToAll]);

    useEffect(() => {
        fetchProducts();
    }, []);

    // Fetch categories from API
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await axios.get(`/api/categories-with-products`);
                let data: Category[] = [];
                if (Array.isArray(res.data)) data = res.data;
                else if (res.data.success && Array.isArray(res.data.data)) data = res.data.data;
                setCategories(data);
            } catch {
                // silently fail — pills just won't show
            }
        };
        fetchCategories();
    }, []);

    // Prepare repeated categories for infinite loop scrolling (without 'All' option)
    const baseCategoryItems = useMemo(() => [
        ...categories.map((c) => ({ id: c.id, name: c.name })),
    ], [categories]);

    const repeatCount = 4;
    const repeatedCategories = useMemo(() => {
        if (baseCategoryItems.length <= 1) return baseCategoryItems;
        const list: typeof baseCategoryItems = [];
        for (let i = 0; i < repeatCount; i++) {
            list.push(...baseCategoryItems);
        }
        return list;
    }, [baseCategoryItems]);

    // Continuous auto-sliding animation in an infinite loop (smooth & slow pace)
    useEffect(() => {
        if (categories.length === 0) return;

        const container = filterScrollRef.current;
        if (!container) return;

        // Position in the middle set on mount
        const setWidth = container.scrollWidth / repeatCount;
        if (container.scrollLeft === 0 && setWidth > 0) {
            container.scrollLeft = setWidth;
        }

        let lastTime = performance.now();
        const speed = 0.60 // Slower, calmer and smoother sliding pace

        const animate = (time: number) => {
            const dt = Math.min(time - lastTime, 50);
            lastTime = time;

            if (!isFilterPausedRef.current && !isFilterDraggingRef.current && container) {
                const currentSetWidth = container.scrollWidth / repeatCount;
                if (currentSetWidth > 0) {
                    container.scrollLeft += (speed * dt) / 16.67;

                    // Infinite seamless wrapping
                    if (container.scrollLeft >= currentSetWidth * (repeatCount - 1)) {
                        container.scrollLeft -= currentSetWidth;
                    } else if (container.scrollLeft < currentSetWidth) {
                        container.scrollLeft += currentSetWidth;
                    }
                }
            }
            filterAnimFrameIdRef.current = requestAnimationFrame(animate);
        };

        filterAnimFrameIdRef.current = requestAnimationFrame(animate);

        return () => {
            if (filterAnimFrameIdRef.current) cancelAnimationFrame(filterAnimFrameIdRef.current);
            if (filterResumeTimeoutRef.current) clearTimeout(filterResumeTimeoutRef.current);
        };
    }, [categories, repeatedCategories]);

    const pauseFilterAutoScroll = () => {
        if (filterResumeTimeoutRef.current) clearTimeout(filterResumeTimeoutRef.current);
        isFilterPausedRef.current = true;
    };

    const resumeFilterAutoScroll = (delay = 0) => {
        if (filterResumeTimeoutRef.current) clearTimeout(filterResumeTimeoutRef.current);
        if (delay > 0) {
            filterResumeTimeoutRef.current = setTimeout(() => {
                isFilterPausedRef.current = false;
            }, delay);
        } else {
            isFilterPausedRef.current = false;
        }
    };

    // Category filter drag handlers
    const onFilterMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = filterScrollRef.current;
        if (!el) return;
        pauseFilterAutoScroll();
        isFilterDraggingRef.current = true;
        filterHasDraggedRef.current = false;
        filterDragStartXRef.current = e.pageX - el.offsetLeft;
        filterDragScrollLeftRef.current = el.scrollLeft;
        setIsFilterDragging(true);
    };

    const onFilterMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isFilterDraggingRef.current) return;
        e.preventDefault();
        const el = filterScrollRef.current;
        if (!el) return;
        const x = e.pageX - el.offsetLeft;
        const walk = (x - filterDragStartXRef.current) * 1.5;
        if (Math.abs(x - filterDragStartXRef.current) > 5) {
            filterHasDraggedRef.current = true;
        }
        el.scrollLeft = filterDragScrollLeftRef.current - walk;

        const setWidth = el.scrollWidth / repeatCount;
        if (setWidth > 0) {
            if (el.scrollLeft >= setWidth * (repeatCount - 1)) {
                el.scrollLeft -= setWidth;
                filterDragScrollLeftRef.current -= setWidth;
            } else if (el.scrollLeft < setWidth) {
                el.scrollLeft += setWidth;
                filterDragScrollLeftRef.current += setWidth;
            }
        }
    };

    const onFilterMouseUp = () => {
        isFilterDraggingRef.current = false;
        setIsFilterDragging(false);
    };

    const onFilterMouseLeave = () => {
        if (isFilterDraggingRef.current) {
            isFilterDraggingRef.current = false;
            setIsFilterDragging(false);
        }
        resumeFilterAutoScroll();
    };

    // Touch handlers for mobile
    const onFilterTouchStart = () => {
        pauseFilterAutoScroll();
    };

    const onFilterTouchMove = () => {
        pauseFilterAutoScroll();
    };

    const onFilterTouchEnd = () => {
        // Resume auto-slide after 1.5s on mobile
        resumeFilterAutoScroll(1500);
    };

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = 340;
            scrollContainerRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    const scrollFilters = (direction: 'left' | 'right') => {
        pauseFilterAutoScroll();
        if (filterScrollRef.current) {
            const scrollAmount = 240;
            filterScrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
        // Resume auto-slide 2s after manual button click
        resumeFilterAutoScroll(2000);
    };

    const handleCategoryClick = (cat: { id: number; name: string; slug?: string }) => {
        if (filterHasDraggedRef.current) return;
        router.push(`/categories/subcategories/${getCategorySlug(cat)}`);
    };

    if (!loading && products.length === 0) {
        return null;
    }

    const lifestyleImage = products[0]?.image_url || "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80";

    return (
        <section className="pt-6 pb-2 sm:pt-6 sm:pb-0 md:pt-6 md:pb-0 bg-white">
            <div className="container mx-auto px-4 md:px-8">
                {/* Header: BestSellers */}
                <div className="mb-4 sm:mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-normal text-[#0c2340] tracking-normal">
                            BestSellers
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">Trending products loved by customers</p>
                    </div>
                    {products.length > 0 && (
                        <Link
                            href="/products"
                            className="group/btn inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#007FFF] hover:text-[#0055CC] transition-colors"
                        >
                            <span>View All</span>
                            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
                        </Link>
                    )}
                </div>

                {loading ? (
                    <div className="flex gap-5 overflow-hidden py-4">
                        <div className="hidden md:block w-[240px] lg:w-[270px] h-[360px] rounded-2xl bg-gray-100 animate-pulse flex-shrink-0" />
                        {Array.from({ length: 4 }).map((_, idx) => (
                            <div key={idx} className="w-[175px] sm:w-[210px] md:w-[240px] h-[360px] rounded-2xl bg-gray-100 animate-pulse flex-shrink-0" />
                        ))}
                    </div>
                ) : (
                    <div className="flex gap-4 sm:gap-5 items-stretch relative group/slider px-1 sm:px-2">
                        {/* 1. Left-most Lifestyle Card (Static on Web View, hidden on mobile) */}
                        <div
                            onClick={() => router.push('/products')}
                            className="hidden md:block flex-shrink-0 w-[240px] lg:w-[270px] self-stretch rounded-2xl overflow-hidden relative cursor-pointer group/card shadow-sm hover:shadow-md transition-all duration-300 min-h-[350px]"
                        >
                            <img
                                src={lifestyleImage}
                                alt="BestSellers Lifestyle"
                                className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-black/25 group-hover/card:bg-black/35 transition-colors flex items-center justify-center">
                                <button className="bg-white text-gray-900 font-bold text-xs sm:text-sm px-6 py-2.5 rounded-full shadow-lg hover:bg-gray-100 transition-all transform group-hover/card:scale-105">
                                    View All
                                </button>
                            </div>
                        </div>

                        {/* 2. Scrollable Products on Right */}
                        <div className="relative flex-1 min-w-0">
                            {/* Left Scroll Button */}
                            <button
                                onClick={() => scroll('left')}
                                className="hidden md:flex absolute -left-5 lg:-left-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 lg:w-12 lg:h-12 items-center justify-center bg-white/95 hover:bg-white text-gray-800 shadow-xl rounded-full border border-gray-200 opacity-0 invisible group-hover/slider:opacity-100 group-hover/slider:visible transition-all duration-300 hover:scale-110"
                                aria-label="Scroll left"
                            >
                                <ChevronLeft className="w-6 h-6 text-gray-800" />
                            </button>

                            {/* Right Scroll Button */}
                            <button
                                onClick={() => scroll('right')}
                                className="hidden md:flex absolute -right-5 lg:-right-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 lg:w-12 lg:h-12 items-center justify-center bg-white/95 hover:bg-white text-gray-800 shadow-xl rounded-full border border-gray-200 opacity-0 invisible group-hover/slider:opacity-100 group-hover/slider:visible transition-all duration-300 hover:scale-110"
                                aria-label="Scroll right"
                            >
                                <ChevronRight className="w-6 h-6 text-gray-800" />
                            </button>

                            {/* Horizontal Scrollable Row for Bestsellers */}
                            <div
                                ref={scrollContainerRef}
                                onMouseDown={onMouseDown}
                                onMouseMove={onMouseMove}
                                onMouseUp={onMouseUp}
                                onMouseLeave={onMouseLeave}
                                className={`flex gap-3 sm:gap-4 md:gap-5 overflow-x-auto scrollbar-hide pb-2 sm:pb-4 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'
                                    }`}
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                                {products.map((product) => (
                                    <div key={product.id} className="flex-shrink-0 w-[175px] sm:w-[210px] md:w-[240px] lg:w-[260px]">
                                        <ProductCard
                                            product={product}
                                            onClick={() => {
                                                if (!hasDraggedRef.current) router.push(`/products/${getProductSlug(product)}`);
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Category Slider - Auto Loop Carousel */}
                <div
                    className="mt-5 sm:mt-8 pt-1 sm:pt-2 relative group/catfilters"
                    onMouseEnter={pauseFilterAutoScroll}
                    onMouseLeave={() => {
                        if (!isFilterDraggingRef.current) resumeFilterAutoScroll();
                    }}
                >
                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                        {/* Left Scroll Arrow */}
                        <button
                            onClick={() => scrollFilters('left')}
                            className="flex-shrink-0 w-8 h-8 rounded-full border border-gray-300 hover:border-black flex items-center justify-center text-gray-700 hover:text-black transition-colors bg-white shadow-xs hover:shadow-sm"
                            aria-label="Scroll categories left"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        {/* Category Filter Pills — Infinite Auto-sliding Loop */}
                        <div
                            ref={filterScrollRef}
                            onMouseDown={onFilterMouseDown}
                            onMouseMove={onFilterMouseMove}
                            onMouseUp={onFilterMouseUp}
                            onMouseLeave={onFilterMouseLeave}
                            onTouchStart={onFilterTouchStart}
                            onTouchMove={onFilterTouchMove}
                            onTouchEnd={onFilterTouchEnd}
                            onTouchCancel={onFilterTouchEnd}
                            className={`flex items-center gap-2.5 sm:gap-3 overflow-x-auto scrollbar-hide py-1 flex-1 select-none ${isFilterDragging ? 'cursor-grabbing' : 'cursor-grab'
                                }`}
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {repeatedCategories.map((cat, idx) => (
                                <button
                                    key={`${cat.id}-${idx}`}
                                    onClick={() => handleCategoryClick(cat)}
                                    className="flex-shrink-0 px-4 py-1.5 sm:py-2 rounded-full text-xs font-semibold border border-gray-200 bg-white text-gray-800 hover:border-[#007FFF] hover:text-[#007FFF] hover:bg-blue-50/50 shadow-xs transition-all duration-200 whitespace-nowrap capitalize cursor-pointer"
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>

                        {/* Right Scroll Arrow */}
                        <button
                            onClick={() => scrollFilters('right')}
                            className="flex-shrink-0 w-8 h-8 rounded-full border border-gray-300 hover:border-black flex items-center justify-center text-gray-700 hover:text-black transition-colors bg-white shadow-xs hover:shadow-sm"
                            aria-label="Scroll categories right"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </section>
    );
}
