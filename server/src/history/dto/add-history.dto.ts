import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AddHistoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  query!: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}
