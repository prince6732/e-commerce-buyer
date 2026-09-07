"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  Clock,
  X,
  AlertTriangle,
  Download,
  RotateCcw,
  RefreshCw,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import imgPlaceholder from "@/public/imagePlaceholder.png";
import { getOrder, downloadOrderInvoice } from "../../../../../utils/orderApi";
import { returnApi } from "../../../../../utils/returnApi";
import { generateInvoicePDF } from "@/utils/generateInvoicePDF";
import ErrorMessage from "@/components/(sheared)/ErrorMessage";
import SuccessMessage from "@/components/(sheared)/SuccessMessage";
import { formatAddressDisplay } from "../../../../../utils/addressUtils";
import ReturnRequestModal from "@/components/returns/ReturnRequestModal";

const basePath = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = (params?.slug || params?.id || "") as string;

  const [order, setOrder] = useState<any>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const handleDownloadInvoice = async () => {
    if (!order) return;
    try {
      setDownloadingInvoice(true);
      await downloadOrderInvoice(order.id);
    } catch (err) {
      console.warn("Backend PDF download failed, fallback to client generation:", err);
      try {
        await generateInvoicePDF(order);
      } catch (fallbackErr) {
        console.error("Client PDF generation error:", fallbackErr);
        setErrorMessage("Failed to download invoice. Please try again.");
      }
    } finally {
      setDownloadingInvoice(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    setLoading(true);
    try {
      const response = await getOrder(orderId);
      if (response.success) {
        setOrder(response.data);
        // Check return eligibility
        try {
          const eligRes = await returnApi.checkEligibility(response.data.id);
          setEligibility(eligRes);
        } catch (e) {
          console.warn("Could not check return eligibility:", e);
        }
      }
    } catch (error) {
      console.error("Error fetching order details:", error);
      setErrorMessage("Failed to load order details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case "confirmed":
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
      case "processing":
        return <Package className="w-5 h-5 text-purple-500" />;
      case "shipped":
        return <Truck className="w-5 h-5 text-orange-500" />;
      case "delivered":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "cancelled":
        return <X className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "confirmed":
        return "bg-blue-100 text-blue-800";
      case "processing":
        return "bg-purple-100 text-purple-800";
      case "shipped":
        return "bg-orange-100 text-orange-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center py-12">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-[#007FFF] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Order Not Found</h3>
          <p className="text-gray-600 mb-6">
            The order you are trying to view does not exist or you do not have permission to view it.
          </p>
          <button
            onClick={() => router.push("/orders")}
            style={{ backgroundColor: "var(--theme-blue)", color: "#FFFAFB" }}
            className="px-6 py-2 rounded-lg hover:bg-[#0066CC] transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const isDelivered = order.status === "delivered";
  const hasEligibleItems = eligibility?.items && eligibility.items.length > 0;
  const existingReturns = order.returnRequests || order.returns || [];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {errorMessage && <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />}
        {successMessage && <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />}

        {/* Header card with back button */}
        <div className="bg-white rounded-2xl px-6 py-4 mb-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/orders")}
              className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Order Details</h1>
              <p className="text-sm text-gray-500 font-mono">Order #{order.order_number}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Live Tracking Link */}
            <Link
              href={`/orders/${order.slug || order.order_number || order.id}/tracking`}
              className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-[#007FFF] font-bold text-xs md:text-sm rounded-lg transition-all flex items-center gap-1.5 border border-blue-200 shadow-sm"
            >
              <Truck className="w-4 h-4" />
              <span>Track Delivery</span>
            </Link>

            {/* Request Return / Exchange Button */}
            {isDelivered && hasEligibleItems && (
              <button
                onClick={() => setShowReturnModal(true)}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs md:text-sm rounded-lg transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Return / Exchange</span>
              </button>
            )}

            <button
              onClick={handleDownloadInvoice}
              disabled={downloadingInvoice}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs md:text-sm rounded-lg transition-all flex items-center gap-2 shadow-sm hover:shadow-md disabled:opacity-50"
            >
              {downloadingInvoice ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Invoice</span>
                </>
              )}
            </button>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </span>
            {getStatusIcon(order.status)}
          </div>
        </div>

        {/* Existing Returns Banner */}
        {existingReturns.length > 0 && (
          <div className="mb-6 p-5 bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl shadow-md border border-blue-800/40">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-[#ff9903] flex items-center justify-center border border-blue-500/30">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-base">Return / Exchange in Progress</h4>
                  <p className="text-xs text-blue-200 mt-0.5">
                    Return request <strong>#{existingReturns[0].returnNumber || existingReturns[0].return_number}</strong> ({existingReturns[0].status?.replace(/_/g, " ").toUpperCase()})
                  </p>
                </div>
              </div>

              <Link
                href={`/orders/${order.slug || order.order_number || order.id}/returns/${existingReturns[0].returnNumber || existingReturns[0].return_number || existingReturns[0].id}`}
                className="px-4 py-2 bg-white text-slate-900 hover:bg-blue-50 font-bold text-xs rounded-xl transition-all shadow flex items-center gap-1.5"
              >
                <span>Track Return Progress</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Order Information & Address */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 text-lg mb-4">Order Information</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500">Order Date:</span>
                  <span className="font-semibold text-gray-800">{formatDate(order.created_at)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500">Payment Method:</span>
                  <span className="font-semibold text-gray-800">
                    {order.payment_method === "cash_on_delivery" ? "Cash on Delivery" : "Online Payment"}
                  </span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-gray-500">Payment Status:</span>
                  <span
                    className={`font-semibold capitalize ${
                      order.payment_status === "paid" ? "text-green-600" : "text-yellow-600"
                    }`}
                  >
                    {order.payment_status}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 text-lg mb-4">Shipping Address</h3>
              <p className="text-sm text-gray-700 leading-relaxed mb-4 whitespace-pre-line">
                {formatAddressDisplay(order.shipping_address)}
              </p>
              {order.notes && (
                <div className="pt-3 border-t border-gray-100">
                  <h4 className="font-semibold text-gray-900 text-sm mb-1">Order Notes:</h4>
                  <p className="text-sm text-gray-500">{order.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Order Items ({(order.order_items || order.orderItems || []).length})
              </h3>
              {isDelivered && hasEligibleItems && (
                <button
                  onClick={() => setShowReturnModal(true)}
                  className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Return or Exchange Items</span>
                </button>
              )}
            </div>

            <div className="space-y-6">
              {(order.order_items || order.orderItems || []).length > 0 ? (
                (order.order_items || order.orderItems).map((item: any, index: number) => {
                  let secondaryImages: string[] = [];
                  try {
                    if (item.variant?.image_json) {
                      const parsed =
                        typeof item.variant.image_json === "string"
                          ? JSON.parse(item.variant.image_json)
                          : item.variant.image_json;
                      if (Array.isArray(parsed)) secondaryImages = parsed;
                    }
                  } catch {}
                  if (secondaryImages.length === 0) {
                    try {
                      if (item.product?.image_json) {
                        const parsed =
                          typeof item.product.image_json === "string"
                            ? JSON.parse(item.product.image_json)
                            : item.product.image_json;
                        if (Array.isArray(parsed)) secondaryImages = parsed;
                      }
                    } catch {}
                  }

                  const primaryImage = item.variant?.image_url || item.product?.image_url;
                  let allImages = [...secondaryImages];
                  if (primaryImage && !allImages.includes(primaryImage)) {
                    allImages.unshift(primaryImage);
                  }

                  const mrp = Number(item.variant?.mrp || 0);
                  const price = Number(item.price || 0);
                  const discount = mrp > price ? mrp - price : 0;
                  const discountPercent = mrp > price ? Math.round((discount / mrp) * 100) : 0;

                  return (
                    <div key={item.id} className="border-b border-gray-100 last:border-b-0 pb-6 last:pb-0">
                      <div className="flex gap-6 flex-col sm:flex-row">
                        {/* Product Image */}
                        <div className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 bg-gray-50 mx-auto sm:mx-0">
                          <Image
                            src={`${basePath}${primaryImage || imgPlaceholder.src}`}
                            alt={item.product.name}
                            fill
                            unoptimized
                            className="object-contain p-1"
                          />
                          <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                            #{index + 1}
                          </div>
                        </div>

                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-2 mb-3">
                            <div>
                              <h4 className="text-base font-semibold text-gray-900 line-clamp-2">
                                {item.product.name}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-800 text-xs font-semibold rounded">
                                  {item.variant.title}
                                </span>
                                {item.variant.sku && (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-mono rounded">
                                    SKU: {item.variant.sku}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-left md:text-right flex-shrink-0">
                              <p className="text-lg font-bold text-gray-900">₹{item.total.toLocaleString()}</p>
                              <p className="text-xs text-gray-500">
                                ₹{item.price.toLocaleString()} × {item.quantity}
                              </p>
                            </div>
                          </div>

                          {/* Selected Attributes */}
                          {item.selected_attributes && Object.keys(item.selected_attributes).length > 0 && (
                            <div className="bg-gray-50 rounded-xl p-3 mt-3">
                              <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                                Selected Options
                              </h5>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(item.selected_attributes).map(([key, value]) => (
                                  <span
                                    key={key}
                                    className="inline-flex items-center text-xs text-orange-800 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-md font-medium"
                                  >
                                    <span className="font-bold mr-1">
                                      {key.replace(/([A-Z])/g, " $1").trim()}:
                                    </span>
                                    {String(value)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Pricing Info: MRP, savings */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                            <div className="bg-gray-50 rounded-lg p-3">
                              <h5 className="text-xs font-semibold text-gray-500 mb-1">Unit Price</h5>
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-green-600">
                                  ₹{item.price.toLocaleString()}
                                </span>
                                {mrp > price && (
                                  <span className="text-[10px] text-gray-400 line-through">
                                    ₹{mrp.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-3">
                              <h5 className="text-xs font-semibold text-gray-500 mb-1">Quantity</h5>
                              <span className="text-sm font-bold text-gray-800">{item.quantity}</span>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-3 col-span-2 sm:col-span-1">
                              <h5 className="text-xs font-semibold text-gray-500 mb-1">Item Total</h5>
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-blue-600">
                                  ₹{item.total.toLocaleString()}
                                </span>
                                {mrp > price && (
                                  <span className="text-[10px] text-green-600 font-semibold">
                                    Saved ₹{(discount * item.quantity).toLocaleString()} ({discountPercent}% off)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">No Items Found</h4>
                  <p className="text-gray-500">This order doesn't contain any items.</p>
                </div>
              )}
            </div>
          </div>

          {/* Order Summary breakdown */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600 pb-2 border-b border-gray-100">
                <span>Subtotal ({order.order_items?.length || 0} items)</span>
                <span className="font-semibold text-gray-900">₹{order.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-600 pb-2 border-b border-gray-100">
                <span>Shipping Fee</span>
                <span className={`font-semibold ${order.shipping_fee === 0 ? "text-green-600" : "text-gray-900"}`}>
                  {order.shipping_fee === 0 ? "FREE" : `₹${order.shipping_fee.toLocaleString()}`}
                </span>
              </div>
              {order.tax > 0 && (
                <div className="flex justify-between text-gray-600 pb-2 border-b border-gray-100">
                  <span>Tax & Fees</span>
                  <span className="font-semibold text-gray-900">₹{order.tax.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-gray-900 pt-2">
                <span>Total</span>
                <span className="text-xl text-[#007FFF]">₹{order.total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Return & Exchange Modal */}
      {showReturnModal && eligibility && (
        <ReturnRequestModal
          order={order}
          eligibility={eligibility}
          onClose={() => setShowReturnModal(false)}
          onSuccess={(returnReq) => {
            setShowReturnModal(false);
            setSuccessMessage("Return request submitted successfully! Redirecting...");
            router.push(
              `/orders/${order.slug || order.order_number || order.id}/returns/${returnReq.returnNumber || returnReq.id}`
            );
          }}
        />
      )}
    </div>
  );
}
