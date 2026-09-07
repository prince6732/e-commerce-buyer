import React, { useState } from 'react';
import { MapPin, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { checkServiceability, ServiceabilityResponse } from '../../utils/delhiveryApi';

type ServiceabilityCheckerProps = {
  pincode: string;
  onServiceabilityCheck?: (isServiceable: boolean) => void;
};

const ServiceabilityChecker: React.FC<ServiceabilityCheckerProps> = ({
  pincode,
  onServiceabilityCheck
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ServiceabilityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const handleCheck = async () => {
    if (!pincode || pincode.length !== 6) {
      setError('Please enter a valid 6-digit pincode');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setChecked(true);

      const response = await checkServiceability(pincode);
      setResult(response);

      if (onServiceabilityCheck) {
        onServiceabilityCheck(response.serviceable);
      }
    } catch (err: any) {
      setError(err?.error || err?.message || 'Failed to check serviceability');
      setResult(null);

      if (onServiceabilityCheck) {
        onServiceabilityCheck(false);
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-check when pincode becomes 6 digits
  React.useEffect(() => {
    if (pincode && pincode.length === 6 && !checked) {
      handleCheck();
    }
  }, [pincode]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Checking delivery availability...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 text-sm text-red-600 p-3 bg-red-50 border border-red-200 rounded-lg">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold">Unable to check delivery</p>
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!result || !checked) {
    return null;
  }

  if (result.serviceable) {
    return (
      <div className="flex items-start gap-2 text-sm p-3 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-green-900">
            ✓ Delivery Available
          </p>
          <p className="text-green-700 mt-1">
            We deliver to this location via Delhivery courier
          </p>

          {result.estimated_delivery_days && (
            <p className="text-green-600 text-xs mt-2">
              <MapPin className="w-3 h-3 inline mr-1" />
              Estimated delivery: {result.estimated_delivery_days} days
            </p>
          )}

          <div className="flex gap-4 mt-2 text-xs">
            {result.cod_available && (
              <span className="text-green-600">✓ COD Available</span>
            )}
            {result.prepaid_available && (
              <span className="text-green-600">✓ Prepaid Available</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 text-sm p-3 bg-red-50 border border-red-200 rounded-lg">
      <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-semibold text-red-900">
          Delivery Not Available
        </p>
        <p className="text-red-700 mt-1">
          Sorry, we currently don't deliver to this pincode.
        </p>
        <p className="text-red-600 text-xs mt-2">
          Please try a different delivery address or contact support for assistance.
        </p>
      </div>
    </div>
  );
};

export default ServiceabilityChecker;
