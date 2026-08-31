import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@order-platform/database';

@Injectable()
export class AppService {
  constructor(private readonly db: DatabaseService) {}
  async getHello() {
    await this.db.$queryRaw`SELECT 1`;

    return {
      service: 'order-service',
      database: 'connected',
    };
  }
}
