"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RiArrowLeftLine } from "react-icons/ri";
import axios from "../../../../utils/axios";
import { getCategorySlug } from "../../../../utils/slugUtils";
import { getImageUrl } from "../../../../utils/imageUtils";

type Category = {
    id: number;
    name: string;
    description?: string;
    secondary_image: string | null;
    link: string | null;
    image: string | null;
};

const PASTEL_BACKGROUNDS = [
    "bg-[#FBF5F2] hover:bg-[#F5ECE7] border-[#F0E6E0]",
    "bg-[#FFF8EE] hover:bg-[#FFF0DC] border-[#F7EBD8]",
    "bg-[#F2F5F8] hover:bg-[#E7ECF1] border-[#E3E8ED]",
    "bg-[#F0F8F4] hover:bg-[#E2F2E9] border-[#DFEEE5]",
    "bg-[#FFF2F5] hover:bg-[#FFE5EC] border-[#F9DFE6]",
    "bg-[#F6F3FB] hover:bg-[#ECE6F7] border-[#E6DEF1]",
    "bg-[#FAF7F2] hover:bg-[#EFE9E0] border-[#E9E2D7]",
    "bg-[#F1F7F9] hover:bg-[#E3EFF3] border-[#DEEAEF]",
    "bg-[#FFF7F0] hover:bg-[#FFECD9] border-[#F5DFCD]",
    "bg-[#F3FAF5] hover:bg-[#E3F4E8] border-[#DFEFE3]",
    "bg-[#FAF4F8] hover:bg-[#F3E6EF] border-[#ECE0E8]",
    "bg-[#F4F6FA] hover:bg-[#E7EBF3] border-[#E2E6EE]",
];

export default function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await axios.get(`/api/categories-with-products`);
                if (Array.isArray(res.data)) {
                    setCategories(res.data);
                } else if (res.data.success && Array.isArray(res.data.data)) {
                    setCategories(res.data.data);
                } else if (Array.isArray(res.data?.categories)) {
                    setCategories(res.data.categories);
                }
            } catch (e) {
                console.error("Failed to fetch categories", e);
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
    }, []);

    return (
        <div className="min-h-screen bg-[#FAF9F6]/60 pb-20">
            {/* Header Section */}
            <section className="py-6 sm:py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="relative flex items-center justify-center">
                        {/* Back Button */}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2">
                            <button
                                onClick={() => router.back()}
                                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-white hover:bg-gray-100 text-gray-700 rounded-full text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer border border-gray-200/60 shadow-xs"
                                aria-label="Go back"
                            >
                                <RiArrowLeftLine className="text-base sm:text-lg" />
                                <span className="hidden sm:inline">Back</span>
                            </button>
                        </div>

                        {/* Centered Title */}
                        <div className="text-center">
                            <h1 className="text-xl sm:text-3xl md:text-4xl font-serif font-black tracking-widest text-[#0A0908] uppercase flex items-center justify-center gap-2">
                                <span>Shop By Category</span>
                            </h1>
                            {!loading && (
                                <p className="text-xs sm:text-sm text-gray-500 mt-1 font-medium tracking-wide">
                                    Explore all {categories.length} curated categories
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Categories Grid Section */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 md:pt-4">
                {loading ? (
                    /* Skeletons */
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div
                                key={i}
                                className="rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center bg-white border border-gray-100 shadow-2xs animate-pulse min-h-[160px] sm:min-h-[190px] md:min-h-[220px]"
                            >
                                <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-xl bg-gray-200 mb-3" />
                                <div className="w-20 sm:w-24 h-3.5 bg-gray-200 rounded-full" />
                            </div>
                        ))}
                    </div>
                ) : categories.length === 0 ? (
                    /* Empty State */
                    <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm max-w-md mx-auto p-8">
                        <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 mb-1">No Categories Found</h2>
                        <p className="text-xs sm:text-sm text-gray-500 mb-6">
                            Categories will appear here once added in the dashboard.
                        </p>
                        <button
                            onClick={() => router.push("/")}
                            className="px-6 py-2.5 bg-[#007FFF] hover:bg-[#0066CC] text-white text-xs sm:text-sm font-bold rounded-xl shadow transition active:scale-95 cursor-pointer"
                        >
                            Return to Home
                        </button>
                    </div>
                ) : (
                    /* Categories Box Grid */
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                        {categories.map((cat, idx) => {
                            const pastelTheme = PASTEL_BACKGROUNDS[idx % PASTEL_BACKGROUNDS.length];
                            const imgSrc = getImageUrl(cat.image);

                            return (
                                <div
                                    key={cat.id}
                                    onClick={() => router.push(`/categories/subcategories/${getCategorySlug(cat)}`)}
                                    className={`group rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 flex flex-col items-center justify-between border transition-all duration-300 shadow-2xs hover:shadow-lg hover:-translate-y-1 cursor-pointer select-none min-h-[160px] sm:min-h-[190px] md:min-h-[220px] ${pastelTheme}`}
                                >
                                    {/* Image Box */}
                                    <div className="w-full flex-1 flex items-center justify-center py-1 sm:py-2">
                                        <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 relative flex items-center justify-center">
                                            {imgSrc ? (
                                                <img
                                                    src={imgSrc}
                                                    alt={cat.name}
                                                    className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110 drop-shadow-xs"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/60 flex items-center justify-center text-gray-400">
                                                    <span className="text-xl font-bold">{cat.name.charAt(0)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <div className="w-full text-center mt-2 sm:mt-3">
                                        <h2 className="text-xs sm:text-sm md:text-[15px] font-semibold text-gray-800 group-hover:text-black line-clamp-2 leading-snug tracking-tight transition-colors">
                                            {cat.name}
                                        </h2>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
