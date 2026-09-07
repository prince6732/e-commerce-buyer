import React from "react";

export interface ZeltonLoaderProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "brand" | "white" | "navy" | "current" | "gray";
  className?: string;
}

const sizeConfig = {
  xs: "w-3.5 h-3.5 border-2",
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-10 h-10 border-3",
  xl: "w-14 h-14 border-4",
};

const variantConfig = {
  brand: "border-[#007FFF]/20 border-t-[#007FFF]",
  white: "border-white/30 border-t-white",
  navy: "border-[#0c2340]/20 border-t-[#0c2340]",
  gray: "border-gray-200 border-t-gray-600",
  current: "border-current/20 border-t-current",
};

export default function ZeltonLoader({
  size = "md",
  variant = "brand",
  className = "",
}: ZeltonLoaderProps) {
  return (
    <div
      className={`rounded-full animate-spin ${sizeConfig[size]} ${variantConfig[variant]} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
