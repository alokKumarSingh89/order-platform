import { Module } from '@nestjs/common';

import { KafkaModule } from '../kafka/kafka.module';

import { OutboxPublisherService } from './outbox-publisher.service';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { DatabaseModule } from '../database/database.module';

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
