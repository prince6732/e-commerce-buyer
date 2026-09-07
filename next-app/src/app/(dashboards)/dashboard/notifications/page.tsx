"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  ExternalLink,
  ShoppingBag,
  Info,
  Sparkles,
  Truck,
  RefreshCw,
  SlidersHorizontal,
  Check,
  ArrowLeft,
  X,
  Lock,
  AlertTriangle,
  Server,
  Users,
  Search,
  Loader2,
} from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "../../../../../utils/axios";

const PAGE_SIZE = 10;

interface AdminPreference {
  id?: number;
  userId?: number;
  inAppOrders: boolean;
  inAppPayments: boolean;
  inAppInventory: boolean;
  inAppReturns: boolean;
  inAppShipping: boolean;
  inAppCustomers: boolean;
  inAppSystem: boolean;
  emailOrders: boolean;
  emailPayments: boolean;
  emailInventory: boolean;
  emailReturns: boolean;
  emailShipping: boolean;
  emailCustomers: boolean;
  emailSystem: boolean;
}

export default function AdminNotificationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    bulkDeleteNotifications,
  } = useNotifications();

  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showPreferencesModal, setShowPreferencesModal] = useState<boolean>(false);
  const [adminPrefs, setAdminPrefs] = useState<Partial<AdminPreference>>({});

  // Infinite scroll & search state
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const isFetchingRef = useRef(false);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch admin preferences
  const fetchAdminPreferences = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;
      const res = await axios.get("/api/notifications/admin/preferences", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data) {
        setAdminPrefs(res.data);
      }
    } catch (e) {
      console.error("Failed to load admin notification preferences:", e);
    }
  };

  const updateAdminPreferences = async (dto: Partial<AdminPreference>) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;
      const res = await axios.patch("/api/notifications/admin/preferences", dto, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data) {
        setAdminPrefs(res.data);
      }
    } catch (e) {
      console.error("Failed to update admin notification preferences:", e);
    }
  };

  useEffect(() => {
    fetchAdminPreferences();
  }, []);

  // Fetch notifications helper
  const loadBatch = useCallback(
    async (pageNum: number, search: string = "", isAppend: boolean = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (isAppend) {
        setLoadingMore(true);
      } else if (search) {
        setIsSearching(true);
      }

      try {
        const isUnreadTab = activeTab === "UNREAD";
        const category = isUnreadTab || activeTab === "ALL" ? undefined : activeTab;
        const isRead = isUnreadTab ? false : undefined;

        const moreAvailable = await fetchNotifications({
          category,
          is_read: isRead,
          search: search || undefined,
          page: pageNum,
          limit: PAGE_SIZE,
          append: isAppend,
        });

        setPage(pageNum);
        setHasMore(moreAvailable);
      } catch (err) {
        console.error("Failed to load batch notifications:", err);
      } finally {
        isFetchingRef.current = false;
        setLoadingMore(false);
        setIsSearching(false);
      }
    },
    [activeTab, fetchNotifications]
  );

  // Initial fetch and tab / search change handler
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setSelectedIds([]);
    loadBatch(1, debouncedSearchQuery, false);
  }, [activeTab, debouncedSearchQuery, loadBatch]);

  // Load next page on scroll
  const loadNextPage = useCallback(() => {
    if (!hasMore || loadingMore || loading || isFetchingRef.current) return;
    loadBatch(page + 1, debouncedSearchQuery, true);
  }, [hasMore, loadingMore, loading, page, debouncedSearchQuery, loadBatch]);

  // IntersectionObserver for bottom sentinel
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting) {
          loadNextPage();
        }
      },
      {
        root: null,
        rootMargin: "300px",
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadNextPage]);

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
    await updateAdminPreferences(adminPrefs);
    setShowPreferencesModal(false);
  };

  const getNotificationIcon = (type: string) => {
    const t = (type || "").toUpperCase();
    if (t.startsWith("ORDER") || t.startsWith("CANCELLATION")) return <ShoppingBag className="w-5 h-5 text-[#007FFF]" />;
    if (t.startsWith("PAYMENT") || t.startsWith("REFUND")) return <Sparkles className="w-5 h-5 text-emerald-600" />;
    if (t.startsWith("SHIPMENT") || t.startsWith("DELIVERY")) return <Truck className="w-5 h-5 text-indigo-600" />;
    if (t.startsWith("RETURN") || t.startsWith("EXCHANGE")) return <RefreshCw className="w-5 h-5 text-amber-600" />;
    if (t.startsWith("PRODUCT") || t.includes("STOCK")) return <AlertTriangle className="w-5 h-5 text-rose-600" />;
    if (t.includes("CUSTOMER") || t.includes("REVIEW") || t.includes("CONTACT")) return <Users className="w-5 h-5 text-purple-600" />;
    if (t.includes("SYSTEM") || t.includes("ERROR") || t.includes("BACKUP")) return <Server className="w-5 h-5 text-red-600" />;
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
        return <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-blue-50 text-[#007FFF] rounded-full border border-blue-200">NORMAL</span>;
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
    { id: "ALL", label: "All Alerts" },
    { id: "UNREAD", label: `Unread (${unreadCount})` },
    { id: "ORDERS", label: "Orders" },
    { id: "PAYMENTS", label: "Payments" },
    { id: "INVENTORY", label: "Inventory" },
    { id: "RETURNS", label: "Returns" },
    { id: "SHIPPING", label: "Shipping" },
    { id: "CUSTOMERS", label: "Customers" },
    { id: "SYSTEM", label: "System" },
  ];

  return (
    <div className="min-h-screen bg-gray-50/70 p-3 sm:p-6 lg:p-8 space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  Super Admin Notifications
                </h1>
                {unreadCount > 0 && (
                  <span className="px-2.5 py-0.5 text-xs font-bold bg-[#007FFF] text-white rounded-full">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-gray-500 mt-0.5">
                Real-time store operations, order alerts, low stock warnings, and system logs.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowPreferencesModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-gray-800 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#007FFF]" />
              Preferences
            </button>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#007FFF] hover:bg-[#0066CC] transition-colors shadow-xs cursor-pointer"
              >
                <CheckCheck className="w-4 h-4" />
                Mark All Read
              </button>
            )}
          </div>
        </div>

        {/* Search Bar + Categories */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Category Navigation Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveTab(cat.id);
                  setSelectedIds([]);
                }}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all cursor-pointer ${activeTab === cat.id
                    ? "bg-[#0A0908] text-white shadow-xs"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                  }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notifications..."
              className="w-full rounded-xl border border-gray-300 bg-white pl-9 pr-9 py-2 text-xs md:text-sm text-gray-900 placeholder-gray-400 shadow-xs focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition-all"
            />
            {isSearching ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#007FFF]" />
              </div>
            ) : searchQuery ? (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-200 cursor-pointer"
              >
                Clear
              </button>
            ) : null}
          </div>
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
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedIds.length})
                </button>
              )}

              <button
                onClick={handleBulkDeleteRead}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete All Read
              </button>
            </div>
          </div>
        )}

        {/* Notifications List */}
        <div className="space-y-3">
          {loading && notifications.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-gray-200">
              <Loader2 className="w-8 h-8 animate-spin text-[#007FFF] mx-auto mb-3" />
              <p className="text-xs font-semibold text-gray-500">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-gray-200 px-4 shadow-xs">
              <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3 stroke-[1.25]" />
              <h3 className="text-base font-bold text-gray-900 mb-1">
                No Admin Alerts Found
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto font-medium">
                Your store is running smoothly! No notifications under this category right now.
              </p>
            </div>
          ) : (
            notifications.map((n, idx) => {
              const isSelected = selectedIds.includes(n.id);
              return (
                <div
                  key={n.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all flex items-start gap-4 ${!n.isRead
                      ? "bg-white border-blue-200 shadow-xs"
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
                      <span className="text-xs font-semibold text-gray-400">#{idx + 1}</span>
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
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#007FFF] hover:bg-[#0066CC] transition-colors shadow-xs cursor-pointer"
                        >
                          View Details <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}

                      {!n.isRead && (
                        <button
                          onClick={() => markAsRead(n.id)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Mark read
                        </button>
                      )}

                      <button
                        onClick={() => deleteNotification(n.id)}
                        className="ml-auto p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 cursor-pointer"
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

        {/* Bottom Sentinel for Infinite Scroll */}
        <div ref={bottomSentinelRef} className="h-6 w-full pointer-events-none" />

        {/* Infinite Scroll Bottom Loading State */}
        {loadingMore && (
          <div className="flex items-center justify-center gap-2.5 py-4 text-xs font-bold text-gray-600 bg-white rounded-xl border border-gray-200 shadow-xs animate-in fade-in duration-200">
            <Loader2 className="w-4 h-4 animate-spin text-[#007FFF]" />
            <span>Loading more notifications...</span>
          </div>
        )}

        {/* All Notifications Loaded Indicator */}
        {!hasMore && notifications.length > 0 && !loading && (
          <div className="flex items-center justify-center py-4 text-xs text-gray-400 font-medium animate-in fade-in duration-200">
            <span className="bg-gray-100/90 px-4 py-1.5 rounded-full border border-gray-200 text-gray-600 font-semibold shadow-xs flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>All {notifications.length} notifications loaded</span>
            </span>
          </div>
        )}
      </div>

      {/* Super Admin Notification Preferences Modal */}
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
                    Super Admin Notification Settings
                  </h3>
                  <p className="text-xs font-medium text-gray-500">
                    Configure In-App & Email alerts for store owner monitoring.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowPreferencesModal(false)}
                className="p-2 text-gray-400 hover:text-gray-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toggle Settings Grid */}
            <div className="space-y-4">
              {[
                { keyInApp: "inAppOrders", keyEmail: "emailOrders", label: "New Orders & Cancellations", desc: "Customer checkout and order cancellation alerts" },
                { keyInApp: "inAppPayments", keyEmail: "emailPayments", label: "Payment Failures & Refunds", desc: "Payment Gateway failures and refund requests" },
                { keyInApp: "inAppInventory", keyEmail: "emailInventory", label: "Low Stock & Out of Stock", desc: "Stock depletion threshold warnings and sold out items" },
                { keyInApp: "inAppReturns", keyEmail: "emailReturns", label: "Return & Exchange Requests", desc: "Customer return applications and exchange requests" },
                { keyInApp: "inAppShipping", keyEmail: "emailShipping", label: "Shipping & Delhivery Failures", desc: "Waybill generation errors, RTO, and delivery delays" },
                { keyInApp: "inAppCustomers", keyEmail: "emailCustomers", label: "Customer Inquiries & Reviews", desc: "Contact form messages and 1-2 star low rating reviews" },
                { keyInApp: "inAppSystem", keyEmail: "emailSystem", label: "System Errors & Webhook Outages", desc: "Critical gateway, mailer, or server error alerts" },
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
                        checked={Boolean(adminPrefs[item.keyInApp as keyof AdminPreference])}
                        onChange={(e) =>
                          setAdminPrefs((prev) => ({ ...prev, [item.keyInApp]: e.target.checked }))
                        }
                        className="rounded text-[#007FFF] focus:ring-[#007FFF] w-4 h-4 cursor-pointer"
                      />
                      In-App
                    </label>

                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-800 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(adminPrefs[item.keyEmail as keyof AdminPreference])}
                        onChange={(e) =>
                          setAdminPrefs((prev) => ({ ...prev, [item.keyEmail]: e.target.checked }))
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
                  <strong>Critical Security Note:</strong> Payment Gateway outages and System Failure alerts are mandatory and cannot be disabled.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                onClick={() => setShowPreferencesModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreferences}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#007FFF] hover:bg-[#0066CC] transition-colors shadow-xs cursor-pointer"
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
