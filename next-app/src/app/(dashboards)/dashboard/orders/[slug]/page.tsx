"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
    ArrowLeft,
    Clock,
    CheckCircle,
    Package,
    Truck,
    X,
    MapPin,
    FileText,
    RefreshCw,
    AlertTriangle,
    Download,
    ExternalLink,
    Copy,
    Check
} from "lucide-react";
import imgPlaceholder from "@/public/imagePlaceholder.png";
import { getAdminOrder, updateOrderStatus, formatCurrency, downloadOrderInvoice } from "../../../../../../utils/orderApi";
import { generateInvoicePDF } from "@/utils/generateInvoicePDF";
import ErrorMessage from "@/components/(sheared)/ErrorMessage";
import SuccessMessage from "@/components/(sheared)/SuccessMessage";
import ConfirmModal from "@/components/(sheared)/ConfirmModal";
import CreateShipmentModal from "@/components/CreateShipmentModal";
import { formatAddressDisplay } from "../../../../../../utils/addressUtils";
import { getUserSlug, getOrderSlug } from "../../../../../../utils/slugUtils";

const basePath = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";

export default function AdminOrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = (params?.slug || params?.orderId || params?.id || "") as string;

    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [downloadingInvoice, setDownloadingInvoice] = useState(false);
    const [copiedWaybill, setCopiedWaybill] = useState<string | null>(null);

    const handleCopyWaybill = (waybillNum: string) => {
        if (!waybillNum) return;
        navigator.clipboard.writeText(waybillNum);
        setCopiedWaybill(waybillNum);
        setSuccessMessage(`Waybill ${waybillNum} copied to clipboard!`);
        setTimeout(() => {
            setCopiedWaybill((prev) => (prev === waybillNum ? null : prev));
        }, 2000);
    };
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [isCreateShipmentOpen, setIsCreateShipmentOpen] = useState(false);

    // Confirm Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string | React.ReactNode;
        confirmText: string;
        variant: 'danger' | 'warning' | 'info' | 'success';
        badge?: string;
        onConfirm: () => Promise<void>;
    }>({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        variant: 'danger',
        onConfirm: async () => { },
    });

    useEffect(() => {
        if (orderId) {
            fetchOrderDetails();
        }
    }, [orderId]);

    const fetchOrderDetails = async () => {
        setLoading(true);
        try {
            const response = await getAdminOrder(orderId);
            if (response && (response.success || response.order || response.data)) {
                const orderData = response.order || response.data || response;
                setOrder(orderData);
            } else {
                setErrorMessage(response?.message || "Failed to load order details");
            }
        } catch (error: any) {
            console.error('Error fetching admin order:', error);
            setErrorMessage(error?.response?.data?.message || error?.message || "Failed to load order details. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadInvoice = async () => {
        if (!order) return;
        try {
            setDownloadingInvoice(true);
            await downloadOrderInvoice(order.id, true);
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

    const getStatusIcon = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
            case 'confirmed': return <CheckCircle className="w-4 h-4 text-blue-500" />;
            case 'processing': return <Package className="w-4 h-4 text-purple-500" />;
            case 'shipped': return <Truck className="w-4 h-4 text-orange-500" />;
            case 'delivered': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'cancelled': return <X className="w-4 h-4 text-red-500" />;
            default: return <Clock className="w-4 h-4 text-gray-500" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-100';
            case 'confirmed': return 'bg-blue-50 text-blue-700 border-blue-100';
            case 'processing': return 'bg-purple-50 text-purple-700 border-purple-100';
            case 'shipped': return 'bg-orange-50 text-orange-700 border-orange-100';
            case 'delivered': return 'bg-green-50 text-green-700 border-green-100';
            case 'cancelled': return 'bg-red-50 text-red-700 border-red-100';
            default: return 'bg-gray-50 text-gray-700 border-gray-100';
        }
    };

    const formatDateTime = (dateString: string | Date | null | undefined) => {
        if (!dateString) return { date: '—', time: '' };
        const raw = typeof dateString === 'string' ? dateString : dateString.toISOString();

        let dateObj: Date;
        if (typeof raw === 'string' && raw.includes('T') && raw.endsWith('Z')) {
            dateObj = new Date(raw.slice(0, -1));
        } else {
            dateObj = new Date(raw);
        }

        if (isNaN(dateObj.getTime())) {
            dateObj = new Date(raw);
        }

        if (isNaN(dateObj.getTime())) {
            return { date: raw, time: '' };
        }

        const date = dateObj.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const time = dateObj.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        return { date, time };
    };

    const formatDate = (dateString: string | Date | null | undefined) => {
        const dt = formatDateTime(dateString);
        return dt.time ? `${dt.date}, ${dt.time}` : dt.date;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="text-center py-12 bg-white rounded-2xl shadow-sm border p-8 max-w-sm w-full">
                    <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">Loading Order Details...</p>
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
                    <p className="text-gray-600 mb-6">The order details could not be retrieved from the server.</p>
                    <button
                        onClick={() => router.push('/dashboard/orders')}
                        className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium cursor-pointer"
                    >
                        Back to Orders
                    </button>
                </div>
            </div>
        );
    }

    const orderNumber = order.orderNumber || order.order_number || `ORD-${order.id}`;
    const orderDate = order.createdAt || order.created_at;
    const paymentMethod = order.paymentMethod || order.payment_method;
    const paymentStatus = order.paymentStatus || order.payment_status || 'pending';
    const shippingAddress = order.shippingAddress || order.shipping_address;
    const items = order.orderItems || order.order_items || [];
    const trackingRecords = order.trackingRecords || order.tracking_records || [];
    const waybill = order.delhiveryWaybill || order.delhivery_waybill;
    const subtotal = order.subtotal ?? 0;
    const shippingFee = order.shippingFee ?? order.shipping_fee ?? 0;
    const tax = order.tax ?? 0;
    const total = order.total ?? 0;

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 md:px-8">
            <div className="max-w-6xl mx-auto space-y-6">
                {errorMessage && <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />}
                {successMessage && <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />}

                {/* Top Header Card */}
                <div className="bg-white rounded-2xl px-6 py-4 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/dashboard/orders')}
                            className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors cursor-pointer"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Order Details</h1>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                <p className="text-sm text-gray-500 font-medium font-mono">Order #{orderNumber}</p>
                                {waybill && (
                                    <div className="flex items-center gap-1">
                                        <span 
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-xs font-mono font-medium text-blue-700 select-all"
                                            title={`Delhivery AWB: ${waybill}`}
                                        >
                                            <Truck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                            <span>AWB: {waybill}</span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyWaybill(waybill)}
                                            className="inline-flex items-center justify-center p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-100/70 transition-colors cursor-pointer"
                                            title={copiedWaybill === waybill ? "Copied to clipboard!" : "Copy Waybill"}
                                            aria-label={`Copy waybill ${waybill}`}
                                        >
                                            {copiedWaybill === waybill ? (
                                                <span className="flex items-center text-[10px] text-green-600 font-semibold gap-0.5">
                                                    <Check className="w-3.5 h-3.5 text-green-600" />
                                                    <span>Copied</span>
                                                </span>
                                            ) : (
                                                <Copy className="w-3.5 h-3.5 text-gray-500 hover:text-blue-600" />
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={handleDownloadInvoice}
                            disabled={downloadingInvoice}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs md:text-sm rounded-lg transition-all flex items-center gap-2 shadow-sm hover:shadow-md disabled:opacity-50 cursor-pointer"
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

                        <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 text-sm font-semibold capitalize ${getStatusColor(order.status)}`}>
                            {getStatusIcon(order.status)}
                            <span>{order.status}</span>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left Column: Order Items & Financials (2 Cols) */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Order Items Table Card */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                                <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                    <Package className="w-5 h-5 text-[#007FFF]" />
                                    <span>Order Items ({items.length})</span>
                                </h2>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-3">Product</th>
                                            <th className="px-6 py-3 text-center">Qty</th>
                                            <th className="px-6 py-3 text-right">Price</th>
                                            <th className="px-6 py-3 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 text-gray-700">
                                        {items.map((item: any) => {
                                            const itemImg = item.product?.image_url || item.variant?.image_url || item.imageUrl || item.image_url;
                                            const itemSku = item.variant?.sku || item.sku || "N/A";
                                            const itemPrice = Number(item.price) || 0;
                                            const itemTotal = Number(item.total) || (itemPrice * (item.quantity || 1));

                                            return (
                                                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden relative flex-shrink-0 flex items-center justify-center">
                                                                {itemImg ? (
                                                                    <img
                                                                        src={itemImg.startsWith('http') ? itemImg : `${basePath}${itemImg}`}
                                                                        alt={item.name || item.product?.name || "Product"}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <Image
                                                                        src={imgPlaceholder}
                                                                        alt="Product Placeholder"
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-gray-900 text-sm truncate max-w-[200px] md:max-w-[280px]">
                                                                    {item.name || item.product?.name || "Product Item"}
                                                                </p>
                                                                <p className="text-xs text-gray-400 font-mono">SKU: {itemSku}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center font-medium">
                                                        {item.quantity}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-medium text-gray-600">
                                                        {formatCurrency(itemPrice)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                                                        {formatCurrency(itemTotal)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Summary Calculation */}
                            <div className="p-6 bg-gray-50/50 border-t border-gray-100 space-y-2">
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Subtotal</span>
                                    <span className="font-semibold text-gray-800">{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Shipping Fee</span>
                                    <span className="font-semibold text-gray-800">{shippingFee > 0 ? formatCurrency(shippingFee) : "Free"}</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Tax / GST</span>
                                    <span className="font-semibold text-gray-800">{formatCurrency(tax)}</span>
                                </div>
                                <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between text-base font-bold text-gray-900">
                                    <span>Grand Total</span>
                                    <span className="text-lg text-[#007FFF]">{formatCurrency(total)}</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Right Column: Customer, Shipping, Timeline Details (1 Col) */}
                    <div className="space-y-6">

                        {/* 1. Payment & Order Status Card */}
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                            <h3 className="font-bold text-gray-900 text-base mb-4">Payment Summary</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between border-b border-gray-50 pb-2">
                                    <span className="text-gray-400">Order Date:</span>
                                    <span className="font-medium text-gray-800">{formatDate(orderDate)}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-50 pb-2">
                                    <span className="text-gray-400">Payment Method:</span>
                                    <span className="font-semibold uppercase text-gray-800">{paymentMethod || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Payment Status:</span>
                                    <span className={`font-semibold capitalize ${paymentStatus === 'paid' ? 'text-green-600' : 'text-yellow-600'
                                        }`}>
                                        {paymentStatus}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 2. Customer Details */}
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-gray-900 text-base">Customer Information</h3>
                                {order.user?.id && (
                                    <Link
                                        href={`/dashboard/users/${getUserSlug(order.user)}`}
                                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                                    >
                                        <span>View Profile</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </Link>
                                )}
                            </div>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between border-b border-gray-50 pb-2 items-center">
                                    <span className="text-gray-400">Name:</span>
                                    {order.user?.id ? (
                                        <Link
                                            href={`/dashboard/users/${getUserSlug(order.user)}`}
                                            className="font-semibold text-blue-600 hover:text-blue-800 underline transition-colors"
                                            title={`View profile for ${order.user.name || "Customer"}`}
                                        >
                                            {order.user.name || "Customer"}
                                        </Link>
                                    ) : (
                                        <span className="font-semibold text-gray-800">{order.user?.name || "Customer"}</span>
                                    )}
                                </div>
                                <div className="flex justify-between border-b border-gray-50 pb-2 items-center">
                                    <span className="text-gray-400">Email:</span>
                                    {order.user?.id && order.user?.email ? (
                                        <Link
                                            href={`/dashboard/users/${getUserSlug(order.user)}`}
                                            className="font-semibold text-blue-600 hover:text-blue-800 underline transition-colors select-all"
                                            title={`View profile for ${order.user.name || "Customer"}`}
                                        >
                                            {order.user.email}
                                        </Link>
                                    ) : (
                                        <span className="font-semibold text-gray-800 select-all">{order.user?.email || "N/A"}</span>
                                    )}
                                </div>
                                {(order.user?.phone_number || order.user?.phone || order.user?.contact) && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Phone:</span>
                                        <span className="font-semibold text-gray-800">{order.user?.phone_number || order.user?.phone || order.user?.contact}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. Shipping Address */}
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                            <h3 className="font-bold text-gray-900 text-base mb-3 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-red-500" />
                                <span>Shipping Address</span>
                            </h3>
                            <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                                {formatAddressDisplay(shippingAddress) || "No address provided."}
                            </p>
                        </div>

                        {/* 4. Delhivery Shipment Information */}
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                            <h3 className="font-bold text-gray-900 text-base mb-4 flex items-center gap-2">
                                <Truck className="w-4 h-4 text-blue-600" />
                                <span>Shipment & Logistics</span>
                            </h3>

                            {waybill ? (
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between border-b border-gray-50 pb-2">
                                        <span className="text-gray-400">Waybill:</span>
                                        <span className="font-mono font-bold text-gray-900">{waybill}</span>
                                    </div>
                                    <div className="pt-2">
                                        <Link
                                            href={`/dashboard/orders/${getOrderSlug(order)}/track`}
                                            className="w-full py-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold text-xs transition flex items-center justify-center gap-1.5"
                                        >
                                            <Truck className="w-3.5 h-3.5" />
                                            <span>Track Order</span>
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-sm text-gray-500 mb-3">No shipment created yet.</p>
                                    <button
                                        onClick={() => setIsCreateShipmentOpen(true)}
                                        className="w-full py-2 bg-gradient-to-r from-[#007FFF] to-[#0055CC] text-white rounded-lg font-semibold text-xs hover:shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <Truck className="w-3.5 h-3.5" />
                                        <span>Create Delhivery Shipment</span>
                                    </button>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>

            {/* Create Delhivery Shipment Modal */}
            <CreateShipmentModal
                isOpen={isCreateShipmentOpen}
                onClose={() => setIsCreateShipmentOpen(false)}
                orderId={order.id}
                orderNumber={orderNumber}
                onSuccess={() => {
                    fetchOrderDetails();
                    setSuccessMessage("Shipment created successfully!");
                }}
            />

            {/* Confirm Action Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                variant={confirmModal.variant}
                badge={confirmModal.badge}
                onConfirm={confirmModal.onConfirm}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}
