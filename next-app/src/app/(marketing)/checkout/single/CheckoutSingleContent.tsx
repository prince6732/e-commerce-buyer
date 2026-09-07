"use client";

import { useSearchParams, useRouter } from "next/navigation";
import React, { useEffect, useState, useRef } from "react";
import Script from 'next/script';
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import {
    ArrowLeft,
    MapPin,
    CreditCard,
    CheckCircle2,
    Package,
    Loader2,
    X,
    ShieldCheck,
    Truck,
    RotateCcw,
    Lock,
    User,
    Phone,
    Home,
    Building2,
    ChevronRight,
    Zap,
    Check,
    AlertCircle,
    AlertTriangle,
} from "lucide-react";
import Image from "next/image";
import { placeSingleItemOrder } from "../../../../../utils/orderApi";
import imgPlaceholder from "@/public/imagePlaceholder.png";
import axios from "../../../../../utils/axios";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Modal from "@/components/(sheared)/Modal";
import PaymentIconsStrip from "@/components/checkout/PaymentIconsStrip";
import SearchableDropdown from "@/components/(sheared)/SearchableDropdown";
import { fetchStates, fetchCitiesByState, StateItem, CityItem } from "../../../../../utils/locationApi";
import { useProductSync } from "@/context/ProductSyncContext";

const basePath = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";

const STORAGE_KEY_ADDRESS = "zelton_checkout_single_address_v2";
const STORAGE_KEY_STEP = "zelton_checkout_single_step_v2";
const STORAGE_KEY_PAYMENT = "zelton_checkout_single_payment_v2";

interface ShippingFormData {
    fullName: string;
    phoneNumber: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
}

interface Product {
    id: number;
    name: string;
    image_url: string | null;
    brand?: {
        id: number;
        name: string;
    };
    category?: {
        id: number;
        name: string;
    };
}

interface Variant {
    id: number;
    title: string;
    sku: string;
    stock: number;
    sp: number;
    mrp?: number;
    bp?: number;
    image_url: string | null;
}

import {
    INDIAN_STATES,
    validateAddressLine1,
    validateAddressLine2,
    validateCity,
    validateState,
    validatePostalCode,
    validateCountry,
    validateFullName,
    validatePhoneNumber,
    normalizeAddressInput,
} from "../../../../../utils/addressValidator";

// Yup validation schema
const shippingSchema = yup.object({
    fullName: yup
        .string()
        .transform((value) => normalizeAddressInput(value))
        .test("valid-fullname", function (value) {
            const res = validateFullName(value);
            return res.isValid || this.createError({ message: res.error });
        })
        .required("Full name is required"),
    phoneNumber: yup
        .string()
        .transform((value) => String(value || "").replace(/[^0-9]/g, ""))
        .test("valid-phone", function (value) {
            const res = validatePhoneNumber(value);
            return res.isValid || this.createError({ message: res.error });
        })
        .required("Phone number is required"),
    addressLine1: yup
        .string()
        .transform((value) => normalizeAddressInput(value))
        .test("valid-address-line1", function (value) {
            const { city, state } = this.parent;
            const res = validateAddressLine1(value, city, state);
            return res.isValid || this.createError({ message: res.error });
        })
        .required("Address Line 1 is required"),
    addressLine2: yup
        .string()
        .transform((value) => normalizeAddressInput(value))
        .test("valid-address-line2", function (value) {
            const res = validateAddressLine2(value);
            return res.isValid || this.createError({ message: res.error });
        })
        .default(""),
    city: yup
        .string()
        .transform((value) => normalizeAddressInput(value))
        .test("valid-city", function (value) {
            const res = validateCity(value);
            return res.isValid || this.createError({ message: res.error });
        })
        .required("City is required"),
    state: yup
        .string()
        .transform((value) => normalizeAddressInput(value))
        .test("valid-state", function (value) {
            const res = validateState(value);
            return res.isValid || this.createError({ message: res.error });
        })
        .required("State is required"),
    postalCode: yup
        .string()
        .transform((value) => String(value || "").trim())
        .test("valid-postal-code", function (value) {
            const res = validatePostalCode(value);
            return res.isValid || this.createError({ message: res.error });
        })
        .required("Postal code is required"),
    country: yup
        .string()
        .transform((value) => normalizeAddressInput(value))
        .test("valid-country", function (value) {
            const res = validateCountry(value);
            return res.isValid || this.createError({ message: res.error });
        })
        .required("Country is required")
        .default("India"),
}).required();

const CheckoutSingle = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();
    const { items, removeFromCart } = useCart();
    const { subscribeToProduct } = useProductSync();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('cod');
    const [product, setProduct] = useState<Product | null>(null);
    const [variant, setVariant] = useState<Variant | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [productLoading, setProductLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
    const [paymentMessage, setPaymentMessage] = useState("Verifying payment...");
    const productId = searchParams.get('productId');
    const variantId = searchParams.get('variantId');
    const initialQuantity = parseInt(searchParams.get('quantity') || '1');

    const availableStock = variant ? Number(variant.stock ?? 0) : 0;
    const isOutOfStock = variant ? availableStock <= 0 : false;
    const isInsufficientStock = !isOutOfStock && availableStock < quantity;
    const isUnavailable = isOutOfStock || isInsufficientStock;

    // State & City dynamic loading
    const [statesList, setStatesList] = useState<StateItem[]>([]);
    const [citiesList, setCitiesList] = useState<CityItem[]>([]);
    const [loadingStates, setLoadingStates] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);
    const isInitializedRef = useRef(false);

    // React Hook Form with Yup validation
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        getValues,
        formState: { errors },
    } = useForm<ShippingFormData>({
        resolver: yupResolver(shippingSchema),
        mode: "onBlur",
        reValidateMode: "onChange",
        defaultValues: {
            fullName: "",
            phoneNumber: "",
            addressLine1: "",
            addressLine2: "",
            city: "",
            state: "",
            postalCode: "",
            country: "India",
        },
    });

    // ─── 1. Restore Saved Form & Step from localStorage on Page Load ─────────
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            // Restore Address
            const savedAddressRaw = localStorage.getItem(STORAGE_KEY_ADDRESS);
            if (savedAddressRaw) {
                const parsed = JSON.parse(savedAddressRaw);
                if (parsed && typeof parsed === "object") {
                    Object.keys(parsed).forEach((k) => {
                        const val = parsed[k];
                        if (val !== undefined && val !== null) {
                            setValue(k as keyof ShippingFormData, String(val), { shouldValidate: false });
                        }
                    });
                }
            }

            // Restore Step
            const savedStep = localStorage.getItem(STORAGE_KEY_STEP);
            if (savedStep && ["1", "2", "3"].includes(savedStep)) {
                setCurrentStep(parseInt(savedStep, 10));
            }

            // Restore Payment Method
            const savedPayment = localStorage.getItem(STORAGE_KEY_PAYMENT);
            if (savedPayment === 'cod' || savedPayment === 'online') {
                setPaymentMethod(savedPayment);
            }
        } catch (err) {
            console.error("Error restoring checkout state from localStorage:", err);
        } finally {
            isInitializedRef.current = true;
        }
    }, [setValue]);

    // ─── 2. Auto-Save Form Data to localStorage on Every Change ─────────────
    const watchedValues = watch();
    useEffect(() => {
        if (!isInitializedRef.current || typeof window === "undefined") return;
        try {
            localStorage.setItem(STORAGE_KEY_ADDRESS, JSON.stringify(watchedValues));
        } catch (e) { }
    }, [watchedValues]);

    // ─── 3. Auto-Save Step to localStorage ──────────────────────────────────
    useEffect(() => {
        if (!isInitializedRef.current || typeof window === "undefined") return;
        try {
            localStorage.setItem(STORAGE_KEY_STEP, String(currentStep));
        } catch (e) { }
    }, [currentStep]);

    // ─── 4. Auto-Save Payment Method to localStorage ────────────────────────
    useEffect(() => {
        if (!isInitializedRef.current || typeof window === "undefined") return;
        try {
            localStorage.setItem(STORAGE_KEY_PAYMENT, paymentMethod);
        } catch (e) { }
    }, [paymentMethod]);

    // Auth and Product Loading
    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            router.push('/');
            return;
        }

        const orderId = searchParams.get("order_id");
        if (orderId) {
            verifyPayment(orderId);
            return;
        }

        setQuantity(initialQuantity > 0 ? initialQuantity : 1);

        if (productId && variantId) {
            fetchProductDetails();
        } else {
            router.push('/cart');
        }
    }, [user, authLoading, productId, variantId, initialQuantity, router, searchParams]);

    // Real-time stock subscription for the single product variant
    useEffect(() => {
        if (!productId) return;

        const unsubscribe = subscribeToProduct(Number(productId), (event) => {
            console.log(`⚡ [SingleCheckout] Received product event:`, event);
            if (event.action === "stock_updated") {
                if (event.variantId === undefined || Number(event.variantId) === Number(variantId)) {
                    setVariant((prev) => (prev ? { ...prev, stock: Number(event.stock ?? prev.stock) } : prev));
                }
            } else if (event.action === "updated" || event.action === "status_changed") {
                fetchProductDetails();
            }
        });

        return () => {
            unsubscribe();
        };
    }, [productId, variantId, subscribeToProduct]);

    // Set user info if form is empty
    useEffect(() => {
        if (user) {
            const currentVals = getValues();
            if (!currentVals.fullName && user.name) {
                setValue("fullName", user.name);
            }
            if (!currentVals.phoneNumber && user.phone_number) {
                setValue("phoneNumber", user.phone_number);
            }
        }
    }, [user, setValue, getValues]);

    // Fetch States on load
    useEffect(() => {
        let isMounted = true;
        (async () => {
            setLoadingStates(true);
            const list = await fetchStates();
            if (isMounted) {
                setStatesList(list);
                setLoadingStates(false);
            }
        })();
        return () => {
            isMounted = false;
        };
    }, []);

    // When state in form changes or is preset from localStorage, load cities
    const currentState = watch('state');
    useEffect(() => {
        if (!currentState || statesList.length === 0) {
            return;
        }
        const found = statesList.find(s => s.name.toLowerCase() === currentState.toLowerCase());
        if (found) {
            setLoadingCities(true);
            fetchCitiesByState(found.id).then(cities => {
                setCitiesList(cities);
                setLoadingCities(false);
            });
        }
    }, [currentState, statesList]);

    const verifyPayment = async (orderId: string) => {
        setShowPaymentModal(true);
        setPaymentStatus('verifying');
        setPaymentMessage("Verifying your payment...");

        try {
            const response = await axios.post(`/api/payment/verify`, {
                order_id: orderId
            });

            if (response.data.success && response.data.status === 'PAID') {
                setPaymentStatus('success');
                setPaymentMessage("Payment successful! Redirecting to orders...");

                // Reset saved step on success
                try {
                    localStorage.removeItem(STORAGE_KEY_STEP);
                } catch { }

                setTimeout(() => {
                    router.push('/orders?celebrate=true');
                }, 2000);
            } else {
                setPaymentStatus('failed');
                setPaymentMessage("Payment failed or pending. Please try again.");
                setTimeout(() => {
                    setShowPaymentModal(false);
                    router.replace('/cart');
                }, 3000);
            }
        } catch (error) {
            console.error("Payment verification failed:", error);
            setPaymentStatus('failed');
            setPaymentMessage("Failed to verify payment.");
            setTimeout(() => {
                setShowPaymentModal(false);
                router.replace('/cart');
            }, 3000);
        }
    };

    const fetchProductDetails = async () => {
        try {
            setProductLoading(true);
            const [productResponse, variantResponse] = await Promise.all([
                axios.get(`/api/products/${productId}`),
                axios.get(`/api/get-variant/${variantId}`)
            ]);

            if (productResponse.data.success) {
                setProduct(productResponse.data.product);
            }

            if (variantResponse.data.success) {
                setVariant(variantResponse.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch product details:", error);
            alert("Failed to load product details");
            router.push('/cart');
        } finally {
            setProductLoading(false);
        }
    };

    const handleNextStep = handleSubmit(() => {
        if (isUnavailable) {
            setErrorMessage(isOutOfStock ? "This product is currently out of stock. You cannot proceed with checkout." : `Only ${availableStock} units available in stock. Please adjust quantity.`);
            return;
        }
        if (currentStep === 1) {
            setCurrentStep(2);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (currentStep === 2) {
            setCurrentStep(3);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    const handlePreviousStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const removeProductFromCart = async () => {
        const cartItem = items.find(item =>
            item.product_id === product?.id && item.variant_id === variant?.id
        );

        if (cartItem) {
            try {
                await removeFromCart(cartItem.id);
            } catch (error) {
                console.error("Failed to remove product from cart:", error);
            }
        }
    };

    const handlePlaceOrder = handleSubmit(async (data) => {
        if (!product || !variant) {
            setErrorMessage("Product details not loaded");
            return;
        }

        if (isUnavailable) {
            setErrorMessage(isOutOfStock ? "This product is currently out of stock. Order cannot be placed." : `Only ${availableStock} units available in stock.`);
            return;
        }

        setLoading(true);
        setErrorMessage(null);
        try {
            const cleanFullName = normalizeAddressInput(data.fullName);
            const cleanPhone = String(data.phoneNumber).replace(/[^0-9]/g, '');
            const cleanLine1 = normalizeAddressInput(data.addressLine1);
            const cleanLine2 = normalizeAddressInput(data.addressLine2);
            const cleanCity = normalizeAddressInput(data.city);
            const cleanState = normalizeAddressInput(data.state);
            const cleanPin = String(data.postalCode).trim();
            const cleanCountry = normalizeAddressInput(data.country) || 'India';

            const fullStreetAddress = [cleanLine1, cleanLine2].filter(Boolean).join(', ');
            const structuredAddressObj = {
                name: cleanFullName,
                phone: cleanPhone,
                add: fullStreetAddress,
                city: cleanCity,
                state: cleanState,
                pin: cleanPin,
                country: cleanCountry,
            };
            const shippingAddress = JSON.stringify(structuredAddressObj);

            const orderData = {
                product_id: product.id,
                variant_id: variant.id,
                quantity: quantity,
                shipping_address: shippingAddress,
                billing_address: shippingAddress,
                notes: "Single product instant buy order",
                name: data.fullName || user?.name,
                phone: data.phoneNumber || user?.phone_number,
                email: user?.email,
                origin: typeof window !== 'undefined' ? window.location.origin : undefined,
                return_url: typeof window !== 'undefined' ? `${window.location.origin}/checkout/single?product_id=${product.id}&order_id={order_id}` : undefined,
            };

            if (paymentMethod === 'online') {
                try {
                    const response = await axios.post(`/api/payment/initiate`, orderData);

                    if (response.data.success) {
                        const { payment_session_id, cashfree_mode, mode } = response.data;
                        const activeMode = cashfree_mode || mode || process.env.NEXT_PUBLIC_CASHFREE_MODE || "sandbox";

                        const cashfree = typeof (window as any).Cashfree === 'function'
                            ? (window as any).Cashfree({ mode: activeMode })
                            : new (window as any).Cashfree({ mode: activeMode });

                        cashfree.checkout({
                            paymentSessionId: payment_session_id,
                            redirectTarget: "_self"
                        });
                    } else {
                        setErrorMessage(response.data.message || "Failed to initiate payment");
                        setLoading(false);
                    }
                } catch (error: any) {
                    console.error("Payment initiation failed:", error);
                    setErrorMessage(error.response?.data?.message || "Failed to initiate payment");
                    setLoading(false);
                }
                return;
            }

            // Cash on Delivery (COD) -> Directly place single item order
            const response = await placeSingleItemOrder(orderData);

            if (response.success) {
                try {
                    localStorage.removeItem(STORAGE_KEY_STEP);
                } catch { }
                await removeProductFromCart();
                router.push('/orders?celebrate=true');
            } else {
                setErrorMessage(response.message || "Failed to place order");
                setLoading(false);
            }
        } catch (error: any) {
            console.error("Order placement failed:", error);
            setErrorMessage(error.response?.data?.message || "Failed to place order. Please try again.");
            setLoading(false);
        }
    });

    const increaseQuantity = () => {
        if (variant && quantity < variant.stock) {
            setQuantity(quantity + 1);
        }
    };

    const decreaseQuantity = () => {
        if (quantity > 1) {
            setQuantity(quantity - 1);
        }
    };

    if (productLoading || authLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200/80 max-w-sm w-full">
                    <div className="w-14 h-14 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-4" />
                    <h3 className="text-base font-bold text-slate-900 mb-1">Preparing Express Checkout</h3>
                    <p className="text-xs text-slate-500">Securing your item and fetching live inventory...</p>
                </div>
            </div>
        );
    }

    if (!product || !variant) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200/80 max-w-md w-full">
                    <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Package className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Item Unavailable</h2>
                    <p className="text-sm text-slate-500 mb-6">The requested product could not be loaded. It might be sold out or moved.</p>
                    <button
                        onClick={() => router.push('/cart')}
                        className="px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition font-semibold text-sm"
                    >
                        Return to Cart
                    </button>
                </div>
            </div>
        );
    }

    // ─── Actual Product Price (NO extra delivery fees or hidden charges) ──────
    const price = Number(variant.sp || 0);
    const mrp = Number(variant.mrp || 0);
    const subtotal = price * quantity;
    const totalSavings = mrp > price ? (mrp - price) * quantity : 0;
    const finalTotal = subtotal; // EXACT ACTUAL PRICE
    const currentFormData = getValues();

    const steps = [
        { step: 1, label: "Shipping Address", icon: MapPin, desc: "Where to deliver" },
        { step: 2, label: "Payment Method", icon: CreditCard, desc: "Cash on delivery / UPI" },
        { step: 3, label: "Review & Confirm", icon: CheckCircle2, desc: "Verify details" },
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC] py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Top Express Checkout Header Bar */}
                <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="w-11 h-11 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-2xl flex items-center justify-center transition-all duration-150 flex-shrink-0 group"
                            title="Go back"
                        >
                            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Express Buy Now</h1>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 border border-amber-200/70 text-amber-800 text-[11px] font-bold rounded-full uppercase tracking-wider">
                                    <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
                                    Instant Checkout
                                </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Quick direct purchase with free express delivery</p>
                        </div>
                    </div>

                    {/* Step Breadcrumb Indicators */}
                    <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-1">
                        {steps.map(({ step, label }) => {
                            const isDone = currentStep > step;
                            const isCurrent = currentStep === step;
                            return (
                                <React.Fragment key={step}>
                                    <div
                                        onClick={() => isDone && setCurrentStep(step)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all select-none ${isCurrent
                                                ? "bg-slate-900 text-white shadow-sm"
                                                : isDone
                                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60 cursor-pointer hover:bg-emerald-100/70"
                                                    : "bg-slate-100 text-slate-400"
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isCurrent
                                                ? "bg-white text-slate-900"
                                                : isDone
                                                    ? "bg-emerald-600 text-white"
                                                    : "bg-slate-200 text-slate-500"
                                            }`}>
                                            {isDone ? <Check className="w-3 h-3 stroke-[3]" /> : step}
                                        </div>
                                        <span className="hidden sm:inline">{label}</span>
                                    </div>
                                    {step < 3 && (
                                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* Global Out of Stock Warning Banner */}
                {isUnavailable && (
                    <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start justify-between gap-3 text-red-800 text-sm shadow-sm">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-red-900">
                                    {isOutOfStock ? "Product is Currently Out of Stock" : "Insufficient Stock Available"}
                                </h4>
                                <p className="text-xs text-red-700 mt-0.5">
                                    {isOutOfStock
                                        ? "This item is currently sold out. You cannot place an order for this item."
                                        : `Only ${availableStock} units available in stock. Please adjust your order quantity to proceed.`}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error Banner */}
                {errorMessage && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start justify-between gap-3 text-rose-800 text-sm">
                        <div className="flex items-center gap-2">
                            <X className="w-5 h-5 text-rose-600 flex-shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setErrorMessage(null)}
                            className="text-rose-500 hover:text-rose-700 text-xs font-bold"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {/* Main Content Layout Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* Left Form Area (8 cols) */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* STEP 1: Shipping Address Form */}
                        {currentStep === 1 && (
                            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
                                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                                            <MapPin className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-900">Delivery Address</h2>
                                            <p className="text-xs text-slate-500">Your address is automatically saved as you type</p>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                        Step 1 of 3
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* Full Name */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Full Name <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                                <User className="w-4 h-4" />
                                            </div>
                                            <input
                                                type="text"
                                                {...register('fullName')}
                                                className={`w-full pl-10 pr-4 py-3 bg-slate-50/50 hover:bg-white focus:bg-white text-sm text-slate-900 border rounded-2xl transition duration-150 focus:outline-none focus:ring-4 focus:ring-blue-500/10 ${errors.fullName ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-blue-600'
                                                    }`}
                                                placeholder="e.g. Rahul Sharma"
                                            />
                                        </div>
                                        {errors.fullName && (
                                            <p className="text-rose-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                                                <span>•</span> {errors.fullName.message}
                                            </p>
                                        )}
                                    </div>

                                    {/* Phone Number */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Phone Number <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                                <Phone className="w-4 h-4" />
                                            </div>
                                            <input
                                                type="tel"
                                                maxLength={10}
                                                {...register('phoneNumber')}
                                                className={`w-full pl-10 pr-4 py-3 bg-slate-50/50 hover:bg-white focus:bg-white text-sm text-slate-900 border rounded-2xl transition duration-150 focus:outline-none focus:ring-4 focus:ring-blue-500/10 ${errors.phoneNumber ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-blue-600'
                                                    }`}
                                                placeholder="10-digit mobile number"
                                            />
                                        </div>
                                        {errors.phoneNumber && (
                                            <p className="text-rose-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                                                <span>•</span> {errors.phoneNumber.message}
                                            </p>
                                        )}
                                    </div>

                                    {/* Address Line 1 */}
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Address Line 1 (Flat, House No., Building, Street) <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                                <Home className="w-4 h-4" />
                                            </div>
                                            <input
                                                type="text"
                                                {...register('addressLine1')}
                                                className={`w-full pl-10 pr-4 py-3 bg-slate-50/50 hover:bg-white focus:bg-white text-sm text-slate-900 border rounded-2xl transition duration-150 focus:outline-none focus:ring-4 focus:ring-blue-500/10 ${errors.addressLine1 ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-blue-600'
                                                    }`}
                                                placeholder="e.g. Flat 402, Royal Palms, Gandhi Road"
                                            />
                                        </div>
                                        {errors.addressLine1 && (
                                            <p className="text-rose-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                                                <span>•</span> {errors.addressLine1.message}
                                            </p>
                                        )}
                                    </div>

                                    {/* Address Line 2 */}
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Address Line 2 / Landmark <span className="text-slate-400 font-normal">(Optional)</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                                <Building2 className="w-4 h-4" />
                                            </div>
                                            <input
                                                type="text"
                                                {...register('addressLine2')}
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50/50 hover:bg-white focus:bg-white text-sm text-slate-900 border border-slate-200 rounded-2xl transition duration-150 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10"
                                                placeholder="e.g. Near City Hospital, Sector 14"
                                            />
                                        </div>
                                    </div>

                                    {/* State Dropdown */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            State <span className="text-rose-500">*</span>
                                        </label>
                                        <SearchableDropdown
                                            items={statesList}
                                            placeholder={loadingStates ? "Loading states..." : "Select State"}
                                            displayProperty="name"
                                            valueProperty="name"
                                            value={watch('state')}
                                            showAddButton={false}
                                            disabled={loadingStates}
                                            error={errors.state?.message}
                                            onChange={(selectedStateName) => {
                                                setValue('state', selectedStateName, { shouldValidate: true });
                                                setValue('city', '', { shouldValidate: false });
                                            }}
                                            onSelectionChange={(selectedState) => {
                                                if (selectedState) {
                                                    setValue('state', selectedState.name, { shouldValidate: true });
                                                    setValue('city', '', { shouldValidate: false });
                                                    setLoadingCities(true);
                                                    fetchCitiesByState(selectedState.id).then(cities => {
                                                        setCitiesList(cities);
                                                        setLoadingCities(false);
                                                    });
                                                }
                                            }}
                                        />
                                        {errors.state && (
                                            <p className="text-rose-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                                                <span>•</span> {errors.state.message}
                                            </p>
                                        )}
                                    </div>

                                    {/* City Dropdown */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            City <span className="text-rose-500">*</span>
                                        </label>
                                        <SearchableDropdown
                                            items={citiesList}
                                            placeholder={
                                                !watch('state')
                                                    ? "Select state first"
                                                    : loadingCities
                                                        ? "Loading cities..."
                                                        : "Select City"
                                            }
                                            displayProperty="name"
                                            valueProperty="name"
                                            value={watch('city')}
                                            showAddButton={false}
                                            disabled={!watch('state') || loadingCities}
                                            error={errors.city?.message}
                                            onChange={(selectedCityName) => {
                                                setValue('city', selectedCityName, { shouldValidate: true });
                                            }}
                                            onSelectionChange={(selectedCity) => {
                                                if (selectedCity) {
                                                    setValue('city', selectedCity.name, { shouldValidate: true });
                                                }
                                            }}
                                        />
                                        {errors.city && (
                                            <p className="text-rose-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                                                <span>•</span> {errors.city.message}
                                            </p>
                                        )}
                                    </div>

                                    {/* Postal Code */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Postal Code (PIN) <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            maxLength={6}
                                            {...register('postalCode')}
                                            className={`w-full px-4 py-3 bg-slate-50/50 hover:bg-white focus:bg-white text-sm text-slate-900 border rounded-2xl transition duration-150 focus:outline-none focus:ring-4 focus:ring-blue-500/10 ${errors.postalCode ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-blue-600'
                                                }`}
                                            placeholder="6-digit PIN code"
                                        />
                                        {errors.postalCode && (
                                            <p className="text-rose-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                                                <span>•</span> {errors.postalCode.message}
                                            </p>
                                        )}
                                    </div>

                                    {/* Country */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Country
                                        </label>
                                        <input
                                            type="text"
                                            readOnly
                                            value="India"
                                            {...register('country')}
                                            className="w-full px-4 py-3 bg-slate-100 text-slate-600 text-sm font-semibold border border-slate-200 rounded-2xl cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                {/* Trust assurance footer */}
                                <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                                    <div className="flex flex-col items-center">
                                        <ShieldCheck className="w-5 h-5 text-emerald-600 mb-1" />
                                        <span className="text-[11px] font-bold text-slate-700">100% Genuine</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <Truck className="w-5 h-5 text-blue-600 mb-1" />
                                        <span className="text-[11px] font-bold text-slate-700">Free Express Delivery</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <RotateCcw className="w-5 h-5 text-purple-600 mb-1" />
                                        <span className="text-[11px] font-bold text-slate-700">Easy Returns</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: Payment Method (Amazon-style clean 2 options) */}
                        {currentStep === 2 && (
                            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
                                {/* Header */}
                                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900">Payment method</h2>
                                        <p className="text-xs text-slate-500 mt-0.5">Select how you would like to pay</p>
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                        Step 2 of 3
                                    </span>
                                </div>

                                {/* Amazon Style 2-Option Card Container */}
                                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">

                                    {/* Option 1: Online Payment (UPI, Cards, NetBanking) */}
                                    <label
                                        htmlFor="pay-online"
                                        className={`flex items-start gap-4 p-5 sm:p-6 transition-all cursor-pointer select-none ${paymentMethod === 'online'
                                                ? 'bg-blue-50/40'
                                                : 'bg-white hover:bg-slate-50/70'
                                            }`}
                                    >
                                        <div className="pt-0.5">
                                            <input
                                                type="radio"
                                                id="pay-online"
                                                name="payment_choice"
                                                value="online"
                                                checked={paymentMethod === 'online'}
                                                onChange={() => setPaymentMethod('online')}
                                                className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-900 text-base">
                                                        Online Payment <span className="font-normal text-slate-600 text-sm">(UPI, Cards, Net Banking)</span>
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded uppercase">
                                                        Instant &amp; Safe
                                                    </span>
                                                </div>
                                            </div>

                                            <p className="text-xs text-slate-500 mt-1">
                                                Pay securely via Google Pay, PhonePe, Paytm, Debit/Credit Card, or Net Banking.
                                            </p>

                                            {/* Network Icons Strip */}
                                            <PaymentIconsStrip />

                                            {paymentMethod === 'online' && (
                                                <div className="mt-3.5 pt-3 border-t border-blue-100 flex items-center gap-2 text-xs text-blue-700">
                                                    <span className="font-semibold">ℹ️</span>
                                                    <span>You will complete payment securely on the next screen with zero extra fees.</span>
                                                </div>
                                            )}
                                        </div>
                                    </label>

                                    {/* Option 2: Cash on Delivery (COD) */}
                                    <label
                                        htmlFor="pay-cod"
                                        className={`flex items-start gap-4 p-5 sm:p-6 transition-all cursor-pointer select-none ${paymentMethod === 'cod'
                                                ? 'bg-blue-50/40'
                                                : 'bg-white hover:bg-slate-50/70'
                                            }`}
                                    >
                                        <div className="pt-0.5">
                                            <input
                                                type="radio"
                                                id="pay-cod"
                                                name="payment_choice"
                                                value="cod"
                                                checked={paymentMethod === 'cod'}
                                                onChange={() => setPaymentMethod('cod')}
                                                className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <span className="font-bold text-slate-900 text-base">
                                                    Cash on Delivery / Pay on Delivery
                                                </span>
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded uppercase">
                                                    Doorstep Payment
                                                </span>
                                            </div>

                                            <p className="text-xs text-slate-500 mt-1">
                                                Pay with Cash or scan the courier delivery agent's UPI QR code upon arrival.
                                            </p>

                                            {paymentMethod === 'cod' && (
                                                <div className="mt-3.5 pt-3 border-t border-blue-100 flex items-center gap-2 text-xs text-amber-800">
                                                    <span className="font-semibold">💡</span>
                                                    <span>Please keep exact change of <strong>₹{finalTotal}</strong> ready for a quick delivery.</span>
                                                </div>
                                            )}
                                        </div>
                                    </label>

                                </div>

                                {/* Simple Security Footer */}
                                <div className="pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                                    <div className="flex items-center gap-1.5">
                                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                                        <span>256-Bit SSL Encrypted &amp; PCI-DSS Certified</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                        <span className="text-slate-600 font-medium">100% Purchase Protection</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: Review Order */}
                        {currentStep === 3 && (
                            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
                                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                                            <CheckCircle2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-900">Review &amp; Place Order</h2>
                                            <p className="text-xs text-slate-500">Please review your delivery details before placing order</p>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                        Step 3 of 3
                                    </span>
                                </div>

                                {/* Summary Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Delivery Address Box */}
                                    <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl relative">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                                                <MapPin className="w-4 h-4 text-blue-600" />
                                                <span>Delivering To</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setCurrentStep(1)}
                                                className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                        <p className="font-bold text-slate-800 text-sm">{currentFormData.fullName}</p>
                                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                            {currentFormData.addressLine1}
                                            {currentFormData.addressLine2 ? `, ${currentFormData.addressLine2}` : ""}
                                            <br />
                                            {currentFormData.city}, {currentFormData.state} - {currentFormData.postalCode}
                                        </p>
                                        <p className="text-xs text-slate-700 font-medium mt-1">📞 {currentFormData.phoneNumber}</p>
                                    </div>

                                    {/* Payment Method Box */}
                                    <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl relative">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                                                <CreditCard className="w-4 h-4 text-emerald-600" />
                                                <span>Payment Type</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setCurrentStep(2)}
                                                className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                                            >
                                                Change
                                            </button>
                                        </div>
                                        <p className="font-bold text-slate-800 text-sm">
                                            {paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'Online Payment (Prepaid)'}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {paymentMethod === 'cod'
                                                ? 'Pay ₹' + finalTotal + ' in cash/UPI upon delivery.'
                                                : 'Secure instant checkout via Cashfree Gateway.'}
                                        </p>
                                    </div>
                                </div>

                                {/* Product Breakdown inside Step 3 */}
                                <div className="border border-slate-200 rounded-2xl p-4 bg-white flex flex-col sm:flex-row items-center gap-4">
                                    <div className="relative w-20 h-20 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex-shrink-0">
                                        <Image
                                            src={`${basePath}${variant.image_url || product.image_url || imgPlaceholder.src}`}
                                            alt={product.name}
                                            fill
                                            unoptimized
                                            className="object-contain p-1"
                                        />
                                    </div>
                                    <div className="flex-1 text-center sm:text-left min-w-0">
                                        <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{product.name}</h4>
                                        <p className="text-xs text-slate-500 mt-0.5">{variant.title} • SKU: <span className="font-mono">{variant.sku}</span></p>
                                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                                            <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                                Qty: {quantity}
                                            </span>
                                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                                ₹{price} / unit
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-lg font-black text-slate-900">₹{subtotal}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Right Order Summary Sidebar (4 cols) */}
                    <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-8">
                        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
                            <h2 className="text-base font-bold text-slate-900 flex items-center justify-between">
                                <span>Order Summary</span>
                                <span className="text-xs font-semibold text-slate-400">1 Item</span>
                            </h2>

                            {/* Product Card */}
                            <div className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-2xl space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="relative w-16 h-16 bg-white border border-slate-200/80 rounded-xl overflow-hidden flex-shrink-0">
                                        <Image
                                            src={`${basePath}${variant.image_url || product.image_url || imgPlaceholder.src}`}
                                            alt={product.name}
                                            fill
                                            unoptimized
                                            className="object-contain p-1"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-900 text-xs line-clamp-2 leading-snug">
                                            {product.name}
                                        </h3>
                                        <p className="text-[11px] text-slate-500 mt-0.5">{variant.title}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs font-black text-slate-900">₹{price}</span>
                                            {mrp > price && (
                                                <span className="text-[10px] text-slate-400 line-through">₹{mrp}</span>
                                            )}
                                        </div>

                                        {/* Stock Status Indicator */}
                                        {isOutOfStock ? (
                                            <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-red-600">
                                                <AlertCircle className="w-3 h-3" />
                                                <span>Out of Stock</span>
                                            </div>
                                        ) : isInsufficientStock ? (
                                            <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-amber-700">
                                                <AlertTriangle className="w-3 h-3" />
                                                <span>Only {availableStock} in stock</span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                {/* Quantity Display */}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                                    <span className="font-semibold text-slate-600">Quantity:</span>
                                    <span className={`font-bold px-3 py-1 rounded-lg text-xs shadow-2xs border ${isOutOfStock ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-slate-900 border-slate-200'}`}>
                                        {quantity}
                                    </span>
                                </div>
                            </div>

                            {/* Price Breakdown — Simple & Clean */}
                            <div className="space-y-2.5 text-xs text-slate-600 border-t border-slate-100 pt-4">
                                <div className="flex justify-between">
                                    <span>Item Price ({quantity} {quantity === 1 ? 'item' : 'items'})</span>
                                    <span className="font-semibold text-slate-800">₹{subtotal}</span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span>Delivery Charges</span>
                                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                        FREE
                                    </span>
                                </div>

                                <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline text-slate-900">
                                    <div>
                                        <span className="text-sm font-bold block">Total Amount</span>
                                        <span className="text-[10px] text-slate-400 font-medium">All taxes &amp; shipping included</span>
                                    </div>
                                    <span className="text-2xl font-black text-slate-900">₹{finalTotal}</span>
                                </div>
                            </div>

                            {/* Security Badges */}
                            <div className="pt-2 border-t border-slate-100 text-center">
                                <p className="text-[11px] text-slate-400 font-semibold flex items-center justify-center gap-1.5">
                                    <Lock className="w-3 h-3 text-slate-400" />
                                    <span>Guaranteed Safe &amp; 256-Bit Encrypted Checkout</span>
                                </p>
                            </div>
                        </div>

                        {/* Warning if unavailable */}
                        {isUnavailable && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                <span>{isOutOfStock ? 'Item is out of stock. Checkout is disabled.' : `Only ${availableStock} available in stock.`}</span>
                            </div>
                        )}

                        {/* Primary Action Button (Amazon Yellow / Orange Theme) */}
                        <div>
                            {currentStep < 3 ? (
                                <button
                                    type="button"
                                    onClick={handleNextStep}
                                    disabled={isUnavailable}
                                    className="w-full py-3.5 bg-[#FFD814] hover:bg-[#F7CA00] active:bg-[#F2C200] disabled:bg-slate-300 disabled:border-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 border border-[#FCD200] rounded-full font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 hover:shadow"
                                >
                                    <span>{isUnavailable ? (isOutOfStock ? 'Item Out of Stock' : 'Insufficient Stock') : `Proceed to ${currentStep === 1 ? 'Payment' : 'Review'}`}</span>
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handlePlaceOrder}
                                    disabled={loading || isUnavailable}
                                    className="w-full py-3.5 bg-[#FFD814] hover:bg-[#F7CA00] active:bg-[#F2C200] disabled:bg-slate-300 disabled:border-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 border border-[#FCD200] rounded-full font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2 hover:shadow"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin text-slate-900" />
                                            <span>Confirming Order...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Lock className="w-4 h-4 text-slate-900" />
                                            <span>{isUnavailable ? (isOutOfStock ? 'Item Out of Stock' : 'Insufficient Stock') : `Place Order (₹${finalTotal})`}</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* Cashfree Payment SDK */}
            <Script
                src="https://sdk.cashfree.com/js/v3/cashfree.js"
                strategy="lazyOnload"
            />

            {/* Payment Verification Status Modal */}
            <Modal
                isOpen={showPaymentModal}
                onClose={() => { }}
                title={paymentStatus === 'verifying' ? "Verifying Payment" : paymentStatus === 'success' ? "Payment Successful" : "Payment Failed"}
                width="max-w-md"
            >
                <div className="flex flex-col items-center justify-center p-6 text-center">
                    {paymentStatus === 'verifying' && (
                        <>
                            <Loader2 className="w-12 h-12 text-slate-900 animate-spin mb-4" />
                            <p className="text-slate-600 text-sm font-medium">{paymentMessage}</p>
                        </>
                    )}
                    {paymentStatus === 'success' && (
                        <>
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-9 h-9" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Order Confirmed!</h3>
                            <p className="text-slate-600 text-sm">{paymentMessage}</p>
                        </>
                    )}
                    {paymentStatus === 'failed' && (
                        <>
                            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
                                <X className="w-9 h-9" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Payment Incomplete</h3>
                            <p className="text-slate-600 text-sm">{paymentMessage}</p>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default CheckoutSingle;
