import type { BulkReviewItemsRequest, ReviewItemKind } from "@digital-self/shared";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";

class BulkReviewItemDto {
  @IsIn(["proposal", "memory", "ability_evidence"])
  kind!: ReviewItemKind;

  @IsUUID()
  id!: string;

  @IsOptional() @IsString() @MaxLength(300)
  title?: string;

  @IsOptional() @IsString() @MaxLength(20_000)
  content?: string;
}

export class BulkReviewItemsDto implements BulkReviewItemsRequest {
  @IsIn(["confirmed", "rejected"])
  status!: "confirmed" | "rejected";

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => BulkReviewItemDto)
  items!: BulkReviewItemDto[];

  @IsOptional() @IsString() @MaxLength(1_000)
  note?: string;
}
