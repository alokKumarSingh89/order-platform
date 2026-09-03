import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../database/database.module';

import { OutboxPublisherService } from './outbox-publisher.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
  ],

  providers: [OutboxPublisherService],

  exports: [OutboxPublisherService],
})
export class OutboxWorkerModule {}
