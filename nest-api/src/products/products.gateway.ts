import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/products',
})
export class ProductsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ProductsGateway.name);

  handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        (client.handshake.headers?.authorization
          ? String(client.handshake.headers.authorization).replace('Bearer ', '')
          : null) ||
        client.handshake.query?.token;

      // All connected clients join global product channel
      client.join('products_global');

      if (token) {
        const secret = process.env.JWT_SECRET || 'secret';
        try {
          const decoded: any = jwt.verify(token as string, secret);
          if (decoded && (decoded.sub || decoded.id)) {
            const userId = decoded.sub || decoded.id;
            const role = decoded.role || 'User';
            client.data.userId = userId;
            client.data.role = role;

            if (['Admin', 'Manager', 'superadmin', 'admin'].includes(role)) {
              client.join('admin_products');
            }

            this.logger.log(`Product Socket Client connected: ${client.id} (User: ${userId}, Role: ${role})`);
            return;
          }
        } catch {
          // Token verification fallback to guest
        }
      }

      this.logger.log(`Product Socket Client connected (Guest): ${client.id}`);
    } catch (error) {
      this.logger.error(`Error in handleConnection for socket ${client.id}:`, error);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Product Socket Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_product_room')
  handleJoinProductRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { productId: number | string },
  ) {
    if (data?.productId) {
      const room = `product_${data.productId}`;
      client.join(room);
      this.logger.log(`Client ${client.id} joined room: ${room}`);
      return { status: 'success', room };
    }
  }

  @SubscribeMessage('leave_product_room')
  handleLeaveProductRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { productId: number | string },
  ) {
    if (data?.productId) {
      const room = `product_${data.productId}`;
      client.leave(room);
      this.logger.log(`Client ${client.id} left room: ${room}`);
      return { status: 'success', room };
    }
  }

  /**
   * Broadcast product created
   */
  emitProductCreated(product: any) {
    if (this.server) {
      this.logger.log(`Emitting product:created for product #${product?.id}`);
      this.server.emit('product:created', {
        action: 'created',
        product,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Broadcast product updated (includes price changes, variant changes, stock, images, etc.)
   */
  emitProductUpdated(product: any) {
    if (this.server) {
      this.logger.log(`Emitting product:updated for product #${product?.id}`);
      this.server.emit('product:updated', {
        action: 'updated',
        productId: Number(product?.id),
        product,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Broadcast product deleted
   */
  emitProductDeleted(productId: number) {
    if (this.server) {
      this.logger.log(`Emitting product:deleted for product #${productId}`);
      this.server.emit('product:deleted', {
        action: 'deleted',
        productId: Number(productId),
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Broadcast product status change (active / inactive)
   */
  emitProductStatusChanged(productId: number, status: boolean, product?: any) {
    if (this.server) {
      this.logger.log(`Emitting product:status_changed for product #${productId} -> ${status}`);
      this.server.emit('product:status_changed', {
        action: 'status_changed',
        productId: Number(productId),
        status: Boolean(status),
        product: product ?? null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Broadcast product/variant stock updated
   */
  emitProductStockUpdated(payload: {
    productId: number;
    variantId?: number;
    stock: number;
    totalStock?: number;
    product?: any;
  }) {
    if (this.server) {
      this.logger.log(
        `Emitting product:stock_updated for product #${payload.productId}, variant #${payload.variantId} -> stock: ${payload.stock}`,
      );
      this.server.emit('product:stock_updated', {
        action: 'stock_updated',
        productId: Number(payload.productId),
        variantId: payload.variantId ? Number(payload.variantId) : undefined,
        stock: Number(payload.stock),
        totalStock: payload.totalStock !== undefined ? Number(payload.totalStock) : undefined,
        product: payload.product ?? null,
        timestamp: new Date().toISOString(),
      });

      // Also emit product:updated if full product object is supplied
      if (payload.product) {
        this.server.emit('product:updated', {
          action: 'updated',
          productId: Number(payload.productId),
          product: payload.product,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
}
