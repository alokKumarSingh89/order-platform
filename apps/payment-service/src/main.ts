import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const logger = new Logger('PaymentWorker');
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: process.env.KAFKA_CLIENT_ID ?? 'payment-service',
          brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
        },
        consumer: {
          groupId: process.env.KAFKA_CONSUMER_GROUP ?? 'payment-service-group',
          allowAutoTopicCreation: false,
        },
        run: {
          autoCommit: false,
        },
      },
    },
  );
  await app.listen();
  logger.log('Payment Kafka worker started');
}
bootstrap().catch(console.error);
