"use client";

import React, { useState } from 'react';
import { Star, Edit, Trash2, Shield, User as UserIcon, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Review } from '../../../utils/reviewApi';

interface ReviewCardProps {
  review: Review;
  currentUserId?: number;
  onEdit?: (review: Review) => void;
  onDelete?: (reviewId: number) => void;
  onToggleHelpful?: (reviewId: number) => Promise<{ helpful_count: number; is_helpful: boolean }>;
}

const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  currentUserId,
  onEdit,
  onDelete,
  onToggleHelpful
}) => {
  const [isHelpful, setIsHelpful] = useState(false);
  const [helpfulCount, setHelpfulCount] = useState((review.helpful_count ?? (review as any).helpfulCount) || 0);
  const [helpfulLoading, setHelpfulLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [reported, setReported] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  const isOwnReview = currentUserId != null && (
    Number(currentUserId) === Number(review.user_id) ||
    Number(currentUserId) === Number((review as any).userId) ||
    Number(currentUserId) === Number(review.user?.id)
  );

  const handleToggleHelpful = async () => {
    if (!onToggleHelpful || isOwnReview) return;

    setHelpfulLoading(true);
    try {
      const result = await onToggleHelpful(review.id);
      setIsHelpful(result.is_helpful);
      setHelpfulCount(result.helpful_count);
    } catch (error) {
      console.error('Error toggling helpful:', error);
    } finally {
      setHelpfulLoading(false);
    }
  };

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

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const userName = review.user_name || review.user?.name || (review as any).userName || "Verified Customer";
  const profilePic = review.user?.profile_picture || (review as any).profile_picture;
  const rawDate = review.created_at || (review as any).createdAt;
  const formattedDate = formatDate(rawDate);

  const rating = Math.max(1, Math.min(5, review.rating || 5));
  const reviewTitle = review.title || (review as any).title;
  const reviewText = review.review_text || (review as any).reviewText || "";
  const isVerified = review.is_verified ?? (review as any).isVerified ?? true;
  const images: string[] = review.images || (review as any).images || [];

  const shouldTruncate = reviewText.length > 350;
  const displayText = shouldTruncate && !isExpanded ? `${reviewText.slice(0, 350)}...` : reviewText;

  return (
    <div className="py-4 border-b border-gray-200 last:border-b-0 space-y-2 text-[#0F1111]">
      {/* ── 1. Amazon Profile Row: Avatar & Name ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[#E9EBEB] flex items-center justify-center flex-shrink-0 text-gray-500">
            {profilePic ? (
              <img
                src={getReviewImageUrl(profilePic)}
                alt={userName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <UserIcon className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-[#0F1111] font-medium leading-none">
              {userName}
            </span>
            {isOwnReview && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Shield className="w-2.5 h-2.5" />
                Your Review
              </span>
            )}
          </div>
        </div>

        {/* Actions for Own Review */}
        {isOwnReview && (
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(review)}
                className="text-xs text-[#007185] hover:text-[#C7511F] hover:underline cursor-pointer flex items-center gap-1 font-medium"
              >
                <Edit className="w-3 h-3" />
                <span>Edit</span>
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(review.id)}
                className="text-xs text-red-600 hover:text-red-800 hover:underline cursor-pointer flex items-center gap-1 font-medium"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── 2. Amazon Star Rating & Headline ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              className={`w-4 h-4 ${s <= rating
                  ? 'fill-[#DE7921] text-[#DE7921]'
                  : 'fill-gray-200 text-gray-300'
                }`}
            />
          ))}
        </div>
        {reviewTitle && (
          <span className="font-bold text-sm sm:text-[15px] text-[#0F1111] leading-snug">
            {reviewTitle}
          </span>
        )}
      </div>

      {/* ── 3. Date & Country ── */}
      {formattedDate && (
        <div className="text-xs text-[#565959]">
          Reviewed in India on {formattedDate}
        </div>
      )}

      {/* ── 4. Variant Info & Verified Purchase ── */}
      <div className="flex items-center gap-2 text-xs text-[#565959] flex-wrap">
        {isVerified && (
          <span className="text-[#C45500] font-bold">
            Verified Purchase
          </span>
        )}
      </div>

      {/* ── 5. Review Body Text ── */}
      {reviewText && (
        <div className="text-sm text-[#0F1111] leading-relaxed pt-0.5">
          <p className="whitespace-pre-line break-words">{displayText}</p>
          {shouldTruncate && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-[#007185] hover:text-[#C7511F] hover:underline font-medium mt-1 cursor-pointer block"
            >
              {isExpanded ? 'Read less' : 'Read more'}
            </button>
          )}
        </div>
      )}

      {/* ── 6. Review Images ── */}
      {images && images.length > 0 && (
        <div className="flex items-center gap-2.5 pt-2 pb-1 flex-wrap">
          {images.map((img, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedPhotoIndex(idx)}
              className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border border-gray-300 cursor-pointer hover:opacity-90 transition bg-gray-50 flex-shrink-0"
            >
              <img
                src={getReviewImageUrl(img)}
                alt={`Customer review photo ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* ── 7. Amazon Footer: Helpful Count, Helpful Button & Report ── */}
      <div className="space-y-2 pt-1">
        {helpfulCount > 0 && (
          <p className="text-xs text-[#565959]">
            {helpfulCount} {helpfulCount === 1 ? 'person' : 'people'} found this helpful
          </p>
        )}

        <div className="flex items-center gap-3 pt-0.5">
          {!isOwnReview && onToggleHelpful && (
            <button
              onClick={handleToggleHelpful}
              disabled={helpfulLoading}
              className={`px-5 py-1 rounded-[8px] text-xs sm:text-sm font-normal border transition shadow-[0_2px_5px_rgba(213,217,217,0.5)] cursor-pointer ${isHelpful
                  ? 'bg-amber-50 border-[#DE7921] text-[#DE7921] font-medium'
                  : 'bg-white border-[#D5D9D9] text-[#0F1111] hover:bg-[#F7FAFA]'
                } disabled:opacity-50`}
            >
              {helpfulLoading ? '...' : isHelpful ? 'Helpful ✓' : 'Helpful'}
            </button>
          )}

          {!isOwnReview && (
            <>
              <span className="text-[#D5D9D9]">|</span>
              <button
                onClick={() => setReported(true)}
                className="text-xs text-[#565959] hover:text-[#0F1111] hover:underline cursor-pointer"
              >
                {reported ? 'Reported' : 'Report'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Lightbox Modal for Review Photo ── */}
      {selectedPhotoIndex !== null && images && images.length > 0 && (
        <div
          className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedPhotoIndex(null)}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] w-full bg-black rounded-lg overflow-hidden flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPhotoIndex(null)}
              className="absolute top-3 right-3 z-10 text-white bg-black/50 hover:bg-black p-1.5 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            {images.length > 1 && (
              <button
                onClick={() =>
                  setSelectedPhotoIndex((prev) =>
                    prev !== null ? (prev > 0 ? prev - 1 : images.length - 1) : 0
                  )
                }
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-white bg-black/50 hover:bg-black p-2 rounded-full"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <img
              src={getReviewImageUrl(images[selectedPhotoIndex])}
              alt="Full view"
              className="max-h-[80vh] max-w-full object-contain"
            />

            {images.length > 1 && (
              <button
                onClick={() =>
                  setSelectedPhotoIndex((prev) =>
                    prev !== null ? (prev < images.length - 1 ? prev + 1 : 0) : 0
                  )
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-white bg-black/50 hover:bg-black p-2 rounded-full"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewCard;