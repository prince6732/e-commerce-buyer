"use client";

import { yupResolver } from "@hookform/resolvers/yup";
import { useEffect, useState, useRef, useCallback } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import * as yup from "yup";
import Modal from "@/components/(sheared)/Modal";
import ErrorMessage from "@/components/(sheared)/ErrorMessage";
import SuccessMessage from "@/components/(sheared)/SuccessMessage";
import { useLoader } from "@/context/LoaderContext";
import { useParams, useRouter } from "next/navigation";
import { AxiosError } from "axios";
import { Pencil, Trash2, Search, Loader2, Plus, Check } from "lucide-react";
import ProtectedRoute from "@/components/(sheared)/ProtectedRoute";
import {
    createAttributeValue,
    deleteAttributeValue,
    fetchAttributeValues,
    updateAttributeValue,
    toggleAttributeValueStatus
} from "../../../../../../../utils/attributeValue";
import { AttributeValue } from "@/common/interface";
import { FaArrowLeft } from "react-icons/fa";

const schema = yup.object({
    value: yup.string().required("Value is required").max(100),
    description: yup.string().nullable().max(255, "Description can't exceed 255 characters"),
    status: yup.boolean().required(),
    attributeValues: yup.array(
        yup.object({
            value: yup.string().required("Value is required"),
            description: yup.string().nullable().max(255, "Description can't exceed 255 characters"),
            status: yup.boolean().required(),
        })
    ),
}).required();

type FormData = yup.InferType<typeof schema>;

const PAGE_SIZE = 10;

export default function AttributeValuesManagement() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFormSubmit, setIsFormSubmit] = useState(false);
    const [selectedValue, setSelectedValue] = useState<AttributeValue | null>(null);
    const [attributeName, setAttributeName] = useState<string | null>(null);
    const [resolvedAttributeId, setResolvedAttributeId] = useState<number | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Infinite scroll & values state
    const [values, setValues] = useState<AttributeValue[]>([]);
    const [page, setPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(true);
    const [totalValues, setTotalValues] = useState(0);
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const isFetchingRef = useRef(false);
    const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    const { showLoader, hideLoader } = useLoader();
    const params = useParams();
    const rawIdentifier = (params?.slug || params?.id || "") as string;
    const router = useRouter();

    const {
        register,
        handleSubmit,
        reset,
        control,
        watch,
        formState: { errors },
    } = useForm<any>({
        resolver: yupResolver(schema),
        defaultValues: {
            value: "",
            description: "",
            status: true,
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "attributeValues",
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

    // Fetch Attribute Values function
    const fetchValues = async (pageNum: number, search: string = "", isAppend: boolean = false) => {
        if (!rawIdentifier || isFetchingRef.current) return;
        isFetchingRef.current = true;

        if (isAppend) {
            setIsLoadingMore(true);
        } else {
            setIsLoadingInitial(true);
            if (search) setIsSearching(true);
        }

        try {
            const res = await fetchAttributeValues(rawIdentifier, {
                page: pageNum,
                limit: PAGE_SIZE,
                search: search || undefined,
            });

            let list: AttributeValue[] = [];
            let paginationData: any = null;

            const attrObj = res?.data?.attribute || res?.attribute;
            if (attrObj) {
                if (attrObj.id) setResolvedAttributeId(Number(attrObj.id));
                if (attrObj.name) setAttributeName(attrObj.name);
            }

            if (res && res.data && Array.isArray(res.data.values)) {
                list = res.data.values;
                paginationData = res.data.pagination;
            } else if (res && Array.isArray(res.values)) {
                list = res.values;
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

            setTotalValues(total);
            setHasNextPage(hasNext);
            setPage(pageNum);

            if (isAppend) {
                setValues((prev) => {
                    const existingIds = new Set(prev.map((v) => v.id));
                    const newUnique = list.filter((v) => !existingIds.has(v.id));
                    return [...prev, ...newUnique];
                });
            } else {
                setValues(list);
            }
        } catch {
            setErrorMessage("Failed to load attribute values. Please try again.");
            if (!isAppend) setValues([]);
            setHasNextPage(false);
        } finally {
            isFetchingRef.current = false;
            setIsLoadingInitial(false);
            setIsLoadingMore(false);
            setIsSearching(false);
        }
    };

    // Trigger initial fetch / reset on rawIdentifier or search changes
    useEffect(() => {
        if (rawIdentifier) {
            setPage(1);
            setHasNextPage(true);
            fetchValues(1, debouncedSearchQuery, false);
        }
    }, [rawIdentifier, debouncedSearchQuery]);

    // Load next page
    const loadNextPage = useCallback(() => {
        if (!isFetchingRef.current && hasNextPage && !isLoadingInitial && !isLoadingMore) {
            fetchValues(page + 1, debouncedSearchQuery, true);
        }
    }, [hasNextPage, isLoadingInitial, isLoadingMore, page, debouncedSearchQuery, rawIdentifier]);

    // IntersectionObserver for bottom sentinel
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

    const openModal = (val: AttributeValue | null = null) => {
        setSelectedValue(val);
        if (val) {
            reset({ value: val.value, description: val.description || "", status: val.status });
        } else {
            reset({ value: "", description: "", status: true, attributeValues: [] });
        }
        setIsModalOpen(true);
    };

    const onSubmit = async (data: FormData) => {
        showLoader();
        setIsFormSubmit(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        const targetAttrId = resolvedAttributeId || (!isNaN(Number(rawIdentifier)) ? Number(rawIdentifier) : 0);

        const payload = {
            ...data,
            attributeValues: [
                ...(data.attributeValues || []),
                { value: data.value, description: data.description, status: data.status },
            ],
            attribute_id: targetAttrId,
            attribute_slug: rawIdentifier,
        };

        try {
            if (selectedValue) {
                const res = await updateAttributeValue(selectedValue.id, payload as any);
                const updated = res.value || res.data || { ...selectedValue, ...payload };
                setValues((prev) =>
                    prev.map((v) => (v.id === selectedValue.id ? { ...v, ...updated } : v))
                );
                setSuccessMessage("Value updated successfully!");
            } else {
                const res = await createAttributeValue(payload as any);
                const createdList = res.values || res.data || (res.value ? [res.value] : []);
                if (Array.isArray(createdList) && createdList.length > 0) {
                    setValues((prev) => [...createdList, ...prev]);
                    setTotalValues((prev) => prev + createdList.length);
                } else {
                    await fetchValues(1, debouncedSearchQuery, false);
                }
                setSuccessMessage("Value created successfully!");
            }

            reset({ value: "", description: "", status: true, attributeValues: [] });
            setIsModalOpen(false);
        } catch (err) {
            const error = err as AxiosError<{ message?: string }>;
            setErrorMessage(error.response?.data?.message || "Please try again.");
        } finally {
            setIsFormSubmit(false);
            hideLoader();
        }
    };

    const confirmDelete = (val: AttributeValue) => {
        setSelectedValue(val);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!selectedValue) return;
        showLoader();
        try {
            await deleteAttributeValue(selectedValue.id);
            setValues((prev) => prev.filter((v) => v.id !== selectedValue.id));
            setTotalValues((prev) => Math.max(0, prev - 1));
            setSuccessMessage("Value deleted successfully!");
            setIsDeleteModalOpen(false);
            setSelectedValue(null);
        } catch (err: any) {
            console.error(err);
            setErrorMessage(err.response?.data?.message || err.response?.data?.error || "Failed to delete value. Please try again.");
        } finally {
            hideLoader();
        }
    };

    const handleStatusToggle = async (val: AttributeValue) => {
        try {
            await toggleAttributeValueStatus(val.id);
            setValues((prev) =>
                prev.map((v) => v.id === val.id ? { ...v, status: !v.status } : v)
            );
            setSuccessMessage("Status updated successfully!");
        } catch {
            setErrorMessage("Failed to toggle status.");
        }
    };

    return (
        <ProtectedRoute role="Admin">
            <div className="p-3 md:p-6">
                {errorMessage && <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />}
                {successMessage && <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />}

                {/* Header */}
                <div className="mb-4 md:mb-6 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-xl shadow-md">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 md:px-6 py-3.5 md:py-4">

                        {/* Title & Badge */}
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg md:text-xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">
                                {attributeName ? `${attributeName} | Values` : "Attribute Values"}
                            </h2>
                            {totalValues > 0 && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                    {values.length} of {totalValues}
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
                                    placeholder="Search values..."
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

                            {/* Back Button */}
                            <button
                                type="button"
                                onClick={() => router.push("/dashboard/attributes")}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl shadow-xs text-xs md:text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap"
                            >
                                <FaArrowLeft className="text-xs md:text-sm" />
                                <span>Back</span>
                            </button>

                            {/* Create Value Button */}
                            <button
                                onClick={() => openModal(null)}
                                className="flex items-center justify-center gap-1.5 px-4 py-2 md:py-2.5 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] rounded-xl shadow-md text-white font-semibold text-xs md:text-sm hover:shadow-lg transition-all duration-200 whitespace-nowrap cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Create Value</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Table - Desktop */}
                <div className="hidden md:block">
                    <div className="overflow-x-auto scrollbar rounded-2xl shadow-lg border border-gray-200 bg-white">
                        <table className="w-full min-w-[700px] text-sm text-left">
                            <thead className="uppercase text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4">S.No.</th>
                                    <th className="px-6 py-4">Value</th>
                                    <th className="px-6 py-4">Description</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-end">Action</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-200 text-gray-700">
                                {isLoadingInitial && values.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-16">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Loader2 className="w-8 h-8 animate-spin text-[#007FFF]" />
                                                <span className="text-sm font-medium text-gray-500">Loading values...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : values.length > 0 ? (
                                    values.map((val, index) => (
                                        <tr
                                            key={val.id}
                                            className="hover:bg-blue-50/30 transition-colors"
                                        >
                                            <td className="px-6 py-4 font-semibold text-gray-500">{index + 1}</td>
                                            <td className="px-6 py-4 max-w-[200px] break-all whitespace-normal font-semibold text-gray-900">{val.value}</td>
                                            <td className="px-6 py-4 max-w-[300px] break-all whitespace-normal text-gray-600">{val.description || <span className="text-gray-400 italic">—</span>}</td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleStatusToggle(val)}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors cursor-pointer ${val.status ? "bg-green-500" : "bg-red-500"
                                                        }`}
                                                    title="Toggle Status"
                                                >
                                                    <span
                                                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${val.status ? "translate-x-5" : "translate-x-0"
                                                            }`}
                                                    />
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        title="Edit Value"
                                                        onClick={() => openModal(val)}
                                                        className="size-10 bg-blue-100 hover:bg-blue-200 text-blue-600 flex justify-center items-center rounded-full transition cursor-pointer"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        title="Delete Value"
                                                        onClick={() => confirmDelete(val)}
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
                                            No Values Found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Cards - Mobile */}
                <div className="md:hidden space-y-4">
                    {isLoadingInitial && values.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-md border border-gray-200">
                            <Loader2 className="w-8 h-8 animate-spin text-[#007FFF] mb-2" />
                            <span className="text-sm font-medium text-gray-500">Loading values...</span>
                        </div>
                    ) : values.length ? (
                        values.map((val, index) => (
                            <div
                                key={val.id}
                                className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg transition"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="font-bold text-gray-900 text-base">{val.value}</h3>
                                            <button
                                                onClick={() => handleStatusToggle(val)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors cursor-pointer ${val.status ? "bg-green-500" : "bg-red-500"
                                                    }`}
                                                title="Toggle Status"
                                            >
                                                <span
                                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${val.status ? "translate-x-5" : "translate-x-0"
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-2 font-semibold">#{index + 1}</p>
                                        <p className="text-sm text-gray-700">{val.description || <span className="text-gray-400 italic">No description</span>}</p>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-3 border-t border-gray-100">
                                    <button
                                        title="Edit Value"
                                        onClick={() => openModal(val)}
                                        className="flex-1 py-2.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-sm cursor-pointer"
                                    >
                                        <Pencil className="h-4 w-4" />
                                        Edit
                                    </button>
                                    <button
                                        title="Delete Value"
                                        onClick={() => confirmDelete(val)}
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
                            <p className="text-gray-400 italic">No Values Found</p>
                        </div>
                    )}
                </div>

                {/* Bottom Sentinel for Infinite Scroll */}
                <div ref={bottomSentinelRef} className="h-6 w-full pointer-events-none" />

                {/* Infinite Scroll Bottom Loading State */}
                {isLoadingMore && (
                    <div className="flex items-center justify-center gap-2.5 py-6 text-sm text-gray-600 animate-in fade-in duration-200">
                        <Loader2 className="w-5 h-5 animate-spin text-[#007FFF]" />
                        <span className="font-semibold text-gray-700">Loading more values...</span>
                    </div>
                )}

                {!hasNextPage && values.length > 0 && !isLoadingInitial && (
                    <div className="flex items-center justify-center py-6 text-xs md:text-sm text-gray-400 font-medium animate-in fade-in duration-200">
                        <span className="bg-gray-100/90 px-4 py-1.5 rounded-full border border-gray-200 text-gray-600 font-semibold shadow-xs flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>All {values.length} values loaded</span>
                        </span>
                    </div>
                )}

                {/* Form Modal */}
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        reset({ value: "", description: "", status: true });
                        setSelectedValue(null);
                    }}
                    title={selectedValue ? "Edit Value" : "Add Value"}
                    width="max-w-3xl"
                >
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className="grid gap-6 p-6 bg-white rounded-2xl"
                    >
                        {/* Single Value Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Value */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-1">
                                    Value <span className="text-red-500">*</span>
                                </label>
                                <input
                                    {...register("value")}
                                    placeholder="Enter Value"
                                    className="w-full min-h-12 py-2.5 px-4 rounded-xl bg-white border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#007FFF] transition-all duration-200"
                                />
                                <p className="text-sm text-red-500 mt-1">{errors.value?.message as any}</p>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-1">
                                    Description
                                </label>
                                <input
                                    {...register("description")}
                                    placeholder="Enter Description (optional)"
                                    className="w-full min-h-12 py-2.5 px-4 rounded-xl bg-white border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#007FFF] transition-all duration-200"
                                />
                                <p className="text-sm text-red-500 mt-1">{errors.description?.message as any}</p>
                            </div>
                        </div>

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

                        {/* Divider */}
                        <hr className="border-gray-200" />

                        {/* Dynamic Values (Add More Section) */}
                        {!selectedValue && (
                            <div className="space-y-4">
                                {fields.map((field, index) => {
                                    const statusFieldName = `attributeValues.${index}.status` as const;
                                    const statusValue = watch(statusFieldName);

                                    return (
                                        <div
                                            key={field.id}
                                            className="p-4 rounded-xl bg-gray-50 border border-gray-200"
                                        >
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Value */}
                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                                                        Value <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        {...register(`attributeValues.${index}.value` as const)}
                                                        placeholder="Enter Value"
                                                        className="w-full min-h-12 py-2.5 px-4 rounded-xl bg-white border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#007FFF] transition-all duration-200"
                                                    />
                                                    <p className="text-sm text-red-500 mt-1">
                                                        {(errors.attributeValues as any)?.[index]?.value?.message}
                                                    </p>
                                                </div>

                                                {/* Description */}
                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                                                        Description
                                                    </label>
                                                    <input
                                                        {...register(`attributeValues.${index}.description` as const)}
                                                        placeholder="Enter Description"
                                                        className="w-full min-h-12 py-2.5 px-4 rounded-xl bg-white border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#007FFF] transition-all duration-200"
                                                    />
                                                    <p className="text-sm text-red-500 mt-1">
                                                        {(errors.attributeValues as any)?.[index]?.description?.message}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Status & Remove */}
                                            <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-200">
                                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                                    <span className="text-sm font-semibold text-gray-900">Status</span>
                                                    <div
                                                        className={`flex items-center h-6 w-12 rounded-full transition-all duration-300 ${statusValue ? "bg-green-500" : "bg-red-500"
                                                            }`}
                                                    >
                                                        <input type="checkbox" {...register(statusFieldName)} hidden />
                                                        <div
                                                            className={`h-6 w-6 rounded-full bg-white shadow-md transform transition-all duration-300 ${statusValue ? "translate-x-6" : "translate-x-0"
                                                                }`}
                                                        ></div>
                                                    </div>
                                                </label>

                                                <button
                                                    type="button"
                                                    onClick={() => remove(index)}
                                                    className="text-xs bg-red-100 hover:bg-red-200 text-red-600 font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Submit */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                            <div className="flex gap-2 w-full sm:w-auto">
                                {!selectedValue && (
                                    <button
                                        type="button"
                                        onClick={() => append({ value: "", description: "", status: true })}
                                        className="px-5 py-2.5 rounded-xl font-semibold bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-all cursor-pointer text-sm"
                                    >
                                        + Add More
                                    </button>
                                )}

                                <button
                                    type="submit"
                                    disabled={isFormSubmit}
                                    className={`px-8 py-2.5 font-semibold rounded-xl text-white shadow-md transition-all duration-300 cursor-pointer text-sm ${isFormSubmit
                                        ? "bg-blue-400/60 cursor-not-allowed"
                                        : "bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] hover:shadow-blue-500/30"
                                        }`}
                                >
                                    {isFormSubmit ? "Saving..." : selectedValue ? "Update Value" : "Save Value"}
                                </button>
                            </div>
                        </div>
                    </form>
                </Modal>

                {/* Delete Modal */}
                <Modal width="max-w-xl" isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirm Delete">
                    <div className="p-4">
                        <p className="text-gray-700">Are you sure you want to delete <strong>{selectedValue?.value}</strong>?</p>
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
