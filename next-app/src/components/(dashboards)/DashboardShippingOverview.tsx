"use client";

import Link from 'next/link';
import { Truck, Package, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { DashboardStatistics } from '../../../utils/dashboardApi';

interface DashboardShippingOverviewProps {
  shipping: DashboardStatistics['data']['shipping'];
  onSelectTab: (tab: any) => void;
}

export default function DashboardShippingOverview({ shipping, onSelectTab }: DashboardShippingOverviewProps) {
  const s = shipping || {
    total: 0,
    created: 0,
    in_transit: 0,
    out_for_delivery: 0,
    delivered: 0,
    failures: 0,
    pending: 0,
    delivery_success_rate: 100,
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            Shipping & Delhivery Logistics Overview
          </h3>
          <p className="text-xs text-gray-500">Waybill dispatch, live in-transit packages, and delivery rate</p>
        </div>
        <button
          onClick={() => onSelectTab('shipping')}
          className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
        >
          Logistics Pipeline &rarr;
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Pending Dispatch */}
        <Link
          href="/dashboard/orders?status=confirmed"
          className="p-3 rounded-xl bg-amber-50/50 hover:bg-amber-100/70 border border-amber-100 transition-all cursor-pointer"
        >
          <div className="flex justify-between items-center text-xs font-semibold text-amber-800">
            <span>Pending Shipment</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <p className="text-base font-extrabold text-amber-950 mt-1">{s.pending}</p>
          <p className="text-[10px] text-amber-700 mt-0.5">Awaiting Waybill</p>
        </Link>

        {/* In Transit */}
        <Link
          href="/dashboard/orders?status=shipped"
          className="p-3 rounded-xl bg-sky-50/50 hover:bg-sky-100/70 border border-sky-100 transition-all cursor-pointer"
        >
          <div className="flex justify-between items-center text-xs font-semibold text-sky-800">
            <span>In Transit</span>
            <Truck className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <p className="text-base font-extrabold text-sky-950 mt-1">{s.in_transit}</p>
          <p className="text-[10px] text-sky-700 mt-0.5">On the Move</p>
        </Link>

        {/* Out for Delivery */}
        <Link
          href="/dashboard/orders?status=out_for_delivery"
          className="p-3 rounded-xl bg-purple-50/50 hover:bg-purple-100/70 border border-purple-100 transition-all cursor-pointer"
        >
          <div className="flex justify-between items-center text-xs font-semibold text-purple-800">
            <span>Out for Delivery</span>
            <Package className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <p className="text-base font-extrabold text-purple-950 mt-1">{s.out_for_delivery}</p>
          <p className="text-[10px] text-purple-700 mt-0.5">Today's Delivery</p>
        </Link>

        {/* Delivered */}
        <Link
          href="/dashboard/orders?status=delivered"
          className="p-3 rounded-xl bg-emerald-50/50 hover:bg-emerald-100/70 border border-emerald-100 transition-all cursor-pointer"
        >
          <div className="flex justify-between items-center text-xs font-semibold text-emerald-800">
            <span>Delivered</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-base font-extrabold text-emerald-950 mt-1">{s.delivered}</p>
          <p className="text-[10px] text-emerald-700 mt-0.5">{s.delivery_success_rate}% Success</p>
        </Link>

        {/* Failed */}
        <Link
          href="/dashboard/orders?delhiveryStatus=failed"
          className="p-3 rounded-xl bg-rose-50/50 hover:bg-rose-100/70 border border-rose-100 transition-all cursor-pointer"
        >
          <div className="flex justify-between items-center text-xs font-semibold text-rose-800">
            <span>Failed / RTO</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <p className="text-base font-extrabold text-rose-950 mt-1">{s.failures}</p>
          <p className="text-[10px] text-rose-700 mt-0.5">Attempt Failed</p>
        </Link>
      </div>
    </div>
  );
}
