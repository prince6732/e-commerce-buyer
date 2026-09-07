"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import * as yup from "yup";
import React from "react";
import { useLoader } from "@/context/LoaderContext";
import Image from "next/image";
import { yupResolver } from "@hookform/resolvers/yup/dist/yup.js";
import dynamic from "next/dynamic";

const JoditEditor = dynamic(() => import("jodit-react"), { ssr: false });
import { Brand } from "@/common/interface";
import {
    createBrand,
    deleteBrand,
    fetchBrands,
    updateBrand,
    toggleBrandStatus
} from "../../../../../utils/brand";
import ErrorMessage from "@/components/(sheared)/ErrorMessage";
import SuccessMessage from "@/components/(sheared)/SuccessMessage";
import Modal from "@/components/(sheared)/Modal";
import ImageCropperModal from "@/components/(frontend)/ImageCropperModal";
import { Pencil, Trash2, Search, Loader2, Plus, Check } from "lucide-react";
import { getImageUrl } from "../../../../../utils/imageUtils";
import { getErrorMessage } from "../../../../../utils/errorUtils";

const PAGE_SIZE = 10;

const schema = yup.object({
    name: yup.string().required("Name is required").min(2).max(200),
    description: yup.string().required("Description is required").max(1000),
    image1: yup.string().required("image is required"),
    description1: yup.string().max(1000, "Description can be max 1000 characters"),
    image2: yup.string(),
    description2: yup.string().max(1000, "Description can be max 1000 characters"),
    image3: yup.string(),
    description3: yup.string().max(1000, "Description can be max 1000 characters"),
    status: yup.boolean().required(),
});

type FormData = yup.InferType<typeof schema>;

function AdminBrandManagement() {
    // Infinite scroll & brands state
    const [brands, setBrands] = useState<Brand[]>([]);
    const [page, setPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(true);
    const [totalBrands, setTotalBrands] = useState(0);
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const isFetchingRef = useRef(false);
    const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    // Modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
    const [isMainDescriptionModalOpen, setIsMainDescriptionModalOpen] = useState(false);
    const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [previewImage1, setPreviewImage1] = useState<string | null>(null);
    const [previewImage2, setPreviewImage2] = useState<string | null>(null);
    const [previewImage3, setPreviewImage3] = useState<string | null>(null);
    const { showLoader, hideLoader } = useLoader();
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [brandToDelete, setBrandToDelete] = useState<number | null>(null);

    const config = useMemo(
        () => ({
            "uploader": {
                "insertImageAsBase64URI": true
            },
            showPlaceholder: false,
            readonly: false,
            buttons: "bold,italic,underline,ul,ol,link,image,undo,redo",
            toolbarAdaptive: true,
            toolbarSticky: false,
            buttonsMD: "bold,italic,underline,ul,ol,link,image",
            buttonsSM: "bold,italic,ul,ol",
            buttonsXS: "bold,italic,ul",
            askBeforePasteHTML: false,
            askBeforePasteFromWord: false,
            defaultActionOnPaste: 'insert_clear_html' as any
        }),
        []
    );

    const {
        register,
        handleSubmit,
        setValue,
        reset,
        control,
        watch,
        formState: { errors },
    } = useForm<any>({
        resolver: yupResolver(schema),
        defaultValues: { status: true },
    });

    // Debounce search input
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

    // Fetch Brands
    const getAllBrands = async (pageNum: number, search: string = "", isAppend: boolean = false) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        if (isAppend) {
            setIsLoadingMore(true);
        } else {
            setIsLoadingInitial(true);
            if (search) setIsSearching(true);
        }

        try {
            const res = await fetchBrands({
                page: pageNum,
                limit: PAGE_SIZE,
                search: search || undefined,
                paginate: true,
            });

            let list: Brand[] = [];
            let paginationData: any = null;

            if (res && res.data && Array.isArray(res.data.brands)) {
                list = res.data.brands;
                paginationData = res.data.pagination;
            } else if (res && Array.isArray(res.brands)) {
                list = res.brands;
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

            setTotalBrands(total);
            setHasNextPage(hasNext);
            setPage(pageNum);

            if (isAppend) {
                setBrands((prev) => {
                    const existingIds = new Set(prev.map((b) => b.id));
                    const newUnique = list.filter((b) => !existingIds.has(b.id));
                    return [...prev, ...newUnique];
                });
            } else {
                setBrands(list);
            }
        } catch (err) {
            console.error(err);
            setErrorMessage("Failed to load brands");
            if (!isAppend) setBrands([]);
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
        getAllBrands(1, debouncedSearchQuery, false);
    }, [debouncedSearchQuery]);

    // Load next page on scroll
    const loadNextPage = useCallback(() => {
        if (!hasNextPage || isLoadingMore || isLoadingInitial || isFetchingRef.current) return;
        getAllBrands(page + 1, debouncedSearchQuery, true);
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

    const openDescriptionModal = (item: Brand | null = null) => {
        setSelectedBrand(item);
        if (item) {
            setIsDescriptionModalOpen(true);
        }
    };

    const openMainDescriptionModal = (item: Brand | null = null) => {
        setSelectedBrand(item);
        if (item) {
            setIsMainDescriptionModalOpen(true);
        }
    };

    const openModal = (brand: Brand | null = null) => {
        setSelectedBrand(brand);

        if (brand) {
            setValue("name", brand.name);
            setValue("description", brand.description ?? "");
            setValue("description1", brand.description1 ?? "");
            setValue("description2", brand.description2 ?? "");
            setValue("description3", brand.description3 ?? "");
            setValue("status", Boolean(brand.status));

            const normalize = (path?: string | null) =>
                path ? path.replace(/\\/g, "/") : null;

            setPreviewImage1(normalize(brand.image1));
            setPreviewImage2(normalize(brand.image2));
            setPreviewImage3(normalize(brand.image3));
            if (brand.image1) setValue("image1", brand.image1);
            if (brand.image2) setValue("image2", brand.image2);
            if (brand.image3) setValue("image3", brand.image3);
        } else {
            reset({ status: true });
            setPreviewImage1(null);
            setPreviewImage2(null);
            setPreviewImage3(null);
        }
        setIsModalOpen(true);
    };

    const onSubmit = async (data: FormData) => {
        showLoader();
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
            if (selectedBrand) {
                const res = await updateBrand(selectedBrand.id.toString(), data as any);
                const updated = (res as any)?.brand || (res as any)?.data || { ...selectedBrand, ...data };
                setBrands((prev) =>
                    prev.map((b) => (b.id === selectedBrand.id ? { ...b, ...updated } : b))
                );
                setSuccessMessage("Brand updated successfully!");
            } else {
                const res = await createBrand(data as any);
                const created = (res as any)?.brand || (res as any)?.data;
                if (created) {
                    setBrands((prev) => [created, ...prev]);
                    setTotalBrands((prev) => prev + 1);
                } else {
                    await getAllBrands(1, debouncedSearchQuery, false);
                }
                setSuccessMessage("Brand created successfully!");
            }
            reset();
            setPreviewImage1(null);
            setPreviewImage2(null);
            setPreviewImage3(null);
            setIsModalOpen(false);
        } catch (err: any) {
            console.error(err);
            setErrorMessage(getErrorMessage(err, selectedBrand ? "Failed to update brand" : "Failed to create brand"));
        } finally {
            hideLoader();
        }
    };

    const confirmDelete = (id: number) => {
        setBrandToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!brandToDelete) return;

        showLoader();
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            await deleteBrand(brandToDelete.toString());
            setBrands((prev) => prev.filter((b) => Number(b.id) !== brandToDelete));
            setTotalBrands((prev) => Math.max(0, prev - 1));
            setSuccessMessage("Brand deleted successfully!");
        } catch (err: any) {
            console.error(err);
            setErrorMessage(getErrorMessage(err, "Failed to delete brand"));
        } finally {
            hideLoader();
            setIsDeleteModalOpen(false);
            setBrandToDelete(null);
        }
    };

    const handleStatusToggle = async (brand: Brand) => {
        try {
            await toggleBrandStatus(brand.id.toString());
            setBrands((prev) =>
                prev.map((b) => b.id === brand.id ? { ...b, status: !b.status } : b)
            );
            setSuccessMessage("Status updated successfully!");
        } catch (err: any) {
            console.error(err);
            setErrorMessage(getErrorMessage(err, "Failed to toggle status."));
        }
    };

    return (
        <div className="p-3 md:p-6">
            {errorMessage && <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />}
            {successMessage && <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />}

            {/* Header */}
            <div className="mb-4 md:mb-6 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-xl shadow-md">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 md:px-6 py-3.5 md:py-4">

                    {/* Title & Count */}
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg md:text-xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">
                            Brands
                        </h2>
                        {totalBrands > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                {brands.length} of {totalBrands}
                            </span>
                        )}
                    </div>

                    {/* Search & Actions */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                        {/* Search Input */}
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search brands..."
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

                        {/* Create Brand Button */}
                        <button
                            onClick={() => openModal(null)}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 md:py-2.5 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] rounded-xl shadow-md text-white font-semibold text-xs md:text-sm hover:shadow-lg transition-all duration-200 whitespace-nowrap cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Create Brand</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
                <div className="overflow-x-auto scrollbar rounded-2xl shadow-lg border border-gray-200 bg-white">
                    <table className="w-full min-w-[800px] text-sm text-left">
                        <thead className="bg-gray-50 uppercase text-xs font-semibold text-gray-600 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4">S.No.</th>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4">Section 1 Image</th>
                                <th className="px-6 py-4">Section 2 Image</th>
                                <th className="px-6 py-4">Section 3 Image</th>
                                <th className="px-6 py-4">Section Descriptions</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-gray-700">
                            {isLoadingInitial && brands.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-16">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="w-8 h-8 animate-spin text-[#007FFF]" />
                                            <span className="text-sm font-medium text-gray-500">Loading brands...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : brands.length > 0 ? (
                                brands.map((brand, index) => {
                                    const primaryUrl = getImageUrl(brand.image1);
                                    const secondaryUrl = getImageUrl(brand.image2);
                                    const tertiaryUrl = getImageUrl(brand.image3);

                                    return (
                                        <tr key={brand.id} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-6 py-4 font-semibold text-gray-500">{index + 1}</td>
                                            <td className="px-6 py-4 max-w-[200px] break-all whitespace-normal font-semibold text-gray-900">{brand.name}</td>
                                            <td className="px-6 py-4">
                                                <button
                                                    className="px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold transition cursor-pointer"
                                                    onClick={() => openMainDescriptionModal(brand)}
                                                >
                                                    View Description
                                                </button>
                                            </td>

                                            <td className="px-6 py-4">
                                                {primaryUrl ? (
                                                    <Image
                                                        src={primaryUrl}
                                                        alt={brand.name}
                                                        width={60}
                                                        height={60}
                                                        className="object-cover rounded-xl border border-gray-200 shadow-sm"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">No Image</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {secondaryUrl ? (
                                                    <Image
                                                        src={secondaryUrl}
                                                        alt={brand.name}
                                                        width={60}
                                                        height={60}
                                                        className="object-cover rounded-xl border border-gray-200 shadow-sm"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">No Image</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {tertiaryUrl ? (
                                                    <Image
                                                        src={tertiaryUrl}
                                                        alt={brand.name}
                                                        width={60}
                                                        height={60}
                                                        className="object-cover rounded-xl border border-gray-200 shadow-sm"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">No Image</span>
                                                )}
                                            </td>

                                            {/* Description Button */}
                                            <td className="px-6 py-4">
                                                <button
                                                    className="px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold transition cursor-pointer"
                                                    onClick={() => openDescriptionModal(brand)}
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleStatusToggle(brand)}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors cursor-pointer ${brand.status ? "bg-green-500" : "bg-red-500"
                                                        }`}
                                                    title="Toggle Status"
                                                >
                                                    <span
                                                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${brand.status ? "translate-x-5" : "translate-x-0"
                                                            }`}
                                                    />
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        title="Edit Brand"
                                                        onClick={() => openModal(brand)}
                                                        className="size-10 bg-blue-100 hover:bg-blue-200 text-blue-600 flex justify-center items-center rounded-full transition cursor-pointer"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        title="Delete Brand"
                                                        onClick={() => confirmDelete(Number(brand.id))}
                                                        className="size-10 bg-red-100 hover:bg-red-200 text-red-600 flex justify-center items-center rounded-full transition cursor-pointer"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={9} className="text-center text-gray-400 py-12 italic">
                                        No Brands Found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {isLoadingInitial && brands.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-md border border-gray-200">
                        <Loader2 className="w-8 h-8 animate-spin text-[#007FFF] mb-2" />
                        <span className="text-sm font-medium text-gray-500">Loading brands...</span>
                    </div>
                ) : brands.length ? (
                    brands.map((brand, index) => {
                        const primaryUrl = getImageUrl(brand.image1);
                        const secondaryUrl = getImageUrl(brand.image2);
                        const tertiaryUrl = getImageUrl(brand.image3);

                        return (
                            <div
                                key={brand.id}
                                className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg transition"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="font-bold text-gray-900 text-base">{brand.name}</h3>
                                            <button
                                                onClick={() => handleStatusToggle(brand)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors cursor-pointer ${brand.status ? "bg-green-500" : "bg-red-500"
                                                    }`}
                                                title="Toggle Status"
                                            >
                                                <span
                                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${brand.status ? "translate-x-5" : "translate-x-0"
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 font-semibold mb-2">#{index + 1}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    {primaryUrl ? (
                                        <Image
                                            src={primaryUrl}
                                            alt={brand.name}
                                            width={80}
                                            height={80}
                                            className="object-cover rounded-lg w-full h-20 border border-gray-100"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="w-full h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                                            <span className="text-xs text-gray-400">No Image</span>
                                        </div>
                                    )}
                                    {secondaryUrl ? (
                                        <Image
                                            src={secondaryUrl}
                                            alt={brand.name}
                                            width={80}
                                            height={80}
                                            className="object-cover rounded-lg w-full h-20 border border-gray-100"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="w-full h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                                            <span className="text-xs text-gray-400">No Image</span>
                                        </div>
                                    )}
                                    {tertiaryUrl ? (
                                        <Image
                                            src={tertiaryUrl}
                                            alt={brand.name}
                                            width={80}
                                            height={80}
                                            className="object-cover rounded-lg w-full h-20 border border-gray-100"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="w-full h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                                            <span className="text-xs text-gray-400">No Image</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 mb-3">
                                    <button
                                        className="flex-1 py-1.5 text-xs rounded-lg bg-blue-50 text-blue-700 font-semibold transition cursor-pointer"
                                        onClick={() => openMainDescriptionModal(brand)}
                                    >
                                        Description
                                    </button>
                                    <button
                                        className="flex-1 py-1.5 text-xs rounded-lg bg-blue-50 text-blue-700 font-semibold transition cursor-pointer"
                                        onClick={() => openDescriptionModal(brand)}
                                    >
                                        Section Details
                                    </button>
                                </div>

                                <div className="flex gap-2 pt-3 border-t border-gray-100">
                                    <button
                                        title="Edit Brand"
                                        onClick={() => openModal(brand)}
                                        className="flex-1 py-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-sm cursor-pointer"
                                    >
                                        <Pencil className="h-4 w-4" />
                                        Edit
                                    </button>
                                    <button
                                        title="Delete Brand"
                                        onClick={() => confirmDelete(Number(brand.id))}
                                        className="flex-1 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-sm cursor-pointer"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
                        <p className="text-gray-400 italic">No Brands Found</p>
                    </div>
                )}
            </div>

            {/* Bottom Sentinel for Infinite Scroll */}
            <div ref={bottomSentinelRef} className="h-6 w-full pointer-events-none" />

            {/* Infinite Scroll Bottom Loading State */}
            {isLoadingMore && (
                <div className="flex items-center justify-center gap-2.5 py-6 text-sm text-gray-600 animate-in fade-in duration-200">
                    <Loader2 className="w-5 h-5 animate-spin text-[#007FFF]" />
                    <span className="font-semibold text-gray-700">Loading more brands...</span>
                </div>
            )}

            {/* All Brands Loaded End Indicator */}
            {!hasNextPage && brands.length > 0 && !isLoadingInitial && (
                <div className="flex items-center justify-center py-6 text-xs md:text-sm text-gray-400 font-medium animate-in fade-in duration-200">
                    <span className="bg-gray-100/90 px-4 py-1.5 rounded-full border border-gray-200 text-gray-600 font-semibold shadow-xs flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>All {brands.length} brands loaded</span>
                    </span>
                </div>
            )}

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedBrand(null);
                    reset();
                }}
                title={selectedBrand ? "Edit Brand" : "Add Brand"}
                width="max-w-4xl"
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-h-[80vh] overflow-y-auto px-4 md:px-6 py-4">
                    {/* Name */}
                    <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-900 mb-1">
                            Brand Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            {...register("name")}
                            placeholder="Enter Brand Name"
                            className="w-full py-2.5 px-4 rounded-xl bg-white border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#007FFF] transition text-sm"
                        />
                        <p className="text-xs text-red-500 mt-1">{errors.name?.message as any}</p>
                    </div>

                    {/* Main Description */}
                    <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-900 mb-1">
                            Main Description <span className="text-red-500">*</span>
                        </label>
                        <Controller
                            name="description"
                            control={control}
                            render={({ field }) => (
                                <div className="text-black bg-white rounded-xl overflow-hidden border border-gray-300">
                                    <JoditEditor
                                        value={field.value || ""}
                                        config={config}
                                        onBlur={(newContent) => field.onChange(newContent)}
                                    />
                                </div>
                            )}
                        />
                        <p className="text-xs text-red-500 mt-1">{errors.description?.message as any}</p>
                    </div>

                    {/* Section 1 */}
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-4">
                        <h3 className="font-bold text-gray-800 text-sm">Section 1 Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Section 1 Description</label>
                                <Controller
                                    name="description1"
                                    control={control}
                                    render={({ field }) => (
                                        <div className="text-black bg-white rounded-xl overflow-hidden border border-gray-300">
                                            <JoditEditor
                                                value={field.value || ""}
                                                config={config}
                                                onBlur={(newContent) => field.onChange(newContent)}
                                            />
                                        </div>
                                    )}
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Image 1 <span className="text-red-500">*</span>
                                    </label>
                                    <ImageCropperModal
                                        onSelect={(img: any) => {
                                            setValue("image1", img);
                                            setPreviewImage1(img);
                                        }}
                                        buttonLabel="Select Image"
                                        directory="brands"
                                    />
                                    <p className="text-xs text-red-500 mt-1">{errors.image1?.message as any}</p>
                                </div>
                                <div>
                                    {previewImage1 ? (
                                        <img
                                            src={getImageUrl(previewImage1) || ""}
                                            alt="First"
                                            className="h-20 w-20 rounded-xl object-cover border border-gray-200 shadow-sm"
                                        />
                                    ) : (
                                        <div className="h-20 w-20 flex items-center justify-center rounded-xl bg-gray-100 border border-gray-200 text-xs text-gray-400">
                                            No Image
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2 */}
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-4">
                        <h3 className="font-bold text-gray-800 text-sm">Section 2 Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Section 2 Description</label>
                                <Controller
                                    name="description2"
                                    control={control}
                                    render={({ field }) => (
                                        <div className="text-black bg-white rounded-xl overflow-hidden border border-gray-300">
                                            <JoditEditor
                                                value={field.value || ""}
                                                config={config}
                                                onBlur={(newContent) => field.onChange(newContent)}
                                            />
                                        </div>
                                    )}
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Image 2
                                    </label>
                                    <ImageCropperModal
                                        onSelect={(img: any) => {
                                            setValue("image2", img);
                                            setPreviewImage2(img);
                                        }}
                                        buttonLabel="Select Image"
                                        directory="brands"
                                    />
                                </div>
                                <div>
                                    {previewImage2 ? (
                                        <img
                                            src={getImageUrl(previewImage2) || ""}
                                            alt="Second"
                                            className="h-20 w-20 rounded-xl object-cover border border-gray-200 shadow-sm"
                                        />
                                    ) : (
                                        <div className="h-20 w-20 flex items-center justify-center rounded-xl bg-gray-100 border border-gray-200 text-xs text-gray-400">
                                            No Image
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3 */}
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-4">
                        <h3 className="font-bold text-gray-800 text-sm">Section 3 Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Section 3 Description</label>
                                <Controller
                                    name="description3"
                                    control={control}
                                    render={({ field }) => (
                                        <div className="text-black bg-white rounded-xl overflow-hidden border border-gray-300">
                                            <JoditEditor
                                                value={field.value || ""}
                                                config={config}
                                                onBlur={(newContent) => field.onChange(newContent)}
                                            />
                                        </div>
                                    )}
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Image 3
                                    </label>
                                    <ImageCropperModal
                                        onSelect={(img: any) => {
                                            setValue("image3", img);
                                            setPreviewImage3(img);
                                        }}
                                        buttonLabel="Select Image"
                                        directory="brands"
                                    />
                                </div>
                                <div>
                                    {previewImage3 ? (
                                        <img
                                            src={getImageUrl(previewImage3) || ""}
                                            alt="Third"
                                            className="h-20 w-20 rounded-xl object-cover border border-gray-200 shadow-sm"
                                        />
                                    ) : (
                                        <div className="h-20 w-20 flex items-center justify-center rounded-xl bg-gray-100 border border-gray-200 text-xs text-gray-400">
                                            No Image
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-200" />

                    {/* Status + Submit */}
                    <div className="flex items-center justify-between gap-4 pt-2">
                        {/* Status Toggle */}
                        <label className="flex items-center gap-3 cursor-pointer">
                            <span className="text-sm font-semibold text-gray-900">Status</span>
                            <div
                                className={`flex items-center h-6 w-12 rounded-full transition-all duration-300 ${watch("status") ? "bg-green-500" : "bg-red-500"
                                    }`}
                            >
                                <input type="checkbox" {...register("status")} hidden />
                                <div
                                    className={`h-6 w-6 rounded-full bg-white shadow-md transform transition-all duration-300 ${watch("status") ? "translate-x-6" : "translate-x-0"
                                        }`}
                                ></div>
                            </div>
                        </label>

                        {/* Submit */}
                        <button
                            type="submit"
                            className="px-8 py-2.5 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] text-white font-semibold rounded-xl transition-all duration-300 shadow-md hover:shadow-blue-500/30 text-sm cursor-pointer"
                        >
                            {selectedBrand ? "Update Brand" : "Save Brand"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Main Description Modal */}
            <Modal
                isOpen={isMainDescriptionModalOpen}
                onClose={() => {
                    setIsMainDescriptionModalOpen(false);
                }}
                width="max-w-3xl"
                title="Description"
            >
                <div
                    className="text-gray-700 space-y-2 prose max-w-none p-4"
                    dangerouslySetInnerHTML={{ __html: selectedBrand?.description || "<p>No Description</p>" }}
                />
            </Modal>

            {/* Section Descriptions Modal */}
            <Modal
                isOpen={isDescriptionModalOpen}
                onClose={() => {
                    setIsDescriptionModalOpen(false);
                }}
                width="max-w-4xl"
                title="Section Descriptions"
            >
                <div className="p-4 space-y-4">
                    <div>
                        <h2 className="text-base font-bold text-gray-800 mb-1">Description 1</h2>
                        <div className="text-gray-700 p-3 bg-gray-50 rounded-xl" dangerouslySetInnerHTML={{ __html: selectedBrand?.description1 || "<p>No Description</p>" }} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-gray-800 mb-1">Description 2</h2>
                        <div className="text-gray-700 p-3 bg-gray-50 rounded-xl" dangerouslySetInnerHTML={{ __html: selectedBrand?.description2 || "<p>No Description</p>" }} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-gray-800 mb-1">Description 3</h2>
                        <div className="text-gray-700 p-3 bg-gray-50 rounded-xl" dangerouslySetInnerHTML={{ __html: selectedBrand?.description3 || "<p>No Description</p>" }} />
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                width="max-w-md"
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setBrandToDelete(null);
                }}
                title="Confirm Delete"
            >
                <div className="p-4">
                    <p className="text-gray-700">
                        Are you sure you want to delete this brand?
                    </p>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={() => {
                                setIsDeleteModalOpen(false);
                                setBrandToDelete(null);
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

export default AdminBrandManagement;
