import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface CreateOrderRequest {
  userId: string;
  productId: string;
  quantity: number;
  totalAmount: string;
}

@Injectable()
export class OrdersService {
  private readonly orderServiceUrl: string;
  private readonly logger = new Logger(OrdersService.name);
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.orderServiceUrl = this.config.getOrThrow<string>('services.order');
  }

  async createOrder(payload, requestId: string) {
    try {
      const response = await firstValueFrom(
        this.http.post(`${this.orderServiceUrl}/orders`, payload, {
          headers: {
            'x-request-id': requestId,
          },
        }),
      );

      return response.data as unknown;
    } catch (error: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
        this.logger.error(`Order service timeout: ${requestId}`);

        throw new RequestTimeoutException('Order service timeout');
      }

      this.logger.error(`Order service unavailable: ${requestId}`);
      this.logger.error(error);
      throw new BadGatewayException('Order service unavailable');
    }
  }
  async getOrder(orderId: string, requestId: string) {
    try {
      const response = await firstValueFrom(
        this.http.get(`${this.orderServiceUrl}/orders/${orderId}`, {
          headers: {
            'x-request-id': requestId,
          },
        }),
      );

      return response.data as unknown;
    } catch (error: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
        throw new RequestTimeoutException('Order service timeout');
      }
      throw new BadGatewayException('Order service unavailable');
    }
  }
}
