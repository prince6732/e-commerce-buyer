"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronUp, X, Home} from "lucide-react";
import axios from "../../../../utils/axios";
import imgPlaceholder from "@/public/imagePlaceholder.png";
import ProductCard from "@/components/(frontend)/ProductCard";
import { useProductSync, ProductEventData } from "@/context/ProductSyncContext";

const basePath = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";

type Product = {
    id: number;
    name: string;
    description: string;
    image_url: string;
    min_price: number;
    max_price: number;
    average_rating: number;
    reviews_count: number;
    brand: { id: number; name: string } | null;
    category: { id: number; name: string } | null;
    variants: any[];
    best_variant: {
        id: number;
        sp: number;
        mrp: number | null;
        stock: number;
        image_url: string | null;
    } | null;
};

type Category = {
    id: number;
    name: string;
    parent_id: number | null;
    image?: string;
};

const ProductsPage = () => {
    const searchParams = useSearchParams();

    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [subcategories, setSubcategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter states
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
    const [selectedCategory, setSelectedCategory] = useState<number | null>(
        searchParams.get('category_id') ? parseInt(searchParams.get('category_id')!) : null
    );
    const [selectedSubcategory, setSelectedSubcategory] = useState<number | null>(
        searchParams.get('subcategory_id') ? parseInt(searchParams.get('subcategory_id')!) : null
    );

    // Modern Filter & Sort States
    const [sortBy, setSortBy] = useState<string>('newest');
    const [priceRange, setPriceRange] = useState<string>('all'); // 'all' | 'under1000' | '1000to2000' | 'above2000'

    // Category & Subcategory Slider Refs & States
    const catScrollRef = useRef<HTMLDivElement>(null);
    const isCatDraggingRef = useRef(false);
    const catDragStartXRef = useRef(0);
    const catDragScrollLeftRef = useRef(0);
    const hasCatDraggedRef = useRef(false);
    const [isCatDragging, setIsCatDragging] = useState(false);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    // Pagination & Infinite Scroll states
    const [currentPage, setCurrentPage] = useState(1);
    const [totalProducts, setTotalProducts] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const observerTargetRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 500) {
                setShowScrollTop(true);
            } else {
                setShowScrollTop(false);
            }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const { subscribeToAll } = useProductSync();

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };

    useEffect(() => {
        const unsubscribe = subscribeToAll((event: ProductEventData) => {
            const updatedProd = event.product;
            const pid = event.productId || (updatedProd?.id ? Number(updatedProd.id) : undefined);
            if (!pid) return;

            if (event.action === "deleted" || (event.action === "status_changed" && event.status === false)) {
                setProducts((prev) => prev.filter((p) => Number(p.id) !== pid));
                setTotalProducts((prev) => Math.max(0, prev - 1));
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
            } else if (event.action === "created") {
                if (currentPage === 1) {
                    fetchProducts(1, false);
                }
            }
        });

        return () => {
            unsubscribe();
        };
    }, [subscribeToAll, currentPage]);

    useEffect(() => {
        loadCategories();
    }, []);

    useEffect(() => {
        fetchProducts(1, false);
    }, [selectedCategory, selectedSubcategory, priceRange, sortBy]);

    const loadCategories = async () => {
        try {
            const response = await axios.get('/api/categories-with-products');
            let data: any[] = [];
            if (Array.isArray(response.data)) {
                data = response.data;
            } else if (response.data?.success && Array.isArray(response.data?.data)) {
                data = response.data.data;
            }
            setCategories(data);

            const allSubs: Category[] = [];
            data.forEach((cat) => {
                if (Array.isArray(cat.children)) {
                    cat.children.forEach((sub: any) => {
                        allSubs.push({
                            id: sub.id,
                            name: sub.name,
                            parent_id: cat.id,
                            image: sub.image,
                        });
                    });
                }
            });
            setSubcategories(allSubs);
        } catch (error) {
            console.error("Failed to fetch categories:", error);
        }
    };

    const fetchProducts = async (pageToFetch = 1, isAppend = false) => {
        if (isAppend) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }

        try {
            const params: any = {
                page: pageToFetch,
                per_page: 20,
            };

            if (searchQuery) params.search = searchQuery;

            if (selectedSubcategory) {
                params.category_id = selectedSubcategory;
            } else if (selectedCategory) {
                params.category_id = selectedCategory;
            }

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
                setTotalProducts(pagination?.total ?? productList.length);
                setHasMore(pageToFetch < totalPagesCount && productList.length > 0);

                if (isAppend) {
                    setProducts((prev) => [...prev, ...productList]);
                } else {
                    setProducts(productList);
                }
                setCurrentPage(pageToFetch);
            } else {
                if (!isAppend) setProducts([]);
                setHasMore(false);
            }
        } catch (error) {
            console.error("Failed to fetch products:", error);
            if (!isAppend) setProducts([]);
            setHasMore(false);
        } finally {
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
    }, [hasMore, loading, loadingMore, currentPage, selectedCategory, selectedSubcategory, priceRange, sortBy, searchQuery]);

    const clearFilters = () => {
        setSearchQuery('');
        setSelectedCategory(null);
        setSelectedSubcategory(null);
        setPriceRange('all');
        setSortBy('newest');
        setCurrentPage(1);
        fetchProducts(1, false);
    };

    const updateCatScrollButtons = () => {
        const el = catScrollRef.current;
        if (!el) return;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        setCanScrollLeft(scrollLeft > 4);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            updateCatScrollButtons();
        }, 150);
        window.addEventListener('resize', updateCatScrollButtons);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updateCatScrollButtons);
        };
    }, [categories]);

    // Global mouse listeners for fluid drag-to-scroll across the whole window
    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (!isCatDraggingRef.current || !catScrollRef.current) return;
            e.preventDefault();
            const el = catScrollRef.current;
            const x = e.pageX - el.offsetLeft;
            const walk = (x - catDragStartXRef.current) * 1.5;
            if (Math.abs(walk) > 4) {
                hasCatDraggedRef.current = true;
            }
            el.scrollLeft = catDragScrollLeftRef.current - walk;
            updateCatScrollButtons();
        };

        const handleGlobalMouseUp = () => {
            if (isCatDraggingRef.current) {
                isCatDraggingRef.current = false;
                setIsCatDragging(false);
                setTimeout(() => {
                    hasCatDraggedRef.current = false;
                }, 60);
            }
        };

        if (isCatDragging) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [isCatDragging]);

    const scrollCategories = (direction: 'left' | 'right') => {
        if (catScrollRef.current) {
            const scrollAmount = Math.max(300, Math.floor(catScrollRef.current.clientWidth * 0.7));
            catScrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
            setTimeout(updateCatScrollButtons, 350);
        }
    };

    const onCatWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        if (!catScrollRef.current) return;
        if (e.deltaY !== 0) {
            catScrollRef.current.scrollLeft += e.deltaY;
            updateCatScrollButtons();
        } else if (e.deltaX !== 0) {
            catScrollRef.current.scrollLeft += e.deltaX;
            updateCatScrollButtons();
        }
    };

    const onCatMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = catScrollRef.current;
        if (!el) return;
        isCatDraggingRef.current = true;
        hasCatDraggedRef.current = false;
        catDragStartXRef.current = e.pageX - el.offsetLeft;
        catDragScrollLeftRef.current = el.scrollLeft;
        setIsCatDragging(true);
    };

    const getFilteredSubcategories = () => {
        if (!selectedCategory) return [];
        return subcategories.filter(sub => sub.parent_id === selectedCategory);
    };

    const getSelectedCategoryName = () => {
        if (!selectedCategory) return null;
        return categories.find(cat => cat.id === selectedCategory)?.name;
    };

    const getSelectedSubcategoryName = () => {
        if (!selectedSubcategory) return null;
        return subcategories.find(sub => sub.id === selectedSubcategory)?.name;
    };

    const processedProducts = Array.isArray(products) ? products : [];

    if (loading && products.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
                <div className="container mx-auto px-4 py-16">
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="w-12 h-12 border-4 border-blue-200 border-t-[#007FFF] rounded-full animate-spin" />
                        <p className="text-gray-600 font-medium">Loading products...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Breadcrumb Navigation */}
            <div className="bg-gray-50/70 border-b border-gray-100 py-2.5">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-2 text-xs sm:text-sm text-gray-500">
                    <Link href="/" className="hover:text-[#007FFF] transition-colors flex items-center gap-1">
                        <Home className="w-3.5 h-3.5" />
                        <span>Home</span>
                    </Link>
                    <span className="text-gray-400">/</span>
                    <Link href="/products" className="text-gray-500 hover:text-[#007FFF] transition-colors font-medium">
                        Products
                    </Link>
                    {selectedCategory && (
                        <>
                            <span className="text-gray-400">/</span>
                            <span className="text-[#007FFF] font-medium">{getSelectedCategoryName()}</span>
                        </>
                    )}
                    {selectedSubcategory && (
                        <>
                            <span className="text-gray-400">/</span>
                            <span className="text-[#007FFF] font-medium">{getSelectedSubcategoryName()}</span>
                        </>
                    )}
                </div>
            </div>

            {/* ── 1. Circular Categories Carousel (Scrolls with page) ── */}
            <div className="relative bg-white border-b border-gray-200/80 py-2 sm:py-2.5">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="relative group/prodcats flex items-center">
                        {/* Left Scroll Arrow */}
                        {canScrollLeft && (
                            <button
                                type="button"
                                onClick={() => scrollCategories('left')}
                                className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 flex items-center justify-center bg-white hover:bg-gray-100 active:scale-95 shadow-md rounded-full transition-all duration-200 border border-gray-200 text-gray-800 mr-1 sm:mr-2 z-20 cursor-pointer"
                                aria-label="Scroll categories left"
                            >
                                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-800" />
                            </button>
                        )}

                        {/* Scrollable Container with Category Circles */}
                        <div
                            ref={catScrollRef}
                            onMouseDown={onCatMouseDown}
                            onWheel={onCatWheel}
                            onScroll={updateCatScrollButtons}
                            className={`flex gap-3.5 sm:gap-6 md:gap-8 lg:gap-10 overflow-x-auto [&::-webkit-scrollbar]:hidden py-1.5 items-start flex-1 select-none scroll-smooth ${isCatDragging ? 'cursor-grabbing' : 'cursor-grab'
                                }`}
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitOverflowScrolling: 'touch' }}
                        >
                            {categories.map((cat) => {
                                const isSelected = selectedCategory === cat.id && !selectedSubcategory;
                                const catImg = cat.image
                                    ? (cat.image.startsWith('http') ? cat.image : `${basePath}${cat.image.startsWith('/') ? '' : '/'}${cat.image}`)
                                    : imgPlaceholder.src;

                                return (
                                    <div
                                        key={cat.id}
                                        onClick={() => {
                                            if (!hasCatDraggedRef.current) {
                                                if (selectedCategory === cat.id) {
                                                    setSelectedCategory(null);
                                                    setSelectedSubcategory(null);
                                                } else {
                                                    setSelectedCategory(cat.id);
                                                    setSelectedSubcategory(null);
                                                }
                                                setCurrentPage(1);
                                            }
                                        }}
                                        className="flex-shrink-0 group cursor-pointer transition-all duration-300 flex flex-col items-center w-[68px] sm:w-[82px] md:w-[95px]"
                                    >
                                        <div className={`p-0.5 rounded-full border-2 transition-all duration-300 group-hover:scale-105 bg-white ${isSelected
                                                ? 'border-[#007FFF] ring-2 ring-[#007FFF]/20 shadow-md scale-105'
                                                : 'border-gray-300 group-hover:border-[#007FFF]'
                                            }`}>
                                            <div className="w-13 h-13 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-full overflow-hidden bg-white flex items-center justify-center p-1.5 pointer-events-none">
                                                <img
                                                    src={catImg}
                                                    alt={cat.name}
                                                    draggable={false}
                                                    className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110 pointer-events-none select-none"
                                                    onError={(e: any) => { e.target.src = imgPlaceholder.src; }}
                                                />
                                            </div>
                                        </div>
                                        <span className={`mt-1.5 text-[10px] sm:text-xs font-semibold text-center leading-tight line-clamp-2 capitalize px-0.5 select-none ${isSelected ? 'text-[#007FFF] font-bold' : 'text-[#0A0908] group-hover:text-[#007FFF]'
                                            }`}>
                                            {cat.name}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Right Scroll Arrow */}
                        {canScrollRight && (
                            <button
                                type="button"
                                onClick={() => scrollCategories('right')}
                                className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 flex items-center justify-center bg-white hover:bg-gray-100 active:scale-95 shadow-md rounded-full transition-all duration-200 border border-gray-200 text-gray-800 ml-1 sm:ml-2 z-20 cursor-pointer"
                                aria-label="Scroll categories right"
                            >
                                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-800" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Products Listing Section */}
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {/* ── 2. All Products Header + Filter Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex-shrink-0">
                        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#0c2340]">
                            {selectedSubcategory ? getSelectedSubcategoryName() : selectedCategory ? getSelectedCategoryName() : 'All Products'}
                        </h1>
                        <p className="text-xs sm:text-sm text-gray-500 font-medium">{totalProducts} products available</p>
                    </div>

                    {/* Right: Inline Price Dropdown & Sort Dropdown */}
                    <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap justify-start sm:justify-end">
                        {/* PRICE Dropdown (Left side of Sort) */}
                        <div className="flex items-center gap-1.5">
                            {/* <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">PRICE:</span> */}
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

                        {/* SORT Dropdown (Right side of Price) */}
                        <div className="flex items-center gap-1.5">
                            {/* <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">SORT:</span> */}
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
                        {(selectedCategory || selectedSubcategory || priceRange !== 'all' || sortBy !== 'newest') && (
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

                {/* ── 4. Products Grid (Slightly Smaller Cards: 5 Columns) ── */}
                <div>
                    {loading ? (
                        <div className="text-center py-20">
                            <div className="w-14 h-14 border-4 border-blue-200 border-t-[#007FFF] rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-gray-600 font-medium text-sm">Loading products...</p>
                        </div>
                    ) : processedProducts.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-3xl border border-gray-200/80 shadow-xs">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ChevronRight className="w-10 h-10 text-gray-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Products Match Filters</h3>
                            <p className="text-gray-500 mb-6 text-sm">Try selecting a different price range or clearing active category filters.</p>
                            <button
                                onClick={clearFilters}
                                style={{ backgroundColor: 'var(--theme-blue)', color: '#FFFAFB' }}
                                className="px-6 py-3 rounded-xl font-semibold hover:bg-[#0066CC] hover:shadow-lg transition-all text-sm"
                            >
                                Reset All Filters
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Products Grid - Compact 5 Columns Layout */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-3.5 sm:gap-4.5 mb-12">
                                {processedProducts.map((product) => {
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
                            <div ref={observerTargetRef} className="w-full py-8 flex flex-col items-center justify-center col-span-full">
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
            </div>

            {/* ── Centered Scroll To Top Button ── */}
            <button
                type="button"
                onClick={scrollToTop}
                aria-label="Scroll to top"
                className={`fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-40 p-3 sm:p-3.5 rounded-full bg-gray-800/90 hover:bg-gray-900 text-white shadow-lg hover:shadow-2xl backdrop-blur-md border border-gray-700/50 transition-all duration-300 transform active:scale-90 flex items-center justify-center group select-none cursor-pointer ${showScrollTop ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-8 pointer-events-none'
                    }`}
                title="Back to Top"
            >
                <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-200 group-hover:-translate-y-1" />
            </button>
        </div>
    );
};

export default ProductsPage;
