"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProtectedRoute from "@/components/(sheared)/ProtectedRoute";
import { useAddProductModal } from "@/context/AddProductModalContext";
import {
  ShoppingBag,
  CreditCard,
  Search,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import {
  DashboardStatistics,
  DashboardFilterParams,
  getDashboardStatistics
} from '../../../../utils/dashboardApi';
import DashboardFilters from '@/components/(dashboards)/DashboardFilters';
import DashboardKpiCards from '@/components/(dashboards)/DashboardKpiCards';
import DashboardStatusOverview from '@/components/(dashboards)/DashboardStatusOverview';
import DashboardActionRequired from '@/components/(dashboards)/DashboardActionRequired';
import DashboardTabs, { DashboardTabType } from '@/components/(dashboards)/DashboardTabs';
import DashboardShippingView from '@/components/(dashboards)/DashboardShippingView';
import DashboardReturnsView from '@/components/(dashboards)/DashboardReturnsView';
import DashboardCategoriesView from '@/components/(dashboards)/DashboardCategoriesView';
import DashboardDiscountsView from '@/components/(dashboards)/DashboardDiscountsView';
import DashboardShippingOverview from '@/components/(dashboards)/DashboardShippingOverview';

export default function DashboardPage() {
  const { openAddProductModal } = useAddProductModal();
  const [stats, setStats] = useState<DashboardStatistics['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Dashboard filter & tab states
  const [filters, setFilters] = useState<DashboardFilterParams>({ period: '30days', status: 'all', paymentMethod: 'all' });
  const [activeTab, setActiveTab] = useState<DashboardTabType>('overview');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

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
      setError(err.response?.data?.message || 'Failed to load dashboard statistics');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFilters = (newFilters: DashboardFilterParams) => {
    setFilters(newFilters);
    fetchStatistics(newFilters);
  };

  const handleResetFilters = () => {
    const reset = { period: '30days', status: 'all', paymentMethod: 'all' };
    setFilters(reset);
    fetchStatistics(reset);
  };

  const formatCurrency = (amount: number | string) => {
    const val = Number(amount);
    if (isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800 border-amber-300',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
      processing: 'bg-sky-100 text-sky-800 border-sky-300',
      shipped: 'bg-purple-100 text-purple-800 border-purple-300',
      out_for_delivery: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      delivered: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      completed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      cancelled: 'bg-rose-100 text-rose-800 border-rose-300',
    };
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Filtered orders for Recent Orders search
  const filteredLatestOrders = (stats?.latest_orders || []).filter((o) => {
    if (!orderSearchQuery.trim()) return true;
    const q = orderSearchQuery.toLowerCase();
    const oNum = (o.order_id || o.order_number || '').toLowerCase();
    const cName = (o.customer_name || '').toLowerCase();
    const cEmail = (o.customer_email || '').toLowerCase();
    return oNum.includes(q) || cName.includes(q) || cEmail.includes(q);
  });

  if (error) {
    return (
      <ProtectedRoute role="Admin">
        <div className="p-6">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-900 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">Unable to load dashboard data</h3>
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

  return (
    <ProtectedRoute role="Admin">
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">

        {/* 1. Header Quick Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Store Command Center</h1>
              <span className="text-xs bg-blue-100 text-[#007FFF] font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
                Live Data
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Monitor store performance, orders, inventory, and customer activity
            </p>
          </div>

          {/* Quick Nav Shortcuts */}
          <div className="flex items-center gap-2 overflow-x-auto scrollHide">
            <button
              type="button"
              onClick={openAddProductModal}
              className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#007FFF] text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              + Add Product
            </button>
            <Link
              href="/dashboard/orders"
              className="px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <ShoppingBag className="w-3.5 h-3.5" /> View Orders
            </Link>
            <Link
              href="/dashboard/categories"
              className="px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              + Category
            </Link>
            <button
              onClick={() => fetchStatistics()}
              disabled={isLoading}
              className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all cursor-pointer"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
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

        {/* Loading Skeleton */}
        {isLoading && !stats ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3 lg:gap-3.5">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-28 bg-gray-200 animate-pulse rounded-2xl" />
              ))}
            </div>
            <div className="h-64 bg-gray-200 animate-pulse rounded-2xl" />
          </div>
        ) : stats ? (
          <>
            {/* 3. KPI Summary Grid */}
            <DashboardKpiCards data={stats} onSelectTab={setActiveTab} />

            {/* 4. Shipping Logistics Overview */}
            <div className="my-6">
              <DashboardShippingOverview shipping={stats.shipping} onSelectTab={setActiveTab} />
            </div>

            {/* 6. Action Required Alerts */}
            <DashboardActionRequired items={stats.action_required || []} />

            {/* 7. Clickable Order Status Pipeline */}
            <DashboardStatusOverview orders={stats.orders} />

            {/* 8. Segmented Analytics Tabs */}
            <DashboardTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              counts={{
                orders: stats.overview.total_orders,
                products: stats.overview.total_products,
                inventoryAlerts: (stats.inventory.low_stock || 0) + (stats.inventory.out_of_stock || 0),
                pendingAction: stats.action_required?.length || 0,
              }}
            />

            {/* TAB CONTENT: Overview / Default */}
            {(activeTab === 'overview' || activeTab === 'orders' || activeTab === 'sales') && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left 2 Cols: Searchable Recent Orders Table */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-4 md:p-5 border border-gray-200 shadow-xs flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Recent Orders</h3>
                        <p className="text-xs text-gray-500">Latest customer order transactions</p>
                      </div>

                      {/* Table Search input */}
                      <div className="relative min-w-[200px]">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search order ID or customer..."
                          value={orderSearchQuery}
                          onChange={(e) => setOrderSearchQuery(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-[#007FFF]"
                        />
                      </div>
                    </div>

                    {/* Table with horizontal scroll on mobile */}
                    <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0 pb-2 scrollbar">
                      <table className="w-full min-w-[600px] text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase">
                            <th className="py-2.5 px-3">Order</th>
                            <th className="py-2.5 px-3">Customer</th>
                            <th className="py-2.5 px-3">Payment</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Amount</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs font-medium">
                          {filteredLatestOrders.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-gray-500">
                                No orders found matching "{orderSearchQuery}".
                              </td>
                            </tr>
                          ) : (
                            filteredLatestOrders.map((o) => (
                              <tr key={o.id} className="hover:bg-gray-50/80 transition-colors">
                                <td className="py-3 px-3">
                                  <p className="font-bold text-gray-900">{o.order_id || o.order_number}</p>
                                  <p className="text-[10px] text-gray-400">{formatDate(o.created_at)}</p>
                                </td>
                                <td className="py-3 px-3">
                                  <p className="font-semibold text-gray-800">{o.customer_name}</p>
                                  <p className="text-[10px] text-gray-400 truncate max-w-[120px]">{o.customer_email}</p>
                                </td>
                                <td className="py-3 px-3">
                                  <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 whitespace-nowrap">
                                    {o.payment_method || 'online'}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${getStatusColor(o.status)}`}>
                                    {o.status}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-right font-bold text-gray-900 whitespace-nowrap">
                                  {formatCurrency(o.total_amount ?? o.total ?? 0)}
                                </td>
                                <td className="py-3 px-3 text-right whitespace-nowrap">
                                  <Link
                                    href="/dashboard/orders"
                                    className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#007FFF] inline-flex items-center gap-1 font-bold text-[11px] transition-all"
                                  >
                                    View <ArrowUpRight className="w-3 h-3" />
                                  </Link>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                    <span>Showing latest {filteredLatestOrders.length} orders</span>
                    <Link href="/dashboard/orders" className="font-bold text-[#007FFF] hover:underline">
                      Go to Order Management &rarr;
                    </Link>
                  </div>
                </div>

                {/* Right Col: Top Selling Products & Store Insights */}
                <div className="space-y-4 min-w-0">

                  {/* Top Selling Products Card */}
                  <div className="bg-white rounded-2xl p-4 md:p-5 border border-gray-200 shadow-xs">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                      <div>
                        <h3 className="text-sm md:text-base font-bold text-gray-900">Top Selling Products</h3>
                        <p className="text-xs text-gray-500">Best performers by sales volume</p>
                      </div>
                      <Link href="/dashboard/products" className="text-xs font-bold text-[#007FFF] hover:underline">
                        View All
                      </Link>
                    </div>

                    <div className="space-y-2 overflow-x-auto">
                      {(stats.charts.top_products || []).slice(0, 5).map((prod, idx) => (
                        <div key={prod.id || idx} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 min-w-0">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="w-5 text-center text-xs font-black text-gray-400 flex-shrink-0">#{idx + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-gray-900 truncate" title={prod.name}>{prod.name}</p>
                              <p className="text-[10px] text-gray-500">{prod.total_sold} units sold</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <p className="text-xs font-bold text-emerald-600 whitespace-nowrap">{formatCurrency(prod.total_revenue)}</p>
                            <p className="text-[10px] text-gray-400">Rev</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Store Insights Card */}
                  <div className="bg-gradient-to-br from-gray-900 to-slate-800 text-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-800">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-700">
                      <Sparkles className="w-4 h-4 text-[#007FFF] flex-shrink-0" />
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-400">Automated Store Insights</h3>
                    </div>
                    <ul className="space-y-2 text-xs font-medium text-gray-300 overflow-x-auto">
                      {(stats.store_insights || []).map((insight, idx) => (
                        <li key={idx} className="flex items-start gap-2 bg-gray-800/60 p-2 rounded-xl break-words min-w-0">
                          <span className="break-words min-w-0">{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>
              </div>
            )}

            {/* TAB CONTENT: Products / Inventory */}
            {(activeTab === 'products' || activeTab === 'inventory') && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Low Stock Warning Panel */}
                <div className="bg-white rounded-2xl p-5 border border-amber-200 shadow-xs">
                  <div className="flex items-center justify-between mb-4 border-b border-amber-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Low Stock Products</h3>
                        <p className="text-xs text-gray-500">Items with 5 or fewer remaining units</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {stats.inventory.low_stock} Items
                    </span>
                  </div>

                  {(!stats.inventory.low_stock_products || stats.inventory.low_stock_products.length === 0) ? (
                    <p className="text-xs text-gray-500 text-center py-6">No products currently low in stock.</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.inventory.low_stock_products.map((item) => (
                        <div key={item.variant_id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50/50 border border-amber-100">
                          <div>
                            <p className="text-xs font-bold text-gray-900">{item.name}</p>
                            <p className="text-[10px] text-gray-500">SKU: {item.sku}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg">
                              {item.stock} in stock
                            </span>
                            <Link href="/dashboard/products?tab=low-stock" className="text-xs font-bold text-[#007FFF] hover:underline">
                              Restock
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Out of Stock Alert Panel */}
                <div className="bg-white rounded-2xl p-5 border border-rose-200 shadow-xs">
                  <div className="flex items-center justify-between mb-4 border-b border-rose-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Out of Stock Products</h3>
                        <p className="text-xs text-gray-500">Items with 0 inventory available</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
                      {stats.inventory.out_of_stock} Items
                    </span>
                  </div>

                  {(!stats.inventory.out_of_stock_products || stats.inventory.out_of_stock_products.length === 0) ? (
                    <p className="text-xs text-gray-500 text-center py-6">No products completely out of stock.</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.inventory.out_of_stock_products.map((item) => (
                        <div key={item.variant_id} className="flex items-center justify-between p-3 rounded-xl bg-rose-50/50 border border-rose-100">
                          <div>
                            <p className="text-xs font-bold text-gray-900">{item.name}</p>
                            <p className="text-[10px] text-gray-500">SKU: {item.sku}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-lg">
                              0 Units
                            </span>
                            <Link href="/dashboard/products?tab=out-of-stock" className="text-xs font-bold text-rose-600 hover:underline">
                              Update Stock
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB CONTENT: Customers */}
            {activeTab === 'customers' && (
              <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs">
                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Recent Registered Customers</h3>
                    <p className="text-xs text-gray-500">Newly registered verified users</p>
                  </div>
                  <Link href="/dashboard/users" className="text-xs font-bold text-[#007FFF] hover:underline">
                    View All Users &rarr;
                  </Link>
                </div>

                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full min-w-[420px] text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase">
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3 text-right">Joined Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs font-medium">
                      {(stats.recent_users || []).map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-3 flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-[#007FFF] font-bold flex items-center justify-center text-xs">
                              {u.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <span className="font-bold text-gray-900">{u.name}</span>
                          </td>
                          <td className="py-3 px-3 text-gray-600">{u.email}</td>
                          <td className="py-3 px-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                              {u.role || 'Customer'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right text-gray-500">{formatDate(u.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Payments */}
            {activeTab === 'payments' && (
              <div className="grid md:grid-cols-2 gap-6">

                {/* Online Payment Card */}
                <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs">
                  <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-100 text-[#007FFF] rounded-xl">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Cashfree Online Payments</h3>
                        <p className="text-xs text-gray-500">Digital transactions via PG</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 rounded-xl bg-gray-50">
                      <span className="text-xs font-semibold text-gray-600">Total Volume:</span>
                      <span className="text-base font-extrabold text-gray-900">{formatCurrency(stats.payments?.online?.total || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-50 text-emerald-800">
                      <span className="text-xs font-semibold">Successful Paid Orders:</span>
                      <span className="text-sm font-bold">{stats.payments?.online?.successful || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-amber-50 text-amber-800">
                      <span className="text-xs font-semibold">Pending Gateway Orders:</span>
                      <span className="text-sm font-bold">{stats.payments?.online?.pending || 0}</span>
                    </div>
                  </div>
                </div>

                {/* COD Payment Card */}
                <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs">
                  <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Cash on Delivery (COD)</h3>
                        <p className="text-xs text-gray-500">Doorstep payment collection</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 rounded-xl bg-gray-50">
                      <span className="text-xs font-semibold text-gray-600">Total Volume:</span>
                      <span className="text-base font-extrabold text-gray-900">{formatCurrency(stats.payments?.cod?.total || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-50 text-emerald-800">
                      <span className="text-xs font-semibold">Collected Orders (Delivered):</span>
                      <span className="text-sm font-bold">{stats.payments?.cod?.collected || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-sky-50 text-sky-800">
                      <span className="text-xs font-semibold">Pending Delivery Collection:</span>
                      <span className="text-sm font-bold">{stats.payments?.cod?.pending || 0}</span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* TAB CONTENT: Shipping */}
            {activeTab === 'shipping' && (
              <DashboardShippingView shipping={stats.shipping} />
            )}

            {/* TAB CONTENT: Returns & Refunds */}
            {activeTab === 'returns' && (
              <DashboardReturnsView
                refunds={stats.refunds}
                returns={stats.returns}
                cancellations={stats.cancellations}
              />
            )}

            {/* TAB CONTENT: Categories */}
            {activeTab === 'categories' && (
              <DashboardCategoriesView categoryPerformance={stats.category_performance} />
            )}

            {/* TAB CONTENT: Discounts */}
            {activeTab === 'discounts' && (
              <DashboardDiscountsView discounts={stats.discounts} />
            )}

          </>
        ) : null}

      </div>
    </ProtectedRoute>
  );
}
