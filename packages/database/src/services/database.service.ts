import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly adapter: PrismaPg;

  constructor(private readonly config: ConfigService) {
    console.log(config);
    const connectionString = config.get<string>("ORDER_DATABASE_URL");
    if (!connectionString) {
      throw new Error("ORDER_DATABASE_URL is not defined");
    }
    const adapter = new PrismaPg({
      connectionString,
    });
    super({
      adapter,
    });
    this.adapter = adapter;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
