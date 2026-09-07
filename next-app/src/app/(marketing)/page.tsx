"use client";

import React, { useEffect, useState } from "react";

import { useRouter } from "next/navigation";
import imgPlaceholder from "@/public/imagePlaceholder.png";
import axios from "../../../utils/axios";
import CategorySlider from "./categories/CategorySlider";
import ProductSlider from "./products/ProductSlider";
import PopularProductsSlider from "./Popular_Products/PopularProductsSlider";
import NewArrivalsSection from "./NewArrivals/NewArrivalsSection";

type Variant = {
  id: number;
  title: string;
  mrp: string;
  sp: string;
  stock: number;
  image_url: string | null;
  image_json?: string;
};

type Product = {
  id: number;
  name: string;
  description?: string;
  image_url: string | null;
  variants: Variant[];
};

type Slider = {
  id: number;
  title: string;
  link?: string;
  open_in_new_tab?: boolean;
  description: string;
  image: string;
  status: boolean;
  show_buttons: boolean;
  button1_text?: string;
  button1_link?: string;
  button2_text?: string;
  button2_link?: string;
};

export default function HomeUI() {
  const [sliders, setSliders] = useState<Slider[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const ytIframeRef = React.useRef<HTMLIFrameElement>(null);
  const router = useRouter();

  const baseUrl = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchSliders = async () => {
    try {
      const res = await axios.get(`/api/sliders`);
      let fetchedSliders: Slider[] = [];
      if (Array.isArray(res.data)) {
        fetchedSliders = res.data;
      } else if (res.data.success && Array.isArray(res.data.data)) {
        fetchedSliders = res.data.data;
      }

      const activeSliders = fetchedSliders.filter(
        (slide) =>
          slide.status === true ||
          String(slide.status) === "1" ||
          String(slide.status) === "true"
      );
      setSliders(activeSliders);
    } catch (error) {
      console.error("Failed to fetch sliders", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSliders();
  }, []);

  useEffect(() => {
    if (sliders.length <= 1 || isVideoPlaying || isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sliders.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [sliders.length, isVideoPlaying, isPaused]);

  useEffect(() => {
    const currentSlide = sliders.length > 0 ? sliders[currentIndex] : null;
    const isYouTubeVideo = currentSlide?.link && (currentSlide.link.includes("youtube.com") || currentSlide.link.includes("youtu.be"));
    if (!isYouTubeVideo) return;
    let player: any = null;
    function onPlayerStateChange(event: any) {
      if (event.data === 1) setIsVideoPlaying(true);
      if (event.data === 2) setIsVideoPlaying(false);
    }
    function onYouTubeIframeAPIReady() {
      const iframe = ytIframeRef.current;
      if (iframe && (window as any).YT && (window as any).YT.Player) {
        player = new (window as any).YT.Player(iframe, {
          events: {
            'onStateChange': onPlayerStateChange
          }
        });
      }
    }
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
      (window as any).onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
    } else {
      onYouTubeIframeAPIReady();
    }
    return () => {
      if (player && player.destroy) player.destroy();
    };
  }, [currentIndex, sliders]);

  const handleSlideChange = (index: number) => {
    if (index === currentIndex) return;
    setCurrentIndex(index);
  };

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
      setCurrentIndex((prev) => (prev + 1) % sliders.length);
    } else if (isRightSwipe) {
      setCurrentIndex((prev) => (prev === 0 ? sliders.length - 1 : prev - 1));
    }
  };

  const currentSlide = sliders.length > 0 ? sliders[currentIndex] : null;

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`/api/products`);
      if (res.data?.success && Array.isArray(res.data?.data)) {
        const parseImages = (raw: any): string[] => {
          if (!raw) return [];
          if (Array.isArray(raw)) return raw;
          if (typeof raw === "string") {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) return parsed;
              if (typeof parsed === "string") return [parsed];
              return [];
            } catch {
              return [raw];
            }
          }
          return [];
        };

        const data = res.data.data.map((prod: Product) => {
          const productImage = prod.image_url
            ? `${baseUrl}${prod.image_url}`
            : prod.variants?.[0]?.image_url
              ? `${baseUrl}${prod.variants[0].image_url}`
              : imgPlaceholder.src;

          return {
            ...prod,
            image_url: productImage,
            variants: Array.isArray(prod.variants)
              ? prod.variants.map((v) => ({
                ...v,
                image_url: v.image_url ? `${baseUrl}${v.image_url}` : null,
                image_json: parseImages(v.image_json).map((img: string) => `${baseUrl}${img}`),
              }))
              : [],
          };
        });
      }
    } catch (error) {
      console.error("Failed to fetch products", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <section
        className="hero-section relative bg-gray-50 overflow-hidden w-full select-none group/hero"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {loading ? (
          <div className="w-full aspect-[1791/563] bg-gradient-to-br from-gray-200 via-gray-300 to-gray-200 animate-pulse relative" />
        ) : sliders.length > 0 ? (
          <div className="relative w-full aspect-[1791/563] overflow-hidden bg-gray-100">
            {sliders.map((slide, idx) => {
              const slideImageUrl = `${baseUrl}${slide.image}`;
              const isYouTubeVideo = slide.link && (slide.link.includes("youtube.com") || slide.link.includes("youtu.be"));
              const isCurrent = idx === currentIndex;
              const targetVal =
                slide.open_in_new_tab === true ||
                  String(slide.open_in_new_tab) === "1" ||
                  String(slide.open_in_new_tab) === "true"
                  ? "_blank"
                  : "_self";

              return (
                <div
                  key={slide.id}
                  className={`w-full h-full transition-opacity duration-500 ease-in-out ${isCurrent
                    ? "relative z-10 opacity-100 pointer-events-auto visible"
                    : "absolute top-0 left-0 right-0 bottom-0 z-0 opacity-0 pointer-events-none invisible"
                    }`}
                >
                  {slide.link && !isYouTubeVideo ? (
                    <a
                      href={slide.link}
                      target={targetVal}
                      rel="noopener noreferrer"
                      className="block w-full h-full cursor-pointer"
                    >
                      <img
                        src={slideImageUrl}
                        alt={slide.title || "Slider Image"}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                        className="w-full h-full object-cover select-none"
                      />
                    </a>
                  ) : (
                    <div className="w-full h-full">
                      <img
                        src={slideImageUrl}
                        alt={slide.title || "Slider Image"}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                        className="w-full h-full object-cover select-none"
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Slide Overlays (Title, Description, Buttons, YouTube video) */}
            {currentSlide && (currentSlide.title || currentSlide.description || currentSlide.show_buttons || (currentSlide.link && (currentSlide.link.includes("youtube.com") || currentSlide.link.includes("youtu.be")))) && (
              <div className="absolute inset-0 container mx-auto px-4 sm:px-6 md:px-8 h-full flex items-center justify-center sm:justify-start z-20 pointer-events-none">
                <div
                  key={currentIndex}
                  className="w-full flex flex-col md:flex-row items-center justify-center md:justify-between animate-fade-in-up"
                >
                  {/* Left: Title and Description */}
                  {(currentSlide.title || currentSlide.description || currentSlide.show_buttons) && (
                    <div className="flex-1 text-center md:text-left max-w-2xl drop-shadow-md">
                      {currentSlide.title && (
                        <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-2 sm:mb-3 leading-tight drop-shadow-lg">
                          {currentSlide.title}
                        </h1>
                      )}
                      {currentSlide.description && (
                        <p className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-100 mb-3 sm:mb-5 leading-relaxed line-clamp-2 sm:line-clamp-3 drop-shadow">
                          {currentSlide.description}
                        </p>
                      )}
                      {!!currentSlide.show_buttons && (
                        <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-2 sm:gap-3 pointer-events-auto">
                          {currentSlide.button1_text && currentSlide.button1_link && (
                            <button
                              type="button"
                              onClick={() => router.push(currentSlide.button1_link!)}
                              style={{
                                backgroundColor: 'var(--theme-blue, #0066CC)',
                                color: '#FFFAFB',
                              }}
                              className="w-full sm:w-auto py-1.5 sm:py-2 md:py-2.5 px-4 sm:px-5 md:px-6 text-xs sm:text-sm md:text-base font-semibold rounded-full transition-all duration-300 hover:scale-105 hover:shadow-lg whitespace-nowrap cursor-pointer"
                            >
                              {currentSlide.button1_text}
                            </button>
                          )}
                          {currentSlide.button2_text && currentSlide.button2_link && (
                            <button
                              type="button"
                              onClick={() => router.push(currentSlide.button2_link!)}
                              className="w-full sm:w-auto py-1.5 sm:py-2 md:py-2.5 px-4 sm:px-5 md:px-6 bg-white/20 backdrop-blur-sm text-white text-xs sm:text-sm md:text-base font-semibold rounded-full border border-white/80 hover:bg-white hover:text-gray-900 transition-all duration-300 hover:scale-105 whitespace-nowrap cursor-pointer"
                            >
                              {currentSlide.button2_text}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Right: YouTube video preview with play/pause detection */}
                  {currentSlide.link && (currentSlide.link.includes("youtube.com") || currentSlide.link.includes("youtu.be")) && (() => {
                    const match = currentSlide.link.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
                    const youtubeEmbedUrl = match ? `https://www.youtube.com/embed/${match[1]}?enablejsapi=1` : currentSlide.link.replace("watch?v=", "embed/") + "?enablejsapi=1";
                    return (
                      <>
                        {/* Desktop: right side, large */}
                        <div className="hidden md:flex flex-1 items-center justify-center md:justify-end px-4 mt-4 md:mt-0 pointer-events-auto">
                          <div className="w-72 h-40 sm:w-80 sm:h-48 md:w-[440px] md:h-[250px] rounded-xl overflow-hidden shadow-2xl border border-white/80 bg-black/80 flex items-center justify-center">
                            <iframe
                              ref={ytIframeRef}
                              className="w-full h-full"
                              src={youtubeEmbedUrl}
                              title={currentSlide.title || "Video"}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        </div>
                        {/* Mobile: bottom right, small */}
                        <div className="md:hidden pointer-events-auto mt-2">
                          <div className="w-36 h-20 rounded-md overflow-hidden shadow-lg border border-white/70 bg-black flex items-center justify-center">
                            <iframe
                              ref={ytIframeRef}
                              className="w-full h-full"
                              src={youtubeEmbedUrl}
                              title={currentSlide.title || "Video"}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

          </div>
        ) : null}
      </section>
      <CategorySlider />
      <ProductSlider />
      <NewArrivalsSection />
      <PopularProductsSlider />
    </div>
  );
}