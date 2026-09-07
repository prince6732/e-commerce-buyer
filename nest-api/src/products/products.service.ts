
import { Injectable, Inject, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and, like, desc, inArray, or, sql, ne, isNull } from 'drizzle-orm';
import * as jwt from 'jsonwebtoken';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import {
  products,
  variants,
  variantAttributeValues,
  itemAttributes,
  productAttributeValues,
  categoryAttributes,
  attributeValues,
  attributes,
  categories,
  brands,
  carts,
  likes,
  orders,
  orderItems,
  reviews,
  users,
} from '../database/schema';

import { ProductsGateway } from './products.gateway';
import { matchesSlugOrId, slugify } from '../common/utils/slug.util';

@Injectable()
export class ProductsService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private configService: ConfigService,
    private productsGateway: ProductsGateway,
  ) { }

  private async checkIfAdmin(req?: any): Promise<boolean> {
    if (!req) return false;
    if (req.user && (req.user.role === 'Admin' || req.user.role === 'admin')) return true;

    try {
      const authHeader = req.headers?.authorization || req.headers?.Authorization;
      if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (token) {
          const secret = this.configService?.get<string>('JWT_SECRET', 'super_secret_jwt_key_zelton_2026') || process.env.JWT_SECRET || 'super_secret_jwt_key_zelton_2026';
          const decoded: any = jwt.verify(token, secret);
          if (decoded && (decoded.role === 'Admin' || decoded.role === 'admin')) {
            return true;
          }
          if (decoded?.sub) {
            const user = await this.db.query.users.findFirst({
              where: eq(users.id, Number(decoded.sub)),
            });
            if (user && user.status && (user.role === 'Admin' || user.role === 'admin')) {
              return true;
            }
          }
        }
      }
    } catch {
      return false;
    }
    return false;
  }

  private async getAllDescendantCategoryIds(parentId: number): Promise<number[]> {
    try {
      const directSubs = await this.db.query.categories.findMany({
        where: and(eq(categories.parentId, parentId), eq(categories.status, true)),
      });
      let allIds: number[] = [parentId];
      for (const sub of directSubs) {
        const subId = Number(sub.id);
        const descendants = await this.getAllDescendantCategoryIds(subId);
        allIds = allIds.concat(descendants);
      }
      return Array.from(new Set(allIds));
    } catch {
      return [parentId];
    }
  }

  private sanitizeCustomerVariant(variant: any) {
    if (!variant) return variant;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { bp, ...rest } = variant;
    return rest;
  }

  private sanitizeCustomerProduct(product: any) {
    if (!product) return product;
    const copy = { ...product };
    if (copy.variants && Array.isArray(copy.variants)) {
      copy.variants = copy.variants.map((v: any) => this.sanitizeCustomerVariant(v));
    }
    if (copy.best_variant) {
      copy.best_variant = this.sanitizeCustomerVariant(copy.best_variant);
    }
    return copy;
  }

  async index() {
    const prodList = await this.db
      .select()
      .from(products)
      .where(eq(products.status, true));

    const data = await this.hydrateProductsWithRelations(prodList);

    const allReviews = await this.db.query.reviews.findMany({
      where: eq(reviews.isApproved, true),
    });
    const reviewStats: Record<number, { count: number; sum: number }> = {};
    for (const r of allReviews) {
      if (!reviewStats[r.productId]) reviewStats[r.productId] = { count: 0, sum: 0 };
      reviewStats[r.productId].count += 1;
      reviewStats[r.productId].sum += r.rating;
    }

    const activeProducts = data.filter((p: any) => {
      const activeVariants = (p.variants ?? []).filter((v: any) => v.status);
      return activeVariants.length > 0;
    });

    const mapped = activeProducts.map((product: any) => {
      const activeVariants = (product.variants ?? []).filter((v: any) => v.status);
      let imageUrl = product.imageUrl;
      if (!imageUrl && activeVariants.length > 0) {
        imageUrl = activeVariants[0].imageUrl;
      }

      const formattedVariants = activeVariants.map((variant: any) => ({
        id: variant.id,
        title: variant.title,
        mrp: variant.mrp,
        sp: variant.sp,
        stock: variant.stock,
        image_url: variant.imageUrl,
        image_json: variant.imageJson,
      }));

      const rStat = reviewStats[product.id] ?? { count: 0, sum: 0 };
      let avgRating = 0;
      let reviewsCount = 0;
      if (rStat && rStat.count > 0) {
        avgRating = Math.round((rStat.sum / rStat.count) * 10) / 10;
        reviewsCount = rStat.count;
      } else if (product.average_rating && Number(product.average_rating) > 0) {
        avgRating = Number(product.average_rating);
        reviewsCount = Number(product.reviews_count || 12);
      } else if (product.id && product.id % 4 !== 0) {
        const seedRatings = [4.5, 4.2, 4.8, 3.9, 4.6, 4.1, 4.7, 4.3, 3.8, 4.9];
        const seedCounts = [28, 64, 142, 12, 89, 45, 230, 78, 15, 310];
        avgRating = seedRatings[product.id % seedRatings.length];
        reviewsCount = seedCounts[product.id % seedCounts.length];
      } else {
        avgRating = 0;
        reviewsCount = 0;
      }

      const sortedVariants = [...activeVariants].sort((a: any, b: any) => parseFloat(a.sp) - parseFloat(b.sp));
      const bestVariant = sortedVariants[0] ? {
        id: sortedVariants[0].id,
        title: sortedVariants[0].title,
        sku: sortedVariants[0].sku,
        sp: sortedVariants[0].sp,
        mrp: sortedVariants[0].mrp,
        stock: sortedVariants[0].stock,
        image_url: sortedVariants[0].imageUrl,
      } : null;

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        image_url: imageUrl,
        status: product.status,
        brand: product.brand ? { id: product.brand.id, name: product.brand.name } : null,
        category: product.category ? { id: product.category.id, name: product.category.name } : null,
        average_rating: avgRating,
        reviews_count: reviewsCount,
        best_variant: bestVariant,
        variants: formattedVariants,
      };
    });

    return {
      success: true,
      message: 'Products fetched successfully.',
      data: mapped,
    };
  }

  private async resolveCategoryId(rawCatIdOrSlug: any, rawParentIdOrSlug?: any): Promise<number | null> {
    if (rawCatIdOrSlug === undefined || rawCatIdOrSlug === null || rawCatIdOrSlug === '') {
      return null;
    }
    const rawCatStr = String(rawCatIdOrSlug).trim();
    const numCat = Number(rawCatStr);
    if (!isNaN(numCat) && numCat > 0 && String(numCat) === rawCatStr) {
      return numCat;
    }

    const allCats: any[] = await this.db.query.categories.findMany();

    // If parent context is provided, resolve parent first and look up child subcategory
    if (rawParentIdOrSlug !== undefined && rawParentIdOrSlug !== null && rawParentIdOrSlug !== '') {
      const parentCat = allCats.find((c: any) => matchesSlugOrId(c, rawParentIdOrSlug) && (!c.parentId || c.parentId === null))
        || allCats.find((c: any) => matchesSlugOrId(c, rawParentIdOrSlug));

      if (parentCat) {
        const matchingSub = allCats.find((c: any) => matchesSlugOrId(c, rawCatIdOrSlug) && Number(c.parentId) === Number(parentCat.id));
        if (matchingSub) {
          return Number(matchingSub.id);
        }
      }
    }

    // Try finding top-level parent category first if it matches
    const parentMatch = allCats.find((c: any) => matchesSlugOrId(c, rawCatIdOrSlug) && (!c.parentId || c.parentId === null));
    if (parentMatch) {
      return Number(parentMatch.id);
    }

    // Otherwise find any category matching the slug
    const anyMatch = allCats.find((c: any) => matchesSlugOrId(c, rawCatIdOrSlug));
    return anyMatch ? Number(anyMatch.id) : null;
  }

  async getAllProductsPaginated(query: any) {
    const perPage = Math.max(1, parseInt(query.per_page ?? '20'));
    const page = Math.max(1, parseInt(query.page ?? '1'));
    const search = query.search?.trim();

    const isCategoryFilterSpecified = (query.category_id !== undefined && query.category_id !== '' && query.category_id !== null) ||
      (query.subcategory_id !== undefined && query.subcategory_id !== '' && query.subcategory_id !== null);

    const categoryId = isCategoryFilterSpecified
      ? await this.resolveCategoryId(query.category_id ?? query.subcategory_id, query.parent_id)
      : undefined;

    const brandId = query.brand_id ? parseInt(query.brand_id) : undefined;

    let minPrice = query.min_price !== undefined && query.min_price !== '' ? parseFloat(query.min_price) : undefined;
    let maxPrice = query.max_price !== undefined && query.max_price !== '' ? parseFloat(query.max_price) : undefined;

    if (query.price_range) {
      if (query.price_range === 'under1000') {
        minPrice = 0;
        maxPrice = 1000;
      } else if (query.price_range === '1000to2000') {
        minPrice = 1000;
        maxPrice = 2000;
      } else if (query.price_range === 'above2000') {
        minPrice = 2000;
        maxPrice = undefined;
      }
    }

    const sortOrder = query.sort_order?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const conditions: any[] = [eq(products.status, true)];
    if (isCategoryFilterSpecified) {
      if (categoryId) {
        const categoryIds = await this.getAllDescendantCategoryIds(categoryId);
        if (categoryIds.length === 1) {
          conditions.push(eq(products.categoryId, categoryIds[0]));
        } else if (categoryIds.length > 1) {
          conditions.push(inArray(products.categoryId, categoryIds));
        }
      } else {
        conditions.push(sql`1=0`);
      }
    }
    if (brandId) conditions.push(eq(products.brandId, brandId));

    if (search) {
      const matchingVariants = await this.db.query.variants.findMany({
        where: or(
          like(variants.sku, `%${search}%`),
          like(variants.title, `%${search}%`),
        ),
        columns: { productId: true },
      });
      const variantProductIds = Array.from(
        new Set(matchingVariants.map((v: any) => Number(v.productId)).filter(Boolean)),
      );

      if (variantProductIds.length > 0) {
        conditions.push(
          or(
            like(products.name, `%${search}%`),
            like(products.description, `%${search}%`),
            like(products.itemCode, `%${search}%`),
            inArray(products.id, variantProductIds),
          ),
        );
      } else {
        conditions.push(
          or(
            like(products.name, `%${search}%`),
            like(products.description, `%${search}%`),
            like(products.itemCode, `%${search}%`),
          ),
        );
      }
    }

    const prodList = await this.db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(sortOrder === 'asc' ? products.createdAt : desc(products.createdAt));

    const allMatching = await this.hydrateProductsWithRelations(prodList);

    // Fetch all approved reviews to compute ratings and counts
    const allReviews = await this.db.query.reviews.findMany({
      where: eq(reviews.isApproved, true),
    });
    const reviewStats: Record<number, { count: number; sum: number }> = {};
    for (const r of allReviews) {
      if (!reviewStats[r.productId]) reviewStats[r.productId] = { count: 0, sum: 0 };
      reviewStats[r.productId].count += 1;
      reviewStats[r.productId].sum += r.rating;
    }

    // Filter by price range and active variants
    const filteredProducts = allMatching.filter((p: any) => {
      const activeVariants = (p.variants ?? []).filter((v: any) => v.status);
      if (activeVariants.length === 0) return false; // Hide product if 0 active variants!

      if (minPrice !== undefined || maxPrice !== undefined) {
        return activeVariants.some((v: any) => {
          const price = parseFloat(v.sp as string);
          if (minPrice !== undefined && price < minPrice) return false;
          if (maxPrice !== undefined && price > maxPrice) return false;
          return true;
        });
      }
      return true;
    });

    // Backend Sorting
    const sortBy = query.sort_by || query.sort;
    if (sortBy === 'price_low' || sortBy === 'price-low') {
      filteredProducts.sort((a: any, b: any) => {
        const getMinSp = (p: any) => {
          const active = (p.variants ?? []).filter((v: any) => v.status);
          if (active.length > 0) return Math.min(...active.map((v: any) => parseFloat(v.sp as string) || 0));
          return 0;
        };
        return getMinSp(a) - getMinSp(b);
      });
    } else if (sortBy === 'price_high' || sortBy === 'price-high') {
      filteredProducts.sort((a: any, b: any) => {
        const getMinSp = (p: any) => {
          const active = (p.variants ?? []).filter((v: any) => v.status);
          if (active.length > 0) return Math.min(...active.map((v: any) => parseFloat(v.sp as string) || 0));
          return 0;
        };
        return getMinSp(b) - getMinSp(a);
      });
    } else if (sortBy === 'rating') {
      filteredProducts.sort((a: any, b: any) => {
        const getRating = (p: any) => {
          const stat = reviewStats[p.id];
          return stat && stat.count > 0 ? stat.sum / stat.count : 0;
        };
        return getRating(b) - getRating(a);
      });
    } else if (sortBy === 'newest') {
      filteredProducts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const total = filteredProducts.length;
    const paginatedItems = filteredProducts.slice((page - 1) * perPage, page * perPage);

    const transformedItems = paginatedItems.map((product: any) => {
      const activeVariants = (product.variants ?? []).filter((v: any) => v.status);
      let imageUrl = product.imageUrl;
      if (!imageUrl && activeVariants.length > 0) {
        imageUrl = activeVariants[0].imageUrl;
      }

      const formattedVariants = activeVariants.map((variant: any) => ({
        id: variant.id,
        title: variant.title,
        mrp: variant.mrp,
        sp: variant.sp,
        stock: variant.stock,
        image_url: variant.imageUrl,
        image_json: variant.imageJson,
      }));

      const sps = activeVariants.map((v: any) => parseFloat(v.sp as string)).filter((val: number) => !isNaN(val));
      const mrps = activeVariants.map((v: any) => parseFloat(v.mrp as string)).filter((val: number) => !isNaN(val));
      const prices = sps.length ? sps : mrps;

      const pMinPrice = prices.length ? Math.min(...prices) : 0;
      const pMaxPrice = prices.length ? Math.max(...prices) : 0;

      const sortedVariants = [...activeVariants].sort((a: any, b: any) => parseFloat(a.sp) - parseFloat(b.sp));
      const bestVariant = sortedVariants[0] ? {
        id: sortedVariants[0].id,
        title: sortedVariants[0].title,
        sku: sortedVariants[0].sku,
        sp: sortedVariants[0].sp,
        mrp: sortedVariants[0].mrp,
        stock: sortedVariants[0].stock,
        image_url: sortedVariants[0].imageUrl,
      } : null;

      const rStat = reviewStats[product.id] ?? { count: 0, sum: 0 };
      let avgRating = 0;
      let reviewsCount = 0;
      if (rStat && rStat.count > 0) {
        avgRating = Math.round((rStat.sum / rStat.count) * 10) / 10;
        reviewsCount = rStat.count;
      } else if (product.average_rating && Number(product.average_rating) > 0) {
        avgRating = Number(product.average_rating);
        reviewsCount = Number(product.reviews_count || 12);
      } else if (product.id && product.id % 4 !== 0) {
        const seedRatings = [4.5, 4.2, 4.8, 3.9, 4.6, 4.1, 4.7, 4.3, 3.8, 4.9];
        const seedCounts = [28, 64, 142, 12, 89, 45, 230, 78, 15, 310];
        avgRating = seedRatings[product.id % seedRatings.length];
        reviewsCount = seedCounts[product.id % seedCounts.length];
      } else {
        avgRating = 0;
        reviewsCount = 0;
      }

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        image_url: imageUrl,
        status: product.status,
        brand: product.brand ? { id: product.brand.id, name: product.brand.name } : null,
        category: product.category ? { id: product.category.id, name: product.category.name } : null,
        min_price: pMinPrice,
        max_price: pMaxPrice,
        variants: formattedVariants,
        average_rating: avgRating,
        reviews_count: reviewsCount,
        best_variant: bestVariant,
      };
    });

    // Build suggestions matching categories, brands, products
    const suggestionsSet = new Set<string>();
    if (search) {
      const catMatches = await this.db.query.categories.findMany({
        where: and(eq(categories.status, true), like(categories.name, `%${search}%`)),
        limit: 5,
      });
      catMatches.forEach((c) => suggestionsSet.add(c.name));

      const brandMatches = await this.db.query.brands.findMany({
        where: like(brands.name, `%${search}%`),
        limit: 3,
      });
      brandMatches.forEach((b) => suggestionsSet.add(b.name));

      const prodMatches = await this.db.query.products.findMany({
        where: and(eq(products.status, true), like(products.name, `%${search}%`)),
        limit: 6,
      });
      prodMatches.forEach((p) => suggestionsSet.add(p.name));
    }

    if (suggestionsSet.size === 0) {
      const catDefaults = await this.db.query.categories.findMany({
        where: eq(categories.status, true),
        limit: 4,
      });
      catDefaults.forEach((c) => suggestionsSet.add(c.name));

      const prodDefaults = await this.db.query.products.findMany({
        where: eq(products.status, true),
        limit: 4,
      });
      prodDefaults.forEach((p) => suggestionsSet.add(p.name));
    }

    const suggestions = Array.from(suggestionsSet).slice(0, 10);
    const lastPage = Math.ceil(total / perPage) || 1;
    const fromIndex = total > 0 ? (page - 1) * perPage + 1 : null;
    const toIndex = total > 0 ? Math.min(page * perPage, total) : null;

    return {
      res: 'success',
      success: true,
      message: 'Products fetched successfully.',
      data: {
        products: transformedItems,
        suggestions,
      },
      pagination: {
        total,
        per_page: perPage,
        current_page: page,
        last_page: lastPage,
        from: fromIndex,
        to: toIndex,
      },
    };
  }

  async show(idOrSlug: string | number): Promise<any> {
    let p: any = null;
    const numId = Number(idOrSlug);
    if (!isNaN(numId) && numId > 0 && String(idOrSlug).trim() === String(numId)) {
      p = await this.findProductWithRelations(numId);
      if (p && !p.status) p = null;
    }

    if (!p) {
      const allProds = await this.db
        .select()
        .from(products)
        .where(eq(products.status, true));
      const match = allProds.find((item: any) => matchesSlugOrId(item, idOrSlug));
      if (match) {
        p = await this.findProductWithRelations(Number(match.id));
      }
    }

    const activeVariants = (p?.variants ?? []).filter((v: any) => v.status);

    if (!p || activeVariants.length === 0) {
      throw new HttpException(
        { success: false, message: 'Product not found.' },
        HttpStatus.NOT_FOUND, // 404
      );
    }

    let imageUrl = p.imageUrl;
    if (!imageUrl && activeVariants.length > 0) {
      const firstWithImg = activeVariants.find((v: any) => v.imageUrl);
      if (firstWithImg) imageUrl = firstWithImg.imageUrl;
    }

    const formattedProduct = {
      ...p,
      image_url: imageUrl,
      variants: activeVariants.map((v: any) => ({
        ...v,
        image_url: v.imageUrl,
        image_json: v.imageJson,
      })),
    };

    return {
      success: true,
      message: 'Product details fetched successfully.',
      product: formattedProduct,
    };
  }

  async getProductById(idOrSlug: string | number, req?: any): Promise<any> {
    const isAdmin = await this.checkIfAdmin(req);

    let p: any = null;
    const numId = Number(idOrSlug);
    if (!isNaN(numId) && numId > 0 && String(idOrSlug).trim() === String(numId)) {
      p = await this.findFullProductById(numId, isAdmin);
    }

    if (!p) {
      const allProds = await this.db.select().from(products);
      const match = allProds.find((item: any) => matchesSlugOrId(item, idOrSlug));
      if (match) {
        p = await this.findFullProductById(Number(match.id), isAdmin);
      }
    }

    if (!p) {
      throw new HttpException(
        { res: 'error', message: 'Product not found.' },
        HttpStatus.NOT_FOUND, // 404
      );
    }

    const activeVariants = (p?.variants ?? []).filter((v: any) => v.status);

    if (!isAdmin && (!p.status || activeVariants.length === 0)) {
      throw new HttpException(
        { res: 'error', message: 'Product not found.' },
        HttpStatus.NOT_FOUND, // 404
      );
    }

    const variantsToFormat = isAdmin ? (p?.variants ?? []) : activeVariants;

    let imageUrl = p.imageUrl;
    if (!imageUrl && variantsToFormat.length > 0) {
      const firstWithImg = variantsToFormat.find((v: any) => v.imageUrl);
      if (firstWithImg) imageUrl = firstWithImg.imageUrl;
    }

    const prodReviews = await this.db.query.reviews.findMany({
      where: and(eq(reviews.productId, Number(p.id)), eq(reviews.isApproved, true)),
    });
    const reviewsCount = prodReviews.length;
    const avgRating = reviewsCount > 0
      ? Math.round((prodReviews.reduce((sum, r) => sum + r.rating, 0) / reviewsCount) * 10) / 10
      : 0;

    const ratingDist: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    prodReviews.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) {
        ratingDist[r.rating] = (ratingDist[r.rating] || 0) + 1;
      }
    });

    const formattedVariants = variantsToFormat.map((v: any) => {
      const attrVals = (v.variantAttributeValues ?? []).map((vav: any) => ({
        id: vav.attributeValue?.id,
        attribute_id: vav.attributeValue?.attributeId ?? vav.attributeValue?.attribute_id,
        attributeId: vav.attributeValue?.attributeId ?? vav.attributeValue?.attribute_id,
        value: vav.attributeValue?.value,
        attribute: vav.attributeValue?.attribute ? {
          id: vav.attributeValue.attribute.id,
          name: vav.attributeValue.attribute.name,
        } : null,
      }));

      const rawVariant = {
        ...v,
        id: Number(v.id),
        title: v.title ?? null,
        sku: v.sku,
        stock: Number(v.stock ?? 0),
        mrp: Number(v.mrp ?? 0),
        sp: Number(v.sp ?? 0),
        bp: Number(v.bp ?? 0),
        status: Boolean(v.status),
        image_url: v.imageUrl ?? v.image_url ?? null,
        imageUrl: v.imageUrl ?? v.image_url ?? null,
        image_json: v.imageJson ?? v.image_json ?? null,
        imageJson: v.imageJson ?? v.image_json ?? null,
        attribute_values: attrVals,
        attributeValues: attrVals,
        variantAttributeValues: v.variantAttributeValues,
        variant_attribute_values: v.variantAttributeValues,
      };

      return isAdmin ? rawVariant : this.sanitizeCustomerVariant(rawVariant);
    });

    const formattedItemAttrs = (p.itemAttributes ?? p.item_attributes ?? []).map((ia: any) => ({
      ...ia,
      attribute_id: Number(ia.attributeId ?? ia.attribute_id ?? ia.attribute?.id),
      attributeId: Number(ia.attributeId ?? ia.attribute_id ?? ia.attribute?.id),
      is_primary: Boolean(ia.isPrimary ?? ia.is_primary),
      isPrimary: Boolean(ia.isPrimary ?? ia.is_primary),
      has_images: Boolean(ia.hasImages ?? ia.has_images),
      hasImages: Boolean(ia.hasImages ?? ia.has_images),
      attribute: ia.attribute,
    }));

    const formattedProduct = {
      ...p,
      image_url: imageUrl || p.imageUrl || p.image_url,
      imageUrl: imageUrl || p.imageUrl || p.image_url,
      image_json: p.imageJson || p.image_json,
      imageJson: p.imageJson || p.image_json,
      feature_json: p.featureJson || p.feature_json,
      featureJson: p.featureJson || p.feature_json,
      detail_json: p.detailJson || p.detail_json,
      detailJson: p.detailJson || p.detail_json,
      item_attributes: formattedItemAttrs,
      itemAttributes: formattedItemAttrs,
      product_attribute_values: p.productAttributeValues || p.product_attribute_values || [],
      productAttributeValues: p.productAttributeValues || p.product_attribute_values || [],
      is_new_arrival: p.isNewArrival ?? p.is_new_arrival ?? false,
      isNewArrival: p.isNewArrival ?? p.is_new_arrival ?? false,
      item_code: p.itemCode || p.item_code,
      itemCode: p.itemCode || p.item_code,
      variants: formattedVariants,
      rating_summary: {
        average_rating: avgRating,
        total_reviews: reviewsCount,
        reviews_count: reviewsCount,
        rating_distribution: ratingDist,
      },
    };

    return {
      res: 'success',
      message: 'Product fetched successfully.',
      product: formattedProduct,
      errors: [],
    };
  }

  async search(queryInput: any) {
    const qStr = (typeof queryInput === 'string' ? queryInput : queryInput?.q)?.trim();
    const categoryId = queryInput?.category_id ? parseInt(queryInput.category_id) : undefined;
    const brandId = queryInput?.brand_id ? parseInt(queryInput.brand_id) : undefined;
    const brandIds = queryInput?.brand_ids ? (Array.isArray(queryInput.brand_ids) ? queryInput.brand_ids.map(Number) : String(queryInput.brand_ids).split(',').map(Number).filter(Boolean)) : undefined;
    const categoryIdsInput = queryInput?.category_ids ? (Array.isArray(queryInput.category_ids) ? queryInput.category_ids.map(Number) : String(queryInput.category_ids).split(',').map(Number).filter(Boolean)) : undefined;
    const minPrice = queryInput?.min_price !== undefined && queryInput?.min_price !== '' ? parseFloat(queryInput.min_price) : undefined;
    const maxPrice = queryInput?.max_price !== undefined && queryInput?.max_price !== '' ? parseFloat(queryInput.max_price) : undefined;
    const minRating = queryInput?.min_rating !== undefined && queryInput?.min_rating !== '' ? parseFloat(queryInput.min_rating) : undefined;
    const minDiscount = queryInput?.min_discount !== undefined && queryInput?.min_discount !== '' ? parseFloat(queryInput.min_discount) : undefined;
    const colorsInput = queryInput?.color || queryInput?.colors;
    const selectedColors = colorsInput ? (Array.isArray(colorsInput) ? colorsInput.map((c: any) => String(c).toLowerCase().trim()) : String(colorsInput).split(',').map((c) => c.toLowerCase().trim()).filter(Boolean)) : [];
    const narrowTag = queryInput?.narrow_tag ? String(queryInput.narrow_tag).toLowerCase().trim() : undefined;
    const freeShipping = queryInput?.free_shipping === true || queryInput?.free_shipping === 'true';
    const sortBy = queryInput?.sort_by || queryInput?.sort || 'featured';
    const limit = Math.max(1, parseInt(queryInput?.limit ?? '40'));
    const page = Math.max(1, parseInt(queryInput?.page ?? '1'));

    if (!qStr) {
      throw new HttpException(
        { res: 'error', message: 'Search query is required.' },
        HttpStatus.BAD_REQUEST, // 400
      );
    }

    const qLower = qStr.toLowerCase();

    // Fetch all active products with relations
    const prodList = await this.db
      .select()
      .from(products)
      .where(eq(products.status, true));

    const allProds = await this.hydrateProductsWithRelations(prodList);

    // Fetch all approved reviews for real rating and review counts
    const allReviews = await this.db.query.reviews.findMany({
      where: eq(reviews.isApproved, true),
    });
    const reviewStats: Record<number, { count: number; sum: number }> = {};
    for (const r of allReviews) {
      if (!reviewStats[r.productId]) reviewStats[r.productId] = { count: 0, sum: 0 };
      reviewStats[r.productId].count += 1;
      reviewStats[r.productId].sum += r.rating;
    }

    // Filter products that match the base search query (qLower)
    const baseMatchedProducts = allProds.filter((product: any) => {
      const activeVariants = (product.variants ?? []).filter((v: any) => v.status);
      if (activeVariants.length === 0) return false;

      const nameMatch = product.name?.toLowerCase().includes(qLower);
      const descMatch = product.description?.toLowerCase().includes(qLower);
      const itemCodeMatch = product.itemCode?.toLowerCase().includes(qLower);
      const catMatch = product.category?.name?.toLowerCase().includes(qLower);
      const parentCatMatch = product.category?.parent?.name?.toLowerCase().includes(qLower);
      const brandMatch = product.brand?.name?.toLowerCase().includes(qLower);
      const variantMatch = activeVariants.some(
        (v: any) => v.title?.toLowerCase().includes(qLower) ||
          v.sku?.toLowerCase().includes(qLower) ||
          v.variantAttributeValues?.some((vav: any) => vav.attributeValue?.value?.toLowerCase().includes(qLower))
      );
      const attributeMatch = product.itemAttributes?.some(
        (ia: any) => ia.attribute?.name?.toLowerCase().includes(qLower)
      );

      return nameMatch || descMatch || itemCodeMatch || catMatch || parentCatMatch || brandMatch || variantMatch || attributeMatch;
    });

    // --- 1. Compute Dynamic Aggregations & Facets from baseMatchedProducts ---
    const categoryMap = new Map<number, { id: number; name: string; count: number }>();
    const brandMap = new Map<number, { id: number; name: string; count: number }>();
    const colorMap = new Map<string, number>();
    const narrowMap = new Map<string, { label: string; tag: string; icon: string; count: number }>();
    let minObservedPrice = Infinity;
    let maxObservedPrice = 0;
    let fourStarCount = 0;
    let threeStarCount = 0;
    let twoStarCount = 0;
    let oneStarCount = 0;
    let tenDiscountCount = 0;
    let twentyfiveDiscountCount = 0;
    let fiftyDiscountCount = 0;
    let seventyDiscountCount = 0;

    // Helper for icons based on category/tag name
    const getTagIcon = (text: string) => {
      const t = text.toLowerCase();
      if (t.includes('headphone') || t.includes('earphone') || t.includes('audio') || t.includes('earbud') || t.includes('sound')) return '🎧';
      if (t.includes('watch') || t.includes('wearable')) return '⌚';
      if (t.includes('shirt') || t.includes('top') || t.includes('cloth') || t.includes('apparel')) return '👕';
      if (t.includes('pant') || t.includes('jean') || t.includes('trouser') || t.includes('denim')) return '👖';
      if (t.includes('shoe') || t.includes('footwear') || t.includes('sneaker')) return '👟';
      if (t.includes('bag') || t.includes('backpack')) return '🎒';
      if (t.includes('phone') || t.includes('mobile')) return '📱';
      if (t.includes('laptop') || t.includes('computer')) return '💻';
      if (t.includes('gaming') || t.includes('game')) return '🎮';
      if (t.includes('camera')) return '📷';
      if (t.includes('wireless') || t.includes('bluetooth')) return '📶';
      if (t.includes('smart')) return '✨';
      if (t.includes('cotton') || t.includes('silk') || t.includes('linen')) return '🌱';
      if (t.includes('casual') || t.includes('formal') || t.includes('office')) return '👔';
      if (t.includes('printed') || t.includes('check') || t.includes('stripe')) return '🎨';
      return '🏷️';
    };

    baseMatchedProducts.forEach((product: any) => {
      const activeVars = (product.variants ?? []).filter((v: any) => v.status);
      const prices = activeVars.map((v: any) => parseFloat(v.sp || v.mrp || 0)).filter((p: number) => p > 0);
      const mrps = activeVars.map((v: any) => parseFloat(v.mrp || 0)).filter((p: number) => p > 0);
      const prodMinSp = prices.length > 0 ? Math.min(...prices) : 0;
      const prodMaxMrp = mrps.length > 0 ? Math.max(...mrps) : prodMinSp;
      const discount = prodMaxMrp > prodMinSp ? Math.round(((prodMaxMrp - prodMinSp) / prodMaxMrp) * 100) : 0;

      if (prodMinSp > 0) {
        minObservedPrice = Math.min(minObservedPrice, prodMinSp);
        maxObservedPrice = Math.max(maxObservedPrice, prodMinSp);
      }

      // Review stats
      const rStat = reviewStats[product.id];
      let prodRating = 0;
      if (rStat && rStat.count > 0) {
        prodRating = parseFloat((rStat.sum / rStat.count).toFixed(1));
      } else if (product.average_rating && Number(product.average_rating) > 0) {
        prodRating = parseFloat(String(product.average_rating));
      } else if (product.id && product.id % 4 !== 0) {
        const seedRatings = [4.5, 4.2, 4.8, 3.9, 4.6, 4.1, 4.7, 4.3, 3.8, 4.9];
        prodRating = seedRatings[product.id % seedRatings.length];
      }

      if (prodRating >= 4) fourStarCount++;
      if (prodRating >= 3) threeStarCount++;
      if (prodRating >= 2) twoStarCount++;
      if (prodRating >= 1) oneStarCount++;

      // Discount counts
      if (discount >= 10) tenDiscountCount++;
      if (discount >= 25) twentyfiveDiscountCount++;
      if (discount >= 50) fiftyDiscountCount++;
      if (discount >= 70) seventyDiscountCount++;

      // Categories
      if (product.category) {
        const cat = product.category;
        const entry = categoryMap.get(cat.id) || { id: cat.id, name: cat.name, count: 0 };
        entry.count += 1;
        categoryMap.set(cat.id, entry);

        const catTag = cat.name.toLowerCase();
        const existingNarrow = narrowMap.get(catTag) || { label: cat.name, tag: catTag, icon: getTagIcon(cat.name), count: 0 };
        existingNarrow.count += 1;
        narrowMap.set(catTag, existingNarrow);
      }
      if (product.category?.parent) {
        const parent = product.category.parent;
        const entry = categoryMap.get(parent.id) || { id: parent.id, name: parent.name, count: 0 };
        entry.count += 1;
        categoryMap.set(parent.id, entry);
      }

      // Brands
      if (product.brand) {
        const b = product.brand;
        const entry = brandMap.get(b.id) || { id: b.id, name: b.name, count: 0 };
        entry.count += 1;
        brandMap.set(b.id, entry);
      }

      // Colors & Attribute values
      activeVars.forEach((v: any) => {
        v.variantAttributeValues?.forEach((vav: any) => {
          const val = vav.attributeValue?.value?.trim();
          if (val) {
            const valLower = val.toLowerCase();
            const isCommonColor = ['black', 'white', 'blue', 'navy', 'red', 'maroon', 'green', 'olive', 'yellow', 'brown', 'beige', 'grey', 'gray', 'pink', 'purple', 'orange', 'silver', 'gold'].includes(valLower);
            if (isCommonColor) {
              colorMap.set(val, (colorMap.get(val) || 0) + 1);
            } else {
              const existingNarrow = narrowMap.get(valLower) || { label: val, tag: valLower, icon: getTagIcon(val), count: 0 };
              existingNarrow.count += 1;
              narrowMap.set(valLower, existingNarrow);
            }
          }
        });

        if (v.title) {
          ['Black', 'White', 'Blue', 'Navy', 'Red', 'Maroon', 'Green', 'Olive', 'Yellow', 'Brown', 'Beige', 'Grey', 'Pink', 'Purple', 'Silver', 'Gold'].forEach((c) => {
            if (v.title.toLowerCase().includes(c.toLowerCase())) {
              colorMap.set(c, (colorMap.get(c) || 0) + 1);
            }
          });
        }
      });

      // Extract prominent keywords from product name for narrow options
      if (product.name) {
        const words = product.name
          .replace(/[^\w\s]/gi, ' ')
          .split(/\s+/)
          .filter((w: string) => w.length > 3 && !['with', 'from', 'this', 'that', 'have', 'best', 'pack', 'size', 'free', 'item', 'plus', 'mens', 'womens', 'boys', 'girls'].includes(w.toLowerCase()));

        words.forEach((w: string) => {
          const wLower = w.toLowerCase();
          if (!wLower.includes(qLower) && !qLower.includes(wLower)) {
            const cap = w.charAt(0).toUpperCase() + w.slice(1);
            const existing = narrowMap.get(wLower) || { label: cap, tag: wLower, icon: getTagIcon(w), count: 0 };
            existing.count += 1;
            narrowMap.set(wLower, existing);
          }
        });
      }
    });

    const available_categories = Array.from(categoryMap.values()).sort((a, b) => b.count - a.count);
    const available_brands = Array.from(brandMap.values()).sort((a, b) => b.count - a.count);
    const available_colors = Array.from(colorMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const narrow_options = Array.from(narrowMap.values())
      .filter((n) => n.count >= 1 && n.label.length > 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 16);

    // --- 2. Apply Filters on baseMatchedProducts ---
    const filtered = baseMatchedProducts.filter((product: any) => {
      const activeVars = (product.variants ?? []).filter((v: any) => v.status);
      const prices = activeVars.map((v: any) => parseFloat(v.sp || v.mrp || 0)).filter((p: number) => p > 0);
      const mrps = activeVars.map((v: any) => parseFloat(v.mrp || 0)).filter((p: number) => p > 0);
      const prodMinSp = prices.length > 0 ? Math.min(...prices) : 0;
      const prodMaxMrp = mrps.length > 0 ? Math.max(...mrps) : prodMinSp;
      const discount = prodMaxMrp > prodMinSp ? Math.round(((prodMaxMrp - prodMinSp) / prodMaxMrp) * 100) : 0;

      // Category filter
      if (categoryId && product.categoryId !== categoryId && product.category?.parent?.id !== categoryId) {
        return false;
      }
      if (categoryIdsInput && categoryIdsInput.length > 0) {
        const matchesCat = categoryIdsInput.includes(Number(product.categoryId)) || (product.category?.parent?.id && categoryIdsInput.includes(Number(product.category.parent.id)));
        if (!matchesCat) return false;
      }

      // Brand filter
      if (brandId && product.brandId !== brandId) {
        return false;
      }
      if (brandIds && brandIds.length > 0) {
        if (!brandIds.includes(Number(product.brandId))) return false;
      }
      if (queryInput?.brands) {
        const brandNamesList = (Array.isArray(queryInput.brands) ? queryInput.brands : String(queryInput.brands).split(',')).map((b: string) => b.trim().toLowerCase());
        const prodBrandName = (product.brand?.name || '').toLowerCase();
        if (!brandNamesList.includes(prodBrandName)) return false;
      }

      // Price Filter
      if (minPrice !== undefined && prodMinSp < minPrice) return false;
      if (maxPrice !== undefined && prodMinSp > maxPrice) return false;

      // Rating Filter
      const rStat = reviewStats[product.id];
      let prodRating = 0;
      if (rStat && rStat.count > 0) {
        prodRating = parseFloat((rStat.sum / rStat.count).toFixed(1));
      } else if (product.average_rating && Number(product.average_rating) > 0) {
        prodRating = parseFloat(String(product.average_rating));
      } else if (product.id && product.id % 4 !== 0) {
        const seedRatings = [4.5, 4.2, 4.8, 3.9, 4.6, 4.1, 4.7, 4.3, 3.8, 4.9];
        prodRating = seedRatings[product.id % seedRatings.length];
      }
      if (minRating !== undefined && prodRating < minRating) return false;

      // Discount Filter
      if (minDiscount !== undefined && discount < minDiscount) return false;

      // Color Filter
      if (selectedColors.length > 0) {
        const hasColor = activeVars.some((v: any) => {
          const inTitle = selectedColors.some((c) => v.title?.toLowerCase().includes(c));
          const inAttr = v.variantAttributeValues?.some((vav: any) => {
            const val = vav.attributeValue?.value?.toLowerCase();
            return selectedColors.some((c) => val?.includes(c));
          });
          return inTitle || inAttr;
        });
        if (!hasColor) return false;
      }

      // Narrow Tag / Keyword Filter
      if (narrowTag) {
        const inName = product.name?.toLowerCase().includes(narrowTag);
        const inDesc = product.description?.toLowerCase().includes(narrowTag);
        const inCat = product.category?.name?.toLowerCase().includes(narrowTag) || product.category?.parent?.name?.toLowerCase().includes(narrowTag);
        const inVariant = activeVars.some((v: any) => {
          return v.title?.toLowerCase().includes(narrowTag) ||
            v.variantAttributeValues?.some((vav: any) => vav.attributeValue?.value?.toLowerCase().includes(narrowTag));
        });
        if (!inName && !inDesc && !inCat && !inVariant) return false;
      }

      // Free shipping
      if (freeShipping && prodMinSp < 499) return false;

      return true;
    });

    // --- 3. Sorting ---
    if (sortBy === 'price_low_high') {
      filtered.sort((a: any, b: any) => {
        const aMin = Math.min(...(a.variants ?? []).map((v: any) => parseFloat(v.sp || v.mrp || 0)));
        const bMin = Math.min(...(b.variants ?? []).map((v: any) => parseFloat(v.sp || v.mrp || 0)));
        return aMin - bMin;
      });
    } else if (sortBy === 'price_high_low') {
      filtered.sort((a: any, b: any) => {
        const aMin = Math.min(...(a.variants ?? []).map((v: any) => parseFloat(v.sp || v.mrp || 0)));
        const bMin = Math.min(...(b.variants ?? []).map((v: any) => parseFloat(v.sp || v.mrp || 0)));
        return bMin - aMin;
      });
    } else if (sortBy === 'avg_rating') {
      filtered.sort((a: any, b: any) => {
        const getProdRating = (p: any) => {
          const stat = reviewStats[p.id];
          if (stat && stat.count > 0) return stat.sum / stat.count;
          if (p.id && p.id % 4 !== 0) {
            const seedRatings = [4.5, 4.2, 4.8, 3.9, 4.6, 4.1, 4.7, 4.3, 3.8, 4.9];
            return seedRatings[p.id % seedRatings.length];
          }
          return 0;
        };
        return getProdRating(b) - getProdRating(a);
      });
    } else if (sortBy === 'newest') {
      filtered.sort((a: any, b: any) => b.id - a.id);
    } else {
      // Relevance / Featured
      filtered.sort((a: any, b: any) => {
        const aName = a.name?.toLowerCase().includes(qLower) ? 2 : 0;
        const bName = b.name?.toLowerCase().includes(qLower) ? 2 : 0;
        return bName - aName;
      });
    }

    const totalFilteredCount = filtered.length;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    // --- 4. Product Transformation ---
    const transformed = paginated.map((product: any) => {
      const activeVariants = (product.variants ?? []).filter((v: any) => v.status);
      let imageUrl = product.imageUrl;
      if (!imageUrl && activeVariants.length > 0) {
        const firstWithImg = activeVariants.find((v: any) => v.imageUrl);
        if (firstWithImg) imageUrl = firstWithImg.imageUrl;
      }

      const rStat = reviewStats[product.id];
      let avgRating = 0;
      let reviewsCount = 0;
      if (rStat && rStat.count > 0) {
        avgRating = parseFloat((rStat.sum / rStat.count).toFixed(1));
        reviewsCount = rStat.count;
      } else if (product.average_rating && Number(product.average_rating) > 0) {
        avgRating = parseFloat(String(product.average_rating));
        reviewsCount = product.reviews_count || 12;
      } else if (product.id && product.id % 4 !== 0) {
        const seedRatings = [4.5, 4.2, 4.8, 3.9, 4.6, 4.1, 4.7, 4.3, 3.8, 4.9];
        const seedCounts = [28, 64, 142, 12, 89, 45, 230, 78, 15, 310];
        avgRating = seedRatings[product.id % seedRatings.length];
        reviewsCount = seedCounts[product.id % seedCounts.length];
      } else {
        avgRating = 0;
        reviewsCount = 0;
      }

      const bestVariant = activeVariants.length > 0 ? activeVariants[0] : null;

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        image_url: imageUrl,
        category: product.category,
        brand: product.brand,
        brand_name: product.brand?.name,
        category_name: product.category?.name,
        average_rating: avgRating,
        reviews_count: reviewsCount,
        is_bestseller: product.isBestseller ?? product.is_bestseller ?? false,
        is_new_arrival: product.isNewArrival ?? product.is_new_arrival ?? false,
        variants: activeVariants.map((v: any) => ({
          id: v.id,
          title: v.title,
          mrp: parseFloat(v.mrp || '0'),
          sp: parseFloat(v.sp || '0'),
          stock: v.stock,
          image_url: v.imageUrl,
          color: v.variantAttributeValues?.find((vav: any) => vav.attributeValue?.value)?.attributeValue?.value,
        })),
        best_variant: bestVariant ? {
          id: bestVariant.id,
          title: bestVariant.title,
          mrp: parseFloat(bestVariant.mrp || '0'),
          sp: parseFloat(bestVariant.sp || '0'),
          stock: bestVariant.stock,
          image_url: bestVariant.imageUrl,
        } : null,
      };
    });

    return {
      res: 'success',
      message: 'Search completed successfully.',
      data: {
        products: transformed,
        facets: {
          narrow_options: narrow_options,
          available_categories: available_categories,
          available_brands: available_brands,
          available_colors: available_colors,
          price_stats: {
            min: minObservedPrice === Infinity ? 0 : Math.floor(minObservedPrice),
            max: maxObservedPrice === 0 ? 5000 : Math.ceil(maxObservedPrice),
          },
          rating_counts: {
            four_star: fourStarCount,
            three_star: threeStarCount,
            two_star: twoStarCount,
            one_star: oneStarCount,
          },
          discount_counts: {
            ten_plus: tenDiscountCount,
            twentyfive_plus: twentyfiveDiscountCount,
            fifty_plus: fiftyDiscountCount,
            seventy_plus: seventyDiscountCount,
          },
        },
        pagination: {
          current_page: page,
          total_count: totalFilteredCount,
          per_page: limit,
          total_pages: Math.ceil(totalFilteredCount / limit) || 1,
          has_more: page * limit < totalFilteredCount,
        },
        search_info: {
          query: qStr,
          results_count: transformed.length,
          total_results: totalFilteredCount,
        },
      },
    };
  }

  async getSubcategoryProduct(categoryIdOrSlug: string | number) {
    const catId = await this.resolveCategoryId(categoryIdOrSlug);
    if (!catId) {
      return {
        res: 'success',
        message: 'No products found for this category.',
        products: [],
      };
    }

    const categoryIds = await this.getAllDescendantCategoryIds(catId);
    const prodList = await this.db
      .select()
      .from(products)
      .where(
        and(
          categoryIds.length === 1
            ? eq(products.categoryId, categoryIds[0])
            : inArray(products.categoryId, categoryIds),
          eq(products.status, true),
        ),
      );

    const data = await this.hydrateProductsWithRelations(prodList);

    const activeProducts = data.filter((product: any) => {
      const activeVariants = (product.variants ?? []).filter((v: any) => v.status);
      return activeVariants.length > 0;
    });

    const transformed = activeProducts.map((product: any) => {
      const activeVariants = (product.variants ?? []).filter((v: any) => v.status);
      let imageUrl = product.imageUrl;
      if (!imageUrl && activeVariants.length > 0) {
        const firstWithImg = activeVariants.find((v: any) => v.imageUrl);
        if (firstWithImg) imageUrl = firstWithImg.imageUrl;
      }
      return {
        ...product,
        image_url: imageUrl,
        variants: activeVariants,
      };
    });

    return {
      res: 'success',
      message: transformed.length === 0
        ? 'No products found for this category.'
        : 'Products fetched successfully.',
      products: transformed,
    };
  }

  async getSimilarProducts(productIdOrSlug: string | number, query: any = {}): Promise<any> {
    let targetProduct: any = null;
    const numId = Number(productIdOrSlug);
    if (!isNaN(numId) && numId > 0 && String(productIdOrSlug).trim() === String(numId)) {
      targetProduct = await this.db.query.products.findFirst({
        where: eq(products.id, numId),
        with: { category: true } as any,
      });
    }

    if (!targetProduct) {
      const allProds: any[] = await this.db.query.products.findMany({
        with: { category: true } as any,
      });
      targetProduct = allProds.find((item: any) => matchesSlugOrId(item, productIdOrSlug));
    }

    if (!targetProduct) {
      throw new HttpException(
        { res: 'error', message: 'Product not found.' },
        HttpStatus.NOT_FOUND, // 404
      );
    }

    const productId = targetProduct.id;

    const page = Math.max(1, parseInt(query.page ?? '1'));
    const perPage = Math.max(1, parseInt(query.per_page ?? '10'));

    // Fetch all active products except current product
    const allActiveProdsRaw = await this.db
      .select()
      .from(products)
      .where(and(ne(products.id, productId), eq(products.status, true)))
      .orderBy(desc(products.createdAt));

    const allActiveProds = await this.hydrateProductsWithRelations(allActiveProdsRaw);

    const validProds = allActiveProds.filter(
      (p: any) => (p.variants ?? []).filter((v: any) => v.status).length > 0
    );

    // Get sibling category IDs under the same parent category if applicable
    let siblingCatIds: number[] = [];
    if ((targetProduct.category as any)?.parentId) {
      const parentId = (targetProduct.category as any).parentId;
      const siblingCategories = await this.db.query.categories.findMany({
        where: and(eq(categories.parentId, parentId), eq(categories.status, true)),
      });
      siblingCatIds = siblingCategories.map((c) => Number(c.id));
    }

    // 1. Primary: Same category / subcategory
    const sameCategoryProds = validProds.filter(
      (p: any) => Number(p.categoryId) === Number(targetProduct.categoryId)
    );

    // 2. Secondary: Sibling categories
    const siblingCategoryProds = validProds.filter(
      (p: any) =>
        Number(p.categoryId) !== Number(targetProduct.categoryId) &&
        siblingCatIds.includes(Number(p.categoryId))
    );

    // 3. Tertiary: Products from all other categories (when related products end)
    const otherCategoryProds = validProds.filter(
      (p: any) =>
        Number(p.categoryId) !== Number(targetProduct.categoryId) &&
        !siblingCatIds.includes(Number(p.categoryId))
    );

    // Combine in order: Same Category -> Sibling Categories -> Other Categories
    const combinedProducts = [
      ...sameCategoryProds,
      ...siblingCategoryProds,
      ...otherCategoryProds,
    ];

    const totalCount = combinedProducts.length;
    const paginated = combinedProducts.slice((page - 1) * perPage, page * perPage);

    const allReviews = await this.db.query.reviews.findMany({
      where: eq(reviews.isApproved, true),
    });
    const reviewStats: Record<number, { count: number; sum: number }> = {};
    for (const r of allReviews) {
      if (!reviewStats[r.productId]) reviewStats[r.productId] = { count: 0, sum: 0 };
      reviewStats[r.productId].count += 1;
      reviewStats[r.productId].sum += r.rating;
    }

    const transformed = paginated.map((product: any) => {
      const activeVariants = (product.variants ?? []).filter((v: any) => v.status);
      let imageUrl = product.imageUrl;
      if (!imageUrl && activeVariants.length > 0) {
        const firstWithImg = activeVariants.find((v: any) => v.imageUrl);
        if (firstWithImg) imageUrl = firstWithImg.imageUrl;
      }
      const rStat = reviewStats[product.id] ?? { count: 0, sum: 0 };
      const avgRating = rStat.count > 0 ? Math.round((rStat.sum / rStat.count) * 10) / 10 : 0;

      return {
        ...product,
        image_url: imageUrl,
        rating_summary: {
          average_rating: avgRating,
          reviews_count: rStat.count,
        },
      };
    });

    const lastPage = Math.ceil(totalCount / perPage) || 1;
    const hasNextPage = page < lastPage;

    return {
      res: 'success',
      message: 'Similar products fetched successfully.',
      products: transformed,
      pagination: {
        current_page: page,
        per_page: perPage,
        limit: perPage,
        total: totalCount,
        last_page: lastPage,
        has_more: hasNextPage,
        hasNextPage,
        has_next_page: hasNextPage,
      },
    };
  }

  async getMostOrderedProducts(query: any = {}): Promise<any> {
    const limit = Math.max(1, Math.min(50, parseInt(query.limit ?? '10')));
    const filterByStatus = query.filter_status === 'true' || query.filter_status === true;

    const allOrderItems = await this.db.query.orderItems.findMany({
      with: { order: true } as any,
    });

    const allLikes = await this.db.query.likes.findMany();
    const likeCounts: Record<number, number> = {};
    for (const l of allLikes) {
      likeCounts[l.productId] = (likeCounts[l.productId] ?? 0) + 1;
    }

    const allReviews = await this.db.query.reviews.findMany({
      where: eq(reviews.isApproved, true),
    });
    const reviewStats: Record<number, { count: number; sum: number }> = {};
    for (const r of allReviews) {
      if (!reviewStats[r.productId]) reviewStats[r.productId] = { count: 0, sum: 0 };
      reviewStats[r.productId].count += 1;
      reviewStats[r.productId].sum += r.rating;
    }

    const productStats: Record<number, { qty: number; count: number; revenue: number }> = {};
    for (const item of allOrderItems) {
      const orderStatus = (item as any).order?.status;
      if (filterByStatus && !['confirmed', 'processing', 'shipped', 'delivered'].includes(orderStatus)) {
        continue;
      }
      const pId = item.productId;
      if (!productStats[pId]) productStats[pId] = { qty: 0, count: 0, revenue: 0 };
      productStats[pId].qty += item.quantity;
      productStats[pId].count += 1;
      productStats[pId].revenue += parseFloat(item.total as string);
    }

    const orderedProductIds = Object.keys(productStats).map(Number);
    let fetchedProducts: any[] = [];

    if (orderedProductIds.length > 0) {
      const prodList = await this.db
        .select()
        .from(products)
        .where(and(eq(products.status, true), inArray(products.id, orderedProductIds)));
      fetchedProducts = await this.hydrateProductsWithRelations(prodList);
    }

    fetchedProducts = fetchedProducts.filter((p: any) => (p.variants ?? []).filter((v: any) => v.status).length > 0);
    fetchedProducts.sort((a, b) => (productStats[b.id]?.qty ?? 0) - (productStats[a.id]?.qty ?? 0));

    const mapped = (fetchedProducts as any[]).map((p: any) => {
      const activeVariants = (p.variants ?? []).filter((v: any) => v.status);
      const sps = activeVariants.map((v: any) => parseFloat(v.sp as string)).filter((val: number) => !isNaN(val));
      const minPrice = sps.length ? Math.min(...sps) : 0;
      const maxPrice = sps.length ? Math.max(...sps) : 0;
      const totalStock = activeVariants.reduce((sum: number, v: any) => sum + v.stock, 0);
      const bestVariant = [...activeVariants].sort((a: any, b: any) => parseFloat(a.sp) - parseFloat(b.sp))[0] ?? null;

      let imageUrl = p.imageUrl;
      if (!imageUrl && activeVariants.length > 0) {
        const firstWithImg = activeVariants.find((v: any) => v.imageUrl);
        imageUrl = firstWithImg ? firstWithImg.imageUrl : activeVariants[0].imageUrl;
      }

      const formattedVariants = activeVariants.map((v: any) => ({
        id: v.id,
        title: v.title,
        mrp: v.mrp,
        sp: v.sp,
        stock: v.stock,
        image_url: v.imageUrl,
        image_json: v.imageJson,
      }));

      const rStat = reviewStats[p.id] ?? { count: 0, sum: 0 };
      let avgRating = 0;
      let reviewsCount = 0;
      if (rStat && rStat.count > 0) {
        avgRating = Math.round((rStat.sum / rStat.count) * 10) / 10;
        reviewsCount = rStat.count;
      } else if (p.average_rating && Number(p.average_rating) > 0) {
        avgRating = Number(p.average_rating);
        reviewsCount = Number(p.reviews_count || 12);
      } else if (p.id && p.id % 4 !== 0) {
        const seedRatings = [4.5, 4.2, 4.8, 3.9, 4.6, 4.1, 4.7, 4.3, 3.8, 4.9];
        const seedCounts = [28, 64, 142, 12, 89, 45, 230, 78, 15, 310];
        avgRating = seedRatings[p.id % seedRatings.length];
        reviewsCount = seedCounts[p.id % seedCounts.length];
      } else {
        avgRating = 0;
        reviewsCount = 0;
      }

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        image_url: imageUrl,
        category: p.category ? { id: p.category.id, name: p.category.name } : null,
        brand: p.brand ? { id: p.brand.id, name: p.brand.name } : null,
        price_range: { min: minPrice, max: maxPrice, currency: 'INR' },
        total_stock: totalStock,
        likes_count: likeCounts[p.id] ?? 0,
        variants_count: activeVariants.length,
        variants: formattedVariants,
        best_variant: bestVariant ? {
          id: bestVariant.id,
          title: bestVariant.title,
          sku: bestVariant.sku,
          sp: bestVariant.sp,
          mrp: bestVariant.mrp,
          stock: bestVariant.stock,
          image_url: bestVariant.imageUrl,
        } : null,
        total_ordered_quantity: productStats[p.id]?.qty ?? 0,
        total_orders_count: productStats[p.id]?.count ?? 0,
        total_revenue: productStats[p.id]?.revenue ?? 0,
        average_rating: avgRating,
        reviews_count: reviewsCount,
        created_at: p.createdAt,
      };
    });

    let finalProducts = mapped;
    if (finalProducts.length < 8) {
      const neededCount = 8 - finalProducts.length;
      const existingIds = finalProducts.map((p) => p.id);
      // Fetch more than needed to account for products filtered out by zero active variants
      const newProdsRaw = await this.db
        .select()
        .from(products)
        .where(and(eq(products.status, true)))
        .orderBy(desc(products.createdAt))
        .limit(neededCount * 3);

      const newProds = await this.hydrateProductsWithRelations(newProdsRaw);

      const fillProds = newProds
        .filter((p: any) => !existingIds.includes(p.id) && (p.variants ?? []).filter((v: any) => v.status).length > 0)
        .slice(0, neededCount)
        .map((p: any) => {
          const activeVariants = (p.variants ?? []).filter((v: any) => v.status);
          const sps = activeVariants.map((v: any) => parseFloat(v.sp as string)).filter((val: number) => !isNaN(val));
          const bestVariant = [...activeVariants].sort((a: any, b: any) => parseFloat(a.sp) - parseFloat(b.sp))[0] ?? null;

          let imageUrl = p.imageUrl;
          if (!imageUrl && activeVariants.length > 0) {
            const firstWithImg = activeVariants.find((v: any) => v.imageUrl);
            imageUrl = firstWithImg ? firstWithImg.imageUrl : activeVariants[0].imageUrl;
          }

          const formattedVariants = activeVariants.map((v: any) => ({
            id: v.id,
            title: v.title,
            mrp: v.mrp,
            sp: v.sp,
            stock: v.stock,
            image_url: v.imageUrl,
            image_json: v.imageJson,
          }));

          const rStat = reviewStats[p.id] ?? { count: 0, sum: 0 };
          let avgRating = 0;
          let reviewsCount = 0;
          if (rStat && rStat.count > 0) {
            avgRating = Math.round((rStat.sum / rStat.count) * 10) / 10;
            reviewsCount = rStat.count;
          } else if (p.average_rating && Number(p.average_rating) > 0) {
            avgRating = Number(p.average_rating);
            reviewsCount = Number(p.reviews_count || 12);
          } else if (p.id && p.id % 4 !== 0) {
            const seedRatings = [4.5, 4.2, 4.8, 3.9, 4.6, 4.1, 4.7, 4.3, 3.8, 4.9];
            const seedCounts = [28, 64, 142, 12, 89, 45, 230, 78, 15, 310];
            avgRating = seedRatings[p.id % seedRatings.length];
            reviewsCount = seedCounts[p.id % seedCounts.length];
          } else {
            avgRating = 0;
            reviewsCount = 0;
          }

          return {
            id: p.id,
            name: p.name,
            description: p.description,
            image_url: imageUrl,
            category: p.category ? { id: p.category.id, name: p.category.name } : null,
            brand: p.brand ? { id: p.brand.id, name: p.brand.name } : null,
            price_range: { min: sps.length ? Math.min(...sps) : 0, max: sps.length ? Math.max(...sps) : 0, currency: 'INR' },
            total_stock: activeVariants.reduce((sum: number, v: any) => sum + v.stock, 0),
            likes_count: likeCounts[p.id] ?? 0,
            variants_count: activeVariants.length,
            variants: formattedVariants,
            best_variant: bestVariant ? {
              id: bestVariant.id,
              title: bestVariant.title,
              sku: bestVariant.sku,
              sp: bestVariant.sp,
              mrp: bestVariant.mrp,
              stock: bestVariant.stock,
              image_url: bestVariant.imageUrl,
            } : null,
            total_ordered_quantity: 0,
            total_orders_count: 0,
            total_revenue: 0,
            average_rating: avgRating,
            reviews_count: reviewsCount,
            created_at: p.createdAt,
          };
        });

      finalProducts = [...finalProducts, ...fillProds];
    }

    const totalUnitsSold = finalProducts.reduce((sum, p) => sum + (p.total_ordered_quantity ?? 0), 0);
    const totalRev = finalProducts.reduce((sum, p) => sum + (p.total_revenue ?? 0), 0);
    const totalOrders = finalProducts.reduce((sum, p) => sum + (p.total_orders_count ?? 0), 0);
    const avgRatingSum = finalProducts.reduce((sum, p) => sum + (p.average_rating ?? 0), 0);
    const overallAvgRating = finalProducts.length > 0 ? Math.round((avgRatingSum / finalProducts.length) * 10) / 10 : 0;

    const resultList = finalProducts.slice(0, limit);

    return {
      res: 'success',
      message: 'Most ordered products fetched successfully.',
      data: {
        products: resultList,
        count: resultList.length,
        limit,
        analytics: {
          total_units_sold: totalUnitsSold,
          total_revenue: totalRev,
          total_orders: totalOrders,
          average_rating: overallAvgRating,
        },
      },
    };
  }

  async getTopSellingProducts(query: any = {}) {
    const limit = Math.max(1, Math.min(50, parseInt(query.limit ?? '10')));
    const allLikes = await this.db.query.likes.findMany();
    const likeCounts: Record<number, number> = {};
    for (const l of allLikes) {
      likeCounts[l.productId] = (likeCounts[l.productId] ?? 0) + 1;
    }

    // Fetch more to account for products filtered out by zero active variants
    const prodsRaw = await this.db
      .select()
      .from(products)
      .where(eq(products.status, true))
      .limit(limit * 3);

    const prods = await this.hydrateProductsWithRelations(prodsRaw);

    prods.sort((a, b) => (likeCounts[b.id] ?? 0) - (likeCounts[a.id] ?? 0));

    const mapped = (prods as any[])
      .filter((product: any) => (product.variants ?? []).filter((v: any) => v.status).length > 0)
      .slice(0, limit)
      .map((product: any) => {
        const activeVariants = (product.variants ?? []).filter((v: any) => v.status);
        const sps = activeVariants.map((v: any) => parseFloat(v.sp as string));
        const minPrice = sps.length ? Math.min(...sps) : 0;
        const maxPrice = sps.length ? Math.max(...sps) : 0;
        const totalStock = activeVariants.reduce((sum: number, v: any) => sum + v.stock, 0);
        const bestVariant = [...activeVariants].sort((a: any, b: any) => parseFloat(a.sp) - parseFloat(b.sp))[0] ?? null;

        let imageUrl = product.imageUrl;
        if (!imageUrl && activeVariants.length > 0) {
          const firstWithImg = activeVariants.find((v: any) => v.imageUrl);
          imageUrl = firstWithImg ? firstWithImg.imageUrl : activeVariants[0].imageUrl;
        }

        const formattedVariants = activeVariants.map((v: any) => ({
          id: v.id,
          title: v.title,
          mrp: v.mrp,
          sp: v.sp,
          stock: v.stock,
          image_url: v.imageUrl,
          image_json: v.imageJson,
        }));

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          image_url: imageUrl,
          category: product.category ? { id: product.category.id, name: product.category.name } : null,
          brand: product.brand ? { id: product.brand.id, name: product.brand.name } : null,
          price_range: { min: minPrice, max: maxPrice, currency: 'INR' },
          total_stock: totalStock,
          likes_count: likeCounts[product.id] ?? 0,
          variants_count: activeVariants.length,
          variants: formattedVariants,
          best_variant: bestVariant,
          created_at: product.createdAt,
        };
      });

    return {
      res: 'success',
      message: 'Top selling products fetched successfully.',
      data: { products: mapped, count: mapped.length, limit },
    };
  }

  async debugOrderData(): Promise<any> {
    const productsCount = (await this.db.query.products.findMany()).length;
    const ordersCount = (await this.db.query.orders.findMany()).length;
    const orderItemsCount = (await this.db.query.orderItems.findMany()).length;

    const allOrders = await this.db.query.orders.findMany();
    const orderStatuses: Record<string, number> = {};
    for (const o of allOrders) {
      orderStatuses[o.status] = (orderStatuses[o.status] ?? 0) + 1;
    }

    const sampleOrderItems = await this.db.query.orderItems.findMany({
      with: { product: true } as any,
      limit: 10,
    });

    return {
      res: 'success',
      debug_data: {
        counts: { products: productsCount, orders: ordersCount, order_items: orderItemsCount },
        order_statuses: Object.entries(orderStatuses).map(([status, count]) => ({ status, count })),
        sample_order_items: sampleOrderItems,
      },
    };
  }

  async getNewArrivalProducts(query: any = {}): Promise<any> {
    const data = await this.db.query.products.findMany({
      where: and(eq(products.isNewArrival, true), eq(products.status, true)),
      with: {
        variants: { where: eq(variants.status, true) },
        brand: true,
        category: true,
      } as any,
    });

    // Exclude products with zero active variants
    const activeData = (data as any[]).filter(
      (product: any) => (product.variants ?? []).filter((v: any) => v.status).length > 0,
    );

    const allReviews = await this.db.query.reviews.findMany({
      where: eq(reviews.isApproved, true),
    });
    const reviewStats: Record<number, { count: number; sum: number }> = {};
    for (const r of allReviews) {
      if (!reviewStats[r.productId]) reviewStats[r.productId] = { count: 0, sum: 0 };
      reviewStats[r.productId].count += 1;
      reviewStats[r.productId].sum += r.rating;
    }

    const mapped = activeData.map((product: any) => {
      const activeVariants = (product.variants ?? []).filter((v: any) => v.status);
      let imageUrl = product.imageUrl;
      if (!imageUrl && activeVariants.length > 0) {
        const firstWithImg = activeVariants.find((v: any) => v.imageUrl);
        if (firstWithImg) imageUrl = firstWithImg.imageUrl;
      }

      const rStat = reviewStats[product.id] ?? { count: 0, sum: 0 };
      let avgRating = 0;
      let reviewsCount = 0;
      if (rStat && rStat.count > 0) {
        avgRating = Math.round((rStat.sum / rStat.count) * 10) / 10;
        reviewsCount = rStat.count;
      } else if (product.average_rating && Number(product.average_rating) > 0) {
        avgRating = Number(product.average_rating);
        reviewsCount = Number(product.reviews_count || 12);
      } else if (product.id && product.id % 4 !== 0) {
        const seedRatings = [4.5, 4.2, 4.8, 3.9, 4.6, 4.1, 4.7, 4.3, 3.8, 4.9];
        const seedCounts = [28, 64, 142, 12, 89, 45, 230, 78, 15, 310];
        avgRating = seedRatings[product.id % seedRatings.length];
        reviewsCount = seedCounts[product.id % seedCounts.length];
      } else {
        avgRating = 0;
        reviewsCount = 0;
      }

      const sortedVariants = [...activeVariants].sort((a: any, b: any) => parseFloat(a.sp) - parseFloat(b.sp));
      const bestVariant = sortedVariants[0] ? {
        id: sortedVariants[0].id,
        sp: sortedVariants[0].sp,
        mrp: sortedVariants[0].mrp,
        stock: sortedVariants[0].stock,
        image_url: sortedVariants[0].imageUrl,
      } : null;

      const sps = activeVariants.map((v: any) => parseFloat(v.sp as string)).filter((val: number) => !isNaN(val));

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        image_url: imageUrl,
        is_new_arrival: product.isNewArrival,
        average_rating: avgRating,
        reviews_count: reviewsCount,
        brand: product.brand ? { id: product.brand.id, name: product.brand.name } : null,
        category: product.category ? { id: product.category.id, name: product.category.name } : null,
        best_variant: bestVariant,
        min_price: sps.length ? Math.min(...sps) : null,
        max_price: sps.length ? Math.max(...sps) : null,
        variants: activeVariants.map((v: any) => ({
          id: v.id,
          title: v.title,
          mrp: v.mrp,
          sp: v.sp,
          stock: v.stock,
          image_url: v.imageUrl,
          image_json: v.imageJson,
        })),
      };
    });

    if (query?.page || query?.limit || query?.per_page || query?.paginate) {
      const page = Math.max(1, parseInt(query.page ?? '1'));
      const limit = Math.max(1, parseInt(query.limit ?? query.per_page ?? '10'));
      const total = mapped.length;
      const start = (page - 1) * limit;
      const paginated = mapped.slice(start, start + limit);
      const lastPage = Math.max(1, Math.ceil(total / limit));
      const hasNextPage = page < lastPage;

      return {
        success: true,
        message: 'New arrival products fetched successfully.',
        data: paginated,
        total,
        current_page: page,
        per_page: limit,
        limit,
        last_page: lastPage,
        hasNextPage,
        has_next_page: hasNextPage,
        has_more: hasNextPage,
        pagination: {
          current_page: page,
          per_page: limit,
          limit,
          total,
          last_page: lastPage,
          hasNextPage,
          has_next_page: hasNextPage,
          has_more: hasNextPage,
        },
      };
    }

    return {
      success: true,
      message: 'New arrival products fetched successfully.',
      data: mapped,
    };
  }

  async getAdminProducts(query: any): Promise<any> {
    try {
      const perPage = Math.max(1, parseInt(query.limit ?? query.per_page ?? '10'));
      const page = Math.max(1, parseInt(query.page ?? '1'));
      const search = query.search?.trim();
      const isCategoryFilterSpecified = query.category_id !== undefined && query.category_id !== '' && query.category_id !== null;
      const categoryId = isCategoryFilterSpecified
        ? await this.resolveCategoryId(query.category_id, query.parent_id)
        : undefined;

      const brandId = query.brand_id ? parseInt(query.brand_id) : undefined;
      const statusFilter = query.status !== undefined && query.status !== '' ? (query.status === 'true' || query.status === true || query.status === '1') : undefined;
      const isNewArrivalFilter = query.is_new_arrival !== undefined && query.is_new_arrival !== '' && query.is_new_arrival !== 'all' ? (query.is_new_arrival === 'true' || query.is_new_arrival === true || query.is_new_arrival === '1') : undefined;

      const conditions: any[] = [];
      if (isCategoryFilterSpecified) {
        if (categoryId) {
          const categoryIds = await this.getAllDescendantCategoryIds(categoryId);
          if (categoryIds.length === 1) {
            conditions.push(eq(products.categoryId, categoryIds[0]));
          } else if (categoryIds.length > 1) {
            conditions.push(inArray(products.categoryId, categoryIds));
          }
        } else {
          conditions.push(sql`1=0`);
        }
      }
      if (brandId) conditions.push(eq(products.brandId, brandId));
      if (statusFilter !== undefined) conditions.push(eq(products.status, statusFilter));
      if (isNewArrivalFilter !== undefined) conditions.push(eq(products.isNewArrival, isNewArrivalFilter));
      if (search) {
        // Query variants table for matching SKU or variant title
        const matchingVariants = await this.db.query.variants.findMany({
          where: or(
            like(variants.sku, `%${search}%`),
            like(variants.title, `%${search}%`),
          ),
          columns: { productId: true },
        });
        const variantProductIds = Array.from(
          new Set(matchingVariants.map((v: any) => Number(v.productId)).filter(Boolean)),
        );

        if (variantProductIds.length > 0) {
          conditions.push(
            or(
              like(products.name, `%${search}%`),
              like(products.description, `%${search}%`),
              like(products.itemCode, `%${search}%`),
              inArray(products.id, variantProductIds),
            ),
          );
        } else {
          conditions.push(
            or(
              like(products.name, `%${search}%`),
              like(products.description, `%${search}%`),
              like(products.itemCode, `%${search}%`),
            ),
          );
        }
      }

      const prodList = await this.db
        .select()
        .from(products)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(products.createdAt));

      const allMatching = await this.hydrateProductsWithRelations(prodList);

      const stockStatusRaw = (query.stock_status || query.stockStatus || query.tab || 'all').toLowerCase().trim();

      let totalAll = 0;
      let totalLowStock = 0;
      let totalOutOfStock = 0;

      const processedProducts = allMatching.map((product: any) => {
        const vList = product.variants ?? [];
        let imageUrl = product.imageUrl;
        if (!imageUrl && vList.length > 0) {
          const firstWithImg = vList.find((v: any) => v.imageUrl);
          if (firstWithImg) imageUrl = firstWithImg.imageUrl;
        }

        const totalStock = vList.reduce((sum: number, v: any) => sum + (v.stock ?? 0), 0);
        const lowStockVariantsCount = vList.filter((v: any) => (v.stock ?? 0) > 0 && (v.stock ?? 0) <= 5).length;
        const outOfStockVariantsCount = vList.filter((v: any) => (v.stock ?? 0) === 0).length;

        const isOutOfStock = totalStock === 0 || outOfStockVariantsCount > 0;
        const isLowStock = (totalStock > 0 && totalStock <= 5) || lowStockVariantsCount > 0;

        totalAll++;
        if (isLowStock) totalLowStock++;
        if (isOutOfStock) totalOutOfStock++;

        const sps = vList.map((v: any) => parseFloat(v.sp as string)).filter((val: number) => !isNaN(val));
        const minPrice = sps.length ? Math.min(...sps) : 0;
        const maxPrice = sps.length ? Math.max(...sps) : 0;
        const productSlug = (product.slug || product.name || '')
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        return {
          id: product.id,
          name: product.name,
          slug: productSlug,
          item_code: product.itemCode,
          image_url: imageUrl,
          status: product.status,
          is_new_arrival: product.isNewArrival,
          category_id: product.categoryId,
          brand_id: product.brandId,
          created_at: product.createdAt,
          updated_at: product.updatedAt,
          category: product.category ? {
            id: product.category.id,
            name: product.category.name,
            slug: (product.category.slug || product.category.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          } : null,
          brand: product.brand ? { id: product.brand.id, name: product.brand.name } : null,
          total_stock: totalStock,
          is_low_stock: isLowStock,
          is_out_of_stock: isOutOfStock,
          low_stock_variants_count: lowStockVariantsCount,
          out_of_stock_variants_count: outOfStockVariantsCount,
          min_price: minPrice,
          max_price: maxPrice,
          variants_count: vList.length,
          item_attributes: (product.itemAttributes ?? []).map((ia: any) => ({
            productId: ia.productId,
            attributeId: ia.attributeId,
            attribute_id: ia.attributeId,
            hasImages: ia.hasImages,
            has_images: ia.hasImages,
            isPrimary: ia.isPrimary,
            is_primary: ia.isPrimary,
          })),
          variants: vList.map((v: any) => this.formatVariant(v)),
        };
      });

      // Filter by stock status if requested
      let filteredProducts = processedProducts;
      if (stockStatusRaw === 'low_stock' || stockStatusRaw === 'low-stock') {
        filteredProducts = processedProducts.filter((p: any) => p.is_low_stock);
      } else if (stockStatusRaw === 'out_of_stock' || stockStatusRaw === 'out-of-stock') {
        filteredProducts = processedProducts.filter((p: any) => p.is_out_of_stock);
      } else if (stockStatusRaw === 'in_stock' || stockStatusRaw === 'in-stock') {
        filteredProducts = processedProducts.filter((p: any) => !p.is_out_of_stock && !p.is_low_stock);
      }

      const total = filteredProducts.length;
      const paginated = filteredProducts.slice((page - 1) * perPage, page * perPage);

      const lastPage = Math.ceil(total / perPage) || 1;
      const fromIndex = total > 0 ? (page - 1) * perPage + 1 : null;
      const toIndex = total > 0 ? Math.min(page * perPage, total) : null;
      const hasNextPage = page < lastPage;

      return {
        res: 'success',
        message: 'Products fetched successfully',
        data: {
          products: paginated,
          counts: {
            all: totalAll,
            low_stock: totalLowStock,
            out_of_stock: totalOutOfStock,
          },
          pagination: {
            current_page: page,
            page,
            per_page: perPage,
            limit: perPage,
            total,
            last_page: lastPage,
            has_next_page: hasNextPage,
            hasNextPage,
            has_more: hasNextPage,
            from: fromIndex,
            to: toIndex,
          },
        },
      };
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { res: 'error', message: 'Failed to fetch admin products: ' + e.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProductDetails(idOrSlug: string | number): Promise<any> {
    try {
      let product: any = null;
      const numId = Number(idOrSlug);
      if (!isNaN(numId) && numId > 0 && String(idOrSlug).trim() === String(numId)) {
        product = await this.findFullProductById(numId, true);
      }

      if (!product) {
        const allProds = await this.db.select().from(products);
        const match = allProds.find((item: any) => matchesSlugOrId(item, idOrSlug));
        if (match) {
          product = await this.findFullProductById(Number(match.id), true);
        }
      }

      if (!product) {
        throw new HttpException(
          { res: 'error', message: 'Product not found.' },
          HttpStatus.NOT_FOUND,
        );
      }

      let imageUrl = product.imageUrl;
      if (!imageUrl && product.variants?.length > 0) {
        const firstWithImg = product.variants.find((v: any) => v.imageUrl);
        if (firstWithImg) imageUrl = firstWithImg.imageUrl;
      }

      const formattedProduct = this.formatProduct({
        ...product,
        image_url: imageUrl,
      });

      return {
        res: 'success',
        message: 'Product details fetched successfully',
        product: formattedProduct,
      };
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { res: 'error', message: 'Failed to fetch product details: ' + e.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async store(body: any): Promise<any> {
    if (!body?.name) {
      throw new HttpException(
        { res: 'error', message: 'The name field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const categoryId = body.category_id ? Number(body.category_id) : null;
    if (!categoryId) {
      throw new HttpException(
        { res: 'error', message: 'The selected category id is invalid.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const category = await this.db.query.categories.findFirst({ where: eq(categories.id, categoryId) });
    if (!category) {
      throw new HttpException(
        { res: 'error', message: 'The selected category id is invalid.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const brandIdRaw = body.brand_id ?? body.brandId ?? body.brand?.id;
    const brandId = brandIdRaw ? Number(brandIdRaw) : null;
    if (brandId) {
      const brand = await this.db.query.brands.findFirst({ where: eq(brands.id, brandId) });
      if (!brand) {
        throw new HttpException(
          { res: 'error', message: 'The selected brand id is invalid.' },
          HttpStatus.UNPROCESSABLE_ENTITY, // 422
        );
      }
    }

    // Duplicate check: LOWER(name) + category_id + brand_id
    const nameLower = body.name.toLowerCase();
    const existing = await this.db.query.products.findFirst({
      where: and(
        sql`LOWER(${products.name}) = ${nameLower}`,
        eq(products.categoryId, categoryId),
        brandId ? eq(products.brandId, brandId) : isNull(products.brandId),
      ),
    });

    if (existing) {
      throw new HttpException(
        { res: 'error', message: 'This product already exists in the selected category/brand.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    // Check variant SKUs for duplicates in database
    if (body.variants?.length) {
      for (const vData of body.variants) {
        if (vData.sku) {
          const skuDup = await this.db.query.variants.findFirst({ where: eq(variants.sku, vData.sku) });
          if (skuDup) {
            throw new HttpException(
              { res: 'error', message: `The SKU '${vData.sku}' is already in use by another variant.` },
              HttpStatus.UNPROCESSABLE_ENTITY, // 422
            );
          }
        }
      }
    }

    try {
      const [r] = await this.db.insert(products).values({
        name: body.name,
        description: body.description ?? null,
        itemCode: body.item_code ?? body.itemCode ?? null,
        categoryId: categoryId,
        brandId: brandId,
        status: body.status !== undefined ? Boolean(body.status) : true,
        featureJson: body.feature_json ? body.feature_json : (body.featureList ? JSON.stringify(body.featureList) : null),
        detailJson: body.detail_json ? body.detail_json : (body.detailList ? JSON.stringify(body.detailList) : null),
        imageUrl: body.image_url ?? null,
        imageJson: body.image_json ? body.image_json : (body.imageList ? JSON.stringify(body.imageList) : null),
        isNewArrival: body.is_new_arrival ?? false,
      }).$returningId();

      const productId = r.id;

      if (body.variants?.length) {
        const allAttributeValueIds = new Set<number>();

        for (const variantData of body.variants) {
          const attrValues: number[] = variantData.attributeValues ?? [];
          const [v] = await this.db.insert(variants).values({
            title: variantData.title ?? null,
            sku: variantData.sku,
            mrp: variantData.mrp,
            sp: variantData.sp,
            bp: variantData.bp,
            stock: variantData.stock !== undefined && variantData.stock !== null ? Number(variantData.stock) : 0,
            imageUrl: variantData.image_url ?? null,
            imageJson: variantData.image_json ? (typeof variantData.image_json === 'string' ? variantData.image_json : JSON.stringify(variantData.image_json)) : null,
            productId,
            status: variantData.status !== undefined ? Boolean(variantData.status) : true,
          }).$returningId();

          if (attrValues.length) {
            for (const attrValId of attrValues) {
              await this.db.insert(variantAttributeValues).values({
                variantId: v.id,
                attributeValueId: attrValId,
              });
              allAttributeValueIds.add(attrValId);
            }
          }
        }

        if (allAttributeValueIds.size > 0) {
          await this._syncProductAttributes(productId, categoryId, Array.from(allAttributeValueIds));
        }
      }

      const createdProduct = await this.findProductWithRelations(productId);

      const formatted = this.formatProduct(createdProduct);
      this.productsGateway.emitProductCreated(formatted);

      return {
        res: 'success',
        message: `${body.name} has been created successfully.`,
        product: formatted,
      };
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { res: 'error', message: 'The product could not be added.', error_detail: e.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: number, body: any) {
    const existingProduct = await this.db.query.products.findFirst({ where: eq(products.id, id) });
    if (!existingProduct) {
      throw new HttpException(
        { res: 'error', message: 'Product not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (!body?.name) {
      throw new HttpException(
        { res: 'error', message: 'The name field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    let categoryId = existingProduct.categoryId;
    if (body.category_id !== undefined || body.categoryId !== undefined) {
      const rawCat = body.category_id ?? body.categoryId;
      if (rawCat !== null && rawCat !== '') {
        if (!isNaN(Number(rawCat))) {
          const cat = await this.db.query.categories.findFirst({ where: eq(categories.id, Number(rawCat)) });
          if (cat) categoryId = cat.id;
        } else {
          const allCats = await this.db.query.categories.findMany();
          const targetSlug = String(rawCat).toLowerCase().trim();
          const cat = allCats.find((c) => {
            const s = (c.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            return s === targetSlug || (c.name || '').toLowerCase().trim() === targetSlug;
          });
          if (cat) categoryId = cat.id;
        }
      }
    }

    const brandIdRaw = body.brand_id ?? body.brandId ?? body.brand?.id;
    let brandId: number | null = existingProduct.brandId;
    if (brandIdRaw !== undefined && brandIdRaw !== null) {
      if (brandIdRaw === "" || brandIdRaw === 0 || brandIdRaw === "0") {
        brandId = null;
      } else if (!isNaN(Number(brandIdRaw))) {
        const bId = Number(brandIdRaw);
        const brand = await this.db.query.brands.findFirst({ where: eq(brands.id, bId) });
        if (brand) brandId = brand.id;
      }
    }

    // Duplicate check: LOWER(name) + category_id + brand_id where id != id
    const nameLower = body.name.toLowerCase().trim();
    const duplicate = await this.db.query.products.findFirst({
      where: and(
        sql`LOWER(${products.name}) = ${nameLower}`,
        eq(products.categoryId, categoryId),
        brandId ? eq(products.brandId, brandId) : isNull(products.brandId),
        ne(products.id, id),
      ),
    });

    if (duplicate) {
      throw new HttpException(
        { res: 'error', message: 'This product already exists in the selected category/brand.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    // Check SKU duplicates for variant updates
    if (body.variants?.length) {
      for (const vData of body.variants) {
        if (vData.sku) {
          const numVId = vData.id && !isNaN(Number(vData.id)) ? Number(vData.id) : null;
          const skuDup = await this.db.query.variants.findFirst({
            where: numVId
              ? and(eq(variants.sku, vData.sku), ne(variants.id, numVId))
              : eq(variants.sku, vData.sku),
          });
          if (skuDup) {
            throw new HttpException(
              { res: 'error', message: `The SKU '${vData.sku}' is already in use by another variant.` },
              HttpStatus.UNPROCESSABLE_ENTITY, // 422
            );
          }
        }
      }
    }

    try {
      const featureJsonVal = body.feature_json ? body.feature_json : (body.featureList ? JSON.stringify(body.featureList) : existingProduct.featureJson);
      const detailJsonVal = body.detail_json ? body.detail_json : (body.detailList ? JSON.stringify(body.detailList) : existingProduct.detailJson);
      const imageJsonVal = body.image_json ? body.image_json : (body.imageList ? JSON.stringify(body.imageList) : existingProduct.imageJson);

      await this.db.update(products).set({
        name: body.name,
        description: body.description ?? null,
        itemCode: body.item_code ?? body.itemCode ?? null,
        categoryId: categoryId,
        brandId: brandId,
        status: body.status !== undefined ? Boolean(body.status) : existingProduct.status,
        featureJson: featureJsonVal,
        detailJson: detailJsonVal,
        imageUrl: body.image_url ?? body.imageUrl ?? existingProduct.imageUrl,
        imageJson: imageJsonVal,
        isNewArrival: body.is_new_arrival !== undefined ? Boolean(body.is_new_arrival) : existingProduct.isNewArrival,
      }).where(eq(products.id, id));

      if (body.variants !== undefined) {
        const allAttributeValueIds = new Set<number>();
        const keepVariantIds: number[] = [];

        for (const vData of body.variants) {
          const rawId = vData.id;
          const numVarId = rawId && !isNaN(Number(rawId)) ? Number(rawId) : null;
          let existingVar: any = null;
          if (numVarId) {
            existingVar = await this.db.query.variants.findFirst({
              where: and(eq(variants.id, numVarId), eq(variants.productId, id)),
            });
          }

          let variantId: number;
          const vImgUrl = vData.image_url ?? vData.imageUrl ?? null;
          const vImgJson = vData.image_json ? (typeof vData.image_json === 'string' ? vData.image_json : JSON.stringify(vData.image_json)) : (vData.imageJson ? (typeof vData.imageJson === 'string' ? vData.imageJson : JSON.stringify(vData.imageJson)) : null);

          if (existingVar) {
            variantId = Number(existingVar.id);
            await this.db.update(variants).set({
              title: vData.title ?? existingVar.title,
              sku: vData.sku ?? existingVar.sku,
              mrp: vData.mrp !== undefined && vData.mrp !== null ? String(vData.mrp) : String(existingVar.mrp),
              sp: vData.sp !== undefined && vData.sp !== null ? String(vData.sp) : String(existingVar.sp),
              bp: vData.bp !== undefined && vData.bp !== null ? String(vData.bp) : String(existingVar.bp),
              stock: vData.stock !== undefined && vData.stock !== null ? Number(vData.stock) : 0,
              imageUrl: vImgUrl,
              imageJson: vImgJson,
              status: vData.status !== undefined ? Boolean(vData.status) : true,
            } as any).where(eq(variants.id, variantId));
          } else {
            const [newV] = await this.db.insert(variants).values({
              title: vData.title ?? '',
              sku: vData.sku ?? '',
              mrp: vData.mrp !== undefined && vData.mrp !== null ? String(vData.mrp) : '0',
              sp: vData.sp !== undefined && vData.sp !== null ? String(vData.sp) : '0',
              bp: vData.bp !== undefined && vData.bp !== null ? String(vData.bp) : '0',
              stock: vData.stock !== undefined && vData.stock !== null ? Number(vData.stock) : 0,
              imageUrl: vImgUrl,
              imageJson: vImgJson,
              productId: id,
              status: vData.status !== undefined ? Boolean(vData.status) : true,
            } as any).$returningId();
            variantId = Number(newV.id);
          }

          keepVariantIds.push(variantId);

          const uniqueAttrValIds: number[] = Array.from(new Set(
            (vData.attributeValues || [])
              .map((av: any) => Number(av))
              .filter((av: number) => !isNaN(av) && av > 0)
          )) as number[];

          await this.db.delete(variantAttributeValues).where(eq(variantAttributeValues.variantId, variantId));
          for (const attrValId of uniqueAttrValIds) {
            const avExists = await this.db.query.attributeValues.findFirst({
              where: eq(attributeValues.id, attrValId),
            });
            if (avExists) {
              await this.db.insert(variantAttributeValues).values({ variantId, attributeValueId: attrValId });
              allAttributeValueIds.add(attrValId);
            }
          }
        }

        const currentVariants = await this.db.query.variants.findMany({ where: eq(variants.productId, id) });
        for (const cv of currentVariants) {
          if (!keepVariantIds.includes(cv.id)) {
            try {
              await this.destroyVariant(cv.id);
            } catch (err: any) {
              await this.db.update(variants).set({ status: false }).where(eq(variants.id, cv.id));
            }
          }
        }

        await this.db.delete(itemAttributes).where(eq(itemAttributes.productId, id));
        await this.db.delete(productAttributeValues).where(eq(productAttributeValues.productId, id));
        if (allAttributeValueIds.size > 0) {
          await this._syncProductAttributes(id, categoryId, Array.from(allAttributeValueIds));
        }
      }

      const updatedProduct = await this.findProductWithRelations(id);

      const formatted = this.formatProduct(updatedProduct);
      this.productsGateway.emitProductUpdated(formatted);

      return {
        res: 'success',
        message: 'Product updated successfully.',
        product: formatted,
      };
    } catch (e: any) {
      console.error('Error updating product:', e);
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { res: 'error', message: e.message || 'Failed to update product.' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async destroy(id: number) {
    const product = await this.db.query.products.findFirst({ where: eq(products.id, id) });
    if (!product) {
      throw new HttpException(
        { res: 'error', message: 'Product not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    const hasOrders = await this.db.query.orderItems.findFirst({
      where: eq(orderItems.productId, id),
    });

    if (hasOrders) {
      throw new HttpException(
        {
          res: 'error',
          message: 'This product cannot be deleted because it is associated with existing orders.',
        },
        HttpStatus.BAD_REQUEST, // 400
      );
    }

    const productVariants = await this.db.query.variants.findMany({ where: eq(variants.productId, id) });
    for (const v of productVariants) {
      await this.destroyVariant(v.id);
    }
    await this.db.delete(itemAttributes).where(eq(itemAttributes.productId, id));
    await this.db.delete(productAttributeValues).where(eq(productAttributeValues.productId, id));
    await this.db.delete(products).where(eq(products.id, id));

    this.productsGateway.emitProductDeleted(id);

    return { res: 'success', message: 'Product and its variants deleted successfully' };
  }

  async changeStatus(id: number) {
    const product = await this.db.query.products.findFirst({ where: eq(products.id, id) });
    if (!product) {
      throw new HttpException(
        { res: 'error', message: 'Product not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    const newStatus = !product.status;
    await this.db.update(products).set({ status: newStatus }).where(eq(products.id, id));

    const updated = await this.findProductWithRelations(id);
    const formatted = this.formatProduct(updated);
    this.productsGateway.emitProductStatusChanged(id, newStatus, formatted);
    this.productsGateway.emitProductUpdated(formatted);

    return { result: 'success', message: 'Status updated successfully', status: newStatus };
  }

  async toggleNewArrival(id: number) {
    const p = await this.db.query.products.findFirst({ where: eq(products.id, id) });
    if (!p) {
      throw new HttpException(
        { res: 'error', message: 'Product not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    const newStatus = !p.isNewArrival;
    await this.db.update(products).set({ isNewArrival: newStatus }).where(eq(products.id, id));

    const updated = await this.findProductWithRelations(id);
    const formatted = this.formatProduct(updated);
    this.productsGateway.emitProductUpdated(formatted);

    return {
      success: true,
      message: newStatus ? 'Tagged as New Arrival' : 'Removed from New Arrivals',
      is_new_arrival: newStatus,
    };
  }

  // === VARIANTS ===
  async getVariants(): Promise<any> {
    const list = await this.db.query.variants.findMany({
      with: { product: true } as any,
    });
    return list.map((v) => this.formatVariant(v));
  }

  async showVariant(id: number): Promise<any> {
    const v = await this.db.query.variants.findFirst({
      where: eq(variants.id, id),
      with: {
        product: {
          with: {
            brand: true,
            category: true,
          },
        },
      } as any,
    });
    if (!v) {
      throw new HttpException(
        { res: 'error', message: 'Variant not found.' },
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      success: true,
      message: 'Variant details fetched successfully.',
      data: this.formatVariant(v),
    };
  }

  async storeVariant(body: any) {
    if (!body?.title) {
      throw new HttpException(
        { res: 'error', message: 'The title field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (!body?.sku) {
      throw new HttpException(
        { res: 'error', message: 'The sku field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const productId = body.product_id ? Number(body.product_id) : null;
    if (!productId) {
      throw new HttpException(
        { res: 'error', message: 'The selected product id is invalid.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const product = await this.db.query.products.findFirst({ where: eq(products.id, productId) });
    if (!product) {
      throw new HttpException(
        { res: 'error', message: 'The selected product id is invalid.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    // SKU unique check
    const skuDup = await this.db.query.variants.findFirst({ where: eq(variants.sku, body.sku) });
    if (skuDup) {
      throw new HttpException(
        { res: 'error', message: 'The SKU field must be unique.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    // Duplicate title check for product
    const titleLower = body.title.toLowerCase();
    const existing = await this.db.query.variants.findFirst({
      where: and(
        sql`LOWER(${variants.title}) = ${titleLower}`,
        eq(variants.productId, productId),
      ),
    });

    if (existing) {
      throw new HttpException(
        { res: 'error', message: 'This variant already exists for the selected product.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const [r] = await this.db.insert(variants).values({
      title: body.title,
      sku: body.sku,
      mrp: body.mrp,
      sp: body.sp,
      bp: body.bp,
      stock: body.stock !== undefined && body.stock !== null ? Number(body.stock) : 0,
      imageUrl: body.image_url ?? null,
      imageJson: body.image_json ? (typeof body.image_json === 'string' ? body.image_json : JSON.stringify(body.image_json)) : null,
      productId: productId,
      status: body.status !== undefined ? Boolean(body.status) : true,
    }).$returningId();

    if (body.attributeValues?.length) {
      for (const attrValId of body.attributeValues) {
        await this.db.insert(variantAttributeValues).values({ variantId: r.id, attributeValueId: attrValId });
      }
    }

    const createdVariant = await this.db.query.variants.findFirst({
      where: eq(variants.id, r.id),
      with: { product: true } as any,
    });

    const formattedVariant = this.formatVariant(createdVariant);
    if (productId) {
      const full = await this.findProductWithRelations(productId);
      if (full) {
        const formatted = this.formatProduct(full);
        this.productsGateway.emitProductStockUpdated({
          productId: Number(productId),
          variantId: Number(r.id),
          stock: Number(createdVariant?.stock ?? 0),
          totalStock: Number(formatted?.stock ?? 0),
          product: formatted,
        });
      }
    }

    return {
      res: 'success',
      variant: formattedVariant,
    };
  }

  async updateVariant(id: number, body: any) {
    const variant = await this.db.query.variants.findFirst({ where: eq(variants.id, id) });
    if (!variant) {
      throw new HttpException(
        { res: 'error', message: 'Variant not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (!body?.title) {
      throw new HttpException(
        { res: 'error', message: 'The title field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (!body?.sku) {
      throw new HttpException(
        { res: 'error', message: 'The sku field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const productId = body.productId ?? variant.productId;
    if (productId) {
      const parentProduct = await this.db.query.products.findFirst({ where: eq(products.id, productId) });
      if (!parentProduct) {
        throw new HttpException(
          { res: 'error', message: 'The selected product does not exist.' },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    // SKU unique check excluding current ID
    const skuDup = await this.db.query.variants.findFirst({
      where: and(eq(variants.sku, body.sku), ne(variants.id, id)),
    });
    if (skuDup) {
      throw new HttpException(
        { res: 'error', message: 'The SKU field must be unique.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    // Duplicate title check for product excluding current ID
    const titleLower = body.title.toLowerCase();
    const duplicate = await this.db.query.variants.findFirst({
      where: and(
        sql`LOWER(${variants.title}) = ${titleLower}`,
        eq(variants.productId, productId),
        ne(variants.id, id),
      ),
    });

    if (duplicate) {
      throw new HttpException(
        { res: 'error', message: 'This variant already exists for the selected product.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    await this.db.update(variants).set({
      title: body.title,
      sku: body.sku,
      mrp: body.mrp,
      sp: body.sp,
      bp: body.bp,
      stock: body.stock !== undefined && body.stock !== null ? Number(body.stock) : variant.stock,
      imageUrl: body.image_url ?? variant.imageUrl,
      status: body.status !== undefined ? Boolean(body.status) : variant.status,
      productId: productId,
    }).where(eq(variants.id, id));

    if (body.attributeValues !== undefined) {
      await this.db.delete(variantAttributeValues).where(eq(variantAttributeValues.variantId, id));
      if (body.attributeValues?.length) {
        for (const attrValId of body.attributeValues) {
          await this.db.insert(variantAttributeValues).values({ variantId: id, attributeValueId: attrValId });
        }
      }
    }

    const updatedVariant = await this.db.query.variants.findFirst({
      where: eq(variants.id, id),
      with: { product: true } as any,
    });

    const formattedVariant = this.formatVariant(updatedVariant);
    if (productId) {
      const full = await this.findProductWithRelations(productId);
      if (full) {
        const formatted = this.formatProduct(full);
        this.productsGateway.emitProductStockUpdated({
          productId: Number(productId),
          variantId: Number(id),
          stock: Number(updatedVariant?.stock ?? 0),
          totalStock: Number(formatted?.stock ?? 0),
          product: formatted,
        });
      }
    }

    return {
      res: 'success',
      variant: formattedVariant,
    };
  }

  async destroyVariant(id: number) {
    const variant = await this.db.query.variants.findFirst({ where: eq(variants.id, id) });
    if (!variant) {
      throw new HttpException(
        { res: 'error', message: 'Variant not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.db.delete(variantAttributeValues).where(eq(variantAttributeValues.variantId, id));
    await this.db.delete(carts).where(eq(carts.variantId, id));
    await this.db.delete(variants).where(eq(variants.id, id));

    if (variant.productId) {
      const full = await this.findProductWithRelations(variant.productId);
      if (full) {
        const formatted = this.formatProduct(full);
        this.productsGateway.emitProductStockUpdated({
          productId: Number(variant.productId),
          variantId: Number(id),
          stock: 0,
          totalStock: Number(formatted?.stock ?? 0),
          product: formatted,
        });
      }
    }

    return { res: 'success', message: 'Variant deleted successfully' };
  }

  async changeVariantStatus(id: number) {
    const variant = await this.db.query.variants.findFirst({ where: eq(variants.id, id) });
    if (!variant) {
      throw new HttpException(
        { res: 'error', message: 'Variant not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    const newStatus = !variant.status;
    await this.db.update(variants).set({ status: newStatus }).where(eq(variants.id, id));

    if (variant.productId) {
      const full = await this.findProductWithRelations(variant.productId);
      if (full) {
        const formatted = this.formatProduct(full);
        this.productsGateway.emitProductStockUpdated({
          productId: Number(variant.productId),
          variantId: Number(id),
          stock: newStatus ? Number(variant.stock ?? 0) : 0,
          totalStock: Number(formatted?.stock ?? 0),
          product: formatted,
        });
      }
    }

    return { result: 'success', message: 'Status updated successfully', status: newStatus };
  }

  public formatVariant(v: any) {
    if (!v) return null;
    const vStock = Number(v.stock ?? 0);
    return {
      id: Number(v.id),
      title: v.title ?? null,
      sku: v.sku,
      stock: vStock,
      is_low_stock: vStock > 0 && vStock <= 5,
      is_out_of_stock: vStock === 0,
      mrp: v.mrp !== null && v.mrp !== undefined ? Number(v.mrp) : 0,
      sp: v.sp !== null && v.sp !== undefined ? Number(v.sp) : 0,
      bp: v.bp !== null && v.bp !== undefined ? Number(v.bp) : 0,
      status: Boolean(v.status),
      image_url: v.imageUrl ?? v.image_url ?? null,
      image_json: v.imageJson ?? v.image_json ?? null,
      product_id: Number(v.productId ?? v.product_id),
      created_at: v.createdAt ?? v.created_at,
      updated_at: v.updatedAt ?? v.updated_at,
    };
  }

  public formatProduct(p: any) {
    if (!p) return null;
    const formattedVariants = p.variants ? p.variants.map((v: any) => this.formatVariant(v)) : [];

    let defaultMrp = 0;
    let defaultSp = 0;
    let defaultBp = 0;
    let totalStock = 0;

    if (formattedVariants.length > 0) {
      const activeVars = formattedVariants.filter((v: any) => v.status);
      const targetVars = activeVars.length > 0 ? activeVars : formattedVariants;
      defaultMrp = Number(targetVars[0]?.mrp ?? 0);
      defaultSp = Number(targetVars[0]?.sp ?? 0);
      defaultBp = Number(targetVars[0]?.bp ?? 0);
      totalStock = formattedVariants.reduce((sum: number, v: any) => sum + Number(v.stock ?? 0), 0);
    }

    const slug = (p.slug || p.name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    return {
      id: Number(p.id),
      name: p.name,
      slug,
      description: p.description ?? null,
      item_code: p.itemCode ?? p.item_code ?? null,
      image_url: p.imageUrl ?? p.image_url ?? null,
      status: Boolean(p.status),
      is_new_arrival: Boolean(p.isNewArrival ?? p.is_new_arrival ?? false),
      category_id: Number(p.categoryId ?? p.category_id),
      brand_id: p.brandId ? Number(p.brandId) : (p.brand_id ? Number(p.brand_id) : (p.brand?.id ? Number(p.brand.id) : null)),
      brandId: p.brandId ? Number(p.brandId) : (p.brand_id ? Number(p.brand_id) : (p.brand?.id ? Number(p.brand.id) : null)),
      feature_json: p.featureJson ?? p.feature_json ?? null,
      image_json: p.imageJson ?? p.image_json ?? null,
      detail_json: p.detailJson ?? p.detail_json ?? null,
      mrp: defaultMrp,
      sp: defaultSp,
      bp: defaultBp,
      stock: totalStock,
      created_at: p.createdAt ?? p.created_at,
      updated_at: p.updatedAt ?? p.updated_at,
      ...(p.category ? {
        category: {
          id: Number(p.category.id),
          name: p.category.name,
          slug: (p.category.slug || p.category.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        },
        category_name: p.category.name
      } : {}),
      ...(p.brand ? { brand: { id: Number(p.brand.id), name: p.brand.name }, brand_name: p.brand.name } : {}),
      ...(p.variants ? { variants: formattedVariants } : {}),
    };
  }

  private async _syncProductAttributes(productId: number, categoryId: number, attrValIds: number[]) {
    if (!attrValIds.length) return;

    const uniqueAttrValIds = Array.from(new Set(attrValIds.filter((id) => !isNaN(id) && id > 0)));
    if (!uniqueAttrValIds.length) return;

    const valRecords = await this.db.query.attributeValues.findMany({
      where: inArray(attributeValues.id, uniqueAttrValIds),
    });

    const attrMap: Record<number, number[]> = {};
    for (const v of valRecords) {
      if (!attrMap[v.attributeId]) attrMap[v.attributeId] = [];
      if (!attrMap[v.attributeId].includes(v.id)) {
        attrMap[v.attributeId].push(v.id);
      }
    }

    for (const [attrIdStr, valIds] of Object.entries(attrMap)) {
      const attributeId = parseInt(attrIdStr);
      let catAttr: any = null;
      if (categoryId && !isNaN(categoryId)) {
        catAttr = await this.db.query.categoryAttributes.findFirst({
          where: and(eq(categoryAttributes.categoryId, categoryId), eq(categoryAttributes.attributeId, attributeId)),
        });
      }

      await this.db.insert(itemAttributes).values({
        productId,
        attributeId,
        hasImages: catAttr?.hasImages ?? false,
        isPrimary: catAttr?.isPrimary ?? false,
      });

      for (const valId of valIds) {
        await this.db.insert(productAttributeValues).values({
          productId,
          attributeId,
          attributeValueId: valId,
        });
      }
    }
  }

  public async hydrateProductsWithRelations(prodList: any[]): Promise<any[]> {
    if (!prodList || prodList.length === 0) return [];

    const prodIds = prodList.map((p) => Number(p.id)).filter((id) => !isNaN(id) && id > 0);
    if (prodIds.length === 0) return prodList;

    const allVars = await this.db
      .select()
      .from(variants)
      .where(inArray(variants.productId, prodIds));

    const varsMap = new Map<number, any[]>();
    for (const v of allVars) {
      const pid = Number(v.productId);
      if (!varsMap.has(pid)) varsMap.set(pid, []);
      varsMap.get(pid)!.push(v);
    }

    const catIds = Array.from(new Set(prodList.map((p) => Number(p.categoryId)).filter(Boolean)));
    const brandIds = Array.from(new Set(prodList.map((p) => Number(p.brandId)).filter(Boolean)));

    const catMap = new Map<number, any>();
    if (catIds.length > 0) {
      const catRows = await this.db.select().from(categories).where(inArray(categories.id, catIds));
      for (const c of catRows) catMap.set(Number(c.id), c);

      const parentIds = Array.from(new Set(catRows.map((c: any) => Number(c.parentId)).filter(Boolean)));
      if (parentIds.length > 0) {
        const parentRows = await this.db.select().from(categories).where(inArray(categories.id, parentIds));
        const parentMap = new Map<number, any>();
        for (const p of parentRows) parentMap.set(Number(p.id), p);
        for (const c of catMap.values()) {
          if (c.parentId && parentMap.has(Number(c.parentId))) {
            c.parent = parentMap.get(Number(c.parentId));
          }
        }
      }
    }

    const bMap = new Map<number, any>();
    if (brandIds.length > 0) {
      const bRows = await this.db.select().from(brands).where(inArray(brands.id, brandIds));
      for (const b of bRows) bMap.set(Number(b.id), b);
    }

    const allItemAttrs = await this.db
      .select()
      .from(itemAttributes)
      .where(inArray(itemAttributes.productId, prodIds));

    const itemAttrMap = new Map<number, any[]>();
    for (const ia of allItemAttrs) {
      const pid = Number(ia.productId);
      if (!itemAttrMap.has(pid)) itemAttrMap.set(pid, []);
      itemAttrMap.get(pid)!.push(ia);
    }

    return prodList.map((p) => {
      const cat = p.categoryId ? (catMap.get(Number(p.categoryId)) ?? null) : null;
      const hsn = cat?.hsn || cat?.parent?.hsn || null;
      const cgst = cat?.cgst !== null && cat?.cgst !== undefined ? cat.cgst : (cat?.parent?.cgst ?? null);
      const sgst = cat?.sgst !== null && cat?.sgst !== undefined ? cat.sgst : (cat?.parent?.sgst ?? null);
      const igst = cat?.igst !== null && cat?.igst !== undefined ? cat.igst : (cat?.parent?.igst ?? null);
      const igstNum = parseFloat(String(igst ?? '0')) || 0;
      const cgstNum = parseFloat(String(cgst ?? '0')) || 0;
      const sgstNum = parseFloat(String(sgst ?? '0')) || 0;
      const gstRate = igstNum > 0 ? igstNum : (cgstNum + sgstNum > 0 ? cgstNum + sgstNum : 18.0);

      const enrichedCategory = cat ? {
        ...cat,
        hsn,
        cgst,
        sgst,
        igst,
        gstRate,
        tax_rate: gstRate,
      } : null;

      return {
        ...p,
        hsn,
        cgst,
        sgst,
        igst,
        gstRate,
        tax_rate: gstRate,
        variants: varsMap.get(Number(p.id)) || [],
        category: enrichedCategory,
        brand: p.brandId ? (bMap.get(Number(p.brandId)) ?? null) : null,
        itemAttributes: itemAttrMap.get(Number(p.id)) || [],
      };
    });
  }

  public async findProductWithRelations(id: number): Promise<any> {
    const [product] = await this.db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) return null;
    const [hydrated] = await this.hydrateProductsWithRelations([product]);
    return hydrated ?? null;
  }

  public async findFullProductById(id: number, isAdmin: boolean = false): Promise<any> {
    const [pRow] = await this.db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!pRow) return null;

    let category: any = null;
    let hsn: string | null = null;
    let cgst: any = null;
    let sgst: any = null;
    let igst: any = null;
    let gstRate: number = 18.0;

    if (pRow.categoryId) {
      const [c] = await this.db.select().from(categories).where(eq(categories.id, pRow.categoryId)).limit(1);
      if (c) {
        let parent: any = null;
        if (c.parentId) {
          const [p] = await this.db.select().from(categories).where(eq(categories.id, c.parentId)).limit(1);
          parent = p ?? null;
        }
        hsn = c.hsn || parent?.hsn || null;
        cgst = c.cgst !== null && c.cgst !== undefined ? c.cgst : (parent?.cgst ?? null);
        sgst = c.sgst !== null && c.sgst !== undefined ? c.sgst : (parent?.sgst ?? null);
        igst = c.igst !== null && c.igst !== undefined ? c.igst : (parent?.igst ?? null);
        const igstNum = parseFloat(String(igst ?? '0')) || 0;
        const cgstNum = parseFloat(String(cgst ?? '0')) || 0;
        const sgstNum = parseFloat(String(sgst ?? '0')) || 0;
        gstRate = igstNum > 0 ? igstNum : (cgstNum + sgstNum > 0 ? cgstNum + sgstNum : 18.0);

        category = {
          ...c,
          parent,
          hsn,
          cgst,
          sgst,
          igst,
          gstRate,
          tax_rate: gstRate,
        };
      }
    }

    let brand: any = null;
    if (pRow.brandId) {
      const [b] = await this.db.select().from(brands).where(eq(brands.id, pRow.brandId)).limit(1);
      brand = b ?? null;
    }

    const varConditions = [eq(variants.productId, pRow.id)];
    if (!isAdmin) {
      varConditions.push(eq(variants.status, true));
    }
    const varRows = await this.db.select().from(variants).where(and(...varConditions));

    const varIds = varRows.map((v: any) => Number(v.id)).filter((vid: number) => !isNaN(vid) && vid > 0);
    const vavByVariant = new Map<number, any[]>();
    if (varIds.length > 0) {
      const vavRows = await this.db
        .select({
          variantId: variantAttributeValues.variantId,
          attributeValueId: variantAttributeValues.attributeValueId,
          attributeValue: {
            id: attributeValues.id,
            attributeId: attributeValues.attributeId,
            value: attributeValues.value,
            description: attributeValues.description,
            status: attributeValues.status,
          },
          attribute: {
            id: attributes.id,
            name: attributes.name,
            description: attributes.description,
            status: attributes.status,
          },
        })
        .from(variantAttributeValues)
        .leftJoin(attributeValues, eq(variantAttributeValues.attributeValueId, attributeValues.id))
        .leftJoin(attributes, eq(attributeValues.attributeId, attributes.id))
        .where(inArray(variantAttributeValues.variantId, varIds));

      for (const row of vavRows) {
        const vid = Number(row.variantId);
        if (!vavByVariant.has(vid)) vavByVariant.set(vid, []);
        vavByVariant.get(vid)!.push({
          ...row,
          attributeValue: {
            ...row.attributeValue,
            attribute: row.attribute,
          },
        });
      }
    }

    const itemAttrRows = await this.db
      .select({
        productId: itemAttributes.productId,
        attributeId: itemAttributes.attributeId,
        hasImages: itemAttributes.hasImages,
        isPrimary: itemAttributes.isPrimary,
        attribute: {
          id: attributes.id,
          name: attributes.name,
          description: attributes.description,
          status: attributes.status,
        },
      })
      .from(itemAttributes)
      .leftJoin(attributes, eq(itemAttributes.attributeId, attributes.id))
      .where(eq(itemAttributes.productId, pRow.id));

    const pavRows = await this.db
      .select({
        productId: productAttributeValues.productId,
        attributeId: productAttributeValues.attributeId,
        attributeValueId: productAttributeValues.attributeValueId,
        attribute: {
          id: attributes.id,
          name: attributes.name,
          description: attributes.description,
          status: attributes.status,
        },
        attributeValue: {
          id: attributeValues.id,
          attributeId: attributeValues.attributeId,
          value: attributeValues.value,
          status: attributeValues.status,
        },
      })
      .from(productAttributeValues)
      .leftJoin(attributes, eq(productAttributeValues.attributeId, attributes.id))
      .leftJoin(attributeValues, eq(productAttributeValues.attributeValueId, attributeValues.id))
      .where(eq(productAttributeValues.productId, pRow.id));

    return {
      ...pRow,
      hsn,
      cgst,
      sgst,
      igst,
      gstRate,
      tax_rate: gstRate,
      category,
      brand,
      variants: varRows.map((v: any) => ({
        ...v,
        variantAttributeValues: vavByVariant.get(Number(v.id)) || [],
      })),
      itemAttributes: itemAttrRows,
      productAttributeValues: pavRows,
    };
  }
}