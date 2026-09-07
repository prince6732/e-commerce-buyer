"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
    Star,
    Search,
    X,
    ChevronDown,
    ChevronUp,
    Loader2,
    Check
} from "lucide-react";
import imgPlaceholder from "@/public/imagePlaceholder.png";
import axiosInstance from "../../../../../../utils/axios";
import {
    Review,
    ReviewSummary,
    getProductReviews,
    createReview,
    updateReview,
    deleteReview,
    toggleReviewHelpful,
    getUserProductReview,
    CreateReviewData,
    UpdateReviewData,
} from "../../../../../../utils/reviewApi";
import { getProductSlug } from "../../../../../../utils/slugUtils";
import ReviewCard from "@/components/reviews/ReviewCard";
import ReviewForm from "@/components/reviews/ReviewForm";
import Modal from "@/components/(sheared)/Modal";
import { useAuth } from "@/context/AuthContext";

type SortOption = "helpful" | "newest" | "highest" | "lowest" | "oldest";
type ReviewerFilter = "all" | "verified";
type StarFilter = "all" | "5" | "4" | "3" | "2" | "1" | "positive" | "critical";
type MediaFilter = "all" | "media" | "text";

interface ProductSnippet {
    id: number;
    name: string;
    image_url: string | null;
    brand?: { name: string } | null;
    category?: { name: string } | null;
    sp?: number;
    mrp?: number;
    discount?: number;
    variants?: any[];
}

export default function ProductReviewsPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, openAuthModal } = useAuth();

    const productId = (params?.slug || params?.id || "") as string;
    const baseUrl = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";

    const initialRatingParam = searchParams.get("rating");
    const initialMediaParam = searchParams.get("media");

    const [product, setProduct] = useState<ProductSnippet | null>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [summary, setSummary] = useState<ReviewSummary>({
        total_reviews: 0,
        average_rating: 0,
        rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
    const [userReview, setUserReview] = useState<Review | null>(null);

    const [loading, setLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [totalMatchingReviews, setTotalMatchingReviews] = useState(0);

    // Filters & Sorting state (Amazon Dropdowns)
    const [sortBy, setSortBy] = useState<SortOption>("helpful");
    const [reviewerFilter, setReviewerFilter] = useState<ReviewerFilter>("all");
    const [starFilter, setStarFilter] = useState<StarFilter>(
        initialRatingParam ? (initialRatingParam as StarFilter) : "all"
    );
    const [mediaFilter, setMediaFilter] = useState<MediaFilter>(
        initialMediaParam ? "media" : "all"
    );
    const [searchInputValue, setSearchInputValue] = useState("");
    const [appliedSearch, setAppliedSearch] = useState("");
    const [showCalcInfo, setShowCalcInfo] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 400) {
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

    // Modals
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [editingReview, setEditingReview] = useState<Review | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [reviewToDelete, setReviewToDelete] = useState<Review | null>(null);

    const isFetchingRef = useRef(false);
    const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

    // ─── Fetch product snippet ────────────────────────────────────────────────
    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const res = await axiosInstance.get(`/api/get-product/${productId}`);
                if (res.data.res === "success") {
                    const p = res.data.product;
                    const variants = p.variants || [];
                    const activeVars = variants.filter((v: any) => v.status);
                    const bestVar = activeVars[0] || variants[0];
                    const sp = bestVar ? Number(bestVar.sp) : undefined;
                    const mrp = bestVar ? Number(bestVar.mrp) : undefined;
                    const discount = sp && mrp && mrp > sp ? Math.round(((mrp - sp) / mrp) * 100) : 0;

                    setProduct({
                        id: p.id,
                        name: p.name,
                        image_url: p.image_url ? (p.image_url.startsWith('http') ? p.image_url : `${baseUrl}${p.image_url}`) : null,
                        brand: p.brand ?? null,
                        category: p.category ?? null,
                        sp,
                        mrp,
                        discount,
                        variants: activeVars,
                    });
                }
            } catch {
                // Non-critical
            }
        };
        fetchProduct();
    }, [productId, baseUrl]);

    // ─── Fetch reviews ────────────────────────────────────────────────────────
    const fetchReviews = useCallback(
        async (page = 1, isAppend = false) => {
            if (isFetchingRef.current) return;
            isFetchingRef.current = true;

            if (isAppend) {
                setIsLoadingMore(true);
            } else {
                setLoading(true);
            }

            try {
                let ratingQuery: number | undefined = undefined;
                if (starFilter === "5" || starFilter === "4" || starFilter === "3" || starFilter === "2" || starFilter === "1") {
                    ratingQuery = parseInt(starFilter);
                }

                const res = await getProductReviews(productId, {
                    page,
                    per_page: 10,
                    sort_by: sortBy,
                    rating: ratingQuery,
                    search: appliedSearch || undefined,
                    verified_only: reviewerFilter === "verified" ? true : undefined,
                    media_only: mediaFilter === "media" ? true : undefined,
                    text_only: mediaFilter === "text" ? true : undefined,
                });

                let list = res?.reviews?.data || [];

                // Client-side fallback filter for positive/critical ratings
                if (starFilter === "positive") {
                    list = list.filter((r) => r.rating >= 4);
                } else if (starFilter === "critical") {
                    list = list.filter((r) => r.rating <= 3);
                }

                const pag = res?.reviews;
                const total = pag?.total ?? list.length;
                const lastPage = pag?.last_page || 1;
                const hasNext = page < lastPage;

                setTotalMatchingReviews(total);
                setSummary(res.summary);
                setCurrentPage(page);
                setHasMore(hasNext);

                if (isAppend) {
                    setReviews((prev) => {
                        const existingIds = new Set(prev.map((r) => r.id));
                        const newUnique = list.filter((r) => !existingIds.has(r.id));
                        return [...prev, ...newUnique];
                    });
                } else {
                    setReviews(list);
                }
            } catch (err) {
                console.error("Failed to fetch reviews:", err);
                if (!isAppend) setReviews([]);
                setHasMore(false);
            } finally {
                isFetchingRef.current = false;
                setLoading(false);
                setIsLoadingMore(false);
            }
        },
        [productId, sortBy, reviewerFilter, starFilter, mediaFilter, appliedSearch]
    );

    // Initial and filtered fetch
    useEffect(() => {
        setCurrentPage(1);
        setHasMore(true);
        fetchReviews(1, false);
    }, [fetchReviews]);

    // Infinite scroll load more
    const loadNextPage = useCallback(() => {
        if (!hasMore || loading || isLoadingMore || isFetchingRef.current) return;
        fetchReviews(currentPage + 1, true);
    }, [hasMore, loading, isLoadingMore, currentPage, fetchReviews]);

    // Observer for Bottom Sentinel
    useEffect(() => {
        const sentinel = bottomSentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadNextPage();
                }
            },
            { rootMargin: "300px", threshold: 0.1 }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [loadNextPage]);

    // ─── Fetch user's own review ──────────────────────────────────────────────
    useEffect(() => {
        if (!user) { setUserReview(null); return; }
        getUserProductReview(productId)
            .then((r) => setUserReview(r.review ?? null))
            .catch(() => setUserReview(null));
    }, [productId, user]);

    // ─── Handlers ────────────────────────────────────────────────────────────
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setAppliedSearch(searchInputValue.trim());
    };

    const handleClearSearch = () => {
        setSearchInputValue("");
        setAppliedSearch("");
    };

    const handleFormSubmit = async (data: CreateReviewData | UpdateReviewData) => {
        if (editingReview) {
            const res = await updateReview(editingReview.id, data as UpdateReviewData);
            setUserReview(res.review ?? null);
        } else {
            const res = await createReview(data as CreateReviewData);
            setUserReview(res.review ?? null);
        }
        setShowReviewForm(false);
        setEditingReview(null);
        fetchReviews(1, false);
    };

    const handleEditReview = (review: Review) => {
        setEditingReview(review);
        setShowReviewForm(true);
    };

    const handleDeleteClick = (reviewId: number) => {
        const r = reviews.find((x) => x.id === reviewId) ?? userReview ?? null;
        setReviewToDelete(r);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!reviewToDelete) return;
        await deleteReview(reviewToDelete.id);
        setUserReview(null);
        setReviewToDelete(null);
        setShowDeleteModal(false);
        fetchReviews(1, false);
    };

    const handleToggleHelpful = (reviewId: number) => toggleReviewHelpful(reviewId);

    const getStarPercentage = (star: number) => {
        if (!summary.total_reviews || summary.total_reviews === 0) return 0;
        const count = summary.rating_distribution?.[star] || 0;
        return Math.round((count / summary.total_reviews) * 100);
    };

    const averageRating = summary.average_rating > 0 ? summary.average_rating : (summary.total_reviews > 0 ? 4.2 : 0);

    return (
        <div className="min-h-screen bg-white text-[#0F1111] pb-20">

            {/* ── 1. Top Breadcrumb & Product Link ── */}
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-3 pb-2">
                <div className="flex items-center gap-1.5 text-xs text-[#565959] truncate">
                    <Link
                        href={`/products/${product ? getProductSlug(product) : productId}`}
                        className="text-[#565959] hover:text-[#007185] hover:underline truncate max-w-[500px] lg:max-w-[850px]"
                    >
                        {product?.name || `Product #${productId}`}
                    </Link>
                    <span>›</span>
                    <span className="text-[#C45500] font-medium whitespace-nowrap">Customer reviews</span>
                </div>
            </div>

            {/* ── 2. Amazon Head Section (Matching Reference Image Exactly) ── */}
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
                <div className="flex flex-col lg:flex-row items-start justify-between gap-8 lg:gap-12">

                    {/* Left: Customer Reviews Breakdown + Write a Review Pill Button */}
                    <div className="flex-shrink-0 w-full lg:w-auto">
                        <h1 className="text-xl font-bold text-[#0F1111] mb-1">
                            Customer reviews
                        </h1>

                        <div className="flex items-center gap-2 mb-0.5">
                            <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                        key={s}
                                        className={`w-4 h-4 ${s <= Math.round(averageRating)
                                                ? "fill-[#DE7921] text-[#DE7921]"
                                                : "fill-gray-200 text-gray-300"
                                            }`}
                                    />
                                ))}
                            </div>
                            <span className="text-sm font-bold text-[#0F1111]">
                                {averageRating > 0 ? averageRating.toFixed(1) : "0.0"} out of 5
                            </span>
                        </div>

                        <p className="text-xs text-[#565959] mb-3">
                            {summary.total_reviews} global ratings
                        </p>

                        {/* Breakdown Bars with Write a Review button right beside the 1-star row */}
                        <div className="space-y-2">
                            {[5, 4, 3, 2, 1].map((star) => {
                                const pct = getStarPercentage(star);
                                const isSelected = starFilter === String(star);

                                return (
                                    <div key={star} className="flex items-center gap-3">
                                        <div
                                            onClick={() => setStarFilter(isSelected ? "all" : (String(star) as StarFilter))}
                                            className="flex items-center gap-2 text-xs group cursor-pointer"
                                        >
                                            <span className={`min-w-[34px] text-xs whitespace-nowrap ${isSelected ? "font-bold text-[#DE7921]" : "text-[#007185] group-hover:text-[#C7511F] group-hover:underline"
                                                }`}>
                                                {star} star
                                            </span>

                                            <div className="w-28 sm:w-36 h-4 bg-[#F0F2F2] rounded-sm overflow-hidden border border-gray-200">
                                                <div
                                                    className="h-full bg-[#FFA41C] border-r border-[#DE7921] transition-all duration-300"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>

                                            <span className={`min-w-[28px] text-right text-xs ${isSelected ? "font-bold text-[#DE7921]" : "text-[#007185] group-hover:text-[#C7511F] group-hover:underline"
                                                }`}>
                                                {pct}%
                                            </span>
                                        </div>

                                        {/* Write a review button positioned right next to 1-star row */}
                                        {star === 1 && (
                                            <div className="ml-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!user) { openAuthModal("login"); return; }
                                                        if (userReview) {
                                                            handleEditReview(userReview);
                                                        } else {
                                                            setEditingReview(null);
                                                            setShowReviewForm(true);
                                                        }
                                                    }}
                                                    className="px-4 py-1 rounded-full border border-[#D5D9D9] hover:bg-[#F7FAFA] text-xs text-[#0F1111] font-normal shadow-xs transition cursor-pointer whitespace-nowrap"
                                                >
                                                    {userReview ? "Edit review" : "Write a review"}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* How are ratings calculated */}
                        <div className="mt-3">
                            <button
                                type="button"
                                onClick={() => setShowCalcInfo(!showCalcInfo)}
                                className="inline-flex items-center gap-1 text-xs text-[#007185] hover:text-[#C7511F] hover:underline cursor-pointer"
                            >
                                <span>How are ratings calculated?</span>
                                <ChevronDown className={`w-3 h-3 transition-transform ${showCalcInfo ? "rotate-180" : ""}`} />
                            </button>

                            {showCalcInfo && (
                                <div className="mt-2 p-3 bg-[#F7FAFA] border border-[#D5D9D9] rounded text-xs text-[#565959] leading-relaxed shadow-sm max-w-xs">
                                    To calculate the overall star rating and percentage breakdown by star, we don’t use a simple average. Instead, our system considers things like how recent a review is and if the reviewer bought the item on our store. It also analyses reviews to verify trustworthiness.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Middle: Product Thumbnail & Title + Brand + Variants */}
                    <div className="flex-1 min-w-0 flex items-start gap-4">
                        {/* Thumbnail Image */}
                        <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-white">
                            <Image
                                src={product?.image_url || imgPlaceholder.src}
                                alt={product?.name || "Product"}
                                fill
                                unoptimized
                                className="object-contain"
                            />
                        </div>

                        {/* Title & Metadata */}
                        <div className="min-w-0 space-y-1">
                            <Link
                                href={`/products/${product ? getProductSlug(product) : productId}`}
                                className="text-base sm:text-lg font-normal text-[#007185] hover:text-[#C7511F] hover:underline leading-snug line-clamp-2 block"
                            >
                                {product?.name || "Loading product..."}
                            </Link>

                            {product?.brand && (
                                <p className="text-xs text-[#565959]">
                                    by <Link href={`/products/${product ? getProductSlug(product) : productId}`} className="text-[#007185] hover:underline">{product.brand.name}</Link>
                                </p>
                            )}

                            {/* Size & Colour Variant Info */}
                            <div className="flex items-center gap-2 text-xs text-[#565959] pt-1 flex-wrap">
                                <span>Size: <span className="text-[#0F1111] font-medium">{product?.variants?.[0]?.attribute_values?.find((a: any) => a.attribute?.name?.toLowerCase().includes('size') || a.attribute_id === 1)?.value || '6 UK'}</span></span>
                                <span>|</span>
                                <span>Colour: <span className="text-[#0F1111] font-medium">{product?.variants?.[0]?.attribute_values?.find((a: any) => a.attribute?.name?.toLowerCase().includes('color') || a.attribute?.name?.toLowerCase().includes('colour') || a.attribute_id === 2)?.value || 'White-Grey'}</span></span>
                                <span>|</span>
                                <Link href={`/products/${product ? getProductSlug(product) : productId}`} className="text-[#007185] hover:text-[#C7511F] hover:underline">
                                    Change
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Right: See All Buying Options in subtle container box */}
                    <div className="w-full lg:w-auto flex-shrink-0 flex justify-end">
                        <div className="w-full sm:w-auto border border-gray-200 rounded-lg p-3 sm:p-4 bg-white shadow-xs flex items-center justify-center">
                            <button
                                onClick={() => router.push(`/products/${productId}`)}
                                className="w-full sm:w-auto px-8 py-2 rounded-full bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] text-xs sm:text-sm font-normal border border-[#FCD200] shadow-xs transition whitespace-nowrap cursor-pointer"
                            >
                                See All Buying Options
                            </button>
                        </div>
                    </div>

                </div>
            </div>

            {/* ── 3. Search Bar Section (Amazon Search Customer Reviews) ── */}
            <div className="max-w-[1300px] mx-auto px-4 sm:px-6 py-4 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <form onSubmit={handleSearchSubmit} className="flex items-center flex-1 max-w-lg">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchInputValue}
                                onChange={(e) => setSearchInputValue(e.target.value)}
                                placeholder="Search customer reviews"
                                className="w-full pl-9 pr-8 py-2 rounded-l-md border border-r-0 border-gray-300 text-sm focus:outline-none focus:border-[#007185]"
                            />
                            {searchInputValue && (
                                <button
                                    type="button"
                                    onClick={handleClearSearch}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <button
                            type="submit"
                            className="px-5 py-2 rounded-r-md bg-[#232F3E] hover:bg-[#131921] text-white text-xs sm:text-sm font-medium transition cursor-pointer"
                        >
                            Search
                        </button>
                    </form>

                    <Link
                        href="/contact-us"
                        className="text-xs sm:text-sm text-[#007185] hover:text-[#C7511F] hover:underline"
                    >
                        Need customer service?
                    </Link>
                </div>
            </div>

            {/* ── 4. Amazon Filter & Sort Controls Bar ── */}
            <div className="max-w-[1300px] mx-auto px-4 sm:px-6 py-4 border-b border-gray-200">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs sm:text-sm">

                    {/* Sort By Dropdown */}
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-[#565959] uppercase tracking-wider text-[11px]">SORT BY</span>
                        <div className="relative">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortOption)}
                                className="appearance-none bg-[#F0F2F2] border border-[#D5D9D9] hover:bg-[#E3E6E6] text-[#0F1111] py-1.5 pl-3 pr-8 rounded-[8px] text-xs sm:text-sm font-normal cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#007185] shadow-[0_2px_5px_rgba(213,217,217,0.5)]"
                            >
                                <option value="helpful">Top reviews</option>
                                <option value="newest">Most recent</option>
                                <option value="highest">Highest rating</option>
                                <option value="lowest">Lowest rating</option>
                                <option value="oldest">Oldest first</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>

                    {/* Filter By Dropdowns */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-bold text-[#565959] uppercase tracking-wider text-[11px]">FILTER BY</span>

                        {/* All Reviewers / Verified Only */}
                        <div className="relative">
                            <select
                                value={reviewerFilter}
                                onChange={(e) => setReviewerFilter(e.target.value as ReviewerFilter)}
                                className="appearance-none bg-[#F0F2F2] border border-[#D5D9D9] hover:bg-[#E3E6E6] text-[#0F1111] py-1.5 pl-3 pr-8 rounded-[8px] text-xs sm:text-sm font-normal cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#007185] shadow-[0_2px_5px_rgba(213,217,217,0.5)]"
                            >
                                <option value="all">All reviewers</option>
                                <option value="verified">Verified purchase only</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        {/* All Stars */}
                        <div className="relative">
                            <select
                                value={starFilter}
                                onChange={(e) => setStarFilter(e.target.value as StarFilter)}
                                className="appearance-none bg-[#F0F2F2] border border-[#D5D9D9] hover:bg-[#E3E6E6] text-[#0F1111] py-1.5 pl-3 pr-8 rounded-[8px] text-xs sm:text-sm font-normal cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#007185] shadow-[0_2px_5px_rgba(213,217,217,0.5)]"
                            >
                                <option value="all">All stars</option>
                                <option value="5">5 star only</option>
                                <option value="4">4 star only</option>
                                <option value="3">3 star only</option>
                                <option value="2">2 star only</option>
                                <option value="1">1 star only</option>
                                <option value="positive">All positive (4-5 stars)</option>
                                <option value="critical">All critical (1-3 stars)</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        {/* Media Type */}
                        <div className="relative">
                            <select
                                value={mediaFilter}
                                onChange={(e) => setMediaFilter(e.target.value as MediaFilter)}
                                className="appearance-none bg-[#F0F2F2] border border-[#D5D9D9] hover:bg-[#E3E6E6] text-[#0F1111] py-1.5 pl-3 pr-8 rounded-[8px] text-xs sm:text-sm font-normal cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#007185] shadow-[0_2px_5px_rgba(213,217,217,0.5)]"
                            >
                                <option value="all">All text, image and video reviews</option>
                                <option value="media">Image &amp; video reviews only</option>
                                <option value="text">Text only</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>

                </div>

                {/* Total customer reviews count line */}
                <div className="mt-3 text-xs sm:text-sm text-[#565959]">
                    {totalMatchingReviews} customer review{totalMatchingReviews !== 1 ? "s" : ""}
                    {appliedSearch && ` matching "${appliedSearch}"`}
                </div>
            </div>

            {/* ── 5. Full Reviews Feed ("From India") ── */}
            <div className="max-w-[1300px] mx-auto px-4 sm:px-6 py-6">
                <h2 className="text-base sm:text-lg font-bold text-[#0F1111] mb-3">
                    From India
                </h2>

                {/* Reviews List */}
                {loading && reviews.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-[#007185]" />
                        <span className="text-sm text-[#565959]">Loading reviews...</span>
                    </div>
                ) : reviews.length === 0 ? (
                    <div className="py-16 text-center border border-gray-200 rounded-lg p-6 bg-gray-50/50">
                        <p className="text-base font-semibold text-[#0F1111] mb-1">
                            No customer reviews match your filters
                        </p>
                        <p className="text-xs sm:text-sm text-[#565959] mb-4">
                            Try resetting your filters or search keywords.
                        </p>
                        <button
                            onClick={() => {
                                setStarFilter("all");
                                setReviewerFilter("all");
                                setMediaFilter("all");
                                setAppliedSearch("");
                                setSearchInputValue("");
                            }}
                            className="px-4 py-1.5 bg-white border border-[#D5D9D9] hover:bg-[#F7FAFA] rounded-md text-xs sm:text-sm font-medium shadow-xs"
                        >
                            Reset all filters
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {reviews.map((review) => {
                            const isOwner = !!user?.id && (
                                Number(review.user_id) === Number(user.id) ||
                                Number((review as any).userId) === Number(user.id) ||
                                Number(review.user?.id) === Number(user.id)
                            );
                            return (
                                <ReviewCard
                                    key={review.id}
                                    review={review}
                                    currentUserId={user?.id}
                                    onEdit={isOwner ? handleEditReview : undefined}
                                    onDelete={isOwner ? handleDeleteClick : undefined}
                                    onToggleHelpful={!isOwner ? handleToggleHelpful : undefined}
                                />
                            );
                        })}
                    </div>
                )}

                {/* Bottom Sentinel for Infinite Scroll */}
                <div ref={bottomSentinelRef} className="h-8 w-full pointer-events-none" />

                {/* Loading more spinner */}
                {isLoadingMore && (
                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#565959]">
                        <Loader2 className="w-5 h-5 animate-spin text-[#007185]" />
                        <span>Loading more reviews...</span>
                    </div>
                )}

                {/* End of reviews indicator */}
                {!hasMore && reviews.length > 0 && !loading && (
                    <div className="flex items-center justify-center py-6 text-xs sm:text-sm text-[#565959] font-medium">
                        <span className="bg-gray-100 px-4 py-1.5 rounded-full text-[#0F1111] flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>All {totalMatchingReviews} reviews loaded</span>
                        </span>
                    </div>
                )}
            </div>

            {/* ── Review Form Modal ── */}
            {showReviewForm && (
                <Modal
                    isOpen={showReviewForm}
                    title={editingReview ? "Edit Your Review" : "Write a Customer Review"}
                    onClose={() => { setShowReviewForm(false); setEditingReview(null); }}
                >
                    <ReviewForm
                        productId={productId}
                        initialData={editingReview ? {
                            rating: editingReview.rating,
                            title: editingReview.title || '',
                            review_text: editingReview.review_text || (editingReview as any).reviewText || '',
                            images: editingReview.images ?? undefined,
                        } : undefined}
                        isEditing={!!editingReview}
                        onSubmit={handleFormSubmit}
                        onCancel={() => { setShowReviewForm(false); setEditingReview(null); }}
                    />
                </Modal>
            )}

            {/* ── Delete Confirmation Modal ── */}
            <Modal
                isOpen={showDeleteModal}
                title="Delete Review"
                onClose={() => { setShowDeleteModal(false); setReviewToDelete(null); }}
            >
                <div className="p-4 space-y-4">
                    <p className="text-sm text-[#0F1111]">
                        Are you sure you want to delete your review? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={() => { setShowDeleteModal(false); setReviewToDelete(null); }}
                            className="px-4 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDelete}
                            className="px-5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium"
                        >
                            Delete Review
                        </button>
                    </div>
                </div>
            </Modal>

            {/* ── Centered Floating Scroll To Top Button ── */}
            <button
                type="button"
                onClick={scrollToTop}
                aria-label="Scroll to top"
                className={`fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-40 p-3 sm:p-3.5 rounded-full bg-[#232F3E]/90 hover:bg-[#131921] text-white shadow-lg hover:shadow-2xl backdrop-blur-md border border-gray-700/50 transition-all duration-300 transform active:scale-90 flex items-center justify-center group select-none cursor-pointer ${showScrollTop ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-8 pointer-events-none'
                    }`}
                title="Back to top"
            >
                <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-200 group-hover:-translate-y-1" />
            </button>

        </div>
    );
}
