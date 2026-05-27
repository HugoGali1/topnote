import { ArrayMaxSize, IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RankCandidateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nombre!: string;

  @IsOptional() @IsString() @MaxLength(200)
  casa?: string;

  @IsOptional()
  ano?: number | string;

  @IsOptional() @IsString() @MaxLength(40)
  familia?: string;

  @IsOptional() @IsObject()
  notas?: { salida?: string[]; corazon?: string[]; fondo?: string[] };

  @IsOptional() @IsArray()
  acordes?: string[];

  @IsOptional() @IsArray()
  temporada?: string[];

  @IsOptional() @IsString() @MaxLength(20)
  genero?: string;

  @IsOptional()
  rating?: number;

  @IsOptional()
  rating_count?: number;

  @IsOptional() @IsArray()
  similares_a?: string[];
}

export class RankDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  query!: string;

  @IsOptional() @IsObject()
  filters?: { familia?: string; gender?: string; season?: string };

  @IsArray()
  @ArrayMaxSize(120)
  @ValidateNested({ each: true })
  @Type(() => RankCandidateDto)
  candidates!: RankCandidateDto[];
}
