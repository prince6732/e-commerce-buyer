"use client";

import { yupResolver } from "@hookform/resolvers/yup";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import * as yup from "yup";
import Modal from "@/components/(sheared)/Modal";
import ErrorMessage from "@/components/(sheared)/ErrorMessage";
import SuccessMessage from "@/components/(sheared)/SuccessMessage";
import { useLoader } from "@/context/LoaderContext";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Pencil, Trash2, Search, Loader2, Plus, Check } from "lucide-react";
import { TiInfoLargeOutline } from "react-icons/ti";
import ProtectedRoute from "@/components/(sheared)/ProtectedRoute";
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
  toggleCategoryStatus,
} from "../../../../../utils/category";
import dynamic from "next/dynamic";

const JoditEditor = dynamic(() => import("jodit-react"), { ssr: false });
import ImageCropperModal from "@/components/(frontend)/ImageCropperModal";
import { Category } from "@/common/interface";
import { getImageUrl } from "../../../../../utils/imageUtils";
import { getErrorMessage } from "../../../../../utils/errorUtils";
import { getCategorySlug } from "../../../../../utils/slugUtils";

const PAGE_SIZE = 10;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const SUPPORTED_FORMATS = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
];

const schema = yup
  .object({
    name: yup.string().trim().required("Name is required").min(2, "Name must be at least 2 characters").max(50, "Name cannot exceed 50 characters"),
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
    image: yup.mixed().test("fileSize", "Image must be less than 8MB.",
      (file) => !file || typeof file === "string" || (file instanceof File && file.size <= MAX_FILE_SIZE)
    ).test("fileType", "Unsupported format", (file) => !file || typeof file === "string" ||
      (file instanceof File && SUPPORTED_FORMATS.includes(file.type))
    ),
    secondary_image: yup.mixed().test("fileSize", "Secondary image must be less than 8MB.",
      (file) => !file || typeof file === "string" || (file instanceof File && file.size <= MAX_FILE_SIZE)
    ).test("fileType", "Unsupported format", (file) => !file || typeof file === "string" ||
      (file instanceof File && SUPPORTED_FORMATS.includes(file.type))
    ),
    status: yup.boolean().required(),
  })
  .required();

type FormData = yup.InferType<typeof schema>;

export default function CategoriesManagement() {
  // Infinite scroll & categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [totalCategories, setTotalCategories] = useState(0);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isFetchingRef = useRef(false);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Modals & form state
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [previewPrimary, setPreviewPrimary] = useState<string | null>(null);
  const [previewSecondary, setPreviewSecondary] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);

  const { showLoader, hideLoader } = useLoader();
  const router = useRouter();

  const config = useMemo(
    () => ({
      uploader: { insertImageAsBase64URI: true },
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
    formState: { errors },
  } = useForm<any>({
    resolver: yupResolver(schema),
    defaultValues: { status: true },
  });

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

  // Fetch Categories
  const loadCategories = async (pageNum: number, search: string = "", isAppend: boolean = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isAppend) {
      setIsLoadingMore(true);
    } else {
      setIsLoadingInitial(true);
      if (search) setIsSearching(true);
    }

    try {
      const res = await getCategories({
        page: pageNum,
        limit: PAGE_SIZE,
        search: search || undefined,
        paginate: true,
      });

      let list: Category[] = [];
      let paginationData: any = null;

      if (res && res.data && Array.isArray(res.data.categories)) {
        list = res.data.categories;
        paginationData = res.data.pagination;
      } else if (res && Array.isArray(res.categories)) {
        list = res.categories;
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

      setTotalCategories(total);
      setHasNextPage(hasNext);
      setPage(pageNum);

      if (isAppend) {
        setCategories((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const newUnique = list.filter((c) => !existingIds.has(c.id));
          return [...prev, ...newUnique];
        });
      } else {
        setCategories(list);
      }
    } catch {
      setErrorMessage("Failed to load categories");
      if (!isAppend) setCategories([]);
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
    loadCategories(1, debouncedSearchQuery, false);
  }, [debouncedSearchQuery]);

  // Load next page on scroll
  const loadNextPage = useCallback(() => {
    if (!hasNextPage || isLoadingMore || isLoadingInitial || isFetchingRef.current) return;
    loadCategories(page + 1, debouncedSearchQuery, true);
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

  const openModal = (category: Category | null = null) => {
    setSelectedCategory(category);

    if (category) {
      setValue("name", category.name);
      setValue("description", category.description ?? "");
      setValue("link", category.link ?? "");
      setValue("hsn", (category as any).hsn ?? "");
      setValue("cgst", (category as any).cgst !== null && (category as any).cgst !== undefined ? (category as any).cgst : "");
      setValue("sgst", (category as any).sgst !== null && (category as any).sgst !== undefined ? (category as any).sgst : "");
      setValue("igst", (category as any).igst !== null && (category as any).igst !== undefined ? (category as any).igst : "");
      setValue("status", Boolean(category.status));

      const normalize = (path?: string | null) =>
        path ? path.replace(/\\/g, "/") : null;

      const secImg = category.secondary_image || (category as any).secondaryImage;
      setPreviewPrimary(normalize(category.image));
      setPreviewSecondary(normalize(secImg));
      if (category.image) setValue("image", category.image);
      if (secImg) setValue("secondary_image", secImg);
    } else {
      reset({ status: true, name: "", description: "", link: "", hsn: "", cgst: "", sgst: "", igst: "" });
      setPreviewPrimary(null);
      setPreviewSecondary(null);
    }
    setIsModalOpen(true);
  };

  const onSubmit = async (data: FormData) => {
    showLoader();
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      if (selectedCategory) {
        const res = await updateCategory(selectedCategory.id.toString(), data as any);
        const updated = (res as any)?.category || (res as any)?.data || { ...selectedCategory, ...data };
        setCategories((prev) =>
          prev.map((c) => (c.id === selectedCategory.id ? { ...c, ...updated } : c))
        );
        setSuccessMessage("Category updated successfully!");
      } else {
        const res = await createCategory(data as any);
        const created = (res as any)?.category || (res as any)?.data;
        if (created) {
          setCategories((prev) => [created, ...prev]);
          setTotalCategories((prev) => prev + 1);
        } else {
          await loadCategories(1, debouncedSearchQuery, false);
        }
        setSuccessMessage("Category created successfully!");
      }
      reset();
      setPreviewPrimary(null);
      setPreviewSecondary(null);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(getErrorMessage(err, selectedCategory ? "Failed to update category" : "Failed to create category"));
    } finally {
      hideLoader();
    }
  };

  const confirmDelete = (category: Category) => {
    setCategoryToDelete(category);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    showLoader();
    try {
      await deleteCategory(categoryToDelete.id.toString());
      setCategories((prev) => prev.filter((c) => c.id !== categoryToDelete.id));
      setTotalCategories((prev) => Math.max(0, prev - 1));
      setSuccessMessage("Category deleted successfully!");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(getErrorMessage(err, "Failed to delete category"));
    } finally {
      hideLoader();
      setIsDeleteModalOpen(false);
      setCategoryToDelete(null);
    }
  };

  const handleStatusToggle = async (category: Category) => {
    try {
      await toggleCategoryStatus(category.id);
      setCategories((prev) =>
        prev.map((c) => c.id === category.id ? { ...c, status: !c.status } : c)
      );
      setSuccessMessage("Status updated successfully!");
    } catch (err: any) {
      setErrorMessage(getErrorMessage(err, "Failed to toggle status."));
    }
  };

  const openDescriptionModal = (category: Category | null = null) => {
    setSelectedCategory(category);
    if (category) {
      setIsDescriptionModalOpen(true);
    }
  };

  const onDetail = (category: Category) => {
    const slug = getCategorySlug(category);
    router.push(`/dashboard/categories/sub-categories/${slug}`);
  };

  return (
    <ProtectedRoute role="Admin">
      <div className="p-3 md:p-6">
        {errorMessage && (
          <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />
        )}
        {successMessage && (
          <SuccessMessage
            message={successMessage}
            onClose={() => setSuccessMessage(null)}
          />
        )}

        {/* Header */}
        <div className="mb-4 md:mb-6 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-xl shadow-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 md:px-6 py-3.5 md:py-4">

            {/* Title & Count */}
            <div className="flex items-center gap-3">
              <h2 className="text-lg md:text-xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">
                Categories
              </h2>
              {totalCategories > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {categories.length} of {totalCategories}
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
                  placeholder="Search categories..."
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

              {/* Create Category Button */}
              <button
                onClick={() => openModal(null)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 md:py-2.5 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] rounded-xl shadow-md text-white font-semibold text-xs md:text-sm hover:shadow-lg transition-all duration-200 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Category</span>
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
                  <th className="px-6 py-4">Primary Image</th>
                  <th className="px-6 py-4">Secondary Image</th>
                  <th className="px-6 py-4">Link</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-end">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-700">
                {isLoadingInitial && categories.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-[#007FFF]" />
                        <span className="text-sm font-medium text-gray-500">Loading categories...</span>
                      </div>
                    </td>
                  </tr>
                ) : categories.length ? (
                  categories.map((category, index) => {
                    const image = getImageUrl(category.image);
                    const secondary_image = getImageUrl(category.secondary_image || (category as any).secondaryImage);
                    return (
                      <tr key={category.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4 font-semibold text-gray-500">{index + 1}</td>
                        <td className="px-6 py-4 max-w-[200px] break-all whitespace-normal font-semibold text-gray-900">{category.name}</td>
                        <td className="px-6 py-4">
                          {image ? (
                            <Image
                              src={image}
                              alt={category.name}
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
                              alt={category.name}
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
                          {category.link ? (
                            <a
                              href={category.link}
                              className="text-[#007FFF] hover:text-blue-700 underline truncate max-w-[160px] inline-block font-medium"
                              title={category.link}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {category.link}
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            className="px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold transition cursor-pointer"
                            onClick={() => openDescriptionModal(category)}
                          >
                            View Description
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleStatusToggle(category)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors cursor-pointer ${category.status ? "bg-green-500" : "bg-red-500"
                              }`}
                            title="Toggle Status"
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${category.status ? "translate-x-5" : "translate-x-0"
                                }`}
                            />
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              title="View Subcategories"
                              onClick={() => onDetail(category)}
                              className="size-10 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full flex items-center justify-center transition cursor-pointer"
                            >
                              <TiInfoLargeOutline className="h-5 w-5" />
                            </button>
                            <button
                              title="Edit Category"
                              onClick={() => openModal(category)}
                              className="size-10 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full flex items-center justify-center transition cursor-pointer"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              title="Delete Category"
                              onClick={() => confirmDelete(category)}
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
                      colSpan={8}
                      className="text-center text-gray-400 py-12 italic"
                    >
                      No Categories Found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cards - Mobile */}
        <div className="md:hidden space-y-4">
          {isLoadingInitial && categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-md border border-gray-200">
              <Loader2 className="w-8 h-8 animate-spin text-[#007FFF] mb-2" />
              <span className="text-sm font-medium text-gray-500">Loading categories...</span>
            </div>
          ) : categories.length ? (
            categories.map((category, index) => {
              const image = getImageUrl(category.image);
              const secondary_image = getImageUrl(category.secondary_image || (category as any).secondaryImage);
              return (
                <div
                  key={category.id}
                  className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-gray-900 text-base">{category.name}</h3>
                        <button
                          onClick={() => handleStatusToggle(category)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors cursor-pointer ${category.status ? "bg-green-500" : "bg-red-500"
                            }`}
                          title="Toggle Status"
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${category.status ? "translate-x-5" : "translate-x-0"
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
                        alt={category.name}
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
                        alt={category.name}
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
                      onClick={() => openDescriptionModal(category)}
                    >
                      View Description
                    </button>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      title="View Subcategories"
                      onClick={() => onDetail(category)}
                      className="flex-1 py-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-sm cursor-pointer"
                    >
                      <TiInfoLargeOutline className="h-4 w-4" />
                      Subcategories
                    </button>
                    <button
                      title="Edit Category"
                      onClick={() => openModal(category)}
                      className="flex-1 py-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center gap-1.5 transition font-medium text-sm cursor-pointer"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      title="Delete Category"
                      onClick={() => confirmDelete(category)}
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
              <p className="text-gray-400 italic">No Categories Found</p>
            </div>
          )}
        </div>

        {/* Bottom Sentinel for Infinite Scroll */}
        <div ref={bottomSentinelRef} className="h-6 w-full pointer-events-none" />

        {/* Infinite Scroll Bottom Loading State */}
        {isLoadingMore && (
          <div className="flex items-center justify-center gap-2.5 py-6 text-sm text-gray-600 animate-in fade-in duration-200">
            <Loader2 className="w-5 h-5 animate-spin text-[#007FFF]" />
            <span className="font-semibold text-gray-700">Loading more categories...</span>
          </div>
        )}

        {/* All Categories Loaded End Indicator */}
        {!hasNextPage && categories.length > 0 && !isLoadingInitial && (
          <div className="flex items-center justify-center py-6 text-xs md:text-sm text-gray-400 font-medium animate-in fade-in duration-200">
            <span className="bg-gray-100/90 px-4 py-1.5 rounded-full border border-gray-200 text-gray-600 font-semibold shadow-xs flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>All {categories.length} categories loaded</span>
            </span>
          </div>
        )}

        {/* Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            reset({ name: "", description: "", link: "", hsn: "", cgst: "", sgst: "", igst: "", status: true });
            setPreviewPrimary(null);
            setPreviewSecondary(null);
            setSelectedCategory(null);
          }}
          title={selectedCategory ? "Edit Category" : "Add Category"}
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
                placeholder="Enter Category Name"
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
              <div className="flex items-center gap-2">
                <span className="text-xs md:text-sm font-bold text-gray-900">Tax & GST Configuration</span>
                <span className="text-red-500 font-bold text-sm">*</span>
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
                {selectedCategory ? "Update Category" : "Save Category"}
              </button>
            </div>
          </form>
        </Modal>

        {/* Description Modal */}
        <Modal
          isOpen={isDescriptionModalOpen}
          onClose={() => setIsDescriptionModalOpen(false)}
          width="max-w-3xl"
          title="Category Description"
        >
          <div
            className="p-4 text-gray-700 prose max-w-none"
            dangerouslySetInnerHTML={{
              __html: selectedCategory?.description || "<p>No Description</p>",
            }}
          />
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          width="max-w-md"
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setCategoryToDelete(null);
          }}
          title="Confirm Delete"
        >
          <div className="p-4">
            <p className="text-gray-700">
              Are you sure you want to delete <strong>{categoryToDelete?.name}</strong>?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setCategoryToDelete(null);
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
