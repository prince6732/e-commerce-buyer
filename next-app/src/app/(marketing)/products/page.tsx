"use client";

import React, { Suspense } from "react";
import ProductsPage from "./ProductsPageContent";

export default function ProductsWrapper() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
                <div className="container mx-auto px-4 py-16">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-blue-200 border-t-[#007FFF] rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading products...</p>
                    </div>
                </div>
            </div>}>
            <ProductsPage />
        </Suspense>
    );
}
