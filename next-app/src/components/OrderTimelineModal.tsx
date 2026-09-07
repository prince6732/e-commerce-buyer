"use client";

import React from "react";
import Image from "next/image";
import { CheckCircle, Package, Truck, Clock, MapPin, Calendar, User, Mail, Phone, Home } from "lucide-react";
import Modal from "@/components/(sheared)/Modal";
import imgPlaceholder from "@/public/imagePlaceholder.png";
import { formatAddressDisplay } from "../../utils/addressUtils";

const basePath = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";

interface OrderItem {
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
}

interface TimelineItem {
    id: number;
    status: string;
    description: string;
    location: string | null;
    tracked_at: string;
    formatted_date: string;
}

interface Order {
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
    billing_address: string | null;
    notes: string | null;
    created_at: string;
    delivered_at: string | null;
    delivery_confirmed_at: string | null;
    user: {
        id: number;
        name: string;
        email: string;
        phone_number: string | null;
    };
    order_items: OrderItem[];
}

interface OrderDetailsData {
    order: Order;
    timeline: TimelineItem[];
    duration: {
        days: number;
        hours: number;
        formatted: string;
    };
    status_durations: Record<string, string>;
    order_placed_at: string;
    order_completed_at: string;
    shipped_at: string | null;
    delivered_at: string | null;
}

interface OrderTimelineModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderDetails: OrderDetailsData | null;
    loading: boolean;
}

const OrderTimelineModal: React.FC<OrderTimelineModalProps> = ({
    isOpen,
    onClose,
    orderDetails,
    loading
}) => {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
                return Clock;
            case 'confirmed':
                return CheckCircle;
            case 'processing':
                return Package;
            case 'shipped':
                return Truck;
            case 'delivered':
            case 'completed':
                return CheckCircle;
            default:
                return Clock;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return 'bg-yellow-500';
            case 'confirmed':
                return 'bg-blue-500';
            case 'processing':
                return 'bg-purple-500';
            case 'shipped':
                return 'bg-orange-500';
            case 'delivered':
                return 'bg-green-500';
            case 'completed':
                return 'bg-emerald-600';
            default:
                return 'bg-gray-500';
        }
    };

    if (!orderDetails) {
        return null;
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Completed Order Details"
            width="max-w-6xl"
        >
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
                    <span className="ml-3 text-gray-600">Loading order details...</span>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Header Info */}
                    <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg p-6 border border-emerald-200">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-900">{orderDetails.order.order_number}</h3>
                                <p className="text-sm text-gray-600 mt-1">Order completed successfully!</p>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                                <CheckCircle className="w-5 h-5" />
                                <span className="font-semibold">Completed</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div className="flex items-center gap-3 text-sm">
                                <div className="p-2 bg-white rounded-lg">
                                    <Calendar className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-gray-500">Order Duration</p>
                                    <p className="font-semibold text-gray-900">{orderDetails.duration.formatted}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="p-2 bg-white rounded-lg">
                                    <Package className="w-5 h-5 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-gray-500">Total Items</p>
                                    <p className="font-semibold text-gray-900">{orderDetails.order.order_items.length}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="p-2 bg-white rounded-lg">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-gray-500">Total Amount</p>
                                    <p className="font-semibold text-gray-900">{formatCurrency(orderDetails.order.total)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column - Timeline */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Order Timeline */}
                            <div className="bg-white rounded-lg border border-gray-200 p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-blue-600" />
                                    Order Journey Timeline
                                </h3>

                                <div className="relative">
                                    {/* Timeline Line */}
                                    <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gray-200"></div>

                                    <div className="space-y-6">
                                        {orderDetails.timeline.map((item, index) => {
                                            const StatusIcon = getStatusIcon(item.status);
                                            const isLast = index === orderDetails.timeline.length - 1;

                                            return (
                                                <div key={item.id} className="relative flex gap-4">
                                                    {/* Icon */}
                                                    <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full ${getStatusColor(item.status)} flex items-center justify-center shadow-lg`}>
                                                        <StatusIcon className="w-6 h-6 text-white" />
                                                    </div>

                                                    {/* Content */}
                                                    <div className={`flex-1 pb-6 ${!isLast ? 'border-b border-gray-100' : ''}`}>
                                                        <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                                                            <div className="flex items-start justify-between mb-2">
                                                                <h4 className="font-semibold text-gray-900 capitalize">
                                                                    {item.status.replace('_', ' ')}
                                                                </h4>
                                                                <span className="text-xs text-gray-500">
                                                                    {item.formatted_date}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-gray-700 mb-2">{item.description}</p>
                                                            {item.location && (
                                                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                                                    <MapPin className="w-3 h-3" />
                                                                    <span>{item.location}</span>
                                                                </div>
                                                            )}
                                                            {orderDetails.status_durations[item.status] && (
                                                                <div className="mt-2 text-xs text-blue-600 font-medium">
                                                                    Duration: {orderDetails.status_durations[item.status]}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Order Items */}
                            <div className="bg-white rounded-lg border border-gray-200 p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Package className="w-5 h-5 text-purple-600" />
                                    Ordered Items
                                </h3>

                                <div className="space-y-3">
                                    {orderDetails.order.order_items.map((item) => (
                                        <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                            <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                                                <Image
                                                    src={`${basePath}${item.variant.image_url || item.product.image_url || imgPlaceholder.src}`}
                                                    alt={item.product.name}
                                                    fill
                                                    unoptimized
                                                    className="object-cover"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-gray-900 truncate">{item.product.name}</h4>
                                                <p className="text-sm text-gray-600">{item.variant.title}</p>
                                                <div className="flex items-center gap-4 mt-1">
                                                    <span className="text-sm text-gray-500">Qty: {item.quantity}</span>
                                                    <span className="text-sm text-gray-500">SKU: {item.variant.sku}</span>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="font-bold text-gray-900">{formatCurrency(item.total)}</p>
                                                <p className="text-sm text-gray-500">{formatCurrency(item.price)} each</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Column - Customer & Order Info */}
                        <div className="space-y-6">
                            {/* Customer Information */}
                            <div className="bg-white rounded-lg border border-gray-200 p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <User className="w-5 h-5 text-blue-600" />
                                    Customer Details
                                </h3>

                                <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <User className="w-5 h-5 text-gray-400 mt-0.5" />
                                        <div>
                                            <p className="text-xs text-gray-500">Name</p>
                                            <p className="font-medium text-gray-900">{orderDetails.order.user.name}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                                        <div>
                                            <p className="text-xs text-gray-500">Email</p>
                                            <p className="font-medium text-gray-900 break-all">{orderDetails.order.user.email}</p>
                                        </div>
                                    </div>
                                    {orderDetails.order.user.phone_number && (
                                        <div className="flex items-start gap-3">
                                            <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                                            <div>
                                                <p className="text-xs text-gray-500">Phone</p>
                                                <p className="font-medium text-gray-900">{orderDetails.order.user.phone_number}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Shipping Address */}
                            <div className="bg-white rounded-lg border border-gray-200 p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Home className="w-5 h-5 text-green-600" />
                                    Shipping Address
                                </h3>
                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{formatAddressDisplay(orderDetails.order.shipping_address)}</p>
                            </div>

                            {/* Payment Info */}
                            <div className="bg-white rounded-lg border border-gray-200 p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Payment Summary</h3>

                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Payment Method:</span>
                                        <span className="font-medium text-gray-900 capitalize">
                                            {orderDetails.order.payment_method.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Payment Status:</span>
                                        <span className={`font-medium capitalize ${orderDetails.order.payment_status === 'paid'
                                                ? 'text-green-600'
                                                : 'text-yellow-600'
                                            }`}>
                                            {orderDetails.order.payment_status}
                                        </span>
                                    </div>

                                    <div className="border-t pt-3 mt-3 space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Subtotal:</span>
                                            <span className="text-gray-900">{formatCurrency(orderDetails.order.subtotal)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Shipping:</span>
                                            <span className="text-gray-900">{formatCurrency(orderDetails.order.shipping_fee)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Tax:</span>
                                            <span className="text-gray-900">{formatCurrency(orderDetails.order.tax)}</span>
                                        </div>
                                        <div className="flex justify-between text-lg font-bold pt-2 border-t">
                                            <span className="text-gray-900">Total:</span>
                                            <span className="text-green-600">{formatCurrency(orderDetails.order.total)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Key Dates */}
                            <div className="bg-white rounded-lg border border-gray-200 p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Key Dates</h3>

                                <div className="space-y-3 text-sm">
                                    <div>
                                        <p className="text-gray-500">Order Placed</p>
                                        <p className="font-medium text-gray-900">{orderDetails.order_placed_at}</p>
                                    </div>
                                    {orderDetails.shipped_at && (
                                        <div>
                                            <p className="text-gray-500">Shipped</p>
                                            <p className="font-medium text-gray-900">{orderDetails.shipped_at}</p>
                                        </div>
                                    )}
                                    {orderDetails.delivered_at && (
                                        <div>
                                            <p className="text-gray-500">Delivered</p>
                                            <p className="font-medium text-gray-900">{orderDetails.delivered_at}</p>
                                        </div>
                                    )}
                                    <div className="pt-2 border-t">
                                        <p className="text-gray-500">Completed</p>
                                        <p className="font-semibold text-green-600">{orderDetails.order_completed_at}</p>
                                    </div>
                                </div>
                            </div>

                            {orderDetails.order.notes && (
                                <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
                                    <h3 className="text-sm font-bold text-gray-900 mb-2">Order Notes</h3>
                                    <p className="text-sm text-gray-700">{orderDetails.order.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default OrderTimelineModal;
