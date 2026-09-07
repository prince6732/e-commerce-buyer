"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  MapPin,
  Download,
  Copy,
  Check,
  ArrowLeft,
  Search,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import imgPlaceholder from "@/public/imagePlaceholder.png";
import logoText from "@/public/ZeltonHorizontalBlack.png";
import axios from "../../../utils/axios";
import { downloadOrderInvoice } from "../../../utils/orderApi";

const basePath = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";

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
  shippingAddress?: string;
  shipping_address?: string;
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

function TrackOrderContent() {
  const searchParams = useSearchParams();

  // Form State
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Result State
  const [order, setOrder] = useState<Order | null>(null);
  const [trackingRecords, setTrackingRecords] = useState<TrackingRecord[]>([]);
  const [copiedWaybill, setCopiedWaybill] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [autoSearched, setAutoSearched] = useState(false);

  const isValidEmail = (emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr.trim());
  };

  // Extract query parameters on load
  useEffect(() => {
    const qOrder = searchParams.get("order") || searchParams.get("orderNumber") || searchParams.get("awb") || searchParams.get("waybill") || searchParams.get("id");
    const qEmail = searchParams.get("email");

    if (qOrder && !identifier) {
      setIdentifier(qOrder);
    }
    if (qEmail && !email) {
      setEmail(qEmail);
    }

    if (qOrder && qEmail && !autoSearched && isValidEmail(qEmail)) {
      setAutoSearched(true);
      executeTracking(qOrder, qEmail);
    }
  }, [searchParams]);

  const executeTracking = async (orderIden: string, emailAddr: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await axios.post("/api/orders/public-track", {
        identifier: orderIden.trim(),
        email: emailAddr.trim(),
      });

      if (res.data.success) {
        const orderData = res.data.data.order;
        setOrder(orderData);
        setTrackingRecords(res.data.data.tracking_records || orderData.trackingRecords || []);
      }
    } catch (err: any) {
      console.error("Public track order error:", err);
      const msg = err.response?.data?.message || "Order not found or details mismatch. Please verify your Order Number and Email.";
      setErrorMessage(msg);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  // Button disabled condition
  const isButtonDisabled = !identifier.trim() || !email.trim() || !isValidEmail(email) || loading;

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMessage("Please enter your Order Number or Delhivery AWB.");
      return;
    }
    if (!email.trim() || !isValidEmail(email)) {
      setErrorMessage("Please enter a valid email address (e.g. customer@example.com).");
      return;
    }
    await executeTracking(identifier, email);
  };

  const formatDate = (dateInput?: any) => {
    if (!dateInput) return "—";
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
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const resolveImageUrl = (url?: string | null) => {
    if (!url) return imgPlaceholder.src;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return `${basePath}${url}`;
    return `${basePath}/${url}`;
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
      console.error("Failed to download invoice:", err);
    } finally {
      setDownloadingInvoice(false);
    }
  };

  // ── Render Search Form View ──
  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-10 font-sans">
        {/* Centered Brand Logo (Above Card) */}
        <div className="mb-6 sm:mb-8 flex justify-center">
          <Link href="/" className="inline-block transition-transform hover:scale-105">
            <Image
              src={logoText}
              alt="Zelton Logo"
              className="h-8 sm:h-10 md:h-11 w-auto object-contain"
              priority
              unoptimized
            />
          </Link>
        </div>

        {/* Main Split Content Area */}
        <div className="w-full max-w-6xl bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-gray-200/90 overflow-hidden flex flex-col md:flex-row min-h-[540px]">
          {/* Left 50% - Delhivery Logistics Portal Section */}
          <div className="w-full md:w-1/2 bg-gradient-to-br from-[#0B192C] via-[#1E3E62] to-[#007FFF]/90 p-5 sm:p-8 lg:p-10 flex flex-col justify-between relative overflow-hidden text-white">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#007FFF]/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4 sm:space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold text-amber-300 border border-white/20 shadow-xs">
                <Truck className="w-4 h-4 text-amber-400" />
                <span>Delhivery Express Logistics Portal</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping ml-0.5"></span>
              </div>

              <div>
                <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-white">
                  Track Your ZELTON Order in Real-Time
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-gray-200 leading-relaxed max-w-md opacity-90">
                  Get instant GPS location checkpoints, courier milestone scans, and official GST invoices directly from our Delhivery live network.
                </p>
              </div>
            </div>

            <div className="relative z-10 pt-4 mt-4 border-t border-white/15 flex items-center justify-between text-[11px] text-gray-300">
              <span className="font-semibold text-white flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Official Logistics Gateway
              </span>
              <span>Fast &amp; Secure Shipping</span>
            </div>
          </div>

          {/* Right 50% - Track Order Form Card */}
          <div className="w-full md:w-1/2 bg-white p-3 sm:p-8 lg:p-12 flex flex-col justify-between">
            <div className="max-w-md mx-auto w-full my-auto space-y-5 sm:space-y-6">
              <div>
                <div className="inline-block text-xs font-bold uppercase tracking-wider text-[#007FFF] bg-blue-50 px-2.5 py-1 rounded-md mb-2">
                  Quick Shipment Search
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  Track Your Order
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Enter your Order ID / AWB and billing email below to view live tracking.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs sm:text-sm">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Tracking Error</p>
                    <p className="text-rose-700 text-xs mt-0.5 leading-relaxed">{errorMessage}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleTrackSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Order Number / Waybill AWB
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. ORD-1788605276057-995 or Delhivery AWB"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50/50 hover:bg-white focus:bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#007FFF] focus:border-[#007FFF] focus:outline-none transition shadow-xs"
                    />
                    <Package className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Billing / Account Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. customer@example.com"
                      className={`w-full pl-10 pr-4 py-3 bg-gray-50/50 hover:bg-white focus:bg-white border rounded-xl text-sm text-gray-900 focus:ring-2 focus:outline-none transition shadow-xs ${
                        email.trim() && !isValidEmail(email)
                          ? "border-rose-400 focus:ring-rose-400 focus:border-rose-400"
                          : "border-gray-300 focus:ring-[#007FFF] focus:border-[#007FFF]"
                      }`}
                    />
                    <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  {email.trim() && !isValidEmail(email) && (
                    <p className="text-[11px] text-rose-600 mt-1.5 font-semibold">
                      Please enter a valid email address
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isButtonDisabled}
                  className="w-full py-3.5 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044AA] text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Connecting to Delhivery...</span>
                    </>
                  ) : (
                    <>
                      <Truck className="w-4 h-4" />
                      <span>Track Order Now</span>
                    </>
                  )}
                </button>
              </form>

              <div className="pt-2 text-center text-[11px] text-gray-400 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>256-Bit SSL Encrypted Live Tracking</span>
              </div>
            </div>

            <div className="pt-6 text-center sm:text-right text-[10px] sm:text-[11px] text-gray-400 font-semibold tracking-wider uppercase border-t border-gray-100">
              Powered By <span className="text-gray-800 font-bold">Delhivery Logistics</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render Full Tracking Result Dashboard ──
  const orderNum = order.orderNumber || order.order_number || `ORD-${order.id}`;
  const invNum = order.invoiceNumber || order.invoice_number;
  const rawDate = order.createdAt || order.created_at;
  const itemsList = order.orderItems || order.order_items || [];
  const addressStr = order.shippingAddress || order.shipping_address || "";
  const waybillNum = order.delhiveryWaybill || order.delhivery_waybill;
  const delhiveryStatusStr = order.delhiveryStatus || order.delhivery_status;
  const payMethodStr = (order.paymentMethod || order.payment_method) === "cash_on_delivery" ? "Cash on Delivery" : "Online Payment";
  const payStatusStr = order.paymentStatus || order.payment_status || "pending";
  const currentStatus = (order.status || "pending").toLowerCase();
  const courierStatusLower = (delhiveryStatusStr || "").toLowerCase();

  const rawRecords = trackingRecords.length > 0 ? trackingRecords : (order.trackingRecords || order.tracking_records || []);
  const chronologicalRecords = [...rawRecords].sort((a, b) => {
    const timeA = new Date(a.tracked_at || a.trackedAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.tracked_at || b.trackedAt || b.createdAt || 0).getTime();
    return timeA - timeB;
  });

  const latestIndex = chronologicalRecords.length > 0 ? chronologicalRecords.length - 1 : -1;
  const latestEvent = latestIndex >= 0 ? chronologicalRecords[latestIndex] : null;

  // 5-Stage Step Index Computation
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
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Top Header with Brand Logo */}
      <div className="py-3 sm:py-4 bg-white border-b border-gray-200/80 flex items-center justify-between px-4 sm:px-8 max-w-7xl mx-auto w-full">
        <Link href="/" className="flex items-center">
          <Image
            src={logoText}
            alt="Zelton Logo"
            className="h-7 sm:h-8 w-auto object-contain"
            priority
            unoptimized
          />
        </Link>
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="hidden xs:inline">Delhivery Live Sync Active</span>
          <span className="inline xs:hidden">Live Sync</span>
        </div>
      </div>

      <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Top Navigation Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <button
              onClick={() => setOrder(null)}
              className="inline-flex items-center gap-2 text-base font-semibold text-gray-700 hover:text-gray-900 transition-colors w-fit cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Search Another Order</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => executeTracking(identifier, email)}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs sm:text-sm font-semibold text-[#007FFF] hover:bg-blue-100 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                <span>{loading ? "Refreshing..." : "Refresh Live Status"}</span>
              </button>

              <button
                onClick={handleDownloadInvoice}
                disabled={downloadingInvoice}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold text-gray-800 hover:bg-gray-50 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {downloadingInvoice ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4 text-gray-600" />
                )}
                <span>Download Invoice</span>
              </button>
            </div>
          </div>

          {/* Order Header & Courier Banner Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-100">
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-mono">{orderNum}</h1>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      currentStatus === "delivered" || courierStatusLower.includes("delivered")
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : isCancelled
                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                          : isRTO || isAttempted
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : delhiveryStatusStr
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
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

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600 font-medium">
                  <span>Order Date: <strong className="text-gray-900">{formatDate(rawDate)}</strong></span>
                  {invNum && <span>Invoice: <strong className="text-amber-600 font-mono font-bold">{invNum}</strong></span>}
                  <span>Payment: <strong className="text-gray-900">{payMethodStr} ({payStatusStr})</strong></span>
                </div>
              </div>

              {/* Courier Details Badge */}
              {waybillNum && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
                  <div className="w-12 h-12 bg-amber-500/10 text-[#ff9903] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Courier: Delhivery Express</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-mono font-bold text-gray-900">AWB: {waybillNum}</span>
                      <button
                        onClick={() => copyWaybill(waybillNum)}
                        className="text-gray-400 hover:text-gray-700 transition-colors p-1 cursor-pointer"
                        title="Copy Waybill AWB"
                      >
                        {copiedWaybill ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    {delhiveryStatusStr && (
                      <div className="text-xs text-emerald-700 font-semibold mt-0.5">
                        Live Status: {delhiveryStatusStr}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Stepper / Exception Alert */}
            {isCancelled ? (
              <div className="pt-6">
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-800 text-sm">
                  <XCircle className="w-6 h-6 text-rose-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-base">Order Cancelled</p>
                    <p className="text-xs text-rose-600 mt-0.5">This order has been cancelled.</p>
                  </div>
                </div>
              </div>
            ) : isRTO ? (
              <div className="pt-6">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-800 text-sm">
                  <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-base">Return to Origin (RTO)</p>
                    <p className="text-xs text-amber-700 mt-0.5">Shipment is returning to origin warehouse.</p>
                  </div>
                </div>
              </div>
            ) : isAttempted ? (
              <div className="pt-6">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3 text-blue-800 text-sm">
                  <Clock className="w-6 h-6 text-[#007FFF] flex-shrink-0" />
                  <div>
                    <p className="font-bold text-base">Delivery Attempted</p>
                    <p className="text-xs text-blue-700 mt-0.5">Courier attempted delivery; reattempt scheduled soon.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="pt-8">
                <div className="relative">
                  <div className="hidden sm:block absolute top-5 left-[10%] right-[10%] h-1 bg-gray-200 rounded-full z-0">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${(Math.max(0, currentStepIdx) / (steps.length - 1)) * 100}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 relative z-10">
                    {steps.map((step, idx) => {
                      const isCompleted = idx <= currentStepIdx;
                      const isCurrent = idx === currentStepIdx;

                      return (
                        <div key={step.label} className="flex flex-col items-center text-center">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all border-2 ${
                              isCompleted
                                ? "bg-emerald-600 border-emerald-600 text-white shadow"
                                : "bg-white border-gray-300 text-gray-400"
                            }`}
                          >
                            {isCompleted ? <Check className="w-5 h-5" /> : idx + 1}
                          </div>
                          <span className={`text-sm font-bold mt-2.5 ${isCurrent ? "text-emerald-700" : isCompleted ? "text-gray-900" : "text-gray-400"}`}>
                            {step.label}
                          </span>
                          <span className="text-xs text-gray-500 font-medium mt-0.5">{step.date}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2-Column Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left Column: Timeline */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
                <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-6 h-6 text-amber-500" />
                    <h2 className="text-lg font-bold text-gray-900">Shipment Timeline &amp; Live Scans</h2>
                  </div>
                  <span className="text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                    {chronologicalRecords.length} Tracking Event{chronologicalRecords.length === 1 ? "" : "s"}
                  </span>
                </div>

                {chronologicalRecords.length > 0 ? (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                    {chronologicalRecords.map((record, idx) => {
                      const recordTime = record.tracked_at || record.trackedAt || record.createdAt;
                      const isLatest = idx === latestIndex;

                      return (
                        <div key={record.id || idx} className="relative flex items-start gap-4">
                          <div
                            className={`absolute -left-6 top-1.5 w-4 h-4 rounded-full border-2 border-white flex-shrink-0 ${
                              isLatest ? "bg-emerald-600 ring-4 ring-emerald-100" : "bg-gray-400"
                            }`}
                          />

                          <div
                            className={`flex-1 p-4 sm:p-5 rounded-xl border text-sm leading-relaxed ${
                              isLatest ? "bg-emerald-50/70 border-emerald-200 text-emerald-950 shadow-sm" : "bg-gray-50/60 border-gray-200 text-gray-800"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                              <span className="font-extrabold text-base capitalize text-gray-900">
                                {record.status}
                              </span>
                              <span className="text-xs text-gray-500 font-semibold bg-white px-2.5 py-0.5 rounded border border-gray-200">
                                {formatDate(recordTime)}
                              </span>
                            </div>

                            <p className="text-gray-700 font-medium text-sm">{record.description}</p>

                            {record.location && (
                              <div className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-bold text-gray-600 bg-white px-2.5 py-1 rounded-md border border-gray-200">
                                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                                <span>{record.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 text-sm">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30 text-gray-400" />
                    <p className="font-semibold text-gray-700">No tracking logs recorded yet.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">

              {/* Delivery Address */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-500" />
                  <span>Delivery Address</span>
                </h3>
                {addressStr ? (
                  <div className="text-sm text-gray-800 space-y-1.5 leading-relaxed">
                    <p className="font-bold text-base text-gray-900">{order.user?.name || "Customer"}</p>
                    <p className="whitespace-pre-line text-gray-600 font-medium">{addressStr}</p>
                    {(order.user?.phone_number || order.user?.phoneNumber) && (
                      <p className="text-gray-500 pt-1 font-semibold text-xs">
                        Phone: <span className="text-gray-900">{order.user?.phone_number || order.user?.phoneNumber}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No delivery address recorded.</p>
                )}
              </div>

              {/* Order Items */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-500" />
                    <span>Items in Shipment ({itemsList.length})</span>
                  </span>
                </h3>

                {itemsList.length > 0 ? (
                  <div className="space-y-4 divide-y divide-gray-100">
                    {itemsList.map((item) => {
                      const prodName = item.product?.name || "Product";
                      const varTitle = item.variant?.title;
                      const sku = item.variant?.sku;
                      const rawImg = item.variant?.image_url || item.variant?.imageUrl || item.product?.image_url || item.product?.imageUrl;
                      const imgUrl = resolveImageUrl(rawImg);
                      const attributes = item.selectedAttributes || item.selected_attributes;

                      return (
                        <div key={item.id} className="pt-4 first:pt-0 flex gap-4 items-start">
                          <div className="relative w-16 h-16 rounded-xl bg-gray-50 border border-gray-200 flex-shrink-0 overflow-hidden shadow-xs">
                            <Image
                              src={imgUrl}
                              alt={prodName}
                              fill
                              unoptimized
                              className="object-contain p-1"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">{prodName}</h4>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {varTitle && (
                                <span className="text-[11px] font-semibold text-gray-700 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">
                                  {varTitle}
                                </span>
                              )}
                              {sku && (
                                <span className="text-[10px] font-mono text-gray-500 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">
                                  SKU: {sku}
                                </span>
                              )}
                            </div>

                            {attributes && Object.keys(attributes).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {Object.entries(attributes).map(([k, v]) => (
                                  <span key={k} className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                    {k}: {String(v)}
                                  </span>
                                ))}
                              </div>
                            )}

                            <p className="text-xs font-semibold text-gray-600 mt-2">
                              Qty: <strong className="text-gray-900">{item.quantity}</strong> × {formatCurrency(item.price)}
                            </p>
                          </div>

                          <div className="text-sm font-bold text-gray-900 flex-shrink-0 pt-0.5">
                            {formatCurrency(item.total)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No items listed.</p>
                )}
              </div>

              {/* Payment Summary */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Payment Breakdown
                </h3>
                <div className="space-y-2.5 text-sm text-gray-600 font-medium">
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
                  <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-base font-bold text-gray-900">
                    <span>Total Paid</span>
                    <span className="text-amber-600 text-lg">{formatCurrency(order.total)}</span>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

export default function StandaloneTrackOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[#007FFF] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <TrackOrderContent />
    </Suspense>
  );
}

