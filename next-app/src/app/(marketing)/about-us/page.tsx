'use client';

import React from 'react';
import Link from 'next/link';
import {
    Store,
    Users,
    ShieldCheck,
    Truck,
    Award,
    Target,
    Sparkles,
    ArrowRight,
    Quote,
    CheckCircle2,
    Package,
    RotateCcw,
    CreditCard,
    Headphones,
    Heart,
    Star,
    ShoppingBag,
    Check,
    Layers,
    Clock,
    MapPin,
    ExternalLink
} from 'lucide-react';
import { RiWhatsappLine } from 'react-icons/ri';

export default function AboutUsPage() {
    return (
        <div className="min-h-screen bg-[#F8FAFC] text-gray-900 pb-20 sm:pb-16">

            {/* ══════════════════════════════════════════════════════
                1. HERO SECTION (Amazon / Flipkart Clean Brand Header)
            ══════════════════════════════════════════════════════ */}
            <section className="bg-gradient-to-b from-[#EEF6FF] via-[#F8FAFC] to-[#F8FAFC] border-b border-blue-100/70 pt-6 pb-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-5 font-medium">
                        <Link href="/" className="hover:text-[#007FFF] transition-colors">Home</Link>
                        <span>›</span>
                        <span className="text-gray-500">Company</span>
                        <span>›</span>
                        <span className="text-[#007FFF] font-semibold">About Zelton</span>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 pb-4">
                        {/* Title & Subtitle */}
                        <div className="space-y-3 max-w-2xl">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-[#007FFF] text-xs font-bold shadow-2xs">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Built on Trust, Quality & Customer Delight</span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#0F172A] tracking-tight leading-tight">
                                Crafting exceptional online shopping experiences.
                            </h1>
                            <p className="text-xs sm:text-sm md:text-base text-gray-600 leading-relaxed">
                                Welcome to Zelton — your trusted e-commerce destination for curated premium products, lightning-fast fulfillment, and unmatched customer support across India.
                            </p>
                        </div>

                        {/* Fast CTA Buttons */}
                        <div className="flex flex-wrap sm:flex-nowrap md:flex-col lg:flex-row items-center gap-3 flex-shrink-0">
                            <Link
                                href="/products"
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#007FFF] hover:bg-[#0066CC] active:scale-[0.98] text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                            >
                                <ShoppingBag className="w-4 h-4" />
                                <span>Explore Products</span>
                            </Link>
                            <Link
                                href="/contact-us"
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/90 text-gray-800 font-bold text-xs sm:text-sm shadow-2xs transition-all hover:border-[#007FFF]/50"
                            >
                                <Headphones className="w-4 h-4 text-[#007FFF]" />
                                <span>Contact Support</span>
                            </Link>
                        </div>
                    </div>

                    {/* Trust Badges Strip */}
                    <div className="mt-4 pt-4 border-t border-blue-100/60 flex items-center gap-4 sm:gap-8 flex-wrap text-[11px] font-semibold text-gray-600">
                        <div className="flex items-center gap-1.5 text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span>100% Genuine Verified Products</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-700">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#007FFF] flex-shrink-0" />
                            <span>7-Day Easy Replacement</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-700">
                            <Truck className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                            <span>Express Pan-India Logistics</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-700">
                            <Heart className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                            <span>50,000+ Happy Customers</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                2. KEY METRICS STATS BAR (Flipkart / Amazon Milestone Ribbon)
            ══════════════════════════════════════════════════════ */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
                <div className="bg-white rounded-3xl border border-gray-200/90 p-6 sm:p-8 shadow-xs">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                        <div className="pt-2 sm:pt-0">
                            <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#007FFF]">50,000+</div>
                            <p className="text-xs sm:text-sm font-bold text-gray-800 mt-1">Happy Customers</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">Across 500+ Indian cities</p>
                        </div>
                        <div className="pt-4 sm:pt-0 sm:pl-6">
                            <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#007FFF]">10,000+</div>
                            <p className="text-xs sm:text-sm font-bold text-gray-800 mt-1">Quality Products</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">Directly sourced & verified</p>
                        </div>
                        <div className="pt-4 sm:pt-0 sm:pl-6">
                            <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#007FFF]">99.4%</div>
                            <p className="text-xs sm:text-sm font-bold text-gray-800 mt-1">Satisfaction Rate</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">Verified customer reviews</p>
                        </div>
                        <div className="pt-4 sm:pt-0 sm:pl-6">
                            <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#007FFF]">24 / 7</div>
                            <p className="text-xs sm:text-sm font-bold text-gray-800 mt-1">Helpdesk Support</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">WhatsApp & phone hotline</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                3. OUR STORY & WHAT DRIVES US
            ══════════════════════════════════════════════════════ */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
                <div className="bg-white rounded-3xl border border-gray-200/90 overflow-hidden shadow-xs">
                    <div className="grid md:grid-cols-12 items-center">
                        <div className="md:col-span-7 p-6 sm:p-10 lg:p-12 space-y-4">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#007FFF] text-xs font-bold border border-blue-100">
                                <Store className="w-3.5 h-3.5" />
                                <span>Our Story & Mission</span>
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                                Eliminating friction in modern e-commerce.
                            </h2>
                            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                                Zelton was founded with a singular purpose: to deliver transparent, high-quality, and dependable products without the hidden compromises common in online marketplaces.
                            </p>
                            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                                From state-of-the-art warehousing and automated inventory sync to strict multi-checkpoint quality checks, every order placed on Zelton is handled with accuracy and speed. We partner with India’s leading logistics networks like Delhivery to ensure rapid doorstep dispatch.
                            </p>

                            <div className="pt-2 grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-900">
                                        <CheckCircle2 className="w-4 h-4 text-[#007FFF]" />
                                        <span>Direct Sourcing</span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 mt-1">No middlemen, fair pricing</p>
                                </div>
                                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-900">
                                        <CheckCircle2 className="w-4 h-4 text-[#007FFF]" />
                                        <span>Safe Packaging</span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 mt-1">Tamper-proof bubble safety</p>
                                </div>
                            </div>
                        </div>

                        {/* Visual Capability Card on Right */}
                        <div className="md:col-span-5 bg-gradient-to-br from-[#0c2340] to-[#1a3d68] text-white p-8 sm:p-10 h-full flex flex-col justify-between space-y-6">
                            <div>
                                <span className="text-xs font-bold uppercase tracking-wider text-blue-300">The Zelton Infrastructure</span>
                                <h3 className="text-xl sm:text-2xl font-bold mt-2 text-white">Built for Reliability & Speed</h3>
                                <p className="text-xs text-blue-100 mt-2 leading-relaxed">
                                    Our fulfillment systems track every item from vendor arrival to final delivery confirmation.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/10 border border-white/10 backdrop-blur-sm">
                                    <Package className="w-5 h-5 text-blue-300 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-xs font-bold">Smart Barcode Scanning</h4>
                                        <p className="text-[11px] text-blue-200">Zero error dispatch rate on orders</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/10 border border-white/10 backdrop-blur-sm">
                                    <Truck className="w-5 h-5 text-emerald-300 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-xs font-bold">Automated Waybill & Tracking</h4>
                                        <p className="text-[11px] text-blue-200">Instant SMS & WhatsApp delivery links</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/10 border border-white/10 backdrop-blur-sm">
                                    <RotateCcw className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-xs font-bold">Rapid Return Turnaround</h4>
                                        <p className="text-[11px] text-blue-200">24-hour return verification & refunds</p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 text-xs text-blue-200 flex items-center justify-between border-t border-white/10">
                                <span>Delhivery Certified Logistics</span>
                                <span className="font-bold text-white">Pan-India Reach</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                4. FOUNDER & LEADERSHIP VISION (Amazon Style Leadership)
            ══════════════════════════════════════════════════════ */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
                <div className="bg-white rounded-3xl border border-gray-200/90 p-6 sm:p-10 shadow-xs">
                    <div className="grid md:grid-cols-12 gap-8 items-center">
                        {/* Founder Image / Card */}
                        <div className="md:col-span-5 flex justify-center">
                            <div className="relative group w-full max-w-[320px] rounded-2xl overflow-hidden shadow-lg border border-gray-200 bg-gray-100">
                                <div className="aspect-4/5 w-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center relative overflow-hidden">
                                    <img
                                        src="/owner-profile.png"
                                        alt="Gurwinder Singh - Founder & CEO, Zelton"
                                        onError={(e) => {
                                            // Fallback if image doesn't exist
                                            (e.currentTarget as HTMLElement).style.display = 'none';
                                        }}
                                        className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                                    />
                                    {/* Fallback Icon Container if image is missing */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 pointer-events-none p-4 text-center">
                                        <div className="w-16 h-16 rounded-full bg-white text-[#007FFF] flex items-center justify-center font-bold text-2xl shadow-md mb-2">
                                            G
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 bg-white border-t border-gray-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-sm text-gray-900">Gurwinder Singh</h4>
                                            <p className="text-xs text-[#007FFF] font-semibold">Founder & CEO, Zelton</p>
                                        </div>
                                        <div className="w-7 h-7 rounded-full bg-blue-50 text-[#007FFF] flex items-center justify-center" title="Verified Founder">
                                            <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Founder Message & Quote */}
                        <div className="md:col-span-7 space-y-4">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-[#007FFF] rounded-full text-xs font-bold border border-blue-100">
                                <Quote className="w-3.5 h-3.5" />
                                <span>A Word From Our Leadership</span>
                            </div>

                            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                                &quot;We win when our customers win.&quot;
                            </h2>

                            {/* Quote Box */}
                            <div className="relative bg-blue-50/40 p-5 sm:p-6 rounded-2xl border border-blue-100/80">
                                <Quote className="w-8 h-8 text-[#007FFF]/15 absolute top-4 right-4 pointer-events-none" />
                                <p className="text-gray-700 italic text-xs sm:text-sm md:text-base leading-relaxed relative z-10">
                                    &ldquo;At Zelton, our philosophy is anchored in a simple truth: genuine customer satisfaction is the only metric that matters. Every brand partnership, product catalog, and delivery workflow is designed with one goal — to give you complete peace of mind when shopping with us.&rdquo;
                                </p>
                            </div>

                            {/* Core Pillars */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                    <span>Direct Manufacturer Sourcing</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                    <span>Zero Compromise on Quality</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                    <span>Customer-First Return Policies</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                    <span>Fast & Secure Payment Processing</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                5. THE 4 PILLARS OF ZELTON (Why Choose Us)
            ══════════════════════════════════════════════════════ */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
                <div className="text-center max-w-2xl mx-auto mb-8 space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#007FFF]">Why Choose Us</span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">The 4 Customer Commitments</h2>
                    <p className="text-xs sm:text-sm text-gray-500">
                        Standards and safeguards built into every purchase you make on Zelton.
                    </p>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200/90 shadow-2xs hover:shadow-md hover:border-[#007FFF]/40 transition-all">
                        <div className="w-10 h-10 bg-blue-50 text-[#007FFF] rounded-xl flex items-center justify-center mb-4 border border-blue-100">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-gray-900 text-sm mb-1">100% Genuine Quality</h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Multi-checkpoint verification ensures that every item is authentic, durable, and brand-certified.
                        </p>
                    </div>

                    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200/90 shadow-2xs hover:shadow-md hover:border-[#007FFF]/40 transition-all">
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4 border border-emerald-100">
                            <Truck className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-gray-900 text-sm mb-1">Express Dispatch</h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Orders processed within 24 hours with live courier tracking updates sent straight to your phone.
                        </p>
                    </div>

                    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200/90 shadow-2xs hover:shadow-md hover:border-[#007FFF]/40 transition-all">
                        <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4 border border-purple-100">
                            <RotateCcw className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-gray-900 text-sm mb-1">7-Day Easy Returns</h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Hassle-free return and replacement policy with instant UPI or direct bank refunds.
                        </p>
                    </div>

                    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200/90 shadow-2xs hover:shadow-md hover:border-[#007FFF]/40 transition-all">
                        <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4 border border-amber-100">
                            <Headphones className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-gray-900 text-sm mb-1">24/7 Dedicated Care</h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Dedicated customer support team available through WhatsApp, phone hotline, and email tickets.
                        </p>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                6. POPULAR PRODUCT CATEGORIES
            ══════════════════════════════════════════════════════ */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
                <div className="bg-gradient-to-br from-blue-50/70 via-white to-blue-50/40 rounded-3xl p-6 sm:p-8 border border-blue-100 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-[#007FFF]">Curated Catalog</span>
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">Explore Our Top Collections</h2>
                        </div>
                        <Link
                            href="/categories"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#007FFF] hover:underline"
                        >
                            <span>View All Categories</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {[
                            { name: 'Electronics', count: 'Latest Tech', href: '/products' },
                            { name: 'Fashion & Travel', count: 'Trending Styles', href: '/products' },
                            { name: 'Displays & TVs', count: 'Ultra HD Visuals', href: '/products' },
                            { name: 'Wearables & Audio', count: 'Smart Watches', href: '/products' },
                            { name: 'Furniture & Living', count: 'Modern Decor', href: '/products' },
                            { name: 'Lifestyle & Care', count: 'Daily Essentials', href: '/products' }
                        ].map((cat, idx) => (
                            <Link
                                key={idx}
                                href={cat.href}
                                className="bg-white rounded-2xl p-4 border border-gray-200/80 hover:border-[#007FFF] hover:shadow-md transition-all group flex flex-col justify-between"
                            >
                                <h3 className="font-bold text-xs sm:text-sm text-gray-900 group-hover:text-[#007FFF] transition-colors truncate">
                                    {cat.name}
                                </h3>
                                <p className="text-[11px] text-gray-500 mt-1">
                                    {cat.count}
                                </p>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                7. BOTTOM CALL TO ACTION
            ══════════════════════════════════════════════════════ */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 text-center">
                <div className="bg-gradient-to-b from-[#0F172A] to-[#1E293B] text-white rounded-3xl p-8 sm:p-12 shadow-md relative overflow-hidden">
                    <div className="max-w-xl mx-auto space-y-4 relative z-10">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Start Shopping Today</span>
                        </span>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
                            Experience the Zelton difference.
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                            Discover authentic products, exclusive discounts, and seamless doorstep delivery across India.
                        </p>
                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                            <Link
                                href="/products"
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#007FFF] hover:bg-[#0066CC] active:scale-[0.98] text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-500/25 transition-all"
                            >
                                <ShoppingBag className="w-4 h-4" />
                                <span>Browse All Products</span>
                            </Link>
                            <Link
                                href="/contact-us"
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs sm:text-sm backdrop-blur-sm transition-all"
                            >
                                <Headphones className="w-4 h-4 text-blue-300" />
                                <span>Get in Touch</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

        </div>
    );
}
