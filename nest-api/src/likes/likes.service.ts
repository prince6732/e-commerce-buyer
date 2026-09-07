import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import { likes, products, variants, categories, brands } from '../database/schema';

@Injectable()
export class LikesService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async toggle(userId: number, productIdInput: any) {
    const productId = productIdInput ? Number(productIdInput) : null;
    if (!productId) {
      throw new HttpException(
        { res: 'error', message: 'The selected product_id is invalid.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const product = await this.db.query.products.findFirst({ where: eq(products.id, productId) });
    if (!product) {
      throw new HttpException(
        { res: 'error', message: 'The selected product_id is invalid.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    try {
      const existing = await this.db.query.likes.findFirst({
        where: and(eq(likes.userId, userId), eq(likes.productId, productId)),
      });

      let liked: boolean;
      let message: string;

      if (existing) {
        await this.db.delete(likes).where(eq(likes.id, existing.id));
        liked = false;
        message = 'Product removed from wishlist';
      } else {
        await this.db.insert(likes).values({ userId, productId });
        liked = true;
        message = 'Product added to wishlist';
      }

      const allLikes = await this.db.query.likes.findMany({ where: eq(likes.productId, productId) });

      return {
        res: 'success',
        message,
        liked,
        likes_count: allLikes.length,
      };
    } catch (e: any) {
      throw new HttpException(
        { res: 'error', message: 'Failed to update like status', error: e.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUserLikes(userId: number) {
    try {
      const userLikes = await this.db.query.likes.findMany({
        where: eq(likes.userId, userId),
      });

      const likedProductIds = userLikes.map((l) => l.productId);
      let likedProducts: any[] = [];

      if (likedProductIds.length > 0) {
        const rawProds = await this.db
          .select()
          .from(products)
          .where(and(eq(products.status, true), inArray(products.id, likedProductIds)));

        const prodIds = rawProds.map((p) => p.id);
        const varsByProdId = new Map<number, any[]>();
        if (prodIds.length > 0) {
          const vars = await this.db.select().from(variants).where(inArray(variants.productId, prodIds));
          for (const v of vars) {
            const pid = Number(v.productId);
            if (!varsByProdId.has(pid)) varsByProdId.set(pid, []);
            varsByProdId.get(pid)!.push(v);
          }
        }

        const catIds = Array.from(new Set(rawProds.map((p) => p.categoryId).filter(Boolean)));
        const catById = new Map<number, any>();
        if (catIds.length > 0) {
          const cats = await this.db.select().from(categories).where(inArray(categories.id, catIds as number[]));
          for (const c of cats) catById.set(Number(c.id), c);
        }

        const brandIds = Array.from(new Set(rawProds.map((p) => p.brandId).filter(Boolean)));
        const brandById = new Map<number, any>();
        if (brandIds.length > 0) {
          const bList = await this.db.select().from(brands).where(inArray(brands.id, brandIds as number[]));
          for (const b of bList) brandById.set(Number(b.id), b);
        }

        const prods = rawProds.map((p) => ({
          ...p,
          category: p.categoryId ? (catById.get(Number(p.categoryId)) ?? null) : null,
          brand: p.brandId ? (brandById.get(Number(p.brandId)) ?? null) : null,
          variants: varsByProdId.get(Number(p.id)) || [],
        }));

        // Compute total likes for each product across all users
        const allProductLikes = await this.db.query.likes.findMany({
          where: inArray(likes.productId, likedProductIds),
        });
        const totalLikesMap: Record<number, number> = {};
        for (const l of allProductLikes) {
          totalLikesMap[l.productId] = (totalLikesMap[l.productId] ?? 0) + 1;
        }

        likedProducts = prods.map((product: any) => {
          const activeVariants = (product.variants ?? []).filter((v: any) => v.status);
          const sps = activeVariants.map((v: any) => parseFloat(v.sp as string)).filter((val) => !isNaN(val));
          const minPrice = sps.length ? Math.min(...sps) : 0;

          let imageUrl = product.imageUrl;
          if (!imageUrl && activeVariants.length > 0) {
            const firstWithImg = activeVariants.find((v: any) => v.imageUrl);
            if (firstWithImg) imageUrl = firstWithImg.imageUrl;
          }

          return {
            id: Number(product.id),
            name: product.name,
            description: product.description ?? null,
            item_code: product.itemCode ?? null,
            image_url: imageUrl ?? null,
            status: Boolean(product.status),
            is_new_arrival: Boolean(product.isNewArrival),
            category_id: Number(product.categoryId),
            brand_id: product.brandId ? Number(product.brandId) : null,
            created_at: product.createdAt,
            updated_at: product.updatedAt,
            category: product.category ? { id: Number(product.category.id), name: product.category.name } : null,
            brand: product.brand ? { id: Number(product.brand.id), name: product.brand.name } : null,
            variants: activeVariants.slice(0, 1).map((v: any) => ({
              id: Number(v.id),
              title: v.title ?? null,
              sku: v.sku,
              stock: Number(v.stock ?? 0),
              sp: v.sp !== null ? Number(v.sp) : 0,
              mrp: v.mrp !== null ? Number(v.mrp) : 0,
              image_url: v.imageUrl ?? null,
            })),
            is_liked: true,
            likes_count: totalLikesMap[product.id] ?? 0,
            min_price: minPrice,
          };
        });
      }

      return {
        res: 'success',
        liked_products: likedProducts,
        count: likedProducts.length,
      };
    } catch (e: any) {
      throw new HttpException(
        { res: 'error', message: 'Failed to fetch liked products', error: e.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async checkLikeStatus(userId: number, productIdInput: any) {
    const productId = productIdInput ? Number(productIdInput) : null;
    if (!productId) {
      throw new HttpException(
        { res: 'error', message: 'The selected product_id is invalid.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const product = await this.db.query.products.findFirst({ where: eq(products.id, productId) });
    if (!product) {
      throw new HttpException(
        { res: 'error', message: 'The selected product_id is invalid.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const existing = await this.db.query.likes.findFirst({
      where: and(eq(likes.userId, userId), eq(likes.productId, productId)),
    });

    const allLikes = await this.db.query.likes.findMany({ where: eq(likes.productId, productId) });

    return {
      res: 'success',
      is_liked: !!existing,
      likes_count: allLikes.length,
    };
  }

  async getProductsLikesStatus(userId: number, productIds: any) {
    if (!productIds || !Array.isArray(productIds)) {
      throw new HttpException(
        { res: 'error', message: 'The product_ids field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const ids = productIds.map(Number).filter((n) => !isNaN(n));

    try {
      const userLikes = await this.db.query.likes.findMany({ where: eq(likes.userId, userId) });
      const userLikedProductIds = userLikes.map((l) => l.productId);

      const allLikes = ids.length > 0
        ? await this.db.query.likes.findMany({ where: inArray(likes.productId, ids) })
        : [];

      const countsMap: Record<number, number> = {};
      for (const l of allLikes) {
        countsMap[l.productId] = (countsMap[l.productId] ?? 0) + 1;
      }

      const likesData: Record<number, { is_liked: boolean; likes_count: number }> = {};
      for (const id of ids) {
        likesData[id] = {
          is_liked: userLikedProductIds.includes(id),
          likes_count: countsMap[id] ?? 0,
        };
      }

      return {
        res: 'success',
        likes_data: likesData,
      };
    } catch (e: any) {
      throw new HttpException(
        { res: 'error', message: 'Failed to fetch likes data', error: e.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
