import { Module } from '@nestjs/common';

import { PaymentModule } from '../payment/payment.module';

import { PaymentConsumer } from './payment.consumer';

@Module({
  imports: [PaymentModule],

  controllers: [PaymentConsumer],
})
export class KafkaModule {}
