/**
 * Utility functions for slug generation and entity slug resolution.
 */

export const slugify = (text?: string | null): string => {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove all non-word chars except spaces & hyphens
    .replace(/[\s_-]+/g, "-") // Replace spaces, underscores, and multiple hyphens with a single hyphen
    .replace(/^-+|-+$/g, ""); // Remove leading and trailing hyphens
};

export const getCategorySlug = (category: any): string => {
  if (!category) return "";
  if (category.slug && typeof category.slug === "string" && category.slug.trim()) {
    return category.slug.trim();
  }
  const fromName = slugify(category.name);
  if (fromName) return fromName;
  return category.id ? String(category.id) : "";
};

export const getProductSlug = (product: any): string => {
  if (!product) return "";
  if (product.slug && typeof product.slug === "string" && product.slug.trim()) {
    return product.slug.trim();
  }
  const fromName = slugify(product.name);
  if (fromName) return fromName;
  if (product.item_code || product.itemCode) {
    return slugify(product.item_code || product.itemCode);
  }
  return product.id ? String(product.id) : "";
};

export const getUserSlug = (user: any): string => {
  if (!user) return "";
  if (user.slug && typeof user.slug === "string" && user.slug.trim()) {
    return user.slug.trim();
  }
  const fromName = slugify(user.name);
  if (fromName) return fromName;
  return user.id ? String(user.id) : "";
};

export const getOrderSlug = (order: any): string => {
  if (!order) return "";
  if (order.order_number && typeof order.order_number === "string" && order.order_number.trim()) {
    return order.order_number.trim();
  }
  if (order.orderNumber && typeof order.orderNumber === "string" && order.orderNumber.trim()) {
    return order.orderNumber.trim();
  }
  if (order.slug && typeof order.slug === "string" && order.slug.trim()) {
    return order.slug.trim();
  }
  return order.id ? String(order.id) : "";
};

export const getBrandSlug = (brand: any): string => {
  if (!brand) return "";
  if (brand.slug && typeof brand.slug === "string" && brand.slug.trim()) {
    return brand.slug.trim();
  }
  const fromName = slugify(brand.name);
  if (fromName) return fromName;
  return brand.id ? String(brand.id) : "";
};
