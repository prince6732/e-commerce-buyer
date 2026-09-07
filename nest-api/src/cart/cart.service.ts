import { Injectable, Inject, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import { carts, products, variants } from '../database/schema';

@Injectable()
export class CartService {
  private logger = new Logger(CartService.name);

  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async index(userId: number) {
    try {
      const rawItems = await this.db.query.carts.findMany({
        where: eq(carts.userId, userId),
        with: {
          product: { with: { brand: true, category: true } as any },
          variant: true,
        } as any,
      });

      const items = rawItems.map((item: any) => {
        const p = item.product;
        const v = item.variant;
        const currentPrice =
          v?.sp !== null && v?.sp !== undefined
            ? Number(v.sp)
            : p?.sp !== null && p?.sp !== undefined
              ? Number(p.sp)
              : 0;
        const totalNum = currentPrice * item.quantity;

        return {
          id: Number(item.id),
          product_id: Number(item.productId),
          variant_id: Number(item.variantId),
          quantity: Number(item.quantity),
          price: currentPrice.toFixed(2),
          total: totalNum,
          selected_attributes: item.selectedAttributes,
          product: p
            ? {
                id: Number(p.id),
                name: p.name,
                image_url: p.imageUrl ?? null,
                brand: p.brand ? p.brand.name : null,
                category_name: p.category ? p.category.name : null,
                status: p.status !== undefined ? Boolean(p.status) : true,
              }
            : null,
          variant: v
            ? {
                id: Number(v.id),
                title: v.title ?? null,
                sku: v.sku,
                stock: Number(v.stock ?? 0),
                image_url: v.imageUrl ?? null,
                bs: v.bs ?? null,
                mrp: v.mrp !== null && v.mrp !== undefined ? Number(v.mrp) : null,
                sp: v.sp !== null && v.sp !== undefined ? Number(v.sp) : currentPrice,
                status: v.status !== undefined ? Boolean(v.status) : true,
              }
            : null,
        };
      });

      const cartTotal = items.reduce((sum, i) => sum + (i.total || 0), 0);
      const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);

      return {
        success: true,
        data: {
          items,
          total: cartTotal,
          count: cartCount,
        },
      };
    } catch (e: any) {
      this.logger.error(`Error fetching cart items for user ${userId}:`, e);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to fetch cart items',
          error: e.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async store(userId: number, body: any) {
    try {
      const productId = body?.product_id ? Number(body.product_id) : null;
      const variantId = body?.variant_id ? Number(body.variant_id) : null;
      const quantity = body?.quantity ? Number(body.quantity) : null;

      const errors: Record<string, string[]> = {};

      if (!productId) {
        errors.product_id = ['The selected product_id is invalid.'];
      }
      if (!variantId) {
        errors.variant_id = ['The selected variant_id is invalid.'];
      }
      if (!quantity || quantity < 1) {
        errors.quantity = ['The quantity must be at least 1.'];
      }

      if (Object.keys(errors).length > 0) {
        throw new HttpException(
          {
            success: false,
            message: 'Validation failed',
            errors,
          },
          HttpStatus.UNPROCESSABLE_ENTITY, // 422
        );
      }

      const product = await this.db.query.products.findFirst({ where: eq(products.id, productId!) });
      if (!product) {
        throw new HttpException(
          {
            success: false,
            message: 'Validation failed',
            errors: { product_id: ['The selected product_id is invalid.'] },
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const variant = await this.db.query.variants.findFirst({ where: eq(variants.id, variantId!) });
      if (!variant) {
        throw new HttpException(
          {
            success: false,
            message: 'Validation failed',
            errors: { variant_id: ['The selected variant_id is invalid.'] },
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      if (Number(variant.productId) !== Number(product.id)) {
        throw new HttpException(
          {
            success: false,
            message: 'Validation failed',
            errors: { variant_id: ['Selected variant does not belong to the specified product.'] },
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      if (Number(variant.stock) < quantity!) {
        throw new HttpException(
          {
            success: false,
            message: 'Validation failed',
            errors: { quantity: [`Not enough stock available. Only ${variant.stock} items left.`] },
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const existingCartItem = await this.db.query.carts.findFirst({
        where: and(eq(carts.userId, userId), eq(carts.productId, productId!), eq(carts.variantId, variantId!)),
      });

      let cartItemId: number;

      const itemPrice =
        variant.sp !== null && variant.sp !== undefined
          ? Number(variant.sp)
          : (product as any).sp !== null && (product as any).sp !== undefined
            ? Number((product as any).sp)
            : 0;

      if (existingCartItem) {
        const newQuantity = existingCartItem.quantity + quantity!;
        if (newQuantity > variant.stock) {
          throw new HttpException(
            {
              success: false,
              message: 'Validation failed',
              errors: { quantity: [`Total quantity would exceed available stock (${variant.stock} available).`] },
            },
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }

        await this.db
          .update(carts)
          .set({
            quantity: newQuantity,
            price: itemPrice.toFixed(2),
            selectedAttributes: body.selected_attributes ?? existingCartItem.selectedAttributes,
          })
          .where(eq(carts.id, existingCartItem.id));

        cartItemId = existingCartItem.id;
      } else {
        const insertRes: any = await this.db
          .insert(carts)
          .values({
            userId,
            productId: productId!,
            variantId: variantId!,
            quantity: quantity!,
            price: itemPrice.toFixed(2),
            selectedAttributes: body.selected_attributes ?? null,
          });

        cartItemId = Number(insertRes?.[0]?.insertId || insertRes?.insertId || 0);

        if (!cartItemId) {
          const createdItem = await this.db.query.carts.findFirst({
            where: and(eq(carts.userId, userId), eq(carts.productId, productId!), eq(carts.variantId, variantId!)),
            orderBy: (c, { desc }) => [desc(c.id)],
          });
          cartItemId = createdItem?.id || 0;
        }
      }

      const cartItem: any = await this.db.query.carts.findFirst({
        where: eq(carts.id, cartItemId),
        with: { product: true, variant: true } as any,
      });

      const currentPrice =
        cartItem?.variant?.sp !== null && cartItem?.variant?.sp !== undefined
          ? Number(cartItem.variant.sp)
          : cartItem?.product?.sp !== null && cartItem?.product?.sp !== undefined
            ? Number(cartItem.product.sp)
            : itemPrice;
      const totalNum = currentPrice * (cartItem?.quantity || quantity || 1);

      return {
        success: true,
        message: 'Item added to cart successfully',
        data: {
          id: Number(cartItem?.id || cartItemId),
          product_id: Number(cartItem?.productId || productId),
          variant_id: Number(cartItem?.variantId || variantId),
          quantity: Number(cartItem?.quantity || quantity),
          price: currentPrice.toFixed(2),
          total: totalNum,
          product: {
            id: Number(cartItem?.product?.id || productId),
            name: cartItem?.product?.name || product.name,
            image_url: cartItem?.product?.imageUrl ?? null,
          },
          variant: {
            id: Number(cartItem?.variant?.id || variantId),
            title: cartItem?.variant?.title ?? null,
            sku: cartItem?.variant?.sku || variant.sku,
            stock: Number(cartItem?.variant?.stock ?? variant.stock),
          },
        },
      };
    } catch (e: any) {
      if (e instanceof HttpException) {
        throw e;
      }
      this.logger.error(`Error adding to cart (userId: ${userId}):`, e);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to add item to cart',
          error: e.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(userId: number, id: number, body: any) {
    try {
      const quantity = body?.quantity ? Number(body.quantity) : null;
      if (!quantity || quantity < 1) {
        throw new HttpException(
          {
            success: false,
            message: 'Validation failed',
            errors: { quantity: ['The quantity must be at least 1.'] },
          },
          HttpStatus.UNPROCESSABLE_ENTITY, // 422
        );
      }

      const cartItem: any = await this.db.query.carts.findFirst({
        where: and(eq(carts.id, id), eq(carts.userId, userId)),
        with: { variant: true } as any,
      });

      if (!cartItem) {
        throw new HttpException(
          {
            success: false,
            message: 'Failed to update cart item',
            error: 'Cart item not found',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const variant = cartItem.variant;
      if (variant && variant.stock < quantity) {
        throw new HttpException(
          {
            success: false,
            message: 'Validation failed',
            errors: { quantity: [`Not enough stock available. Only ${variant.stock} items left.`] },
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      await this.db
        .update(carts)
        .set({
          quantity,
        })
        .where(eq(carts.id, id));

      const currentPrice = variant?.sp !== null && variant?.sp !== undefined ? Number(variant.sp) : 0;
      const totalNum = currentPrice * quantity;

      return {
        success: true,
        message: 'Cart item updated successfully',
        data: {
          id: Number(cartItem.id),
          quantity: Number(quantity),
          price: currentPrice.toFixed(2),
          total: totalNum,
        },
      };
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      this.logger.error(`Error updating cart item ${id}:`, e);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to update cart item',
          error: e.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async destroy(userId: number, id: number) {
    try {
      const cartItem = await this.db.query.carts.findFirst({
        where: and(eq(carts.id, id), eq(carts.userId, userId)),
      });

      if (!cartItem) {
        throw new HttpException(
          {
            success: false,
            message: 'Failed to remove item from cart',
            error: 'Cart item not found',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      await this.db.delete(carts).where(eq(carts.id, id));

      return {
        success: true,
        message: 'Item removed from cart successfully',
      };
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      this.logger.error(`Error removing cart item ${id}:`, e);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to remove item from cart',
          error: e.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async clear(userId: number) {
    try {
      await this.db.delete(carts).where(eq(carts.userId, userId));
      return {
        success: true,
        message: 'Cart cleared successfully',
      };
    } catch (e: any) {
      this.logger.error(`Error clearing cart for user ${userId}:`, e);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to clear cart',
          error: e.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCartCount(userId: number) {
    try {
      const items = await this.db.query.carts.findMany({ where: eq(carts.userId, userId) });
      const count = items.reduce((sum, item) => sum + item.quantity, 0);

      return {
        success: true,
        data: { count },
      };
    } catch (e: any) {
      this.logger.error(`Error getting cart count for user ${userId}:`, e);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get cart count',
          error: e.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
