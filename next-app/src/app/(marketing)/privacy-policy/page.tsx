'use client';

import React from 'react';
import Link from 'next/link';
import {
    Lock,
    UserCheck,
    Database,
    AlertCircle,
    CheckCircle2,
    ShieldCheck,
    Clock,
    Headphones,
    KeyRound,
    Check
} from 'lucide-react';

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-[#F8FAFC] text-gray-900 pb-20 sm:pb-16">

            {/* ══════════════════════════════════════════════════════
                1. HERO SECTION (Clean E-Commerce Privacy Header)
            ══════════════════════════════════════════════════════ */}
            <section className="bg-gradient-to-b from-[#EEF6FF] via-[#F8FAFC] to-[#F8FAFC] border-b border-blue-100/70 pt-6 pb-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-5xl mx-auto">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-5 font-medium">
                        <Link href="/" className="hover:text-[#007FFF] transition-colors">Home</Link>
                        <span>›</span>
                        <span className="text-gray-500">Security & Compliance</span>
                        <span>›</span>
                        <span className="text-[#007FFF] font-semibold">Privacy Policy</span>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-2">
                        <div className="space-y-2.5 max-w-2xl">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-[#007FFF] text-xs font-bold shadow-2xs">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>256-Bit SSL Encrypted & Data Protected</span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#0F172A] tracking-tight">
                                Privacy Policy & Data Protection
                            </h1>
                            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                                We value the trust you place in us. This document outlines how your personal information is collected, processed, and safeguarded when shopping on Zelton.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <Link
                                href="/contact-us"
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/90 text-gray-800 font-bold text-xs shadow-2xs transition-all hover:border-[#007FFF]/50"
                            >
                                <Headphones className="w-3.5 h-3.5 text-[#007FFF]" />
                                <span>Privacy Officer Contact</span>
                            </Link>
                        </div>
                    </div>

                    {/* Meta Bar */}
                    <div className="mt-4 pt-4 border-t border-blue-100/60 flex items-center gap-4 sm:gap-6 flex-wrap text-[11px] font-semibold text-gray-500">
                        <div className="flex items-center gap-1.5 text-gray-700">
                            <Clock className="w-3.5 h-3.5 text-[#007FFF]" />
                            <span>Effective: February 2026</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>PCI-DSS & SSL Compliant</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-700">
                            <Lock className="w-3.5 h-3.5 text-purple-600" />
                            <span>Zero Third-Party Data Selling</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                2. MAIN CONTENT (Card-Based Structured Privacy Policy)
            ══════════════════════════════════════════════════════ */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
                <div className="bg-white rounded-3xl border border-gray-200/90 p-6 sm:p-10 shadow-xs space-y-10">

                    {/* Section 1: Overview */}
                    <div>
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#007FFF] flex items-center justify-center font-bold text-xs border border-blue-100">
                                1
                            </div>
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Commitment to User Privacy</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                            Zelton respects your privacy and is committed to protecting the personally identifiable information you share with us. We adhere to the highest consumer data protection standards in India and ensure that all customer interactions remain confidential and secure.
                        </p>
                    </div>

                    {/* Section 2: Information We Collect */}
                    <div>
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#007FFF] flex items-center justify-center font-bold text-xs border border-blue-100">
                                2
                            </div>
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Information We Collect</h2>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4 text-xs sm:text-sm text-gray-600">
                            <div className="bg-gray-50/70 p-4 sm:p-5 rounded-2xl border border-gray-100 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-gray-900">
                                    <UserCheck className="w-4 h-4 text-[#007FFF]" />
                                    <span>Personal & Delivery Details</span>
                                </div>
                                <ul className="space-y-1.5 text-gray-600">
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#007FFF] font-bold">•</span>
                                        <span>Full name, email address, and active mobile number</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#007FFF] font-bold">•</span>
                                        <span>Shipping & billing address with pincode</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#007FFF] font-bold">•</span>
                                        <span>Order history, reviews, and support ticket records</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-gray-50/70 p-4 sm:p-5 rounded-2xl border border-gray-100 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-gray-900">
                                    <Database className="w-4 h-4 text-[#007FFF]" />
                                    <span>Automated Technical Data</span>
                                </div>
                                <ul className="space-y-1.5 text-gray-600">
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#007FFF] font-bold">•</span>
                                        <span>Device type, browser version, and IP address</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#007FFF] font-bold">•</span>
                                        <span>Session cookies for login authentication and cart persistence</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#007FFF] font-bold">•</span>
                                        <span>Anonymized usage analytics to optimize site performance</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: How We Use Your Data */}
                    <div>
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#007FFF] flex items-center justify-center font-bold text-xs border border-blue-100">
                                3
                            </div>
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">How We Use Collected Information</h2>
                        </div>
                        <div className="bg-gray-50/60 rounded-2xl p-4 sm:p-5 border border-gray-100 space-y-2.5 text-xs sm:text-sm text-gray-600">
                            <div className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                <span><strong>Order Fulfillment:</strong> Processing transactions, printing shipping waybills, and delivering packages to your doorstep.</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                <span><strong>Delivery Notifications:</strong> Dispatching real-time SMS and WhatsApp updates regarding shipment tracking and estimated delivery dates.</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                <span><strong>Customer Support:</strong> Assisting you with returns, replacements, refunds, or general product inquiries.</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                <span><strong>Fraud Prevention:</strong> Detecting fraudulent transactions and securing payment gateway interactions.</span>
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Data Security Protocols */}
                    <div>
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#007FFF] flex items-center justify-center font-bold text-xs border border-blue-100">
                                4
                            </div>
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Data Protection & Payment Security</h2>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4 text-xs sm:text-sm text-gray-600">
                            <div className="bg-blue-50/40 p-4 sm:p-5 rounded-2xl border border-blue-100 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-blue-900">
                                    <Lock className="w-4 h-4 text-[#007FFF]" />
                                    <span>256-Bit SSL Encryption</span>
                                </div>
                                <p className="leading-relaxed">
                                    All data exchanged between your browser and our servers is secured via industry-standard SSL encryption. We never store raw debit/credit card CVVs.
                                </p>
                            </div>

                            <div className="bg-emerald-50/40 p-4 sm:p-5 rounded-2xl border border-emerald-100 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-emerald-900">
                                    <KeyRound className="w-4 h-4 text-emerald-600" />
                                    <span>Zero Data Selling Promise</span>
                                </div>
                                <p className="leading-relaxed">
                                    We strictly do not sell, lease, or rent customer personal information to third-party advertisers. Your data is used exclusively for service fulfillment.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Section 5: Customer Rights */}
                    <div>
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#007FFF] flex items-center justify-center font-bold text-xs border border-blue-100">
                                5
                            </div>
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Your Privacy Rights & Choices</h2>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-3">
                            As a valued Zelton customer, you have full control over your personal data:
                        </p>
                        <div className="grid sm:grid-cols-2 gap-3 text-xs sm:text-sm text-gray-700 font-medium">
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-[#007FFF]" />
                                <span>Right to review & update address book</span>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-[#007FFF]" />
                                <span>Right to request complete account deletion</span>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-[#007FFF]" />
                                <span>Right to opt out of promotional emails</span>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-[#007FFF]" />
                                <span>Right to manage non-essential browser cookies</span>
                            </div>
                        </div>
                    </div>

                    {/* Contact & Support Notice */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50/60 rounded-2xl p-5 sm:p-6 border border-blue-100 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white text-[#007FFF] flex items-center justify-center flex-shrink-0 shadow-2xs border border-blue-100">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-bold text-sm text-gray-900">Contact the Privacy & Compliance Team</h3>
                            <p className="text-xs text-gray-600">
                                If you have questions regarding our data collection policies or wish to exercise your data rights:
                            </p>
                            <div className="pt-1 flex flex-wrap gap-4 text-xs font-semibold text-gray-800">
                                <span>Email: <a href="mailto:privacy@zelton.co.in" className="text-[#007FFF] hover:underline">privacy@zelton.co.in</a></span>
                                <span>Customer Desk: <a href="tel:+919729310456" className="text-[#007FFF] hover:underline">+91 9729310456</a></span>
                            </div>
                        </div>
                    </div>

                </div>
            </section>

        </div>
    );
}
