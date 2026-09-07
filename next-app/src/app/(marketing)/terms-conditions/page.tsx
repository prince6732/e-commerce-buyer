'use client';

import React from 'react';
import Link from 'next/link';
import {
    FileText,
    ShoppingCart,
    Package,
    RotateCcw,
    ShieldCheck,
    AlertCircle,
    CheckCircle2,
    Lock,
    Scale,
    HelpCircle,
    ArrowRight,
    Headphones,
    Clock,
    Globe
} from 'lucide-react';

export default function TermsConditionsPage() {
    return (
        <div className="min-h-screen bg-[#F8FAFC] text-gray-900 pb-20 sm:pb-16">

            {/* ══════════════════════════════════════════════════════
                1. HERO SECTION (Clean E-Commerce Legal Header)
            ══════════════════════════════════════════════════════ */}
            <section className="bg-gradient-to-b from-[#EEF6FF] via-[#F8FAFC] to-[#F8FAFC] border-b border-blue-100/70 pt-6 pb-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-5xl mx-auto">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-5 font-medium">
                        <Link href="/" className="hover:text-[#007FFF] transition-colors">Home</Link>
                        <span>›</span>
                        <span className="text-gray-500">Legal & Policy</span>
                        <span>›</span>
                        <span className="text-[#007FFF] font-semibold">Terms & Conditions</span>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-2">
                        <div className="space-y-2.5 max-w-2xl">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-[#007FFF] text-xs font-bold shadow-2xs">
                                <Scale className="w-3.5 h-3.5" />
                                <span>Platform Agreement & Guidelines</span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#0F172A] tracking-tight">
                                Terms & Conditions of Service
                            </h1>
                            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                                Please review these terms carefully before browsing or placing orders on Zelton. By using our platform, you agree to these legal conditions.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <Link
                                href="/contact-us"
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/90 text-gray-800 font-bold text-xs shadow-2xs transition-all hover:border-[#007FFF]/50"
                            >
                                <Headphones className="w-3.5 h-3.5 text-[#007FFF]" />
                                <span>Need Help? Contact Us</span>
                            </Link>
                        </div>
                    </div>

                    {/* Meta Bar */}
                    <div className="mt-4 pt-4 border-t border-blue-100/60 flex items-center gap-4 sm:gap-6 flex-wrap text-[11px] font-semibold text-gray-500">
                        <div className="flex items-center gap-1.5 text-gray-700">
                            <Clock className="w-3.5 h-3.5 text-[#007FFF]" />
                            <span>Last Updated: February 2026</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Governed by the Laws of India</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-700">
                            <Globe className="w-3.5 h-3.5 text-purple-600" />
                            <span>Applies to Web & Mobile Platform</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                2. MAIN CONTENT (Card-Based Structured Legal Terms)
            ══════════════════════════════════════════════════════ */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
                <div className="bg-white rounded-3xl border border-gray-200/90 p-6 sm:p-10 shadow-xs space-y-10">

                    {/* Section 1: Introduction */}
                    <div>
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#007FFF] flex items-center justify-center font-bold text-xs border border-blue-100">
                                1
                            </div>
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Introduction & Acceptance of Terms</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                            Welcome to Zelton (&quot;Zelton&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;). These Terms and Conditions govern your access to and use of the website, mobile services, and purchasing systems. By accessing, browsing, or placing an order on our platform, you acknowledge that you have read, understood, and agreed to be bound by these Terms and our Privacy Policy.
                        </p>
                    </div>

                    {/* Section 2: Account Terms & Eligibility */}
                    <div>
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#007FFF] flex items-center justify-center font-bold text-xs border border-blue-100">
                                2
                            </div>
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Account Registration & Security</h2>
                        </div>
                        <div className="bg-gray-50/60 rounded-2xl p-4 sm:p-5 border border-gray-100 space-y-2 text-xs sm:text-sm text-gray-600">
                            <div className="flex items-start gap-2">
                                <span className="text-[#007FFF] font-bold mt-0.5">•</span>
                                <span>You must be at least 18 years of age or possess legal parental/guardian consent to make purchases.</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-[#007FFF] font-bold mt-0.5">•</span>
                                <span>You are solely responsible for maintaining the confidentiality of your login credentials and password.</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-[#007FFF] font-bold mt-0.5">•</span>
                                <span>You agree to provide true, accurate, and current contact and address details during checkout.</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-[#007FFF] font-bold mt-0.5">•</span>
                                <span>Zelton reserves the right to suspend or terminate accounts that engage in fraudulent behavior or policy violations.</span>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Orders & Pricing */}
                    <div>
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#007FFF] flex items-center justify-center font-bold text-xs border border-blue-100">
                                3
                            </div>
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Orders, Pricing & Payments</h2>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4 text-xs sm:text-sm text-gray-600">
                            <div className="bg-gray-50/70 p-4 sm:p-5 rounded-2xl border border-gray-100 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-gray-900">
                                    <ShoppingCart className="w-4 h-4 text-[#007FFF]" />
                                    <span>Order Placement & Verification</span>
                                </div>
                                <p className="leading-relaxed">
                                    All orders are subject to stock availability and validation checks. Order confirmation emails or SMS do not signify final acceptance; Zelton reserves the right to cancel any order due to pricing errors or inventory discrepancies.
                                </p>
                            </div>

                            <div className="bg-gray-50/70 p-4 sm:p-5 rounded-2xl border border-gray-100 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-gray-900">
                                    <Lock className="w-4 h-4 text-[#007FFF]" />
                                    <span>Currency & Secure Payments</span>
                                </div>
                                <p className="leading-relaxed">
                                    All transactions are processed in Indian National Rupees (INR). We accept major Credit/Debit cards, UPI (Google Pay, PhonePe, Paytm), Net Banking, and Cash on Delivery (COD). Payment gateways are 256-bit encrypted and PCI-DSS compliant.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Shipping & Logistics */}
                    <div>
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#007FFF] flex items-center justify-center font-bold text-xs border border-blue-100">
                                4
                            </div>
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Shipping, Delivery & Risk of Loss</h2>
                        </div>
                        <div className="bg-gray-50/60 rounded-2xl p-4 sm:p-5 border border-gray-100 space-y-2 text-xs sm:text-sm text-gray-600">
                            <div className="flex items-start gap-2">
                                <span className="text-[#007FFF] font-bold mt-0.5">•</span>
                                <span>Estimated delivery times (typically 3–6 business days) are approximate and may vary due to logistics or location factors.</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-[#007FFF] font-bold mt-0.5">•</span>
                                <span>Shipment tracking information will be provided via SMS and WhatsApp once the package is dispatched with our courier partners (Delhivery, etc.).</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-[#007FFF] font-bold mt-0.5">•</span>
                                <span>Risk of loss transfers to the customer once physical delivery has been completed and verified at the provided shipping address.</span>
                            </div>
                        </div>
                    </div>

                    {/* Section 5: Returns & Replacements */}
                    <div>
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#007FFF] flex items-center justify-center font-bold text-xs border border-blue-100">
                                5
                            </div>
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">7-Day Return & Replacement Policy</h2>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4 text-xs sm:text-sm text-gray-600">
                            <div className="bg-emerald-50/40 p-4 sm:p-5 rounded-2xl border border-emerald-100 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-emerald-900">
                                    <RotateCcw className="w-4 h-4 text-emerald-600" />
                                    <span>Return Eligibility</span>
                                </div>
                                <p className="leading-relaxed">
                                    Eligible items may be returned or replaced within 7 days of delivery. Items must be unused, unwashed, with all original tags, boxes, and accessories intact.
                                </p>
                            </div>

                            <div className="bg-blue-50/40 p-4 sm:p-5 rounded-2xl border border-blue-100 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-blue-900">
                                    <ShieldCheck className="w-4 h-4 text-[#007FFF]" />
                                    <span>Refund Disbursement</span>
                                </div>
                                <p className="leading-relaxed">
                                    Upon return verification at our fulfillment warehouse, refunds are initiated within 24 hours to the original payment mode or verified UPI account for COD orders.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Section 6: Intellectual Property & Governing Law */}
                    <div>
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#007FFF] flex items-center justify-center font-bold text-xs border border-blue-100">
                                6
                            </div>
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Intellectual Property & Governing Law</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                            All materials, trademarks, brand logos, product descriptions, website designs, and source code are the exclusive intellectual property of Zelton. These terms are governed by the laws of India. Any legal dispute shall be subject to the exclusive jurisdiction of the competent courts in India.
                        </p>
                    </div>

                    {/* Contact & Support Notice */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50/60 rounded-2xl p-5 sm:p-6 border border-blue-100 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white text-[#007FFF] flex items-center justify-center flex-shrink-0 shadow-2xs border border-blue-100">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-bold text-sm text-gray-900">Questions or Clarifications?</h3>
                            <p className="text-xs text-gray-600">
                                For inquiries concerning these Terms & Conditions or order compliance, contact our legal and customer team:
                            </p>
                            <div className="pt-1 flex flex-wrap gap-4 text-xs font-semibold text-gray-800">
                                <span>Email: <a href="mailto:legal@zelton.co.in" className="text-[#007FFF] hover:underline">legal@zelton.co.in</a></span>
                                <span>Phone: <a href="tel:+919729310456" className="text-[#007FFF] hover:underline">+91 9729310456</a></span>
                            </div>
                        </div>
                    </div>

                </div>
            </section>

        </div>
    );
}
