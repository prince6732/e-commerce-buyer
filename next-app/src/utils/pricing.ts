/**
 * Pricing Utility Helper for Application-Wide Consistent Pricing Logic
 * 
 * Pricing Business Rules:
 * 1. Current Selling Price = Base Price (BP) / Selling Price (sp)
 * 2. Original/Strikethrough Price = MRP (mrp)
 * 3. Buying Price (bp) = Cost price from supplier. Internal use ONLY (profit/loss). NEVER show on customer UI/API.
 * 4. Discount = Math.round(((MRP - BP) / MRP) * 100)
 * 5. If MRP <= BP, discount is 0% OFF and strikethrough price is hidden/not discounted.
 */

export interface PricingResult {
  sp: number;            // Current Selling Price (Base Price / BP)
  mrp: number;           // Original Retail Price (MRP)
  discountPct: number;   // Discount percentage rounded to whole number
  hasDiscount: boolean;   // True if MRP > SP and SP > 0
  formattedSp: string;   // Formatted SP (e.g. ₹321)
  formattedMrp: string;  // Formatted MRP (e.g. ₹432)
  savingsAmount: number; // MRP - SP
  formattedSavings: string;
}

export function calculateDiscount(mrp: number, sp: number): number {
  if (!mrp || mrp <= 0 || !sp || sp <= 0 || mrp <= sp) {
    return 0;
  }
  return Math.round(((mrp - sp) / mrp) * 100);
}

export function formatPrice(price?: number | string | null): string {
  const numeric = typeof price === "string" ? parseFloat(price) : price;
  if (numeric == null || isNaN(numeric)) return "₹0";
  return `₹${Math.round(numeric).toLocaleString("en-IN")}`;
}

export function getPricing(mrpInput?: number | string | null, spInput?: number | string | null): PricingResult {
  const sp = parseFloat(String(spInput ?? 0)) || 0;
  const mrp = parseFloat(String(mrpInput ?? 0)) || 0;

  const discountPct = calculateDiscount(mrp, sp);
  const hasDiscount = discountPct > 0;
  const savingsAmount = hasDiscount ? Math.max(0, mrp - sp) : 0;

  return {
    sp,
    mrp,
    discountPct,
    hasDiscount,
    formattedSp: formatPrice(sp),
    formattedMrp: formatPrice(mrp),
    savingsAmount,
    formattedSavings: formatPrice(savingsAmount),
  };
}

export function extractProductPricing(productOrVariant: any): PricingResult {
  if (!productOrVariant) {
    return getPricing(0, 0);
  }

  const variant = productOrVariant.best_variant || (productOrVariant.variants && productOrVariant.variants[0]) || productOrVariant;
  const sp = variant?.sp != null ? parseFloat(String(variant.sp)) : (productOrVariant.min_price ?? 0);
  const mrp = variant?.mrp != null ? parseFloat(String(variant.mrp)) : (productOrVariant.max_price ?? 0);

  return getPricing(mrp, sp);
}
