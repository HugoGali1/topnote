import { ArrayMaxSize, IsArray, IsString, MaxLength, MinLength } from 'class-validator';

export class BulkFavoritesDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(120, { each: true })
  perfumeIds!: string[];
}
