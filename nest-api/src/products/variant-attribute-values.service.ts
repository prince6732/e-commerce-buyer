import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import { variantAttributeValues, variants, attributeValues, products, categories, brands } from '../database/schema';
import { ProductsGateway } from './products.gateway';

@Injectable()
export class VariantAttributeValuesService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private productsGateway: ProductsGateway,
  ) {}

  /**
   * GET /variant/:variantId/attribute-values
   * Returns all attribute values attached to a variant (with attribute info)
   */
  async index(variantId: number) {
    const variant = await this.db.query.variants.findFirst({ where: eq(variants.id, variantId) });
    if (!variant) {
      throw new HttpException(
        { res: 'error', message: 'Variant not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    const pivotRows = await this.db.query.variantAttributeValues.findMany({
      where: eq(variantAttributeValues.variantId, variantId),
    });

    // Fetch each attribute value with its parent attribute
    const result = await Promise.all(
      pivotRows.map(async (row) => {
        const val: any = await this.db.query.attributeValues.findFirst({
          where: eq(attributeValues.id, row.attributeValueId),
          with: { attribute: true } as any,
        });
        if (!val) return null;
        return {
          id: Number(val.id),
          attribute_id: Number(val.attributeId),
          value: val.value,
          description: val.description ?? null,
          status: Boolean(val.status),
          created_at: val.createdAt,
          updated_at: val.updatedAt,
          ...(val.attribute ? {
            attribute: {
              id: Number(val.attribute.id),
              name: val.attribute.name,
              description: val.attribute.description ?? null,
              status: Boolean(val.attribute.status),
            }
          } : {})
        };
      }),
    );

    return result.filter(Boolean);
  }

  /**
   * POST /variant/:variantId/attach-attribute-values
   * Body: { attribute_value_ids: number[] }
   * Syncs (without detaching existing) attribute values to a variant
   */
  async store(variantId: number, attributeValueIds: number[]) {
    const variant = await this.db.query.variants.findFirst({ where: eq(variants.id, variantId) });
    if (!variant) {
      throw new HttpException(
        { res: 'error', message: 'Variant not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    const ids = Array.isArray(attributeValueIds) ? attributeValueIds : [];

    // syncWithoutDetaching equivalent: insert only new ones, skip duplicates
    for (const avId of ids) {
      const exists = await this.db.query.variantAttributeValues.findFirst({
        where: and(
          eq(variantAttributeValues.variantId, variantId),
          eq(variantAttributeValues.attributeValueId, avId),
        ),
      });
      if (!exists) {
        await this.db.insert(variantAttributeValues).values({ variantId, attributeValueId: avId });
      }
    }

    const updatedValues = await this.index(variantId);

    if (variant.productId) {
      const full = await this.getProductWithRelations(variant.productId);
      if (full) {
        this.productsGateway.emitProductUpdated(full);
      }
    }

    return { res: 'success', values: updatedValues };
  }

  /**
   * DELETE /variant/:variantId/detach-attribute-value/:attributeValueId
   * Removes one attribute value from the variant pivot
   */
  async destroy(variantId: number, attributeValueId: number) {
    const variant = await this.db.query.variants.findFirst({ where: eq(variants.id, variantId) });
    if (!variant) {
      throw new HttpException(
        { res: 'error', message: 'Variant not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.db.delete(variantAttributeValues).where(
      and(
        eq(variantAttributeValues.variantId, variantId),
        eq(variantAttributeValues.attributeValueId, attributeValueId),
      ),
    );

    if (variant.productId) {
      const full = await this.getProductWithRelations(variant.productId);
      if (full) {
        this.productsGateway.emitProductUpdated(full);
      }
    }

    return { res: 'success', message: 'Attribute value detached successfully' };
  }

  private async getProductWithRelations(productId: number) {
    const [p] = await this.db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!p) return null;
    const vList = await this.db.select().from(variants).where(eq(variants.productId, productId));
    const [cat] = p.categoryId ? await this.db.select().from(categories).where(eq(categories.id, p.categoryId)).limit(1) : [null];
    const [brand] = p.brandId ? await this.db.select().from(brands).where(eq(brands.id, p.brandId)).limit(1) : [null];
    return {
      ...p,
      variants: vList,
      category: cat,
      brand: brand,
    };
  }
}
