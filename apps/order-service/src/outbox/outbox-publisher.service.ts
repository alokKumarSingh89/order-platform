import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '@order-platform/database';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { OutboxEvent } from './outbox.types';

@Injectable()
export class OutboxPublisherService {
  private readonly logger = new Logger(OutboxPublisherService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly kafka: KafkaProducerService,
  ) {}
  private readonly batchSize = 10;

  private readonly maxAttempts = 5;

  async processBatch(): Promise<void> {
    const events = await this.claimEvents();
    if (events.length === 0) {
      return;
    }
    this.logger.log(`Claimed ${events.length} outbox events`);
    for (const event of events) {
      await this.publishEvent(event);
    }
  }

  async claimEvents(): Promise<OutboxEvent[]> {
    return this.db.$transaction(async (tx) => {
      const events = await tx.$queryRaw<OutboxEvent[]>`SELECT id,
          "eventType",
          "aggregateType",
          "aggregateId",
          payload,
          attempts 
          FROM "OutboxEvent"
          WHERE
          (
            status = 'PENDING'
            OR (
              status = 'FAILED'
              AND "nextAttemptAt" IS NOT NULL
              AND "nextAttemptAt" <= NOW()
            )
          ) 
          AND(
            status != 'PROCESSING'
            OR "lockedAt" < NOW() - INTERVAL '5 minutes'
          )
          ORDER BY "createdAt"
          LIMIT ${this.batchSize}
          FOR UPDATE SKIP LOCKED`;
      if (events.length === 0) {
        return [];
      }
      const ids = events.map((event) => event.id);
      await tx.$executeRaw`
          UPDATE "OutboxEvent"
          SET
            status = 'PROCESSING',
            "lockedAt" = NOW(),
            "attempts" = "attempts" + 1
          WHERE id = ANY(${ids})
        `;
      return events.map((event) => ({
        ...event,

        attempts: event.attempts + 1,
      }));
    });
  }
  private async publishEvent(event: OutboxEvent): Promise<void> {
    try {
      await this.kafka.publish(
        event.eventType,
        event.aggregateId,
        event.payload,
      );
      await this.markPublished(event.id);
      this.logger.log(`Published event=${event.id} type=${event.eventType}`);
    } catch (error) {
      await this.handleFailure(event, error);
    }
  }
  private async markPublished(eventId: string): Promise<void> {
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
  private async handleFailure(
    event: OutboxEvent,
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (event.attempts >= this.maxAttempts) {
      await this.moveToDeadLetter(event.id, message);
      return;
    }
    const delay = this.calculateBackoff(event.attempts);
    const nextAttemptAt = new Date(Date.now() + delay);
    await this.db.outboxEvent.updateMany({
      where: {
        id: event.id,
        status: 'PROCESSING',
      },
      data: {
        status: 'FAILED',
        lastError: message,
        nextAttemptAt,
        lockedAt: null,
      },
    });
    this.logger.warn(
      `Event ${event.id} failed. ` +
        `Attempt=${event.attempts}. ` +
        `RetryAt=${nextAttemptAt.toISOString()}`,
    );
  }
  private async moveToDeadLetter(
    eventId: string,
    error: string,
  ): Promise<void> {
    await this.db.outboxEvent.updateMany({
      where: {
        id: eventId,
        status: 'PROCESSING',
      },
      data: {
        status: 'DEAD',
        lastError: error,
        lockedAt: null,
      },
    });
    this.logger.error(`Event ${eventId} moved to DEAD_LETTER`);
  }
  private calculateBackoff(attempts: number): number {
    const baseDelay = 1000;
    const maxDelay = 60 * 1000;

    const delay = baseDelay * Math.pow(2, attempts - 1);
    return Math.min(delay, maxDelay);
  }
}
