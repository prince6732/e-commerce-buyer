"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { fetchNewArrivalSliders, fetchNewArrivalProducts, NewArrivalSlider } from "../../../../utils/newArrivalApi";
import ProductCard from "@/components/(frontend)/ProductCard";
import { getProductSlug } from "../../../../utils/slugUtils";
import { useProductSync, ProductEventData } from "@/context/ProductSyncContext";

const baseUrl = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";
const PAGE_SIZE = 10;

export default function NewArrivalsPage() {
  const router = useRouter();

  // Slider state
  const [sliders, setSliders] = useState<NewArrivalSlider[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slidersLoading, setSlidersLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const autoplayRef = useRef<NodeJS.Timeout | null>(null);
  const [bannerTouchStart, setBannerTouchStart] = useState<number | null>(null);
  const [bannerTouchEnd, setBannerTouchEnd] = useState<number | null>(null);

  // Products pagination state
  const [products, setProducts] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isFetchingRef = useRef(false);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

  // Fetch Sliders on Mount
  useEffect(() => {
    fetchNewArrivalSliders()
      .then((data) => {
        const active = (data || []).filter(
          (s: any) =>
            s.status === true ||
            String(s.status) === "1" ||
            String(s.status) === "true"
        );
        setSliders(active);
      })
      .catch((err) => console.error("Failed to load new arrival sliders:", err))
      .finally(() => setSlidersLoading(false));
  }, []);

  // Fetch Products (Initial & Pagination)
  const loadProducts = async (pageNum: number = 1, isAppend: boolean = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isAppend) {
      setIsLoadingMore(true);
    } else {
      setIsLoadingInitial(true);
    }

    try {
      const res = await fetchNewArrivalProducts({
        page: pageNum,
        limit: PAGE_SIZE,
        per_page: PAGE_SIZE,
        paginate: true,
      });

      let list: any[] = [];
      let total = 0;
      let hasNext = false;

      if (res && res.data && Array.isArray(res.data)) {
        list = res.data;
        total = res.total ?? list.length;
        hasNext = Boolean(
          res.has_next_page ??
          res.hasNextPage ??
          res.has_more ??
          (res.last_page ? pageNum < res.last_page : list.length >= PAGE_SIZE)
        );
      } else if (Array.isArray(res)) {
        list = res;
        total = list.length;
        hasNext = false;
      }

      setHasNextPage(hasNext);
      setPage(pageNum);

      if (isAppend) {
        setProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newUnique = list.filter((p) => !existingIds.has(p.id));
          return [...prev, ...newUnique];
        });
      } else {
        setProducts(list);
      }
    } catch (err) {
      console.error("Failed to load new arrival products:", err);
      if (!isAppend) setProducts([]);
      setHasNextPage(false);
    } finally {
      isFetchingRef.current = false;
      setIsLoadingInitial(false);
      setIsLoadingMore(false);
    }
  };

  const { subscribeToAll } = useProductSync();

  useEffect(() => {
    const unsubscribe = subscribeToAll((event: ProductEventData) => {
      const updatedProd = event.product;
      const pid = event.productId || (updatedProd?.id ? Number(updatedProd.id) : undefined);
      if (!pid) return;

      if (event.action === "deleted" || (event.action === "status_changed" && event.status === false)) {
        setProducts((prev) => prev.filter((p) => Number(p.id) !== pid));
      } else if (event.action === "updated" && updatedProd) {
        if (updatedProd.is_new_arrival === false) {
          setProducts((prev) => prev.filter((p) => Number(p.id) !== pid));
        } else {
          setProducts((prev) =>
            prev.map((p) => {
              if (Number(p.id) !== pid) return p;
              return {
                ...p,
                ...updatedProd,
                name: updatedProd.name ?? p.name,
                image_url: updatedProd.image_url ?? p.image_url,
              };
            })
          );
        }
      } else if (event.action === "created" && updatedProd?.is_new_arrival) {
        setProducts((prev) => [updatedProd, ...prev]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [subscribeToAll]);

  // Initial Load
  useEffect(() => {
    loadProducts(1, false);
  }, []);

  // Next Page Load
  const loadNextPage = useCallback(() => {
    if (!hasNextPage || isLoadingMore || isLoadingInitial || isFetchingRef.current) return;
    loadProducts(page + 1, true);
  }, [hasNextPage, isLoadingMore, isLoadingInitial, page]);

  // Observer for Bottom Sentinel
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting) {
          loadNextPage();
        }
      },
      {
        root: null,
        rootMargin: "300px",
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadNextPage]);

  // Slider Autoplay (No dots/arrows)
  const startAutoplay = useCallback(() => {
    if (autoplayRef.current) clearInterval(autoplayRef.current);
    autoplayRef.current = setInterval(() => {
      if (!isPaused) {
        setCurrentSlide((p) => (p + 1) % (sliders.length || 1));
      }
    }, 5500);
  }, [sliders.length, isPaused]);

  useEffect(() => {
    if (sliders.length < 2) return;
    startAutoplay();
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [sliders.length, startAutoplay]);

  const prevSlide = () =>
    setCurrentSlide((curr) => (curr === 0 ? sliders.length - 1 : curr - 1));
  const nextSlide = () =>
    setCurrentSlide((curr) => (curr + 1) % (sliders.length || 1));

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-gray-900 pb-16">
      {/* ── Edge-to-Edge Full-Width Banner Slider ── */}
      {slidersLoading ? (
        <div className="w-full aspect-[1791/563] bg-gray-200 animate-pulse mb-6 sm:mb-8" />
      ) : sliders.length > 0 ? (
        <div
          className="relative w-full aspect-[1791/563] overflow-hidden mb-6 sm:mb-8 group select-none bg-gray-100"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={(e) => {
            setBannerTouchEnd(null);
            setBannerTouchStart(e.targetTouches[0].clientX);
          }}
          onTouchMove={(e) => {
            setBannerTouchEnd(e.targetTouches[0].clientX);
          }}
          onTouchEnd={() => {
            if (!bannerTouchStart || !bannerTouchEnd) return;
            const dist = bannerTouchStart - bannerTouchEnd;
            if (dist > 45) {
              nextSlide();
            } else if (dist < -45) {
              prevSlide();
            }
          }}
        >
          {sliders.map((slide, idx) => {
            const isClickable = !!slide.link;
            const targetVal =
              slide.open_in_new_tab === true ||
                String(slide.open_in_new_tab) === "1" ||
                String(slide.open_in_new_tab) === "true"
                ? "_blank"
                : "_self";
            const isCurrent = idx === currentSlide;

            return (
              <div
                key={slide.id}
                className={`w-full h-full transition-opacity duration-500 ease-in-out ${isCurrent
                  ? "relative z-10 opacity-100 pointer-events-auto visible"
                  : "absolute top-0 left-0 right-0 bottom-0 z-0 opacity-0 pointer-events-none invisible"
                  }`}
              >
                {isClickable ? (
                  <a
                    href={slide.link}
                    target={targetVal}
                    rel="noopener noreferrer"
                    className="block w-full h-full cursor-pointer"
                  >
                    <img
                      src={`${baseUrl}${slide.image}`}
                      alt={slide.title || "New Arrival Banner"}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                      className="w-full h-full object-cover select-none"
                    />
                  </a>
                ) : (
                  <div className="w-full h-full">
                    <img
                      src={`${baseUrl}${slide.image}`}
                      alt={slide.title || "New Arrival Banner"}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                      className="w-full h-full object-cover select-none"
                    />
                  </div>
                )}
                {(slide.title || slide.description) && (
                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none">
                    {slide.title && (
                      <p className="text-white text-base sm:text-xl font-bold drop-shadow">
                        {slide.title}
                      </p>
                    )}
                    {slide.description && (
                      <p className="text-white/85 text-xs sm:text-sm mt-0.5 drop-shadow">
                        {slide.description}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="w-full max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── Section Header ── */}
        <div className="text-center my-6 sm:my-8 md:my-10">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-black tracking-widest text-[#0A0908] uppercase">
            New Arrivals
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1.5">
            Trending products loved by customers
          </p>
        </div>

        {/* ── Products Grid ── */}
        {isLoadingInitial && products.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white border border-gray-100 shadow-xs p-3 animate-pulse flex flex-col gap-3"
              >
                <div className="aspect-square w-full rounded-xl bg-gray-200" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
                <div className="h-5 bg-gray-200 rounded w-2/3 mt-2" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-xs max-w-lg mx-auto my-8">
            <div className="w-16 h-16 bg-blue-50 text-[#007FFF] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              No new arrivals yet
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mb-6">
              Check back soon for fresh picks!
            </p>
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#007FFF] hover:bg-[#0066CC] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all"
            >
              <span>Browse All Products</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isNew={true}
                onClick={() => router.push(`/products/${getProductSlug(product)}`)}
              />
            ))}
          </div>
        )}

        {/* Bottom Sentinel for Infinite Scroll */}
        <div ref={bottomSentinelRef} className="h-10 w-full pointer-events-none" />

        {/* Infinite Scroll Bottom Loading State */}
        {isLoadingMore && (
          <div className="flex items-center justify-center gap-2.5 py-8 text-sm text-gray-600 animate-in fade-in duration-200">
            <Loader2 className="w-5 h-5 animate-spin text-[#007FFF]" />
            <span className="font-semibold text-gray-700">Loading more products...</span>
          </div>
        )}

        {/* All Products Loaded End Indicator */}
        {!hasNextPage && products.length > 0 && !isLoadingInitial && (
          <div className="flex items-center justify-center py-8 text-xs md:text-sm text-gray-400 font-medium animate-in fade-in duration-200">
            <span className="bg-white px-4 py-1.5 rounded-full border border-gray-200 text-gray-600 font-semibold shadow-xs flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>All {products.length} new arrivals loaded</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
