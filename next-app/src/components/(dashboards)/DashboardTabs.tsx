"use client";

import { LayoutGrid, TrendingUp, ShoppingBag, Package, Users, ShieldAlert, CreditCard, Truck, RotateCcw, FolderTree, Tag } from 'lucide-react';

export type DashboardTabType = 'overview' | 'sales' | 'orders' | 'products' | 'customers' | 'inventory' | 'payments' | 'shipping' | 'returns' | 'categories' | 'discounts';

interface DashboardTabsProps {
  activeTab: DashboardTabType;
  onTabChange: (tab: DashboardTabType) => void;
  counts?: {
    orders?: number;
    products?: number;
    inventoryAlerts?: number;
    pendingAction?: number;
  };
}

export default function DashboardTabs({ activeTab, onTabChange, counts }: DashboardTabsProps) {
  const tabs = [
    { id: 'overview' as DashboardTabType, label: 'Overview', icon: LayoutGrid },
    { id: 'sales' as DashboardTabType, label: 'Sales', icon: TrendingUp },
    { id: 'orders' as DashboardTabType, label: 'Orders', icon: ShoppingBag, badge: counts?.orders },
    { id: 'products' as DashboardTabType, label: 'Products', icon: Package, badge: counts?.products },
    { id: 'customers' as DashboardTabType, label: 'Customers', icon: Users },
    { id: 'inventory' as DashboardTabType, label: 'Inventory', icon: ShieldAlert, badge: counts?.inventoryAlerts, badgeColor: counts?.inventoryAlerts ? 'bg-red-500 text-white' : undefined },
    { id: 'payments' as DashboardTabType, label: 'Payments', icon: CreditCard },
    { id: 'shipping' as DashboardTabType, label: 'Shipping', icon: Truck },
    { id: 'returns' as DashboardTabType, label: 'Returns & Refunds', icon: RotateCcw },
    { id: 'categories' as DashboardTabType, label: 'Categories', icon: FolderTree },
    { id: 'discounts' as DashboardTabType, label: 'Discounts', icon: Tag },
  ];

  return (
    <div className="bg-white rounded-2xl p-1.5 border border-gray-200 shadow-2xs mb-6 overflow-x-auto scrollHide">
      <div className="flex items-center gap-1 min-w-max">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${isActive
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#007FFF]' : 'text-gray-400'}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${tab.badgeColor || (isActive ? 'bg-[#007FFF] text-white' : 'bg-gray-200 text-gray-700')
                    }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
