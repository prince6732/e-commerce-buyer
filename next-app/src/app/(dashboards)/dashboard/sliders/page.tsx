"use client";

import { yupResolver } from "@hookform/resolvers/yup";
import { useEffect, useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import * as yup from "yup";
import Modal from "@/components/(sheared)/Modal";
import ErrorMessage from "@/components/(sheared)/ErrorMessage";
import SuccessMessage from "@/components/(sheared)/SuccessMessage";
import { useLoader } from "@/context/LoaderContext";
import { Pencil, Trash2, GripVertical, Search, Loader2, Plus, Check } from "lucide-react";
import ProtectedRoute from "@/components/(sheared)/ProtectedRoute";
import ImageCropperModal from "@/components/(frontend)/ImageCropperModal";
import {
    createSlider,
    deleteSlider,
    fetchSliders,
    SliderPayload,
    updateSlider,
    updateSliderOrder,
    toggleSliderStatus
} from "../../../../../utils/slider";
import { Slider } from "@/common/interface";
import { getErrorMessage } from "../../../../../utils/errorUtils";

const basePath = process.env.NEXT_PUBLIC_UPLOAD_BASE || "https://api.zelton.co.in";
const PAGE_SIZE = 10;

const schema = yup.object({
    title: yup.string().nullable().max(100),
    description: yup.string().nullable(),
    link: yup.string().nullable().url("Please enter a valid URL"),
    open_in_new_tab: yup.boolean(),
    status: yup.boolean(),
    image: yup.mixed().nullable(),
    show_buttons: yup.boolean(),
    button1_text: yup.string().nullable().max(100),
    button1_link: yup.string().nullable(),
    button2_text: yup.string().nullable().max(100),
    button2_link: yup.string().nullable(),
});

type FormData = yup.InferType<typeof schema>;

function SlidersManagement() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFormSubmit, setIsFormSubmit] = useState(false);
    const [selectedSlider, setSelectedSlider] = useState<Slider | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Infinite scroll & sliders state
    const [sliders, setSliders] = useState<Slider[]>([]);
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

    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [draggedItem, setDraggedItem] = useState<Slider | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const { showLoader, hideLoader } = useLoader();
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
    const [sliderDesc, setSliderDesc] = useState<string>("");

    const {
        register,
        handleSubmit,
        setValue,
        reset,
        watch,
        formState: { errors },
    } = useForm({
        resolver: yupResolver(schema),
        defaultValues: {
            status: true,
            show_buttons: false,
            button1_text: 'Shop Now',
            button1_link: '/products',
            button2_text: 'Explore Collection',
            button2_link: '/categories'
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
            const res = await fetchSliders({
                page: pageNum,
                limit: PAGE_SIZE,
                search: search || undefined,
                paginate: true,
            });

            let list: Slider[] = [];
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
            setErrorMessage("Please try again");
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

    const openModal = (slider: Slider | null = null) => {
        setSelectedSlider(slider);
        setPreviewImage(null);

        if (slider) {
            setValue("title", slider.title);
            setValue("description", slider.description);
            setValue("link", slider.link || "");
            setValue("open_in_new_tab", slider.open_in_new_tab || false);
            setValue("status", slider.status);
            setValue("show_buttons", slider.show_buttons);
            setValue("button1_text", slider.button1_text || "");
            setValue("button1_link", slider.button1_link || "");
            setValue("button2_text", slider.button2_text || "");
            setValue("button2_link", slider.button2_link || "");
            setPreviewImage(slider.image || null);
        } else {
            reset({
                status: true,
                open_in_new_tab: false,
                show_buttons: false,
                button1_text: 'Shop Now',
                button1_link: '/products',
                button2_text: 'Explore Collection',
                button2_link: '/categories'
            });
        }
        setIsModalOpen(true);
    };

    const onSubmit = async (data: FormData) => {
        if (!selectedSlider && !previewImage) {
            setErrorMessage("Image is required for new sliders");
            return;
        }

        showLoader();
        setIsFormSubmit(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const payload: SliderPayload = {
                title: data.title,
                description: data.description ?? "",
                link: data.link ?? "",
                open_in_new_tab: data.open_in_new_tab ?? false,
                status: data.status ?? true,
                image: previewImage || selectedSlider?.image || "",
                show_buttons: data.show_buttons ?? true,
                button1_text: data.button1_text ?? "",
                button1_link: data.button1_link ?? "",
                button2_text: data.button2_text ?? "",
                button2_link: data.button2_link ?? "",
            };

            if (selectedSlider) {
                const res = await updateSlider(selectedSlider.id, payload);
                const updated = res?.slider || res?.data || { ...selectedSlider, ...payload };
                setSliders((prev) =>
                    prev.map((s) => (s.id === selectedSlider.id ? { ...s, ...updated } : s))
                );
                setSuccessMessage("Slider updated successfully!");
            } else {
                const res = await createSlider(payload);
                const created = res?.slider || res?.data;
                if (created) {
                    setSliders((prev) => [created, ...prev]);
                    setTotalSliders((prev) => prev + 1);
                } else {
                    await loadSliders(1, debouncedSearchQuery, false);
                }
                setSuccessMessage("Slider created successfully!");
            }

            reset({ status: true, open_in_new_tab: false });
            setPreviewImage(null);
            setIsModalOpen(false);
        } catch (err: any) {
            setErrorMessage(getErrorMessage(err, "Please try again."));
        } finally {
            setIsFormSubmit(false);
            hideLoader();
        }
    };

    const confirmDelete = (slider: Slider) => {
        setSelectedSlider(slider);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        showLoader();
        try {
            if (selectedSlider) {
                await deleteSlider(selectedSlider.id);
                setSliders((prev) => prev.filter((s) => s.id !== selectedSlider.id));
                setTotalSliders((prev) => Math.max(0, prev - 1));
                setSuccessMessage("Slider deleted successfully!");
                setIsDeleteModalOpen(false);
            }
        } catch (err: any) {
            console.error(err);
            setErrorMessage(getErrorMessage(err, "Failed to delete slider"));
        } finally {
            hideLoader();
        }
    };

    const handleStatusToggle = async (slider: Slider) => {
        try {
            await toggleSliderStatus(slider.id);
            setSliders((prev) =>
                prev.map((s) => s.id === slider.id ? { ...s, status: !s.status } : s)
            );
            setSuccessMessage("Status updated successfully!");
        } catch (err: any) {
            setErrorMessage(getErrorMessage(err, "Failed to toggle status."));
        }
    };

    const handleDragStart = (e: React.DragEvent, slider: Slider) => {
        setDraggedItem(slider);
        setIsDragging(true);
        e.dataTransfer.effectAllowed = 'move';

        const target = e.currentTarget as HTMLElement;
        target.style.opacity = '0.5';
        target.style.transform = 'scale(0.95)';
    };

    const handleDragEnd = (e: React.DragEvent) => {
        setDraggedItem(null);
        setIsDragging(false);

        const target = e.currentTarget as HTMLElement;
        target.style.opacity = '1';
        target.style.transform = 'scale(1)';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const target = e.currentTarget as HTMLElement;
        if (!target.classList.contains('drag-over')) {
            target.classList.add('drag-over');
            target.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
            target.style.borderTop = '2px solid #3b82f6';
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        const target = e.currentTarget as HTMLElement;
        target.classList.remove('drag-over');
        target.style.backgroundColor = '';
        target.style.borderTop = '';
    };

    const handleDrop = async (e: React.DragEvent, targetSlider: Slider) => {
        e.preventDefault();

        const target = e.currentTarget as HTMLElement;
        target.classList.remove('drag-over');
        target.style.backgroundColor = '';
        target.style.borderTop = '';

        if (!draggedItem || draggedItem.id === targetSlider.id) {
            return;
        }

        const newSliders = [...sliders];
        const draggedIndex = newSliders.findIndex(s => s.id === draggedItem.id);
        const targetIndex = newSliders.findIndex(s => s.id === targetSlider.id);

        newSliders.splice(draggedIndex, 1);
        newSliders.splice(targetIndex, 0, draggedItem);

        setSliders(newSliders);

        try {
            const orderIds = newSliders.map(slider => slider.id);
            await updateSliderOrder(orderIds);
            setSuccessMessage("Slider order updated successfully!");
        } catch (error) {
            await loadSliders(1, debouncedSearchQuery, false);
            setErrorMessage("Failed to update slider order. Please try again.");
        }
    };

    return (
        <ProtectedRoute role="Admin">
            <div className="z-[999] p-3 md:p-6">
                {errorMessage && (
                    <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />
                )}
                {successMessage && (
                    <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />
                )}

                {/* Header + Search */}
                <div className="mb-4 md:mb-6 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-xl shadow-md">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 md:px-6 py-3.5 md:py-4">

                        {/* Title & Count */}
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg md:text-xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">
                                Sliders
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
                                    placeholder="Search sliders..."
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

                            {/* Create Slider Button */}
                            <button
                                onClick={() => openModal(null)}
                                className="flex items-center justify-center gap-1.5 px-4 py-2 md:py-2.5 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] rounded-xl shadow-md text-white font-semibold text-xs md:text-sm hover:shadow-lg transition-all duration-200 whitespace-nowrap cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Create Slider</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Drag and Drop Info */}
                {sliders.length > 1 && (
                    <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                        <p className="text-xs text-blue-700 flex items-center gap-2 font-medium">
                            <GripVertical className="h-4 w-4" />
                            Drag and drop rows to reorder sliders. Changes will be saved automatically.
                        </p>
                    </div>
                )}

                {/* Table - Desktop */}
                <div
                    className={`hidden md:block overflow-x-auto scrollbar rounded-2xl shadow-lg border border-gray-200 bg-white ${isDragging ? "ring-2 ring-blue-300/50" : ""
                        }`}
                >
                    <table className="w-full min-w-[900px] text-sm text-left">
                        <thead className="bg-gray-50 uppercase text-xs font-semibold text-gray-600 border-b border-gray-200">
                            <tr>
                                <th className="w-10"></th>
                                <th className="px-6 py-4">S.No.</th>
                                <th className="px-6 py-4">Image</th>
                                <th className="px-6 py-4">Title</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4">Link</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-end">Actions</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {isLoadingInitial && sliders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-16">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="w-8 h-8 animate-spin text-[#007FFF]" />
                                            <span className="text-sm font-medium text-gray-500">Loading sliders...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : sliders.length ? (
                                sliders.map((slider, index) => (
                                    <tr
                                        key={slider.id}
                                        className={`transition-colors hover:bg-blue-50/30 ${isDragging ? "opacity-50" : ""
                                            } cursor-grab active:cursor-grabbing`}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, slider)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, slider)}
                                    >
                                        <td className="px-3">
                                            <GripVertical className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                                        </td>

                                        <td className="px-6 py-4 font-semibold text-gray-500">
                                            {index + 1}
                                        </td>

                                        <td className="px-6 py-4">
                                            {slider.image ? (
                                                <img
                                                    onClick={() => {
                                                        setImagePreviewUrl(`${basePath}${slider.image}`);
                                                        setIsImageModalOpen(true);
                                                    }}
                                                    src={`${basePath}${slider.image}`}
                                                    alt={slider.title || "Slider Image"}
                                                    className="h-14 w-24 rounded-xl object-cover border border-gray-200 shadow-sm cursor-pointer hover:scale-105 transition-transform"
                                                />
                                            ) : (
                                                <div className="h-14 w-24 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-xs text-gray-400">
                                                    No Image
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 max-w-[200px] break-all whitespace-normal font-semibold text-gray-900">
                                            {slider.title || <span className="text-gray-400 italic">No Title</span>}
                                        </td>

                                        <td className="px-6 py-4 max-w-[200px] break-all whitespace-normal text-gray-600">
                                            {slider.description ? (
                                                <button
                                                    onClick={() => {
                                                        setSliderDesc(slider.description || "");
                                                        setIsDescriptionModalOpen(true);
                                                    }}
                                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition cursor-pointer"
                                                >
                                                    View Details
                                                </button>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">—</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 max-w-[160px] break-all whitespace-normal">
                                            {slider.link ? (
                                                <a
                                                    href={slider.link}
                                                    target={(slider.open_in_new_tab === true || String(slider.open_in_new_tab) === "1" || String(slider.open_in_new_tab) === "true") ? "_blank" : "_self"}
                                                    className="text-blue-600 hover:text-blue-700 underline truncate max-w-[160px] inline-block font-medium"
                                                    title={slider.link}
                                                    rel="noreferrer"
                                                >
                                                    {slider.link}
                                                </a>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">—</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleStatusToggle(slider)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors cursor-pointer ${slider.status ? "bg-green-500" : "bg-red-500"
                                                    }`}
                                                title="Toggle Status"
                                            >
                                                <span
                                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${slider.status ? "translate-x-5" : "translate-x-0"
                                                        }`}
                                                />
                                            </button>
                                        </td>

                                        <td className="px-6 py-4 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => openModal(slider)}
                                                    className="size-10 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full flex items-center justify-center transition cursor-pointer"
                                                    title="Edit"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => confirmDelete(slider)}
                                                    className="size-10 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center transition cursor-pointer"
                                                    title="Delete"
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
                                        colSpan={8}
                                        className="text-center text-gray-500 py-16"
                                    >
                                        <p className="font-semibold text-gray-700">No sliders found</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Cards - Mobile */}
                <div className="md:hidden space-y-4">
                    {isLoadingInitial && sliders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-md border border-gray-200">
                            <Loader2 className="w-8 h-8 animate-spin text-[#007FFF] mb-2" />
                            <span className="text-sm font-medium text-gray-500">Loading sliders...</span>
                        </div>
                    ) : sliders.length ? (
                        sliders.map((slider, index) => (
                            <div
                                key={slider.id}
                                className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg transition"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="font-bold text-gray-900 text-base">{slider.title || "Untitled Slider"}</h3>
                                            <button
                                                onClick={() => handleStatusToggle(slider)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors cursor-pointer ${slider.status ? "bg-green-500" : "bg-red-500"
                                                    }`}
                                                title="Toggle Status"
                                            >
                                                <span
                                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${slider.status ? "translate-x-5" : "translate-x-0"
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-400 font-semibold">#{index + 1}</p>
                                    </div>
                                </div>

                                {slider.image && (
                                    <img
                                        onClick={() => {
                                            setImagePreviewUrl(`${basePath}${slider.image}`);
                                            setIsImageModalOpen(true);
                                        }}
                                        src={`${basePath}${slider.image}`}
                                        alt={slider.title || "Slider Image"}
                                        className="w-full h-32 rounded-xl object-cover mb-3 cursor-pointer hover:scale-[1.02] transition-transform border border-gray-100"
                                    />
                                )}

                                {slider.description && (
                                    <button
                                        onClick={() => {
                                            setSliderDesc(slider.description || "");
                                            setIsDescriptionModalOpen(true);
                                        }}
                                        className="w-full mb-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition cursor-pointer"
                                    >
                                        View Details
                                    </button>
                                )}

                                {slider.link && (
                                    <a
                                        href={slider.link}
                                        target={slider.open_in_new_tab ? "_blank" : "_self"}
                                        className="block mb-3 text-xs text-blue-600 hover:text-blue-700 underline truncate font-medium"
                                        title={slider.link}
                                    >
                                        {slider.link}
                                    </a>
                                )}

                                <div className="flex gap-2 pt-3 border-t border-gray-100">
                                    <button
                                        onClick={() => openModal(slider)}
                                        className="flex-1 py-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-xs cursor-pointer"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => confirmDelete(slider)}
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
                            <p className="text-gray-500 font-medium">No sliders found</p>
                        </div>
                    )}
                </div>

                {/* Bottom Sentinel for Infinite Scroll */}
                <div ref={bottomSentinelRef} className="h-6 w-full pointer-events-none" />

                {/* Infinite Scroll Bottom Loading State */}
                {isLoadingMore && (
                    <div className="flex items-center justify-center gap-2.5 py-6 text-sm text-gray-600 animate-in fade-in duration-200">
                        <Loader2 className="w-5 h-5 animate-spin text-[#007FFF]" />
                        <span className="font-semibold text-gray-700">Loading more sliders...</span>
                    </div>
                )}

                {/* All Sliders Loaded End Indicator */}
                {!hasNextPage && sliders.length > 0 && !isLoadingInitial && (
                    <div className="flex items-center justify-center py-6 text-xs md:text-sm text-gray-400 font-medium animate-in fade-in duration-200">
                        <span className="bg-gray-100/90 px-4 py-1.5 rounded-full border border-gray-200 text-gray-600 font-semibold shadow-xs flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>All {sliders.length} sliders loaded</span>
                        </span>
                    </div>
                )}

                {/* Modal */}
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        reset({ status: true, open_in_new_tab: false, show_buttons: false });
                        setPreviewImage(null);
                    }}
                    title={selectedSlider ? "Edit Slider" : "Add Slider"}
                    width="max-w-5xl"
                >
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className="grid gap-6 text-gray-800 p-4 md:p-6 max-h-[80vh] overflow-y-auto"
                    >
                        {/* Image Upload Section - Kept on Top */}
                        <div className="bg-gray-50 border border-gray-200/60 p-5 rounded-2xl">
                            <label className="block text-sm font-semibold text-gray-800 mb-3">
                                Slider Banner Image
                            </label>

                            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                                <div className="flex-shrink-0 w-full md:w-auto flex justify-center">
                                    {previewImage ? (
                                        <div className="relative group">
                                            <img
                                                src={`${process.env.NEXT_PUBLIC_UPLOAD_BASE}${previewImage}`}
                                                alt="Slider Preview"
                                                className="h-28 w-48 rounded-xl object-cover border border-gray-200 shadow-md transition-transform duration-300 group-hover:scale-[1.02]"
                                            />
                                        </div>
                                    ) : (
                                        <div className="h-28 w-48 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-xs text-gray-400 bg-white shadow-inner">
                                            <span>No Image Selected</span>
                                            <span className="text-[10px] mt-1 text-gray-400/80">(Required - 16:9 ratio)</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <ImageCropperModal
                                        directory="sliders"
                                        aspectRatio={16 / 9}
                                        buttonLabel="Select Image"
                                        onSelect={(img) => {
                                            setPreviewImage(img as string);
                                            setValue("image", img as string);
                                        }}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] rounded-xl shadow-md text-white font-semibold hover:shadow-lg transition-all duration-200 text-sm cursor-pointer"
                                    />
                                    <p className="text-xs text-gray-500">Upload a landscape image (recommended size: 1920x1080px).</p>
                                </div>
                            </div>
                        </div>

                        {/* Title & Description Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-800 mb-2">
                                    Title
                                </label>
                                <input
                                    {...register("title")}
                                    type="text"
                                    placeholder="Enter Title"
                                    className="w-full min-h-12 py-3 px-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition-all duration-200 text-sm"
                                />
                                {errors.title && (
                                    <p className="text-xs text-red-500 mt-1 font-medium">{errors.title.message}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-800 mb-2">
                                    Description
                                </label>
                                <input
                                    {...register("description")}
                                    type="text"
                                    placeholder="Enter Description"
                                    className="w-full min-h-12 py-3 px-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition-all duration-200 text-sm"
                                />
                                {errors.description && (
                                    <p className="text-xs text-red-500 mt-1 font-medium">{errors.description.message}</p>
                                )}
                            </div>
                        </div>

                        {/* Link & Open in New Tab */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                            <div>
                                <label className="block text-sm font-semibold text-gray-800 mb-2">
                                    Link URL
                                </label>
                                <input
                                    {...register("link")}
                                    type="text"
                                    placeholder="Enter Link URL (e.g. /products or https://...)"
                                    className="w-full min-h-12 py-3 px-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition-all duration-200 text-sm"
                                />
                                {errors.link && (
                                    <p className="text-xs text-red-500 mt-1 font-medium">{errors.link.message}</p>
                                )}
                            </div>

                            {/* Open in New Tab Toggle */}
                            <div className="flex items-center pb-3">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <span className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 transition-colors">
                                        Open in New Tab
                                    </span>
                                    <div
                                        className={`flex items-center h-6 w-11 rounded-full p-0.5 transition-all duration-300 ${watch("open_in_new_tab") ? "bg-[#007FFF]" : "bg-gray-300"
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            {...register("open_in_new_tab")}
                                            hidden
                                        />
                                        <div
                                            className={`h-5 w-5 rounded-full bg-white shadow-md transform transition-all duration-300 ${watch("open_in_new_tab") ? "translate-x-5" : "translate-x-0"
                                                }`}
                                        />
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Action Buttons Option */}
                        <div className="border border-gray-200/80 rounded-2xl p-5 bg-gray-50/50">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900">Show Action Buttons</h4>
                                    <p className="text-xs text-gray-500">Enable primary & secondary call-to-action buttons on the slider.</p>
                                </div>
                                <label className="flex items-center cursor-pointer">
                                    <div
                                        className={`flex items-center h-6 w-11 rounded-full p-0.5 transition-all duration-300 ${watch("show_buttons") ? "bg-[#007FFF]" : "bg-gray-300"
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            {...register("show_buttons")}
                                            hidden
                                        />
                                        <div
                                            className={`h-5 w-5 rounded-full bg-white shadow-md transform transition-all duration-300 ${watch("show_buttons") ? "translate-x-5" : "translate-x-0"
                                                }`}
                                        />
                                    </div>
                                </label>
                            </div>

                            {watch("show_buttons") && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-200/60">
                                    <div className="space-y-3 p-3 bg-white rounded-xl border border-gray-100">
                                        <h5 className="text-xs font-bold text-gray-700 uppercase">Button 1 (Primary)</h5>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Text</label>
                                            <input
                                                {...register("button1_text")}
                                                type="text"
                                                placeholder="e.g. Shop Now"
                                                className="w-full py-2 px-3 rounded-lg bg-gray-50 border border-gray-200 text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Link</label>
                                            <input
                                                {...register("button1_link")}
                                                type="text"
                                                placeholder="e.g. /products"
                                                className="w-full py-2 px-3 rounded-lg bg-gray-50 border border-gray-200 text-xs"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3 p-3 bg-white rounded-xl border border-gray-100">
                                        <h5 className="text-xs font-bold text-gray-700 uppercase">Button 2 (Secondary)</h5>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Text</label>
                                            <input
                                                {...register("button2_text")}
                                                type="text"
                                                placeholder="e.g. Explore Collection"
                                                className="w-full py-2 px-3 rounded-lg bg-gray-50 border border-gray-200 text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Link</label>
                                            <input
                                                {...register("button2_link")}
                                                type="text"
                                                placeholder="e.g. /categories"
                                                className="w-full py-2 px-3 rounded-lg bg-gray-50 border border-gray-200 text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <hr className="border-gray-100 my-1" />

                        {/* Status + Submit */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                            {/* Status Toggle */}
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <span className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 transition-colors">Status</span>
                                <div
                                    className={`flex items-center h-6 w-11 rounded-full p-0.5 transition-all duration-300 ${watch("status") ? "bg-green-500" : "bg-red-500"
                                        }`}
                                >
                                    <input type="checkbox" {...register("status")} hidden />
                                    <div
                                        className={`h-5 w-5 rounded-full bg-white shadow-md transform transition-all duration-300 ${watch("status") ? "translate-x-5" : "translate-x-0"
                                            }`}
                                    />
                                </div>
                            </label>

                            <button
                                type="submit"
                                disabled={isFormSubmit}
                                className={`px-10 py-3.5 rounded-full font-semibold text-white shadow-lg transition-all duration-300 w-full sm:w-auto text-sm tracking-wide cursor-pointer ${isFormSubmit
                                        ? "bg-blue-400/40 cursor-not-allowed"
                                        : "bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] hover:shadow-blue-500/30"
                                    }`}
                            >
                                {isFormSubmit ? "Saving..." : selectedSlider ? "Update Slider" : "Save Slider"}
                            </button>
                        </div>
                    </form>
                </Modal>

                {/* Delete Modal */}
                <Modal
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    title="Delete Slider"
                >
                    <div className="p-6 max-w-sm text-center">
                        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-7 h-7 text-red-500" />
                        </div>
                        <p className="text-sm text-gray-600 mb-5">
                            Are you sure you want to delete <strong>&quot;{selectedSlider?.title || "this slider"}&quot;</strong>? This cannot be undone.
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

                {/* Image Preview Modal */}
                {isImageModalOpen && imagePreviewUrl && (
                    <Modal
                        isOpen={isImageModalOpen}
                        onClose={() => setIsImageModalOpen(false)}
                        title="Slider Preview"
                        width="max-w-4xl"
                    >
                        <div className="p-4">
                            <img
                                src={imagePreviewUrl}
                                alt="Preview"
                                className="max-w-full max-h-[80vh] rounded-xl object-contain mx-auto border border-gray-200 shadow-md"
                            />
                        </div>
                    </Modal>
                )}

                {/* Description View Modal */}
                {isDescriptionModalOpen && (
                    <Modal
                        isOpen={isDescriptionModalOpen}
                        onClose={() => setIsDescriptionModalOpen(false)}
                        title="Slider Description"
                        width="max-w-xl"
                    >
                        <div className="p-6">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                {sliderDesc}
                            </p>
                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={() => setIsDescriptionModalOpen(false)}
                                    className="px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </div>
        </ProtectedRoute>
    );
}

export default SlidersManagement;
