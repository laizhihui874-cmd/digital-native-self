import type { AppendParsedEvidenceRevisionRequest } from "@digital-self/shared";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class AppendParsedRevisionDto implements AppendParsedEvidenceRevisionRequest {
  @IsString() @IsNotEmpty() content!: string;
  @Transform(trim) @IsString() @IsNotEmpty() parserVersion!: string;
}
