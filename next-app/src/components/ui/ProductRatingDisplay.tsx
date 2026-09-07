import React from 'react';
import StarRating from './StarRating';

interface ProductRatingDisplayProps {
  averageRating: number;
  reviewCount: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  className?: string;
}

const ProductRatingDisplay: React.FC<ProductRatingDisplayProps> = ({
  averageRating,
  reviewCount,
  size = 'sm',
  showCount = true,
  className = ''
}) => {
  if (reviewCount === 0) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <StarRating rating={0} size={size} />
        <span className="text-sm text-gray-500">No reviews yet</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <StarRating rating={averageRating} size={size} />
      <span className="text-sm text-gray-600">
        {averageRating.toFixed(1)}
        {showCount && (
          <span className="text-gray-500">
            {' '}({reviewCount} review{reviewCount !== 1 ? 's' : ''})
          </span>
        )}
      </span>
    </div>
  );
};

export default ProductRatingDisplay;