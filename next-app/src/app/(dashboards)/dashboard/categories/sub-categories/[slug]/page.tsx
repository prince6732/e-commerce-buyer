
"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import Image from "next/image";
import { useLoader } from "@/context/LoaderContext";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash2, Search, Loader2, Plus, Check } from "lucide-react";
import Modal from "@/components/(sheared)/Modal";
import ErrorMessage from "@/components/(sheared)/ErrorMessage";
import SuccessMessage from "@/components/(sheared)/SuccessMessage";
import dynamic from "next/dynamic";

const JoditEditor = dynamic(() => import("jodit-react"), { ssr: false });
import ProtectedRoute from "@/components/(sheared)/ProtectedRoute";
import { TiInfoLargeOutline } from "react-icons/ti";
import {
  createSubcategory,
  deleteSubcategory,
  getSubcategories,
  updateSubcategory,
  toggleSubcategoryStatus
} from "../../../../../../../utils/subcategory";
import { getCategoryById } from "../../../../../../../utils/category";
import { fetchAttributes } from "../../../../../../../utils/attribute";
import ImageCropperModal from "@/components/(frontend)/ImageCropperModal";
import { Attribute, Category, Subcategory } from "@/common/interface";
import { FaArrowLeft } from "react-icons/fa";
import { getImageUrl } from "../../../../../../../utils/imageUtils";
import { getErrorMessage } from "../../../../../../../utils/errorUtils";
import { getCategorySlug } from "../../../../../../../utils/slugUtils";

const PAGE_SIZE = 10;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const SUPPORTED_FORMATS = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif"];

const schema = yup.object({
  name: yup.string().trim().required("Name is required").min(2, "Name must be at least 2 characters").max(100, "Name cannot exceed 100 characters"),
  description: yup.string().nullable().max(3000),
  link: yup.string().nullable(),
  hsn: yup
    .string()
    .transform((val) => (val ? String(val).trim() : ""))
    .required("HSN code is required")
    .max(15, "HSN code cannot exceed 15 characters"),
  cgst: yup
    .number()
    .transform((val, orig) => (orig === "" || orig === null || orig === undefined ? undefined : val))
    .typeError("CGST must be a valid number")
    .required("CGST is required")
    .min(0, "CGST cannot be negative")
    .max(99.99, "CGST must be below 100"),
  sgst: yup
    .number()
    .transform((val, orig) => (orig === "" || orig === null || orig === undefined ? undefined : val))
    .typeError("SGST must be a valid number")
    .required("SGST is required")
    .min(0, "SGST cannot be negative")
    .max(99.99, "SGST must be below 100"),
  igst: yup
    .number()
    .transform((val, orig) => (orig === "" || orig === null || orig === undefined ? undefined : val))
    .typeError("IGST must be a valid number")
    .required("IGST is required")
    .min(0, "IGST cannot be negative")
    .max(99.99, "IGST must be below 100"),
  attributes: yup
    .array()
    .of(
      yup.object({
        AttributeId: yup.number().typeError("Attribute is required").required("Attribute is required"),
        HasImages: yup.boolean().default(false),
        IsPrimary: yup.boolean().default(false)
      })
    )
    .max(2, "You can only add up to 2 attributes"),
  image: yup
    .mixed()
    .test("fileSize", "Image must be less than 8MB.", (file) => !file || typeof file === "string" || (file instanceof File && file.size <= MAX_FILE_SIZE))
    .test("fileType", "Unsupported format", (file) => !file || typeof file === "string" || (file instanceof File && SUPPORTED_FORMATS.includes(file.type))),
  secondary_image: yup
    .mixed()
    .test("fileSize", "Secondary image must be less than 8MB.", (file) => !file || typeof file === "string" || (file instanceof File && file.size <= MAX_FILE_SIZE))
    .test("fileType", "Unsupported format", (file) => !file || typeof file === "string" || (file instanceof File && SUPPORTED_FORMATS.includes(file.type))),
  status: yup.boolean().required(),
}).required();

type FormData = yup.InferType<typeof schema>;

export default function SubcategoriesManagement() {
  // Infinite scroll & subcategories state
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [totalSubcategories, setTotalSubcategories] = useState(0);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isFetchingRef = useRef(false);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Other state
  const [availableAttributes, setAvailableAttributes] = useState<Attribute[]>([]);
  const [parentCategory, setParentCategory] = useState<string | null>(null);
  const [parentCategoryData, setParentCategoryData] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<Subcategory | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
  const [previewPrimary, setPreviewPrimary] = useState<string | null>(null);
  const [previewSecondary, setPreviewSecondary] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [subcategoryToDelete, setSubcategoryToDelete] = useState<Subcategory | null>(null);

  const router = useRouter();
  const params = useParams();
  const categoryId = (params?.slug || params?.id || "") as string;

  const { showLoader, hideLoader } = useLoader();

  const config = useMemo(
    () => ({
      "uploader": { "insertImageAsBase64URI": true },
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
    control,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors }
  } = useForm<any>({
    resolver: yupResolver(schema),
    defaultValues: { name: "", description: "", attributes: [], status: true },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "attributes" });

  const disableScrollNumberInput = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
  };

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

  // Fetch Parent Category for autofill
  const fetchParentCategory = async () => {
    if (!categoryId) return;
    try {
      const res = await getCategoryById(categoryId);
      const cat = res?.result || res?.category || res?.data || res;
      if (cat) {
        setParentCategoryData(cat);
        if (cat.name) setParentCategory(cat.name);
      }
    } catch (err) {
      console.error("Failed to load parent category details", err);
    }
  };

  useEffect(() => {
    if (categoryId) {
      fetchParentCategory();
    }
  }, [categoryId]);

  // Fetch Attributes for dropdown
  const getAttributes = async () => {
    try {
      const res = await fetchAttributes({ status: 'active' });
      let activeAttributes: any[] = [];
      if (res && res.data && Array.isArray(res.data.attributes)) {
        activeAttributes = res.data.attributes;
      } else if (res && Array.isArray(res.attributes)) {
        activeAttributes = res.attributes;
      } else if (Array.isArray(res)) {
        activeAttributes = res;
      }
      const filtered = activeAttributes.filter(
        (attr: any) => attr.status === true || attr.status === 1 || attr.status === '1'
      );
      setAvailableAttributes(filtered);
    } catch {
      console.error("Failed to load attributes");
    }
  };

  useEffect(() => {
    getAttributes();
  }, []);

  // Fetch Subcategories
  const fetchSubcategories = async (pageNum: number, search: string = "", isAppend: boolean = false) => {
    if (!categoryId || isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isAppend) {
      setIsLoadingMore(true);
    } else {
      setIsLoadingInitial(true);
      if (search) setIsSearching(true);
    }

    try {
      const res = await getSubcategories(categoryId, {
        page: pageNum,
        limit: PAGE_SIZE,
        search: search || undefined,
        paginate: true,
      });

      let list: Subcategory[] = [];
      let paginationData: any = null;

      if (res && res.data && Array.isArray(res.data.subcategories)) {
        list = res.data.subcategories;
        paginationData = res.data.pagination;
        if (res.data.parent_category) setParentCategory(res.data.parent_category);
      } else if (res && Array.isArray(res.subcategories)) {
        list = res.subcategories;
        paginationData = res.pagination;
        if (res.parent_category) setParentCategory(res.parent_category);
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

      setTotalSubcategories(total);
      setHasNextPage(hasNext);
      setPage(pageNum);

      if (isAppend) {
        setSubcategories((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const newUnique = list.filter((s) => !existingIds.has(s.id));
          return [...prev, ...newUnique];
        });
      } else {
        setSubcategories(list);
      }
    } catch {
      setErrorMessage("Failed to load subcategories");
      if (!isAppend) setSubcategories([]);
      setHasNextPage(false);
    } finally {
      isFetchingRef.current = false;
      setIsLoadingInitial(false);
      setIsLoadingMore(false);
      setIsSearching(false);
    }
  };

  // Trigger initial fetch / reset on categoryId or search query changes
  useEffect(() => {
    if (categoryId) {
      setPage(1);
      setHasNextPage(true);
      fetchSubcategories(1, debouncedSearchQuery, false);
    }
  }, [categoryId, debouncedSearchQuery]);

  // Load next page on scroll
  const loadNextPage = useCallback(() => {
    if (!hasNextPage || isLoadingMore || isLoadingInitial || isFetchingRef.current) return;
    fetchSubcategories(page + 1, debouncedSearchQuery, true);
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

  const openModal = (subcategory: Subcategory | null = null) => {
    getAttributes();
    setSelectedSubcategory(subcategory);

    remove();

    if (subcategory) {
      setValue("name", subcategory.name);
      setValue("description", subcategory.description ?? "");
      setValue("link", subcategory.link ?? "");

      // Tax & GST values: use subcategory's own values if exist, otherwise fallback to parent category
      const subHsn = (subcategory as any).hsn;
      const subCgst = (subcategory as any).cgst;
      const subSgst = (subcategory as any).sgst;
      const subIgst = (subcategory as any).igst;

      const parentHsn = (parentCategoryData as any)?.hsn;
      const parentCgst = (parentCategoryData as any)?.cgst;
      const parentSgst = (parentCategoryData as any)?.sgst;
      const parentIgst = (parentCategoryData as any)?.igst;

      const hasSubHsn = subHsn !== null && subHsn !== undefined && String(subHsn).trim() !== "";
      const hasSubCgst = subCgst !== null && subCgst !== undefined && String(subCgst).trim() !== "";
      const hasSubSgst = subSgst !== null && subSgst !== undefined && String(subSgst).trim() !== "";
      const hasSubIgst = subIgst !== null && subIgst !== undefined && String(subIgst).trim() !== "";

      setValue("hsn", hasSubHsn ? subHsn : (parentHsn ?? ""));
      setValue("cgst", hasSubCgst ? subCgst : (parentCgst !== null && parentCgst !== undefined ? parentCgst : ""));
      setValue("sgst", hasSubSgst ? subSgst : (parentSgst !== null && parentSgst !== undefined ? parentSgst : ""));
      setValue("igst", hasSubIgst ? subIgst : (parentIgst !== null && parentIgst !== undefined ? parentIgst : ""));

      // If parent category is not yet loaded, load it and fill missing values
      if (!parentCategoryData && categoryId) {
        getCategoryById(categoryId).then((res: any) => {
          const cat = res?.result || res?.category || res?.data || res;
          if (cat) {
            setParentCategoryData(cat);
            if (cat.name) setParentCategory(cat.name);
            if (!hasSubHsn && (cat.hsn ?? "")) setValue("hsn", cat.hsn);
            if (!hasSubCgst && cat.cgst !== null && cat.cgst !== undefined) setValue("cgst", cat.cgst);
            if (!hasSubSgst && cat.sgst !== null && cat.sgst !== undefined) setValue("sgst", cat.sgst);
            if (!hasSubIgst && cat.igst !== null && cat.igst !== undefined) setValue("igst", cat.igst);
          }
        });
      }

      setValue("status", Boolean(subcategory.status));

      const normalize = (path?: string | null) =>
        path ? path.replace(/\\/g, "/") : null;

      const secImg = subcategory.secondary_image || (subcategory as any).secondaryImage;
      setPreviewPrimary(normalize(subcategory.image));
      setPreviewSecondary(normalize(secImg));
      if (subcategory.image) setValue("image", subcategory.image);
      if (secImg) setValue("secondary_image", secImg);

      if (subcategory.attributes && subcategory.attributes.length > 0) {
        const hasAnyPrimary = subcategory.attributes.some((attr) => {
          const a = attr as any;
          return Boolean(a.pivot?.is_primary ?? a.pivot?.isPrimary ?? a.is_primary ?? a.isPrimary ?? false);
        });

        subcategory.attributes.forEach((attr, idx) => {
          const a = attr as any;
          const hasImg = Boolean(a.pivot?.has_images ?? a.pivot?.hasImages ?? a.has_images ?? a.hasImages ?? false);
          let isPri = Boolean(a.pivot?.is_primary ?? a.pivot?.isPrimary ?? a.is_primary ?? a.isPrimary ?? false);
          if (!hasAnyPrimary && idx === 0) {
            isPri = true;
          }
          append({
            AttributeId: attr.id,
            HasImages: hasImg,
            IsPrimary: isPri
          });
        });
      }
    } else {
      const hsnVal = (parentCategoryData as any)?.hsn ?? "";
      const cgstVal = (parentCategoryData as any)?.cgst !== null && (parentCategoryData as any)?.cgst !== undefined ? (parentCategoryData as any).cgst : "";
      const sgstVal = (parentCategoryData as any)?.sgst !== null && (parentCategoryData as any)?.sgst !== undefined ? (parentCategoryData as any).sgst : "";
      const igstVal = (parentCategoryData as any)?.igst !== null && (parentCategoryData as any)?.igst !== undefined ? (parentCategoryData as any).igst : "";

      reset({
        name: "",
        description: "",
        link: "",
        hsn: hsnVal,
        cgst: cgstVal,
        sgst: sgstVal,
        igst: igstVal,
        attributes: [],
        status: true,
      });
      setPreviewPrimary(null);
      setPreviewSecondary(null);
    }

    setIsModalOpen(true);
  };

  const onSubmit = async (data: FormData) => {
    showLoader();
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      ...data,
      parent_id: selectedSubcategory?.parent_id ?? (selectedSubcategory as any)?.parentId ?? categoryId,
    };

    try {
      if (selectedSubcategory) {
        const res = await updateSubcategory(selectedSubcategory.id.toString(), payload as any);
        const updated = (res as any)?.subcategory || (res as any)?.data || { ...selectedSubcategory, ...payload };
        setSubcategories((prev) =>
          prev.map((s) => (s.id === selectedSubcategory.id ? { ...s, ...updated } : s))
        );
        setSuccessMessage("Subcategory updated successfully!");
      } else {
        const res = await createSubcategory(payload as any);
        const created = (res as any)?.subcategory || (res as any)?.data;
        if (created) {
          setSubcategories((prev) => [created, ...prev]);
          setTotalSubcategories((prev) => prev + 1);
        } else {
          await fetchSubcategories(1, debouncedSearchQuery, false);
        }
        setSuccessMessage("Subcategory created successfully!");
      }
      reset();
      setPreviewPrimary(null);
      setPreviewSecondary(null);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(getErrorMessage(err, selectedSubcategory ? "Failed to update Subcategory" : "Failed to create Subcategory"));
    } finally {
      hideLoader();
    }
  };

  const onDetail = (subcategory: Subcategory) => {
    router.push(`/dashboard/categories/${subcategory.id}/products`);
  };

  const confirmDelete = (subcategory: Subcategory) => {
    setSubcategoryToDelete(subcategory);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!subcategoryToDelete) return;
    showLoader();
    try {
      await deleteSubcategory(subcategoryToDelete.id.toString());
      setSubcategories((prev) => prev.filter((s) => s.id !== subcategoryToDelete.id));
      setTotalSubcategories((prev) => Math.max(0, prev - 1));
      setSuccessMessage("Subcategory deleted successfully!");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(getErrorMessage(err, "Failed to delete subcategory"));
    } finally {
      hideLoader();
      setIsDeleteModalOpen(false);
      setSubcategoryToDelete(null);
    }
  };

  const openDescriptionModal = (subcategory: Subcategory | null = null) => {
    setSelectedSubcategory(subcategory);
    if (subcategory) {
      setIsDescriptionModalOpen(true);
    }
  };

  const handleStatusToggle = async (subcategory: Subcategory) => {
    try {
      await toggleSubcategoryStatus(subcategory.id);
      setSubcategories((prev) =>
        prev.map((s) => s.id === subcategory.id ? { ...s, status: !s.status } : s)
      );
      setSuccessMessage("Status updated successfully!");
    } catch (err: any) {
      setErrorMessage(getErrorMessage(err, "Failed to toggle status."));
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

            {/* Title & Count */}
            <div className="flex items-center gap-3">
              <h2 className="text-lg md:text-xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">
                {parentCategory ? `${parentCategory} | Subcategories` : "Subcategories"}
              </h2>
              {totalSubcategories > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {subcategories.length} of {totalSubcategories}
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
                  placeholder="Search subcategories..."
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

              {/* Back Button */}
              <button
                type="button"
                onClick={() => router.back()}
                className="flex items-center justify-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl shadow-xs text-xs md:text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap"
              >
                <FaArrowLeft className="text-xs md:text-sm" />
                <span>Back</span>
              </button>

              {/* Create Subcategory Button */}
              <button
                onClick={() => openModal(null)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 md:py-2.5 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] rounded-xl shadow-md text-white font-semibold text-xs md:text-sm hover:shadow-lg transition-all duration-200 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Subcategory</span>
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
                  <th className="px-6 py-4">Attributes</th>
                  <th className="px-6 py-4">Primary Image</th>
                  <th className="px-6 py-4">Secondary Image</th>
                  <th className="px-6 py-4">Link</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-end">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-700">
                {isLoadingInitial && subcategories.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-16">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-[#007FFF]" />
                        <span className="text-sm font-medium text-gray-500">Loading subcategories...</span>
                      </div>
                    </td>
                  </tr>
                ) : subcategories.length ? (
                  subcategories.map((subcategory, index) => {
                    const image = getImageUrl(subcategory.image);
                    const secondary_image = getImageUrl(subcategory.secondary_image || (subcategory as any).secondaryImage);
                    return (
                      <tr key={subcategory.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4 font-semibold text-gray-500">{index + 1}</td>
                        <td className="px-6 py-4 max-w-[200px] break-all whitespace-normal font-semibold text-gray-900">{subcategory.name}</td>
                        <td className="px-6 py-4">
                          {subcategory.attributes && subcategory.attributes.length > 0 ? (
                            <div className="space-y-1.5">
                              {subcategory.attributes.map((attr, idx) => (
                                <div
                                  key={idx}
                                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 text-xs"
                                >
                                  <div className="flex items-center gap-1.5 font-semibold text-gray-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                    <span>{attr.name || "Attribute"}</span>
                                  </div>
                                  <div className="flex gap-2 text-[10px] text-gray-500 mt-1 pl-3">
                                    <span className={`px-1.5 py-0.5 rounded ${attr.pivot?.is_primary ? "bg-blue-100 text-blue-700 font-bold" : "bg-gray-100 text-gray-600"}`}>
                                      {attr.pivot?.is_primary ? "Primary" : "Secondary"}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded ${attr.pivot?.has_images ? "bg-purple-100 text-purple-700 font-bold" : "bg-gray-100 text-gray-600"}`}>
                                      {attr.pivot?.has_images ? "Has Images" : "No Images"}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">No Attributes</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          {image ? (
                            <Image
                              src={image}
                              alt={subcategory.name}
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
                          {secondary_image ? (
                            <Image
                              src={secondary_image}
                              alt={subcategory.name}
                              width={60}
                              height={60}
                              className="object-cover rounded-xl border border-gray-200 shadow-sm"
                              unoptimized
                            />
                          ) : (
                            <span className="text-xs text-gray-400 italic">No Image</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {subcategory.link ? (
                            <a
                              href={subcategory.link}
                              className="text-[#007FFF] hover:text-blue-700 underline truncate max-w-[140px] inline-block font-medium"
                              title={subcategory.link}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {subcategory.link}
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            className="px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold transition cursor-pointer"
                            onClick={() => openDescriptionModal(subcategory)}
                          >
                            View Description
                          </button>
                        </td>

                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleStatusToggle(subcategory)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors cursor-pointer ${subcategory.status ? "bg-green-500" : "bg-red-500"
                              }`}
                            title="Toggle Status"
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${subcategory.status ? "translate-x-5" : "translate-x-0"
                                }`}
                            />
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              title="View Category Products"
                              onClick={() => onDetail(subcategory)}
                              className="size-10 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full flex items-center justify-center transition cursor-pointer"
                            >
                              <TiInfoLargeOutline className="h-5 w-5" />
                            </button>
                            <button
                              title="Edit Subcategory"
                              onClick={() => openModal(subcategory)}
                              className="size-10 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full flex items-center justify-center transition cursor-pointer"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              title="Delete Subcategory"
                              onClick={() => confirmDelete(subcategory)}
                              className="size-10 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center transition cursor-pointer"
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
                    <td
                      colSpan={9}
                      className="text-center text-gray-400 py-12 italic"
                    >
                      No Subcategories Found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cards - Mobile */}
        <div className="md:hidden space-y-4">
          {isLoadingInitial && subcategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-md border border-gray-200">
              <Loader2 className="w-8 h-8 animate-spin text-[#007FFF] mb-2" />
              <span className="text-sm font-medium text-gray-500">Loading subcategories...</span>
            </div>
          ) : subcategories.length ? (
            subcategories.map((subcategory, index) => {
              const image = getImageUrl(subcategory.image);
              const secondary_image = getImageUrl(subcategory.secondary_image || (subcategory as any).secondaryImage);
              return (
                <div
                  key={subcategory.id}
                  className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-gray-900 text-base">{subcategory.name}</h3>
                        <button
                          onClick={() => handleStatusToggle(subcategory)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors cursor-pointer ${subcategory.status ? "bg-green-500" : "bg-red-500"
                            }`}
                          title="Toggle Status"
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${subcategory.status ? "translate-x-5" : "translate-x-0"
                              }`}
                          />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 font-semibold mb-2">#{index + 1}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {image ? (
                      <Image
                        src={image}
                        alt={subcategory.name}
                        width={80}
                        height={80}
                        className="object-cover rounded-lg w-full h-24 border border-gray-100"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                        <span className="text-xs text-gray-400">No Primary Image</span>
                      </div>
                    )}
                    {secondary_image ? (
                      <Image
                        src={secondary_image}
                        alt={subcategory.name}
                        width={80}
                        height={80}
                        className="object-cover rounded-lg w-full h-24 border border-gray-100"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                        <span className="text-xs text-gray-400">No Secondary Image</span>
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <button
                      className="w-full py-1.5 text-xs rounded-lg bg-blue-50 text-blue-700 font-semibold transition cursor-pointer"
                      onClick={() => openDescriptionModal(subcategory)}
                    >
                      View Description
                    </button>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      title="View Products"
                      onClick={() => onDetail(subcategory)}
                      className="flex-1 py-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-sm cursor-pointer"
                    >
                      <TiInfoLargeOutline className="h-4 w-4" />
                      Products
                    </button>
                    <button
                      title="Edit Subcategory"
                      onClick={() => openModal(subcategory)}
                      className="flex-1 py-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-sm cursor-pointer"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      title="Delete Subcategory"
                      onClick={() => confirmDelete(subcategory)}
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
              <p className="text-gray-400 italic">No Subcategories Found</p>
            </div>
          )}
        </div>

        {/* Bottom Sentinel for Infinite Scroll */}
        <div ref={bottomSentinelRef} className="h-6 w-full pointer-events-none" />

        {/* Infinite Scroll Bottom Loading State */}
        {isLoadingMore && (
          <div className="flex items-center justify-center gap-2.5 py-6 text-sm text-gray-600 animate-in fade-in duration-200">
            <Loader2 className="w-5 h-5 animate-spin text-[#007FFF]" />
            <span className="font-semibold text-gray-700">Loading more subcategories...</span>
          </div>
        )}

        {/* All Subcategories Loaded End Indicator */}
        {!hasNextPage && subcategories.length > 0 && !isLoadingInitial && (
          <div className="flex items-center justify-center py-6 text-xs md:text-sm text-gray-400 font-medium animate-in fade-in duration-200">
            <span className="bg-gray-100/90 px-4 py-1.5 rounded-full border border-gray-200 text-gray-600 font-semibold shadow-xs flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>All {subcategories.length} subcategories loaded</span>
            </span>
          </div>
        )}

        {/* Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            reset({ name: "", description: "", link: "", hsn: "", cgst: "", sgst: "", igst: "", attributes: [], status: true });
            setPreviewPrimary(null);
            setPreviewSecondary(null);
            setSelectedSubcategory(null);
          }}
          title={selectedSubcategory ? "Edit Subcategory" : "Add Subcategory"}
          width="max-w-4xl"
        >
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="grid gap-6 p-4 md:p-6 bg-white rounded-2xl max-h-[80vh] overflow-y-auto"
          >
            {/* Name */}
            <div>
              <label className="block text-xs md:text-sm font-semibold text-gray-900 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register("name")}
                type="text"
                placeholder="Enter Subcategory Name"
                className="w-full py-2.5 px-4 rounded-xl bg-white border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-[#007FFF] transition text-sm"
              />
              <p className="text-xs text-red-500 mt-1">{errors.name?.message as any}</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs md:text-sm font-semibold text-gray-900 mb-1">
                Description
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

            {/* Link */}
            <div>
              <label className="block text-xs md:text-sm font-semibold text-gray-900 mb-1">
                Link
              </label>
              <input
                {...register("link")}
                type="text"
                placeholder="Enter Link"
                className="w-full py-2.5 px-4 rounded-xl bg-white border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-[#007FFF] transition text-sm"
              />
              <p className="text-xs text-red-500 mt-1">{errors.link?.message as any}</p>
            </div>

            {/* Tax & GST Configuration (HSN, CGST, SGST, IGST) */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs md:text-sm font-bold text-gray-900">Tax & GST Configuration</span>
                <span className="text-red-500 font-bold text-sm">*</span>
                {(!selectedSubcategory || !((selectedSubcategory as any)?.hsn || (selectedSubcategory as any)?.cgst !== null && (selectedSubcategory as any)?.cgst !== undefined && String((selectedSubcategory as any)?.cgst).trim() !== "")) && ((parentCategoryData as any)?.hsn || (parentCategoryData as any)?.cgst) && (
                  <span className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md font-medium">
                    Autofilled from {parentCategory || (parentCategoryData as any)?.name || "Category"} (Editable)
                  </span>
                )}
              </div>

              {/* HSN Code */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  HSN Code <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">(Max 15 characters)</span>
                </label>
                <input
                  {...register("hsn")}
                  type="text"
                  maxLength={15}
                  placeholder="e.g. 61091000"
                  className="w-full py-2.5 px-4 rounded-xl bg-white border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-[#007FFF] transition text-sm"
                />
                <p className="text-xs text-red-500 mt-1">{errors.hsn?.message as any}</p>
              </div>

              {/* GST Percentages */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    CGST (%) <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">(&lt; 100)</span>
                  </label>
                  <input
                    {...register("cgst")}
                    type="number"
                    step="0.01"
                    min="0"
                    max="99.99"
                    onWheel={disableScrollNumberInput}
                    placeholder="e.g. 9.00"
                    className="w-full py-2 px-3 rounded-lg bg-white border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-[#007FFF] transition text-sm"
                  />
                  <p className="text-xs text-red-500 mt-1">{errors.cgst?.message as any}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    SGST (%) <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">(&lt; 100)</span>
                  </label>
                  <input
                    {...register("sgst")}
                    type="number"
                    step="0.01"
                    min="0"
                    max="99.99"
                    onWheel={disableScrollNumberInput}
                    placeholder="e.g. 9.00"
                    className="w-full py-2 px-3 rounded-lg bg-white border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-[#007FFF] transition text-sm"
                  />
                  <p className="text-xs text-red-500 mt-1">{errors.sgst?.message as any}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    IGST (%) <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">(&lt; 100)</span>
                  </label>
                  <input
                    {...register("igst")}
                    type="number"
                    step="0.01"
                    min="0"
                    max="99.99"
                    onWheel={disableScrollNumberInput}
                    placeholder="e.g. 18.00"
                    className="w-full py-2 px-3 rounded-lg bg-white border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-[#007FFF] transition text-sm"
                  />
                  <p className="text-xs text-red-500 mt-1">{errors.igst?.message as any}</p>
                </div>
              </div>
            </div>

            {/* Images Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Primary Image */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <label className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                  Primary Image
                </label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <ImageCropperModal
                    onSelect={(file: any) => {
                      setValue("image", file);
                      setPreviewPrimary(file);
                    }}
                    buttonLabel="Select Image"
                    directory="categories"
                  />
                  {previewPrimary ? (
                    <img
                      src={getImageUrl(previewPrimary) || ""}
                      alt="Primary"
                      className="h-20 w-20 rounded-xl object-cover border border-gray-200 shadow-sm"
                    />
                  ) : (
                    <div className="h-20 w-20 flex items-center justify-center rounded-xl bg-gray-100 border border-gray-200 text-xs text-gray-400">
                      No Image
                    </div>
                  )}
                </div>
              </div>

              {/* Secondary Image */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <label className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                  Secondary Image
                </label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <ImageCropperModal
                    onSelect={(file: any) => {
                      setValue("secondary_image", file);
                      setPreviewSecondary(file);
                    }}
                    buttonLabel="Select Image"
                    directory="categories"
                  />
                  {previewSecondary ? (
                    <img
                      src={getImageUrl(previewSecondary) || ""}
                      alt="Secondary"
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

            {/* Dynamic Attributes Section */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs md:text-sm font-bold text-gray-900">
                  Category Attributes (Max 2)
                </label>
                {fields.length < 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentAttrs = watch("attributes") || [];
                      const hasPrimary = currentAttrs.some((a: any) => a?.IsPrimary);
                      append({
                        AttributeId: "" as any,
                        HasImages: false,
                        IsPrimary: fields.length === 0 || !hasPrimary,
                      });
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition cursor-pointer"
                  >
                    + Add Attribute
                  </button>
                )}
              </div>

              {fields.map((item, index) => (
                <div key={item.id} className="p-3 bg-white rounded-xl border border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Select Attribute</label>
                    <select
                      {...register(`attributes.${index}.AttributeId` as const)}
                      className="w-full py-2 px-3 rounded-lg border border-gray-300 text-sm bg-white text-gray-900"
                    >
                      <option value="">Select Attribute</option>
                      {availableAttributes.map((attr) => (
                        <option key={attr.id} value={attr.id}>
                          {attr.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700">
                      <input
                        type="checkbox"
                        {...register(`attributes.${index}.HasImages` as const)}
                        onChange={(e) => {
                          setValue(`attributes.${index}.HasImages` as any, e.target.checked);
                          if (e.target.checked) {
                            fields.forEach((_, otherIdx) => {
                              if (otherIdx !== index) {
                                setValue(`attributes.${otherIdx}.HasImages` as any, false);
                              }
                            });
                          }
                        }}
                        className="rounded text-[#007FFF]"
                      />
                      Has Images
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700">
                      <input
                        type="checkbox"
                        {...register(`attributes.${index}.IsPrimary` as const)}
                        onChange={(e) => {
                          setValue(`attributes.${index}.IsPrimary` as any, e.target.checked);
                          if (e.target.checked) {
                            fields.forEach((_, otherIdx) => {
                              if (otherIdx !== index) {
                                setValue(`attributes.${otherIdx}.IsPrimary` as any, false);
                              }
                            });
                          }
                        }}
                        className="rounded text-[#007FFF]"
                      />
                      Is Primary
                    </label>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const wasPrimary = watch(`attributes.${index}.IsPrimary`);
                        remove(index);
                        if (wasPrimary && fields.length > 1) {
                          setTimeout(() => {
                            setValue(`attributes.0.IsPrimary` as any, true);
                          }, 0);
                        }
                      }}
                      className="px-3 py-1.5 text-xs bg-red-100 hover:bg-red-200 text-red-600 font-semibold rounded-lg transition cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Status + Submit */}
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-gray-200">
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

              <button
                type="submit"
                className="px-8 py-2.5 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] text-white font-semibold rounded-xl transition-all duration-300 shadow-md hover:shadow-blue-500/30 text-sm cursor-pointer"
              >
                {selectedSubcategory ? "Update Subcategory" : "Save Subcategory"}
              </button>
            </div>
          </form>
        </Modal>

        {/* Description Modal */}
        <Modal
          isOpen={isDescriptionModalOpen}
          onClose={() => setIsDescriptionModalOpen(false)}
          width="max-w-3xl"
          title="Subcategory Description"
        >
          <div
            className="p-4 text-gray-700 prose max-w-none"
            dangerouslySetInnerHTML={{
              __html: selectedSubcategory?.description || "<p>No Description</p>",
            }}
          />
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          width="max-w-md"
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSubcategoryToDelete(null);
          }}
          title="Confirm Delete"
        >
          <div className="p-4">
            <p className="text-gray-700">
              Are you sure you want to delete <strong>{subcategoryToDelete?.name}</strong>?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSubcategoryToDelete(null);
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
    </ProtectedRoute>
  );
}