import type { BulkReviewItemsResponse, ListReviewItemsResponse, ReviewItem, ReviewItemKind } from "@digital-self/shared";
import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, ValidationPipe } from "@nestjs/common";

import { BulkReviewItemsDto } from "./dto/bulk-review-items.dto";
import { ListReviewItemsQueryDto } from "./dto/list-review-items-query.dto";
import { ReviewReviewItemDto } from "./dto/review-review-item.dto";
import { ReviewItemsService } from "./review-items.service";

const validationPipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

@Controller("review-items")
export class ReviewItemsController {
  constructor(@Inject(ReviewItemsService) private readonly service: ReviewItemsService) {}

  @Get()
  list(@Query(validationPipe) query: ListReviewItemsQueryDto): Promise<ListReviewItemsResponse> {
    return this.service.list(query);
  }

  @Patch(":kind/:id")
  review(
    @Param("kind") kind: ReviewItemKind,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(validationPipe) body: ReviewReviewItemDto,
  ): Promise<ReviewItem> {
    return this.service.review(kind, id, body);
  }

  @Post("bulk-review")
  bulkReview(@Body(validationPipe) body: BulkReviewItemsDto): Promise<BulkReviewItemsResponse> {
    return this.service.bulkReview(body);
  }

  @Post(":kind/:id/undo")
  undo(@Param("kind") kind: ReviewItemKind, @Param("id", new ParseUUIDPipe()) id: string): Promise<ReviewItem> {
    return this.service.undo(kind, id);
  }
}
