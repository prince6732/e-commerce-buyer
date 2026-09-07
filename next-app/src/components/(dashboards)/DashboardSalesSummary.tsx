"use client";

import Link from 'next/link';
import { Tag, RotateCcw, ArrowUpRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { DashboardStatistics } from '../../../utils/dashboardApi';
import { FaRupeeSign } from 'react-icons/fa';

interface DashboardSalesSummaryProps {
  overview: DashboardStatistics['data']['overview'];
  discounts: DashboardStatistics['data']['discounts'];
  refunds: DashboardStatistics['data']['refunds'];
  payments?: DashboardStatistics['data']['payments'];
  onSelectTab: (tab: any) => void;
}

export default function DashboardSalesSummary({
  overview,
  discounts,
  refunds,
  payments,
  onSelectTab,
}: DashboardSalesSummaryProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const grossSales = discounts?.gross_sales || overview.monthly_revenue;
  const totalDiscount = discounts?.total_discount_amount || 0;
  const refundAmount = refunds?.amount || 0;
  const netSales = overview.monthly_revenue;
  const aov = overview.average_order_value;
  const aovGrowth = overview.aov_growth;

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FaRupeeSign className="w-5 h-5 text-emerald-600" />
            Financial & Sales Summary
          </h3>
          <p className="text-xs text-gray-500">Gross sales, discounts, refunds, and net store revenue</p>
        </div>
        <button
          onClick={() => onSelectTab('sales')}
          className="text-xs font-bold text-[#007FFF] hover:underline flex items-center gap-1 cursor-pointer"
        >
          Sales Analytics &rarr;
        </button>
      </div>

      <div className={`grid grid-cols-2 ${payments ? 'sm:grid-cols-3 lg:grid-cols-6' : 'sm:grid-cols-4'} gap-3`}>
        {/* Gross Sales */}
        <div
          onClick={() => onSelectTab('sales')}
          className="p-3 rounded-xl bg-gray-50 hover:bg-gray-100/80 transition-all cursor-pointer border border-gray-100 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-500">Gross Sales</span>
            <ArrowUpRight className="w-3 h-3 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5" />
          </div>
          <p className="text-base font-extrabold text-gray-900 mt-1">{formatCurrency(grossSales)}</p>
        </div>

        {/* Discounts */}
        <div
          onClick={() => onSelectTab('discounts')}
          className="p-3 rounded-xl bg-purple-50/60 hover:bg-purple-100/80 transition-all cursor-pointer border border-purple-100 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-purple-700">Discounts</span>
            <Tag className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <p className="text-base font-extrabold text-purple-900 mt-1">-{formatCurrency(totalDiscount)}</p>
        </div>

        {/* Refunds */}
        <div
          onClick={() => onSelectTab('returns')}
          className="p-3 rounded-xl bg-rose-50/60 hover:bg-rose-100/80 transition-all cursor-pointer border border-rose-100 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-700">Refunds</span>
            <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <p className="text-base font-extrabold text-rose-900 mt-1">-{formatCurrency(refundAmount)}</p>
        </div>

        {/* Net Sales */}
        <div
          onClick={() => onSelectTab('sales')}
          className="p-3 rounded-xl bg-emerald-50/60 hover:bg-emerald-100/80 transition-all cursor-pointer border border-emerald-100 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700">Net Sales</span>
            <ArrowUpRight className="w-3 h-3 text-emerald-600 group-hover:translate-x-0.5" />
          </div>
          <p className="text-base font-extrabold text-emerald-900 mt-1">{formatCurrency(netSales)}</p>
        </div>

        {/* Successful Paid */}
        {payments && (
          <Link
            href="/dashboard/orders?paymentStatus=paid"
            className="p-3 rounded-xl bg-emerald-50/50 hover:bg-emerald-100/70 border border-emerald-100 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex justify-between items-center text-xs font-bold text-emerald-800">
              <span>Successful Paid</span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div>
              <p className="text-base font-extrabold text-emerald-950 mt-1">
                {(payments.online?.successful || 0) + (payments.cod?.collected || 0)}
              </p>
              <p className="text-[10px] text-emerald-700 mt-0.5">Verified Collections</p>
            </div>
          </Link>
        )}

        {/* Failed Payments */}
        {payments && (
          <Link
            href="/dashboard/orders?paymentStatus=failed"
            className="p-3 rounded-xl bg-rose-50/50 hover:bg-rose-100/70 border border-rose-100 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex justify-between items-center text-xs font-bold text-rose-800">
              <span>Failed Payments</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div>
              <p className="text-base font-extrabold text-rose-950 mt-1">
                {payments.online?.failed || 0}
              </p>
              <p className="text-[10px] text-rose-700 mt-0.5">Requires Customer Support</p>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
