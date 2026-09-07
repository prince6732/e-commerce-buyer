"use client";

import Link from 'next/link';
import { Clock, CheckCircle, Package, Truck, Navigation, XCircle, CheckSquare } from 'lucide-react';
import { DashboardStatistics } from '../../../utils/dashboardApi';

interface DashboardStatusOverviewProps {
  orders: DashboardStatistics['data']['orders'];
}

export default function DashboardStatusOverview({ orders }: DashboardStatusOverviewProps) {
  const statusCards = [
    {
      id: 'pending',
      label: 'Pending',
      count: orders.pending || 0,
      icon: Clock,
      bg: 'bg-amber-50 hover:bg-amber-100/80 border-amber-200 text-amber-700',
      iconBg: 'bg-amber-100 text-amber-600',
      query: 'pending',
    },
    {
      id: 'confirmed',
      label: 'Confirmed',
      count: orders.confirmed || 0,
      icon: CheckSquare,
      bg: 'bg-blue-50 hover:bg-blue-100/80 border-blue-200 text-blue-700',
      iconBg: 'bg-blue-100 text-blue-600',
      query: 'confirmed',
    },
    {
      id: 'processing',
      label: 'Processing',
      count: orders.processing || 0,
      icon: Package,
      bg: 'bg-sky-50 hover:bg-sky-100/80 border-sky-200 text-sky-700',
      iconBg: 'bg-sky-100 text-sky-600',
      query: 'processing',
    },
    {
      id: 'shipped',
      label: 'Shipped',
      count: orders.shipped || 0,
      icon: Truck,
      bg: 'bg-purple-50 hover:bg-purple-100/80 border-purple-200 text-purple-700',
      iconBg: 'bg-purple-100 text-purple-600',
      query: 'shipped',
    },
    {
      id: 'out_for_delivery',
      label: 'Out for Delivery',
      count: orders.out_for_delivery || 0,
      icon: Navigation,
      bg: 'bg-indigo-50 hover:bg-indigo-100/80 border-indigo-200 text-indigo-700',
      iconBg: 'bg-indigo-100 text-indigo-600',
      query: 'out_for_delivery',
    },
    {
      id: 'delivered',
      label: 'Delivered',
      count: orders.delivered || 0,
      icon: CheckCircle,
      bg: 'bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200 text-emerald-700',
      iconBg: 'bg-emerald-100 text-emerald-600',
      query: 'delivered',
    },
    {
      id: 'cancelled',
      label: 'Cancelled',
      count: orders.cancelled || 0,
      icon: XCircle,
      bg: 'bg-rose-50 hover:bg-rose-100/80 border-rose-200 text-rose-700',
      iconBg: 'bg-rose-100 text-rose-600',
      query: 'cancelled',
    },
  ];

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
          Order Status Pipeline
        </h3>
        <Link
          href="/dashboard/orders"
          className="text-xs font-semibold text-[#007FFF] hover:underline"
        >
          View All Orders &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {statusCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.id}
              href={`/dashboard/orders?status=${card.query}`}
              className={`rounded-2xl p-3 border shadow-2xs transition-all duration-200 flex flex-col justify-between cursor-pointer group ${card.bg}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-xl ${card.iconBg}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold tracking-wide uppercase opacity-75">Filter &rarr;</span>
              </div>
              <div>
                <p className="text-2xl font-black tracking-tight">{card.count}</p>
                <p className="text-xs font-semibold truncate mt-0.5">{card.label}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
