import type { UpdateEventRequest } from "@digital-self/shared";
import { eventRecordStatusValues, eventTimePrecisionValues, eventTypeValues } from "@digital-self/shared";
import { Transform } from "class-transformer";
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class UpdateEventDto implements UpdateEventRequest {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() title?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsIn(eventTypeValues) eventType?: UpdateEventRequest["eventType"];
  @IsOptional() @IsDateString() occurredAt?: string;
  @IsOptional() @IsDateString() endedAt?: string | null;
  @IsOptional() @IsIn(eventTimePrecisionValues) timePrecision?: UpdateEventRequest["timePrecision"];
  @IsOptional() @IsIn(eventRecordStatusValues) recordStatus?: UpdateEventRequest["recordStatus"];
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() changeReason?: string;
}
