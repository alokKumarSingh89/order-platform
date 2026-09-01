import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OrdersGatewayService {
  private readonly orderServiceUrl: string;
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.orderServiceUrl = this.config.getOrThrow<string>('services.order');
  }

  async createOrder(payload: unknown, requestId: string) {
    try {
      const response = await firstValueFrom(
        this.http.post(`${this.orderServiceUrl}/orders`, payload, {
          headers: {
            'x-request-id': requestId,
          },
        }),
      );

      return response.data as unknown;
    } catch (error) {
      console.error('Order service request failed', error);
      throw new ServiceUnavailableException('Order service unavailable');
    }
  }
}
