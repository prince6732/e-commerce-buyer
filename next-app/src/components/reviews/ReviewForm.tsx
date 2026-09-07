import React, { useState } from 'react';
import { Send, Image as ImageIcon, Trash2 } from 'lucide-react';
import StarRating from '../ui/StarRating';
import { CreateReviewData, UpdateReviewData } from '../../../utils/reviewApi';
import Image from 'next/image';

interface ReviewFormProps {
    productId: number | string;
    initialData?: {
        rating: number;
        title: string;
        review_text: string;
        images?: string[];
    };
    isEditing?: boolean;
    onSubmit: (data: CreateReviewData | UpdateReviewData) => Promise<void>;
    onCancel: () => void;
    loading?: boolean;
}

const ReviewForm: React.FC<ReviewFormProps> = ({
    productId,
    initialData,
    isEditing = false,
    onSubmit,
    onCancel,
    loading = false
}) => {
    const [formData, setFormData] = useState({
        rating: initialData?.rating || 0,
        title: initialData?.title || '',
        review_text: initialData?.review_text || (initialData as any)?.reviewText || ''
    });
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
    const [existingImages, setExistingImages] = useState<string[]>(initialData?.images || []);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    const MAX_IMAGES = 5;

    React.useEffect(() => {
        if (initialData) {
            setFormData({
                rating: initialData.rating || 0,
                title: initialData.title || '',
                review_text: initialData.review_text || (initialData as any).reviewText || ''
            });
            setExistingImages(initialData.images || []);
        }
    }, [initialData]);

    const getReviewImageUrl = (path: string) => {
        if (!path) return '';
        if (path.startsWith('http') || path.startsWith('data:')) return path;
        const baseUrl = process.env.NEXT_PUBLIC_UPLOAD_BASE || 'https://api.zelton.co.in';
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        if (cleanPath.startsWith('/storage/')) {
            return `${baseUrl}${cleanPath}`;
        }
        return `${baseUrl}/storage/${cleanPath.replace(/^\//, '')}`;
    };


    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const currentCount = existingImages.length + selectedImages.length;
        const remainingSlots = MAX_IMAGES - currentCount;

        if (remainingSlots <= 0) {
            setErrors(prev => ({ ...prev, images: `You can only upload up to ${MAX_IMAGES} images.` }));
            e.target.value = '';
            return;
        }

        let filesToAdd = files;
        if (files.length > remainingSlots) {
            setErrors(prev => ({ ...prev, images: `Maximum ${MAX_IMAGES} images allowed. Only the first ${remainingSlots} images were added.` }));
            filesToAdd = files.slice(0, remainingSlots);
        } else {
            setErrors(prev => ({ ...prev, images: '' }));
        }

        // Validate file sizes (max 5MB each)
        const oversizedFiles = filesToAdd.filter(file => file.size > 5 * 1024 * 1024);
        if (oversizedFiles.length > 0) {
            setErrors(prev => ({ ...prev, images: 'Each image must be less than 5MB' }));
            e.target.value = '';
            return;
        }

        setSelectedImages(prev => [...prev, ...filesToAdd]);

        // Create preview URLs
        filesToAdd.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreviewUrls(prev => [...prev, reader.result as string]);
            };
            reader.readAsDataURL(file);
        });

        e.target.value = '';
    };

    const removeSelectedImage = (index: number) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== index));
        setImagePreviewUrls(prev => prev.filter((_, i) => i !== index));
    };

    const removeExistingImage = (imagePath: string) => {
        setExistingImages(prev => prev.filter(img => img !== imagePath));
    };

    const validateForm = () => {
        const newErrors: { [key: string]: string } = {};

        if (formData.rating === 0) {
            newErrors.rating = 'Please select a rating';
        }

        if (formData.title.trim().length < 3) {
            newErrors.title = 'Title must be at least 3 characters';
        }

        if (formData.review_text.trim().length < 10) {
            newErrors.review_text = 'Review must be at least 10 characters';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        try {
            const submitData = isEditing
                ? {
                    ...formData,
                    images: selectedImages,
                    existing_images: existingImages
                }
                : {
                    ...formData,
                    product_id: productId,
                    images: selectedImages
                };

            await onSubmit(submitData);
            // Close the form after successful submission
            onCancel();
        } catch (error) {
            console.error('Error submitting review:', error);
        }
    };

    const handleRatingChange = (rating: number) => {
        setFormData(prev => ({ ...prev, rating }));
        if (errors.rating) {
            setErrors(prev => ({ ...prev, rating: '' }));
        }
    };

    return (
        <div className="bg-white rounded-lg p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Rating Section */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rating <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                        <StarRating
                            rating={formData.rating}
                            interactive={true}
                            onRatingChange={handleRatingChange}
                            size="md"
                        />
                        <span className="text-xs text-gray-600">
                            {formData.rating > 0 && `${formData.rating} star${formData.rating !== 1 ? 's' : ''}`}
                        </span>
                    </div>
                    {errors.rating && (
                        <p className="mt-1 text-xs text-red-600">{errors.rating}</p>
                    )}
                </div>

                {/* Title Section */}
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Review Title <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        id="title"
                        value={formData.title}
                        onChange={(e) => {
                            setFormData(prev => ({ ...prev, title: e.target.value }));
                            if (errors.title) setErrors(prev => ({ ...prev, title: '' }));
                        }}
                        placeholder="Sum up your review"
                        className={`w-full px-3 text-black py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${errors.title ? 'border-red-300' : 'border-gray-300'
                            }`}
                        maxLength={100}
                    />
                    <div className="flex justify-between mt-1">
                        {errors.title ? (
                            <p className="text-xs text-red-600">{errors.title}</p>
                        ) : (
                            <div></div>
                        )}
                        <span className="text-xs text-gray-400">
                            {formData.title.length}/100
                        </span>
                    </div>
                </div>

                {/* Review Text Section */}
                <div>
                    <label htmlFor="review_text" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Your Review <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        id="review_text"
                        value={formData.review_text}
                        onChange={(e) => {
                            setFormData(prev => ({ ...prev, review_text: e.target.value }));
                            if (errors.review_text) setErrors(prev => ({ ...prev, review_text: '' }));
                        }}
                        placeholder="Share your thoughts about this product..."
                        rows={4}
                        className={`w-full text-black px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-vertical ${errors.review_text ? 'border-red-300' : 'border-gray-300'
                            }`}
                        maxLength={1000}
                    />
                    <div className="flex justify-between mt-1">
                        {errors.review_text ? (
                            <p className="text-xs text-red-600">{errors.review_text}</p>
                        ) : (
                            <div></div>
                        )}
                        <span className="text-xs text-gray-400">
                            {formData.review_text.length}/1000
                        </span>
                    </div>
                </div>

                {/* Image Upload Section */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Add Photos (Optional)
                    </label>
                    <p className="text-xs text-gray-500 mb-2">Upload up to {MAX_IMAGES} images (max 5MB each)</p>

                    {/* Image Preview Grid */}
                    <div className="grid grid-cols-5 gap-2 mb-2">
                        {/* Existing Images */}
                        {existingImages.map((imagePath, index) => (
                            <div key={`existing-${index}`} className="relative aspect-square border border-gray-200 rounded-lg overflow-hidden group">
                                <img
                                    src={getReviewImageUrl(imagePath)}
                                    alt={`Review image ${index + 1}`}
                                    className="w-full h-full object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeExistingImage(imagePath)}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}

                        {/* New Image Previews */}
                        {imagePreviewUrls.map((url, index) => (
                            <div key={`new-${index}`} className="relative aspect-square border border-gray-200 rounded-lg overflow-hidden group">
                                <Image
                                    src={url}
                                    alt={`Preview ${index + 1}`}
                                    fill
                                    className="object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeSelectedImage(index)}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}

                        {/* Upload Button */}
                        {(existingImages.length + selectedImages.length) < MAX_IMAGES && (
                            <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                                <ImageIcon className="w-6 h-6 text-gray-400" />
                                <span className="text-xs text-gray-500 mt-1">Add</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageSelect}
                                    className="hidden"
                                />
                            </label>
                        )}
                    </div>

                    {errors.images && (
                        <p className="text-xs text-red-600 mt-1">{errors.images}</p>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg font-medium hover:bg-gray-50 transition-colors"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading || formData.rating === 0}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                {isEditing ? 'Update' : 'Submit'}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ReviewForm;