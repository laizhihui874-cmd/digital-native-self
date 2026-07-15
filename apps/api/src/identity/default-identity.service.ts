import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_USER_DISPLAY_NAME = "MVP User";
const DEFAULT_USER_TIMEZONE = "Asia/Shanghai";

@Injectable()
export class DefaultIdentityService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async getCurrentUserId(): Promise<string> {
    const userId = process.env.DEFAULT_USER_ID ?? DEFAULT_USER_ID;

    // MVP is single-user/local-first. Replace this with auth/Feishu identity resolution later.
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        displayName: process.env.DEFAULT_USER_DISPLAY_NAME ?? DEFAULT_USER_DISPLAY_NAME,
        timezone: process.env.DEFAULT_USER_TIMEZONE ?? DEFAULT_USER_TIMEZONE,
      },
    });

    return userId;
  }
}
