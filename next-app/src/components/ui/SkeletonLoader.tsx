import React from "react";

export function OrderCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs animate-pulse space-y-4">
      <div className="flex justify-between items-center pb-3 border-b border-gray-100">
        <div className="space-y-1.5">
          <div className="w-24 h-3 bg-gray-200 rounded" />
          <div className="w-32 h-4 bg-gray-200 rounded" />
        </div>
        <div className="w-20 h-6 bg-gray-200 rounded-full" />
      </div>
      <div className="flex gap-4 items-center">
        <div className="w-16 h-16 bg-gray-200 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="w-3/4 h-4 bg-gray-200 rounded" />
          <div className="w-1/3 h-3 bg-gray-200 rounded" />
        </div>
        <div className="w-16 h-4 bg-gray-200 rounded" />
      </div>
      <div className="pt-3 border-t border-gray-100 flex justify-between">
        <div className="flex gap-2">
          <div className="w-24 h-8 bg-gray-200 rounded-xl" />
          <div className="w-20 h-8 bg-gray-200 rounded-xl" />
        </div>
        <div className="w-20 h-8 bg-gray-200 rounded-xl" />
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-2xs animate-pulse space-y-3">
      <div className="aspect-square bg-gray-200 rounded-xl" />
      <div className="space-y-2">
        <div className="w-3/4 h-4 bg-gray-200 rounded" />
        <div className="w-1/2 h-3 bg-gray-200 rounded" />
        <div className="w-1/3 h-4 bg-gray-200 rounded" />
      </div>
    </div>
  );
}
