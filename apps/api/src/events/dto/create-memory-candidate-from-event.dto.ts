import type { CreateMemoryCandidateFromEventRequest } from "@digital-self/shared";
import { Transform } from "class-transformer";
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

const allowedMemoryTypes = ["ability", "value", "relationship", "recurring_problem"] as const;
const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class CreateMemoryCandidateFromEventDto implements CreateMemoryCandidateFromEventRequest {
  @Transform(trim) @IsString() @IsNotEmpty() content!: string;
  @IsIn(allowedMemoryTypes) memoryType!: CreateMemoryCandidateFromEventRequest["memoryType"];
  @IsOptional() @IsNumber() @Min(0) @Max(1) confidence?: number;
}
