import { Module } from '@nestjs/common';

import { OrdersGatewayController } from './orders-gateway.controller';

import { OrdersGatewayService } from './orders-gateway.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [OrdersGatewayController],
  providers: [OrdersGatewayService],
})
export class OrdersGatewayModule {}
