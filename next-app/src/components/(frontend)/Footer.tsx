"use client";

import React, { useEffect, useState } from "react";
import { FaTelegram, FaWhatsapp, FaInstagram } from "react-icons/fa";
import Link from "next/link";
import { fetchSettingByKey } from "../../../utils/settingsApi";

const Footer = () => {
    const [whatsappNumber, setWhatsappNumber] = useState<string>("919729310456");

    useEffect(() => {
        fetchSettingByKey("whatsapp_number")
            .then((setting) => {
                if (setting?.value) setWhatsappNumber(setting.value);
            })
            .catch(() => { });
    }, []);

    return (
        <footer className="bg-[#0A0908] text-[#FFFAFB] pt-8 pb-24 md:pt-12 md:pb-10 px-5 sm:px-8 md:px-12 tracking-wide border-t border-white/5">
            <div className="w-full max-w-7xl mx-auto">
                {/* Main Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-10 pb-8 border-b border-white/10">

                    {/* Brand & Description (Mobile: Full width, Desktop: 5 cols) */}
                    <div className="lg:col-span-5 space-y-3">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[#FFFAFB] text-2xl sm:text-3xl font-black italic tracking-tight">
                                Zelton
                            </h2>
                        </div>
                        <p className="text-gray-400 text-xs sm:text-sm leading-relaxed max-w-md">
                            Your trusted hub for premium products. Fast, secure, and hassle-free deals. Shop smarter, safer – only on Zelton.
                        </p>

                        {/* Social / Contact Icons */}
                        <div className="pt-2">
                            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold mb-2.5">
                                Connect With Us
                            </p>
                            <div className="flex items-center gap-3">
                                <a
                                    href={`https://wa.me/${whatsappNumber}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="WhatsApp"
                                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/5 hover:bg-[#25D366]/20 border border-white/10 flex items-center justify-center text-[#25D366] transition-all hover:scale-110"
                                >
                                    <FaWhatsapp className="text-lg sm:text-xl" />
                                </a>
                                <a
                                    href="https://t.me/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Telegram"
                                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/5 hover:bg-[#007FFF]/20 border border-white/10 flex items-center justify-center text-[#007FFF] transition-all hover:scale-110"
                                >
                                    <FaTelegram className="text-lg sm:text-xl" />
                                </a>
                                <a
                                    href="https://instagram.com/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Instagram"
                                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/5 hover:bg-pink-500/20 border border-white/10 flex items-center justify-center text-pink-500 transition-all hover:scale-110"
                                >
                                    <FaInstagram className="text-lg sm:text-xl" />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Links Grid: On mobile 2 columns side-by-side to save height */}
                    <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 pt-2 sm:pt-0">
                        {/* Useful Links */}
                        <div>
                            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white mb-3">
                                Useful Links
                            </h3>
                            <ul className="space-y-2 sm:space-y-2.5">
                                <li>
                                    <Link href="/" className="text-gray-400 hover:text-[#007FFF] text-xs sm:text-sm transition-colors block py-0.5">
                                        Featured
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/new-arrivals" className="text-gray-400 hover:text-[#007FFF] text-xs sm:text-sm transition-colors block py-0.5">
                                        New Arrivals
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/categories" className="text-gray-400 hover:text-[#007FFF] text-xs sm:text-sm transition-colors block py-0.5">
                                        All Categories
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/wishlist" className="text-gray-400 hover:text-[#007FFF] text-xs sm:text-sm transition-colors block py-0.5">
                                        My Wishlist
                                    </Link>
                                </li>
                            </ul>
                        </div>

                        {/* Information */}
                        <div>
                            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white mb-3">
                                Information
                            </h3>
                            <ul className="space-y-2 sm:space-y-2.5">
                                <li>
                                    <Link href="/about-us" className="text-gray-400 hover:text-[#007FFF] text-xs sm:text-sm transition-colors block py-0.5">
                                        About Us
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/contact-us" className="text-gray-400 hover:text-[#007FFF] text-xs sm:text-sm transition-colors block py-0.5">
                                        Contact Us
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/terms-conditions" className="text-gray-400 hover:text-[#007FFF] text-xs sm:text-sm transition-colors block py-0.5">
                                        Terms &amp; Conditions
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/privacy-policy" className="text-gray-400 hover:text-[#007FFF] text-xs sm:text-sm transition-colors block py-0.5">
                                        Privacy Policy
                                    </Link>
                                </li>
                            </ul>
                        </div>

                        {/* Customer Care (Tablet/Desktop 3rd col) */}
                        <div className="col-span-2 sm:col-span-1">
                            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white mb-3">
                                Customer Care
                            </h3>
                            <ul className="space-y-2 sm:space-y-2.5">
                                <li>
                                    <Link href="/orders" className="text-gray-400 hover:text-[#007FFF] text-xs sm:text-sm transition-colors block py-0.5">
                                        Track Orders
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/profile" className="text-gray-400 hover:text-[#007FFF] text-xs sm:text-sm transition-colors block py-0.5">
                                        My Account
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar: Copyright */}
                <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                    <p className="text-[11px] sm:text-xs text-gray-500">
                        &copy; {new Date().getFullYear()} Zelton E-Commerce. All rights reserved.
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-gray-500">
                        <Link href="/terms-conditions" className="hover:text-gray-300 transition-colors">Terms</Link>
                        <span>&bull;</span>
                        <Link href="/privacy-policy" className="hover:text-gray-300 transition-colors">Privacy</Link>
                        <span>&bull;</span>
                        <Link href="/contact-us" className="hover:text-gray-300 transition-colors">Support</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;