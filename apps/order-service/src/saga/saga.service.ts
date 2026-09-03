import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '../generated/prisma/client';
import { randomUUID } from 'node:crypto';

@Injectable()
export class SagaService {
  private readonly logger = new Logger(SagaService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * ---------------------------------------------------------
   * Helper: mark Kafka event as processed
   * ---------------------------------------------------------
   *
   * Returns:
   *   true  -> first time we see this event
   *   false -> duplicate event
   */
  private async markProcessed(
    tx: Prisma.TransactionClient,
    eventId: string,
    consumer: string,
  ): Promise<boolean> {
    const result = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO "ProcessedEvent"
        ("id", "eventId", "consumer")
      VALUES
        (${randomUUID()}, ${eventId}, ${consumer})
      ON CONFLICT ("eventId", "consumer")
      DO NOTHING
      RETURNING "id"
    `;
    return result.length > 0;
  }

  /**
   * ---------------------------------------------------------
   * inventory.reserved
   * ---------------------------------------------------------
   *
   * Inventory successfully reserved stock.
   *
   * Next Saga step:
   *
   *     payment.requested
   */
  async handleInventoryReserved(event: {
    eventId: string;
    orderId: string;
    productId: string;
    quantity: number;
  }) {
    await this.db.$transaction(async (tx) => {
      const firstTime = await this.markProcessed(
        tx,
        event.eventId,
        'order-saga',
      );

      if (!firstTime) {
        this.logger.log(
          `Duplicate inventory.reserved ignored: ${event.eventId}`,
        );

        return;
      }
      const orderId = BigInt(event.orderId);
      const order = await tx.order.findUnique({
        where: {
          id: orderId,
        },
      });
      if (!order) {
        throw new Error(`Order ${event.orderId} not found`);
      }
      /**
       * If the order is already completed/cancelled,
       * don't continue the Saga.
       */
      if (order.status !== 'PENDING') {
        this.logger.warn(
          `Order ${event.orderId} is ${order.status}; skipping payment`,
        );

        return;
      }
      /**
       * Generate the Outbox ID ourselves.
       *
       * This ID becomes the eventId of payment.requested.
       */
      const paymentEventId = randomUUID();
      await tx.outboxEvent.create({
        data: {
          id: paymentEventId,
          eventType: 'payment.requested',
          aggregateType: 'Order',
          aggregateId: order.id.toString(),
          payload: {
            eventId: paymentEventId,
            orderId: order.id.toString(),
            productId: order.productId.toString(),
            quantity: order.quantity,
            amount: order.totalAmount.toString(),
          },
        },
      });
      this.logger.log(
        `Order ${event.orderId}: inventory reserved -> payment requested`,
      );
    });
  }
  /**
   * ---------------------------------------------------------
   * inventory.rejected
   * ---------------------------------------------------------
   *
   * Inventory couldn't reserve stock.
   *
   * Saga ends:
   *
   *     Order -> CANCELLED
   */
  async handleInventoryRejected(event: {
    eventId: string;
    orderId: string;
    reason?: string;
  }) {
    await this.db.$transaction(async (tx) => {
      const firstTime = await this.markProcessed(
        tx,
        event.eventId,
        'order-saga',
      );
      if (!firstTime) {
        this.logger.log(
          `Duplicate inventory.rejected ignored: ${event.eventId}`,
        );

        return;
      }

      const orderId = BigInt(event.orderId);

      const order = await tx.order.findUnique({
        where: {
          id: orderId,
        },
      });

      if (!order) {
        throw new Error(`Order ${event.orderId} not found`);
      }

      if (order.status !== 'PENDING') {
        return;
      }
      await tx.order.update({
        where: {
          id: orderId,
        },
        data: {
          status: 'CANCELLED',
        },
      });

      const cancelEventId = randomUUID();
      await tx.outboxEvent.create({
        data: {
          id: cancelEventId,
          eventType: 'order.cancelled',
          aggregateType: 'Order',
          aggregateId: order.id.toString(),
          payload: {
            eventId: cancelEventId,
            orderId: order.id.toString(),
            reason: event.reason ?? 'INVENTORY_UNAVAILABLE',
          },
        },
      });

      this.logger.log(
        `Order ${event.orderId}: inventory rejected -> cancelled`,
      );
    });
  }
  /**
   * ---------------------------------------------------------
   * payment.completed
   * ---------------------------------------------------------
   *
   * Payment succeeded.
   *
   * Saga ends successfully:
   *
   *     Order -> CONFIRMED
   */
  async handlePaymentCompleted(event: {
    eventId: string;
    orderId: string;
    paymentId: string;
    amount: string;
  }) {
    await this.db.$transaction(async (tx) => {
      const firstTime = await this.markProcessed(
        tx,
        event.eventId,
        'order-saga',
      );

      if (!firstTime) {
        this.logger.log(
          `Duplicate payment.completed ignored: ${event.eventId}`,
        );

        return;
      }

      const orderId = BigInt(event.orderId);

      const order = await tx.order.findUnique({
        where: {
          id: orderId,
        },
      });

      if (!order) {
        throw new Error(`Order ${event.orderId} not found`);
      }

      if (order.status !== 'PENDING') {
        return;
      }
      await tx.order.update({
        where: {
          id: orderId,
        },
        data: {
          status: 'CONFIRMED',
        },
      });

      const confirmedEventId = randomUUID();
      await tx.outboxEvent.create({
        data: {
          id: confirmedEventId,
          eventType: 'order.confirmed',
          aggregateType: 'Order',
          aggregateId: order.id.toString(),
          payload: {
            eventId: confirmedEventId,
            orderId: order.id.toString(),
            paymentId: event.paymentId,
            amount: event.amount,
          },
        },
      });

      this.logger.log(`Order ${event.orderId}: payment completed -> confirmed`);
    });
  }
  /**
   * ---------------------------------------------------------
   * payment.failed
   * ---------------------------------------------------------
   *
   * Payment failed AFTER inventory was already reserved.
   *
   * We therefore need compensation.
   *
   * Next Saga step:
   *
   *     inventory.release.requested
   */
  async handlePaymentFailed(event: {
    eventId: string;
    orderId: string;
    paymentId: string;
    reason: string;
  }) {
    await this.db.$transaction(async (tx) => {
      const firstTime = await this.markProcessed(
        tx,
        event.eventId,
        'order-saga',
      );

      if (!firstTime) {
        this.logger.log(`Duplicate payment.failed ignored: ${event.eventId}`);

        return;
      }

      const orderId = BigInt(event.orderId);

      const order = await tx.order.findUnique({
        where: {
          id: orderId,
        },
      });

      if (!order) {
        throw new Error(`Order ${event.orderId} not found`);
      }

      if (order.status !== 'PENDING') {
        return;
      }

      /**
       * We don't immediately mark CANCELLED.
       *
       * Inventory is still reserved.
       *
       * We first ask Inventory to release it.
       */
      const releaseEventId = randomUUID();

      await tx.outboxEvent.create({
        data: {
          id: releaseEventId,

          eventType: 'inventory.release.requested',

          aggregateType: 'Order',

          aggregateId: order.id.toString(),

          payload: {
            eventId: releaseEventId,

            orderId: order.id.toString(),

            productId: order.productId.toString(),

            quantity: order.quantity,

            reason: event.reason,
          },
        },
      });

      this.logger.warn(
        `Order ${event.orderId}: payment failed -> inventory release requested`,
      );
    });
  }
  /**
   * ---------------------------------------------------------
   * inventory.released
   * ---------------------------------------------------------
   *
   * Compensation completed.
   *
   * Now the Saga can finally cancel the order.
   */
  async handleInventoryReleased(event: {
    eventId: string;
    orderId: string;
    productId: string;
    quantity: number;
  }) {
    await this.db.$transaction(async (tx) => {
      const firstTime = await this.markProcessed(
        tx,
        event.eventId,
        'order-saga',
      );

      if (!firstTime) {
        this.logger.log(
          `Duplicate inventory.released ignored: ${event.eventId}`,
        );

        return;
      }

      const orderId = BigInt(event.orderId);

      const order = await tx.order.findUnique({ where: { id: orderId } });

      if (!order) {
        throw new Error(`Order ${event.orderId} not found`);
      }

      if (order.status !== 'PENDING') {
        return;
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      });

      const cancelEventId = randomUUID();

      await tx.outboxEvent.create({
        data: {
          id: cancelEventId,
          eventType: 'order.cancelled',
          aggregateType: 'Order',
          aggregateId: order.id.toString(),
          payload: {
            eventId: cancelEventId,
            orderId: order.id.toString(),
            reason: 'PAYMENT_FAILED',
          },
        },
      });

      this.logger.log(
        `Order ${event.orderId}: inventory released -> cancelled`,
      );
    });
  }
}
