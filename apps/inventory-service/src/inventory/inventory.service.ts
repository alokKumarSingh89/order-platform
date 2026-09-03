import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { randomUUID } from 'node:crypto';

export interface OrderCreatedEvent {
  eventId: string;
  orderId: string;
  userId: string;
  productId: string;
  quantity: number;
  totalAmount: string;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  private readonly consumerName = 'inventory-service';

  constructor(private readonly db: DatabaseService) {}
  async processOrderCreated(event: OrderCreatedEvent) {
    return this.db.$transaction(async (tx) => {
      /*
       * STEP 1
       * Idempotency check
       *
       * We use ON CONFLICT DO NOTHING because
       * PostgreSQL transactions cannot safely continue
       * after a unique constraint exception.
       */
      this.logger.debug(event);
      const processed = await tx.$queryRaw<{ eventId: string }[]>`
        INSERT INTO "ProcessedEvent" ("id", "eventId", "consumer")
        VALUES(${randomUUID()},${event.eventId},${this.consumerName})
        ON CONFLICT ("eventId", "consumer")
        DO NOTHING
        RETURNING "eventId";
      `;

      /*
       * Event was already processed.
       */
      if (processed.length === 0) {
        this.logger.log(`Duplicate event ignored: ${event.eventId}`);
        return {
          duplicate: true,
        };
      }

      /*
       * STEP 2
       * Lock inventory row.
       *
       * FOR UPDATE prevents two concurrent
       * reservations from modifying the same
       * inventory row at the same time.
       */
      const inventory = await tx.$queryRaw<
        {
          id: bigint;
          productId: bigint;
          quantity: number;
          reserved: number;
        }[]
      >`SELECT
            "id",
            "productId",
            "quantity",
            "reserved"
          FROM "Inventory"
          WHERE "productId" = ${BigInt(event.productId)}
          FOR UPDATE;
      `;

      /*
       * Product does not exist.
       */
      if (inventory.length === 0) {
        await this.createRejectedEvent(tx, event, 'PRODUCT_NOT_FOUND');

        return {
          success: false,
          reason: 'PRODUCT_NOT_FOUND',
        };
      }

      const item = inventory[0];

      const available = item.quantity - item.reserved;

      /*
       * STEP 3
       * Check available stock.
       */
      if (available < event.quantity) {
        await this.createRejectedEvent(tx, event, 'INSUFFICIENT_STOCK');

        this.logger.warn(`Insufficient stock for product ${event.productId}`);

        return {
          success: false,
          reason: 'INSUFFICIENT_STOCK',
        };
      }

      /*
       * STEP 4
       * Reserve stock.
       */
      await tx.$executeRaw`
        UPDATE "Inventory"
        SET
          "reserved" = "reserved" + ${event.quantity},
          "updatedAt" = NOW()
        WHERE "id" = ${item.id};
      `;

      /*
       * STEP 5
       * Write an Outbox event in the SAME transaction.
       */
      await tx.outboxEvent.create({
        data: {
          id: randomUUID(),
          eventType: 'inventory.reserved',
          aggregateType: 'Inventory',
          aggregateId: event.orderId,

          payload: {
            eventId: event.eventId,
            orderId: event.orderId,
            productId: event.productId,
            quantity: event.quantity,
          },
        },
      });
      this.logger.log(`Inventory reserved for order ${event.orderId}`);

      return {
        success: true,
      };
    });
  }

  private async createRejectedEvent(
    tx: any,
    event: OrderCreatedEvent,
    reason: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await tx.outboxEvent.create({
      data: {
        id: randomUUID(),
        eventType: 'inventory.rejected',
        aggregateType: 'Inventory',
        aggregateId: event.orderId,

        payload: {
          eventId: event.eventId,
          orderId: event.orderId,
          productId: event.productId,
          quantity: event.quantity,
          reason,
        },
      },
    });
  }
}
