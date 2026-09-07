"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLike } from "@/context/LikeContext";
import { extractProductPricing } from "@/utils/pricing";
import { getProductSlug } from "../../../../utils/slugUtils";
import { useAuth } from "@/context/AuthContext";
import { Heart, ShoppingCart, ArrowLeft, Trash2, ShieldCheck, Layers, CheckCircle2, Truck, Tag } from "lucide-react";
import imgPlaceholder from "@/public/imagePlaceholder.png";
import { getUserLikedProducts } from "../../../../utils/likeApi";
import ErrorMessage from "@/components/(sheared)/ErrorMessage";
import SuccessMessage from "@/components/(sheared)/SuccessMessage";
import { useLoader } from "@/context/LoaderContext";

interface LikedProduct {
    id: number;
    name: string;
    description?: string;
    item_code?: string;
    image_url?: string;
    category?: {
        name: string;
    };
    brand?: {
        name: string;
    };
    variants: Array<{
        id: number;
        title: string;
        sku: string;
        sp: number;
        mrp?: number;
        stock: number;
        image_url?: string;
        image_json?: string;
    }>;
    min_price?: number;
    likes_count?: number;
}

const LikesPage = () => {
    const router = useRouter();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const { user, loading: authLoading, openAuthModal } = useAuth();
    const { toggleLike, isLiked, likesLoading } = useLike();
    const [likedProducts, setLikedProducts] = useState<LikedProduct[]>([]);
    const [removingId, setRemovingId] = useState<number | null>(null);
    const { showLoader, hideLoader } = useLoader();

    const basePath = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";

    useEffect(() => {
        if (authLoading) return;
        fetchLikedProducts();
    }, [user, authLoading]);

    const fetchLikedProducts = async () => {
        showLoader();
        try {
            const response = await getUserLikedProducts();
            if (response.res === 'success') {
                setLikedProducts(response.liked_products);
            }
        } catch (error) {
            console.error('Error fetching liked products:', error);
            setErrorMessage("Failed to load your wishlist. Please try again.");
        } finally {
            hideLoader();
        }
    };

    const handleRemoveFromWishlist = async (productId: number) => {
        setRemovingId(productId);
        const success = await toggleLike(productId);
        if (success) {
            setLikedProducts(prev => prev.filter(product => product.id !== productId));
            setSuccessMessage("Product removed from wishlist successfully!");
        } else {
            setErrorMessage("Failed to remove product from wishlist. Please try again.");
        }
        setRemovingId(null);
    };

    const handleProductClick = (productOrId: any) => {
        const slug = typeof productOrId === 'object' ? getProductSlug(productOrId) : productOrId;
        router.push(`/products/${slug}`);
    };

    const getProductImageUrl = (product: LikedProduct) => {
        if (product.image_url) {
            return product.image_url.startsWith('http') ? product.image_url : `${basePath}${product.image_url}`;
        }
        if (product.variants && product.variants.length > 0 && product.variants[0].image_url) {
            const vUrl = product.variants[0].image_url;
            return vUrl.startsWith('http') ? vUrl : `${basePath}${vUrl}`;
        }
        return imgPlaceholder.src;
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
                <div className="container mx-auto px-4 py-16">
                    <div className="text-center">
                        <Heart className="w-24 h-24 text-gray-400 mx-auto mb-6" />
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">Please Login</h1>
                        <p className="text-gray-600 mb-8">You need to login to view your wishlist</p>
                        <button
                            onClick={() => openAuthModal('login')}
                            style={{ backgroundColor: 'var(--theme-blue)', color: '#FFFAFB' }}
                            className="px-8 py-3 font-semibold rounded-full hover:bg-[#0066CC] hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                        >
                            Login Now
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            {errorMessage && <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />}
            {successMessage && <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />}

            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-4 mb-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">My Wishlist</h1>
                            <p className="text-gray-600">{likedProducts.length} items saved</p>
                        </div>
                    </div>
                </div>

                {/* Products Grid */}
                {likedProducts.length === 0 ? (
                    <div className="text-center py-16">
                        <Heart className="w-24 h-24 text-gray-400 mx-auto mb-6" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your wishlist is empty</h2>
                        <p className="text-gray-600 mb-8">Start adding products you love to your wishlist</p>
                        <button
                            onClick={() => router.push('/')}
                            style={{ backgroundColor: 'var(--theme-blue)', color: '#FFFAFB' }}
                            className="px-8 py-3 font-semibold rounded-full hover:bg-[#0066CC] hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                        >
                            Browse Products
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 gap-3.5 sm:gap-4.5">
                        {likedProducts.map((product) => {
                            const { formattedSp, formattedMrp, discountPct, hasDiscount } = extractProductPricing(product);
                            const fullName = product.brand?.name ? `${product.name} (${product.brand.name})` : product.name;
                            const hasStock = product.variants?.some((v) => v.stock > 0) ?? true;

                            return (
                                <div key={product.id} className="bg-white rounded-2xl shadow-2xs hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-200/80 flex flex-col group/card">
                                    {/* 1. Full-bleed Product Image Section (object-cover with Choose Options overlay) */}
                                    <div className="relative w-full aspect-square bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-200/60 flex-shrink-0">
                                        <img
                                            src={getProductImageUrl(product)}
                                            alt={fullName || "Product"}
                                            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500 cursor-pointer"
                                            onClick={() => handleProductClick(product)}
                                            onError={(e: any) => {
                                                e.target.src = imgPlaceholder.src;
                                            }}
                                        />
                                        {/* Remove from wishlist top floating heart button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveFromWishlist(product.id);
                                            }}
                                            disabled={removingId === product.id || likesLoading}
                                            className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-red-500 shadow-md border border-gray-100 hover:bg-red-50 transition-all hover:scale-110 disabled:opacity-50"
                                            title="Remove from wishlist"
                                        >
                                            {removingId === product.id ? (
                                                <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-500 rounded-full animate-spin"></div>
                                            ) : (
                                                <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-red-500 text-red-500" />
                                            )}
                                        </button>

                                        {/* "Choose Options" Overlay Button on hover */}
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] flex justify-center pointer-events-none opacity-0 invisible group-hover/card:opacity-100 group-hover/card:visible transition-all duration-300 scale-95 group-hover/card:scale-100 z-20">
                                            <span className="w-full text-center bg-white/95 hover:bg-white text-gray-900 text-xs sm:text-sm font-bold py-2 sm:py-2.5 px-4 rounded-full shadow-2xl border border-gray-200">
                                                Choose Options
                                            </span>
                                        </div>
                                    </div>

                                    {/* 2. Product Info Section */}
                                    <div className="p-2.5 sm:p-3.5 flex flex-col justify-between flex-1 bg-[#F7F7F7] gap-2">
                                        <div className="flex flex-col gap-1">
                                            {/* Full Product Name */}
                                            <h3
                                                className="text-xs sm:text-sm font-semibold text-gray-900 leading-snug cursor-pointer group-hover/card:text-[#007FFF] transition-colors"
                                                onClick={() => handleProductClick(product)}
                                                title={fullName}
                                            >
                                                {fullName}
                                            </h3>

                                            {/* Pricing Row (Selling Price in Red, Strikethrough MRP, Navy Discount Pill) */}
                                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mt-0.5">
                                                <span className="font-bold text-sm sm:text-base text-[#C53030]">
                                                    {formattedSp}
                                                </span>
                                                {hasDiscount && (
                                                    <span className="line-through text-xs sm:text-sm text-gray-400 font-normal">
                                                        {formattedMrp}
                                                    </span>
                                                )}
                                                {hasDiscount && discountPct > 0 && (
                                                    <span className="bg-[#0c2340] text-white text-[10px] sm:text-[11px] font-extrabold px-2 py-0.5 rounded-full shadow-2xs">
                                                        {discountPct}% OFF
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* ── 3. Desktop Metadata Section (Quality Assured, Options, Stock Status — Matching Image 2) ── */}
                                        <div className="hidden sm:flex pt-2 border-t border-gray-200/60 flex-col gap-1.5 mt-auto">
                                            <div className="flex items-center justify-between gap-2 text-xs">
                                                {product.brand ? (
                                                    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-[11px] font-medium px-2 py-0.5 rounded-md">
                                                        <Tag className="w-3 h-3 text-gray-500" />
                                                        {product.brand.name}
                                                    </span>
                                                ) : product.category ? (
                                                    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-[11px] font-medium px-2 py-0.5 rounded-md">
                                                        {product.category.name}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 bg-blue-50 text-[#007FFF] text-[11px] font-medium px-2 py-0.5 rounded-md">
                                                        <ShieldCheck className="w-3 h-3" /> Quality Assured
                                                    </span>
                                                )}

                                                {product.variants && product.variants.length > 1 && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-white px-2 py-0.5 rounded-md border border-gray-200">
                                                        <Layers className="w-3 h-3 text-gray-400" />
                                                        {product.variants.length} Options
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
                                                {hasStock ? (
                                                    <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                                        <CheckCircle2 className="w-3 h-3" /> In Stock & ready to ship
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-amber-600 font-medium">
                                                        <Truck className="w-3 h-3" /> Express Delivery Available
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action buttons (View + Delete) */}
                                        <div className="flex items-center gap-1.5 sm:gap-2 pt-2 border-t border-gray-200/60 mt-1">
                                            <button
                                                onClick={() => handleProductClick(product.id)}
                                                className="flex-1 py-1.5 sm:py-2 px-2.5 sm:px-3 bg-[#007FFF] text-white rounded-lg hover:bg-[#0066CC] transition-colors text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs"
                                            >
                                                <ShoppingCart className="w-3.5 h-3.5" />
                                                <span>View</span>
                                            </button>
                                            <button
                                                onClick={() => handleRemoveFromWishlist(product.id)}
                                                disabled={removingId === product.id || likesLoading}
                                                className="p-1.5 sm:px-2.5 sm:py-2 bg-red-50 text-[#F40000] hover:bg-red-100 border border-red-100 rounded-lg transition-colors text-xs disabled:opacity-50 flex items-center justify-center"
                                                title="Remove"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LikesPage;