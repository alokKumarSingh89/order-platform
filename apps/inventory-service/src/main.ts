import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('InventoryWorker');
  console.log('WORKER ENV:', {
    NODE_ENV: process.env.NODE_ENV,
    KAFKA_BROKER: process.env.KAFKA_BROKER,
    KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID,
    KAFKA_CONSUMER_GROUP: process.env.KAFKA_CONSUMER_GROUP,
  });
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: process.env.KAFKA_CLIENT_ID ?? 'inventory-service',
          brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
        },
        consumer: {
          groupId:
            process.env.KAFKA_CONSUMER_GROUP ?? 'inventory-service-group',
          allowAutoTopicCreation: false,
        },
        run: {
          autoCommit: false,
        },
      },
    },
  );
  await app.listen();
  logger.log('Inventory Kafka worker started');
}

bootstrap().catch(console.error);
