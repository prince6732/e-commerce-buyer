
import { CategoryAttribute } from "@/common/interface";
import { Control, FieldErrors, useFieldArray, UseFormSetValue, UseFormWatch } from "react-hook-form";
import ImageCropperModal from "../(frontend)/ImageCropperModal";
import { FormData1 } from "@/app/(dashboards)/dashboard/categories/[slug]/products/add-multi-variant/page";
import { X } from "lucide-react";

type Props = {
    itemIndex: number;
    control: Control<any>;
    register: any;
    setValue: UseFormSetValue<FormData1>;
    watch: UseFormWatch<FormData1>;
    errors: FieldErrors<FormData1>;
    attributeOneHasImages: boolean;
    attributeTwoHasImages: boolean;
    attribute?: CategoryAttribute;
    productId?: string | null;
};

const uploadUrl = process.env.NEXT_PUBLIC_UPLOAD_BASE ?? "https://api.zelton.co.in";

function VariantOption({ itemIndex, control, register, setValue, watch, errors, attributeOneHasImages, attributeTwoHasImages, attribute, productId }: Props) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `variants.${itemIndex}.options`,
    });

    const disableScrollNumberInput = (e: React.WheelEvent<HTMLInputElement>) => {
        e.currentTarget.blur(); // remove focus so scroll cannot change value
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-6">
                {fields.map((option, optionIndex) => {
                    const variantImageUrl = watch(`variants.${itemIndex}.options.${optionIndex}.image_url`);
                    // Ensure variantImageJson is an array
                    let variantImageJsonRaw = watch(`variants.${itemIndex}.options.${optionIndex}.imageJson`);
                    let variantImageJson: string[] = [];

                    if (variantImageJsonRaw) {
                        if (typeof variantImageJsonRaw === "string") {
                            try {
                                const parsed = JSON.parse(variantImageJsonRaw);
                                if (Array.isArray(parsed)) variantImageJson = parsed;
                            } catch (err) {
                                console.error("Failed to parse imageJson", err);
                            }
                        } else if (Array.isArray(variantImageJsonRaw)) {
                            variantImageJson = variantImageJsonRaw.filter((item): item is string => item !== undefined);
                        }
                    }

                    return (
                        <div
                            key={option.id}
                            className="p-4 border border-gray-200 rounded-xl bg-gray-50 shadow-sm flex flex-col gap-4 relative"
                        >
                            <button
                                type="button"
                                onClick={() => remove(optionIndex)}
                                title="Remove Option"
                                className="absolute -top-3 -right-3 z-10 flex items-center justify-center h-8 w-8 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-500 hover:text-white hover:border-red-500 shadow-sm hover:shadow-md transition-all duration-200">
                                <X size={18} />
                            </button>

                            {/* Header row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">

                                {/* Name */}
                                <div className="space-y-1.5">
                                    <label className="flex items-center text-sm font-semibold text-gray-800">
                                        Name
                                        <span className="text-xs text-gray-400 ms-1">(Optional)</span>
                                    </label>

                                    <input
                                        {...register(`variants.${itemIndex}.options.${optionIndex}.title`)}
                                        type="text"
                                        placeholder="Enter product name"
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                                    />

                                    {errors.variants?.[itemIndex]?.options?.[optionIndex]?.title && (
                                        <p className="text-xs text-red-500">
                                            {errors.variants[itemIndex].options[optionIndex].title?.message}
                                        </p>
                                    )}
                                </div>

                                {/* Attribute Value */}
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1 text-sm font-semibold text-gray-800">
                                        {attribute?.name || "Attribute Value"}
                                        <span className="text-red-500">*</span>
                                    </label>

                                    <select
                                        {...register(`variants.${itemIndex}.options.${optionIndex}.attributeValue`)}
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                                    >
                                        <option value="">Select value</option>
                                        {attribute?.values?.map((value) => (
                                            <option key={value.id} value={value.id}>
                                                {value.value}
                                            </option>
                                        ))}
                                    </select>

                                    {errors.variants?.[itemIndex]?.options?.[optionIndex]?.attributeValue && (
                                        <p className="text-xs text-red-500">
                                            {errors.variants[itemIndex].options[optionIndex].attributeValue?.message}
                                        </p>
                                    )}
                                </div>

                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
                                {/* SKU */}
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1 text-sm font-semibold text-gray-800">
                                        SKU
                                        <span className="text-red-500">*</span>
                                    </label>

                                    <input
                                        {...register(`variants.${itemIndex}.options.${optionIndex}.sku`)}
                                        type="text"
                                        placeholder="Enter SKU"
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                                    />

                                    {errors.variants?.[itemIndex]?.options?.[optionIndex]?.sku && (
                                        <p className="text-xs text-red-500">
                                            {errors.variants[itemIndex].options[optionIndex].sku?.message}
                                        </p>
                                    )}
                                </div>
                                {/* MRP */}
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1 text-sm font-semibold text-gray-800">
                                        MRP
                                        <span className="text-red-500">*</span>
                                    </label>

                                    <input
                                        {...register(`variants.${itemIndex}.options.${optionIndex}.mrp`)}
                                        type="number"
                                        onWheel={disableScrollNumberInput}
                                        placeholder="Enter MRP"
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                                    />

                                    {errors.variants?.[itemIndex]?.options?.[optionIndex]?.mrp && (
                                        <p className="text-xs text-red-500">
                                            {errors.variants[itemIndex].options[optionIndex].mrp?.message}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
                                {/* Base Price / Selling Price (sp) */}
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1 text-sm font-semibold text-gray-800">
                                        Base Price / Selling Price (BP)
                                        <span className="text-red-500">*</span>
                                    </label>

                                    <input
                                        {...register(`variants.${itemIndex}.options.${optionIndex}.sp`)}
                                        type="number"
                                        onWheel={disableScrollNumberInput}
                                        placeholder="Enter Selling Price (BP)"
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                                    />

                                    {errors.variants?.[itemIndex]?.options?.[optionIndex]?.sp && (
                                        <p className="text-xs text-red-500">
                                            {errors.variants[itemIndex].options[optionIndex].sp?.message}
                                        </p>
                                    )}
                                </div>
                                {/* Buying Price (bp) */}
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1 text-sm font-semibold text-gray-800">
                                        Buying Price (Cost Price)
                                        <span className="text-red-500">*</span>
                                    </label>

                                    <input
                                        {...register(`variants.${itemIndex}.options.${optionIndex}.bp`)}
                                        type="number"
                                        onWheel={disableScrollNumberInput}
                                        placeholder="Enter Buying Price"
                                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                                    />

                                    {errors.variants?.[itemIndex]?.options?.[optionIndex]?.bp && (
                                        <p className="text-xs text-red-500">
                                            {errors.variants[itemIndex].options[optionIndex].bp?.message}
                                        </p>
                                    )}
                                </div>
                            </div>


                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">

                                {/* Stock */}
                                <div>
                                    <label className="block text-base font-semibold text-black mb-1">Stock<span className="text-red-500">*</span></label>
                                    <input
                                        {...register(`variants.${itemIndex}.options.${optionIndex}.stock` as const)}
                                        type="number"
                                        onWheel={disableScrollNumberInput}
                                        step="0.01"
                                        placeholder="Enter Stock"
                                        className="w-full px-3 py-2 rounded-lg bg-white text-black border border-gray-300 focus:border-[#007FFF] focus:ring-2 focus:ring-blue-100 transition"
                                    />
                                    <p className="text-sm text-red-500">{errors.variants?.[itemIndex]?.options?.[optionIndex]?.stock?.message}</p>
                                </div>
                                {/* Status */}
                                <div className="mt-9 ms-4">
                                    <div
                                        className="flex items-center gap-4 cursor-pointer select-none"
                                        onClick={() => setValue(`variants.${itemIndex}.options.${optionIndex}.status`, !watch(`variants.${itemIndex}.options.${optionIndex}.status`))}
                                    >
                                        <span className="text-sm font-semibold text-gray-800">Status</span>
                                        <div className={`relative flex items-center ms-8 h-6 w-12 rounded-full transition-all duration-300 ${watch(`variants.${itemIndex}.options.${optionIndex}.status`) ? "bg-[#007FFF]" : "bg-zinc-400"}`}>
                                            <span className={`absolute h-6 w-6 rounded-full bg-white shadow-md transform transition-all duration-300 ${watch(`variants.${itemIndex}.options.${optionIndex}.status`) ? "translate-x-6" : "translate-x-0"}`} />
                                        </div>
                                    </div>
                                </div>
                            </div>


                            {/* Primary Image with Cropper for this option */}
                            {attributeTwoHasImages && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-base font-semibold text-black mb-1">Primary Image*</label>
                                        <ImageCropperModal
                                            onSelect={(img: any) => {
                                                setValue(`variants.${itemIndex}.options.${optionIndex}.image_url`, img);
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
                                        <p className="text-sm text-red-500">{errors.variants?.[itemIndex]?.options?.[optionIndex]?.image_url?.message}</p>
                                    </div>
                                    <div>
                                        <label className="block text-base font-semibold text-black mb-1">Additional Images</label>
                                        <ImageCropperModal
                                            multiple
                                            onSelect={(imgs: any) => {
                                                setValue(`variants.${itemIndex}.options.${optionIndex}.imageJson`, imgs);
                                            }}
                                            buttonLabel="Select Additional Images"
                                        />
                                        <div className="flex gap-2 mt-2 flex-nowrap overflow-x-auto">
                                            {variantImageJson
                                                .filter((src: any): src is string => typeof src === "string" && !!src)
                                                .map((src: any, i: any) => (
                                                    <img
                                                        key={i}
                                                        src={`${uploadUrl}${src}`}
                                                        alt={`Preview ${i}`}
                                                        className="h-20 w-20 rounded object-cover border"
                                                    />
                                                ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    );
                })}
            </div>
            <button
                type="button"
                onClick={() =>
                    append({
                        title: "",
                        attributeValue: "",
                        sku: "",
                        mrp: "",
                        bp: "",
                        sp: "",
                        image_url: "",
                        imageJson: [],
                        status: true,
                        hasAttributeImages1: attributeOneHasImages,
                        hasAttributeImages2: attributeTwoHasImages
                    })
                }
                className="flex items-center gap-2 px-4 py-2 w-36 bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB] rounded-xl shadow-md text-white font-semibold hover:shadow-lg transition-all duration-200"            >
                + Add Option
            </button>
        </div>
    );
}

export default VariantOption;