import { IsString, MaxLength, MinLength } from 'class-validator';

export class AddFavoriteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  perfumeId!: string;
}
