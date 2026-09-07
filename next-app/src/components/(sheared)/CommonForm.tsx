"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Modal from "@/components/(sheared)/Modal";
import Image from "next/image";
import { TextCursor, Info } from "lucide-react";
import { getImageUrl } from "../../../utils/imageUtils";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const SUPPORTED_FORMATS = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif"];

export type FormData = {
    name: string;
    description?: string | null;
    image?: any;
    secondary_image?: any;
    link?: string | null;
    status: boolean;
};

const schema = yup.object({
    name: yup.string().required("Name is required").min(2).max(50),
    description: yup.string().nullable().optional().max(300),
    image: yup
        .mixed()
        .optional()
        .test("fileSize", "Image must be less than 8MB.", (file) => !file || typeof file === "string" || (file instanceof File && file.size <= MAX_FILE_SIZE))
        .test("fileType", "Unsupported format", (file) => !file || typeof file === "string" || (file instanceof File && SUPPORTED_FORMATS.includes(file.type))),
    secondary_image: yup
        .mixed()
        .optional()
        .test("fileSize", "Secondary image must be less than 8MB.", (file) => !file || typeof file === "string" || (file instanceof File && file.size <= MAX_FILE_SIZE))
        .test("fileType", "Unsupported format", (file) => !file || typeof file === "string" || (file instanceof File && SUPPORTED_FORMATS.includes(file.type))),
    link: yup.string().nullable().optional(),
    status: yup.boolean().required(),
});

type InitialData = {
    id: number;
    name: string;
    description?: string;
    image?: string;
    secondary_image?: string;
    link?: string;
    status: boolean;
    attribute_ids?: number[];
} | null;

type Mode = "category" | "subcategory";

type Attribute = {
    id: number;
    name: string;
};

interface Props {
    mode: Mode;
    isOpen: boolean;
    initialData?: InitialData;
    onClose: () => void;
    onSubmit: (data: FormData & { attribute_ids?: number[] }) => Promise<void> | void;
    isSubmitting?: boolean;
    availableAttributes?: Attribute[];
}

export default function CommonForm({
    mode,
    isOpen,
    initialData = null,
    onClose,
    onSubmit,
    isSubmitting = false,
    availableAttributes = [],
}: Props) {
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [previewSecondary, setPreviewSecondary] = useState<string | null>(null);
    const [selectedAttributes, setSelectedAttributes] = useState<number[]>([]);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors, isValid },
    } = useForm<FormData>({
        resolver: yupResolver(schema) as any,
        mode: "onChange",
        defaultValues: {
            name: "",
            description: "",
            image: "",
            secondary_image: "",
            link: "",
            status: true,
        },
    });

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            reset({
                name: initialData?.name ?? "",
                description: initialData?.description ?? "",
                image: initialData?.image ?? "",
                secondary_image: initialData?.secondary_image ?? "",
                link: initialData?.link ?? "",
                status: initialData?.status ?? true,
            });

            setPreviewImage(getImageUrl(initialData?.image));
            setPreviewSecondary(getImageUrl(initialData?.secondary_image));

            // Clear attributes for new subcategory
            if (!initialData) {
                setSelectedAttributes([]);
            }

            // Preload selected attributes for editing
            if (initialData?.attribute_ids) {
                setSelectedAttributes(initialData.attribute_ids);
            }
        }
    }, [isOpen, initialData, reset]);

    const toggleAttribute = (id: number) => {
        setSelectedAttributes((prev) =>
            prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
        );
    };

    const label = mode === "subcategory" ? "Subcategory" : "Category";

    const handleClose = () => {
        reset({
            name: "",
            description: "",
            image: "",
            secondary_image: "",
            link: "",
            status: true,
        });
        setPreviewImage(null);
        setPreviewSecondary(null);
        setSelectedAttributes([]);
        onClose();
    };

    const submit = async (data: FormData) => {
        await onSubmit({ ...data, attribute_ids: selectedAttributes });
    };

    const isChecked = watch("status");

    return (
        <Modal
            width="max-w-md"
            isOpen={isOpen}
            onClose={handleClose}
            title={initialData?.id ? `Edit ${label}` : `Add ${label}`}
        >
            <form onSubmit={handleSubmit(submit)} className="space-y-6 px-1 py-2">
                {/* Name */}
                <div>
                    <label htmlFor="name" className="block text-sm font-medium">
                        {label} Name<span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <input
                            id="name"
                            {...register("name")}
                            type="text"
                            placeholder={`Enter ${label.toLowerCase()} name`}
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                        />
                        <TextCursor className="absolute top-3.5 right-3 h-5 w-5 text-gray-500" />
                    </div>
                    {errors.name?.message && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
                </div>

                {/* Description */}
                <div>
                    <label htmlFor="description" className="block text-sm font-medium">
                        Description
                    </label>
                    <input
                        id="description"
                        {...register("description")}
                        type="text"
                        placeholder="Enter Description"
                        className="w-full py-3 px-5 rounded-2xl border border-gray-300"
                    />
                    {errors.description?.message && <p className="text-sm text-red-500">{errors.description.message}</p>}
                </div>

                {/* Image */}
                <div>
                    <label className="flex items-center justify-between text-sm font-medium">
                        <span>Image</span>
                        <div className="relative group">
                            <button type="button" className="text-gray-500 hover:text-black focus:outline-none">
                                <Info size={16} />
                            </button>
                            <div className="absolute right-0 top-3 hidden group-hover:block text-xs rounded p-2 shadow-lg bg-gray-700 text-white">
                                Upload an image <br /> <span className="font-semibold">275 × 474 px</span>
                            </div>
                        </div>
                    </label>
                    <input
                        type="file"
                        accept={SUPPORTED_FORMATS.join(",")}
                        onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setValue("image", file || "");
                            setPreviewImage(file ? URL.createObjectURL(file) : null);
                        }}
                        className="w-full py-3 px-5 rounded-2xl border file:mr-4 file:py-2 file:px-4 file:border-0 file:rounded-lg file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    />
                    {errors.image && <p className="text-xs text-red-500">{String(errors.image.message || '')}</p>}
                    {previewImage && <Image src={previewImage} unoptimized width={600} height={600} alt="Image Preview" className="mt-2 h-24 w-24 rounded object-cover border" />}
                </div>

                {/* Secondary Image */}
                <div>
                    <label className="flex items-center justify-between text-sm font-medium">
                        <span>Secondary Image</span>
                        <div className="relative group">
                            <button type="button" className="text-gray-500 hover:text-black focus:outline-none">
                                <Info size={16} />
                            </button>
                            <div className="absolute right-0 top-3 hidden group-hover:block text-xs rounded p-2 shadow-lg bg-gray-700 text-white">
                                Upload an image <br /> <span className="font-semibold">1500 × 200 px</span>
                            </div>
                        </div>
                    </label>
                    <input
                        type="file"
                        accept={SUPPORTED_FORMATS.join(",")}
                        onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setValue("secondary_image", file || "");
                            setPreviewSecondary(file ? URL.createObjectURL(file) : null);
                        }}
                        className="w-full py-3 px-5 rounded-2xl border file:mr-4 file:py-2 file:px-4 file:border-0 file:rounded-lg file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    />
                    {errors.secondary_image && <p className="text-xs text-red-500">{String(errors.secondary_image.message || '')}</p>}
                    {previewSecondary && <Image src={previewSecondary} unoptimized width={1600} height={600} alt="Secondary Preview" className="mt-2 h-24 w-64 rounded object-cover border" />}
                </div>

                {/* Attributes */}
                {mode === "subcategory" && availableAttributes.length > 0 && (
                    <div>
                        <label className="block text-sm font-medium mb-1">Attributes</label>
                        <div className="flex flex-wrap gap-2">
                            {availableAttributes.map((attr) => {
                                const isSelected = selectedAttributes.includes(attr.id);
                                return (
                                    <div
                                        key={attr.id}
                                        className={`cursor-pointer px-4 py-1 rounded-full text-sm font-medium border transition ${isSelected ? "bg-blue-500 text-white border-blue-500" : "bg-gray-200 text-gray-700 border-gray-300"
                                            }`}
                                        onClick={() => toggleAttribute(attr.id)}
                                    >
                                        {attr.name}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Link */}
                <div>
                    <label htmlFor="link" className="block text-sm font-medium">Link</label>
                    <input
                        id="link"
                        {...register("link")}
                        type="text"
                        placeholder={`Enter ${label.toLowerCase()} link`}
                        className="w-full py-3 px-5 rounded-2xl border border-gray-300"
                    />
                    {errors.link?.message && <p className="text-sm text-red-500">{errors.link.message}</p>}
                </div>

                {/* Status Toggle */}
                <div className="flex items-center gap-3">
                    <label htmlFor="status" className="text-sm font-medium">Status</label>
                    <div
                        className={`relative h-6 w-12 cursor-pointer rounded-full transition ${isChecked ? "bg-blue-500" : "bg-gray-300"}`}
                        onClick={() => setValue("status", !isChecked)}
                    >
                        <input type="checkbox" {...register("status")} hidden id="status" />
                        <div className={`absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow-md transition ${isChecked ? "translate-x-6" : "translate-x-0"}`} />
                    </div>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={isSubmitting || !isValid}
                    className={`w-full rounded-lg px-4 py-3 text-center text-sm font-semibold text-white transition ${isSubmitting || !isValid ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"}`}
                >
                    {isSubmitting ? "Saving..." : "Save"}
                </button>
            </form>
        </Modal>
    );
}
