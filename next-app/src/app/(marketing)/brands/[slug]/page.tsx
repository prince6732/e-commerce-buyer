"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
    ArrowLeft,
    Package,
    Loader2,
    ShoppingBag,
    Award,
    CheckCircle,
} from "lucide-react";
import { getBrandById } from "../../../../../utils/brand";
import { getProductSlug } from "../../../../../utils/slugUtils";
import { Brand } from "@/common/interface";
import { useLike } from "@/context/LikeContext";
import imgPlaceholder from "@/public/imagePlaceholder.png";
import axios from "../../../../../utils/axios";

const basePath = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";

interface BrandProduct {
    id: number;
    name: string;
    description: string;
    item_code?: string;
    slug?: string;
    image_url: string | null;
    category: { id: number; name: string } | null;
    brand: { id: number; name: string } | null;
    min_price: number;
    max_price: number;
    total_stock: number;
    variants_count: number;
    average_rating?: number;
    reviews_count?: number;
    best_variant?: {
        id: number;
        sp: number;
        mrp: number | null;
        stock: number;
        image_url: string | null;
    } | null;
}

interface ExtendedBrand extends Brand {
    products_count?: number;
}

export default function BrandDetailPage() {
    const params = useParams();
    const router = useRouter();
    const brandId = (params?.slug || params?.id || "") as string;
    const [brand, setBrand] = useState<ExtendedBrand | null>(null);
    const [products, setProducts] = useState<BrandProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const observerTargetRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const fetchBrandDetails = async () => {
            try {
                setLoading(true);
                const data = await getBrandById(brandId);
                setBrand(data);

                // Fetch first page of products
                await fetchProducts(1);
            } catch (err: any) {
                console.error("Error fetching brand:", err);
                setError(err.message || "Failed to load brand details");
            } finally {
                setLoading(false);
            }
        };

        if (brandId) {
            fetchBrandDetails();
        }
    }, [brandId]);

    const fetchProducts = async (page: number) => {
        try {
            if (page > 1) {
                setLoadingMore(true);
            }

            const response = await axios.get(`/api/brands/${brandId}/products`, {
                params: {
                    page,
                    per_page: 8,
                },
            });

            const { products: newProducts, has_more } = response.data;

            if (page === 1) {
                setProducts(newProducts);
            } else {
                setProducts((prev) => [...prev, ...newProducts]);
            }

            setHasMore(has_more);
            setCurrentPage(page);
        } catch (err: any) {
            console.error("Error fetching products:", err);
        } finally {
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
                    fetchProducts(currentPage + 1);
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(target);
        return () => observer.disconnect();
    }, [hasMore, loading, loadingMore, currentPage, brandId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-[#007FFF] animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Loading brand details...</p>
                </div>
            </div>
        );
    }

    if (error || !brand) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Brand Not Found</h1>
                    <p className="text-gray-600 mb-6">{error || "The brand you're looking for doesn't exist."}</p>
                    <button
                        onClick={() => router.push("/")}
                        style={{ backgroundColor: 'var(--theme-blue)', color: '#FFFAFB' }}
                        className="px-6 py-3 rounded-xl hover:bg-[#0066CC] transition-all duration-300 font-medium"
                    >
                        Go to Home
                    </button>
                </div>
            </div>
        );
    }

    const sections = [
        {
            image: brand.image1,
            description: brand.description1,
            layout: "image-left",
        },
        {
            image: brand.image2,
            description: brand.description2,
            layout: "image-right",
        },
        {
            image: brand.image3,
            description: brand.description3,
            layout: "image-left",
        },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-white">
            {/* Hero Header with Background */}
            <div style={{ backgroundColor: 'var(--theme-blue)', color: '#FFFAFB' }} className="relative">
                <div className="container mx-auto px-4 py-10 md:py-14 relative z-10">

                    {/* Back Button */}
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition mb-6 text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </button>

                    {/* Content Row */}
                    <div className="flex flex-col md:flex-row items-center gap-10">

                        {/* Brand Info */}
                        <div className="flex-1">
                            <div className="flex items-center gap-4 mb-4">
                                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                                    {brand.name}
                                </h1>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold">
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                    Official Brand
                                </span>
                            </div>

                            {brand.description && (
                                <div
                                    className="text-lg opacity-90 leading-relaxed max-w-2xl"
                                    dangerouslySetInnerHTML={{ __html: brand.description }}
                                />
                            )}

                            {/* Stats */}
                            <div className="flex items-center gap-8 mt-8 pt-8 border-t border-white/20">
                                <div>
                                    <div className="text-3xl font-bold">
                                        {brand.products_count || 0}
                                    </div>
                                    <div className="text-sm opacity-80">Products</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-bold flex items-center gap-1">
                                        4.8
                                        <span className="text-xl">★</span>
                                    </div>
                                    <div className="text-sm opacity-80">Brand Rating</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-bold">100%</div>
                                    <div className="text-sm opacity-80">Authentic</div>
                                </div>
                            </div>
                        </div>

                        {/* Brand Logo/Image */}
                        {brand.image1 && (
                            <div className="w-48 h-48 md:w-64 md:h-64 relative bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center justify-center border border-white/20">
                                <div className="w-full h-full relative rounded-xl overflow-hidden">
                                    <Image
                                        src={`${basePath}${brand.image1}`}
                                        alt={brand.name}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>


            {/* Main Content */}
            <div className="container mx-auto px-4 py-12">
                {/* Brand Story Sections */}
                <div className="space-y-16 mb-16">
                    {sections.map((section, index) => {
                        if (!section.image || !section.description) return null;

                        const isEven = index % 2 === 0;
                        const imageUrl = `${basePath}${section.image}`;

                        return (
                            <div
                                key={index}
                                className={`flex flex-col ${isEven ? "lg:flex-row" : "lg:flex-row-reverse"
                                    } items-center gap-12`}
                            >
                                {/* Image */}
                                <div className="w-full lg:w-1/2">
                                    <div className="relative rounded-3xl overflow-hidden shadow-xl group">
                                        <div className="aspect-[4/3] relative">
                                            <Image
                                                src={imageUrl}
                                                alt={`${brand.name} - Section ${index + 1}`}
                                                fill
                                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                unoptimized
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="w-full lg:w-1/2">
                                    <div className="space-y-6">
                                        <div className="prose prose-lg max-w-none">
                                            <div
                                                className="text-gray-700 leading-relaxed space-y-4"
                                                dangerouslySetInnerHTML={{ __html: section.description }}
                                            />
                                        </div>

                                        {/* Decorative element */}
                                        <div className="flex items-center gap-2 pt-4">
                                            <div className="w-2 h-2 bg-[#007FFF] rounded-full"></div>
                                            <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
                                            <div className="w-2 h-2 bg-[#007FFF] rounded-full"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {sections.every((s) => !s.image || !s.description) && (
                        <div className="text-center py-16">
                            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                No additional information available
                            </h3>
                            <p className="text-gray-600">Brand details will be updated soon.</p>
                        </div>
                    )}
                </div>

                {/* Products Section */}
                {products.length > 0 ? (
                    <>
                        {/* Products Header */}
                        <div className="mb-8 text-center">
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">
                                Our Products
                            </h2>
                            <p className="text-gray-600">
                                Explore {brand.products_count} amazing products from {brand.name}
                            </p>
                        </div>

                        {/* Products Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {products.map((product) => {
                                const sp = product.best_variant?.sp ?? product.min_price;
                                const mrp = product.best_variant?.mrp ?? product.max_price ?? null;
                                const discountPct = mrp && Number(mrp) > Number(sp)
                                    ? Math.round(((Number(mrp) - Number(sp)) / Number(mrp)) * 100)
                                    : 0;
                                const rating = product.average_rating ?? 0;
                                const reviewCount = product.reviews_count ?? 0;

                                return (
                                    <Link
                                        key={product.id}
                                        href={`/products/${getProductSlug(product)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-white rounded-2xl shadow hover:shadow-lg transition-all duration-300 overflow-hidden group flex flex-col"
                                    >
                                        {/* Image */}
                                        <div className="relative aspect-[3/4] bg-gray-50 overflow-hidden flex-shrink-0">
                                            <Image
                                                src={product.image_url ? `${basePath}${product.image_url}` : imgPlaceholder}
                                                alt={product.name}
                                                fill
                                                unoptimized
                                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                            {mrp && Number(mrp) >= Number(sp) && (
                                                <span className="absolute top-2 right-2 bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full z-10">
                                                    {discountPct}% OFF
                                                </span>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="p-2.5 flex flex-col gap-0.5 flex-1">
                                            <h3 className="font-semibold text-gray-900 text-xs leading-snug line-clamp-2 group-hover:text-[#007FFF] transition-colors">
                                                {product.name}
                                            </h3>

                                            {/* Star rating */}
                                            {reviewCount > 0 && (
                                                <div className="flex items-center gap-1">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <svg
                                                            key={star}
                                                            className={`w-3.5 h-3.5 ${star <= Math.round(rating)
                                                                    ? 'text-yellow-400 fill-yellow-400'
                                                                    : 'text-gray-300 fill-gray-300'
                                                                }`}
                                                            viewBox="0 0 20 20"
                                                        >
                                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                        </svg>
                                                    ))}
                                                    <span className="text-xs text-gray-500 ml-0.5">({reviewCount})</span>
                                                </div>
                                            )}

                                            {/* Price */}
                                            <div className="flex items-baseline gap-1.5 flex-wrap mt-0.5">
                                                <span className="text-sm font-bold text-gray-900">
                                                    ₹{Number(sp).toLocaleString('en-IN')}
                                                </span>
                                                {mrp && Number(mrp) >= Number(sp) && (
                                                    <span className="text-xs text-gray-500">({discountPct}% off)</span>
                                                )}
                                            </div>

                                            {/* MRP */}
                                            {mrp && Number(mrp) > Number(sp) && (
                                                <p className="text-xs text-gray-400">
                                                    M.R.P.: <span className="line-through">₹{Number(mrp).toLocaleString('en-IN')}</span>
                                                </p>
                                            )}

                                            {/* Brand */}
                                            {product.brand && (
                                                <p className="text-xs text-gray-500 mt-auto pt-1">{product.brand.name}</p>
                                            )}
                                        </div>
                                    </Link>
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
                ) : (
                    <div className="text-center py-16">
                        <ShoppingBag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            No products available
                        </h3>
                        <p className="text-gray-600 mb-6">
                            Products from this brand will be added soon.
                        </p>
                    </div>
                )}
            </div>

            {/* Bottom CTA Section */}
            <div style={{ backgroundColor: 'var(--theme-blue)' }} className="py-12">
                <div className="container mx-auto px-4 text-center text-white">
                    <h2 className="text-3xl font-bold mb-4">Discover More Brands</h2>
                    <p className="text-white/90 mb-6 max-w-2xl mx-auto">
                        Explore our complete collection of trusted brands and find products that match your style.
                    </p>
                    <button
                        onClick={() => router.push('/brands')}
                        className="px-8 py-4 bg-white text-[#007FFF] rounded-xl hover:bg-gray-100 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                        View All Brands
                    </button>
                </div>
            </div>
        </div>
    );
}
