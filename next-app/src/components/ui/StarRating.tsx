import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  showRatingText?: boolean;
}

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  size = 'md',
  interactive = false,
  onRatingChange,
  showRatingText = false
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const handleStarClick = (starIndex: number) => {
    if (interactive && onRatingChange) {
      onRatingChange(starIndex + 1);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {Array.from({ length: maxRating }, (_, index) => {
          const starNumber = index + 1;
          const isFilled = starNumber <= rating;
          const isPartiallyFilled = starNumber > rating && starNumber - 1 < rating;
          const fillPercentage = isPartiallyFilled ? ((rating % 1) * 100) : 0;

          return (
            <div
              key={index}
              className={`relative ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
              onClick={() => handleStarClick(index)}
            >
              {/* Background star */}
              <Star
                className={`${sizeClasses[size]} text-gray-300 ${interactive ? 'hover:text-yellow-400' : ''
                  }`}
                fill="currentColor"
              />

              {/* Filled star or partial fill */}
              {(isFilled || isPartiallyFilled) && (
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{
                    width: isFilled ? '100%' : `${fillPercentage}%`
                  }}
                >
                  <Star
                    className={`${sizeClasses[size]} text-yellow-500`}
                    fill="currentColor"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showRatingText && (
        <span className="text-sm text-gray-600 ml-1">
          {rating.toFixed(1)} out of {maxRating}
        </span>
      )}
    </div>
  );
};

export default StarRating;