"use client";

import { useEffect, useMemo, useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup/dist/yup.js";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import * as yup from "yup";
import dynamic from "next/dynamic";

const JoditEditor = dynamic(() => import("jodit-react"), { ssr: false });
import {
    ApiResponse,
    Brand,
    Category,
    CategoryAttribute,
    Product
} from "@/common/interface";
import { useLoader } from "@/context/LoaderContext";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FaArrowLeft } from "react-icons/fa";
import { getCategoryByIdForProduct } from "../../../../../../../../utils/category";
import { fetchBrands } from "../../../../../../../../utils/brand";
import { createProduct, getProductById, updateProduct, setEditProductId, getEditProductId, clearEditProductId } from "../../../../../../../../utils/product";
import ImageCropperModal from "@/components/(frontend)/ImageCropperModal";
import { X } from "lucide-react";

const variant = yup.object({
    id: yup.mixed().nullable().optional(),
    has_images: yup.boolean(),
    title: yup.string().required('title is required'),
    attributeValue: yup.string().required("Attribute Value 1 is required"),
    sku: yup.string().required("SKU is required"),
    mrp: yup
        .number()
        .typeError("MRP must be a number")
        .required("MRP is required")
        .positive("MRP must be greater than 0")
        .max(9999999.99, "MRP exceeds limit"),
    sp: yup
        .number()
        .typeError("Selling Price (BP) must be a number")
        .required("Base Price / Selling Price (BP) is required")
        .positive("Selling Price (BP) must be greater than 0")
        .max(9999999.99, "Selling Price (BP) exceeds limit")
        .test("sp-less-mrp", "Selling Price (BP) cannot be greater than MRP", function (value) {
            const { mrp } = this.parent;
            return !mrp || !value || value <= mrp;
        }),
    bp: yup
        .number()
        .typeError("Buying Price must be a number")
        .required("Buying Price is required")
        .positive("Buying Price must be greater than 0")
        .max(9999999.99, "Buying Price exceeds limit"),
    stock: yup
        .number()
        .typeError("Stock value must be a number")
        .required("Stock is required")
        .min(0, "Stock must be greater than or equal to 0")
        .max(100000, "Stock exceeds limit"),
    status: yup.boolean().default(true),
    imageUrl: yup.string().when('has_images', {
        is: (has_images: any) => Boolean(has_images),
        then: (schema) => schema.required("Primary image is required"),
        otherwise: (schema) => schema.notRequired(),
    }),
    imageJson: yup.array().of(yup.string()),
});

const schema = yup.object({
    attributeOneHasImages: yup.boolean(),
    attributeTwoHasImages: yup.boolean(),
    name: yup.string().required("Name is required").min(2),
    categoryId: yup.string().required("Category is required"),
    itemCode: yup.string().nullable(),
    brandId: yup.string().required("Brand is required"),
    detailJson: yup.array(
        yup.object({
            key: yup.string().required("Detail Key is required"),
            value: yup.string().required("Detail Value is required"),
        })
    ),
    featureJson: yup.array(
        yup.object({
            value: yup.string().required("Feature is required"),
        })
    ),
    description: yup.string(),
    image_url: yup.string().when(['attributeOneHasImages', 'attributeTwoHasImages'], {
        is: (attributeOneHasImages: any, attributeTwoHasImages: any) => !Boolean(attributeOneHasImages) && !Boolean(attributeTwoHasImages),
        then: (schema) => schema.required("Primary image is required"),
        otherwise: (schema) => schema.notRequired(),
    }),
    imageJson: yup.array().of(yup.string()),
    variants: yup.array().of(variant).min(1, "At least one variant is required"),
    status: yup.boolean().default(true),
});


type FormData = yup.InferType<typeof schema>;

const uploadUrl = process.env.NEXT_PUBLIC_UPLOAD_BASE ?? "https://api.zelton.co.in";

function VariantProductForm() {
    const [preview, setPreview] = useState<string | null>(null);
    const [multiPreview, setMultiPreview] = useState<string[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [attributes, setAttributes] = useState<CategoryAttribute[]>([]);
    const [variantHasImages, setVariantHasImages] = useState<boolean>(false);
    const { showLoader, hideLoader } = useLoader();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState<"success" | "error" | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const [productId, setProductId] = useState<string | null>(null);
    const categoryId = (params?.slug || params?.id || "") as string;

    useEffect(() => {
        const idFromStorage = getEditProductId();
        const idFromQuery = searchParams?.get("productId");
        const effectiveId = idFromStorage || idFromQuery;
        if (effectiveId) {
            setProductId(effectiveId);
            setEditProductId(effectiveId);
            if (idFromQuery) {
                const url = new URL(window.location.href);
                url.searchParams.delete("productId");
                window.history.replaceState({}, "", url.toString());
            }
        }
    }, [searchParams]);

    const config = useMemo(
        () => ({
            "uploader": {
                "insertImageAsBase64URI": true
            },
            showPlaceholder: false,
            readonly: false,
            buttons: "bold,italic,underline,ul,ol,link,undo,redo",
            toolbarAdaptive: true,
            toolbarSticky: false,
            buttonsMD: "bold,italic,underline,ul,ol,link",
            buttonsSM: "bold,italic,ul,ol",
            buttonsXS: "bold,italic,ul",
            askBeforePasteHTML: false,
            askBeforePasteFromWord: false,
            defaultActionOnPaste: 'insert_clear_html' as any,
            style: {
                minHeight: "100px",
                fontSize: "14px"
            }
        }),
        []
    );

    const {
        register,
        handleSubmit,
        setValue,
        control,
        formState: { errors },
        watch
    } = useForm<any>({
        resolver: yupResolver(schema),
        defaultValues: {
            description: "",
            featureJson: [],
            imageJson: [],
            detailJson: [],
            categoryId: categoryId || "",
        },
    });

    useEffect(() => {
        const initializeForm = async () => {
            await getAllBrands();
            const categoryData = await fetchCategory();
            if (productId && categoryData) {
                await fetchProductDetails(productId, categoryData.hasImages);
            } else if (!productId && categoryData) {
                const currentVariants = watch("variants");
                if (!currentVariants || currentVariants.length === 0) {
                    appendVariant({
                        title: "",
                        attributeValue: "",
                        sku: "",
                        mrp: 0,
                        bp: 0,
                        sp: 0,
                        stock: 0,
                        status: true,
                        imageUrl: "",
                        imageJson: [],
                        has_images: categoryData.hasImages,
                    });
                }
            }
        };

        initializeForm();
    }, [productId]);

    const fetchProductDetails = async (id: string, hasImages: boolean = false) => {
        showLoader();
        try {
            const res = await getProductById(id);
            if (res.success && res.result) {
                const product = res.result;
                setValue("name", product.name);
                setValue("description", product.description);
                setValue("itemCode", product.item_code);
                if (product.category_id || product.categoryId) {
                    setValue("categoryId", String(product.category_id ?? product.categoryId));
                }
                const bId = String(product.brandId ?? product.brand_id ?? product.brand?.id ?? "");
                if (bId) {
                    setValue("brandId", bId);
                } else if (brands && brands.length > 0) {
                    setValue("brandId", String(brands[0].id));
                }

                setValue("status", Boolean(product.status));
                setValue("image_url", product.image_url || "");
                setValue("detailJson", product.detail_json ? JSON.parse(product.detail_json) : []);
                setValue("featureJson", product.feature_json ? JSON.parse(product.feature_json).map((v: string) => ({ value: v })) : []);
                setValue("imageJson", product.image_json ? JSON.parse(product.image_json) : []);

                if (product.variants && product.variants.length > 0) {
                    const prodAttrVals = product.productAttributeValues ?? product.product_attribute_values ?? [];
                    setValue("variants", product.variants.map((v: any, index: number) => {
                        let attrValId = v.attribute_values?.[0]?.id ??
                            v.variantAttributeValues?.[0]?.attributeValueId ??
                            v.variant_attribute_values?.[0]?.attribute_value_id;

                        if (!attrValId && prodAttrVals.length > 0) {
                            const matched = prodAttrVals.find((pav: any) => {
                                const valName = pav.attributeValue?.value ?? pav.attribute_value?.value;
                                return valName && v.title?.toLowerCase().includes(valName.toLowerCase());
                            });
                            if (matched) {
                                attrValId = matched.attributeValueId ?? matched.attribute_value_id ?? matched.attributeValue?.id;
                            }
                        }

                        if (!attrValId && prodAttrVals[index]) {
                            attrValId = prodAttrVals[index].attributeValueId ?? prodAttrVals[index].attribute_value_id ?? prodAttrVals[index].attributeValue?.id;
                        }

                        return {
                            id: v.id,
                            title: v.title,
                            attributeValue: attrValId ? String(attrValId) : "",
                            sku: v.sku,
                            mrp: v.mrp,
                            sp: v.sp,
                            bp: v.bp,
                            stock: v.stock,
                            status: Boolean(v.status),
                            imageUrl: v.image_url || v.imageUrl,
                            imageJson: v.image_json ? (typeof v.image_json === 'string' ? JSON.parse(v.image_json) : v.image_json) : (v.imageJson ? (typeof v.imageJson === 'string' ? JSON.parse(v.imageJson) : v.imageJson) : []),
                            has_images: hasImages,
                        };
                    }));
                }

                setPreview(product.image_url || null);
                setMultiPreview(product.image_json ? JSON.parse(product.image_json) : []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            hideLoader();
        }
    };

    const checkAttrHasImages = (attr: any): boolean => {
        if (!attr) return false;
        const val =
            attr.pivot?.has_images ??
            attr.pivot?.hasImages ??
            attr.pivot?.HasImages ??
            attr.has_images ??
            attr.hasImages ??
            attr.HasImages;
        return val === true || val === 1 || val === "1" || val === "true";
    };

    const fetchCategory = async () => {
        showLoader();
        try {
            const data = await getCategoryByIdForProduct(categoryId!);
            const categoryData = data.result;

            if (!categoryData) return null;

            if (categoryData.id) {
                setValue("categoryId", String(categoryData.id));
            }

            setAttributes(categoryData.attributes || []);
            const attributeHasImages = categoryData.attributes?.some(
                (attr: any) => checkAttrHasImages(attr)
            ) || false;

            setVariantHasImages(attributeHasImages);

            if (categoryData.attributes && categoryData.attributes.length > 0) {
                const firstAttr = categoryData.attributes[0];
                const firstHasImages = checkAttrHasImages(firstAttr);
                setValue("attributeOneHasImages", firstHasImages);

                if (categoryData.attributes.length > 1) {
                    const secondAttr = categoryData.attributes[1];
                    const secondHasImages = checkAttrHasImages(secondAttr);
                    setValue("attributeTwoHasImages", secondHasImages);
                } else {
                    setValue("attributeTwoHasImages", false);
                }
            } else {
                setValue("attributeOneHasImages", false);
                setValue("attributeTwoHasImages", false);
            }

            return { hasImages: attributeHasImages };
        } catch (err) {
            console.error(err);
            setErrorMessage("Failed to load category attributes");
            return null;
        } finally {
            hideLoader();
        }
    };

    const getAllBrands = async () => {
        showLoader();
        try {
            const data = await fetchBrands({ status: "active" });
            const list: Brand[] = Array.isArray(data) ? data : (data?.brands || data?.data?.brands || []);
            const activeBrands = list.filter((brand: Brand) => Boolean(brand.status));
            setBrands(activeBrands);
            const currentBId = watch("brandId");
            if ((!currentBId || currentBId === "") && activeBrands.length > 0) {
                setValue("brandId", String(activeBrands[0].id));
            }
        } catch (err) {
            console.error(err);
            setErrorMessage("Failed to load brands");
        } finally {
            hideLoader();
        }
    };

    const { fields: featureFields, append: featureAppend, remove: featureRemove } = useFieldArray({
        control,
        name: "featureJson",
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "detailJson",
    });

    const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({
        control,
        name: "variants",
    });

    const onSubmit = async (data: FormData) => {
        const formattedVariants = (data.variants ?? []).map((v: any) => {
            const formatted: any = {
                title: v.title,
                sku: v.sku,
                mrp: v.mrp,
                sp: v.sp,
                bp: v.bp,
                stock: v.stock,
                status: v.status,
                has_images: v.has_images,
                image_url: v.imageUrl ?? null,
                image_json: v.imageJson?.length ? JSON.stringify(v.imageJson) : null,
            };

            // Only include valid numeric attributeValues if a value is selected
            if (v.attributeValue && !isNaN(Number(v.attributeValue))) {
                formatted.attributeValues = [Number(v.attributeValue)];
            }

            // Include variant ID if updating and ID is a valid number
            if (productId && v.id && !isNaN(Number(v.id)) && typeof v.id !== 'object') {
                formatted.id = Number(v.id);
            }

            return formatted;
        });

        const payload = {
            name: data.name,
            description: data.description,
            itemCode: data.itemCode,
            item_code: data.itemCode,
            category_id: data.categoryId,
            categoryId: data.categoryId,
            brand_id: data.brandId ? Number(data.brandId) : null,
            brandId: data.brandId ? Number(data.brandId) : null,
            status: data.status ?? true,
            detailList: data.detailJson || [],
            detail_json: JSON.stringify(data.detailJson || []),
            featureList: data.featureJson?.map(feature => feature.value) || [],
            feature_json: JSON.stringify(data.featureJson?.map(feature => feature.value) || []),
            image_url: data.image_url ?? null,
            imageUrl: data.image_url ?? null,
            imageList: data.imageJson || [],
            image_json: JSON.stringify(data.imageJson || []),
            variants: formattedVariants,
        };

        try {
            let res: ApiResponse<string>;

            if (productId) {
                res = await updateProduct(productId, payload as any);
            } else {
                res = await createProduct(payload as any);
            }

            if (res.success) {
                setSuccessMessage(res.message || "Success!");
            } else {
                if (res.errors) {
                    const errorMessages = Object.values(res.errors).flat().join(' ');
                    setErrorMessage(errorMessages || res.message || "An error occurred.");
                } else {
                    setErrorMessage(res.message || "An error occurred.");
                }
            }
        } catch (err) {
            console.error("Submit error:", err);
            setErrorMessage(productId ? "Failed to update product" : "Failed to create product");
        } finally {
            hideLoader();
        }
    };

    useEffect(() => {
        if (successMessage) {
            setToastType("success");
            setToastMessage(successMessage);
            setShowToast(true);
        } else if (errorMessage) {
            setToastType("error");
            setToastMessage(errorMessage);
            setShowToast(true);
        }
    }, [successMessage, errorMessage]);

    useEffect(() => {
        if (showToast) {
            const timer = setTimeout(() => {
                setShowToast(false);
                if (successMessage) {
                    router.push(`/dashboard/categories/${categoryId}/products`);
                }
                setSuccessMessage(null);
                setErrorMessage(null);
                setToastMessage(null);
                setToastType(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [showToast]);

    const disableScrollNumberInput = (e: React.WheelEvent<HTMLInputElement>) => {
        e.currentTarget.blur(); // remove focus so scroll cannot change value
    };

    return (
        <div className="w-full mx-auto bg-white/90 relative">

            {/* header */}
            <div className="max-w-[80rem] mx-auto top-0 z-50 px-4 pt-4">
                <div className="p-5 bg-white/80 backdrop-blur border border-gray-200 rounded-2xl shadow-lg mb-5">

                    <div className="flex items-center justify-between">
                        {/* Title */}
                        <h2 className="lg:text-3xl text-xl font-bold px-5 text-gray-900 tracking-tight">
                            {productId ? "Update Product" : "Fill Product Details"}
                        </h2>
                        {/* Back Button */}
                        <button
                            type="button"
                            onClick={() => router.push(`/dashboard/categories/${categoryId}/products`)}
                            className="flex items-center gap-2 px-4 py-2 
                                    bg-gray-100 hover:bg-gray-200 
                                    text-gray-700 rounded-xl shadow-sm 
                                    hover:shadow-md transition-all duration-200"
                        >
                            <FaArrowLeft className="text-lg" />
                            <span className="font-medium">Back</span>
                        </button>
                    </div>

                </div>
            </div>

            {showToast && toastMessage && (
                <div className={`fixed top-6 right-6 z-[9999] px-6 py-4 rounded shadow-lg font-semibold transition-all
                        ${toastType === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {toastMessage}
                </div>
            )}

            <form
                id="product-form"
                onSubmit={handleSubmit(onSubmit)}
                className="max-w-[80rem] mx-auto px-3 md:px-4 pb-4"
            >
                <div className="flex flex-col gap-4 md:gap-6 lg:gap-8">
                    <div className="border border-gray-300 rounded-xl p-3 md:p-6 bg-white flex flex-col gap-4 md:gap-6 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                            {/* Name */}
                            <div>
                                <label className="block text-sm md:text-base font-semibold text-black mb-1">Name<span className="text-red-600">*</span></label>
                                <input
                                    {...register("name")}
                                    type="text"
                                    placeholder="Enter product name"
                                    className="w-full px-3 py-2 rounded-lg bg-white text-black border border-gray-300 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition"
                                />
                                <p className="text-sm text-red-500">{errors.name?.message as any}</p>
                            </div>

                            {/* Brand */}
                            <div>
                                <label className="block text-base font-semibold text-black mb-1">Brand<span className="text-red-600">*</span></label>
                                <select
                                    {...register("brandId")}
                                    className="w-full px-3 py-2 rounded-lg bg-white text-black border border-gray-300 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition"
                                >
                                    <option value="">-- Select Brand --</option>
                                    {brands.map((brand) => (
                                        <option key={brand.id} value={brand.id}>
                                            {brand.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-sm text-red-500">{errors.brandId?.message as any}</p>
                            </div>
                            {/* Item Code */}
                            <div>
                                <label className="block text-base font-semibold text-black mb-1">Item Code</label>
                                <input
                                    {...register("itemCode")}
                                    type="text"
                                    placeholder="Enter item code"
                                    className="w-full px-3 py-2 rounded-lg bg-white text-black border border-gray-300 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition"
                                />
                            </div>

                        </div>
                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Description
                            </label>
                            <Controller
                                name="description"
                                control={control}
                                defaultValue=""
                                render={({ field: { onChange, value } }) => (
                                    <JoditEditor
                                        value={value}
                                        config={config}
                                        onBlur={(newContent) => onChange(newContent)}
                                    />
                                )}
                            />
                            <p className="text-sm text-red-500">{errors.description?.message as any}</p>
                        </div>
                        {/* Product Details */}
                        <div>
                            <label className="block text-base font-semibold text-black mb-2">Product Detail</label>
                            <div className="flex flex-col gap-3">
                                {fields.map((field, index) => (
                                    <div
                                        key={field.id}
                                        className="flex flex-col sm:flex-row gap-2 rounded-xl bg-white items-start"
                                    >
                                        <span className="flex-1 w-full">
                                            <input
                                                {...register(`detailJson.${index}.key` as const)}
                                                placeholder="Key"
                                                className="w-full px-3 py-2 rounded bg-white text-black border border-gray-300 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition"
                                            />
                                            <p className="text-sm text-red-500 mt-1">
                                                {Array.isArray(errors.detailJson) && errors.detailJson[index]?.key?.message}
                                            </p>
                                        </span>
                                        <span className="flex-1 w-full">
                                            <input
                                                {...register(`detailJson.${index}.value` as const)}
                                                placeholder="Value"
                                                className="w-full px-3 py-2 rounded bg-white text-black border border-gray-300 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition mt-2 sm:mt-0"
                                            />
                                            <p className="text-sm text-red-500 mt-1">
                                                {Array.isArray(errors.detailJson) ? errors.detailJson[index]?.value?.message : undefined}
                                            </p>
                                        </span>
                                        <div className="w-full sm:w-auto flex-shrink-0 mt-2 sm:mt-0">
                                            <button
                                                type="button"
                                                onClick={() => remove(index)}
                                                className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition w-full sm:w-auto"
                                            >
                                                X
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => append({ key: "", value: "" })}
                                className="flex items-center gap-2 px-4 py-2 mt-2 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] rounded-xl shadow-md text-white font-semibold hover:shadow-lg transition-all duration-200 cursor-pointer">
                                + Add detail
                            </button>
                        </div>
                        {/* Product Features */}
                        <div>
                            <label className="block text-base font-semibold text-black mb-2">
                                Product Features
                            </label>
                            <div className="flex flex-col gap-3">
                                {featureFields.map((field, index) => (
                                    <div
                                        key={field.id}
                                        className="flex flex-col sm:flex-row gap-2 rounded-xl bg-white items-start"
                                    >
                                        <span className="flex-1 w-full">
                                            <input
                                                {...register(`featureJson.${index}.value` as const)}
                                                placeholder={`Feature ${index + 1}`}
                                                className="w-full px-3 py-2 rounded bg-white text-black border border-gray-300 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition"
                                            />
                                            {/* ✅ Error message */}
                                            <p className="text-sm text-red-500 mt-1">
                                                {Array.isArray(errors.featureJson) ? errors.featureJson[index]?.value?.message : undefined}
                                            </p>
                                        </span>
                                        <div className="w-full sm:w-auto flex-shrink-0 mt-2 sm:mt-0">
                                            <button
                                                type="button"
                                                onClick={() => featureRemove(index)}
                                                className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition w-full sm:w-auto"
                                            >
                                                X
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => featureAppend({ value: "" })}
                                className="flex items-center gap-2 px-4 py-2 mt-2 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] rounded-xl shadow-md text-white font-semibold hover:shadow-lg transition-all duration-200 cursor-pointer"> + Add Feature
                            </button>
                        </div>
                        {/* Images */}
                        {!variantHasImages && (
                            <>
                                {/* Product Images */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                                    {/* ================= LEFT: Primary Image ================= */}
                                    <div className="border border-gray-200 rounded-xl p-5 bg-gray-50/50">
                                        <label className="block text-lg font-semibold text-black mb-4">
                                            Primary Image<span className="text-red-600">*</span>
                                        </label>

                                        <ImageCropperModal
                                            className="flex items-center gap-2 px-4 py-2 mt-2 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] rounded-xl shadow-md text-white font-semibold hover:shadow-lg transition-all duration-200 cursor-pointer"
                                            onSelect={(img: any) => {
                                                setValue("image_url", img);
                                                setPreview(img);
                                            }}
                                            buttonLabel="Select Primary Image"
                                        />

                                        {preview && (
                                            <img
                                                src={`${uploadUrl}${preview}`}
                                                alt="Primary"
                                                className="mt-4 h-28 w-28 rounded-xl object-cover border shadow-sm"
                                            />
                                        )}

                                        <p className="text-sm text-red-500 mt-1">
                                            {errors.image_url?.message as any}
                                        </p>
                                    </div>

                                    {/* ================= RIGHT: Additional Images ================= */}
                                    <div className="border border-gray-200 rounded-xl p-5 bg-gray-50/50">
                                        <label className="block text-lg font-semibold text-black mb-4">
                                            Additional Images
                                        </label>

                                        <ImageCropperModal
                                            multiple
                                            className="flex items-center gap-2 px-4 py-2 mt-2 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] rounded-xl shadow-md text-white font-semibold hover:shadow-lg transition-all duration-200 cursor-pointer"
                                            onSelect={(imgs: any) => {
                                                const normalized = Array.isArray(imgs) ? imgs : imgs ? [imgs] : [];
                                                setValue("imageJson", normalized);
                                                setMultiPreview(normalized);
                                            }}
                                            buttonLabel="Select Additional Images"
                                        />

                                        <div className="flex gap-3 mt-4 overflow-x-auto">
                                            {Array.isArray(multiPreview) &&
                                                multiPreview.map((src, i) => (
                                                    <img
                                                        key={i}
                                                        src={`${uploadUrl}${src}`}
                                                        alt={`Preview ${i}`}
                                                        className="h-20 w-20 rounded-xl object-cover border shadow-sm"
                                                    />
                                                ))}
                                        </div>
                                    </div>

                                </div>

                            </>
                        )}
                        {/* Status Toggle */}
                        <div
                            className="flex items-center gap-3 cursor-pointer select-none"
                            onClick={() => setValue("status", !watch("status"))}
                        >
                            <span className="block text-base font-semibold text-black">
                                Status
                            </span>
                            <div
                                className={`flex items-center h-6 w-12 rounded-full transition-all duration-300 ${watch("status") ? "bg-green-500" : "bg-red-500"
                                    }`}
                            >
                                <span
                                    className={`h-6 w-6 rounded-full bg-white shadow-md transform transition-all duration-300 ${watch("status") ? "translate-x-6" : "translate-x-0"
                                        }`}
                                />
                            </div>
                        </div>
                    </div>
                    {/* Variants Section */}
                    <div className="border border-gray-300 rounded-xl p-6 bg-white shadow-sm">
                        <div className="p-3 bg-white/70 backdrop-blur border border-gray-200 rounded-2xl shadow-lg mb-5">
                            <div className="flex items-center justify-between">
                                {/* Title */}
                                <h2 className="lg:text-3xl text-xl font-bold px-5 text-gray-900 tracking-tight">
                                    Product Variant Details
                                </h2>

                                {/* Buttons */}
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            appendVariant({
                                                title: "",
                                                attributeValue: "",
                                                sku: "",
                                                mrp: 0,
                                                bp: 0,
                                                sp: 0,
                                                stock: 0,
                                                status: true,
                                                imageUrl: "",
                                                imageJson: [],
                                                has_images: variantHasImages,
                                            })
                                        }

                                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] rounded-xl shadow-md text-white font-semibold hover:shadow-lg transition-all duration-200 cursor-pointer">
                                        + Add Variant
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {variantFields.map((variant, variantIndex) => {
                                const variantImageUrl = watch(`variants.${variantIndex}.imageUrl`);
                                const rawVariantImageJson = watch(`variants.${variantIndex}.imageJson`);
                                const variantImageJson = Array.isArray(rawVariantImageJson)
                                    ? rawVariantImageJson
                                    : rawVariantImageJson
                                        ? [rawVariantImageJson]
                                        : [];
                                return (
                                    <div
                                        key={variant.id}
                                        className="mb-6 p-4 border border-gray-200 rounded-xl bg-gray-50 shadow-sm flex flex-col gap-4 relative"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => removeVariant(variantIndex)}
                                            title="Remove Variant"
                                            className="absolute -top-3 -right-3 z-10 flex items-center justify-center h-8 w-8 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-500 hover:text-white hover:border-red-500 shadow-sm hover:shadow-md transition-all duration-200">
                                            <X size={18} />
                                        </button>

                                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                                            <div className="flex-1">
                                                <label className="block text-base font-semibold text-black mb-1">Name<span className="text-red-600">*</span></label>
                                                <input
                                                    {...register(`variants.${variantIndex}.title` as const)}
                                                    type="text"
                                                    placeholder="Enter product name"
                                                    className="w-full px-3 py-2 rounded-lg bg-white text-black border border-gray-300 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition"
                                                />
                                                <p className="text-sm text-red-500">
                                                    {Array.isArray(errors.variants) ? errors.variants[variantIndex]?.title?.message : undefined}
                                                </p>
                                            </div>
                                            {/* Attribute Value */}
                                            <div className="flex-1">
                                                <div>
                                                    <label className="block text-base font-semibold text-black mb-1">
                                                        {attributes.length > 0 ? attributes[0]?.name : "Attribute Value"}<span className="text-red-600">*</span>
                                                    </label>
                                                    <select
                                                        {...register(`variants.${variantIndex}.attributeValue` as const)}
                                                        className="w-full px-3 py-3 rounded-lg bg-white text-black border border-gray-300 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition"
                                                    >
                                                        <option value="">-- Select value --</option>
                                                        {attributes[0]?.values?.length ? (
                                                            attributes[0].values.map((value) => (
                                                                <option key={value.id} value={value.id}>
                                                                    {value.value}
                                                                </option>
                                                            ))
                                                        ) : (
                                                            <option disabled>No values available</option>
                                                        )}
                                                    </select>
                                                    <p className="text-sm text-red-500">
                                                        {Array.isArray(errors.variants) ? errors.variants[variantIndex]?.attributeValue?.message : undefined}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-4 items-center">

                                            {/* SKU */}
                                            <div className="flex-1">
                                                <label className="block text-base font-semibold text-black mb-1">
                                                    SKU<span className="text-red-600">*</span>
                                                </label>
                                                <input
                                                    {...register(`variants.${variantIndex}.sku` as const)}
                                                    type="text"
                                                    placeholder="Enter SKU"
                                                    className="w-full px-3 py-2 rounded-lg bg-white text-black border border-gray-300 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition"
                                                />
                                                <p className="text-sm text-red-500">
                                                    {Array.isArray(errors.variants) ? errors.variants[variantIndex]?.sku?.message : undefined}
                                                </p>
                                            </div>
                                            {/* MRP */}
                                            <div className="flex-1">
                                                <label className="block text-base font-semibold text-black mb-1">
                                                    MRP<span className="text-red-600">*</span>
                                                </label>
                                                <input
                                                    {...register(`variants.${variantIndex}.mrp` as const)}
                                                    type="number"
                                                    onWheel={disableScrollNumberInput}
                                                    placeholder="Enter MRP"
                                                    className="w-full px-3 py-2 rounded-lg bg-white text-black border border-gray-300 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition"
                                                />
                                                <p className="text-sm text-red-500">
                                                    {Array.isArray(errors.variants) ? errors.variants[variantIndex]?.mrp?.message : undefined}
                                                </p>
                                            </div>

                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                                            {/* Base Price / Selling Price (sp) */}
                                            <div className="flex-1">
                                                <label className="block text-base font-semibold text-black mb-1">
                                                    Base Price / Selling Price (BP)<span className="text-red-600">*</span>
                                                </label>
                                                <input
                                                    {...register(`variants.${variantIndex}.sp` as const)}
                                                    type="number"
                                                    onWheel={disableScrollNumberInput}
                                                    placeholder="Enter Selling Price (BP)"
                                                    className="w-full px-3 py-2 rounded-lg bg-white text-black border border-gray-300 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition"
                                                />
                                                <p className="text-sm text-red-500">
                                                    {Array.isArray(errors.variants) ? errors.variants[variantIndex]?.sp?.message : undefined}
                                                </p>
                                            </div>
                                            {/* Buying Price (bp) */}
                                            <div className="flex-1">
                                                <label className="block text-base font-semibold text-black mb-1">
                                                    Buying Price (Cost Price)<span className="text-red-600">*</span>
                                                </label>
                                                <input
                                                    {...register(`variants.${variantIndex}.bp` as const)}
                                                    type="number"
                                                    onWheel={disableScrollNumberInput}
                                                    placeholder="Enter Buying Price"
                                                    className="w-full px-3 py-2 rounded-lg bg-white text-black border border-gray-300 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition"
                                                />
                                                <p className="text-sm text-red-500">
                                                    {Array.isArray(errors.variants) ? errors.variants[variantIndex]?.bp?.message : undefined}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                                            {/* Stock */}
                                            <div className="flex-1">
                                                <label className="block text-base font-semibold text-black mb-1">Stock<span className="text-red-600">*</span></label>
                                                <input
                                                    {...register(`variants.${variantIndex}.stock` as const)}
                                                    type="number"
                                                    onWheel={disableScrollNumberInput}
                                                    step="0.01"
                                                    placeholder="Enter Stock"
                                                    className="w-full px-3 py-2 rounded-lg bg-white text-black border border-gray-300 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition"
                                                />
                                                <p className="text-sm text-red-500">
                                                    {Array.isArray(errors.variants) ? errors.variants[variantIndex]?.stock?.message : undefined}
                                                </p>
                                            </div>
                                            <div className="mt-6">
                                                <div className="flex items-center gap-4 cursor-pointer select-none"
                                                    onClick={() => setValue(`variants.${variantIndex}.status`, !watch(`variants.${variantIndex}.status`))}
                                                >
                                                    <span className="text-sm font-semibold text-gray-800">Status</span>
                                                    <div className={`relative flex items-center h-6 w-12 rounded-full transition-all duration-300 ${watch(`variants.${variantIndex}.status`) ? "bg-green-500" : "bg-red-500"}`}>
                                                        <span className={`absolute h-6 w-6 rounded-full bg-white shadow-md transform transition-all duration-300 ${watch(`variants.${variantIndex}.status`) ? "translate-x-6" : "translate-x-0"}`} />
                                                    </div>
                                                </div>
                                            </div>

                                        </div>

                                        {/* Primary Image with Cropper for this variant */}
                                        {variantHasImages && (
                                            <>
                                                <div>
                                                    <label className="block text-base font-semibold text-black mb-1">Primary Image*</label>
                                                    <ImageCropperModal
                                                        onSelect={(img: any) => {
                                                            setValue(`variants.${variantIndex}.imageUrl`, img);
                                                        }}
                                                        buttonLabel="Select Primary Image"
                                                    />
                                                    {variantImageUrl && (
                                                        <img
                                                            src={`${uploadUrl}${variantImageUrl}`}
                                                            alt="Primary"
                                                            className="mt-2 h-24 w-24 rounded object-cover border"
                                                        />
                                                    )}
                                                    <p className="text-sm text-red-500">
                                                        {Array.isArray(errors.variants) ? errors.variants[variantIndex]?.imageUrl?.message : undefined}
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="block text-base font-semibold text-black mb-1">Additional Images</label>
                                                    <ImageCropperModal
                                                        multiple
                                                        onSelect={(imgs: any) => {
                                                            setValue(`variants.${variantIndex}.imageJson`, imgs);
                                                        }}
                                                        buttonLabel="Select Additional Images"
                                                    />
                                                    <div className="flex gap-2 mt-2 flex-nowrap overflow-x-auto">
                                                        {variantImageJson
                                                            .filter((src): src is string => typeof src === "string" && !!src)
                                                            .map((src, i) => (
                                                                <img
                                                                    key={i}
                                                                    src={`${uploadUrl}${src}`}
                                                                    alt={`Preview ${i}`}
                                                                    className="h-20 w-20 rounded object-cover border"
                                                                />
                                                            ))}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-sm text-red-500">
                            {errors.variants?.message as any}
                        </p>
                    </div>
                </div>

                {/* Button */}
                <div className="border border-gray-300 rounded-xl mt-6 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] ">
                    <div className="max-w-[90rem] mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">

                        {/* Message */}
                        <p className="text-sm text-gray-600 font-medium">
                            ⚠️ Please check all product details before submitting.
                        </p>

                        {/* Save Button */}
                        <button
                            form="product-form"
                            type="submit"
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] rounded-xl shadow-md text-white font-semibold hover:shadow-lg transition-all duration-200 cursor-pointer"
                        >
                            {productId ? "Update Product" : "Save Product"}
                        </button>

                    </div>
                </div>

            </form>

        </div>
    );
}

export default VariantProductForm;
