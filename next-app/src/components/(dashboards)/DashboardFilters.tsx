"use client";

import { useState } from 'react';
import { Calendar, Filter, RefreshCw, ChevronDown } from 'lucide-react';
import { DashboardFilterParams } from '../../../utils/dashboardApi';

interface DashboardFiltersProps {
  filters: DashboardFilterParams;
  onApplyFilters: (newFilters: DashboardFilterParams) => void;
  onResetFilters: () => void;
  isLoading?: boolean;
}

export default function DashboardFilters({
  filters,
  onApplyFilters,
  onResetFilters,
  isLoading = false,
}: DashboardFiltersProps) {
  const [period, setPeriod] = useState(filters.period || '30days');
  const [startDate, setStartDate] = useState(filters.startDate || '');
  const [endDate, setEndDate] = useState(filters.endDate || '');
  const [status, setStatus] = useState(filters.status || 'all');
  const [paymentMethod, setPaymentMethod] = useState(filters.paymentMethod || 'all');
  const [paymentStatus, setPaymentStatus] = useState(filters.paymentStatus || 'all');
  const [showCustomDates, setShowCustomDates] = useState(filters.period === 'custom');

  const handlePeriodChange = (val: string) => {
    setPeriod(val);
    if (val === 'custom') {
      setShowCustomDates(true);
    } else {
      setShowCustomDates(false);
      onApplyFilters({
        period: val,
        status,
        paymentMethod,
        paymentStatus,
      });
    }
  };

  const handleApply = () => {
    onApplyFilters({
      period,
      startDate: period === 'custom' ? startDate : undefined,
      endDate: period === 'custom' ? endDate : undefined,
      status,
      paymentMethod,
      paymentStatus,
    });
  };

  const handleReset = () => {
    setPeriod('30days');
    setStartDate('');
    setEndDate('');
    setStatus('all');
    setPaymentMethod('all');
    setPaymentStatus('all');
    setShowCustomDates(false);
    onResetFilters();
  };

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs mb-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">

        {/* Left: Date Presets Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollHide py-1">
          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1 mr-1">
            <Calendar className="w-3.5 h-3.5" /> Date:
          </span>
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: '7days', label: '7 Days' },
            { id: '30days', label: '30 Days' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'this_year', label: 'This Year' },
            { id: 'custom', label: 'Custom' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handlePeriodChange(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${period === item.id
                  ? 'bg-[#007FFF] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleApply}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <Filter className="w-3.5 h-3.5" />
            Apply
          </button>
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Reset
          </button>
        </div>
      </div>

      {/* Second Row: Dropdown Filters & Custom Dates */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Order Status:</label>
          <div className="relative">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 pr-8 text-xs font-medium text-gray-800 focus:outline-none focus:border-[#007FFF]"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Payment Method Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Method:</label>
          <div className="relative">
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 pr-8 text-xs font-medium text-gray-800 focus:outline-none focus:border-[#007FFF]"
            >
              <option value="all">All Methods</option>
              <option value="online">Cashfree (Online)</option>
              <option value="cod">Cash on Delivery (COD)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Payment Status Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Payment Status:</label>
          <div className="relative">
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 pr-8 text-xs font-medium text-gray-800 focus:outline-none focus:border-[#007FFF]"
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Paid (Successful)</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Custom Range Inputs */}
        {showCustomDates && (
          <div className="flex items-center gap-2 bg-blue-50/50 p-1 px-2 rounded-xl border border-blue-200">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700"
            />
          </div>
        )}

      </div>
    </div>
  );
}
