"use client";

import { Category } from "@/common/interface";
import Modal from "@/components/(sheared)/Modal";
import { useLoader } from "@/context/LoaderContext";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { FaArrowLeft } from "react-icons/fa";
import { getCategoryById } from "../../../../../../../utils/category";
import { getAdminProducts, deleteProduct, toggleProductStatus, setEditProductId } from "../../../../../../../utils/product";
import { getProductSlug } from "../../../../../../../utils/slugUtils";
import { TiInfoLargeOutline } from "react-icons/ti";
import { Pencil, Trash2, Search, Loader2, Plus, Check } from "lucide-react";

const basePath: string =
    `${process.env.NEXT_PUBLIC_UPLOAD_BASE}` || "https://api.zelton.co.in";

const PAGE_SIZE = 10;

export default function Products() {
    const [category, setCategory] = useState<Category | null>(null);

    // Infinite scroll & products state
    const [products, setProducts] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(true);
    const [totalProducts, setTotalProducts] = useState(0);
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const isFetchingRef = useRef(false);
    const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    // Modals & messages
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

    const { showLoader, hideLoader } = useLoader();
    const params = useParams();
    const categoryId = (params?.slug || params?.id || "") as string;
    const router = useRouter();

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Auto-dismiss alert toasts
    useEffect(() => {
        if (successMessage || errorMessage) {
            const timer = setTimeout(() => {
                setSuccessMessage(null);
                setErrorMessage(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, errorMessage]);

    // Fetch Category details
    const fetchCategory = async () => {
        try {
            const data = await getCategoryById(categoryId);
            setCategory(data.result || data.data || null);
        } catch (err) {
            console.error(err);
            setErrorMessage("Failed to load category");
        }
    };

    useEffect(() => {
        if (categoryId) {
            fetchCategory();
        }
    }, [categoryId]);

    // Fetch Products
    const fetchProducts = async (pageNum: number, search: string = "", isAppend: boolean = false) => {
        if (!categoryId || isFetchingRef.current) return;
        isFetchingRef.current = true;

        if (isAppend) {
            setIsLoadingMore(true);
        } else {
            setIsLoadingInitial(true);
            if (search) setIsSearching(true);
        }

        try {
            const filters: any = { category_id: categoryId };
            if (search) filters.search = search;

            const response = await getAdminProducts(pageNum, PAGE_SIZE, filters);

            if (response.success && response.result) {
                const list = response.result.products || [];
                const paginationData = response.result.pagination;

                const total = paginationData?.total ?? list.length;
                const hasNext = Boolean(
                    paginationData?.has_next_page ??
                    paginationData?.hasNextPage ??
                    paginationData?.has_more ??
                    (paginationData ? pageNum < paginationData.last_page : list.length >= PAGE_SIZE)
                );

                setTotalProducts(total);
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
            console.error(err);
            setErrorMessage("Failed to load products");
            if (!isAppend) setProducts([]);
            setHasNextPage(false);
        } finally {
            isFetchingRef.current = false;
            setIsLoadingInitial(false);
            setIsLoadingMore(false);
            setIsSearching(false);
        }
    };

    // Trigger initial fetch / reset on categoryId or search query changes
    useEffect(() => {
        if (categoryId) {
            setPage(1);
            setHasNextPage(true);
            fetchProducts(1, debouncedSearchQuery, false);
        }
    }, [categoryId, debouncedSearchQuery]);

    // Load next page on scroll
    const loadNextPage = useCallback(() => {
        if (!hasNextPage || isLoadingMore || isLoadingInitial || isFetchingRef.current) return;
        fetchProducts(page + 1, debouncedSearchQuery, true);
    }, [hasNextPage, isLoadingMore, isLoadingInitial, page, debouncedSearchQuery]);

    // Observer for bottom sentinel
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
            setErrorMessage(err.response?.data?.message || err.response?.data?.error || "Failed to delete product");
        } finally {
            hideLoader();
        }
    };

    const handleStatusToggle = async (product: any) => {
        try {
            await toggleProductStatus(product.id);
            setProducts((prev) =>
                prev.map((p) => p.id === product.id ? { ...p, status: !p.status } : p)
            );
            setSuccessMessage("Status updated successfully!");
        } catch {
            setErrorMessage("Failed to toggle status.");
        }
    };

    const openDeleteModal = (product: any) => {
        setSelectedProduct(product);
        setIsDeleteModalOpen(true);
    };

    const addProduct = () => {
        if (category?.attributes && category?.attributes?.length > 0) {
            if (category?.attributes?.length === 1) {
                router.push(`/dashboard/categories/${categoryId}/products/add-single-attribute-product`);
            } else {
                router.push(`/dashboard/categories/${categoryId}/products/add-multi-variant`);
            }
        } else {
            router.push(`/dashboard/categories/${categoryId}/products/add-single-variant`);
        }
    };

    const goToProductDetail = (product: any) => {
        const slug = getProductSlug(product);
        window.open(`/dashboard/products/${slug}`, '_blank', 'noopener,noreferrer');
    };

    const editProduct = (product: any) => {
        setEditProductId(product.id);
        const attrCount = product.item_attributes?.length ?? product.itemAttributes?.length ?? category?.attributes?.length ?? 0;
        if (attrCount === 1) {
            router.push(`/dashboard/categories/${categoryId}/products/add-single-attribute-product`);
        } else if (attrCount === 0 && (!product.variants || product.variants.length <= 1)) {
            router.push(`/dashboard/categories/${categoryId}/products/add-single-variant`);
        } else {
            router.push(`/dashboard/categories/${categoryId}/products/add-multi-variant`);
        }
    };

    return (
        <div className="p-3 md:p-6">
            {/* Header */}
            <div className="mb-4 md:mb-6 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-xl shadow-md">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 md:px-6 py-3.5 md:py-4">

                    {/* Title & Count */}
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg md:text-xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">
                            {category?.name ? `${category.name} - Products` : "Products"}
                        </h2>
                        {totalProducts > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                {products.length} of {totalProducts}
                            </span>
                        )}
                    </div>

                    {/* Actions & Search */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">

                        {/* Search Input */}
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search products..."
                                className="w-full rounded-xl border border-gray-300 bg-white pl-10 pr-10 py-2 md:py-2.5 text-sm md:text-base text-gray-900 placeholder-gray-400 shadow-sm focus:border-[#007FFF] focus:ring-2 focus:ring-blue-200 transition-all"
                            />
                            {isSearching ? (
                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                                    <Loader2 className="w-4 h-4 animate-spin text-[#007FFF]" />
                                </div>
                            ) : searchQuery ? (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 transition-all cursor-pointer"
                                >
                                    Clear
                                </button>
                            ) : null}
                        </div>

                        {/* Back Button */}
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl shadow-xs text-xs md:text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap"
                        >
                            <FaArrowLeft className="text-xs md:text-sm" />
                            <span>Back</span>
                        </button>

                        {/* Add Products Button */}
                        <button
                            onClick={addProduct}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 md:py-2.5 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] rounded-xl shadow-md text-white font-semibold text-xs md:text-sm hover:shadow-lg transition-all duration-200 whitespace-nowrap cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Product</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Table - Desktop */}
            <div className="hidden md:block">
                <div className="overflow-x-auto scrollbar rounded-2xl shadow-lg border border-gray-200 bg-white">
                    <table className="w-full min-w-[800px] text-sm text-left">
                        {/* Table Header */}
                        <thead className="uppercase text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4">S.No.</th>
                                <th className="px-6 py-4">Image</th>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Item Code</th>
                                <th className="px-6 py-4">Stock</th>
                                <th className="px-6 py-4">Price Range</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-end">Actions</th>
                            </tr>
                        </thead>

                        {/* Table Body */}
                        <tbody className="divide-y divide-gray-200 text-gray-700">
                            {isLoadingInitial && products.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-16">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="w-8 h-8 animate-spin text-[#007FFF]" />
                                            <span className="text-sm font-medium text-gray-500">Loading products...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : products.length ? (
                                products.map((product, index) => (
                                    <tr
                                        key={product.id}
                                        className="hover:bg-blue-50/30 transition-colors"
                                    >
                                        {/* S.No */}
                                        <td className="px-6 py-4 font-semibold text-gray-500">{index + 1}</td>

                                        {/* Image */}
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

                                        {/* Name */}
                                        <td className="px-6 py-4 font-semibold max-w-[200px] break-all whitespace-normal text-gray-900">
                                            {product.name}
                                        </td>

                                        {/* Item Code */}
                                        <td className="px-6 py-4 max-w-[120px] break-all whitespace-normal text-gray-600">
                                            {product.item_code || '-'}
                                        </td>

                                        {/* Stock */}
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${product.total_stock > 10
                                                ? "bg-green-100 text-green-700"
                                                : product.total_stock > 0
                                                    ? "bg-yellow-100 text-yellow-700"
                                                    : "bg-red-100 text-red-700"
                                                }`}>
                                                {product.total_stock || 0} units
                                            </span>
                                        </td>

                                        {/* Price Range */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-medium">
                                                {product.min_price === product.max_price
                                                    ? `₹${product.min_price}`
                                                    : `₹${product.min_price} - ₹${product.max_price}`
                                                }
                                            </span>
                                        </td>

                                        {/* Status */}
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

                                        {/* Actions */}
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    title="View Product Details"
                                                    onClick={() => goToProductDetail(product)}
                                                    className="size-10 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full flex items-center justify-center transition cursor-pointer"
                                                >
                                                    <TiInfoLargeOutline className="h-5 w-5" />
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
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className="text-center text-gray-400 py-12 italic">
                                        No Products Found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
                {isLoadingInitial && products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-md border border-gray-200">
                        <Loader2 className="w-8 h-8 animate-spin text-[#007FFF] mb-2" />
                        <span className="text-sm font-medium text-gray-500">Loading products...</span>
                    </div>
                ) : products.length ? (
                    products.map((product, index) => (
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
                                    <p className="text-xs text-gray-500 mb-1 font-semibold">#{index + 1}</p>
                                    {product.item_code && (
                                        <p className="text-xs text-gray-600">
                                            <span className="font-medium">Code:</span> {product.item_code}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mb-3 pt-3 border-t border-gray-100">
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Stock</p>
                                    <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium inline-block ${product.total_stock > 10
                                            ? "bg-green-100 text-green-700"
                                            : product.total_stock > 0
                                                ? "bg-yellow-100 text-yellow-700"
                                                : "bg-red-100 text-red-700"
                                            }`}
                                    >
                                        {product.total_stock || 0} units
                                    </span>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Price Range</p>
                                    <span className="text-sm font-bold text-gray-900">
                                        {product.min_price === product.max_price
                                            ? `₹${product.min_price}`
                                            : `₹${product.min_price} - ₹${product.max_price}`}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    title="View Details"
                                    onClick={() => goToProductDetail(product)}
                                    className="flex-1 py-2.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-sm cursor-pointer"
                                >
                                    <TiInfoLargeOutline className="h-4 w-4" />
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
                                    title="Delete Product"
                                    onClick={() => openDeleteModal(product)}
                                    className="flex-1 py-2.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-sm cursor-pointer"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
                        <p className="text-gray-400 italic">No Products Found</p>
                    </div>
                )}
            </div>

            {/* Bottom Sentinel for Infinite Scroll */}
            <div ref={bottomSentinelRef} className="h-6 w-full pointer-events-none" />

            {/* Infinite Scroll Bottom Loading State */}
            {isLoadingMore && (
                <div className="flex items-center justify-center gap-2.5 py-6 text-sm text-gray-600 animate-in fade-in duration-200">
                    <Loader2 className="w-5 h-5 animate-spin text-[#007FFF]" />
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

            {/* Success/Error Toast */}
            {(successMessage || errorMessage) && (
                <div className={`fixed top-6 right-6 z-[99999] px-6 py-4 rounded-lg shadow-lg font-semibold animate-in fade-in duration-200 ${successMessage ? "bg-green-100 text-green-800 border border-green-200" : "bg-red-100 text-red-800 border border-red-200"
                    }`}>
                    {successMessage || errorMessage}
                </div>
            )}

            {/* Description Modal */}
            <Modal
                isOpen={isDescriptionModalOpen}
                onClose={() => {
                    setIsDescriptionModalOpen(false);
                    setSelectedProduct(null);
                }}
                title="Product Description"
            >
                <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                        {selectedProduct?.name}
                    </h3>
                    <div
                        className="text-gray-700 prose max-w-none"
                        dangerouslySetInnerHTML={{
                            __html:
                                selectedProduct?.description || "<p>No Description</p>",
                        }}
                    />
                </div>
            </Modal>

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
                        Are you sure you want to delete <strong>{selectedProduct?.name}</strong>? This action cannot be undone.
                    </p>
                    <div className="mt-6 flex gap-3 justify-end">
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
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium cursor-pointer"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
