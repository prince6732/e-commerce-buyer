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
    CategoryAttribute,
} from "@/common/interface";
import { useLoader } from "@/context/LoaderContext";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FaArrowLeft } from "react-icons/fa";
import { getCategoryByIdForProduct } from "../../../../../../../../utils/category";
import { fetchBrands } from "../../../../../../../../utils/brand";
import { createProduct, getProductById, updateProduct, setEditProductId, getEditProductId, clearEditProductId } from "../../../../../../../../utils/product";
import ImageCropperModal from "@/components/(frontend)/ImageCropperModal";
import VariantOption from "@/components/(sheared)/Option";
import { X } from "lucide-react";

const option = yup.object({
    id: yup.mixed().nullable().optional(),
    hasAttributeImages1: yup.boolean(),
    hasAttributeImages2: yup.boolean(),
    title: yup.string(),
    attributeValue: yup.string().required("Option value is required"),
    sku: yup.string().required("SKU is required"),
    mrp: yup.number().typeError("MRP must be a number").required("MRP is required").positive("MRP must be greater than 0").max(9999999.99, "MRP exceeds limit"),
    bp: yup.number().typeError("BP must be a number").required("BP is required").positive("BP must be greater than 0").max(9999999.99, "BP exceeds limit"),
    sp: yup.number().typeError("SP must be a number").required("SP is required").positive("SP must be greater than 0").max(9999999.99, "SP exceeds limit"),
    stock: yup.number().typeError("Stock value must be a number").required("Stock is required").min(0, "Stock must be greater than or equal to 0").max(100000, "Stock exceeds limit"),
    status: yup.boolean().default(true),
    image_url: yup.string().when(['hasAttributeImages1', 'hasAttributeImages2'], {
        is: (hasAttributeImages1: boolean, hasAttributeImages2: boolean) => hasAttributeImages1 && hasAttributeImages2,
        then: (schema) => schema.required("Primary image is required"),
        otherwise: (schema) => schema.notRequired(),
    }),
    imageJson: yup.array().of(yup.string()),
});

const variant = yup.object({
    hasAttributeImages1: yup.boolean(),
    hasAttributeImages2: yup.boolean(),
    title: yup.string(),
    attributeValue: yup.string().required("Variant value is required"),
    image_url: yup.string().when(['hasAttributeImages1', 'hasAttributeImages2'], {
        is: (hasAttributeImages1: boolean, hasAttributeImages2: boolean) => hasAttributeImages1 && !hasAttributeImages2,
        then: (schema) => schema.required("Primary image is required"),
        otherwise: (schema) => schema.notRequired(),
    }),
    imageJson: yup.array().of(yup.string()),
    options: yup.array().of(option).min(1, "At least one option is required"),
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
        is: (attributeOneHasImages: boolean, attributeTwoHasImages: boolean) => !attributeOneHasImages && !attributeTwoHasImages,
        then: (schema) => schema.required("Primary image is required"),
        otherwise: (schema) => schema.notRequired(),
    }),
    imageJson: yup.array().of(yup.string()),
    variants: yup.array().of(variant).min(1, "At least one variant is required"),
    status: yup.boolean().default(true),
});

export type FormData1 = yup.InferType<typeof schema>;

const uploadUrl = process.env.NEXT_PUBLIC_UPLOAD_BASE ?? "https://api.zelton.co.in";


function VariantProductForm() {
    const [preview, setPreview] = useState<string | null>(null);
    const [multiPreview, setMultiPreview] = useState<string[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [attributes, setAttributes] = useState<CategoryAttribute[]>([]);
    const [variantOneHasImages, setVariantOneHasImages] = useState<boolean>(false);
    const [variantTwoHasImages, setVariantTwoHasImages] = useState<boolean>(false);
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
            const categoryFlags = await fetchCategory();
            await getAllBrands();
            if (productId) {
                await fetchProductDetails(productId, categoryFlags);
            }
        };

        initializeForm();
    }, [productId]);

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

    const fetchProductDetails = async (id: string, categoryFlags?: { hasImages1: boolean; hasImages2: boolean }) => {
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

                const safeJsonParse = (val: any, fallback: any = []) => {
                    if (!val) return fallback;
                    if (typeof val === "object") return val;
                    if (typeof val === "string") {
                        try {
                            return JSON.parse(val);
                        } catch {
                            return fallback;
                        }
                    }
                    return fallback;
                };

                const detailParsed = safeJsonParse(product.detail_json, []);
                const featureParsed = safeJsonParse(product.feature_json, []);
                const imageParsed = safeJsonParse(product.image_json, []);

                setValue("status", Boolean(product.status));
                setValue("image_url", product.image_url || "");
                setValue("detailJson", Array.isArray(detailParsed) ? detailParsed : []);
                setValue("featureJson", Array.isArray(featureParsed) ? featureParsed.map((v: any) => typeof v === "object" && v !== null && "value" in v ? v : { value: String(v ?? "") }) : []);
                setValue("imageJson", Array.isArray(imageParsed) ? imageParsed : []);

                setPreview(product.image_url || null);
                setMultiPreview(Array.isArray(imageParsed) ? imageParsed : []);

                if (!product.variants || product.variants.length === 0) {
                    hideLoader();
                    return;
                }

                // Get attributes from item_attributes
                const productAttributes = product.item_attributes || product.itemAttributes || [];

                // Sort attributes by is_primary / isPrimary
                const sortedAttrs = [...productAttributes].sort((a: any, b: any) => {
                    const aPri = Boolean(a.is_primary ?? a.isPrimary);
                    const bPri = Boolean(b.is_primary ?? b.isPrimary);
                    if (aPri && !bPri) return -1;
                    if (!aPri && bPri) return 1;
                    return 0;
                });

                const v1HasImages = categoryFlags?.hasImages1 ?? sortedAttrs[0]?.has_images ?? sortedAttrs[0]?.hasImages ?? variantOneHasImages;
                const v2HasImages = categoryFlags?.hasImages2 ?? sortedAttrs[1]?.has_images ?? sortedAttrs[1]?.hasImages ?? variantTwoHasImages;

                let newVariants: any[] = [];

                if (sortedAttrs.length >= 2) {
                    const primaryAttrId = Number(sortedAttrs[0]?.attribute_id ?? sortedAttrs[0]?.attributeId);
                    const secondaryAttrId = Number(sortedAttrs[1]?.attribute_id ?? sortedAttrs[1]?.attributeId);

                    // Group variants by primary attribute value
                    const variantsByAttribute1 = product.variants.reduce((acc: any, variant: any) => {
                        const attrVals = variant.attribute_values || variant.attributeValues || [];
                        const attr1 = attrVals.find((av: any) => Number(av.attribute_id ?? av.attributeId ?? av.attribute?.id) === primaryAttrId);
                        const key = attr1 ? (attr1.id ?? attr1.attribute_value_id ?? attr1.attributeValueId ?? attr1.value) : (variant.id || "default");
                        if (!acc[key]) {
                            acc[key] = [];
                        }
                        acc[key].push(variant);
                        return acc;
                    }, {});

                    newVariants = Object.keys(variantsByAttribute1).map((key) => {
                        const group = variantsByAttribute1[key];
                        const firstVariant = group[0];
                        const attrVals = firstVariant.attribute_values || firstVariant.attributeValues || [];
                        const attr1Value = attrVals.find((av: any) => Number(av.attribute_id ?? av.attributeId ?? av.attribute?.id) === primaryAttrId);

                        // Extract title prefix if exists
                        const titleParts = firstVariant.title ? firstVariant.title.split(' ') : [''];
                        const variantTitle = titleParts[0] || '';

                        return {
                            title: variantTitle,
                            attributeValue: (attr1Value?.id ?? attr1Value?.attribute_value_id ?? attr1Value?.attributeValueId ?? "")?.toString() || "",
                            image_url: firstVariant.image_url || firstVariant.imageUrl || "",
                            imageJson: firstVariant.image_json ? (typeof firstVariant.image_json === "string" ? JSON.parse(firstVariant.image_json) : firstVariant.image_json) : (firstVariant.imageJson ? (typeof firstVariant.imageJson === "string" ? JSON.parse(firstVariant.imageJson) : firstVariant.imageJson) : []),
                            hasAttributeImages1: v1HasImages,
                            hasAttributeImages2: v2HasImages,
                            options: group.map((v: any) => {
                                const optAttrVals = v.attribute_values || v.attributeValues || [];
                                const attr2Value = optAttrVals.find((av: any) => Number(av.attribute_id ?? av.attributeId ?? av.attribute?.id) === secondaryAttrId);

                                // Extract option title (everything after first word)
                                const vTitleParts = v.title ? v.title.split(' ') : [];
                                const optionTitle = vTitleParts.slice(1).join(' ') || '';

                                return {
                                    id: v.id,
                                    title: optionTitle || v.title || "",
                                    attributeValue: (attr2Value?.id ?? attr2Value?.attribute_value_id ?? attr2Value?.attributeValueId ?? "")?.toString() || "",
                                    sku: v.sku || "",
                                    mrp: parseFloat(v.mrp) || 0,
                                    sp: parseFloat(v.sp) || 0,
                                    bp: parseFloat(v.bp) || 0,
                                    stock: v.stock || 0,
                                    status: Boolean(v.status),
                                    image_url: v.image_url || v.imageUrl || "",
                                    imageJson: v.image_json ? (typeof v.image_json === "string" ? JSON.parse(v.image_json) : v.image_json) : (v.imageJson ? (typeof v.imageJson === "string" ? JSON.parse(v.imageJson) : v.imageJson) : []),
                                    hasAttributeImages1: v1HasImages,
                                    hasAttributeImages2: v2HasImages,
                                };
                            })
                        };
                    });
                } else if (sortedAttrs.length === 1) {
                    const primaryAttrId = Number(sortedAttrs[0]?.attribute_id ?? sortedAttrs[0]?.attributeId);
                    const variantsByAttribute1 = product.variants.reduce((acc: any, variant: any) => {
                        const attrVals = variant.attribute_values || variant.attributeValues || [];
                        const attr1 = attrVals.find((av: any) => Number(av.attribute_id ?? av.attributeId ?? av.attribute?.id) === primaryAttrId);
                        const key = attr1 ? (attr1.id ?? attr1.attribute_value_id ?? attr1.attributeValueId ?? attr1.value) : (variant.id || "default");
                        if (!acc[key]) {
                            acc[key] = [];
                        }
                        acc[key].push(variant);
                        return acc;
                    }, {});

                    newVariants = Object.keys(variantsByAttribute1).map((key) => {
                        const group = variantsByAttribute1[key];
                        const firstVariant = group[0];
                        const attrVals = firstVariant.attribute_values || firstVariant.attributeValues || [];
                        const attr1Value = attrVals.find((av: any) => Number(av.attribute_id ?? av.attributeId ?? av.attribute?.id) === primaryAttrId);

                        return {
                            title: firstVariant.title || "",
                            attributeValue: (attr1Value?.id ?? attr1Value?.attribute_value_id ?? attr1Value?.attributeValueId ?? "")?.toString() || "",
                            image_url: firstVariant.image_url || firstVariant.imageUrl || "",
                            imageJson: firstVariant.image_json ? (typeof firstVariant.image_json === "string" ? JSON.parse(firstVariant.image_json) : firstVariant.image_json) : [],
                            hasAttributeImages1: v1HasImages,
                            hasAttributeImages2: v2HasImages,
                            options: group.map((v: any) => ({
                                id: v.id,
                                title: v.title || "",
                                attributeValue: "",
                                sku: v.sku || "",
                                mrp: parseFloat(v.mrp) || 0,
                                sp: parseFloat(v.sp) || 0,
                                bp: parseFloat(v.bp) || 0,
                                stock: v.stock || 0,
                                status: Boolean(v.status),
                                image_url: v.image_url || v.imageUrl || "",
                                imageJson: v.image_json ? (typeof v.image_json === "string" ? JSON.parse(v.image_json) : v.image_json) : [],
                                hasAttributeImages1: v1HasImages,
                                hasAttributeImages2: v2HasImages,
                            }))
                        };
                    });
                } else {
                    newVariants = product.variants.map((v: any) => ({
                        title: v.title || product.name || "",
                        attributeValue: "",
                        image_url: v.image_url || "",
                        imageJson: v.image_json ? (typeof v.image_json === "string" ? JSON.parse(v.image_json) : v.image_json) : [],
                        hasAttributeImages1: false,
                        hasAttributeImages2: false,
                        options: [{
                            id: v.id,
                            title: v.title || "",
                            attributeValue: "",
                            sku: v.sku || "",
                            mrp: parseFloat(v.mrp) || 0,
                            sp: parseFloat(v.sp) || 0,
                            bp: parseFloat(v.bp) || 0,
                            stock: v.stock || 0,
                            status: Boolean(v.status),
                            image_url: v.image_url || "",
                            imageJson: v.image_json ? (typeof v.image_json === "string" ? JSON.parse(v.image_json) : v.image_json) : [],
                            hasAttributeImages1: false,
                            hasAttributeImages2: false,
                        }]
                    }));
                }

                setValue("variants", newVariants);
            }
        } catch (error) {
            console.error(error);
        } finally {
            hideLoader();
        }
    };

    const fetchCategory = async () => {
        showLoader();
        try {
            const data = await getCategoryByIdForProduct(categoryId?.toString()!);

            if (!data?.result) {
                setErrorMessage("Category data not found.");
                return { hasImages1: false, hasImages2: false };
            }
            if (data.result.id) {
                setValue("categoryId", String(data.result.id));
            }
            const checkHasImages = (attr: any): boolean => {
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

            const checkIsPrimary = (attr: any): boolean => {
                if (!attr) return false;
                const val =
                    attr.pivot?.is_primary ??
                    attr.pivot?.isPrimary ??
                    attr.pivot?.IsPrimary ??
                    attr.is_primary ??
                    attr.isPrimary ??
                    attr.IsPrimary;
                return val === true || val === 1 || val === "1" || val === "true";
            };

            const normalizedAttributes = data.result.attributes?.map((attr: any) => {
                const attrHasImg = checkHasImages(attr);
                const attrIsPri = checkIsPrimary(attr);
                return {
                    attributeId: attr.id,
                    id: attr.id,
                    name: attr.name,
                    description: attr.description,
                    hasImages: attrHasImg,
                    isPrimary: attrIsPri,
                    has_images: attrHasImg,
                    values: attr.values || [],
                };
            }) || [];

            const sortedAttributes = normalizedAttributes.sort((a: any, b: any) => {
                if (a.isPrimary && !b.isPrimary) return -1;
                if (!a.isPrimary && b.isPrimary) return 1;
                return 0;
            });

            setAttributes(sortedAttributes);

            let hasImages1 = false;
            let hasImages2 = false;

            if (sortedAttributes.length === 2) {
                const firstAttr = sortedAttributes[0];
                const secondAttr = sortedAttributes[1];

                hasImages1 = firstAttr.hasImages;
                hasImages2 = secondAttr.hasImages;

                setVariantOneHasImages(hasImages1);
                setVariantTwoHasImages(hasImages2);

                setValue("attributeOneHasImages", hasImages1);
                setValue("attributeTwoHasImages", hasImages2);
            } else if (sortedAttributes.length === 1) {
                const firstAttr = sortedAttributes[0];
                hasImages1 = firstAttr.hasImages;
                setVariantOneHasImages(hasImages1);
                setValue("attributeOneHasImages", hasImages1);
            }

            return { hasImages1, hasImages2 };
        } catch (err) {
            console.error("Error fetching category:", err);
            setErrorMessage("Failed to load category attributes.");
            return { hasImages1: false, hasImages2: false };
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

    const onSubmit = async (data: FormData1) => {
        showLoader();
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const formattedVariants = (data.variants ?? []).flatMap((variant, variantIndex) =>
                (variant.options ?? []).map((option, optionIndex) => {
                    const {
                        title,
                        hasAttributeImages1,
                        hasAttributeImages2,
                        attributeValue,
                        image_url,
                        imageJson,
                        ...restOfOption
                    } = option;

                    const formattedVariant: any = {
                        ...restOfOption,
                        title: `${variant.title} ${option.title}`,
                        status: option.status ?? true,
                        image_url: getImageUrl(data, variantIndex, optionIndex),
                        image_json: JSON.stringify(getImageList(data, variantIndex, optionIndex)),
                    };

                    // Only include valid numeric attributeValues if they exist
                    const attributeValues = [variant.attributeValue, attributeValue]
                        .filter(Boolean)
                        .map((v: any) => String(v).trim())
                        .filter((v, idx, arr) => v && !isNaN(Number(v)) && arr.indexOf(v) === idx);
                    if (attributeValues.length > 0) {
                        formattedVariant.attributeValues = attributeValues.map(Number);
                    }

                    // Include variant ID if updating and ID is a valid number
                    if (productId && option.id && !isNaN(Number(option.id)) && typeof option.id !== 'object') {
                        formattedVariant.id = Number(option.id);
                    }

                    return formattedVariant;
                })
            );
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
                featureList: data.featureJson?.map((feature) => feature.value) || [],
                feature_json: JSON.stringify(data.featureJson?.map((feature) => feature.value) || []),
                image_url: data.image_url ?? null,
                imageUrl: data.image_url ?? null,
                imageList: data.imageJson || [],
                image_json: JSON.stringify(data.imageJson || []),
                variants: formattedVariants,
            };
            let res: ApiResponse<string>;

            if (productId) {
                res = await updateProduct(productId, payload as any);
            } else {
                res = await createProduct(payload as any);
            }

            if (res.success) {
                setSuccessMessage(res.message || (productId ? "Product updated successfully." : "Product created successfully."));
            } else {
                if (res.errors && Object.keys(res.errors).length > 0) {
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

    const getImageUrl = (data: FormData1, variantIndex: number, optionIndex: number) => {
        const variant = data.variants?.[variantIndex];
        if (!variant) return "";
        const option = variant.options?.[optionIndex];

        const optImg = option?.image_url;
        const varImg = variant?.image_url;

        if (variant.hasAttributeImages1 && variant.hasAttributeImages2) {
            return optImg || varImg || "";
        }
        if (variant.hasAttributeImages1 && !variant.hasAttributeImages2) {
            return varImg || optImg || "";
        }
        if (!variant.hasAttributeImages1 && variant.hasAttributeImages2) {
            return optImg || varImg || "";
        }
        return optImg || varImg || "";
    };

    const getImageList = (data: FormData1, variantIndex: number, optionIndex: number) => {
        const variant = data.variants?.[variantIndex];
        if (!variant) return [];
        const option = variant.options?.[optionIndex];

        const optList = Array.isArray(option?.imageJson) ? option.imageJson : [];
        const varList = Array.isArray(variant?.imageJson) ? variant.imageJson : [];

        if (variant.hasAttributeImages1 && variant.hasAttributeImages2) {
            return optList.length ? optList : varList;
        }
        if (variant.hasAttributeImages1 && !variant.hasAttributeImages2) {
            return varList.length ? varList : optList;
        }
        if (!variant.hasAttributeImages1 && variant.hasAttributeImages2) {
            return optList.length ? optList : varList;
        }
        return optList.length ? optList : varList;
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
                            <div>
                                <label className="block text-sm md:text-base font-semibold text-black mb-1">Name<span className="text-red-600">*</span></label>
                                <input
                                    {...register("name")}
                                    type="text"
                                    placeholder="Enter product name"
                                    className="w-full px-3 py-2 rounded-lg bg-white text-black border border-gray-300 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition"
                                />
                                <p className="text-sm text-red-500">{errors.name?.message as string}</p>
                            </div>
                            <div>
                                <label className="block text-sm md:text-base font-semibold text-black mb-1">Brand<span className="text-red-600">*</span></label>
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
                                <p className="text-sm text-red-500">{errors.brandId?.message as string}</p>
                            </div>
                            <div>
                                <label className="block text-sm md:text-base font-semibold text-black mb-1">Item Code</label>
                                <input
                                    {...register("itemCode")}
                                    type="text"
                                    placeholder="Enter item code"
                                    className="w-full px-3 py-2 rounded-lg bg-white text-black border border-gray-300 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition"
                                />
                            </div>

                        </div>
                        <div>
                            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
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
                            <p className="text-sm text-red-500">{errors.description?.message as string}</p>
                        </div>
                        {/* Product Details */}
                        <div>
                            <label className="block text-sm md:text-base font-semibold text-black mb-2">Product Detail</label>
                            <div className="flex flex-col gap-2 md:gap-3">
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
                                className="flex items-center gap-2 px-4 py-2 mt-2 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] rounded-xl shadow-md text-white font-semibold hover:shadow-lg transition-all duration-200 cursor-pointer"                            >
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
                                className="flex items-center gap-2 px-4 py-2 mt-2 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] rounded-xl shadow-md text-white font-semibold hover:shadow-lg transition-all duration-200 cursor-pointer"
                            >
                                + Add Feature
                            </button>
                        </div>
                        {!variantOneHasImages && !variantTwoHasImages && (
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
                                                image_url: "",
                                                imageJson: [],
                                                options: [],
                                                hasAttributeImages1: variantOneHasImages,
                                                hasAttributeImages2: variantTwoHasImages
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
                                const variantImageUrl = watch(`variants.${variantIndex}.image_url`);
                                const rawImageJson = watch(`variants.${variantIndex}.imageJson`);
                                let variantImageJson: string[] = [];
                                if (Array.isArray(rawImageJson)) {
                                    variantImageJson = rawImageJson;
                                } else if (typeof rawImageJson === "string" && rawImageJson.trim() !== "") {
                                    try {
                                        const parsed = JSON.parse(rawImageJson);
                                        variantImageJson = Array.isArray(parsed) ? parsed : [parsed];
                                    } catch {
                                        variantImageJson = [rawImageJson];
                                    }
                                }

                                return (
                                    <div
                                        key={variant.id}
                                        className="mb-6 p-4 border border-gray-200 rounded-xl bg-gray-50 shadow-sm flex flex-col gap-2 relative"
                                    >

                                        <button
                                            type="button"
                                            onClick={() => removeVariant(variantIndex)}
                                            title="Remove Variant"
                                            className="absolute -top-3 -right-3 z-10 flex items-center justify-center h-8 w-8 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-500 hover:text-white hover:border-red-500 shadow-sm hover:shadow-md transition-all duration-200">
                                            <X size={18} />
                                        </button>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">

                                            {/* Variant Name */}
                                            <div className="space-y-1.5">
                                                <label className="flex items-center gap-1 text-sm font-semibold text-gray-800">
                                                    Name
                                                    <span className="text-xs text-gray-400">(Optional)</span>
                                                </label>

                                                <input
                                                    {...register(`variants.${variantIndex}.title` as const)}
                                                    type="text"
                                                    placeholder="Enter product name"
                                                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                                                />

                                                {(errors.variants as any)?.[variantIndex]?.title && (
                                                    <p className="text-xs text-red-500">
                                                        {(errors.variants as any)[variantIndex]?.title?.message}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Attribute Value */}
                                            <div className="space-y-1.5">
                                                <label className="flex items-center gap-1 text-sm font-semibold text-gray-800">
                                                    {attributes.length > 0 ? attributes[0]?.name : "Attribute Value"}
                                                    <span className="text-red-500">*</span>
                                                </label>

                                                <select
                                                    {...register(`variants.${variantIndex}.attributeValue` as const)}
                                                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                                                >
                                                    <option value="">Select value</option>
                                                    {attributes[0]?.values?.map((value) => (
                                                        <option key={value.id} value={value.id}>
                                                            {value.value}
                                                        </option>
                                                    ))}
                                                </select>

                                                {(errors.variants as any)?.[variantIndex]?.attributeValue && (
                                                    <p className="text-xs text-red-500">
                                                        {(errors.variants as any)[variantIndex]?.attributeValue?.message}
                                                    </p>
                                                )}
                                            </div>

                                        </div>

                                        {variantOneHasImages && !variantTwoHasImages && (
                                            <>
                                                <div>
                                                    <label className="block text-base font-semibold text-black mb-1">Primary Image<span className="text-red-600">*</span></label>
                                                    <ImageCropperModal
                                                        onSelect={(img: any) => {
                                                            setValue(`variants.${variantIndex}.image_url`, img);
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
                                                    <p className="text-sm text-red-500">{(errors.variants as any)?.[variantIndex]?.image_url?.message}</p>
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
                                                            .filter((src: string): src is string => typeof src === "string" && !!src)
                                                            .map((src: string, i: number) => (
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
                                        <div className="flex flex-col gap-2 w-full">
                                            <div className="mb-6 rounded-2xl border border-gray-200 bg-gradient-to-r from-white via-white/90 to-gray-50 shadow-sm">
                                                <div className="flex items-center justify-between px-6 py-4">

                                                    {/* Left: Title */}
                                                    <div className="flex items-center gap-4">
                                                        {/* Accent */}
                                                        <span className="h-8 w-1.5 rounded-full bg-[#007FFF]"></span>

                                                        <div>
                                                            <h2 className="text-xl font-semibold text-gray-900 tracking-tight">
                                                                Product Variant Options
                                                            </h2>
                                                            <p className="text-sm text-gray-500">
                                                                Configure variant-specific pricing, images & details
                                                            </p>
                                                        </div>
                                                    </div>

                                                </div>
                                            </div>

                                            <div>
                                                <VariantOption
                                                    itemIndex={variantIndex}
                                                    control={control}
                                                    register={register}
                                                    setValue={setValue}
                                                    watch={watch}
                                                    errors={errors}
                                                    attributeOneHasImages={variantOneHasImages}
                                                    attributeTwoHasImages={variantTwoHasImages}
                                                    attribute={attributes[1]}
                                                    productId={productId}
                                                />
                                            </div>
                                        </div>
                                        <p className="text-sm text-red-500">
                                            {(errors.variants as any)?.[variantIndex]?.options?.message}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-sm text-red-500">
                            {errors.variants?.message as string}
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
