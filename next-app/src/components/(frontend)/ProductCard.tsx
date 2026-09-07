"use client";

import React from "react";
import { useRouter } from "next/navigation";
import imgPlaceholder from "@/public/imagePlaceholder.png";
import { extractProductPricing } from "@/utils/pricing";
import { getProductSlug } from "../../../utils/slugUtils";
import { Star, Truck, CheckCircle2, Layers, ShieldCheck, Tag, Heart, ChevronDown } from "lucide-react";
import { useLike } from "@/context/LikeContext";
import { useAuth } from "@/context/AuthContext";

export interface ProductCardProps {
  product: any;
  onClick?: () => void;
  className?: string;
  isNew?: boolean;
  isBestseller?: boolean;
  hideMetadata?: boolean;
}

export default function ProductCard({
  product,
  onClick,
  className = "",
  isNew,
  isBestseller,
  hideMetadata = false,
}: ProductCardProps) {
  const router = useRouter();
  const { isLiked, toggleLike } = useLike();
  const { user, openAuthModal } = useAuth();

  if (!product) return null;

  const isProductLiked = isLiked(product?.id);

  const handleWishlistClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) {
      openAuthModal("login");
      return;
    }
    if (product?.id) {
      await toggleLike(Number(product.id));
    }
  };

  const uploadUrl = process.env.NEXT_PUBLIC_UPLOAD_BASE ?? "https://api.zelton.co.in";

  // Determine Image URL safely (prioritize product primary image, then first variant with image, then best_variant)
  let rawImg = product.image_url || product.imageUrl;
  if (!rawImg && product.variants && product.variants.length > 0) {
    const firstWithImg = product.variants.find((v: any) => v?.image_url || v?.imageUrl);
    rawImg = firstWithImg?.image_url || firstWithImg?.imageUrl || product.variants[0]?.image_url || product.variants[0]?.imageUrl;
  }
  if (!rawImg) {
    rawImg = product.best_variant?.image_url || product.best_variant?.imageUrl;
  }

  const imgSrc = rawImg
    ? rawImg.startsWith("http") || rawImg.startsWith("data:")
      ? rawImg
      : `${uploadUrl}${rawImg.startsWith("/") ? "" : "/"}${rawImg}`
    : imgPlaceholder.src;

  // Extract Pricing (SP = BP, MRP = Original, Discount = % OFF)
  const { sp, mrp, discountPct, hasDiscount, formattedSp, formattedMrp } =
    extractProductPricing(product);

  // Metadata Extraction
  const rating = parseFloat(String(product.average_rating ?? product.rating_summary?.average_rating ?? product.rating ?? 0));
  const reviewsCount = Number(product.reviews_count ?? product.rating_summary?.reviews_count ?? product.rating_summary?.total_reviews ?? product.reviewsCount ?? 0);
  const variantCount = product.variants?.length || product.variants_count || 0;
  const brandName = product.brand?.name || product.brand_name;
  const categoryName = product.category?.name || product.category_name;
  const stock = product.best_variant?.stock ?? product.total_stock ?? 10;
  const showNewBadge = isNew || product.is_new_arrival;
  const showBestsellerBadge = isBestseller || product.is_bestseller;

  const handleClick = (e?: React.MouseEvent) => {
    if (onClick) {
      onClick();
    } else {
      const slug = getProductSlug(product);
      if (!slug) return;
      if (e && (e.ctrlKey || e.metaKey || e.button === 1)) {
        window.open(`/products/${slug}`, '_blank', 'noopener,noreferrer');
      } else {
        router.push(`/products/${slug}`);
      }
    }
  };

  const formattedReviewCount = reviewsCount >= 1000
    ? `${(reviewsCount / 1000).toFixed(1).replace(/\.0$/, '')}K`
    : reviewsCount;

  return (
    <div
      onClick={handleClick}
      className={`group/card bg-[#F7F7F7] rounded-2xl border border-gray-200/80 hover:border-gray-300 hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between h-full select-none ${className}`}
    >
      {/* ── 1. Image Frame (1:1 Aspect Ratio, Scale Hover) ── */}
      <div className="relative w-full aspect-square bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-200/60 flex-shrink-0">
        <img
          src={imgSrc}
          alt={product.name || "Product"}
          className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
          onError={(e: any) => {
            e.target.src = imgPlaceholder.src;
          }}
        />

        {/* Top-Left Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none">
          {showNewBadge && (
            <span className="bg-[#007FFF] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
              NEW
            </span>
          )}
          {showBestsellerBadge && !showNewBadge && (
            <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
              BESTSELLER
            </span>
          )}
        </div>

        {/* Top-Right Wishlist (Like / Heart) Button */}
        <button
          type="button"
          onClick={handleWishlistClick}
          className="absolute top-2 right-2 p-1.5 sm:p-2 bg-white/90 hover:bg-white rounded-full shadow-md transition-all duration-200 z-20 flex items-center justify-center hover:scale-110"
          title={isProductLiked ? "Remove from Wishlist" : "Add to Wishlist"}
          aria-label={isProductLiked ? "Remove from Wishlist" : "Add to Wishlist"}
        >
          <Heart
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${isProductLiked
              ? "fill-red-500 text-red-500"
              : "text-gray-600 hover:text-red-500"
              }`}
          />
        </button>

        {/* "Choose Options" Overlay Button */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] flex justify-center pointer-events-none opacity-0 invisible group-hover/card:opacity-100 group-hover/card:visible transition-all duration-300 scale-95 group-hover/card:scale-100 z-20">
          <span className="w-full text-center bg-white/95 hover:bg-white text-gray-900 text-xs sm:text-sm font-bold py-2.5 sm:py-3 px-6 rounded-full shadow-2xl border border-gray-200">
            Choose Options
          </span>
        </div>
      </div>

      {/* ── 2. Card Content ── */}
      <div className="p-2 sm:p-2.5 flex flex-col justify-between flex-1 bg-[#F7F7F7] gap-1.5">
        <div className="flex flex-col gap-0.5">
          {/* Product Title (Max 2 lines) */}
          <h3 className="text-xs sm:text-[13px] font-semibold text-gray-900 line-clamp-2 leading-snug group-hover/card:text-[#007FFF] transition-colors min-h-[2rem]">
            {product.name}
          </h3>

          {/* ── Rating Row ── */}
          {rating > 0 && (
            <div className="flex items-center gap-1 my-0.5 select-none flex-wrap">
              <span className="text-[11px] font-bold text-gray-900 leading-none">
                {rating.toFixed(1)}
              </span>
              <div className="flex items-center text-amber-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-3 h-3 ${star <= Math.round(rating)
                        ? "fill-amber-500 text-amber-500"
                        : "fill-gray-200 text-gray-200"
                      }`}
                  />
                ))}
              </div>
              <ChevronDown className="w-2.5 h-2.5 text-gray-500 stroke-[2.5]" />
              <span className="text-[10px] sm:text-[11px] text-[#007185] hover:text-[#C7511F] font-normal">
                ({formattedReviewCount})
              </span>
            </div>
          )}

          {/* Pricing Row */}
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <span className="font-bold text-xs sm:text-sm text-[#C53030]">
              {formattedSp}
            </span>
            {hasDiscount && (
              <span className="line-through text-[10px] sm:text-xs text-gray-400 font-normal">
                {formattedMrp}
              </span>
            )}
            {hasDiscount && discountPct > 0 && (
              <span className="bg-[#0c2340] text-white text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow-2xs">
                {discountPct}% OFF
              </span>
            )}
          </div>
        </div>

        {/* ── 3. Useful Product Metadata Section (Strictly 2 Lines) ── */}
        {!hideMetadata && (
          <div className="flex pt-1.5 border-t border-gray-200/60 flex-col gap-1 mt-auto">
            {/* Row 1: Quality Assured & Options Tag (Single line, no wrap) */}
            <div className="flex items-center justify-between gap-1 text-xs flex-nowrap w-full">
              <span className="inline-flex items-center gap-1 bg-blue-50 text-[#007FFF] text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded border border-blue-100 flex-shrink-0">
                <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#007FFF]" /> Quality Assured
              </span>

              {/* Variant count badge if multi-variant */}
              {variantCount > 1 && (
                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold text-gray-700 bg-white px-1.5 py-0.5 rounded border border-gray-200 shadow-2xs flex-shrink-0">
                  <Layers className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-400" />
                  {variantCount} Options
                </span>
              )}
            </div>

            {/* Row 2: Stock / Express Shipping Status Tag */}
            <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-medium text-gray-600 truncate">
              {stock > 0 ? (
                <span className="flex items-center gap-1 text-emerald-700 font-medium truncate">
                  <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-600 flex-shrink-0" /> In Stock & ready to ship
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600 font-medium truncate">
                  <Truck className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" /> Express Delivery Available
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
