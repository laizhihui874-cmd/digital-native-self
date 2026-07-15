import { Module } from "@nestjs/common";

import { WeeklyReviewsController } from "./weekly-reviews.controller";
import { WeeklyReviewsRepository } from "./weekly-reviews.repository";
import { WeeklyReviewsService } from "./weekly-reviews.service";

@Module({
  controllers: [WeeklyReviewsController],
  providers: [WeeklyReviewsRepository, WeeklyReviewsService],
})
export class WeeklyReviewsModule {}
