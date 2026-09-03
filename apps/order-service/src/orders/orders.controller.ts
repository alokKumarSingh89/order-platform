import { Body, Controller, Post } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    const order = await this.ordersService.createOrder(dto);

    return {
      id: order.id.toString(),
      userId: order.userId.toString(),
      productId: order.productId.toString(),
      quantity: order.quantity,
      status: order.status,
      totalAmount: order.totalAmount.toString(),
      createdAt: order.createdAt,
    };
  }
}
