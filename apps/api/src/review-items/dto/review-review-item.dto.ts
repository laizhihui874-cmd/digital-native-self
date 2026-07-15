import type { ReviewReviewItemRequest } from "@digital-self/shared";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ReviewReviewItemDto implements ReviewReviewItemRequest {
  @IsIn(["confirmed", "rejected"])
  status!: ReviewReviewItemRequest["status"];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  note?: string;
}
