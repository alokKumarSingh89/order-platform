import { Controller, Logger } from '@nestjs/common';
import { SagaService } from './saga.service';
import { Ctx, EventPattern, KafkaContext } from '@nestjs/microservices';

@Controller()
export class SagaConsumer {
  private readonly logger = new Logger(SagaConsumer.name);

  constructor(private readonly sagaService: SagaService) {}

  @EventPattern('inventory.reserved')
  async handleInventoryReserved(event: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received inventory.reserved');

    await this.sagaService.handleInventoryReserved(event);

    await this.commitOffset(context);
  }

  @EventPattern('inventory.rejected')
  async handleInventoryRejected(event: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received inventory.rejected');

    await this.sagaService.handleInventoryRejected(event);

    await this.commitOffset(context);
  }
  @EventPattern('payment.completed')
  async handlePaymentCompleted(event: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received payment.completed');

    await this.sagaService.handlePaymentCompleted(event);

    await this.commitOffset(context);
  }

  @EventPattern('payment.failed')
  async handlePaymentFailed(event: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received payment.failed');

    await this.sagaService.handlePaymentFailed(event);

    await this.commitOffset(context);
  }

  @EventPattern('inventory.released')
  async handleInventoryReleased(event: any, @Ctx() context: KafkaContext) {
    this.logger.log('Received inventory.released');

    await this.sagaService.handleInventoryReleased(event);

    await this.commitOffset(context);
  }
  private async commitOffset(context: KafkaContext) {
    const message = context.getMessage();
    const partition = context.getPartition();

    const topic = context.getTopic();

    const offset = BigInt(message.offset);

    const nextOffset = (offset + 1n).toString();

    const consumer = context.getConsumer();
    await consumer.commitOffsets([
      {
        topic,
        partition,
        offset: nextOffset,
      },
    ]);
  }
}
