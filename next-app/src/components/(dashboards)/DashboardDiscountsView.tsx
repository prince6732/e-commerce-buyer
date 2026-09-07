"use client";

import { Tag } from 'lucide-react';
import { DashboardStatistics } from '../../../utils/dashboardApi';

interface DashboardDiscountsViewProps {
  discounts: DashboardStatistics['data']['discounts'];
}

export default function DashboardDiscountsView({ discounts }: DashboardDiscountsViewProps) {
  if (!discounts) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-violet-900 to-slate-900 text-white rounded-2xl p-6 shadow-sm border border-purple-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="w-6 h-6 text-purple-400" />
            <h2 className="text-xl font-bold tracking-tight">Discount & Coupon Analytics</h2>
          </div>
          <p className="text-xs text-purple-200 mt-1">
            Analyze gross sales vs net sales, promotional coupon usage, and discount margins
          </p>
        </div>

        <div className="flex items-center gap-6 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10">
          <div>
            <p className="text-[10px] font-bold text-purple-200 uppercase">Total Discount Savings</p>
            <p className="text-xl font-black text-amber-300">{formatCurrency(discounts.total_discount_amount)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-purple-200 uppercase">Avg Discount / Order</p>
            <p className="text-xl font-black text-purple-300">{formatCurrency(discounts.average_discount_per_order)}</p>
          </div>
        </div>
      </div>

      {/* Grid of 4 Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs">
          <p className="text-xs font-semibold text-gray-500">Gross Sales (Pre-Discount)</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{formatCurrency(discounts.gross_sales)}</p>
          <p className="text-[10px] text-gray-400 mt-1">Sum of subtotal before discounts</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs">
          <p className="text-xs font-semibold text-gray-500">Net Sales Revenue</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(discounts.net_sales)}</p>
          <p className="text-[10px] text-emerald-700 mt-1">Actual collected revenue</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs">
          <p className="text-xs font-semibold text-gray-500">Discounted Orders</p>
          <p className="text-2xl font-black text-purple-600 mt-1">{discounts.orders_with_discount_count}</p>
          <p className="text-[10px] text-purple-700 mt-1">Orders with price reduction</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs">
          <p className="text-xs font-semibold text-gray-500">Discount Margin %</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{discounts.discount_percentage}%</p>
          <p className="text-[10px] text-amber-700 mt-1">Discount vs Gross Sales ratio</p>
        </div>
      </div>

    </div>
  );
}
