import { Controller, Get, Inject } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

type HealthPayload = {
  service: "ok";
  prisma: {
    configured: boolean;
    schemaSource: string;
  };
};

@Controller("health")
export class HealthController {
  private readonly prismaService: PrismaService;

  constructor(@Inject(PrismaService) prismaService: PrismaService) {
    this.prismaService = prismaService;
  }

  @Get()
  getHealth(): HealthPayload {
    return {
      service: "ok",
      prisma: {
        configured: this.prismaService.isDatabaseConfigured(),
        schemaSource: this.prismaService.getSchemaSource(),
      },
    };
  }
}
