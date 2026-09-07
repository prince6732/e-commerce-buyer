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
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        (client.handshake.headers?.authorization
          ? String(client.handshake.headers.authorization).replace('Bearer ', '')
          : null) ||
        client.handshake.query?.token;

      // Join global room by default
      client.join('global');

      if (token) {
        const secret = process.env.JWT_SECRET || 'secret';
        try {
          const decoded: any = jwt.verify(token as string, secret);
          if (decoded && (decoded.sub || decoded.id)) {
            const userId = decoded.sub || decoded.id;
            const role = decoded.role || 'User';

            // Join user room
            client.join(`user_${userId}`);
            client.data.userId = userId;
            client.data.role = role;

            // Join admin room if role is Admin or Manager
            if (['Admin', 'Manager', 'superadmin', 'admin'].includes(role)) {
              client.join('admin');
            }

            this.logger.log(`Client connected: ${client.id} (User: ${userId}, Role: ${role})`);
            return;
          }
        } catch (err) {
          // Token verification failed, fallback to guest connection
        }
      }

      this.logger.log(`Client connected (Guest): ${client.id}`);
    } catch (error) {
      this.logger.error(`Error in handleConnection for socket ${client.id}:`, error);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    if (data?.room) {
      client.join(data.room);
      this.logger.log(`Client ${client.id} explicitly joined room: ${data.room}`);
      return { status: 'success', room: data.room };
    }
  }

  emitToRoom(room: string, event: string, payload: any) {
    if (this.server) {
      this.server.to(room).emit(event, payload);
    }
  }

  emitToAll(event: string, payload: any) {
    if (this.server) {
      this.server.emit(event, payload);
    }
  }
}
