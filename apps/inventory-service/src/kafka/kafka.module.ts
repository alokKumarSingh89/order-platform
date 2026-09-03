import { Module } from '@nestjs/common';
import { InventoryConsumer } from './inventory.consumer';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [InventoryConsumer],
})
export class KafkaModule {}
