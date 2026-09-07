"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  RotateCcw,
  RefreshCw,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Package,
  Building2,
  CreditCard,
  MapPin,
  Calendar,
  AlertCircle,
  Check,
  ShieldCheck,
  Ban,
} from "lucide-react";
import { returnApi } from "@/utils/returnApi";
import imgPlaceholder from "@/public/imagePlaceholder.png";

const basePath = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";

const STAGES = [
  { key: "requested", title: "Request Submitted", desc: "Under review by our team" },
  { key: "approved", title: "Return Approved", desc: "Preparing reverse courier pickup" },
  { key: "in_transit", title: "Reverse Pickup & Transit", desc: "En route to Central Warehouse" },
  { key: "qc_passed", title: "Warehouse Quality Check", desc: "Inspected & Verified" },
  { key: "completed", title: "Refund / Exchange Done", desc: "Payout or replacement completed" },
];

export default function ReturnTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug || "") as string;
  const returnNumber = (params?.returnNumber || "") as string;

  const [returnReq, setReturnReq] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (returnNumber) {
      fetchReturnDetails();
    }
  }, [returnNumber]);

  const fetchReturnDetails = async () => {
    setLoading(true);
    try {
      const data = await returnApi.getReturnDetails(returnNumber);
      setReturnReq(data);
    } catch (err: any) {
      setErrorMsg("Failed to load return details. Please check the link or log in.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelReturn = async () => {
    if (!window.confirm("Are you sure you want to cancel this return request?")) return;
    setCancelling(true);
    try {
      await returnApi.cancelReturn(returnReq.id, "Cancelled by user from tracking page");
      await fetchReturnDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "Failed to cancel return");
    } finally {
      setCancelling(false);
    }
  };

  const getStageStatus = (stageKey: string) => {
    if (!returnReq) return "pending";
    const status = returnReq.status;

    if (status === "cancelled") return "cancelled";
    if (status === "rejected" && stageKey !== "requested") return "cancelled";

    const stageHierarchy = [
      ["requested"],
      ["approved", "pickup_scheduled"],
      ["picked_up", "in_transit", "received_at_warehouse"],
      ["qc_pending", "qc_passed", "qc_failed"],
      ["refund_pending", "refund_processing", "refunded", "exchange_processing", "completed"],
    ];

    const currentIdx = stageHierarchy.findIndex((arr) => arr.includes(status));
    const thisStageIdx = STAGES.findIndex((s) => s.key === stageKey);

    if (currentIdx > thisStageIdx) return "completed";
    if (currentIdx === thisStageIdx) {
      if (status === "qc_failed") return "failed";
      return "active";
    }
    return "pending";
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center py-12">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-[#007FFF] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading return tracking status...</p>
        </div>
      </div>
    );
  }

  if (!returnReq) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-lg border border-gray-100">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Return Not Found</h3>
          <p className="text-gray-500 text-sm mb-6">
            We couldn't find a return request matching #{returnNumber}.
          </p>
          <button
            onClick={() => router.push(`/orders/${slug}`)}
            className="px-6 py-2.5 bg-[#007FFF] text-white font-bold text-xs rounded-xl"
          >
            Back to Order
          </button>
        </div>
      </div>
    );
  }

  const items = returnReq.items || [];
  const events = returnReq.trackingEvents || [];
  const isExchange = returnReq.returnType === "exchange";
  const isCancelled = returnReq.status === "cancelled";
  const isRejected = returnReq.status === "rejected";
  const isQcFailed = returnReq.status === "qc_failed";
  const canCancel = ["requested", "approved"].includes(returnReq.status);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl space-y-6">
        {/* Header navigation bar */}
        <div className="bg-white rounded-2xl px-6 py-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/orders/${slug}`)}
              className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">
                  {isExchange ? "Exchange Request" : "Return Request"}
                </h1>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                    isCancelled || isRejected || isQcFailed
                      ? "bg-red-100 text-red-700"
                      : returnReq.status === "completed" || returnReq.status === "refunded"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {returnReq.status?.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-mono mt-0.5">#{returnReq.returnNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canCancel && (
              <button
                onClick={handleCancelReturn}
                disabled={cancelling}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl transition-all border border-red-200 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{cancelling ? "Cancelling..." : "Cancel Request"}</span>
              </button>
            )}
            <Link
              href={`/orders/${slug}`}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all"
            >
              View Order #{returnReq.order?.orderNumber}
            </Link>
          </div>
        </div>

        {/* Rejection / Cancellation alert */}
        {isRejected && (
          <div className="p-5 bg-red-50 border border-red-200 rounded-2xl text-red-900 flex items-start gap-3">
            <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">Return Request Rejected</h4>
              <p className="text-xs text-red-700 mt-1">
                <strong>Reason:</strong> {returnReq.rejectionReason || "Inspection criteria not met."}
              </p>
            </div>
          </div>
        )}

        {isQcFailed && (
          <div className="p-5 bg-red-50 border border-red-200 rounded-2xl text-red-900 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">Quality Inspection Failed</h4>
              <p className="text-xs text-red-700 mt-1">
                <strong>QC Remarks:</strong> {returnReq.qcRemarks || "Returned items arrived damaged or missing seals."}
              </p>
            </div>
          </div>
        )}

        {/* 5-Stage Reverse Timeline Stepper */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 text-lg mb-6">Reverse Shipment Progress</h3>

          <div className="relative">
            {/* Desktop timeline line */}
            <div className="hidden md:block absolute top-5 left-8 right-8 h-1 bg-gray-200 z-0" />

            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative z-10">
              {STAGES.map((s, idx) => {
                const stageStatus = getStageStatus(s.key);

                return (
                  <div key={s.key} className="flex md:flex-col items-start md:items-center gap-4 md:gap-2">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all flex-shrink-0 ${
                        stageStatus === "completed"
                          ? "bg-emerald-500 text-white ring-4 ring-emerald-100 shadow"
                          : stageStatus === "active"
                          ? "bg-[#007FFF] text-white ring-4 ring-blue-100 shadow-md animate-pulse"
                          : stageStatus === "failed" || stageStatus === "cancelled"
                          ? "bg-red-500 text-white ring-4 ring-red-100"
                          : "bg-gray-200 text-gray-400"
                      }`}
                    >
                      {stageStatus === "completed" ? (
                        <Check className="w-5 h-5" />
                      ) : stageStatus === "failed" || stageStatus === "cancelled" ? (
                        <XCircle className="w-5 h-5" />
                      ) : (
                        idx + 1
                      )}
                    </div>

                    <div className="md:text-center">
                      <h4
                        className={`text-xs font-bold ${
                          stageStatus === "active"
                            ? "text-[#007FFF]"
                            : stageStatus === "completed"
                            ? "text-emerald-700"
                            : "text-gray-800"
                        }`}
                      >
                        {s.title}
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{s.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delhivery Reverse AWB Card */}
          {returnReq.reverseWaybill && (
            <div className="mt-8 p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#007FFF] flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-800">
                    Delhivery Reverse AWB: <span className="font-mono text-[#007FFF]">{returnReq.reverseWaybill}</span>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Carrier: {returnReq.reverseCourierName || "Delhivery Express Reverse"}
                  </div>
                </div>
              </div>

              <a
                href={`https://www.delhivery.com/tracking?waybill=${returnReq.reverseWaybill}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 bg-[#007FFF] hover:bg-[#0066CC] text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-1 self-start sm:self-auto"
              >
                <span>Track on Delhivery</span>
              </a>
            </div>
          )}
        </div>

        {/* Return Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Items to Return */}
          <div className="md:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
            <h3 className="font-bold text-gray-900 text-base">Items in this {isExchange ? "Exchange" : "Return"}</h3>

            <div className="space-y-3">
              {items.map((item: any) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="relative w-16 h-16 rounded-xl bg-white border border-gray-200 overflow-hidden flex-shrink-0">
                      <Image
                        src={`${basePath}${item.product?.imageUrl || item.variant?.imageUrl || imgPlaceholder.src}`}
                        alt={item.product?.name || "Product"}
                        fill
                        unoptimized
                        className="object-contain p-1"
                      />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{item.product?.name}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.variant?.title || "Standard"} • Qty: <strong>{item.quantity}</strong>
                      </p>

                      {isExchange && item.exchangeVariant && (
                        <div className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 bg-purple-50 text-purple-700 text-[11px] font-bold rounded-md border border-purple-200">
                          <RefreshCw className="w-3 h-3" />
                          <span>Exchanging for: {item.exchangeVariant.title}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-sm text-gray-900">₹{item.price}</span>
                    <div className="text-[11px] text-gray-500">Total: ₹{(Number(item.price) * item.quantity).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Customer Reason / Uploads */}
            <div className="pt-4 border-t border-gray-100 text-xs space-y-2 text-gray-700">
              <div>
                <strong>Reason:</strong> {returnReq.reason?.replace(/_/g, " ")}
              </div>
              {returnReq.reasonDetails && (
                <div>
                  <strong>Customer Remarks:</strong> {returnReq.reasonDetails}
                </div>
              )}
            </div>
          </div>

          {/* Refund / Payout Summary & Pickup Address */}
          <div className="space-y-6">
            {/* Refund info card */}
            {!isExchange && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-3">
                <h3 className="font-bold text-gray-900 text-sm">Refund Summary</h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Refund Amount:</span>
                    <span className="font-bold text-base text-emerald-600">₹{returnReq.refundAmount}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Refund Mode:</span>
                    <span className="capitalize font-semibold text-gray-900">
                      {returnReq.refundMode === "bank_transfer_upi" ? "Bank / UPI" : "Original Payment"}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Refund Status:</span>
                    <span className="capitalize font-bold text-emerald-600">{returnReq.refundStatus}</span>
                  </div>

                  {returnReq.refundTransactionId && (
                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-[11px] text-gray-500 block">Transaction Reference:</span>
                      <span className="font-mono text-[11px] font-bold text-gray-900 break-all">
                        {returnReq.refundTransactionId}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Doorstep Pickup Address */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#007FFF]" />
                <h3 className="font-bold text-gray-900 text-sm">Pickup Address</h3>
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                <p className="font-bold text-gray-900">{returnReq.pickupAddress?.name}</p>
                <p>{returnReq.pickupAddress?.address}</p>
                <p>
                  {returnReq.pickupAddress?.city}, {returnReq.pickupAddress?.state} - {returnReq.pickupAddress?.pincode}
                </p>
                <p className="text-gray-500">Phone: {returnReq.pickupAddress?.phone}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Scans History */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-bold text-gray-900 text-base">Tracking Event History</h3>

          {events.length > 0 ? (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
              {events.map((evt: any, i: number) => (
                <div key={evt.id || i} className="relative">
                  <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-[#007FFF] ring-4 ring-blue-100" />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h5 className="font-bold text-xs text-gray-900">{evt.description || evt.status}</h5>
                    <span className="text-[11px] text-gray-400 font-mono">{formatDate(evt.eventTime || evt.createdAt)}</span>
                  </div>
                  {evt.location && <p className="text-[11px] text-gray-500 mt-0.5">Location: {evt.location}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">Initial request created. Courier updates will appear here.</p>
          )}
        </div>
      </div>
    </div>
  );
}
