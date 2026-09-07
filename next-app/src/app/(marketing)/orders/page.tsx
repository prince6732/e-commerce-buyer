"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
    Package,
    Truck,
    AlertTriangle,
    Download,
    ArrowLeft,
    ChevronRight,
    ShoppingBag,
} from "lucide-react";
import imgPlaceholder from "@/public/imagePlaceholder.png";
import { getOrders, cancelOrder, downloadOrderInvoice } from "../../../../utils/orderApi";
import { getOrderSlug } from "../../../../utils/slugUtils";
import { generateInvoicePDF } from "@/utils/generateInvoicePDF";
import { getImageUrl } from "../../../../utils/imageUtils";
import Modal from "@/components/(sheared)/Modal";
import ErrorMessage from "@/components/(sheared)/ErrorMessage";
import SuccessMessage from "@/components/(sheared)/SuccessMessage";
import CelebrationEffect from "@/components/(frontend)/CelebrationEffect";
import { useLoader } from "@/context/LoaderContext";
import ZeltonLoader from "@/components/ui/ZeltonLoader";
import { OrderCardSkeleton } from "@/components/ui/SkeletonLoader";

type OrderItem = {
    id: number;
    quantity: number;
    price: number;
    total: number;
    selected_attributes: Record<string, string> | null;
    product: {
        id: number;
        name: string;
        image_url: string | null;
    };
    variant: {
        id: number;
        title: string;
        sku: string;
        image_url: string | null;
    };
};

type Order = {
    id: number;
    order_number: string;
    status: string;
    payment_method: string;
    payment_status: string;
    subtotal: number;
    shipping_fee: number;
    tax: number;
    total: number;
    shipping_address: string;
    notes: string | null;
    created_at: string;
    order_items: OrderItem[];
};

const OrdersPage = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [showCelebration, setShowCelebration] = useState(false);
    const { user, loading: authLoading, openAuthModal } = useAuth();

    useEffect(() => {
        if (searchParams?.get("celebrate") === "true") {
            setShowCelebration(true);
            const timer = setTimeout(() => {
                const params = new URLSearchParams(searchParams.toString());
                params.delete("celebrate");
                const queryString = params.toString();
                const newPath = `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`;
                window.history.replaceState(null, "", newPath);
            }, 1500);

            return () => clearTimeout(timer);
        }
    }, [searchParams]);

    const [orders, setOrders] = useState<Order[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
    const [cancelLoading, setCancelLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<number | null>(null);
    const { showLoader, hideLoader } = useLoader();

    const handleDownloadInvoice = async (order: any) => {
        try {
            setDownloadingInvoiceId(order.id);
            await downloadOrderInvoice(order.id);
        } catch (err) {
            console.warn("Backend invoice download failed, attempting client-side generation:", err);
            try {
                await generateInvoicePDF(order);
            } catch (fallbackErr) {
                console.error("Client-side PDF generation error:", fallbackErr);
                setErrorMessage("Failed to download invoice. Please try again.");
            }
        } finally {
            setDownloadingInvoiceId(null);
        }
    };

    useEffect(() => {
        if (user) {
            fetchOrders();
        }
    }, [user, currentPage]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const params: any = {
                page: currentPage,
                per_page: 12,
            };

            const response = await getOrders(params);

            if (response.success && response.data) {
                const list = Array.isArray(response.data.data)
                    ? response.data.data
                    : Array.isArray(response.data)
                        ? response.data
                        : [];
                setOrders(list);
                setTotalPages(response.data.last_page || 1);
            } else if (Array.isArray(response.data)) {
                setOrders(response.data);
            }
        } catch (error) {
            console.error("Error fetching orders:", error);
            setErrorMessage("Failed to load orders. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const s = (status || "").toLowerCase();
        switch (s) {
            case "delivered":
            case "completed":
                return {
                    label: "Delivered",
                    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    dotClass: "bg-emerald-500",
                };
            case "shipped":
            case "out_for_delivery":
                return {
                    label: s === "out_for_delivery" ? "Out for Delivery" : "Shipped",
                    classes: "bg-blue-50 text-[#007FFF] border-blue-200",
                    dotClass: "bg-[#007FFF]",
                };
            case "confirmed":
            case "processing":
                return {
                    label: s === "confirmed" ? "Confirmed" : "Processing",
                    classes: "bg-indigo-50 text-indigo-700 border-indigo-200",
                    dotClass: "bg-indigo-500",
                };
            case "pending":
                return {
                    label: "Pending",
                    classes: "bg-amber-50 text-amber-700 border-amber-200",
                    dotClass: "bg-amber-500",
                };
            case "cancelled":
                return {
                    label: "Cancelled",
                    classes: "bg-rose-50 text-rose-700 border-rose-200",
                    dotClass: "bg-rose-500",
                };
            default:
                return {
                    label: status ? status.charAt(0).toUpperCase() + status.slice(1) : "Order Placed",
                    classes: "bg-gray-50 text-gray-700 border-gray-200",
                    dotClass: "bg-gray-400",
                };
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return "N/A";
        try {
            const d = new Date(dateString);
            if (isNaN(d.getTime())) return "N/A";
            return d.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
            });
        } catch {
            return "N/A";
        }
    };

    const handleConfirmCancel = async () => {
        if (!orderToCancel) return;

        setCancelLoading(true);
        showLoader();
        try {
            const response = await cancelOrder(orderToCancel.id);
            if (response.success) {
                fetchOrders();
                setSuccessMessage(`Order #${orderToCancel.order_number} cancelled successfully!`);
                setShowCancelModal(false);
                setOrderToCancel(null);
            }
        } catch (error: any) {
            console.error("Error cancelling order:", error);
            setErrorMessage(error.response?.data?.message || "Failed to cancel order. Please try again.");
        } finally {
            setCancelLoading(false);
            hideLoader();
        }
    };

    // Show loading spinner while auth is loading
    if (authLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center py-20">
                <div className="text-center">
                    <ZeltonLoader size="lg" variant="brand" />
                    <p className="text-gray-500 text-sm mt-3 font-medium">Loading your orders...</p>
                </div>
            </div>
        );
    }

    // Show login prompt if unauthenticated
    if (!user) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-20">
                <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-lg border border-gray-100">
                    <div className="w-16 h-16 bg-blue-50 text-[#007FFF] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xs">
                        <ShoppingBag className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign in to view orders</h1>
                    <p className="text-gray-500 text-xs sm:text-sm mb-6">
                        Track your shipments, view past receipts, and manage order deliveries.
                    </p>
                    <button
                        onClick={() => openAuthModal("login")}
                        className="w-full py-3 bg-[#007FFF] hover:bg-[#0066CC] text-white rounded-xl font-bold text-sm transition shadow-md active:scale-95 cursor-pointer"
                    >
                        Sign In Now
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAF9F6]/60 pb-24">
            {showCelebration && <CelebrationEffect duration={6000} />}
            {errorMessage && <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />}
            {successMessage && <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />}

            {/* Header Section (Centered matching categories page) */}
            <section className="py-6 sm:py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="relative flex items-center justify-center">
                        {/* Back Button */}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2">
                            <button
                                onClick={() => router.back()}
                                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-white hover:bg-gray-100 text-gray-700 rounded-full text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer border border-gray-200/60 shadow-xs"
                                aria-label="Go back"
                            >
                                <ArrowLeft className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                                <span className="hidden sm:inline">Back</span>
                            </button>
                        </div>

                        {/* Centered Heading */}
                        <div className="text-center">
                            <h1 className="text-xl sm:text-3xl md:text-4xl font-serif font-black tracking-widest text-[#0A0908] uppercase flex items-center justify-center gap-2">
                                <span>Your Orders</span>
                            </h1>
                            {!loading && (
                                <p className="text-xs sm:text-sm text-gray-500 mt-1 font-medium tracking-wide">
                                    {orders.length} orders found in your history
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Orders Content Area */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 md:pt-4">
                {loading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                        <OrderCardSkeleton />
                        <OrderCardSkeleton />
                        <OrderCardSkeleton />
                        <OrderCardSkeleton />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-gray-200/80 p-12 text-center max-w-md mx-auto my-12 shadow-sm">
                        <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Package className="w-8 h-8" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 mb-1">No Orders Found</h2>
                        <p className="text-xs text-gray-500 mb-6">
                            You haven't placed any orders yet.
                        </p>
                        <button
                            onClick={() => router.push("/products")}
                            className="px-6 py-2.5 bg-[#007FFF] hover:bg-[#0066CC] text-white rounded-xl text-xs sm:text-sm font-bold shadow transition active:scale-95 cursor-pointer"
                        >
                            Start Shopping
                        </button>
                    </div>
                ) : (
                    /* 2 Orders Per Row (Grid Layout: 1 col on mobile, 2 cols on lg) */
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                        {orders.map((order: any) => {
                            const orderItemsList: any[] = order.order_items || order.orderItems || [];
                            const orderNum = order.order_number || order.orderNumber || String(order.id);
                            const createdDate = order.created_at || order.createdAt;
                            const paymentMeth = order.payment_method || order.paymentMethod;
                            const formattedTotal = typeof order.total === "number"
                                ? order.total.toLocaleString("en-IN")
                                : parseFloat(order.total || 0).toLocaleString("en-IN");
                            const statusBadge = getStatusBadge(order.status);

                            return (
                                <div
                                    key={order.id}
                                    className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden"
                                >
                                    {/* 1. Card Header Strip */}
                                    <div className="bg-[#FBFBFB] px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 text-xs">
                                        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Placed On</p>
                                                <p className="font-semibold text-gray-800 text-xs">{formatDate(createdDate)}</p>
                                            </div>
                                            <div className="h-6 w-px bg-gray-200 hidden sm:block" />
                                            <div>
                                                <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Total</p>
                                                <p className="font-bold text-gray-900 text-xs">₹{formattedTotal}</p>
                                            </div>
                                            <div className="h-6 w-px bg-gray-200 hidden sm:block" />
                                            <div className="hidden sm:block">
                                                <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Payment</p>
                                                <p className="font-medium text-gray-700 text-xs uppercase">
                                                    {paymentMeth === "cash_on_delivery" ? "COD" : "Online"}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Status Badge */}
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusBadge.classes}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass}`} />
                                                <span>{statusBadge.label}</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Order Number Identifier Sub-Bar */}
                                    <div className="px-4 py-2 bg-gray-50/40 border-b border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                                        <span className="font-mono text-gray-400 font-medium">Order ID: #{orderNum}</span>
                                        <span className="font-medium text-gray-600">{orderItemsList.length} item{orderItemsList.length > 1 ? "s" : ""}</span>
                                    </div>

                                    {/* 2. Items Preview Body */}
                                    <div className="p-4 sm:p-5 flex-1 divide-y divide-gray-100">
                                        {orderItemsList.length > 0 ? (
                                            orderItemsList.map((item: any) => {
                                                const rawImage =
                                                    item.variant?.image_url ||
                                                    item.variant?.imageUrl ||
                                                    item.product?.image_url ||
                                                    item.product?.imageUrl;
                                                const imageSrc = getImageUrl(rawImage) || imgPlaceholder.src;
                                                const variantTitle = item.variant?.title || item.variant?.sku;
                                                const itemTotal = typeof item.total === "number"
                                                    ? item.total.toLocaleString("en-IN")
                                                    : parseFloat(item.total || 0).toLocaleString("en-IN");

                                                return (
                                                    <div key={item.id} className="flex items-center gap-3.5 py-3 first:pt-0 last:pb-0">
                                                        {/* Thumbnail */}
                                                        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-gray-200/70 bg-gray-50 flex items-center justify-center flex-shrink-0">
                                                            <img
                                                                src={imageSrc}
                                                                alt={item.product?.name || "Product"}
                                                                className="w-full h-full object-contain p-1"
                                                                loading="lazy"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).src = imgPlaceholder.src;
                                                                }}
                                                            />
                                                        </div>

                                                        {/* Item Details */}
                                                        <div className="flex-1 min-w-0">
                                                            <h3
                                                                onClick={() => router.push(`/orders/${getOrderSlug(order)}`)}
                                                                className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-1 hover:text-[#007FFF] transition-colors cursor-pointer"
                                                            >
                                                                {item.product?.name || "Product"}
                                                            </h3>
                                                            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-500">
                                                                {variantTitle && (
                                                                    <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                                                        {variantTitle}
                                                                    </span>
                                                                )}
                                                                <span className="text-[11px]">Qty: {item.quantity}</span>
                                                            </div>
                                                        </div>

                                                        {/* Price */}
                                                        <div className="text-right flex-shrink-0 text-xs sm:text-sm font-bold text-gray-900">
                                                            ₹{itemTotal}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="py-4 text-center text-xs text-gray-400 italic">
                                                No items found
                                            </div>
                                        )}
                                    </div>

                                    {/* 3. Action Buttons Footer */}
                                    <div className="px-4 py-3 bg-[#FBFBFB] border-t border-gray-100 flex flex-wrap items-center justify-between gap-2.5">
                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                            <button
                                                onClick={() => router.push(`/orders/${getOrderSlug(order)}`)}
                                                className="flex-1 sm:flex-none px-4 py-2 bg-[#007FFF] hover:bg-[#0066CC] text-white text-xs font-bold rounded-xl transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                            >
                                                <span>View Details</span>
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </button>

                                            <button
                                                onClick={() => router.push(`/orders/${getOrderSlug(order)}/tracking`)}
                                                className="flex-1 sm:flex-none px-3.5 py-2 bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 text-xs font-bold rounded-xl transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                            >
                                                <Truck className="w-3.5 h-3.5 text-gray-600" />
                                                <span>Track</span>
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => handleDownloadInvoice(order)}
                                            disabled={downloadingInvoiceId === order.id}
                                            className="w-full sm:w-auto px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                                            title="Download Tax Invoice"
                                        >
                                            {downloadingInvoiceId === order.id ? (
                                                <ZeltonLoader size="xs" variant="brand" />
                                            ) : (
                                                <Download className="w-3.5 h-3.5 text-emerald-600" />
                                            )}
                                            <span>Invoice</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-10">
                        <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs transition"
                        >
                            Previous
                        </button>

                        <span className="text-xs font-medium text-gray-500">
                            Page <strong className="text-gray-900">{currentPage}</strong> of {totalPages}
                        </span>

                        <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs transition"
                        >
                            Next
                        </button>
                    </div>
                )}
            </main>

            {/* Cancel Order Confirmation Modal */}
            <Modal
                isOpen={showCancelModal}
                onClose={() => {
                    setShowCancelModal(false);
                    setOrderToCancel(null);
                }}
                title="Cancel Order"
                width="max-w-md"
            >
                <div className="text-center pt-2">
                    <div className="mx-auto flex items-center justify-center w-14 h-14 bg-red-100 rounded-full mb-3">
                        <AlertTriangle className="w-7 h-7 text-red-600" />
                    </div>

                    <h3 className="text-base font-bold text-gray-900 mb-1">
                        Are you sure you want to cancel this order?
                    </h3>

                    {orderToCancel && (
                        <div className="bg-gray-50 rounded-xl p-3 my-4 text-left text-xs border border-gray-200/80 space-y-1">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Order:</span>
                                <span className="font-mono font-bold text-gray-900">#{orderToCancel.order_number}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Total Amount:</span>
                                <span className="font-bold text-gray-900">₹{orderToCancel.total.toLocaleString()}</span>
                            </div>
                        </div>
                    )}

                    <p className="text-xs text-gray-500 mb-6">
                        This action cannot be undone. The order will be cancelled immediately.
                    </p>

                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => {
                                setShowCancelModal(false);
                                setOrderToCancel(null);
                            }}
                            disabled={cancelLoading}
                            className="px-5 py-2.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200 transition disabled:opacity-50 cursor-pointer"
                        >
                            Keep Order
                        </button>
                        <button
                            onClick={handleConfirmCancel}
                            disabled={cancelLoading}
                            className="px-5 py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                            {cancelLoading ? (
                                <ZeltonLoader size="xs" variant="white" />
                            ) : (
                                "Yes, Cancel Order"
                            )}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default function OrdersPageWrapper() {
    return (
        <Suspense fallback={null}>
            <OrdersPage />
        </Suspense>
    );
}