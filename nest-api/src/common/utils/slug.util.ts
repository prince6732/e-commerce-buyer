/**
 * Utility functions for generating and matching URL slugs across entities.
 */

// Format 1: Strips punctuation characters (e.g. apostrophes in "Men's" -> "mens") - Matches Next.js slugify
export function slugifyStrip(text?: string | null): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Format 2: Hyphenates non-alphanumeric characters (e.g. "Men's" -> "men-s")
export function slugifyHyphen(text?: string | null): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Generates the primary slug (matching frontend slugify)
export function slugify(text?: string | null): string {
  return slugifyStrip(text);
}

/**
 * Checks if a given item (with .id, .name, .slug, .itemCode) matches a raw target ID or slug.
 * Supports numeric ID, explicit slug, itemCode, name equality, stripped-punctuation slug,
 * hyphenated slug, and alphanumeric equivalence.
 */
export function matchesSlugOrId(item: any, rawSlugOrId: string | number): boolean {
  if (!item || rawSlugOrId === undefined || rawSlugOrId === null) return false;

  const target = String(rawSlugOrId).toLowerCase().trim();
  if (!target) return false;

  const decodedTarget = decodeURIComponent(target).toLowerCase().trim();

  // 1. Direct ID match
  if (item.id !== undefined && item.id !== null) {
    const idStr = String(item.id);
    if (idStr === target || idStr === decodedTarget) return true;
  }

  // 2. Explicit slug column
  if (item.slug && typeof item.slug === 'string') {
    const s = item.slug.toLowerCase().trim();
    if (s === target || s === decodedTarget) return true;
    const s1 = slugifyStrip(s);
    const s2 = slugifyHyphen(s);
    if (s1 === target || s1 === decodedTarget || s2 === target || s2 === decodedTarget) return true;
  }

  // 3. Item code match
  const itemCode = item.itemCode || item.item_code;
  if (itemCode && typeof itemCode === 'string') {
    const code = itemCode.toLowerCase().trim();
    if (code === target || code === decodedTarget) return true;
    const c1 = slugifyStrip(code);
    const c2 = slugifyHyphen(code);
    if (c1 === target || c1 === decodedTarget || c2 === target || c2 === decodedTarget) return true;
  }

  // 4. Name match
  if (item.name && typeof item.name === 'string') {
    const nameLower = item.name.toLowerCase().trim();
    if (nameLower === target || nameLower === decodedTarget) return true;

    const n1 = slugifyStrip(nameLower);
    if (n1 === target || n1 === decodedTarget) return true;

    const n2 = slugifyHyphen(nameLower);
    if (n2 === target || n2 === decodedTarget) return true;

    // Alphanumeric comparison (ignores all hyphens/underscores/punctuation differences)
    const cleanTarget = target.replace(/[^a-z0-9]/g, '');
    const cleanDecoded = decodedTarget.replace(/[^a-z0-9]/g, '');
    const cleanName = nameLower.replace(/[^a-z0-9]/g, '');
    if (cleanName && (cleanTarget === cleanName || cleanDecoded === cleanName)) {
      return true;
    }
  }

  return false;
}

/**
 * Returns the slug / identifier to be used in URLs for orders (orderNumber, slug, or fallback to ID).
 */
export function getOrderSlug(order: any): string {
  if (!order) return '';
  if (typeof order === 'string' && order.trim()) return order.trim();
  if (order.orderNumber && typeof order.orderNumber === 'string' && order.orderNumber.trim()) {
    return order.orderNumber.trim();
  }
  if (order.order_number && typeof order.order_number === 'string' && order.order_number.trim()) {
    return order.order_number.trim();
  }
  if (order.slug && typeof order.slug === 'string' && order.slug.trim()) {
    return order.slug.trim();
  }
  return order.id ? String(order.id) : '';
}
