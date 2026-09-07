"use client";

import Link from 'next/link';
import { CreditCard, CheckCircle, AlertTriangle } from 'lucide-react';
import { DashboardStatistics } from '../../../utils/dashboardApi';

interface DashboardPaymentOverviewProps {
  payments: DashboardStatistics['data']['payments'];
}

export default function DashboardPaymentOverview({ payments }: DashboardPaymentOverviewProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const online = payments?.online || { total: 0, successful: 0, pending: 0, failed: 0, success_rate: 100 };
  const cod = payments?.cod || { total: 0, collected: 0, pending: 0, success_rate: 100 };

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#007FFF]" />
            Payment Overview
          </h3>
          <p className="text-xs text-gray-500">Cashfree PG vs Cash on Delivery collection breakdown</p>
        </div>
        <Link
          href="/dashboard/orders"
          className="text-xs font-bold text-[#007FFF] hover:underline"
        >
          All Payments &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Cashfree Online */}
        <Link
          href="/dashboard/orders?paymentMethod=online"
          className="p-3 rounded-xl bg-blue-50/50 hover:bg-blue-100/70 border border-blue-100 transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-center text-xs font-bold text-gray-700">
            <span>Cashfree Online</span>
            <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-md font-extrabold">PG</span>
          </div>
          <p className="text-base font-extrabold text-gray-900 mt-1">{formatCurrency(online.total)}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">{online.successful} Successful</p>
        </Link>

        {/* COD */}
        <Link
          href="/dashboard/orders?paymentMethod=cash_on_delivery"
          className="p-3 rounded-xl bg-blue-50/50 hover:bg-blue-100/70 border border-blue-100 transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-center text-xs font-bold text-gray-700">
            <span>COD Orders</span>
            <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-md font-extrabold">COD</span>
          </div>
          <p className="text-base font-extrabold text-gray-900 mt-1">{formatCurrency(cod.total)}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">{cod.collected} Collected</p>
        </Link>

        {/* Paid / Successful */}
        <Link
          href="/dashboard/orders?paymentStatus=paid"
          className="p-3 rounded-xl bg-emerald-50/50 hover:bg-emerald-100/70 border border-emerald-100 transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-center text-xs font-bold text-emerald-800">
            <span>Successful Paid</span>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-base font-extrabold text-emerald-950 mt-1">{online.successful + cod.collected}</p>
          <p className="text-[10px] text-emerald-700 mt-0.5">Verified Collections</p>
        </Link>

        {/* Failed Payments */}
        <Link
          href="/dashboard/orders?paymentStatus=failed"
          className="p-3 rounded-xl bg-rose-50/50 hover:bg-rose-100/70 border border-rose-100 transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-center text-xs font-bold text-rose-800">
            <span>Failed Payments</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <p className="text-base font-extrabold text-rose-950 mt-1">{online.failed}</p>
          <p className="text-[10px] text-rose-700 mt-0.5">Requires Customer Support</p>
        </Link>
      </div>
    </div>
  );
}
