'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Mail,
    Search,
    Trash2,
    Eye,
    CheckCircle2,
    Loader2,
    Check
} from 'lucide-react';
import {
    deleteContactMessage,
    getContactMessages,
    markMessageAsRead,
    type ContactMessage
} from '../../../../../utils/contactUsApi';
import Modal from '@/components/(sheared)/Modal';
import { useLoader } from '@/context/LoaderContext';
import ErrorMessage from '@/components/(sheared)/ErrorMessage';
import SuccessMessage from '@/components/(sheared)/SuccessMessage';

const PAGE_SIZE = 10;

export default function ContactMessagesPage() {
    // Infinite scroll & messages state
    const [messages, setMessages] = useState<ContactMessage[]>([]);
    const [page, setPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(true);
    const [totalMessages, setTotalMessages] = useState(0);
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const isFetchingRef = useRef(false);
    const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    // Modals & messages
    const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [messageToDelete, setMessageToDelete] = useState<ContactMessage | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const { showLoader, hideLoader } = useLoader();

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Auto-dismiss alert toasts
    useEffect(() => {
        if (successMessage || errorMessage) {
            const timer = setTimeout(() => {
                setSuccessMessage(null);
                setErrorMessage(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, errorMessage]);

    // Fetch Messages
    const fetchMessages = async (pageNum: number, search: string = "", isAppend: boolean = false) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        if (isAppend) {
            setIsLoadingMore(true);
        } else {
            setIsLoadingInitial(true);
            if (search) setIsSearching(true);
        }

        try {
            const response = await getContactMessages({
                page: pageNum,
                limit: PAGE_SIZE,
                search: search || undefined,
            });

            let list: ContactMessage[] = [];
            let paginationData: any = null;

            if (response && response.data) {
                list = response.data.data || (response.data as any).messages || [];
                paginationData = response.data;
            }

            const total = paginationData?.total ?? list.length;
            const hasNext = Boolean(
                (paginationData as any)?.has_next_page ??
                (paginationData as any)?.hasNextPage ??
                (paginationData as any)?.has_more ??
                (paginationData ? pageNum < paginationData.last_page : list.length >= PAGE_SIZE)
            );

            setTotalMessages(total);
            setHasNextPage(hasNext);
            setPage(pageNum);

            if (isAppend) {
                setMessages((prev) => {
                    const existingIds = new Set(prev.map((m) => m.id));
                    const newUnique = list.filter((m) => !existingIds.has(m.id));
                    return [...prev, ...newUnique];
                });
            } else {
                setMessages(list);
            }
        } catch (error) {
            console.error('Failed to fetch messages:', error);
            setErrorMessage("Failed to load contact messages. Please try again.");
            if (!isAppend) setMessages([]);
            setHasNextPage(false);
        } finally {
            isFetchingRef.current = false;
            setIsLoadingInitial(false);
            setIsLoadingMore(false);
            setIsSearching(false);
        }
    };

    // Trigger initial fetch / reset on search query changes
    useEffect(() => {
        setPage(1);
        setHasNextPage(true);
        fetchMessages(1, debouncedSearchQuery, false);
    }, [debouncedSearchQuery]);

    // Load next page on scroll
    const loadNextPage = useCallback(() => {
        if (!hasNextPage || isLoadingMore || isLoadingInitial || isFetchingRef.current) return;
        fetchMessages(page + 1, debouncedSearchQuery, true);
    }, [hasNextPage, isLoadingMore, isLoadingInitial, page, debouncedSearchQuery]);

    // Observer for bottom sentinel
    useEffect(() => {
        const sentinel = bottomSentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const target = entries[0];
                if (target.isIntersecting) {
                    loadNextPage();
                }
            },
            {
                root: null,
                rootMargin: "300px",
                threshold: 0.1,
            }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [loadNextPage]);

    const confirmDelete = (message: ContactMessage) => {
        setMessageToDelete(message);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!messageToDelete) return;
        showLoader();
        try {
            await deleteContactMessage(messageToDelete.id);
            setMessages((prev) => prev.filter((m) => m.id !== messageToDelete.id));
            setTotalMessages((prev) => Math.max(0, prev - 1));
            setSuccessMessage("Message deleted successfully!");
        } catch (err: any) {
            console.error(err);
            setErrorMessage(err.response?.data?.message || err.response?.data?.error || "Failed to delete message");
        } finally {
            hideLoader();
            setIsDeleteModalOpen(false);
            setMessageToDelete(null);
        }
    };

    const handleView = async (message: ContactMessage) => {
        setSelectedMessage(message);
        setShowModal(true);

        if (!message.is_read) {
            try {
                await markMessageAsRead(message.id);
                setMessages((prev) =>
                    prev.map((m) => (m.id === message.id ? { ...m, is_read: true } : m))
                );
            } catch (error) {
                console.error('Failed to mark as read:', error);
            }
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="p-3 md:p-6">
            {errorMessage && <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />}
            {successMessage && <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />}

            {/* Header + Search */}
            <div className="mb-4 md:mb-6 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-xl shadow-md">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 md:px-6 py-3.5 md:py-4">

                    {/* Title & Count */}
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-lg md:text-xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">
                                Contact Messages
                            </h1>
                            {totalMessages > 0 && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                    {messages.length} of {totalMessages}
                                </span>
                            )}
                        </div>
                        <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                            Manage customer inquiries and support requests
                        </p>
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search messages..."
                            className="w-full rounded-xl border border-gray-300 bg-white pl-10 pr-10 py-2 md:py-2.5 text-sm md:text-base text-gray-900 placeholder-gray-400 shadow-sm focus:border-[#007FFF] focus:ring-2 focus:ring-blue-200 transition-all"
                        />
                        {isSearching ? (
                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                                <Loader2 className="w-4 h-4 animate-spin text-[#007FFF]" />
                            </div>
                        ) : searchQuery ? (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 transition-all cursor-pointer"
                            >
                                Clear
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Messages Table - Desktop */}
            <div className="hidden md:block">
                <div className="overflow-x-auto scrollbar rounded-2xl shadow-lg border border-gray-200 bg-white">
                    <table className="w-full min-w-[800px] text-sm text-left">
                        <thead className="bg-gray-50 uppercase text-xs font-semibold text-gray-600 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4">S.No.</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Phone</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4 text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-700">
                            {isLoadingInitial && messages.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="w-8 h-8 animate-spin text-[#007FFF]" />
                                            <span className="text-sm font-medium text-gray-500">Loading messages...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : messages.length ? (
                                messages.map((message, index) => (
                                    <tr
                                        key={message.id}
                                        className={`hover:bg-blue-50/30 transition-colors ${!message.is_read ? 'bg-blue-50/20 font-medium' : ''
                                            }`}
                                    >
                                        <td className="px-6 py-4 font-semibold text-gray-500">{index + 1}</td>
                                        <td className="px-6 py-4">
                                            {message.is_read ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-gray-500" />
                                                    Read
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 animate-pulse">
                                                    <Mail className="w-3.5 h-3.5 text-[#007FFF]" />
                                                    New
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-gray-900">{message.name}</td>
                                        <td className="px-6 py-4">
                                            <a
                                                href={`mailto:${message.email}`}
                                                className="text-[#007FFF] hover:text-blue-700 underline"
                                            >
                                                {message.email}
                                            </a>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{message.phone_number || '—'}</td>
                                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{formatDate(message.created_at)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => handleView(message)}
                                                    className="size-10 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full flex items-center justify-center transition cursor-pointer"
                                                    title="View Message"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => confirmDelete(message)}
                                                    className="size-10 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center transition cursor-pointer"
                                                    title="Delete Message"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="text-center py-16">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Mail className="w-12 h-12 text-gray-300 mb-1" />
                                            <p className="text-gray-500 font-medium text-base">No messages found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden space-y-4">
                {isLoadingInitial && messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-md border border-gray-200">
                        <Loader2 className="w-8 h-8 animate-spin text-[#007FFF] mb-2" />
                        <span className="text-sm font-medium text-gray-500">Loading messages...</span>
                    </div>
                ) : messages.length ? (
                    messages.map((message, index) => (
                        <div
                            key={message.id}
                            className={`p-4 bg-white rounded-xl shadow-md border border-gray-200 space-y-3 ${!message.is_read ? 'border-l-4 border-l-[#007FFF]' : ''
                                }`}
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-gray-900 text-base">{message.name}</h3>
                                        <span className="text-xs text-gray-400 font-semibold">#{index + 1}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">{formatDate(message.created_at)}</p>
                                </div>
                                <div>
                                    {message.is_read ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                            Read
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                            New
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1 text-xs text-gray-600">
                                <p>
                                    <strong className="text-gray-800">Email:</strong>{' '}
                                    <a href={`mailto:${message.email}`} className="text-[#007FFF] underline font-medium">
                                        {message.email}
                                    </a>
                                </p>
                                {message.phone_number && (
                                    <p>
                                        <strong className="text-gray-800">Phone:</strong> {message.phone_number}
                                    </p>
                                )}
                            </div>

                            <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-700 line-clamp-2">
                                {message.message}
                            </div>

                            <div className="flex gap-2 pt-2 border-t border-gray-100">
                                <button
                                    onClick={() => handleView(message)}
                                    className="flex-1 py-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-xs cursor-pointer"
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                    View Details
                                </button>
                                <button
                                    onClick={() => confirmDelete(message)}
                                    className="flex-1 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-xs cursor-pointer"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
                        <Mail className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 font-medium">No messages found</p>
                    </div>
                )}
            </div>

            {/* Bottom Sentinel for Infinite Scroll */}
            <div ref={bottomSentinelRef} className="h-6 w-full pointer-events-none" />

            {/* Infinite Scroll Bottom Loading State */}
            {isLoadingMore && (
                <div className="flex items-center justify-center gap-2.5 py-6 text-sm text-gray-600 animate-in fade-in duration-200">
                    <Loader2 className="w-5 h-5 animate-spin text-[#007FFF]" />
                    <span className="font-semibold text-gray-700">Loading more messages...</span>
                </div>
            )}

            {/* All Messages Loaded End Indicator */}
            {!hasNextPage && messages.length > 0 && !isLoadingInitial && (
                <div className="flex items-center justify-center py-6 text-xs md:text-sm text-gray-400 font-medium animate-in fade-in duration-200">
                    <span className="bg-gray-100/90 px-4 py-1.5 rounded-full border border-gray-200 text-gray-600 font-semibold shadow-xs flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>All {messages.length} messages loaded</span>
                    </span>
                </div>
            )}

            {/* View Message Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title="Message Details"
                width="max-w-2xl"
            >
                {selectedMessage && (
                    <div className="p-4 md:p-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Sender Name</label>
                                <p className="text-sm font-bold text-gray-900 mt-0.5">{selectedMessage.name}</p>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Email Address</label>
                                <p className="text-sm font-medium text-[#007FFF] mt-0.5">
                                    <a href={`mailto:${selectedMessage.email}`} className="underline">
                                        {selectedMessage.email}
                                    </a>
                                </p>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Phone Number</label>
                                <p className="text-sm font-medium text-gray-900 mt-0.5">
                                    {selectedMessage.phone_number || 'N/A'}
                                </p>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Received At</label>
                                <p className="text-sm font-medium text-gray-900 mt-0.5">
                                    {formatDate(selectedMessage.created_at)}
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Message</label>
                            <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-800 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                                {selectedMessage.message}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-sm font-semibold transition cursor-pointer"
                            >
                                Close
                            </button>
                            <a
                                href={`mailto:${selectedMessage.email}?subject=Re: Inquiry from ${selectedMessage.name}`}
                                className="px-5 py-2.5 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] text-white rounded-xl text-sm font-semibold transition shadow-md cursor-pointer inline-flex items-center gap-2"
                            >
                                <Mail className="w-4 h-4" />
                                Reply via Email
                            </a>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setMessageToDelete(null);
                }}
                title="Delete Message"
                width="max-w-md"
            >
                <div className="p-4">
                    <p className="text-gray-700">
                        Are you sure you want to delete the message from <strong>{messageToDelete?.name}</strong>?
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={() => {
                                setIsDeleteModalOpen(false);
                                setMessageToDelete(null);
                            }}
                            className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 transition font-medium cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDelete}
                            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition font-medium cursor-pointer"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
