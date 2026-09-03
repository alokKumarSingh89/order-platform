import { Logger } from '@nestjs/common';

import { NestFactory } from '@nestjs/core';

import { OutboxWorkerModule } from './outbox/outbox-worker.module';

import { OutboxPublisherService } from './outbox/outbox-publisher.service';

async function bootstrap() {
  const logger = new Logger('InventoryOutboxWorker');
  const app = await NestFactory.createApplicationContext(OutboxWorkerModule);

  const publisher = app.get(OutboxPublisherService);

  await publisher.start();

  logger.log('Inventory outbox worker started');

  const shutdown = async () => {
    logger.log('Shutting down inventory outbox worker...');

    await publisher.stop();

    await app.close();

    process.exit(0);
  };

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  process.on('SIGTERM', shutdown);

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  process.on('SIGINT', shutdown);

  while (true) {
    try {
      await publisher.processBatch();
    } catch (error) {
      logger.error(
        'Inventory outbox batch failed',
        error instanceof Error ? error.stack : String(error),
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

bootstrap();
