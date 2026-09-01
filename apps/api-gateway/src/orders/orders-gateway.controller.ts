import { Body, Controller, Headers, Post } from '@nestjs/common';
import { OrdersGatewayService } from './orders-gateway.service';

@Controller('api/orders')
export class OrdersGatewayController {
  constructor(private readonly ordersGatewayService: OrdersGatewayService) {}

  @Post()
  async createOrder(
    @Body() body: unknown,
    @Headers('x-request-id')
    requestId: string,
  ) {
    return this.ordersGatewayService.createOrder(body, requestId);
  }
}
