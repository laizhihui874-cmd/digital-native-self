import type { CreateAiConversationRequest, CreateAiMessageRequest, UpdateAiConversationRequest } from "@digital-self/shared";
import { Type } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";

import { ArchiveSearchContextDto } from "../../archive-search/dto/archive-search.dto";

export class CreateAiConversationDto implements CreateAiConversationRequest {
  @IsOptional() @IsString() @MaxLength(120)
  title?: string;
}

export class UpdateAiConversationDto implements UpdateAiConversationRequest {
  @IsString() @IsNotEmpty() @MaxLength(120)
  title!: string;
}

export class CreateAiMessageDto implements CreateAiMessageRequest {
  @IsString() @IsNotEmpty() @MaxLength(8000)
  content!: string;

  @IsOptional() @ValidateNested() @Type(() => ArchiveSearchContextDto)
  context?: ArchiveSearchContextDto;

  @IsOptional() @IsUUID()
  retryUserMessageId?: string;
}
