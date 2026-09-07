"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  X,
  RotateCcw,
  RefreshCw,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  Upload,
  ChevronRight,
  ChevronLeft,
  Truck,
  ShieldCheck,
} from "lucide-react";
import { returnApi } from "../../../utils/returnApi";
import { uploadImage } from "../../../utils/fileApi";
import imgPlaceholder from "@/public/imagePlaceholder.png";

const basePath = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";

interface ReturnModalProps {
  order: any;
  eligibility: any;
  onClose: () => void;
  onSuccess: (returnReq: any) => void;
}

const REASONS = [
  { value: "defective_damaged", label: "Defective or Damaged Product" },
  { value: "wrong_item_received", label: "Wrong Item / Variant Received" },
  { value: "size_fit_issue", label: "Size / Fit Issue" },
  { value: "quality_not_expected", label: "Quality Not as Expected" },
  { value: "different_from_description", label: "Item Different from Description" },
  { value: "missing_parts", label: "Missing Parts or Accessories" },
  { value: "other", label: "Other Reasons" },
];

export default function ReturnRequestModal({
  order,
  eligibility,
  onClose,
  onSuccess,
}: ReturnModalProps) {
  const eligibleItems = eligibility?.items || [];
  const isPrepaid = order.payment_method !== "cash_on_delivery" && order.payment_status === "paid";

  // Step management (1: Items, 2: Type & Refund/Exchange, 3: Reason & Photos, 4: Pickup Address)
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected items: map of orderItemId -> { quantity: number, exchangeVariantId?: number }
  const [selectedItems, setSelectedItems] = useState<
    Record<number, { quantity: number; exchangeVariantId?: number }>
  >(() => {
    const initial: Record<number, { quantity: number; exchangeVariantId?: number }> = {};
    if (eligibleItems.length > 0) {
      initial[eligibleItems[0].orderItemId] = {
        quantity: 1,
        exchangeVariantId: eligibleItems[0].exchangeVariants?.[0]?.variantId,
      };
    }
    return initial;
  });

  const [returnType, setReturnType] = useState<"return" | "exchange">("return");
  const [refundMode, setRefundMode] = useState<"original_source" | "bank_transfer_upi">(
    isPrepaid ? "original_source" : "bank_transfer_upi"
  );

  // Bank details for COD
  const [bankDetails, setBankDetails] = useState({
    account_holder: "",
    account_number: "",
    ifsc_code: "",
    bank_name: "",
    upi_id: "",
  });

  // Reason & photos
  const [reason, setReason] = useState(REASONS[0].value);
  const [reasonDetails, setReasonDetails] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Pickup address
  const [pickupAddress, setPickupAddress] = useState({
    name: order.shipping_address?.name || order.user?.name || "Customer",
    phone: String(order.shipping_address?.phone || order.user?.phone_number || ""),
    address: order.shipping_address?.address || order.shipping_address?.street || String(order.shipping_address || ""),
    city: order.shipping_address?.city || "",
    state: order.shipping_address?.state || "",
    pincode: order.shipping_address?.pin || order.shipping_address?.pincode || "",
  });

  // Handle item toggle
  const toggleItem = (itemId: number, maxQty: number, firstVariantId?: number) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[itemId]) {
        delete next[itemId];
      } else {
        next[itemId] = { quantity: 1, exchangeVariantId: firstVariantId };
      }
      return next;
    });
  };

  const updateItemQty = (itemId: number, qty: number, maxQty: number) => {
    if (qty < 1 || qty > maxQty) return;
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantity: qty },
    }));
  };

  const updateExchangeVariant = (itemId: number, variantId: number) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], exchangeVariantId: variantId },
    }));
  };

  // Image Upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploadingImage(true);
      setErrorMsg(null);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        const res = await uploadImage(formData);
        if (res?.result) {
          const imgUrl = res.result;
          setImages((prev) => [...prev, imgUrl]);
        }
      }
    } catch (err: any) {
      setErrorMsg("Failed to upload image. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate estimated refund
  const calculateRefundTotal = () => {
    return Object.entries(selectedItems).reduce((sum, [itemIdStr, data]) => {
      const item = eligibleItems.find((it: any) => String(it.orderItemId) === itemIdStr);
      if (!item) return sum;
      return sum + (item.unitPrice || 0) * data.quantity;
    }, 0);
  };

  // Step validation
  const validateStep = (currentStep: number): boolean => {
    setErrorMsg(null);
    if (currentStep === 1) {
      if (Object.keys(selectedItems).length === 0) {
        setErrorMsg("Please select at least one item to proceed.");
        return false;
      }
    } else if (currentStep === 2) {
      if (returnType === "exchange") {
        for (const [itemIdStr, data] of Object.entries(selectedItems)) {
          if (!data.exchangeVariantId) {
            const item = eligibleItems.find((it: any) => String(it.orderItemId) === itemIdStr);
            setErrorMsg(`Please select a replacement size/variant for "${item?.productName}".`);
            return false;
          }
        }
      } else {
        if (!isPrepaid && refundMode === "bank_transfer_upi") {
          if (!bankDetails.upi_id && (!bankDetails.account_number || !bankDetails.ifsc_code)) {
            setErrorMsg("Please provide your UPI ID or Bank Account Details for refund transfer.");
            return false;
          }
        }
      }
    } else if (currentStep === 3) {
      if (!reason) {
        setErrorMsg("Please select a reason for your return.");
        return false;
      }
    } else if (currentStep === 4) {
      if (!pickupAddress.name || !pickupAddress.phone || !pickupAddress.address || !pickupAddress.pincode) {
        setErrorMsg("Please complete all required fields for the pickup address.");
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep((s) => s + 1);
    }
  };

  const prevStep = () => {
    setErrorMsg(null);
    setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    setSubmitting(true);
    setErrorMsg(null);

    const itemsPayload = Object.entries(selectedItems).map(([itemIdStr, data]) => ({
      order_item_id: Number(itemIdStr),
      quantity: data.quantity,
      exchange_variant_id: returnType === "exchange" ? data.exchangeVariantId : undefined,
    }));

    try {
      const response = await returnApi.requestReturn({
        order_id: order.id,
        return_type: returnType,
        reason,
        reason_details: reasonDetails,
        items: itemsPayload,
        customer_images: images,
        refund_mode: returnType === "return" ? refundMode : undefined,
        bank_details: returnType === "return" && !isPrepaid ? bankDetails : undefined,
        pickup_address: pickupAddress,
      });

      onSuccess(response);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || "Failed to submit return request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-8 border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-[#ff9903] flex items-center justify-center border border-orange-500/30">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Request Return / Exchange</h2>
              <p className="text-xs text-gray-400 font-mono">Order #{order.order_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Indicator */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs">
          {[
            { num: 1, label: "Select Items" },
            { num: 2, label: "Type & Method" },
            { num: 3, label: "Reason & Photos" },
            { num: 4, label: "Pickup Address" },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] transition-all ${
                  step === s.num
                    ? "bg-[#007FFF] text-white shadow-sm ring-2 ring-blue-200"
                    : step > s.num
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {step > s.num ? "✓" : s.num}
              </div>
              <span className={`hidden sm:inline font-medium ${step === s.num ? "text-blue-600 font-bold" : "text-gray-500"}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: SELECT ITEMS */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Select Items to Return / Exchange</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Items eligible under our 7-day return policy window.
                </p>
              </div>

              <div className="space-y-3">
                {eligibleItems.map((item: any) => {
                  const isSelected = !!selectedItems[item.orderItemId];
                  const currentQty = selectedItems[item.orderItemId]?.quantity || 1;
                  const maxQty = item.availableReturnQuantity || item.returnable_quantity || 1;

                  return (
                    <div
                      key={item.orderItemId}
                      className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                        isSelected
                          ? "border-[#007FFF] bg-blue-50/40 shadow-sm ring-1 ring-blue-100"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            toggleItem(
                              item.orderItemId,
                              maxQty,
                              item.exchangeVariants?.[0]?.variantId
                            )
                          }
                          className="w-5 h-5 rounded text-[#007FFF] focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="relative w-16 h-16 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0">
                          <Image
                            src={`${basePath}${item.imageUrl || imgPlaceholder.src}`}
                            alt={item.productName}
                            fill
                            unoptimized
                            className="object-contain p-1"
                          />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{item.productName}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-700 font-medium">
                              {item.variantTitle || "Standard"}
                            </span>
                            <span className="text-xs font-bold text-gray-900">₹{item.unitPrice}</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1">
                            Available to return: <strong className="text-gray-800">{maxQty} unit(s)</strong>
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="flex items-center gap-2 self-end sm:self-center bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm">
                          <span className="text-xs text-gray-500 font-medium mr-1">Qty:</span>
                          <button
                            type="button"
                            onClick={() => updateItemQty(item.orderItemId, currentQty - 1, maxQty)}
                            disabled={currentQty <= 1}
                            className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-800 font-bold flex items-center justify-center text-xs"
                          >
                            -
                          </button>
                          <span className="font-bold text-sm text-gray-900 w-5 text-center">{currentQty}</span>
                          <button
                            type="button"
                            onClick={() => updateItemQty(item.orderItemId, currentQty + 1, maxQty)}
                            disabled={currentQty >= maxQty}
                            className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-800 font-bold flex items-center justify-center text-xs"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: RETURN TYPE & REFUND / EXCHANGE */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Select Return Type</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Would you like a direct refund or an exchange for another size/variant?
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setReturnType("return")}
                  className={`p-5 rounded-2xl border text-left transition-all ${
                    returnType === "return"
                      ? "border-[#007FFF] bg-blue-50/50 shadow-md ring-2 ring-blue-100"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#007FFF] flex items-center justify-center mb-3">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm">Return for Refund</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Receive 100% refund (₹{calculateRefundTotal().toLocaleString()}) to your original payment mode or bank.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setReturnType("exchange")}
                  className={`p-5 rounded-2xl border text-left transition-all ${
                    returnType === "exchange"
                      ? "border-purple-600 bg-purple-50/50 shadow-md ring-2 ring-purple-100"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-3">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm">Size / Variant Exchange</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Swap your item for a different size or color with zero extra delivery fee.
                  </p>
                </button>
              </div>

              {/* Exchange Variant Picker */}
              {returnType === "exchange" && (
                <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-100 space-y-4">
                  <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wide">
                    Choose Replacement Variants
                  </h4>
                  {Object.entries(selectedItems).map(([itemIdStr, data]) => {
                    const item = eligibleItems.find((it: any) => String(it.orderItemId) === itemIdStr);
                    if (!item) return null;
                    const variantsList = item.exchangeVariants || [];

                    return (
                      <div key={itemIdStr} className="bg-white p-3.5 rounded-xl border border-purple-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-900 line-clamp-1">{item.productName}</span>
                          <span className="text-[11px] text-gray-500">Current: {item.variantTitle}</span>
                        </div>

                        {variantsList.length > 0 ? (
                          <select
                            value={data.exchangeVariantId || ""}
                            onChange={(e) =>
                              updateExchangeVariant(Number(itemIdStr), Number(e.target.value))
                            }
                            className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 bg-white text-gray-800 font-medium"
                          >
                            {variantsList.map((v: any) => (
                              <option key={v.variantId} value={v.variantId}>
                                {v.title} (In Stock: {v.stock}) - ₹{v.price}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-xs text-red-600">
                            No alternative variants currently in stock for this product. Please choose refund.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Refund Mode / Bank Details Picker */}
              {returnType === "return" && (
                <div className="space-y-4">
                  {isPrepaid ? (
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3">
                      <CreditCard className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h5 className="font-bold text-emerald-900 text-sm">Original Payment Method</h5>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          Since this order was paid online, the refund of ₹{calculateRefundTotal().toLocaleString()} will be automatically processed back to your original payment card / UPI within 3-5 business days after QC verification.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                          COD Refund Payout Details
                        </h4>
                        <span className="text-xs text-blue-600 font-semibold">₹{calculateRefundTotal().toLocaleString()}</span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          UPI ID (Fastest Refund)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. yourname@oksbi / phone@paytm"
                          value={bankDetails.upi_id}
                          onChange={(e) => setBankDetails({ ...bankDetails, upi_id: e.target.value })}
                          className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>

                      <div className="relative flex py-1 items-center">
                        <div className="flex-grow border-t border-gray-200"></div>
                        <span className="flex-shrink mx-3 text-gray-400 text-[11px] uppercase font-bold">Or Bank Account</span>
                        <div className="flex-grow border-t border-gray-200"></div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-1">Account Holder Name</label>
                          <input
                            type="text"
                            placeholder="Full Name as in Passbook"
                            value={bankDetails.account_holder}
                            onChange={(e) => setBankDetails({ ...bankDetails, account_holder: e.target.value })}
                            className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-1">Account Number</label>
                          <input
                            type="text"
                            placeholder="Bank Account Number"
                            value={bankDetails.account_number}
                            onChange={(e) => setBankDetails({ ...bankDetails, account_number: e.target.value })}
                            className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-1">IFSC Code</label>
                          <input
                            type="text"
                            placeholder="e.g. SBIN0001234"
                            value={bankDetails.ifsc_code}
                            onChange={(e) => setBankDetails({ ...bankDetails, ifsc_code: e.target.value.toUpperCase() })}
                            className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white font-mono uppercase"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-1">Bank Name</label>
                          <input
                            type="text"
                            placeholder="e.g. State Bank of India"
                            value={bankDetails.bank_name}
                            onChange={(e) => setBankDetails({ ...bankDetails, bank_name: e.target.value })}
                            className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: REASON & EVIDENCE */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Reason & Photos</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Help us understand why you are returning or exchanging this item.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Primary Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white font-medium text-gray-800"
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Additional Details / Problem Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe any flaws, fit issues, or specific notes for our inspection team..."
                  value={reasonDetails}
                  onChange={(e) => setReasonDetails(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Upload Photos of the Product / Defect (Optional but speeds up approval)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 hover:border-[#007FFF] bg-gray-50 hover:bg-blue-50/40 cursor-pointer transition-all">
                    <Upload className="w-5 h-5 text-gray-400" />
                    <span className="text-[10px] text-gray-500 font-semibold mt-1">
                      {uploadingImage ? "Uploading..." : "Add Photo"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>

                  {images.map((imgUrl, idx) => (
                    <div key={idx} className="relative w-24 h-24 rounded-2xl border border-gray-200 overflow-hidden bg-gray-100">
                      <Image
                        src={`${basePath}${imgUrl}`}
                        alt={`Photo ${idx + 1}`}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/70 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: PICKUP ADDRESS */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Confirm Doorstep Pickup Address</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Our courier partner Delhivery will collect the return package from this address.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={pickupAddress.name}
                    onChange={(e) => setPickupAddress({ ...pickupAddress, name: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={pickupAddress.phone}
                    onChange={(e) => setPickupAddress({ ...pickupAddress, phone: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={pickupAddress.address}
                    onChange={(e) => setPickupAddress({ ...pickupAddress, address: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={pickupAddress.city}
                    onChange={(e) => setPickupAddress({ ...pickupAddress, city: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={pickupAddress.state}
                    onChange={(e) => setPickupAddress({ ...pickupAddress, state: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Pincode</label>
                  <input
                    type="text"
                    value={pickupAddress.pincode}
                    onChange={(e) => setPickupAddress({ ...pickupAddress, pincode: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white font-mono"
                  />
                </div>
              </div>

              {/* Summary recap box */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2 text-xs">
                <div className="flex justify-between font-semibold text-gray-800">
                  <span>Selected Type:</span>
                  <span className="capitalize text-blue-600">{returnType === "exchange" ? "Exchange" : "Return & Refund"}</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-800">
                  <span>Items Selected:</span>
                  <span>{Object.keys(selectedItems).length} item(s)</span>
                </div>
                {returnType === "return" && (
                  <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200">
                    <span>Estimated Refund:</span>
                    <span className="text-emerald-600 text-sm">₹{calculateRefundTotal().toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              disabled={submitting}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={nextStep}
              className="px-6 py-2.5 bg-[#007FFF] hover:bg-[#0066CC] text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>Continue</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Request...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Submit {returnType === "exchange" ? "Exchange" : "Return"} Request</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
