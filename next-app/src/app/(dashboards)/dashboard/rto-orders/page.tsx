"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Undo2,
  RotateCcw,
  Truck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  MapPin,
  Phone,
  Calendar,
  Check,
  X,
  ShieldCheck,
  Inbox,
  Send,
  Building2,
  CreditCard,
} from "lucide-react";
import { rtoApi } from "@/utils/rtoApi";

export default function RtoDashboardPage() {
  const [rtoCases, setRtoCases] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeStatus, setActiveStatus] = useState("all");
  const [ndrAgingFilter, setNdrAgingFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Action Console Modal
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // NDR Action Form
  const [ndrAction, setNdrAction] = useState<"reattempt" | "reschedule" | "update_address" | "update_phone" | "rto">("reattempt");
  const [ndrRemarks, setNdrRemarks] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [updatedAddress, setUpdatedAddress] = useState("");
  const [updatedCity, setUpdatedCity] = useState("");
  const [updatedState, setUpdatedState] = useState("");
  const [updatedPincode, setUpdatedPincode] = useState("");
  const [updatedPhone, setUpdatedPhone] = useState("");

  // RTO QC Form
  const [qcStatus, setQcStatus] = useState<"passed" | "damaged" | "lost" | "tampered">("passed");
  const [qcRemarks, setQcRemarks] = useState("");
  const [autoRestock, setAutoRestock] = useState(true);

  useEffect(() => {
    fetchData();
  }, [page, activeStatus, ndrAgingFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [casesRes, analyticsRes] = await Promise.all([
        rtoApi.getAllRtoCases({
          page,
          limit: 15,
          status: activeStatus === "all" ? undefined : activeStatus,
          ndrAging: ndrAgingFilter || undefined,
          search: searchTerm.trim() || undefined,
        }),
        rtoApi.getRtoAnalytics(),
      ]);

      setRtoCases(casesRes.items || []);
      setStatusCounts(casesRes.countsByStatus || {});
      setTotalPages(casesRes.pagination?.totalPages || 1);
      setAnalytics(analyticsRes);
    } catch (err) {
      console.error("Failed to load RTO cases:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const openCaseModal = async (c: any) => {
    setSelectedCase(c);
    setNdrAction("reattempt");
    setNdrRemarks("");
    setRescheduleDate(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
    setUpdatedAddress("");
    setUpdatedCity("");
    setUpdatedState("");
    setUpdatedPincode("");
    setUpdatedPhone(c.order?.user?.phoneNumber || c.order?.user?.phone_number || "");
    setQcStatus("passed");
    setQcRemarks("");
    setAutoRestock(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      setModalLoading(true);
      const fullDetails = await rtoApi.getRtoCaseDetails(c.id);
      setSelectedCase(fullDetails);
    } catch (e) {
      console.warn("Could not load full RTO case details:", e);
    } finally {
      setModalLoading(false);
    }
  };

  // Submit NDR Action
  const handleSubmitNdrAction = async () => {
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await rtoApi.executeNdrAction(selectedCase.id, {
        action: ndrAction,
        remarks: ndrRemarks,
        reschedule_date: ndrAction === "reschedule" ? rescheduleDate : undefined,
        updated_address: ndrAction === "update_address" ? updatedAddress : undefined,
        updated_city: ndrAction === "update_address" ? updatedCity : undefined,
        updated_state: ndrAction === "update_address" ? updatedState : undefined,
        updated_pincode: ndrAction === "update_address" ? updatedPincode : undefined,
        updated_phone: ndrAction === "update_phone" ? updatedPhone : undefined,
      });

      setActionSuccess(`NDR Action '${ndrAction.toUpperCase()}' dispatched successfully.`);
      const updated = await rtoApi.getRtoCaseDetails(selectedCase.id);
      setSelectedCase(updated);
      fetchData();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Failed to execute NDR action");
    } finally {
      setActionLoading(false);
    }
  };

  // Mark RTO Received at Warehouse
  const handleMarkDelivered = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await rtoApi.markDelivered(selectedCase.id);
      const updated = await rtoApi.getRtoCaseDetails(selectedCase.id);
      setSelectedCase(updated);
      fetchData();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "Failed to mark received");
    } finally {
      setActionLoading(false);
    }
  };

  // Submit RTO QC
  const handleQcSubmit = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await rtoApi.qualityCheck(selectedCase.id, {
        qc_status: qcStatus,
        qc_remarks: qcRemarks,
        restock: autoRestock,
      });

      setActionSuccess("RTO Quality Check completed and inventory updated.");
      const updated = await rtoApi.getRtoCaseDetails(selectedCase.id);
      setSelectedCase(updated);
      fetchData();
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || "QC submission failed");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ndr":
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-bold">NDR Active</span>;
      case "reattempt_requested":
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-900 rounded-full text-xs font-bold">Reattempt Queued</span>;
      case "rto_initiated":
        return <span className="px-2.5 py-1 bg-rose-100 text-rose-900 rounded-full text-xs font-bold">RTO Initiated</span>;
      case "rto_in_transit":
        return <span className="px-2.5 py-1 bg-purple-100 text-purple-900 rounded-full text-xs font-bold">RTO In Transit</span>;
      case "rto_received":
        return <span className="px-2.5 py-1 bg-sky-100 text-sky-900 rounded-full text-xs font-bold">RTO at Warehouse</span>;
      case "qc_passed":
      case "restocked":
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-full text-xs font-bold">Restocked & QC Passed</span>;
      case "qc_failed":
        return <span className="px-2.5 py-1 bg-red-100 text-red-900 rounded-full text-xs font-bold">QC Failed (Damaged)</span>;
      default:
        return <span className="px-2.5 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  const calculateAgingBadge = (firstNdrAt?: string) => {
    if (!firstNdrAt) return null;
    const diffHours = (Date.now() - new Date(firstNdrAt).getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">&lt; 24h</span>;
    } else if (diffHours < 48) {
      return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-bold rounded">24 - 48h</span>;
    } else if (diffHours < 72) {
      return <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-[10px] font-bold rounded">48 - 72h</span>;
    } else {
      return <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded">&gt; 72h Critical</span>;
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
          <h1 className="text-2xl font-bold text-gray-900">RTO & NDR Command Center</h1>
          <p className="text-xs text-gray-500 mt-1">
            Real-time delivery failure resolution, Delhivery reattempt instructions, and RTO warehouse QC restock.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/returns"
            className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-[#007FFF] font-bold text-xs rounded-xl transition-all border border-blue-200 flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Customer Returns & Exchanges</span>
          </Link>
        </div>
      </div>

      {/* Analytics & Aging KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs text-amber-700 font-bold uppercase">Total NDRs Raised</div>
          <div className="text-2xl font-black text-amber-700 mt-1">{analytics?.totalNdr || 0}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Delivery failures</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs text-rose-700 font-bold uppercase">Total RTOs</div>
          <div className="text-2xl font-black text-rose-700 mt-1">{analytics?.totalRto || 0}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Return to origin</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs text-emerald-700 font-bold uppercase">Restocked from RTO</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{analytics?.totalRestocked || 0}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">QC passed items</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs text-purple-700 font-bold uppercase">Active NDR &lt;24h</div>
          <div className="text-2xl font-black text-purple-700 mt-1">
            {analytics?.ndrAging?.lessThan24h || 0}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">High recovery chance</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs text-red-700 font-bold uppercase">NDR &gt;72h (Critical)</div>
          <div className="text-2xl font-black text-red-700 mt-1">
            {analytics?.ndrAging?.greaterThan72h || 0}
          </div>
          <div className="text-[11px] text-red-600 mt-0.5">Urgent action required</div>
        </div>
      </div>

      {/* NDR Aging Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { key: "all", label: `All (${statusCounts.all || 0})` },
              { key: "ndr", label: `Active NDR (${statusCounts.ndr || 0})` },
              { key: "reattempt_requested", label: `Reattempt Queued (${statusCounts.reattempt_requested || 0})` },
              { key: "rto_initiated", label: `RTO Initiated (${statusCounts.rto_initiated || 0})` },
              { key: "rto_in_transit", label: `In Transit (${statusCounts.rto_in_transit || 0})` },
              { key: "rto_received", label: `At Warehouse (${statusCounts.rto_received || 0})` },
              { key: "restocked", label: `Restocked (${statusCounts.restocked || 0})` },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setActiveStatus(t.key);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeStatus === t.key
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Aging Chips & Search */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setNdrAgingFilter(null)}
                className={`px-2 py-1 text-[11px] font-bold rounded-lg ${!ndrAgingFilter ? "bg-white text-gray-900 shadow-xs" : "text-gray-500"}`}
              >
                All Ages
              </button>
              <button
                onClick={() => setNdrAgingFilter("<24h")}
                className={`px-2 py-1 text-[11px] font-bold rounded-lg ${ndrAgingFilter === "<24h" ? "bg-emerald-500 text-white shadow-xs" : "text-gray-500"}`}
              >
                &lt;24h
              </button>
              <button
                onClick={() => setNdrAgingFilter("24-48h")}
                className={`px-2 py-1 text-[11px] font-bold rounded-lg ${ndrAgingFilter === "24-48h" ? "bg-yellow-500 text-white shadow-xs" : "text-gray-500"}`}
              >
                24-48h
              </button>
              <button
                onClick={() => setNdrAgingFilter(">72h")}
                className={`px-2 py-1 text-[11px] font-bold rounded-lg ${ndrAgingFilter === ">72h" ? "bg-red-500 text-white shadow-xs" : "text-gray-500"}`}
              >
                &gt;72h
              </button>
            </div>

            <form onSubmit={handleSearch} className="relative flex-1 sm:w-60">
              <input
                type="text"
                placeholder="Search RTO # or Waybill..."
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
            <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs text-gray-500 font-medium">Loading RTO & NDR cases...</p>
          </div>
        ) : rtoCases.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <Inbox className="w-12 h-12 text-gray-300 mx-auto" />
            <h4 className="text-sm font-bold text-gray-800">No RTO or NDR Records Found</h4>
            <p className="text-xs text-gray-500">There are no active delivery failure cases matching the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 text-gray-600 font-bold border-b border-gray-100">
                <tr>
                  <th className="p-4">RTO / Case #</th>
                  <th className="p-4">Order / Customer</th>
                  <th className="p-4">Waybill (AWB)</th>
                  <th className="p-4">NDR Attempts</th>
                  <th className="p-4">Last Courier Remark</th>
                  <th className="p-4">Aging</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rtoCases.map((c) => (
                  <tr key={c.id} className="hover:bg-amber-50/20 transition-colors">
                    <td className="p-4 font-mono font-bold text-gray-900">
                      <div>#{c.rtoNumber}</div>
                      <div className="text-[10px] text-gray-400 font-normal">{formatDate(c.createdAt)}</div>
                    </td>

                    <td className="p-4">
                      <div className="font-bold text-gray-900">Order #{c.order?.orderNumber}</div>
                      <div className="text-gray-500 text-[11px]">{c.order?.user?.name || "Customer"}</div>
                      <div className="text-gray-400 text-[10px]">{c.order?.user?.phoneNumber || c.order?.user?.phone_number}</div>
                    </td>

                    <td className="p-4 font-mono font-bold text-blue-600">{c.waybill}</td>

                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold rounded">
                        Attempt {c.ndrAttempts || 1}
                      </span>
                    </td>

                    <td className="p-4 max-w-xs">
                      <p className="text-gray-700 text-[11px] line-clamp-2">
                        {c.courierRemarks || "Customer not available"}
                      </p>
                    </td>

                    <td className="p-4">{calculateAgingBadge(c.firstNdrAt)}</td>

                    <td className="p-4">{getStatusBadge(c.status)}</td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => openCaseModal(c)}
                        className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all shadow-sm"
                      >
                        Action
                      </button>
                    </td>
                  </tr>
                ))}
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

      {/* ACTION & RESOLUTION MODAL */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden my-8 border border-gray-100 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-[#ff9903] flex items-center justify-center border border-amber-500/30">
                  <Undo2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">NDR & RTO Console #{selectedCase.rtoNumber}</h2>
                    {getStatusBadge(selectedCase.status)}
                  </div>
                  <p className="text-xs text-gray-400 font-mono">
                    Order #{selectedCase.order?.orderNumber} • AWB: {selectedCase.waybill}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedCase(null)}
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

            {actionSuccess && (
              <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{actionSuccess}</span>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Order & Delivery Failure Info */}
              <div className="bg-amber-50/50 rounded-2xl p-5 border border-amber-200 space-y-3">
                <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                  Delivery Attempt Failure Details
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500 block">NDR Attempts:</span>
                    <strong className="text-gray-900 text-sm">Attempt #{selectedCase.ndrAttempts || 1}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block">First Failure Date:</span>
                    <strong className="text-gray-900">{formatDate(selectedCase.firstNdrAt)}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Courier Status:</span>
                    <strong className="text-gray-900">{selectedCase.courierStatus || "NDR"}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-200/60 text-xs">
                  <span className="text-gray-500 block">Courier Remark:</span>
                  <p className="text-amber-950 font-semibold mt-0.5">
                    {selectedCase.courierRemarks || "Customer not available"}
                  </p>
                </div>
              </div>

              {/* ACTION 1: DISPATCH NDR INSTRUCTION TO DELHIVERY */}
              <div className="bg-white rounded-2xl p-5 border border-gray-200 space-y-4">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-[#ff9903]" />
                  <span>Dispatch Action Instruction to Delhivery</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { key: "reattempt", label: "Reattempt" },
                    { key: "reschedule", label: "Reschedule Date" },
                    { key: "update_address", label: "Update Address" },
                    { key: "update_phone", label: "Update Phone" },
                    { key: "rto", label: "Initiate RTO" },
                  ].map((act) => (
                    <button
                      key={act.key}
                      type="button"
                      onClick={() => setNdrAction(act.key as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                        ndrAction === act.key
                          ? "border-[#ff9903] bg-orange-50/60 text-orange-900 ring-2 ring-orange-100"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>

                {/* Conditional Inputs */}
                {ndrAction === "reschedule" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">New Delivery Date</label>
                    <input
                      type="date"
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-white"
                    />
                  </div>
                )}

                {ndrAction === "update_phone" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Updated Contact Phone</label>
                    <input
                      type="text"
                      placeholder="10-digit phone number"
                      value={updatedPhone}
                      onChange={(e) => setUpdatedPhone(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-white"
                    />
                  </div>
                )}

                {ndrAction === "update_address" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Correct Street Address</label>
                      <input
                        type="text"
                        placeholder="House / Street / Landmark"
                        value={updatedAddress}
                        onChange={(e) => setUpdatedAddress(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={updatedCity}
                        onChange={(e) => setUpdatedCity(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Pincode</label>
                      <input
                        type="text"
                        value={updatedPincode}
                        onChange={(e) => setUpdatedPincode(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-white font-mono"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Instruction Remarks for Courier Executive
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Spoke to customer, customer will be available after 2 PM."
                    value={ndrRemarks}
                    onChange={(e) => setNdrRemarks(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-white"
                  />
                </div>

                <button
                  onClick={handleSubmitNdrAction}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>{actionLoading ? "Sending..." : `Dispatch '${ndrAction.toUpperCase()}' Instruction`}</span>
                </button>
              </div>

              {/* ACTION 2: RTO WAREHOUSE INBOUND & QC RESTOCK */}
              {["rto_initiated", "rto_in_transit", "rto_received"].includes(selectedCase.status) && (
                <div className="bg-purple-50/50 rounded-2xl p-5 border border-purple-200 space-y-4">
                  <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wide flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-purple-600" />
                    <span>RTO Warehouse Inbound & QC Restock</span>
                  </h4>

                  {selectedCase.status !== "rto_received" && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-600">
                        When the RTO package arrives back at Zelton Ambala Central Warehouse, mark it as received to enable QC.
                      </p>
                      <button
                        onClick={handleMarkDelivered}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                      >
                        Mark RTO Received at Ambala Warehouse
                      </button>
                    </div>
                  )}

                  {selectedCase.status === "rto_received" && (
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Warehouse Inspection Status
                          </label>
                          <select
                            value={qcStatus}
                            onChange={(e) => setQcStatus(e.target.value as any)}
                            className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-white font-bold"
                          >
                            <option value="passed">QC Passed (Brand New Condition - Restock)</option>
                            <option value="damaged">QC Failed - Damaged / Crushed in Transit</option>
                            <option value="tampered">QC Failed - Tampered / Missing Items</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            QC Remarks
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Box intact, seals untampered."
                            value={qcRemarks}
                            onChange={(e) => setQcRemarks(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-white"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="autoRestock"
                          checked={autoRestock}
                          onChange={(e) => setAutoRestock(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <label htmlFor="autoRestock" className="text-xs font-semibold text-gray-800 cursor-pointer">
                          Automatically restock items into sellable inventory on QC pass
                        </label>
                      </div>

                      <button
                        onClick={handleQcSubmit}
                        disabled={actionLoading}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm disabled:opacity-50"
                      >
                        {actionLoading ? "Submitting QC..." : "Complete QC Inspection & Update Stock"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tracking Scans History */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Tracking Events</h4>
                <div className="space-y-2 text-xs">
                  {(selectedCase.trackingEvents || []).map((evt: any, i: number) => (
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
