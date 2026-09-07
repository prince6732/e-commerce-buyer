import React from "react";

export default function ProductDetailsSkeleton() {
  return (
    <div className="w-full bg-white min-h-screen animate-pulse">
      {/* ── Breadcrumb Skeleton ── */}
      <div className="bg-gray-50/70 border-b border-gray-100 py-3">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-2.5">
          <div className="w-12 h-3.5 bg-gray-200 rounded" />
          <div className="w-2.5 h-3 bg-gray-200 rounded" />
          <div className="w-16 h-3.5 bg-gray-200 rounded" />
          <div className="w-2.5 h-3 bg-gray-200 rounded" />
          <div className="w-28 h-3.5 bg-gray-200 rounded" />
          <div className="w-2.5 h-3 bg-gray-200 rounded" />
          <div className="w-36 h-3.5 bg-gray-200 rounded hidden sm:block" />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          MOBILE SKELETON (visible only below lg)
      ══════════════════════════════════════════════════════ */}
      <div className="lg:hidden bg-gray-100/50">
        {/* Top Location Strip Skeleton */}
        <div className="bg-[#232f3e] px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-gray-600 rounded-full" />
            <div className="w-48 h-3 bg-gray-600 rounded" />
          </div>
          <div className="w-3 h-3 bg-gray-600 rounded" />
        </div>

        {/* Brand Header & Title Skeleton */}
        <div className="px-4 pt-3.5 pb-3 bg-white border-b border-gray-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0" />
              <div className="space-y-1">
                <div className="w-20 h-3 bg-gray-200 rounded" />
                <div className="w-16 h-2.5 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="w-24 h-4 bg-gray-200 rounded" />
          </div>
          <div className="w-4/5 h-4 bg-gray-200 rounded" />
          <div className="w-2/3 h-4 bg-gray-200 rounded" />
          <div className="w-28 h-3 bg-gray-200 rounded" />
        </div>

        {/* Main Image Carousel Skeleton */}
        <div className="w-full aspect-[4/5] sm:aspect-square bg-gray-100 border-b border-gray-100 relative flex items-center justify-center">
          <div className="w-32 h-32 bg-gray-200/80 rounded-2xl" />
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gray-300" />
            <div className="w-2 h-2 rounded-full bg-gray-300" />
            <div className="w-2 h-2 rounded-full bg-gray-300" />
          </div>
        </div>

        {/* Price Box Skeleton */}
        <div className="px-4 py-3 bg-white border-b border-gray-100 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-12 h-5 bg-red-100 rounded" />
            <div className="w-28 h-7 bg-gray-200 rounded" />
            <div className="w-20 h-4 bg-gray-200 rounded" />
          </div>
          <div className="w-36 h-3 bg-gray-200 rounded" />
        </div>

        {/* Offers Strip Skeleton */}
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <div className="flex gap-2.5 overflow-x-hidden">
            <div className="w-44 h-16 bg-gray-100 rounded-lg flex-shrink-0" />
            <div className="w-44 h-16 bg-gray-100 rounded-lg flex-shrink-0" />
          </div>
        </div>

        {/* Total & Action Buttons Skeleton */}
        <div className="px-4 py-4 bg-white border-b border-gray-100 space-y-3">
          <div className="w-32 h-4 bg-gray-200 rounded" />
          <div className="w-44 h-3 bg-gray-200 rounded" />
          <div className="w-20 h-4 bg-gray-200 rounded" />
          <div className="w-full h-11 bg-amber-100 rounded-full" />
          <div className="w-full h-11 bg-orange-100 rounded-full" />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          DESKTOP SKELETON (visible only on lg+)
      ══════════════════════════════════════════════════════ */}
      <div className="hidden lg:block">
        <div className="w-full max-w-[1720px] mx-auto px-6 xl:px-8 py-8">
          <div className="flex gap-8 xl:gap-12 items-start">
            {/* ── LEFT: Sticky Image Column Skeleton ── */}
            <div className="w-[420px] xl:w-[480px] 2xl:w-[520px] flex-shrink-0 flex gap-3.5">
              {/* Vertical thumbnails */}
              <div className="flex flex-col gap-2.5 w-[68px] flex-shrink-0">
                <div className="w-[68px] h-[68px] bg-gray-200 rounded-lg" />
                <div className="w-[68px] h-[68px] bg-gray-200 rounded-lg" />
                <div className="w-[68px] h-[68px] bg-gray-200 rounded-lg" />
                <div className="w-[68px] h-[68px] bg-gray-200 rounded-lg" />
              </div>

              {/* Large Main Image Preview */}
              <div className="flex-1 aspect-square bg-gray-100 rounded-2xl border border-gray-200 flex items-center justify-center p-8">
                <div className="w-48 h-48 bg-gray-200/70 rounded-2xl" />
              </div>
            </div>

            {/* ── CENTER: Product Details Skeleton ── */}
            <div className="flex-1 min-w-0 space-y-5">
              {/* Brand & Store */}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-200" />
                <div className="w-28 h-3.5 bg-gray-200 rounded" />
              </div>

              {/* Title & Rating */}
              <div className="space-y-2">
                <div className="w-11/12 h-6 bg-gray-200 rounded" />
                <div className="w-3/4 h-6 bg-gray-200 rounded" />
                <div className="flex items-center gap-2 pt-1">
                  <div className="w-28 h-4 bg-gray-200 rounded" />
                  <div className="w-16 h-4 bg-gray-200 rounded" />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* Price block */}
              <div className="space-y-1.5">
                <div className="flex items-baseline gap-3">
                  <div className="w-14 h-6 bg-red-100 rounded" />
                  <div className="w-36 h-9 bg-gray-200 rounded" />
                  <div className="w-24 h-4 bg-gray-200 rounded" />
                </div>
                <div className="w-32 h-3.5 bg-gray-200 rounded" />
              </div>

              {/* Offers strip */}
              <div className="flex gap-3 pt-2">
                <div className="w-48 h-20 bg-gray-100 rounded-xl border border-gray-200/80 p-3 space-y-2">
                  <div className="w-28 h-3 bg-gray-200 rounded" />
                  <div className="w-36 h-2.5 bg-gray-200 rounded" />
                </div>
                <div className="w-48 h-20 bg-gray-100 rounded-xl border border-gray-200/80 p-3 space-y-2">
                  <div className="w-28 h-3 bg-gray-200 rounded" />
                  <div className="w-36 h-2.5 bg-gray-200 rounded" />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* Variant Selector Skeleton */}
              <div className="space-y-3">
                <div className="w-20 h-4 bg-gray-200 rounded" />
                <div className="flex gap-2">
                  <div className="w-16 h-9 bg-gray-200 rounded-lg" />
                  <div className="w-16 h-9 bg-gray-200 rounded-lg" />
                  <div className="w-16 h-9 bg-gray-200 rounded-lg" />
                </div>
              </div>

              {/* Quantity & CTA buttons */}
              <div className="pt-2 flex items-center gap-4">
                <div className="w-28 h-11 bg-gray-200 rounded-xl" />
                <div className="w-44 h-11 bg-amber-100 rounded-full" />
                <div className="w-44 h-11 bg-orange-100 rounded-full" />
              </div>

              {/* Features and Specs Table Skeleton */}
              <div className="pt-6 border-t border-gray-100 space-y-3">
                <div className="w-36 h-5 bg-gray-200 rounded" />
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <div className="w-32 h-3.5 bg-gray-200 rounded" />
                    <div className="w-48 h-3.5 bg-gray-200 rounded" />
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <div className="w-28 h-3.5 bg-gray-200 rounded" />
                    <div className="w-56 h-3.5 bg-gray-200 rounded" />
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <div className="w-36 h-3.5 bg-gray-200 rounded" />
                    <div className="w-40 h-3.5 bg-gray-200 rounded" />
                  </div>
                </div>
              </div>
            </div>

            {/* ── RIGHT: Trust & Delivery Box Skeleton ── */}
            <div className="w-[300px] xl:w-[340px] flex-shrink-0 bg-gray-50/80 rounded-2xl border border-gray-200 p-5 space-y-4">
              <div className="w-28 h-4 bg-gray-200 rounded" />
              <div className="w-full h-10 bg-gray-200 rounded-xl" />
              <div className="space-y-2 pt-2">
                <div className="w-4/5 h-3 bg-gray-200 rounded" />
                <div className="w-3/5 h-3 bg-gray-200 rounded" />
              </div>
              <div className="border-t border-gray-200 pt-3 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-gray-200 rounded-full" />
                  <div className="w-36 h-3 bg-gray-200 rounded" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-gray-200 rounded-full" />
                  <div className="w-32 h-3 bg-gray-200 rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
