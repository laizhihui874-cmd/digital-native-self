import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { lifeGraphNodeTypeValues, type LifeGraphNodeType } from "@digital-self/shared";

function splitCommaSeparated(value: unknown): string[] | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return values.length > 0 ? values : undefined;
}

export class LifeGraphSubgraphQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  centerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  depth?: 1 | 2 | 3;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsDateString()
  asOf?: string;

  @IsOptional()
  @Transform(({ value }) => splitCommaSeparated(value))
  @IsArray()
  @IsIn(lifeGraphNodeTypeValues, { each: true })
  nodeTypes?: LifeGraphNodeType[];

  @IsOptional()
  @Transform(({ value }) => splitCommaSeparated(value))
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  statuses?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(20)
  @Max(800)
  limit?: number;
}
