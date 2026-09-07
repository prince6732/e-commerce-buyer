"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  RotateCcw,
  RefreshCw,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Eye,
  Check,
  Ban,
  Package,
  Calendar,
  AlertTriangle,
  CreditCard,
  Building2,
  ChevronRight,
  ChevronLeft,
  X,
  ShieldCheck,
  Inbox,
} from "lucide-react";
import { returnApi } from "@/utils/returnApi";
import imgPlaceholder from "@/public/imagePlaceholder.png";

const basePath = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState<any[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState("all");
  const [returnTypeFilter, setReturnTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Action Modal
  const [selectedReturn, setSelectedReturn] = useState<any | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form states in action modal
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [qcStatus, setQcStatus] = useState<"passed" | "failed">("passed");
  const [qcRemarks, setQcRemarks] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundDeductions, setRefundDeductions] = useState("0");
  const [refundTransactionId, setRefundTransactionId] = useState("");

  useEffect(() => {
    fetchReturns();
  }, [page, activeTab, returnTypeFilter]);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const res = await returnApi.getAllReturns({
        page,
        limit: 15,
        status: activeTab === "all" ? undefined : activeTab,
        returnType: returnTypeFilter === "all" ? undefined : returnTypeFilter,
        search: searchTerm.trim() || undefined,
      });

      setReturns(res.items || []);
      setStatusCounts(res.countsByStatus || {});
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (err) {
      console.error("Failed to load admin returns:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReturns();
  };

  const openReturnModal = async (ret: any) => {
    setSelectedReturn(ret);
    setAdminNotes(ret.adminNotes || "");
    setRejectionReason("");
    setPickupDate(new Date().toISOString().split("T")[0]);
    setQcStatus("passed");
    setQcRemarks("");
    setRefundAmount(ret.refundAmount || "");
    setRefundDeductions("0");
    setRefundTransactionId("");
    setActionError(null);

    try {
      setModalLoading(true);
      const fullDetails = await returnApi.getAdminReturnDetails(ret.id);
      setSelectedReturn(fullDetails);
    } catch (e) {
      console.warn("Could not fetch full return details:", e);
    } finally {
      setModalLoading(false);
    }
  };

  // Actions
  const handleApprove = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const updated = await returnApi.approveReturn(selectedReturn.id, { admin_notes: adminNotes });
      setSelectedReturn(updated);
      fetchReturns();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Approval failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setActionError("Please provide a rejection reason.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const updated = await returnApi.rejectReturn(selectedReturn.id, { rejection_reason: rejectionReason });
      setSelectedReturn(updated);
      fetchReturns();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Rejection failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSchedulePickup = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await returnApi.scheduleReversePickup(selectedReturn.id, { pickup_date: pickupDate });
      const updated = await returnApi.getAdminReturnDetails(selectedReturn.id);
      setSelectedReturn(updated);
      fetchReturns();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Failed to schedule pickup");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkReceived = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const updated = await returnApi.markReceived(selectedReturn.id);
      setSelectedReturn(updated);
      fetchReturns();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Failed to mark received");
    } finally {
      setActionLoading(false);
    }
  };

  const handleQC = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const updated = await returnApi.qualityCheck(selectedReturn.id, {
        qc_status: qcStatus,
        qc_remarks: qcRemarks,
      });
      setSelectedReturn(updated);
      fetchReturns();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Quality Check failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefund = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await returnApi.processRefund(selectedReturn.id, {
        refund_amount: Number(refundAmount),
        deductions: Number(refundDeductions),
        transaction_id: refundTransactionId || undefined,
      });
      const updated = await returnApi.getAdminReturnDetails(selectedReturn.id);
      setSelectedReturn(updated);
      fetchReturns();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Refund failed");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "requested":
        return <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold">In Review</span>;
      case "approved":
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">Approved</span>;
      case "pickup_scheduled":
        return <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-bold">Pickup Scheduled</span>;
      case "in_transit":
        return <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-bold">In Transit</span>;
      case "received_at_warehouse":
        return <span className="px-2.5 py-1 bg-sky-100 text-sky-800 rounded-full text-xs font-bold">At Warehouse</span>;
      case "qc_passed":
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">QC Passed</span>;
      case "qc_failed":
        return <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-bold">QC Failed</span>;
      case "refunded":
      case "completed":
        return <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">Completed</span>;
      case "rejected":
        return <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">Rejected</span>;
      case "cancelled":
        return <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Returns & Exchanges Management</h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage customer return requests, reverse Delhivery logistics, warehouse QC, and refund payouts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/rto-orders"
            className="px-4 py-2 bg-orange-50 hover:bg-orange-100 text-[#ff9903] font-bold text-xs rounded-xl transition-all border border-orange-200 flex items-center gap-1.5"
          >
            <Truck className="w-4 h-4" />
            <span>RTO & NDR Command Center</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs text-gray-500 font-bold uppercase">Total Requests</div>
          <div className="text-2xl font-black text-gray-900 mt-1">{statusCounts.all || 0}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">All customer requests</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs text-yellow-600 font-bold uppercase">In Review</div>
          <div className="text-2xl font-black text-yellow-600 mt-1">{statusCounts.requested || 0}</div>
          <div className="text-[11px] text-yellow-600/70 mt-0.5">Pending admin action</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs text-purple-600 font-bold uppercase">In Transit & Warehouse</div>
          <div className="text-2xl font-black text-purple-600 mt-1">
            {(statusCounts.pickup_scheduled || 0) + (statusCounts.in_transit || 0) + (statusCounts.received_at_warehouse || 0)}
          </div>
          <div className="text-[11px] text-purple-600/70 mt-0.5">Reverse Delhivery courier</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs text-blue-600 font-bold uppercase">QC Passed / Pending</div>
          <div className="text-2xl font-black text-blue-600 mt-1">
            {(statusCounts.qc_passed || 0) + (statusCounts.qc_pending || 0)}
          </div>
          <div className="text-[11px] text-blue-600/70 mt-0.5">Awaiting refund/exchange</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs text-emerald-600 font-bold uppercase">Completed</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {(statusCounts.refunded || 0) + (statusCounts.completed || 0)}
          </div>
          <div className="text-[11px] text-emerald-600/70 mt-0.5">Refunded or Exchanged</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { key: "all", label: `All (${statusCounts.all || 0})` },
              { key: "requested", label: `In Review (${statusCounts.requested || 0})` },
              { key: "approved", label: `Approved (${statusCounts.approved || 0})` },
              { key: "in_transit", label: `In Transit (${statusCounts.in_transit || 0})` },
              { key: "received_at_warehouse", label: `Warehouse (${statusCounts.received_at_warehouse || 0})` },
              { key: "qc_passed", label: `QC Passed (${statusCounts.qc_passed || 0})` },
              { key: "qc_failed", label: `QC Failed (${statusCounts.qc_failed || 0})` },
              { key: "refunded", label: `Refunded (${statusCounts.refunded || 0})` },
              { key: "rejected", label: `Rejected (${statusCounts.rejected || 0})` },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setActiveTab(t.key);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === t.key
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search & Type filters */}
          <div className="flex items-center gap-2">
            <select
              value={returnTypeFilter}
              onChange={(e) => {
                setReturnTypeFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs p-2.5 rounded-xl border border-gray-200 bg-white font-semibold text-gray-800"
            >
              <option value="all">All Types</option>
              <option value="return">Refund Returns</option>
              <option value="exchange">Exchanges</option>
            </select>

            <form onSubmit={handleSearch} className="relative flex-1 sm:w-64">
              <input
                type="text"
                placeholder="Search Return # or AWB..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-3" />
            </form>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-[#007FFF] rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs text-gray-500 font-medium">Loading return requests...</p>
          </div>
        ) : returns.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <Inbox className="w-12 h-12 text-gray-300 mx-auto" />
            <h4 className="text-sm font-bold text-gray-800">No Return Requests Found</h4>
            <p className="text-xs text-gray-500">There are no records matching your selected filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 text-gray-600 font-bold border-b border-gray-100">
                <tr>
                  <th className="p-4">Return Number</th>
                  <th className="p-4">Order / Customer</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Items</th>
                  <th className="p-4">Refund Amount</th>
                  <th className="p-4">Reverse AWB</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {returns.map((ret) => {
                  const isExchange = ret.returnType === "exchange";
                  const items = ret.items || [];

                  return (
                    <tr key={ret.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="p-4 font-mono font-bold text-gray-900">
                        <div>#{ret.returnNumber}</div>
                        <div className="text-[10px] text-gray-400 font-normal">{formatDate(ret.createdAt)}</div>
                      </td>

                      <td className="p-4">
                        <div className="font-bold text-gray-900">Order #{ret.order?.orderNumber}</div>
                        <div className="text-gray-500 text-[11px]">{ret.order?.user?.name || ret.user?.name || "Customer"}</div>
                        <div className="text-gray-400 text-[10px]">{ret.order?.user?.email || ret.user?.email}</div>
                      </td>

                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold ${
                            isExchange ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {isExchange ? <RefreshCw className="w-3 h-3" /> : <RotateCcw className="w-3 h-3" />}
                          {isExchange ? "Exchange" : "Refund"}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="font-semibold text-gray-800">
                          {items.length} item(s) (Qty: {items.reduce((s: number, i: any) => s + i.quantity, 0)})
                        </div>
                        <div className="text-[10px] text-gray-400 line-clamp-1">
                          {items.map((i: any) => i.product?.name).filter(Boolean).join(", ")}
                        </div>
                      </td>

                      <td className="p-4 font-bold text-emerald-600">
                        {isExchange ? "N/A" : `₹${ret.refundAmount}`}
                      </td>

                      <td className="p-4 font-mono text-[11px]">
                        {ret.reverseWaybill ? (
                          <span className="text-blue-600 font-bold">{ret.reverseWaybill}</span>
                        ) : (
                          <span className="text-gray-400">Not assigned</span>
                        )}
                      </td>

                      <td className="p-4">{getStatusBadge(ret.status)}</td>

                      <td className="p-4 text-right">
                        <button
                          onClick={() => openReturnModal(ret)}
                          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all shadow-sm"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-semibold text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* ACTION & DETAILS MODAL */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden my-8 border border-gray-100 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-[#007FFF] flex items-center justify-center border border-blue-500/30">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">Manage Return #{selectedReturn.returnNumber}</h2>
                    {getStatusBadge(selectedReturn.status)}
                  </div>
                  <p className="text-xs text-gray-400 font-mono">
                    Order #{selectedReturn.order?.orderNumber} • Customer: {selectedReturn.order?.user?.name || "Customer"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedReturn(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Return Items & Customer Reason */}
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200 space-y-4">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Return Items ({selectedReturn.items?.length})
                </h4>

                <div className="space-y-3">
                  {(selectedReturn.items || []).map((it: any) => (
                    <div
                      key={it.id}
                      className="bg-white p-3.5 rounded-xl border border-gray-200 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0">
                          <Image
                            src={`${basePath}${it.product?.imageUrl || it.variant?.imageUrl || imgPlaceholder.src}`}
                            alt={it.product?.name || "Product"}
                            fill
                            unoptimized
                            className="object-contain p-1"
                          />
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-gray-900">{it.product?.name}</h5>
                          <p className="text-[11px] text-gray-500">
                            {it.variant?.title} • Qty: <strong>{it.quantity}</strong> • Unit: ₹{it.price}
                          </p>
                          {it.exchangeVariant && (
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              Exchange Variant: {it.exchangeVariant.title}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-xs text-gray-900">
                          ₹{(Number(it.price) * it.quantity).toLocaleString()}
                        </span>
                        {it.qcStatus && (
                          <div
                            className={`text-[10px] font-bold capitalize mt-0.5 ${
                              it.qcStatus === "passed" ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            QC: {it.qcStatus}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-gray-200 text-xs space-y-1 text-gray-700">
                  <p>
                    <strong>Reason:</strong> {selectedReturn.reason?.replace(/_/g, " ")}
                  </p>
                  {selectedReturn.reasonDetails && (
                    <p>
                      <strong>Customer Remarks:</strong> {selectedReturn.reasonDetails}
                    </p>
                  )}
                  {selectedReturn.pickupAddress && (
                    <p className="text-gray-500">
                      <strong>Pickup:</strong> {selectedReturn.pickupAddress.address},{" "}
                      {selectedReturn.pickupAddress.city}, {selectedReturn.pickupAddress.state} -{" "}
                      {selectedReturn.pickupAddress.pincode} (Phone: {selectedReturn.pickupAddress.phone})
                    </p>
                  )}
                </div>
              </div>

              {/* ACTION CONSOLE */}
              <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-200 space-y-4">
                <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wide flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#007FFF]" />
                  <span>Admin Action Console</span>
                </h4>

                {/* State 1: Requested -> Approve or Reject */}
                {selectedReturn.status === "requested" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Admin Approval Notes (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Return approved, generating Delhivery reverse manifest."
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-white"
                      />
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleApprove}
                        disabled={actionLoading}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        <span>{actionLoading ? "Processing..." : "Approve Return & Schedule Pickup"}</span>
                      </button>

                      <div className="flex-1 min-w-[240px] flex gap-2">
                        <input
                          type="text"
                          placeholder="Rejection reason..."
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          className="flex-1 text-xs p-2 rounded-lg border border-red-300 bg-white"
                        />
                        <button
                          onClick={handleReject}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* State 2: Approved -> Schedule / Re-manifest Reverse Pickup */}
                {selectedReturn.status === "approved" && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-600">
                      This return is approved. Dispatch reverse pickup request to Delhivery Express.
                    </p>
                    <div className="flex items-center gap-3">
                      <input
                        type="date"
                        value={pickupDate}
                        onChange={(e) => setPickupDate(e.target.value)}
                        className="text-xs p-2 rounded-lg border border-gray-300 bg-white"
                      />
                      <button
                        onClick={handleSchedulePickup}
                        disabled={actionLoading}
                        className="px-5 py-2.5 bg-[#007FFF] hover:bg-[#0066CC] text-white font-bold text-xs rounded-xl transition-all shadow-sm disabled:opacity-50"
                      >
                        {actionLoading ? "Scheduling..." : "Schedule Delhivery Pickup"}
                      </button>
                    </div>
                  </div>
                )}

                {/* State 3: In Transit -> Mark Received at Central Warehouse */}
                {(selectedReturn.status === "in_transit" || selectedReturn.status === "pickup_scheduled") && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-600">
                      Reverse courier is en route. When parcel arrives at Ambala central warehouse, mark it as received.
                    </p>
                    <button
                      onClick={handleMarkReceived}
                      disabled={actionLoading}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm disabled:opacity-50"
                    >
                      {actionLoading ? "Updating..." : "Mark Parcel Received at Warehouse"}
                    </button>
                  </div>
                )}

                {/* State 4: Received at Warehouse -> Quality Inspection & Restock */}
                {["received_at_warehouse", "qc_pending"].includes(selectedReturn.status) && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Quality Inspection Status
                        </label>
                        <select
                          value={qcStatus}
                          onChange={(e) => setQcStatus(e.target.value as any)}
                          className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-white font-bold"
                        >
                          <option value="passed">QC Passed (Brand New Condition - Auto Restock)</option>
                          <option value="failed">QC Failed (Damaged / Missing Accessories)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          QC Inspector Remarks
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Tags intact, item undamaged."
                          value={qcRemarks}
                          onChange={(e) => setQcRemarks(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-white"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleQC}
                      disabled={actionLoading}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm disabled:opacity-50"
                    >
                      {actionLoading ? "Submitting QC..." : "Submit QC & Restock Inventory"}
                    </button>
                  </div>
                )}

                {/* State 5: QC Passed -> Trigger Refund Payout */}
                {selectedReturn.status === "qc_passed" && selectedReturn.returnType === "return" && (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-600">
                      QC passed! Process refund payout to customer.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Refund Amount (₹)</label>
                        <input
                          type="number"
                          value={refundAmount}
                          onChange={(e) => setRefundAmount(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-white font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Deductions (₹)</label>
                        <input
                          type="number"
                          value={refundDeductions}
                          onChange={(e) => setRefundDeductions(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Tx Reference ID</label>
                        <input
                          type="text"
                          placeholder="Gateway Ref or Bank UTR"
                          value={refundTransactionId}
                          onChange={(e) => setRefundTransactionId(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-white font-mono"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleRefund}
                      disabled={actionLoading}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm disabled:opacity-50"
                    >
                      {actionLoading ? "Processing Refund..." : "Execute & Complete Refund"}
                    </button>
                  </div>
                )}

                {/* Completed / Cancelled Notice */}
                {["completed", "refunded", "rejected", "cancelled"].includes(selectedReturn.status) && (
                  <p className="text-xs text-gray-600">
                    This return request is in final state (<strong>{selectedReturn.status}</strong>). No further admin actions required.
                  </p>
                )}
              </div>

              {/* Tracking Scans Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Tracking Events</h4>
                <div className="space-y-2 text-xs">
                  {(selectedReturn.trackingEvents || []).map((evt: any, i: number) => (
                    <div key={evt.id || i} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex justify-between gap-3">
                      <div>
                        <span className="font-bold text-gray-900">{evt.description || evt.status}</span>
                        {evt.location && <span className="text-gray-500 block text-[11px]">Location: {evt.location}</span>}
                      </div>
                      <span className="text-gray-400 text-[11px] whitespace-nowrap font-mono">
                        {formatDate(evt.eventTime || evt.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
