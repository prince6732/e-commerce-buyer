"use client";

import Modal from "@/components/(sheared)/Modal";
import { useLoader } from "@/context/LoaderContext";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { getAdminProducts, deleteProduct, toggleProductStatus, setEditProductId } from "../../../../../utils/product";
import { Pencil, Trash2, Eye, Sparkles, Search, Loader2, Filter, Plus, Check, AlertTriangle, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Package, ShieldAlert, Layers } from "lucide-react";
import { toggleProductNewArrival } from "../../../../../utils/newArrivalApi";
import { getErrorMessage } from "../../../../../utils/errorUtils";
import { useAddProductModal } from "@/context/AddProductModalContext";
import { useProductSync, ProductEventData } from "@/context/ProductSyncContext";
import { getProductSlug, getCategorySlug } from "../../../../../utils/slugUtils";

const basePath: string =
    `${process.env.NEXT_PUBLIC_UPLOAD_BASE}` || "https://api.zelton.co.in";

const PAGE_SIZE = 10;

function ProductsContent() {
    const { openAddProductModal } = useAddProductModal();
    const searchParams = useSearchParams();

    // Helper to determine initial tab from searchParams (supports ?tab=low-stock, ?tab=out-of-stock, or ?stockStatus=...)
    const getInitialTab = () => {
        const paramTab = searchParams?.get("tab");
        const paramStock = searchParams?.get("stockStatus");
        if (paramTab === "low-stock" || paramTab === "low_stock" || paramStock === "low_stock") return "low_stock";
        if (paramTab === "out-of-stock" || paramTab === "out_of_stock" || paramStock === "out_of_stock") return "out_of_stock";
        return "all";
    };

    // Products & Pagination State
    const [products, setProducts] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(true);
    const [totalProducts, setTotalProducts] = useState(0);
    const [pagination, setPagination] = useState<any>(null);
    const [stockCounts, setStockCounts] = useState<{ all: number; low_stock: number; out_of_stock: number }>({
        all: 0,
        low_stock: 0,
        out_of_stock: 0,
    });

    // Loading & Request Flags
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const isFetchingRef = useRef(false);
    const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

    // Notification State
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Modals State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [isNewArrivalModalOpen, setIsNewArrivalModalOpen] = useState(false);
    const [selectedProductForNewArrival, setSelectedProductForNewArrival] = useState<any | null>(null);

    // Filter & Search & Tabs State
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [newArrivalFilter, setNewArrivalFilter] = useState<string>("all");
    const [stockStatusFilter, setStockStatusFilter] = useState<string>(getInitialTab());
    const [isSearching, setIsSearching] = useState(false);

    // Expandable Variant Rows State
    const [expandedProductIds, setExpandedProductIds] = useState<Set<number>>(new Set());

    const { showLoader, hideLoader } = useLoader();
    const router = useRouter();
    const { subscribeToAll } = useProductSync();

    // Listen to URL searchParams change to switch tabs (e.g. when navigated from dashboard)
    useEffect(() => {
        const paramTab = searchParams?.get("tab");
        const paramStock = searchParams?.get("stockStatus");
        let target = "all";
        if (paramTab === "low-stock" || paramTab === "low_stock" || paramStock === "low_stock") target = "low_stock";
        else if (paramTab === "out-of-stock" || paramTab === "out_of_stock" || paramStock === "out_of_stock") target = "out_of_stock";

        if (target !== stockStatusFilter) {
            setStockStatusFilter(target);
        }
    }, [searchParams]);

    // Tab switcher with URL query parameter sync
    const handleTabChange = (newTab: "all" | "low_stock" | "out_of_stock") => {
        setStockStatusFilter(newTab);
        setPage(1);
        const url = new URL(window.location.href);
        if (newTab === "low_stock") {
            url.searchParams.set("tab", "low-stock");
            url.searchParams.delete("stockStatus");
        } else if (newTab === "out_of_stock") {
            url.searchParams.set("tab", "out-of-stock");
            url.searchParams.delete("stockStatus");
        } else {
            url.searchParams.delete("tab");
            url.searchParams.delete("stockStatus");
        }
        window.history.replaceState({}, "", url.toString());
    };

    // Toggle variant accordion row expansion
    const toggleExpand = (productId: number) => {
        setExpandedProductIds((prev) => {
            const next = new Set(prev);
            if (next.has(productId)) {
                next.delete(productId);
            } else {
                next.add(productId);
            }
            return next;
        });
    };

    // Real-time synchronization for Dashboard products table
    useEffect(() => {
        const unsubscribe = subscribeToAll((event: ProductEventData) => {
            const updatedProd = event.product;
            const pid = event.productId || (updatedProd?.id ? Number(updatedProd.id) : undefined);
            if (!pid) return;

            if (event.action === "deleted") {
                setProducts((prev) => prev.filter((p) => Number(p.id) !== pid));
                setTotalProducts((prev) => Math.max(0, prev - 1));
            } else if (event.action === "status_changed") {
                setProducts((prev) =>
                    prev.map((p) => {
                        if (Number(p.id) !== pid) return p;
                        return {
                            ...p,
                            status: event.status !== undefined ? event.status : p.status,
                            ...(updatedProd ? updatedProd : {}),
                        };
                    })
                );
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
            } else if (event.action === "created" && updatedProd) {
                setProducts((prev) => {
                    const exists = prev.some((p) => Number(p.id) === Number(updatedProd.id));
                    if (exists) return prev;
                    return [updatedProd, ...prev];
                });
                setTotalProducts((prev) => prev + 1);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [subscribeToAll]);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Auto-clear success and error messages
    useEffect(() => {
        if (successMessage || errorMessage) {
            const timer = setTimeout(() => {
                setSuccessMessage(null);
                setErrorMessage(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, errorMessage]);

    // Fetch Products (Initial / Reset / Next Page)
    const fetchProducts = async (
        pageNum: number,
        search: string = "",
        newArrival: string = "all",
        stockStatus: string = "all",
        isAppend: boolean = false
    ) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        if (isAppend) {
            setIsLoadingMore(true);
        } else {
            setIsLoadingInitial(true);
            if (search) {
                setIsSearching(true);
            }
        }

        try {
            const filters: any = {};
            if (search) filters.search = search;
            if (newArrival && newArrival !== "all") filters.is_new_arrival = newArrival;
            if (stockStatus && stockStatus !== "all") filters.stock_status = stockStatus;

            const response = await getAdminProducts(pageNum, PAGE_SIZE, filters);

            if (response.success && response.result) {
                const list = response.result.products || [];
                const paginationData = response.result.pagination;
                const countsData = response.result.counts;

                if (countsData) {
                    setStockCounts(countsData);
                }

                const hasNext = Boolean(
                    paginationData?.has_next_page ??
                    paginationData?.hasNextPage ??
                    paginationData?.has_more ??
                    (pageNum < (paginationData?.last_page || 1))
                );

                setPagination(paginationData);
                setTotalProducts(paginationData?.total ?? 0);
                setHasNextPage(hasNext);
                setPage(pageNum);

                if (isAppend) {
                    setProducts((prev) => {
                        const existingIds = new Set(prev.map((p) => p.id));
                        const newUnique = list.filter((p: any) => !existingIds.has(p.id));
                        return [...prev, ...newUnique];
                    });
                } else {
                    setProducts(list);
                }
            } else {
                if (!isAppend) setProducts([]);
                setHasNextPage(false);
            }
        } catch (err) {
            console.error("Error fetching products:", err);
            setErrorMessage("Failed to load products");
        } finally {
            isFetchingRef.current = false;
            setIsLoadingInitial(false);
            setIsLoadingMore(false);
            setIsSearching(false);
        }
    };

    // Trigger initial fetch or reset when filters/search/tabs change
    useEffect(() => {
        setPage(1);
        setHasNextPage(true);
        fetchProducts(1, debouncedSearchQuery, newArrivalFilter, stockStatusFilter, false);
    }, [debouncedSearchQuery, newArrivalFilter, stockStatusFilter]);

    // Load next page on scroll
    const loadNextPage = useCallback(() => {
        if (!hasNextPage || isLoadingMore || isLoadingInitial || isFetchingRef.current) return;
        fetchProducts(page + 1, debouncedSearchQuery, newArrivalFilter, stockStatusFilter, true);
    }, [hasNextPage, isLoadingMore, isLoadingInitial, page, debouncedSearchQuery, newArrivalFilter, stockStatusFilter]);

    // IntersectionObserver attached to bottom sentinel
    useEffect(() => {
        const sentinel = bottomSentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const target = entries[0];
                if (target.isIntersecting) {
                    loadNextPage();
                }
            },
            {
                root: null,
                rootMargin: "300px",
                threshold: 0.1,
            }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [loadNextPage]);

    // Delete Product
    const handleDeleteProduct = async () => {
        if (!selectedProduct) return;
        showLoader();
        try {
            await deleteProduct(selectedProduct.id);
            setProducts((prev) => prev.filter((p) => p.id !== selectedProduct.id));
            setTotalProducts((prev) => Math.max(0, prev - 1));
            setSuccessMessage("Product deleted successfully");
            setIsDeleteModalOpen(false);
            setSelectedProduct(null);
        } catch (err: any) {
            console.error(err);
            setErrorMessage(getErrorMessage(err, "Failed to delete product"));
        } finally {
            hideLoader();
        }
    };

    const openDeleteModal = (product: any) => {
        setSelectedProduct(product);
        setIsDeleteModalOpen(true);
    };

    // Toggle New Arrival Status
    const handleToggleNewArrival = (product: any) => {
        setSelectedProductForNewArrival(product);
        setIsNewArrivalModalOpen(true);
    };

    const confirmToggleNewArrival = async () => {
        if (!selectedProductForNewArrival) return;
        setIsNewArrivalModalOpen(false);
        showLoader();
        try {
            await toggleProductNewArrival(selectedProductForNewArrival.id);
            setProducts((prev) =>
                prev.map((p) =>
                    p.id === selectedProductForNewArrival.id ? { ...p, is_new_arrival: !p.is_new_arrival } : p
                )
            );
            setSuccessMessage(
                selectedProductForNewArrival.is_new_arrival
                    ? "Product removed from New Arrivals"
                    : "Product added to New Arrivals"
            );
        } catch (err: any) {
            setErrorMessage(getErrorMessage(err, "Failed to toggle New Arrival status."));
        } finally {
            hideLoader();
            setSelectedProductForNewArrival(null);
        }
    };

    // Toggle Active/Inactive Status
    const handleStatusToggle = async (product: any) => {
        try {
            await toggleProductStatus(product.id);
            setProducts((prev) =>
                prev.map((p) => (p.id === product.id ? { ...p, status: !p.status } : p))
            );
            setSuccessMessage("Product status updated successfully.");
        } catch (err: any) {
            setErrorMessage(getErrorMessage(err, "Failed to toggle product status."));
        }
    };

    const goToProductDetail = (product: any) => {
        const slug = getProductSlug(product);
        window.open(`/dashboard/products/${slug}`, '_blank', 'noopener,noreferrer');
    };

    const editProduct = (product: any) => {
        setEditProductId(product.id);
        const catId = product.category_id ?? product.categoryId ?? getCategorySlug({ id: product.category_id, name: product.category?.name, slug: product.category?.slug });
        const attrCount = product.item_attributes?.length ?? product.itemAttributes?.length ?? 0;
        if (attrCount === 1) {
            router.push(`/dashboard/categories/${catId}/products/add-single-attribute-product`);
        } else if (attrCount === 0 && (!product.variants || product.variants.length <= 1)) {
            router.push(`/dashboard/categories/${catId}/products/add-single-variant`);
        } else {
            router.push(`/dashboard/categories/${catId}/products/add-multi-variant`);
        }
    };

    return (
        <div className="p-3 md:p-6">
            {/* Header with Title and Search/Actions */}
            <div className="mb-4 md:mb-6 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-xl shadow-md">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 md:px-6 py-3.5 md:py-4">

                    {/* Heading */}
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg md:text-xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">
                            {stockStatusFilter === "low_stock" ? "Low Stock Products" : stockStatusFilter === "out_of_stock" ? "Out of Stock Products" : "All Products"}
                        </h2>
                        {totalProducts > 0 && (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${stockStatusFilter === "out_of_stock"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : stockStatusFilter === "low_stock"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                }`}>
                                {products.length} of {totalProducts}
                            </span>
                        )}
                    </div>

                    {/* Filter & Search Container */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">

                        {/* New Arrivals Filter Dropdown */}
                        <div className="relative min-w-[175px]">
                            <select
                                value={newArrivalFilter}
                                onChange={(e) => {
                                    setNewArrivalFilter(e.target.value);
                                }}
                                className="
                                    w-full
                                    appearance-none
                                    rounded-xl
                                    border border-gray-300
                                    bg-white
                                    pl-3.5 pr-8 py-2 md:py-2.5
                                    text-xs md:text-sm font-semibold
                                    text-gray-700
                                    shadow-sm
                                    focus:border-blue-400
                                    focus:ring-2
                                    focus:ring-blue-200
                                    cursor-pointer
                                    transition-all
                                "
                            >
                                <option value="all">All Types</option>
                                <option value="true">✨ New Arrivals</option>
                                <option value="false">Standard Products</option>
                            </select>
                            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        </div>

                        {/* Search Input */}
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                }}
                                placeholder="Search by name, SKU, item code..."
                                className="
                                    w-full
                                    rounded-xl
                                    border border-gray-300
                                    bg-white
                                    pl-10 pr-10 py-2 md:py-2.5
                                    text-sm md:text-base
                                    text-gray-900
                                    placeholder-gray-400
                                    shadow-sm
                                    focus:border-blue-400
                                    focus:ring-2
                                    focus:ring-blue-200
                                    transition-all
                                "
                            />
                            {isSearching ? (
                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                </div>
                            ) : searchQuery ? (
                                <button
                                    onClick={() => {
                                        setSearchQuery("");
                                    }}
                                    className="
                                        absolute right-3 top-1/2 -translate-y-1/2
                                        rounded-lg bg-gray-100 px-2 py-0.5
                                        text-xs font-semibold text-gray-600
                                        hover:bg-gray-200 transition-all cursor-pointer
                                    "
                                >
                                    Clear
                                </button>
                            ) : null}
                        </div>

                        {/* Add Product Button */}
                        <button
                            type="button"
                            onClick={openAddProductModal}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 md:py-2.5 rounded-xl bg-gradient-to-r from-[#007FFF] to-[#0055CC] text-white text-xs md:text-sm font-semibold shadow-xs hover:shadow-md hover:from-[#0066CC] hover:to-[#0044BB] transition-all whitespace-nowrap cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Product</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Stock Tabs Navigation Bar */}
            <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                    type="button"
                    onClick={() => handleTabChange("all")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all cursor-pointer whitespace-nowrap ${stockStatusFilter === "all"
                        ? "bg-[#007FFF] text-white shadow-md shadow-blue-500/20"
                        : "bg-white text-gray-700 hover:bg-gray-100/80 border border-gray-200"
                        }`}
                >
                    <Package className="w-4 h-4" />
                    <span>All Products</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${stockStatusFilter === "all" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"
                        }`}>
                        {stockCounts.all || (stockStatusFilter === "all" ? totalProducts : 0)}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => handleTabChange("low_stock")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all cursor-pointer whitespace-nowrap ${stockStatusFilter === "low_stock"
                        ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                        : "bg-white text-gray-700 hover:bg-gray-100/80 border border-gray-200"
                        }`}
                >
                    <AlertTriangle className="w-4 h-4 text-amber-300" />
                    <span>Low Stock</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${stockStatusFilter === "low_stock" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
                        }`}>
                        {stockCounts.low_stock}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => handleTabChange("out_of_stock")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all cursor-pointer whitespace-nowrap ${stockStatusFilter === "out_of_stock"
                        ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                        : "bg-white text-gray-700 hover:bg-gray-100/80 border border-gray-200"
                        }`}
                >
                    <AlertCircle className="w-4 h-4 text-rose-300" />
                    <span>Out of Stock</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${stockStatusFilter === "out_of_stock" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-800"
                        }`}>
                        {stockCounts.out_of_stock}
                    </span>
                </button>
            </div>

            {/* Floating Alert Notification */}
            {(successMessage || errorMessage) && (
                <div className={`fixed top-6 right-6 z-[99999] px-6 py-4 rounded-lg shadow-lg font-semibold animate-in fade-in slide-in-from-top-2 duration-200 ${successMessage ? "bg-green-100 text-green-800 border border-green-200" : "bg-red-100 text-red-800 border border-red-200"
                    }`}>
                    {successMessage || errorMessage}
                </div>
            )}

            {/* Products Table - Desktop */}
            <div className="hidden md:block">
                <div className="overflow-x-auto scrollbar rounded-2xl shadow-lg border border-gray-200 bg-white">
                    <table className="w-full min-w-[900px] text-sm text-left">
                        <thead className="uppercase text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4">S.No.</th>
                                <th className="px-6 py-4">Image</th>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4">Brand</th>
                                <th className="px-6 py-4">Stock</th>
                                <th className="px-6 py-4">Price Range</th>
                                <th className="px-6 py-4">New Arrival</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-end">Actions</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-200 text-gray-700">
                            {isLoadingInitial && products.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-16">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                            <span className="text-sm font-medium text-gray-500">Loading products...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : products.length > 0 ? (
                                products.map((product, index) => {
                                    const isMatchingSearchVariant = Boolean(
                                        debouncedSearchQuery &&
                                        product.variants?.some((v: any) =>
                                            v.sku?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
                                            v.title?.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
                                        )
                                    );
                                    const isExpanded = expandedProductIds.has(product.id) || stockStatusFilter !== "all" || isMatchingSearchVariant;
                                    const hasVariants = product.variants && product.variants.length > 0;
                                    const outCount = product.out_of_stock_variants_count ?? (product.variants?.filter((v: any) => v.stock === 0).length || 0);
                                    const lowCount = product.low_stock_variants_count ?? (product.variants?.filter((v: any) => v.stock > 0 && v.stock <= 5).length || 0);

                                    return (
                                        <React.Fragment key={product.id}>
                                            <tr className="hover:bg-blue-50/30 transition-colors">
                                                <td className="px-6 py-4 font-semibold text-gray-500">{index + 1}</td>

                                                <td className="px-6 py-4">
                                                    {product.image_url ? (
                                                        <img
                                                            src={`${basePath}${product.image_url}`}
                                                            alt={product.name}
                                                            className="w-16 h-16 object-cover rounded-xl border border-gray-200 shadow-sm"
                                                        />
                                                    ) : (
                                                        <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center">
                                                            <span className="text-xs text-gray-400">No Image</span>
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="px-6 py-4 font-medium max-w-[240px] break-all whitespace-normal">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-bold text-gray-900 leading-tight">{product.name}</span>
                                                        {hasVariants && product.variants.length === 1 && product.variants[0]?.sku && (
                                                            <span className="text-[11px] font-mono text-gray-500">
                                                                SKU: <strong className="text-gray-800">{product.variants[0].sku}</strong>
                                                            </span>
                                                        )}
                                                        {product.item_code && (
                                                            <span className="text-[10px] font-mono text-gray-400">
                                                                Item Code: {product.item_code}
                                                            </span>
                                                        )}
                                                        {hasVariants && (
                                                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleExpand(product.id)}
                                                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                                                                >
                                                                    <Layers className="w-3 h-3" />
                                                                    <span>{product.variants.length} Variant{product.variants.length > 1 ? "s" : ""}</span>
                                                                    {isExpanded ? (
                                                                        <ChevronUp className="w-3 h-3" />
                                                                    ) : (
                                                                        <ChevronDown className="w-3 h-3" />
                                                                    )}
                                                                </button>
                                                                {outCount > 0 && (
                                                                    <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 rounded text-[10px] font-bold">
                                                                        {outCount} Out
                                                                    </span>
                                                                )}
                                                                {lowCount > 0 && (
                                                                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded text-[10px] font-bold">
                                                                        {lowCount} Low
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 max-w-[150px] break-all whitespace-normal">
                                                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs block text-center">
                                                        {product.category?.name || '-'}
                                                    </span>
                                                </td>

                                                <td className="px-6 py-4 max-w-[150px] break-all whitespace-normal">
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs block text-center">
                                                        {product.brand?.name || '-'}
                                                    </span>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${product.total_stock === 0
                                                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                                                            : product.total_stock <= 5
                                                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                                                : "bg-green-100 text-green-700 border border-green-200"
                                                            }`}>
                                                            {product.total_stock === 0 ? "0 (Out of Stock)" : product.total_stock <= 5 ? `${product.total_stock} (Low Stock)` : product.total_stock}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm font-medium">
                                                        {product.min_price === product.max_price
                                                            ? `₹${product.min_price}`
                                                            : `₹${product.min_price} - ₹${product.max_price}`
                                                        }
                                                    </span>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <button
                                                        title={product.is_new_arrival ? "Remove from New Arrivals" : "Mark as New Arrival"}
                                                        onClick={() => handleToggleNewArrival(product)}
                                                        className={`p-1.5 rounded-full transition-colors cursor-pointer ${product.is_new_arrival
                                                            ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
                                                            : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                                                            }`}
                                                    >
                                                        <Sparkles className="w-4 h-4" />
                                                    </button>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => handleStatusToggle(product)}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors cursor-pointer ${product.status ? "bg-green-500" : "bg-red-500"
                                                            }`}
                                                        title="Toggle Status"
                                                    >
                                                        <span
                                                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${product.status ? "translate-x-5" : "translate-x-0"
                                                                }`}
                                                        />
                                                    </button>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <div className="flex gap-2 justify-end">
                                                        <button
                                                            title="View Details"
                                                            onClick={() => goToProductDetail(product)}
                                                            className="size-10 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full flex items-center justify-center transition cursor-pointer"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            title="Edit Product"
                                                            onClick={() => editProduct(product)}
                                                            className="size-10 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full flex items-center justify-center transition cursor-pointer"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            title="Delete Product"
                                                            onClick={() => openDeleteModal(product)}
                                                            className="size-10 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center transition cursor-pointer"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expandable Variant Details Breakdown Row */}
                                            {isExpanded && hasVariants && (
                                                <tr className="bg-slate-50/80 border-b border-gray-200">
                                                    <td colSpan={10} className="px-8 py-4">
                                                        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                                            <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <Layers className="w-4 h-4 text-[#007FFF]" />
                                                                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                                                                        Variant Inventory Breakdown ({product.variants.length})
                                                                    </h4>
                                                                </div>
                                                                <span className="text-xs text-gray-500 font-medium">
                                                                    Product SKU: <strong className="text-gray-900">{product.item_code || "N/A"}</strong>
                                                                </span>
                                                            </div>

                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-xs text-left">
                                                                    <thead>
                                                                        <tr className="text-gray-500 uppercase border-b border-gray-100 bg-gray-50/50">
                                                                            <th className="py-2 px-3">Variant Option</th>
                                                                            <th className="py-2 px-3">SKU</th>
                                                                            <th className="py-2 px-3">Price</th>
                                                                            <th className="py-2 px-3">Current Stock</th>
                                                                            <th className="py-2 px-3">Stock Health</th>
                                                                            <th className="py-2 px-3">Status</th>
                                                                            <th className="py-2 px-3 text-end">Action</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-100">
                                                                        {product.variants.map((v: any) => {
                                                                            const vStock = Number(v.stock ?? 0);
                                                                            const isOut = vStock === 0;
                                                                            const isLow = vStock > 0 && vStock <= 5;

                                                                            return (
                                                                                <tr
                                                                                    key={v.id}
                                                                                    className={`hover:bg-gray-50/80 transition-colors ${isOut ? "bg-rose-50/30" : isLow ? "bg-amber-50/30" : ""
                                                                                        }`}
                                                                                >
                                                                                    <td className="py-2.5 px-3 font-semibold text-gray-900 flex items-center gap-2">
                                                                                        {v.image_url ? (
                                                                                            <img
                                                                                                src={`${basePath}${v.image_url}`}
                                                                                                alt={v.title || "Variant"}
                                                                                                className="w-8 h-8 rounded-lg object-cover border border-gray-200"
                                                                                            />
                                                                                        ) : (
                                                                                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] text-gray-400">
                                                                                                -
                                                                                            </div>
                                                                                        )}
                                                                                        <span>{v.title || "Standard Variant"}</span>
                                                                                    </td>
                                                                                    <td className="py-2.5 px-3 font-mono text-gray-600">
                                                                                        {v.sku || "-"}
                                                                                    </td>
                                                                                    <td className="py-2.5 px-3 font-semibold text-gray-900">
                                                                                        ₹{v.sp || v.mrp || 0}
                                                                                    </td>
                                                                                    <td className="py-2.5 px-3">
                                                                                        <span className="font-extrabold text-sm text-gray-900">
                                                                                            {vStock}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="py-2.5 px-3">
                                                                                        {isOut ? (
                                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                                                                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                                                                                Out of Stock
                                                                                            </span>
                                                                                        ) : isLow ? (
                                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                                                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                                                                                Low Stock ({vStock} left)
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                                                                In Stock
                                                                                            </span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="py-2.5 px-3">
                                                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${v.status ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                                                                                            }`}>
                                                                                            {v.status ? "Active" : "Inactive"}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="py-2.5 px-3 text-end">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => editProduct(product)}
                                                                                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition cursor-pointer"
                                                                                        >
                                                                                            Edit / Restock
                                                                                        </button>
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={10} className="text-center text-gray-400 py-12 italic">
                                        {stockStatusFilter === "low_stock"
                                            ? "No Low Stock Products Found"
                                            : stockStatusFilter === "out_of_stock"
                                                ? "No Out of Stock Products Found"
                                                : "No Products Found"}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Products Cards - Mobile */}
            <div className="md:hidden space-y-4">
                {isLoadingInitial && products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-md border border-gray-200">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                        <span className="text-sm font-medium text-gray-500">Loading products...</span>
                    </div>
                ) : products.length ? (
                    products.map((product, index) => {
                        const isMatchingSearchVariant = Boolean(
                            debouncedSearchQuery &&
                            product.variants?.some((v: any) =>
                                v.sku?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
                                v.title?.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
                            )
                        );
                        const hasVariants = product.variants && product.variants.length > 0;
                        const isExpanded = expandedProductIds.has(product.id) || stockStatusFilter !== "all" || isMatchingSearchVariant;

                        return (
                            <div
                                key={product.id}
                                className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg transition"
                            >
                                <div className="flex gap-4 mb-4">
                                    {product.image_url ? (
                                        <img
                                            src={`${basePath}${product.image_url}`}
                                            alt={product.name}
                                            className="w-20 h-20 object-cover rounded-xl border border-gray-200 shadow-sm flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <span className="text-xs text-gray-400">No Image</span>
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <h3 className="font-bold text-gray-900 text-sm line-clamp-2">{product.name}</h3>
                                            <button
                                                onClick={() => handleStatusToggle(product)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors cursor-pointer ${product.status ? "bg-green-500" : "bg-red-500"
                                                    }`}
                                                title="Toggle Status"
                                            >
                                                <span
                                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${product.status ? "translate-x-5" : "translate-x-0"
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                        {hasVariants && product.variants.length === 1 && product.variants[0]?.sku && (
                                            <p className="text-[11px] font-mono text-gray-600 mb-1">
                                                SKU: <strong className="text-gray-900">{product.variants[0].sku}</strong>
                                            </p>
                                        )}
                                        {product.item_code && (
                                            <p className="text-[10px] font-mono text-gray-400 mb-1">Code: {product.item_code}</p>
                                        )}
                                        <p className="text-xs text-gray-500 mb-2">#{index + 1}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                                {product.category?.name || '-'}
                                            </span>
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                                {product.brand?.name || '-'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-3 pt-3 border-t border-gray-100">
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Total Stock</p>
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-block ${product.total_stock === 0
                                            ? "bg-rose-100 text-rose-800"
                                            : product.total_stock <= 5
                                                ? "bg-amber-100 text-amber-800"
                                                : "bg-green-100 text-green-700"
                                            }`}>
                                            {product.total_stock === 0 ? "0 (Out of Stock)" : product.total_stock <= 5 ? `${product.total_stock} (Low)` : product.total_stock}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Price Range</p>
                                        <span className="text-sm font-bold text-gray-900">
                                            {product.min_price === product.max_price
                                                ? `₹${product.min_price}`
                                                : `₹${product.min_price} - ₹${product.max_price}`
                                            }
                                        </span>
                                    </div>
                                </div>

                                {hasVariants && (
                                    <div className="mb-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => toggleExpand(product.id)}
                                            className="w-full flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 transition"
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <Layers className="w-3.5 h-3.5 text-blue-600" />
                                                View {product.variants.length} Variants
                                            </span>
                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>

                                        {isExpanded && (
                                            <div className="mt-2 space-y-1.5 border border-gray-200 rounded-lg p-2 bg-gray-50/50">
                                                {product.variants.map((v: any) => {
                                                    const vStock = Number(v.stock ?? 0);
                                                    return (
                                                        <div key={v.id} className="flex items-center justify-between p-1.5 rounded bg-white text-xs border border-gray-100">
                                                            <div>
                                                                <p className="font-semibold text-gray-900">{v.title || "Standard"}</p>
                                                                <p className="text-[10px] text-gray-500">SKU: {v.sku}</p>
                                                            </div>
                                                            <div className="text-end">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${vStock === 0 ? "bg-rose-100 text-rose-800" : vStock <= 5 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                                                                    }`}>
                                                                    {vStock} Units
                                                                </span>
                                                                <p className="text-[10px] font-semibold text-gray-900 mt-0.5">₹{v.sp || v.mrp || 0}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex gap-2 flex-wrap pt-2 border-t border-gray-100">
                                    <button
                                        title="View Details"
                                        onClick={() => goToProductDetail(product)}
                                        className="flex-1 py-2.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-sm cursor-pointer"
                                    >
                                        <Eye className="h-4 w-4" />
                                        View
                                    </button>
                                    <button
                                        title="Edit Product"
                                        onClick={() => editProduct(product)}
                                        className="flex-1 py-2.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-sm cursor-pointer"
                                    >
                                        <Pencil className="h-4 w-4" />
                                        Edit
                                    </button>
                                    <button
                                        title={product.is_new_arrival ? "Remove from New Arrivals" : "Mark as New Arrival"}
                                        onClick={() => handleToggleNewArrival(product)}
                                        className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-sm cursor-pointer ${product.is_new_arrival
                                            ? "bg-amber-100 hover:bg-amber-200 text-amber-600"
                                            : "bg-gray-100 hover:bg-gray-200 text-gray-400"
                                            }`}
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        {product.is_new_arrival ? "New" : "Tag"}
                                    </button>
                                    <button
                                        title="Delete Product"
                                        onClick={() => openDeleteModal(product)}
                                        className="flex-1 py-2.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-sm cursor-pointer"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
                        <p className="text-gray-400 italic">
                            {stockStatusFilter === "low_stock"
                                ? "No Low Stock Products Found"
                                : stockStatusFilter === "out_of_stock"
                                    ? "No Out of Stock Products Found"
                                    : "No Products Found"}
                        </p>
                    </div>
                )}
            </div>

            {/* Bottom Sentinel Element for Infinite Scroll */}
            <div ref={bottomSentinelRef} className="h-6 w-full pointer-events-none" />

            {/* Infinite Scroll Bottom Loading State */}
            {isLoadingMore && (
                <div className="flex items-center justify-center gap-2.5 py-6 text-sm text-gray-600 animate-in fade-in duration-200">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <span className="font-semibold text-gray-700">Loading more products...</span>
                </div>
            )}

            {/* All Products Loaded End Indicator */}
            {!hasNextPage && products.length > 0 && !isLoadingInitial && (
                <div className="flex items-center justify-center py-6 text-xs md:text-sm text-gray-400 font-medium animate-in fade-in duration-200">
                    <span className="bg-gray-100/90 px-4 py-1.5 rounded-full border border-gray-200 text-gray-600 font-semibold shadow-xs flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>All {products.length} products loaded</span>
                    </span>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setSelectedProduct(null);
                }}
                title="Delete Product"
            >
                <div className="p-4">
                    <p className="text-gray-700 mb-4">
                        Are you sure you want to delete <strong>{selectedProduct?.name}</strong>?
                        This will also delete all variants. This action cannot be undone.
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={() => {
                                setIsDeleteModalOpen(false);
                                setSelectedProduct(null);
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteProduct}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium cursor-pointer"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </Modal>

            {/* New Arrival Confirmation Modal */}
            <Modal
                isOpen={isNewArrivalModalOpen}
                onClose={() => {
                    setIsNewArrivalModalOpen(false);
                    setSelectedProductForNewArrival(null);
                }}
                title={selectedProductForNewArrival?.is_new_arrival ? "Remove from New Arrivals" : "Add to New Arrivals"}
            >
                <div className="p-4">
                    <p className="text-gray-700 mb-4">
                        {selectedProductForNewArrival?.is_new_arrival ? (
                            <>
                                Are you sure you want to remove <strong>{selectedProductForNewArrival?.name}</strong> from new arrivals?
                            </>
                        ) : (
                            <>
                                Are you sure you want to add <strong>{selectedProductForNewArrival?.name}</strong> in new arrival?
                            </>
                        )}
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={() => {
                                setIsNewArrivalModalOpen(false);
                                setSelectedProductForNewArrival(null);
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmToggleNewArrival}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium cursor-pointer"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default function ProductsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        }>
            <ProductsContent />
        </Suspense>
    );
}



