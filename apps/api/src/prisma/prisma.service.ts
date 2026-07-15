import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient {
  getSchemaSource(): string {
    return "packages/shared/prisma/schema.prisma";
  }

  isDatabaseConfigured(): boolean {
    return Boolean(process.env.DATABASE_URL);
  }
}
