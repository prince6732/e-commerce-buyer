'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as Yup from 'yup';
import {
    Mail,
    Phone,
    MapPin,
    Send,
    CheckCircle2,
    Loader2,
    Package,
    RotateCcw,
    CreditCard,
    ShieldCheck,
    Truck,
    HelpCircle,
    MessageSquare,
    Clock,
    ArrowRight,
    Search,
    ChevronDown,
    ExternalLink,
    Headphones,
    FileText,
    Sparkles,
    User,
    Check
} from 'lucide-react';
import { RiWhatsappLine } from 'react-icons/ri';
import { submitContactMessage } from '../../../../utils/contactUsApi';
import ErrorMessage from '@/components/(sheared)/ErrorMessage';
import SuccessMessage from '@/components/(sheared)/SuccessMessage';
import { useLoader } from '@/context/LoaderContext';
import { useAuth } from '@/context/AuthContext';
import { fetchSettingByKey } from '../../../../utils/settingsApi';

const contactSchema = Yup.object().shape({
    name: Yup.string()
        .required('Full name is required')
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must not exceed 100 characters')
        .matches(/^[a-zA-Z\s.]+$/, 'Name can only contain letters and spaces'),
    email: Yup.string()
        .required('Email address is required')
        .email('Please enter a valid email address')
        .max(255, 'Email must not exceed 255 characters'),
    phone_number: Yup.string()
        .required('Phone number is required')
        .matches(/^[0-9+\-\s()]{10,20}$/, 'Please enter a valid 10-digit phone number')
        .min(10, 'Phone number must be at least 10 digits')
        .max(20, 'Phone number must not exceed 20 characters'),
    order_id: Yup.string().optional(),
    topic: Yup.string().required('Please select an inquiry topic'),
    message: Yup.string()
        .required('Message description is required')
        .min(10, 'Please describe your query in at least 10 characters')
        .max(1000, 'Message must not exceed 1000 characters')
});

interface ContactFormData {
    name: string;
    email: string;
    phone_number: string;
    order_id?: string;
    topic: string;
    message: string;
}

const TOPICS = [
    { id: 'orders', label: 'Order Status & Tracking', icon: Package, hint: 'Questions regarding placed orders, delays, or tracking' },
    { id: 'returns', label: 'Returns & Exchange', icon: RotateCcw, hint: 'Return requests, replacement policy, or pickup schedule' },
    { id: 'refunds', label: 'Refunds & Payments', icon: CreditCard, hint: 'Refund timeline, failed payments, or invoice requests' },
    { id: 'product', label: 'Product & Warranty', icon: ShieldCheck, hint: 'Specifications, size guide, warranty, or availability' },
    { id: 'shipping', label: 'Shipping & Delivery', icon: Truck, hint: 'Pincode serviceability, address changes, or courier issues' },
    { id: 'other', label: 'Other Inquiries', icon: HelpCircle, hint: 'General feedback, partnership, or account help' }
];

const FAQS = [
    {
        category: 'Orders & Tracking',
        question: 'How do I track my active order?',
        answer: 'You can instantly check your live delivery status in the "My Orders" section or on our dedicated Track Shipment page by entering your tracking or order ID. Once shipped, SMS and WhatsApp updates are sent with live courier tracking links.'
    },
    {
        category: 'Orders & Tracking',
        question: 'Can I change my delivery address after placing an order?',
        answer: 'If your order has not been dispatched yet, you can modify the delivery address by contacting our support team or updating it in My Orders. Once dispatched with Delhivery/courier, address re-routing may take 24-48 hours.'
    },
    {
        category: 'Returns & Refunds',
        question: 'What is the return and replacement window?',
        answer: 'We provide a hassle-free 7-day return and replacement policy for all eligible items. Items must be in original condition with tags and packaging intact. Initiate a return directly from the My Orders dashboard.'
    },
    {
        category: 'Returns & Refunds',
        question: 'How long does it take to receive a refund?',
        answer: 'Once the returned package passes quality inspection at our warehouse, refunds are initiated within 24 hours. UPI and card refunds reflect in 2-5 business days. COD refunds are credited via direct bank transfer/UPI.'
    },
    {
        category: 'Payments & Pricing',
        question: 'Which payment methods are supported on Zelton?',
        answer: 'We support all major payment modes including UPI (Google Pay, PhonePe, Paytm), Credit/Debit cards (Visa, Mastercard, RuPay), Net Banking across 50+ banks, and Cash on Delivery (COD).'
    },
    {
        category: 'Shipping & Delivery',
        question: 'What are standard shipping timelines and charges?',
        answer: 'Standard shipping takes 3-6 business days across India. We provide free shipping on prepaid orders and orders above ₹499. Express delivery is available for select metro cities.'
    }
];

export default function ContactUsPage() {
    const { user } = useAuth();
    const { showLoader, hideLoader } = useLoader();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [whatsappNumber, setWhatsappNumber] = useState<string>('919729310456');
    const [faqSearch, setFaqSearch] = useState<string>('');
    const [selectedFaqCategory, setSelectedFaqCategory] = useState<string>('All');
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

    const formRef = useRef<HTMLDivElement | null>(null);

    // Fetch dynamic WhatsApp support number
    useEffect(() => {
        fetchSettingByKey('whatsapp_number')
            .then((setting) => {
                if (setting?.value) setWhatsappNumber(setting.value.replace(/[^0-9]/g, ''));
            })
            .catch(() => { });
    }, []);

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors }
    } = useForm<ContactFormData>({
        resolver: yupResolver(contactSchema) as any,
        defaultValues: {
            name: '',
            email: '',
            phone_number: '',
            order_id: '',
            topic: 'orders',
            message: ''
        }
    });

    // Autofill user credentials if logged in
    useEffect(() => {
        if (user) {
            if (user.name) setValue('name', user.name);
            if (user.email) setValue('email', user.email);
            const userPhone = (user as any).phone_number || (user as any).phone || '';
            if (userPhone) setValue('phone_number', userPhone);
        }
    }, [user, setValue]);

    const selectedTopic = watch('topic');
    const currentMessage = watch('message') || '';

    const handleTopicSelect = (topicId: string) => {
        setValue('topic', topicId, { shouldValidate: true });
    };

    const scrollToFormWithTopic = (topicId: string) => {
        setValue('topic', topicId, { shouldValidate: true });
        if (formRef.current) {
            formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const onSubmit = async (data: ContactFormData) => {
        setLoading(true);
        setSuccess(false);
        setErrorMessage(null);
        setSuccessMessage(null);
        showLoader();

        // Format message with topic and order id for comprehensive backend logging
        const topicLabel = TOPICS.find((t) => t.id === data.topic)?.label || data.topic;
        const formattedMessage = data.order_id?.trim()
            ? `[Topic: ${topicLabel} | Order ID: ${data.order_id.trim()}]\n\n${data.message}`
            : `[Topic: ${topicLabel}]\n\n${data.message}`;

        try {
            const payload = {
                name: data.name.trim(),
                email: data.email.trim(),
                phone_number: data.phone_number.trim(),
                message: formattedMessage
            };

            const response = await submitContactMessage(payload);
            if (response.success) {
                setSuccess(true);
                setSuccessMessage("Thank you for reaching out! Your support ticket has been received. Our team will get back to you within 24 hours.");
                reset({
                    name: user?.name || '',
                    email: user?.email || '',
                    phone_number: (user as any)?.phone_number || (user as any)?.phone || '',
                    order_id: '',
                    topic: 'orders',
                    message: ''
                });
            } else {
                setErrorMessage("Failed to send message. Please try again or chat with us on WhatsApp.");
            }
        } catch (error: any) {
            console.error('Error submitting contact form:', error);
            setErrorMessage(error.response?.data?.message || "Failed to send message. Please check your internet connection or try WhatsApp support.");
        } finally {
            setLoading(false);
            hideLoader();
        }
    };

    // Filter FAQs based on search and category
    const filteredFaqs = useMemo(() => {
        return FAQS.filter((faq) => {
            const matchesCategory = selectedFaqCategory === 'All' || faq.category === selectedFaqCategory;
            const matchesSearch =
                !faqSearch.trim() ||
                faq.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
                faq.answer.toLowerCase().includes(faqSearch.toLowerCase()) ||
                faq.category.toLowerCase().includes(faqSearch.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [faqSearch, selectedFaqCategory]);

    const faqCategories = ['All', 'Orders & Tracking', 'Returns & Refunds', 'Payments & Pricing', 'Shipping & Delivery'];

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-gray-900 pb-20 sm:pb-16">
            {errorMessage && <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />}
            {successMessage && <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />}

            {/* ══════════════════════════════════════════════════════
                1. HERO SECTION (Amazon / Flipkart Clean Help Center Header)
            ══════════════════════════════════════════════════════ */}
            <section className="bg-gradient-to-b from-[#EEF6FF] via-[#F8FAFC] to-[#F8FAFC] border-b border-blue-100/70 pt-6 pb-10 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-5 font-medium">
                        <Link href="/" className="hover:text-[#007FFF] transition-colors">Home</Link>
                        <span>›</span>
                        <span className="text-gray-500">Help Centre</span>
                        <span>›</span>
                        <span className="text-[#007FFF] font-semibold">24x7 Customer Care</span>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-2">
                        {/* Title & Subtitle */}
                        <div className="space-y-2 max-w-2xl">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-[#007FFF] text-xs font-bold shadow-2xs">
                                <Headphones className="w-3.5 h-3.5" />
                                <span>Zelton Customer Service & Helpdesk</span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#0F172A] tracking-tight">
                                How can we help you today?
                            </h1>
                            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                                Get instant help with your orders, returns, and delivery, or connect directly with our support specialists.
                            </p>
                        </div>

                        {/* Quick Contact Action Buttons */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 flex-shrink-0">
                            <a
                                href={`https://wa.me/${whatsappNumber}?text=Hi%20Zelton%20Support,%20I%20need%20help%20with%20my%20order.`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.98] text-white font-bold text-xs shadow-md shadow-[#25D366]/20 transition-all cursor-pointer"
                            >
                                <RiWhatsappLine className="text-lg" />
                                <span>WhatsApp Support</span>
                            </a>
                            <a
                                href="tel:+919729310456"
                                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/90 text-gray-800 font-bold text-xs shadow-2xs transition-all hover:border-[#007FFF]/50"
                            >
                                <Phone className="w-3.5 h-3.5 text-[#007FFF]" />
                                <span>Call: +91 9729310456</span>
                            </a>
                        </div>
                    </div>

                    {/* Interactive Help Search Bar */}
                    <div className="mt-6 max-w-2xl">
                        <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={faqSearch}
                                onChange={(e) => setFaqSearch(e.target.value)}
                                placeholder="Describe your issue or search keywords (e.g. tracking, return pickup, refund timeline)..."
                                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 hover:border-gray-300 focus:border-[#007FFF] rounded-2xl text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-50 transition-all shadow-sm"
                            />
                            {faqSearch && (
                                <button
                                    type="button"
                                    onClick={() => setFaqSearch('')}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-700"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Trust Badges Strip */}
                    <div className="mt-4 flex items-center gap-4 sm:gap-6 flex-wrap text-[11px] font-semibold text-gray-500">
                        <div className="flex items-center gap-1.5 text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Instant WhatsApp Support Online</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-600">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#007FFF]" />
                            <span>100% Buyer Protection</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-600">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Fast Ticket Resolution</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                2. QUICK SELF-SERVICE PILLARS (Amazon Style Issue Cards)
            ══════════════════════════════════════════════════════ */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 relative z-10">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                    {[
                        {
                            title: 'Track Orders',
                            desc: 'Live tracking & updates',
                            icon: Package,
                            color: 'text-blue-600 bg-blue-50 border-blue-100',
                            href: '/orders',
                            isLink: true
                        },
                        {
                            title: 'Returns & Pickup',
                            desc: '7-day easy returns',
                            icon: RotateCcw,
                            color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
                            href: '/orders',
                            isLink: true
                        },
                        {
                            title: 'Refund Status',
                            desc: 'Bank & UPI timeline',
                            icon: CreditCard,
                            color: 'text-amber-600 bg-amber-50 border-amber-100',
                            href: '/orders',
                            isLink: true
                        },
                        {
                            title: 'Shipping & Pin',
                            desc: 'Delhivery delivery check',
                            icon: Truck,
                            color: 'text-purple-600 bg-purple-50 border-purple-100',
                            href: '/track-order',
                            isLink: true
                        },
                        {
                            title: 'Warranty & Care',
                            desc: '100% genuine products',
                            icon: ShieldCheck,
                            color: 'text-rose-600 bg-rose-50 border-rose-100',
                            topicId: 'product',
                            isLink: false
                        },
                        {
                            title: 'Manage Profile',
                            desc: 'Addresses & security',
                            icon: User,
                            color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
                            href: '/profile',
                            isLink: true
                        }
                    ].map((item, idx) => (
                        item.isLink ? (
                            <Link
                                key={idx}
                                href={item.href || '/orders'}
                                className="group bg-white rounded-2xl p-4 border border-gray-200/90 hover:border-[#007FFF]/50 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 border ${item.color} group-hover:scale-105 transition-transform`}>
                                    <item.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-xs sm:text-sm font-bold text-gray-900 group-hover:text-[#007FFF] transition-colors leading-tight">
                                        {item.title}
                                    </h3>
                                    <p className="text-[11px] text-gray-500 mt-1 line-clamp-1 leading-snug">
                                        {item.desc}
                                    </p>
                                </div>
                            </Link>
                        ) : (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => scrollToFormWithTopic(item.topicId || 'product')}
                                className="group bg-white rounded-2xl p-4 border border-gray-200/90 hover:border-[#007FFF]/50 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between text-left cursor-pointer"
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 border ${item.color} group-hover:scale-105 transition-transform`}>
                                    <item.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-xs sm:text-sm font-bold text-gray-900 group-hover:text-[#007FFF] transition-colors leading-tight">
                                        {item.title}
                                    </h3>
                                    <p className="text-[11px] text-gray-500 mt-1 line-clamp-1 leading-snug">
                                        {item.desc}
                                    </p>
                                </div>
                            </button>
                        )
                    ))}
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                3. MAIN SUPPORT & CONTACT FORM SECTION
            ══════════════════════════════════════════════════════ */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
                <div className="grid lg:grid-cols-12 gap-8 items-start">

                    {/* Left Column (5 Cols): Direct Support Channels & Address */}
                    <div className="lg:col-span-5 space-y-5">
                        {/* Section Header */}
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-[#007FFF]">Direct Assistance</span>
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">Connect with our support channels</h2>
                            <p className="text-xs sm:text-sm text-gray-500 mt-1">
                                Choose your preferred channel to get fast and reliable answers.
                            </p>
                        </div>

                        {/* WhatsApp Card */}
                        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-2xs hover:shadow-sm transition-all">
                            <div className="flex items-start gap-4">
                                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#25D366] flex items-center justify-center flex-shrink-0 border border-emerald-200">
                                    <RiWhatsappLine className="text-2xl" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="font-bold text-sm text-gray-900">WhatsApp Instant Chat</h3>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            Online
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">Quick order questions & live agent assistance</p>
                                    <div className="mt-3">
                                        <a
                                            href={`https://wa.me/${whatsappNumber}?text=Hi%20Zelton%20Support,%20I%20need%20help%20with%20my%20order.`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                                        >
                                            <span>Open WhatsApp Chat</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Phone Support Card */}
                        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs hover:shadow-sm transition-all">
                            <div className="flex items-start gap-4">
                                <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#007FFF] flex items-center justify-center flex-shrink-0 border border-blue-100">
                                    <Phone className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-sm text-gray-900">Direct Support Hotline</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">Mon – Sat: 9:00 AM – 6:00 PM IST</p>
                                    <div className="mt-2.5">
                                        <a
                                            href="tel:+919729310456"
                                            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#007FFF] hover:underline"
                                        >
                                            <span>+91 9729310456</span>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Email Support Card */}
                        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs hover:shadow-sm transition-all">
                            <div className="flex items-start gap-4">
                                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 border border-indigo-100">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-sm text-gray-900">Email Customer Care</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">Guaranteed reply within 24 business hours</p>
                                    <div className="mt-2.5 space-y-1">
                                        <div>
                                            <a
                                                href="mailto:support@zelton.co.in"
                                                className="text-xs font-semibold text-gray-800 hover:text-[#007FFF] hover:underline"
                                            >
                                                support@zelton.co.in
                                            </a>
                                        </div>
                                        <div>
                                            <a
                                                href="mailto:care@zelton.co.in"
                                                className="text-xs font-semibold text-gray-800 hover:text-[#007FFF] hover:underline"
                                            >
                                                care@zelton.co.in
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Head Office Card */}
                        <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-2xs">
                            <div className="flex items-start gap-4">
                                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 border border-amber-100">
                                    <MapPin className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-sm text-gray-900">Registered Office</h3>
                                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                                        Zelton Enterprises Private Limited<br />
                                        Corporate Office, India
                                    </p>
                                    <p className="text-[11px] text-gray-400 mt-1 font-medium">GST Registered & Verified Business</p>
                                </div>
                            </div>
                        </div>

                        {/* Flipkart / Amazon Trust Guarantee Box */}
                        <div className="rounded-2xl p-5 bg-gradient-to-br from-[#0c2340] to-[#133054] text-white shadow-sm space-y-3">
                            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                                <Sparkles className="w-4 h-4" />
                                <span>The Zelton Buyer Promise</span>
                            </div>
                            <div className="space-y-2 text-xs text-blue-100/90">
                                <div className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                    <span>100% Genuine & Quality Inspected Products</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                    <span>Instant Automated Tracking & SMS Dispatch Notifications</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                    <span>Zero-Hassle 7-Day Replacement & Return Policy</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Right Column (7 Cols): Smart Contact Message Form */}
                    <div ref={formRef} className="lg:col-span-7">
                        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/90 shadow-sm relative">

                            {/* Form Header */}
                            <div className="border-b border-gray-100 pb-5 mb-6">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-[#007FFF]">Online Support Ticket</span>
                                    <span className="text-xs text-gray-400">* Required fields</span>
                                </div>
                                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">Send us a message</h2>
                                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                                    Fill in your inquiry details below and an executive will be assigned to your case.
                                </p>
                            </div>

                            {/* Success Banner */}
                            {success && (
                                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 animate-in fade-in duration-300">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-xs font-bold text-emerald-900">Inquiry Submitted Successfully!</h4>
                                        <p className="text-xs text-emerald-700 mt-0.5">
                                            Thank you! Our customer support representative will review your message and reach out via email/phone shortly.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

                                {/* 1. Inquiry Topic Selector (Chips) */}
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                                        Select Query Category *
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {TOPICS.map((topic) => {
                                            const isSelected = selectedTopic === topic.id;
                                            const IconComp = topic.icon;
                                            return (
                                                <button
                                                    key={topic.id}
                                                    type="button"
                                                    onClick={() => handleTopicSelect(topic.id)}
                                                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                                                        isSelected
                                                            ? 'border-[#007FFF] bg-blue-50/70 text-[#007FFF] font-bold shadow-2xs ring-1 ring-[#007FFF]'
                                                            : 'border-gray-200 bg-gray-50/50 text-gray-700 hover:bg-gray-100/70'
                                                    }`}
                                                >
                                                    <IconComp className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-[#007FFF]' : 'text-gray-500'}`} />
                                                    <span className="truncate">{topic.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {errors.topic && (
                                        <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.topic.message}</p>
                                    )}
                                </div>

                                {/* 2. Name & Order ID Grid */}
                                <div className="grid sm:grid-cols-2 gap-4">
                                    {/* Name Input */}
                                    <div>
                                        <label htmlFor="name" className="block text-xs font-bold text-gray-700 mb-1.5">
                                            Your Full Name *
                                        </label>
                                        <input
                                            type="text"
                                            id="name"
                                            {...register('name')}
                                            placeholder="e.g. Rahul Sharma"
                                            className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 ${
                                                errors.name
                                                    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100 bg-rose-50/30'
                                                    : 'border-gray-300 focus:border-[#007FFF] focus:ring-blue-100 bg-white'
                                            }`}
                                        />
                                        {errors.name && (
                                            <p className="mt-1 text-xs text-rose-600 font-medium">{errors.name.message}</p>
                                        )}
                                    </div>

                                    {/* Order ID Input (Optional) */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label htmlFor="order_id" className="block text-xs font-bold text-gray-700">
                                                Order Number (Optional)
                                            </label>
                                            <span className="text-[10px] text-gray-400">e.g. ORD-10294</span>
                                        </div>
                                        <input
                                            type="text"
                                            id="order_id"
                                            {...register('order_id')}
                                            placeholder="ORD-XXXXXX or OD123456"
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 bg-white text-xs sm:text-sm transition-all focus:outline-none"
                                        />
                                    </div>
                                </div>

                                {/* 3. Email & Phone Number Grid */}
                                <div className="grid sm:grid-cols-2 gap-4">
                                    {/* Email */}
                                    <div>
                                        <label htmlFor="email" className="block text-xs font-bold text-gray-700 mb-1.5">
                                            Email Address *
                                        </label>
                                        <input
                                            type="email"
                                            id="email"
                                            {...register('email')}
                                            placeholder="name@example.com"
                                            className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 ${
                                                errors.email
                                                    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100 bg-rose-50/30'
                                                    : 'border-gray-300 focus:border-[#007FFF] focus:ring-blue-100 bg-white'
                                            }`}
                                        />
                                        {errors.email && (
                                            <p className="mt-1 text-xs text-rose-600 font-medium">{errors.email.message}</p>
                                        )}
                                    </div>

                                    {/* Phone Number */}
                                    <div>
                                        <label htmlFor="phone_number" className="block text-xs font-bold text-gray-700 mb-1.5">
                                            Phone / WhatsApp Number *
                                        </label>
                                        <input
                                            type="tel"
                                            id="phone_number"
                                            {...register('phone_number')}
                                            placeholder="+91 98765 43210"
                                            className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 ${
                                                errors.phone_number
                                                    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100 bg-rose-50/30'
                                                    : 'border-gray-300 focus:border-[#007FFF] focus:ring-blue-100 bg-white'
                                            }`}
                                        />
                                        {errors.phone_number && (
                                            <p className="mt-1 text-xs text-rose-600 font-medium">{errors.phone_number.message}</p>
                                        )}
                                    </div>
                                </div>

                                {/* 4. Message Description */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label htmlFor="message" className="block text-xs font-bold text-gray-700">
                                            Describe your issue or query *
                                        </label>
                                        <span className="text-[11px] text-gray-400">
                                            {currentMessage.length}/1000 characters
                                        </span>
                                    </div>
                                    <textarea
                                        id="message"
                                        {...register('message')}
                                        rows={5}
                                        placeholder="Please provide details about your query (e.g. tracking issue, item condition, question regarding product specs)..."
                                        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 resize-none ${
                                            errors.message
                                                ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100 bg-rose-50/30'
                                                : 'border-gray-300 focus:border-[#007FFF] focus:ring-blue-100 bg-white'
                                        }`}
                                    />
                                    {errors.message && (
                                        <p className="mt-1 text-xs text-rose-600 font-medium">{errors.message.message}</p>
                                    )}
                                </div>

                                {/* 5. Action Buttons & Consent Note */}
                                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100">
                                    <p className="text-[11px] text-gray-500 leading-tight">
                                        By submitting, you agree to receive support updates via Email, SMS, or WhatsApp.
                                    </p>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full sm:w-auto min-w-[200px] px-6 py-3 rounded-xl bg-[#007FFF] hover:bg-[#0066CC] active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Submitting Ticket...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" />
                                                <span>Submit Support Ticket</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                            </form>
                        </div>
                    </div>

                </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                4. FREQUENTLY ASKED QUESTIONS (Accordion with Filter Tabs)
            ══════════════════════════════════════════════════════ */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-12 border-t border-gray-200">
                <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#007FFF]">Quick Solutions</span>
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Frequently Asked Questions</h2>
                    <p className="text-xs sm:text-sm text-gray-500">
                        Find quick answers to common queries regarding ordering, dispatch, refunds, and warranties.
                    </p>
                </div>

                {/* Search in FAQs */}
                <div className="max-w-xl mx-auto mb-6">
                    <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={faqSearch}
                            onChange={(e) => setFaqSearch(e.target.value)}
                            placeholder="Search help topics (e.g. return, tracking, refund)..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#007FFF] transition-all shadow-2xs"
                        />
                    </div>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center justify-center gap-2 flex-wrap mb-8">
                    {faqCategories.map((category) => (
                        <button
                            key={category}
                            type="button"
                            onClick={() => setSelectedFaqCategory(category)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                selectedFaqCategory === category
                                    ? 'bg-[#0F172A] text-white shadow-xs'
                                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                {/* FAQ Accordion List */}
                <div className="max-w-3xl mx-auto space-y-3">
                    {filteredFaqs.length > 0 ? (
                        filteredFaqs.map((faq, index) => {
                            const isOpen = openFaqIndex === index;
                            return (
                                <div
                                    key={index}
                                    className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden shadow-2xs transition-all"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                                        className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-gray-50/80 transition-colors"
                                    >
                                        <span className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-2.5">
                                            <span className="w-6 h-6 rounded-full bg-blue-50 text-[#007FFF] text-xs font-extrabold flex items-center justify-center flex-shrink-0">
                                                ?
                                            </span>
                                            {faq.question}
                                        </span>
                                        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180 text-[#007FFF]' : ''}`} />
                                    </button>

                                    {isOpen && (
                                        <div className="px-5 pb-4 pt-1 text-xs sm:text-sm text-gray-600 leading-relaxed border-t border-gray-100 bg-gray-50/40 animate-in fade-in duration-200">
                                            <p>{faq.answer}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-8 text-xs text-gray-500 bg-white rounded-2xl border border-gray-200 p-6">
                            No matching FAQs found for &quot;{faqSearch}&quot;. Please send us a message above or chat on WhatsApp.
                        </div>
                    )}
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                5. MOBILE STICKY CONTACT ACTION BAR
            ══════════════════════════════════════════════════════ */}
            <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-2.5 shadow-2xl flex items-center gap-2.5">
                <a
                    href={`https://wa.me/${whatsappNumber}?text=Hi%20Zelton%20Support,%20I%20need%20help%20with%20my%20order.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#25D366] text-white font-bold text-xs shadow-sm"
                >
                    <RiWhatsappLine className="text-lg" />
                    <span>WhatsApp</span>
                </a>
                <a
                    href="tel:+919729310456"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#007FFF] text-white font-bold text-xs shadow-sm"
                >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Support</span>
                </a>
            </div>
        </div>
    );
}
