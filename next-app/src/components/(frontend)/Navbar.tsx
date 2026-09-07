'use client';

import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RiArrowDownSLine,
  RiMenuLine,
  RiSearchLine,
  RiUserLine,
  RiShoppingBagLine,
  RiCloseLine,
  RiHeartLine,
  RiLoaderLine,
  RiBox3Line,
  RiLogoutBoxRLine,
  RiHome4Fill,
  RiGridLine,
  RiWhatsappLine,
  RiUser3Line
} from 'react-icons/ri';
import { TbLayoutDashboardFilled } from 'react-icons/tb';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useLike } from '@/context/LikeContext';
import logoText from '@/public/ZeltonHorizontalBlack.png';
import axios from '../../../utils/axios';
import { Truck, ChevronLeft, ChevronRight, Bell } from 'lucide-react';
import { getOrders } from '../../../utils/orderApi';
import NotificationBell from '@/components/(sheared)/NotificationBell';
import { getActiveAnnouncements } from '../../../utils/topbarAnnouncementApi';
import { fetchSettingByKey } from '../../../utils/settingsApi';
import { TopbarAnnouncement } from '@/common/interface';
import { getCategorySlug, getProductSlug } from '../../../utils/slugUtils';

const basePath = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";

export default function Navbar() {
  const { user, logout, openAuthModal } = useAuth();
  const [avatarError, setAvatarError] = useState(false);
  useEffect(() => {
    setAvatarError(false);
  }, [user]);
  const { count } = useCart();
  const { likedProducts } = useLike();
  const [orderCount, setOrderCount] = useState<number>(0);
  const [whatsappNumber, setWhatsappNumber] = useState<string>('919729310456');

  useEffect(() => {
    if (user) {
      getOrders()
        .then((res: any) => {
          const list = Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.data?.data)
              ? res.data.data
              : Array.isArray(res?.result)
                ? res.result
                : Array.isArray(res)
                  ? res
                  : [];
          setOrderCount(list.length);
        })
        .catch(() => setOrderCount(0));
    } else {
      setOrderCount(0);
    }
  }, [user]);

  useEffect(() => {
    fetchSettingByKey('whatsapp_number')
      .then((setting) => {
        if (setting?.value) setWhatsappNumber(setting.value);
      })
      .catch(() => { });
  }, []);
  const router = useRouter();
  const pathname = usePathname();
  const [categories, setCategories] = useState<any[]>([]);
  const [topSubcategories, setTopSubcategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobileShopOpen, setMobileShopOpen] = useState(false);
  const [expandedMobileCatId, setExpandedMobileCatId] = useState<number | null>(null);
  const [isAccountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isMobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const tickingRef = useRef(false);
  const [headerHeight, setHeaderHeight] = useState(110);
  const headerRef = useRef<HTMLElement | null>(null);

  // Category horizontal scroll & hover states
  const categoryScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollCategoriesLeft, setCanScrollCategoriesLeft] = useState(false);
  const [canScrollCategoriesRight, setCanScrollCategoriesRight] = useState(false);
  const [activeHoverCat, setActiveHoverCat] = useState<any | null>(null);
  const [catDropdownPos, setCatDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const catHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkCategoryScroll = () => {
    const el = categoryScrollRef.current;
    if (el) {
      const hasOverflow = el.scrollWidth > el.clientWidth + 2;
      setCanScrollCategoriesLeft(el.scrollLeft > 5);
      setCanScrollCategoriesRight(hasOverflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
    }
  };

  useEffect(() => {
    checkCategoryScroll();
    const timer = setTimeout(checkCategoryScroll, 300);
    window.addEventListener('resize', checkCategoryScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkCategoryScroll);
    };
  }, [categories]);

  const scrollCategoryStrip = (direction: 'left' | 'right') => {
    const el = categoryScrollRef.current;
    if (el) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleCategoryWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = categoryScrollRef.current;
    if (el && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      checkCategoryScroll();
    }
  };

  const handleCatMouseEnter = (cat: any, e: React.MouseEvent<HTMLElement>) => {
    if (catHoverTimeoutRef.current) clearTimeout(catHoverTimeoutRef.current);
    if (!cat.children || cat.children.length === 0) {
      setActiveHoverCat(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const dropdownWidth = 240;
    const idealLeft = rect.left;
    const safeLeft = Math.max(12, Math.min(window.innerWidth - dropdownWidth - 16, idealLeft));

    setCatDropdownPos({ top: rect.bottom + 2, left: safeLeft });
    setActiveHoverCat(cat);
  };

  const handleCatMouseLeave = () => {
    catHoverTimeoutRef.current = setTimeout(() => {
      setActiveHoverCat(null);
    }, 180);
  };

  const handleDropdownMouseEnter = () => {
    if (catHoverTimeoutRef.current) clearTimeout(catHoverTimeoutRef.current);
  };

  const handleDropdownMouseLeave = () => {
    setActiveHoverCat(null);
  };

  // Dynamic Topbar Announcements
  const [announcements, setAnnouncements] = useState<TopbarAnnouncement[]>([]);
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [announcementDirection, setAnnouncementDirection] = useState(1);
  const [isAnnouncementPaused, setIsAnnouncementPaused] = useState(false);

  useEffect(() => {
    getActiveAnnouncements().then((data) => {
      if (Array.isArray(data)) {
        setAnnouncements(data);
      }
    });
  }, []);

  // Auto-slide every 5 seconds when multiple announcements exist and not hovered
  useEffect(() => {
    if (announcements.length <= 1 || isAnnouncementPaused) return;
    const interval = setInterval(() => {
      setAnnouncementDirection(1);
      setAnnouncementIndex((prev) => (prev + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [announcements.length, isAnnouncementPaused]);

  const handlePrevAnnouncement = () => {
    if (announcements.length <= 1) return;
    setAnnouncementDirection(-1);
    setAnnouncementIndex((prev) => (prev - 1 + announcements.length) % announcements.length);
  };

  const handleNextAnnouncement = () => {
    if (announcements.length <= 1) return;
    setAnnouncementDirection(1);
    setAnnouncementIndex((prev) => (prev + 1) % announcements.length);
  };

  useLayoutEffect(() => {
    const updateHeight = () => {
      if (headerRef.current) {
        const height = headerRef.current.offsetHeight;
        if (height > 50) {
          setHeaderHeight(height);
          document.documentElement.style.setProperty('--navbar-height', `${height}px`);
        }
      }
    };

    updateHeight();
    const timer = setTimeout(updateHeight, 100);
    const timer2 = setTimeout(updateHeight, 400);

    window.addEventListener('resize', updateHeight);
    return () => {
      window.removeEventListener('resize', updateHeight);
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [isScrolled, pathname, categories, topSubcategories, brands, isMobileMenuOpen, isSearchOpen, isMobileSearchOpen, user, announcements]);

  // Smooth auto-hide on scroll down, auto-show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      if (!tickingRef.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const prevScrollY = lastScrollYRef.current;
          const delta = currentScrollY - prevScrollY;

          // Update scrolled shadow state
          setIsScrolled(currentScrollY > 20);

          // Don't auto-hide if mobile menu or search modal is open
          if (isMobileMenuOpen || isSearchOpen) {
            setIsNavVisible(true);
            lastScrollYRef.current = currentScrollY;
            tickingRef.current = false;
            return;
          }

          // If at or near top of the page (within 40px), always show navbar
          if (currentScrollY <= 40) {
            setIsNavVisible(true);
          } else if (delta > 8 && currentScrollY > headerHeight) {
            // Meaningful scroll down -> slide up and hide navbar
            setIsNavVisible(false);
            setActiveHoverCat(null);
            setAccountMenuOpen(false);
            setIsSearchDropdownOpen(false);
          } else if (delta < -6) {
            // Meaningful scroll up -> slide down and show navbar
            setIsNavVisible(true);
          }

          lastScrollYRef.current = currentScrollY <= 0 ? 0 : currentScrollY;
          tickingRef.current = false;
        });
        tickingRef.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [headerHeight, isMobileMenuOpen, isSearchOpen]);

  // On route change, reset navbar to visible
  useEffect(() => {
    setIsNavVisible(true);
    lastScrollYRef.current = 0;
  }, [pathname]);

  // Fetch all categories (sorted 1st by most products, 2nd by most subcategories)
  useEffect(() => {
    const getCategories = async () => {
      try {
        const response = await axios.get('/api/categories?order_by=products_count');
        const rawData = response.data;
        const list = Array.isArray(rawData)
          ? rawData
          : Array.isArray(rawData?.data?.categories)
            ? rawData.data.categories
            : Array.isArray(rawData?.categories)
              ? rawData.categories
              : [];
        setCategories(list);
      } catch (error) {
        console.error('Error fetching categories in Navbar:', error);
      }
    };

    const getBrands = async () => {
      try {
        const response = await axios.get('/api/brands');
        setBrands(response.data || []);
      } catch (error) {
        console.error('Error fetching brands:', error);
        setBrands([]);
      }
    };

    const getTopSubcategories = async () => {
      try {
        const response = await axios.get('/api/subcategories-with-products?limit=8&min_products=1&order_by=products_count&order_direction=desc');
        if (response.data.res === 'success') {
          setTopSubcategories(response.data.data.categories || []);
        } else {
          console.warn('API returned non-success response:', response.data);
          setTopSubcategories([]);
        }
      } catch (error) {
        console.error('Error fetching top subcategories:', error);
        setTopSubcategories([]);
      }
    };

    getCategories();
    getTopSubcategories();
    getBrands();
  }, []);

  const handleLogout = async () => {
    await logout();
    setAccountMenuOpen(false);
    router.refresh();
  };

  const handleDashboardRedirect = () => {
    if (user?.role === 'Admin') {
      router.push('/dashboard');
    } else {
      openAuthModal('login');
    }
    setAccountMenuOpen(false);
  };

  // Search functionality
  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchSuggestions([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await axios.get(`/api/search-products?q=${encodeURIComponent(query)}&limit=8`);
      if (response.data.res === 'success' || response.data.success) {
        const payloadData = response.data.data;
        if (Array.isArray(payloadData)) {
          setSearchResults(payloadData);
          setSearchSuggestions([]);
        } else {
          setSearchResults(payloadData?.products || []);
          setSearchSuggestions(payloadData?.suggestions || []);
        }
      } else {
        setSearchResults([]);
        setSearchSuggestions([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      setSearchSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim()) {
      setIsSearchDropdownOpen(true);
    } else {
      setIsSearchDropdownOpen(false);
    }

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  const handleMobileSearchChange = (value: string) => {
    setMobileSearchQuery(value);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const handleMobileSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mobileSearchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(mobileSearchQuery.trim())}`);
      setMobileMenuOpen(false);
      setMobileSearchQuery('');
      setSearchResults([]);
    }
  };

  const handleProductClick = (productOrId: any) => {
    const slug = typeof productOrId === 'object' ? getProductSlug(productOrId) : productOrId;
    router.push(`/products/${slug}`);
    setSearchOpen(false);
    setMobileMenuOpen(false);
    setSearchQuery('');
    setMobileSearchQuery('');
    setSearchResults([]);
  };

  const handleSubcategoryClick = (subcategory: any) => {
    if (subcategory) {
      router.push(`/categories/subcategories/${getCategorySlug(subcategory)}`);
      setSearchOpen(false);
      setMobileMenuOpen(false);
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Close search dropdown if clicking outside search container
      if (!target.closest('.search-container')) {
        setIsSearchDropdownOpen(false);
      }

      // Close account menu if clicking outside account container
      if (!target.closest('.account-container')) {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close search modal on ESC key
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isSearchOpen) {
        setSearchOpen(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [isSearchOpen]);

  return (
    <>
      <div style={{ height: headerHeight }} aria-hidden="true" suppressHydrationWarning />
      <header
        ref={headerRef}
        className={`fixed top-0 left-0 w-full z-[500] bg-white border-b border-gray-200 shadow-sm transition-transform duration-300 ease-in-out ${isNavVisible ? 'translate-y-0' : '-translate-y-full'
          }`}
      >

        {/* Top Black Announcement Bar (Dynamic from Backend) */}
        {announcements.length > 0 && announcements[announcementIndex] && (
          <div
            onMouseEnter={() => setIsAnnouncementPaused(true)}
            onMouseLeave={() => setIsAnnouncementPaused(false)}
            className="bg-[#0A0908] text-[#FFFAFB] text-xs font-semibold py-1.5 px-4 md:px-8 w-full flex items-center justify-between transition-all duration-300 select-none overflow-hidden"
          >
            {announcements.length > 1 ? (
              <button
                onClick={handlePrevAnnouncement}
                className="p-1 hover:text-[#007FFF] transition-colors cursor-pointer flex-shrink-0"
                aria-label="Previous announcement"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="w-5 flex-shrink-0" />
            )}

            <div className="flex-1 flex items-center justify-center overflow-hidden min-h-[20px] relative px-2">
              <AnimatePresence mode="wait" custom={announcementDirection}>
                <motion.div
                  key={announcements[announcementIndex]?.id || announcementIndex}
                  custom={announcementDirection}
                  initial={{ x: announcementDirection > 0 ? 80 : -80, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: announcementDirection > 0 ? -80 : 80, opacity: 0 }}
                  transition={{ duration: 0.32, ease: [0.25, 1, 0.5, 1] }}
                  className="flex items-center justify-center gap-1.5 text-center truncate max-w-full"
                >
                  {announcements[announcementIndex].link_url ? (
                    announcements[announcementIndex].link_url!.startsWith("http") ? (
                      <a
                        href={announcements[announcementIndex].link_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline hover:text-[#007FFF] transition-colors inline-flex items-center gap-1.5 truncate"
                      >
                        {announcements[announcementIndex].icon && (
                          <span className="text-sm">{announcements[announcementIndex].icon}</span>
                        )}
                        <span className="truncate">{announcements[announcementIndex].title}</span>
                      </a>
                    ) : (
                      <Link
                        href={announcements[announcementIndex].link_url!}
                        className="hover:underline hover:text-[#007FFF] transition-colors inline-flex items-center gap-1.5 truncate"
                      >
                        {announcements[announcementIndex].icon && (
                          <span className="text-sm">{announcements[announcementIndex].icon}</span>
                        )}
                        <span className="truncate">{announcements[announcementIndex].title}</span>
                      </Link>
                    )
                  ) : (
                    <div className="inline-flex items-center gap-1.5 truncate">
                      {announcements[announcementIndex].icon && (
                        <span className="text-sm">{announcements[announcementIndex].icon}</span>
                      )}
                      <span className="truncate">{announcements[announcementIndex].title}</span>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {announcements.length > 1 ? (
              <button
                onClick={handleNextAnnouncement}
                className="p-1 hover:text-[#007FFF] transition-colors cursor-pointer flex-shrink-0"
                aria-label="Next announcement"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="w-5 flex-shrink-0" />
            )}
          </div>
        )}

        {/* Mobile Header Layout */}
        <div className="block sm:hidden px-3.5 py-2.5 bg-white border-b border-gray-100 relative">
          {/* Row 1: Hamburger, Brand Logo, Track Order, Bell, Cart, Profile */}
          <div className="flex items-center justify-between mb-2 relative z-[700]">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-1.5 text-gray-800 hover:text-black rounded-full active:bg-gray-100 transition-colors"
                title="Open Menu"
              >
                <RiMenuLine className="text-2xl text-gray-900" />
              </button>
              <Link href="/" className="flex items-center">
                <Image src={logoText} unoptimized priority alt="Zelton Logo" className="h-6.5 w-auto object-contain" />
              </Link>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5">
              {/* 1. Track Order Truck Icon */}
              <Link
                href="/track-order"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-gray-800 hover:text-black hover:bg-gray-100 rounded-full transition-colors"
                title="Track Order"
              >
                <Truck className="w-5 h-5 text-gray-800" />
              </Link>

              {/* 2. Real-time Socket Notification Bell */}
              <NotificationBell />

              {/* 3. Cart Bag Icon */}
              <button
                onClick={() => router.push('/cart')}
                className="p-1.5 text-gray-800 hover:text-black hover:bg-gray-100 rounded-full relative flex items-center justify-center transition-colors"
                title="Cart"
              >
                <RiShoppingBagLine className="text-2xl text-gray-900" />
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-[#007FFF] text-white text-[9px] rounded-full min-w-[16px] h-[16px] px-0.5 flex items-center justify-center font-bold border-2 border-white shadow-xs">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>

              {/* 4. Account Profile Icon (In the last position on far right) */}
              <div className="relative account-container">
                {user ? (
                  <button
                    onClick={() => setAccountMenuOpen(!isAccountMenuOpen)}
                    className="p-1 text-gray-800 hover:text-black rounded-full flex items-center justify-center transition-transform active:scale-95"
                    title="Account"
                  >
                    <div className="w-7 h-7 rounded-full overflow-hidden border border-gray-300 shadow-xs">
                      {user.profile_picture && !avatarError ? (
                        <img
                          src={
                            user.profile_picture.startsWith('http://') || user.profile_picture.startsWith('https://')
                              ? user.profile_picture
                              : `${basePath}/storage/${user.profile_picture}`
                          }
                          alt={user.name}
                          onError={() => setAvatarError(true)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="bg-[#0A0908] text-white w-full h-full flex items-center justify-center font-bold text-[10px]">
                          {user.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={() => openAuthModal('login')}
                    className="p-1.5 text-gray-800 hover:text-black hover:bg-gray-100 rounded-full transition-colors"
                    title="Sign In"
                  >
                    <RiUserLine className="text-2xl text-gray-900" />
                  </button>
                )}

                {/* Mobile Profile Dropdown (Old Clean UI, opens directly under profile avatar on top of search bar) */}
                {isAccountMenuOpen && user && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white shadow-2xl rounded-2xl border border-gray-200 overflow-hidden animate-in slide-in-from-top-2 duration-200 z-[99999]">
                    <div className="bg-black text-white p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 flex-shrink-0">
                          {user.profile_picture && !avatarError ? (
                            <img src={user.profile_picture.startsWith('http') ? user.profile_picture : `${basePath}/storage/${user.profile_picture}`} alt={user.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-white/20 flex items-center justify-center font-bold text-xs">{user.name?.charAt(0).toUpperCase()}</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs truncate">{user.name}</div>
                          <div className="text-[10px] opacity-80 truncate">{user.email}</div>
                        </div>
                      </div>
                    </div>
                    <div className="p-2 space-y-1">
                      {user.role === 'Admin' && (
                        <button onClick={handleDashboardRedirect} className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded-lg">
                          <TbLayoutDashboardFilled className="text-sm text-gray-600" />
                          <span>Dashboard</span>
                        </button>
                      )}
                      <Link href="/profile" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        <RiUser3Line className="text-sm text-gray-600" />
                        <span>My Profile</span>
                      </Link>
                      <Link href="/orders" onClick={() => setAccountMenuOpen(false)} className="flex items-center justify-between w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        <div className="flex items-center gap-2.5">
                          <RiBox3Line className="text-sm text-gray-600" />
                          <span>My Orders</span>
                        </div>
                        {orderCount > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-50 text-[#007FFF] rounded-full">
                            {orderCount}
                          </span>
                        )}
                      </Link>
                      <Link href="/wishlist" onClick={() => setAccountMenuOpen(false)} className="flex items-center justify-between w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        <div className="flex items-center gap-2.5">
                          <RiHeartLine className="text-sm text-gray-600" />
                          <span>Wishlist</span>
                        </div>
                        {likedProducts.length > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-pink-50 text-pink-600 rounded-full">
                            {likedProducts.length}
                          </span>
                        )}
                      </Link>
                      <Link href="/notifications" onClick={() => setAccountMenuOpen(false)} className="flex items-center justify-between w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        <div className="flex items-center gap-2.5">
                          <Bell className="text-sm text-gray-600 w-3.5 h-3.5" />
                          <span>My Notifications</span>
                        </div>
                      </Link>
                      <button onClick={handleLogout} className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors border-t border-gray-100 mt-1">
                        <RiLogoutBoxRLine className="text-sm" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Full-Width Search Input Bar */}
          <div className="w-full relative z-[50]">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative bg-[#f4f4f5] hover:bg-[#eaeaea] focus-within:bg-white rounded-full border border-gray-200/90 flex items-center px-3.5 py-2 transition-all shadow-inner">
                <RiSearchLine className="text-gray-500 text-base mr-2.5 flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    handleSearchChange(e.target.value);
                    if (e.target.value.trim()) setIsSearchDropdownOpen(true);
                  }}
                  onFocus={() => {
                    if (searchQuery.trim()) setIsSearchDropdownOpen(true);
                  }}
                  placeholder="Search products, categories, brands..."
                  className="w-full bg-transparent text-xs text-gray-900 placeholder-gray-500 focus:outline-none"
                />
                {searchQuery && (
                  <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults([]);
                        setIsSearchDropdownOpen(false);
                      }}
                      className="text-[11px] font-bold text-gray-500 hover:text-black px-1.5 py-0.5 border-r border-gray-300"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSearchDropdownOpen(false)}
                      className="p-0.5 text-gray-500 hover:text-black"
                    >
                      <RiCloseLine className="text-base" />
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Mobile Search Results Overlay */}
          {searchQuery && isSearchDropdownOpen && (
            <div className="block sm:hidden absolute left-2 right-2 top-full mt-1 bg-white shadow-2xl rounded-2xl border border-gray-200 overflow-hidden z-[9999] animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="p-4 pb-8 max-h-[75vh] overflow-y-auto space-y-4">

                {/* Database Suggestions List */}
                {searchSuggestions.length > 0 && (
                  <div className="space-y-1 pb-3 border-b border-gray-100">
                    {searchSuggestions.map((sug, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          setSearchQuery(sug);
                          performSearch(sug);
                          setIsSearchDropdownOpen(true);
                        }}
                        className="flex items-center gap-2.5 py-2 px-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                      >
                        <RiSearchLine className="text-gray-400 text-sm" />
                        <span className="truncate">{sug}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Related Products Grid */}
                <div>
                  <h3 className="font-serif text-sm font-bold text-[#0c2340] mb-3">Related Products</h3>
                  {searchResults.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2.5 pb-6">
                      {searchResults.map((product) => {
                        const bestVariant = product.best_variant || (product.variants && product.variants[0]);
                        const sp = bestVariant?.sp || product.min_price || 0;
                        const mrp = bestVariant?.mrp || product.max_price || 0;
                        const discount = mrp > sp ? Math.round(((mrp - sp) / mrp) * 100) : 0;
                        const formattedSp = typeof sp === 'number' ? sp.toFixed(2) : sp;

                        return (
                          <div
                            key={product.id}
                            onClick={() => handleProductClick(product.id)}
                            className="group flex flex-col cursor-pointer bg-white rounded-xl p-2.5 border border-gray-100 hover:border-[#007FFF]/40 hover:shadow-md transition-all"
                          >
                            <div className="w-full aspect-square bg-gray-50 rounded-lg overflow-hidden mb-1.5 relative flex items-center justify-center border border-gray-100/80">
                              {discount > 0 && (
                                <span className="absolute top-1 left-1 bg-red-600 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shadow-xs z-10">
                                  {discount}% OFF
                                </span>
                              )}
                              {product.image_url ? (
                                <img src={`${basePath}${product.image_url}`} alt={product.name} className="w-full h-full object-contain p-1" />
                              ) : (
                                <div className="text-gray-400 font-bold text-xs">{product.name?.charAt(0)}</div>
                              )}
                            </div>
                            <h4 className="font-semibold text-[11px] text-gray-900 truncate mb-0.5">{product.name}</h4>
                            <div className="flex items-center gap-1 mt-auto">
                              <span className="text-xs font-bold text-[#C53030]">₹ {formattedSp}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 py-2">No matching products found.</p>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Main Desktop Header Row */}
        <div className="hidden sm:flex w-full px-4 md:px-8 lg:px-12 py-3 items-center justify-between gap-4 md:gap-8">

          {/* Left: Brand Logo */}
          <div className="flex-1 flex items-center justify-start">
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <Image src={logoText} unoptimized priority alt="Zelton Logo" className="h-7 md:h-9 w-auto object-contain" />
            </Link>
          </div>

          {/* Middle: Pill/Capsule Search Bar (Centered Horizontally) */}
          <div className="relative flex-1 max-w-[650px] mx-auto search-container z-[9999]">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative w-full bg-[#f0f0f0] hover:bg-[#e8e8e8] focus-within:bg-[#FFFAFB] rounded-full border border-transparent focus-within:border-[#007FFF] transition-all duration-200 shadow-inner flex items-center pr-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    handleSearchChange(e.target.value);
                    if (e.target.value.trim()) setIsSearchDropdownOpen(true);
                  }}
                  onFocus={() => {
                    if (searchQuery.trim()) setIsSearchDropdownOpen(true);
                  }}
                  placeholder="What are you looking for?"
                  className="w-full bg-transparent pl-6 pr-28 py-2.5 text-xs md:text-sm text-[#0A0908] placeholder-gray-500 focus:outline-none"
                />

                {/* Input Action Controls */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {/* Clear text button */}
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults([]);
                        setIsSearchDropdownOpen(false);
                      }}
                      className="text-xs font-bold text-gray-500 hover:text-[#007FFF] transition-colors px-1.5 py-0.5 border-r border-gray-300 mr-1"
                      title="Clear text"
                    >
                      Clear
                    </button>
                  )}

                  {/* X Cross Button (Closes dropdown without clearing text) */}
                  {searchQuery && isSearchDropdownOpen && (
                    <button
                      type="button"
                      onClick={() => setIsSearchDropdownOpen(false)}
                      className="text-gray-500 hover:text-[#007FFF] transition-colors p-1 rounded-full mr-1"
                      title="Close results"
                    >
                      <RiCloseLine className="text-lg" />
                    </button>
                  )}

                  {/* Submit / Loader */}
                  {isSearching ? (
                    <RiLoaderLine className="text-[#007FFF] text-lg animate-spin" />
                  ) : (
                    <button type="submit" className="text-gray-700 hover:text-[#007FFF] transition-colors p-0.5" title="Search">
                      <RiSearchLine className="text-lg md:text-xl" />
                    </button>
                  )}
                </div>
              </div>
            </form>
            {/* Search Dropdown Results Overlay (Always Above Category Ribbon) */}
            {searchQuery && isSearchDropdownOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-3 w-[94vw] max-w-[1320px] bg-white shadow-2xl rounded-2xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[99999]">
                <div className="p-6 flex flex-col md:flex-row gap-6 max-h-[580px] overflow-y-auto">

                  {/* Left Section: Related Products (Image 2) */}
                  <div className="md:w-[75%] min-w-0">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-serif text-lg md:text-xl font-bold text-[#0c2340]">Related Products</h3>
                      <span className="text-xs text-gray-500 font-medium">
                        {searchResults.length} {searchResults.length === 1 ? 'product' : 'products'} found
                      </span>
                    </div>

                    {searchResults.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-12">
                        {searchResults.map((product) => {
                          const bestVariant = product.best_variant || (product.variants && product.variants[0]);
                          const sp = bestVariant?.sp || product.min_price || 0;
                          const mrp = bestVariant?.mrp || product.max_price || 0;
                          const discount = mrp > sp ? Math.round(((mrp - sp) / mrp) * 100) : 0;
                          const formattedSp = typeof sp === 'number' ? sp.toFixed(2) : sp;
                          const formattedMrp = typeof mrp === 'number' ? mrp.toFixed(2) : mrp;
                          const rawSub = (product.category?.name || product.brand?.name || 'Product').replace(/No attribute product/gi, '').trim();

                          return (
                            <div
                              key={product.id}
                              onClick={() => handleProductClick(product)}
                              className="group flex flex-col cursor-pointer bg-white rounded-2xl p-2.5 sm:p-3 border border-gray-200/80 hover:border-[#007FFF] hover:shadow-xl transition-all duration-300 relative"
                            >
                              {/* Image (Full size of box, no double border, no inner padding) */}
                              <div className="w-full aspect-square bg-gray-50 rounded-xl overflow-hidden mb-2.5 relative flex items-center justify-center">
                                {discount > 0 && (
                                  <span className="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-xs z-10">
                                    {discount}% OFF
                                  </span>
                                )}
                                {product.image_url ? (
                                  <img
                                    src={product.image_url.startsWith('http') ? product.image_url : `${basePath}${product.image_url}`}
                                    alt={product.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="text-gray-400 font-bold text-xl">
                                    {product.name?.charAt(0).toUpperCase() || 'P'}
                                  </div>
                                )}

                                {/* Hover View Button Overlay */}
                                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-2 z-10">
                                  <button className="bg-white text-gray-900 font-bold text-xs px-5 py-1.5 rounded-full shadow-md transform translate-y-1 group-hover:translate-y-0 transition-all duration-300 hover:bg-gray-50">
                                    View
                                  </button>
                                </div>
                              </div>

                              {/* Title (Single line truncate) */}
                              <h4 className="text-xs md:text-sm font-semibold text-gray-900 group-hover:text-[#007FFF] transition-colors truncate mb-1" title={product.name}>
                                {product.name}
                              </h4>

                              {/* Subcategory / Brand */}
                              <p className="text-[11px] text-gray-400 truncate mb-2">
                                {rawSub || 'Zelton Collection'}
                              </p>

                              {/* Price & Discount */}
                              <div className="flex items-center flex-wrap gap-1.5 mt-auto pt-1.5 border-t border-gray-100">
                                <span className="font-bold text-xs md:text-sm text-[#C53030]">₹ {formattedSp}</span>
                                {mrp > sp && (
                                  <span className="line-through text-[11px] text-gray-400">₹ {formattedMrp}</span>
                                )}
                                {discount > 0 && (
                                  <span className="bg-red-50 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-100 ml-auto">
                                    {discount}% OFF
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : !isSearching ? (
                      <div className="py-12 text-center text-gray-500 text-sm">
                        No related products found for "{searchQuery}"
                      </div>
                    ) : null}
                  </div>

                  {/* Right Section: Suggestions (Real Database Suggestions from Categories, Brands, Products) */}
                  <div className="md:w-[25%] border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                    <h3 className="font-serif text-base md:text-lg font-bold text-[#0c2340] mb-4">Suggestions</h3>

                    <div className="space-y-1.5">
                      {(searchSuggestions.length > 0
                        ? searchSuggestions
                        : [
                          searchQuery,
                          ...(categories.map((c: any) => c.name)),
                          ...(searchResults.map((p: any) => p.name))
                        ]
                      )
                        .filter((term: any, index: number, self: any[]) => term && typeof term === 'string' && self.indexOf(term) === index)
                        .slice(0, 10)
                        .map((suggestionText: string, idx: number) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setSearchQuery(suggestionText);
                              performSearch(suggestionText);
                              setIsSearchDropdownOpen(true);
                            }}
                            className="flex items-center gap-2.5 p-2.5 rounded-xl text-xs md:text-sm font-medium text-gray-700 hover:text-black hover:bg-gray-100 cursor-pointer transition-all group"
                          >
                            <RiSearchLine className="w-4 h-4 text-gray-400 group-hover:text-black flex-shrink-0" />
                            <span className="truncate">{suggestionText}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>

          {/* Right Actions: Track Order, Notification Bell, Cart, Account (Profile at the end) */}
          <div className="flex-1 flex items-center justify-end space-x-6 md:space-x-8 lg:space-x-10">

            {/* 1. Track Order */}
            <Link
              href="/track-order"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs md:text-sm font-semibold text-[#0A0908] hover:text-[#007FFF] transition-colors whitespace-nowrap"
              title="Track Order"
            >
              <Truck className="w-4 h-4 md:w-5 md:h-5 text-[#0A0908]" />
              <span className="hidden sm:inline">Track Order</span>
            </Link>

            {/* 2. Real-time Socket Notification Bell */}
            <NotificationBell />

            {/* 3. Cart Icon Button */}
            <button
              onClick={() => router.push('/cart')}
              className="w-10 h-10 md:w-11 md:h-11 rounded-full border border-gray-900 hover:border-[#007FFF] flex items-center justify-center text-[#0A0908] hover:text-[#007FFF] transition-colors relative"
              title="Cart"
            >
              <RiShoppingBagLine className="text-xl md:text-2xl" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#007FFF] text-[#FFFAFB] text-[10px] rounded-full w-4 h-4 md:w-5 md:h-5 flex items-center justify-center font-bold">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>

            {/* 4. Account Profile (At the end on the far right) */}
            <div className="relative z-[600] account-container">
              {user ? (
                <button
                  onClick={() => setAccountMenuOpen(!isAccountMenuOpen)}
                  className="p-1 text-gray-800 hover:text-black transition-colors rounded-full flex items-center justify-center"
                  title="Account"
                >
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-full overflow-hidden border border-gray-300 shadow-sm">
                    {user.profile_picture && !avatarError ? (
                      <img
                        src={
                          user.profile_picture.startsWith('http://') || user.profile_picture.startsWith('https://')
                            ? user.profile_picture
                            : `${basePath}/storage/${user.profile_picture}`
                        }
                        alt={user.name}
                        onError={() => setAvatarError(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="bg-black text-white w-full h-full flex items-center justify-center font-bold text-xs">
                        {user.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => openAuthModal('login')}
                  className="p-1 text-gray-800 hover:text-black transition-colors flex items-center justify-center"
                  title="Sign In"
                >
                  <RiUserLine className="text-2xl md:text-[26px] text-gray-900" />
                </button>
              )}

              {isAccountMenuOpen && user && (
                <div className="absolute right-0 top-full mt-3 w-72 bg-white shadow-2xl rounded-2xl border border-gray-200 overflow-hidden animate-in slide-in-from-top-2 duration-200 z-[9999]">
                  <div>
                    <div className="bg-black text-white p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20">
                          {user.profile_picture && !avatarError ? (
                            <img src={user.profile_picture.startsWith('http') ? user.profile_picture : `${basePath}/storage/${user.profile_picture}`} alt={user.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-white/20 flex items-center justify-center font-bold text-sm">{user.name?.charAt(0).toUpperCase()}</div>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{user.name}</div>
                          <div className="text-xs opacity-80 truncate max-w-[170px]">{user.email}</div>
                        </div>
                      </div>
                    </div>
                    <div className="p-2 space-y-1">
                      {user.role === 'Admin' && (
                        <button onClick={handleDashboardRedirect} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                          <TbLayoutDashboardFilled className="text-base text-gray-600" />
                          <span>Dashboard</span>
                        </button>
                      )}
                      <Link href="/profile" onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        <RiUser3Line className="text-base text-gray-600" />
                        <span>My Profile</span>
                      </Link>
                      <Link href="/orders" onClick={() => setAccountMenuOpen(false)} className="flex items-center justify-between w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        <div className="flex items-center gap-2.5">
                          <RiBox3Line className="text-base text-gray-600" />
                          <span>My Orders</span>
                        </div>
                        {orderCount > 0 && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-blue-50 text-[#007FFF] rounded-full">
                            {orderCount}
                          </span>
                        )}
                      </Link>
                      <Link href="/wishlist" onClick={() => setAccountMenuOpen(false)} className="flex items-center justify-between w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        <div className="flex items-center gap-2.5">
                          <RiHeartLine className="text-base text-gray-600" />
                          <span>My Wishlist</span>
                        </div>
                        {likedProducts.length > 0 && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-rose-100 text-rose-600 rounded-full">
                            {likedProducts.length}
                          </span>
                        )}
                      </Link>
                      <Link href="/notifications" onClick={() => setAccountMenuOpen(false)} className="flex items-center justify-between w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        <div className="flex items-center gap-2.5">
                          <Bell className="text-base text-gray-600 w-4 h-4" />
                          <span>My Notifications</span>
                        </div>
                      </Link>
                      <button onClick={handleLogout} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                        <RiLogoutBoxRLine className="text-base" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
              className="sm:hidden p-1.5 text-gray-800 hover:text-black"
            >
              <RiMenuLine className="text-2xl" />
            </button>
          </div>
        </div>

        {/* Categories Sub-Navbar (Scrollable left/right with sleek arrows and zero scrollbars) */}
        {categories.length > 0 && (
          <div className="hidden md:block relative z-[30] py-1 px-4 md:px-8 border-t border-gray-100/80 bg-white shadow-2xs group/navbar-strip">
            <div className="relative flex items-center max-w-full">
              {/* Left Scroll Button & Fade Mask */}
              {/* {canScrollCategoriesLeft && (
                <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center pr-4 bg-gradient-to-r from-white via-white/90 to-transparent">
                  <button
                    type="button"
                    onClick={() => scrollCategoryStrip('left')}
                    className="w-6 h-6 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-gray-700 hover:text-black hover:bg-gray-50 transition-all hover:scale-110 active:scale-95"
                    title="Scroll left"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              )} */}

              {/* Scrollable Category Row */}
              <div
                ref={categoryScrollRef}
                onScroll={checkCategoryScroll}
                onWheel={handleCategoryWheel}
                className="w-full flex items-center justify-start gap-4 md:gap-5 lg:gap-6 overflow-x-auto scrollbar-none scroll-smooth py-1 px-2 select-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              >
                {categories.map((cat: any) => {
                  const hasSubcategories = Array.isArray(cat.children) && cat.children.length > 0;
                  const isHovered = activeHoverCat?.id === cat.id;

                  return (
                    <div
                      key={cat.id}
                      className="flex-shrink-0"
                      onMouseEnter={(e) => handleCatMouseEnter(cat, e)}
                      onMouseLeave={handleCatMouseLeave}
                    >
                      <Link
                        href={`/categories/subcategories/${getCategorySlug(cat)}`}
                        className={`flex items-center text-[12px] md:text-[13px] font-semibold transition-colors whitespace-nowrap pb-0.5 capitalize tracking-normal ${isHovered ? 'text-[#007FFF]' : 'text-[#0A0908] hover:text-[#007FFF]'
                          }`}
                      >
                        <span className={`border-b-2 transition-all capitalize ${isHovered ? 'border-[#007FFF]' : 'border-transparent hover:border-[#007FFF]'
                          }`}>
                          {cat.name}
                        </span>
                        {hasSubcategories && (
                          <RiArrowDownSLine className={`text-[12px] text-gray-800 transition-transform duration-200 ml-0.5 ${isHovered ? 'rotate-180 text-[#007FFF]' : ''
                            }`} />
                        )}
                      </Link>
                    </div>
                  );
                })}
              </div>

              {/* Right Scroll Button & Fade Mask
              {canScrollCategoriesRight && (
                <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center pl-4 bg-gradient-to-l from-white via-white/90 to-transparent">
                  <button
                    type="button"
                    onClick={() => scrollCategoryStrip('right')}
                    className="w-6 h-6 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-gray-700 hover:text-black hover:bg-gray-50 transition-all hover:scale-110 active:scale-95"
                    title="Scroll right"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )} */}
            </div>

            {/* Global Unclipped Subcategories Dropdown (Fixed Portal Positioning) */}
            {activeHoverCat && catDropdownPos && Array.isArray(activeHoverCat.children) && activeHoverCat.children.length > 0 && isNavVisible && (
              <div
                style={{ top: catDropdownPos.top, left: catDropdownPos.left }}
                onMouseEnter={handleDropdownMouseEnter}
                onMouseLeave={handleDropdownMouseLeave}
                className="fixed w-56 sm:w-64 bg-white shadow-2xl border border-gray-200 rounded-xl py-2 px-1.5 z-[999999] animate-in fade-in slide-in-from-top-1 duration-150"
              >
                <div className="px-2.5 py-1 mb-1 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{activeHoverCat.name}</span>
                  <Link
                    href={`/categories/subcategories/${getCategorySlug(activeHoverCat)}`}
                    onClick={() => setActiveHoverCat(null)}
                    className="text-[10px] font-semibold text-[#007FFF] hover:underline"
                  >
                    View All
                  </Link>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-0.5">
                  {activeHoverCat.children.map((sub: any) => (
                    <Link
                      key={sub.id}
                      href={`/categories/subcategories/${getCategorySlug(activeHoverCat)}?sub=${getCategorySlug(sub)}`}
                      onClick={() => setActiveHoverCat(null)}
                      className="block px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-[#007FFF] transition-colors rounded-lg capitalize"
                    >
                      {sub.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}


        {/* Mobile Menu */}
        {
          isMobileMenuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="lg:hidden fixed inset-0 bg-black/60 z-[99998]"
                onClick={() => setMobileMenuOpen(false)}
              />

              {/* Sidebar */}
              <div className="lg:hidden fixed top-0 left-0 bottom-0 w-[82%] max-w-[320px] bg-white shadow-2xl z-[99999] overflow-y-auto flex flex-col">

                {/* ── Header: dark navy like Amazon ── */}
                <div className="bg-[#232f3e] px-4 py-3 flex items-center justify-between flex-shrink-0">
                  <div>
                    {user ? (
                      <>
                        <p className="text-[#f90] text-xs font-semibold">Hello, {user.name?.split(' ')[0]}</p>
                        <p className="text-white font-bold text-base leading-tight">Browse Store</p>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setMobileMenuOpen(false);
                            openAuthModal('login');
                          }}
                          className="flex items-center gap-1.5 text-white text-sm font-semibold hover:text-[#f90] transition-colors"
                        >
                          <RiUserLine className="text-base" />
                          Sign in
                        </button>
                        <p className="text-white font-bold text-base leading-tight mt-0.5">Browse Store</p>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-white hover:text-[#f90] transition-colors p-1"
                  >
                    <RiCloseLine className="text-2xl" />
                  </button>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 overflow-y-auto">

                  {/* Search */}
                  <div className="px-4 py-3 border-b border-gray-200">
                    <form onSubmit={handleMobileSearchSubmit}>
                      <div className="relative">
                        <input
                          type="text"
                          value={mobileSearchQuery}
                          onChange={(e) => handleMobileSearchChange(e.target.value)}
                          placeholder="Search products..."
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#f90] bg-white"
                        />
                        <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base" />
                        {isSearching && (
                          <RiLoaderLine className="absolute right-3 top-1/2 -translate-y-1/2 text-[#f90] text-base animate-spin" />
                        )}
                      </div>
                    </form>
                    {mobileSearchQuery && searchResults.length > 0 && (
                      <div className="mt-2 border border-gray-200 rounded bg-white shadow-md overflow-hidden">
                        {searchResults.slice(0, 5).map((product) => (
                          <div
                            key={product.id}
                            onClick={() => handleProductClick(product.id)}
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                          >
                            <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                              {product.image_url ? (
                                <img src={`${basePath}${product.image_url}`} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-bold">
                                  {product.name?.charAt(0).toUpperCase() || 'P'}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                              <p className="text-xs text-gray-500 truncate">{product.category?.name}</p>
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() => handleMobileSearchSubmit(new Event('submit') as any)}
                          className="w-full text-sm text-[#007185] font-semibold py-2.5 px-3 text-left hover:bg-gray-50 transition-colors"
                        >
                          See all results →
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Home */}
                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-3.5 text-sm font-medium text-gray-900 hover:bg-gray-50 border-b border-gray-200 transition-colors"
                  >
                    <span className="font-semibold text-[15px]">Store Home</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </Link>

                  {/* ── Trending section ── */}
                  <div className="border-b border-gray-200">
                    <p className="px-4 pt-4 pb-2 text-[15px] font-bold text-gray-900">Trending</p>
                    <Link
                      href="/new-arrivals"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors"
                    >
                      New Arrivals
                    </Link>
                    <Link
                      href="/sale"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors"
                    >
                      <span>Sale</span>
                      <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold">HOT</span>
                    </Link>
                    <Link
                      href="/about_us"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors"
                    >
                      About Us
                    </Link>
                  </div>

                  {/* ── Top Categories with Subcategories Accordion ── */}
                  {categories.length > 0 && (
                    <div className="border-b border-gray-200">
                      <button
                        onClick={() => setMobileShopOpen(!isMobileShopOpen)}
                        className="w-full flex items-center justify-between px-4 pt-4 pb-2"
                      >
                        <p className="text-[15px] font-bold text-gray-900">Top Categories for You</p>
                        <RiArrowDownSLine className={`text-xl text-gray-500 transition-transform duration-200 ${isMobileShopOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isMobileShopOpen && (
                        <div className="border-t border-gray-100">
                          {categories.map((cat: any) => (
                            <div key={cat.id} className="border-b border-gray-100 last:border-b-0">
                              <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                                <Link
                                  href={`/categories/subcategories/${getCategorySlug(cat)}`}
                                  onClick={() => setMobileMenuOpen(false)}
                                  className="text-sm font-semibold text-gray-800 hover:text-black flex-1 capitalize"
                                >
                                  {cat.name}
                                </Link>
                                {cat.children && cat.children.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedMobileCatId(expandedMobileCatId === cat.id ? null : cat.id);
                                    }}
                                    className="p-1 text-gray-500 hover:text-black"
                                  >
                                    <RiArrowDownSLine
                                      className={`text-lg transition-transform duration-200 ${expandedMobileCatId === cat.id ? 'rotate-180 text-black' : ''
                                        }`}
                                    />
                                  </button>
                                )}
                              </div>

                              {/* Subcategories Accordion */}
                              {expandedMobileCatId === cat.id && cat.children && cat.children.length > 0 && (
                                <div className="bg-gray-50 py-1.5 px-4 space-y-1">
                                  {cat.children.map((sub: any) => (
                                    <Link
                                      key={sub.id}
                                      href={`/categories/subcategories/${getCategorySlug(cat)}?sub=${getCategorySlug(sub)}`}
                                      onClick={() => setMobileMenuOpen(false)}
                                      className="block py-2 pl-4 text-xs font-medium text-gray-600 hover:text-black hover:bg-gray-100 rounded-md transition-colors capitalize"
                                    >
                                      {sub.name}
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {!isMobileShopOpen && <div className="pb-2" />}
                    </div>
                  )}

                  {/* ── Account section (if logged in) ── */}
                  {user && (
                    <div className="border-b border-gray-200">
                      <p className="px-4 pt-4 pb-2 text-[15px] font-bold text-gray-900">Account & Settings</p>
                      {user.role === 'Admin' && (
                        <button
                          onClick={handleDashboardRedirect}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors"
                        >
                          <TbLayoutDashboardFilled className="text-base text-gray-500" />
                          Dashboard
                        </button>
                      )}
                      <Link
                        href="/profile"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors"
                      >
                        <RiUser3Line className="text-base text-gray-500" />
                        <span>My Profile</span>
                      </Link>
                      <Link
                        href="/orders"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <RiBox3Line className="text-base text-gray-500" />
                          <span>My Orders</span>
                        </div>
                        {orderCount > 0 && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-blue-50 text-[#007FFF] rounded-full">
                            {orderCount}
                          </span>
                        )}
                      </Link>
                      <Link
                        href="/wishlist"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <RiHeartLine className="text-base text-gray-500" />
                          <span>Wishlist</span>
                        </div>
                        {likedProducts.length > 0 && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-rose-100 text-rose-600 rounded-full">
                            {likedProducts.length}
                          </span>
                        )}
                      </Link>
                      <Link
                        href="/notifications"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors"
                      >
                        <Bell className="text-base text-gray-500 w-4 h-4" />
                        <span>My Notifications</span>
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 border-t border-gray-100 transition-colors"
                      >
                        <RiLogoutBoxRLine className="text-base" />
                        Sign Out
                      </button>
                    </div>
                  )}

                  {/* ── Guest CTA ── */}
                  {!user && (
                    <div className="px-4 py-4 space-y-2.5 border-b border-gray-200">
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          openAuthModal('login');
                        }}
                        className="block w-full text-center py-2.5 px-4 bg-black hover:bg-gray-800 text-white text-sm font-bold rounded-xl transition-colors"
                      >
                        Sign In
                      </button>
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          openAuthModal('register');
                        }}
                        className="block w-full text-center py-2.5 px-4 border border-gray-300 text-gray-800 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        Create Account
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Footer strip ── */}
                <div className="flex-shrink-0 bg-[#232f3e] px-4 py-3">
                  <p className="text-xs text-gray-400 text-center">© 2026 Zelton. All rights reserved.</p>
                </div>
              </div>
            </>
          )
        }
      </header>

      {/* Fixed Mobile Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[99999] bg-white border-t border-gray-200 py-1 px-1 flex justify-around items-center md:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.08)] select-none">
        {/* 1. Home */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${pathname === '/' ? 'text-[#007FFF]' : 'text-gray-600 hover:text-gray-900'
            }`}
        >
          <RiHome4Fill className="text-xl" />
          <span className={`text-[10px] mt-0.5 ${pathname === '/' ? 'font-bold' : 'font-medium'}`}>Home</span>
        </Link>

        {/* 2. Categories */}
        <Link
          href="/categories"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${pathname.startsWith('/categories') ? 'text-[#007FFF]' : 'text-gray-600 hover:text-gray-900'
            }`}
        >
          <RiGridLine className="text-xl" />
          <span className={`text-[10px] mt-0.5 ${pathname.startsWith('/categories') ? 'font-bold' : 'font-medium'}`}>Category</span>
        </Link>

        {/* 3. WhatsApp Direct Chat */}
        <a
          href={`https://wa.me/${whatsappNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center flex-1 py-1 text-[#25D366] hover:opacity-80 transition-opacity"
          aria-label="Chat on WhatsApp"
        >
          <RiWhatsappLine className="text-xl" />
          <span className="text-[10px] font-medium mt-0.5 text-gray-700">WhatsApp</span>
        </a>

        {/* 4. Wishlist */}
        <Link
          href="/wishlist"
          className={`flex flex-col items-center justify-center flex-1 py-1 relative transition-colors ${pathname.startsWith('/wishlist') ? 'text-[#007FFF]' : 'text-gray-600 hover:text-gray-900'
            }`}
        >
          <div className="relative flex items-center justify-center">
            <RiHeartLine className="text-xl" />
            {likedProducts && likedProducts.length > 0 && (
              <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none shadow-xs">
                {likedProducts.length > 9 ? '9+' : likedProducts.length}
              </span>
            )}
          </div>
          <span className={`text-[10px] mt-0.5 ${pathname.startsWith('/wishlist') ? 'font-bold' : 'font-medium'}`}>Wishlist</span>
        </Link>

        {/* 5. My Orders */}
        <Link
          href="/orders"
          className={`flex flex-col items-center justify-center flex-1 py-1 relative transition-colors ${pathname.startsWith('/orders') ? 'text-[#007FFF]' : 'text-gray-600 hover:text-gray-900'
            }`}
        >
          <div className="relative flex items-center justify-center">
            <RiBox3Line className="text-xl" />
            {orderCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-[#007FFF] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none shadow-xs">
                {orderCount > 9 ? '9+' : orderCount}
              </span>
            )}
          </div>
          <span className={`text-[10px] mt-0.5 ${pathname.startsWith('/orders') ? 'font-bold' : 'font-medium'}`}>My Orders</span>
        </Link>
      </div>
    </>
  );
}
