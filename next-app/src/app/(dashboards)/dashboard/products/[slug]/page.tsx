
"use client";

import Modal from "@/components/(sheared)/Modal";
import { useLoader } from "@/context/LoaderContext";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { getProductDetails, deleteVariant, setEditProductId } from "../../../../../../utils/product";
import { toggleVariantStatus } from "../../../../../../utils/variantApi";
import { getCategorySlug } from "../../../../../../utils/slugUtils";
import { FaArrowLeft } from "react-icons/fa";
import { Trash2, Pencil, X, ChevronLeft, ChevronRight } from "lucide-react";

const basePath: string =
    `${process.env.NEXT_PUBLIC_UPLOAD_BASE}` || "https://api.zelton.co.in";

export default function ProductDetails() {
    const [product, setProduct] = useState<any>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
    const [openVariantId, setOpenVariantId] = useState<number | null>(null);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxImages, setLightboxImages] = useState<string[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    const openLightbox = (images: (string | null | undefined)[], initialIndex: number = 0, event?: React.MouseEvent) => {
        if (event) {
            event.stopPropagation();
        }
        const resolvedImages = images.map(img => {
            if (!img) return '';
            return img.startsWith('http') ? img : `${basePath}${img}`;
        }).filter(Boolean);

        if (resolvedImages.length > 0) {
            setLightboxImages(resolvedImages);
            setLightboxIndex(initialIndex >= 0 && initialIndex < resolvedImages.length ? initialIndex : 0);
            setIsLightboxOpen(true);
        }
    };

    useEffect(() => {
        if (!isLightboxOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsLightboxOpen(false);
            } else if (e.key === "ArrowLeft") {
                setLightboxIndex((prev) => (prev > 0 ? prev - 1 : lightboxImages.length - 1));
            } else if (e.key === "ArrowRight") {
                setLightboxIndex((prev) => (prev < lightboxImages.length - 1 ? prev + 1 : 0));
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isLightboxOpen, lightboxImages.length]);
    const { showLoader, hideLoader } = useLoader();
    const params = useParams();
    const productId = (params?.slug || params?.id || "") as string;
    const router = useRouter();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (openVariantId && !target.closest(`.variant-dropdown-${openVariantId}`) && !target.closest(`.variant-row-${openVariantId}`)) {
                setOpenVariantId(null);
            }
        };

        if (openVariantId !== null) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [openVariantId]);

    useEffect(() => {
        if (productId) {
            fetchProductDetails();
        }
    }, [productId]);

    useEffect(() => {
        if (successMessage || errorMessage) {
            const timer = setTimeout(() => {
                setSuccessMessage(null);
                setErrorMessage(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, errorMessage]);

    const fetchProductDetails = async () => {
        showLoader();
        try {
            const response = await getProductDetails(productId);
            if (response.success && response.result) {
                setProduct(response.result);
            } else {
                setErrorMessage("Failed to load product details");
            }
        } catch (err) {
            console.error(err);
            setErrorMessage("Failed to load product details");
        } finally {
            hideLoader();
        }
    };

    const handleDeleteVariant = async () => {
        if (!selectedVariant) return;
        showLoader();
        try {
            const response = await deleteVariant(selectedVariant.id);
            if (response.success) {
                setSuccessMessage("Variant deleted successfully");
                setIsDeleteModalOpen(false);
                setSelectedVariant(null);
                fetchProductDetails();
            } else {
                setErrorMessage(response.message || "Failed to delete variant");
            }
        } catch (err: any) {
            console.error(err);
            setErrorMessage(err.response?.data?.message || err.response?.data?.error || "Failed to delete variant");
        } finally {
            hideLoader();
        }
    };

    const handleStatusToggle = async (variant: any, event?: React.MouseEvent) => {
        if (event) {
            event.stopPropagation();
        }
        try {
            await toggleVariantStatus(variant.id);
            setProduct((prev: any) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    variants: prev.variants.map((v: any) =>
                        v.id === variant.id ? { ...v, status: !v.status } : v
                    ),
                };
            });
            setSuccessMessage("Status updated successfully!");
        } catch {
            setErrorMessage("Failed to toggle status.");
        }
    };

    const openDeleteModal = (variant: any) => {
        setSelectedVariant(variant);
        setIsDeleteModalOpen(true);
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

    if (!product) {
        return <div className="p-6">Loading...</div>;
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="p-5 bg-white/70 backdrop-blur border border-gray-200 rounded-2xl shadow-lg mb-5">
                <div className="flex items-center justify-between">
                    <h2 className="lg:text-3xl text-xl font-bold px-5 text-gray-900 tracking-tight">
                        Product Details
                    </h2>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => editProduct(product)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
                        >
                            <Pencil className="text-lg w-4 h-4" />
                            <span className="font-medium">Edit Product</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
                        >
                            <FaArrowLeft className="text-lg" />
                            <span className="font-medium">Back</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Success/Error Toast */}
            {(successMessage || errorMessage) && (
                <div className={`fixed top-6 right-6 z-[99999] px-6 py-4 rounded-lg shadow-lg font-semibold ${successMessage ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}>
                    {successMessage || errorMessage}
                </div>
            )}

            {/* Product Information */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Product Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-6">
                        {(() => {
                            const secImgs = product.image_json
                                ? (typeof product.image_json === "string" ? JSON.parse(product.image_json) : product.image_json)
                                : [];
                            const allProdImgs = [
                                ...(product.image_url ? [product.image_url] : []),
                                ...(Array.isArray(secImgs) ? secImgs : [])
                            ];

                            return (
                                <>
                                    {product.image_url && (
                                        <div>
                                            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Primary Image</span>
                                            <img
                                                src={`${basePath}${product.image_url}`}
                                                alt={product.name}
                                                onClick={(e) => openLightbox(allProdImgs, 0, e)}
                                                className="w-full max-w-md h-64 object-contain bg-gray-50 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:opacity-90 transition"
                                            />
                                        </div>
                                    )}
                                    {Array.isArray(secImgs) && secImgs.length > 0 && (
                                        <div>
                                            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Secondary Images</span>
                                            <div className="flex flex-wrap gap-3">
                                                {secImgs.map((img: string, idx: number) => (
                                                    <div
                                                        key={idx}
                                                        onClick={(e) => openLightbox(allProdImgs, product.image_url ? idx + 1 : idx, e)}
                                                        className="w-24 h-24 border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105 cursor-pointer bg-white"
                                                    >
                                                        <img
                                                            src={`${basePath}${img}`}
                                                            alt={`${product.name} ${idx + 1}`}
                                                            className="object-contain w-full h-full p-1"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>

                    {/* Right Column */}
                    <div className="space-y-3">
                        <div>
                            <label className="text-sm font-semibold text-gray-600">Name</label>
                            <p className="text-lg font-medium text-gray-900">{product.name}</p>
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-gray-600">Item Code</label>
                            <p className="text-gray-900">{product.item_code || '-'}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-semibold text-gray-600">Category</label>
                                <p className="text-gray-900">{product.category?.name || '-'}</p>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-600">Brand</label>
                                <p className="text-gray-900">{product.brand?.name || '-'}</p>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-gray-600">Status</label>
                            <p>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${product.status ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                    }`}>
                                    {product.status ? "Active" : "Inactive"}
                                </span>
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-gray-600">Description</label>
                            <div
                                className="text-gray-700 prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: product.description || 'No description' }}
                            />
                        </div>
                    </div>
                </div>

                {/* Product Features */}
                {product.feature_json && JSON.parse(product.feature_json).length > 0 && (
                    <div className="mt-6">
                        <label className="text-sm font-semibold text-gray-600">Features</label>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                            {JSON.parse(product.feature_json).map((feature: string, index: number) => (
                                <li key={index} className="text-gray-700">{feature}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Product Variants */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                    Product Variants ({product.variants?.length || 0})
                </h3>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-sm text-left">
                        <thead className="uppercase text-xs font-semibold text-gray-700 bg-gray-50">
                            <tr>
                                <th className="px-4 py-3">S.No.</th>
                                <th className="px-4 py-3">Image</th>
                                <th className="px-4 py-3">Title</th>
                                <th className="px-4 py-3">SKU</th>
                                <th className="px-4 py-3">Attributes</th>
                                <th className="px-4 py-3">MRP</th>
                                <th className="px-4 py-3">Selling Price (BP)</th>
                                <th className="px-4 py-3">Buying Price (Cost)</th>
                                <th className="px-4 py-3">Stock</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {product.variants && product.variants.length > 0 ? (
                                product.variants.map((variant: any, index: number) => {
                                    const variantImages = variant.image_json
                                        ? (typeof variant.image_json === "string" ? JSON.parse(variant.image_json) : variant.image_json)
                                        : [];
                                    const allVariantImages = [
                                        ...(variant.image_url ? [variant.image_url] : []),
                                        ...(Array.isArray(variantImages) ? variantImages : [])
                                    ];
                                    const isDropdownOpen = openVariantId === variant.id;
                                    return (
                                        <React.Fragment key={variant.id}>
                                            <tr
                                                onClick={() => {
                                                    setOpenVariantId((prev: number | null) => prev === variant.id ? null : variant.id);
                                                }}
                                                className={`hover:bg-gray-50 transition cursor-pointer variant-row-${variant.id} ${isDropdownOpen ? "bg-blue-50/50 hover:bg-blue-100/50" : ""
                                                    }`}
                                            >
                                                <td className="px-4 py-3">{index + 1}</td>

                                                <td className="px-4 py-3">
                                                    {variant.image_url ? (
                                                        <img
                                                            src={`${basePath}${variant.image_url}`}
                                                            alt={variant.title}
                                                            onClick={(e) => openLightbox(allVariantImages, 0, e)}
                                                            className="w-12 h-12 object-contain rounded-lg border bg-white cursor-pointer hover:scale-105 transition"
                                                        />
                                                    ) : (
                                                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                                            <span className="text-xs text-gray-400">No Img</span>
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3 font-medium">{variant.title || '-'}</td>
                                                <td className="px-4 py-3">{variant.sku}</td>

                                                <td className="px-4 py-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {variant.attribute_values?.map((av: any) => (
                                                            <span
                                                                key={av.id}
                                                                className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs"
                                                                title={av.attribute?.name}
                                                            >
                                                                {av.value}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3">₹{variant.mrp}</td>
                                                <td className="px-4 py-3 font-semibold text-green-600">₹{variant.sp}</td>
                                                <td className="px-4 py-3">₹{variant.bp}</td>

                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${variant.stock > 10
                                                            ? "bg-green-100 text-green-700"
                                                            : variant.stock > 0
                                                                ? "bg-yellow-100 text-yellow-700"
                                                                : "bg-red-100 text-red-700"
                                                        }`}>
                                                        {variant.stock}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={(e) => handleStatusToggle(variant, e)}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors cursor-pointer ${variant.status ? "bg-green-500" : "bg-red-500"
                                                            }`}
                                                        title="Toggle Status"
                                                    >
                                                        <span
                                                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${variant.status ? "translate-x-5" : "translate-x-0"
                                                                }`}
                                                        />
                                                    </button>
                                                </td>

                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        title="Delete Variant"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openDeleteModal(variant);
                                                        }}
                                                        className="inline-flex items-center justify-center size-9 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition cursor-pointer"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                            {isDropdownOpen && (
                                                <tr className={`variant-dropdown-${variant.id} bg-blue-50/10`}>
                                                    <td colSpan={11} className="px-6 py-4">
                                                        <div className="p-5 bg-gray-50/50 border border-blue-200/50 rounded-2xl shadow-inner flex flex-col lg:flex-row gap-6 animate-fadeIn transition-all">
                                                            {/* Images Column */}
                                                            <div className="space-y-3 lg:w-1/3">
                                                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Variant Images</h4>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {variant.image_url ? (
                                                                        <div className="text-center">
                                                                            <img
                                                                                src={`${basePath}${variant.image_url}`}
                                                                                alt={variant.title}
                                                                                onClick={(e) => openLightbox(allVariantImages, 0, e)}
                                                                                className="w-20 h-20 object-contain rounded-xl border bg-white shadow-sm hover:scale-105 transition-all duration-300 cursor-pointer"
                                                                            />
                                                                            <span className="text-[10px] text-gray-400 mt-1 block">Primary</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center border text-xs text-gray-400">
                                                                            No Primary
                                                                        </div>
                                                                    )}
                                                                    {variantImages.map((img: string, idx: number) => (
                                                                        <div key={idx} className="text-center">
                                                                            <img
                                                                                src={`${basePath}${img}`}
                                                                                alt={`${variant.title} ${idx + 1}`}
                                                                                onClick={(e) => openLightbox(allVariantImages, variant.image_url ? idx + 1 : idx, e)}
                                                                                className="w-20 h-20 object-contain rounded-xl border bg-white shadow-sm hover:scale-105 transition-all duration-300 cursor-pointer"
                                                                            />
                                                                            <span className="text-[10px] text-gray-400 mt-1 block">Secondary {idx + 1}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* Info Grid Column */}
                                                            <div className="flex-1">
                                                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Variant Details</h4>
                                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs sm:text-sm">
                                                                    <div>
                                                                        <span className="block font-medium text-gray-500">Title</span>
                                                                        <span className="font-semibold text-gray-900">{variant.title || '-'}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="block font-medium text-gray-500">SKU</span>
                                                                        <span className="font-semibold text-gray-900">{variant.sku || '-'}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="block font-medium text-gray-500">MRP</span>
                                                                        <span className="font-semibold text-gray-900">₹{variant.mrp}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="block font-medium text-gray-500">Selling Price</span>
                                                                        <span className="font-bold text-green-600">₹{variant.sp}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="block font-medium text-gray-500">Base Price</span>
                                                                        <span className="font-semibold text-gray-900">₹{variant.bp}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="block font-medium text-gray-500">Stock</span>
                                                                        <span className="font-semibold text-gray-900">{variant.stock}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="block font-medium text-gray-500 mb-1">Status</span>
                                                                        <button
                                                                            onClick={(e) => handleStatusToggle(variant, e)}
                                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors cursor-pointer ${variant.status ? "bg-green-500" : "bg-red-500"
                                                                                }`}
                                                                            title="Toggle Status"
                                                                        >
                                                                            <span
                                                                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${variant.status ? "translate-x-5" : "translate-x-0"
                                                                                    }`}
                                                                            />
                                                                        </button>
                                                                    </div>
                                                                    <div>
                                                                        <span className="block font-medium text-gray-500 mb-1">Attributes</span>
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {variant.attribute_values && variant.attribute_values.length > 0 ? (
                                                                                variant.attribute_values.map((av: any) => (
                                                                                    <span
                                                                                        key={av.id}
                                                                                        className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-semibold"
                                                                                        title={av.attribute?.name}
                                                                                    >
                                                                                        {av.value}
                                                                                    </span>
                                                                                ))
                                                                            ) : (
                                                                                <span className="text-xs text-gray-400">-</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
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
                                    <td colSpan={11} className="text-center text-gray-400 py-8 italic">
                                        No Variants Found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Delete Variant Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setSelectedVariant(null);
                }}
                title="Delete Variant"
            >
                <div className="p-4">
                    <p className="text-gray-700 mb-4">
                        Are you sure you want to delete variant <strong>{selectedVariant?.sku}</strong>?
                        This action cannot be undone.
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={() => {
                                setIsDeleteModalOpen(false);
                                setSelectedVariant(null);
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteVariant}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium cursor-pointer"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </Modal>

            {/* ══════════════════════════════════════════════════════
                FLIPKART-STYLE FULLSCREEN LIGHTBOX IMAGE SLIDER MODAL
            ══════════════════════════════════════════════════════ */}
            {isLightboxOpen && lightboxImages.length > 0 && (
                <div className="fixed inset-0 z-[99999] bg-white flex flex-col justify-between select-none animate-fadeIn">
                    {/* Top Header Bar */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
                        <button
                            onClick={() => setIsLightboxOpen(false)}
                            className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-700 flex items-center gap-2 text-sm font-medium cursor-pointer"
                            title="Close (Esc)"
                        >
                            <X className="w-6 h-6 text-gray-800" />
                            <span className="hidden sm:inline font-semibold text-gray-800">Close</span>
                        </button>

                        <div className="text-center text-sm font-semibold text-gray-800 tracking-wide max-w-md truncate">
                            {product?.name || 'Image Preview'} ({lightboxIndex + 1} / {lightboxImages.length})
                        </div>

                        <div className="w-16" />
                    </div>

                    {/* Main Image View */}
                    <div className="relative flex-1 flex items-center justify-center p-4 sm:p-8 overflow-hidden bg-white">
                        {/* Prev Button */}
                        {lightboxImages.length > 1 && (
                            <button
                                onClick={() => setLightboxIndex((prev) => (prev > 0 ? prev - 1 : lightboxImages.length - 1))}
                                className="absolute left-4 sm:left-10 z-10 w-12 h-12 bg-white/90 hover:bg-gray-100 text-gray-800 border border-gray-200 rounded-full shadow-lg flex items-center justify-center transition-all transform hover:scale-110 cursor-pointer"
                                title="Previous Image (Left Arrow)"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                        )}

                        {/* Current Image */}
                        <div className="relative w-full h-full max-w-5xl max-h-[78vh] flex items-center justify-center">
                            <img
                                src={lightboxImages[lightboxIndex]}
                                alt={`Full view ${lightboxIndex + 1}`}
                                className="max-w-full max-h-full object-contain transition-all duration-300"
                            />
                        </div>

                        {/* Next Button */}
                        {lightboxImages.length > 1 && (
                            <button
                                onClick={() => setLightboxIndex((prev) => (prev < lightboxImages.length - 1 ? prev + 1 : 0))}
                                className="absolute right-4 sm:right-10 z-10 w-12 h-12 bg-white/90 hover:bg-gray-100 text-gray-800 border border-gray-200 rounded-full shadow-lg flex items-center justify-center transition-all transform hover:scale-110 cursor-pointer"
                                title="Next Image (Right Arrow)"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        )}
                    </div>

                    {/* Bottom Pagination Bar */}
                    <div className="py-4 px-6 border-t border-gray-100 bg-white flex flex-col items-center gap-3">
                        {/* Dots Indicator */}
                        <div className="flex items-center gap-2">
                            {lightboxImages.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setLightboxIndex(idx)}
                                    className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${idx === lightboxIndex ? 'bg-gray-900 w-6' : 'bg-gray-300 w-2.5 hover:bg-gray-400'
                                        }`}
                                />
                            ))}
                        </div>

                        {/* Horizontal Thumbnail Strip */}
                        {lightboxImages.length > 1 && (
                            <div className="flex gap-2.5 overflow-x-auto max-w-full py-1 px-2 no-scrollbar">
                                {lightboxImages.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setLightboxIndex(idx)}
                                        className={`relative w-14 h-14 rounded-lg border-2 overflow-hidden flex-shrink-0 transition-all cursor-pointer ${idx === lightboxIndex ? 'border-[#007FFF] scale-105 shadow-md' : 'border-gray-200 opacity-60 hover:opacity-100'
                                            }`}
                                    >
                                        <img src={img} alt={`thumb-${idx}`} className="w-full h-full object-contain p-1" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

