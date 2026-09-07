import React, { useState } from 'react';
import { Loader2, Package, Truck, AlertCircle, CheckCircle } from 'lucide-react';
import { createDelhiveryShipment } from '../../utils/delhiveryApi';
import Modal from './(sheared)/Modal';

type CreateShipmentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orderId: number | string;
  orderNumber: string;
  onSuccess: () => void;
};

const CreateShipmentModal: React.FC<CreateShipmentModalProps> = ({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleCreateShipment = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await createDelhiveryShipment(orderId);
      setSuccess(`Shipment created successfully! Waybill: ${response.waybill}`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err?.message || err?.error || 'Failed to create shipment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Create Shipment - Order #${orderNumber}`}
      width="max-w-md"
    >
      <div className="space-y-4">
        {!success && !error && (
          <>
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Before creating shipment:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Ensure order has complete shipping address</li>
                  <li>Verify customer phone number is correct</li>
                  <li>Check product is ready for pickup</li>
                  <li>Package is properly sealed and labeled</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Truck className="w-5 h-5 text-gray-600" />
              <div className="text-sm">
                <p className="font-semibold text-gray-800">Delhivery Courier</p>
                <p className="text-gray-600">Will generate waybill number for tracking</p>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-800">
              <p className="font-semibold mb-1">Error</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-green-800">
              <p className="font-semibold mb-1">Success!</p>
              <p>{success}</p>
            </div>
          </div>
        )}

        {/* Footer Buttons */}
        {!success && (
          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateShipment}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  Create Shipment
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default CreateShipmentModal;
