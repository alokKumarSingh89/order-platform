import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '@order-platform/database';
import { KafkaProducerService } from '../kafka/kafka-producer.service';

@Injectable()
export class OutboxPublisherService {
  private readonly logger = new Logger(OutboxPublisherService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly kafka: KafkaProducerService,
  ) {}

  async processBatch() {
    const events = await this.db.outboxEvent.findMany({
      where: {
        status: 'PENDING',
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 10,
    });

    for (const event of events) {
      await this.publishEvent(event);
    }
  }

  private async publishEvent(event: {
    id: string;
    eventType: string;
    aggregateId: string;
    payload: unknown;
  }) {
    try {
      await this.kafka.publish(
        event.eventType,
        event.aggregateId,
        event.payload,
      );

      await this.db.outboxEvent.update({
        where: {
          id: event.id,
        },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });

      this.logger.log(`Published ${event.eventType} ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed ${event.id}`, error);
      await this.db.outboxEvent.update({
        where: {
          id: event.id,
        },
        data: {
          attempts: {
            increment: 1,
          },
          lastError: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
}
