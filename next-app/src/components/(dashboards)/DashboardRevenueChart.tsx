"use client";

import { useState } from 'react';
import { TrendingUp, ShoppingBag, BarChart3 } from 'lucide-react';
import { DashboardStatistics } from '../../../utils/dashboardApi';
import { FaRupeeSign } from 'react-icons/fa';

interface DashboardRevenueChartProps {
  data: DashboardStatistics['data'];
}

export default function DashboardRevenueChart({ data }: DashboardRevenueChartProps) {
  const [metric, setMetric] = useState<'revenue' | 'orders' | 'aov'>('revenue');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const timeline = data.charts?.revenue_timeline || [];
  const monthlyData = data.charts?.revenue_by_month || [];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Determine current active dataset
  const chartPoints = timeline.length > 0 ? timeline : monthlyData.map(m => ({
    date: m.month,
    revenue: m.revenue,
    orders: m.orders,
    aov: m.orders > 0 ? Math.round(m.revenue / m.orders) : 0,
  }));

  const values = chartPoints.map(p => {
    if (metric === 'orders') return p.orders;
    if (metric === 'aov') return p.aov;
    return p.revenue;
  });

  const maxValue = Math.max(...values, 10);
  const minValue = 0;

  // SVG dimensions
  const svgWidth = 600;
  const svgHeight = 200;
  const paddingX = 40;
  const paddingY = 30;

  const pointsCount = chartPoints.length;
  const stepX = (svgWidth - paddingX * 2) / Math.max(pointsCount - 1, 1);

  // Generate SVG polyline coordinates
  const pointsCoords = values.map((val, idx) => {
    const x = paddingX + idx * stepX;
    const y = svgHeight - paddingY - ((val - minValue) / (maxValue - minValue)) * (svgHeight - paddingY * 2);
    return { x, y, val, item: chartPoints[idx] };
  });

  const pathD = pointsCoords.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${pointsCoords[pointsCoords.length - 1]?.x || 0} ${svgHeight - paddingY} L ${pointsCoords[0]?.x || 0} ${svgHeight - paddingY} Z`;

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs mb-6">

      {/* Header & Metric Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-gray-100 pb-3">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#007FFF]" />
            Sales Performance & Revenue Analytics
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time store trend metrics for selected date range
          </p>
        </div>

        {/* Toggle buttons */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setMetric('revenue')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${metric === 'revenue' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <FaRupeeSign className="w-3.5 h-3.5 text-[#007FFF]" /> Revenue
          </button>
          <button
            onClick={() => setMetric('orders')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${metric === 'orders' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-blue-500" /> Orders
          </button>
          <button
            onClick={() => setMetric('aov')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${metric === 'aov' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Avg Order Value
          </button>
        </div>
      </div>

      {/* SVG Chart Visualization */}
      <div className="relative w-full overflow-x-auto">
        <div className="min-w-[500px]">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-48 overflow-visible">
            {/* Grid lines */}
            {[0, 0.33, 0.66, 1].map((pct, idx) => {
              const y = svgHeight - paddingY - pct * (svgHeight - paddingY * 2);
              const gridVal = Math.round(minValue + pct * (maxValue - minValue));
              return (
                <g key={idx}>
                  <line x1={paddingX} y1={y} x2={svgWidth - paddingX} y2={y} stroke="#f1f5f9" strokeDasharray="4 4" />
                  <text x={paddingX - 8} y={y + 3} textAnchor="end" className="text-[9px] fill-gray-400 font-medium">
                    {metric === 'orders' ? gridVal : `₹${gridVal > 1000 ? Math.round(gridVal / 1000) + 'k' : gridVal}`}
                  </text>
                </g>
              );
            })}

            {/* Gradient Area Fill */}
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#007FFF" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#007FFF" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={areaD} fill="url(#chartGradient)" />

            {/* Line Path */}
            <path d={pathD} fill="none" stroke="#007FFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

            {/* Interactive Data Points */}
            {pointsCoords.map((pt, idx) => (
              <g key={idx} className="group/pt cursor-pointer">
                {/* Invisible hover target */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="12"
                  fill="transparent"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
                {/* Visible Circle */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredIdx === idx ? '6' : '4'}
                  fill="#ffffff"
                  stroke="#007FFF"
                  strokeWidth="3"
                  className="transition-all duration-150"
                />

                {/* X-Axis Date Labels */}
                <text
                  x={pt.x}
                  y={svgHeight - 8}
                  textAnchor="middle"
                  className={`text-[10px] font-medium transition-all ${hoveredIdx === idx ? 'fill-[#007FFF] font-bold' : 'fill-gray-400'
                    }`}
                >
                  {pt.item.date}
                </text>
              </g>
            ))}
          </svg>

          {/* Floating Hover Tooltip */}
          {hoveredIdx !== null && pointsCoords[hoveredIdx] && (
            <div
              className="absolute bg-gray-900 text-white text-xs rounded-xl p-3 shadow-xl z-20 pointer-events-none transition-all border border-gray-700"
              style={{
                left: `${(pointsCoords[hoveredIdx].x / svgWidth) * 100}%`,
                top: '10px',
                transform: 'translateX(-50%)',
              }}
            >
              <p className="font-bold text-blue-400 border-b border-gray-800 pb-1 mb-1">
                {pointsCoords[hoveredIdx].item.date}
              </p>
              <div className="space-y-0.5 text-[11px]">
                <p className="flex justify-between gap-4">
                  <span className="text-gray-400">Revenue:</span>
                  <span className="font-semibold text-white">{formatCurrency(pointsCoords[hoveredIdx].item.revenue)}</span>
                </p>
                <p className="flex justify-between gap-4">
                  <span className="text-gray-400">Orders:</span>
                  <span className="font-semibold text-white">{pointsCoords[hoveredIdx].item.orders}</span>
                </p>
                <p className="flex justify-between gap-4">
                  <span className="text-gray-400">AOV:</span>
                  <span className="font-semibold text-white">{formatCurrency(pointsCoords[hoveredIdx].item.aov)}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
