import { Module } from "@nestjs/common";

import { MemoriesController } from "./memories.controller";
import { MemoriesRepository } from "./memories.repository";
import { MemoriesService } from "./memories.service";

@Module({
  controllers: [MemoriesController],
  providers: [MemoriesRepository, MemoriesService],
  exports: [MemoriesRepository, MemoriesService],
})
export class MemoriesModule {}
