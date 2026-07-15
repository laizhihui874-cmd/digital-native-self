import type { CreateResumeDocumentTextRequest } from "@digital-self/shared";
import { Transform } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class CreateResumeDocumentTextDto implements CreateResumeDocumentTextRequest {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  title?: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
