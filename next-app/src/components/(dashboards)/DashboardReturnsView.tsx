"use client";

import Link from 'next/link';
import { RotateCcw, XCircle, Clock, CheckCircle2, ArrowRight, AlertTriangle } from 'lucide-react';
import { DashboardStatistics } from '../../../utils/dashboardApi';
import { FaRupeeSign } from 'react-icons/fa';

interface DashboardReturnsViewProps {
  refunds: DashboardStatistics['data']['refunds'];
  returns: DashboardStatistics['data']['returns'];
  cancellations: DashboardStatistics['data']['cancellations'];
}

export default function DashboardReturnsView({ refunds, returns, cancellations }: DashboardReturnsViewProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <div className="space-y-6">

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-rose-900 via-pink-900 to-slate-900 text-white rounded-2xl p-6 shadow-sm border border-rose-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-rose-400" />
            <h2 className="text-xl font-bold tracking-tight">Returns, Refunds & Cancellations Analytics</h2>
          </div>
          <p className="text-xs text-rose-200 mt-1">
            Monitor customer order return requests, processed refund value, and order cancellation trends
          </p>
        </div>

        <div className="flex items-center gap-6 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10">
          <div>
            <p className="text-[10px] font-bold text-rose-200 uppercase">Refund Value Issued</p>
            <p className="text-xl font-black text-rose-300">{formatCurrency(refunds?.amount || 0)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-rose-200 uppercase">Cancellation Rate</p>
            <p className="text-xl font-black text-amber-300">{cancellations?.rate || 0}%</p>
          </div>
        </div>
      </div>

      {/* Grid of 3 Main Metrics Cards */}
      <div className="grid md:grid-cols-3 gap-4">

        {/* Refunds Panel */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <FaRupeeSign className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Refund Summary</h3>
            </div>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {refunds?.count || 0} Refunded
            </span>
          </div>

          <div className="space-y-3 text-xs font-medium">
            <div className="flex justify-between items-center p-3 rounded-xl bg-gray-50">
              <span className="text-gray-600">Total Refunded Amount:</span>
              <span className="text-sm font-extrabold text-emerald-600">{formatCurrency(refunds?.amount || 0)}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-50 text-emerald-800">
              <span>Completed Refunds:</span>
              <span className="font-bold">{refunds?.completed || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-amber-50 text-amber-800">
              <span>Pending Processing:</span>
              <span className="font-bold">{refunds?.pending || 0}</span>
            </div>
          </div>
        </div>

        {/* Returns Panel */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                <RotateCcw className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Return Requests</h3>
            </div>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
              {returns?.rate || 0}% Return Rate
            </span>
          </div>

          <div className="space-y-3 text-xs font-medium">
            <div className="flex justify-between items-center p-3 rounded-xl bg-gray-50">
              <span className="text-gray-600">Total Requests:</span>
              <span className="text-sm font-extrabold text-gray-900">{returns?.total || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-amber-50 text-amber-800">
              <span>Pending Action:</span>
              <span className="font-bold">{returns?.pending || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-50 text-emerald-800">
              <span>Approved & Completed:</span>
              <span className="font-bold">{(returns?.approved || 0) + (returns?.completed || 0)}</span>
            </div>
          </div>
        </div>

        {/* Cancellations Panel */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                <XCircle className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Order Cancellations</h3>
            </div>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {cancellations?.count || 0} Orders
            </span>
          </div>

          <div className="space-y-3 text-xs font-medium">
            <div className="flex justify-between items-center p-3 rounded-xl bg-gray-50">
              <span className="text-gray-600">Cancelled Value:</span>
              <span className="text-sm font-extrabold text-rose-600">{formatCurrency(cancellations?.amount || 0)}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-amber-50 text-amber-800">
              <span>Overall Cancellation Rate:</span>
              <span className="font-bold">{cancellations?.rate || 0}%</span>
            </div>
            <div className="flex justify-end pt-1">
              <Link href="/dashboard/orders?status=cancelled" className="text-xs font-bold text-[#007FFF] hover:underline flex items-center gap-1">
                View Cancelled Orders <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
