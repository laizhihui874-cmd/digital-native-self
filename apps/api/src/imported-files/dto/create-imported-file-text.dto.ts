import type { CreateImportedFileTextRequest } from "@digital-self/shared";
import { importedFileTypeValues } from "@digital-self/shared";
import { Transform } from "class-transformer";
import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

const pastedTextFileTypeValues = importedFileTypeValues.filter(
  (value) => value === "txt" || value === "markdown",
);

export class CreateImportedFileTextDto implements CreateImportedFileTextRequest {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsIn(pastedTextFileTypeValues)
  fileType?: CreateImportedFileTextRequest["fileType"];

  @IsString()
  @IsNotEmpty()
  content!: string;
}
