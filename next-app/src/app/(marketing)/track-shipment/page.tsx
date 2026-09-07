"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Loader2, Package, AlertCircle } from 'lucide-react';
import TrackingTimeline from '@/components/TrackingTimeline';
import { DelhiveryTrackingData, trackByWaybill } from '../../../../utils/delhiveryApi';
import ErrorMessage from '@/components/(sheared)/ErrorMessage';
import SuccessMessage from '@/components/(sheared)/SuccessMessage';
import { useLoader } from '@/context/LoaderContext';

function PublicTrackingContent() {
    const searchParams = useSearchParams();
    const [waybill, setWaybill] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [trackingData, setTrackingData] = useState<DelhiveryTrackingData | null>(null);
    const [searched, setSearched] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const { showLoader, hideLoader } = useLoader();

    useEffect(() => {
        const qAwb = searchParams.get('waybill') || searchParams.get('awb') || searchParams.get('tracking_id') || searchParams.get('id');
        if (qAwb && !waybill) {
            setWaybill(qAwb);
            executeTrack(qAwb);
        }
    }, [searchParams]);

    const executeTrack = async (awbNumber: string) => {
        if (!awbNumber.trim()) {
            setError('Please enter a waybill number');
            setErrorMessage('Please enter a waybill number');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            setSearched(true);
            setErrorMessage(null);
            showLoader();

            const response = await trackByWaybill(awbNumber.trim());
            setTrackingData(response.tracking_data);
            setSuccessMessage('Shipment tracking information loaded successfully!');
        } catch (err: any) {
            const errorMsg = err?.error || err?.message || 'Failed to fetch tracking information';
            setError(errorMsg);
            setErrorMessage(errorMsg);
            setTrackingData(null);
        } finally {
            setLoading(false);
            hideLoader();
        }
    };

    const handleTrack = async (e: React.FormEvent) => {
        e.preventDefault();
        await executeTrack(waybill);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 py-12 px-4">
            {errorMessage && <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />}
            {successMessage && <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />}
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center p-4 bg-blue-100 rounded-full mb-4">
                        <Package className="w-12 h-12 text-blue-600" />
                    </div>
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">
                        Track Your Shipment
                    </h1>
                    <p className="text-gray-600">
                        Enter your waybill number to track your package in real-time
                    </p>
                </div>

                {/* Search Form */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                    <form onSubmit={handleTrack} className="space-y-4">
                        <div>
                            <label htmlFor="waybill" className="block text-sm font-medium text-gray-700 mb-2">
                                Waybill Number
                            </label>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    id="waybill"
                                    value={waybill}
                                    onChange={(e) => setWaybill(e.target.value)}
                                    placeholder="Enter waybill number (e.g., DEL2025121012345)"
                                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    disabled={loading}
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !waybill.trim()}
                                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors font-medium cursor-pointer"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Tracking...
                                        </>
                                    ) : (
                                        <>
                                            <Search className="w-5 h-5" />
                                            Track
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-blue-800">
                                <p className="font-semibold mb-1">Where to find your waybill number?</p>
                                <p>Your waybill number can be found in your order confirmation email or on your shipping label.</p>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <h3 className="text-lg font-semibold text-red-900 mb-1">
                                    Unable to Track Shipment
                                </h3>
                                <p className="text-red-800">{error}</p>
                                <p className="text-sm text-red-700 mt-2">
                                    Please verify your waybill number and try again.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tracking Results */}
                {trackingData && (
                    <TrackingTimeline trackingData={trackingData} />
                )}

                {/* No Results */}
                {searched && !trackingData && !loading && !error && (
                    <div className="bg-white rounded-lg shadow-md p-8">
                        <div className="flex flex-col items-center justify-center text-gray-500">
                            <Package className="w-16 h-16 mb-4 text-gray-300" />
                            <p className="text-lg font-semibold mb-2">No Tracking Information Found</p>
                            <p className="text-sm text-center">
                                We couldn't find any tracking information for this waybill number.
                            </p>
                        </div>
                    </div>
                )}

                {/* Info Cards */}
                {!searched && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                        <div className="bg-white rounded-lg shadow-md p-6 text-center">
                            <div className="inline-flex items-center justify-center p-3 bg-green-100 rounded-full mb-4">
                                <Package className="w-6 h-6 text-green-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Real-Time Updates</h3>
                            <p className="text-sm text-gray-600">
                                Get live updates on your package location and status
                            </p>
                        </div>

                        <div className="bg-white rounded-lg shadow-md p-6 text-center">
                            <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-full mb-4">
                                <Search className="w-6 h-6 text-blue-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Easy Tracking</h3>
                            <p className="text-sm text-gray-600">
                                Simply enter your waybill number to track your shipment
                            </p>
                        </div>

                        <div className="bg-white rounded-lg shadow-md p-6 text-center">
                            <div className="inline-flex items-center justify-center p-3 bg-purple-100 rounded-full mb-4">
                                <AlertCircle className="w-6 h-6 text-purple-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Detailed History</h3>
                            <p className="text-sm text-gray-600">
                                View complete scan history with locations and timestamps
                            </p>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-12 text-center">
                    <p className="text-sm text-gray-500">
                        Powered by <span className="font-semibold">Delhivery</span> •
                        Need help? <a href="/contact-us" className="text-blue-600 hover:text-blue-700 font-medium">Contact Support</a>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function PublicTrackingPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <PublicTrackingContent />
        </Suspense>
    );
}

