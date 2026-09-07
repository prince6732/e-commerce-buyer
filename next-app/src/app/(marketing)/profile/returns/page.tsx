"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RotateCcw,
  RefreshCw,
  Truck,
  Package,
  ArrowLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
} from "lucide-react";
import { returnApi } from "@/utils/returnApi";
import imgPlaceholder from "@/public/imagePlaceholder.png";

const basePath = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";

const TABS = [
  { key: "all", label: "All Returns" },
  { key: "requested", label: "In Review" },
  { key: "approved", label: "Approved & Pickup" },
  { key: "in_transit", label: "In Transit" },
  { key: "qc_passed", label: "QC Passed" },
  { key: "refunded", label: "Refunded / Completed" },
];

export default function MyReturnsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("all");
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchReturns();
  }, [activeTab, page]);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const res = await returnApi.getMyReturns({
        page,
        limit: 10,
        status: activeTab === "all" ? undefined : activeTab,
      });
      setReturns(res.items || []);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (err) {
      console.error("Failed to load returns:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "requested":
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold">In Review</span>;
      case "approved":
        return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">Approved</span>;
      case "pickup_scheduled":
        return <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-bold">Pickup Scheduled</span>;
      case "in_transit":
        return <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-bold">In Transit</span>;
      case "received_at_warehouse":
        return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">At Warehouse</span>;
      case "qc_passed":
        return <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">QC Passed</span>;
      case "qc_failed":
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">QC Failed</span>;
      case "refunded":
      case "completed":
        return <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">Completed</span>;
      case "rejected":
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">Rejected</span>;
      case "cancelled":
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">Cancelled</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl space-y-6">
        {/* Header navigation bar */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => router.push("/profile")}
              className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">My Returns & Exchanges</h1>
              <p className="text-xs text-gray-500 mt-0.5">Track and manage your return requests</p>
            </div>
          </div>

          <Link
            href="/orders"
            className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-[#007FFF] font-bold text-xs rounded-xl transition-all border border-blue-200 self-start sm:self-auto"
          >
            Browse My Orders
          </Link>
        </div>

        {/* Tab Filter Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? "bg-[#007FFF] text-white shadow-sm"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Return Requests List */}
        {loading ? (
          <div className="text-center py-16 bg-white rounded-3xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-[#007FFF] rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-500 text-xs font-medium">Loading your returns...</p>
          </div>
        ) : returns.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl shadow-sm border border-gray-100 space-y-4">
            <div className="w-16 h-16 bg-blue-50 text-[#007FFF] rounded-2xl flex items-center justify-center mx-auto">
              <RotateCcw className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">No Return Requests Found</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                You haven't requested any returns or exchanges in this tab.
              </p>
            </div>
            <Link
              href="/orders"
              className="inline-block px-5 py-2.5 bg-[#007FFF] hover:bg-[#0066CC] text-white font-bold text-xs rounded-xl shadow-sm"
            >
              View Delivered Orders
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {returns.map((ret) => {
              const orderSlug = ret.order?.slug || ret.order?.orderNumber || ret.orderId;
              const items = ret.items || [];
              const isExchange = ret.returnType === "exchange";

              return (
                <div
                  key={ret.id}
                  className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:border-blue-200 transition-all space-y-4"
                >
                  {/* Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
                        {isExchange ? <RefreshCw className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-gray-900">Return #{ret.returnNumber}</h4>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                            {isExchange ? "Exchange" : "Refund"}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500">
                          Requested on {formatDate(ret.createdAt)} • Order #{ret.order?.orderNumber}
                        </p>
                      </div>
                    </div>

                    <div className="self-start sm:self-center">{getStatusBadge(ret.status)}</div>
                  </div>

                  {/* Items Strip */}
                  <div className="space-y-3">
                    {items.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 overflow-hidden flex-shrink-0">
                            <Image
                              src={`${basePath}${item.product?.imageUrl || item.variant?.imageUrl || imgPlaceholder.src}`}
                              alt={item.product?.name || "Product"}
                              fill
                              unoptimized
                              className="object-contain p-1"
                            />
                          </div>
                          <div>
                            <h5 className="font-bold text-xs text-gray-900 line-clamp-1">{item.product?.name}</h5>
                            <p className="text-[11px] text-gray-500">Qty: {item.quantity}</p>
                          </div>
                        </div>

                        <span className="text-xs font-bold text-gray-900">₹{item.price}</span>
                      </div>
                    ))}
                  </div>

                  {/* Bottom details and link */}
                  <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-gray-600">
                      {!isExchange && (
                        <span>
                          Refund: <strong className="text-emerald-600">₹{ret.refundAmount}</strong>
                        </span>
                      )}
                      {ret.reverseWaybill && (
                        <span className="ml-3 font-mono text-[11px] text-gray-500">
                          AWB: {ret.reverseWaybill}
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/orders/${orderSlug}/returns/${ret.returnNumber}`}
                      className="px-4 py-2 bg-[#007FFF] hover:bg-[#0066CC] text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
                    >
                      <span>Track Return Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 pt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 bg-white rounded-xl border border-gray-200 text-xs font-bold disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-xs font-bold text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-4 py-2 bg-white rounded-xl border border-gray-200 text-xs font-bold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
