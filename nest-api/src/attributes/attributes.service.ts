import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { eq, ne, and, sql, or, desc, like } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import {
  attributes,
  attributeValues,
  categoryAttributes,
  itemAttributes,
  productAttributeValues,
  variantAttributeValues,
} from '../database/schema';

@Injectable()
export class AttributesService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  // ─── Attributes ──────────────────────────────────────────────────────────
  async indexAttributes(query: any = {}): Promise<any> {
    const isPaginatedRequest = query.page !== undefined || query.limit !== undefined || query.per_page !== undefined || query.search !== undefined;
    const perPage = Math.max(1, parseInt(query.limit ?? query.per_page ?? '10'));
    const page = Math.max(1, parseInt(query.page ?? '1'));
    const search = (query.search || query.q || '').trim();

    const conditions: any[] = [];
    if (query.status !== undefined && query.status !== null && query.status !== 'all' && query.status !== '') {
      const status = String(query.status);
      if (status === 'active' || status === '1' || status === 'true') {
        conditions.push(eq(attributes.status, true));
      } else if (status === 'inactive' || status === '0' || status === 'false') {
        conditions.push(eq(attributes.status, false));
      }
    }

    if (search) {
      conditions.push(
        or(
          like(attributes.name, `%${search}%`),
          like(attributes.description, `%${search}%`),
        ),
      );
    }

    const allMatching = await this.db.query.attributes.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      orderBy: [desc(attributes.createdAt)],
    });

    const total = allMatching.length;
    const paginated = isPaginatedRequest
      ? allMatching.slice((page - 1) * perPage, page * perPage)
      : allMatching;

    const formatted = paginated.map((a) => this.formatAttribute(a));
    const lastPage = Math.ceil(total / perPage) || 1;
    const hasNextPage = page < lastPage;

    if (!isPaginatedRequest && !query.paginate) {
      return formatted;
    }

    return {
      res: 'success',
      data: {
        attributes: formatted,
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
      attributes: formatted,
    };
  }

  async showAttribute(idOrSlug: string | number): Promise<any> {
    let a: any = null;
    const numId = Number(idOrSlug);
    if (!isNaN(numId) && numId > 0 && String(idOrSlug).trim() === String(numId)) {
      a = await this.db.query.attributes.findFirst({ where: eq(attributes.id, numId) });
    }
    if (!a) {
      const slugLower = String(idOrSlug).toLowerCase().trim();
      const all = await this.db.query.attributes.findMany();
      a = all.find((item) => {
        const itemSlug = (item.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        return itemSlug === slugLower || (item.name || '').toLowerCase().trim() === slugLower;
      });
    }
    if (!a) {
      throw new HttpException(
        { res: 'error', message: 'Attribute not found.' },
        HttpStatus.NOT_FOUND,
      );
    }
    return this.formatAttribute(a);
  }

  async storeAttribute(body: any): Promise<any> {
    if (!body?.name) {
      throw new HttpException(
        { res: 'error', message: 'The name field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const nameLower = (body.name || '').toString().toLowerCase();
    const existing = await this.db.query.attributes.findFirst({
      where: sql`LOWER(${attributes.name}) = ${nameLower}`,
    });

    if (existing) {
      throw new HttpException(
        {
          res: 'error',
          message: 'This attribute already exists.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const [r] = await this.db
      .insert(attributes)
      .values({
        name: body.name,
        description: body.description ?? null,
        status: body.status !== undefined ? Boolean(body.status) : true,
      })
      .$returningId();

    const attribute = await this.showAttribute(r.id);
    return { res: 'success', attribute };
  }

  async updateAttribute(id: number, body: any): Promise<any> {
    const existingAttr = await this.db.query.attributes.findFirst({ where: eq(attributes.id, id) });
    if (!existingAttr) {
      throw new HttpException(
        { res: 'error', message: 'Attribute not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (!body?.name) {
      throw new HttpException(
        { res: 'error', message: 'The name field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const nameLower = (body.name || '').toString().toLowerCase();
    const exists = await this.db.query.attributes.findFirst({
      where: and(
        sql`LOWER(${attributes.name}) = ${nameLower}`,
        ne(attributes.id, id),
      ),
    });

    if (exists) {
      throw new HttpException(
        {
          res: 'error',
          message: 'This attribute already exists.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    await this.db
      .update(attributes)
      .set({
        name: body.name,
        description: body.description ?? null,
        status: body.status !== undefined ? Boolean(body.status) : existingAttr.status,
      })
      .where(eq(attributes.id, id));

    const updated = await this.showAttribute(id);
    return { res: 'success', attribute: updated };
  }

  async destroyAttribute(id: number): Promise<any> {
    const existingAttr = await this.db.query.attributes.findFirst({ where: eq(attributes.id, id) });
    if (!existingAttr) {
      throw new HttpException(
        { res: 'error', message: 'Attribute not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    const hasValues = await this.db.query.attributeValues.findFirst({
      where: eq(attributeValues.attributeId, id),
    });
    const hasCategories = await this.db.query.categoryAttributes.findFirst({
      where: eq(categoryAttributes.attributeId, id),
    });
    const hasItemAttrs = await this.db.query.itemAttributes.findFirst({
      where: eq(itemAttributes.attributeId, id),
    });
    const hasProdValues = await this.db.query.productAttributeValues.findFirst({
      where: eq(productAttributeValues.attributeId, id),
    });

    if (hasValues || hasCategories || hasItemAttrs || hasProdValues) {
      throw new HttpException(
        {
          res: 'error',
          message:
            'This attribute cannot be deleted because it is associated with existing values, categories, or products.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.db.delete(attributes).where(eq(attributes.id, id));
    return { res: 'success', message: 'Attribute deleted successfully' };
  }

  async changeAttributeStatus(id: number): Promise<any> {
    const attr = await this.db.query.attributes.findFirst({ where: eq(attributes.id, id) });
    if (!attr) {
      throw new HttpException(
        { res: 'error', message: 'Attribute not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    const newStatus = !attr.status;
    await this.db.update(attributes).set({ status: newStatus }).where(eq(attributes.id, id));
    return { result: 'success', message: 'Status updated successfully', status: newStatus };
  }

  // ─── Attribute Values ─────────────────────────────────────────────────────
  async indexValues(query: any = {}): Promise<any> {
    const attributeParam = query.attribute_id ?? query.attribute_slug ?? query.slug ?? query.attribute;
    if (!attributeParam) {
      throw new HttpException(
        {
          res: 'error',
          message: 'attribute_id or slug is required',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    let attribute: any = null;
    const numId = Number(attributeParam);
    if (!isNaN(numId) && numId > 0 && String(attributeParam).trim() === String(numId)) {
      attribute = await this.db.query.attributes.findFirst({
        where: eq(attributes.id, numId),
      });
    }
    if (!attribute) {
      const slugLower = String(attributeParam).toLowerCase().trim();
      const all = await this.db.query.attributes.findMany();
      attribute = all.find((item) => {
        const itemSlug = (item.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        return itemSlug === slugLower || (item.name || '').toLowerCase().trim() === slugLower;
      });
    }

    if (!attribute) {
      throw new HttpException(
        {
          res: 'error',
          message: 'Attribute not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const attributeId = Number(attribute.id);

    const isPaginatedRequest = query.page !== undefined || query.limit !== undefined || query.per_page !== undefined || query.search !== undefined;
    const perPage = Math.max(1, parseInt(query.limit ?? query.per_page ?? '10'));
    const page = Math.max(1, parseInt(query.page ?? '1'));
    const search = (query.search || query.q || '').trim();

    const conditions: any[] = [eq(attributeValues.attributeId, attributeId)];
    if (query.status !== undefined && query.status !== null && query.status !== 'all' && query.status !== '') {
      const status = String(query.status);
      if (status === 'active' || status === '1' || status === 'true') {
        conditions.push(eq(attributeValues.status, true));
      } else if (status === 'inactive' || status === '0' || status === 'false') {
        conditions.push(eq(attributeValues.status, false));
      }
    }

    if (search) {
      conditions.push(
        or(
          like(attributeValues.value, `%${search}%`),
          like(attributeValues.description, `%${search}%`),
        ),
      );
    }

    const allValues = await this.db.query.attributeValues.findMany({
      where: and(...conditions),
      orderBy: [desc(attributeValues.createdAt)],
    });

    const total = allValues.length;
    const paginated = isPaginatedRequest
      ? allValues.slice((page - 1) * perPage, page * perPage)
      : allValues;

    const formattedValues = paginated.map((v) => this.formatAttributeValue(v));
    const lastPage = Math.ceil(total / perPage) || 1;
    const hasNextPage = page < lastPage;

    return {
      res: 'success',
      attribute: this.formatAttribute(attribute),
      values: formattedValues,
      data: {
        values: formattedValues,
        attribute: this.formatAttribute(attribute),
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

  async showValue(id: number): Promise<any> {
    const v = await this.db.query.attributeValues.findFirst({
      where: eq(attributeValues.id, id),
      with: { attribute: true },
    });
    if (!v) {
      throw new HttpException(
        { res: 'error', message: 'Attribute value not found.' },
        HttpStatus.NOT_FOUND,
      );
    }
    return this.formatAttributeValue(v);
  }

  async storeValue(body: any): Promise<any> {
    let attributeId = body.attribute_id ? Number(body.attribute_id) : null;
    let attr: any = null;
    if (attributeId) {
      attr = await this.db.query.attributes.findFirst({
        where: eq(attributes.id, attributeId),
      });
    }
    if (!attr && (body.attribute_slug || body.slug || body.attribute)) {
      const slugLower = String(body.attribute_slug || body.slug || body.attribute).toLowerCase().trim();
      const all = await this.db.query.attributes.findMany();
      attr = all.find((item) => {
        const itemSlug = (item.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        return itemSlug === slugLower || (item.name || '').toLowerCase().trim() === slugLower;
      });
      if (attr) {
        attributeId = Number(attr.id);
      }
    }

    if (!attr || !attributeId) {
      throw new HttpException(
        { res: 'error', message: 'The selected attribute id is invalid.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const valueList = body.attributeValues;
    if (!Array.isArray(valueList) || !valueList.length) {
      throw new HttpException(
        {
          res: 'error',
          message: 'attributeValues array is required',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const created: any[] = [];

    for (const item of valueList) {
      const valLower = (item.value || '').toString().toLowerCase();
      const exists = await this.db.query.attributeValues.findFirst({
        where: and(
          eq(attributeValues.attributeId, attributeId),
          sql`LOWER(${attributeValues.value}) = ${valLower}`,
        ),
      });

      if (exists) continue;

      const [r] = await this.db
        .insert(attributeValues)
        .values({
          attributeId,
          value: item.value,
          description: item.description ?? null,
          status: item.status !== undefined ? Boolean(item.status) : true,
        })
        .$returningId();

      const createdRecord = await this.db.query.attributeValues.findFirst({
        where: eq(attributeValues.id, r.id),
      });

      if (createdRecord) {
        created.push(this.formatAttributeValue(createdRecord));
      }
    }

    return {
      res: 'success',
      message: created.length
        ? 'Attribute values created successfully.'
        : 'No new values were added (duplicates skipped).',
      created,
    };
  }

  async updateValue(id: number, body: any): Promise<any> {
    const existingVal = await this.db.query.attributeValues.findFirst({
      where: eq(attributeValues.id, id),
    });
    if (!existingVal) {
      throw new HttpException(
        { res: 'error', message: 'Attribute value not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    const attributeId = body.attribute_id ? Number(body.attribute_id) : existingVal.attributeId;
    const attr = await this.db.query.attributes.findFirst({
      where: eq(attributes.id, attributeId),
    });
    if (!attr) {
      throw new HttpException(
        { res: 'error', message: 'The selected attribute id is invalid.' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (!body?.value) {
      throw new HttpException(
        { res: 'error', message: 'The value field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const valLower = (body.value || '').toString().toLowerCase();

    const exists = await this.db.query.attributeValues.findFirst({
      where: and(
        eq(attributeValues.attributeId, attributeId),
        sql`LOWER(${attributeValues.value}) = ${valLower}`,
        ne(attributeValues.id, id),
      ),
    });

    if (exists) {
      throw new HttpException(
        {
          res: 'error',
          message: 'This value already exists for the selected attribute.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    await this.db
      .update(attributeValues)
      .set({
        attributeId,
        value: body.value,
        description: body.description ?? null,
        status: body.status !== undefined ? Boolean(body.status) : existingVal.status,
      })
      .where(eq(attributeValues.id, id));

    const updated = await this.db.query.attributeValues.findFirst({
      where: eq(attributeValues.id, id),
    });

    return { res: 'success', value: this.formatAttributeValue(updated) };
  }

  async destroyValue(id: number): Promise<any> {
    const existingVal = await this.db.query.attributeValues.findFirst({
      where: eq(attributeValues.id, id),
    });
    if (!existingVal) {
      throw new HttpException(
        { res: 'error', message: 'Attribute value not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    const hasProdValues = await this.db.query.productAttributeValues.findFirst({
      where: eq(productAttributeValues.attributeValueId, id),
    });
    const hasVariantValues = await this.db.query.variantAttributeValues.findFirst({
      where: eq(variantAttributeValues.attributeValueId, id),
    });

    if (hasProdValues || hasVariantValues) {
      throw new HttpException(
        {
          res: 'error',
          message:
            'This attribute value cannot be deleted because it is associated with existing products or variants.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.db.delete(attributeValues).where(eq(attributeValues.id, id));
    return { res: 'success', message: 'Attribute value deleted successfully' };
  }

  async changeValueStatus(id: number): Promise<any> {
    const val = await this.db.query.attributeValues.findFirst({
      where: eq(attributeValues.id, id),
    });
    if (!val) {
      throw new HttpException(
        { res: 'error', message: 'Attribute value not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    const newStatus = !val.status;
    await this.db
      .update(attributeValues)
      .set({ status: newStatus })
      .where(eq(attributeValues.id, id));

    return { result: 'success', message: 'Status updated successfully', status: newStatus };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  private formatAttribute(attr: any) {
    if (!attr) return null;
    const slug = (attr.slug || attr.name || '')
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    return {
      id: Number(attr.id),
      name: attr.name,
      slug,
      description: attr.description ?? null,
      status: Boolean(attr.status),
      created_at: attr.createdAt ?? attr.created_at,
      updated_at: attr.updatedAt ?? attr.updated_at,
    };
  }

  private formatAttributeValue(val: any) {
    if (!val) return null;
    return {
      id: Number(val.id),
      attribute_id: Number(val.attributeId ?? val.attribute_id),
      value: val.value,
      description: val.description ?? null,
      status: Boolean(val.status),
      created_at: val.createdAt ?? val.created_at,
      updated_at: val.updatedAt ?? val.updated_at,
      ...(val.attribute ? { attribute: this.formatAttribute(val.attribute) } : {}),
    };
  }
}

