import { Controller, Logger } from '@nestjs/common';
import {
  InventoryService,
  type OrderCreatedEvent,
} from '../inventory/inventory.service';
import {
  Ctx,
  EventPattern,
  KafkaContext,
  Payload,
} from '@nestjs/microservices';

@Controller()
export class InventoryConsumer {
  private readonly logger = new Logger(InventoryConsumer.name);

  constructor(private readonly inventoryService: InventoryService) {}

  @EventPattern('order.created')
  async handleOrderCreated(
    @Payload() payload: OrderCreatedEvent,
    @Ctx() context: KafkaContext,
  ) {
    const message = context.getMessage();
    const topic = context.getTopic();
    const partition = context.getPartition();
    const offset = message.offset;

    this.logger.log(
      `Received order.created topic=${topic} partition=${partition} offset=${offset}`,
    );

    try {
      await this.inventoryService.processOrderCreated(payload);
      /*
       * KafkaJS commits the NEXT offset.
       *
       * If current offset is 10,
       * commit 11.
       */
      const nextOffset = (BigInt(offset) + 1n).toString();
      const consumer = context.getConsumer();
      await consumer.commitOffsets([
        {
          topic,
          partition,
          offset: nextOffset,
        },
      ]);
      this.logger.log(`Committed Kafka offset ${nextOffset}`);
    } catch (error) {
      this.logger.error(
        `Failed processing order.created offset=${offset}`,
        error instanceof Error ? error.stack : String(error),
      );
      /*
       * Don't commit the offset.
       *
       * Kafka can deliver the event again.
       */
      throw error;
    }
  }
}
