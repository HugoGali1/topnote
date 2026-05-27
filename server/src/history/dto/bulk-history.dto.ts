import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsObject, IsOptional, IsString,
  MaxLength, MinLength, ValidateNested,
} from 'class-validator';

export class HistoryEntryInputDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  query!: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}

export class BulkHistoryDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => HistoryEntryInputDto)
  entries!: HistoryEntryInputDto[];
}
