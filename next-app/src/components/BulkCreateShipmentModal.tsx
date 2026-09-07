import React, { useState } from 'react';
import {
  Loader2,
  Package,
  Truck,
  AlertCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  Copy,
  ExternalLink,
  Info,
} from 'lucide-react';
import Modal from './(sheared)/Modal';
import { bulkCreateDelhiveryShipments } from '../../utils/delhiveryApi';

type OrderSummary = {
  id: number;
  order_number?: string;
  orderNumber?: string;
  status: string;
  payment_method?: string;
  paymentMethod?: string;
  shipping_address?: string;
  shippingAddress?: string;
  total?: number;
  delhivery_waybill?: string | null;
  delhiveryWaybill?: string | null;
  user?: {
    name?: string;
    email?: string;
    phone_number?: string | null;
  };
  order_items?: any[];
  orderItems?: any[];
};

type BulkCreateShipmentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedOrders: OrderSummary[];
  onSuccess: () => void;
};

type ShipmentResult = {
  orderId: number;
  orderNumber?: string;
  waybill?: string;
  status: string;
  success: boolean;
  reason?: string;
  message: string;
};

export const BulkCreateShipmentModal: React.FC<BulkCreateShipmentModalProps> = ({
  isOpen,
  onClose,
  selectedOrders,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [copiedWaybill, setCopiedWaybill] = useState<string | null>(null);
  const [results, setResults] = useState<{
    processedCount: number;
    shippedCount: number;
    skippedCount: number;
    failedCount: number;
    items: ShipmentResult[];
    message: string;
  } | null>(null);

  // Classify selected orders
  const eligibleOrders = selectedOrders.filter(
    (o) =>
      !o.delhivery_waybill &&
      !o.delhiveryWaybill &&
      ['confirmed', 'processing'].includes(o.status)
  );

  const alreadyShippedOrders = selectedOrders.filter(
    (o) =>
      Boolean(o.delhivery_waybill || o.delhiveryWaybill) ||
      ['shipped', 'delivered', 'completed'].includes(o.status)
  );

  const pendingOrders = selectedOrders.filter((o) => o.status === 'pending');
  const cancelledOrders = selectedOrders.filter((o) => o.status === 'cancelled');

  const handleCopyWaybill = (waybill: string) => {
    navigator.clipboard.writeText(waybill);
    setCopiedWaybill(waybill);
    setTimeout(() => setCopiedWaybill(null), 2000);
  };

  const handleCreateBulkShipments = async () => {
    const eligibleIds = eligibleOrders.map((o) => o.id);
    if (eligibleIds.length === 0) return;

    setLoading(true);
    setResults(null);

    try {
      const response = await bulkCreateDelhiveryShipments(eligibleIds);
      if (response) {
        setResults({
          processedCount: response.processedCount ?? response.shippedCount ?? 0,
          shippedCount: response.shippedCount ?? response.processedCount ?? 0,
          skippedCount: (response.skippedCount ?? 0) + (selectedOrders.length - eligibleIds.length),
          failedCount: response.failedCount ?? 0,
          items: response.results || [],
          message: response.message || 'Shipments processed',
        });
      }
    } catch (err: any) {
      setResults({
        processedCount: 0,
        shippedCount: 0,
        skippedCount: selectedOrders.length - eligibleIds.length,
        failedCount: eligibleIds.length,
        items: eligibleIds.map((id) => ({
          orderId: id,
          status: 'failed',
          success: false,
          reason: err?.message || 'Failed to create shipment',
          message: err?.message || 'Failed to create shipment',
        })),
        message: err?.message || 'An error occurred while creating shipments',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteAndClose = () => {
    onSuccess();
    setResults(null);
    onClose();
  };

  const handleModalClose = () => {
    if (loading) return;
    if (results && results.shippedCount > 0) {
      onSuccess();
    }
    setResults(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title="Bulk Create Delhivery Shipments"
      width="max-w-2xl"
    >
      <div className="p-6">
        {/* Results View */}
        {results ? (
          <div className="space-y-4">
            <div className="text-center pb-2">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${results.shippedCount > 0
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-rose-100 text-rose-600'
                  }`}
              >
                {results.shippedCount > 0 ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <AlertCircle className="w-6 h-6" />
                )}
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                {results.shippedCount > 0
                  ? 'Shipments Created Successfully!'
                  : 'Shipment Creation Incomplete'}
              </h3>
              <p className="text-xs text-gray-500 mt-1">{results.message}</p>
            </div>

            {/* Results Pill Cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-center">
                <span className="text-xs text-emerald-700 font-medium block">
                  Shipped (AWB Generated)
                </span>
                <span className="text-lg font-bold text-emerald-700">
                  {results.shippedCount}
                </span>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
                <span className="text-xs text-gray-600 font-medium block">Skipped</span>
                <span className="text-lg font-bold text-gray-700">
                  {results.skippedCount}
                </span>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-center">
                <span className="text-xs text-rose-700 font-medium block">Failed</span>
                <span className="text-lg font-bold text-rose-700">
                  {results.failedCount}
                </span>
              </div>
            </div>

            {/* Detailed Items List */}
            {results.items && results.items.length > 0 && (
              <div className="space-y-2 mt-3">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Shipment Processing Details:
                </p>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {results.items.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 ${item.success
                          ? 'bg-emerald-50/50 border-emerald-200'
                          : item.status === 'skipped'
                            ? 'bg-gray-50 border-gray-200 text-gray-700'
                            : 'bg-rose-50/50 border-rose-200 text-rose-900'
                        }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {item.success ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        ) : item.status === 'skipped' ? (
                          <Info className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                        )}
                        <div className="truncate">
                          <span className="font-bold text-gray-900">
                            {item.orderNumber || `Order #${item.orderId}`}
                          </span>
                          <span className="text-gray-500 ml-2">
                            {item.reason || item.message}
                          </span>
                        </div>
                      </div>

                      {item.waybill && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="font-mono font-bold bg-white text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded shadow-2xs">
                            {item.waybill}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyWaybill(item.waybill!)}
                            className="text-gray-500 hover:text-indigo-600 p-1 rounded hover:bg-white transition cursor-pointer"
                            title="Copy Waybill"
                          >
                            {copiedWaybill === item.waybill ? (
                              <span className="text-[10px] text-emerald-600 font-bold">
                                Copied!
                              </span>
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={handleCompleteAndClose}
                className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Confirmation / Preparation View */
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Generate Shipments for Selected Orders
                </h3>
                <p className="text-xs text-gray-500">
                  Delhivery courier shipments will be created for all confirmed orders.
                </p>
              </div>
            </div>

            {/* Summary Stat Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
                <span className="text-xs text-gray-500 block">Selected</span>
                <span className="text-base font-bold text-gray-800">
                  {selectedOrders.length}
                </span>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 text-center">
                <span className="text-xs text-indigo-700 font-semibold block">
                  Ready to Ship
                </span>
                <span className="text-base font-bold text-indigo-700">
                  {eligibleOrders.length}
                </span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-center">
                <span className="text-xs text-emerald-700 block">Already Shipped</span>
                <span className="text-base font-bold text-emerald-700">
                  {alreadyShippedOrders.length}
                </span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-center">
                <span className="text-xs text-amber-700 block">Pending Acceptance</span>
                <span className="text-base font-bold text-amber-700">
                  {pendingOrders.length}
                </span>
              </div>
            </div>

            {/* Information Banner */}
            <div className="bg-indigo-50/80 border border-indigo-200 rounded-lg p-3 text-xs text-indigo-950">
              <p className="font-semibold mb-1">
                {eligibleOrders.length} accepted order{eligibleOrders.length === 1 ? '' : 's'} will be registered with Delhivery.
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-indigo-800">
                <li>Automatic AWB tracking numbers will be assigned</li>
                <li>Order status will update to <span className="font-semibold text-indigo-950">Shipped</span></li>
                <li>Customers will receive an automated dispatch email with tracking details</li>
              </ul>
            </div>

            {/* Ineligible Warning if any */}
            {(pendingOrders.length > 0 || cancelledOrders.length > 0 || alreadyShippedOrders.length > 0) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Note on skipped orders:</span>
                  <span className="ml-1">
                    {pendingOrders.length > 0 && `${pendingOrders.length} pending order(s) must be accepted first. `}
                    {alreadyShippedOrders.length > 0 && `${alreadyShippedOrders.length} order(s) are already shipped. `}
                    {cancelledOrders.length > 0 && `${cancelledOrders.length} order(s) are cancelled. `}
                    These will be safely ignored.
                  </span>
                </div>
              </div>
            )}

            {/* Eligible Orders Preview */}
            {eligibleOrders.length > 0 ? (
              <div>
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Orders to be Dispatched ({eligibleOrders.length}):
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                  {eligibleOrders.map((o) => {
                    const orderNum = o.order_number || o.orderNumber || `ORD-${o.id}`;
                    const custName = o.user?.name || 'Customer';
                    const itemsCount = (o.order_items || o.orderItems || []).length;
                    const isCod = (o.payment_method || o.paymentMethod) === 'cash_on_delivery';

                    return (
                      <div
                        key={o.id}
                        className="bg-white border border-gray-200 rounded-md p-2 flex items-center justify-between text-xs hover:border-indigo-300 transition"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                            {orderNum}
                          </span>
                          <span className="text-gray-900 font-medium">{custName}</span>
                          <span className="text-gray-400">({itemsCount} items)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded font-semibold text-[11px] ${isCod
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                          >
                            {isCod ? 'COD' : 'Prepaid'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center text-xs text-amber-800">
                <AlertCircle className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                <p className="font-bold">No eligible orders selected</p>
                <p className="text-amber-700 mt-0.5">
                  Shipments can only be created for orders in <strong>Confirmed (Accepted)</strong> or <strong>Processing</strong> status that do not already have an active waybill.
                </p>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateBulkShipments}
                disabled={loading || eligibleOrders.length === 0}
                className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-sm flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating Shipments...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      Create {eligibleOrders.length} Shipment
                      {eligibleOrders.length === 1 ? '' : 's'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default BulkCreateShipmentModal;
