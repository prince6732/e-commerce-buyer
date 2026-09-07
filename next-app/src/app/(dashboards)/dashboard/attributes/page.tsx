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
import { useRouter } from "next/navigation";
import { getErrorMessage } from "../../../../../utils/errorUtils";

import { TiInfoLargeOutline } from "react-icons/ti";
import {
    createAttribute,
    deleteAttribute,
    fetchAttributes,
    updateAttribute,
    toggleAttributeStatus
} from "../../../../../utils/attribute";
import { Attribute } from "@/common/interface";

const schema = yup.object({
    name: yup.string().required("Name is required").max(50),
    description: yup.string().nullable(),
    status: yup.boolean().required(),
});

type FormValues = yup.InferType<typeof schema>;

const PAGE_SIZE = 10;

export default function AttributesManagement() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFormSubmit, setIsFormSubmit] = useState(false);
    const [selectedAttribute, setSelectedAttribute] = useState<Attribute | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Infinite scroll & attributes state
    const [attributes, setAttributes] = useState<Attribute[]>([]);
    const [page, setPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(true);
    const [totalAttributes, setTotalAttributes] = useState(0);
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const isFetchingRef = useRef(false);
    const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    const { showLoader, hideLoader } = useLoader();
    const router = useRouter();

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm<any>({
        resolver: yupResolver(schema),
        mode: "onChange",
        defaultValues: {
            name: "",
            description: "",
            status: true,
        },
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

    // Fetch Attributes function
    const getAttributes = async (pageNum: number, search: string = "", isAppend: boolean = false) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        if (isAppend) {
            setIsLoadingMore(true);
        } else {
            setIsLoadingInitial(true);
            if (search) setIsSearching(true);
        }

        try {
            const res = await fetchAttributes({
                page: pageNum,
                limit: PAGE_SIZE,
                search: search || undefined,
                paginate: true,
            });

            // Handles response shapes: { data: { attributes: [...], pagination: {...} } } or array
            let list: Attribute[] = [];
            let paginationData: any = null;

            if (res && res.data && Array.isArray(res.data.attributes)) {
                list = res.data.attributes;
                paginationData = res.data.pagination;
            } else if (res && Array.isArray(res.attributes)) {
                list = res.attributes;
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

            setTotalAttributes(total);
            setHasNextPage(hasNext);
            setPage(pageNum);

            if (isAppend) {
                setAttributes((prev) => {
                    const existingIds = new Set(prev.map((a) => a.id));
                    const newUnique = list.filter((a) => !existingIds.has(a.id));
                    return [...prev, ...newUnique];
                });
            } else {
                setAttributes(list);
            }
        } catch {
            setErrorMessage("Failed to load attributes. Please try again.");
            if (!isAppend) setAttributes([]);
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
        getAttributes(1, debouncedSearchQuery, false);
    }, [debouncedSearchQuery]);

    // Load next page on scroll
    const loadNextPage = useCallback(() => {
        if (!hasNextPage || isLoadingMore || isLoadingInitial || isFetchingRef.current) return;
        getAttributes(page + 1, debouncedSearchQuery, true);
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

    const slugify = (text: string) =>
        (text || '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

    const onDetail = (attribute: Attribute) => {
        const slug = (attribute as any).slug || slugify(attribute.name) || attribute.id;
        router.push(`/dashboard/attributes/${slug}/attribute-values`);
    };

    const openModal = (attribute: Attribute | null = null) => {
        setSelectedAttribute(attribute);

        if (attribute) {
            reset({
                name: attribute.name,
                description: attribute.description ?? "",
                status: attribute.status,
            });
        } else {
            reset({
                name: "",
                description: "",
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
                ...data,
                description: data.description ?? undefined,
                status: Boolean(data.status),
            };

            if (selectedAttribute) {
                const res = await updateAttribute(selectedAttribute.id, payload);
                const updated = res.attribute || res.data || { ...selectedAttribute, ...payload };
                setAttributes((prev) =>
                    prev.map((a) => (a.id === selectedAttribute.id ? { ...a, ...updated } : a))
                );
                setSuccessMessage("Attribute updated successfully!");
            } else {
                const res = await createAttribute(payload);
                const created = res.attribute || res.data;
                if (created) {
                    setAttributes((prev) => [created, ...prev]);
                    setTotalAttributes((prev) => prev + 1);
                } else {
                    await getAttributes(1, debouncedSearchQuery, false);
                }
                setSuccessMessage("Attribute created successfully!");
            }

            reset({ name: "", description: "", status: true });
            setIsModalOpen(false);
        } catch (err: any) {
            setErrorMessage(getErrorMessage(err, "Please try again."));
        } finally {
            setIsFormSubmit(false);
            hideLoader();
        }
    };

    const confirmDelete = (attribute: Attribute) => {
        setSelectedAttribute(attribute);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!selectedAttribute) return;
        showLoader();
        try {
            await deleteAttribute(selectedAttribute.id);
            setAttributes((prev) => prev.filter((a) => a.id !== selectedAttribute.id));
            setTotalAttributes((prev) => Math.max(0, prev - 1));
            setSuccessMessage("Attribute deleted successfully!");
            setIsDeleteModalOpen(false);
            setSelectedAttribute(null);
        } catch (err: any) {
            console.error(err);
            setErrorMessage(getErrorMessage(err, "Failed to delete attribute"));
        } finally {
            hideLoader();
        }
    };

    const handleStatusToggle = async (attribute: Attribute) => {
        try {
            await toggleAttributeStatus(attribute.id);
            setAttributes((prev) =>
                prev.map((a) => (a.id === attribute.id ? { ...a, status: !a.status } : a))
            );
            setSuccessMessage("Status updated successfully!");
        } catch (err: any) {
            setErrorMessage(getErrorMessage(err, "Failed to toggle status."));
        }
    };

    return (
        <ProtectedRoute role="Admin">
            <div className="p-3 md:p-6">
                {errorMessage && (<ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />)}
                {successMessage && (<SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />)}

                {/* Header */}
                <div className="mb-4 md:mb-6 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-xl shadow-md">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 md:px-6 py-3.5 md:py-4">

                        {/* Title & Count */}
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg md:text-xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">
                                Attributes
                            </h2>
                            {totalAttributes > 0 && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                    {attributes.length} of {totalAttributes}
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
                                    placeholder="Search attributes..."
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

                            {/* Create Attribute Button */}
                            <button
                                onClick={() => openModal(null)}
                                className="flex items-center justify-center gap-1.5 px-4 py-2 md:py-2.5 rounded-xl bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] rounded-xl shadow-md text-white font-semibold text-xs md:text-sm hover:shadow-lg transition-all duration-200 whitespace-nowrap cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Create Attribute</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Table - Desktop */}
                <div className="hidden md:block">
                    <div className="overflow-x-auto scrollbar rounded-2xl shadow-lg border border-gray-200 bg-white">
                        <table className="w-full min-w-[800px] text-sm text-left">
                            <thead className="uppercase text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4">S.No.</th>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Description</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-end">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 text-gray-700">
                                {isLoadingInitial && attributes.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-16">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Loader2 className="w-8 h-8 animate-spin text-[#007FFF]" />
                                                <span className="text-sm font-medium text-gray-500">Loading attributes...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : attributes.length > 0 ? (
                                    attributes.map((attr, index) => (
                                        <tr
                                            key={attr.id}
                                            className="hover:bg-blue-50/30 transition-colors"
                                        >
                                            <td className="px-6 py-4 font-semibold text-gray-500">{index + 1}</td>
                                            <td className="px-6 py-4 max-w-[200px] break-all whitespace-normal font-semibold text-gray-900">{attr.name}</td>
                                            <td className="px-6 py-4 max-w-[300px] break-all whitespace-normal text-gray-600">{attr.description || <span className="text-gray-400 italic">—</span>}</td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleStatusToggle(attr)}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors cursor-pointer ${attr.status ? "bg-green-500" : "bg-red-500"
                                                        }`}
                                                    title="Toggle Status"
                                                >
                                                    <span
                                                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${attr.status ? "translate-x-5" : "translate-x-0"
                                                            }`}
                                                    />
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        title="View Attribute Values"
                                                        onClick={() => onDetail(attr)}
                                                        className="size-10 bg-blue-100 hover:bg-blue-200 text-blue-600 flex justify-center items-center rounded-full transition cursor-pointer"
                                                    >
                                                        <TiInfoLargeOutline className="h-5 w-5" />
                                                    </button>
                                                    <button
                                                        title="Edit Attribute"
                                                        onClick={() => openModal(attr)}
                                                        className="size-10 bg-blue-100 hover:bg-blue-200 text-blue-600 flex justify-center items-center rounded-full transition cursor-pointer"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        title="Delete Attribute"
                                                        onClick={() => confirmDelete(attr)}
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
                                            colSpan={5}
                                            className="text-center text-gray-400 py-12 italic"
                                        >
                                            No Attributes Found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Cards - Mobile */}
                <div className="md:hidden space-y-4">
                    {isLoadingInitial && attributes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-md border border-gray-200">
                            <Loader2 className="w-8 h-8 animate-spin text-[#007FFF] mb-2" />
                            <span className="text-sm font-medium text-gray-500">Loading attributes...</span>
                        </div>
                    ) : attributes.length ? (
                        attributes.map((attr, index) => (
                            <div
                                key={attr.id}
                                className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg transition"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="font-bold text-gray-900 text-base">{attr.name}</h3>
                                            <button
                                                onClick={() => handleStatusToggle(attr)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors cursor-pointer ${attr.status ? "bg-green-500" : "bg-red-500"
                                                    }`}
                                                title="Toggle Status"
                                            >
                                                <span
                                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${attr.status ? "translate-x-5" : "translate-x-0"
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-2 font-semibold">#{index + 1}</p>
                                        <p className="text-sm text-gray-700">{attr.description || <span className="text-gray-400 italic">No description</span>}</p>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-3 border-t border-gray-100">
                                    <button
                                        title="View Attribute Values"
                                        onClick={() => onDetail(attr)}
                                        className="flex-1 py-2.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-sm cursor-pointer"
                                    >
                                        <TiInfoLargeOutline className="h-4 w-4" />
                                        Values
                                    </button>
                                    <button
                                        title="Edit Attribute"
                                        onClick={() => openModal(attr)}
                                        className="flex-1 py-2.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-sm cursor-pointer"
                                    >
                                        <Pencil className="h-4 w-4" />
                                        Edit
                                    </button>
                                    <button
                                        title="Delete Attribute"
                                        onClick={() => confirmDelete(attr)}
                                        className="flex-1 py-2.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-sm cursor-pointer"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
                            <p className="text-gray-400 italic">No Attributes Found</p>
                        </div>
                    )}
                </div>

                {/* Bottom Sentinel for Infinite Scroll */}
                <div ref={bottomSentinelRef} className="h-6 w-full pointer-events-none" />

                {/* Infinite Scroll Bottom Loading State */}
                {isLoadingMore && (
                    <div className="flex items-center justify-center gap-2.5 py-6 text-sm text-gray-600 animate-in fade-in duration-200">
                        <Loader2 className="w-5 h-5 animate-spin text-[#007FFF]" />
                        <span className="font-semibold text-gray-700">Loading more attributes...</span>
                    </div>
                )}

                {/* All Attributes Loaded End Indicator */}
                {!hasNextPage && attributes.length > 0 && !isLoadingInitial && (
                    <div className="flex items-center justify-center py-6 text-xs md:text-sm text-gray-400 font-medium animate-in fade-in duration-200">
                        <span className="bg-gray-100/90 px-4 py-1.5 rounded-full border border-gray-200 text-gray-600 font-semibold shadow-xs flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>All {attributes.length} attributes loaded</span>
                        </span>
                    </div>
                )}

                {/* Modal */}
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        reset({ name: "", description: "", status: true });
                        setSelectedAttribute(null);
                    }}
                    title={selectedAttribute ? "Edit Attribute" : "Add Attribute"}
                    width="max-w-xl"
                >
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className="grid gap-6 p-6 bg-white rounded-2xl"
                    >
                        {/* Name */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-1">
                                Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                {...register("name")}
                                type="text"
                                placeholder="Enter Attribute Name"
                                className="w-full min-h-12 py-2.5 px-4 rounded-xl bg-white border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#007FFF] transition-all duration-200"
                            />
                            <p className="text-sm text-red-500 mt-1">{errors.name?.message as any}</p>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-1">
                                Description
                            </label>
                            <input
                                {...register("description")}
                                type="text"
                                placeholder="Enter Description (optional)"
                                className="w-full min-h-12 py-2.5 px-4 rounded-xl bg-white border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#007FFF] transition-all duration-200"
                            />
                        </div>

                        {/* Divider */}
                        <hr className="border-gray-200" />

                        {/* Status + Submit */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
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

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isFormSubmit}
                                className={`px-8 py-3 w-full sm:w-auto font-semibold rounded-xl text-white shadow-md transition-all duration-300 cursor-pointer ${isFormSubmit
                                    ? "bg-blue-400/60 cursor-not-allowed"
                                    : "bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] hover:shadow-blue-500/30"
                                    }`}
                            >
                                {isFormSubmit
                                    ? "Saving..."
                                    : selectedAttribute
                                        ? "Update Attribute"
                                        : "Save Attribute"}
                            </button>
                        </div>
                    </form>
                </Modal>

                {/* Delete Modal */}
                <Modal
                    width="max-w-xl"
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    title="Confirm Delete"
                >
                    <div className="p-4">
                        <p className="text-gray-700">Are you sure you want to delete <strong>{selectedAttribute?.name}</strong>?</p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium cursor-pointer"
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
