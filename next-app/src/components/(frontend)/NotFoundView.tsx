"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Search,
  ArrowRight,
  Home,
  Flame,
  Sparkles,
  Truck,
  HelpCircle,
} from "lucide-react";
import logoText from "@/public/ZeltonHorizontalBlack.png";

export default function NotFoundView() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const popularShortcuts = [
    { label: "New Arrivals", href: "/new-arrivals", icon: Sparkles },
    { label: "Best Sellers", href: "/products", icon: Flame },
    { label: "Track Shipment", href: "/track-shipment", icon: Truck },
    { label: "Customer Help", href: "/contact-us", icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen flex flex-col justify-between bg-white text-[#0A0908] selection:bg-[#007FFF] selection:text-white">
      {/* Clean Top Navigation Bar */}
      <header className="w-full border-b border-gray-100 bg-white px-4 sm:px-8 py-4 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center hover:opacity-80 transition">
          <Image
            src={logoText}
            alt="Zelton Logo"
            priority
            unoptimized
            className="h-7 sm:h-8 w-auto object-contain"
          />
        </Link>
        <nav className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-medium text-gray-600">
          <Link href="/" className="hover:text-[#007FFF] transition">
            Home
          </Link>
          <Link href="/products" className="hover:text-[#007FFF] transition">
            Shop
          </Link>
          <Link href="/new-arrivals" className="hidden sm:inline hover:text-[#007FFF] transition">
            New Arrivals
          </Link>
          <Link href="/contact-us" className="hover:text-[#007FFF] transition">
            Help
          </Link>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6">
        <div className="max-w-xl w-full text-center space-y-8">
          {/* E-Commerce Bag Icon + 404 Badge */}
          <div className="flex flex-col items-center">
            <div className="relative mb-3">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-blue-50/80 border border-blue-100 flex items-center justify-center text-[#007FFF]">
                <ShoppingBag className="w-10 h-10 sm:w-12 sm:h-12 stroke-[1.5]" />
              </div>
              <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-[#0A0908] text-white text-[11px] font-bold tracking-wider">
                404
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0A0908] tracking-tight mt-2">
              Page Not Found
            </h1>
            <p className="text-sm sm:text-base text-gray-500 max-w-md mx-auto mt-2 leading-relaxed">
              We couldn’t find what you’re looking for. The item or page may have been moved or is no longer available.
            </p>
          </div>

          {/* Simple E-commerce Search Input */}
          <form onSubmit={handleSearchSubmit} className="max-w-md mx-auto">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-gray-400 absolute left-4 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, brands, collections..."
                className="w-full pl-11 pr-24 py-3 bg-gray-50/80 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-[#007FFF] focus:ring-2 focus:ring-[#007FFF]/20 rounded-xl text-xs sm:text-sm text-gray-900 transition outline-none"
              />
              <button
                type="submit"
                className="absolute right-1.5 px-4 py-2 bg-[#007FFF] hover:bg-[#0066CC] text-white text-xs font-semibold rounded-lg transition active:scale-95 cursor-pointer shadow-xs"
              >
                Search
              </button>
            </div>
          </form>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#007FFF] hover:bg-[#0066CC] text-white text-xs sm:text-sm font-semibold shadow-sm hover:shadow transition active:scale-95"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Continue Shopping</span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-semibold transition active:scale-95"
            >
              <Home className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
          </div>

          {/* Popular E-Commerce Categories Shortcut Pills */}
          <div className="pt-6 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
              Popular Destinations
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {popularShortcuts.map((item, i) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={i}
                    href={item.href}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-50 hover:bg-blue-50/60 border border-gray-200/80 hover:border-blue-200 text-xs font-medium text-gray-700 hover:text-[#007FFF] transition"
                  >
                    <Icon className="w-3.5 h-3.5 text-gray-500 group-hover:text-[#007FFF]" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="w-full py-4 px-4 text-center border-t border-gray-100 text-xs text-gray-500">
        <p>© {new Date().getFullYear()} Zelton. All rights reserved.</p>
      </footer>
    </div>
  );
}
