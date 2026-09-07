"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  ExternalLink,
  ShoppingBag,
  Mail,
  Info,
  ShieldAlert,
  Sparkles,
  Truck,
  RefreshCw,
  SlidersHorizontal,
  Check,
  ArrowLeft,
  X,
  Lock,
} from "lucide-react";
import { useNotifications, NotificationPreference } from "@/context/NotificationContext";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NotificationsPage() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    loading,
    preferences,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    bulkDeleteNotifications,
    updatePreferences,
  } = useNotifications();

  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showPreferencesModal, setShowPreferencesModal] = useState<boolean>(false);
  const [prefState, setPrefState] = useState<Partial<NotificationPreference>>({});

  // Sync preference state when preferences load
  useEffect(() => {
    if (preferences) {
      setPrefState(preferences);
    }
  }, [preferences]);

  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Initial fetch and tab change handler
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    const isUnreadTab = activeTab === "UNREAD";
    const category = isUnreadTab || activeTab === "ALL" ? undefined : activeTab;
    const isRead = isUnreadTab ? false : undefined;

    fetchNotifications({
      category,
      is_read: isRead,
      page: 1,
      limit: 8,
      append: false,
    }).then((moreAvailable) => {
      setHasMore(moreAvailable);
    });
  }, [activeTab, fetchNotifications]);

  // Load next batch on scroll
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const isUnreadTab = activeTab === "UNREAD";
    const category = isUnreadTab || activeTab === "ALL" ? undefined : activeTab;
    const isRead = isUnreadTab ? false : undefined;

    const moreAvailable = await fetchNotifications({
      category,
      is_read: isRead,
      page: nextPage,
      limit: 8,
      append: true,
    });

    setPage(nextPage);
    setHasMore(moreAvailable);
    setLoadingMore(false);
  }, [loadingMore, hasMore, page, activeTab, fetchNotifications]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
        loadMore();
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMore]);

  // Handle select all checkbox
  const toggleSelectAll = () => {
    if (selectedIds.length === notifications.length && notifications.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(notifications.map((n) => n.id));
    }
  };

  // Toggle single selection
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    await bulkDeleteNotifications({ ids: selectedIds });
    setSelectedIds([]);
  };

  const handleBulkDeleteRead = async () => {
    await bulkDeleteNotifications({ allRead: true });
    setSelectedIds([]);
  };

  const handleSavePreferences = async () => {
    await updatePreferences(prefState);
    setShowPreferencesModal(false);
  };

  const getNotificationIcon = (type: string) => {
    const t = (type || "").toUpperCase();
    if (t.startsWith("ORDER")) return <ShoppingBag className="w-5 h-5 text-[#007FFF]" />;
    if (t.startsWith("PAYMENT")) return <Sparkles className="w-5 h-5 text-emerald-600" />;
    if (t.startsWith("SHIPMENT") || t.startsWith("DELIVERY")) return <Truck className="w-5 h-5 text-indigo-600" />;
    if (t.startsWith("RETURN") || t.startsWith("REFUND")) return <RefreshCw className="w-5 h-5 text-amber-600" />;
    if (t.startsWith("SECURITY") || t.startsWith("PASSWORD") || t === "ACCOUNT" || t === "WELCOME") return <ShieldAlert className="w-5 h-5 text-red-600" />;
    if (t === "CONTACT") return <Mail className="w-5 h-5 text-purple-600" />;
    return <Info className="w-5 h-5 text-gray-600" />;
  };

  const getPriorityBadge = (priority?: string) => {
    const p = (priority || "NORMAL").toUpperCase();
    switch (p) {
      case "CRITICAL":
        return <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-red-50 text-red-700 rounded-full border border-red-200">CRITICAL</span>;
      case "HIGH":
        return <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-amber-50 text-amber-700 rounded-full border border-amber-200">HIGH</span>;
      case "LOW":
        return <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-gray-100 text-gray-600 rounded-full border border-gray-200">LOW</span>;
      default:
        return <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-blue-50 text-[#007FFF] rounded-full border border-blue-100">NORMAL</span>;
    }
  };

  const formatTime = (dateStr: string) => {
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

      if (isNaN(d.getTime())) return dateStr;

      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return dateStr;
    }
  };

  const categories = [
    { id: "ALL", label: "All" },
    { id: "UNREAD", label: `Unread (${unreadCount})` },
    { id: "ORDERS", label: "Orders" },
    { id: "PAYMENTS", label: "Payments" },
    { id: "SHIPPING", label: "Shipping" },
    { id: "RETURNS", label: "Returns & Refunds" },
    { id: "PRODUCTS", label: "Products" },
    { id: "ACCOUNT", label: "Account" },
    { id: "MARKETING", label: "Offers" },
  ];

  return (
    <div className="min-h-screen bg-gray-50/70 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  Notification Center
                </h1>
                {unreadCount > 0 && (
                  <span className="px-2.5 py-0.5 text-xs font-bold bg-red-600 text-white rounded-full">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-gray-500 mt-0.5">
                Manage your real-time alerts, order status updates, and notification preferences.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreferencesModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-gray-800 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4 text-gray-700" />
              Preferences
            </button>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#007FFF] hover:bg-blue-700 transition-colors shadow-xs"
              >
                <CheckCheck className="w-4 h-4" />
                Mark All Read
              </button>
            )}
          </div>
        </div>

        {/* Category Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveTab(cat.id);
                setSelectedIds([]);
              }}
              className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${activeTab === cat.id
                  ? "bg-[#0A0908] text-white shadow-xs"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Bulk Action Controls Bar */}
        {notifications.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200 text-xs text-gray-700 shadow-xs">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer font-bold select-none text-gray-900">
                <input
                  type="checkbox"
                  checked={selectedIds.length > 0 && selectedIds.length === notifications.length}
                  onChange={toggleSelectAll}
                  className="rounded text-[#007FFF] focus:ring-[#007FFF] w-4 h-4 cursor-pointer"
                />
                Select All
              </label>
              {selectedIds.length > 0 && (
                <span className="font-bold text-[#007FFF] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                  {selectedIds.length} selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <button
                  onClick={handleBulkDeleteSelected}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedIds.length})
                </button>
              )}

              <button
                onClick={handleBulkDeleteRead}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete All Read
              </button>
            </div>
          </div>
        )}

        {/* Notifications List */}
        <div className="space-y-3">
          {loading ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-gray-200">
              <div className="w-8 h-8 border-4 border-[#007FFF] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-xs font-semibold text-gray-500">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-gray-200 px-4 shadow-xs">
              <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3 stroke-[1.25]" />
              <h3 className="text-base font-bold text-gray-900 mb-1">
                No Notifications Found
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto font-medium">
                You don&apos;t have any notifications under this category right now.
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              const isSelected = selectedIds.includes(n.id);
              return (
                <div
                  key={n.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all flex items-start gap-4 ${!n.isRead
                      ? "bg-white border-blue-200 shadow-sm"
                      : "bg-white/80 border-gray-200"
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(n.id)}
                    className="mt-1 rounded text-[#007FFF] focus:ring-[#007FFF] w-4 h-4 cursor-pointer"
                  />

                  <div className="p-3 rounded-xl bg-gray-100 shrink-0 mt-0.5">
                    {getNotificationIcon(n.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {getPriorityBadge(n.priority)}
                      <h3 className="text-sm font-bold text-gray-900 truncate">
                        {n.title}
                      </h3>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#007FFF] animate-pulse"></span>
                      )}
                      <span className="text-[11px] text-gray-400 ml-auto font-semibold">
                        {formatTime(n.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-gray-600 leading-relaxed mb-3">
                      {n.message}
                    </p>

                    <div className="flex items-center gap-4">
                      {n.link && (
                        <Link
                          href={n.link}
                          onClick={() => {
                            if (!n.isRead) markAsRead(n.id);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#007FFF] hover:bg-blue-700 transition-colors shadow-xs"
                        >
                          View Details <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}

                      {!n.isRead && (
                        <button
                          onClick={() => markAsRead(n.id)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" /> Mark read
                        </button>
                      )}

                      <button
                        onClick={() => deleteNotification(n.id)}
                        className="ml-auto p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Infinite Scroll Indicators */}
        {loadingMore && (
          <div className="py-4 text-center text-xs font-bold text-gray-500 animate-pulse bg-white rounded-xl border border-gray-200 shadow-xs">
            Loading more notifications...
          </div>
        )}
        {!hasMore && notifications.length > 0 && (
          <div className="py-3 text-center text-xs font-semibold text-gray-400">
            You've reached the end of notifications
          </div>
        )}
      </div>

      {/* Customer Notification Preferences Modal */}
      {showPreferencesModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-gray-200 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-[#007FFF]">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Notification Preferences
                  </h3>
                  <p className="text-xs font-medium text-gray-500">
                    Choose which channels you want to receive alerts on.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowPreferencesModal(false)}
                className="p-2 text-gray-400 hover:text-gray-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toggle Settings Grid */}
            <div className="space-y-4">
              {[
                { keyInApp: "inAppOrders", keyEmail: "emailOrders", label: "Order & Dispatch Updates", desc: "Order confirmation, shipping, tracking & delivery alerts" },
                { keyInApp: "inAppPayments", keyEmail: "emailPayments", label: "Payment & Invoice Updates", desc: "Payment status, receipts, and failure notices" },
                { keyInApp: "inAppShipping", keyEmail: "emailShipping", label: "Shipping & Courier Tracking", desc: "Out for delivery and delivery exception alerts" },
                { keyInApp: "inAppReturns", keyEmail: "emailReturns", label: "Returns & Refund Status", desc: "Return approvals, pickup schedules, and refund completions" },
                { keyInApp: "inAppProducts", keyEmail: "emailProducts", label: "Product & Price Drop Alerts", desc: "Wishlist price drop and back-in-stock alerts" },
                { keyInApp: "inAppMarketing", keyEmail: "emailMarketing", label: "Marketing & Exclusive Offers", desc: "Flash sales, coupon codes, and promotional offers" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="p-4 bg-gray-50/70 rounded-2xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{item.label}</h4>
                    <p className="text-[11px] font-medium text-gray-500">{item.desc}</p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-800 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(prefState[item.keyInApp as keyof NotificationPreference])}
                        onChange={(e) =>
                          setPrefState((prev) => ({ ...prev, [item.keyInApp]: e.target.checked }))
                        }
                        className="rounded text-[#007FFF] focus:ring-[#007FFF] w-4 h-4 cursor-pointer"
                      />
                      In-App
                    </label>

                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-800 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(prefState[item.keyEmail as keyof NotificationPreference])}
                        onChange={(e) =>
                          setPrefState((prev) => ({ ...prev, [item.keyEmail]: e.target.checked }))
                        }
                        className="rounded text-[#007FFF] focus:ring-[#007FFF] w-4 h-4 cursor-pointer"
                      />
                      Email
                    </label>
                  </div>
                </div>
              ))}

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs font-medium text-amber-900">
                <Lock className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  <strong>Security Note:</strong> Critical security alerts (password resets, login verifications) are mandatory and cannot be disabled.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                onClick={() => setShowPreferencesModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreferences}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#007FFF] hover:bg-blue-700 transition-colors shadow-xs"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
