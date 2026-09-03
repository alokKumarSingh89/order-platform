import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { randomUUID } from 'node:crypto';

export interface InventoryReservedEvent {
  eventId: string;
  orderId: string;
  productId: string;
  quantity: number;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly consumerName = 'payment-service';
  constructor(private readonly db: DatabaseService) {}

  processInventoryReserved(event: InventoryReservedEvent) {
    return this.db.$transaction(async (tx) => {
      /*
       * 1. Idempotency
       */
      const processed = await tx.$queryRaw<{ eventId: string }[]>`
            INSERT INTO "ProcessedEvent"
              ("id", "eventId", "consumer")
            VALUES
              (
                ${randomUUID()},
                ${event.eventId},
                ${this.consumerName}
              )
            ON CONFLICT ("eventId", "consumer")
            DO NOTHING
            RETURNING "eventId";
          `;
      if (processed.length === 0) {
        this.logger.log(`Duplicate payment event ignored: ${event.eventId}`);
        return {
          duplicate: true,
        };
      }

      /*
       * 2. Check whether payment already exists.
       */
      const existing = await tx.payment.findUnique({
        where: {
          orderId: event.orderId,
        },
      });
      if (existing) {
        return {
          duplicate: true,
          paymentId: existing.id,
        };
      }
      /*
       * 3. Calculate payment amount.
       *
       * For this learning project we simulate
       * payment processing.
       */
      const amount = this.calculateAmount(event);
      /*
       * 4. Simulate payment provider.
       */
      const paymentSuccessful = this.simulatePayment(event);
      if (!paymentSuccessful) {
        const payment = await tx.payment.create({
          data: {
            orderId: event.orderId,
            amount,
            status: 'FAILED',
            failureReason: 'PAYMENT_DECLINED',
          },
        });
        /*
         * 5. Payment failed.
         *
         * Still write Outbox in same transaction.
         */
        await tx.outboxEvent.create({
          data: {
            id: randomUUID(),
            eventType: 'payment.failed',
            aggregateType: 'Payment',
            aggregateId: event.orderId,
            payload: {
              eventId: event.eventId,
              orderId: event.orderId,
              paymentId: payment.id,
              reason: 'PAYMENT_DECLINED',
            },
          },
        });
        return {
          success: false,
          paymentId: payment.id,
        };
      }
      /*
       * 6. Payment succeeded.
       */
      const payment = await tx.payment.create({
        data: {
          orderId: event.orderId,
          amount,
          status: 'COMPLETED',
        },
      });
      await tx.outboxEvent.create({
        data: {
          id: randomUUID(),
          eventType: 'payment.completed',

          aggregateType: 'Payment',

          aggregateId: event.orderId,

          payload: {
            eventId: event.eventId,
            orderId: event.orderId,
            paymentId: payment.id,
            amount: amount.toString(),
          },
        },
      });
      this.logger.log(`Payment completed for order ${event.orderId}`);
      return {
        success: true,
        paymentId: payment.id,
      };
    });
  }
  private calculateAmount(event: InventoryReservedEvent) {
    /*
     * Demo only.
     *
     * In the real application the payment
     * amount should come from the Order event
     * rather than recalculating it here.
     */
    return event.quantity * 100;
  }
  private simulatePayment(event: InventoryReservedEvent) {
    /*
     * For now:
     *
     * productId ending in 999
     * = payment failure.
     *
     * Everything else succeeds.
     */
    return !event.productId.endsWith('999');
  }
}
