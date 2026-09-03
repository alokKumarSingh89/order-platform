import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { randomUUID } from 'node:crypto';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async createOrder(
    @Body() body: CreateOrderDto,
    @Headers('x-request-id')
    requestId?: string,
  ) {
    return this.ordersService.createOrder(body, requestId ?? randomUUID());
  }
  @Get(':id')
  async getOrder(
    @Param('id') id: string,
    @Headers('x-request-id')
    requestId?: string,
  ) {
    return this.ordersService.getOrder(id, requestId ?? randomUUID());
  }
}
