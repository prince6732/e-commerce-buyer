"use client";

import Link from 'next/link';
import { FolderTree, Award, TrendingUp, ArrowRight, BarChart2 } from 'lucide-react';
import { DashboardStatistics } from '../../../utils/dashboardApi';
import { getCategorySlug } from '../../../utils/slugUtils';

interface DashboardCategoriesViewProps {
  categoryPerformance: DashboardStatistics['data']['category_performance'];
}

export default function DashboardCategoriesView({ categoryPerformance }: DashboardCategoriesViewProps) {
  if (!categoryPerformance) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const categories = categoryPerformance.categories || [];
  const maxRevenue = Math.max(...categories.map(c => c.revenue), 1);

  return (
    <div className="space-y-6">

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-2xl p-6 shadow-sm border border-emerald-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight">Category Performance Analytics</h2>
          </div>
          <p className="text-xs text-emerald-200 mt-1">
            Analyze sales volume, unit distribution, and revenue contributions across catalog categories
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10">
          <div>
            <p className="text-[10px] font-bold text-emerald-200 uppercase">Active Categories</p>
            <p className="text-xl font-black text-emerald-300">
              {categoryPerformance.active_categories_with_sales} / {categoryPerformance.total_categories}
            </p>
          </div>
          <Link
            href="/dashboard/categories"
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1"
          >
            Manage Categories <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Highlights: Best vs Lowest Performing Category */}
      <div className="grid md:grid-cols-2 gap-4">
        {categoryPerformance.best_category && (
          <div className="bg-white rounded-2xl p-5 border border-emerald-200 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
              <Award className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-extrabold uppercase text-emerald-600 tracking-wider">Top Performing Category</span>
              <h3 className="text-base font-extrabold text-gray-900">{categoryPerformance.best_category.name}</h3>
              <p className="text-xs font-bold text-emerald-600 mt-0.5">
                {formatCurrency(categoryPerformance.best_category.revenue)} ({categoryPerformance.best_category.revenue_percentage}% of total store revenue)
              </p>
            </div>
          </div>
        )}

        {categoryPerformance.lowest_category && (
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-gray-100 text-gray-600 rounded-2xl">
              <BarChart2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">Lowest Performing Category</span>
              <h3 className="text-base font-extrabold text-gray-900">{categoryPerformance.lowest_category.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatCurrency(categoryPerformance.lowest_category.revenue)} ({categoryPerformance.lowest_category.revenue_percentage}% of sales)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Category Performance Table */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs">
        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">Category Revenue Breakdown</h3>
            <p className="text-xs text-gray-500">Sales volume and units sold per category</p>
          </div>
          <Link href="/dashboard/categories" className="text-xs font-bold text-[#007FFF] hover:underline">
            View All Categories &rarr;
          </Link>
        </div>

        <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0 pb-2 scrollbar">
          <table className="w-full min-w-[580px] text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase">
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Orders</th>
                <th className="py-2.5 px-3">Units Sold</th>
                <th className="py-2.5 px-3">Revenue Share</th>
                <th className="py-2.5 px-3 text-right">Total Revenue</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs font-medium">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-3">
                    <p className="font-bold text-gray-900 whitespace-nowrap">{cat.name}</p>
                  </td>
                  <td className="py-3 px-3 text-gray-600 whitespace-nowrap">{cat.orders_count}</td>
                  <td className="py-3 px-3 text-gray-600 whitespace-nowrap">{cat.units_sold}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2 max-w-[160px]">
                      <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#007FFF] h-full rounded-full"
                          style={{ width: `${Math.min(cat.revenue_percentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-gray-600 w-10">{cat.revenue_percentage}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-extrabold text-emerald-600 whitespace-nowrap">
                    {formatCurrency(cat.revenue)}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <Link
                      href={`/dashboard/categories/${getCategorySlug(cat)}/products`}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#007FFF] rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1"
                    >
                      Products <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
