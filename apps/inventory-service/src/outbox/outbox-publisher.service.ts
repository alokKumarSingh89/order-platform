import { Inject, Injectable, Logger } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';
import { OutboxEvent } from './outbox.types';

@Injectable()
export class OutboxPublisherService {
  private readonly logger = new Logger(OutboxPublisherService.name);

  private readonly producer: Producer;

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {
    const kafka = new Kafka({
      clientId: 'inventory-outbox-worker',
      brokers: [this.config.getOrThrow<string>('KAFKA_BROKER')],
    });
    this.producer = kafka.producer();
  }

  async start() {
    await this.producer.connect();

    this.logger.log('Inventory outbox Kafka producer connected');
  }

  async stop() {
    await this.producer.disconnect();
  }
  async processBatch() {
    const events = await this.claimEvents();

    if (events.length === 0) {
      return;
    }
    for (const event of events) {
      try {
        await this.publish(event);
        await this.markPublished(event.id);
      } catch (error) {
        await this.handleFailure(event, error);
      }
    }
  }
  private async claimEvents(): Promise<OutboxEvent[]> {
    return this.db.$transaction(async (tx) => {
      const events = await tx.$queryRaw<OutboxEvent[]>`
        SELECT
            "id",
            "eventType",
            "aggregateType",
            "aggregateId",
            "payload",
            "attempts"
        FROM "OutboxEvent"
        WHERE
            (
                "status" = 'PENDING'
                OR (
                  "status" = 'FAILED'
                  AND "nextAttemptAt" IS NOT NULL
                  AND "nextAttemptAt" <= NOW()
                )
            )
        ORDER BY "createdAt"
        LIMIT 10
        FOR UPDATE SKIP LOCKED;
    `;
      for (const event of events) {
        await tx.$executeRaw`
            UPDATE "OutboxEvent"
            SET
              "status" = 'PROCESSING',
              "lockedAt" = NOW(),
              "attempts" = "attempts" + 1,
              "updatedAt" = NOW()
            WHERE "id" = ${event.id};
          `;
      }
      return events.map((event) => ({
        ...event,
        attempts: event.attempts + 1,
      }));
    });
  }

  private async publish(event: OutboxEvent) {
    await this.producer.send({
      topic: event.eventType,
      messages: [
        {
          key: event.aggregateId,
          value: JSON.stringify(event.payload),
        },
      ],
    });
    this.logger.log(`Published ${event.eventType} ${event.id}`);
  }
  private async markPublished(eventId: string) {
    await this.db.outboxEvent.updateMany({
      where: {
        id: eventId,
        status: 'PROCESSING',
      },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        lockedAt: null,
      },
    });
  }
  private async handleFailure(event: OutboxEvent, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (event.attempts >= 5) {
      await this.db.outboxEvent.update({
        where: {
          id: event.id,
        },

        data: {
          status: 'DEAD_LETTER',
          lastError: message,
          lockedAt: null,
        },
      });
      this.logger.error(`Event moved to DEAD_LETTER: ${event.id}`);

      return;
    }
    const delaySeconds = Math.pow(2, event.attempts - 1);

    const nextAttemptAt = new Date(Date.now() + delaySeconds * 1000);
    await this.db.outboxEvent.update({
      where: {
        id: event.id,
      },

      data: {
        status: 'FAILED',
        lastError: message,
        nextAttemptAt,
        lockedAt: null,
      },
    });
    this.logger.warn(`Retry scheduled for ${event.id} in ${delaySeconds}s`);
  }
}
