"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Modal from "@/components/(sheared)/Modal";
import ErrorMessage from "@/components/(sheared)/ErrorMessage";
import SuccessMessage from "@/components/(sheared)/SuccessMessage";
import { useLoader } from "@/context/LoaderContext";
import { Pencil, Trash2, Search, Loader2, Plus, Check } from "lucide-react";
import ProtectedRoute from "@/components/(sheared)/ProtectedRoute";
import { getErrorMessage } from "../../../../../utils/errorUtils";
import { TopbarAnnouncement } from "@/common/interface";
import {
    getAdminAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    toggleAnnouncementStatus,
} from "../../../../../utils/topbarAnnouncementApi";

const PAGE_SIZE = 10;

const schema = yup.object({
    title: yup
        .string()
        .trim()
        .required("Title is required")
        .min(3, "Title must be at least 3 characters")
        .max(255, "Title cannot exceed 255 characters"),
    icon: yup
        .string()
        .trim()
        .nullable()
        .max(100, "Icon cannot exceed 100 characters"),
    link_url: yup
        .string()
        .trim()
        .nullable()
        .max(500, "Link URL cannot exceed 500 characters")
        .test(
            "is-valid-url",
            "Must be a valid relative path (e.g. /offers) or full URL (e.g. https://...)",
            (value) => {
                if (!value || value === "") return true;
                if (value.startsWith("/")) return true;
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            }
        ),
    status: yup.boolean().required(),
});

type FormValues = yup.InferType<typeof schema>;

const EMOJI_SUGGESTIONS = ["🚀", "🎉", "🔥", "⚡", "🎁", "📦", "📢", "✨", "🏷️", "🚚"];

export default function TopbarAnnouncementsManagement() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFormSubmit, setIsFormSubmit] = useState(false);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<TopbarAnnouncement | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Infinite scroll & announcements state
    const [announcements, setAnnouncements] = useState<TopbarAnnouncement[]>([]);
    const [page, setPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(true);
    const [totalAnnouncements, setTotalAnnouncements] = useState(0);
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const isFetchingRef = useRef(false);
    const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    const { showLoader, hideLoader } = useLoader();

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors },
    } = useForm<any>({
        resolver: yupResolver(schema),
        mode: "onChange",
        defaultValues: {
            title: "",
            icon: "",
            link_url: "",
            status: true,
        },
    });

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

    // Fetch announcements from API
    const loadAnnouncements = async (pageNum: number, search: string = "", isAppend: boolean = false) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        if (isAppend) {
            setIsLoadingMore(true);
        } else {
            setIsLoadingInitial(true);
            if (search) setIsSearching(true);
        }

        try {
            const res = await getAdminAnnouncements({
                page: pageNum,
                limit: PAGE_SIZE,
                per_page: PAGE_SIZE,
                search: search || undefined,
            });

            let list: TopbarAnnouncement[] = [];
            let total = 0;
            let hasNext = false;

            if (res && res.res === "success" && Array.isArray(res.data)) {
                list = res.data;
                total = res.total ?? list.length;
                hasNext = Boolean(
                    res.has_next_page ??
                    res.hasNextPage ??
                    res.has_more ??
                    (res.last_page ? pageNum < res.last_page : list.length >= PAGE_SIZE)
                );
            } else if (Array.isArray(res)) {
                list = res;
                total = list.length;
                hasNext = false;
            }

            setTotalAnnouncements(total);
            setHasNextPage(hasNext);
            setPage(pageNum);

            if (isAppend) {
                setAnnouncements((prev) => {
                    const existingIds = new Set(prev.map((a) => a.id));
                    const newUnique = list.filter((a) => !existingIds.has(a.id));
                    return [...prev, ...newUnique];
                });
            } else {
                setAnnouncements(list);
            }
        } catch {
            setErrorMessage("Please try again");
            if (!isAppend) setAnnouncements([]);
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
        loadAnnouncements(1, debouncedSearchQuery, false);
    }, [debouncedSearchQuery]);

    // Load next page on scroll
    const loadNextPage = useCallback(() => {
        if (!hasNextPage || isLoadingMore || isLoadingInitial || isFetchingRef.current) return;
        loadAnnouncements(page + 1, debouncedSearchQuery, true);
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

    const openModal = (announcement: TopbarAnnouncement | null = null) => {
        setSelectedAnnouncement(announcement);

        if (announcement) {
            reset({
                title: announcement.title,
                icon: announcement.icon ?? "",
                link_url: announcement.link_url ?? "",
                status: announcement.status === "active",
            });
        } else {
            reset({
                title: "",
                icon: "🚀",
                link_url: "",
                status: true,
            });
        }
        setIsModalOpen(true);
    };

    const onSubmit = async (data: FormValues) => {
        showLoader();
        setIsFormSubmit(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const payload = {
                title: data.title.trim(),
                icon: data.icon ? data.icon.trim() : null,
                link_url: data.link_url ? data.link_url.trim() : null,
                status: data.status ? ("active" as const) : ("inactive" as const),
            };

            if (selectedAnnouncement) {
                const res = await updateAnnouncement(selectedAnnouncement.id, payload);
                const updated = res?.data || { ...selectedAnnouncement, ...payload };
                setAnnouncements((prev) =>
                    prev.map((a) => (a.id === selectedAnnouncement.id ? { ...a, ...updated } : a))
                );
                setSuccessMessage("Announcement updated successfully!");
            } else {
                const res = await createAnnouncement(payload);
                const created = res?.data;
                if (created) {
                    setAnnouncements((prev) => [created, ...prev]);
                    setTotalAnnouncements((prev) => prev + 1);
                } else {
                    await loadAnnouncements(1, debouncedSearchQuery, false);
                }
                setSuccessMessage("Announcement created successfully!");
            }

            reset({ title: "", icon: "", link_url: "", status: true });
            setIsModalOpen(false);
        } catch (err: any) {
            setErrorMessage(getErrorMessage(err, "Please try again."));
        } finally {
            setIsFormSubmit(false);
            hideLoader();
        }
    };

    const confirmDelete = (announcement: TopbarAnnouncement) => {
        setSelectedAnnouncement(announcement);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!selectedAnnouncement) return;
        showLoader();
        try {
            await deleteAnnouncement(selectedAnnouncement.id);
            setAnnouncements((prev) => prev.filter((a) => a.id !== selectedAnnouncement.id));
            setTotalAnnouncements((prev) => Math.max(0, prev - 1));
            setSuccessMessage("Announcement deleted successfully!");
            setIsDeleteModalOpen(false);
        } catch (err: any) {
            console.error(err);
            setErrorMessage(getErrorMessage(err, "Failed to delete announcement"));
        } finally {
            hideLoader();
        }
    };

    const handleStatusToggle = async (announcement: TopbarAnnouncement) => {
        const nextStatus = announcement.status === "active" ? "inactive" : "active";
        try {
            await toggleAnnouncementStatus(announcement.id, nextStatus);
            setAnnouncements((prev) =>
                prev.map((a) =>
                    a.id === announcement.id ? { ...a, status: nextStatus } : a
                )
            );
            setSuccessMessage("Status updated successfully!");
        } catch (err: any) {
            setErrorMessage(getErrorMessage(err, "Failed to toggle status."));
        }
    };

    return (
        <ProtectedRoute role="Admin">
            <div className="z-[999] p-3 md:p-6">
                {errorMessage && (<ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />)}
                {successMessage && (<SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />)}

                {/* Header + Search */}
                <div className="mb-4 md:mb-6 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-xl shadow-md">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 md:px-6 py-3.5 md:py-4">

                        {/* Title & Count */}
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg md:text-xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">
                                Topbar Management
                            </h2>
                            {totalAnnouncements > 0 && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                    {announcements.length} of {totalAnnouncements}
                                </span>
                            )}
                        </div>

                        {/* Actions & Search */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                            {/* Search Input */}
                            <div className="relative w-full sm:w-72">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search announcements..."
                                    className="w-full rounded-xl border border-gray-300 bg-white pl-10 pr-10 py-2 md:py-2.5 text-sm md:text-base text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition-all"
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

                            {/* Create Announcement Button */}
                            <button
                                onClick={() => openModal(null)}
                                className="flex items-center justify-center gap-1.5 px-4 py-2 md:py-2.5 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] rounded-xl shadow-md text-white font-semibold text-xs md:text-sm hover:shadow-lg transition-all duration-200 whitespace-nowrap cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Create Announcement</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Table - Desktop */}
                <div className="hidden md:block overflow-x-auto scrollbar rounded-2xl shadow-lg border border-gray-200 bg-white">
                    <table className="w-full min-w-[800px] text-sm text-left">
                        <thead className="bg-gray-50 uppercase text-xs font-semibold text-gray-600 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4">S.No.</th>
                                <th className="px-6 py-4">Title</th>
                                <th className="px-6 py-4">Icon</th>
                                <th className="px-6 py-4">Link URL</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-end">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {isLoadingInitial && announcements.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-16">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="w-8 h-8 animate-spin text-[#007FFF]" />
                                            <span className="text-sm font-medium text-gray-500">Loading announcements...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : announcements.length ? (
                                announcements.map((item, index) => (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-blue-50/30 transition"
                                    >
                                        <td className="px-6 py-4 font-semibold text-gray-500">{index + 1}</td>
                                        <td className="px-6 py-4 max-w-[280px] break-all whitespace-normal font-semibold text-gray-900">
                                            {item.title}
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.icon ? (
                                                <span className="text-xl inline-block">{item.icon}</span>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 max-w-[200px] break-all whitespace-normal">
                                            {item.link_url ? (
                                                <a
                                                    href={item.link_url}
                                                    target={item.link_url.startsWith("http") ? "_blank" : "_self"}
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:text-blue-700 underline font-medium"
                                                >
                                                    {item.link_url}
                                                </a>
                                            ) : (
                                                <span className="text-gray-400 text-xs italic">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleStatusToggle(item)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors cursor-pointer ${item.status === "active" ? "bg-green-500" : "bg-red-500"
                                                    }`}
                                                title="Toggle Status"
                                            >
                                                <span
                                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${item.status === "active" ? "translate-x-5" : "translate-x-0"
                                                        }`}
                                                />
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    title="Edit Announcement"
                                                    onClick={() => openModal(item)}
                                                    className="size-10 bg-blue-100 hover:bg-blue-200 text-blue-600 flex justify-center items-center rounded-full transition cursor-pointer"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    title="Delete Announcement"
                                                    onClick={() => confirmDelete(item)}
                                                    className="size-10 bg-red-100 hover:bg-red-200 text-red-600 flex justify-center items-center rounded-full transition cursor-pointer"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="text-center text-gray-500 py-16"
                                    >
                                        <p className="font-semibold text-gray-700">No announcements found</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Cards - Mobile */}
                <div className="md:hidden space-y-4">
                    {isLoadingInitial && announcements.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-md border border-gray-200">
                            <Loader2 className="w-8 h-8 animate-spin text-[#007FFF] mb-2" />
                            <span className="text-sm font-medium text-gray-500">Loading announcements...</span>
                        </div>
                    ) : announcements.length ? (
                        announcements.map((item, index) => (
                            <div
                                key={item.id}
                                className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg transition"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                {item.icon && <span className="text-xl">{item.icon}</span>}
                                                <h3 className="font-bold text-gray-900 text-base">{item.title}</h3>
                                            </div>
                                            <button
                                                onClick={() => handleStatusToggle(item)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors cursor-pointer ${item.status === "active" ? "bg-green-500" : "bg-red-500"
                                                    }`}
                                                title="Toggle Status"
                                            >
                                                <span
                                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${item.status === "active" ? "translate-x-5" : "translate-x-0"
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-400 font-semibold">#{index + 1}</p>
                                    </div>
                                </div>

                                {item.link_url && (
                                    <div className="mb-3">
                                        <a
                                            href={item.link_url}
                                            target={item.link_url.startsWith("http") ? "_blank" : "_self"}
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:text-blue-700 underline truncate block font-medium"
                                        >
                                            {item.link_url}
                                        </a>
                                    </div>
                                )}

                                <div className="flex gap-2 pt-3 border-t border-gray-100">
                                    <button
                                        onClick={() => openModal(item)}
                                        className="flex-1 py-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-xs cursor-pointer"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => confirmDelete(item)}
                                        className="flex-1 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-xs cursor-pointer"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
                            <p className="text-gray-500 font-medium">No announcements found</p>
                        </div>
                    )}
                </div>

                {/* Bottom Sentinel for Infinite Scroll */}
                <div ref={bottomSentinelRef} className="h-6 w-full pointer-events-none" />

                {/* Infinite Scroll Bottom Loading State */}
                {isLoadingMore && (
                    <div className="flex items-center justify-center gap-2.5 py-6 text-sm text-gray-600 animate-in fade-in duration-200">
                        <Loader2 className="w-5 h-5 animate-spin text-[#007FFF]" />
                        <span className="font-semibold text-gray-700">Loading more announcements...</span>
                    </div>
                )}

                {/* All Announcements Loaded End Indicator */}
                {!hasNextPage && announcements.length > 0 && !isLoadingInitial && (
                    <div className="flex items-center justify-center py-6 text-xs md:text-sm text-gray-400 font-medium animate-in fade-in duration-200">
                        <span className="bg-gray-100/90 px-4 py-1.5 rounded-full border border-gray-200 text-gray-600 font-semibold shadow-xs flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>All {announcements.length} announcements loaded</span>
                        </span>
                    </div>
                )}

                {/* Modal */}
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        reset();
                        setSelectedAnnouncement(null);
                    }}
                    title={selectedAnnouncement ? "Edit Announcement" : "Create Announcement"}
                >
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 md:p-6 text-gray-800">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                {...register("title")}
                                type="text"
                                placeholder="e.g. Free shipping on orders over ₹999!"
                                className={`w-full px-4 py-2.5 rounded-xl border bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 transition text-sm ${errors.title ? "border-red-400 focus:ring-red-200" : "border-gray-200 focus:ring-blue-100 focus:border-[#007FFF]"
                                    }`}
                            />
                            {errors.title && (
                                <p className="text-xs text-red-500 mt-1 font-medium">{String(errors.title.message)}</p>
                            )}
                        </div>

                        {/* Icon */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Icon / Emoji <span className="text-xs text-gray-400 font-normal">(optional)</span>
                            </label>
                            <input
                                {...register("icon")}
                                type="text"
                                placeholder="e.g. 🚀 or 🔥"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#007FFF] transition text-sm"
                            />
                            {/* Suggestions */}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {EMOJI_SUGGESTIONS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => setValue("icon", emoji)}
                                        className="px-2 py-1 bg-gray-100 hover:bg-blue-100 rounded-lg text-base transition cursor-pointer"
                                        title={`Pick ${emoji}`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Link URL */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Link URL <span className="text-xs text-gray-400 font-normal">(optional — internal path or https://)</span>
                            </label>
                            <input
                                {...register("link_url")}
                                type="text"
                                placeholder="e.g. /products or https://..."
                                className={`w-full px-4 py-2.5 rounded-xl border bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 transition text-sm ${errors.link_url ? "border-red-400 focus:ring-red-200" : "border-gray-200 focus:ring-blue-100 focus:border-[#007FFF]"
                                    }`}
                            />
                            {errors.link_url && (
                                <p className="text-xs text-red-500 mt-1 font-medium">{String(errors.link_url.message)}</p>
                            )}
                        </div>

                        {/* Status */}
                        <div className="flex items-center justify-between py-2">
                            <div>
                                <span className="text-sm font-semibold text-gray-700">Active Status</span>
                                <p className="text-xs text-gray-400">Controls whether this appears on the public topbar</p>
                            </div>
                            <label className="flex items-center cursor-pointer">
                                <div
                                    className={`flex items-center h-6 w-11 rounded-full p-0.5 transition-all duration-300 ${watch("status") ? "bg-green-500" : "bg-gray-300"
                                        }`}
                                >
                                    <input type="checkbox" {...register("status")} hidden />
                                    <div
                                        className={`h-5 w-5 rounded-full bg-white shadow-md transform transition-all duration-300 ${watch("status") ? "translate-x-5" : "translate-x-0"
                                            }`}
                                    />
                                </div>
                            </label>
                        </div>

                        <hr className="border-gray-100 my-2" />

                        {/* Submit Button */}
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsModalOpen(false);
                                    reset();
                                }}
                                className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isFormSubmit}
                                className={`px-7 py-2.5 rounded-xl font-semibold text-white shadow-md transition text-sm cursor-pointer ${isFormSubmit
                                        ? "bg-blue-300 cursor-not-allowed"
                                        : "bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB]"
                                    }`}
                            >
                                {isFormSubmit ? "Saving..." : selectedAnnouncement ? "Update Announcement" : "Create Announcement"}
                            </button>
                        </div>
                    </form>
                </Modal>

                {/* Delete Modal */}
                <Modal
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    title="Delete Announcement"
                >
                    <div className="p-6 max-w-sm text-center">
                        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-7 h-7 text-red-500" />
                        </div>
                        <p className="text-sm text-gray-600 mb-5">
                            Are you sure you want to delete <strong>&quot;{selectedAnnouncement?.title}&quot;</strong>? This cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors text-sm cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors text-sm cursor-pointer"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </Modal>
            </div>
        </ProtectedRoute>
    );
}
