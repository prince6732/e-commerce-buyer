"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  X,
  Check,
  Folder,
  FolderPlus,
  FolderOpen,
  Layers,
  Search,
  Plus,
  ArrowRight,
  Loader2,
  Sparkles,
  ChevronRight,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useAddProductModal } from "@/context/AddProductModalContext";
import { getCategories, getCategoryByIdForProduct } from "../../../utils/category";
import { getSubcategories } from "../../../utils/subcategory";
import { getImageUrl } from "../../../utils/imageUtils";
import { clearEditProductId } from "../../../utils/product";
import { getCategorySlug } from "../../../utils/slugUtils";

interface CategoryItem {
  id: string | number;
  name: string;
  description?: string | null;
  image?: string | null;
  secondary_image?: string | null;
  status?: boolean;
  attributes?: any[];
}

interface SubcategoryItem {
  id: string | number;
  name: string;
  description?: string | null;
  image?: string | null;
  secondary_image?: string | null;
  status?: boolean;
  attributes?: any[];
  parentId?: number | string | null;
  parent_id?: number | string | null;
}

export default function AddProductSelectionModal() {
  const { isOpen, closeAddProductModal } = useAddProductModal();
  const router = useRouter();

  // Selection states
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryItem | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<SubcategoryItem | null>(null);

  // Loading states
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingSubcategories, setIsLoadingSubcategories] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search filters
  const [categorySearch, setCategorySearch] = useState("");
  const [subcategorySearch, setSubcategorySearch] = useState("");

  // Load categories when modal opens
  useEffect(() => {
    if (isOpen) {
      loadCategoriesList();
      setSelectedCategory(null);
      setSelectedSubcategory(null);
      setCategorySearch("");
      setSubcategorySearch("");
      setErrorMsg(null);
      setIsNavigating(false);
    }
  }, [isOpen]);

  // Load subcategories when selectedCategory changes
  useEffect(() => {
    if (selectedCategory) {
      loadSubcategoriesList(selectedCategory.id);
    } else {
      setSubcategories([]);
      setSelectedSubcategory(null);
    }
  }, [selectedCategory]);

  const loadCategoriesList = async () => {
    setIsLoadingCategories(true);
    setErrorMsg(null);
    try {
      const data = await getCategories();
      const list: CategoryItem[] = data || [];
      setCategories(list);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to load categories. Please try again.");
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const loadSubcategoriesList = async (parentId: string | number) => {
    setIsLoadingSubcategories(true);
    setSelectedSubcategory(null);
    try {
      const res = await getSubcategories(String(parentId));
      const subList: SubcategoryItem[] = res.subcategories || [];
      setSubcategories(subList);
    } catch (err: any) {
      console.error(err);
      setSubcategories([]);
    } finally {
      setIsLoadingSubcategories(false);
    }
  };

  // Filtered categories
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    return categories.filter((c) =>
      c.name.toLowerCase().includes(categorySearch.toLowerCase().trim())
    );
  }, [categories, categorySearch]);

  // Filtered subcategories
  const filteredSubcategories = useMemo(() => {
    if (!subcategorySearch.trim()) return subcategories;
    return subcategories.filter((s) =>
      s.name.toLowerCase().includes(subcategorySearch.toLowerCase().trim())
    );
  }, [subcategories, subcategorySearch]);

  // Navigate to Categories page
  const handleGoToCategories = () => {
    closeAddProductModal();
    router.push("/dashboard/categories");
  };

  // Navigate to Subcategories page for the selected category
  const handleGoToSubcategories = () => {
    if (!selectedCategory) return;
    closeAddProductModal();
    router.push(`/dashboard/categories/sub-categories/${getCategorySlug(selectedCategory)}`);
  };

  // Handle Continue / Add Product
  const handleContinue = async () => {
    if (!selectedSubcategory) return;

    clearEditProductId();
    setIsNavigating(true);
    setErrorMsg(null);

    const targetCatId = selectedSubcategory.id;

    try {
      // Fetch full details with attributes for the selected subcategory
      const res = await getCategoryByIdForProduct(String(selectedSubcategory.id));
      const categoryData = res?.result;
      const attributes = categoryData?.attributes || [];
      const attrCount = attributes.length;

      closeAddProductModal();

      if (attrCount === 0) {
        router.push(
          `/dashboard/categories/${targetCatId}/products/add-single-variant`
        );
      } else if (attrCount === 1) {
        router.push(
          `/dashboard/categories/${targetCatId}/products/add-single-attribute-product`
        );
      } else {
        router.push(
          `/dashboard/categories/${targetCatId}/products/add-multi-variant`
        );
      }
    } catch (err: any) {
      console.error("Error resolving subcategory attributes:", err);
      // Fallback check on subcategory's local attributes array
      const localAttrs = selectedSubcategory.attributes || [];
      const count = localAttrs.length;

      closeAddProductModal();

      if (count === 0) {
        router.push(
          `/dashboard/categories/${targetCatId}/products/add-single-variant`
        );
      } else if (count === 1) {
        router.push(
          `/dashboard/categories/${targetCatId}/products/add-single-attribute-product`
        );
      } else {
        router.push(
          `/dashboard/categories/${targetCatId}/products/add-multi-variant`
        );
      }
    } finally {
      setIsNavigating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={closeAddProductModal}
      />

      {/* Main Modal Container */}
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/80 via-white to-blue-50/30">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#007FFF] flex items-center justify-center font-bold shadow-xs">
                <Plus className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                Add Product
              </h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 bg-blue-50 text-[#007FFF] border border-blue-200/60 rounded-full">
                Step 1 of 2
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Select where you want to add the product
            </p>
          </div>

          <button
            onClick={closeAddProductModal}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
            aria-label="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Banner if any */}
        {errorMsg && (
          <div className="mx-6 mt-3 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ── Two-Panel Body ── */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 overflow-hidden h-[460px] sm:h-[500px] max-h-[62vh] min-h-0">
          {/* ──── Left Panel: Categories ──── */}
          <div className="flex flex-col h-full min-h-0 bg-white overflow-hidden">
            {/* Panel Header & Search */}
            <div className="p-3.5 sm:p-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-gray-600" />
                  <span className="text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wider">
                    Categories
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-gray-200/80 text-gray-700 rounded-full">
                    {categories.length}
                  </span>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 text-xs sm:text-sm rounded-xl border border-gray-200 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all"
                />
                {categorySearch && (
                  <button
                    onClick={() => setCategorySearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Category List Scroll Area */}
            <div className="flex-1 p-3 overflow-y-auto space-y-1.5 min-h-0 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-50 [&::-webkit-scrollbar-thumb]:bg-gray-300 hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 [&::-webkit-scrollbar-thumb]:rounded-full [scrollbar-width:thin]">
              {isLoadingCategories ? (
                <div className="space-y-2 py-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-12 rounded-xl bg-gray-100 animate-pulse"
                    />
                  ))}
                </div>
              ) : categories.length === 0 ? (
                /* No Categories Exist */
                <div className="h-full flex flex-col items-center justify-center text-center p-6 my-auto">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                    <FolderPlus className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">
                    No categories found
                  </h3>
                  <p className="text-xs text-gray-500 max-w-[240px] mb-4 leading-relaxed">
                    No category exist. Please create a category to continue.
                  </p>
                  <button
                    type="button"
                    onClick={handleGoToCategories}
                    className="px-4 py-2 rounded-xl bg-[#007FFF] hover:bg-[#0066CC] text-white text-xs font-semibold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Go to Categories</span>
                  </button>
                </div>
              ) : filteredCategories.length === 0 ? (
                /* Search Filter Empty State */
                <div className="py-8 text-center text-xs text-gray-400">
                  No category matching &quot;{categorySearch}&quot;
                </div>
              ) : (
                /* Categories Render */
                filteredCategories.map((cat) => {
                  const isSelected = selectedCategory?.id === cat.id;
                  const imgUrl = cat.image ? getImageUrl(cat.image) : null;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat);
                        setSubcategorySearch("");
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-all duration-150 flex items-center justify-between group cursor-pointer ${isSelected
                          ? "bg-blue-50/90 border-blue-400 text-[#007FFF] shadow-xs ring-1 ring-blue-400/20"
                          : "bg-white border-gray-100 hover:bg-gray-50/80 hover:border-gray-200 text-gray-800"
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={cat.name}
                            className="w-8 h-8 rounded-lg object-cover border border-gray-200 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected
                                ? "bg-blue-100 text-[#007FFF]"
                                : "bg-gray-100 text-gray-500 group-hover:bg-gray-200"
                              }`}
                          >
                            <Folder className="w-4 h-4" />
                          </div>
                        )}
                        <span
                          className={`text-xs sm:text-sm font-semibold truncate ${isSelected ? "text-blue-950" : "text-gray-800"
                            }`}
                        >
                          {cat.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-[#007FFF] text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-transform group-hover:translate-x-0.5" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ──── Right Panel: Subcategories ──── */}
          <div className="flex flex-col h-full min-h-0 bg-white overflow-hidden">
            {/* Panel Header & Search */}
            <div className="p-3.5 sm:p-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-gray-600" />
                  <span className="text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wider">
                    Subcategories
                  </span>
                  {selectedCategory && !isLoadingSubcategories && (
                    <span className="text-xs font-semibold px-2 py-0.5 bg-gray-200/80 text-gray-700 rounded-full">
                      {subcategories.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder={
                    selectedCategory
                      ? "Search subcategories..."
                      : "Select a category first..."
                  }
                  disabled={!selectedCategory}
                  value={subcategorySearch}
                  onChange={(e) => setSubcategorySearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 text-xs sm:text-sm rounded-xl border border-gray-200 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all"
                />
                {subcategorySearch && (
                  <button
                    onClick={() => setSubcategorySearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Subcategory List Scroll Area */}
            <div className="flex-1 p-3 overflow-y-auto space-y-1.5 min-h-0 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-50 [&::-webkit-scrollbar-thumb]:bg-gray-300 hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 [&::-webkit-scrollbar-thumb]:rounded-full [scrollbar-width:thin]">
              {!selectedCategory ? (
                /* No Category Selected State */
                <div className="h-full flex flex-col items-center justify-center text-center p-6 my-auto">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#007FFF] flex items-center justify-center mb-3">
                    <FolderOpen className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">
                    Select a category
                  </h3>
                  <p className="text-xs text-gray-500 max-w-[220px]">
                    Select a category to view its subcategories.
                  </p>
                </div>
              ) : isLoadingSubcategories ? (
                /* Loading Subcategories */
                <div className="space-y-2 py-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-12 rounded-xl bg-gray-100 animate-pulse"
                    />
                  ))}
                </div>
              ) : subcategories.length === 0 ? (
                /* Selected Category has NO Subcategories */
                <div className="h-full flex flex-col items-center justify-center text-center p-6 my-auto">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">
                    No subcategories found
                  </h3>
                  <p className="text-xs text-gray-500 max-w-[260px] mb-4 leading-relaxed">
                    This category does not have any subcategories yet. Please create a subcategory to continue.
                  </p>
                  <button
                    type="button"
                    onClick={handleGoToSubcategories}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] text-white text-xs font-semibold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Go to Subcategories</span>
                  </button>
                </div>
              ) : filteredSubcategories.length === 0 ? (
                /* Search Filter Empty State */
                <div className="py-8 text-center text-xs text-gray-400">
                  No subcategory matching &quot;{subcategorySearch}&quot;
                </div>
              ) : (
                /* Subcategories Render */
                filteredSubcategories.map((sub) => {
                  const isSelected = selectedSubcategory?.id === sub.id;
                  const imgUrl = sub.image ? getImageUrl(sub.image) : null;
                  const attrList = sub.attributes || [];
                  const attrCount = attrList.length;

                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSelectedSubcategory(sub)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-all duration-150 flex items-center justify-between group cursor-pointer ${isSelected
                          ? "bg-blue-50/90 border-blue-400 text-[#007FFF] shadow-xs ring-1 ring-blue-400/20"
                          : "bg-white border-gray-100 hover:bg-gray-50/80 hover:border-gray-200 text-gray-800"
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={sub.name}
                            className="w-8 h-8 rounded-lg object-cover border border-gray-200 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected
                                ? "bg-blue-100 text-[#007FFF]"
                                : "bg-gray-100 text-gray-500 group-hover:bg-gray-200"
                              }`}
                          >
                            <Layers className="w-4 h-4" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <p
                            className={`text-xs sm:text-sm font-semibold truncate ${isSelected ? "text-blue-950" : "text-gray-800"
                              }`}
                          >
                            {sub.name}
                          </p>
                          {/* Attribute Type Badge preview */}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {attrCount === 0 ? (
                              <span className="text-[10px] font-medium text-gray-400">
                                Single Variant (0 attributes)
                              </span>
                            ) : attrCount === 1 ? (
                              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded">
                                1 Attribute: {attrList[0]?.name || "Variant"}
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.2 rounded">
                                {attrCount} Attributes (Multi-Variant)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-[#007FFF] text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-gray-300 group-hover:border-gray-400" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Modal Footer ── */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-gray-100 bg-gray-50/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Selected Path Breadcrumb */}
          <div className="text-xs text-gray-600 flex items-center gap-1.5 truncate max-w-full">
            <span className="font-semibold text-gray-500">Target:</span>
            {selectedCategory ? (
              <span className="font-bold text-gray-900 bg-white px-2 py-0.5 rounded-md border border-gray-200 truncate">
                {selectedCategory.name}
              </span>
            ) : (
              <span className="text-gray-400 italic">No category selected</span>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            {selectedSubcategory ? (
              <span className="font-bold text-[#007FFF] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md truncate">
                {selectedSubcategory.name}
              </span>
            ) : (
              <span className="text-gray-400 italic">
                No subcategory selected
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={closeAddProductModal}
              disabled={isNavigating}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-200/70 transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleContinue}
              disabled={!selectedCategory || !selectedSubcategory || isNavigating}
              className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] text-white text-xs sm:text-sm font-semibold shadow-xs hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isNavigating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Opening Form...</span>
                </>
              ) : (
                <>
                  <span>Continue / Add Product</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}












