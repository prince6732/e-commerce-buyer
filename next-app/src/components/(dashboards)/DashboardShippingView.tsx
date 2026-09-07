"use client";

import Link from 'next/link';
import { Truck, CheckCircle2, AlertTriangle, Clock, Navigation, ArrowRight, ShieldAlert } from 'lucide-react';
import { DashboardStatistics } from '../../../utils/dashboardApi';

interface DashboardShippingViewProps {
  shipping: DashboardStatistics['data']['shipping'];
}

export default function DashboardShippingView({ shipping }: DashboardShippingViewProps) {
  if (!shipping) return null;

  const cards = [
    {
      id: 'total',
      label: 'Total Shipments',
      count: shipping.total,
      sub: `${shipping.created} waybills assigned`,
      icon: Truck,
      bg: 'bg-blue-50 border-blue-200 text-blue-900',
      iconBg: 'bg-blue-100 text-blue-600',
    },
    {
      id: 'delivered',
      label: 'Delivered Packages',
      count: shipping.delivered,
      sub: `${shipping.delivery_success_rate}% success rate`,
      icon: CheckCircle2,
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      iconBg: 'bg-emerald-100 text-emerald-600',
    },
    {
      id: 'in_transit',
      label: 'In Transit',
      count: shipping.in_transit,
      sub: 'En route to hub/destination',
      icon: Truck,
      bg: 'bg-purple-50 border-purple-200 text-purple-900',
      iconBg: 'bg-purple-100 text-purple-600',
    },
    {
      id: 'out_for_delivery',
      label: 'Out for Delivery',
      count: shipping.out_for_delivery,
      sub: 'Out with delivery agent',
      icon: Navigation,
      bg: 'bg-indigo-50 border-indigo-200 text-indigo-900',
      iconBg: 'bg-indigo-100 text-indigo-600',
    },
    {
      id: 'failures',
      label: 'Delivery Failures',
      count: shipping.failures,
      sub: 'NDR / Failed attempts',
      icon: ShieldAlert,
      bg: 'bg-rose-50 border-rose-200 text-rose-900',
      iconBg: 'bg-rose-100 text-rose-600',
    },
    {
      id: 'pending',
      label: 'Pending Dispatch',
      count: shipping.pending,
      sub: 'Awaiting waybill / courier',
      icon: Clock,
      bg: 'bg-amber-50 border-amber-200 text-amber-900',
      iconBg: 'bg-amber-100 text-amber-600',
    },
  ];

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-sm border border-blue-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold tracking-tight">Delhivery Logistics Command</h2>
          </div>
          <p className="text-xs text-blue-200 mt-1">
            Real-time courier waybill status tracking, delivery performance, and dispatch management
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
          <div>
            <p className="text-[10px] font-bold text-blue-200 uppercase">Delivery Success Rate</p>
            <p className="text-2xl font-black text-emerald-400">{shipping.delivery_success_rate}%</p>
          </div>
          <Link
            href="/dashboard/orders"
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1"
          >
            Manage Orders <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Grid of Shipping Pipeline Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.id} className={`rounded-2xl p-4 border shadow-2xs ${c.bg} flex flex-col justify-between`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-xl ${c.iconBg}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black">{c.count}</p>
                <p className="text-xs font-bold mt-0.5">{c.label}</p>
                <p className="text-[10px] opacity-75 mt-1">{c.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
