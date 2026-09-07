"use client";

import Link from 'next/link';
import { ShoppingBag, Users, Package, Clock, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { FaRupeeSign } from 'react-icons/fa';
import { DashboardStatistics } from '../../../utils/dashboardApi';

interface DashboardKpiCardsProps {
  data: DashboardStatistics['data'];
  onSelectTab?: (tab: any) => void;
}

export default function DashboardKpiCards({ data, onSelectTab }: DashboardKpiCardsProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const overview = data.overview;
  const inventory = data.inventory;
  const orders = data.orders;

  const kpis = [
    {
      id: 'revenue',
      title: 'Total Revenue',
      value: formatCurrency(overview.monthly_revenue),
      subtext: `Today: ${formatCurrency(overview.today_revenue)}`,
      growth: overview.revenue_growth,
      growthText: `${overview.revenue_growth >= 0 ? '+' : ''}${overview.revenue_growth}%`,
      icon: FaRupeeSign,
      bg: 'from-blue-500 to-blue-700',
      textColor: 'text-white',
      isPrimary: true,
      onClick: () => onSelectTab && onSelectTab('sales'),
    },
    {
      id: 'orders',
      title: 'Total Orders',
      value: overview.total_orders.toLocaleString('en-IN'),
      subtext: `${(orders.delivered || 0) + (orders.completed || 0)} delivered`,
      growth: overview.orders_growth,
      growthText: `${overview.orders_growth >= 0 ? '+' : ''}${overview.orders_growth}%`,
      icon: ShoppingBag,
      bg: 'bg-white border-gray-200',
      iconBg: 'bg-blue-100 text-blue-600',
      href: '/dashboard/orders',
    },
    {
      id: 'customers',
      title: 'Total Customers',
      value: overview.total_users.toLocaleString('en-IN'),
      subtext: `+${overview.new_users_this_month} new this month`,
      growth: overview.users_growth,
      growthText: `${overview.users_growth >= 0 ? '+' : ''}${overview.users_growth}%`,
      icon: Users,
      bg: 'bg-white border-gray-200',
      iconBg: 'bg-emerald-100 text-emerald-600',
      href: '/dashboard/users',
    },
    {
      id: 'products',
      title: 'Total Products',
      value: overview.total_products.toLocaleString('en-IN'),
      subtext: `${inventory.in_stock || overview.total_products} in stock`,
      icon: Package,
      bg: 'bg-white border-gray-200',
      iconBg: 'bg-purple-100 text-purple-600',
      href: '/dashboard/products',
    },
    {
      id: 'pending',
      title: 'Pending Action',
      value: orders.pending.toLocaleString('en-IN'),
      subtext: 'Orders awaiting confirmation',
      icon: Clock,
      bg: 'bg-white border-gray-200',
      iconBg: 'bg-amber-100 text-amber-600',
      href: '/dashboard/orders?status=pending',
    },
    {
      id: 'stock_alerts',
      title: 'Stock Warnings',
      value: (inventory.low_stock + inventory.out_of_stock).toLocaleString('en-IN'),
      subtext: `${inventory.out_of_stock} out, ${inventory.low_stock} low`,
      icon: AlertTriangle,
      bg: 'bg-white border-gray-200',
      iconBg: inventory.out_of_stock > 0 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600',
      href: inventory.out_of_stock > 0 && inventory.low_stock === 0 ? '/dashboard/products?tab=out-of-stock' : '/dashboard/products?tab=low-stock',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-6 gap-2.5 sm:gap-3 lg:gap-3.5 mb-6">
      {kpis.map((card) => {
        const Icon = card.icon;
        const isPrimary = Boolean(card.isPrimary);

        const Content = (
          <div className="flex flex-col justify-between h-full min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className={isPrimary ? "p-2 bg-white/20 backdrop-blur-md rounded-xl flex-shrink-0" : `p-2 rounded-xl flex-shrink-0 ${card.iconBg}`}>
                <Icon className={isPrimary ? "w-4 h-4 text-white" : "w-4 h-4"} />
              </div>
              {card.growthText && (
                <span className={isPrimary
                  ? "flex items-center gap-0.5 text-[10px] font-bold bg-white/20 backdrop-blur-md px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                  : `flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${(card.growth ?? 0) >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`
                }>
                  {(card.growth ?? 0) >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {card.growthText}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className={isPrimary ? "text-[11px] font-semibold text-white/80 uppercase tracking-wider truncate" : "text-[11px] font-semibold text-gray-500 truncate"}>
                {card.title}
              </p>
              <p className={isPrimary ? "text-lg sm:text-xl font-extrabold tracking-tight mt-0.5 truncate text-white" : "text-lg sm:text-xl font-bold text-gray-900 mt-0.5 truncate"}>
                {card.value}
              </p>
              <p className={isPrimary ? "text-[10px] sm:text-[11px] text-white/80 mt-0.5 font-medium truncate" : "text-[10px] sm:text-[11px] text-gray-400 mt-0.5 truncate"}>
                {card.subtext}
              </p>
            </div>
          </div>
        );

        const cardClasses = `rounded-2xl p-3 sm:p-3.5 border transition-all duration-200 cursor-pointer group shadow-2xs hover:shadow-md flex flex-col justify-between ${
          isPrimary
            ? 'bg-gradient-to-br from-[#007FFF] to-[#0055CC] text-white border-transparent shadow-blue-500/10'
            : 'bg-white border-gray-200/90 hover:border-gray-300'
        }`;

        if (card.href) {
          return (
            <Link
              key={card.id}
              href={card.href}
              className={cardClasses}
            >
              {Content}
            </Link>
          );
        }

        return (
          <div
            key={card.id}
            onClick={card.onClick}
            className={cardClasses}
          >
            {Content}
          </div>
        );
      })}
    </div>
  );
}

