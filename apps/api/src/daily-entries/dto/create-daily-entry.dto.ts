import type { CreateDailyEntryRequest } from "@digital-self/shared";
import { dailyEntrySourceValues } from "@digital-self/shared";
import { Transform } from "class-transformer";
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateDailyEntryDto implements CreateDailyEntryRequest {
  @IsOptional()
  @IsIn(dailyEntrySourceValues)
  source?: CreateDailyEntryRequest["source"];

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  rawContent!: string;

  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}
