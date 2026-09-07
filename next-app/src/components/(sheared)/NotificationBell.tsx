"use client";

import React, { useState, useRef, useEffect } from "react";
import { Bell, Check, CheckCheck, Trash2, ExternalLink, ShoppingBag, Mail, Info, X, ShieldAlert, Sparkles, Truck, RefreshCw, Layers } from "lucide-react";
import { useNotifications, AppNotification } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function NotificationBell() {
  const pathname = usePathname();
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    activeToast,
    clearActiveToast,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const isAdminView = pathname?.startsWith("/dashboard") || ["Admin", "Manager", "superadmin"].includes(user?.role || "");
  const viewAllUrl = isAdminView ? "/dashboard/notifications" : "/notifications";
  const themeAccentClass = "text-[#007FFF]";
  const themeHoverClass = "hover:text-[#0066CC]";

  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calculate exact unread count based on loaded notifications state
  const unreadInState = notifications.filter((n) => !n.isRead).length;
  const effectiveUnreadCount = notifications.length > 0 && notifications.length <= unreadCount ? unreadInState : unreadCount;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-dismiss active toast after 6 seconds
  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        clearActiveToast();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [activeToast, clearActiveToast]);

  const filteredNotifications = notifications.filter((n) =>
    filter === "unread" ? !n.isRead : true
  );

  const getNotificationIcon = (type: string) => {
    const t = (type || "").toUpperCase();
    if (t.startsWith("ORDER")) return <ShoppingBag className={`w-4 h-4 ${themeAccentClass}`} />;
    if (t.startsWith("PAYMENT")) return <Sparkles className="w-4 h-4 text-emerald-600" />;
    if (t.startsWith("SHIPMENT") || t.startsWith("DELIVERY")) return <Truck className="w-4 h-4 text-indigo-600" />;
    if (t.startsWith("RETURN") || t.startsWith("REFUND")) return <RefreshCw className="w-4 h-4 text-amber-600" />;
    if (t.startsWith("SECURITY") || t.startsWith("PASSWORD") || t === "ACCOUNT") return <ShieldAlert className="w-4 h-4 text-red-600" />;
    if (t === "CONTACT") return <Mail className="w-4 h-4 text-purple-600" />;
    return <Info className="w-4 h-4 text-gray-600" />;
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return "Just now";
    try {
      const raw = String(dateStr).trim();
      const cleanStr = raw.replace("Z", "").replace("T", " ");
      const parts = cleanStr.split(".")[0].split(/[- :]/);

      let d: Date;
      if (parts.length >= 6) {
        const year = Number(parts[0]);
        const month = Number(parts[1]) - 1;
        const day = Number(parts[2]);
        const hour = Number(parts[3]);
        const minute = Number(parts[4]);
        const second = Number(parts[5]);
        d = new Date(year, month, day, hour, minute, second || 0);
      } else {
        d = new Date(raw);
      }

      if (isNaN(d.getTime())) return "Just now";

      const now = new Date();
      let diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
      if (diffSec < 0) diffSec = Math.abs(diffSec);

      if (diffSec < 45) return "Just now";
      if (diffSec < 3600) return `${Math.max(1, Math.floor(diffSec / 60))}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      if (diffSec < 2592000) return `${Math.floor(diffSec / 86400)}d ago`;

      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch (e) {
      return "Just now";
    }
  };

  const getItemLink = (n: AppNotification) => {
    if (!isAdminView) {
      const type = (n.type || "").toUpperCase();
      if (type.startsWith("ORDER") || !n.link || n.link === "/orders" || n.link.startsWith("/orders")) {
        return "/profile?tab=orders";
      }
    }
    return n.link || (isAdminView ? "/dashboard/orders" : "/profile?tab=orders");
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 sm:p-2 rounded-full text-gray-800 hover:text-black hover:bg-gray-100 transition-all focus:outline-none flex items-center justify-center"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className={`w-5 h-5 sm:w-5.5 sm:h-5.5 ${effectiveUnreadCount > 0 ? themeAccentClass : "text-gray-900"}`} />
        {effectiveUnreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-bold text-white bg-red-600 rounded-full border-2 border-white shadow-xs pointer-events-none">
            {effectiveUnreadCount > 99 ? "99+" : effectiveUnreadCount}
          </span>
        )}
      </button>

      {/* Floating Drawer / Dropdown */}
      {isOpen && (
        <div className="absolute -right-16 sm:right-0 mt-3 w-[310px] sm:w-80 md:w-96 max-w-[calc(100vw-20px)] bg-white border border-gray-200 rounded-2xl shadow-2xl z-[9999] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 bg-gray-50/80">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
              {effectiveUnreadCount > 0 && (
                <span className="px-2.5 py-0.5 text-[11px] font-bold bg-red-100 text-red-700 rounded-full">
                  {effectiveUnreadCount > 99 ? "99+" : effectiveUnreadCount} unread
                </span>
              )}
            </div>

            {effectiveUnreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className={`flex items-center gap-1 text-xs font-bold ${themeAccentClass} ${themeHoverClass} hover:underline transition-colors`}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-gray-100 px-4 py-2 gap-2 bg-white">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${filter === "all"
                  ? "bg-[#0A0908] text-white shadow-xs"
                  : "text-gray-600 hover:bg-gray-100"
                }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${filter === "unread"
                  ? "bg-[#0A0908] text-white shadow-xs"
                  : "text-gray-600 hover:bg-gray-100"
                }`}
            >
              Unread ({effectiveUnreadCount})
            </button>
          </div>

          {/* Notification Items List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-100 bg-white">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 text-center px-4">
                <Bell className="w-9 h-9 mx-auto text-gray-300 mb-2 stroke-[1.5]" />
                <p className="text-xs font-semibold text-gray-500">
                  {filter === "unread" ? "No unread notifications" : "No notifications yet"}
                </p>
              </div>
            ) : (
              filteredNotifications.slice(0, 10).map((n) => {
                const targetLink = getItemLink(n);
                return (
                  <div
                    key={n.id}
                    className={`p-3.5 flex gap-3 transition-colors ${!n.isRead
                        ? "bg-blue-50/60"
                        : "hover:bg-gray-50"
                      }`}
                  >
                    <div className="p-2 rounded-xl bg-gray-100 h-fit shrink-0">
                      {getNotificationIcon(n.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1 mb-0.5">
                        <h4 className="text-xs font-bold text-gray-900 truncate">
                          {n.title}
                        </h4>
                        <span className="text-[10px] text-gray-400 shrink-0 font-medium">{formatTime(n.createdAt)}</span>
                      </div>

                      <p className="text-xs text-gray-600 line-clamp-2 leading-snug mb-2">
                        {n.message}
                      </p>

                      <div className="flex items-center gap-3">
                        {targetLink && (
                          <Link
                            href={targetLink}
                            onClick={() => {
                              if (!n.isRead) markAsRead(n.id);
                              setIsOpen(false);
                            }}
                            className={`inline-flex items-center gap-1 text-[11px] font-bold ${themeAccentClass} ${themeHoverClass} hover:underline`}
                          >
                            View Details <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}

                        {!n.isRead && (
                          <button
                            onClick={() => markAsRead(n.id)}
                            className="text-[11px] font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Mark read
                          </button>
                        )}

                        <button
                          onClick={() => deleteNotification(n.id)}
                          className="ml-auto text-gray-400 hover:text-red-600 transition-colors p-1"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Link to Dedicated Page */}
          <div className="p-3 border-t border-gray-100 bg-gray-50/80 text-center">
            <Link
              href={viewAllUrl}
              onClick={() => setIsOpen(false)}
              className={`inline-flex items-center justify-center gap-1.5 text-xs font-extrabold ${themeAccentClass} ${themeHoverClass} hover:underline w-full py-1`}
            >
              <Layers className="w-3.5 h-3.5" />
              View All Notifications
            </Link>
          </div>
        </div>
      )}

      {/* Interactive Toast Popup Banner on Screen Bottom Right */}
      {activeToast && (
        <div className="fixed bottom-5 right-5 z-[99999] max-w-sm w-full bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 flex gap-3.5 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="p-2.5 rounded-xl bg-blue-50 h-fit shrink-0">
            {getNotificationIcon(activeToast.type)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="text-xs font-bold text-gray-900">{activeToast.title}</h4>
              <button
                onClick={clearActiveToast}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed mb-2">
              {activeToast.message}
            </p>
            <Link
              href={getItemLink(activeToast)}
              onClick={clearActiveToast}
              className={`inline-flex items-center gap-1 text-xs font-bold ${themeAccentClass} ${themeHoverClass} hover:underline`}
            >
              View Now <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
