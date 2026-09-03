import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SagaWorkerModule } from './saga/saga-worker.module';

async function bootstrap() {
  const logger = new Logger('OrderSagaWorker');
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    SagaWorkerModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: process.env.KAFKA_CLIENT_ID ?? 'order-saga',

          brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
        },
        consumer: {
          groupId: 'order-saga-group',

          allowAutoTopicCreation: true,
        },
        run: {
          autoCommit: false,
        },
      },
    },
  );
  await app.listen();

  logger.log('Order Saga Kafka worker started');
}

bootstrap().catch(console.error);
