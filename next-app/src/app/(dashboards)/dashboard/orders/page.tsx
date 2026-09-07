"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Eye, Truck, CheckCircle, XCircle, Clock, X, Package, Download, Calendar, Send, Filter as FilterIcon, AlertTriangle, Loader2, Check, Copy } from "lucide-react";
import axios from "../../../../../utils/axios";
import Modal from "@/components/(sheared)/Modal";
import CreateShipmentModal from "@/components/CreateShipmentModal";
import BulkCreateShipmentModal from "@/components/BulkCreateShipmentModal";
import ActionDropdownMenu from "@/components/(sheared)/ActionDropdownMenu";
import { getCompletedOrders, getCancelledOrders, downloadOrderInvoice, bulkAcceptOrders, bulkCancelOrders } from "../../../../../utils/orderApi";
import { generateInvoicePDF } from "@/utils/generateInvoicePDF";
import { useLoader } from "@/context/LoaderContext";
import { getOrderSlug, getUserSlug } from "../../../../../utils/slugUtils";

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

type TrackingRecord = {
    id: number;
    status: string;
    description: string;
    location: string | null;
    tracked_at: string;
};

type User = {
    id: number;
    name: string;
    email: string;
    phone_number: string | null;
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
    delivered_at: string | null;
    delivery_confirmed_at: string | null;
    delhivery_waybill?: string | null;
    delhivery_status?: string | null;
    courier_name?: string | null;
    user: User;
    order_items: OrderItem[];
    tracking_records: TrackingRecord[];
};

type OrderStats = {
    total_orders: number;
    pending_orders: number;
    confirmed_orders: number;
    processing_orders: number;
    shipped_orders: number;
    delivered_orders: number;
    completed_orders: number;
    cancelled_orders: number;
    total_revenue: number;
    todays_orders: number;
    this_month_orders: number;
};

function OrdersContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const initialStatus = searchParams?.get('status') || '';
    const initialPaymentMethod = searchParams?.get('paymentMethod') || searchParams?.get('payment_method') || '';
    const initialPaymentStatus = searchParams?.get('paymentStatus') || searchParams?.get('payment_status') || '';
    const initialDelhiveryStatus = searchParams?.get('delhiveryStatus') || searchParams?.get('delhivery_status') || '';

    const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'cancelled'>('all');
    const [orders, setOrders] = useState<Order[]>([]);
    const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
    const [cancelledOrders, setCancelledOrders] = useState<Order[]>([]);
    const [stats, setStats] = useState<OrderStats | null>(null);
    const [filter, setFilter] = useState<string>(initialStatus);
    const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>(initialPaymentMethod);
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>(initialPaymentStatus);
    const [delhiveryStatusFilter, setDelhiveryStatusFilter] = useState<string>(initialDelhiveryStatus);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
    const [showFilters, setShowFilters] = useState(false);

    // Infinite scroll state
    const [page, setPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(true);
    const [totalOrdersCount, setTotalOrdersCount] = useState(0);
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const isFetchingRef = useRef(false);
    const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const activeFilterCount = (searchTerm ? 1 : 0) + (filter ? 1 : 0) + (dateFilter.from ? 1 : 0) + (dateFilter.to ? 1 : 0);

    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState<"success" | "error" | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToastMessage = (message: string, type: "success" | "error") => {
        setToastMessage(message);
        setToastType(type);
        setShowToast(true);
    };

    useEffect(() => {
        if (showToast) {
            const timer = setTimeout(() => {
                setShowToast(false);
                setToastMessage(null);
                setToastType(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [showToast]);

    // Bulk Management State
    const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
    const [showBulkAcceptModal, setShowBulkAcceptModal] = useState(false);
    const [showBulkCancelModal, setShowBulkCancelModal] = useState(false);
    const [showBulkShipmentModal, setShowBulkShipmentModal] = useState(false);
    const [bulkCancelReason, setBulkCancelReason] = useState('');
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

    const [showCreateShipment, setShowCreateShipment] = useState(false);
    const [shipmentOrderId, setShipmentOrderId] = useState<number | null>(null);
    const [shipmentOrderNumber, setShipmentOrderNumber] = useState<string>('');
    const { showLoader, hideLoader } = useLoader();
    const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<number | null>(null);
    const [copiedWaybill, setCopiedWaybill] = useState<string | null>(null);

    const handleCopyWaybill = (e: React.MouseEvent, waybill: string) => {
        e.stopPropagation();
        if (!waybill) return;
        navigator.clipboard.writeText(waybill);
        setCopiedWaybill(waybill);
        showToastMessage(`Waybill ${waybill} copied to clipboard!`, 'success');
        setTimeout(() => {
            setCopiedWaybill((prev) => (prev === waybill ? null : prev));
        }, 2000);
    };

    const handleDownloadInvoice = async (order: any) => {
        try {
            setDownloadingInvoiceId(order.id);
            await downloadOrderInvoice(order.id, true);
        } catch (err) {
            console.warn("Backend invoice download failed, fallback to client generation:", err);
            try {
                await generateInvoicePDF(order);
            } catch (fallbackErr) {
                console.error("Client PDF generation error:", fallbackErr);
                showToastMessage("Failed to download invoice", "error");
            }
        } finally {
            setDownloadingInvoiceId(null);
        }
    };

    const fetchOrders = async (pageNum: number = 1, isAppend: boolean = false) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        if (isAppend) {
            setIsLoadingMore(true);
        } else {
            setIsLoadingInitial(true);
        }

        try {
            const params = new URLSearchParams();

            if (filter) params.append('status', filter);
            if (paymentMethodFilter) params.append('payment_method', paymentMethodFilter);
            if (paymentStatusFilter) params.append('payment_status', paymentStatusFilter);
            if (delhiveryStatusFilter) params.append('delhivery_status', delhiveryStatusFilter);
            if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
            if (dateFilter.from) params.append('from_date', dateFilter.from);
            if (dateFilter.to) params.append('to_date', dateFilter.to);
            params.append('page', pageNum.toString());
            params.append('limit', '10');
            params.append('per_page', '10');

            const response = await axios.get(`/api/admin/orders?${params.toString()}`);

            if (response.data.success) {
                const list: Order[] = response.data.data.data || [];
                const pag = response.data.data;
                const total = pag?.total ?? list.length;
                const hasNext = Boolean(
                    pag?.has_next_page ??
                    pag?.hasNextPage ??
                    pag?.has_more ??
                    (pageNum < (pag?.last_page || 1))
                );

                setTotalOrdersCount(total);
                setHasNextPage(hasNext);
                setPage(pageNum);

                if (isAppend) {
                    setOrders((prev) => {
                        const existingIds = new Set(prev.map((o) => o.id));
                        const newUnique = list.filter((o) => !existingIds.has(o.id));
                        return [...prev, ...newUnique];
                    });
                } else {
                    setOrders(list);
                }
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
            if (!isAppend) setOrders([]);
            setHasNextPage(false);
        } finally {
            isFetchingRef.current = false;
            setIsLoadingInitial(false);
            setIsLoadingMore(false);
        }
    };

    const fetchCompletedOrders = async (pageNum: number = 1, isAppend: boolean = false) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        if (isAppend) {
            setIsLoadingMore(true);
        } else {
            setIsLoadingInitial(true);
        }

        try {
            const response = await getCompletedOrders({
                search: debouncedSearchTerm,
                from_date: dateFilter.from,
                to_date: dateFilter.to,
                page: pageNum,
                limit: 10,
                per_page: 10,
            });

            if (response.success) {
                const list: Order[] = response.data.data || [];
                const pag = response.data;
                const total = pag?.total ?? list.length;
                const hasNext = Boolean(
                    pag?.has_next_page ??
                    pag?.hasNextPage ??
                    pag?.has_more ??
                    (pageNum < (pag?.last_page || 1))
                );

                setTotalOrdersCount(total);
                setHasNextPage(hasNext);
                setPage(pageNum);

                if (isAppend) {
                    setCompletedOrders((prev) => {
                        const existingIds = new Set(prev.map((o) => o.id));
                        const newUnique = list.filter((o) => !existingIds.has(o.id));
                        return [...prev, ...newUnique];
                    });
                } else {
                    setCompletedOrders(list);
                }
            }
        } catch (error) {
            console.error('Error fetching completed orders:', error);
            showToastMessage('Failed to fetch completed orders', 'error');
            if (!isAppend) setCompletedOrders([]);
            setHasNextPage(false);
        } finally {
            isFetchingRef.current = false;
            setIsLoadingInitial(false);
            setIsLoadingMore(false);
        }
    };

    const fetchCancelledOrders = async (pageNum: number = 1, isAppend: boolean = false) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        if (isAppend) {
            setIsLoadingMore(true);
        } else {
            setIsLoadingInitial(true);
        }

        try {
            const response = await getCancelledOrders({
                search: debouncedSearchTerm,
                from_date: dateFilter.from,
                to_date: dateFilter.to,
                page: pageNum,
                limit: 10,
                per_page: 10,
            });

            if (response.success) {
                const list: Order[] = response.data.data || [];
                const pag = response.data;
                const total = pag?.total ?? list.length;
                const hasNext = Boolean(
                    pag?.has_next_page ??
                    pag?.hasNextPage ??
                    pag?.has_more ??
                    (pageNum < (pag?.last_page || 1))
                );

                setTotalOrdersCount(total);
                setHasNextPage(hasNext);
                setPage(pageNum);

                if (isAppend) {
                    setCancelledOrders((prev) => {
                        const existingIds = new Set(prev.map((o) => o.id));
                        const newUnique = list.filter((o) => !existingIds.has(o.id));
                        return [...prev, ...newUnique];
                    });
                } else {
                    setCancelledOrders(list);
                }
            }
        } catch (error) {
            console.error('Error fetching cancelled orders:', error);
            showToastMessage('Failed to fetch cancelled orders', 'error');
            if (!isAppend) setCancelledOrders([]);
            setHasNextPage(false);
        } finally {
            isFetchingRef.current = false;
            setIsLoadingInitial(false);
            setIsLoadingMore(false);
        }
    };

    const fetchOrderStats = async () => {
        try {
            const response = await axios.get('/api/admin/orders/stats');
            if (response.data.success) {
                setStats(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching order stats:', error);
        }
    };

    // Trigger initial fetch on tab or filter change
    useEffect(() => {
        setPage(1);
        setHasNextPage(true);
        setSelectedOrderIds([]);

        if (activeTab === 'all') {
            fetchOrders(1, false);
        } else if (activeTab === 'completed') {
            fetchCompletedOrders(1, false);
        } else if (activeTab === 'cancelled') {
            fetchCancelledOrders(1, false);
        }
        fetchOrderStats();
    }, [activeTab, filter, paymentMethodFilter, paymentStatusFilter, delhiveryStatusFilter, debouncedSearchTerm, dateFilter]);

    // Load next page on scroll
    const loadNextPage = useCallback(() => {
        if (!hasNextPage || isLoadingMore || isLoadingInitial || isFetchingRef.current) return;
        const nextPage = page + 1;
        if (activeTab === 'all') {
            fetchOrders(nextPage, true);
        } else if (activeTab === 'completed') {
            fetchCompletedOrders(nextPage, true);
        } else if (activeTab === 'cancelled') {
            fetchCancelledOrders(nextPage, true);
        }
    }, [hasNextPage, isLoadingMore, isLoadingInitial, page, activeTab]);

    // Observer for bottom sentinel
    useEffect(() => {
        const sentinel = bottomSentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const target = entries[0];
                if (target.isIntersecting) {
                    loadNextPage();
                }
            },
            {
                root: null,
                rootMargin: "300px",
                threshold: 0.1,
            }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [loadNextPage]);

    const refreshCurrentTab = () => {
        if (activeTab === 'all') fetchOrders(1, false);
        else if (activeTab === 'completed') fetchCompletedOrders(1, false);
        else if (activeTab === 'cancelled') fetchCancelledOrders(1, false);
    };

    const handleConfirmOrder = async (orderId: number) => {
        showLoader();
        try {
            const response = await axios.patch(`/api/admin/orders/${orderId}/status`, {
                status: 'confirmed',
                description: 'Order accepted by admin',
                location: 'Warehouse'
            });

            if (response.data.success) {
                showToastMessage('Order accepted successfully', 'success');
                refreshCurrentTab();
                fetchOrderStats();
            }
        } catch (error: any) {
            console.error('Error confirming order:', error);
            showToastMessage(error.response?.data?.message || 'Failed to accept order', 'error');
        } finally {
            hideLoader();
        }
    };

    const handleRejectOrder = async (orderId: number) => {
        if (!confirm('Are you sure you want to reject/cancel this order?')) return;
        showLoader();
        try {
            const response = await axios.patch(`/api/admin/orders/${orderId}/status`, {
                status: 'cancelled',
                description: 'Order rejected by admin',
                location: 'Warehouse'
            });

            if (response.data.success) {
                showToastMessage('Order rejected successfully', 'success');
                refreshCurrentTab();
                fetchOrderStats();
            }
        } catch (error: any) {
            console.error('Error rejecting order:', error);
            showToastMessage(error.response?.data?.message || 'Failed to reject order', 'error');
        } finally {
            hideLoader();
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
                return <Clock className="w-4 h-4 text-yellow-500" />;
            case 'confirmed':
                return <CheckCircle className="w-4 h-4 text-blue-500" />;
            case 'processing':
                return <Package className="w-4 h-4 text-purple-500" />;
            case 'shipped':
                return <Truck className="w-4 h-4 text-orange-500" />;
            case 'delivered':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'completed':
                return <CheckCircle className="w-4 h-4 text-emerald-600" />;
            case 'cancelled':
                return <X className="w-4 h-4 text-red-500" />;
            default:
                return <Clock className="w-4 h-4 text-gray-500" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'confirmed':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'processing':
                return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'shipped':
                return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'delivered':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'completed':
                return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'cancelled':
                return 'bg-red-100 text-red-800 border-red-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const formatDateTime = (dateString: string | Date | null | undefined) => {
        if (!dateString) return { date: '—', time: '' };
        const raw = typeof dateString === 'string' ? dateString : dateString.toISOString();

        // Fix MySQL local timestamp: If raw ends with 'Z' but was stored in local time, stripping 'Z' prevents double timezone addition
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

    const formatDate = (dateString: string) => {
        const dt = formatDateTime(dateString);
        return dt.time ? `${dt.date}, ${dt.time}` : dt.date;
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    const displayOrders = activeTab === 'all' ? orders : (activeTab === 'completed' ? completedOrders : cancelledOrders);

    const isAllSelected = displayOrders.length > 0 && displayOrders.every(o => selectedOrderIds.includes(o.id));
    const isSomeSelected = selectedOrderIds.length > 0 && !isAllSelected && displayOrders.some(o => selectedOrderIds.includes(o.id));

    const handleToggleSelectAll = () => {
        if (isAllSelected) {
            const visibleIds = new Set(displayOrders.map(o => o.id));
            setSelectedOrderIds(prev => prev.filter(id => !visibleIds.has(id)));
        } else {
            const visibleIds = displayOrders.map(o => o.id);
            setSelectedOrderIds(prev => Array.from(new Set([...prev, ...visibleIds])));
        }
    };

    const handleToggleSelectOrder = (orderId: number) => {
        setSelectedOrderIds(prev =>
            prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
        );
    };

    const handleClearSelection = () => {
        setSelectedOrderIds([]);
    };

    // Selected orders object list
    const selectedOrdersList = displayOrders.filter(o => selectedOrderIds.includes(o.id));

    // Smart Status Classification for Accept
    const eligibleForAccept = selectedOrdersList.filter(o => o.status === 'pending');
    const alreadyAcceptedForAccept = selectedOrdersList.filter(o => o.status === 'confirmed');
    const skippedForAccept = selectedOrdersList.filter(o => o.status !== 'pending');

    // Smart Status Classification for Cancel
    const eligibleForCancel = selectedOrdersList.filter(o => ['pending', 'confirmed', 'processing'].includes(o.status));
    const alreadyCancelledForCancel = selectedOrdersList.filter(o => o.status === 'cancelled');
    const skippedForCancel = selectedOrdersList.filter(o => !['pending', 'confirmed', 'processing'].includes(o.status));

    // Smart Status Classification for Bulk Shipment Creation (Accepted / Confirmed orders)
    const eligibleForShipment = selectedOrdersList.filter(
        o => !o.delhivery_waybill && !(o as any).delhiveryWaybill && ['confirmed', 'processing'].includes(o.status)
    );
    const alreadyShippedForShipment = selectedOrdersList.filter(
        o => Boolean(o.delhivery_waybill || (o as any).delhiveryWaybill) || ['shipped', 'delivered', 'completed'].includes(o.status)
    );
    const pendingForShipment = selectedOrdersList.filter(o => o.status === 'pending');

    const handleOpenBulkShipmentModal = () => {
        if (selectedOrderIds.length === 0) return;
        if (eligibleForShipment.length === 0) {
            if (pendingForShipment.length > 0) {
                showToastMessage('Selected orders are still pending. Please accept/confirm the orders first before creating shipments.', 'error');
            } else if (alreadyShippedForShipment.length > 0) {
                showToastMessage('Selected orders already have shipments created or are already shipped.', 'error');
            } else {
                showToastMessage('No selected orders are eligible for shipment creation.', 'error');
            }
            return;
        }
        setShowBulkShipmentModal(true);
    };

    const handleOpenBulkAcceptModal = () => {
        if (selectedOrderIds.length === 0) return;
        if (eligibleForAccept.length === 0) {
            showToastMessage('No selected orders can be accepted. The selected orders are already accepted or cancelled.', 'error');
            return;
        }
        setShowBulkAcceptModal(true);
    };

    const handleOpenBulkCancelModal = () => {
        if (selectedOrderIds.length === 0) return;
        if (eligibleForCancel.length === 0) {
            showToastMessage('No selected orders can be cancelled. The selected orders are already cancelled.', 'error');
            return;
        }
        setShowBulkCancelModal(true);
    };

    const handleBulkAccept = async () => {
        const eligibleIds = eligibleForAccept.map(o => o.id);
        if (eligibleIds.length === 0) {
            showToastMessage('No selected orders can be accepted. The selected orders are already accepted or cancelled.', 'error');
            setShowBulkAcceptModal(false);
            return;
        }

        setIsBulkProcessing(true);
        showLoader();
        try {
            // ONLY send eligible IDs to backend
            const res = await bulkAcceptOrders(eligibleIds);
            if (res.success) {
                const totalAccepted = res.acceptedCount ?? res.processedCount ?? 0;
                const clientSkipped = skippedForAccept.length;
                const totalSkipped = (res.skippedCount ?? 0) + clientSkipped;

                let feedbackMsg = '';
                if (totalAccepted > 0 && totalSkipped > 0) {
                    feedbackMsg = `${totalAccepted} order(s) accepted successfully. ${totalSkipped} order(s) were skipped because they were already accepted or cancelled.`;
                } else if (totalAccepted > 0) {
                    feedbackMsg = `${totalAccepted} order(s) accepted successfully.`;
                } else {
                    feedbackMsg = res.message || 'No orders could be accepted.';
                }

                showToastMessage(feedbackMsg, totalAccepted > 0 ? 'success' : 'error');
                setSelectedOrderIds([]);
                setShowBulkAcceptModal(false);
                refreshCurrentTab();
                fetchOrderStats();
            }
        } catch (err: any) {
            console.error('Error bulk accepting orders:', err);
            showToastMessage(err.response?.data?.message || 'Failed to accept selected orders', 'error');
        } finally {
            setIsBulkProcessing(false);
            hideLoader();
        }
    };

    const handleBulkCancel = async () => {
        const eligibleIds = eligibleForCancel.map(o => o.id);
        if (eligibleIds.length === 0) {
            showToastMessage('No selected orders can be cancelled. The selected orders are already cancelled.', 'error');
            setShowBulkCancelModal(false);
            return;
        }

        setIsBulkProcessing(true);
        showLoader();
        try {
            // ONLY send eligible IDs to backend
            const res = await bulkCancelOrders(eligibleIds, bulkCancelReason);
            if (res.success) {
                const totalCancelled = res.cancelledCount ?? res.processedCount ?? 0;
                const clientSkipped = skippedForCancel.length;
                const totalSkipped = (res.skippedCount ?? 0) + clientSkipped;

                let feedbackMsg = '';
                if (totalCancelled > 0 && totalSkipped > 0) {
                    feedbackMsg = `${totalCancelled} order(s) cancelled successfully. ${totalSkipped} order(s) were skipped because they were already cancelled.`;
                } else if (totalCancelled > 0) {
                    feedbackMsg = `${totalCancelled} order(s) cancelled successfully.`;
                } else {
                    feedbackMsg = res.message || 'No orders could be cancelled.';
                }

                showToastMessage(feedbackMsg, totalCancelled > 0 ? 'success' : 'error');
                setSelectedOrderIds([]);
                setBulkCancelReason('');
                setShowBulkCancelModal(false);
                refreshCurrentTab();
                fetchOrderStats();
            }
        } catch (err: any) {
            console.error('Error bulk cancelling orders:', err);
            showToastMessage(err.response?.data?.message || 'Failed to cancel selected orders', 'error');
        } finally {
            setIsBulkProcessing(false);
            hideLoader();
        }
    };

    const activeOrdersCount = stats
        ? (stats.pending_orders || 0) + (stats.confirmed_orders || 0) + (stats.processing_orders || 0) + (stats.shipped_orders || 0) + (stats.delivered_orders || 0)
        : 0;

    return (
        <div className="p-3 md:p-6">
            <div className="p-3 md:p-5 bg-white/70 backdrop-blur border border-gray-200 rounded-2xl shadow-lg mb-4 md:mb-5">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-lg md:text-xl lg:text-3xl font-bold px-2 md:px-5 text-gray-900 tracking-tight">Order Management</h1>
                        <p className="text-xs md:text-sm text-gray-600 px-2 md:px-5">Manage and track all orders</p>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-4 md:mb-6">
                    <div className="bg-white rounded-lg p-3 md:p-5 border border-gray-200 shadow-md">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs md:text-sm font-medium text-gray-600">Total Orders</p>
                                <p className="text-base md:text-2xl font-bold text-gray-900">{stats.total_orders}</p>
                            </div>
                            <Package className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg p-3 md:p-5 shadow-md border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs md:text-sm font-medium text-gray-600">Today's Orders</p>
                                <p className="text-base md:text-2xl font-bold text-gray-900">{stats.todays_orders}</p>
                            </div>
                            <Calendar className="w-6 h-6 md:w-8 md:h-8 text-green-500" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg p-3 md:p-5 shadow-md border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs md:text-sm font-medium text-gray-600">Active / Pending</p>
                                <p className="text-base md:text-2xl font-bold text-blue-600">{activeOrdersCount}</p>
                            </div>
                            <Clock className="w-6 h-6 md:w-8 md:h-8 text-yellow-500" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg p-3 md:p-5 shadow-md border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs md:text-sm font-medium text-gray-600">Completed</p>
                                <p className="text-base md:text-2xl font-bold text-emerald-600">{stats.completed_orders || 0}</p>
                            </div>
                            <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-emerald-500" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg p-3 md:p-5 shadow-md border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs md:text-sm font-medium text-gray-600">Cancelled</p>
                                <p className="text-base md:text-2xl font-bold text-rose-600">{stats.cancelled_orders || 0}</p>
                            </div>
                            <XCircle className="w-6 h-6 md:w-8 md:h-8 text-rose-500" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg p-3 md:p-5 shadow-md border border-gray-200 col-span-2 md:col-span-1">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs md:text-sm font-medium text-gray-600">Total Revenue</p>
                                <p className="text-base md:text-2xl font-bold text-gray-900">{formatCurrency(stats.total_revenue)}</p>
                            </div>
                            <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-green-500" />
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs & Filter Toggle Bar */}
            <div className="mb-4 md:mb-6">
                <div className="border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <nav className="-mb-px flex space-x-3 md:space-x-8 overflow-x-auto">
                        <button
                            onClick={() => {
                                setActiveTab('all');
                                setPage(1);
                                setFilter('');
                                setSelectedOrderIds([]);
                            }}
                            className={`py-3 md:py-4 px-1 border-b-2 font-medium text-xs md:text-sm transition-colors whitespace-nowrap ${activeTab === 'all'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-1.5 md:gap-2">
                                <Package className="w-4 h-4 md:w-5 md:h-5" />
                                <span className="hidden sm:inline">All Orders (In-Processing)</span>
                                <span className="sm:hidden">All Orders</span>
                                {activeOrdersCount > 0 && (
                                    <span className="bg-blue-100 text-blue-600 text-xs font-bold px-1.5 md:px-2 py-0.5 rounded-full">
                                        {activeOrdersCount}
                                    </span>
                                )}
                            </div>
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('completed');
                                setPage(1);
                                setFilter('');
                                setSelectedOrderIds([]);
                            }}
                            className={`py-3 md:py-4 px-1 border-b-2 font-medium text-xs md:text-sm transition-colors whitespace-nowrap ${activeTab === 'completed'
                                ? 'border-emerald-500 text-emerald-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-1.5 md:gap-2">
                                <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                                <span className="hidden sm:inline">Completed Orders</span>
                                <span className="sm:hidden">Completed</span>
                                {stats && (stats.completed_orders || 0) > 0 && (
                                    <span className="bg-emerald-100 text-emerald-600 text-xs font-bold px-1.5 md:px-2 py-0.5 rounded-full">
                                        {stats.completed_orders}
                                    </span>
                                )}
                            </div>
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('cancelled');
                                setPage(1);
                                setFilter('');
                                setSelectedOrderIds([]);
                            }}
                            className={`py-3 md:py-4 px-1 border-b-2 font-medium text-xs md:text-sm transition-colors whitespace-nowrap ${activeTab === 'cancelled'
                                ? 'border-rose-500 text-rose-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-1.5 md:gap-2">
                                <XCircle className="w-4 h-4 md:w-5 md:h-5" />
                                <span className="hidden sm:inline">Cancelled Orders</span>
                                <span className="sm:hidden">Cancelled</span>
                                {stats && (stats.cancelled_orders || 0) > 0 && (
                                    <span className="bg-rose-100 text-rose-600 text-xs font-bold px-1.5 md:px-2 py-0.5 rounded-full">
                                        {stats.cancelled_orders}
                                    </span>
                                )}
                            </div>
                        </button>
                    </nav>

                    {/* Filter Toggle Button */}
                    <div className="flex items-center gap-2 pb-2 sm:pb-0">
                        {activeFilterCount > 0 && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilter('');
                                    setDateFilter({ from: '', to: '' });
                                }}
                                className="px-3 py-1.5 text-xs text-gray-500 hover:text-rose-600 font-medium transition cursor-pointer flex items-center gap-1"
                                title="Reset all active filters"
                            >
                                <X className="w-3.5 h-3.5" />
                                <span>Clear Filters</span>
                            </button>
                        )}
                        <button
                            onClick={() => setShowFilters(prev => !prev)}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold transition shadow-xs cursor-pointer border ${showFilters || activeFilterCount > 0
                                ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                }`}
                            aria-expanded={showFilters}
                        >
                            <FilterIcon className="w-4 h-4 text-blue-600" />
                            <span>Filters</span>
                            {activeFilterCount > 0 && (
                                <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters (Hidden by Default, toggled by Filters button) */}
            {showFilters && (
                <div className="bg-white border border-gray-200 shadow-md rounded-2xl p-4 md:p-6 mb-4 md:mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <FilterIcon className="w-4 h-4 text-blue-600" />
                            <span>Filter Orders</span>
                        </div>
                        {activeFilterCount > 0 && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilter('');
                                    setDateFilter({ from: '', to: '' });
                                }}
                                className="text-xs text-rose-600 hover:text-rose-700 font-medium underline cursor-pointer"
                            >
                                Reset all filters
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                        <div>
                            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">Search <span className="text-[8px] md:text-xs font-medium text-gray-500">(Customer / Invoice no. / Order ID)</span></label>
                            <div className="relative">
                                <Search className="w-3 h-3 md:w-4 md:h-4 absolute left-3 top-2.5 md:top-3 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Order number or customer..."
                                    className="w-full pl-9 md:pl-10 pr-3 md:pr-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {activeTab === 'all' && (
                            <div>
                                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">Status</label>
                                <select
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white cursor-pointer"
                                >
                                    <option value="">All Active Orders</option>
                                    <option value="pending">Pending</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="processing">Processing</option>
                                    <option value="shipped">Shipped</option>
                                    <option value="delivered">Delivered</option>
                                </select>
                            </div>
                        )}

                        <div className={activeTab !== 'all' ? 'md:col-start-2' : ''}>
                            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">From Date</label>
                            <input
                                type="date"
                                value={dateFilter.from}
                                onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
                                className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">To Date</label>
                            <input
                                type="date"
                                value={dateFilter.to}
                                onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
                                className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'all' && selectedOrderIds.length > 0 && (
                <div className="bg-gradient-to-r from-blue-50/90 via-white to-blue-50/60 border border-blue-200 shadow-md rounded-2xl px-4 py-3 md:px-5 md:py-3.5 flex flex-wrap items-center justify-between gap-3 mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-xs">
                            {selectedOrderIds.length}
                        </span>
                        <span className="text-sm font-semibold text-gray-800">
                            {selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'order' : 'orders'} selected
                        </span>
                        <button
                            onClick={handleClearSelection}
                            className="text-xs text-gray-500 hover:text-rose-600 font-medium underline ml-2 transition cursor-pointer"
                        >
                            Deselect all
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleOpenBulkAcceptModal}
                            disabled={isBulkProcessing || eligibleForAccept.length === 0}
                            className={`px-3.5 py-2 text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer ${eligibleForAccept.length > 0
                                ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white'
                                : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                                }`}
                            title={eligibleForAccept.length > 0 ? `${eligibleForAccept.length} eligible for accept` : 'No selected orders eligible for accept'}
                        >
                            <CheckCircle className="w-4 h-4" />
                            <span>Accept Selected ({eligibleForAccept.length})</span>
                        </button>
                        <button
                            onClick={handleOpenBulkShipmentModal}
                            disabled={isBulkProcessing || eligibleForShipment.length === 0}
                            className={`px-3.5 py-2 text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer ${eligibleForShipment.length > 0
                                ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
                                : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                                }`}
                            title={eligibleForShipment.length > 0 ? `${eligibleForShipment.length} confirmed orders ready for shipment` : 'No selected orders eligible for shipment (accept orders first)'}
                        >
                            <Send className="w-4 h-4" />
                            <span>Create Shipments ({eligibleForShipment.length})</span>
                        </button>
                        <button
                            onClick={handleOpenBulkCancelModal}
                            disabled={isBulkProcessing || eligibleForCancel.length === 0}
                            className={`px-3.5 py-2 text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer ${eligibleForCancel.length > 0
                                ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white'
                                : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                                }`}
                            title={eligibleForCancel.length > 0 ? `${eligibleForCancel.length} eligible for cancel` : 'No selected orders eligible for cancel'}
                        >
                            <XCircle className="w-4 h-4" />
                            <span>Cancel Selected ({eligibleForCancel.length})</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Orders Table - Desktop */}
            <div className="hidden md:block overflow-x-auto rounded-2xl shadow-lg border border-gray-200 bg-white">
                <table className="w-full min-w-[1000px] text-sm text-left">
                    <thead className="bg-gray-50 uppercase text-xs font-semibold text-gray-600">
                        <tr>
                            {activeTab === 'all' && (
                                <th className="w-10 px-4 py-4 text-center">
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        ref={(el) => {
                                            if (el) el.indeterminate = isSomeSelected;
                                        }}
                                        onChange={handleToggleSelectAll}
                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                        aria-label="Select all visible orders"
                                    />
                                </th>
                            )}
                            <th className="px-6 py-4">Order</th>
                            <th className="px-6 py-4">Invoice No.</th>
                            <th className="px-6 py-4">Customer</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Shipment</th>
                            <th className="px-6 py-4">Payment Method</th>
                            <th className="px-6 py-4">Payment Status</th>
                            <th className="px-6 py-4">Total</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-gray-700">
                        {isLoadingInitial && displayOrders.length === 0 ? (
                            <tr>
                                <td colSpan={activeTab === 'all' ? 11 : 10} className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                        <span className="text-sm font-medium text-gray-500">Loading orders...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : displayOrders.length === 0 ? (
                            <tr>
                                <td colSpan={activeTab === 'all' ? 11 : 10} className="px-6 py-16 text-center text-gray-500">
                                    No orders found
                                </td>
                            </tr>
                        ) : (
                            displayOrders.map((order) => {
                                const itemsList = order.order_items || (order as any).orderItems || [];
                                const orderNum = order.order_number || (order as any).orderNumber || `ORD-${order.id}`;
                                const userId = (order as any).user?.id || (order as any).userId || (order as any).user_id;
                                const userName = (order as any).user?.name || "Customer";
                                const userEmail = (order as any).user?.email || "";
                                const statusStr = order.status ? (order.status.charAt(0).toUpperCase() + order.status.slice(1)) : "";
                                const payStatusStr = order.payment_status || (order as any).paymentStatus || "pending";
                                const formattedPayStatus = payStatusStr ? (payStatusStr.charAt(0).toUpperCase() + payStatusStr.slice(1)) : "";
                                const waybillNum = order.delhivery_waybill || (order as any).delhiveryWaybill;
                                const isSelected = selectedOrderIds.includes(order.id);

                                return (
                                    <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${isSelected && activeTab === 'all' ? 'bg-blue-50/50' : ''}`}>
                                        {activeTab === 'all' && (
                                            <td className="w-10 px-4 py-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleSelectOrder(order.id)}
                                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                                    aria-label={`Select order ${orderNum}`}
                                                />
                                            </td>
                                        )}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="text-sm font-semibold text-gray-900">{orderNum}</div>
                                                <div className="text-xs text-gray-500">{itemsList.length} items</div>
                                                {waybillNum && (
                                                    <div className="mt-1.5 flex items-center gap-1.5">
                                                        <span 
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[11px] font-mono font-medium text-blue-700 select-all"
                                                            title={`Delhivery AWB: ${waybillNum}`}
                                                        >
                                                            <Truck className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                                            <span>AWB: {waybillNum}</span>
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleCopyWaybill(e, waybillNum)}
                                                            className="inline-flex items-center justify-center p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-100/70 transition-colors"
                                                            title={copiedWaybill === waybillNum ? "Copied to clipboard!" : "Copy Waybill"}
                                                            aria-label={`Copy waybill ${waybillNum}`}
                                                        >
                                                            {copiedWaybill === waybillNum ? (
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
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-mono text-indigo-700 font-semibold">
                                                {(order as any).invoiceNumber || (order as any).invoice_number || <span className="text-gray-400 italic text-xs">—</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 max-w-[200px] break-all whitespace-normal">
                                            <div>
                                                {userId ? (
                                                    <>
                                                        <Link
                                                            href={`/dashboard/users/${getUserSlug({ id: userId, name: userName, email: userEmail })}`}
                                                            className="text-sm font-semibold text-blue-600 hover:text-blue-800 underline transition-colors block"
                                                            title={`View customer profile for ${userName}`}
                                                        >
                                                            {userName}
                                                        </Link>
                                                        {userEmail && (
                                                            <Link
                                                                href={`/dashboard/users/${getUserSlug({ id: userId, name: userName, email: userEmail })}`}
                                                                className="text-xs text-gray-500 hover:text-blue-700 underline transition-colors block mt-0.5"
                                                                title={`View customer profile for ${userName}`}
                                                            >
                                                                {userEmail}
                                                            </Link>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="text-sm font-medium text-gray-900">{userName}</div>
                                                        <div className="text-xs text-gray-500">{userEmail}</div>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {(() => {
                                                const rawDate = activeTab === 'completed' && order.delivery_confirmed_at
                                                    ? order.delivery_confirmed_at
                                                    : (order.created_at || (order as any).createdAt);
                                                const dt = formatDateTime(rawDate);
                                                return (
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{dt.date}</div>
                                                        {dt.time && <div className="text-xs text-gray-500 font-medium mt-0.5">{dt.time}</div>}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                                                {getStatusIcon(order.status)}
                                                {statusStr}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {waybillNum ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200" title={`AWB: ${waybillNum}`}>
                                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                                    <span>Created</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                                    <XCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                                                    <span>Not Created</span>
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {(order.payment_method || (order as any).paymentMethod) === 'cash_on_delivery' ? 'Cash on Delivery' : 'Online Payment'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${payStatusStr === 'paid'
                                                ? 'bg-green-100 text-green-800'
                                                : payStatusStr === 'failed'
                                                    ? 'bg-red-100 text-red-800'
                                                    : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {formattedPayStatus}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {formatCurrency(order.total)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                                            <ActionDropdownMenu
                                                align="right"
                                                ariaLabel={`Actions for order ${orderNum}`}
                                                items={[
                                                    {
                                                        key: 'invoice',
                                                        label: 'Download Invoice',
                                                        icon: Download,
                                                        variant: 'success',
                                                        loading: downloadingInvoiceId === order.id,
                                                        onClick: () => handleDownloadInvoice(order),
                                                    },
                                                    {
                                                        key: 'details',
                                                        label: 'View Order Details',
                                                        icon: Eye,
                                                        variant: 'primary',
                                                        href: `/dashboard/orders/${getOrderSlug(order)}`,
                                                    },
                                                    {
                                                        key: 'confirm',
                                                        label: 'Accept Order',
                                                        icon: CheckCircle,
                                                        variant: 'success',
                                                        hidden: activeTab !== 'all' || order.status !== 'pending',
                                                        onClick: () => handleConfirmOrder(order.id),
                                                    },
                                                    {
                                                        key: 'reject',
                                                        label: 'Reject Order',
                                                        icon: X,
                                                        variant: 'danger',
                                                        hidden: activeTab !== 'all' || ['cancelled', 'delivered', 'shipped'].includes(order.status),
                                                        onClick: () => handleRejectOrder(order.id),
                                                    },
                                                    {
                                                        key: 'shipment',
                                                        label: 'Create Shipment',
                                                        icon: Send,
                                                        variant: 'info',
                                                        hidden: activeTab !== 'all' || Boolean(order.delhivery_waybill) || !['confirmed', 'processing'].includes(order.status),
                                                        onClick: () => {
                                                            setShipmentOrderId(order.id);
                                                            setShipmentOrderNumber(order.order_number || (order as any).orderNumber);
                                                            setShowCreateShipment(true);
                                                        },
                                                    },
                                                    {
                                                        key: 'track',
                                                        label: 'Track Shipment',
                                                        icon: Truck,
                                                        variant: 'warning',
                                                        hidden: !order.delhivery_waybill,
                                                        href: `/dashboard/orders/${getOrderSlug(order)}/track`,
                                                    },
                                                ]}
                                            />
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Orders Cards - Mobile */}
            <div className="md:hidden space-y-4">
                {isLoadingInitial && displayOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-md border border-gray-200">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                        <span className="text-sm font-medium text-gray-500">Loading orders...</span>
                    </div>
                ) : displayOrders.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
                        <p className="text-gray-500">No orders found</p>
                    </div>
                ) : (
                    displayOrders.map((order) => {
                        const itemsList = order.order_items || (order as any).orderItems || [];
                        const orderNum = order.order_number || (order as any).orderNumber || `ORD-${order.id}`;
                        const userId = (order as any).user?.id || (order as any).userId || (order as any).user_id;
                        const userName = (order as any).user?.name || "Customer";
                        const userEmail = (order as any).user?.email || "";
                        const statusStr = order.status ? (order.status.charAt(0).toUpperCase() + order.status.slice(1)) : "";
                        const payStatusStr = order.payment_status || (order as any).paymentStatus || "pending";
                        const formattedPayStatus = payStatusStr ? (payStatusStr.charAt(0).toUpperCase() + payStatusStr.slice(1)) : "";
                        const waybillNum = order.delhivery_waybill || (order as any).delhiveryWaybill;
                        const isSelected = selectedOrderIds.includes(order.id);

                        return (
                            <div
                                key={order.id}
                                className={`bg-white rounded-xl shadow-md border p-4 hover:shadow-lg transition ${isSelected ? 'border-blue-400 ring-2 ring-blue-100 bg-blue-50/20' : 'border-gray-200'}`}
                            >
                                <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-gray-100">
                                    {activeTab === 'all' ? (
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleToggleSelectOrder(order.id)}
                                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                            />
                                            <span className="text-xs font-semibold text-gray-700">Select order</span>
                                        </label>
                                    ) : (
                                        <div />
                                    )}
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                                        {getStatusIcon(order.status)}
                                        {statusStr}
                                    </span>
                                </div>

                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-900 text-base">{orderNum}</h3>
                                        <p className="text-xs text-gray-500">{itemsList.length} items</p>
                                        {waybillNum && (
                                            <div className="mt-1.5 flex items-center gap-1.5">
                                                <span 
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[11px] font-mono font-medium text-blue-700 select-all"
                                                    title={`Delhivery AWB: ${waybillNum}`}
                                                >
                                                    <Truck className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                                    <span>AWB: {waybillNum}</span>
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleCopyWaybill(e, waybillNum)}
                                                    className="inline-flex items-center justify-center p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-100/70 transition-colors"
                                                    title={copiedWaybill === waybillNum ? "Copied to clipboard!" : "Copy Waybill"}
                                                    aria-label={`Copy waybill ${waybillNum}`}
                                                >
                                                    {copiedWaybill === waybillNum ? (
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

                                <div className="space-y-2 mb-3 pb-3 border-b border-gray-100">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Customer:</span>
                                        {userId ? (
                                            <Link
                                                href={`/dashboard/users/${getUserSlug({ id: userId, name: userName, email: userEmail })}`}
                                                className="font-semibold text-blue-600 hover:text-blue-800 underline transition-colors"
                                                title={`View customer profile for ${userName}`}
                                            >
                                                {userName}
                                            </Link>
                                        ) : (
                                            <span className="font-medium text-gray-900">{userName}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Email:</span>
                                        {userId && userEmail ? (
                                            <Link
                                                href={`/dashboard/users/${getUserSlug({ id: userId, name: userName, email: userEmail })}`}
                                                className="text-xs text-gray-600 hover:text-blue-700 underline transition-colors"
                                                title={`View customer profile for ${userName}`}
                                            >
                                                {userEmail}
                                            </Link>
                                        ) : (
                                            <span className="text-gray-700 text-xs">{userEmail}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Date:</span>
                                        {(() => {
                                            const rawDate = activeTab === 'completed' && order.delivery_confirmed_at
                                                ? order.delivery_confirmed_at
                                                : (order.created_at || (order as any).createdAt);
                                            const dt = formatDateTime(rawDate);
                                            return (
                                                <div className="text-right">
                                                    <div className="text-gray-900 font-medium text-xs">{dt.date}</div>
                                                    {dt.time && <div className="text-gray-500 text-[11px] font-medium">{dt.time}</div>}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Payment:</span>
                                        <span className="text-gray-900">{(order.payment_method || (order as any).paymentMethod) === 'cash_on_delivery' ? 'COD' : 'Online'}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Shipment:</span>
                                        {order.delhivery_waybill || (order as any).delhiveryWaybill ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                <CheckCircle className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                                                <span>Created</span>
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                                <XCircle className="w-3 h-3 text-rose-600 flex-shrink-0" />
                                                <span>Not Created</span>
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Payment Status:</span>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${payStatusStr === 'paid' ? 'bg-green-100 text-green-800' : payStatusStr === 'failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {formattedPayStatus}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm pt-2">
                                        <span className="text-gray-600 font-semibold">Total:</span>
                                        <span className="font-bold text-gray-900 text-base">{formatCurrency(order.total)}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => handleDownloadInvoice(order)}
                                        disabled={downloadingInvoiceId === order.id}
                                        className="w-full py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg flex items-center justify-center gap-2 transition font-medium text-sm disabled:opacity-50"
                                    >
                                        {downloadingInvoiceId === order.id ? (
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Download className="w-4 h-4" />
                                        )}
                                        Download Invoice
                                    </button>

                                    {activeTab !== 'all' ? (
                                        <>
                                            <button
                                                onClick={() => router.push(`/dashboard/orders/${getOrderSlug(order)}`)}
                                                className="w-full py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg flex items-center justify-center gap-2 transition font-medium text-sm cursor-pointer"
                                            >
                                                <Eye className="w-4 h-4" />
                                                View Details
                                            </button>
                                            {order.delhivery_waybill && (
                                                <a
                                                    href={`/dashboard/orders/${getOrderSlug(order)}/track`}
                                                    className="w-full py-2.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg flex items-center justify-center gap-2 transition font-medium text-sm"
                                                >
                                                    <Truck className="w-4 h-4" />
                                                    Track Shipment
                                                </a>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => router.push(`/dashboard/orders/${getOrderSlug(order)}`)}
                                                className="w-full py-2.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg flex items-center justify-center gap-2 transition font-medium text-sm cursor-pointer"
                                            >
                                                <Eye className="w-4 h-4" />
                                                View Details
                                            </button>
                                            {order.status === 'pending' && (
                                                <button
                                                    onClick={() => handleConfirmOrder(order.id)}
                                                    className="w-full py-2.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg flex items-center justify-center gap-2 transition font-medium text-sm cursor-pointer"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Confirm Order
                                                </button>
                                            )}
                                            {!order.delhivery_waybill && ['confirmed', 'processing'].includes(order.status) && (
                                                <button
                                                    onClick={() => {
                                                        setShipmentOrderId(order.id);
                                                        setShipmentOrderNumber(order.order_number);
                                                        setShowCreateShipment(true);
                                                    }}
                                                    className="w-full py-2.5 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg flex items-center justify-center gap-2 transition font-medium text-sm cursor-pointer"
                                                >
                                                    <Send className="w-4 h-4" />
                                                    Create Shipment
                                                </button>
                                            )}
                                            {order.delhivery_waybill && (
                                                <a
                                                    href={`/dashboard/orders/${getOrderSlug(order)}/track`}
                                                    className="w-full py-2.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg flex items-center justify-center gap-2 transition font-medium text-sm"
                                                >
                                                    <Truck className="w-4 h-4" />
                                                    Track Shipment
                                                </a>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Bottom Sentinel for Infinite Scroll */}
            <div ref={bottomSentinelRef} className="h-6 w-full pointer-events-none" />

            {/* Infinite Scroll Bottom Loading State */}
            {isLoadingMore && (
                <div className="flex items-center justify-center gap-2.5 py-6 text-sm text-gray-600 animate-in fade-in duration-200">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <span className="font-semibold text-gray-700">Loading more orders...</span>
                </div>
            )}

            {/* All Orders Loaded End Indicator */}
            {!hasNextPage && displayOrders.length > 0 && !isLoadingInitial && (
                <div className="flex items-center justify-center py-6 text-xs md:text-sm text-gray-400 font-medium animate-in fade-in duration-200">
                    <span className="bg-gray-100/90 px-4 py-1.5 rounded-full border border-gray-200 text-gray-600 font-semibold shadow-xs flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>All {displayOrders.length} orders loaded</span>
                    </span>
                </div>
            )}

            {/* Bulk Accept Modal */}
            <Modal
                isOpen={showBulkAcceptModal}
                title="Bulk Accept Orders"
                onClose={() => {
                    if (!isBulkProcessing) setShowBulkAcceptModal(false);
                }}
            >
                <div className="p-6">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                        <CheckCircle className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 text-center mb-1">
                        Accept Selected Orders?
                    </h3>
                    <p className="text-xs text-gray-500 text-center mb-4">
                        Review the status breakdown below before confirming. Only eligible pending orders will be sent to the server for confirmation.
                    </p>

                    {/* Summary stats pill cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
                            <span className="text-xs text-gray-500 block">Selected</span>
                            <span className="text-base font-bold text-gray-800">{selectedOrderIds.length}</span>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-center">
                            <span className="text-xs text-emerald-700 font-semibold block">To Accept</span>
                            <span className="text-base font-bold text-emerald-700">{eligibleForAccept.length}</span>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-center">
                            <span className="text-xs text-blue-700 block">Already Accepted</span>
                            <span className="text-base font-bold text-blue-700">{alreadyAcceptedForAccept.length}</span>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-center">
                            <span className="text-xs text-amber-700 block">To Be Skipped</span>
                            <span className="text-base font-bold text-amber-700">{skippedForAccept.length}</span>
                        </div>
                    </div>

                    {/* Informative text */}
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-950 mb-4">
                        <p className="font-semibold mb-1">
                            {eligibleForAccept.length} order{eligibleForAccept.length === 1 ? '' : 's'} will be accepted.
                            {skippedForAccept.length > 0 && ` ${skippedForAccept.length} already accepted/cancelled order${skippedForAccept.length === 1 ? '' : 's'} will be skipped.`}
                        </p>
                        <p className="text-emerald-800">
                            Each confirmed order will be assigned a Tax Invoice and each customer will receive their own confirmation email with PDF attached.
                        </p>
                    </div>

                    {/* Eligible orders list */}
                    {eligibleForAccept.length > 0 && (
                        <div className="mb-3">
                            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                Orders to be Accepted ({eligibleForAccept.length}):
                            </p>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-gray-50 border border-gray-200 rounded-lg">
                                {eligibleForAccept.map(o => (
                                    <span key={o.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                                        {o.order_number || (o as any).orderNumber || `ORD-${o.id}`}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Skipped orders list */}
                    {skippedForAccept.length > 0 && (
                        <div className="mb-4">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                Orders to be Skipped ({skippedForAccept.length}):
                            </p>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-gray-50 border border-gray-200 rounded-lg">
                                {skippedForAccept.map(o => (
                                    <span key={o.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-white text-gray-600 border border-gray-300">
                                        <span>{o.order_number || (o as any).orderNumber || `ORD-${o.id}`}</span>
                                        <span className="text-[10px] text-gray-400 capitalize">({o.status})</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => setShowBulkAcceptModal(false)}
                            disabled={isBulkProcessing}
                            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleBulkAccept}
                            disabled={isBulkProcessing || eligibleForAccept.length === 0}
                            className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-sm flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
                        >
                            {isBulkProcessing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Accepting...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Accept {eligibleForAccept.length} Order{eligibleForAccept.length === 1 ? '' : 's'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Bulk Cancel Modal */}
            <Modal
                isOpen={showBulkCancelModal}
                title="Bulk Cancel Orders"
                onClose={() => {
                    if (!isBulkProcessing) setShowBulkCancelModal(false);
                }}
            >
                <div className="p-6">
                    <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 text-center mb-1">
                        Cancel Selected Orders?
                    </h3>
                    <p className="text-xs text-gray-500 text-center mb-4">
                        Review the status breakdown below before confirming. Inventory will be automatically restored for all cancelled items.
                    </p>

                    {/* Summary stats pill cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
                            <span className="text-xs text-gray-500 block">Selected</span>
                            <span className="text-base font-bold text-gray-800">{selectedOrderIds.length}</span>
                        </div>
                        <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-center">
                            <span className="text-xs text-rose-700 font-semibold block">To Cancel</span>
                            <span className="text-base font-bold text-rose-700">{eligibleForCancel.length}</span>
                        </div>
                        <div className="bg-gray-100 border border-gray-300 rounded-lg p-2.5 text-center">
                            <span className="text-xs text-gray-600 block">Already Cancelled</span>
                            <span className="text-base font-bold text-gray-700">{alreadyCancelledForCancel.length}</span>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-center">
                            <span className="text-xs text-amber-700 block">To Be Skipped</span>
                            <span className="text-base font-bold text-amber-700">{skippedForCancel.length}</span>
                        </div>
                    </div>

                    {/* Informative text */}
                    <div className="bg-rose-50/80 border border-rose-200 rounded-lg p-3 text-xs text-rose-950 mb-4">
                        <p className="font-semibold mb-1">
                            {eligibleForCancel.length} order{eligibleForCancel.length === 1 ? '' : 's'} will be cancelled.
                            {skippedForCancel.length > 0 && ` ${skippedForCancel.length} already cancelled order${skippedForCancel.length === 1 ? '' : 's'} will be skipped.`}
                        </p>
                        <p className="text-rose-800">
                            Inventory stock will be restored for all affected items, and individual cancellation emails will be sent to customers.
                        </p>
                    </div>

                    {/* Eligible orders list */}
                    {eligibleForCancel.length > 0 && (
                        <div className="mb-3">
                            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                Orders to be Cancelled ({eligibleForCancel.length}):
                            </p>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-gray-50 border border-gray-200 rounded-lg">
                                {eligibleForCancel.map(o => (
                                    <span key={o.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                        <XCircle className="w-3 h-3 text-rose-600" />
                                        <span>{o.order_number || (o as any).orderNumber || `ORD-${o.id}`}</span>
                                        <span className="text-[10px] opacity-75 capitalize">({o.status})</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Skipped orders list */}
                    {skippedForCancel.length > 0 && (
                        <div className="mb-3">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                Orders to be Skipped ({skippedForCancel.length}):
                            </p>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-gray-50 border border-gray-200 rounded-lg">
                                {skippedForCancel.map(o => (
                                    <span key={o.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-white text-gray-600 border border-gray-300">
                                        <span>{o.order_number || (o as any).orderNumber || `ORD-${o.id}`}</span>
                                        <span className="text-[10px] text-gray-400 capitalize">({o.status})</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Reason input */}
                    <div className="mb-5">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                            Cancellation Reason (Optional):
                        </label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {['Customer requested cancellation', 'Items out of stock', 'Delivery address unserviceable', 'Bulk cancelled by store admin'].map(preset => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setBulkCancelReason(preset)}
                                    className={`px-2.5 py-1 text-xs rounded-full border transition cursor-pointer ${bulkCancelReason === preset ? 'bg-rose-50 border-rose-300 text-rose-700 font-semibold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                        <textarea
                            value={bulkCancelReason}
                            onChange={(e) => setBulkCancelReason(e.target.value)}
                            placeholder="Enter cancellation reason for customer notification..."
                            rows={2}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => setShowBulkCancelModal(false)}
                            disabled={isBulkProcessing}
                            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleBulkCancel}
                            disabled={isBulkProcessing || eligibleForCancel.length === 0}
                            className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-sm flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
                        >
                            {isBulkProcessing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Cancelling...</span>
                                </>
                            ) : (
                                <>
                                    <XCircle className="w-4 h-4" />
                                    <span>Cancel {eligibleForCancel.length} Order{eligibleForCancel.length === 1 ? '' : 's'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Single Create Delhivery Shipment Modal */}
            {shipmentOrderId && (
                <CreateShipmentModal
                    isOpen={showCreateShipment}
                    onClose={() => {
                        setShowCreateShipment(false);
                        setShipmentOrderId(null);
                        setShipmentOrderNumber('');
                    }}
                    orderId={shipmentOrderId}
                    orderNumber={shipmentOrderNumber}
                    onSuccess={() => {
                        fetchOrders();
                        fetchOrderStats();
                        showToastMessage('Shipment created successfully!', 'success');
                    }}
                />
            )}

            {/* Bulk Create Delhivery Shipments Modal */}
            <BulkCreateShipmentModal
                isOpen={showBulkShipmentModal}
                onClose={() => setShowBulkShipmentModal(false)}
                selectedOrders={selectedOrdersList}
                onSuccess={() => {
                    fetchOrders();
                    fetchOrderStats();
                    setSelectedOrderIds([]);
                    showToastMessage('Bulk shipment creation completed successfully!', 'success');
                }}
            />

            {/* Toast Notification */}
            {showToast && toastMessage && (
                <div className={`fixed top-6 right-6 z-[9999] px-6 py-4 rounded-lg shadow-lg font-semibold transition-all border ${toastType === 'success'
                    ? 'bg-green-100 text-green-800 border-green-200'
                    : 'bg-red-100 text-red-800 border-red-200'
                    }`}>
                    {toastMessage}
                </div>
            )}
        </div>
    );
}

export default function OrdersPage() {
    return (
        <Suspense fallback={<div className="p-6 text-center text-gray-500">Loading orders...</div>}>
            <OrdersContent />
        </Suspense>
    );
}
