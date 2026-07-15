import type { CreatePersonRequest } from "@digital-self/shared";
import { IsISO8601, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreatePersonDto implements CreatePersonRequest {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(120) relationship?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsISO8601({ strict: true }) firstMetAt?: string;
}
