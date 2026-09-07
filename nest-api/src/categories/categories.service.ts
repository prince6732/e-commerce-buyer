import { Injectable, Inject, NotFoundException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { eq, and, isNull, like, sql, or, desc, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import { categories, categoryAttributes, products, attributes, attributeValues, variants } from '../database/schema';
import { matchesSlugOrId } from '../common/utils/slug.util';

@Injectable()
export class CategoriesService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  // === PARENT CATEGORIES ===

  async index(query: any = {}): Promise<any> {
    const isPaginatedRequest = query.page !== undefined || query.limit !== undefined || query.per_page !== undefined || query.search !== undefined;
    const perPage = Math.max(1, parseInt(query.limit ?? query.per_page ?? '10'));
    const page = Math.max(1, parseInt(query.page ?? '1'));
    const search = (query.search || query.q || '').trim();
    const includeInactive = query?.include_inactive === 'true';
    const orderBy = (query?.order_by || query?.orderBy || '').toLowerCase();
    const orderDirection = (query?.order_direction || query?.orderDirection || 'desc').toLowerCase();

    const conditions: any[] = [isNull(categories.parentId)];
    if (!includeInactive) {
      conditions.push(eq(categories.status, true));
    }

    if (search) {
      conditions.push(
        or(
          like(categories.name, `%${search}%`),
          like(categories.description, `%${search}%`),
        ),
      );
    }

    // 1. Fetch product counts grouped by category_id
    const productCountRows = await this.db
      .select({
        categoryId: products.categoryId,
        count: sql<number>`count(${products.id})`,
      })
      .from(products)
      .where(includeInactive ? sql`1=1` : eq(products.status, true))
      .groupBy(products.categoryId);

    const productCountMap = new Map<number, number>();
    for (const row of productCountRows) {
      if (row.categoryId != null) {
        productCountMap.set(Number(row.categoryId), Number(row.count) || 0);
      }
    }

    // 2. Fetch all matching parent categories
    const allMatching = await this.db
      .select()
      .from(categories)
      .where(and(...conditions));

    // Fetch all subcategories for grouping
    const subcatConditions: any[] = [
      sql`${categories.parentId} IS NOT NULL`,
    ];
    if (!includeInactive) {
      subcatConditions.push(eq(categories.status, true));
    }
    const allSubcategories = await this.db
      .select()
      .from(categories)
      .where(and(...subcatConditions));

    const subcatMap = new Map<number, any[]>();
    for (const sub of allSubcategories) {
      const pId = Number(sub.parentId);
      if (!subcatMap.has(pId)) {
        subcatMap.set(pId, []);
      }
      subcatMap.get(pId)!.push(sub);
    }

    // 3. Format and compute total products count (direct + all subcategories)
    const formatted = allMatching.map((cat: any) => {
      const directCount = productCountMap.get(Number(cat.id)) || 0;
      const childrenRaw = subcatMap.get(Number(cat.id)) || [];
      const children = childrenRaw.map((sub: any) => {
        const subCount = productCountMap.get(Number(sub.id)) || 0;
        return {
          ...this.formatCategory(sub),
          products_count: subCount,
          productsCount: subCount,
        };
      });

      // Sort children subcategories by product count descending
      children.sort((a: any, b: any) => (b.products_count ?? 0) - (a.products_count ?? 0));

      const subcatTotal = children.reduce((sum: number, c: any) => sum + (c.products_count || 0), 0);
      const totalProductsCount = directCount + subcatTotal;

      return {
        ...this.formatCategory(cat),
        products_count: totalProductsCount,
        productsCount: totalProductsCount,
        children,
      };
    });

    // 4. Sort parent categories
    const isSortByProducts =
      orderBy === 'products_count' ||
      orderBy === 'products' ||
      orderBy === 'most_products' ||
      (!orderBy && !includeInactive);

    if (isSortByProducts) {
      formatted.sort((a: any, b: any) => {
        // Primary sort: Most products added
        const prodDiff = (b.products_count || 0) - (a.products_count || 0);
        if (prodDiff !== 0) return orderDirection === 'asc' ? -prodDiff : prodDiff;

        // Secondary sort: Most subcategories added
        const subcatDiff = (b.children?.length || 0) - (a.children?.length || 0);
        if (subcatDiff !== 0) return orderDirection === 'asc' ? -subcatDiff : subcatDiff;

        // Tertiary tie-breaker: id
        return Number(b.id) - Number(a.id);
      });
    } else if (orderBy === 'name') {
      formatted.sort((a: any, b: any) => {
        return orderDirection === 'desc'
          ? b.name.localeCompare(a.name)
          : a.name.localeCompare(b.name);
      });
    } else {
      // Default admin sort (created_at DESC)
      formatted.sort((a: any, b: any) => {
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        return orderDirection === 'asc' ? timeA - timeB : timeB - timeA;
      });
    }

    const total = formatted.length;
    const paginated = isPaginatedRequest
      ? formatted.slice((page - 1) * perPage, page * perPage)
      : formatted;

    const lastPage = Math.ceil(total / perPage) || 1;
    const hasNextPage = page < lastPage;

    if (!isPaginatedRequest && !query.paginate) {
      return paginated;
    }

    return {
      res: 'success',
      data: {
        categories: paginated,
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
        },
      },
      categories: paginated,
    };
  }

  async indexWithProducts(): Promise<any> {
    const productCountRows = await this.db
      .select({
        categoryId: products.categoryId,
        count: sql<number>`count(${products.id})`,
      })
      .from(products)
      .where(eq(products.status, true))
      .groupBy(products.categoryId);

    const productCountMap = new Map<number, number>();
    for (const row of productCountRows) {
      if (row.categoryId != null) {
        productCountMap.set(Number(row.categoryId), Number(row.count) || 0);
      }
    }

    const parentCategories = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.status, true), isNull(categories.parentId)));

    const subcategoryRows = await this.db
      .select({
        id: categories.id,
        name: categories.name,
        parentId: categories.parentId,
        image: categories.image,
        secondaryImage: categories.secondaryImage,
      })
      .from(categories)
      .where(and(eq(categories.status, true), sql`${categories.parentId} IS NOT NULL`));

    const subcatMap = new Map<number, any[]>();
    for (const sub of subcategoryRows) {
      const pId = Number(sub.parentId);
      if (!subcatMap.has(pId)) {
        subcatMap.set(pId, []);
      }
      subcatMap.get(pId)!.push(sub);
    }

    const formatted = parentCategories.map((cat: any) => {
      const directCount = productCountMap.get(Number(cat.id)) || 0;
      const subcats = subcatMap.get(Number(cat.id)) || [];
      const children = subcats.map((sub: any) => {
        const subCount = productCountMap.get(Number(sub.id)) || 0;
        return {
          ...sub,
          products_count: subCount,
          productsCount: subCount,
        };
      });

      // Sort children subcategories by product count descending
      children.sort((a: any, b: any) => (b.products_count ?? 0) - (a.products_count ?? 0));

      const subcatTotal = children.reduce((sum: number, c: any) => sum + (c.products_count || 0), 0);
      const totalProductsCount = directCount + subcatTotal;

      return {
        ...cat,
        products_count: totalProductsCount,
        productsCount: totalProductsCount,
        children,
      };
    });

    // Sort parent categories: 1st by most products added, 2nd by most subcategories added
    formatted.sort((a: any, b: any) => {
      const prodDiff = (b.products_count ?? 0) - (a.products_count ?? 0);
      if (prodDiff !== 0) return prodDiff;
      const subcatDiff = (b.children?.length ?? 0) - (a.children?.length ?? 0);
      if (subcatDiff !== 0) return subcatDiff;
      return Number(b.id) - Number(a.id);
    });

    return formatted;
  }

  async subcategoriesWithProducts(query: any = {}): Promise<any> {
    const parentIdStr = query?.parent_id;
    if (!parentIdStr) {
      throw new HttpException(
        {
          res: 'error',
          message: 'parent_id is required.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    let parentCategory: any = null;
    const numId = Number(parentIdStr);
    if (!isNaN(numId) && numId > 0 && String(parentIdStr).trim() === String(numId)) {
      parentCategory = await this.db.query.categories.findFirst({
        where: eq(categories.id, numId),
      });
    }

    if (!parentCategory) {
      const allCategories = await this.db.query.categories.findMany();
      parentCategory = allCategories.find((c: any) => matchesSlugOrId(c, parentIdStr) && (c.parentId == null || c.parentId === undefined))
        || allCategories.find((c: any) => matchesSlugOrId(c, parentIdStr));
    }

    if (!parentCategory) {
      return {
        res: 'success',
        parent_category: null,
        subcategories: [],
        total: 0,
      };
    }

    const parentId = parentCategory.id;
    const subcats = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.parentId, parentId), eq(categories.status, true)));

    let withProducts: any[] = [];
    if (subcats.length > 0) {
      const subcatIds = subcats.map((s: any) => Number(s.id));
      const activeCatRows = await this.db
        .selectDistinct({ categoryId: products.categoryId })
        .from(products)
        .innerJoin(variants, and(eq(variants.productId, products.id), eq(variants.status, true)))
        .where(and(inArray(products.categoryId, subcatIds), eq(products.status, true)));

      const activeCatSet = new Set(activeCatRows.map((r: any) => Number(r.categoryId)));
      withProducts = subcats.filter((sc: any) => activeCatSet.has(Number(sc.id)));
    }

    return {
      res: 'success',
      parent_category: parentCategory?.name ?? null,
      subcategories: withProducts.map(({ products: _, ...rest }: any) => rest),
      total: withProducts.length,
    };
  }

  async getSubcategoriesWithProductCounts(query: any = {}): Promise<any> {
    try {
      const limit = Math.max(1, Math.min(100, parseInt(query.limit ?? '20')));
      const minProducts = Math.max(0, parseInt(query.min_products ?? '0'));
      const orderBy = ['products_count', 'name', 'created_at'].includes(query.order_by) ? query.order_by : 'products_count';
      const orderDirection = ['asc', 'desc'].includes(query.order_direction) ? query.order_direction : 'desc';

      const includeInactive = query.include_inactive === 'true';

      const subcats = await this.db
        .select()
        .from(categories)
        .where(
          includeInactive
            ? sql`${categories.parentId} IS NOT NULL`
            : and(sql`${categories.parentId} IS NOT NULL`, eq(categories.status, true)),
        );

      const parentIds = [...new Set(subcats.map((s: any) => s.parentId).filter(Boolean))] as number[];
      const parentMap = new Map<number, any>();
      if (parentIds.length > 0) {
        const parentRows = await this.db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(inArray(categories.id, parentIds));
        for (const p of parentRows) {
          parentMap.set(Number(p.id), p);
        }
      }

      const subcatIds = subcats.map((s: any) => Number(s.id));
      const activeProds = subcatIds.length > 0
        ? await this.db
            .select({
              id: products.id,
              categoryId: products.categoryId,
              name: products.name,
              imageUrl: products.imageUrl,
              status: products.status,
            })
            .from(products)
            .where(and(inArray(products.categoryId, subcatIds), eq(products.status, true)))
        : [];

      const prodIds = activeProds.map((p) => Number(p.id));
      const activeVariants = prodIds.length > 0
        ? await this.db
            .select({
              id: variants.id,
              productId: variants.productId,
              sp: variants.sp,
              stock: variants.stock,
              imageUrl: variants.imageUrl,
              status: variants.status,
            })
            .from(variants)
            .where(and(inArray(variants.productId, prodIds), eq(variants.status, true)))
        : [];

      const variantsByProd = new Map<number, any[]>();
      for (const v of activeVariants) {
        const pId = Number(v.productId);
        if (!variantsByProd.has(pId)) variantsByProd.set(pId, []);
        variantsByProd.get(pId)!.push(v);
      }

      const prodsByCat = new Map<number, any[]>();
      for (const p of activeProds) {
        const cId = Number(p.categoryId);
        if (!prodsByCat.has(cId)) prodsByCat.set(cId, []);
        prodsByCat.get(cId)!.push({
          ...p,
          variants: variantsByProd.get(Number(p.id)) || [],
        });
      }

      const processed = subcats.map((cat: any) => {
        const activeCatProds = prodsByCat.get(Number(cat.id)) || [];
        const productsCount = activeCatProds.length;
        const parentInfo = cat.parentId ? parentMap.get(Number(cat.parentId)) : null;

        const allVariants = activeCatProds.flatMap((p: any) => p.variants ?? []);
        const variantsCount = allVariants.length;
        const totalStock = allVariants.reduce((sum: number, v: any) => sum + (v.stock ?? 0), 0);

        const prices = allVariants
          .map((v: any) => parseFloat(v.sp as string))
          .filter((price: number) => !isNaN(price) && price > 0);

        const minPrice = prices.length ? Math.min(...prices) : 0;
        const maxPrice = prices.length ? Math.max(...prices) : 0;
        const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

        const sampleProducts = activeCatProds.slice(0, 3).map((p: any) => {
          const vList = p.variants ?? [];
          const vPrices = vList.map((v: any) => parseFloat(v.sp as string)).filter((pr: number) => !isNaN(pr));
          const pMinPrice = vPrices.length ? Math.min(...vPrices) : 0;
          const firstWithImg = vList.find((v: any) => v.imageUrl);
          const imgUrl = p.imageUrl || (firstWithImg ? firstWithImg.imageUrl : null);

          return {
            id: p.id,
            name: p.name,
            image_url: imgUrl,
            min_price: pMinPrice,
          };
        });

        return {
          id: cat.id,
          name: cat.name,
          description: cat.description,
          image: cat.image,
          secondary_image: cat.secondaryImage,
          parent_category: parentInfo ? { id: parentInfo.id, name: parentInfo.name } : null,
          products_count: productsCount,
          variants_count: variantsCount,
          total_stock: totalStock,
          price_stats: {
            min_price: minPrice,
            max_price: maxPrice,
            avg_price: Math.round(avgPrice * 100) / 100,
            currency: 'INR',
          },
          sample_products: sampleProducts,
          created_at: cat.createdAt,
          updated_at: cat.updatedAt,
        };
      });

      const filtered = processed.filter((item) => item.products_count >= minProducts);

      filtered.sort((a: any, b: any) => {
        let valA = a[orderBy];
        let valB = b[orderBy];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (orderDirection === 'asc') {
          return valA > valB ? 1 : valA < valB ? -1 : 0;
        } else {
          return valA < valB ? 1 : valA > valB ? -1 : 0;
        }
      });

      const sliced = filtered.slice(0, limit);

      return {
        res: 'success',
        message: 'Subcategories with product counts fetched successfully.',
        data: {
          categories: sliced,
          count: sliced.length,
          filters: {
            min_products: minProducts,
            order_by: orderBy,
            order_direction: orderDirection,
            limit,
          },
        },
      };
    } catch (e: any) {
      throw new HttpException(
        {
          res: 'error',
          message: 'Failed to fetch subcategories with product counts.',
          errors: [e.message],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async show(idOrSlug: string | number, query: any = {}): Promise<any> {
    const includeInactive = query?.include_inactive === 'true';

    let category: any = null;
    const numId = Number(idOrSlug);
    if (!isNaN(numId) && numId > 0 && String(idOrSlug).trim() === String(numId)) {
      const [found] = await this.db.select().from(categories).where(eq(categories.id, numId)).limit(1);
      category = found || null;
    }

    if (!category) {
      const slugLower = String(idOrSlug).toLowerCase().trim();
      const allCats: any[] = await this.db.select().from(categories);

      if (query?.parent_id) {
        const rawParent = String(query.parent_id).trim();
        const numParent = Number(rawParent);
        let parentCat = (!isNaN(numParent) && numParent > 0 && String(numParent) === rawParent)
          ? allCats.find((c: any) => Number(c.id) === numParent)
          : allCats.find((c: any) => {
              const s = (c.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
              return (s === rawParent.toLowerCase() || (c.name || '').toLowerCase().trim() === rawParent.toLowerCase()) && !c.parentId;
            });
        if (parentCat) {
          category = allCats.find((cat: any) => {
            const itemSlug = (cat.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            return (itemSlug === slugLower || (cat.name || '').toLowerCase().trim() === slugLower) && Number(cat.parentId) === Number(parentCat.id);
          });
        }
      }

      if (!category) {
        category = allCats.find((cat: any) => {
          const itemSlug = (cat.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          return itemSlug === slugLower || (cat.name || '').toLowerCase().trim() === slugLower;
        });
      }
    }

    if (!category) {
      throw new HttpException(
        { success: false, message: 'Category not found or inactive.' },
        HttpStatus.NOT_FOUND, // 404
      );
    }

    if (!includeInactive) {
      if (!category.status) {
        throw new HttpException(
          { success: false, message: 'Category not found or inactive.' },
          HttpStatus.NOT_FOUND, // 404
        );
      }
      if (category.parentId) {
        const [parent] = await this.db.select().from(categories).where(
          and(eq(categories.id, category.parentId), isNull(categories.parentId), eq(categories.status, true))
        ).limit(1);
        if (!parent) {
          throw new HttpException(
            { success: false, message: 'Category not found or inactive.' },
            HttpStatus.NOT_FOUND, // 404
          );
        }
      }
    }

    // Load subcategories directly
    const subcats = await this.db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.parentId, category.id),
          includeInactive ? sql`1=1` : eq(categories.status, true),
        ),
      );

    // Load category attributes directly
    const catAttrs = await this.db
      .select({
        categoryId: categoryAttributes.categoryId,
        attributeId: categoryAttributes.attributeId,
        hasImages: categoryAttributes.hasImages,
        isPrimary: categoryAttributes.isPrimary,
        attribute: {
          id: attributes.id,
          name: attributes.name,
          description: attributes.description,
          status: attributes.status,
        },
      })
      .from(categoryAttributes)
      .leftJoin(attributes, eq(categoryAttributes.attributeId, attributes.id))
      .where(eq(categoryAttributes.categoryId, category.id));

    const slug = (category.name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const formattedCategory = {
      ...category,
      slug,
      children: subcats.map((sub: any) => ({
        ...sub,
        slug: (sub.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      })),
      attributes: catAttrs.map((ca: any) => ca.attribute).filter(Boolean),
    };

    return {
      success: true,
      message: 'Category details fetched successfully.',
      result: formattedCategory,
    };
  }

  async getCategoryByIdForProduct(idOrSlug: string | number, query: any = {}): Promise<any> {
    const includeInactive = query?.include_inactive === 'true';

    let category: any = null;
    const numId = Number(idOrSlug);
    if (!isNaN(numId) && numId > 0 && String(idOrSlug).trim() === String(numId)) {
      const [row] = await this.db.select().from(categories).where(eq(categories.id, numId)).limit(1);
      category = row;
    }

    if (!category) {
      const slugLower = String(idOrSlug).toLowerCase().trim();
      const allCats: any[] = await this.db.select().from(categories);

      if (query?.parent_id) {
        const rawParent = String(query.parent_id).trim();
        const numParent = Number(rawParent);
        let parentCat = (!isNaN(numParent) && numParent > 0 && String(numParent) === rawParent)
          ? allCats.find((c: any) => Number(c.id) === numParent)
          : allCats.find((c: any) => {
              const s = (c.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
              return (s === rawParent.toLowerCase() || (c.name || '').toLowerCase().trim() === rawParent.toLowerCase()) && !c.parentId;
            });
        if (parentCat) {
          category = allCats.find((cat: any) => {
            const itemSlug = (cat.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            return (itemSlug === slugLower || (cat.name || '').toLowerCase().trim() === slugLower) && Number(cat.parentId) === Number(parentCat.id);
          });
        }
      }

      if (!category) {
        category = allCats.find((cat: any) => {
          const itemSlug = (cat.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          return itemSlug === slugLower || (cat.name || '').toLowerCase().trim() === slugLower;
        });
      }
    }

    if (!category) {
      throw new HttpException(
        { success: false, message: 'Category not found or inactive.' },
        HttpStatus.NOT_FOUND, // 404
      );
    }

    if (!includeInactive) {
      if (!category.status) {
        throw new HttpException(
          { success: false, message: 'Category not found or inactive.' },
          HttpStatus.NOT_FOUND, // 404
        );
      }
      if (category.parentId) {
        const [parent] = await this.db.select().from(categories).where(
          and(eq(categories.id, category.parentId), isNull(categories.parentId), eq(categories.status, true)),
        ).limit(1);
        if (!parent) {
          throw new HttpException(
            { success: false, message: 'Category not found or inactive.' },
            HttpStatus.NOT_FOUND, // 404
          );
        }
      }
    }

    // Direct fetch of subcategories
    const subcats = await this.db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.parentId, category.id),
          includeInactive ? sql`1=1` : eq(categories.status, true),
        ),
      );

    // Direct fetch of categoryAttributes
    const catAttrs = await this.db
      .select({
        categoryId: categoryAttributes.categoryId,
        attributeId: categoryAttributes.attributeId,
        hasImages: categoryAttributes.hasImages,
        isPrimary: categoryAttributes.isPrimary,
        attribute: {
          id: attributes.id,
          name: attributes.name,
          description: attributes.description,
          status: attributes.status,
        },
      })
      .from(categoryAttributes)
      .innerJoin(attributes, eq(categoryAttributes.attributeId, attributes.id))
      .where(eq(categoryAttributes.categoryId, category.id));

    // Direct fetch of attributeValues
    const attrIds = catAttrs.map((ca: any) => ca.attributeId).filter(Boolean);
    let attrValRows: any[] = [];
    if (attrIds.length > 0) {
      attrValRows = await this.db
        .select()
        .from(attributeValues)
        .where(
          and(
            inArray(attributeValues.attributeId, attrIds),
            eq(attributeValues.status, true),
          ),
        );
    }

    const attrValMap = new Map<number, any[]>();
    for (const v of attrValRows) {
      const aid = Number(v.attributeId);
      if (!attrValMap.has(aid)) attrValMap.set(aid, []);
      attrValMap.get(aid)!.push(v);
    }

    const attributesList = (catAttrs ?? [])
      .sort((a: any, b: any) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
      .map((ca: any) => ({
        ...ca.attribute,
        is_primary: ca.isPrimary,
        has_images: ca.hasImages,
        values: (attrValMap.get(Number(ca.attributeId)) || []).map((v: any) => ({
          id: v.id,
          value: v.value,
          color_code: v.colorCode,
          status: v.status,
        })),
      }));

    const slug = (category.name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const formattedCategory = {
      ...category,
      slug,
      children: subcats.map((sub: any) => ({
        ...sub,
        slug: (sub.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      })),
      attributes: attributesList,
    };

    return {
      success: true,
      message: 'Category details fetched successfully.',
      result: formattedCategory,
    };
  }

  async store(body: any) {
    if (!body?.name) {
      throw new HttpException(
        { res: 'error', message: 'The name field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const parentId = body.parent_id ? Number(body.parent_id) : null;
    if (parentId) {
      const parent = await this.db.query.categories.findFirst({
        where: eq(categories.id, parentId),
      });
      if (!parent) {
        throw new HttpException(
          { res: 'error', message: 'The selected parent id is invalid.' },
          HttpStatus.UNPROCESSABLE_ENTITY, // 422
        );
      }
    }

    const nameLower = body.name.toLowerCase();
    const existing = await this.db.query.categories.findFirst({
      where: and(
        sql`LOWER(${categories.name}) = ${nameLower}`,
        parentId ? eq(categories.parentId, parentId) : isNull(categories.parentId),
      ),
    });

    if (existing) {
      throw new HttpException(
        { res: 'error', message: 'This category already exists.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const taxData = this.sanitizeTaxAndHsn(body);

    const [result] = await this.db.insert(categories).values({
      name: body.name,
      description: body.description ?? null,
      image: body.image ?? null,
      secondaryImage: body.secondary_image ?? body.secondaryImage ?? null,
      link: body.link ?? null,
      parentId: parentId,
      status: body.status !== undefined ? Boolean(body.status) : true,
      hsn: taxData.hsn,
      cgst: taxData.cgst,
      sgst: taxData.sgst,
      igst: taxData.igst,
    }).$returningId();

    const cat = await this.db.query.categories.findFirst({
      where: eq(categories.id, result.id),
    });

    return {
      res: 'success',
      category: this.formatCategory(cat),
    };
  }

  async update(id: number, body: any) {
    const existingCat = await this.db.query.categories.findFirst({
      where: eq(categories.id, id),
    });
    if (!existingCat) {
      throw new HttpException(
        { res: 'error', message: 'Category not found.' },
        HttpStatus.NOT_FOUND, // 404
      );
    }

    if (!body?.name) {
      throw new HttpException(
        { res: 'error', message: 'The name field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const parentId = body.parent_id ? Number(body.parent_id) : null;
    if (parentId) {
      const parent = await this.db.query.categories.findFirst({
        where: eq(categories.id, parentId),
      });
      if (!parent) {
        throw new HttpException(
          { res: 'error', message: 'The selected parent id is invalid.' },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    const nameLower = body.name.toLowerCase();
    const duplicate = await this.db.query.categories.findFirst({
      where: and(
        sql`LOWER(${categories.name}) = ${nameLower}`,
        sql`${categories.id} != ${id}`,
        parentId ? eq(categories.parentId, parentId) : isNull(categories.parentId),
      ),
    });

    if (duplicate) {
      throw new HttpException(
        { res: 'error', message: 'This category already exists.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const taxData = this.sanitizeTaxAndHsn(body);

    await this.db.update(categories).set({
      name: body.name,
      description: body.description ?? null,
      image: body.image ?? null,
      secondaryImage: body.secondary_image ?? body.secondaryImage ?? null,
      link: body.link ?? null,
      parentId: parentId,
      status: body.status !== undefined ? Boolean(body.status) : existingCat.status,
      hsn: body.hsn !== undefined ? taxData.hsn : existingCat.hsn,
      cgst: body.cgst !== undefined ? taxData.cgst : existingCat.cgst,
      sgst: body.sgst !== undefined ? taxData.sgst : existingCat.sgst,
      igst: body.igst !== undefined ? taxData.igst : existingCat.igst,
    }).where(eq(categories.id, id));

    const updatedCat = await this.db.query.categories.findFirst({
      where: eq(categories.id, id),
    });

    return {
      res: 'success',
      category: this.formatCategory(updatedCat),
    };
  }

  async destroy(id: number) {
    const category = await this.db.query.categories.findFirst({
      where: eq(categories.id, id),
    });
    if (!category) {
      throw new HttpException(
        { res: 'error', message: 'Category not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    const hasSubcategories = await this.db.query.categories.findFirst({
      where: eq(categories.parentId, id),
    });
    if (hasSubcategories) {
      throw new HttpException(
        {
          res: 'error',
          message: 'This category cannot be deleted because it is associated with existing subcategories.',
        },
        HttpStatus.BAD_REQUEST, // 400
      );
    }

    const hasProducts = await this.db.query.products.findFirst({
      where: eq(products.categoryId, id),
    });
    if (hasProducts) {
      throw new HttpException(
        {
          res: 'error',
          message: 'This category cannot be deleted because it is associated with existing products.',
        },
        HttpStatus.BAD_REQUEST, // 400
      );
    }

    await this.db.delete(categoryAttributes).where(eq(categoryAttributes.categoryId, id));
    await this.db.delete(categories).where(eq(categories.id, id));

    return {
      res: 'success',
      message: 'Category deleted successfully',
    };
  }

  async changeStatus(id: number) {
    const category = await this.db.query.categories.findFirst({
      where: eq(categories.id, id),
    });
    if (!category) {
      throw new HttpException(
        { res: 'error', message: 'Category not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    const newStatus = !category.status;
    await this.db.update(categories).set({ status: newStatus }).where(eq(categories.id, id));

    return {
      result: 'success',
      message: 'Status updated successfully',
      status: newStatus,
    };
  }

  async subcategoryIndex(query: {
    parent_id?: string;
    search?: string;
    include_inactive?: string;
    limit?: string;
    per_page?: string;
    page?: string;
    paginate?: string;
  }): Promise<any> {
    const isPaginatedRequest = query.page !== undefined || query.limit !== undefined || query.per_page !== undefined || query.search !== undefined;
    const perPage = Math.max(1, parseInt(query.limit ?? query.per_page ?? '10'));
    const page = Math.max(1, parseInt(query.page ?? '1'));
    const search = (query.search || '').trim();
    const includeInactive = query.include_inactive === 'true';

    let parentId: number | undefined = undefined;
    let parentCategory: any = null;

    if (query.parent_id) {
      const rawParent = String(query.parent_id).trim();
      const numParent = Number(rawParent);
      if (!isNaN(numParent) && numParent > 0 && String(numParent) === rawParent) {
        parentId = numParent;
        parentCategory = await this.db.query.categories.findFirst({ where: eq(categories.id, numParent) });
      } else {
        const slugLower = rawParent.toLowerCase();
        const allCats = await this.db.query.categories.findMany();
        parentCategory = allCats.find((c: any) => {
          const s = (c.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          return s === slugLower || (c.name || '').toLowerCase().trim() === slugLower;
        });
        if (parentCategory) {
          parentId = Number(parentCategory.id);
        }
      }
    }

    // Build conditions
    const conditions: any[] = [];
    if (!includeInactive) {
      conditions.push(eq(categories.status, true));
    }
    if (parentId) {
      conditions.push(eq(categories.parentId, parentId));
      if (!includeInactive) {
        const parent = await this.db.query.categories.findFirst({
          where: and(eq(categories.id, parentId), isNull(categories.parentId), eq(categories.status, true)),
        });
        if (!parent) {
          return { res: 'success', parent_category: null, subcategories: [], total: 0 };
        }
      }
    } else {
      conditions.push(sql`${categories.parentId} IS NOT NULL`);
    }

    if (search) {
      conditions.push(
        or(
          like(categories.name, `%${search}%`),
          like(categories.description, `%${search}%`),
        ),
      );
    }

    const allMatching: any[] = await this.db
      .select()
      .from(categories)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(categories.createdAt));

    const total = allMatching.length;
    const paginated = isPaginatedRequest
      ? allMatching.slice((page - 1) * perPage, page * perPage)
      : allMatching;

    const paginatedIds = paginated.map((c: any) => Number(c.id));
    let catAttrs: any[] = [];
    if (paginatedIds.length > 0) {
      catAttrs = await this.db
        .select({
          categoryId: categoryAttributes.categoryId,
          attributeId: categoryAttributes.attributeId,
          hasImages: categoryAttributes.hasImages,
          isPrimary: categoryAttributes.isPrimary,
          attribute: {
            id: attributes.id,
            name: attributes.name,
            description: attributes.description,
            status: attributes.status,
          },
        })
        .from(categoryAttributes)
        .leftJoin(attributes, eq(categoryAttributes.attributeId, attributes.id))
        .where(inArray(categoryAttributes.categoryId, paginatedIds));
    }

    const catAttrMap = new Map<number, any[]>();
    for (const ca of catAttrs) {
      const cid = Number(ca.categoryId);
      if (!catAttrMap.has(cid)) catAttrMap.set(cid, []);
      catAttrMap.get(cid)!.push(ca);
    }

    const formattedSubcats = paginated.map((c: any) => {
      const cAttrs = catAttrMap.get(Number(c.id)) || [];
      return {
        ...c,
        slug: (c.slug || c.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        secondary_image: c.secondaryImage ?? c.secondary_image ?? null,
        secondaryImage: c.secondaryImage ?? c.secondary_image ?? null,
        attributes: cAttrs.map((ca: any) => ({
          id: ca.attribute?.id,
          name: ca.attribute?.name,
          pivot: {
            category_id: ca.categoryId,
            attribute_id: ca.attributeId,
            has_images: ca.hasImages,
            is_primary: ca.isPrimary,
          },
        })),
      };
    });

    const lastPage = Math.ceil(total / perPage) || 1;
    const hasNextPage = page < lastPage;

    return {
      res: 'success',
      parent_category: parentCategory?.name ?? null,
      parent_category_details: parentCategory ? this.formatCategory(parentCategory) : null,
      subcategories: formattedSubcats,
      total,
      data: {
        subcategories: formattedSubcats,
        parent_category: parentCategory?.name ?? null,
        parent_category_details: parentCategory ? this.formatCategory(parentCategory) : null,
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
        },
      },
    };
  }

  async subcategoryShow(idOrSlug: string | number, query: any = {}): Promise<any> {
    const includeInactive = query?.include_inactive === 'true';

    let subcat: any = null;
    const numId = Number(idOrSlug);
    if (!isNaN(numId) && numId > 0 && String(idOrSlug).trim() === String(numId)) {
      const [row] = await this.db.select().from(categories).where(eq(categories.id, numId)).limit(1);
      subcat = row;
    }

    if (!subcat) {
      const slugLower = String(idOrSlug).toLowerCase().trim();
      const allSubcats: any[] = await this.db.select().from(categories);
      subcat = allSubcats.find((c: any) => {
        if (!c.parentId) return false;
        const itemSlug = (c.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        return itemSlug === slugLower || (c.name || '').toLowerCase().trim() === slugLower;
      });
    }

    if (!subcat || !subcat.parentId) {
      throw new HttpException(
        { res: 'error', message: 'This is not a subcategory.' },
        HttpStatus.BAD_REQUEST, // 400
      );
    }

    if (!includeInactive) {
      if (!subcat.status) {
        throw new HttpException(
          { res: 'error', message: 'Subcategory not found or inactive.' },
          HttpStatus.NOT_FOUND, // 404
        );
      }
      const [parentActive] = await this.db.select().from(categories).where(
        and(eq(categories.id, subcat.parentId), isNull(categories.parentId), eq(categories.status, true)),
      ).limit(1);
      if (!parentActive) {
        throw new HttpException(
          { res: 'error', message: 'Subcategory not found or inactive.' },
          HttpStatus.NOT_FOUND, // 404
        );
      }
    }

    const [parent] = await this.db.select().from(categories).where(eq(categories.id, subcat.parentId)).limit(1);

    const catAttrs = await this.db
      .select({
        categoryId: categoryAttributes.categoryId,
        attributeId: categoryAttributes.attributeId,
        hasImages: categoryAttributes.hasImages,
        isPrimary: categoryAttributes.isPrimary,
        attribute: {
          id: attributes.id,
          name: attributes.name,
          description: attributes.description,
          status: attributes.status,
        },
      })
      .from(categoryAttributes)
      .leftJoin(attributes, eq(categoryAttributes.attributeId, attributes.id))
      .where(eq(categoryAttributes.categoryId, subcat.id));

    const slug = (subcat.name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const formattedSubcat = {
      ...subcat,
      parent: parent ?? null,
      slug,
      secondary_image: subcat.secondaryImage ?? subcat.secondary_image ?? null,
      secondaryImage: subcat.secondaryImage ?? subcat.secondary_image ?? null,
      attributes: catAttrs.map((ca: any) => ({
        id: ca.attribute?.id,
        name: ca.attribute?.name,
        pivot: {
          category_id: ca.categoryId,
          attribute_id: ca.attributeId,
          has_images: ca.hasImages,
          is_primary: ca.isPrimary,
        },
      })),
    };

    return {
      res: 'success',
      subcategory: formattedSubcat,
    };
  }

  async storeSubcategory(body: any) {
    let attrs = body.attributes;
    if (typeof attrs === 'string') {
      try {
        attrs = JSON.parse(attrs);
      } catch (e) {
        attrs = [];
      }
    }

    if (Array.isArray(attrs)) {
      attrs = attrs.map((attr: any) => ({
        AttributeId: attr.AttributeId ?? attr.attribute_id ?? attr.id ?? null,
        HasImages: Boolean(attr.HasImages ?? attr.has_images ?? false),
        IsPrimary: Boolean(attr.IsPrimary ?? attr.is_primary ?? attr.isPrimary ?? false),
      }));
    } else {
      attrs = [];
    }

    if (!body?.name) {
      throw new HttpException(
        { res: 'error', message: 'The name field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    let parentId: number | null = null;
    if (body?.parent_id) {
      const num = Number(body.parent_id);
      if (!isNaN(num) && num > 0 && String(num) === String(body.parent_id).trim()) {
        parentId = num;
      } else {
        const slugLower = String(body.parent_id).toLowerCase().trim();
        const allCats = await this.db.query.categories.findMany();
        const found = allCats.find((c: any) => {
          const s = (c.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          return s === slugLower || (c.name || '').toLowerCase().trim() === slugLower;
        });
        if (found) parentId = Number(found.id);
      }
    }

    if (!parentId) {
      throw new HttpException(
        { res: 'error', message: 'The selected parent id is invalid.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const parent = await this.db.query.categories.findFirst({
      where: eq(categories.id, parentId),
    });
    if (!parent) {
      throw new HttpException(
        { res: 'error', message: 'The selected parent id is invalid.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const nameLower = body.name.toLowerCase();
    const existing = await this.db.query.categories.findFirst({
      where: and(
        sql`LOWER(${categories.name}) = ${nameLower}`,
        eq(categories.parentId, parentId),
      ),
    });
    if (existing) {
      throw new HttpException(
        { res: 'error', message: 'This subcategory already exists.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (attrs.length > 0) {
      const primaryCount = attrs.filter((a: any) => a.IsPrimary).length;
      if (primaryCount > 1) {
        throw new HttpException(
          { res: 'error', message: 'Only one attribute can be marked as primary.' },
          HttpStatus.UNPROCESSABLE_ENTITY, // 422
        );
      }

      const hasImagesCount = attrs.filter((a: any) => a.HasImages).length;
      if (hasImagesCount > 1) {
        throw new HttpException(
          { res: 'error', message: 'Only one attribute can have Has Images enabled.' },
          HttpStatus.UNPROCESSABLE_ENTITY, // 422
        );
      }
    }

    let taxData = this.sanitizeTaxAndHsn(body);
    if (parentId && (!taxData.hsn || taxData.cgst === null || taxData.sgst === null || taxData.igst === null)) {
      const parentCat = await this.db.query.categories.findFirst({
        where: eq(categories.id, parentId),
      });
      if (parentCat) {
        taxData = {
          hsn: taxData.hsn ?? parentCat.hsn ?? null,
          cgst: taxData.cgst ?? parentCat.cgst ?? null,
          sgst: taxData.sgst ?? parentCat.sgst ?? null,
          igst: taxData.igst ?? parentCat.igst ?? null,
        };
      }
    }

    const [result] = await this.db.insert(categories).values({
      name: body.name,
      description: body.description ?? null,
      image: body.image ?? null,
      secondaryImage: body.secondary_image ?? body.secondaryImage ?? null,
      link: body.link ?? null,
      parentId: parentId,
      status: body.status !== undefined ? Boolean(body.status) : true,
      hsn: taxData.hsn,
      cgst: taxData.cgst,
      sgst: taxData.sgst,
      igst: taxData.igst,
    }).$returningId();

    if (attrs.length > 0) {
      await this._syncCategoryAttributes(result.id, attrs);
    }

    const subcat = await this.findCategoryWithAttributes(result.id);

    return {
      res: 'success',
      subcategory: this.formatCategory(subcat),
    };
  }

  async updateSubcategory(id: number, body: any) {
    const existingSubcat = await this.db.query.categories.findFirst({
      where: eq(categories.id, id),
    });
    if (!existingSubcat) {
      throw new HttpException(
        { res: 'error', message: 'Subcategory not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    let attrs = body.attributes;
    if (typeof attrs === 'string') {
      try {
        attrs = JSON.parse(attrs);
      } catch (e) {
        attrs = [];
      }
    }

    if (Array.isArray(attrs)) {
      attrs = attrs.map((attr: any) => ({
        AttributeId: attr.AttributeId ?? attr.attribute_id ?? attr.id ?? null,
        HasImages: Boolean(attr.HasImages ?? attr.has_images ?? false),
        IsPrimary: Boolean(attr.IsPrimary ?? attr.is_primary ?? attr.isPrimary ?? false),
      }));
    } else {
      attrs = [];
    }

    if (!body?.name) {
      throw new HttpException(
        { res: 'error', message: 'The name field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    let parentId: number | null = existingSubcat.parentId ? Number(existingSubcat.parentId) : null;
    if (body?.parent_id !== undefined && body?.parent_id !== null && String(body.parent_id).trim() !== '') {
      const rawParent = String(body.parent_id).trim();
      const numParent = Number(rawParent);
      if (!isNaN(numParent) && numParent > 0 && String(numParent) === rawParent) {
        parentId = numParent;
      } else {
        const slugLower = rawParent.toLowerCase();
        const allCats = await this.db.query.categories.findMany();
        const found = allCats.find((c: any) => {
          const s = (c.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          return s === slugLower || (c.name || '').toLowerCase().trim() === slugLower;
        });
        if (found) {
          parentId = Number(found.id);
        } else if (existingSubcat.parentId) {
          parentId = Number(existingSubcat.parentId);
        }
      }
    }

    if (!parentId) {
      throw new HttpException(
        { res: 'error', message: 'The selected parent id is invalid.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const parent = await this.db.query.categories.findFirst({
      where: eq(categories.id, parentId),
    });
    if (!parent) {
      throw new HttpException(
        { res: 'error', message: 'The selected parent id is invalid.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const nameLower = body.name.toLowerCase();
    const duplicate = await this.db.query.categories.findFirst({
      where: and(
        sql`LOWER(${categories.name}) = ${nameLower}`,
        sql`${categories.id} != ${id}`,
        eq(categories.parentId, parentId),
      ),
    });
    if (duplicate) {
      throw new HttpException(
        { res: 'error', message: 'This subcategory already exists.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (attrs.length > 0) {
      const primaryCount = attrs.filter((a: any) => a.IsPrimary).length;
      if (primaryCount > 1) {
        throw new HttpException(
          { res: 'error', message: 'Only one attribute can be marked as primary.' },
          HttpStatus.UNPROCESSABLE_ENTITY, // 422
        );
      }

      const hasImagesCount = attrs.filter((a: any) => a.HasImages).length;
      if (hasImagesCount > 1) {
        throw new HttpException(
          { res: 'error', message: 'Only one attribute can have Has Images enabled.' },
          HttpStatus.UNPROCESSABLE_ENTITY, // 422
        );
      }
    }

    const taxData = this.sanitizeTaxAndHsn(body);

    await this.db.update(categories).set({
      name: body.name,
      description: body.description ?? null,
      image: body.image ?? null,
      secondaryImage: body.secondary_image ?? body.secondaryImage ?? null,
      link: body.link ?? null,
      parentId: parentId,
      status: body.status !== undefined ? Boolean(body.status) : existingSubcat.status,
      hsn: body.hsn !== undefined ? taxData.hsn : existingSubcat.hsn,
      cgst: body.cgst !== undefined ? taxData.cgst : existingSubcat.cgst,
      sgst: body.sgst !== undefined ? taxData.sgst : existingSubcat.sgst,
      igst: body.igst !== undefined ? taxData.igst : existingSubcat.igst,
    }).where(eq(categories.id, id));

    // Full sync (replace pivot)
    await this.db.delete(categoryAttributes).where(eq(categoryAttributes.categoryId, id));
    if (attrs.length > 0) {
      await this._syncCategoryAttributes(id, attrs);
    }

    const subcat = await this.findCategoryWithAttributes(id);

    return {
      res: 'success',
      subcategory: this.formatCategory(subcat),
    };
  }

  async destroySubcategory(id: number) {
    const subcategory = await this.db.query.categories.findFirst({
      where: eq(categories.id, id),
    });
    if (!subcategory) {
      throw new HttpException(
        { res: 'error', message: 'Subcategory not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    const hasProducts = await this.db.query.products.findFirst({
      where: eq(products.categoryId, id),
    });
    if (hasProducts) {
      throw new HttpException(
        {
          res: 'error',
          message: 'This subcategory cannot be deleted because it is associated with existing products.',
        },
        HttpStatus.BAD_REQUEST, // 400
      );
    }

    await this.db.delete(categoryAttributes).where(eq(categoryAttributes.categoryId, id));
    await this.db.delete(categories).where(eq(categories.id, id));

    return {
      res: 'success',
      message: 'Subcategory deleted successfully.',
    };
  }

  private async findCategoryWithAttributes(id: number) {
    const [cat] = await this.db.select().from(categories).where(eq(categories.id, id)).limit(1);
    if (!cat) return null;

    const catAttrs = await this.db
      .select({
        categoryId: categoryAttributes.categoryId,
        attributeId: categoryAttributes.attributeId,
        hasImages: categoryAttributes.hasImages,
        isPrimary: categoryAttributes.isPrimary,
        attribute: {
          id: attributes.id,
          name: attributes.name,
          description: attributes.description,
          status: attributes.status,
        },
      })
      .from(categoryAttributes)
      .leftJoin(attributes, eq(categoryAttributes.attributeId, attributes.id))
      .where(eq(categoryAttributes.categoryId, id));

    return {
      ...cat,
      categoryAttributes: catAttrs,
    };
  }

  // Helper: format category/subcategory object matching Laravel structure
  private formatCategory(cat: any) {
    if (!cat) return null;

    let formattedAttrs: any[] | undefined = undefined;
    if (cat.categoryAttributes && Array.isArray(cat.categoryAttributes)) {
      formattedAttrs = cat.categoryAttributes.map((ca: any) => ({
        id: Number(ca.attribute?.id ?? ca.attributeId),
        name: ca.attribute?.name,
        ...(ca.attribute?.description !== undefined ? { description: ca.attribute.description } : {}),
        ...(ca.attribute?.status !== undefined ? { status: Boolean(ca.attribute.status) } : {}),
        pivot: {
          category_id: Number(ca.categoryId),
          attribute_id: Number(ca.attributeId),
          has_images: Boolean(ca.hasImages),
          is_primary: Boolean(ca.isPrimary),
        },
      }));
    } else if (cat.attributes && Array.isArray(cat.attributes)) {
      formattedAttrs = cat.attributes;
    }

    const slug = (cat.slug || cat.name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    return {
      id: Number(cat.id),
      name: cat.name,
      slug,
      description: cat.description ?? null,
      image: cat.image ?? null,
      secondary_image: cat.secondaryImage ?? cat.secondary_image ?? null,
      secondaryImage: cat.secondaryImage ?? cat.secondary_image ?? null,
      link: cat.link ?? null,
      parent_id: cat.parentId !== undefined ? (cat.parentId ? Number(cat.parentId) : null) : (cat.parent_id ? Number(cat.parent_id) : null),
      status: Boolean(cat.status),
      hsn: cat.hsn ?? null,
      cgst: cat.cgst !== null && cat.cgst !== undefined ? cat.cgst : null,
      sgst: cat.sgst !== null && cat.sgst !== undefined ? cat.sgst : null,
      igst: cat.igst !== null && cat.igst !== undefined ? cat.igst : null,
      created_at: cat.createdAt ?? cat.created_at,
      updated_at: cat.updatedAt ?? cat.updated_at,
      ...(cat.products_count !== undefined ? { products_count: cat.products_count, productsCount: cat.products_count } : {}),
      ...(formattedAttrs !== undefined ? { attributes: formattedAttrs } : {}),
    };
  }

  // Helper: insert category-attribute pivot rows
  private async _syncCategoryAttributes(categoryId: number, attrs: any[]) {
    for (const attr of attrs) {
      const attributeId = attr.AttributeId ?? attr.attribute_id;
      if (!attributeId) continue;
      await this.db.insert(categoryAttributes).values({
        categoryId,
        attributeId,
        hasImages: Boolean(attr.HasImages ?? attr.has_images ?? false),
        isPrimary: Boolean(attr.IsPrimary ?? attr.is_primary ?? false),
      });
    }
  }

  // Helper: validate and sanitize HSN and GST rates
  private sanitizeTaxAndHsn(body: any) {
    let hsn: string | null = null;
    if (body.hsn !== undefined && body.hsn !== null && String(body.hsn).trim() !== '') {
      hsn = String(body.hsn).trim();
      if (hsn.length > 15) {
        throw new HttpException(
          { res: 'error', message: 'HSN code cannot exceed 15 characters.' },
          HttpStatus.UNPROCESSABLE_ENTITY, // 422
        );
      }
    }

    const parseRate = (val: any, label: string): string | null => {
      if (val === undefined || val === null || String(val).trim() === '') return null;
      const num = parseFloat(String(val).trim());
      if (isNaN(num) || num < 0 || num >= 100) {
        throw new HttpException(
          { res: 'error', message: `${label} must be a number between 0 and 99.99.` },
          HttpStatus.UNPROCESSABLE_ENTITY, // 422
        );
      }
      return num.toFixed(2);
    };

    const cgst = parseRate(body.cgst, 'CGST');
    const sgst = parseRate(body.sgst, 'SGST');
    const igst = parseRate(body.igst, 'IGST');

    return { hsn, cgst, sgst, igst };
  }
}






