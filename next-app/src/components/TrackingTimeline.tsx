import React from 'react';
import { Package, MapPin, Clock, CheckCircle, XCircle, Truck, AlertCircle } from 'lucide-react';
import { DelhiveryTrackingData } from '../../utils/delhiveryApi';

type TrackingTimelineProps = {
  trackingData: DelhiveryTrackingData;
};

const TrackingTimeline: React.FC<TrackingTimelineProps> = ({ trackingData }) => {
  const getStatusIcon = (status: string) => {
    const statusLower = status.toLowerCase();

    if (statusLower.includes('delivered')) {
      return <CheckCircle className="w-6 h-6 text-[#0CCA4A]" />;
    } else if (statusLower.includes('out for delivery')) {
      return <Truck className="w-6 h-6 text-[#007FFF]" />;
    } else if (statusLower.includes('transit') || statusLower.includes('dispatched')) {
      return <Package className="w-6 h-6 text-[#007FFF]" />;
    } else if (statusLower.includes('picked')) {
      return <CheckCircle className="w-6 h-6 text-teal-500" />;
    } else if (statusLower.includes('cancelled') || statusLower.includes('rto')) {
      return <XCircle className="w-6 h-6 text-[#F40000]" />;
    } else {
      return <Clock className="w-6 h-6 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();

    if (statusLower.includes('delivered')) return 'border-[#0CCA4A] bg-emerald-50';
    if (statusLower.includes('out for delivery')) return 'border-[#007FFF] bg-blue-50';
    if (statusLower.includes('transit') || statusLower.includes('dispatched')) return 'border-[#007FFF] bg-blue-50';
    if (statusLower.includes('picked')) return 'border-teal-500 bg-teal-50';
    if (statusLower.includes('cancelled') || statusLower.includes('rto')) return 'border-[#F40000] bg-red-50';
    return 'border-gray-300 bg-gray-50';
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">Shipment Tracking</h3>
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-full">
            <Truck className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-semibold text-blue-600">
              {trackingData.status}
            </span>
          </div>
        </div>

        {/* Waybill Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs text-gray-500 mb-1">Waybill Number</p>
            <p className="text-sm font-semibold text-gray-800">{trackingData.waybill}</p>
          </div>
          {trackingData.current_location && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Current Location</p>
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-gray-500" />
                {trackingData.current_location}
              </p>
            </div>
          )}
          {trackingData.expected_delivery && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Expected Delivery</p>
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                <Clock className="w-4 h-4 text-gray-500" />
                {formatDate(trackingData.expected_delivery)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        <div className="space-y-6">
          {trackingData.scans && trackingData.scans.length > 0 ? (
            trackingData.scans.map((scan, index) => (
              <div key={index} className="relative flex gap-4">
                {/* Icon */}
                <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 ${getStatusColor(scan.scan_detail)}`}>
                  {getStatusIcon(scan.scan_detail)}
                </div>

                {/* Content */}
                <div className="flex-1 pb-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-800">{scan.scan_detail}</h4>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(scan.scan_date)}
                      </span>
                    </div>

                    {scan.location && (
                      <p className="text-sm text-gray-600 flex items-center gap-1 mb-1">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {scan.location}
                      </p>
                    )}

                    {scan.instructions && (
                      <p className="text-sm text-gray-500 mt-2 italic">
                        {scan.instructions}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <AlertCircle className="w-5 h-5 mr-2" />
              <p>No tracking information available yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Last Updated */}
      {trackingData.status_date && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Last updated: {formatDate(trackingData.status_date)}
          </p>
        </div>
      )}
    </div>
  );
};

export default TrackingTimeline;
