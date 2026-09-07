"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { FaWhatsapp } from "react-icons/fa";
import { CheckCircle, Loader2, Phone } from "lucide-react";
import SuccessMessage from "@/components/(sheared)/SuccessMessage";
import ErrorMessage from "@/components/(sheared)/ErrorMessage";
import ProtectedRoute from "@/components/(sheared)/ProtectedRoute";
import { fetchSettings, upsertSetting } from "../../../../../utils/settingsApi";

type WhatsAppFormData = {
    whatsapp_number: string;
};

function SettingsPage() {
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<WhatsAppFormData>({
        defaultValues: { whatsapp_number: "" },
    });

    const currentNumber = watch("whatsapp_number");

    useEffect(() => {
        const loadSetting = async () => {
            try {
                const settings = await fetchSettings();
                const entry = Array.isArray(settings)
                    ? settings.find((s: any) => s.key === "whatsapp_number")
                    : null;
                // Pre-fill with saved value or default to "91"
                setValue("whatsapp_number", entry?.value || "91");
            } catch {
                setValue("whatsapp_number", "91");
            } finally {
                setIsLoading(false);
            }
        };
        loadSetting();
    }, [setValue]);

    const onSubmit = async (data: WhatsAppFormData) => {
        setIsSubmitting(true);
        try {
            // Strip non-digits then ensure country code 91 is prepended if missing
            let number = data.whatsapp_number.replace(/\D/g, "");
            if (!number.startsWith("91") || number.length <= 10) {
                number = "91" + number.replace(/^91/, "");
            }
            await upsertSetting("whatsapp_number", number);
            setValue("whatsapp_number", number);
            setSuccessMessage("WhatsApp number updated successfully!");
        } catch {
            setErrorMessage("Failed to update WhatsApp number. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const previewUrl = currentNumber
        ? `https://wa.me/${currentNumber.replace(/\D/g, "")}`
        : null;

    return (
        <div className="p-4 md:p-6 max-w-2xl mx-auto">
            {successMessage && (
                <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />
            )}
            {errorMessage && (
                <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />
            )}

            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <FaWhatsapp className="text-[#25D366] text-3xl" />
                    Settings
                </h1>
                <p className="text-gray-500 mt-1 text-sm">
                    Manage application settings and integrations.
                </p>
            </div>

            {/* WhatsApp Settings Card */}
            <div className="bg-white rounded-2xl shadow border border-gray-200 overflow-hidden">
                {/* Card Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#25D366]/10 rounded-xl flex items-center justify-center">
                        <FaWhatsapp className="text-[#25D366] text-xl" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-gray-900">WhatsApp Contact</h2>
                        <p className="text-xs text-gray-500">
                            This number will be shown on the floating WhatsApp button across all pages.
                        </p>
                    </div>
                </div>

                {/* Card Body */}
                <div className="px-6 py-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    WhatsApp Number
                                    <span className="text-red-500 ml-1">*</span>
                                </label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        {...register("whatsapp_number", {
                                            required: "WhatsApp number is required",
                                            pattern: {
                                                value: /^[0-9]{10,15}$/,
                                                message:
                                                    "Enter a valid number with country code (10–15 digits, no spaces or symbols)",
                                            },
                                        })}
                                        type="text"
                                        placeholder="e.g. 919729310456 (country code + number)"
                                        className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all ${errors.whatsapp_number
                                                ? "border-red-400 focus:ring-2 focus:ring-red-100"
                                                : "border-gray-300 focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20"
                                            }`}
                                    />
                                </div>
                                {errors.whatsapp_number && (
                                    <p className="text-red-500 text-xs mt-1">
                                        {errors.whatsapp_number.message}
                                    </p>
                                )}
                                <p className="text-gray-400 text-xs mt-1">
                                    Include country code without &apos;+&apos;. Example: <strong>919729310456</strong> for India (+91).
                                </p>
                            </div>

                            {/* Preview */}
                            {previewUrl && (
                                <div className="flex items-center gap-2 bg-[#25D366]/5 border border-[#25D366]/20 rounded-xl px-4 py-3">
                                    <FaWhatsapp className="text-[#25D366] text-lg flex-shrink-0" />
                                    <span className="text-sm text-gray-600">
                                        Chat link:{" "}
                                        <a
                                            href={previewUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#25D366] font-medium underline break-all"
                                        >
                                            {previewUrl}
                                        </a>
                                    </span>
                                </div>
                            )}

                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="w-4 h-4" />
                                            Save Changes
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function Settings() {
    return (
        <ProtectedRoute>
            <SettingsPage />
        </ProtectedRoute>
    );
}
