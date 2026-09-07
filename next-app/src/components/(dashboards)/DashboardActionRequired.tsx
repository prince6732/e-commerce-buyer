"use client";

import Link from 'next/link';
import { AlertCircle, AlertTriangle, Clock, Mail, Star, ArrowRight, CheckCircle2 } from 'lucide-react';
import { DashboardStatistics } from '../../../utils/dashboardApi';

interface DashboardActionRequiredProps {
  items: DashboardStatistics['data']['action_required'];
}

export default function DashboardActionRequired({ items }: DashboardActionRequiredProps) {
  if (!items || items.length === 0) {
    return (
      <div className="bg-emerald-50/60 rounded-2xl p-5 border border-emerald-200 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-900">All Operations Smooth</h4>
            <p className="text-xs text-emerald-700">No urgent pending alerts or inventory issues requiring action.</p>
          </div>
        </div>
      </div>
    );
  }

  const getAlertStyles = (type: string) => {
    switch (type) {
      case 'critical':
        return {
          bg: 'bg-rose-50 border-rose-200 hover:bg-rose-100/80',
          iconBg: 'bg-rose-100 text-rose-700',
          badge: 'bg-rose-600 text-white',
          icon: AlertCircle,
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 border-amber-200 hover:bg-amber-100/80',
          iconBg: 'bg-amber-100 text-amber-700',
          badge: 'bg-amber-600 text-white',
          icon: AlertTriangle,
        };
      case 'pending':
        return {
          bg: 'bg-sky-50 border-sky-200 hover:bg-sky-100/80',
          iconBg: 'bg-sky-100 text-sky-700',
          badge: 'bg-sky-600 text-white',
          icon: Clock,
        };
      case 'reviews':
        return {
          bg: 'bg-purple-50 border-purple-200 hover:bg-purple-100/80',
          iconBg: 'bg-purple-100 text-purple-700',
          badge: 'bg-purple-600 text-white',
          icon: Star,
        };
      default:
        return {
          bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100/80',
          iconBg: 'bg-blue-100 text-blue-700',
          badge: 'bg-blue-600 text-white',
          icon: Mail,
        };
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs mb-6">
      <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
          </span>
          <h3 className="text-base font-bold text-gray-900">Action Required</h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
            {items.length} Issue{items.length > 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-xs text-gray-500">Prioritized store items needing admin attention</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item) => {
          const style = getAlertStyles(item.type);
          const Icon = style.icon;
          return (
            <Link
              key={item.id}
              href={item.link}
              className={`rounded-2xl p-4 border transition-all duration-200 flex flex-col justify-between cursor-pointer group ${style.bg}`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${style.iconBg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-gray-900 leading-snug">{item.title}</h4>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                  {item.count}
                </span>
              </div>

              <p className="text-xs text-gray-600 mb-3">{item.message}</p>

              <div className="flex items-center justify-between text-xs font-bold text-gray-800 group-hover:text-[#007FFF] transition-colors">
                <span>Resolve Issue</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
