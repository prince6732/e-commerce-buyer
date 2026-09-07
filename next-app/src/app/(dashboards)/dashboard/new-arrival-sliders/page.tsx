"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { AxiosError } from "axios";
import { Pencil, Trash2, Images, Search, Loader2, Plus, Check } from "lucide-react";
import Modal from "@/components/(sheared)/Modal";
import ErrorMessage from "@/components/(sheared)/ErrorMessage";
import SuccessMessage from "@/components/(sheared)/SuccessMessage";
import ProtectedRoute from "@/components/(sheared)/ProtectedRoute";
import ImageCropperModal from "@/components/(frontend)/ImageCropperModal";
import { useLoader } from "@/context/LoaderContext";
import {
    fetchNewArrivalSliders,
    createNewArrivalSlider,
    updateNewArrivalSlider,
    deleteNewArrivalSlider,
    toggleNewArrivalSliderStatus,
    type NewArrivalSlider,
} from "../../../../../utils/newArrivalApi";

const basePath = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";
const PAGE_SIZE = 10;

type FormData = {
    title?: string | null;
    description: string;
    link: string;
    open_in_new_tab: boolean;
    status: boolean;
};

function NewArrivalSlidersManagement() {
    // Infinite scroll & sliders state
    const [sliders, setSliders] = useState<NewArrivalSlider[]>([]);
    const [page, setPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(true);
    const [totalSliders, setTotalSliders] = useState(0);
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const isFetchingRef = useRef(false);
    const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    // Modals & UI state
    const [selected, setSelected] = useState<NewArrivalSlider | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isFormSubmit, setIsFormSubmit] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [imageError, setImageError] = useState(false);
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const { showLoader, hideLoader } = useLoader();

    const {
        register,
        handleSubmit,
        setValue,
        reset,
        watch,
        formState: { errors },
    } = useForm<FormData>({
        defaultValues: { status: true, open_in_new_tab: false, description: "", link: "" },
    });

    const statusValue = watch("status");
    const openInNewTab = watch("open_in_new_tab");

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

    // Fetch Sliders
    const loadSliders = async (pageNum: number, search: string = "", isAppend: boolean = false) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        if (isAppend) {
            setIsLoadingMore(true);
        } else {
            setIsLoadingInitial(true);
            if (search) setIsSearching(true);
        }

        try {
            const res = await fetchNewArrivalSliders({
                page: pageNum,
                limit: PAGE_SIZE,
                search: search || undefined,
                paginate: true,
            });

            let list: NewArrivalSlider[] = [];
            let paginationData: any = null;

            if (res && res.data && Array.isArray(res.data.sliders)) {
                list = res.data.sliders;
                paginationData = res.data.pagination;
            } else if (res && Array.isArray(res.sliders)) {
                list = res.sliders;
                paginationData = res.pagination;
            } else if (Array.isArray(res)) {
                list = res;
            }

            const total = paginationData?.total ?? list.length;
            const hasNext = Boolean(
                paginationData?.has_next_page ??
                paginationData?.hasNextPage ??
                paginationData?.has_more ??
                (paginationData ? pageNum < paginationData.last_page : list.length >= PAGE_SIZE)
            );

            setTotalSliders(total);
            setHasNextPage(hasNext);
            setPage(pageNum);

            if (isAppend) {
                setSliders((prev) => {
                    const existingIds = new Set(prev.map((s) => s.id));
                    const newUnique = list.filter((s) => !existingIds.has(s.id));
                    return [...prev, ...newUnique];
                });
            } else {
                setSliders(list);
            }
        } catch {
            setErrorMessage("Failed to load posters. Please try again.");
            if (!isAppend) setSliders([]);
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
        loadSliders(1, debouncedSearchQuery, false);
    }, [debouncedSearchQuery]);

    // Load next page on scroll
    const loadNextPage = useCallback(() => {
        if (!hasNextPage || isLoadingMore || isLoadingInitial || isFetchingRef.current) return;
        loadSliders(page + 1, debouncedSearchQuery, true);
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

    const openModal = (slider: NewArrivalSlider | null = null) => {
        setSelected(slider);
        setPreviewImage(null);
        setImageError(false);
        if (slider) {
            setValue("title", slider.title);
            setValue("description", slider.description ?? "");
            setValue("link", slider.link ?? "");
            setValue("open_in_new_tab", slider.open_in_new_tab ?? false);
            setValue("status", slider.status);
            setPreviewImage(slider.image);
        } else {
            reset({ status: true, open_in_new_tab: false, description: "", link: "", title: "" });
        }
        setIsModalOpen(true);
    };

    const onSubmit = async (data: FormData) => {
        if (!selected && !previewImage) {
            setImageError(true);
            return;
        }
        showLoader();
        setIsFormSubmit(true);
        try {
            const payload = {
                title: data.title,
                description: data.description || "",
                link: data.link || "",
                open_in_new_tab: data.open_in_new_tab,
                status: data.status,
                image: previewImage || selected?.image || "",
            };

            if (selected) {
                const res = await updateNewArrivalSlider(selected.id, payload);
                const updated = res?.slider || res?.data || { ...selected, ...payload };
                setSliders((prev) =>
                    prev.map((s) => (s.id === selected.id ? { ...s, ...updated } : s))
                );
                setSuccessMessage("Poster updated successfully!");
            } else {
                const res = await createNewArrivalSlider(payload);
                const created = res?.slider || res?.data;
                if (created) {
                    setSliders((prev) => [created, ...prev]);
                    setTotalSliders((prev) => prev + 1);
                } else {
                    await loadSliders(1, debouncedSearchQuery, false);
                }
                setSuccessMessage("Poster created successfully!");
            }
            setIsModalOpen(false);
            reset({ status: true, open_in_new_tab: false, description: "", link: "", title: "" });
            setPreviewImage(null);
        } catch (err) {
            const error = err as AxiosError<{ message?: string }>;
            setErrorMessage(error.response?.data?.message || "Failed to save. Please try again.");
        } finally {
            setIsFormSubmit(false);
            hideLoader();
        }
    };

    const handleDelete = async () => {
        if (!selected) return;
        showLoader();
        try {
            await deleteNewArrivalSlider(selected.id);
            setSliders((prev) => prev.filter((s) => s.id !== selected.id));
            setTotalSliders((prev) => Math.max(0, prev - 1));
            setSuccessMessage("Poster deleted successfully!");
            setIsDeleteModalOpen(false);
            setSelected(null);
        } catch (err: any) {
            console.error(err);
            setErrorMessage(err.response?.data?.message || err.response?.data?.error || "Failed to delete. Please try again.");
        } finally {
            hideLoader();
        }
    };

    const handleStatusToggle = async (slider: NewArrivalSlider) => {
        try {
            await toggleNewArrivalSliderStatus(slider.id);
            setSliders((prev) =>
                prev.map((s) => s.id === slider.id ? { ...s, status: !s.status } : s)
            );
            setSuccessMessage("Status updated successfully!");
        } catch {
            setErrorMessage("Failed to toggle status.");
        }
    };

    return (
        <div className="p-3 md:p-6">
            {errorMessage && <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />}
            {successMessage && <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />}

            {/* Header + Search */}
            <div className="mb-4 md:mb-6 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-xl shadow-md">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 md:px-6 py-3.5 md:py-4">

                    {/* Title & Count */}
                    <div className="flex items-center gap-3">
                        <Images className="w-6 h-6 text-[#007FFF]" />
                        <h2 className="text-lg md:text-xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">
                            New Arrival Posters
                        </h2>
                        {totalSliders > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                {sliders.length} of {totalSliders}
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
                                placeholder="Search posters..."
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

                        {/* Add Poster Button */}
                        <button
                            onClick={() => openModal(null)}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 md:py-2.5 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] rounded-xl shadow-md text-white font-semibold text-xs md:text-sm hover:shadow-lg transition-all duration-200 whitespace-nowrap cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Poster</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block">
                <div className="overflow-x-auto scrollbar rounded-2xl shadow-lg border border-gray-200 bg-white">
                    <table className="w-full min-w-[800px] text-sm text-left">
                        <thead className="bg-gray-50 uppercase text-xs font-semibold text-gray-600 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4">S.No.</th>
                                <th className="px-6 py-4">Image</th>
                                <th className="px-6 py-4">Title</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4">Link</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-700">
                            {isLoadingInitial && sliders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="w-8 h-8 animate-spin text-[#007FFF]" />
                                            <span className="text-sm font-medium text-gray-500">Loading posters...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : sliders.length ? (
                                sliders.map((slider, idx) => (
                                    <tr key={slider.id} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="px-6 py-4 font-semibold text-gray-500">{idx + 1}</td>
                                        <td className="px-6 py-4">
                                            {slider.image ? (
                                                <img
                                                    src={`${basePath}${slider.image}`}
                                                    alt={slider.title || "Poster Banner"}
                                                    onClick={() => {
                                                        setImagePreviewUrl(`${basePath}${slider.image}`);
                                                        setIsImagePreviewOpen(true);
                                                    }}
                                                    className="h-14 w-24 rounded-xl object-cover border border-gray-200 shadow-sm cursor-pointer hover:scale-105 transition-transform"
                                                />
                                            ) : <span className="text-xs text-gray-400 italic">No Image</span>}
                                        </td>
                                        <td className="px-6 py-4 font-semibold max-w-[200px] break-all whitespace-normal text-gray-900">
                                            {slider.title ? slider.title : <span className="text-gray-400 italic">No Title</span>}
                                        </td>
                                        <td className="px-6 py-4 max-w-[300px] break-all whitespace-normal text-gray-600">
                                            {slider.description
                                                ? <span>{slider.description}</span>
                                                : <span className="text-gray-400 italic">—</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            {slider.link
                                                ? (
                                                    <a
                                                        href={slider.link}
                                                        target={(slider.open_in_new_tab === true || String(slider.open_in_new_tab) === "1" || String(slider.open_in_new_tab) === "true") ? "_blank" : "_self"}
                                                        className="text-blue-600 hover:text-blue-700 underline truncate max-w-[160px] inline-block font-medium"
                                                        title={slider.link}
                                                        rel="noreferrer"
                                                    >
                                                        {slider.link}
                                                    </a>
                                                )
                                                : <span className="text-gray-400 italic">—</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleStatusToggle(slider)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors duration-300 cursor-pointer ${slider.status ? "bg-green-500" : "bg-red-500"}`}
                                                title="Toggle Status"
                                            >
                                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300 ${slider.status ? "translate-x-5" : "translate-x-0"}`} />
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center gap-2 justify-end">
                                                <button
                                                    onClick={() => openModal(slider)}
                                                    className="size-10 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full flex items-center justify-center transition cursor-pointer"
                                                    title="Edit"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => { setSelected(slider); setIsDeleteModalOpen(true); }}
                                                    className="size-10 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center transition cursor-pointer"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-4 py-16 text-center text-gray-500">
                                        <Images className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                        <p className="font-semibold text-gray-700">No posters found</p>
                                        <p className="text-xs text-gray-400 mt-0.5">Click &quot;Add Poster&quot; to create your first New Arrivals banner.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {isLoadingInitial && sliders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-md border border-gray-200">
                        <Loader2 className="w-8 h-8 animate-spin text-[#007FFF] mb-2" />
                        <span className="text-sm font-medium text-gray-500">Loading posters...</span>
                    </div>
                ) : sliders.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center text-gray-500">
                        <Images className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p className="font-semibold text-gray-700">No posters found</p>
                    </div>
                ) : sliders.map((slider, index) => (
                    <div key={slider.id} className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
                        <div className="flex items-start gap-3">
                            {slider.image ? (
                                <img
                                    src={`${basePath}${slider.image}`}
                                    alt={slider.title || "Poster Banner"}
                                    onClick={() => {
                                        setImagePreviewUrl(`${basePath}${slider.image}`);
                                        setIsImagePreviewOpen(true);
                                    }}
                                    className="w-20 h-14 rounded-lg object-cover flex-shrink-0 border border-gray-100 cursor-pointer"
                                />
                            ) : (
                                <div className="w-20 h-14 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 text-xs text-gray-400">
                                    No Image
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-1">
                                    <h3 className="font-bold text-gray-900 text-sm truncate">{slider.title || "Untitled Poster"}</h3>
                                    <span className="text-xs text-gray-400 font-semibold">#{index + 1}</span>
                                </div>
                                {slider.description && (
                                    <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{slider.description}</p>
                                )}
                                <div className="flex items-center gap-3 mt-3">
                                    <button
                                        onClick={() => handleStatusToggle(slider)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors cursor-pointer ${slider.status ? "bg-green-500" : "bg-red-500"}`}
                                    >
                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${slider.status ? "translate-x-5" : "translate-x-0"}`} />
                                    </button>
                                    <button onClick={() => openModal(slider)} className="p-1.5 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg cursor-pointer">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => { setSelected(slider); setIsDeleteModalOpen(true); }} className="p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg cursor-pointer">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom Sentinel for Infinite Scroll */}
            <div ref={bottomSentinelRef} className="h-6 w-full pointer-events-none" />

            {/* Infinite Scroll Bottom Loading State */}
            {isLoadingMore && (
                <div className="flex items-center justify-center gap-2.5 py-6 text-sm text-gray-600 animate-in fade-in duration-200">
                    <Loader2 className="w-5 h-5 animate-spin text-[#007FFF]" />
                    <span className="font-semibold text-gray-700">Loading more posters...</span>
                </div>
            )}

            {/* All Posters Loaded Indicator */}
            {!hasNextPage && sliders.length > 0 && !isLoadingInitial && (
                <div className="flex items-center justify-center py-6 text-xs md:text-sm text-gray-400 font-medium animate-in fade-in duration-200">
                    <span className="bg-gray-100/90 px-4 py-1.5 rounded-full border border-gray-200 text-gray-600 font-semibold shadow-xs flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>All {sliders.length} posters loaded</span>
                    </span>
                </div>
            )}

            {/* Create / Edit Modal */}
            {isModalOpen && (
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        reset({ status: true, open_in_new_tab: false, description: "", link: "", title: "" });
                        setPreviewImage(null);
                    }}
                    title={selected ? "Edit Poster" : "Add New Arrival Poster"}
                    width="max-w-4xl"
                >
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className="grid gap-6 text-gray-800 p-4 md:p-6 max-h-[80vh] overflow-y-auto"
                    >
                        {/* Image Upload Section */}
                        <div className="bg-gray-50 border border-gray-200 p-5 rounded-2xl">
                            <label className="block text-xs md:text-sm font-semibold text-gray-900 mb-3">
                                Poster Banner Image <span className="text-red-500">*</span>
                            </label>

                            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                                <div className="flex-shrink-0 w-full md:w-auto flex justify-center">
                                    {previewImage ? (
                                        <div className="relative group">
                                            <img
                                                src={`${basePath}${previewImage}`}
                                                alt="Poster Preview"
                                                className="h-28 w-48 rounded-xl object-cover border border-gray-200 shadow-md"
                                            />
                                        </div>
                                    ) : (
                                        <div className="h-28 w-48 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-xs text-gray-400 bg-white shadow-inner">
                                            <span>No Image Selected</span>
                                            <span className="text-[10px] mt-1 text-gray-400">(Required - 16:9 ratio)</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <ImageCropperModal
                                        directory="new-arrival-sliders"
                                        aspectRatio={16 / 9}
                                        buttonLabel="Select Image"
                                        onSelect={(img) => {
                                            setPreviewImage(img as string);
                                            setImageError(false);
                                        }}
                                    />
                                    <p className="text-xs text-gray-500">Upload a landscape image (recommended size: 1920x1080px).</p>
                                    {imageError && (
                                        <p className="text-xs text-red-500 mt-0.5 font-medium">Image is required</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Title & Description */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs md:text-sm font-semibold text-gray-900 mb-1">
                                    Title
                                </label>
                                <input
                                    {...register("title")}
                                    type="text"
                                    placeholder="Enter Title (optional)"
                                    className="w-full py-2.5 px-4 rounded-xl bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#007FFF] transition text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs md:text-sm font-semibold text-gray-900 mb-1">
                                    Description
                                </label>
                                <input
                                    {...register("description")}
                                    type="text"
                                    placeholder="Enter Description (optional)"
                                    className="w-full py-2.5 px-4 rounded-xl bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#007FFF] transition text-sm"
                                />
                            </div>
                        </div>

                        {/* Link & Open in New Tab */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                            <div>
                                <label className="block text-xs md:text-sm font-semibold text-gray-900 mb-1">
                                    Link URL
                                </label>
                                <input
                                    {...register("link")}
                                    type="text"
                                    placeholder="Enter Link URL (optional)"
                                    className="w-full py-2.5 px-4 rounded-xl bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#007FFF] transition text-sm"
                                />
                            </div>

                            {/* Open in New Tab Toggle */}
                            <div className="flex items-center pt-5">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <span className="text-sm font-semibold text-gray-900">
                                        Open in New Tab
                                    </span>
                                    <div
                                        className={`flex items-center h-6 w-11 rounded-full p-0.5 transition-all duration-300 ${openInNewTab ? "bg-[#007FFF]" : "bg-gray-300"}`}
                                    >
                                        <input type="checkbox" {...register("open_in_new_tab")} hidden />
                                        <div
                                            className={`h-5 w-5 rounded-full bg-white shadow-md transform transition-all duration-300 ${openInNewTab ? "translate-x-5" : "translate-x-0"}`}
                                        />
                                    </div>
                                </label>
                            </div>
                        </div>

                        <hr className="border-gray-200" />

                        {/* Status + Submit */}
                        <div className="flex items-center justify-between gap-4 pt-2">
                            {/* Status Toggle */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <span className="text-sm font-semibold text-gray-900">Status</span>
                                <div
                                    className={`flex items-center h-6 w-11 rounded-full p-0.5 transition-all duration-300 ${statusValue ? "bg-green-500" : "bg-red-500"}`}
                                >
                                    <input type="checkbox" {...register("status")} hidden />
                                    <div
                                        className={`h-5 w-5 rounded-full bg-white shadow-md transform transition-all duration-300 ${statusValue ? "translate-x-5" : "translate-x-0"}`}
                                    />
                                </div>
                            </label>

                            <button
                                type="submit"
                                disabled={isFormSubmit}
                                className={`px-8 py-2.5 rounded-xl font-semibold text-white shadow-md transition-all duration-300 text-sm cursor-pointer ${isFormSubmit
                                    ? "bg-blue-400/40 cursor-not-allowed"
                                    : "bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] hover:shadow-blue-500/30"
                                    }`}
                            >
                                {isFormSubmit ? "Saving..." : selected ? "Update Poster" : "Save Poster"}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <Modal
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    title="Delete Poster"
                    width="max-w-md"
                >
                    <div className="p-4">
                        <p className="text-gray-700">
                            Are you sure you want to delete <strong>&quot;{selected?.title || "this poster"}&quot;</strong>? This cannot be undone.
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
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
            )}

            {/* Full Image Preview Modal */}
            {isImagePreviewOpen && imagePreviewUrl && (
                <Modal
                    isOpen={isImagePreviewOpen}
                    onClose={() => setIsImagePreviewOpen(false)}
                    title="Image Preview"
                    width="max-w-3xl"
                >
                    <div className="p-4">
                        <img
                            src={imagePreviewUrl}
                            alt="Preview"
                            className="max-w-full max-h-[80vh] rounded-xl object-contain mx-auto border border-gray-200"
                        />
                    </div>
                </Modal>
            )}
        </div>
    );
}

export default function NewArrivalSlidersPage() {
    return (
        <ProtectedRoute role="Admin">
            <NewArrivalSlidersManagement />
        </ProtectedRoute>
    );
}
