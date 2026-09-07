"use client";

import { Menu, User, LogOut, Home } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import NotificationBell from "@/components/(sheared)/NotificationBell";
import { useAddProductModal } from "@/context/AddProductModalContext";

interface HeaderProps {
    onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
    const { user, logout } = useAuth();
    const { openAddProductModal } = useAddProductModal();
    const router = useRouter();
    const [showUserModal, setShowUserModal] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                setShowUserModal(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleLogout = async () => {
        await logout();
        router.push("/");
    };

    return (
        <header className="sticky top-0 z-50 lg:mx-3 lg:mt-2 backdrop-blur-xl bg-white/80 border border-white/50 shadow-[0_4px_20px_rgba(0,0,0,0.05)] lg:rounded-2xl">
            <div className="flex items-center justify-between px-4 py-3">

                {/* Left Section */}
                <div className="flex items-center gap-4">
                    {/* Sidebar Toggle */}
                    <button
                        onClick={onToggleSidebar}
                        aria-label="Toggle Sidebar"
                        className="p-2 rounded-xl text-gray-700 hover:bg-gray-100 hover:text-[#007FFF] transition-all duration-300"
                    >
                        <Menu className="w-6 h-6" />
                    </button>

                    {/* Logo + Title */}
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-[#007FFF] to-[#00AAFF] bg-clip-text text-transparent tracking-wide">
                            Zelton Admin
                        </h1>
                        <p className="text-xs text-gray-500 -mt-0.5">Overview of your store performance</p>
                    </div>
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-3 md:gap-4">

                    {/* Quick Action Button */}
                    <button
                        type="button"
                        onClick={openAddProductModal}
                        className="hidden sm:flex items-center gap-1.5 px-4 py-3 rounded-xl bg-gradient-to-r from-[#007FFF] to-[#0055CC] text-white text-sm font-semibold shadow-xs hover:shadow-md hover:from-[#0066CC] hover:to-[#0044BB] transition-all duration-200 cursor-pointer"
                    >
                        <span>+ Add Product</span>
                    </button>

                    {/* Notifications */}
                    <NotificationBell />

                    {/* User Dropdown */}
                    <div className="relative" ref={modalRef}>
                        <button
                            onClick={() => setShowUserModal((prev) => !prev)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-blue-50 transition-all duration-300"
                        >
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#007FFF] to-[#00AAFF] text-white flex items-center justify-center font-semibold shadow-md">
                                {user?.name?.charAt(0).toUpperCase() || "U"}
                            </div>

                            <span className="hidden md:block text-sm font-medium text-gray-800">
                                {user?.name || "User"}
                            </span>
                        </button>

                        {/* Dropdown Menu */}
                        {showUserModal && (
                            <div
                                className="absolute right-0 top-14 w-60 bg-white shadow-xl border border-gray-100 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">

                                {/* User Info */}
                                <div className="px-4 py-3 bg-gray-50">
                                    <p className="text-sm font-semibold text-gray-900">
                                        {user?.name || "User"}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">{user?.email || ""}</p>
                                </div>

                                {/* Menu Links */}
                                <div className="py-1">
                                    <Link
                                        href="/"
                                        onClick={() => setShowUserModal(false)}
                                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-[#eff6ff] hover:text-[#007FFF] transition-all"
                                    >
                                        <Home className="w-4 h-4" /> Home
                                    </Link>

                                    <Link
                                        href="/profile"
                                        onClick={() => setShowUserModal(false)}
                                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-[#eff6ff] hover:text-[#007FFF] transition-all"
                                    >
                                        <User className="w-4 h-4" /> Profile
                                    </Link>
                                </div>

                                {/* Logout */}
                                <div className="border-t border-gray-100">
                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-all"
                                    >
                                        <LogOut className="w-4 h-4" /> Logout
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>

    );
}
