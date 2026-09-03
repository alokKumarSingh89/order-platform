import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { OutboxWorkerModule } from './outbox/outbox-worker.module';
import { OutboxPublisherService } from './outbox/outbox-publisher.service';

async function bootstrap() {
  const logger = new Logger('PaymentOutboxWorker');

  const app = await NestFactory.createApplicationContext(OutboxWorkerModule);
  const publisher = app.get(OutboxPublisherService);

  await publisher.start();

  logger.log('Payment outbox worker started');
  const shutdown = async () => {
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
        'Payment outbox batch failed',
        error instanceof Error ? error.stack : String(error),
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
bootstrap().catch(console.error);
