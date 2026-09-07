"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, Loader2, RefreshCw, AlertCircle, Copy, Check } from 'lucide-react';
import TrackingTimeline from '@/components/TrackingTimeline';
import { getAdminOrder } from '../../../../../../../utils/orderApi';
import { trackOrderDelhivery, syncDelhiveryTracking, DelhiveryTrackingData } from '../../../../../../../utils/delhiveryApi';

const TrackOrderPage = () => {
  const params = useParams();
  const router = useRouter();
  const orderId = (params?.slug || params?.orderId || params?.id || "") as string;

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<DelhiveryTrackingData | null>(null);
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [copied, setCopied] = useState(false);


  const fetchTrackingData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch order details
      const orderResponse = await getAdminOrder(orderId);
      setOrderInfo(orderResponse.order || orderResponse.data || orderResponse);

      // Fetch tracking data
      const trackingResponse = await trackOrderDelhivery(orderId);
      setTrackingData(trackingResponse.tracking_data);
    } catch (err: any) {
      setError(err?.error || err?.message || 'Failed to fetch tracking information');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncTracking = async () => {
    try {
      setSyncing(true);
      setError(null);
      const response = await syncDelhiveryTracking(orderId);
      setTrackingData(response.tracking_data);
    } catch (err: any) {
      setError(err?.error || err?.message || 'Failed to sync tracking data');
    } finally {
      setSyncing(false);
    }
  };

  const copyWaybill = () => {
    if (trackingData?.waybill) {
      navigator.clipboard.writeText(trackingData.waybill);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchTrackingData();
    }
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading tracking information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-center justify-center mb-4">
              <div className="p-4 bg-red-100 rounded-full">
                <AlertCircle className="w-12 h-12 text-red-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">
              Unable to Load Tracking
            </h2>
            <p className="text-gray-600 text-center mb-6">{error}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => router.back()}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Go Back
              </button>
              <button
                onClick={fetchTrackingData}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Orders
          </button>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">
                  Track Your Order
                </h1>
                {orderInfo && (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600">
                      Order Number: <span className="font-semibold text-gray-800">{orderInfo.order_number || orderInfo.orderNumber}</span>
                    </p>
                    {trackingData?.waybill && (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-600">
                          Waybill: <span className="font-semibold text-gray-800">{trackingData.waybill}</span>
                        </p>
                        <button
                          onClick={copyWaybill}
                          className="p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                          title="Copy waybill number"
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={handleSyncTracking}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Tracking Timeline */}
        {trackingData ? (
          <TrackingTimeline trackingData={trackingData} />
        ) : (
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex flex-col items-center justify-center text-gray-500">
              <Package className="w-16 h-16 mb-4 text-gray-300" />
              <p className="text-lg font-semibold mb-2">No Tracking Information</p>
              <p className="text-sm text-center">
                Tracking information will be available once the shipment is created and picked up by Delhivery.
              </p>
            </div>
          </div>
        )}

        {/* Order Summary */}
        {orderInfo && (
          <div className="mt-6 bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Order Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="text-base font-semibold text-gray-800 capitalize">{orderInfo.status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="text-base font-semibold text-gray-800">₹{orderInfo.total}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Payment Method</p>
                <p className="text-base font-semibold text-gray-800 capitalize">{orderInfo.payment_method || orderInfo.paymentMethod}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Order Date</p>
                <p className="text-base font-semibold text-gray-800">
                  {new Date(orderInfo.created_at || orderInfo.createdAt).toLocaleDateString('en-IN')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Need Help?</h3>
          <p className="text-sm text-blue-800 mb-4">
            If you have any questions about your shipment or need assistance, please contact our support team.
          </p>
          <div className="flex gap-3">
            <a
              href="/contact-us"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackOrderPage;
