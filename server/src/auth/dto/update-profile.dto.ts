import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProfileDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(120)
  newPassword?: string;

  @IsOptional()
  @IsIn(['masculino', 'femenino', null])
  gender?: 'masculino' | 'femenino' | null;
}
