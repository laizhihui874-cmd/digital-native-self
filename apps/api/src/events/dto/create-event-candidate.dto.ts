import type { CreateEventCandidateRequest } from "@digital-self/shared";
import { eventTimePrecisionValues, eventTypeValues } from "@digital-self/shared";
import { Transform } from "class-transformer";
import { IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class CreateEventCandidateDto implements CreateEventCandidateRequest {
  @IsUUID() evidenceFragmentId!: string;
  @Transform(trim) @IsString() @IsNotEmpty() title!: string;
  @IsOptional() @Transform(trim) @IsString() description?: string;
  @IsIn(eventTypeValues) eventType!: CreateEventCandidateRequest["eventType"];
  @IsDateString() occurredAt!: string;
  @IsOptional() @IsIn(eventTimePrecisionValues) timePrecision?: CreateEventCandidateRequest["timePrecision"];
  @IsOptional() @IsNumber() @Min(0) @Max(1) confidence?: number;
}
