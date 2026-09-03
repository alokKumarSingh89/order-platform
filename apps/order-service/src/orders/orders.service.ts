import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class OrdersService {
  constructor(private readonly db: DatabaseService) {}

  async createOrder(dto: CreateOrderDto) {
    const eventId = randomUUID();
    return this.db.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: BigInt(dto.userId),
          productId: BigInt(dto.productId),
          quantity: dto.quantity,
          status: 'PENDING',
          totalAmount: dto.totalAmount,
        },
      });
      await tx.outboxEvent.create({
        data: {
          id: eventId,
          eventType: 'order.created',
          aggregateType: 'Order',
          aggregateId: order.id.toString(),
          payload: {
            eventId,
            orderId: order.id.toString(),
            userId: dto.userId,
            productId: dto.productId,
            quantity: dto.quantity,
            totalAmount: dto.totalAmount,
          },
        },
      });
      return order;
    });
  }
}
