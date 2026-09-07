"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Search,
    Loader2,
    ShieldCheck,
    Truck,
    RotateCcw,
    CreditCard,
    ArrowRight,
    Building2,
    Sparkles,
    CheckCircle2,
    X,
} from "lucide-react";
import { fetchBrands } from "../../../../utils/brand";
import { getBrandSlug } from "../../../../utils/slugUtils";
import { Brand } from "@/common/interface";
import { getImageUrl } from "../../../../utils/imageUtils";

// Helper to strip HTML tags for clean card description preview
function stripHtml(html: string | undefined | null): string {
    if (!html) return "";
    return html.replace(/<[^>]*>?/gm, "").trim();
}

export default function BrandsPage() {
    const router = useRouter();
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeSort, setActiveSort] = useState<"all" | "az" | "za">("all");

    useEffect(() => {
        const loadBrands = async () => {
            try {
                setLoading(true);
                const data = await fetchBrands();
                const list: Brand[] = Array.isArray(data)
                    ? data
                    : data?.data?.brands || data?.brands || [];
                const activeBrands = list.filter((brand: Brand) => brand.status);
                setBrands(activeBrands);
            } catch (err) {
                console.error("Error fetching brands:", err);
            } finally {
                setLoading(false);
            }
        };

        loadBrands();
    }, []);

    // Filter and sort brands
    const processedBrands = useMemo(() => {
        let result = brands.filter((brand) => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                brand.name?.toLowerCase().includes(q) ||
                brand.description?.toLowerCase().includes(q)
            );
        });

        if (activeSort === "az") {
            result = [...result].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        } else if (activeSort === "za") {
            result = [...result].sort((a, b) => (b.name || "").localeCompare(a.name || ""));
        }

        return result;
    }, [brands, searchQuery, activeSort]);

    return (
        <div className="min-h-screen bg-[#FAF9F6]/70 pb-20">
            {/* Header & Hero Showcase */}
            <header className="relative bg-white border-b border-gray-100 overflow-hidden">
                {/* Subtle blue ambient gradient glow */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-50/50 rounded-full blur-2xl pointer-events-none -ml-20 -mb-20" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-1">
                    {/* Navigation Row */}
                    <div className="flex items-center justify-between gap-4 mb-6">
                        <button
                            onClick={() => router.back()}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-blue-50 text-gray-700 hover:text-[#007FFF] border border-gray-200 shadow-xs text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer"
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Back</span>
                        </button>

                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#007FFF] border border-blue-100">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Official Stores</span>
                            </span>
                        </div>
                    </div>

                    {/* Title & Subtitle */}
                    <div className="max-w-3xl">
                        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-gray-900 tracking-tight leading-tight">
                            Explore <span className="text-[#007FFF]">Official Brands</span>
                        </h1>
                        <p className="mt-2.5 text-sm sm:text-base text-gray-600 leading-relaxed">
                            Discover authentic products directly from certified manufacturer stores. Enjoy full warranty coverage, brand guarantees, and premium quality.
                        </p>
                    </div>

                    {/* Search & Quick Controls Bar */}
                    <div className="mt-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pt-4 border-t border-gray-100">
                        {/* Search Input */}
                        <div className="relative w-full md:max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by brand name or keyword..."
                                className="w-full pl-11 pr-10 py-3 bg-gray-50/80 hover:bg-gray-50 focus:bg-white border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition-all shadow-xs"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition"
                                    title="Clear search"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Sort & Count Pills */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500 mr-1 hidden sm:inline">Sort:</span>
                            <button
                                onClick={() => setActiveSort("all")}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeSort === "all"
                                    ? "bg-[#007FFF] text-white shadow-xs"
                                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                                    }`}
                            >
                                Default
                            </button>
                            <button
                                onClick={() => setActiveSort("az")}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeSort === "az"
                                    ? "bg-[#007FFF] text-white shadow-xs"
                                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                                    }`}
                            >
                                A &rarr; Z
                            </button>
                            <button
                                onClick={() => setActiveSort("za")}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeSort === "za"
                                    ? "bg-[#007FFF] text-white shadow-xs"
                                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                                    }`}
                            >
                                Z &rarr; A
                            </button>

                            {!loading && (
                                <div className="ml-auto md:ml-2 px-3 py-1.5 rounded-xl bg-blue-50 text-[#007FFF] text-xs font-bold border border-blue-100">
                                    {processedBrands.length} {processedBrands.length === 1 ? "Brand" : "Brands"}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Brands Grid Section */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10">
                {loading ? (
                    /* Skeletons */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div
                                key={i}
                                className="bg-white rounded-2xl sm:rounded-3xl p-0 overflow-hidden border border-gray-100 shadow-sm animate-pulse flex flex-col"
                            >
                                <div className="h-44 bg-gray-200 w-full relative">
                                    <div className="absolute -bottom-6 left-6 w-14 h-14 rounded-2xl bg-gray-300 border-4 border-white shadow" />
                                </div>
                                <div className="p-6 pt-9 flex-1 flex flex-col justify-between">
                                    <div>
                                        <div className="h-5 bg-gray-200 rounded-md w-3/4 mb-3" />
                                        <div className="h-3.5 bg-gray-100 rounded-md w-full mb-1.5" />
                                        <div className="h-3.5 bg-gray-100 rounded-md w-2/3" />
                                    </div>
                                    <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                                        <div className="h-4 bg-gray-200 rounded w-24" />
                                        <div className="h-8 w-8 rounded-xl bg-gray-100" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : processedBrands.length === 0 ? (
                    /* Empty State */
                    <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm text-center py-16 px-6 max-w-lg mx-auto mt-6">
                        <div className="w-16 h-16 bg-blue-50 text-[#007FFF] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                            <Building2 className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-1">
                            No Brands Found
                        </h2>
                        <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
                            {searchQuery
                                ? `No brands matched your search for "${searchQuery}". Please try another keyword.`
                                : "There are currently no active brands listed."}
                        </p>
                        {searchQuery ? (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="px-6 py-2.5 bg-[#007FFF] hover:bg-[#0066CC] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition active:scale-95 cursor-pointer"
                            >
                                Clear Search
                            </button>
                        ) : (
                            <button
                                onClick={() => router.push("/")}
                                className="px-6 py-2.5 bg-[#007FFF] hover:bg-[#0066CC] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition active:scale-95 cursor-pointer"
                            >
                                Return to Store Home
                            </button>
                        )}
                    </div>
                ) : (
                    /* Brands Card Grid */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {processedBrands.map((brand) => {
                            const bannerUrl = getImageUrl(brand.image1);
                            const logoUrl = getImageUrl(brand.image2 || brand.image3);
                            const plainDescription = stripHtml(brand.description);

                            return (
                                <div
                                    key={brand.id}
                                    onClick={() => router.push(`/brands/${getBrandSlug(brand)}`)}
                                    className="group relative bg-white rounded-2xl sm:rounded-3xl overflow-hidden border border-gray-200/80 hover:border-blue-300 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer flex flex-col select-none"
                                >
                                    {/* Cover Banner Area */}
                                    <div className="relative h-44 w-full bg-gradient-to-br from-blue-50 to-indigo-50/50 overflow-hidden">
                                        {bannerUrl ? (
                                            <img
                                                src={bannerUrl}
                                                alt={brand.name}
                                                className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                                                loading="lazy"
                                            />
                                        ) : (
                                            /* Brand Banner Fallback Pattern */
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-[#007FFF]/10 via-blue-50 to-indigo-100/30">
                                                <Building2 className="w-12 h-12 text-[#007FFF]/30" />
                                            </div>
                                        )}

                                        {/* Subtle Dark Gradient Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent opacity-40 group-hover:opacity-60 transition-opacity duration-300" />

                                        {/* Top-Right Badge: Official Store */}
                                        <div className="absolute top-3 right-3 z-2">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/90 backdrop-blur-md text-gray-800 shadow-xs border border-white/60">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-[#007FFF]" />
                                                <span>Official</span>
                                            </span>
                                        </div>

                                        {/* Floating Logo Badge */}
                                        <div className="absolute -bottom-6 left-5 z-3">
                                            <div className="w-14 h-14 rounded-2xl bg-white p-1 shadow-md border-2 border-white overflow-hidden flex items-center justify-center group-hover:shadow-lg group-hover:scale-105 transition-all duration-300">
                                                {logoUrl ? (
                                                    <img
                                                        src={logoUrl}
                                                        alt={`${brand.name} logo`}
                                                        className="w-full h-full object-contain rounded-xl"
                                                        loading="lazy"
                                                    />
                                                ) : bannerUrl ? (
                                                    /* If banner exists, use a clean brand initial */
                                                    <div className="w-full h-full bg-gradient-to-br from-[#007FFF] to-[#0055CC] rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-xs">
                                                        {brand.name?.charAt(0).toUpperCase() || "B"}
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-full bg-blue-50 text-[#007FFF] rounded-xl flex items-center justify-center font-black text-xl">
                                                        {brand.name?.charAt(0).toUpperCase() || "B"}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Content */}
                                    <div className="p-5 pt-8 flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                <h3 className="text-base sm:text-lg font-extrabold text-gray-900 group-hover:text-[#007FFF] transition-colors line-clamp-1">
                                                    {brand.name}
                                                </h3>
                                            </div>

                                            {plainDescription ? (
                                                <p className="text-xs sm:text-sm text-gray-500 line-clamp-2 leading-relaxed font-normal">
                                                    {plainDescription}
                                                </p>
                                            ) : (
                                                <p className="text-xs sm:text-sm text-gray-400 italic">
                                                    Explore genuine {brand.name} products and exclusive deals.
                                                </p>
                                            )}
                                        </div>

                                        {/* Bottom Action Row */}
                                        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                                            <span className="text-xs font-bold text-[#007FFF] flex items-center gap-1.5 group-hover:text-[#0055CC] transition-colors">
                                                <span>Visit Store</span>
                                                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                            </span>

                                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#007FFF] group-hover:bg-[#007FFF] group-hover:text-white flex items-center justify-center transition-all duration-300 shadow-2xs">
                                                <ArrowRight className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* E-Commerce Trust Badges Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 sm:mt-20">
                <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm p-6 sm:p-8 lg:p-10">
                    <div className="text-center max-w-xl mx-auto mb-8">
                        <h2 className="text-lg sm:text-2xl font-bold text-gray-900">
                            Why Shop From Official Brands On Zelton?
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">
                            Direct partnerships ensure authentic quality, prompt after-sales support, and secure shopping.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Feature 1 */}
                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/70 border border-gray-100 hover:bg-blue-50/40 hover:border-blue-100 transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#007FFF] flex items-center justify-center flex-shrink-0">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">100% Genuine</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Authentic products straight from certified brands.</p>
                            </div>
                        </div>

                        {/* Feature 2 */}
                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/70 border border-gray-100 hover:bg-blue-50/40 hover:border-blue-100 transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#007FFF] flex items-center justify-center flex-shrink-0">
                                <Truck className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Express Delivery</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Fast & tracked logistics right to your doorstep.</p>
                            </div>
                        </div>

                        {/* Feature 3 */}
                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/70 border border-gray-100 hover:bg-blue-50/40 hover:border-blue-100 transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#007FFF] flex items-center justify-center flex-shrink-0">
                                <RotateCcw className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Easy Returns</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Hassle-free 7-day replacement & return policy.</p>
                            </div>
                        </div>

                        {/* Feature 4 */}
                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/70 border border-gray-100 hover:bg-blue-50/40 hover:border-blue-100 transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#007FFF] flex items-center justify-center flex-shrink-0">
                                <CreditCard className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Secure Payments</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Encrypted transactions via Cards, UPI, and Netbanking.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
