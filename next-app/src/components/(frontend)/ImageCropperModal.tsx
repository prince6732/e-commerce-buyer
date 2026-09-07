"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Cropper, { ReactCropperElement } from "react-cropper";
import "cropperjs/dist/cropper.css";
import axios from "../../../utils/axios";
import Modal from "../(sheared)/Modal";
import { Image, Trash2, Crop, RotateCw, RotateCcw, RefreshCw } from "lucide-react";
import { getImageUrl } from "../../../utils/imageUtils";

export interface ImageItem {
    url: string;
    selected: boolean;
}

type Props = {
    multiple?: boolean;
    onSelect: (imgs: string[] | string) => void;
    buttonLabel?: string;
    className?: string;
    directory?: string;
    aspectRatio?: number;
};

const FRAME_OPTIONS = [
    { label: "Free", ratio: 0, description: "Custom" },
    { label: "1:1", ratio: 1, description: "Square" },
    { label: "4:3", ratio: 4 / 3, description: "Landscape" },
    { label: "16:9", ratio: 16 / 9, description: "Banner" },
    { label: "3:4", ratio: 3 / 4, description: "Portrait" },
    { label: "9:16", ratio: 9 / 16, description: "Story" },
    { label: "2:1", ratio: 2 / 1, description: "Wide Header" },
];

export default function ImageCropperModal({
    multiple = false,
    onSelect,
    buttonLabel = "Select Image",
    className = "",
    directory = "products",
    aspectRatio,
}: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [images, setImages] = useState<ImageItem[]>([]);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isCropping, setIsCropping] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [imageToDelete, setImageToDelete] = useState<string | null>(null);

    const [activeAspectRatio, setActiveAspectRatio] = useState<number>(aspectRatio ?? 0);

    const cropperRef = useRef<ReactCropperElement>(null);

    useEffect(() => {
        if (!selectedImage) {
            setActiveAspectRatio(aspectRatio ?? 0);
        }
    }, [selectedImage, aspectRatio]);

    const handleSelectFrame = (ratio: number) => {
        setActiveAspectRatio(ratio);
        if (cropperRef.current?.cropper) {
            cropperRef.current.cropper.setAspectRatio(ratio > 0 ? ratio : NaN);
        }
    };

    const handleRotate = (degree: number) => {
        if (cropperRef.current?.cropper) {
            cropperRef.current.cropper.rotate(degree);
        }
    };

    const handleReset = () => {
        if (cropperRef.current?.cropper) {
            cropperRef.current.cropper.reset();
            const resetRatio = aspectRatio ?? 0;
            setActiveAspectRatio(resetRatio);
            cropperRef.current.cropper.setAspectRatio(resetRatio > 0 ? resetRatio : NaN);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const url = URL.createObjectURL(e.target.files[0]);
            setSelectedImage(url);
            setActiveAspectRatio(aspectRatio ?? 0);
        }
    };

    const fetchImages = async () => {
        try {
            const res = await axios.get(`/api/images/get-files/${directory}`);
            const imgs: ImageItem[] = res.data.map((url: string) => ({ url, selected: false }));
            setImages(imgs);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCropSave = async () => {
        const cropper = cropperRef.current?.cropper;
        if (!cropper || !selectedImage) return;

        // Obtain canvas of exact selected region BEFORE triggering any state re-render
        const canvas = cropper.getCroppedCanvas({
            fillColor: "#ffffff",
            imageSmoothingEnabled: true,
            imageSmoothingQuality: "high",
        });

        if (!canvas) {
            alert("Could not get cropped canvas");
            return;
        }

        setIsCropping(true);

        try {
            const blob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((b) => resolve(b), "image/png");
            });

            if (!blob) throw new Error("Could not create blob from canvas");

            const formData = new FormData();
            formData.append("directory", directory);
            formData.append("image", blob, "cropped_image.png");

            const res = await axios.post("/api/images/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                params: { directory },
            });

            const uploadedUrl: string = res.data.result;
            if (!uploadedUrl) throw new Error("No image URL returned from server");

            const finalUrl = uploadedUrl.startsWith("http") ? uploadedUrl : `${uploadedUrl}`;

            onSelect(finalUrl);
            setSelectedImage(null);
            setActiveAspectRatio(0);
            setImages((prev) => [...prev, { url: finalUrl, selected: true }]);
        } catch (err) {
            console.error(err);
            alert("Failed to upload cropped image.");
        } finally {
            setIsCropping(false);
        }
    };

    const toggleSelect = (index: number) => {
        setImages((prev) => {
            return multiple
                ? prev.map((img, i) =>
                    i === index ? { ...img, selected: !img.selected } : img
                )
                : prev.map((img, i) => {
                    if (i === index) {
                        const isCurrentlySelected = img.selected;
                        return { ...img, selected: !isCurrentlySelected };
                    } else {
                        return { ...img, selected: false };
                    }
                });
        });
    };

    const confirmDeleteImage = (url: string) => {
        setImageToDelete(url);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteConfirmed = async () => {
        if (!imageToDelete) return;
        try {
            const res = await axios.delete("/api/images", { data: { path: imageToDelete } });
            if (res.data?.isSuccess) {
                setImages((prev) => prev.filter((img) => img.url !== imageToDelete));
                setIsDeleteModalOpen(false);
                setImageToDelete(null);
            } else {
                alert(res.data?.message || "Failed to delete image.");
            }
        } catch (err) {
            console.error(err);
            alert("Error deleting image.");
        }
    };

    const handleDone = () => {
        const selectedImgs = images.filter((img) => img.selected).map((img) => img.url);
        onSelect(multiple ? selectedImgs : selectedImgs[0] || "");
        setIsOpen(false);
        setSelectedImage(null);
        setActiveAspectRatio(0);
        setImages([]);
    };

    const handleClose = () => {
        setIsOpen(false);
        setSelectedImage(null);
        setActiveAspectRatio(0);
    };

    const openModal = () => {
        setIsOpen(true);
        setActiveAspectRatio(0);
        fetchImages();
    };

    return (
        <div>
            <button
                type="button"
                onClick={openModal}
                className={className || `flex items-center gap-2 px-4 py-2 mt-2
                        bg-gradient-to-r from-[#007FFF] to-[#0055CC]
                        hover:from-[#0066CC] hover:to-[#0044BB]
                        rounded-xl shadow-md text-white font-semibold
                        hover:shadow-lg transition-all duration-200`}>
                <Image size={16} />
                {buttonLabel}
            </button>

            {typeof window !== 'undefined' && createPortal(
                <>
                    <Modal isOpen={isOpen} onClose={handleClose} title="Select Image" width="max-w-4xl" zIndex="z-[99999]">
                        {!selectedImage ? (
                            <div className="space-y-4">
                                <label className="btn btn-secondary mb-4 cursor-pointer bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md inline-block">
                                    Upload Image
                                    <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                                </label>

                                {images.length > 0 && (
                                    <div className="max-h-[290px] overflow-y-auto pr-2">
                                        <div className="grid grid-cols-4 gap-4">
                                            {images.map((img, i) => (
                                                <div key={i} className="relative group cursor-pointer">
                                                    <img
                                                        src={getImageUrl(img.url) || ""}
                                                        className="w-full h-28 object-cover border rounded-md"
                                                        onClick={() => toggleSelect(i)}
                                                    />

                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            confirmDeleteImage(img.url);
                                                        }}
                                                        className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition"
                                                        title="Delete image"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>

                                                    <input
                                                        type="checkbox"
                                                        checked={img.selected}
                                                        onChange={() => toggleSelect(i)}
                                                        className="absolute top-2 left-2 w-5 h-5 cursor-pointer accent-blue-600"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100"
                                    >
                                        Cancel
                                    </button>
                                    {images.some((img) => img.selected) && (
                                        <button
                                            type="button"
                                            onClick={handleDone}
                                            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md"
                                        >
                                            Done
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col w-full h-[580px] bg-gray-900 rounded-xl overflow-hidden shadow-inner border border-gray-700">
                                {/* Frame Size Selection Header */}
                                <div className="bg-gray-800/90 backdrop-blur-md px-3 py-2 border-b border-gray-700 flex flex-wrap items-center justify-between gap-2 z-[10]">
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <Crop size={15} className="text-[#007FFF]" />
                                        <span className="text-xs font-semibold text-gray-200">Frame Size:</span>
                                    </div>
                                    <div className="flex items-center gap-1 overflow-x-auto max-w-full py-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                        {FRAME_OPTIONS.map((frame) => {
                                            const isSelected = isNaN(frame.ratio)
                                                ? isNaN(activeAspectRatio)
                                                : activeAspectRatio === frame.ratio;
                                            return (
                                                <button
                                                    key={frame.label}
                                                    type="button"
                                                    onClick={() => handleSelectFrame(frame.ratio)}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all flex-shrink-0 ${isSelected
                                                        ? "bg-gradient-to-r from-[#007FFF] to-[#0055CC] text-white shadow-sm font-bold"
                                                        : "bg-gray-700/80 hover:bg-gray-700 text-gray-300 hover:text-white"
                                                        }`}
                                                >
                                                    <span>{frame.label}</span>
                                                    <span className="text-[10px] opacity-75 font-normal">({frame.description})</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Cropper Workspace */}
                                <div className="flex-1 relative bg-black/40 overflow-hidden">
                                    <Cropper
                                        src={selectedImage}
                                        style={{ height: "450px", width: "100%" }}
                                        guides={true}
                                        ref={cropperRef}
                                        viewMode={1}
                                        dragMode="move"
                                        scalable={true}
                                        cropBoxMovable={true}
                                        cropBoxResizable={true}
                                        checkOrientation={true}
                                        checkCrossOrigin={true}
                                        background={true}
                                        aspectRatio={activeAspectRatio > 0 ? activeAspectRatio : NaN}
                                        autoCropArea={0.8}
                                    />
                                </div>

                                {/* Action Controls Footer */}
                                <div className="bg-gray-800/90 backdrop-blur-md px-4 py-3 border-t border-gray-700 flex items-center justify-between z-[10]">
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleRotate(-90)}
                                            className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition"
                                            title="Rotate Left 90°"
                                        >
                                            <RotateCcw size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleRotate(90)}
                                            className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition"
                                            title="Rotate Right 90°"
                                        >
                                            <RotateCw size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleReset}
                                            className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition"
                                            title="Reset Crop Box"
                                        >
                                            <RefreshCw size={16} />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedImage(null)}
                                            className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold rounded-xl transition duration-200 text-sm"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCropSave}
                                            disabled={isCropping}
                                            className={`px-6 py-2 rounded-xl font-semibold text-white text-sm shadow-md transition duration-200 ${isCropping ? "bg-gray-500 cursor-not-allowed" : "bg-gradient-to-r from-[#007FFF] to-[#0055CC] hover:from-[#0066CC] hover:to-[#0044BB]"}`}
                                        >
                                            {isCropping ? "Cropping..." : "Crop"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Modal>

                    <Modal
                        isOpen={isDeleteModalOpen}
                        onClose={() => setIsDeleteModalOpen(false)}
                        title="Delete Image"
                        width="max-w-md"
                        zIndex="z-[99999]"
                    >
                        <div className="text-center space-y-4">
                            <p className="text-gray-700">Are you sure you want to delete this image?</p>
                            <div className="flex justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 text-black"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteConfirmed}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </Modal>
                </>,
                document.body
            )}
        </div>
    );
}

