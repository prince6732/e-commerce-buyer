"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowLeft,
  Package,
  Truck,
  Clock,
  XCircle,
  MapPin,
  Download,
  Copy,
  Check,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import imgPlaceholder from "@/public/imagePlaceholder.png";
import axios from "../../../../../../utils/axios";
import { downloadOrderInvoice } from "../../../../../../utils/orderApi";
import { generateInvoicePDF } from "@/utils/generateInvoicePDF";
import { getImageUrl } from "../../../../../../utils/imageUtils";
import ZeltonLoader from "@/components/ui/ZeltonLoader";

type OrderItem = {
  id: number;
  quantity: number;
  price: number;
  total: number;
  selected_attributes?: Record<string, string> | null;
  selectedAttributes?: Record<string, string> | null;
  product?: {
    id: number;
    name: string;
    image_url?: string | null;
    imageUrl?: string | null;
  };
  variant?: {
    id: number;
    title: string;
    sku?: string;
    image_url?: string | null;
    imageUrl?: string | null;
  };
};

type TrackingRecord = {
  id: number;
  status: string;
  description: string;
  location?: string | null;
  tracked_at?: string | null;
  trackedAt?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
};

type Order = {
  id: number;
  orderNumber?: string;
  order_number?: string;
  invoiceNumber?: string;
  invoice_number?: string;
  status: string;
  paymentMethod?: string;
  payment_method?: string;
  paymentStatus?: string;
  payment_status?: string;
  subtotal: number;
  shippingFee?: number;
  shipping_fee?: number;
  tax: number;
  total: number;
  shippingAddress?: string | object;
  shipping_address?: string | object;
  notes?: string | null;
  createdAt?: string;
  created_at?: string;
  delhiveryWaybill?: string | null;
  delhivery_waybill?: string | null;
  delhiveryStatus?: string | null;
  delhivery_status?: string | null;
  user?: {
    id: number;
    name: string;
    email: string;
    phone_number?: string | null;
    phoneNumber?: string | null;
  };
  orderItems?: OrderItem[];
  order_items?: OrderItem[];
  trackingRecords?: TrackingRecord[];
  tracking_records?: TrackingRecord[];
};

export default function OrderTrackingPage() {
  const router = useRouter();
  const params = useParams();
  const { user, openAuthModal } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [trackingRecords, setTrackingRecords] = useState<TrackingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [copiedWaybill, setCopiedWaybill] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const orderId = (params?.slug || params?.id || "") as string;

  useEffect(() => {
    if (user && orderId) {
      fetchOrderTracking();
    } else if (!user) {
      setLoading(false);
    }
  }, [user, orderId]);

  const fetchOrderTracking = async (showSyncLoader = false) => {
    try {
      if (showSyncLoader) {
        setSyncing(true);
      } else {
        setLoading(true);
      }

      const response = await axios.get(`/api/orders/${orderId}/tracking`);

      if (response.data.success) {
        const orderData = response.data.data.order;
        setOrder(orderData);
        setTrackingRecords(
          response.data.data.tracking_records ||
            orderData.trackingRecords ||
            orderData.tracking_records ||
            []
        );

        if (showSyncLoader) {
          setSyncSuccess(true);
          setTimeout(() => setSyncSuccess(false), 3000);
        }
      }
    } catch (error) {
      console.error("Error fetching order tracking:", error);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  const formatDate = (dateInput?: any) => {
    if (!dateInput) return "—";
    try {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return "—";
      return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "—";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const copyWaybill = (waybill: string) => {
    navigator.clipboard.writeText(waybill);
    setCopiedWaybill(true);
    setTimeout(() => setCopiedWaybill(false), 2000);
  };

  const handleDownloadInvoice = async () => {
    if (!order) return;
    try {
      setDownloadingInvoice(true);
      await downloadOrderInvoice(order.id, false);
    } catch (err) {
      console.warn("Backend invoice download failed, trying client-side generator:", err);
      try {
        await generateInvoicePDF(order as any);
      } catch (fallbackErr) {
        console.error("Failed to download invoice:", fallbackErr);
      }
    } finally {
      setDownloadingInvoice(false);
    }
  };

  // Safe Address Formatter
  const parseAddress = (rawAddress: any) => {
    if (!rawAddress) return null;
    if (typeof rawAddress === "object" && rawAddress !== null) return rawAddress;
    if (typeof rawAddress === "string") {
      try {
        const parsed = JSON.parse(rawAddress);
        if (typeof parsed === "object" && parsed !== null) return parsed;
      } catch {
        return { raw: rawAddress };
      }
    }
    return { raw: String(rawAddress) };
  };

  if (!user) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center bg-white px-4">
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-md text-center max-w-md w-full">
          <div className="w-16 h-16 bg-blue-50 text-[#007FFF] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Track Your Order</h2>
          <p className="text-sm text-gray-500 mb-6">Please sign in to view live shipment updates and tracking details.</p>
          <button
            onClick={() => openAuthModal("login")}
            className="w-full py-3 bg-[#007FFF] hover:bg-[#0066CC] text-white rounded-xl font-bold text-sm transition shadow-md active:scale-95 cursor-pointer"
          >
            Sign In to Continue
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center bg-white">
        <div className="text-center py-12 bg-white rounded-3xl border border-gray-100 p-8 max-w-sm w-full shadow-sm">
          <ZeltonLoader size="lg" variant="brand" className="mx-auto mb-4" />
          <p className="text-sm font-bold text-gray-800">Fetching Shipment Updates...</p>
          <p className="text-xs text-gray-400 mt-1">Connecting to tracking courier network</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center bg-white px-4">
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm text-center max-w-md w-full">
          <XCircle className="w-14 h-14 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900 mb-1">Order Not Found</h2>
          <p className="text-xs sm:text-sm text-gray-500 mb-6">We couldn't locate this order in your account history.</p>
          <button
            onClick={() => router.push("/orders")}
            className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-xl font-bold text-sm transition active:scale-95 cursor-pointer"
          >
            Back to All Orders
          </button>
        </div>
      </div>
    );
  }

  // Field extractors
  const orderNum = order.orderNumber || order.order_number || `ORD-${order.id}`;
  const invNum = order.invoiceNumber || order.invoice_number;
  const rawDate = order.createdAt || order.created_at;
  const itemsList = order.orderItems || order.order_items || [];
  const rawAddress = order.shippingAddress || order.shipping_address;
  const addrObj = parseAddress(rawAddress);
  const waybillNum = order.delhiveryWaybill || order.delhivery_waybill;
  const delhiveryStatusStr = order.delhiveryStatus || order.delhivery_status;
  const payMethodStr = (order.paymentMethod || order.payment_method) === "cash_on_delivery" ? "Cash on Delivery" : "Online Payment";
  const payStatusStr = order.paymentStatus || order.payment_status || "pending";
  const currentStatus = (order.status || "pending").toLowerCase();
  const courierStatusLower = (delhiveryStatusStr || "").toLowerCase();

  // Sort tracking events chronologically (oldest to newest)
  const rawRecords = trackingRecords.length > 0 ? trackingRecords : (order.trackingRecords || order.tracking_records || []);
  const chronologicalRecords = [...rawRecords].sort((a, b) => {
    const timeA = new Date(a.tracked_at || a.trackedAt || a.created_at || a.createdAt || 0).getTime();
    const timeB = new Date(b.tracked_at || b.trackedAt || b.created_at || b.createdAt || 0).getTime();
    return timeA - timeB;
  });

  const latestIndex = chronologicalRecords.length > 0 ? chronologicalRecords.length - 1 : -1;
  const latestEvent = latestIndex >= 0 ? chronologicalRecords[latestIndex] : null;

  // 5-Stage Step Index Computation
  // 0: Order Placed
  // 1: Order Confirmed
  // 2: Dispatched / In Transit
  // 3: Out for Delivery
  // 4: Delivered
  const get5StepIndex = () => {
    if (currentStatus === "cancelled" || courierStatusLower.includes("cancel")) {
      return -1;
    }
    if (currentStatus === "delivered" || currentStatus === "completed" || courierStatusLower.includes("delivered")) {
      return 4;
    }
    if (
      courierStatusLower.includes("out for delivery") ||
      courierStatusLower.includes("dispatched for delivery") ||
      courierStatusLower.includes("ofd")
    ) {
      return 3;
    }
    if (
      courierStatusLower.includes("transit") ||
      courierStatusLower.includes("picked") ||
      courierStatusLower.includes("manifest") ||
      courierStatusLower.includes("dispatched") ||
      currentStatus === "shipped" ||
      Boolean(waybillNum)
    ) {
      return 2;
    }
    if (currentStatus === "confirmed" || currentStatus === "processing") {
      return 1;
    }
    return 0;
  };

  const currentStepIdx = get5StepIndex();

  // Determine Exception Alerts
  const isRTO = courierStatusLower.includes("rto") || courierStatusLower.includes("return");
  const isAttempted = courierStatusLower.includes("attempt") || courierStatusLower.includes("undelivered") || courierStatusLower.includes("failed");
  const isCancelled = currentStatus === "cancelled" || courierStatusLower.includes("cancel");

  const steps = [
    { label: "Order Placed", date: formatDate(rawDate) },
    { label: "Order Confirmed", date: currentStepIdx >= 1 ? "Confirmed" : "Pending" },
    {
      label: "Dispatched",
      date: currentStepIdx >= 2
        ? (waybillNum ? "In Transit" : "Dispatched")
        : "Awaiting Dispatch",
    },
    {
      label: "Out for Delivery",
      date: currentStepIdx >= 3
        ? "With Courier Agent"
        : (currentStepIdx >= 2 ? "Scheduled Soon" : "Pending"),
    },
    {
      label: "Delivered",
      date: currentStepIdx === 4
        ? (formatDate(latestEvent?.tracked_at || latestEvent?.trackedAt || latestEvent?.createdAt) !== "—"
            ? formatDate(latestEvent?.tracked_at || latestEvent?.trackedAt || latestEvent?.createdAt)
            : "Delivered")
        : "Est. 2-4 Days",
    },
  ];

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* ── Top Header Section ── */}
      <section className="py-6 sm:py-8 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-between gap-4">
            <button
              onClick={() => router.push("/orders")}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer border border-gray-200/60"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Orders</span>
            </button>

            <div className="text-center">
              <h1 className="text-lg sm:text-2xl font-serif font-black tracking-widest text-[#0A0908] uppercase">
                Order Tracking
              </h1>
              <p className="text-xs text-gray-500 font-mono mt-0.5 font-medium">
                #{orderNum}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Sync Live Status Button */}
              <button
                onClick={() => fetchOrderTracking(true)}
                disabled={syncing}
                title="Sync Live Tracking from Delhivery"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-[#007FFF] border border-blue-200 rounded-full text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-[#007FFF]" : ""}`} />
                <span className="hidden sm:inline">{syncing ? "Syncing..." : syncSuccess ? "Updated!" : "Refresh Status"}</span>
              </button>

              <button
                onClick={handleDownloadInvoice}
                disabled={downloadingInvoice}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {downloadingInvoice ? (
                  <ZeltonLoader size="xs" variant="brand" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span className="hidden sm:inline">Invoice</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">

        {/* ── 1. Order Summary & Status Card ── */}
        <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-100">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight font-mono">
                  {orderNum}
                </h2>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                    currentStatus === "delivered" || courierStatusLower.includes("delivered")
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : isCancelled
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : isRTO || isAttempted
                          ? "bg-amber-50 text-amber-800 border-amber-300"
                          : delhiveryStatusStr
                            ? "bg-blue-50 text-[#007FFF] border-blue-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {isCancelled
                    ? "Cancelled"
                    : isRTO
                      ? "RTO Initiated"
                      : isAttempted
                        ? `Attempted (${delhiveryStatusStr})`
                        : (delhiveryStatusStr || currentStatus)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-gray-500 font-medium">
                <span>Placed on <strong className="text-gray-900">{formatDate(rawDate)}</strong></span>
                {invNum && (
                  <span>Invoice: <strong className="text-amber-700 font-mono">{invNum}</strong></span>
                )}
                <span>Payment: <strong className="text-gray-900">{payMethodStr} ({payStatusStr})</strong></span>
              </div>
            </div>

            {/* Courier AWB details (if assigned) */}
            {waybillNum && (
              <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 flex items-center gap-3.5">
                <div className="w-10 h-10 bg-white text-[#007FFF] rounded-xl flex items-center justify-center shadow-xs flex-shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Delhivery Express Logistics</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono font-bold text-gray-900">AWB: {waybillNum}</span>
                    <button
                      onClick={() => copyWaybill(waybillNum)}
                      className="text-gray-400 hover:text-gray-700 transition p-0.5 cursor-pointer"
                      title="Copy AWB"
                    >
                      {copiedWaybill ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Exception Alert Banners ── */}
          {isCancelled ? (
            <div className="pt-6">
              <div className="bg-rose-50/80 border border-rose-200/90 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 text-rose-950">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-rose-950">Order Cancelled</h3>
                  <p className="text-xs sm:text-sm text-rose-700 mt-0.5 font-medium leading-relaxed">
                    This order has been cancelled. If payment was completed, any applicable refund will be credited to your original payment method.
                  </p>
                </div>
              </div>
            </div>
          ) : isRTO ? (
            <div className="pt-6">
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 text-amber-950">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-amber-950">Return to Origin (RTO) Initiated</h3>
                  <p className="text-xs sm:text-sm text-amber-800 mt-0.5 font-medium leading-relaxed">
                    Package is being returned back to our fulfillment center by Delhivery. Our support team will reach out to you shortly.
                  </p>
                </div>
              </div>
            </div>
          ) : isAttempted ? (
            <div className="pt-6">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 text-blue-950">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#007FFF] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-blue-950">Delivery Attempted</h3>
                  <p className="text-xs sm:text-sm text-blue-800 mt-0.5 font-medium leading-relaxed">
                    Delhivery attempted delivery at your location. Another delivery attempt will be made soon. Please ensure your contact phone is reachable.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* ── 5-Stage Stepper ── */}
          {!isCancelled && (
            <div className="pt-8">
              <div className="relative">
                {/* Connector Line */}
                <div className="hidden sm:block absolute top-5 left-[10%] right-[10%] h-1 bg-gray-200 rounded-full z-0">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${(Math.max(0, currentStepIdx) / (steps.length - 1)) * 100}%` }}
                  />
                </div>

                {/* Stepper Dots (5 columns on desktop) */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 relative z-10">
                  {steps.map((step, idx) => {
                    const isCompleted = idx <= currentStepIdx;
                    const isCurrent = idx === currentStepIdx;

                    return (
                      <div key={step.label} className="flex flex-col items-center text-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all border-2 ${
                            isCompleted
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                              : "bg-white border-gray-300 text-gray-400"
                          }`}
                        >
                          {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                        </div>
                        <span
                          className={`text-xs sm:text-sm font-bold mt-2.5 ${
                            isCurrent
                              ? "text-emerald-700"
                              : isCompleted
                                ? "text-gray-900"
                                : "text-gray-400"
                          }`}
                        >
                          {step.label}
                        </span>
                        <span className="text-[11px] text-gray-500 font-medium mt-0.5">{step.date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── 2. Two-Column Details Area ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column: Shipment Timeline & Live Scans (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs p-6 sm:p-8">
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">Shipment Timeline &amp; Live Courier Scans</h2>
                </div>
                <span className="text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1 rounded-full border border-gray-200/80">
                  {chronologicalRecords.length} Event{chronologicalRecords.length === 1 ? "" : "s"}
                </span>
              </div>

              {chronologicalRecords.length > 0 ? (
                <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                  {chronologicalRecords.map((record, idx) => {
                    const recordTime = record.tracked_at || record.trackedAt || record.created_at || record.createdAt;
                    const isCurrentLatest = idx === latestIndex;
                    const recStatus = (record.status || "").toLowerCase();
                    const isCancelledEvent = recStatus.includes("cancel");
                    const isDeliveredEvent = recStatus.includes("delivered") || recStatus.includes("completed");

                    // Determine box styling based on event status & active state
                    let boxStyle = "bg-gray-50/70 border-gray-200 text-gray-800";
                    let dotStyle = "bg-gray-400";

                    if (isCurrentLatest) {
                      if (isCancelledEvent) {
                        boxStyle = "bg-rose-50/80 border-rose-300 text-rose-950 shadow-xs";
                        dotStyle = "bg-rose-600 ring-4 ring-rose-100";
                      } else if (isDeliveredEvent) {
                        boxStyle = "bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-xs";
                        dotStyle = "bg-emerald-600 ring-4 ring-emerald-100";
                      } else {
                        boxStyle = "bg-blue-50/80 border-blue-300 text-blue-950 shadow-xs";
                        dotStyle = "bg-[#007FFF] ring-4 ring-blue-100";
                      }
                    } else if (isCancelledEvent) {
                      boxStyle = "bg-rose-50/40 border-rose-200 text-rose-900";
                      dotStyle = "bg-rose-500";
                    }

                    return (
                      <div key={record.id || idx} className="relative flex items-start gap-4">
                        {/* Dot Indicator */}
                        <div
                          className={`absolute -left-6 top-2 w-3.5 h-3.5 rounded-full border-2 border-white flex-shrink-0 transition-all ${dotStyle}`}
                        />

                        <div className={`flex-1 p-4 sm:p-5 rounded-2xl border text-sm leading-relaxed ${boxStyle}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <span className="font-black text-sm sm:text-base capitalize">
                              {record.status}
                            </span>
                            <span className="text-[11px] text-gray-500 font-semibold bg-white/90 px-2.5 py-0.5 rounded-lg border border-gray-200/60">
                              {formatDate(recordTime)}
                            </span>
                          </div>

                          <p className="text-xs sm:text-sm font-medium mt-1 opacity-90">{record.description}</p>

                          {record.location && (
                            <div className="inline-flex items-center gap-1.5 mt-2.5 text-[11px] font-bold text-gray-600 bg-white/80 px-2.5 py-1 rounded-lg border border-gray-200/60">
                              <MapPin className="w-3 h-3 text-amber-500" />
                              <span>{record.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400 text-sm">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-30 text-gray-400" />
                  <p className="font-bold text-gray-700">No tracking scans recorded yet.</p>
                  <p className="text-xs text-gray-400 mt-1">Updates will appear as the courier scans your package in transit.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Address, Order Items, Breakdown (1 col) */}
          <div className="space-y-6">

            {/* 1. Delivery Address Card */}
            <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs p-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3.5 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-500" />
                <span>Delivery Address</span>
              </h3>

              {addrObj ? (
                <div className="text-xs sm:text-sm text-gray-800 space-y-1 leading-relaxed">
                  <p className="font-bold text-sm sm:text-base text-gray-900">
                    {addrObj.name || addrObj.fullName || order.user?.name || "Customer"}
                  </p>
                  {(addrObj.add || addrObj.address || addrObj.street) && (
                    <p className="text-gray-600 font-medium">
                      {addrObj.add || addrObj.address || addrObj.street}
                    </p>
                  )}
                  {(addrObj.city || addrObj.state || addrObj.pin || addrObj.pincode) && (
                    <p className="text-gray-600 font-medium">
                      {[
                        addrObj.city,
                        addrObj.state,
                        addrObj.pin || addrObj.pincode ? `PIN: ${addrObj.pin || addrObj.pincode}` : null,
                      ].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {addrObj.country && (
                    <p className="text-gray-400 text-[11px] font-semibold">{addrObj.country}</p>
                  )}
                  {addrObj.raw && (
                    <p className="text-gray-600 font-medium whitespace-pre-line">{addrObj.raw}</p>
                  )}
                  {(addrObj.phone || order.user?.phone_number || order.user?.phoneNumber) && (
                    <p className="text-gray-500 pt-1 text-xs font-medium">
                      Phone: <strong className="text-gray-900">{addrObj.phone || order.user?.phone_number || order.user?.phoneNumber}</strong>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No delivery address specified.</p>
              )}
            </div>

            {/* 2. Items in Shipment */}
            <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs p-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3.5 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-500" />
                  <span>Items in Shipment ({itemsList.length})</span>
                </span>
              </h3>

              {itemsList.length > 0 ? (
                <div className="space-y-3.5 divide-y divide-gray-100">
                  {itemsList.map((item) => {
                    const prodName = item.product?.name || "Product";
                    const varTitle = item.variant?.title;
                    const rawImg = item.variant?.image_url || item.variant?.imageUrl || item.product?.image_url || item.product?.imageUrl;
                    const imgUrl = getImageUrl(rawImg) || imgPlaceholder.src;

                    return (
                      <div key={item.id} className="pt-3.5 first:pt-0 flex gap-3.5 items-center">
                        <div className="relative w-14 h-14 rounded-xl bg-gray-50 border border-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                          <img
                            src={imgUrl}
                            alt={prodName}
                            className="w-full h-full object-contain p-1"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = imgPlaceholder.src;
                            }}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-1">{prodName}</h4>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-gray-500">
                            {varTitle && (
                              <span className="text-[10px] font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                                {varTitle}
                              </span>
                            )}
                            <span className="text-[11px]">Qty: {item.quantity}</span>
                          </div>
                        </div>

                        <div className="text-xs sm:text-sm font-bold text-gray-900 flex-shrink-0">
                          {formatCurrency(item.total)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No items listed.</p>
              )}
            </div>

            {/* 3. Payment Breakdown */}
            <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs p-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3.5">
                Payment Breakdown
              </h3>
              <div className="space-y-2 text-xs sm:text-sm text-gray-600 font-medium">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-gray-900">{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping Fee</span>
                  <span className="font-bold text-emerald-600">
                    {(order.shippingFee || order.shipping_fee || 0) === 0 ? "FREE" : formatCurrency(order.shippingFee || order.shipping_fee || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (GST)</span>
                  <span className="font-bold text-gray-900">{formatCurrency(order.tax)}</span>
                </div>
                <div className="pt-2.5 border-t border-gray-100 flex justify-between items-center text-sm sm:text-base font-bold text-gray-900">
                  <span>Total</span>
                  <span className="text-amber-600 text-base sm:text-lg">{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}