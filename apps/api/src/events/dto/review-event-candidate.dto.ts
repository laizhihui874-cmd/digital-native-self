import type { ReviewEventCandidateRequest } from "@digital-self/shared";
import { eventTimePrecisionValues, eventTypeValues } from "@digital-self/shared";
import { Transform } from "class-transformer";
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class ReviewEventCandidateDto implements ReviewEventCandidateRequest {
  @IsIn(["confirmed", "rejected"] as const) status!: "confirmed" | "rejected";
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() title?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsIn(eventTypeValues) eventType?: ReviewEventCandidateRequest["eventType"];
  @IsOptional() @IsDateString() occurredAt?: string;
  @IsOptional() @IsIn(eventTimePrecisionValues) timePrecision?: ReviewEventCandidateRequest["timePrecision"];
}
