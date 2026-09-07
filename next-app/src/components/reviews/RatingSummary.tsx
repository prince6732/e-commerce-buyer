// import React from 'react';
// import StarRating from '../ui/StarRating';
// import { ReviewSummary } from '../../../utils/reviewApi';

// interface RatingSummaryProps {
//   summary: ReviewSummary;
//   onRatingFilter?: (rating: number | null) => void;
//   selectedRating?: number | null;
// }

// const RatingSummary: React.FC<RatingSummaryProps> = ({
//   summary,
//   onRatingFilter,
//   selectedRating
// }) => {
//   const { average_rating, total_reviews, rating_distribution } = summary;

//   const getRatingPercentage = (rating: number) => {
//     if (!total_reviews || total_reviews === 0) return 0;
//     const count = rating_distribution[rating] || 0;
//     const percentage = (count / total_reviews) * 100;
//     return isNaN(percentage) ? 0 : percentage;
//   };

//   const handleRatingClick = (rating: number) => {
//     if (onRatingFilter) {
//       const newRating = selectedRating === rating ? null : rating;
//       onRatingFilter(newRating);
//     }
//   };

//   return (
//     <div className="bg-white border border-gray-200 rounded-lg p-5">
//       <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Reviews</h3>
      
//       <div className="flex items-center gap-4 mb-5 pb-5 border-b">
//         <div className="text-center">
//           <div className="text-3xl font-bold text-gray-900 mb-1">{average_rating.toFixed(1)}</div>
//           <StarRating rating={average_rating} size="md" />
//           <p className="text-xs text-gray-500 mt-1">
//             {total_reviews.toLocaleString()} rating{total_reviews !== 1 ? 's' : ''}
//           </p>
//         </div>
//       </div>

//       {/* Rating Distribution */}
//       <div className="space-y-2">
//         {[5, 4, 3, 2, 1].map((rating) => {
//           const count = rating_distribution[rating] || 0;
//           const percentage = getRatingPercentage(rating);
//           const isSelected = selectedRating === rating;

//           return (
//             <div
//               key={rating}
//               onClick={() => handleRatingClick(rating)}
//               className={`flex items-center gap-2 py-1 transition-all cursor-pointer group relative ${isSelected ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
//             >
//               <button className="text-xs text-blue-600 hover:underline font-medium min-w-[35px] text-left">
//                 {rating} star
//               </button>

//               {/* Stars shown on hover only */}
//               <div className="absolute left-16 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 bg-white px-2 py-1 rounded shadow-lg z-10 pointer-events-none">
//                 <StarRating rating={rating} size="sm" />
//               </div>

//               <div className="flex-1 relative">
//                 <div className="w-full bg-gray-200 rounded-sm h-5 overflow-hidden">
//                   <div
//                     className={`h-full transition-all duration-300 ${isSelected ? 'bg-orange-400' : 'bg-orange-300'}`}
//                     style={{ width: `${percentage}%` }}
//                   />
//                 </div>
//               </div>

//               <div className="min-w-[50px] text-right">
//                 <span className="text-xs text-gray-600">
//                   {percentage.toFixed(0)}%
//                 </span>
//               </div>
//             </div>
//           );
//         })}
//       </div>

//       {selectedRating && (
//         <button
//           onClick={() => onRatingFilter && onRatingFilter(null)}
//           className="w-full mt-4 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm font-medium transition-colors"
//         >
//           Clear Filter
//         </button>
//       )}
//     </div>
//   );
// };

// export default RatingSummary;