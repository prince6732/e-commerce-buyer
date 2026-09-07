"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/(sheared)/ProtectedRoute";
import {
  TrendingUp,
  TrendingDown,
  Tag,
  RotateCcw,
  ShoppingBag,
  ArrowUpRight,
  RefreshCw,
  Percent,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  Layers,
  BarChart3,
  CreditCard,
  FileSpreadsheet,
  Package,
} from "lucide-react";
import { FaRupeeSign } from "react-icons/fa";
import {
  DashboardStatistics,
  DashboardFilterParams,
  getDashboardStatistics,
} from "../../../../../utils/dashboardApi";
import DashboardFilters from "@/components/(dashboards)/DashboardFilters";
import DashboardRevenueChart from "@/components/(dashboards)/DashboardRevenueChart";

export default function SalesSummaryPage() {
  const [stats, setStats] = useState<DashboardStatistics["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters state
  const [filters, setFilters] = useState<DashboardFilterParams>({
    period: "30days",
    status: "all",
    paymentMethod: "all",
  });

  useEffect(() => {
    fetchStatistics(filters);
  }, []);

  const fetchStatistics = async (paramsToUse?: DashboardFilterParams) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getDashboardStatistics(paramsToUse || filters);
      setStats(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load sales and financial statistics");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFilters = (newFilters: DashboardFilterParams) => {
    setFilters(newFilters);
    fetchStatistics(newFilters);
  };

  const handleResetFilters = () => {
    const reset = { period: "30days", status: "all", paymentMethod: "all" };
    setFilters(reset);
    fetchStatistics(reset);
  };

  const formatCurrency = (val: number | string | undefined | null) => {
    const num = Number(val);
    if (isNaN(num)) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num || 0);
  };

  if (error) {
    return (
      <ProtectedRoute role="Admin">
        <div className="p-6">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-900 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">Unable to load financial data</h3>
              <p className="text-sm text-rose-700 mt-1">{error}</p>
            </div>
            <button
              onClick={() => fetchStatistics()}
              className="px-4 py-2 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const overview = stats?.overview;
  const discounts = stats?.discounts;
  const refunds = stats?.refunds;
  const cancellations = stats?.cancellations;
  const payments = stats?.payments;
  const categories = stats?.category_performance;
  const topProducts = stats?.charts?.top_products || [];

  // Computed Financial Metrics
  const grossSales = discounts?.gross_sales || overview?.monthly_revenue || 0;
  const totalDiscount = discounts?.total_discount_amount || 0;
  const refundAmount = refunds?.amount || 0;
  const cancelledAmount = cancellations?.amount || 0;
  const netSales = overview?.monthly_revenue || 0;
  const todayRevenue = overview?.today_revenue || 0;
  const revenueGrowth = overview?.revenue_growth || 0;

  // Payments Metrics
  const online = payments?.online || { total: 0, successful: 0, pending: 0, failed: 0, success_rate: 100, successful_amount: 0, failed_amount: 0 };
  const cod = payments?.cod || { total: 0, collected: 0, pending: 0, success_rate: 100 };
  const successfulPaidCount = (online.successful || 0) + (cod.collected || 0);
  const failedPaymentsCount = online.failed || 0;

  // Retention Rate %: (Net Sales / Gross Sales) * 100
  const netRetentionRate = grossSales > 0 ? Math.min(100, Math.max(0, Math.round((netSales / grossSales) * 100))) : 100;
  const discountShare = grossSales > 0 ? Math.min(100, Math.round((totalDiscount / grossSales) * 100)) : 0;
  const refundShare = grossSales > 0 ? Math.min(100, Math.round((refundAmount / grossSales) * 100)) : 0;

  return (
    <ProtectedRoute role="Admin">
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* 1. Header with Quick Action Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <FaRupeeSign className="w-6 h-6 text-emerald-600" />
                Financial & Sales Analytics
              </h1>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                Audited Summary
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Comprehensive revenue stream breakdown, discounts, returns, deductions, and payment channels
            </p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto scrollHide">
            <Link
              href="/dashboard/gst-report"
              className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#007FFF] text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> GST Sales Report
            </Link>
            <Link
              href="/dashboard/orders"
              className="px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <ShoppingBag className="w-3.5 h-3.5" /> All Orders
            </Link>
            <button
              onClick={() => fetchStatistics()}
              disabled={isLoading}
              className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all cursor-pointer"
              title="Refresh Sales Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* 2. Global Filter Toolbar */}
        <DashboardFilters
          filters={filters}
          onApplyFilters={handleApplyFilters}
          onResetFilters={handleResetFilters}
          isLoading={isLoading}
        />

        {isLoading && !stats ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-28 bg-gray-200 animate-pulse rounded-2xl" />
              ))}
            </div>
            <div className="h-64 bg-gray-200 animate-pulse rounded-2xl" />
          </div>
        ) : stats ? (
          <>
            {/* 3. Top Financial KPIs Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
              {/* Gross Sales */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-xl bg-gray-100 text-gray-700">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase bg-gray-50 px-1.5 py-0.5 rounded-md">
                    Total
                  </span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-gray-500">Gross Sales</p>
                  <p className="text-xl font-extrabold text-gray-900 mt-0.5">{formatCurrency(grossSales)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Pre-discount order value</p>
                </div>
              </div>

              {/* Discounts */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-xl bg-purple-100 text-purple-600">
                    <Tag className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-md">
                    -{discounts?.discount_percentage || 0}%
                  </span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-gray-500">Total Discounts</p>
                  <p className="text-xl font-extrabold text-purple-700 mt-0.5">-{formatCurrency(totalDiscount)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{discounts?.orders_with_discount_count || 0} orders discounted</p>
                </div>
              </div>

              {/* Refunds */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-xl bg-rose-100 text-rose-600">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-md">
                    {refunds?.count || 0} Cases
                  </span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-gray-500">Refunds Issued</p>
                  <p className="text-xl font-extrabold text-rose-700 mt-0.5">-{formatCurrency(refundAmount)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{refunds?.pending || 0} pending review</p>
                </div>
              </div>

              {/* Net Sales Revenue */}
              <div className="bg-gradient-to-br from-[#007FFF] to-[#0055CC] rounded-2xl p-4 text-white shadow-blue-500/10 shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md">
                    <FaRupeeSign className="w-4 h-4 text-white" />
                  </div>
                  <span className="flex items-center gap-0.5 text-[10px] font-bold bg-white/20 backdrop-blur-md px-1.5 py-0.5 rounded-full text-white">
                    {revenueGrowth >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    {revenueGrowth >= 0 ? "+" : ""}{revenueGrowth}%
                  </span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-white/80 uppercase tracking-wider">Net Sales</p>
                  <p className="text-xl font-extrabold text-white mt-0.5">{formatCurrency(netSales)}</p>
                  <p className="text-[10px] text-white/80 mt-0.5">Retained Revenue</p>
                </div>
              </div>

              {/* Today's Revenue */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                    Today
                  </span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-gray-500">Today&apos;s Revenue</p>
                  <p className="text-xl font-extrabold text-gray-900 mt-0.5">{formatCurrency(todayRevenue)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Paid & completed today</p>
                </div>
              </div>

              {/* Total Orders */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-xl bg-blue-100 text-blue-600">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">
                    {stats.orders?.delivered || 0} Delivered
                  </span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-gray-500">Total Orders</p>
                  <p className="text-xl font-extrabold text-gray-900 mt-0.5">{(overview?.total_orders || 0).toLocaleString("en-IN")}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">In selected period</p>
                </div>
              </div>

              {/* Successful Paid */}
              <Link
                href="/dashboard/orders?paymentStatus=paid"
                className="bg-emerald-50/50 hover:bg-emerald-100/70 rounded-2xl p-4 border border-emerald-200/80 shadow-2xs flex flex-col justify-between transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                    <span>Successful Paid</span>
                  </div>
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xl font-extrabold text-emerald-950 mt-0.5">{successfulPaidCount}</p>
                  <p className="text-[11px] font-medium text-emerald-700 mt-0.5">Verified Collections</p>
                </div>
              </Link>

              {/* Failed Payments */}
              <Link
                href="/dashboard/orders?paymentStatus=failed"
                className="bg-rose-50/50 hover:bg-rose-100/70 rounded-2xl p-4 border border-rose-200/80 shadow-2xs flex flex-col justify-between transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                    <span>Failed Payments</span>
                  </div>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <p className="text-xl font-extrabold text-rose-950 mt-0.5">{failedPaymentsCount}</p>
                  <p className="text-[11px] font-medium text-rose-700 mt-0.5">Requires Customer Support</p>
                </div>
              </Link>
            </div>

            {/* 4. Gross-to-Net Revenue Bridge Bar */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Gross to Net Revenue Bridge</h3>
                  <p className="text-xs text-gray-500">How gross order volume transitions to realized net store revenue</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 font-bold text-gray-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#007FFF]" /> Net Realized ({netRetentionRate}%)
                  </span>
                  <span className="flex items-center gap-1.5 font-bold text-gray-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Discounts ({discountShare}%)
                  </span>
                  <span className="flex items-center gap-1.5 font-bold text-gray-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Refunds ({refundShare}%)
                  </span>
                </div>
              </div>

              {/* Progress Bar Bridge */}
              <div className="space-y-2">
                <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${netRetentionRate}%` }}
                    className="bg-[#007FFF] h-full transition-all duration-500"
                    title={`Net Revenue: ${formatCurrency(netSales)} (${netRetentionRate}%)`}
                  />
                  <div
                    style={{ width: `${discountShare}%` }}
                    className="bg-purple-500 h-full transition-all duration-500"
                    title={`Discounts: ${formatCurrency(totalDiscount)} (${discountShare}%)`}
                  />
                  <div
                    style={{ width: `${refundShare}%` }}
                    className="bg-rose-500 h-full transition-all duration-500"
                    title={`Refunds: ${formatCurrency(refundAmount)} (${refundShare}%)`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-[11px] font-semibold text-gray-500">1. Gross Order Volume</p>
                    <p className="text-base font-extrabold text-gray-900">{formatCurrency(grossSales)}</p>
                    <p className="text-[10px] text-gray-400">100% of order totals</p>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100">
                    <p className="text-[11px] font-semibold text-purple-700">2. Less Discounts</p>
                    <p className="text-base font-extrabold text-purple-900">-{formatCurrency(totalDiscount)}</p>
                    <p className="text-[10px] text-purple-600">{discountShare}% of gross sales</p>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100">
                    <p className="text-[11px] font-semibold text-rose-700">3. Less Refunds & Returns</p>
                    <p className="text-base font-extrabold text-rose-900">-{formatCurrency(refundAmount)}</p>
                    <p className="text-[10px] text-rose-600">{refundShare}% of gross sales</p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100">
                    <p className="text-[11px] font-semibold text-blue-700">4. Realized Net Revenue</p>
                    <p className="text-base font-extrabold text-blue-900">{formatCurrency(netSales)}</p>
                    <p className="text-[10px] text-blue-600">{netRetentionRate}% realization rate</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Revenue Timeline & Trends Chart */}
            <DashboardRevenueChart data={stats} />

            {/* 6. In-depth Detailed Analysis Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment Methods & Collection Channels */}
              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                      Payment Overview & Collection Channels
                    </h3>
                    <p className="text-xs text-gray-500">Cashfree PG vs Cash on Delivery and verified payments breakdown</p>
                  </div>
                  <Link
                    href="/dashboard/orders"
                    className="text-xs font-bold text-[#007FFF] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    All Payments &rarr;
                  </Link>
                </div>

                {/* 4 Cards Grid - Matches user screenshot exactly */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {/* Cashfree Online */}
                  <Link
                    href="/dashboard/orders?paymentMethod=online"
                    className="p-3 rounded-xl bg-blue-50/50 hover:bg-blue-100/70 border border-blue-100 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                      <span>Cashfree Online</span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-md font-extrabold">PG</span>
                    </div>
                    <div>
                      <p className="text-base font-extrabold text-gray-900 mt-1">{formatCurrency(online.total)}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{online.successful} Successful</p>
                    </div>
                  </Link>

                  {/* COD Orders */}
                  <Link
                    href="/dashboard/orders?paymentMethod=cash_on_delivery"
                    className="p-3 rounded-xl bg-blue-50/50 hover:bg-blue-100/70 border border-blue-100 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                      <span>COD Orders</span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-md font-extrabold">COD</span>
                    </div>
                    <div>
                      <p className="text-base font-extrabold text-gray-900 mt-1">{formatCurrency(cod.total)}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{cod.collected} Collected</p>
                    </div>
                  </Link>

                  {/* Successful Paid - EXACT as in screenshot */}
                  <Link
                    href="/dashboard/orders?paymentStatus=paid"
                    className="p-3 rounded-xl bg-emerald-50/50 hover:bg-emerald-100/70 border border-emerald-100 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-center text-xs font-bold text-emerald-800">
                      <span>Successful Paid</span>
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-base font-extrabold text-emerald-950 mt-1">{successfulPaidCount}</p>
                      <p className="text-[10px] text-emerald-700 mt-0.5">Verified Collections</p>
                    </div>
                  </Link>

                  {/* Failed Payments - EXACT as in screenshot */}
                  <Link
                    href="/dashboard/orders?paymentStatus=failed"
                    className="p-3 rounded-xl bg-rose-50/50 hover:bg-rose-100/70 border border-rose-100 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-center text-xs font-bold text-rose-800">
                      <span>Failed Payments</span>
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    </div>
                    <div>
                      <p className="text-base font-extrabold text-rose-950 mt-1">{failedPaymentsCount}</p>
                      <p className="text-[10px] text-rose-700 mt-0.5">Requires Customer Support</p>
                    </div>
                  </Link>
                </div>

                {/* Extended breakdown details */}
                <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                  <div className="text-[11px] text-gray-600 space-y-1 p-2.5 rounded-xl bg-gray-50/60 border border-gray-100">
                    <div className="flex justify-between font-medium">
                      <span>Online Successful Revenue:</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(payments?.online?.successful_amount || 0)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Online Failed / Dropped:</span>
                      <span className="font-bold text-rose-600">{formatCurrency(payments?.online?.failed_amount || 0)}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-600 space-y-1 p-2.5 rounded-xl bg-gray-50/60 border border-gray-100">
                    <div className="flex justify-between font-medium">
                      <span>COD Doorstep Collected:</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(payments?.cod?.collected || 0)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>COD In-Transit / Pending:</span>
                      <span className="font-bold text-amber-700">{formatCurrency(payments?.cod?.pending || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Deductions: Discounts & Cancellations */}
              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <Percent className="w-5 h-5 text-purple-600" />
                      Promotions & Deductions Analysis
                    </h3>
                    <p className="text-xs text-gray-500">Impact of discounts, customer cancellations, and returns</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Discounts Detail */}
                  <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-900">Discounts & Offers</span>
                      <Tag className="w-3.5 h-3.5 text-purple-500" />
                    </div>
                    <p className="text-lg font-black text-purple-950">-{formatCurrency(totalDiscount)}</p>
                    <div className="text-[11px] text-gray-600 space-y-1 pt-1 border-t border-purple-100">
                      <div className="flex justify-between">
                        <span>Discounted Orders:</span>
                        <span className="font-bold">{discounts?.orders_with_discount_count || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg Discount / Order:</span>
                        <span className="font-bold">{formatCurrency(discounts?.average_discount_per_order || 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Cancellations & Returns Detail */}
                  <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-900">Cancellations & Returns</span>
                      <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                    </div>
                    <p className="text-lg font-black text-rose-950">-{formatCurrency(refundAmount + cancelledAmount)}</p>
                    <div className="text-[11px] text-gray-600 space-y-1 pt-1 border-t border-rose-100">
                      <div className="flex justify-between">
                        <span>Cancellation Rate:</span>
                        <span className="font-bold text-rose-600">{cancellations?.rate || 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Return Rate:</span>
                        <span className="font-bold text-rose-600">{stats?.returns?.rate || 0}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 7. Category Revenue Contribution Breakdown */}
            {categories && categories.categories && categories.categories.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-indigo-600" />
                      Category Sales & Revenue Distribution
                    </h3>
                    <p className="text-xs text-gray-500">Sales volume and gross revenue generated per category</p>
                  </div>
                  <Link
                    href="/dashboard/categories"
                    className="text-xs font-bold text-[#007FFF] hover:underline flex items-center gap-1"
                  >
                    Manage Categories &rarr;
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.categories.map((cat) => (
                    <div key={cat.id} className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-gray-100/60 transition-colors space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 truncate">{cat.name}</span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                          {cat.revenue_percentage}% Share
                        </span>
                      </div>

                      <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(5, cat.revenue_percentage))}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-600 pt-1">
                        <span>{cat.units_sold} units sold ({cat.orders_count} orders)</span>
                        <span className="font-extrabold text-gray-900">{formatCurrency(cat.revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 8. Top Revenue Generating Products */}
            {topProducts.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <Package className="w-5 h-5 text-emerald-600" />
                      Top Revenue Products
                    </h3>
                    <p className="text-xs text-gray-500">Highest grossing inventory items in selected period</p>
                  </div>
                  <Link
                    href="/dashboard/products"
                    className="text-xs font-bold text-[#007FFF] hover:underline flex items-center gap-1"
                  >
                    View All Products &rarr;
                  </Link>
                </div>

                <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0 scrollbar">
                  <table className="w-full min-w-[600px] text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase">
                        <th className="py-2.5 px-3">Rank</th>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-center">Units Sold</th>
                        <th className="py-2.5 px-3 text-right">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs font-medium">
                      {topProducts.map((p, idx) => (
                        <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                              idx === 0 ? "bg-amber-100 text-amber-800" :
                              idx === 1 ? "bg-gray-200 text-gray-800" :
                              idx === 2 ? "bg-amber-50 text-amber-900" : "text-gray-500"
                            }`}>
                              #{idx + 1}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-bold text-gray-900">{p.name}</p>
                            {p.stock !== undefined && (
                              <p className="text-[10px] text-gray-400">{p.stock} units remaining in stock</p>
                            )}
                          </td>
                          <td className="py-3 px-3 text-gray-600">
                            {p.category || "General"}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-gray-800">
                            {p.total_sold}
                          </td>
                          <td className="py-3 px-3 text-right font-black text-gray-900">
                            {formatCurrency(p.total_revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </ProtectedRoute>
  );
}
