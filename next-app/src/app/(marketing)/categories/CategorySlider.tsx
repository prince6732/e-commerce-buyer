"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "../../../../utils/axios";
import { getCategorySlug } from "../../../../utils/slugUtils";
import imgPlaceholder from "@/public/imagePlaceholder.png";

type Category = {
    id: number;
    name: string;
    description?: string;
    secondary_image: string | null;
    link: string | null;
    image: string | null;
};

const imageUrl = `${process.env.NEXT_PUBLIC_UPLOAD_BASE}`;

export default function CategorySlider() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const router = useRouter();

    // Mouse drag-to-scroll state
    const isDraggingRef = useRef(false);
    const dragStartXRef = useRef(0);
    const dragScrollLeftRef = useRef(0);
    const hasDraggedRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);

    const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = scrollContainerRef.current;
        if (!el) return;
        isDraggingRef.current = true;
        hasDraggedRef.current = false;
        dragStartXRef.current = e.pageX - el.offsetLeft;
        dragScrollLeftRef.current = el.scrollLeft;
        setIsDragging(true);
    };

    const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return;
        e.preventDefault();
        const el = scrollContainerRef.current;
        if (!el) return;
        const x = e.pageX - el.offsetLeft;
        const walk = (x - dragStartXRef.current) * 1.5;
        if (Math.abs(x - dragStartXRef.current) > 5) {
            hasDraggedRef.current = true;
        }
        el.scrollLeft = dragScrollLeftRef.current - walk;
    };

    const onMouseUp = () => {
        isDraggingRef.current = false;
        setIsDragging(false);
    };

    const onMouseLeave = () => {
        if (isDraggingRef.current) {
            isDraggingRef.current = false;
            setIsDragging(false);
        }
    };

    // Mobile touch handlers for swipe
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            scroll('right');
        } else if (isRightSwipe) {
            scroll('left');
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await axios.get(`/api/categories-with-products`);
            if (Array.isArray(res.data)) {
                setCategories(res.data);
            } else if (res.data.success && Array.isArray(res.data.data)) {
                setCategories(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch categories", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const onDetail = (category: Category) => {
        router.push(`/categories/subcategories/${getCategorySlug(category)}`);
    };

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = 300;
            scrollContainerRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    const onWheel = (e: React.WheelEvent) => {
        if (scrollContainerRef.current && e.deltaY !== 0) {
            scrollContainerRef.current.scrollLeft += e.deltaY;
        }
    };

    return (
        <section className="my-3 sm:my-4 py-2">
            <div className="w-full max-w-[1536px] mx-auto px-4 sm:px-6">
                {loading ? (
                    <div className="relative">
                        {/* Loading Skeleton - Horizontal Scroll */}
                        <div className="overflow-hidden">
                            <div className="flex gap-4 sm:gap-6 md:gap-8 items-center justify-start md:justify-center">
                                {Array.from({ length: 6 }).map((_, index) => (
                                    <div key={index} className="flex-shrink-0 flex flex-col items-center">
                                        <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full bg-gray-200 animate-pulse border-2 border-gray-300 shadow-sm" />
                                        <div className="mt-2 w-16 sm:w-20 h-3 bg-gray-200 rounded animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="relative group/catslider">
                        {/* Horizontal Scroll Slider for All Screen Sizes (Mobile + Desktop) */}
                        <div className="flex items-center gap-1 sm:gap-2">
                            {/* Left Navigation Button - Desktop on hover */}
                            {categories.length >= 11 && (
                                <button
                                    onClick={() => scroll('left')}
                                    className="hidden md:flex flex-shrink-0 w-8 h-8 lg:w-10 lg:h-10 items-center justify-center bg-white/95 hover:bg-white shadow-md rounded-full transition-all duration-200 hover:scale-110 border border-gray-200 opacity-0 invisible group-hover/catslider:opacity-100 group-hover/catslider:visible z-10"
                                    aria-label="Scroll left"
                                >
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            )}

                            {/* Scrollable Container */}
                            <div
                                ref={scrollContainerRef}
                                onMouseDown={onMouseDown}
                                onMouseMove={onMouseMove}
                                onMouseUp={onMouseUp}
                                onMouseLeave={onMouseLeave}
                                onWheel={onWheel}
                                onTouchStart={onTouchStart}
                                onTouchMove={onTouchMove}
                                onTouchEnd={onTouchEnd}
                                className={`flex gap-3.5 sm:gap-6 md:gap-8 lg:gap-10 overflow-x-auto scrollbar-hide pb-2 pt-1 items-start select-none flex-1 ${categories.length < 11 ? 'justify-center' : 'justify-start'
                                    } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'
                                    }`}
                                style={{
                                    scrollbarWidth: 'none',
                                    msOverflowStyle: 'none',
                                }}
                            >
                                {categories.map((cat) => (
                                    <div
                                        key={cat.id}
                                        onClick={() => { if (!hasDraggedRef.current) onDetail(cat); }}
                                        className="flex-shrink-0 snap-start group cursor-pointer transition-all duration-300 flex flex-col items-center w-[68px] sm:w-[82px] md:w-[95px]"
                                    >
                                        {/* Uniform Grey Border Outer Wrapper */}
                                        <div className="p-0.5 rounded-full border-2 border-gray-300 group-hover:border-[#007FFF] shadow-xs group-hover:shadow-md transition-all duration-300 group-hover:scale-105 bg-white">
                                            <div className="w-13 h-13 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-full overflow-hidden bg-white flex items-center justify-center p-1.5">
                                                <img
                                                    src={
                                                        cat.image
                                                            ? `${imageUrl}${cat.image}`
                                                            : imgPlaceholder.src
                                                    }
                                                    alt={cat.name}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = imgPlaceholder.src;
                                                    }}
                                                    className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110"
                                                />
                                            </div>
                                        </div>
                                        {/* Category Name under Circle */}
                                        <span className="mt-1.5 text-[10px] sm:text-xs font-semibold text-[#0A0908] text-center group-hover:text-[#007FFF] transition-colors leading-tight line-clamp-2 capitalize px-0.5">
                                            {cat.name}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Right Navigation Button - Desktop on hover */}
                            {categories.length >= 11 && (
                                <button
                                    onClick={() => scroll('right')}
                                    className="hidden md:flex flex-shrink-0 w-8 h-8 lg:w-10 lg:h-10 items-center justify-center bg-white/95 hover:bg-white shadow-md rounded-full transition-all duration-200 hover:scale-110 border border-gray-200 opacity-0 invisible group-hover/catslider:opacity-100 group-hover/catslider:visible z-10"
                                    aria-label="Scroll right"
                                >
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Empty State */}
                        {categories.length === 0 && (
                            <div className="text-center py-8">
                                <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-2">
                                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                    </svg>
                                </div>
                                <h3 className="text-sm font-semibold text-gray-900 mb-1">No Categories Found</h3>
                                <p className="text-xs text-gray-600">Categories will appear here once they are added.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </section>
    );
}