"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import axios from "../../../../../../utils/axios";
import {
    ChevronLeft,
    ChevronRight,
    ChevronUp
} from "lucide-react";
import ProductShow from "@/components/ProductShow";

type SubCategory = {
    id: number;
    name: string;
    description?: string;
    secondary_image: string | null;
    link: string | null;
    image: string | null;
    slug?: string;
};

const imageUrl = `${process.env.NEXT_PUBLIC_UPLOAD_BASE}`;

export default function SubCategoriesPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const parentIdOrSlug = (params?.slug || params?.id || "") as string;
    const preselectedSub = searchParams ? searchParams.get('sub') : null;
    const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
    const [parentName, setParentName] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [selectedSubcategory, setSelectedSubcategory] = useState<number | null>(null);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const [isDragging, setIsDragging] = useState(false);
    const dragStartXRef = useRef(0);
    const dragStartScrollLeftRef = useRef(0);
    const dragDistanceRef = useRef(0);

    // Track scroll position to show/hide scroll-to-top button
    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 500) {
                setShowScrollTop(true);
            } else {
                setShowScrollTop(false);
            }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };

    // Non-passive wheel listener: STOPS main screen/page scroll completely and slides subcategories horizontally
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const handleWheel = (e: WheelEvent) => {
            const delta = e.deltaY || e.deltaX;
            if (delta !== 0) {
                e.preventDefault(); // STOP main window/screen vertical scroll!
                el.scrollLeft += delta * 1.2;
            }
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            el.removeEventListener('wheel', handleWheel);
        };
    }, [subcategories]);

    // Mouse left-click drag handlers
    const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        dragStartXRef.current = e.pageX - scrollRef.current.offsetLeft;
        dragStartScrollLeftRef.current = scrollRef.current.scrollLeft;
        dragDistanceRef.current = 0;
    };

    const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - dragStartXRef.current) * 1.5;
        dragDistanceRef.current = Math.abs(x - dragStartXRef.current);
        scrollRef.current.scrollLeft = dragStartScrollLeftRef.current - walk;
    };

    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const dist = touchStart - touchEnd;
        if (dist > 45) {
            scroll("right");
        } else if (dist < -45) {
            scroll("left");
        }
    };

    const onMouseUp = () => {
        setIsDragging(false);
    };

    const scroll = (direction: "left" | "right") => {
        const scrollAmount = 300;
        if (scrollRef.current) {
            scrollRef.current.scrollBy({
                left: direction === "left" ? -scrollAmount : scrollAmount,
                behavior: "smooth",
            });
        }
    };

    const fetchSubCategories = async () => {
        try {
            const res = await axios.get(`/api/subcategories-by-parent`, {
                params: { parent_id: parentIdOrSlug },
            });

            if (res.data.res === "success") {
                const subs = res.data.subcategories || [];
                setParentName(res.data.parent_category || "Essentials");
                setSubcategories(subs);
                if (subs.length > 0) {
                    let initial = subs[0].id;
                    if (preselectedSub) {
                        const matched = subs.find((s: SubCategory) =>
                            String(s.id) === String(preselectedSub) ||
                            (s as any).slug === preselectedSub ||
                            s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === preselectedSub.toLowerCase()
                        );
                        if (matched) initial = matched.id;
                    }
                    setSelectedSubcategory(initial);
                }
            } else {
                console.warn("Unexpected API response:", res.data);
            }
        } catch (error) {
            console.error("Failed to fetch subcategories:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (parentIdOrSlug) fetchSubCategories();
    }, [parentIdOrSlug]);

    const handleSubcategoryClick = (subcategoryId: number, e?: React.MouseEvent) => {
        if (dragDistanceRef.current > 5) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            return;
        }
        setSelectedSubcategory(subcategoryId);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
                <div className="container mx-auto px-4 py-16">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-blue-200 border-t-[#007FFF] rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading subcategories...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!subcategories.length) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
                <div className="container mx-auto px-4 py-16">
                    <div className="text-center">
                        <div className="w-24 h-24 text-gray-400 mx-auto mb-6">
                            <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">{parentName}</h2>
                        <h3 className="text-xl font-semibold text-gray-700 mb-4">No Subcategories Found</h3>
                        <p className="text-gray-600 mb-8">This category doesn't have any subcategories available at the moment</p>
                        <button
                            onClick={() => window.history.back()}
                            style={{ backgroundColor: 'var(--theme-blue)', color: '#FFFAFB' }}
                            className="px-8 py-3 font-semibold rounded-full hover:bg-[#0066CC] hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const pastelBgs = [
        'bg-[#FFF0F3]', 'bg-[#FFF5EC]', 'bg-[#F2F4F7]', 'bg-[#EEFBF6]',
        'bg-[#FFFBEA]', 'bg-[#F0F7FF]', 'bg-[#F7F0FF]', 'bg-[#FFF5F5]',
        'bg-[#F2FAF4]', 'bg-[#FAF5FF]', 'bg-[#FFF9F0]', 'bg-[#F0F9FF]'
    ];

    return (
        <>
            <section className="py-6 container mx-auto relative px-4 md:px-10">
                {/* Header: COLLECTIONS LIST title (Centered) */}
                <div className="flex justify-center items-center mb-6">
                    <h1 className="text-xl md:text-3xl font-serif font-bold tracking-widest text-[#0A0908] uppercase flex items-center gap-1.5">
                        <span>COLLECTIONS</span>
                        <span className="text-xs md:text-sm font-sans font-bold text-red-500 border-2 border-red-500 rounded-full px-2 py-0.5 tracking-tight not-italic inline-block transform -rotate-3">
                            LIST
                        </span>
                    </h1>
                </div>

                {/* Subcategories Carousel Section (Unified Circular Slider for Mobile & Desktop) */}
                <div className="relative my-4 group/subslider">
                    <div className="flex items-center justify-center gap-1 sm:gap-2 relative">
                        {subcategories.length > 4 && (
                            <button
                                onClick={() => scroll("left")}
                                className="hidden md:flex flex-shrink-0 w-8 h-8 lg:w-10 lg:h-10 items-center justify-center bg-white hover:bg-gray-50 shadow-md rounded-full transition-all duration-200 hover:scale-110 border border-gray-200 z-10 opacity-0 invisible group-hover/subslider:opacity-100 group-hover/subslider:visible"
                                aria-label="Scroll left"
                            >
                                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-800" />
                            </button>
                        )}

                        <div
                            ref={scrollRef}
                            onMouseDown={onMouseDown}
                            onMouseMove={onMouseMove}
                            onMouseUp={onMouseUp}
                            onMouseLeave={onMouseUp}
                            onTouchStart={onTouchStart}
                            onTouchMove={onTouchMove}
                            onTouchEnd={onTouchEnd}
                            className={`flex gap-3 sm:gap-6 md:gap-8 lg:gap-10 overflow-x-auto scrollbar-hide pb-2 items-start select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'
                                }`}
                            style={{
                                scrollbarWidth: 'none',
                                msOverflowStyle: 'none',
                            }}
                        >
                            {subcategories.map((sub, idx) => {
                                const isSelected = selectedSubcategory === sub.id;
                                const bgColor = pastelBgs[idx % pastelBgs.length];
                                return (
                                    <div
                                        key={sub.id}
                                        onClick={(e) => handleSubcategoryClick(sub.id, e)}
                                        className="flex-shrink-0 snap-start group cursor-pointer transition-all duration-300 flex flex-col items-center w-[68px] sm:w-[85px] md:w-[100px] select-none"
                                    >
                                        <div
                                            className={`p-0.5 rounded-full border-2 transition-all duration-300 group-hover:scale-105 ${isSelected
                                                ? 'border-[#007FFF] ring-2 ring-[#007FFF]/20 scale-105 shadow-md'
                                                : 'border-gray-200 group-hover:border-[#007FFF] shadow-xs'
                                                }`}
                                        >
                                            <div className={`w-13 h-13 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full overflow-hidden flex items-center justify-center p-2 transition-colors ${bgColor}`}>
                                                <img
                                                    src={sub.image ? `${imageUrl}${sub.image}` : "/placeholder-image.jpg"}
                                                    alt={sub.name}
                                                    className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110"
                                                />
                                            </div>
                                        </div>
                                        <span className={`mt-1.5 text-[10px] sm:text-xs font-semibold text-center leading-tight line-clamp-2 capitalize transition-colors px-0.5 ${isSelected ? 'text-[#007FFF] font-bold' : 'text-gray-700 group-hover:text-[#007FFF]'
                                            }`}>
                                            {sub.name}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {subcategories.length > 4 && (
                            <button
                                onClick={() => scroll("right")}
                                className="hidden md:flex flex-shrink-0 w-8 h-8 lg:w-10 lg:h-10 items-center justify-center bg-white hover:bg-gray-50 shadow-md rounded-full transition-all duration-200 hover:scale-110 border border-gray-200 z-10 opacity-0 invisible group-hover/subslider:opacity-100 group-hover/subslider:visible"
                                aria-label="Scroll right"
                            >
                                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-800" />
                            </button>
                        )}
                    </div>
                </div>
            </section>

            {/* Automatically show selected subcategory's products */}
            {selectedSubcategory && (
                <div className="container mx-auto mt-4 mb-16 px-4">
                    <ProductShow
                        subcategoryId={selectedSubcategory}
                        subcategoryName={subcategories.find(sub => sub.id === selectedSubcategory)?.name || parentName}
                    />
                </div>
            )}

            {/* Centered Scroll To Top Button (Icon only in Grey Theme) */}
            <button
                type="button"
                onClick={scrollToTop}
                aria-label="Scroll to top"
                className={`fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-40 p-3 sm:p-3.5 rounded-full bg-gray-800/90 hover:bg-gray-900 text-white shadow-lg hover:shadow-2xl backdrop-blur-md border border-gray-700/50 transition-all duration-300 transform active:scale-90 flex items-center justify-center group select-none ${showScrollTop ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-8 pointer-events-none'
                    }`}
                title="Back to Top"
            >
                <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-200 group-hover:-translate-y-1" />
            </button>
        </>
    );
}
