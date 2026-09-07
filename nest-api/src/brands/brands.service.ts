import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { eq, and, sql, or, desc, like, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import { brands, products, variants, categories } from '../database/schema';

@Injectable()
export class BrandsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async index(query: any = {}): Promise<any> {
    const isPaginatedRequest = query.page !== undefined || query.limit !== undefined || query.per_page !== undefined || query.search !== undefined;
    const perPage = Math.max(1, parseInt(query.limit ?? query.per_page ?? '10'));
    const page = Math.max(1, parseInt(query.page ?? '1'));
    const search = (query.search || query.q || '').trim();

    const conditions: any[] = [];
    if (query.status !== undefined && query.status !== null && query.status !== 'all' && query.status !== '') {
      const status = String(query.status);
      if (status === 'active' || status === '1' || status === 'true') {
        conditions.push(eq(brands.status, true));
      } else if (status === 'inactive' || status === '0' || status === 'false') {
        conditions.push(eq(brands.status, false));
      }
    }

    if (search) {
      conditions.push(
        or(
          like(brands.name, `%${search}%`),
          like(brands.description, `%${search}%`),
        ),
      );
    }

    const allMatching = await this.db.query.brands.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      orderBy: [desc(brands.createdAt)],
    });

    const total = allMatching.length;
    const paginated = isPaginatedRequest
      ? allMatching.slice((page - 1) * perPage, page * perPage)
      : allMatching;

    const formatted = paginated.map((b) => this.formatBrand(b));
    const lastPage = Math.ceil(total / perPage) || 1;
    const hasNextPage = page < lastPage;

    if (!isPaginatedRequest && !query.paginate) {
      return formatted;
    }

    return {
      res: 'success',
      data: {
        brands: formatted,
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
      brands: formatted,
    };
  }

  private async findBrandByIdOrSlug(idOrSlug: string | number) {
    const numId = Number(idOrSlug);
    if (!isNaN(numId) && numId > 0 && String(idOrSlug).trim() === String(numId)) {
      const b = await this.db.query.brands.findFirst({ where: eq(brands.id, numId) });
      if (b) return b;
    }
    const slugLower = String(idOrSlug).toLowerCase().trim();
    const allBrands = await this.db.query.brands.findMany();
    return allBrands.find((b: any) => {
      const bSlug = (b.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return b.slug === slugLower || bSlug === slugLower || (b.name || '').toLowerCase().trim() === slugLower;
    }) || null;
  }

  async show(idOrSlug: string | number): Promise<any> {
    const b = await this.findBrandByIdOrSlug(idOrSlug);
    if (!b) {
      throw new HttpException(
        { res: 'error', message: 'Brand not found.' },
        HttpStatus.NOT_FOUND,
      );
    }
    const brandProducts = await this.db.query.products.findMany({
      where: and(eq(products.brandId, b.id), eq(products.status, true)),
    });
    return this.formatBrand({
      ...b,
      products_count: brandProducts.length,
    });
  }

  async getProducts(idOrSlug: string | number, query: any = {}): Promise<any> {
    const perPage = parseInt(query.per_page ?? '8');
    const page = parseInt(query.page ?? '1');

    const brand = await this.findBrandByIdOrSlug(idOrSlug);
    if (!brand) {
      throw new HttpException(
        { res: 'error', message: 'Brand not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    const rawProducts = await this.db
      .select()
      .from(products)
      .where(and(eq(products.brandId, brand.id), eq(products.status, true)));

    const prodIds = rawProducts.map((p) => p.id);
    const varsByProdId = new Map<number, any[]>();
    if (prodIds.length > 0) {
      const vars = await this.db.select().from(variants).where(inArray(variants.productId, prodIds));
      for (const v of vars) {
        const pid = Number(v.productId);
        if (!varsByProdId.has(pid)) varsByProdId.set(pid, []);
        varsByProdId.get(pid)!.push(v);
      }
    }

    const catIds = Array.from(new Set(rawProducts.map((p) => p.categoryId).filter(Boolean)));
    const catById = new Map<number, any>();
    if (catIds.length > 0) {
      const cats = await this.db.select().from(categories).where(inArray(categories.id, catIds as number[]));
      for (const c of cats) catById.set(Number(c.id), c);
    }

    const allProducts = rawProducts.map((p) => ({
      ...p,
      brand,
      category: p.categoryId ? (catById.get(Number(p.categoryId)) ?? null) : null,
      variants: varsByProdId.get(Number(p.id)) || [],
    }));

    const totalProducts = allProducts.length;
    const start = (page - 1) * perPage;
    const paginated = allProducts.slice(start, start + perPage);

    const productsData = (paginated as any[]).map((product: any) => {
      const activeVariants = (product.variants ?? []).filter((v: any) => v.status);
      const firstVariant = activeVariants[0] ?? null;
      const imageUrl = product.imageUrl || (firstVariant ? firstVariant.imageUrl : null);
      const sps = activeVariants
        .map((v: any) => parseFloat(v.sp as string))
        .filter((val: number) => !isNaN(val));

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        item_code: product.itemCode,
        image_url: imageUrl,
        category: product.category,
        brand: product.brand,
        min_price: sps.length ? Math.min(...sps) : 0,
        max_price: sps.length ? Math.max(...sps) : 0,
        total_stock: activeVariants.reduce((sum: number, v: any) => sum + (v.stock ?? 0), 0),
        variants_count: activeVariants.length,
      };
    });

    const hasMore = page * perPage < totalProducts;

    return {
      products: productsData,
      has_more: hasMore,
      total: totalProducts,
      current_page: page,
      per_page: perPage,
    };
  }

  async store(body: any) {
    if (!body?.name) {
      throw new HttpException(
        { res: 'error', message: 'The name field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const statusBool = body.status !== undefined ? Boolean(body.status) : true;

    try {
      const [r] = await this.db
        .insert(brands)
        .values({
          name: body.name,
          description: body.description ?? null,
          image1: body.image1 ?? null,
          description1: body.description1 ?? null,
          image2: body.image2 ?? null,
          description2: body.description2 ?? null,
          image3: body.image3 ?? null,
          description3: body.description3 ?? null,
          status: statusBool,
        })
        .$returningId();

      const created = await this.db.query.brands.findFirst({ where: eq(brands.id, r.id) });
      return { res: 'success', brand: this.formatBrand(created) };
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { res: 'error', message: 'Something went wrong.' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: number, body: any) {
    const brand = await this.db.query.brands.findFirst({ where: eq(brands.id, id) });
    if (!brand) {
      throw new HttpException(
        { res: 'error', message: 'Brand not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (!body?.name) {
      throw new HttpException(
        { res: 'error', message: 'The name field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const nameLower = (body.name || '').toLowerCase();
    const exists = await this.db.query.brands.findFirst({
      where: and(
        sql`LOWER(${brands.name}) = ${nameLower}`,
        sql`${brands.id} != ${id}`,
      ),
    });

    if (exists) {
      throw new HttpException(
        { res: 'error', message: 'This brand already exists.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const statusBool = body.status !== undefined ? Boolean(body.status) : brand.status;

    try {
      await this.db
        .update(brands)
        .set({
          name: body.name,
          description: body.description ?? null,
          image1: body.image1 ?? null,
          description1: body.description1 ?? null,
          image2: body.image2 ?? null,
          description2: body.description2 ?? null,
          image3: body.image3 ?? null,
          description3: body.description3 ?? null,
          status: statusBool,
        })
        .where(eq(brands.id, id));

      const updated = await this.db.query.brands.findFirst({ where: eq(brands.id, id) });
      return { res: 'success', brand: this.formatBrand(updated) };
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { res: 'error', message: 'Something went wrong.' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async destroy(id: number) {
    const brand = await this.db.query.brands.findFirst({ where: eq(brands.id, id) });
    if (!brand) {
      throw new HttpException(
        { res: 'error', message: 'Brand not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    const hasProducts = await this.db.query.products.findFirst({
      where: eq(products.brandId, id),
    });

    if (hasProducts) {
      throw new HttpException(
        {
          res: 'error',
          message: 'This brand cannot be deleted because it is associated with existing products.',
        },
        HttpStatus.BAD_REQUEST, // 400
      );
    }

    await this.db.delete(brands).where(eq(brands.id, id));
    return { res: 'success', message: 'Brand deleted successfully' };
  }

  async changeStatus(id: number) {
    const brand = await this.db.query.brands.findFirst({ where: eq(brands.id, id) });
    if (!brand) {
      throw new HttpException(
        { res: 'error', message: 'Brand not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    const newStatus = !brand.status;
    await this.db.update(brands).set({ status: newStatus }).where(eq(brands.id, id));
    return { result: 'success', message: 'Status updated successfully', status: newStatus };
  }

  private formatBrand(b: any) {
    if (!b) return null;
    const computedSlug = b.slug || (b.name ? b.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : String(b.id));
    return {
      id: Number(b.id),
      name: b.name,
      slug: computedSlug,
      description: b.description ?? null,
      description1: b.description1 ?? null,
      description2: b.description2 ?? null,
      description3: b.description3 ?? null,
      image1: b.image1 ?? null,
      image2: b.image2 ?? null,
      image3: b.image3 ?? null,
      status: Boolean(b.status),
      created_at: b.createdAt ?? b.created_at,
      updated_at: b.updatedAt ?? b.updated_at,
      ...(b.products_count !== undefined ? { products_count: b.products_count } : {}),
    };
  }
}
