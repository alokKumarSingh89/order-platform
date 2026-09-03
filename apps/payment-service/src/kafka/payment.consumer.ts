import { Controller, Logger } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  KafkaContext,
  Payload,
} from '@nestjs/microservices';
import {
  type InventoryReservedEvent,
  PaymentService,
} from '../payment/payment.service';

@Controller()
export class PaymentConsumer {
  private readonly logger = new Logger(PaymentConsumer.name);

  constructor(private readonly paymentService: PaymentService) {}

  @EventPattern('inventory.reserved')
  async handleInventoryReserved(
    @Payload() payload: InventoryReservedEvent,
    @Ctx() context: KafkaContext,
  ) {
    const message = context.getMessage();

    const topic = context.getTopic();

    const partition = context.getPartition();

    const offset = message.offset;
    this.logger.log(
      `Received inventory.reserved topic=${topic} partition=${partition} offset=${offset}`,
    );
    try {
      await this.paymentService.processInventoryReserved(payload);
      const nextOffset = (BigInt(offset) + 1n).toString();
      const consumer = context.getConsumer();
      await consumer.commitOffsets([
        {
          topic,
          partition,
          offset: nextOffset,
        },
      ]);
      this.logger.log(`Committed payment offset ${nextOffset}`);
    } catch (error) {
      this.logger.error(
        `Payment processing failed for offset=${offset}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }
}
