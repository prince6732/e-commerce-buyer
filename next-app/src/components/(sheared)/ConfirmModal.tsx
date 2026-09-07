"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info, CheckCircle2, AlertCircle, X, Loader2 } from "lucide-react";

export type ConfirmVariant = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmVariant;
    badge?: string;
    loading?: boolean;
}

const variantConfig: Record<ConfirmVariant, {
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    confirmBtnBg: string;
    confirmBtnHover: string;
    badgeBg: string;
    badgeColor: string;
}> = {
    danger: {
        icon: <AlertTriangle className="w-6 h-6 text-rose-600" />,
        iconBg: "bg-rose-100 ring-8 ring-rose-50",
        iconColor: "text-rose-600",
        confirmBtnBg: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200",
        confirmBtnHover: "hover:bg-rose-700",
        badgeBg: "bg-rose-50 border-rose-200",
        badgeColor: "text-rose-700",
    },
    warning: {
        icon: <AlertCircle className="w-6 h-6 text-amber-600" />,
        iconBg: "bg-amber-100 ring-8 ring-amber-50",
        iconColor: "text-amber-600",
        confirmBtnBg: "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200",
        confirmBtnHover: "hover:bg-amber-700",
        badgeBg: "bg-amber-50 border-amber-200",
        badgeColor: "text-amber-700",
    },
    info: {
        icon: <Info className="w-6 h-6 text-blue-600" />,
        iconBg: "bg-blue-100 ring-8 ring-blue-50",
        iconColor: "text-blue-600",
        confirmBtnBg: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200",
        confirmBtnHover: "hover:bg-blue-700",
        badgeBg: "bg-blue-50 border-blue-200",
        badgeColor: "text-blue-700",
    },
    success: {
        icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
        iconBg: "bg-emerald-100 ring-8 ring-emerald-50",
        iconColor: "text-emerald-600",
        confirmBtnBg: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200",
        confirmBtnHover: "hover:bg-emerald-700",
        badgeBg: "bg-emerald-50 border-emerald-200",
        badgeColor: "text-emerald-700",
    },
};

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "danger",
    badge,
    loading = false,
}: ConfirmModalProps) {
    const config = variantConfig[variant] || variantConfig.danger;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => !loading && onClose()}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />

                    {/* Modal Dialog Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 15 }}
                        transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
                        className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 overflow-hidden z-10"
                    >
                        {/* Close button */}
                        <button
                            onClick={() => !loading && onClose()}
                            disabled={loading}
                            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition disabled:opacity-40"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="flex flex-col items-center text-center">
                            {/* Animated Icon with subtle aura */}
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${config.iconBg}`}>
                                {config.icon}
                            </div>

                            {/* Badge */}
                            {badge && (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border mb-3 ${config.badgeBg} ${config.badgeColor}`}>
                                    {badge}
                                </span>
                            )}

                            {/* Title */}
                            <h3 className="text-lg font-bold text-slate-900 mb-2">
                                {title}
                            </h3>

                            {/* Message / Details */}
                            <div className="text-sm text-slate-600 leading-relaxed mb-6">
                                {typeof message === "string" ? <p>{message}</p> : message}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3 w-full">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={loading}
                                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-sm transition shadow-sm disabled:opacity-50"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    type="button"
                                    onClick={onConfirm}
                                    disabled={loading}
                                    className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition shadow-md flex items-center justify-center gap-2 disabled:opacity-60 ${config.confirmBtnBg}`}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <span>{confirmText}</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
