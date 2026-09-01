import { Module } from '@nestjs/common';

import { DatabaseModule } from '@order-platform/database';

import { KafkaModule } from '../kafka/kafka.module';

import { OutboxPublisherService } from './outbox-publisher.service';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(process.cwd(), '.env'),
    }),
    DatabaseModule,
    KafkaModule,
  ],

  providers: [OutboxPublisherService],

  exports: [OutboxPublisherService],
})
export class OutboxWorkerModule {}
